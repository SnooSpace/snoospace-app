import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated, Easing, StyleSheet } from "react-native";
import Svg, { Circle, Rect, Path, G, Ellipse } from "react-native-svg";
import { COLORS, FONTS } from "../constants/theme";
import { useNavigation } from "@react-navigation/native";
import HapticsService from "../services/HapticsService";

export default function EmptyPostsState({ isOwnProfile = true }) {
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
    navigation.navigate("CreatePost");
  };

  return (
    <View style={styles.container}>
      <View style={styles.illustrationContainer}>
        {/* Floating Animation Wrapper for Camera */}
        <Animated.View style={{ transform: [{ translateY: floatAnim }], zIndex: 2 }}>
          <Svg width="240" height="240" viewBox="0 0 240 240" fill="none">
            <Circle cx="120" cy="120" r="80" fill="#2563EB" fillOpacity="0.08" />
            <Rect x="50" y="60" width="140" height="110" rx="16" stroke="#0F172A" strokeWidth="4" fill="white" />
            <Rect x="65" y="75" width="110" height="80" rx="8" stroke="#0F172A" strokeWidth="3" fill="#F0F9FF" />
            <Path d="M50 60L75 120H50V60Z" fill="#2563EB" stroke="#0F172A" strokeWidth="3" strokeLinejoin="round" />
            <Path d="M190 60L165 120H190V60Z" fill="#2563EB" stroke="#0F172A" strokeWidth="3" strokeLinejoin="round" />
            <G transform="translate(100, 95)">
                <Path d="M2.5 13L25 2.5L16 22.5L13 16L2.5 13Z" fill="white" stroke="#0F172A" strokeWidth="2.5" strokeLinejoin="round" />
                <Path d="M13 16L25 2.5" stroke="#0F172A" strokeWidth="2" />
            </G>
            <Circle cx="170" cy="85" r="5" fill="#22D3EE" stroke="#0F172A" strokeWidth="2" />
            <Path d="M60 145C60 145 65 150 75 148" stroke="#0F172A" strokeWidth="2.5" strokeLinecap="round" />
            <Circle cx="120" cy="195" r="18" fill="white" stroke="#0F172A" strokeWidth="4" />
            <Circle cx="120" cy="195" r="10" fill="#2563EB" />
            <Path d="M90 170L75 200" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" />
            <Path d="M150 170L165 200" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" />
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
          {isOwnProfile ? "Start your journey" : "No posts yet"}
        </Text>
        <Text style={styles.subtitle}>
          {isOwnProfile
            ? "Your gallery is a blank canvas. Capture your first moment and start building your collection today."
            : "This user hasn't posted anything yet. Check back later!"}
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
            <Text style={styles.buttonText}>Create first post</Text>
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
