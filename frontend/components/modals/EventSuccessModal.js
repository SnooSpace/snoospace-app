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
  withDelay,
  Easing,
  interpolate,
} from "react-native-reanimated";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Stop,
  Filter,
  FeGaussianBlur,
  FeMerge,
  FeMergeNode,
  G,
  Circle,
  Path,
  Rect,
  Line,
} from "react-native-svg";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");

const colors = {
  surface: "#F6F7F9",
  surfaceElevated: "#FFFFFF",
  borderSubtle: "rgba(15,23,42,0.06)",
  borderInner: "rgba(255,255,255,0.8)",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  success: "#2E7D6B",
  successTint: "#E8F3EF",
  successGlow: "rgba(46,125,107,0.18)",
  brand: "#1F3A8A",
  brandShadow: "rgba(31,58,138,0.18)",
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

const EventSuccessModal = ({ visible, onClose, onViewEvent, eventData }) => {
  const navigation = useNavigation();
  // Entrance
  const appearScale = useSharedValue(0.92);
  const appearOpacity = useSharedValue(0);

  // Gentle float on ticket
  const floatY = useSharedValue(0);

  // Soft radial pulse behind checkmark
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.5);

  // Sparkle dots (3 of them)
  const spark1 = useSharedValue(0);
  const spark2 = useSharedValue(0);
  const spark3 = useSharedValue(0);

  // Checkmark draw
  const checkDash = useSharedValue(50);

  // Pre-compute animated props
  const checkmarkProps = useAnimatedStyle(() => ({
    strokeDashoffset: checkDash.value,
  }));

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Entrance
      appearScale.value = withTiming(1, {
        duration: 420,
        easing: Easing.out(Easing.cubic),
      });
      appearOpacity.value = withTiming(1, { duration: 350 });

      // Draw checkmark after 300ms
      checkDash.value = 50;
      checkDash.value = withDelay(
        300,
        withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }),
      );

      // Gentle float — 4px up and down, 2.8s cycle
      floatY.value = withRepeat(
        withTiming(-4, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );

      // Soft pulse on glow ring
      pulseScale.value = withRepeat(
        withTiming(1.18, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.25, { duration: 2000 }),
          withTiming(0.5, { duration: 2000 }),
        ),
        -1,
        true,
      );

      // Micro sparkles — staggered, each 2.5s cycle
      const sparkLoop = (sv, delay) => {
        sv.value = withRepeat(
          withDelay(
            delay,
            withSequence(
              withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }),
              withTiming(0, { duration: 900, easing: Easing.in(Easing.ease) }),
            ),
          ),
          -1,
          false,
        );
      };
      sparkLoop(spark1, 0);
      sparkLoop(spark2, 800);
      sparkLoop(spark3, 1600);
    } else {
      appearScale.value = 0.92;
      appearOpacity.value = 0;
      floatY.value = 0;
      pulseScale.value = 1;
      pulseOpacity.value = 0.5;
      spark1.value = 0;
      spark2.value = 0;
      spark3.value = 0;
      checkDash.value = 50;
    }
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: appearOpacity.value,
    transform: [{ scale: appearScale.value }],
  }));

  const ticketStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const spark1Style = useAnimatedStyle(() => ({
    opacity: spark1.value,
    transform: [{ scale: interpolate(spark1.value, [0, 1], [0.4, 1]) }],
  }));
  const spark2Style = useAnimatedStyle(() => ({
    opacity: spark2.value,
    transform: [{ scale: interpolate(spark2.value, [0, 1], [0.4, 1]) }],
  }));
  const spark3Style = useAnimatedStyle(() => ({
    opacity: spark3.value,
    transform: [{ scale: interpolate(spark3.value, [0, 1], [0.4, 1]) }],
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
          {/* 1px inner highlight at top */}
          <View style={styles.innerHighlight} />

          {/* Hero Animation Area */}
          <View style={styles.heroArea}>
            {/* Soft radial glow behind ticket */}
            <View style={styles.glowContainer}>
              <Animated.View style={[styles.glowRing, pulseStyle]} />
            </View>

            {/* Floating confetti dots */}
            <Animated.View style={[styles.spark, styles.spark1, spark1Style]} />
            <Animated.View style={[styles.spark, styles.spark2, spark2Style]} />
            <Animated.View style={[styles.spark, styles.spark3, spark3Style]} />

            {/* 3D Ticket with gentle float */}
            <Animated.View style={ticketStyle}>
              <Svg viewBox="0 0 140 175" width={140} height={175}>
                <Defs>
                  <Filter
                    id="ticketShadow"
                    x="-20%"
                    y="-20%"
                    width="140%"
                    height="140%"
                  >
                    <FeGaussianBlur
                      in="SourceGraphic"
                      stdDeviation="3"
                      result="blur"
                    />
                    <FeMerge>
                      <FeMergeNode in="blur" />
                      <FeMergeNode in="SourceGraphic" />
                    </FeMerge>
                  </Filter>
                </Defs>

                <G x={70} y={87}>
                  {/* Ticket body */}
                  <Path
                    d="M-46,-80 C-46,-80 -42,-84 -38,-84 H38 C42,-84 46,-80 46,-80 V28 A6,6 0 0 0 46,40 V72 C46,76 42,80 38,80 H-38 C-42,80 -46,76 -46,72 V40 A6,6 0 0 0 -46,28 Z"
                    fill={colors.surfaceElevated}
                    stroke={colors.borderSubtle}
                    strokeWidth="1"
                    opacity={0.97}
                  />

                  {/* Perforation dashed line */}
                  <Line
                    x1="-46"
                    y1="34"
                    x2="46"
                    y2="34"
                    stroke={colors.borderSubtle}
                    strokeWidth="1"
                    strokeDasharray="3,4"
                  />

                  {/* Ticket header placeholder rows */}
                  <Rect
                    x="-28"
                    y="-70"
                    width="36"
                    height="4"
                    rx="2"
                    fill={colors.borderSubtle}
                    opacity="0.8"
                  />
                  <Rect
                    x="-28"
                    y="-62"
                    width="22"
                    height="3"
                    rx="1.5"
                    fill={colors.borderSubtle}
                    opacity="0.5"
                  />

                  <Rect
                    x="-28"
                    y="-50"
                    width="44"
                    height="3"
                    rx="1.5"
                    fill={colors.borderSubtle}
                    opacity="0.4"
                  />
                  <Rect
                    x="-28"
                    y="-42"
                    width="30"
                    height="3"
                    rx="1.5"
                    fill={colors.borderSubtle}
                    opacity="0.3"
                  />

                  {/* Success circle */}
                  <Circle cx="0" cy="10" r="20" fill={colors.successTint} />

                  {/* Checkmark */}
                  <AnimatedPath
                    d="M-9,10 L-3,16 L11,3"
                    fill="none"
                    stroke={colors.success}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="50"
                    animatedProps={checkmarkProps}
                  />
                </G>
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
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    // Subtle elevation
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 12,
  },
  innerHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.9)",
    zIndex: 10,
  },
  heroArea: {
    height: 230,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    position: "relative",
    overflow: "hidden",
  },
  glowContainer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  glowRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.successGlow,
  },
  spark: {
    position: "absolute",
    borderRadius: 10,
  },
  spark1: {
    width: 7,
    height: 7,
    backgroundColor: colors.success,
    top: 40,
    left: "28%",
    opacity: 0,
  },
  spark2: {
    width: 5,
    height: 5,
    backgroundColor: "#699acd",
    top: 60,
    right: "24%",
    opacity: 0,
  },
  spark3: {
    width: 6,
    height: 6,
    backgroundColor: "#ffccaa",
    bottom: 45,
    left: "38%",
    opacity: 0,
  },
  contentArea: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 32,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  title: {
    fontFamily: "BasicCommercial-Bold",
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
    // Brand shadow
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    fontFamily: "Manrope-Medium",
    fontSize: 16,
    color: "#FFFFFF",
  },
  closeButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  closeText: {
    fontFamily: "Manrope-Medium",
    fontSize: 15,
    color: colors.textSecondary,
  },
});

export default EventSuccessModal;
