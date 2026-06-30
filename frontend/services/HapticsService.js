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
   * Trigger a heavy impact (for significant or restricted actions)
   */
  triggerImpactHeavy() {
    if (this.isEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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

  // --- Premium Semantic Haptics ---

  /**
   * 1. Back button (Arrow left) - crisp, subtle selection click
   */
  triggerBack() {
    if (this.isEnabled) {
      Haptics.selectionAsync();
    }
  }

  /**
   * 2. 'X' to close a modal or screen - soft, light release tap
   */
  triggerClose() {
    if (this.isEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  /**
   * 3. Tapping on stats count in the profile screen and PublicProfile - extremely light dial-like tick
   */
  triggerStatsTap() {
    if (this.isEnabled) {
      Haptics.selectionAsync();
    }
  }

  /**
   * 4. Edit Profile - light impact confirmation
   */
  triggerEditProfile() {
    if (this.isEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  /**
   * 4. Create Post - medium impact for post creation
   */
  triggerCreatePost() {
    if (this.isEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }

  /**
   * 4. Message Send - crisp medium impact
   */
  triggerMessageSend() {
    if (this.isEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }

  /**
   * 4. Add to Circle - success notification feedback
   */
  triggerAddToCircle() {
    if (this.isEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  /**
   * 4. Follow - medium impact feedback
   */
  triggerFollow() {
    if (this.isEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }

  /**
   * 5. Settings button - selection click
   */
  triggerSettingsPress() {
    if (this.isEnabled) {
      Haptics.selectionAsync();
    }
  }

  /**
   * 5. Save button / Save icon - medium impact for saving configurations
   */
  triggerSavePress() {
    if (this.isEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }

  /**
   * 5. Notification icon - selection click
   */
  triggerNotificationPress() {
    if (this.isEnabled) {
      Haptics.selectionAsync();
    }
  }

  /**
   * 5. Chat icon button - selection click
   */
  triggerChatPress() {
    if (this.isEnabled) {
      Haptics.selectionAsync();
    }
  }

  /**
   * 5. Username switcher (if it has switcher modal) - light impact click
   */
  triggerUsernameSwitcherPress() {
    if (this.isEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  /**
   * 6. Engagement tools: Like
   * Premium heartbeat pop: rapid light impact followed by medium impact after 80ms
   */
  async triggerLike() {
    // Disabled globally per user request
  }

  /**
   * 6. Engagement tools: Comment - selection tap
   */
  triggerComment() {
    if (this.isEnabled) {
      Haptics.selectionAsync();
    }
  }

  /**
   * 6. Engagement tools: View - selection tap
   */
  triggerView() {
    if (this.isEnabled) {
      Haptics.selectionAsync();
    }
  }

  /**
   * 6. Engagement tools: Share - light impact
   */
  triggerShare() {
    if (this.isEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  /**
   * 6. Engagement tools: Save (Bookmark) - medium impact
   */
  triggerSave() {
    if (this.isEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }
}

// Create a singleton instance
const hapticsService = new HapticsService();
export default hapticsService;
