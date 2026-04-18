import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Constants from "expo-constants";
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";

let RNSkeletonPlaceholder = null;
const isExpoGo = Constants.appOwnership === "expo";

if (!isExpoGo) {
  RNSkeletonPlaceholder = require("react-native-skeleton-placeholder").default;
}

// A simple pulsing skeleton block for Expo Go to avoid native module crashes
const PulseSkeletonItem = ({ width, height, marginBottom, borderRadius }) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 1000 }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width: width || "100%",
          height: height || 20,
          marginBottom: marginBottom || 8,
          borderRadius: borderRadius || 4,
          backgroundColor: "#E5E7EB",
        },
        animatedStyle,
      ]}
    />
  );
};

// Map children to PulseSkeletonItems if it's Expo Go
const PulseSkeleton = ({ children }) => {
  return (
    <View style={styles.pulseContainer}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        return (
          <PulseSkeletonItem
            width={child.props.width}
            height={child.props.height}
            marginBottom={child.props.marginBottom}
            borderRadius={child.props.borderRadius || 16}
          />
        );
      })}
    </View>
  );
};

export default function SkeletonPlaceholder(props) {
  if (isExpoGo) {
    return <PulseSkeleton>{props.children}</PulseSkeleton>;
  }
  return <RNSkeletonPlaceholder {...props} />;
}

SkeletonPlaceholder.Item = ({ children, ...props }) => {
  if (isExpoGo) {
    return <PulseSkeletonItem {...props} />;
  }
  return <RNSkeletonPlaceholder.Item {...props}>{children}</RNSkeletonPlaceholder.Item>;
};

const styles = StyleSheet.create({
  pulseContainer: {
    padding: 16,
  },
});
