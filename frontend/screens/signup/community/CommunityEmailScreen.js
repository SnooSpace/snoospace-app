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
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiPost } from '../../../api/client';

// --- Design Constants ---
const PRIMARY_COLOR = '#5f27cd';
const TEXT_COLOR = '#1D2A32';
const LIGHT_TEXT_COLOR = '#6c757d';
const BACKGROUND_COLOR = '#fff';
const ERROR_COLOR = '#dc3545';

const CommunityEmailScreen = ({ navigation, route }) => {
  const [email, setEmail] = useState('');
  const [isValidEmail, setIsValidEmail] = useState(false);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const validateEmail = (text) => {
    setEmail(text);
    setTouched(true);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setIsValidEmail(emailRegex.test(text));
  };

  const handleContinue = async () => {
    if (!isValidEmail) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiPost('/auth/send-otp', { email }, 15000);

      if (response) {
        console.log('OTP sent successfully, navigating to OTP screen');
        setRetryCount(0);
        navigation.navigate('CommunityOtp', { email });
      } else {
        setError('Failed to send verification code. Please try again.');
      }
    } catch (e) {
      console.error('OTP send error:', e);
      const msg = (e.message || '').toLowerCase();

      if (msg.includes('account already exists')) {
        Alert.alert(
          'Email exists',
          'An account with this email already exists.',
          [{ text: 'OK', onPress: () => navigation.navigate('Login', { email }) }]
        );
      } else if (msg.includes('timeout') || msg.includes('timed out')) {
        setRetryCount((prev) => prev + 1);
        if (retryCount < 2) {
          setError(`Request timed out. Retrying... (${retryCount + 1}/3)`);
          setTimeout(() => {
            if (retryCount < 2) {
              handleContinue();
            }
          }, 2000);
        } else {
          setError(
            'Request timed out after multiple attempts. Please check your internet connection and try again.'
          );
        }
      } else if (msg.includes('network') || msg.includes('fetch')) {
        setError('Network error. Please check your internet connection and try again.');
      } else {
        setError(e.message || 'Failed to send verification code. Please try again.');
      }
    } finally {
      if (retryCount >= 2 || !error.includes('Retrying...')) {
        setLoading(false);
      }
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
          <Text style={styles.title}>Enter your email</Text>
          <Text style={styles.subtitle}>
            We'll send you a verification code to confirm your email.
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#adb5bd"
              value={email}
              onChangeText={validateEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
            />
          </View>

          {/* Inline error message for invalid email when touched */}
          {touched && email.length > 0 && !isValidEmail && (
            <Text style={styles.validationErrorText}>
              Please enter a valid email address.
            </Text>
          )}

          {/* API/Network Error display */}
          {error ? <Text style={styles.apiErrorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[
              styles.button,
              (!isValidEmail || loading) && styles.buttonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!isValidEmail || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Get Code</Text>
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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 25,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
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
    marginBottom: 5,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    color: TEXT_COLOR,
  },
  validationErrorText: {
    color: ERROR_COLOR,
    fontSize: 12,
    marginTop: 5,
    marginLeft: 5,
  },
  apiErrorText: {
    color: ERROR_COLOR,
    fontSize: 14,
    marginTop: 15,
    textAlign: 'center',
  },
  button: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 150, // Increased from 30 to 40 for more space
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default CommunityEmailScreen;