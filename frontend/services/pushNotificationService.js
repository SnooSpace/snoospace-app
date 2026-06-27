import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiPost } from '../api/client';
import { getAuthToken } from '../api/auth';

/**
 * Request notification permissions and retrieve the Expo Push Token.
 */
export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.log('[PushService] Simulation detected: Must use physical device for Push Notifications');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[PushService] Permission not granted to get push token!');
      return null;
    }

    // Retrieve Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;
    console.log('[PushService] Expo push token retrieved:', token);

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return token;
  } catch (error) {
    console.error('[PushService] Error getting push token:', error);
    return null;
  }
}

/**
 * Fetch Expo Push Token and post it to our backend Express endpoint.
 */
export async function registerPushTokenWithBackend() {
  try {
    const token = await registerForPushNotificationsAsync();
    if (!token) {
      console.log('[PushService] Could not retrieve token, skipping backend registration.');
      return;
    }

    const authToken = await getAuthToken();
    if (!authToken) {
      console.log('[PushService] No active auth session, skipping backend registration.');
      return;
    }

    // Call backend endpoint to register/upsert push token
    console.log('[PushService] Posting push token registration to backend...');
    await apiPost(
      '/notifications/push-token',
      { token, deviceId: Device.modelName || 'default_device' },
      10000,
      authToken
    );
    console.log('[PushService] Push token registered with backend successfully.');
  } catch (err) {
    console.error('[PushService] Failed to register push token with backend:', err);
  }
}
