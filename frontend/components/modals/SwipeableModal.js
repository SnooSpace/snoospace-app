import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Modal,
  StyleSheet,
  View,
  TouchableOpacity,
  Dimensions,
  Platform,
  Keyboard,
  ScrollView,
  FlatList,
  SectionList,
} from "react-native";
import { BlurView } from "expo-blur";
import { useKeyboardHandler, KeyboardAwareScrollView } from "react-native-keyboard-controller";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  Easing,
} from "react-native-reanimated";
import hapticsService from "../../services/HapticsService";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── SwipeableModalContext ──────────────────────────────────────────────────
export const SwipeableModalContext = React.createContext({
  scrollY: null,
  scrollProps: {},
  onScroll: () => {},
});

export function useSwipeableModalScroll() {
  return React.useContext(SwipeableModalContext);
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function SwipeableModal({
  visible,
  onClose,
  onRequestClose,
  children,
  sheetStyle,
  statusBarTranslucent = true,
  navigationBarTranslucent = false,
  backdropColor = "rgba(0, 0, 0, 0.4)",
  useBlur = false,
  blurIntensity = 20,
  blurTint = "dark",
  springConfig = { damping: 22, stiffness: 180, mass: 1 },
  swipeEnabled = true,
  swipeFromHeaderOnly = false,
  closeOnBackdropPress = true,
  header,
  avoidKeyboard = false,
}) {
  const [shouldRender, setShouldRender] = useState(visible);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const sheetHeight = useSharedValue(SCREEN_HEIGHT * 0.85);
  const backdropOpacity = useSharedValue(0);
  const isSwipedDownRef = useRef(false);
  const keyboardHeight = useSharedValue(0);

  // Scroll tracking shared value (0 = at top, > 0 = scrolled down)
  const scrollY = useSharedValue(0);

  useKeyboardHandler(
    {
      onStart: (e) => {
        "worklet";
        if (avoidKeyboard) {
          keyboardHeight.value = e.height;
        }
      },
      onMove: (e) => {
        "worklet";
        if (avoidKeyboard) {
          keyboardHeight.value = e.height;
        }
      },
      onEnd: (e) => {
        "worklet";
        if (avoidKeyboard) {
          keyboardHeight.value = e.height;
        }
      },
    },
    [avoidKeyboard]
  );

  useEffect(() => {
    if (visible) {
      isSwipedDownRef.current = false;
      scrollY.value = 0;
      // Reset values to start states synchronously before mounting layout
      translateY.value = SCREEN_HEIGHT;
      backdropOpacity.value = 0;
      setShouldRender(true);

      // Animate on the next frame after layout mounting has begun
      requestAnimationFrame(() => {
        translateY.value = withTiming(0, {
          duration: 220,
          easing: Easing.out(Easing.quad),
        });
        backdropOpacity.value = withTiming(1, { duration: 220 });
      });
    } else {
      if (isSwipedDownRef.current) {
        setShouldRender(false);
      } else {
        backdropOpacity.value = withTiming(0, { duration: 250 });
        translateY.value = withTiming(
          SCREEN_HEIGHT,
          { duration: 250 },
          () => {
            runOnJS(setShouldRender)(false);
          }
        );
      }
    }
  }, [visible]);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const handleDismiss = useCallback(() => {
    isSwipedDownRef.current = true;
    hapticsService.triggerClose();
    onClose();
  }, [onClose]);

  // ─── Gestures ─────────────────────────────────────────────────────────────
  const headerContext = useSharedValue({ y: 0 });
  const contentContext = useSharedValue({ y: 0 });
  const touchStartY = useSharedValue(0);

  // Header Pan Gesture: ALWAYS allows dragging down from the top handle / header
  const headerPanGesture = Gesture.Pan()
    .enabled(swipeEnabled)
    .activeOffsetY(10)
    .failOffsetY(-10)
    .onStart(() => {
      "worklet";
      runOnJS(dismissKeyboard)();
      headerContext.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      "worklet";
      if (event.translationY > 0) {
        translateY.value = Math.max(
          0,
          headerContext.value.y + event.translationY
        );
      }
    })
    .onEnd((event) => {
      "worklet";
      if (
        translateY.value > sheetHeight.value * 0.4 ||
        event.velocityY > 300
      ) {
        backdropOpacity.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(
          SCREEN_HEIGHT,
          { duration: 200 },
          () => {
            runOnJS(handleDismiss)();
          }
        );
      } else {
        translateY.value = withTiming(0, {
          duration: 200,
          easing: Easing.out(Easing.quad),
        });
      }
    });

  // Content Pan Gesture: ONLY activates when at top (scrollY <= 1) and dragging down
  // When scrolled down (scrollY > 1) or dragging up, it fails immediately to let ScrollView scroll natively
  const contentPanGesture = Gesture.Pan()
    .enabled(swipeEnabled)
    .manualActivation(true)
    .onTouchesDown((event) => {
      "worklet";
      touchStartY.value = event.allTouches[0]?.absoluteY ?? 0;
    })
    .onTouchesMove((event, stateManager) => {
      "worklet";
      const currentY = event.allTouches[0]?.absoluteY ?? 0;
      const deltaY = currentY - touchStartY.value;
      if (scrollY.value <= 1 && deltaY > 10) {
        stateManager.activate();
      } else if (scrollY.value > 1 || deltaY < -5) {
        stateManager.fail();
      }
    })
    .onStart(() => {
      "worklet";
      runOnJS(dismissKeyboard)();
      contentContext.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      "worklet";
      if (event.translationY > 0) {
        translateY.value = Math.max(
          0,
          contentContext.value.y + event.translationY
        );
      }
    })
    .onEnd((event) => {
      "worklet";
      if (
        translateY.value > sheetHeight.value * 0.4 ||
        event.velocityY > 300
      ) {
        backdropOpacity.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(
          SCREEN_HEIGHT,
          { duration: 200 },
          () => {
            runOnJS(handleDismiss)();
          }
        );
      } else {
        translateY.value = withTiming(0, {
          duration: 200,
          easing: Easing.out(Easing.quad),
        });
      }
    });

  const onScroll = useCallback(
    (event) => {
      const y = event?.nativeEvent?.contentOffset?.y ?? 0;
      scrollY.value = Math.max(0, y);
    },
    [scrollY]
  );

  const scrollProps = useMemo(
    () => ({
      onScroll: (event) => {
        const y = event?.nativeEvent?.contentOffset?.y ?? 0;
        scrollY.value = Math.max(0, y);
      },
      scrollEventThrottle: 16,
      bounces: false,
      overScrollMode: "never",
    }),
    [scrollY]
  );

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value - keyboardHeight.value }],
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

  if (!shouldRender) {
    return null;
  }

  return (
    <SwipeableModalContext.Provider value={{ scrollY, scrollProps, onScroll }}>
      <Modal
        transparent
        visible={shouldRender}
        animationType="none"
        onRequestClose={onRequestClose || onClose}
        statusBarTranslucent={statusBarTranslucent}
        navigationBarTranslucent={navigationBarTranslucent}
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
              {closeOnBackdropPress ? (
                useBlur ? (
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
                )
              ) : useBlur ? (
                <BlurView
                  intensity={blurIntensity}
                  tint={blurTint}
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <View style={StyleSheet.absoluteFill} />
              )}
            </Animated.View>

            {/* Sheet container */}
            <Animated.View
              style={[styles.animatedSheet, animatedSheetStyle]}
              onLayout={(e) => {
                sheetHeight.value = e.nativeEvent.layout.height;
              }}
            >
              <View style={[sheetStyle, { overflow: "hidden" }]}>
                {header ? (
                  <>
                    <GestureDetector gesture={headerPanGesture}>
                      <View collapsable={false}>{header}</View>
                    </GestureDetector>
                    {swipeFromHeaderOnly ? (
                      <View style={styles.contentContainer} collapsable={false}>
                        {children}
                      </View>
                    ) : (
                      <GestureDetector gesture={contentPanGesture}>
                        <View style={styles.contentContainer} collapsable={false}>
                          {children}
                        </View>
                      </GestureDetector>
                    )}
                  </>
                ) : swipeFromHeaderOnly ? (
                  <View collapsable={false}>{children}</View>
                ) : (
                  <GestureDetector gesture={contentPanGesture}>
                    <View collapsable={false}>{children}</View>
                  </GestureDetector>
                )}
              </View>
            </Animated.View>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </SwipeableModalContext.Provider>
  );
}

// ─── Convenience Sub-components ──────────────────────────────────────────────
SwipeableModal.ScrollView = function ModalScrollView(props) {
  const { scrollProps } = useSwipeableModalScroll();
  return (
    <ScrollView
      {...scrollProps}
      {...props}
      style={[{ flexGrow: 1, flexShrink: 1 }, props.style]}
      onScroll={(e) => {
        scrollProps?.onScroll?.(e);
        props.onScroll?.(e);
      }}
    />
  );
};

SwipeableModal.FlatList = function ModalFlatList(props) {
  const { scrollProps } = useSwipeableModalScroll();
  return (
    <FlatList
      {...scrollProps}
      {...props}
      style={[{ flexGrow: 1, flexShrink: 1 }, props.style]}
      onScroll={(e) => {
        scrollProps?.onScroll?.(e);
        props.onScroll?.(e);
      }}
    />
  );
};

SwipeableModal.KeyboardAwareScrollView = function ModalKeyboardAwareScrollView(props) {
  const { scrollProps } = useSwipeableModalScroll();
  return (
    <KeyboardAwareScrollView
      {...scrollProps}
      {...props}
      style={[{ flexGrow: 1, flexShrink: 1 }, props.style]}
      onScroll={(e) => {
        scrollProps?.onScroll?.(e);
        props.onScroll?.(e);
      }}
    />
  );
};

SwipeableModal.SectionList = function ModalSectionList(props) {
  const { scrollProps } = useSwipeableModalScroll();
  return (
    <SectionList
      {...scrollProps}
      {...props}
      style={[{ flexGrow: 1, flexShrink: 1 }, props.style]}
      onScroll={(e) => {
        scrollProps?.onScroll?.(e);
        props.onScroll?.(e);
      }}
    />
  );
};

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
  contentContainer: {
    flexGrow: 1,
    flexShrink: 1,
  },
});
