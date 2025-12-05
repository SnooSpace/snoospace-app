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
    
    const originalLength = token.length;
    const key = await getEncryptionKey();
    const encrypted = [];
    
    for (let i = 0; i < token.length; i++) {
      const tokenChar = token.charCodeAt(i);
      const keyChar = key.charCodeAt(i % key.length);
      encrypted.push(tokenChar ^ keyChar);
    }
    
    // Convert to hex string instead of base64 to avoid encoding issues
    const encryptedHex = encrypted.map(byte => byte.toString(16).padStart(2, '0')).join('');
    
    // console.log('[encryptToken] Encrypted:', {
    //   originalLength,
    //   encryptedLength: encryptedHex.length,
    //   original: token.substring(0, 50) + '...',
    //   encrypted: encryptedHex.substring(0, 50) + '...'
    // });
    
    return encryptedHex;
  } catch (error) {
    console.error('[encryptToken] Error encrypting token:', error);
    // Fallback: return unencrypted if encryption fails
    return token;
  }
}

/**
 * Decrypt an encrypted token
 */
export async function decryptToken(encryptedToken) {
  try {
    if (!encryptedToken) return null;
    
    // CRITICAL FIX: Detect if token is already plaintext (not encrypted)
    // Encrypted tokens are hex strings (only 0-9, a-f characters)
    // JWTs start with "eyJ" and contain dots and alphanumeric chars
    const isPlaintext = encryptedToken.startsWith('eyJ') || 
                       encryptedToken.includes('.') ||
                       !/^[0-9a-f]+$/i.test(encryptedToken);
    
    if (isPlaintext) {
      // console.warn('🔓 [decryptToken] Token is stored as PLAINTEXT (not encrypted)!');
      // console.log('[decryptToken] Returning plaintext token:', {
      //   length: encryptedToken.length,
      //   preview: encryptedToken.substring(0, 50) + '...'
      // });
      // Return the plaintext token as-is
      return encryptedToken;
    }
    
    const encryptedLength = encryptedToken.length;
    const key = await getEncryptionKey();
    
    // Decode from hex
    const encryptedBytes = [];
    for (let i = 0; i < encryptedToken.length; i += 2) {
      encryptedBytes.push(parseInt(encryptedToken.substr(i, 2), 16));
    }
    
    const decrypted = [];
    for (let i = 0; i < encryptedBytes.length; i++) {
      const encryptedByte = encryptedBytes[i];
      const keyChar = key.charCodeAt(i % key.length);
      decrypted.push(String.fromCharCode(encryptedByte ^ keyChar));
    }
    
    const decryptedToken = decrypted.join('');
    
    // console.log('[decryptToken] Decrypted:', {
    //   encryptedLength,
    //   decryptedLength: decryptedToken.length,
    //   encrypted: encryptedToken.substring(0, 50) + '...',
    //   decrypted: decryptedToken.substring(0, 50) + '...'
    // });
    
    return decryptedToken;
  } catch (error) {
    // FIX: Return null instead of corrupted encrypted data
    // This prevents "Unauthorized" errors from corrupted tokens
    console.error('🔐 [decryptToken] Decryption failed - token corrupted:', error.message);
    console.log('💡 [decryptToken] Hint: Clear account data and re-login to fix');
    return null;  // Changed from: return encryptedToken
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
