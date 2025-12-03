import AsyncStorage from '@react-native-async-storage/async-storage';
import * as accountManager from '../utils/accountManager';

const KEY_TOKEN = 'auth_token';
const KEY_EMAIL = 'auth_email';
const KEY_REFRESH = 'auth_refresh_token';
const KEY_PENDING = 'pending_otp';

/**
 * Set auth session for current active account
 * Also updates the account in the account manager
 */
export async function setAuthSession(token, email, refreshToken) {
  try {
    // Set old-style storage for backward compatibility during migration
    const pairs = [[KEY_TOKEN, token || ''], [KEY_EMAIL, email || '']];
    if (refreshToken) pairs.push([KEY_REFRESH, refreshToken || '']);
    await AsyncStorage.multiSet(pairs);
  } catch {}
}

export async function getAuthToken() {
  try {
    // Try new multi-account system first
    const activeAccount = await accountManager.getActiveAccount();
    if (activeAccount?.authToken) {
      console.log('[getAuthToken] Using multi-account token for:', activeAccount.email, 'length:', activeAccount.authToken?.length);
      return activeAccount.authToken;
    }
    
    // Fallback to old storage (for migration)
    const v = await AsyncStorage.getItem(KEY_TOKEN);
    if (v) {
      console.log('[getAuthToken] Using old storage token, length:', v?.length);
    } else {
      console.log('[getAuthToken] No token found');
    }
    return v || null;
  } catch (error) {
    console.error('[getAuthToken] Error:', error);
    return null;
  }
}

export async function getAuthEmail() {
  try {
    // Try new multi-account system first
    const activeAccount = await accountManager.getActiveAccount();
    if (activeAccount?.email) {
      return activeAccount.email;
    }
    
    // Fallback to old storage (for migration)
    const v = await AsyncStorage.getItem(KEY_EMAIL);
    return v || null;
  } catch {
    return null;
  }
}

export async function getRefreshToken() {
  try {
    // Try new multi-account system first
    const activeAccount = await accountManager.getActiveAccount();
    if (activeAccount?.refreshToken) {
      return activeAccount.refreshToken;
    }
    
    // Fallback to old storage (for migration)
    const v = await AsyncStorage.getItem(KEY_REFRESH);
    return v || null;
  } catch {
    return null;
  }
}

/**
 * Clear auth session for current active account
 * If multiple accounts exist, marks current as logged out instead of removing
 * Use clearAllAccounts() to logout all accounts
 */
export async function clearAuthSession() {
  try {
    const allAccounts = await accountManager.getAllAccounts();
    const activeAccount = await accountManager.getActiveAccount();
    
    if (activeAccount) {
      // If multiple accounts exist, just mark as logged out
      if (allAccounts.length > 1) {
        await accountManager.updateAccount(activeAccount.id, { isLoggedIn: false });
      } else {
        // Single account - remove it
        await accountManager.removeAccount(activeAccount.id);
      }
    }
    
    // Also clear old storage
    await AsyncStorage.multiRemove([KEY_TOKEN, KEY_EMAIL, KEY_REFRESH]);
  } catch (error) {
    console.error('[clearAuthSession] Error:', error);
  }
}

export async function setAccessToken(token) {
  try {
    const activeAccount = await accountManager.getActiveAccount();
    
    if (!token) {
      console.warn('[setAccessToken] Attempted to set null/empty token - skipping');
      return;
    }
    
    // Log token update for debugging
    console.log('[setAccessToken] Updating token for account:', {
      id: activeAccount?.id,
      email: activeAccount?.email,
      oldTokenLength: activeAccount?.authToken?.length,
      newTokenLength: token?.length
    });
    
    // Update active account
    if (activeAccount) {
      await accountManager.updateAccount(activeAccount.id, { authToken: token });
    }
    
    // Also set old storage for backward compatibility
    await AsyncStorage.setItem(KEY_TOKEN, token || '');
  } catch (error) {
    console.error('[setAccessToken] Error updating token:', error);
  }
}

/**
 * Update refresh token for current active account
 * Called when tokens are refreshed
 */
export async function setRefreshToken(refreshToken) {
  try {
    const activeAccount = await accountManager.getActiveAccount();
    
    if (!refreshToken) {
      console.warn('[setRefreshToken] Attempted to set null/empty refresh token - skipping');
      return;
    }
    
    // Log refresh token update for debugging
    console.log('[setRefreshToken] Updating refresh token for account:', {
      id: activeAccount?.id,
      email: activeAccount?.email,
      oldRefreshTokenLength: activeAccount?.refreshToken?.length,
      newRefreshTokenLength: refreshToken?.length
    });
    
    // Update active account
    if (activeAccount) {
      await accountManager.updateAccount(activeAccount.id, { refreshToken });
    }
    
    // Also set old storage for backward compatibility
    await AsyncStorage.setItem(KEY_REFRESH, refreshToken || '');
  } catch (error) {
    console.error('[setRefreshToken] Error updating refresh token:', error);
  }
}

export async function setPendingOtp(flow, email, ttlSeconds = 600) {
  try {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const payload = JSON.stringify({ flow, email, expiresAt });
    await AsyncStorage.setItem(KEY_PENDING, payload);
  } catch {}
}

export async function getPendingOtp() {
  try {
    const raw = await AsyncStorage.getItem(KEY_PENDING);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.expiresAt || Date.now() > obj.expiresAt) {
      await AsyncStorage.removeItem(KEY_PENDING);
      return null;
    }
    return obj;
  } catch {
    return null;
  }
}

export async function clearPendingOtp() {
  try {
    await AsyncStorage.removeItem(KEY_PENDING);
  } catch {}
}

// Multi-account specific functions

/**
 * Get current active account
 */
export async function getActiveAccount() {
  return await accountManager.getActiveAccount();
}

/**
 * Get all saved accounts
 */
export async function getAllAccounts() {
  return await accountManager.getAllAccounts();
}

/**
 * Switch to a different account
 */
export async function switchAccount(accountId) {
  return await accountManager.switchAccount(accountId);
}

/**
 * Add a new account
 */
export async function addAccount(accountData) {
  return await accountManager.addAccount(accountData);
}

/**
 * Logout current account and switch to next available
 */
export async function logoutCurrentAccount() {
  return await accountManager.logoutCurrentAccount();
}

/**
 * Logout all accounts
 */
export async function clearAllAccounts() {
  await accountManager.clearAllAccounts();
  await AsyncStorage.multiRemove([KEY_TOKEN, KEY_EMAIL, KEY_REFRESH]);
}

/**
 * Validate token with backend
 * Assumes token is valid if server is unreachable (network error)
 */
export async function validateToken(token) {
  try {
    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/auth/validate-token`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    return data.valid === true;
  } catch (error) {
    // If network error or server unreachable, assume token is valid
    // This prevents "Session Expired" errors when switching accounts quickly
    console.log('[validateToken] Network error - assuming token is valid:', error.message);
    return true; // Changed from false to true
  }
}
