import React from "react";
import { StyleSheet, TouchableOpacity, Platform, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { COLORS } from "../constants/theme";

const GlassBackButton = ({
  onPress,
  style,
  iconName = "arrow-back-outline",
}) => {
  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress && onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[styles.container, style]}
      activeOpacity={0.7}
    >
      <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.iconContainer}>
        <Ionicons name={iconName} size={24} color="#000" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 22,
    overflow: "hidden",
    width: 44,
    height: 44,
    backgroundColor: "rgba(255, 255, 255, 0.7)", // Slightly more opaque for better visibility
    // Shadow
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    // Glass Border
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
  },
  iconContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
});

export default GlassBackButton;
