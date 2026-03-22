import React from "react";
import { StyleSheet, TouchableOpacity, Platform, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { COLORS } from "../constants/theme";

/**
 * GlassBackButton - Reusable glassy back button
 * 
 * Used in SignupHeader and specialized screens like LandingScreen
 */
const GlassBackButton = ({
  onPress,
  style,
  iconName, // Left for backward compatibility
  IconComponent = ArrowLeft,
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
      style={[styles.shadowWrapper, style]}
      activeOpacity={0.7}
    >
      <View style={styles.clippingContainer}>
        <BlurView
          intensity={60}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.iconContainer}>
          <IconComponent size={24} color="#000" strokeWidth={2} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  shadowWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "transparent",
    // Premium Shadow - match Login Screen
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  clippingContainer: {
    flex: 1,
    borderRadius: 22,
    overflow: "hidden", // Important: Clips the BlurView
    backgroundColor: "rgba(255, 255, 255, 0.2)",
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
