import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_TOKEN = 'auth_token';
const KEY_EMAIL = 'auth_email';

export async function setAuthSession(token, email) {
  try {
    await AsyncStorage.multiSet([[KEY_TOKEN, token || ''], [KEY_EMAIL, email || '']]);
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

export async function clearAuthSession() {
  try {
    await AsyncStorage.multiRemove([KEY_TOKEN, KEY_EMAIL]);
  } catch {}
}


