import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Platform, // Import Platform
  StatusBar, // Import StatusBar
  ScrollView, // Import ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiPost } from '../../../api/client';
import { setAuthSession, clearPendingOtp } from '../../../api/auth';

const RESEND_COOLDOWN = 60; // 60 seconds

// --- Design Constants ---
const PRIMARY_COLOR = '#5f27cd';
const TEXT_COLOR = '#1D2A32';
const LIGHT_TEXT_COLOR = '#6c757d';
const BACKGROUND_COLOR = '#fff';
const ERROR_COLOR = '#dc3545';

const CommunityOtpScreen = ({ navigation, route }) => {
  const { email } = route.params || {};
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleVerify = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const resp = await apiPost('/auth/verify-otp', { email, token: otp }, 15000);
      const accessToken = resp.data?.session?.access_token;
      const refreshToken = resp.data?.session?.refresh_token;
      if (accessToken) {
        await setAuthSession(accessToken, email, refreshToken);
      }
      await clearPendingOtp();
      navigation.navigate('CommunityName', {
        email,
        accessToken,
        refreshToken,
      });
    } catch (e) {
      setError(e.message || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0) return;

    setResendLoading(true);
    setError('');
    try {
      await apiPost('/auth/send-otp', { email }, 15000);
      Alert.alert('Success', `Code resent to ${email}.`);
      setResendTimer(RESEND_COOLDOWN);
    } catch (e) {
      setError(e.message || 'Failed to resend code');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Section */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
          
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Enter verification code</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to {email}
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="000000"
              placeholderTextColor="#adb5bd"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
              fontSize={24}
              letterSpacing={4}
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
              <Text style={styles.buttonText}>Verify</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResendCode}
            disabled={resendTimer > 0 || resendLoading}
          >
            {resendLoading ? (
              <ActivityIndicator color={PRIMARY_COLOR} size="small" />
            ) : (
              <Text
                style={[
                  styles.resendText,
                  (resendTimer > 0) && styles.resendTextDisabled
                ]}
              >
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
    // Add padding for Android status bar
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 25,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15, // Replaced paddingHorizontal/Top/Bottom from original style
  },
  backButton: {
    paddingRight: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  contentContainer: {
    // Used to apply top padding to content section
    paddingTop: 30,
    flex: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 5, // Reduced margin since error text is separate
  },
  input: {
    height: 55, // Slightly increased height for better visual appeal
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    backgroundColor: '#f8f9fa',
    letterSpacing: 8, // Increased letter spacing for better OTP look
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  button: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 40, // Increased spacing from input/error
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  resendButton: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 10, // Added padding for easier tapping
  },
  resendText: {
    color: PRIMARY_COLOR,
    fontSize: 16,
    fontWeight: '500',
  },
  resendTextDisabled: {
    color: LIGHT_TEXT_COLOR,
  },
  errorText: {
    color: ERROR_COLOR,
    fontSize: 14,
    marginTop: 15,
    textAlign: 'center',
  },
});

export default CommunityOtpScreen;