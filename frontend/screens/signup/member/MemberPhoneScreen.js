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
import { Ionicons } from '@expo/vector-icons'; // Used for the back arrow
import ProgressBar from '../../../components/Progressbar';

// --- Design Constants ---
const PRIMARY_COLOR = '#5f27cd'; // Deep purple for the button
const TEXT_COLOR = '#1e1e1e'; // Dark text color
const LIGHT_TEXT_COLOR = '#6c757d'; // Lighter grey for smaller text
const BACKGROUND_COLOR = '#ffffff'; // White background

const PhoneNumberInputScreen = ({ navigation, route }) => {
  const { email, accessToken } = route.params || {};
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleContinue = () => {
    navigation.navigate('MemberName', { email, accessToken, phone: phoneNumber });
  };

  // Function to format the phone number as the user types (e.g., (XXX) XXX-XXXX)
  const formatPhoneNumber = (text) => {
    // Remove all non-digit characters
    const digits = text.replace(/\D/g, '');

    // Format for Indian numbers (XXX XX XXXX) - common in some contexts
    // Or just keep it clean and let the keyboard handle the main input.
    // For simplicity, we'll keep it clean here, but you can add more complex logic.
    setPhoneNumber(digits);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Section (Progress Bar and Step Text) */}
        <View style={styles.header}>
          <Text style={styles.stepText}>Step 1 of 8</Text>

          {/* Progress Bar Container */}
          <View style={styles.progressBarContainer}>
            <ProgressBar progress={12.5} />
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>What's your number?</Text>
          <Text style={styles.subtitle}>
            We'll text you a code to verify your phone.
          </Text>

          {/* Phone Number Input */}
          <View style={styles.phoneInputContainer}>
            {/* Country Code and Flag for India */}
            <View style={styles.countryCodePill}>
              {/* Using a flag emoji for simplicity */}
              <Text style={styles.flagEmoji}>🇮🇳</Text>
              <Text style={styles.countryCodeText}>+91</Text>
            </View>

            {/* Actual Phone Number Input Field */}
            <TextInput
              style={styles.inputField}
              onChangeText={formatPhoneNumber}
              value={phoneNumber}
              placeholder="(000) 000-0000"
              placeholderTextColor="#adb5bd"
              keyboardType="phone-pad"
              textContentType="telephoneNumber" // iOS specific
              autoComplete="tel" // Android specific
              maxLength={10} // Indian numbers are typically 10 digits
            />
          </View>
        </View>
      </ScrollView>

      {/* Fixed Footer/Button Section */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, phoneNumber.length !== 10 && styles.disabledButton]}
          onPress={handleContinue}
          // Button is enabled only when 10 digits are entered
          disabled={phoneNumber.length !== 10}
        >
          <Text style={styles.buttonText}>Continue</Text>
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
    flexGrow: 1,
    paddingHorizontal: 20,
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
  phoneInputContainer: {
    flexDirection: 'row',
    height: 50,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ced4da',
    overflow: 'hidden', // Ensures everything fits neatly
  },
  countryCodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#e9ecef', // Slightly darker background for the code section
    borderRightWidth: 1,
    borderRightColor: '#ced4da',
  },
  flagEmoji: {
    fontSize: 18,
    marginRight: 5,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginRight: 2,
  },
  inputField: {
    flex: 1, // Takes up the remaining space
    paddingHorizontal: 15,
    fontSize: 16,
    color: TEXT_COLOR,
    backgroundColor: 'transparent', // Make sure it's transparent
  },
  footer: {
    padding: 20,
    backgroundColor: BACKGROUND_COLOR,
    borderTopWidth: 0,
    marginBottom: 50,
  },
  continueButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6, // Dim the button when disabled
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
    progressBarContainer: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e9ecef",
    overflow: "hidden",
    flexDirection: "row",
  },
  progressBarActive: {
    height: "100%",
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 2,
  },
  progressBarInactive: {
    flex: 1,
    height: "100%",
  },
   stepText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 5,
    marginTop: 5,
    marginLeft: 0,
  },
   header: {
    paddingVertical: 60,
  },
});

export default PhoneNumberInputScreen;