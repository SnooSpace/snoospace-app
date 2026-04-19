import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated, Easing, StyleSheet } from "react-native";
import Svg, { Circle, Rect, Path, G, Ellipse } from "react-native-svg";
import { COLORS, FONTS } from "../constants/theme";
import { useNavigation } from "@react-navigation/native";
import HapticsService from "../services/HapticsService";

const AnimatedG = Animated.createAnimatedComponent(G);

export default function EmptyFeedState() {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current; // Primary button
  const navigation = useNavigation();

  useEffect(() => {
    // Float animation
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

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatAnim, pulseAnim]);

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

  const handleExplore = () => {
    HapticsService.triggerImpactLight();
    navigation.navigate("Search");
  };



  return (
    <View style={styles.container}>
      <View style={styles.illustrationContainer}>
        {/* Floating Animation Wrapper */}
        <Animated.View style={{ transform: [{ translateY: floatAnim }], zIndex: 2 }}>
          <Svg width="240" height="240" viewBox="0 0 240 240" fill="none">
            {/* Soft Brand Glow */}
            <Circle cx="120" cy="120" r="90" fill="#2563EB" fillOpacity={0.06} />
            
            {/* Home/Feed Container (Smartphone + House Silhouette) */}
            <Path 
              d="M60 70C60 58.9543 68.9543 50 80 50H160C171.046 50 180 58.9543 180 70V170C180 181.046 171.046 190 160 190H80C68.9543 190 60 181.046 60 170V70Z" 
              fill="white" 
              stroke="#0F172A" 
              strokeWidth="4"
            />
            
            {/* Roof Shape inside the "Screen" */}
            <Path 
              d="M85 90L120 65L155 90V120H85V90Z" 
              fill="#F0F9FF" 
              stroke="#0F172A" 
              strokeWidth="3" 
              strokeLinejoin="round"
            />
            
            {/* Blank Feed Rows (Abstract placeholders) */}
            <Rect x="85" y="135" width="70" height="8" rx="4" fill="#2563EB" fillOpacity={0.1} />
            <Rect x="85" y="150" width="50" height="8" rx="4" fill="#22D3EE" fillOpacity={0.1} />
            
            {/* Discovery Compass / Navigation element */}
            <G transform="translate(145, 160)">
                <Circle cx="0" cy="0" r="22" fill="white" stroke="#0F172A" strokeWidth="3" />
                <Path d="M0 -10L4 0L0 10L-4 0L0 -10Z" fill="#2563EB" stroke="#0F172A" strokeWidth="1.5" />
                <Path d="M-10 0L0 -4L10 0L0 4L-10 0Z" fill="#22D3EE" stroke="#0F172A" strokeWidth="1.5" />
            </G>
            
            {/* Floating Sparkles (Newness) */}
            <AnimatedG style={{ opacity: pulseAnim }}>
                <Path d="M190 90L193 96L199 99L193 102L190 108L187 102L181 99L187 96L190 90Z" fill="#2563EB" stroke="#0F172A" strokeWidth="1.5" />
                <Circle cx="50" cy="100" r="4" fill="#22D3EE" stroke="#0F172A" strokeWidth="1.5" />
            </AnimatedG>
            
            {/* Bottom Interface Bar */}
            <Rect x="100" y="180" width="40" height="4" rx="2" fill="#0F172A" fillOpacity={0.2} />
          </Svg>
        </Animated.View>
        
        {/* Static shadow on the floor */}
        <View style={styles.shadowContainer}>
          <Svg width="144" height="8" viewBox="0 0 144 8" fill="none">
            <Ellipse cx="72" cy="4" rx="72" ry="4" fill="rgba(30, 58, 138, 0.05)" />
          </Svg>
        </View>
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title}>Your feed is empty</Text>
        <Text style={styles.subtitle}>
            Follow people or communities to see posts and find upcoming events to fill your home screen with things you love.
        </Text>
      </View>

      <View style={styles.actionContainer}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }], width: "100%" }}>
            <TouchableOpacity
                activeOpacity={1}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={handleExplore}
                style={styles.primaryButton}
            >
                <Text style={styles.primaryButtonText}>Explore discovery</Text>
            </TouchableOpacity>
        </Animated.View>
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
  actionContainer: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  primaryButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
    width: "100%",
  },
  primaryButtonText: {
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "center",
  },
  secondaryButton: {
    paddingVertical: 12,
    marginTop: 8,
  },
  secondaryButtonText: {
    fontFamily: FONTS.medium,
    color: "#94A3B8",
    fontSize: 14,
    textAlign: "center",
  },
});
