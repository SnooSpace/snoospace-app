import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated, Easing, StyleSheet } from "react-native";
import Svg, { Circle, Rect, Path, G, Ellipse } from "react-native-svg";
import { COLORS, FONTS } from "../constants/theme";
import { useNavigation } from "@react-navigation/native";
import HapticsService from "../services/HapticsService";

export default function EmptyEventsState({ isOwnProfile = true }) {
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

  const handleCreateEvent = () => {
    HapticsService.triggerImpactLight();
    // Navigate to event creation flow
    // navigation.navigate("CreateEvent");
  };

  return (
    <View style={styles.container}>
      <View style={styles.illustrationContainer}>
        {/* Floating Animation Wrapper */}
        <Animated.View style={{ transform: [{ translateY: floatAnim }], zIndex: 2 }}>
          <Svg width="240" height="240" viewBox="0 0 240 240" fill="none">
            <Circle cx="120" cy="120" r="80" fill="#2563EB" fillOpacity="0.08" />
            
            {/* Ticket Shape */}
            <Rect x="60" y="80" width="120" height="70" rx="12" stroke="#0F172A" strokeWidth="4" fill="white" />
            <Path d="M60 115C68 115 68 105 60 105" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" fill="#F8FAFC" />
            <Path d="M180 115C172 115 172 105 180 105" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" fill="#F8FAFC" />
            
            {/* Ticket Stripes (Brand Blue) */}
            <Rect x="75" y="80" width="15" height="70" fill="#2563EB" fillOpacity="0.2" />
            <Path d="M90 80V150" stroke="#0F172A" strokeWidth="3" strokeDasharray="4 4" />
            
            {/* Spotlight Beam */}
            <Path d="M120 40L160 160H80L120 40Z" fill="#22D3EE" fillOpacity="0.1" />
            <Circle cx="120" cy="45" r="8" fill="white" stroke="#0F172A" strokeWidth="3" />
            
            {/* Calendar Icon element */}
            <Rect x="110" y="100" width="40" height="35" rx="4" stroke="#0F172A" strokeWidth="3" fill="white" />
            <Rect x="110" y="100" width="40" height="10" rx="2" fill="#2563EB" stroke="#0F172A" strokeWidth="3" />
            
            {/* Floating Stars */}
            <Path d="M185 70L187 75H192L188 78L189 83L185 80L181 83L182 78L178 75H183L185 70Z" fill="#22D3EE" stroke="#0F172A" strokeWidth="1.5" />
            <Circle cx="55" cy="90" r="4" fill="#2563EB" stroke="#0F172A" strokeWidth="1.5" />
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
          {isOwnProfile ? "No events found" : "No upcoming events"}
        </Text>
        <Text style={styles.subtitle}>
          {isOwnProfile
            ? "The stage is set, but the calendar is quiet. Host a meetup or a webinar to get started."
            : "There are no events scheduled right now. Check back later!"}
        </Text>
      </View>

      {isOwnProfile && (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            activeOpacity={1}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handleCreateEvent}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Create first event</Text>
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
