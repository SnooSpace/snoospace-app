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
import { Ionicons } from '@expo/vector-icons'; // Assuming you are using Expo or have installed react-native-vector-icons

// --- Design Constants ---
const PRIMARY_COLOR = '#5f27cd'; // Deep purple for the button and progress bar
const TEXT_COLOR = '#1e1e1e'; // Dark text color
const LIGHT_TEXT_COLOR = '#6c757d'; // Lighter grey for smaller text
const BACKGROUND_COLOR = '#ffffff'; // White background

import { apiPost } from "../../../api/client";

const EmailInputScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');

  const handleContinue = async () => {
    navigation.navigate("MemberOtp", { email });
    try {
      await apiPost("/auth/send-otp", { email }, 8000);
    } catch (e) {
      // Show a non-blocking toast/alert, stay on OTP screen
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
          {/* Back Button */}
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>

          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            {/* Active part (33% filled visually based on design) */}
            <View style={[styles.progressBarActive, { width: '33%' }]} />
            {/* The rest of the bar */}
            <View style={styles.progressBarInactive} />
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>What's your email?</Text>
          <Text style={styles.subtitle}>
            We'll use it to keep you updated on events.
          </Text>

          {/* Email Input */}
          <TextInput
            style={styles.input}
            onChangeText={setEmail}
            value={email}
            placeholder="Enter your email"
            placeholderTextColor="#adb5bd"
            keyboardType="email-address"
            autoCapitalize="none"
            textContentType="emailAddress" // iOS specific
            autoComplete="email" // Android specific
          />

          <Text style={styles.infoText}>
            Email will be used to send code for your login.
          </Text>
        </View>
      </ScrollView>

      {/* Fixed Footer/Button Section */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, email.length === 0 && styles.disabledButton]}
          onPress={handleContinue}
          disabled={email.length === 0}
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
    // Add padding top for Android
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollContainer: {
    flexGrow: 1, // Allows the content to expand and scroll if needed
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
    backgroundColor: '#e9ecef', // Very light grey for the background of the bar
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
    backgroundColor: '#f8f9fa', // Light background for the input field
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ced4da', // Light border
    color: TEXT_COLOR,
  },
  infoText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 8,
    marginLeft: 5,
  },
  footer: {
    padding: 20,
    backgroundColor: BACKGROUND_COLOR, // Ensure the footer background matches
    borderTopWidth: 0, // Remove any unnecessary line
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
    opacity: 0.6, // Dim the button when disabled
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600'
  },
});

export default EmailInputScreen;