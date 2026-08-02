/**
 * SwipeableMessageRow — PRODUCTION FIX (post-bisection)
 *
 * Bisection findings (see optimization journey doc):
 *   full (6 SV / 3 styles):        text-row mount avg ~11.7ms
 *   stub (inert gestures):          ~12.1ms  → gesture logic not the cost
 *   no_detector (no GestureDetector): ~11.4ms → GestureDetector not the cost
 *   minimal (1 SV / 1 style):       ~1.7-3.1ms → Reanimated hook COUNT is the cost
 *
 * Root cause: every row paid for the full highlight-pulse animation
 * (scale, bgOpacity, hasAnimated, fired + 1 useAnimatedStyle) even though
 * highlighting only ever applies to a single row at a time, and only when
 * the user taps a reply-quote to jump to the original message.
 *
 * Fix: split into two pieces.
 *   1. SwipeableMessageRow — every row. Keeps swipe-to-reply + long-press
 *      (both real, both used constantly). Packs the swipe scalars into ONE
 *      shared value instead of separate translateX/iconOpacity/fired SVs.
 *      Cost per row: 1 useSharedValue + 2 useAnimatedStyle (bubble + icon).
 *   2. HighlightOverlay — mounted ONLY on the row where isHighlighted=true.
 *      Owns its own scale/bgOpacity SVs and unmounts itself via onDone once
 *      the pulse finishes. Cost: 2 useSharedValue + 1 useAnimatedStyle,
 *      paid by at most one row in the entire list at any moment.
 */
import React, { useEffect, useRef, useCallback, useMemo, Profiler } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { Reply } from "lucide-react-native";

export const msgContentTimings = new Map();
const onRenderContentProfiler = (id, phase, actualDuration) => {
  const match = id.match(/CONTENT-id=(.*)/);
  if (match) {
    msgContentTimings.set(String(match[1]), actualDuration);
  }
};

const REPLY_SWIPE_MAX = 72;
const REPLY_HAPTIC_THRESHOLD = 64;
const INCOMING_MESSAGE_BG = "#FFFFFF";
const INCOMING_BORDER = "#E6ECF5";
const MESSAGE_TEXT_COLOR = "#1F3A5F";

const renderCounts = new Map();

/**
 * HighlightOverlay — the pulse/glow shown when a message is jumped to via a
 * reply-quote tap. Mounted by exactly one row at a time (see arePropsEqual
 * + isHighlighted below), so its two useSharedValue/one useAnimatedStyle
 * calls are never paid by rows that aren't currently highlighted.
 */
function HighlightOverlay({ onDone }) {
  const scale = useSharedValue(1);
  const bgOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.04, { duration: 150 }),
      withTiming(1, { duration: 300 }),
    );
    bgOpacity.value = withTiming(1, { duration: 180 }, (finished) => {
      if (finished) {
        bgOpacity.value = withTiming(0, { duration: 900 }, (finished2) => {
          if (finished2 && onDone) runOnJS(onDone)();
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({
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
    transform: [{ scale: scale.value }],
    pointerEvents: "none",
  }));

  return <Animated.View style={[overlayStyle, { zIndex: 10 }]} pointerEvents="none" />;
}

function SwipeableMessageRowInner({
  messageId,
  isHighlighted,
  onHighlightDone,
  onReply,
  onLongPress,
  isMyMessage: isMine,
  children,
}) {
  const onReplyRef = useRef(onReply);
  const onLongPressRef = useRef(onLongPress);
  onReplyRef.current = onReply;
  onLongPressRef.current = onLongPress;

  if (__DEV__) {
    const count = (renderCounts.get(messageId) || 0) + 1;
    renderCounts.set(messageId, count);
    if (count > 1) {
      console.log(`[PERF-WRAP] re-render #${count} for id=${messageId}`);
    }
  }

  // Single packed shared value for swipe-to-reply. Was 3 separate SVs
  // (translateX, iconOpacity, fired) — packing scalars that always update
  // together into one object cuts JSI registration count without losing
  // per-field access inside worklets.
  const swipe = useSharedValue({ x: 0, iconOpacity: 0, fired: false });

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipe.value.x }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: swipe.value.iconOpacity,
    transform: [{ scale: Math.max(0.5, swipe.value.iconOpacity) }],
  }));

  const callOnReply = useCallback(() => {
    onReplyRef.current?.();
  }, []);

  const callOnLongPress = useCallback(() => {
    onLongPressRef.current?.();
  }, []);

  const longPress = useMemo(
    () =>
      Gesture.LongPress()
        .onStart(() => {
          runOnJS(callOnLongPress)();
        })
        .maxDistance(20),
    [callOnLongPress],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX(isMine ? [-20, 9999] : [-9999, 20])
        .failOffsetY([-10, 10])
        .onUpdate((e) => {
          "worklet";
          const raw = isMine
            ? Math.max(Math.min(e.translationX, 0), -REPLY_SWIPE_MAX)
            : Math.min(Math.max(e.translationX, 0), REPLY_SWIPE_MAX);
          const iconOpacity = Math.abs(raw) / REPLY_SWIPE_MAX;
          const shouldFire = Math.abs(raw) >= REPLY_HAPTIC_THRESHOLD && !swipe.value.fired;
          swipe.value = {
            x: raw,
            iconOpacity,
            fired: shouldFire || swipe.value.fired,
          };
          if (shouldFire) {
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
          }
        })
        .onEnd((e) => {
          "worklet";
          const didTrigger = Math.abs(e.translationX) >= REPLY_HAPTIC_THRESHOLD;
          swipe.value = { x: 0, iconOpacity: 0, fired: false };
          if (didTrigger) {
            runOnJS(callOnReply)();
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isMine, callOnReply],
  );

  useEffect(() => {
    swipe.value = { x: 0, iconOpacity: 0, fired: false };
  }, [messageId]);

  const composed = useMemo(() => Gesture.Simultaneous(longPress, pan), [longPress, pan]);

  return (
    <View style={styles.row}>
      <Animated.View
        style={[styles.replyIcon, isMine ? styles.replyIconRight : styles.replyIconLeft, iconStyle]}
      >
        <View style={styles.replyCircle}>
          <Reply size={16} color={MESSAGE_TEXT_COLOR} strokeWidth={2.5} />
        </View>
      </Animated.View>

      <Animated.View
        style={[styles.bubble, isMine ? styles.bubbleRight : styles.bubbleLeft, bubbleStyle]}
      >
        <GestureDetector gesture={composed}>
          <View collapsable={false}>
            <Profiler id={`CONTENT-id=${messageId}`} onRender={onRenderContentProfiler}>
              {children}
            </Profiler>
            {isHighlighted ? <HighlightOverlay onDone={onHighlightDone} /> : null}
          </View>
        </GestureDetector>
      </Animated.View>
    </View>
  );
}

const arePropsEqual = (prev, next) =>
  String(prev.messageId ?? "") === String(next.messageId ?? "") &&
  prev.isMyMessage === next.isMyMessage &&
  prev.isHighlighted === next.isHighlighted;

const SwipeableMessageRow = React.memo(SwipeableMessageRowInner, arePropsEqual);
export default SwipeableMessageRow;

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
  replyIconLeft: { left: 12 },
  replyCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: INCOMING_MESSAGE_BG,
    borderWidth: 1,
    borderColor: INCOMING_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    flex: 1,
  },
  bubbleRight: { alignItems: "flex-end" },
  bubbleLeft: { alignItems: "flex-start" },
});
