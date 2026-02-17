import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  Modal,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
  interpolate,
  useDerivedValue,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import {
  Camera,
  BarChart2,
  Sparkles,
  MessageCircle,
  Trophy,
  Image as ImageIcon,
  Check,
} from "lucide-react-native";
import { COLORS, FONTS, SHADOWS } from "../../constants/theme";
import HapticsService from "../../services/HapticsService";

const { width } = Dimensions.get("window");

const SuccessCard = ({
  visible,
  type = "media", // media | poll | prompt | qna | challenge
  data: inputData,
  onPrimaryAction, // "View post"
  onSecondaryAction, // "Create another"
}) => {
  const data = inputData || {};

  // Shared Values for Animation
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      progress.value = withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.back(1.2)), // Slight overshoot for "float up" feel
      });
      // Trigger haptic
      HapticsService.triggerNotificationSuccess();
    } else {
      progress.value = withTiming(0, { duration: 300 });
    }
  }, [visible]);

  // Derived Animations
  const backdropOpacity = useDerivedValue(() =>
    interpolate(progress.value, [0, 1], [0, 1]),
  );
  const cardTranslateY = useDerivedValue(() =>
    interpolate(progress.value, [0, 1], [50, 0]),
  );
  const cardScale = useDerivedValue(() =>
    interpolate(progress.value, [0, 1], [0.95, 1]),
  );
  const contentOpacity = useDerivedValue(() =>
    interpolate(progress.value, [0.3, 1], [0, 1]),
  );

  const rBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const rCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: cardTranslateY.value },
      { scale: cardScale.value },
    ],
    opacity: progress.value,
  }));

  const rContentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  // Configuration based on type
  const getConfig = () => {
    switch (type) {
      case "media":
        return {
          icon: Camera,
          accent: "#3B82F6", // Blue
          title: "Post published",
          subtitle: "Your media is now live in the community.",
          primaryAction: "View post",
          IconComponent: data.hasVideo ? VideoIcon : Camera,
        };
      case "poll":
        return {
          icon: BarChart2,
          accent: "#3B82F6", // Blue
          title: "Poll is live",
          subtitle: "Members can now vote and share their opinion.",
          primaryAction: "View poll",
        };
      case "prompt":
        return {
          icon: Sparkles,
          accent: "#8B5CF6", // Purple/Indigo
          title: "Prompt published",
          subtitle: "Your community can now respond.",
          primaryAction: "See responses",
        };
      case "qna":
        return {
          icon: MessageCircle,
          accent: "#14B8A6", // Teal
          title: "Q&A started",
          subtitle: "Questions are now open.",
          primaryAction: "View questions",
        };
      case "challenge":
        return {
          icon: Trophy,
          accent: "#F59E0B", // Orange/Gold
          title: "Challenge created",
          subtitle: "Let the community begin.",
          primaryAction: "View challenge",
        };
      default:
        return {
          icon: Check,
          accent: COLORS.primary,
          title: "Success",
          subtitle: "Action completed successfully.",
          primaryAction: "Done",
        };
    }
  };

  const config = getConfig();
  const Icon = config.icon;

  // Render specific "Extra Touch" content
  const renderExtraTouch = () => {
    switch (type) {
      case "media":
        // Mini thumbnail preview
        return data.thumbnail ? (
          <View style={styles.thumbnailContainer}>
            <Image source={{ uri: data.thumbnail }} style={styles.thumbnail} />
            <View style={styles.thumbnailIconOverlay}>
              <Icon size={16} color="#FFF" />
            </View>
          </View>
        ) : null;

      case "poll":
        // Show poll question as quote
        return (
          <View style={styles.quoteContainer}>
            <Text style={styles.quoteText} numberOfLines={2}>
              "{data.question || "Poll Question"}"
            </Text>
          </View>
        );

      case "prompt":
        // Italic preview of prompt text
        return (
          <View style={styles.quoteContainer}>
            <Text
              style={[styles.quoteText, { fontStyle: "italic" }]}
              numberOfLines={2}
            >
              {data.prompt_text || "Prompt text..."}
            </Text>
          </View>
        );

      case "qna":
        // Badge for anonymous
        return data.allow_anonymous ? (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>Anonymous allowed</Text>
          </View>
        ) : null;

      case "challenge":
        // Summary chips
        return (
          <View style={styles.chipsRow}>
            {data.challenge_type && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {data.challenge_type === "single"
                    ? "Single Task"
                    : "Multi Task"}
                </Text>
              </View>
            )}
            {data.target_count && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {data.target_count} Submissions
                </Text>
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Dimmed Background */}
        <Animated.View style={[StyleSheet.absoluteFill, rBackdropStyle]}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} />
          </BlurView>
        </Animated.View>

        {/* Success Card */}
        <Animated.View style={[styles.card, rCardStyle]}>
          {/* Top Icon */}
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: `${config.accent}15` },
            ]}
          >
            <Animated.View style={rContentStyle}>
              <Icon size={28} color={config.accent} strokeWidth={2.5} />
            </Animated.View>
          </View>

          {/* Text Content */}
          <Animated.View style={[styles.textContainer, rContentStyle]}>
            <Text style={styles.title}>{config.title}</Text>
            <Text style={styles.subtitle}>{config.subtitle}</Text>
          </Animated.View>

          {/* Extra Touch (Thumbnail, Quote, etc.) */}
          <Animated.View style={[styles.extraContent, rContentStyle]}>
            {renderExtraTouch()}
          </Animated.View>

          {/* Actions */}
          <Animated.View style={[styles.actionsContainer, rContentStyle]}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: config.accent }]}
              onPress={onPrimaryAction}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>
                {config.primaryAction}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onSecondaryAction}
            >
              <Text style={styles.secondaryButtonText}>Create another</Text>
            </TouchableOpacity>
          </Animated.View>
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
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 40,
    elevation: 8,
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontFamily: "BasicCommercial-Bold", // User requested BasicCommercial Bold
    fontSize: 20,
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  extraContent: {
    marginBottom: 24,
    width: "100%",
    alignItems: "center",
  },
  // Extra Touch Styles
  thumbnailContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  thumbnailIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  quoteContainer: {
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 12,
    width: "100%",
  },
  quoteText: {
    fontFamily: "Manrope-Medium",
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
  },
  badgeContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: "#F0FDFA",
    borderWidth: 1,
    borderColor: "#CCFBF1",
  },
  badgeText: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: "#0F766E",
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#FFF7ED",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFEDD5",
  },
  chipText: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: "#C2410C",
  },
  // Actions
  actionsContainer: {
    width: "100%",
    gap: 12,
  },
  primaryButton: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  primaryButtonText: {
    fontFamily: "Manrope-Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  secondaryButton: {
    width: "100%",
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontFamily: "Manrope-Medium",
    fontSize: 14,
    color: "#6B7280",
  },
});

export default SuccessCard;
