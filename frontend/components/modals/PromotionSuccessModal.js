import React, { useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import {
  Megaphone,
  BarChart3,
  MessageCircle,
  HelpCircle,
  Lightbulb,
  Calendar,
  X,
} from "lucide-react-native";
import { COLORS, FONTS, SHADOWS } from "../../constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ENGAGEMENT_CONFIG = {
  poll: {
    label: "Poll attached",
    Icon: BarChart3,
    color: "#7C3AED",
    bg: "#F3EFFE",
  },
  qna: {
    label: "Q&A attached",
    Icon: MessageCircle,
    color: "#0EA5E9",
    bg: "#E0F6FF",
  },
  prompt: {
    label: "Prompt attached",
    Icon: HelpCircle,
    color: "#F59E0B",
    bg: "#FEF3C7",
  },
  opportunity: {
    label: "Opportunity attached",
    Icon: Lightbulb,
    color: "#10B981",
    bg: "#D1FAE5",
  },
};

const PromotionSuccessModal = ({
  visible,
  onClose,
  eventData,
  engagementType,
  quota,
}) => {
  const scale = useSharedValue(0.92);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}

      scale.value = withTiming(1, {
        duration: 280,
        easing: Easing.out(Easing.cubic),
      });
      opacity.value = withTiming(1, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      scale.value = 0.92;
      opacity.value = 0;
    }
  }, [visible]);

  const animatedModalStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  const eventTitle = eventData?.title || "Your Event";
  const coverUri =
    eventData?.cover_image ||
    eventData?.image_urls?.[0] ||
    eventData?.flyer_url ||
    eventData?.banner_image;

  const dateRaw = eventData?.event_date || eventData?.start_datetime;
  let formattedDate = null;
  if (dateRaw) {
    try {
      const d = new Date(dateRaw);
      formattedDate = d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    } catch (_) {}
  }

  const engagement = engagementType ? ENGAGEMENT_CONFIG[engagementType] : null;
  const TagIcon = engagement?.Icon;

  const quotaRemaining = quota?.remaining;
  const quotaMax = quota?.max;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Subtle blurred backdrop */}
        {Platform.OS === "ios" ? (
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={styles.androidBackdrop} />
        )}

        <Animated.View style={[styles.card, animatedModalStyle]}>
          {/* Close button at top right */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={18} color="#94A3B8" strokeWidth={2} />
          </TouchableOpacity>

          {/* Hero Icon Container */}
          <View style={styles.heroIconContainer}>
            <Megaphone size={28} color="#7C3AED" strokeWidth={2} />
          </View>

          {/* Live Status Pill */}
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE IN FEED</Text>
          </View>

          {/* Main Title - Authority Rule: BasicCommercialBlack used strictly once */}
          <Text style={styles.title}>Promotion is Live!</Text>

          {/* Body Description - Body Text Rule: Manrope Regular */}
          <Text style={styles.description}>
            Your event is now being promoted across the community feed with your
            interactive engagement.
          </Text>

          {/* Event Preview Card - Weight Discipline: 1 Bold weight + 1 Medium weight */}
          <View style={styles.eventCard}>
            {coverUri ? (
              <Image
                source={{ uri: coverUri }}
                style={styles.coverImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Calendar size={20} color="#64748B" strokeWidth={2} />
              </View>
            )}

            <View style={styles.eventDetails}>
              {/* Event Title - Structural Rule: BasicCommercialBold */}
              <Text style={styles.eventTitle} numberOfLines={1}>
                {eventTitle}
              </Text>

              {/* Date Metadata - Metadata Rule: Manrope Medium */}
              {formattedDate && (
                <Text style={styles.eventDate} numberOfLines={1}>
                  {formattedDate}
                </Text>
              )}

              {/* Engagement Tag Pill */}
              {engagement && TagIcon && (
                <View
                  style={[
                    styles.tagPill,
                    { backgroundColor: engagement.bg },
                  ]}
                >
                  <TagIcon size={12} color={engagement.color} strokeWidth={2} />
                  <Text
                    style={[
                      styles.tagPillText,
                      { color: engagement.color },
                    ]}
                  >
                    {engagement.label}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Quota Counter - Metadata Rule: Manrope Medium */}
          {quotaRemaining !== undefined && quotaMax !== undefined && (
            <View style={styles.quotaRow}>
              <Text style={styles.quotaText}>
                {quotaRemaining} of {quotaMax} weekly promotes remaining
              </Text>
            </View>
          )}

          {/* Primary Action Button - Functional UI Rule: Manrope SemiBold */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Done</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor:
      Platform.OS === "ios" ? "rgba(15, 23, 42, 0.45)" : "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  androidBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
  },
  card: {
    width: Math.min(SCREEN_WIDTH - 48, 350),
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: "center",
    ...SHADOWS.large,
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.16,
        shadowRadius: 28,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  heroIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F3EFFE",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
    marginRight: 6,
  },
  liveBadgeText: {
    fontFamily: FONTS.medium, // Manrope-Medium
    fontSize: 11,
    letterSpacing: 0.8,
    color: "#047857",
  },
  title: {
    fontFamily: FONTS.basicCommercialBlack, // BasicCommercial-Black (Strictly once)
    fontSize: 22,
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    fontFamily: FONTS.regular, // Manrope-Regular
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  eventCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  coverImage: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
  },
  coverPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  eventDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  eventTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 15,
    color: "#0F172A",
    marginBottom: 3,
  },
  eventDate: {
    fontFamily: FONTS.medium, // Manrope-Medium
    fontSize: 13,
    color: "#64748B",
    marginBottom: 4,
  },
  tagPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 2,
  },
  tagPillText: {
    fontFamily: FONTS.medium, // Manrope-Medium
    fontSize: 11,
    marginLeft: 4,
  },
  quotaRow: {
    marginBottom: 16,
  },
  quotaText: {
    fontFamily: FONTS.medium, // Manrope-Medium
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
  },
  primaryButton: {
    width: "100%",
    height: 52,
    borderRadius: 16,
    backgroundColor: "#7C3AED",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#7C3AED",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  primaryButtonText: {
    fontFamily: FONTS.semiBold, // Manrope-SemiBold (16px standard)
    fontSize: 16,
    color: "#FFFFFF",
  },
});

export default React.memo(PromotionSuccessModal);
