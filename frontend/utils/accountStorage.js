import AsyncStorage from "@react-native-async-storage/async-storage";
import { decryptToken } from "./encryption";

export const ACCOUNTS_KEY = "@accounts";
export const ACTIVE_ACCOUNT_KEY = "@activeAccountId";

/**
 * Get all saved accounts
 */
export async function getAllAccounts() {
  try {
    const accountsJson = await AsyncStorage.getItem(ACCOUNTS_KEY);

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
      } catch (error) {
        console.error(
          `[getAllAccounts] Skipping corrupted account ${account.id}:`,
          error.message,
        );
        // Skip this account - it's corrupted
      }
    }

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
