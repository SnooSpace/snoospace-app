import React, { useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { CheckCircle2, FileCheck, Briefcase } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { COLORS, FONTS, SHADOWS } from "../../constants/theme";

const { width } = Dimensions.get("window");

export default function OpportunitySuccessModal({
  visible,
  title,
  message,
  isDraft = false,
  onClose,
}) {
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Trigger success haptic feedback safely
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err) {
        console.warn("Failed to trigger haptic feedback:", err);
      }

      // Start modal content animations
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.92);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  // Determine colors and icon based on state
  const isDraftTheme = isDraft || title?.toLowerCase().includes("draft");
  const themeColor = isDraftTheme ? COLORS.primary : COLORS.success;
  const badgeBg = isDraftTheme ? "rgba(41, 98, 255, 0.08)" : "rgba(52, 199, 89, 0.08)";
  const badgeBorder = isDraftTheme ? "rgba(41, 98, 255, 0.15)" : "rgba(52, 199, 89, 0.15)";

  const renderIcon = () => {
    if (isDraftTheme) {
      return <FileCheck size={36} color={themeColor} strokeWidth={2} />;
    } else if (title?.toLowerCase().includes("update")) {
      return <CheckCircle2 size={36} color={themeColor} strokeWidth={2} />;
    } else {
      return <Briefcase size={36} color={themeColor} strokeWidth={2} />;
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        {/* Glassmorphic Background Blur */}
        <BlurView
          intensity={30}
          style={StyleSheet.absoluteFill}
          tint="dark"
        />

        <Animated.View
          style={[
            styles.container,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Top highlight line for premium feel */}
          <View style={styles.topHighlight} />

          {/* Animated/Glowing Icon Container */}
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: badgeBg, borderColor: badgeBorder },
            ]}
          >
            {renderIcon()}
          </View>

          {/* Title - BasicCommercial-Bold only */}
          <Text style={styles.title}>{title}</Text>

          {/* Subtitle / Message - Manrope-Regular */}
          <Text style={styles.message}>{message}</Text>

          {/* Primary Action Button - Manrope-SemiBold */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={COLORS.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Got it</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)", // Premium dark tint overlay
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  container: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: COLORS.surface,
    borderRadius: 28, // Large premium border radius
    padding: 28,
    alignItems: "center",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  topHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    zIndex: 10,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  title: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 22,
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  message: {
    fontFamily: FONTS.regular, // Manrope-Regular
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  primaryButton: {
    width: "100%",
    height: 52,
    borderRadius: 14,
    overflow: "hidden",
  },
  buttonGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    fontFamily: FONTS.semiBold, // Manrope-SemiBold
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
});
