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
import { apiPost } from '../../../api/client';

const VenueEmailScreen = ({ navigation, route }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email.");
      return;
    }

    setLoading(true);
    setError("");
    
    try {
      // First check if email already exists
      const checkResult = await apiPost("/auth/check-email", { email }, 8000);
      
      if (checkResult.exists) {
        // Email exists, ask user to login instead
        Alert.alert(
          "Account Exists",
          "An account with this email already exists. Would you like to login instead?",
          [
            { text: "Cancel", style: "cancel" },
            { 
              text: "Login", 
              onPress: () => navigation.navigate("Login", { email }) 
            }
          ]
        );
        return;
      }

      // Email doesn't exist, proceed with OTP
      await apiPost("/auth/send-otp", { email }, 8000);
      navigation.navigate("VenueOtp", { email });
    } catch (e) {
      setError(e.message || "Failed to check email.");
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
          <Ionicons name="arrow-back" size={24} color="#1D2A32" />
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
            style={styles.input}
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    color: '#1D2A32',
  },
  content: {
    flex: 1,
    paddingHorizontal: 25,
    paddingTop: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1D2A32',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  button: {
    backgroundColor: '#5f27cd',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
});

export default VenueEmailScreen;
