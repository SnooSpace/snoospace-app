import React, { useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Circle,
  Path,
  Rect,
  Line,
} from "react-native-svg";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");

const colors = {
  surface: "#F6F7F9",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  brand: "#3565F2",
  success: "#2E7D6B",
};

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

const EventSuccessModal = ({ visible, onClose, onViewEvent, eventData }) => {
  const navigation = useNavigation();

  // Entrance
  const enterScale = useSharedValue(0.92);
  const enterOpacity = useSharedValue(0);

  // Layout Layers
  const glowOpacity = useSharedValue(0.85);
  const ticketY = useSharedValue(0);
  const ticketRotateX = useSharedValue(0);
  const ticketRotateY = useSharedValue(0);
  const badgeScale = useSharedValue(1);

  // --- SVG DRAWING ANIMATIONS (5s LOOP) ---
  const dashTicketPath = useSharedValue(600);
  const dashPerforation = useSharedValue(160);
  const dashCheckmark = useSharedValue(50);
  const topHighlightBadge = useSharedValue(120);

  // Accents drift
  const accent1X = useSharedValue(0);
  const accent1Y = useSharedValue(0);
  const accent2X = useSharedValue(0);
  const accent2Y = useSharedValue(0);
  const accent3X = useSharedValue(0);
  const accent3Y = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Entrance
      enterScale.value = withTiming(1, {
        duration: 450,
        easing: Easing.out(Easing.cubic),
      });
      enterOpacity.value = withTiming(1, { duration: 350 });

      // -- DRAWING ANIMATIONS -- (5000ms looping cycle)
      dashTicketPath.value = withRepeat(
        withTiming(0, { duration: 5000, easing: Easing.inOut(Easing.cubic) }),
        -1,
        false,
      );

      dashPerforation.value = withRepeat(
        withTiming(0, { duration: 5000, easing: Easing.inOut(Easing.cubic) }),
        -1,
        false,
      );

      dashCheckmark.value = withRepeat(
        withTiming(0, { duration: 5000, easing: Easing.inOut(Easing.cubic) }),
        -1,
        false,
      );

      topHighlightBadge.value = withRepeat(
        withTiming(0, { duration: 5000, easing: Easing.inOut(Easing.cubic) }),
        -1,
        false,
      );

      // Layer 1: Glow Breathing (2.5s -> exactly halves the 5s loop)
      glowOpacity.value = withRepeat(
        withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );

      // Layer 2: Ticket Float (2.5s)
      ticketY.value = withRepeat(
        withTiming(-6, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );

      // Layer 2: Ticket 3D Sway (5s loop full rotation cycle)
      ticketRotateX.value = withRepeat(
        withSequence(
          withTiming(4, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
          withTiming(-4, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );

      ticketRotateY.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
          withTiming(4, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );

      // Layer 3: Badge Pulse (2.5s)
      badgeScale.value = withRepeat(
        withTiming(1.05, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );

      // Layer 4: Accents drift (Sync'd slowly mapped to 5s loops)
      const createDrift = (svX, svY, durationX, durationY, distance) => {
        svX.value = withRepeat(
          withTiming(distance, {
            duration: durationX,
            easing: Easing.inOut(Easing.ease),
          }),
          -1,
          true,
        );
        svY.value = withRepeat(
          withTiming(distance * 0.8, {
            duration: durationY,
            easing: Easing.inOut(Easing.ease),
          }),
          -1,
          true,
        );
      };

      createDrift(accent1X, accent1Y, 5000, 5000, 3);
      createDrift(accent2X, accent2Y, 5000, 5000, -2.5);
      createDrift(accent3X, accent3Y, 5000, 5000, 3);
    } else {
      enterScale.value = 0.92;
      enterOpacity.value = 0;
      glowOpacity.value = 0.85;
      ticketY.value = 0;
      ticketRotateX.value = 0;
      ticketRotateY.value = 0;
      badgeScale.value = 1;

      dashTicketPath.value = 600;
      dashPerforation.value = 160;
      dashCheckmark.value = 50;
      topHighlightBadge.value = 120;

      accent1X.value = 0;
      accent1Y.value = 0;
      accent2X.value = 0;
      accent2Y.value = 0;
      accent3X.value = 0;
      accent3Y.value = 0;
    }
  }, [visible]);

  // Animated Prop Maps
  const propTicketPath = useAnimatedStyle(() => ({
    strokeDashoffset: dashTicketPath.value,
  }));
  const propDashPerforation = useAnimatedStyle(() => ({
    strokeDashoffset: dashPerforation.value,
  }));
  const propCheckmark = useAnimatedStyle(() => ({
    strokeDashoffset: dashCheckmark.value,
  }));
  const propTopBadge = useAnimatedStyle(() => ({
    strokeDashoffset: topHighlightBadge.value,
  }));

  // Styles
  const containerStyle = useAnimatedStyle(() => ({
    opacity: enterOpacity.value,
    transform: [{ scale: enterScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const ticketStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { translateY: ticketY.value },
      { rotateX: `${ticketRotateX.value}deg` },
      { rotateY: `${ticketRotateY.value}deg` },
    ],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  const accent1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: accent1X.value }, { translateY: accent1Y.value }],
  }));
  const accent2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: accent2X.value }, { translateY: accent2Y.value }],
  }));
  const accent3Style = useAnimatedStyle(() => ({
    transform: [{ translateX: accent3X.value }, { translateY: accent3Y.value }],
  }));

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, containerStyle]}>
          <View style={styles.cardInnerHighlight} />

          <View style={styles.heroArea}>
            {/* Layer 1: Radial Glow */}
            <Animated.View style={[styles.glowLayer, glowStyle]}>
              <Svg width={240} height={240} viewBox="0 0 240 240">
                <Defs>
                  <RadialGradient id="successGlow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor="rgba(46,125,107,0.14)" />
                    <Stop offset="70%" stopColor="rgba(46,125,107,0.05)" />
                    <Stop offset="100%" stopColor="rgba(46,125,107,0)" />
                  </RadialGradient>
                </Defs>
                <Circle cx="120" cy="120" r="120" fill="url(#successGlow)" />
              </Svg>
            </Animated.View>

            {/* Layer 4: Minimal Accents */}
            <Animated.View
              style={[styles.accent, { top: 40, left: 60 }, accent1Style]}
            >
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: "rgba(46,125,107,0.4)",
                    width: 8,
                    height: 8,
                  },
                ]}
              />
            </Animated.View>
            <Animated.View
              style={[styles.accent, { bottom: 50, right: 60 }, accent2Style]}
            >
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: "#64748B",
                    width: 6,
                    height: 6,
                    opacity: 0.3,
                  },
                ]}
              />
            </Animated.View>
            <Animated.View
              style={[styles.accent, { top: 100, right: 50 }, accent3Style]}
            >
              <Svg width={12} height={12} viewBox="0 0 12 12">
                <Path
                  d="M 6 0 C 6 4 10 6 12 6 C 10 6 6 8 6 12 C 6 8 2 6 0 6 C 2 6 6 4 6 0 Z"
                  fill="rgba(46,125,107,0.4)"
                />
              </Svg>
            </Animated.View>

            {/* Layer 2: Ticket Card */}
            <Animated.View style={[styles.ticketContainer, ticketStyle]}>
              <Svg width={140} height={190} viewBox="0 0 140 190">
                <Defs>
                  <LinearGradient
                    id="ticketGrad"
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <Stop offset="0%" stopColor="#FFFFFF" />
                    <Stop offset="100%" stopColor="#F1F3F5" />
                  </LinearGradient>
                </Defs>

                {/* Ticket Base (Drawn) */}
                <AnimatedPath
                  d="M20,0 H120 A20,20 0 0,1 140,20 V130 A8,8 0 0,0 140,146 V170 A20,20 0 0,1 120,190 H20 A20,20 0 0,1 0,170 V146 A8,8 0 0,0 0,130 V20 A20,20 0 0,1 20,0 Z"
                  fill="url(#ticketGrad)"
                  stroke="#2E7D6B"
                  strokeWidth="0.8"
                  strokeDasharray="600"
                  animatedProps={propTicketPath}
                />

                {/* 1px inner highlight top edge */}
                <Path
                  d="M20,1 H120 A19,19 0 0,1 139,20"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />

                {/* Header line placeholder */}
                <Rect
                  x="20"
                  y="24"
                  width="60"
                  height="6"
                  rx="3"
                  fill="#0F172A"
                  opacity="0.1"
                />

                {/* Muted detail lines */}
                <Rect
                  x="20"
                  y="44"
                  width="100"
                  height="4"
                  rx="2"
                  fill="#64748B"
                  opacity="0.12"
                />
                <Rect
                  x="20"
                  y="56"
                  width="70"
                  height="4"
                  rx="2"
                  fill="#64748B"
                  opacity="0.12"
                />
                <Rect
                  x="20"
                  y="68"
                  width="86"
                  height="4"
                  rx="2"
                  fill="#64748B"
                  opacity="0.12"
                />

                {/* Perforation dashes across the cutout center (Drawn) */}
                <AnimatedLine
                  x1="12"
                  y1="138"
                  x2="128"
                  y2="138"
                  stroke="#64748B"
                  strokeWidth="1"
                  strokeDasharray="4 4 160"
                  opacity="0.25"
                  animatedProps={propDashPerforation}
                />
              </Svg>
            </Animated.View>

            {/* Layer 3: Floating Success Badge */}
            <Animated.View style={[styles.badgeContainer, badgeStyle]}>
              <Svg width={88} height={88} viewBox="0 0 88 88">
                <Defs>
                  <RadialGradient id="badgeGlowInner" cx="50%" cy="50%" r="50%">
                    <Stop offset="40%" stopColor="rgba(46,125,107,0.25)" />
                    <Stop offset="100%" stopColor="rgba(46,125,107,0)" />
                  </RadialGradient>
                  <LinearGradient
                    id="badgeGrad"
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <Stop offset="0%" stopColor="#3DB097" />
                    <Stop offset="100%" stopColor="#2E7D6B" />
                  </LinearGradient>
                </Defs>

                {/* Visual smooth glow behind badge */}
                <Circle cx="44" cy="44" r="44" fill="url(#badgeGlowInner)" />

                {/* Badge Body */}
                <Circle cx="44" cy="44" r="26" fill="url(#badgeGrad)" />

                {/* Inner top highlight (white 20%) (Drawn) */}
                <AnimatedPath
                  d="M 19 44 A 25 25 0 0 1 69 44"
                  fill="none"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="1.5"
                  strokeDasharray="120"
                  animatedProps={propTopBadge}
                />

                {/* Solid Checkmark (Drawn) */}
                <AnimatedPath
                  d="M 36 44 L 42 50 L 52 38"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="50"
                  animatedProps={propCheckmark}
                />
              </Svg>
            </Animated.View>
          </View>

          {/* Text + Actions */}
          <View style={styles.contentArea}>
            <Text style={styles.title}>Event is live.</Text>
            <Text style={styles.subtitle}>
              Your event is ready to be discovered.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                onClose?.();
                if (eventData?.id) {
                  navigation.navigate("EventDetails", {
                    eventId: eventData.id,
                    eventData: eventData,
                  });
                } else if (onViewEvent) {
                  onViewEvent();
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>View Event</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.closeText}>Close</Text>
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
    backgroundColor: "rgba(15,23,42,0.35)",
  },
  card: {
    width: width * 0.86,
    backgroundColor: colors.surface,
    borderRadius: 28,
    overflow: "hidden",
  },
  cardInnerHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.8)",
    zIndex: 10,
  },
  heroArea: {
    height: 250,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
    position: "relative",
  },
  glowLayer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  ticketContainer: {
    position: "absolute",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  badgeContainer: {
    position: "absolute",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  accent: {
    position: "absolute",
  },
  dot: {
    borderRadius: 99,
  },
  contentArea: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 28,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  title: {
    fontFamily: "BasicCommercial-Black",
    fontSize: 28,
    color: colors.textPrimary,
    letterSpacing: -0.3,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Manrope-Regular",
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  primaryButton: {
    width: "100%",
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.brand,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  closeButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  closeText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    color: colors.textSecondary,
  },
});

export default EventSuccessModal;
