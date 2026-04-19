import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  StyleSheet,
} from "react-native";
import Svg, { Circle, Path, Line, G, Ellipse } from "react-native-svg";
import { COLORS, FONTS } from "../constants/theme";
import HapticsService from "../services/HapticsService";

export default function EmptyChatState({ onSendMessage }) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current; // Button scale

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -10,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [floatAnim]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleAction = () => {
    HapticsService.triggerImpactLight();
    if (onSendMessage) {
      onSendMessage();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.illustrationContainer}>
        {/* Floating Animation Wrapper */}
        <Animated.View
          style={{ transform: [{ translateY: floatAnim }], zIndex: 2 }}
        >
          <Svg width="240" height="240" viewBox="0 0 240 240" fill="none">
            {/* Soft Brand Glow */}
            <Circle
              cx="120"
              cy="120"
              r="80"
              fill="#2563EB"
              fillOpacity={0.08}
            />

            {/* Main Chat Bubble (The Base) */}
            <Path
              d="M70 70H170V140C170 140 170 155 150 155H90L60 175V70Z"
              fill="white"
              stroke="#0F172A"
              strokeWidth="4"
              strokeLinejoin="round"
            />

            {/* Stylized UI Lines inside the bubble */}
            <Line
              x1="90"
              y1="95"
              x2="150"
              y2="95"
              stroke="#F0F9FF"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <Line
              x1="90"
              y1="95"
              x2="130"
              y2="95"
              stroke="#2563EB"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <Line
              x1="90"
              y1="120"
              x2="150"
              y2="120"
              stroke="#F0F9FF"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <Line
              x1="90"
              y1="120"
              x2="140"
              y2="120"
              stroke="#22D3EE"
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Floating "New/Fresh" Sparkle */}
            <G transform="translate(175, 65)">
              <Path
                d="M0 -12L3 -3L12 0L3 3L0 12L-3 3L-12 0L-3 -3L0 -12Z"
                fill="#2563EB"
                stroke="#0F172A"
                strokeWidth="2"
              />
            </G>

            {/* Decorative Orbiting Elements */}
            <Circle
              cx="65"
              cy="190"
              r="5"
              fill="#22D3EE"
              stroke="#0F172A"
              strokeWidth="2"
            />
            <Circle
              cx="185"
              cy="160"
              r="8"
              fill="#F0F9FF"
              stroke="#0F172A"
              strokeWidth="2.5"
            />

            {/* Dynamic Typing Indicator Dots */}
            <G>
              <Circle cx="110" cy="185" r="3" fill="#0F172A" />
              <Circle
                cx="120"
                cy="185"
                r="3"
                fill="#0F172A"
                fillOpacity={0.4}
              />
              <Circle
                cx="130"
                cy="185"
                r="3"
                fill="#0F172A"
                fillOpacity={0.2}
              />
            </G>
          </Svg>
        </Animated.View>

        {/* Static shadow on the floor */}
        <View style={styles.shadowContainer}>
          <Svg width="128" height="8" viewBox="0 0 128 8" fill="none">
            <Ellipse
              cx="64"
              cy="4"
              rx="64"
              ry="4"
              fill="rgba(30, 58, 138, 0.05)"
            />
          </Svg>
        </View>
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title}>Say hello! It’s not that deep.</Text>
        <Text style={styles.subtitle}>Worst case, nothing happens.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 60,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  illustrationContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    marginBottom: 32,
  },
  shadowContainer: {
    position: "absolute",
    bottom: 0,
    alignSelf: "center",
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontFamily: FONTS.primary,
    fontSize: 24,
    color: "#0F172A",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  button: {
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonText: {
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "center",
  },
});
