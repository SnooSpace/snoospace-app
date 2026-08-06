import React from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Reply } from "lucide-react-native";

const AnimatedGestureCell = ({
  translateX,
  scale,
  replyProgress,
  isMyMessage,
  gestureEnabled,
  children,
}) => {


  const animatedBubbleStyle = useAnimatedStyle(() => {
    if (translateX.value === 0 && scale.value === 1) {
      return {};
    }
    return {
      transform: [{ translateX: translateX.value }, { scale: scale.value }],
    };
  });

  const animatedIconStyle = useAnimatedStyle(() => {
    if (replyProgress.value === 0) {
      return { opacity: 0 };
    }
    const opacity = interpolate(
      replyProgress.value,
      [0, 0.4, 1],
      [0, 0.5, 1],
      Extrapolation.CLAMP,
    );
    const iconScale = interpolate(
      replyProgress.value,
      [0, 1],
      [0.6, 1],
      Extrapolation.CLAMP,
    );
    const startX = isMyMessage ? 10 : -10;
    const iconTranslateX = interpolate(
      replyProgress.value,
      [0, 1],
      [startX, 0],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [{ scale: iconScale }, { translateX: iconTranslateX }],
    };
  });

  return (
    <View style={styles.outerWrapper}>
      {gestureEnabled && (
        <View
          style={[
            styles.replyIconContainer,
            isMyMessage ? styles.replyIconRight : styles.replyIconLeft,
          ]}
          pointerEvents="none"
        >
          <Animated.View style={[styles.replyIconCircle, animatedIconStyle]}>
            <Reply size={16} color="#3565F2" strokeWidth={2.5} />
          </Animated.View>
        </View>
      )}
      <Animated.View style={animatedBubbleStyle}>
        <View style={{ width: "100%" }}>{children}</View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: { position: "relative" },
  replyIconContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 0,
    width: 40,
  },
  replyIconLeft: { left: 8 },
  replyIconRight: { right: 8 },
  replyIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(53, 101, 242, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default React.memo(AnimatedGestureCell);
