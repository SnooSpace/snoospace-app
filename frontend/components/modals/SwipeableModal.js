import React, { useState, useEffect } from "react";
import {
  Modal,
  StyleSheet,
  View,
  TouchableOpacity,
  Dimensions,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import hapticsService from "../../services/HapticsService";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function SwipeableModal({
  visible,
  onClose,
  onRequestClose,
  children,
  sheetStyle,
  statusBarTranslucent = true,
  backdropColor = "rgba(0, 0, 0, 0.4)",
  useBlur = false,
  blurIntensity = 20,
  blurTint = "dark",
  springConfig = { damping: 22, stiffness: 180, mass: 1 },
}) {
  const [shouldRender, setShouldRender] = useState(visible);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      translateY.value = withSpring(0, springConfig);
      backdropOpacity.value = withTiming(1, { duration: 300 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 250 });
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 }, () => {
        runOnJS(setShouldRender)(false);
      });
    }
  }, [visible]);

  const handleDismiss = () => {
    hapticsService.triggerClose();
    onClose();
  };

  const context = useSharedValue({ y: 0 });

  const panGesture = Gesture.Pan()
    .hitSlop({ top: 0, height: 120 })
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      // Only drag downwards (y > 0)
      translateY.value = Math.max(0, context.value.y + event.translationY);
    })
    .onEnd((event) => {
      // Threshold: 120px translation or velocity > 600 snaps to close
      if (translateY.value > 120 || event.velocityY > 600) {
        backdropOpacity.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 }, () => {
          runOnJS(handleDismiss)();
        });
      } else {
        translateY.value = withSpring(0, springConfig);
      }
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateY.value,
      [0, SCREEN_HEIGHT * 0.5],
      [1, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity: backdropOpacity.value * opacity,
    };
  });

  if (!shouldRender) return null;

  return (
    <Modal
      transparent
      visible={shouldRender}
      animationType="none"
      onRequestClose={onRequestClose || onClose}
      statusBarTranslucent={statusBarTranslucent}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.overlay}>
          {/* Backdrop */}
          <Animated.View
            style={[
              styles.backdrop,
              { backgroundColor: backdropColor },
              animatedBackdropStyle,
            ]}
          >
            {useBlur ? (
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={onClose}
              >
                <BlurView
                  intensity={blurIntensity}
                  tint={blurTint}
                  style={StyleSheet.absoluteFill}
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={onClose}
              />
            )}
          </Animated.View>

          {/* Sheet container with pan gesture */}
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.animatedSheet, animatedSheetStyle]}>
              <View style={sheetStyle}>
                {children}
              </View>
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  animatedSheet: {
    width: "100%",
    alignItems: "stretch",
  },
});
