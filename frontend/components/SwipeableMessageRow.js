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
 */
import React, { useRef } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
  withSequence, useDerivedValue, runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { Reply } from "lucide-react-native";

const REPLY_SWIPE_MAX      = 72;
const REPLY_HAPTIC_THRESHOLD = 64;
const INCOMING_MESSAGE_BG  = "#FFFFFF";
const INCOMING_BORDER      = "#E6ECF5";
const MESSAGE_TEXT_COLOR   = "#1F3A5F";

const SwipeableMessageRow = React.memo(({
  messageId,
  highlightedIdSV,
  onReply,
  onLongPress,
  isMyMessage: isMine,
  children,
}) => {
  const translateX  = useSharedValue(0);
  const iconOpacity = useSharedValue(0);
  const scale       = useSharedValue(1);
  const bgOpacity   = useSharedValue(0);
  const fired       = useRef(false);

  // useDerivedValue runs on the UI thread — no React re-renders when
  // highlightedIdSV changes, only the animation worklets below re-execute.
  const isHighlighted = useDerivedValue(
    () => highlightedIdSV.value === String(messageId),
  );

  const hasAnimated = useSharedValue(false);

  const highlightOverlayStyle = useAnimatedStyle(() => {
    const highlighted = isHighlighted.value;

    if (highlighted && !hasAnimated.value) {
      hasAnimated.value = true;
      // Pulse: scale up then back
      scale.value = withSequence(
        withTiming(1.04, { duration: 150 }),
        withTiming(1,    { duration: 300 }),
      );
      // Glow: fade in fast, then fade out slow
      bgOpacity.value = withTiming(1, { duration: 180 }, () => {
        bgOpacity.value = withTiming(0, { duration: 900 });
      });
    }
    if (!highlighted) {
      hasAnimated.value = false;
    }
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

  // Long-press — fires onLongPress on JS thread via runOnJS
  const longPress = Gesture.LongPress()
    .onStart(() => { if (onLongPress) runOnJS(onLongPress)(); })
    .maxDistance(20);

  // Pan — swipe-to-reply, entirely on UI thread until onEnd
  const pan = Gesture.Pan()
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
      translateX.value  = withSpring(0, { damping: 18, stiffness: 200 });
      iconOpacity.value = withTiming(0, { duration: 150 });
      fired.current = false;
      if (didTrigger) runOnJS(onReply)();
    });

  const composed = Gesture.Simultaneous(longPress, pan);

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
            {children}
            <Animated.View style={[highlightOverlayStyle, { zIndex: 10 }]} />
          </View>
        </GestureDetector>
      </Animated.View>
    </View>
  );
});

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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bubble: {
    flex: 1,
  },
  bubbleRight: { alignItems: "flex-end" },
  bubbleLeft:  { alignItems: "flex-start" },
});

export default SwipeableMessageRow;
