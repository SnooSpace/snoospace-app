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
import { apiPost } from '../../../api/client';

// --- Design Constants ---
const PRIMARY_COLOR = '#5f27cd'; // Deep purple for the button
const TEXT_COLOR = '#1e1e1e'; // Dark text color
const LIGHT_TEXT_COLOR = '#6c757d'; // Lighter grey for smaller text
const BACKGROUND_COLOR = '#ffffff'; // White background

// --- Dummy ProgressBar Component (Assuming it exists in '../../../components/Progressbar')
// Re-created here for completeness in this single file context
const ProgressBar = ({ progress }) => {
  const width = `${progress}%`;
  return (
    <View style={styles.progressBarContainer}>
      <View style={[styles.progressBarActive, { width }]} />
    </View>
  );
};

// --- Reusable Phone Input Component ---
// This extracts the core UI from the original PhoneNumberInputScreen
const PhoneInputView = ({ phoneNumber, setPhoneNumber, inputStyles, hideTitle = false }) => {
  // Function to format the phone number as the user types (e.g., (XXX) XXX-XXXX)
  const formatPhoneNumber = (text) => {
    // Remove all non-digit characters
    const digits = text.replace(/\D/g, '');
    setPhoneNumber(digits);
  };

  return (
    <View style={inputStyles?.container || { marginBottom: 30 }}>
      {!hideTitle && <Text style={styles.inputLabel}>Phone Number</Text>}
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
      <Text style={styles.helperText}>
        We'll text you a code to verify this number.
      </Text>
    </View>
  );
};


// ----------------------------------------------------------------------
// 1. UPDATED: PhoneNumberInputScreen (Now uses the reusable PhoneInputView)
// ----------------------------------------------------------------------

export const PhoneNumberInputScreen = ({ navigation, route }) => {
  const { email, accessToken } = route.params || {};
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleContinue = () => {
    // Navigation still points to the name screen, but with the phone number now included
    navigation.navigate('MemberName', { email, accessToken, phone: phoneNumber });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Section (Progress Bar and Step Text) */}
        <View style={styles.header}>
          <Text style={styles.stepText}>Step 1 of 7</Text>
          <ProgressBar progress={14} />
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>What's your number?</Text>
          
          <PhoneInputView 
            phoneNumber={phoneNumber} 
            setPhoneNumber={setPhoneNumber} 
            hideTitle={true} // Title is large, so hide the small label here
          />
          
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

// ----------------------------------------------------------------------
// 2. MODIFIED: NameInputScreen (Now includes PhoneInputView)
// ----------------------------------------------------------------------

const VenueHostNamePhoneScreen = ({ navigation, route }) => {
  const { email, name: venueName, address, city, phone, capacity_max, price_per_head, hourly_price, daily_price } = route.params || {};
  const [hostName, setHostName] = useState('');
  const [hostPhone, setHostPhone] = useState('');

  const handleNext = async () => {
    if (!hostName.trim() || hostPhone.length !== 10) {
      alert('Please enter host name and a 10-digit phone number.');
      return;
    }
    try {
      console.log('Venue signup data:', {
        name: venueName,
        address,
        city,
        contact_name: hostName,
        contact_email: email,
        contact_phone: hostPhone,
        capacity_min: 0,
        capacity_max,
        price_per_head,
        hourly_price,
        daily_price,
        conditions: null,
      });
      
      await apiPost('/venues/signup', {
        name: venueName,
        address,
        city,
        contact_name: hostName,
        contact_email: email,
        contact_phone: hostPhone,
        capacity_min: 0,
        capacity_max,
        price_per_head,
        hourly_price,
        daily_price,
        conditions: null,
      }, 15000);
      navigation.navigate('VenueHome');
    } catch (e) {
      console.error('Venue signup error:', e);
      alert(e.message || 'Failed to create venue');
    }
  };

  // Determine if the button should be disabled
  const isNameValid = hostName.trim().length > 0;
  const isPhoneValid = hostPhone.length === 10;
  const isButtonDisabled = !isNameValid || !isPhoneValid;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back Button and Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
        </View>
        
        {/* Progress Bar and Step Text */}
        <View style={styles.headerTop}>
          <Text style={styles.stepText}>Step 11 of 11</Text>
          <ProgressBar progress={100} />
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Tell us about you</Text>
          
          {/* Name Input Field */}
          <View style={styles.inputGroup}>
             <Text style={styles.inputLabel}>Full Name</Text>
             <TextInput
                style={styles.input}
                onChangeText={setHostName}
                value={hostName}
                placeholder="Enter host full name"
                placeholderTextColor="#adb5bd"
                keyboardType="default"
                autoCapitalize="words"
                textContentType="name" 
                autoComplete="name" 
              />
          </View>
          
          {/* VVVVVVVV PHONE NUMBER COMPONENT INCLUDED HERE VVVVVVVV */}
          <PhoneInputView 
            phoneNumber={hostPhone} 
            setPhoneNumber={setHostPhone} 
            inputStyles={styles.inputGroup} // Apply the same margin as the name field
            hideTitle={false}
          />
          {/* ^^^^^^^^ PHONE NUMBER COMPONENT INCLUDED HERE ^^^^^^^^ */}

        </View>
      </ScrollView>

      {/* Fixed Footer/Button Section */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, (!hostName.trim() || hostPhone.length !== 10) && styles.disabledButton]}
          onPress={handleNext}
          disabled={!hostName.trim() || hostPhone.length !== 10}
        >
          <Text style={styles.buttonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default VenueHostNamePhoneScreen;

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
    paddingVertical: 15,
  },
  headerTop: {
    paddingVertical: 15,
  },
  contentContainer: {
    flex: 1,
    marginTop: 20,
    paddingHorizontal: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 40,
  },
  // --- Input Grouping for Name and Phone ---
  inputGroup: {
    marginBottom: 30, // Space between name and phone inputs
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 8,
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
  // --- Phone Specific Styles ---
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
  helperText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 8,
    paddingLeft: 5,
  },
  // --- General/Footer/Header Styles ---
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
  nextButton: {
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
    backgroundColor: '#e9ecef',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  progressBarActive: {
    height: '100%',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 2,
  },
  stepText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 5,
    marginTop: 5,
    marginLeft: 0,
  },
  backButton: {
    padding: 15, // Increase this value to make the touch area larger
    marginLeft: -15, // Optional: Offset to visually align the icon with the screen edge
  },
});
