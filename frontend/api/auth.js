import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_TOKEN = 'auth_token';
const KEY_EMAIL = 'auth_email';
const KEY_REFRESH = 'auth_refresh_token';
const KEY_PENDING = 'pending_otp';

export async function setAuthSession(token, email, refreshToken) {
  try {
    const pairs = [[KEY_TOKEN, token || ''], [KEY_EMAIL, email || '']];
    if (refreshToken) pairs.push([KEY_REFRESH, refreshToken || '']);
    await AsyncStorage.multiSet(pairs);
  } catch {}
}

export async function getAuthToken() {
  try {
    const v = await AsyncStorage.getItem(KEY_TOKEN);
    return v || null;
  } catch {
    return null;
  }
}

export async function getAuthEmail() {
  try {
    const v = await AsyncStorage.getItem(KEY_EMAIL);
    return v || null;
  } catch {
    return null;
  }
}

export async function getRefreshToken() {
  try {
    const v = await AsyncStorage.getItem(KEY_REFRESH);
    return v || null;
  } catch {
    return null;
  }
}

export async function clearAuthSession() {
  try {
    await AsyncStorage.multiRemove([KEY_TOKEN, KEY_EMAIL, KEY_REFRESH]);
  } catch {}
}

export async function setAccessToken(token) {
  try {
    await AsyncStorage.setItem(KEY_TOKEN, token || '');
  } catch {}
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


