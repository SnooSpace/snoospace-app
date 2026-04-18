import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, Dimensions, Platform, Pressable } from "react-native";
import Animated, {
  FadeInUp,
  FadeOutUp,
  withSpring,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Check, AlertCircle, Info, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, BORDER_RADIUS, SHADOWS } from "../../constants/theme";

const { width } = Dimensions.get("window");

const TOAST_TYPES = {
  success: {
    icon: Check,
    color: "#34C759", // Premium iOS Success Green
    bg: "rgba(52, 199, 89, 0.1)",
  },
  error: {
    icon: AlertCircle,
    color: "#FF3B30", // Premium iOS Error Red
    bg: "rgba(255, 59, 48, 0.1)",
  },
  info: {
    icon: Info,
    color: "#007AFF", // Premium iOS Info Blue
    bg: "rgba(0, 122, 255, 0.1)",
  },
};

const Toast = ({ title, message, type = "success", onDismiss }) => {
  const insets = useSafeAreaInsets();
  const IconComponent = TOAST_TYPES[type]?.icon || Info;
  const mainColor = TOAST_TYPES[type]?.color || COLORS.primary;
  const bgColor = TOAST_TYPES[type]?.bg || "rgba(255, 255, 255, 0.8)";

  const scale = useSharedValue(0.9);

  useEffect(() => {
    Haptics.notificationAsync(
      type === "error" 
        ? Haptics.NotificationFeedbackType.Error 
        : Haptics.NotificationFeedbackType.Success
    );
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInUp.duration(400).springify()}
      exiting={FadeOutUp.duration(300)}
      style={[
        styles.container,
        { top: insets.top + 12 },
        animatedStyle
      ]}
    >
      <BlurView intensity={70} tint="light" style={styles.blurWrapper}>
        <View style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
            <IconComponent size={20} color={mainColor} strokeWidth={2.5} />
          </View>
          
          <View style={styles.textContainer}>
            {title && <Text style={styles.title}>{title}</Text>}
            <Text style={styles.message}>{message}</Text>
          </View>

          <Pressable 
            onPress={onDismiss}
            style={styles.closeButton}
            hitSlop={12}
          >
            <X size={16} color={COLORS.textMuted} strokeWidth={2.5} />
          </Pressable>
        </View>
        
        {/* Subtle bottom indicator */}
        <View style={[styles.indicator, { backgroundColor: mainColor }]} />
      </BlurView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 99999,
    ...SHADOWS.xl,
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  blurWrapper: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
  },
  title: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 15,
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  message: {
    fontFamily: "Manrope-Medium",
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
  indicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.8,
  },
});

export default Toast;
