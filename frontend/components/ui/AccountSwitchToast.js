/**
 * AccountSwitchToast
 * Light-theme Instagram-style pill toast shown after a double-tap account switch.
 * Shows the switched-to account's avatar, name, and username.
 */
import React, { useEffect } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeOutDown,
  withSpring,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { User } from "lucide-react-native";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");

const AccountSwitchToast = ({ name, username, photoUrl }) => {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(0.92);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    scale.value = withSpring(1, { damping: 14, stiffness: 220 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(350).springify()}
      exiting={FadeOutDown.duration(250)}
      style={[
        styles.container,
        { top: insets.top + 10 },
        animatedStyle,
      ]}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <User size={16} color="#666" strokeWidth={2} />
          </View>
        )}
      </View>

      {/* Text */}
      <View style={styles.textContainer}>
        <Text style={styles.label} numberOfLines={1}>
          Switched to{" "}
          <Text style={styles.username}>
            {username ? `@${username}` : name}
          </Text>
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 99999,
    // Light card
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    // Subtle shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 8,
    // Hairline border
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.08)",
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 18,
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 18,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontFamily: "Manrope-Medium",
    fontSize: 14,
    color: "#333333",
    letterSpacing: -0.1,
  },
  username: {
    fontFamily: "Manrope-SemiBold",
    color: "#111111",
  },
});

export default AccountSwitchToast;
