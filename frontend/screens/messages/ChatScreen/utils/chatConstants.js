/**
 * Centralized Gesture & Interaction Constants for ChatScreen Subsystem
 */

export const GESTURE_CONSTANTS = {
  /** Distance in pixels required to trigger swipe action */
  SWIPE_REPLY_THRESHOLD: 64,

  /** Maximum allowed horizontal swipe translation in pixels */
  MAX_SWIPE_TRANSLATION: 80,

  /** Duration in milliseconds required to trigger a long-press */
  LONG_PRESS_DURATION_MS: 350,

  /** Horizontal offsets for Pan gesture activation: [-15, 15] */
  ACTIVE_OFFSET_X: [-15, 15],

  /** Vertical offsets for Pan gesture failure (allows vertical scrolling to take priority): [-8, 8] */
  FAIL_OFFSET_Y: [-8, 8],
};

export const INTERACTION_STATE = {
  IDLE: 0,
  PANNING: 1,
  LONG_PRESS: 2,
  ANIMATING_BACK: 3,
};
