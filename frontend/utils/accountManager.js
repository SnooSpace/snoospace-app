import AsyncStorage from "@react-native-async-storage/async-storage";
import { encryptToken, decryptToken, clearEncryptionKey } from "./encryption";
import authEventEmitter from "./authEventEmitter";
import LikeStateManager from "./LikeStateManager";
import { viewQueueService } from "../services/ViewQueueService";
import { incrementAccountSwitchGeneration } from "../api/client";
import {
  getAllAccounts,
  getActiveAccount,
  ACCOUNTS_KEY,
  ACTIVE_ACCOUNT_KEY
} from "./accountStorage";

export { getAllAccounts, getActiveAccount };

const MAX_ACCOUNTS = 5;

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
        accountData.email,
      );
      console.warn(
        "[addAccount] Account will not persist across token expiration!",
      );
    } else if (accountData.refreshToken.length < 20) {
      console.warn(
        "[addAccount] ⚠️ REFRESH TOKEN TOO SHORT for:",
        accountData.email,
        "length:",
        accountData.refreshToken.length,
      );
      console.warn(
        "[addAccount] Expected 40+ chars for Supabase refresh token",
      );
    } else {
      console.log(
        "[addAccount] ✓ Valid refresh token for:",
        accountData.email,
        "length:",
        accountData.refreshToken.length,
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

    // CRITICAL FIX: Read raw JSON to preserve other accounts' encrypted tokens
    // Previously we called getAllAccounts() which DECRYPTS all tokens, then saved
    // them back as plaintext - corrupting other accounts' tokens!
    const accountsJson = await AsyncStorage.getItem(ACCOUNTS_KEY);
    let accounts = accountsJson ? JSON.parse(accountsJson) : [];
    const accountId = String(accountData.id); // Always convert to string
    const accountType = accountData.type || "unknown";
    const compositeId = `${accountType}_${accountId}`;

    // Check if account already exists by BOTH type and id (handles same id across types)
    const existingIndex = accounts.findIndex((acc) => {
      const accCompositeId = `${acc.type}_${acc.id}`;
      return accCompositeId === compositeId;
    });

    // Purge invalid accounts (decryptToken returns null on failure, never throws).
    if (existingIndex === -1) {
      const validAccounts = [];
      for (const acc of accounts) {
        const decrypted = await decryptToken(acc.authToken);
        if (decrypted && decrypted.length > 0) {
          validAccounts.push(acc);
        } else {
          console.warn(
            "[addAccount] Removing invalid account:",
            acc.id, acc.type, acc.email,
          );
        }
      }
      if (validAccounts.length !== accounts.length) {
        accounts = validAccounts;
        await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
      }
    }

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

    // IMPORTANT: dispatch asynchronously (see switchAccount for full rationale).
    // Utility modules must not synchronously trigger global React state updates.
    if (authEventEmitter) {
      setImmediate(() => {
        authEventEmitter.emit("accountSwitched", {
          accountId: accountId,
          email: accountData.email,
          type: accountType,
        });
      });
    }

    // Verify it was set correctly
    const verifyActiveId = await AsyncStorage.getItem(ACTIVE_ACCOUNT_KEY);
    console.log("[addAccount] Verified active account ID:", verifyActiveId);

    if (verifyActiveId !== compositeActiveId) {
      console.error(
        "[addAccount] ⚠️ ACTIVE ACCOUNT MISMATCH! Expected:",
        compositeActiveId,
        "Got:",
        verifyActiveId,
      );
    } else {
      console.log(
        "[addAccount] ✓ Active account successfully set to:",
        compositeActiveId,
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
  const switchStart = Date.now();

  try {
    console.log(`[switchAccount] [${Date.now() - switchStart}ms] START: Switching to account ID:`, accountId);

    // Step 1: Get previous active account
    let previousAccount;
    console.log(`[switchAccount] [${Date.now() - switchStart}ms] Step 1: Awaiting getActiveAccount()...`);
    try {
      previousAccount = await getActiveAccount();
      console.log(`[switchAccount] [${Date.now() - switchStart}ms] Step 1: Active account returned:`, previousAccount?.id);
    } catch (e) {
      console.error(`[switchAccount] [${Date.now() - switchStart}ms] Failed inside getActiveAccount()`, e);
      throw e;
    }

    if (previousAccount) {
      // Step 2: Clear like cache
      console.log(`[switchAccount] [${Date.now() - switchStart}ms] Step 2: Clearing like cache...`);
      try {
        LikeStateManager.clearAccountCache(
          previousAccount.type,
          previousAccount.id,
        );
        console.log(`[switchAccount] [${Date.now() - switchStart}ms] Step 2: Cleared like cache.`);
      } catch (e) {
        console.error(`[switchAccount] [${Date.now() - switchStart}ms] Failed inside LikeStateManager.clearAccountCache()`, e);
        throw e;
      }

      // Step 3: Clear viewed posts cache
      console.log(`[switchAccount] [${Date.now() - switchStart}ms] Step 3: Awaiting viewQueueService.resetForAccountSwitch()...`);
      try {
        await viewQueueService.resetForAccountSwitch();
        console.log(`[switchAccount] [${Date.now() - switchStart}ms] Step 3: Reset viewed posts cache complete.`);
      } catch (e) {
        console.error(`[switchAccount] [${Date.now() - switchStart}ms] Failed inside viewQueueService.resetForAccountSwitch()`, e);
        throw e;
      }
    }

    // Step 4: Increment generation
    let newGeneration;
    console.log(`[switchAccount] [${Date.now() - switchStart}ms] Step 4: Incrementing generation...`);
    try {
      newGeneration = incrementAccountSwitchGeneration();
      console.log(`[switchAccount] [${Date.now() - switchStart}ms] Step 4: Generation incremented to:`, newGeneration);
    } catch (e) {
      console.error(`[switchAccount] [${Date.now() - switchStart}ms] Failed inside incrementAccountSwitchGeneration()`, e);
      throw e;
    }

    // Step 5: Get all accounts
    let accounts;
    console.log(`[switchAccount] [${Date.now() - switchStart}ms] Step 5: Awaiting getAllAccounts()...`);
    try {
      accounts = await getAllAccounts();
      console.log(`[switchAccount] [${Date.now() - switchStart}ms] Step 5: Found ${accounts.length} stored accounts.`);
    } catch (e) {
      console.error(`[switchAccount] [${Date.now() - switchStart}ms] Failed inside getAllAccounts()`, e);
      throw e;
    }

    const accountIdStr = String(accountId);
    const account = accounts.find((acc) => {
      const compositeId = `${acc.type}_${acc.id}`;
      return compositeId === accountIdStr || String(acc.id) === accountIdStr;
    });

    if (!account) {
      console.error(`[switchAccount] [${Date.now() - switchStart}ms] ERROR: Target account not found in list`);
      throw new Error("Account not found");
    }

    // Step 6: Validate target account state
    console.log(`[switchAccount] [${Date.now() - switchStart}ms] Step 6: Validating target account login status for:`, account.email);
    if (account.isLoggedIn === false) {
      throw new Error("This account is logged out. Please log in again.");
    }
    if (!account.authToken) {
      throw new Error("Account token is missing");
    }

    // Step 7: Update active account record in storage
    const compositeId = `${account.type}_${account.id}`;
    console.log(`[switchAccount] [${Date.now() - switchStart}ms] Step 7.1: Awaiting updateAccount...`);
    try {
      await updateAccount(compositeId, { lastActive: Date.now() });
      console.log(`[switchAccount] [${Date.now() - switchStart}ms] Step 7.1: updateAccount complete.`);
    } catch (e) {
      console.error(`[switchAccount] [${Date.now() - switchStart}ms] Failed inside updateAccount()`, e);
      throw e;
    }

    console.log(`[switchAccount] [${Date.now() - switchStart}ms] Step 7.2: Awaiting AsyncStorage.setItem ACTIVE_ACCOUNT_KEY...`);
    try {
      await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, compositeId);
      console.log(`[switchAccount] [${Date.now() - switchStart}ms] Step 7.2: ACTIVE_ACCOUNT_KEY successfully written.`);
    } catch (e) {
      console.error(`[switchAccount] [${Date.now() - switchStart}ms] Failed inside AsyncStorage.setItem() for ACTIVE_ACCOUNT_KEY`, e);
      throw e;
    }

    // Step 8: Emit event for global handling
    console.log(`[switchAccount] [${Date.now() - switchStart}ms] Step 8: Scheduling accountSwitched event emit...`);
    if (authEventEmitter) {
      console.log(`[switchAccount] [${Date.now() - switchStart}ms] Step 8.1: Calling setImmediate...`);
      setImmediate(() => {
        console.log(`[switchAccount] [${Date.now() - switchStart}ms] setImmediate START: Emitting accountSwitched for:`, account.email);
        try {
          authEventEmitter.emit("accountSwitched", {
            accountId: account.id,
            email: account.email,
            type: account.type,
          });
          console.log(`[switchAccount] [${Date.now() - switchStart}ms] setImmediate FINISH: accountSwitched event emitted.`);
        } catch (e) {
          console.error(`[switchAccount] [${Date.now() - switchStart}ms] setImmediate ERROR emitting accountSwitched:`, e);
          console.error(e.stack);
          console.dir(e);
          console.error(Object.getOwnPropertyNames(e));
        }
      });
      console.log(`[switchAccount] [${Date.now() - switchStart}ms] Step 8.2: setImmediate scheduled.`);
    }

    console.log(`[switchAccount] [${Date.now() - switchStart}ms] SUCCESS: Switch complete for:`, account.email);
    return account;
  } catch (error) {
    console.error(`[switchAccount] [${Date.now() - switchStart}ms] CATCH: ERROR during switch account:`, error);
    if (error) {
      console.error("[switchAccount] Error details stack:", error.stack);
      console.dir(error);
      console.error("[switchAccount] Error details properties:", Object.getOwnPropertyNames(error));
    }
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

    // Clear like cache for this account
    LikeStateManager.clearAccountCache(activeAccount.type, activeAccount.id);
    console.log(
      "[logoutCurrentAccount] Cleared like cache for:",
      activeAccount.type,
      activeAccount.id,
    );

    const accounts = await getAllAccounts();

    // CRITICAL: Use composite key to prevent ID collisions (e.g., member_28 vs community_28)
    const accountCompositeId = `${activeAccount.type}_${activeAccount.id}`;

    // Mark current account as logged out using composite key
    await updateAccount(accountCompositeId, { isLoggedIn: false });

    // Find next available logged-in account - compare by composite key
    const nextAccount = accounts.find(
      (acc) =>
        `${acc.type}_${acc.id}` !== accountCompositeId &&
        acc.isLoggedIn !== false,
    );

    if (nextAccount) {
      // Switch to next account using composite key
      const nextCompositeId = `${nextAccount.type}_${nextAccount.id}`;
      await switchAccount(nextCompositeId);
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
 * @param {string} accountId - Should be composite key (type_id) format for safety
 */
export async function removeAccount(accountId) {
  try {
    // CRITICAL FIX: Read raw JSON to preserve other accounts' encrypted tokens
    const accountsJson = await AsyncStorage.getItem(ACCOUNTS_KEY);
    if (!accountsJson) return false;
    const accounts = JSON.parse(accountsJson);

    const accountIdStr = String(accountId);
    const activeAccount = await getActiveAccount();

    // Build composite key for active account for proper comparison
    const activeCompositeId = activeAccount
      ? `${activeAccount.type}_${activeAccount.id}`
      : null;

    // Prevent removing currently logged-in account - use composite key comparison
    if (
      activeAccount &&
      (activeCompositeId === accountIdStr ||
        String(activeAccount.id) === accountIdStr) &&
      activeAccount.isLoggedIn !== false
    ) {
      throw new Error(
        "Cannot remove currently logged-in account. Please logout first.",
      );
    }

    // CRITICAL: Filter using composite key to prevent removing wrong account
    // when member_28 and community_28 exist
    const updatedAccounts = accounts.filter((acc) => {
      const accCompositeId = `${acc.type}_${acc.id}`;
      // Keep accounts that DON'T match the ID being removed
      // Support both composite key and legacy plain ID formats
      return accCompositeId !== accountIdStr && String(acc.id) !== accountIdStr;
    });

    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updatedAccounts));

    // If removing active account, switch to first available logged-in account
    const activeId = await AsyncStorage.getItem(ACTIVE_ACCOUNT_KEY);
    if (activeId === accountIdStr || String(activeId) === accountIdStr) {
      const nextLoggedIn = updatedAccounts.find(
        (acc) => acc.isLoggedIn !== false,
      );
      if (nextLoggedIn) {
        // Use composite key for new active account
        const nextCompositeId = `${nextLoggedIn.type}_${nextLoggedIn.id}`;
        await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, nextCompositeId);

        // IMPORTANT: dispatch asynchronously (see switchAccount for full rationale).
    // Utility modules must not synchronously trigger global React state updates.
        if (authEventEmitter) {
          setImmediate(() => {
            authEventEmitter.emit("accountSwitched", {
              accountId: nextLoggedIn.id,
              email: nextLoggedIn.email,
              type: nextLoggedIn.type,
            });
          });
        }
      } else if (updatedAccounts.length > 0) {
        const firstCompositeId = `${updatedAccounts[0].type}_${updatedAccounts[0].id}`;
        await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, firstCompositeId);
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
 * @param {string} accountId - Should be composite key (type_id) format for safety
 * @param {Object} updates - Fields to update
 */
export async function updateAccount(accountId, updates) {
  try {
    const accountsJson = await AsyncStorage.getItem(ACCOUNTS_KEY);
    if (!accountsJson) return false;

    const accounts = JSON.parse(accountsJson);
    const accountIdStr = String(accountId);

    // CRITICAL: Prefer composite key matching to prevent ID collisions
    // e.g., member_28 should NOT match community_28
    // Legacy plain ID fallback is kept but logged as warning
    let accountIndex = accounts.findIndex((acc) => {
      const compositeId = `${acc.type}_${acc.id}`;
      return compositeId === accountIdStr;
    });

    // Legacy fallback - only if composite key didn't match and ID looks like plain number
    if (accountIndex === -1 && !accountIdStr.includes("_")) {
      console.warn(
        `[updateAccount] ⚠️ Using legacy plain ID match for: ${accountIdStr}. ` +
          `This may cause issues if multiple account types share this ID.`,
      );
      accountIndex = accounts.findIndex(
        (acc) => String(acc.id) === accountIdStr,
      );
    }

    if (accountIndex === -1) {
      console.warn("[updateAccount] Account not found:", accountIdStr);
      return false;
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

    // CRITICAL: Prefer composite key matching to prevent ID collisions
    // e.g., member_28 should NOT match community_28
    let accountIndex = accounts.findIndex((acc) => {
      const compositeId = `${acc.type}_${acc.id}`;
      return compositeId === accountIdStr;
    });

    // Legacy fallback - only if composite key didn't match and ID looks like plain number
    if (accountIndex === -1 && !accountIdStr.includes("_")) {
      console.warn(
        `[markAccountLoggedOut] ⚠️ Using legacy plain ID match for: ${accountIdStr}. ` +
          `This may cause issues if multiple account types share this ID.`,
      );
      accountIndex = accounts.findIndex(
        (acc) => String(acc.id) === accountIdStr,
      );
    }

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
      "🔴 ===================================================== 🔴",
    );

    // Only update if not already logged out
    if (account.isLoggedIn === false) {
      console.log(
        "[markAccountLoggedOut] Account was already logged out, skipping",
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
    if (authEventEmitter) {
      authEventEmitter.emit("unexpectedLogout", {
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

    // IMPORTANT: dispatch asynchronously (see switchAccount for full rationale).
    // Utility modules must not synchronously trigger global React state updates.
    if (authEventEmitter) {
      setImmediate(() => {
        authEventEmitter.emit("accountSwitched", null);
      });
    }

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
      (acc) => String(acc.id) === accountIdStr,
    );
    if (!accountToRemove) {
      console.log(
        "[removeAccountAndAutoSwitch] Account not found:",
        accountIdStr,
      );
      return {
        removedAccount: null,
        switchedToAccount: null,
        navigateToLanding: false,
      };
    }

    console.log(
      "[removeAccountAndAutoSwitch] Removing account:",
      accountToRemove.email,
    );

    // Filter out the account (keep encrypted in storage)
    const remainingAccounts = accounts.filter(
      (acc) => String(acc.id) !== accountIdStr,
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
      (acc) => acc.isLoggedIn !== false && acc.authToken,
    );

    // Update storage with remaining accounts (encrypted)
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(remainingAccounts));
    console.log(
      "[removeAccountAndAutoSwitch] Remaining accounts:",
      remainingAccounts.length,
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
          nextLoggedIn.email,
        );

        // IMPORTANT: dispatch asynchronously (see switchAccount for full rationale).
    // Utility modules must not synchronously trigger global React state updates.
        if (authEventEmitter) {
          setImmediate(() => {
            authEventEmitter.emit("accountSwitched", {
              accountId: nextLoggedIn.id,
              email: nextLoggedIn.email,
              type: nextLoggedIn.type,
            });
          });
        }

        return {
          removedAccount: accountToRemove,
          switchedToAccount: nextLoggedIn,
          navigateToLanding: false,
        };
      } else {
        await AsyncStorage.removeItem(ACTIVE_ACCOUNT_KEY);
        console.log(
          "[removeAccountAndAutoSwitch] No other logged-in accounts, navigate to landing",
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