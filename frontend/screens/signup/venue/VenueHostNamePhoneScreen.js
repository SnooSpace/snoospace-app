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
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../../constants/theme";
import ProgressBar from '../../../components/Progressbar';

const PhoneInputView = ({ phoneNumber, setPhoneNumber, inputStyles, hideTitle = false }) => {
  const [isFocused, setIsFocused] = useState(false);
  // Function to format the phone number as the user types (e.g., (XXX) XXX-XXXX)
  const formatPhoneNumber = (text) => {
    // Remove all non-digit characters
    const digits = text.replace(/\D/g, '');
    setPhoneNumber(digits);
  };

  return (
    <View style={inputStyles?.container || { marginBottom: 30 }}>
      {!hideTitle && <Text style={styles.inputLabel}>Phone Number</Text>}
      <View style={[styles.phoneInputContainer, isFocused && styles.phoneInputFocused]}>
        {/* Country Code and Flag for India */}
        <View style={styles.countryCodePill}>
          {/* Using a flag emoji for simplicity */}
          <Text style={styles.flagEmoji}>🇮🇳</Text>
          <Text style={styles.countryCodeText}>+91</Text>
          <Ionicons name="caret-down" size={12} color={COLORS.textPrimary} style={{ marginLeft: 5 }} />
        </View>

        {/* Actual Phone Number Input Field */}
        <TextInput
          style={styles.inputField}
          onChangeText={formatPhoneNumber}
          value={phoneNumber}
          placeholder="(000) 000-0000"
          placeholderTextColor={COLORS.textSecondary}
          keyboardType="phone-pad"
          textContentType="telephoneNumber" // iOS specific
          autoComplete="tel" // Android specific
          maxLength={10} // Indian numbers are typically 10 digits
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
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
          style={[styles.continueButtonContainer, phoneNumber.length !== 10 && styles.disabledButton]}
          onPress={handleContinue}
          // Button is enabled only when 10 digits are entered
          disabled={phoneNumber.length !== 10}
        >
          <LinearGradient
            colors={COLORS.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.continueButton}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ----------------------------------------------------------------------
// 2. MODIFIED: NameInputScreen (Now includes PhoneInputView)
// ----------------------------------------------------------------------

const VenueHostNamePhoneScreen = ({ navigation, route }) => {
  const { email, accessToken, name: venueName, address, city, phone, capacity_max, price_per_head, hourly_price, daily_price } = route.params || {};
  const [hostName, setHostName] = useState('');
  const [hostPhone, setHostPhone] = useState('');
  const [isNameFocused, setIsNameFocused] = useState(false);

  const handleNext = async () => {
    if (!hostName.trim() || hostPhone.length !== 10) {
      alert('Please enter host name and a 10-digit phone number.');
      return;
    }
    
    // DON'T create the venue record here - pass all data to username screen
    // Record will be created when username is set (final step)
    const userData = {
      ...route.params,
      contact_name: hostName,
      contact_phone: hostPhone,
    };
    
    console.log('[VenueHostNamePhone] Passing data to username screen:', {
      name: userData.name,
      email: userData.email,
      contact_name: userData.contact_name,
    });
    
    navigation.navigate('VenueUsername', { 
      userData, 
      accessToken: route.params?.accessToken 
    });
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
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
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
                 style={[styles.input, isNameFocused && styles.inputFocused]}
                 onChangeText={setHostName}
                 value={hostName}
                 placeholder="Enter host full name"
                 placeholderTextColor={COLORS.textSecondary}
                 keyboardType="default"
                 autoCapitalize="words"
                 textContentType="name" 
                 autoComplete="name"
                 onFocus={() => setIsNameFocused(true)}
                 onBlur={() => setIsNameFocused(false)} 
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
          style={[styles.nextButtonContainer, (!hostName.trim() || hostPhone.length !== 10) && styles.disabledButton]}
          onPress={handleNext}
          disabled={!hostName.trim() || hostPhone.length !== 10}
        >
          <LinearGradient
            colors={COLORS.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nextButton}
          >
            <Text style={styles.buttonText}>Next</Text>
          </LinearGradient>
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
    backgroundColor: COLORS.background,
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
    color: COLORS.textPrimary,
    marginBottom: 40,
  },
  // --- Input Grouping for Name and Phone ---
  inputGroup: {
    marginBottom: 30, // Space between name and phone inputs
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  input: {
    height: 50,
    backgroundColor: COLORS.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "#fff",
  },
  // --- Phone Specific Styles ---
  phoneInputContainer: {
    flexDirection: 'row',
    height: 50,
    backgroundColor: COLORS.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  phoneInputFocused: {
     borderColor: COLORS.primary,
     backgroundColor: "#fff",
  },
  countryCodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: 'transparent', // Slightly darker background for the code section
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  flagEmoji: {
    fontSize: 18,
    marginRight: 5,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginRight: 2,
  },
  inputField: {
    flex: 1,
    paddingHorizontal: 15,
    fontSize: 16,
    color: COLORS.textPrimary,
    backgroundColor: 'transparent',
  },
  helperText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 8,
    paddingLeft: 5,
  },
  // --- General/Footer/Header Styles ---
  footer: {
    padding: 20,
    backgroundColor: COLORS.background,
    borderTopWidth: 0,
    marginBottom: 50,
  },
  continueButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
  },
  continueButton: {
    paddingVertical: 15,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
  },
  nextButton: {
    paddingVertical: 15,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    fontWeight: '600',
  },
  progressBarContainer: {
    marginBottom: 20,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 5,
    marginTop: 5,
    marginLeft: 0,
  },
  backButton: {
    padding: 15,
    marginLeft: -15,
  },
});
