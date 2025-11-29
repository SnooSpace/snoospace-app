/**
 * EMERGENCY: Force Clear All Account Data
 * Run this to completely wipe multi-account system
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export async function emergencyClearAll() {
  try {
    console.log('🚨 EMERGENCY CLEAR: Removing all account data...');
    
    // Remove all multi-account keys
    await AsyncStorage.multiRemove([
      '@accounts',
      '@activeAccountId',
      '@encryption_key'
    ]);
    
    // Clear from SecureStore too
    try {
      await SecureStore.deleteItemAsync('account_encryption_key');
    } catch (e) {
      // Ignore if doesn't exist
    }
    
    console.log('✅ All account data cleared!');
    console.log('Please restart the app to continue.');
    
    return true;
  } catch (error) {
    console.error('Emergency clear failed:', error);
    return false;
  }
}

// Auto-run on import for emergency fix
// Comment out this line once data is cleared
// emergencyClearAll();
