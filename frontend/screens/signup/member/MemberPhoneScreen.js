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
// Assuming you have an image component or library for flags, 
// for simplicity and platform-independence, I'll use text/emoji for the flag.

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
        {/* Header Section (Only Back Button) */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
          {/* Progress bar and Skip button removed as per request */}
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
              <Ionicons name="caret-down" size={12} color={TEXT_COLOR} style={{ marginLeft: 5 }} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  backButton: {
    paddingRight: 15,
  },
  // Progress bar removed
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
});

export default PhoneNumberInputScreen;