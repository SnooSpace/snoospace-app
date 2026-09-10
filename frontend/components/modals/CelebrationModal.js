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
  StatusBar,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { BadgeCheck, Ticket } from "lucide-react-native";
import Svg, {
  Path,
  Defs,
  ClipPath,
  G,
  Rect,
  Line,
} from "react-native-svg";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// 340 x 500 coordinate system matching the SVG design
const TICKET_DESIGN_WIDTH = 340;
const TICKET_DESIGN_HEIGHT = 500;
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 36, TICKET_DESIGN_WIDTH);
const CARD_HEIGHT = (CARD_WIDTH * TICKET_DESIGN_HEIGHT) / TICKET_DESIGN_WIDTH;
const SCALE_FACTOR = CARD_WIDTH / TICKET_DESIGN_WIDTH;

// Ticket Silhouette with Zig-Zag Top & Bottom Edges + Side Notches
const TICKET_PATH = `
  M 16,30 
  L 28,16 L 40,30 L 52,16 L 64,30 L 76,16 L 88,30 L 100,16 L 112,30 L 124,16 L 136,30 L 148,16 L 160,30 L 172,16 L 184,30 L 196,16 L 208,30 L 220,16 L 232,30 L 244,16 L 256,30 L 268,16 L 280,30 L 292,16 L 304,30 L 316,16 L 324,24 
  V 300 
  A 14,14 0 0 0 310,314 
  A 14,14 0 0 0 324,328 
  V 466 
  L 316,474 L 304,460 L 292,474 L 280,460 L 268,474 L 256,460 L 244,474 L 232,460 L 220,474 L 208,460 L 196,474 L 184,460 L 172,474 L 160,460 L 148,474 L 136,460 L 124,474 L 112,460 L 100,474 L 88,460 L 76,474 L 64,460 L 52,474 L 40,460 L 28,474 L 16,460 
  V 328 
  A 14,14 0 0 0 30,314 
  A 14,14 0 0 0 16,300 
  V 24 
  Z
`;

const CelebrationModal = ({
  visible,
  onClose,
  type = "booking", // 'booking' | 'event' | 'post'
  data = {},
}) => {
  // Smooth timing animation — zero bounce / no overshoot
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);

  useEffect(() => {
    if (visible) {
      StatusBar.setBarStyle("light-content", true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      scale.value = withTiming(1, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      });
      opacity.value = withTiming(1, {
        duration: 200,
        easing: Easing.out(Easing.cubic),
      });
      translateY.value = withTiming(0, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      scale.value = 0.95;
      opacity.value = 0;
      translateY.value = 16;
    }

    return () => {
      StatusBar.setBarStyle("dark-content", true);
    };
  }, [visible]);

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  // Text resolvers based on flow type
  const getBadgeLabel = () => {
    switch (type) {
      case "booking":
        return "BOOKING CONFIRMED";
      case "event":
        return "EVENT CREATED";
      case "post":
        return "POST PUBLISHED";
      default:
        return "SUCCESS";
    }
  };

  const getTitle = () => {
    switch (type) {
      case "booking":
        return "Ticket Booked!";
      case "event":
        return "Event Created!";
      case "post":
        return "Post Published!";
      default:
        return "Confirmed!";
    }
  };

  const getSubtitle = () => {
    switch (type) {
      case "booking":
        return "Get ready for an amazing experience.";
      case "event":
        return "Now, let's fill up those seats!";
      case "post":
        return "Your community is going to love this.";
      default:
        return "Action completed successfully.";
    }
  };

  const eventTitle = data.title || "Grand Theft Auto Premier";
  const ticketTier = data.ticketTier || "Standard Access";
  const ticketCount = data.ticketCount || 1;
  const orderId = data.orderId || "#GTA-9042-X";

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <StatusBar
        barStyle="light-content"
        translucent={true}
        backgroundColor="transparent"
        animated={true}
      />
      <View style={styles.overlay}>
        {/* Dark blurred backdrop */}
        <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.darkDimmer} />

        {/* Modal Ticket Body */}
        <Animated.View style={[styles.cardOuter, animatedCardStyle]}>
          <View
            style={[
              styles.cardCanvas,
              {
                transform: [{ scale: SCALE_FACTOR }],
              },
            ]}
          >
            {/* Layer 1: SVG Ticket Silhouette, Clipped Header & Perforation */}
            <Svg
              width={TICKET_DESIGN_WIDTH}
              height={TICKET_DESIGN_HEIGHT}
              viewBox={`0 0 ${TICKET_DESIGN_WIDTH} ${TICKET_DESIGN_HEIGHT}`}
              style={StyleSheet.absoluteFill}
            >
              <Defs>
                <ClipPath id="ticketClip">
                  <Path d={TICKET_PATH} />
                </ClipPath>
              </Defs>

              {/* White ticket background */}
              <Path d={TICKET_PATH} fill="#FFFFFF" />

              {/* Elements clipped strictly inside the ticket perimeter */}
              <G clipPath="url(#ticketClip)">
                {/* Top Header Area */}
                <Rect x="0" y="0" width="340" height="96" fill="#F8FAFC" />
                <Line
                  x1="0"
                  y1="96"
                  x2="340"
                  y2="96"
                  stroke="#E2E8F0"
                  strokeWidth="1"
                />

                {/* Stub Perforation Line Between Side Cut Notches */}
                <Line
                  x1="30"
                  y1="314"
                  x2="310"
                  y2="314"
                  stroke="#CBD5E1"
                  strokeWidth="1.8"
                  strokeDasharray="5 5"
                />
              </G>
            </Svg>

            {/* Layer 2: UI Elements positioned accurately on top */}

            {/* 1. Top Badge Pill (Clean Mint Tone, Centered Text, No Green Dot on 'B') */}
            <View style={styles.badgePill}>
              <Text style={styles.badgeLabel}>{getBadgeLabel()}</Text>
            </View>

            {/* 2. Success Check Icon (Lucide BadgeCheck in Soft Tinted Container) */}
            <View style={styles.iconCircle}>
              <BadgeCheck size={26} color="#059669" strokeWidth={2.2} />
            </View>

            {/* 3. Main Headings */}
            <View style={styles.headingArea}>
              <Text style={styles.titleText}>{getTitle()}</Text>
              <Text style={styles.subtitleText}>{getSubtitle()}</Text>
            </View>

            {/* 4. Mini Event Summary Card */}
            <View style={styles.eventCard}>
              {data.coverImage ? (
                <Image
                  source={{ uri: data.coverImage }}
                  style={styles.eventThumbImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.eventThumbPlaceholder}>
                  <Ticket size={18} color="#475569" strokeWidth={2} />
                </View>
              )}

              <View style={styles.eventCardTextContainer}>
                <Text style={styles.eventTitle} numberOfLines={1}>
                  {eventTitle}
                </Text>
                <Text style={styles.eventMeta} numberOfLines={1}>
                  {ticketTier} • {ticketCount} Ticket{ticketCount > 1 ? "s" : ""}
                </Text>
              </View>
            </View>

            {/* 5. Barcode & Order Identifier Row */}
            <View style={styles.barcodeRow}>
              {/* Minimal Barcode Strip */}
              <Svg width={78} height={24} viewBox="0 0 78 24">
                <Line x1="4" y1="0" x2="4" y2="24" stroke="#0F172A" strokeWidth="2.5" />
                <Line x1="10" y1="0" x2="10" y2="24" stroke="#0F172A" strokeWidth="1" />
                <Line x1="15" y1="0" x2="15" y2="24" stroke="#0F172A" strokeWidth="3.5" />
                <Line x1="22" y1="0" x2="22" y2="24" stroke="#0F172A" strokeWidth="1.5" />
                <Line x1="28" y1="0" x2="28" y2="24" stroke="#0F172A" strokeWidth="2.5" />
                <Line x1="36" y1="0" x2="36" y2="24" stroke="#0F172A" strokeWidth="4.5" />
                <Line x1="45" y1="0" x2="45" y2="24" stroke="#0F172A" strokeWidth="1.5" />
                <Line x1="51" y1="0" x2="51" y2="24" stroke="#0F172A" strokeWidth="3" />
                <Line x1="58" y1="0" x2="58" y2="24" stroke="#0F172A" strokeWidth="1" />
                <Line x1="64" y1="0" x2="64" y2="24" stroke="#0F172A" strokeWidth="3" />
                <Line x1="72" y1="0" x2="72" y2="24" stroke="#0F172A" strokeWidth="2" />
              </Svg>

              {/* Order Identifier */}
              <View style={styles.orderIdContainer}>
                <Text style={styles.orderIdLabel}>ORDER ID</Text>
                <Text style={styles.orderIdValue}>{orderId}</Text>
              </View>
            </View>

            {/* 6. Bottom Action Button: Done */}
            <TouchableOpacity
              style={styles.doneButton}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
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
  darkDimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  cardOuter: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  cardCanvas: {
    width: TICKET_DESIGN_WIDTH,
    height: TICKET_DESIGN_HEIGHT,
    position: "relative",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.18,
        shadowRadius: 18,
      },
      android: {
        elevation: 12,
      },
    }),
  },

  // 1. Top Badge Pill
  badgePill: {
    position: "absolute",
    top: 44,
    left: 90,
    width: 160,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#D1FAE5",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  badgeLabel: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 11,
    letterSpacing: 1.2,
    color: "#065F46",
    textAlign: "center",
    includeFontPadding: false,
  },

  // 2. Success Check Icon Container (Lucide BadgeCheck in Soft Tinted Container)
  iconCircle: {
    position: "absolute",
    top: 94,
    left: 146,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    ...Platform.select({
      ios: {
        shadowColor: "#059669",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },

  // 3. Headings
  headingArea: {
    position: "absolute",
    top: 148,
    left: 20,
    right: 20,
    alignItems: "center",
  },
  titleText: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 21,
    color: "#0F172A",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitleText: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
  },

  // 4. Mini Event Summary Card
  eventCard: {
    position: "absolute",
    top: 202,
    left: 36,
    width: 268,
    height: 64,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  eventThumbImage: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
  },
  eventThumbPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  eventCardTextContainer: {
    flex: 1,
    marginLeft: 10,
    justifyContent: "center",
  },
  eventTitle: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 14,
    color: "#1E293B",
  },
  eventMeta: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },

  // 5. Barcode & Order ID
  barcodeRow: {
    position: "absolute",
    top: 330,
    left: 44,
    width: 252,
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  orderIdContainer: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  orderIdLabel: {
    fontFamily: "Manrope-Medium",
    fontSize: 10,
    letterSpacing: 0.6,
    color: "#64748B",
    textTransform: "uppercase",
  },
  orderIdValue: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
    letterSpacing: 1,
    color: "#1E293B",
    marginTop: 1,
  },

  // 6. Done Button
  doneButton: {
    position: "absolute",
    top: 384,
    left: 40,
    width: 260,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
  },
  doneButtonText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    letterSpacing: 0.3,
    color: "#FFFFFF",
  },
});

export default CelebrationModal;
