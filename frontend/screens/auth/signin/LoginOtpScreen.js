import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiPost } from "../../../api/client";
import { setAuthSession, clearPendingOtp, getAllAccounts, addAccount } from "../../../api/auth";

const TEXT_COLOR = "#1e1e1e";

const RESEND_COOLDOWN = 60; // 60 seconds

const LoginOtpScreen = ({ navigation, route }) => {
  const { email, isAddingAccount } = route.params || {};
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleVerify = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert("Error", "Please enter the 6-digit code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await apiPost(
        "/auth/verify-otp",
        { email, token: otp },
        20000
      );
      const accessToken = result?.data?.session?.access_token;
      const refreshToken = result?.data?.session?.refresh_token;
      if (accessToken) {
        await setAuthSession(accessToken, email, refreshToken);
      }
      await clearPendingOtp();
      
      // Get user profile with increased timeout
      const profileResult = await apiPost(
        "/auth/get-user-profile",
        { email },
        15000,
        accessToken
      );
      const userRole = profileResult.role;
      const userProfile = profileResult.profile;

      // Handle adding account vs normal login
      if (isAddingAccount) {
        // Check account limit
        const accounts = await getAllAccounts();
        if (accounts.length >= 5) {
          Alert.alert('Maximum Accounts Reached', 'You can only have up to 5 accounts. Remove an account to add a new one.');
          return;
        }

        // Add account to account manager
        await addAccount({
          id: userProfile.id,
          type: userRole,
          username: userProfile.username,
          email: email,
          name: userProfile.name || userProfile.username,
          profilePicture: userProfile.profile_photo_url || userProfile.logo_url || null,
          authToken: accessToken,
          refreshToken: refreshToken,
        });

        Alert.alert('Account Added', 'You can now switch between your accounts from the profile screen.');
        // Navigate back to profile
        navigation.goBack();
        navigation.goBack(); // Go back twice to return to profile
      } else {
        // Normal login flow
        switch (userRole) {
          case "member":
            navigation.reset({ index: 0, routes: [{ name: "MemberHome" }] });
            break;
          case "community":
            navigation.reset({ index: 0, routes: [{ name: "CommunityHome" }] });
            break;
          case "sponsor":
            navigation.reset({ index: 0, routes: [{ name: "SponsorHome" }] });
            break;
          case "venue":
            navigation.reset({ index: 0, routes: [{ name: "VenueHome" }] });
            break;
          default:
            Alert.alert("Error", "Unknown user role. Please contact support.");
        }
      }
    } catch (e) {
      console.error("OTP verification error:", e);
      if (e.message && e.message.includes("timed out")) {
        setError(
          "Request timed out. Please check your internet connection and try again."
        );
      } else {
        setError(
          e.message || "Invalid verification code or failed to get user profile."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0) return;

    setResendLoading(true);
    setError("");
    try {
      await apiPost("/auth/login/start", { email }, 15000);
      Alert.alert("Success", `Code resent to ${email}.`);
      setResendTimer(RESEND_COOLDOWN);
    } catch (e) {
      setError(e.message || "Failed to resend code");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Section (Only Back Button) */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Enter verification code</Text>
        <Text style={styles.subtitle}>We sent a 6-digit code to {email}</Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="000000"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResendCode}
          disabled={resendTimer > 0 || resendLoading}
        >
          {resendLoading ? (
            <ActivityIndicator color="#5f27cd" size="small" />
          ) : (
            <Text style={styles.resendText}>
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Code"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
  },
  backButton: {
    padding: 15,
    marginLeft: -15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1D2A32",
  },
  content: {
    flex: 1,
    paddingHorizontal: 25,
    paddingTop: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1D2A32",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#6c757d",
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    backgroundColor: "#f8f9fa",
    letterSpacing: 4,
  },
  button: {
    backgroundColor: "#5f27cd",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  resendButton: {
    alignItems: "center",
    marginTop: 20,
  },
  resendText: {
    color: "#5f27cd",
    fontSize: 16,
    fontWeight: "500",
  },
  errorText: {
    color: "#dc3545",
    fontSize: 14,
    marginTop: 10,
    textAlign: "center",
  },
});

export default LoginOtpScreen;
