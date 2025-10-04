import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 

// --- Design Constants ---
const PRIMARY_COLOR = '#5f27cd'; 
const TEXT_COLOR = '#1e1e1e'; 
const LIGHT_TEXT_COLOR = '#6c757d'; 
const BACKGROUND_COLOR = '#ffffff'; 

import { apiPost } from "../../../api/client";

const EmailInputScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [isValidEmail, setIsValidEmail] = useState(false);
  const [touched, setTouched] = useState(false); // track if user has typed

  const validateEmail = (text) => {
    setEmail(text);
    setTouched(true);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setIsValidEmail(emailRegex.test(text));
  };

  const handleContinue = async () => {
    navigation.navigate("MemberOtp", { email });
    try {
      await apiPost("/auth/send-otp", { email }, 8000);
    } catch (e) {
      console.log('send-otp error:', e.message);
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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>What's your email?</Text>
          <Text style={styles.subtitle}>
            We'll use it to keep you updated on events.
          </Text>

          <TextInput
            style={styles.input}
            onChangeText={validateEmail}
            value={email}
            placeholder="Enter your email"
            placeholderTextColor="#adb5bd"
            keyboardType="email-address"
            autoCapitalize="none"
            textContentType="emailAddress"
            autoComplete="email"
          />

          {/* Error message if invalid */}
          {touched && email.length > 0 && !isValidEmail && (
            <Text style={styles.errorText}>Please enter a valid email address</Text>
          )}

          <Text style={styles.infoText}>
            Email will be used to send code for your login.
          </Text>
        </View>
      </ScrollView>

      {/* Fixed Footer/Button Section */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, !isValidEmail && styles.disabledButton]}
          onPress={handleContinue}
          disabled={!isValidEmail}
        >
          <Text style={styles.buttonText}>Get Code</Text>
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  backButton: {
    paddingRight: 15,
  },
  progressBarContainer: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e9ecef',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  progressBarActive: {
    height: '100%',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 2,
  },
  progressBarInactive: {
    flex: 1,
    height: '100%',
  },
  contentContainer: {
    flex: 1,
    marginTop: 50,
    paddingHorizontal: 5,
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
  input: {
    height: 50,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ced4da',
    color: TEXT_COLOR,
  },
  errorText: {
    fontSize: 12,
    color: 'red',
    marginTop: 5,
    marginLeft: 5,
  },
  infoText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 8,
    marginLeft: 5,
  },
  footer: {
    padding: 20,
    backgroundColor: BACKGROUND_COLOR,
  },
  continueButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 200,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600'
  },
});

export default EmailInputScreen;
