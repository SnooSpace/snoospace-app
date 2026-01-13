import React, { useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  Share,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../constants/theme";
import { BlurView } from "expo-blur";

const { width, height } = Dimensions.get("window");

const CelebrationModal = ({
  visible,
  onClose,
  type = "post", // 'post' | 'booking' | 'event'
  data = {},
  onSecondaryAction,
}) => {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(50);

  // Confetti/particles could be added here with more shared values

  useEffect(() => {
    if (visible) {
      // Trigger Haptics
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Animate In
      scale.value = withSpring(1, { damping: 12 });
      opacity.value = withTiming(1, { duration: 300 });
      translateY.value = withSpring(0, { damping: 12 });
    } else {
      // Reset
      scale.value = 0.5;
      opacity.value = 0;
      translateY.value = 50;
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const handleShare = async () => {
    try {
      const message =
        type === "event"
          ? `Check out this event: ${data.title} on SnooSpace!`
          : `I just posted on SnooSpace! Check it out.`;

      await Share.share({
        message,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const getSuccessMessage = () => {
    switch (type) {
      case "post":
        return "Post Published!";
      case "booking":
        return "Ticket Booked!";
      case "event":
        return "Event Created!";
      default:
        return "Success!";
    }
  };

  const getSubMessage = () => {
    switch (type) {
      case "post":
        return "Your community is going to love this.";
      case "booking":
        return "Get ready for an amazing experience.";
      case "event":
        return "Now, let's fill up those seats!";
      default:
        return "Action completed successfully.";
    }
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />

        <Animated.View style={[styles.card, animatedStyle]}>
          {/* Success Icon/Badge */}
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={["#4ADE80", "#22C55E"]}
              style={styles.iconCircle}
            >
              <Ionicons name="checkmark-sharp" size={40} color="#FFF" />
            </LinearGradient>
          </View>

          {/* Ticket/Card Content */}
          <View style={styles.content}>
            <Text style={styles.title}>{getSuccessMessage()}</Text>
            <Text style={styles.subtitle}>{getSubMessage()}</Text>

            {/* Visual Flair / Ticket Stub look */}
            <View style={styles.divider}>
              <View style={[styles.notch, styles.notchLeft]} />
              <View style={styles.dashedLine} />
              <View style={[styles.notch, styles.notchRight]} />
            </View>

            {/* "What's Next" Section */}
            <View style={styles.whatsNext}>
              <Text style={styles.whatsNextTitle}>What's Next?</Text>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleShare}
              >
                <LinearGradient
                  colors={COLORS.primaryGradient || ["#00C6FF", "#0072FF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryGradient}
                >
                  <Ionicons name="share-outline" size={20} color="#FFF" />
                  <Text style={styles.primaryButtonText}>
                    Share with Friends
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onClose}
              >
                <Text style={styles.secondaryButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: width * 0.85,
    backgroundColor: "#FFF",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    alignItems: "center",
  },
  iconContainer: {
    marginTop: -30,
    marginBottom: 10,
    padding: 10,
    backgroundColor: "#FFF",
    borderRadius: 50,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: 24,
    alignItems: "center",
    width: "100%",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    width: "116%", // Wider than container to push notches out
    height: 30,
    marginBottom: 20,
    marginLeft: -20, // Center it (116 - 100 / 2ish) - adjusted mostly by visual feel or calc
  },
  notch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.5)", // Match blur/overlay roughly or exact
    // Ideally this matches the background behind the modal.
    // Since we use BlurView, we might just transparent or use a dark color.
    // Let's use a dark gray to simulate the "cutout" look against the dark blur.
    backgroundColor: "#333",
  },
  notchLeft: {
    marginLeft: -10,
  },
  notchRight: {
    marginRight: -10,
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    marginHorizontal: 10,
  },
  whatsNext: {
    width: "100%",
    alignItems: "center",
    gap: 12,
  },
  whatsNextTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9CA3AF",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  primaryButton: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    overflow: "hidden",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    color: COLORS.textSecondary || "#6B7280",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default CelebrationModal;
