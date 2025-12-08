import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const HAPTICS_Enabled_KEY = 'app_haptics_enabled';

class HapticsService {
  constructor() {
    this.isEnabled = true; // Default to true
    this.initPromise = this.init();
  }

  async init() {
    try {
      const saved = await AsyncStorage.getItem(HAPTICS_Enabled_KEY);
      if (saved !== null) {
        this.isEnabled = JSON.parse(saved);
      }
    } catch (error) {
      console.log('Error loading haptics preference:', error);
    }
  }

  async setEnabled(enabled) {
    this.isEnabled = enabled;
    try {
      await AsyncStorage.setItem(HAPTICS_Enabled_KEY, JSON.stringify(enabled));
    } catch (error) {
      console.log('Error saving haptics preference:', error);
    }
  }

  async getEnabled() {
    // Wait for init to complete before returning the value
    await this.initPromise;
    return this.isEnabled;
  }

  // --- Haptic Triggers ---

  /**
   * Trigger a light impact (Primary Button Press)
   */
  triggerImpactLight() {
    if (this.isEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  /**
   * Trigger a medium impact (if needed for heavier actions)
   */
  triggerImpactMedium() {
    if (this.isEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }

  /**
   * Trigger a selection feedback (Toggle/Selection)
   */
  triggerSelection() {
    if (this.isEnabled) {
      Haptics.selectionAsync();
    }
  }

  /**
   * Trigger a success notification (Critical Confirmation)
   */
  triggerNotificationSuccess() {
    if (this.isEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  /**
   * Trigger an error notification
   */
  triggerNotificationError() {
    if (this.isEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  /**
   * Trigger a warning notification
   */
  triggerNotificationWarning() {
    if (this.isEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }
}

// Create a singleton instance
const hapticsService = new HapticsService();
export default hapticsService;
