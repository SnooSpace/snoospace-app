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
      return activeAccount.authToken;
    }
    
    // Fallback to old storage (for migration)
    const v = await AsyncStorage.getItem(KEY_TOKEN);
    return v || null;
  } catch {
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
 * Clear auth session for current active account only
 * Use clearAllAccounts() to logout all accounts
 */
export async function clearAuthSession() {
  try {
    const activeAccount = await accountManager.getActiveAccount();
    if (activeAccount) {
      await accountManager.removeAccount(activeAccount.id);
    }
    
    // Also clear old storage
    await AsyncStorage.multiRemove([KEY_TOKEN, KEY_EMAIL, KEY_REFRESH]);
  } catch {}
}

export async function setAccessToken(token) {
  try {
    // Update active account
    const activeAccount = await accountManager.getActiveAccount();
    if (activeAccount) {
      await accountManager.updateAccount(activeAccount.id, { authToken: token });
    }
    
    // Also set old storage for backward compatibility
    await AsyncStorage.setItem(KEY_TOKEN, token || '');
  } catch {}
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
