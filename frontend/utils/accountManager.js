import AsyncStorage from '@react-native-async-storage/async-storage';
import { encryptToken, decryptToken, clearEncryptionKey } from './encryption';

const ACCOUNTS_KEY = '@accounts';
const ACTIVE_ACCOUNT_KEY = '@activeAccountId';
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
    if (!accountsJson) return [];
    
    const accounts = JSON.parse(accountsJson);
    
    // Decrypt tokens for each account - skip corrupted ones
    const decryptedAccounts = [];
    for (const account of accounts) {
      try {
        const decryptedAccount = {
          ...account,
          authToken: await decryptToken(account.authToken),
          refreshToken: account.refreshToken ? await decryptToken(account.refreshToken) : null,
        };
        decryptedAccounts.push(decryptedAccount);
      } catch (error) {
        console.error(`Skipping corrupted account ${account.id}:`, error.message);
        // Skip this account - it's corrupted
      }
    }
    
    return decryptedAccounts;
  } catch (error) {
    console.error('Error loading accounts:', error);
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
    return accounts.find((acc) => String(acc.id) === String(activeId)) || null;
  } catch (error) {
    console.error('Error getting active account:', error);
    return null;
  }
}

/**
 * Add new account
 * @param {Object} accountData - { id, type, username, email, name, profilePicture, authToken, refreshToken }
 */
export async function addAccount(accountData) {
  try {
    const accounts = await getAllAccounts();
    const accountId = String(accountData.id); // Always convert to string
    
    // Check if account already exists
    const existingIndex = accounts.findIndex((acc) => String(acc.id) === accountId);
    
    // Check max limit (only if adding new account)
    if (existingIndex === -1 && accounts.length >= MAX_ACCOUNTS) {
      throw new Error(`Maximum ${MAX_ACCOUNTS} accounts allowed`);
    }
    
    // Encrypt tokens
    const encryptedAccount = {
      ...accountData,
      id: accountId, // Store as string
      authToken: await encryptToken(accountData.authToken),
      refreshToken: accountData.refreshToken ? await encryptToken(accountData.refreshToken) : null,
      unreadCount: accountData.unreadCount || 0,
      lastActive: Date.now(),
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
    
    // Set as active account - MUST be string
    await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
    
    return true;
  } catch (error) {
    console.error('Error adding account:', error);
    throw error;
  }
}

/**
 * Switch to different account
 */
export async function switchAccount(accountId) {
  try {
    const accounts = await getAllAccounts();
    const accountIdStr = String(accountId);
    const account = accounts.find((acc) => String(acc.id) === accountIdStr);
    
    if (!account) {
      throw new Error('Account not found');
    }
    
    // Update last active time
    await updateAccount(accountIdStr, { lastActive: Date.now() });
    
    // Set as active - MUST be string
    await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, accountIdStr);
    
    return account;
  } catch (error) {
    console.error('Error switching account:', error);
    throw error;
  }
}

/**
 * Remove account
 */
export async function removeAccount(accountId) {
  try {
    const accounts = await getAllAccounts();
    const accountIdStr = String(accountId);
    const updatedAccounts = accounts.filter((acc) => String(acc.id) !== accountIdStr);
    
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updatedAccounts));
    
    // If removing active account, switch to first available
    const activeId = await AsyncStorage.getItem(ACTIVE_ACCOUNT_KEY);
    if (String(activeId) === accountIdStr) {
      if (updatedAccounts.length > 0) {
        await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, String(updatedAccounts[0].id));
      } else {
        await AsyncStorage.removeItem(ACTIVE_ACCOUNT_KEY);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error removing account:', error);
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
    const accountIndex = accounts.findIndex((acc) => String(acc.id) === accountIdStr);
    
    if (accountIndex === -1) return false;
    
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
    console.error('Error updating account:', error);
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
    console.error('Error clearing all accounts:', error);
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
    const oldToken = await AsyncStorage.getItem('@auth_token');
    const oldUserData = await AsyncStorage.getItem('@user_data');
    
    if (!oldToken || !oldUserData) {
      return false; // No old data to migrate
    }
    
    const userData = JSON.parse(oldUserData);
    
    // Migrate to new system
    await addAccount({
      id: String(userData.id), // Convert to string
      type: userData.type || 'member',
      username: userData.username,
      email: userData.email,
      name: userData.name || userData.username,
      profilePicture: userData.profilePicture || userData.profile_picture || null,
      authToken: oldToken,
      refreshToken: null,
    });
    
    console.log('Successfully migrated existing user to multi-account system');
    return true;
  } catch (error) {
    console.error('Error migrating existing user:', error);
    return false;
  }
}

export default {
  getAllAccounts,
  getActiveAccount,
  addAccount,
  switchAccount,
  removeAccount,
  updateAccount,
  updateUnreadCount,
  clearAllAccounts,
  migrateExistingUser,
};
