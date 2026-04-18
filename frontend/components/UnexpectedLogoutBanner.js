import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthState } from "../contexts/AuthStateContext";
import { useNavigation, CommonActions } from "@react-navigation/native";

const { width } = Dimensions.get("window");

/**
 * UnexpectedLogoutBanner
 * Displays an error message when the user's session unexpectedly expires
 * Use this in screens that show dummy/fallback data when not authenticated
 */
export default function UnexpectedLogoutBanner({ onLoginPress }) {
  const { isUnexpectedlyLoggedOut, logoutDetails, clearLogoutState } =
    useAuthState();
  const navigation = useNavigation();

  if (!isUnexpectedlyLoggedOut) {
    return null;
  }

  const handleLogin = () => {
    clearLogoutState();

    if (onLoginPress) {
      onLoginPress();
    } else {
      // Default: navigate to landing/login
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Landing" }],
        }),
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Icon */}
        <View style={styles.iconWrapper}>
          <LinearGradient
            colors={["#FFE5E5", "#FFD1D1"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBackground}
          >
            <Ionicons name="lock-closed-outline" size={36} color="#D32F2F" />
          </LinearGradient>
        </View>

        {/* Title */}
        <Text style={styles.title}>Session Expired</Text>

        {/* Message */}
        <Text style={styles.message}>
          Your session has ended.{"\n"}Please sign in again to continue.
        </Text>

        {/* Login Button */}
        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          <LinearGradient
            colors={["#007AFF", "#0051D5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.loginButtonGradient}
          >
            <Text style={styles.loginButtonText}>Sign In</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Inline version for use in skeleton states
 * Shows a smaller banner without navigation capabilities
 */
export function UnexpectedLogoutInline() {
  const { isUnexpectedlyLoggedOut, logoutDetails } = useAuthState();

  if (!isUnexpectedlyLoggedOut) {
    return null;
  }

  return (
    <View style={styles.inlineContainer}>
      <Ionicons name="alert-circle" size={20} color="#DC2626" />
      <Text style={styles.inlineText}>
        Session expired
        {logoutDetails?.email ? ` for ${logoutDetails.email}` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#F5F5F7",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 48,
    paddingHorizontal: 32,
    alignItems: "center",
    marginHorizontal: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  iconWrapper: {
    marginBottom: 24,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    color: "#666666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  loginButton: {
    width: "100%",
    borderRadius: 25,
    overflow: "hidden",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonGradient: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  inlineContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    gap: 8,
  },
  inlineText: {
    fontSize: 14,
    color: "#DC2626",
    flex: 1,
  },
});
