import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated, Easing, StyleSheet } from "react-native";
import Svg, { Circle, Rect, Path, Ellipse, Line } from "react-native-svg";
import { COLORS, FONTS } from "../constants/theme";
import { useNavigation } from "@react-navigation/native";
import HapticsService from "../services/HapticsService";

export default function EmptyCommunityState({ isOwnProfile = true, onCreatePost }) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current; // Button scale
  const navigation = useNavigation();

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
      ])
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

  const handleCreatePost = () => {
    HapticsService.triggerImpactLight();
    if (onCreatePost) {
      onCreatePost();
    } else {
      navigation.navigate("CreatePost");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.illustrationContainer}>
        {/* Floating Animation Wrapper */}
        <Animated.View style={{ transform: [{ translateY: floatAnim }], zIndex: 2 }}>
          <Svg width="240" height="240" viewBox="0 0 240 240" fill="none">
            <Circle cx="120" cy="120" r="80" fill="#2563EB" fillOpacity="0.08" />
            
            {/* Main Megaphone */}
            <Path d="M70 110L140 80V160L70 130V110Z" fill="white" stroke="#0F172A" strokeWidth="4" strokeLinejoin="round" />
            <Path d="M140 80C155 80 165 95 165 120C165 145 155 160 140 160" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" />
            <Rect x="60" y="110" width="15" height="20" rx="4" fill="#2563EB" stroke="#0F172A" strokeWidth="3" />
            
            {/* Speech Bubble (Poll/Q&A) */}
            <Path d="M160 70H195V100C195 100 185 100 175 110V100H160V70Z" fill="#F0F9FF" stroke="#0F172A" strokeWidth="3" strokeLinejoin="round" />
            <Line x1="170" y1="80" x2="185" y2="80" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round" />
            <Line x1="170" y1="90" x2="180" y2="90" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round" />
            
            {/* Poll Bars */}
            <Rect x="85" y="170" width="30" height="10" rx="2" fill="#2563EB" fillOpacity="0.2" stroke="#0F172A" strokeWidth="2" />
            <Rect x="85" y="185" width="50" height="10" rx="2" fill="#2563EB" stroke="#0F172A" strokeWidth="2" />
            
            {/* Decorative Elements */}
            <Circle cx="190" cy="130" r="6" fill="#2563EB" stroke="#0F172A" strokeWidth="2" />
            <Path d="M45 120H55" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
          </Svg>
        </Animated.View>
        
        {/* Static shadow on the floor */}
        <View style={styles.shadowContainer}>
          <Svg width="128" height="8" viewBox="0 0 128 8" fill="none">
            <Ellipse cx="64" cy="4" rx="64" ry="4" fill="rgba(30, 58, 138, 0.05)" />
          </Svg>
        </View>
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title}>
          {isOwnProfile ? "Quiet in the community" : "No community posts"}
        </Text>
        <Text style={styles.subtitle}>
          {isOwnProfile
            ? "Break the ice! Start a poll, ask a question, or launch a challenge for your members."
            : "This community is quiet right now. Check back later for updates!"}
        </Text>
      </View>

      {isOwnProfile && (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            activeOpacity={1}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handleCreatePost}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Create first community post</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
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
    marginBottom: 24,
  },
  title: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 24,
    color: "#0F172A",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: FONTS.regular, // Manrope-Regular
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
    borderRadius: 999,
    shadowColor: "#BFDBFE",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonText: {
    fontFamily: FONTS.semiBold, // Manrope-SemiBold
    fontSize: 16,
    color: "#FFFFFF",
  },
});
