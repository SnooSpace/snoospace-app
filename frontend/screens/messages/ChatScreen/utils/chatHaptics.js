import * as Haptics from "expo-haptics";

/**
 * Trigger light haptic feedback when swipe threshold is crossed.
 */
export function triggerReplyHaptic() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (err) {
    // Ignore haptic errors on unsupported hardware/web
  }
}

/**
 * Trigger medium haptic feedback when long press action activates.
 */
export function triggerLongPressHaptic() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch (err) {
    // Ignore haptic errors on unsupported hardware/web
  }
}
