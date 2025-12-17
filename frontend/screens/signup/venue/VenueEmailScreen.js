import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../../constants/theme";
import { apiPost } from '../../../api/client';

const VenueEmailScreen = ({ navigation, route }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  const handleContinue = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email.");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Error", "Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError("");
    
    try {
      // Start signup OTP; backend blocks existing accounts
      // Increased timeout to 15 seconds for better reliability
      const response = await apiPost("/auth/send-otp", { email }, 15000);
      
      // Only navigate if we get a successful response
      if (response) {
        console.log("OTP sent successfully, navigating to OTP screen");
        setRetryCount(0); // Reset retry count on success
        navigation.navigate("VenueOtp", { email });
      } else {
        setError("Failed to send verification code. Please try again.");
      }
    } catch (e) {
      console.error("OTP send error:", e);
      const msg = (e.message || '').toLowerCase();
      
      if (msg.includes('account already exists')) {
        Alert.alert(
          "Email exists",
          "An account with this email already exists.",
          [ { text: "OK", onPress: () => navigation.navigate("Login", { email }) } ]
        );
      } else if (msg.includes('timeout') || msg.includes('timed out')) {
        setRetryCount(prev => prev + 1);
        if (retryCount < 2) {
          setError(`Request timed out. Retrying... (${retryCount + 1}/3)`);
          // Auto retry after 2 seconds
          setTimeout(() => {
            if (retryCount < 2) {
              handleContinue();
            }
          }, 2000);
        } else {
          setError("Request timed out after multiple attempts. Please check your internet connection and try again.");
        }
      } else if (msg.includes('network') || msg.includes('fetch')) {
        setError("Network error. Please check your internet connection and try again.");
      } else {
        setError(e.message || "Failed to send verification code. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Venue Signup</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Enter your email</Text>
        <Text style={styles.subtitle}>
          We'll send you a verification code to confirm your email.
        </Text>

        <View style={styles.inputContainer}>
          <TextInput
            placeholderTextColor={COLORS.textSecondary}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={[styles.input, isFocused && { borderColor: COLORS.primary, backgroundColor: '#fff' }]}
          />
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            {!loading && error && !error.includes('Retrying') && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  setError('');
                  setRetryCount(0);
                  handleContinue();
                }}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.buttonContainer, loading && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={loading}
        >
          <LinearGradient
            colors={COLORS.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.button}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.textInverted} />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    paddingRight: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 25,
    paddingTop: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: COLORS.inputBackground,
    color: COLORS.textPrimary,
  },
  buttonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
    marginTop: 20,
  },
  button: {
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    fontWeight: '600',
  },
  errorContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: COLORS.error,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: COLORS.textInverted,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default VenueEmailScreen;
