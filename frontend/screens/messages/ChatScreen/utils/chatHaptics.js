import * as Haptics from "expo-haptics";

export function triggerReplyHaptic() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (err) {}
}

export function triggerLongPressHaptic() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch (err) {}
}
