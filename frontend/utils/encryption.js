import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const ENCRYPTION_KEY_NAME = 'account_encryption_key';

/**
 * Get or generate encryption key
 * Stored securely in SecureStore
 */
export async function getEncryptionKey() {
  try {
    let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME);
    
    if (!key) {
      // Generate new encryption key (32 bytes = 256 bits)
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      key = Array.from(randomBytes)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
      
      await SecureStore.setItemAsync(ENCRYPTION_KEY_NAME, key);
    }
    
    return key;
  } catch (error) {
    console.error('Error getting encryption key:', error);
    throw error;
  }
}

/**
 * Simple XOR encryption (sufficient for our use case)
 * For production, consider using a more robust encryption library
 */
export async function encryptToken(token) {
  try {
    if (!token) return null;
    
    const key = await getEncryptionKey();
    const encrypted = [];
    
    for (let i = 0; i < token.length; i++) {
      const tokenChar = token.charCodeAt(i);
      const keyChar = key.charCodeAt(i % key.length);
      encrypted.push(String.fromCharCode(tokenChar ^ keyChar));
    }
    
    // Convert to base64 for safe storage
    const encryptedStr = encrypted.join('');
    return btoa(encryptedStr);
  } catch (error) {
    console.error('Error encrypting token:', error);
    // Fallback: return unencrypted if encryption fails
    return token;
  }
}

/**
 * Decrypt token
 */
export async function decryptToken(encryptedToken) {
  try {
    if (!encryptedToken) return null;
    
    const key = await getEncryptionKey();
    
    // Decode from base64
    const encryptedStr = atob(encryptedToken);
    const decrypted = [];
    
    for (let i = 0; i < encryptedStr.length; i++) {
      const encryptedChar = encryptedStr.charCodeAt(i);
      const keyChar = key.charCodeAt(i % key.length);
      decrypted.push(String.fromCharCode(encryptedChar ^ keyChar));
    }
    
    return decrypted.join('');
  } catch (error) {
    console.error('Error decrypting token:', error);
    // Fallback: return as-is if decryption fails
    return encryptedToken;
  }
}

/**
 * Clear encryption key (use when logging out all accounts)
 */
export async function clearEncryptionKey() {
  try {
    await SecureStore.deleteItemAsync(ENCRYPTION_KEY_NAME);
  } catch (error) {
    console.error('Error clearing encryption key:', error);
  }
}
