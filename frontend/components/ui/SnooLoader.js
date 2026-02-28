import React from "react";
import { View, StyleSheet } from "react-native";
import LottieView from "lottie-react-native";

const SnooLoader = ({ size = "small", color, style, ...props }) => {
  // Determine dimensions based on size prop to mimic ActivityIndicator
  let dimensions = 24; // default small
  if (size === "large") {
    dimensions = 48;
  } else if (typeof size === "number") {
    dimensions = size;
  }

  return (
    <View style={[styles.container, style]} {...props}>
      <LottieView
        source={require("../../assets/animations/loading.json")}
        autoPlay
        loop
        style={{ width: dimensions, height: dimensions }}
        // The color prop is ignored for now since the Lottie animation likely has its own colors
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
});

export default SnooLoader;
