import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
        })
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="alert-circle" size={40} color="#DC2626" />
        </View>

        <Text style={styles.title}>Session Expired</Text>
        <Text style={styles.message}>
          You have been unexpectedly logged out.{"\n"}
          Please log in again to continue.
        </Text>

        {logoutDetails?.email && (
          <Text style={styles.email}>Account: {logoutDetails.email}</Text>
        )}

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          <Text style={styles.loginButtonText}>Log In</Text>
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
    backgroundColor: "rgba(255,255,255,0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  content: {
    alignItems: "center",
    padding: 32,
    maxWidth: width * 0.85,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 12,
  },
  email: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
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
