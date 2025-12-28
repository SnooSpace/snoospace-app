import AsyncStorage from "@react-native-async-storage/async-storage";
import { encryptToken, decryptToken, clearEncryptionKey } from "./encryption";

const ACCOUNTS_KEY = "@accounts";
const ACTIVE_ACCOUNT_KEY = "@activeAccountId";
const MAX_ACCOUNTS = 5;

/**
 * Account Manager
 * Handles storage and management of multiple user accounts
 * All IDs stored as strings to comply with AsyncStorage requirements
 */

/**
 * Get all saved accounts
 */
export async function getAllAccounts() {
  try {
    const accountsJson = await AsyncStorage.getItem(ACCOUNTS_KEY);
    console.log(
      "[getAllAccounts] Raw storage:",
      accountsJson
        ? `${accountsJson.length} chars, ${
            JSON.parse(accountsJson).length
          } accounts`
        : "EMPTY"
    );

    if (!accountsJson) return [];

    const accounts = JSON.parse(accountsJson);

    // Decrypt tokens for each account - skip corrupted ones
    const decryptedAccounts = [];
    for (const account of accounts) {
      try {
        const decryptedAccount = {
          ...account,
          // Ensure isLoggedIn defaults to true if not explicitly set to false
          // This handles older accounts that may not have this property
          isLoggedIn: account.isLoggedIn !== false,
          authToken: await decryptToken(account.authToken),
          refreshToken: account.refreshToken
            ? await decryptToken(account.refreshToken)
            : null,
        };
        decryptedAccounts.push(decryptedAccount);
        console.log(
          "[getAllAccounts] Decrypted account:",
          account.id,
          "tokenLength:",
          decryptedAccount.authToken?.length || "null",
          "refreshLength:",
          decryptedAccount.refreshToken?.length || "null",
          "isLoggedIn:",
          decryptedAccount.isLoggedIn
        );
      } catch (error) {
        console.error(
          `[getAllAccounts] Skipping corrupted account ${account.id}:`,
          error.message
        );
        // Skip this account - it's corrupted
      }
    }

    console.log(
      "[getAllAccounts] Returning",
      decryptedAccounts.length,
      "accounts"
    );
    return decryptedAccounts;
  } catch (error) {
    console.error("[getAllAccounts] Error loading accounts:", error);
    return [];
  }
}

/**
 * Get active account
 */
export async function getActiveAccount() {
  try {
    const activeId = await AsyncStorage.getItem(ACTIVE_ACCOUNT_KEY);
    if (!activeId) return null;

    const accounts = await getAllAccounts();
    // Support both old format (just id) and new format (type_id)
    return (
      accounts.find((acc) => {
        const compositeId = `${acc.type}_${acc.id}`;
        return compositeId === activeId || String(acc.id) === String(activeId);
      }) || null
    );
  } catch (error) {
    console.error("Error getting active account:", error);
    return null;
  }
}

/**
 * Add new account
 * @param {Object} accountData - { id, type, username, email, name, profilePicture, authToken, refreshToken }
 */
export async function addAccount(accountData) {
  try {
    // VALIDATION: Warn if refresh token is missing or too short
    if (!accountData.refreshToken) {
      console.warn(
        "[addAccount] ⚠️ NO REFRESH TOKEN provided for:",
        accountData.email
      );
      console.warn(
        "[addAccount] Account will not persist across token expiration!"
      );
    } else if (accountData.refreshToken.length < 20) {
      console.warn(
        "[addAccount] ⚠️ REFRESH TOKEN TOO SHORT for:",
        accountData.email,
        "length:",
        accountData.refreshToken.length
      );
      console.warn(
        "[addAccount] Expected 40+ chars for Supabase refresh token"
      );
    } else {
      console.log(
        "[addAccount] ✓ Valid refresh token for:",
        accountData.email,
        "length:",
        accountData.refreshToken.length
      );
    }

    console.log("[addAccount] Adding/updating account:", {
      id: accountData.id,
      email: accountData.email,
      type: accountData.type,
      authTokenLength: accountData.authToken?.length,
      refreshTokenLength: accountData.refreshToken?.length,
      isLoggedIn: accountData.isLoggedIn,
    });

    const accounts = await getAllAccounts();
    const accountId = String(accountData.id); // Always convert to string
    const accountType = accountData.type || "unknown";
    const compositeId = `${accountType}_${accountId}`;

    // Check if account already exists by BOTH type and id (handles same id across types)
    const existingIndex = accounts.findIndex((acc) => {
      const accCompositeId = `${acc.type}_${acc.id}`;
      return accCompositeId === compositeId;
    });

    // Check max limit (only if adding new account)
    if (existingIndex === -1 && accounts.length >= MAX_ACCOUNTS) {
      throw new Error(`Maximum ${MAX_ACCOUNTS} accounts allowed`);
    }

    // Encrypt tokens
    const encryptedAccount = {
      ...accountData,
      id: accountId, // Store as string
      authToken: await encryptToken(accountData.authToken),
      refreshToken: accountData.refreshToken
        ? await encryptToken(accountData.refreshToken)
        : null,
      unreadCount: accountData.unreadCount || 0,
      lastActive: Date.now(),
      isLoggedIn:
        accountData.isLoggedIn !== undefined ? accountData.isLoggedIn : true, // Default to logged in
    };

    let updatedAccounts;
    if (existingIndex !== -1) {
      // Update existing account
      updatedAccounts = [...accounts];
      updatedAccounts[existingIndex] = {
        ...updatedAccounts[existingIndex],
        ...encryptedAccount,
      };
    } else {
      // Add new account
      updatedAccounts = [...accounts, encryptedAccount];
    }

    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updatedAccounts));

    // Set as active account - use composite key for uniqueness
    const compositeActiveId = `${accountType}_${accountId}`;
    console.log("[addAccount] Setting active account to:", compositeActiveId);
    await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, compositeActiveId);

    // Verify it was set correctly
    const verifyActiveId = await AsyncStorage.getItem(ACTIVE_ACCOUNT_KEY);
    console.log("[addAccount] Verified active account ID:", verifyActiveId);

    if (verifyActiveId !== compositeActiveId) {
      console.error(
        "[addAccount] ⚠️ ACTIVE ACCOUNT MISMATCH! Expected:",
        compositeActiveId,
        "Got:",
        verifyActiveId
      );
    } else {
      console.log(
        "[addAccount] ✓ Active account successfully set to:",
        compositeActiveId
      );
    }

    return true;
  } catch (error) {
    console.error("Error adding account:", error);
    throw error;
  }
}

/**
 * Switch to different account
 * Validates that target account is logged in before switching
 */
export async function switchAccount(accountId) {
  try {
    console.log("[switchAccount] Starting switch to account:", accountId);
    const accounts = await getAllAccounts();
    const accountIdStr = String(accountId);

    // Support both composite key (type_id) and legacy (just id) formats
    const account = accounts.find((acc) => {
      const compositeId = `${acc.type}_${acc.id}`;
      return compositeId === accountIdStr || String(acc.id) === accountIdStr;
    });

    if (!account) {
      console.error("[switchAccount] Account not found");
      throw new Error("Account not found");
    }

    // Check if account is logged out
    if (account.isLoggedIn === false) {
      console.error("[switchAccount] Cannot switch to logged-out account");
      throw new Error("This account is logged out. Please log in again.");
    }

    console.log("[switchAccount] Found account:", {
      id: account.id,
      email: account.email,
      type: account.type,
      isLoggedIn: account.isLoggedIn,
      tokenLength: account.authToken?.length,
      refreshTokenLength: account.refreshToken?.length,
    });

    // Validate token before switching
    if (!account.authToken) {
      console.error("[switchAccount] Account has no auth token!");
      throw new Error("Account token is missing");
    }

    if (account.authToken.length < 100) {
      console.warn(
        "[switchAccount] ⚠️ Token seems unusually short:",
        account.authToken.length,
        "chars - may be corrupted"
      );
    }

    // Update last active time
    const compositeId = `${account.type}_${account.id}`;
    await updateAccount(compositeId, { lastActive: Date.now() });

    // Set as active using composite key
    await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, compositeId);
    console.log("[switchAccount] Set active account ID:", compositeId);

    // Double-check the active account after switch
    const verifyActiveAccount = await getActiveAccount();
    console.log("[switchAccount] Post-switch verification:", {
      activeId: verifyActiveAccount?.id,
      activeEmail: verifyActiveAccount?.email,
      activeTokenLength: verifyActiveAccount?.authToken?.length,
    });

    return account;
  } catch (error) {
    console.error("[switchAccount] Error switching account:", error);
    throw error;
  }
}

/**
 * Logout current account and switch to next available logged-in account
 * Returns: { switchToAccount, navigateToLanding }
 */
export async function logoutCurrentAccount() {
  try {
    const activeAccount = await getActiveAccount();
    if (!activeAccount) {
      return { switchToAccount: null, navigateToLanding: true };
    }

    const accounts = await getAllAccounts();
    const accountIdStr = String(activeAccount.id);

    // Mark current account as logged out
    await updateAccount(accountIdStr, { isLoggedIn: false });

    // Find next available logged-in account
    const nextAccount = accounts.find(
      (acc) => String(acc.id) !== accountIdStr && acc.isLoggedIn !== false
    );

    if (nextAccount) {
      // Switch to next account
      await switchAccount(nextAccount.id);
      return { switchToAccount: nextAccount, navigateToLanding: false };
    }

    // No other logged-in accounts available
    return { switchToAccount: null, navigateToLanding: true };
  } catch (error) {
    console.error("[logoutCurrentAccount] Error:", error);
    throw error;
  }
}

/**
 * Remove account
 * Prevents removing currently logged-in account
 */
export async function removeAccount(accountId) {
  try {
    const accounts = await getAllAccounts();
    const accountIdStr = String(accountId);
    const activeAccount = await getActiveAccount();

    // Prevent removing currently logged-in account
    if (
      activeAccount &&
      String(activeAccount.id) === accountIdStr &&
      activeAccount.isLoggedIn !== false
    ) {
      throw new Error(
        "Cannot remove currently logged-in account. Please logout first."
      );
    }

    const updatedAccounts = accounts.filter(
      (acc) => String(acc.id) !== accountIdStr
    );

    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updatedAccounts));

    // If removing active account, switch to first available logged-in account
    const activeId = await AsyncStorage.getItem(ACTIVE_ACCOUNT_KEY);
    if (String(activeId) === accountIdStr) {
      const nextLoggedIn = updatedAccounts.find(
        (acc) => acc.isLoggedIn !== false
      );
      if (nextLoggedIn) {
        await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, String(nextLoggedIn.id));
      } else if (updatedAccounts.length > 0) {
        await AsyncStorage.setItem(
          ACTIVE_ACCOUNT_KEY,
          String(updatedAccounts[0].id)
        );
      } else {
        await AsyncStorage.removeItem(ACTIVE_ACCOUNT_KEY);
      }
    }

    return true;
  } catch (error) {
    console.error("Error removing account:", error);
    throw error;
  }
}

/**
 * Update account data
 */
export async function updateAccount(accountId, updates) {
  try {
    const accountsJson = await AsyncStorage.getItem(ACCOUNTS_KEY);
    if (!accountsJson) return false;

    const accounts = JSON.parse(accountsJson);
    const accountIdStr = String(accountId);

    // Support both composite key (type_id) and legacy (just id) formats
    const accountIndex = accounts.findIndex((acc) => {
      const compositeId = `${acc.type}_${acc.id}`;
      return compositeId === accountIdStr || String(acc.id) === accountIdStr;
    });

    if (accountIndex === -1) {
      console.warn("[updateAccount] Account not found:", accountIdStr);
      return false;
    }

    // Log the update for debugging
    if (updates.authToken || updates.refreshToken) {
      const currentAccount = accounts[accountIndex];
      const currentTokenDecrypted = currentAccount.authToken
        ? await decryptToken(currentAccount.authToken)
        : null;

      console.log("[updateAccount] Updating account tokens:", {
        accountId: accountIdStr,
        accountEmail: currentAccount.email,
        currentTokenLength: currentTokenDecrypted?.length,
        newTokenLength: updates.authToken?.length,
        isUpdatingRefreshToken: !!updates.refreshToken,
      });
    }

    // Encrypt tokens if they're being updated
    if (updates.authToken) {
      updates.authToken = await encryptToken(updates.authToken);
    }
    if (updates.refreshToken) {
      updates.refreshToken = await encryptToken(updates.refreshToken);
    }

    accounts[accountIndex] = {
      ...accounts[accountIndex],
      ...updates,
    };

    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    return true;
  } catch (error) {
    console.error("[updateAccount] Error updating account:", error);
    return false;
  }
}

/**
 * Mark account as logged out with detailed logging
 * Use this instead of updateAccount({ isLoggedIn: false }) for better debugging
 * @param {string} accountId - Account ID
 * @param {string} reason - Why the account is being logged out
 * @param {string} source - Where this was called from (e.g., 'tokenRefresh', 'client.js')
 */
export async function markAccountLoggedOut(accountId, reason, source) {
  try {
    const accountsJson = await AsyncStorage.getItem(ACCOUNTS_KEY);
    if (!accountsJson) return false;

    const accounts = JSON.parse(accountsJson);
    const accountIdStr = String(accountId);

    const accountIndex = accounts.findIndex((acc) => {
      const compositeId = `${acc.type}_${acc.id}`;
      return compositeId === accountIdStr || String(acc.id) === accountIdStr;
    });

    if (accountIndex === -1) {
      console.warn("[markAccountLoggedOut] Account not found:", accountIdStr);
      return false;
    }

    const account = accounts[accountIndex];

    // CRITICAL LOG: Full trace of why account is being logged out
    console.error("🔴 =============== ACCOUNT LOGOUT EVENT =============== 🔴");
    console.error("[markAccountLoggedOut] Account being logged out:", {
      id: account.id,
      email: account.email,
      type: account.type,
      reason: reason,
      source: source,
      timestamp: new Date().toISOString(),
      wasAlreadyLoggedOut: account.isLoggedIn === false,
    });

    // Get stack trace for debugging
    const stack = new Error().stack;
    console.error("[markAccountLoggedOut] Call stack:", stack);
    console.error(
      "🔴 ===================================================== 🔴"
    );

    // Only update if not already logged out
    if (account.isLoggedIn === false) {
      console.log(
        "[markAccountLoggedOut] Account was already logged out, skipping"
      );
      return false;
    }

    accounts[accountIndex] = {
      ...accounts[accountIndex],
      isLoggedIn: false,
      loggedOutAt: Date.now(),
      logoutReason: reason,
      logoutSource: source,
    };

    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));

    // Emit event for global handling
    if (global.authEventEmitter) {
      global.authEventEmitter.emit("unexpectedLogout", {
        accountId: account.id,
        email: account.email,
        reason,
        source,
      });
    }

    return true;
  } catch (error) {
    console.error("[markAccountLoggedOut] Error:", error);
    return false;
  }
}

/**
 * Update unread count for account
 */
export async function updateUnreadCount(accountId, count) {
  return updateAccount(accountId, { unreadCount: count });
}

/**
 * Clear all accounts (logout all)
 */
export async function clearAllAccounts() {
  try {
    await AsyncStorage.removeItem(ACCOUNTS_KEY);
    await AsyncStorage.removeItem(ACTIVE_ACCOUNT_KEY);
    await clearEncryptionKey();
    return true;
  } catch (error) {
    console.error("Error clearing all accounts:", error);
    return false;
  }
}

/**
 * Migrate existing user to new multi-account system
 * Call this on app startup
 */
export async function migrateExistingUser() {
  try {
    // Check if already migrated
    const accounts = await getAllAccounts();
    if (accounts.length > 0) {
      return false; // Already migrated
    }

    // Check for old-style storage
    const oldToken = await AsyncStorage.getItem("@auth_token");
    const oldUserData = await AsyncStorage.getItem("@user_data");

    if (!oldToken || !oldUserData) {
      return false; // No old data to migrate
    }

    const userData = JSON.parse(oldUserData);

    // Migrate to new system
    await addAccount({
      id: String(userData.id), // Convert to string
      type: userData.type || "member",
      username: userData.username,
      email: userData.email,
      name: userData.name || userData.username,
      profilePicture:
        userData.profilePicture || userData.profile_picture || null,
      authToken: oldToken,
      refreshToken: null,
    });

    console.log("Successfully migrated existing user to multi-account system");
    return true;
  } catch (error) {
    console.error("Error migrating existing user:", error);
    return false;
  }
}

/**
 * Remove account by ID and auto-switch to next available logged-in account
 * Use this when permanently deleting an account
 * Returns: { removedAccount, switchedToAccount, navigateToLanding }
 */
export async function removeAccountAndAutoSwitch(accountId) {
  try {
    const accountsJson = await AsyncStorage.getItem(ACCOUNTS_KEY);
    if (!accountsJson) {
      console.log("[removeAccountAndAutoSwitch] No accounts in storage");
      return {
        removedAccount: null,
        switchedToAccount: null,
        navigateToLanding: true,
      };
    }

    const accounts = JSON.parse(accountsJson);
    const accountIdStr = String(accountId);

    // Find the account to remove
    const accountToRemove = accounts.find(
      (acc) => String(acc.id) === accountIdStr
    );
    if (!accountToRemove) {
      console.log(
        "[removeAccountAndAutoSwitch] Account not found:",
        accountIdStr
      );
      return {
        removedAccount: null,
        switchedToAccount: null,
        navigateToLanding: false,
      };
    }

    console.log(
      "[removeAccountAndAutoSwitch] Removing account:",
      accountToRemove.email
    );

    // Filter out the account (keep encrypted in storage)
    const remainingAccounts = accounts.filter(
      (acc) => String(acc.id) !== accountIdStr
    );

    // Find next logged-in account with valid tokens
    const decryptedRemaining = [];
    for (const acc of remainingAccounts) {
      try {
        const decrypted = {
          ...acc,
          authToken: acc.authToken ? await decryptToken(acc.authToken) : null,
          refreshToken: acc.refreshToken
            ? await decryptToken(acc.refreshToken)
            : null,
        };
        decryptedRemaining.push(decrypted);
      } catch {
        // Skip corrupted accounts
      }
    }

    const nextLoggedIn = decryptedRemaining.find(
      (acc) => acc.isLoggedIn !== false && acc.authToken
    );

    // Update storage with remaining accounts (encrypted)
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(remainingAccounts));
    console.log(
      "[removeAccountAndAutoSwitch] Remaining accounts:",
      remainingAccounts.length
    );

    // Handle active account switch
    const activeId = await AsyncStorage.getItem(ACTIVE_ACCOUNT_KEY);
    const wasActiveAccount =
      String(activeId) === accountIdStr ||
      activeId === `${accountToRemove.type}_${accountIdStr}`;

    if (wasActiveAccount || !activeId) {
      if (nextLoggedIn) {
        const compositeId = `${nextLoggedIn.type}_${nextLoggedIn.id}`;
        await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, compositeId);
        console.log(
          "[removeAccountAndAutoSwitch] Switched to:",
          nextLoggedIn.email
        );
        return {
          removedAccount: accountToRemove,
          switchedToAccount: nextLoggedIn,
          navigateToLanding: false,
        };
      } else {
        await AsyncStorage.removeItem(ACTIVE_ACCOUNT_KEY);
        console.log(
          "[removeAccountAndAutoSwitch] No other logged-in accounts, navigate to landing"
        );
        return {
          removedAccount: accountToRemove,
          switchedToAccount: null,
          navigateToLanding: true,
        };
      }
    }

    // Removed a non-active account, no navigation needed
    return {
      removedAccount: accountToRemove,
      switchedToAccount: null,
      navigateToLanding: false,
    };
  } catch (error) {
    console.error("[removeAccountAndAutoSwitch] Error:", error);
    throw error;
  }
}

export default {
  getAllAccounts,
  getActiveAccount,
  addAccount,
  switchAccount,
  removeAccount,
  removeAccountAndAutoSwitch,
  updateAccount,
  updateUnreadCount,
  clearAllAccounts,
  migrateExistingUser,
  logoutCurrentAccount,
  markAccountLoggedOut,
};
