/**
 * SwipeableMessageRow
 *
 * Handles two gestures on a single chat message row:
 *   • Swipe left (mine) / right (theirs) → swipe-to-reply
 *   • Long press → message options menu
 *
 * Both gestures run on the UI thread via Reanimated + Gesture Handler.
 * No JS-thread callbacks during gesture active phase.
 *
 * highlightedIdSV is a Reanimated shared value that drives the yellow glow
 * animation when the user taps a reply quote. It is written from ChatScreen
 * after scrollToMessage() to avoid any React re-renders.
 *
 * ── Perf notes ──────────────────────────────────────────────────────────────
 * React.memo uses a custom comparator that intentionally EXCLUDES onReply and
 * onLongPress from the equality check.  The callbacks are stored in refs
 * (updated synchronously on every render) so the gesture worklets always call
 * the latest version — while the wrapper itself bails out of React reconcili-
 * ation whenever messageId / isMyMessage / highlightedIdSV / children haven't
 * changed.  This eliminates the 1.4-3.2 ms per-row re-render cost that was
 * measured when MessageRow passes new inline arrow functions on every ChatScreen
 * update (socket message, send, notification state, etc.).
 *
 * Gesture objects (Gesture.Pan, Gesture.LongPress, Gesture.Simultaneous) are
 * memoized with useMemo so they are constructed once per row mount rather than
 * recreated on every evaluation.  Their worklets reference only stable values
 * (shared values, useRef, and the stable callOnReply / callOnLongPress
 * useCallback wrappers), so the deps arrays effectively never change after
 * first mount — confirming that deferred creation IS meaningful here: the
 * objects are vanilla JS and the prior per-render creation was pure waste.
 *
 * Reanimated hooks (useSharedValue, useAnimatedStyle, useDerivedValue) CANNOT
 * be deferred or made conditional without violating Rules of Hooks.  Their
 * ~8-13 ms first-mount cost is the unavoidable Reanimated native initialisation
 * overhead.  There is no further win available from the "defer Reanimated"
 * direction without dropping the swipe-to-reply feature entirely.
 */
import React, { useRef, useCallback, useMemo, Profiler } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
  withSequence, useDerivedValue, runOnJS, Easing,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { Reply } from "lucide-react-native";

// ── Diagnostic: shared map for content-only timings (PERF-WRAP split) ──────
export const msgContentTimings = new Map();
const onRenderContentProfiler = (id, phase, actualDuration) => {
  const match = id.match(/CONTENT-id=(.*)/);
  if (match) {
    msgContentTimings.set(String(match[1]), actualDuration);
  }
};

const REPLY_SWIPE_MAX        = 72;
const REPLY_HAPTIC_THRESHOLD = 64;
const INCOMING_MESSAGE_BG    = "#FFFFFF";
const INCOMING_BORDER        = "#E6ECF5";
const MESSAGE_TEXT_COLOR     = "#1F3A5F";

// ── Render-count log for verification (Part 1) ──────────────────────────────
// Remove once confirmed that only legitimately-changed rows re-render.
const renderCounts = new Map();

function SwipeableMessageRowInner({
  messageId,
  highlightedIdSV,
  onReply,
  onLongPress,
  isMyMessage: isMine,
  children,
}) {
  // ── Part 1: Stable callback refs ─────────────────────────────────────────
  // Updated synchronously every render so worklets always see the latest handler.
  // Because the custom memo comparator (below) ignores onReply/onLongPress,
  // this component only re-renders when content-relevant props change — meaning
  // the ref updates happen very rarely (only when MessageRow itself legitimately
  // re-renders for that specific message).
  const onReplyRef    = useRef(onReply);
  const onLongPressRef = useRef(onLongPress);
  onReplyRef.current    = onReply;
  onLongPressRef.current = onLongPress;

  // Verification: log each re-render with a running count (DIAG — remove after testing)
  if (__DEV__) {
    const count = (renderCounts.get(messageId) || 0) + 1;
    renderCounts.set(messageId, count);
    if (count > 1) {
      console.log(`[PERF-WRAP] re-render #${count} for id=${messageId}`);
    }
  }

  // ── Reanimated: shared values (cannot be deferred — Rules of Hooks) ──────
  const translateX  = useSharedValue(0);
  const iconOpacity = useSharedValue(0);
  const scale       = useSharedValue(1);
  const bgOpacity   = useSharedValue(0);
  const hasAnimated = useSharedValue(false);
  const fired       = useRef(false);

  const isHighlighted = useDerivedValue(
    () => highlightedIdSV.value === String(messageId),
  );

  const highlightOverlayStyle = useAnimatedStyle(() => {
    const highlighted = isHighlighted.value;
    if (highlighted && !hasAnimated.value) {
      hasAnimated.value = true;
      scale.value = withSequence(
        withTiming(1.04, { duration: 150 }),
        withTiming(1,    { duration: 300 }),
      );
      bgOpacity.value = withTiming(1, { duration: 180 }, () => {
        bgOpacity.value = withTiming(0, { duration: 900 });
      });
    }
    if (!highlighted) { hasAnimated.value = false; }
    return {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(53, 101, 242, 0.15)",
      borderColor: "rgba(53, 101, 242, 0.5)",
      borderWidth: 1.5,
      borderRadius: 18,
      opacity: bgOpacity.value,
      shadowColor: "#3565F2",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 3,
      pointerEvents: "none",
    };
  });

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ scale: Math.max(0.5, iconOpacity.value) }],
  }));

  // ── Part 1: Stable JS-thread callbacks (empty deps → constructed once) ──
  // These are what runOnJS calls.  Because deps are empty, the function
  // references never change → the memoised gesture objects below never need
  // to be rebuilt after first mount.
  const callOnReply = useCallback(() => {
    onReplyRef.current?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const callOnLongPress = useCallback(() => {
    onLongPressRef.current?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Part 2: Memoised gesture objects ────────────────────────────────────
  // Gesture.LongPress/Pan/Simultaneous are plain JS object construction, not
  // hooks, so useMemo is valid here.  All worklet-closed-over values are
  // stable (shared values, refs, callOnReply/callOnLongPress), so the deps
  // never change after mount — construction cost paid exactly once per row.
  const longPress = useMemo(() =>
    Gesture.LongPress()
      .onStart(() => { runOnJS(callOnLongPress)(); })
      .maxDistance(20),
  [callOnLongPress]); // stable forever after mount

  const pan = useMemo(() =>
    Gesture.Pan()
      .activeOffsetX(isMine ? [-20, 9999] : [-9999, 20])
      .failOffsetY([-10, 10])
      .onUpdate((e) => {
        const raw = isMine
          ? Math.max(Math.min(e.translationX, 0), -REPLY_SWIPE_MAX)
          : Math.min(Math.max(e.translationX, 0), REPLY_SWIPE_MAX);
        translateX.value  = raw;
        iconOpacity.value = Math.abs(raw) / REPLY_SWIPE_MAX;
        if (Math.abs(raw) >= REPLY_HAPTIC_THRESHOLD && !fired.current) {
          fired.current = true;
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        }
      })
      .onEnd((e) => {
        const didTrigger = Math.abs(e.translationX) >= REPLY_HAPTIC_THRESHOLD;
        translateX.value  = withTiming(0, { duration: 180, easing: Easing.out(Easing.quad) });
        iconOpacity.value = withTiming(0, { duration: 150 });
        fired.current = false;
        if (didTrigger) runOnJS(callOnReply)();
      }),
  // isMine: stable for a given message (sender never changes).
  // callOnReply: stable (empty-dep useCallback).
  // Shared values and fired ref: stable objects — their .value changes,
  // not the references themselves.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [isMine, callOnReply]);

  const composed = useMemo(() =>
    Gesture.Simultaneous(longPress, pan),
  [longPress, pan]);

  return (
    <View style={styles.row}>
      {/* Reply icon — shown during swipe */}
      <Animated.View
        style={[
          styles.replyIcon,
          isMine ? styles.replyIconRight : styles.replyIconLeft,
          iconStyle,
        ]}
      >
        <View style={styles.replyCircle}>
          <Reply size={16} color={MESSAGE_TEXT_COLOR} strokeWidth={2.5} />
        </View>
      </Animated.View>

      <Animated.View style={[styles.bubble, isMine ? styles.bubbleRight : styles.bubbleLeft, bubbleStyle]}>
        <GestureDetector gesture={composed}>
          <View collapsable={false}>
            <Profiler id={`CONTENT-id=${messageId}`} onRender={onRenderContentProfiler}>
              {children}
            </Profiler>
            <Animated.View style={[highlightOverlayStyle, { zIndex: 10 }]} />
          </View>
        </GestureDetector>
      </Animated.View>
    </View>
  );
}

// ── Custom memo comparator ───────────────────────────────────────────────────
// Deliberately EXCLUDES onReply and onLongPress — those are handled via refs
// inside the component body so they never need to trigger a re-render.
// Includes children so content updates (deletion, edits) still propagate.
const arePropsEqual = (prev, next) =>
  prev.messageId       === next.messageId       &&
  prev.isMyMessage     === next.isMyMessage     &&
  prev.highlightedIdSV === next.highlightedIdSV &&
  prev.children        === next.children;

const SwipeableMessageRow = React.memo(SwipeableMessageRowInner, arePropsEqual);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  replyIcon: {
    position: "absolute",
    zIndex: -1,
  },
  replyIconRight: { right: 12 },
  replyIconLeft:  { left:  12 },
  replyCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: INCOMING_MESSAGE_BG,
    borderWidth: 1, borderColor: INCOMING_BORDER,
    alignItems: "center", justifyContent: "center",
  },
  bubble: {
    flex: 1,
  },
  bubbleRight: { alignItems: "flex-end" },
  bubbleLeft:  { alignItems: "flex-start" },
});

export default SwipeableMessageRow;
