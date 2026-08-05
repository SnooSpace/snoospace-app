import React, { useRef, useEffect, useMemo } from "react";
import { View } from "react-native";
import { useSharedValue, withSpring, runOnJS } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { GESTURE_CONSTANTS, INTERACTION_STATE } from "../utils/chatConstants";
import { triggerReplyHaptic, triggerLongPressHaptic } from "../utils/chatHaptics";
import AnimatedGestureCell from "./AnimatedGestureCell";

const SPRING_CONFIG = { damping: 25, stiffness: 200, mass: 0.8 };

const MessageInteractionLayer = ({
  children,
  itemKey,
  isMyMessage = false,
  gestureEnabled = true,
  onSwipe,
  onLongPress,
  payload,
  activeRowId,
  activeRowIdShared,
  setActiveRowId,
}) => {
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const replyProgress = useSharedValue(0);
  const hasTriggeredHaptic = useSharedValue(false);
  const interactionState = useSharedValue(INTERACTION_STATE.IDLE);
  const gestureEnabledShared = useSharedValue(gestureEnabled);
  useEffect(() => {
    gestureEnabledShared.value = gestureEnabled;
  }, [gestureEnabled]);

  const stateRef = useRef({ onSwipe, onLongPress, payload, itemKey });
  useEffect(() => {
    stateRef.current = { onSwipe, onLongPress, payload, itemKey };
  });

  const handleSwipeEndJS = useRef((triggered) => {
    if (triggered && stateRef.current.onSwipe) {
      stateRef.current.onSwipe({
        key: stateRef.current.itemKey,
        payload: stateRef.current.payload,
      });
    }
  }).current;

  const handleLongPressJS = useRef(() => {
    if (stateRef.current.onLongPress) {
      stateRef.current.onLongPress({
        key: stateRef.current.itemKey,
        payload: stateRef.current.payload,
      });
    }
  }).current;

  const claimActive = useRef((key) => {
    if (setActiveRowId) setActiveRowId(key);
  }).current;
  const releaseActive = useRef((key) => {
    if (setActiveRowId) {
      setActiveRowId((current) => (current === key ? null : current));
    }
  }).current;

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX(GESTURE_CONSTANTS.ACTIVE_OFFSET_X)
        .failOffsetY(GESTURE_CONSTANTS.FAIL_OFFSET_Y)
        .onBegin(() => {
          "worklet";
          if (!gestureEnabledShared.value) return;
          if (activeRowIdShared) activeRowIdShared.value = itemKey;
          runOnJS(claimActive)(itemKey);
        })
        .onStart(() => {
          "worklet";
          if (!gestureEnabledShared.value) return;
          if (
            translateX.value !== 0 &&
            interactionState.value === INTERACTION_STATE.IDLE
          ) {
            translateX.value = 0;
            scale.value = 1;
            replyProgress.value = 0;
            hasTriggeredHaptic.value = false;
          }
          if (
            interactionState.value !== INTERACTION_STATE.IDLE &&
            interactionState.value !== INTERACTION_STATE.ANIMATING_BACK
          ) {
            return;
          }
          interactionState.value = INTERACTION_STATE.PANNING;
        })
        .onUpdate((e) => {
          "worklet";
          if (
            !gestureEnabledShared.value ||
            interactionState.value !== INTERACTION_STATE.PANNING
          )
            return;
          const rawX = e.translationX;
          if (rawX <= 0) {
            translateX.value = 0;
            replyProgress.value = 0;
            return;
          }
          let clampedX = rawX;
          if (rawX > GESTURE_CONSTANTS.SWIPE_REPLY_THRESHOLD) {
            const excess = rawX - GESTURE_CONSTANTS.SWIPE_REPLY_THRESHOLD;
            clampedX = GESTURE_CONSTANTS.SWIPE_REPLY_THRESHOLD + excess * 0.3;
          }
          translateX.value = Math.min(
            clampedX,
            GESTURE_CONSTANTS.MAX_SWIPE_TRANSLATION,
          );
          replyProgress.value = Math.min(
            translateX.value / GESTURE_CONSTANTS.SWIPE_REPLY_THRESHOLD,
            1,
          );
          if (
            translateX.value >= GESTURE_CONSTANTS.SWIPE_REPLY_THRESHOLD &&
            !hasTriggeredHaptic.value
          ) {
            hasTriggeredHaptic.value = true;
            runOnJS(triggerReplyHaptic)();
          } else if (
            translateX.value < GESTURE_CONSTANTS.SWIPE_REPLY_THRESHOLD &&
            hasTriggeredHaptic.value
          ) {
            hasTriggeredHaptic.value = false;
          }
        })
        .onEnd(() => {
          "worklet";
          if (
            !gestureEnabledShared.value ||
            interactionState.value !== INTERACTION_STATE.PANNING
          )
            return;
          const isTriggered =
            translateX.value >= GESTURE_CONSTANTS.SWIPE_REPLY_THRESHOLD;
          interactionState.value = INTERACTION_STATE.ANIMATING_BACK;
          runOnJS(handleSwipeEndJS)(isTriggered);
          translateX.value = withSpring(0, SPRING_CONFIG, () => {
            "worklet";
            interactionState.value = INTERACTION_STATE.IDLE;
            hasTriggeredHaptic.value = false;
            replyProgress.value = 0;
            if (activeRowIdShared && activeRowIdShared.value === itemKey)
              activeRowIdShared.value = null;
            runOnJS(releaseActive)(itemKey);
          });
        })
        .onFinalize(() => {
          "worklet";
          if (interactionState.value === INTERACTION_STATE.PANNING) {
            translateX.value = withSpring(0, SPRING_CONFIG, () => {
              "worklet";
              interactionState.value = INTERACTION_STATE.IDLE;
              hasTriggeredHaptic.value = false;
              replyProgress.value = 0;
              if (activeRowIdShared && activeRowIdShared.value === itemKey)
                activeRowIdShared.value = null;
              runOnJS(releaseActive)(itemKey);
            });
          }
        }),
    [handleSwipeEndJS, activeRowIdShared, itemKey, claimActive, releaseActive],
  );

  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(GESTURE_CONSTANTS.LONG_PRESS_DURATION_MS)
        .onStart(() => {
          "worklet";
          if (!gestureEnabledShared.value) return;
          if (interactionState.value !== INTERACTION_STATE.IDLE) return;
          if (activeRowIdShared) activeRowIdShared.value = itemKey;
          runOnJS(claimActive)(itemKey);
          interactionState.value = INTERACTION_STATE.LONG_PRESS;
          scale.value = withSpring(0.96, SPRING_CONFIG, () => {
            "worklet";
            scale.value = withSpring(1.0, SPRING_CONFIG);
          });
          runOnJS(triggerLongPressHaptic)();
          runOnJS(handleLongPressJS)();
        })
        .onFinalize(() => {
          "worklet";
          if (interactionState.value === INTERACTION_STATE.LONG_PRESS) {
            scale.value = withSpring(1.0, SPRING_CONFIG, () => {
              "worklet";
              interactionState.value = INTERACTION_STATE.IDLE;
              if (activeRowIdShared && activeRowIdShared.value === itemKey)
                activeRowIdShared.value = null;
              runOnJS(releaseActive)(itemKey);
            });
          }
        }),
    [handleLongPressJS, activeRowIdShared, itemKey, claimActive, releaseActive],
  );

  const combinedGesture = useMemo(
    () => Gesture.Simultaneous(panGesture, longPressGesture),
    [panGesture, longPressGesture],
  );

  const isActive = activeRowId === itemKey;

  return (
    <GestureDetector gesture={combinedGesture}>
      {isActive ? (
        <AnimatedGestureCell
          translateX={translateX}
          scale={scale}
          replyProgress={replyProgress}
          isMyMessage={isMyMessage}
          gestureEnabled={gestureEnabled}
        >
          {children}
        </AnimatedGestureCell>
      ) : (
        <View style={{ width: "100%" }}>{children}</View>
      )}
    </GestureDetector>
  );
};

export default React.memo(MessageInteractionLayer);
