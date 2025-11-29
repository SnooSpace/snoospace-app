/**
 * EMERGENCY FIX: Clear Corrupted Account Data
 * 
 * Run this from React Native Debugger Console or add a button temporarily
 * 
 * Usage:
 * import { clearCorruptedAccounts } from './utils/accountFix';
 * await clearCorruptedAccounts();
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export async function clearCorruptedAccounts() {
  try {
    console.log('Clearing all account data...');
    
    // Clear account-related storage
    await AsyncStorage.removeItem('@accounts');
    await AsyncStorage.removeItem('@activeAccountId');
    await AsyncStorage.removeItem('@encryption_key');
    
    // Keep current auth session (don't logout completely)
    // Just clear the multi-account system
    
    console.log('✅ Account data cleared successfully!');
    console.log('You can now re-add accounts fresh.');
    
    return true;
  } catch (error) {
    console.error('Error clearing accounts:', error);
    return false;
  }
}

export async function debugAccountStatus() {
  try {
    const accounts = await AsyncStorage.getItem('@accounts');
    const activeId = await AsyncStorage.getItem('@activeAccountId');
    const encKey = await AsyncStorage.getItem('@encryption_key');
    
    console.log('=== ACCOUNT DEBUG INFO ===');
    console.log('Accounts:', accounts ? JSON.parse(accounts).length + ' accounts' : 'None');
    console.log('Active ID:', activeId);
    console.log('Encryption key exists:', !!encKey);
    console.log('========================');
  } catch (error) {
    console.error('Debug error:', error);
  }
}
