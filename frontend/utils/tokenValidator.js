/**
 * Token Validation Utilities
 * Helps validate and check token expiration for account switching
 */

/**
 * Check if refresh token looks valid
 * Supabase refresh tokens are typically 40+ characters
 */
export function isRefreshTokenValid(refreshToken) {
  if (!refreshToken) {
    console.warn('[isRefreshTokenValid] No refresh token provided');
    return false;
  }
  
  if (refreshToken.length < 20) {
    console.warn('[isRefreshTokenValid] Suspicious token length:', refreshToken.length);
    return false;
  }
  
  // Supabase refresh tokens are typically 40+ characters
  return refreshToken.length >= 40;
}

/**
 * Check if access token is expired or close to expiring
 * @param {string} accessToken - JWT access token
 * @param {number} bufferMinutes - Minutes before expiry to consider expired (default: 5)
 * @returns {boolean} True if expired or close to expiring
 */
export function isAccessTokenExpired(accessToken, bufferMinutes = 5) {
  if (!accessToken) {
    console.warn('[isAccessTokenExpired] No access token provided');
    return true;
  }

  try {
    // JWT format: header.payload.signature
    const parts = accessToken.split('.');
    if (parts.length !== 3) {
      console.warn('[isAccessTokenExpired] Invalid JWT format');
      return true;
    }

    // Decode payload (base64)
    const payload = JSON.parse(atob(parts[1]));
    
    if (!payload.exp) {
      console.warn('[isAccessTokenExpired] No expiration in token');
      return true;
    }

    const exp = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const bufferTime = bufferMinutes * 60 * 1000;
    
    const isExpired = (exp - now) < bufferTime;
    
    if (isExpired) {
      const minutesUntilExpiry = Math.floor((exp - now) / (60 * 1000));
      console.log(`[isAccessTokenExpired] Token expired or expiring soon (${minutesUntilExpiry} minutes)`);
    }
    
    return isExpired;
  } catch (error) {
    console.error('[isAccessTokenExpired] Error parsing token:', error);
    return true; // Assume expired if can't parse
  }
}

/**
 * Get token expiration time
 * @param {string} accessToken - JWT access token
 * @returns {Date|null} Expiration date or null if can't parse
 */
export function getTokenExpiration(accessToken) {
  if (!accessToken) return null;

  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return null;

    return new Date(payload.exp * 1000);
  } catch (error) {
    console.error('[getTokenExpiration] Error parsing token:', error);
    return null;
  }
}

/**
 * Get user email from access token
 * @param {string} accessToken - JWT access token
 * @returns {string|null} Email or null if can't parse
 */
export function getEmailFromToken(accessToken) {
  if (!accessToken) return null;

  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    return payload.email || null;
  } catch (error) {
    console.error('[getEmailFromToken] Error parsing token:', error);
    return null;
  }
}
