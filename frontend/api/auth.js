import AsyncStorage from "@react-native-async-storage/async-storage";
import * as accountManager from "../utils/accountManager";

const KEY_TOKEN = "auth_token";
const KEY_EMAIL = "auth_email";
const KEY_REFRESH = "auth_refresh_token";
const KEY_PENDING = "pending_otp";

/**
 * Set auth session for current active account
 * Also updates the account in the account manager
 */
export async function setAuthSession(token, email, refreshToken) {
  try {
    // Set old-style storage for backward compatibility during migration
    const pairs = [
      [KEY_TOKEN, token || ""],
      [KEY_EMAIL, email || ""],
    ];
    if (refreshToken) pairs.push([KEY_REFRESH, refreshToken || ""]);
    await AsyncStorage.multiSet(pairs);
  } catch {}
}

export async function getAuthToken() {
  try {
    // Try new multi-account system first
    const activeAccount = await accountManager.getActiveAccount();

    // Check if active account is logged in AND has a token
    if (activeAccount?.authToken && activeAccount.isLoggedIn !== false) {
      console.log(
        "[getAuthToken] Using multi-account token for:",
        activeAccount.email,
        "length:",
        activeAccount.authToken?.length
      );
      return activeAccount.authToken;
    }

    // Active account is logged out - DO NOT auto-switch to avoid UI mismatch
    // Instead, return null and let the caller handle the session expiry
    if (activeAccount && activeAccount.isLoggedIn === false) {
      console.log(
        "[getAuthToken] Active account is logged out:",
        activeAccount.email
      );
      console.log(
        "[getAuthToken] Returning null - caller should handle session expiry"
      );
      return null;
    }

    // Fallback to old storage (for migration)
    const v = await AsyncStorage.getItem(KEY_TOKEN);
    if (v) {
      console.log("[getAuthToken] Using old storage token, length:", v?.length);
    } else {
      console.log("[getAuthToken] No logged-in account found");
    }
    return v || null;
  } catch (error) {
    console.error("[getAuthToken] Error:", error);
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

/**
 * Check if the active account needs re-authentication
 * Returns the account info if re-auth is needed, null otherwise
 */
export async function checkActiveAccountNeedsReauth() {
  try {
    const activeAccount = await accountManager.getActiveAccount();
    if (activeAccount && activeAccount.isLoggedIn === false) {
      return activeAccount;
    }
    return null;
  } catch (error) {
    console.error("[checkActiveAccountNeedsReauth] Error:", error);
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
        await accountManager.updateAccount(activeAccount.id, {
          isLoggedIn: false,
        });
      } else {
        // Single account - remove it
        await accountManager.removeAccount(activeAccount.id);
      }
    }

    // Also clear old storage
    await AsyncStorage.multiRemove([KEY_TOKEN, KEY_EMAIL, KEY_REFRESH]);
  } catch (error) {
    console.error("[clearAuthSession] Error:", error);
  }
}

export async function setAccessToken(token) {
  try {
    const activeAccount = await accountManager.getActiveAccount();

    if (!token) {
      console.warn(
        "[setAccessToken] Attempted to set null/empty token - skipping"
      );
      return;
    }

    // Log token update for debugging
    console.log("[setAccessToken] Updating token for account:", {
      id: activeAccount?.id,
      email: activeAccount?.email,
      oldTokenLength: activeAccount?.authToken?.length,
      newTokenLength: token?.length,
    });

    // Update active account
    if (activeAccount) {
      await accountManager.updateAccount(activeAccount.id, {
        authToken: token,
      });
    }

    // Also set old storage for backward compatibility
    await AsyncStorage.setItem(KEY_TOKEN, token || "");
  } catch (error) {
    console.error("[setAccessToken] Error updating token:", error);
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
      console.warn(
        "[setRefreshToken] Attempted to set null/empty refresh token - skipping"
      );
      return;
    }

    // Log refresh token update for debugging
    console.log("[setRefreshToken] Updating refresh token for account:", {
      id: activeAccount?.id,
      email: activeAccount?.email,
      oldRefreshTokenLength: activeAccount?.refreshToken?.length,
      newRefreshTokenLength: refreshToken?.length,
    });

    // Update active account
    if (activeAccount) {
      await accountManager.updateAccount(activeAccount.id, { refreshToken });
    }

    // Also set old storage for backward compatibility
    await AsyncStorage.setItem(KEY_REFRESH, refreshToken || "");
  } catch (error) {
    console.error("[setRefreshToken] Error updating refresh token:", error);
  }
}

/**
 * Update both access and refresh tokens atomically for a specific account
 * This prevents race conditions when switching accounts during token refresh
 * @param {string} accountId - The specific account ID to update tokens for
 * @param {string} accessToken - New access token (optional)
 * @param {string} refreshToken - New refresh token (optional)
 */
export async function updateAccountTokens(
  accountId,
  accessToken,
  refreshToken
) {
  try {
    if (!accountId) {
      console.warn("[updateAccountTokens] No account ID provided");
      return;
    }

    const updates = {};
    if (accessToken) updates.authToken = accessToken;
    if (refreshToken) updates.refreshToken = refreshToken;

    if (Object.keys(updates).length > 0) {
      console.log("[updateAccountTokens] Updating tokens for account:", {
        accountId,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        accessTokenLength: accessToken?.length,
        refreshTokenLength: refreshToken?.length,
      });
      await accountManager.updateAccount(accountId, updates);
    }

    // Also update legacy storage for backward compatibility
    if (accessToken) {
      await AsyncStorage.setItem(KEY_TOKEN, accessToken);
    }
    if (refreshToken) {
      await AsyncStorage.setItem(KEY_REFRESH, refreshToken);
    }
  } catch (error) {
    console.error("[updateAccountTokens] Error updating tokens:", error);
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

// --- Active Signup Tracking (for crash resume with new email) ---
const KEY_ACTIVE_SIGNUP = "active_signup";

/**
 * Set active signup data when starting a new signup flow
 * This is used for crash resume when the signup email differs from logged-in email
 */
export async function setActiveSignup(email, profileId) {
  try {
    const payload = JSON.stringify({
      email,
      profileId,
      startedAt: Date.now(),
    });
    await AsyncStorage.setItem(KEY_ACTIVE_SIGNUP, payload);
    console.log(
      "[setActiveSignup] Stored active signup for:",
      email,
      "profileId:",
      profileId
    );
  } catch (e) {
    console.log("[setActiveSignup] Failed:", e.message);
  }
}

/**
 * Get active signup data (for crash resume)
 * Returns null if no active signup or if expired (24 hours)
 */
export async function getActiveSignup() {
  try {
    const raw = await AsyncStorage.getItem(KEY_ACTIVE_SIGNUP);
    if (!raw) return null;

    const obj = JSON.parse(raw);
    // Expire after 24 hours
    const ttl = 24 * 60 * 60 * 1000;
    if (!obj.startedAt || Date.now() - obj.startedAt > ttl) {
      await clearActiveSignup();
      return null;
    }

    console.log("[getActiveSignup] Found active signup:", obj.email);
    return obj;
  } catch {
    return null;
  }
}

/**
 * Clear active signup data (when signup is completed or cancelled)
 */
export async function clearActiveSignup() {
  try {
    await AsyncStorage.removeItem(KEY_ACTIVE_SIGNUP);
    console.log("[clearActiveSignup] Cleared");
  } catch {}
}

/**
 * Check if any accounts exist for this email
 * Used to warn users during signup that they already have accounts
 * @param {string} email - Email to check
 * @returns {Promise<boolean>} True if accounts exist, false otherwise
 */
export async function checkEmailExists(email) {
  try {
    const { BACKEND_BASE_URL } = require("./client");
    console.log(
      "[checkEmailExists] Checking email:",
      email,
      "URL:",
      `${BACKEND_BASE_URL}/auth/check-email`
    );

    const response = await fetch(`${BACKEND_BASE_URL}/auth/check-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.toLowerCase().trim() }),
    });

    console.log("[checkEmailExists] Response status:", response.status);

    if (!response.ok) {
      console.log("[checkEmailExists] API error:", response.status);
      return false;
    }

    const data = await response.json();
    console.log("[checkEmailExists] Response data:", data);
    return data.exists === true;
  } catch (error) {
    console.error("[checkEmailExists] Error:", error);
    return false; // On error, allow proceeding
  }
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
 * Remove account and auto-switch to next logged-in account
 * Use this when permanently deleting an account
 */
export async function removeAccountAndAutoSwitch(accountId) {
  return await accountManager.removeAccountAndAutoSwitch(accountId);
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
 * On network error, checks JWT expiration locally
 */
export async function validateToken(token) {
  if (!token) {
    console.log("[validateToken] No token provided");
    return false;
  }

  try {
    const response = await fetch(
      `${
        process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"
      }/auth/validate-token`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.log("[validateToken] Token invalid:", response.status);
      return false;
    }

    const data = await response.json();
    return data.valid === true;
  } catch (error) {
    // On network error, try to decode JWT and check expiration locally
    console.log(
      "[validateToken] Network error, checking JWT expiry locally:",
      error.message
    );

    try {
      // JWT format: header.payload.signature
      const parts = token.split(".");
      if (parts.length !== 3) {
        console.warn("[validateToken] Invalid JWT format");
        return false;
      }

      // Decode payload (base64)
      const payload = JSON.parse(atob(parts[1]));

      if (!payload.exp) {
        console.warn("[validateToken] No expiration in token");
        return false;
      }

      const exp = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const isExpired = exp < now;

      if (isExpired) {
        console.log("[validateToken] Token expired locally");
      } else {
        const minutesUntilExpiry = Math.floor((exp - now) / (60 * 1000));
        console.log(
          `[validateToken] Token valid for ${minutesUntilExpiry} more minutes`
        );
      }

      return !isExpired;
    } catch (decodeError) {
      console.error("[validateToken] Cannot decode token:", decodeError);
      return false;
    }
  }
}
