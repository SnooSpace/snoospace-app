import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import { apiPost } from '../api/client';
import { getAuthToken } from '../api/auth';

import appJson from '../app.json';

// Configure how push notifications appear when the app is in the foreground
// This must be called once at module level (not inside a component).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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
      Alert.alert('Push Permission Denied', 'Notification permissions are required for push notifications to work. Please enable them in system settings.');
      return null;
    }

    // Read projectId directly from app.json to avoid Expo .env caching issues
    const projectId = appJson?.expo?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenData.data;
    console.log('[PushService] Expo push token retrieved:', token);

    if (Platform.OS === 'android') {
      const channels = [
        {
          id: 'default',
          name: 'Default',
          description: 'General notifications',
        },
        {
          id: 'messages',
          name: 'Messages',
          description: 'Direct messages and chat requests',
        },
        {
          id: 'activity',
          name: 'Activity',
          description: 'Activity on your plans, questions, and posts (likes, comments, tags, replies)',
        },
        {
          id: 'social',
          name: 'Social',
          description: 'Circle requests, follows, and groups',
        },
        {
          id: 'events',
          name: 'Events',
          description: 'Event invitations, RSVP updates, and reminders',
        },
        {
          id: 'moderation',
          name: 'Moderation',
          description: 'Community reports and actions',
        },
        {
          id: 'system',
          name: 'System',
          description: 'Security alerts and system announcements',
        },
      ];

      for (const ch of channels) {
        await Notifications.setNotificationChannelAsync(ch.id, {
          name: ch.name,
          description: ch.description,
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
    }

    return token;
  } catch (error) {
    console.error('[PushService] Error getting push token:', error);
    Alert.alert('Push Registration Error', 'Error getting push token: ' + error.message);
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
    Alert.alert('Push Service Error', 'Failed to register push token with backend: ' + err.message);
  }
}

