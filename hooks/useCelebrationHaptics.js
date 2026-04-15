import * as Haptics from "expo-haptics";

/**
 * Fires a haptic with a delay.
 */
const hapticAt = (delay, fn) => {
  setTimeout(fn, delay);
};

/**
 * 🎉 Celebration haptic pattern — designed to match a confetti burst.
 *
 * Breakdown:
 *   0ms    — Heavy initial thud (the "launch")
 *   80ms   — Medium follow-through
 *   160ms  — Light scatter burst (×3 rapid taps)
 *   200ms  ↗
 *   240ms  ↗
 *   400ms  — Soft settle tap
 *   650ms  — Final success confirmation
 */
export const triggerCelebrationHaptics = () => {
  // The launch — strong and immediate
  hapticAt(0, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));

  // Follow-through — medium
  hapticAt(80, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

  // Confetti scatter — rapid light taps
  hapticAt(160, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  hapticAt(200, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  hapticAt(240, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

  // Settle
  hapticAt(400, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

  // Final confirmation — the "you're in" moment
  hapticAt(650, () =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  );
};

/**
 * 🔁 Screen transition haptic — fire on every signup step forward.
 * Subtle tactile confirmation of progress.
 */
export const triggerTransitionHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

/**
 * ✅ Input valid haptic — fires when CTA becomes active after valid input.
 */
export const triggerInputValidHaptic = () => {
  Haptics.selectionAsync();
};

/**
 * 🏷️ Interest chip select haptic — for tapping interest chips.
 */
export const triggerChipSelectHaptic = () => {
  Haptics.selectionAsync();
};
