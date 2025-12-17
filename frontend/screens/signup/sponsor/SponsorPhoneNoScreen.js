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
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../../constants/theme";

const SponsorPhoneNumberInputScreen = ({ navigation, route }) => {
  const { email, accessToken } = route.params || {};
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleContinue = () => {
    console.log('SponsorPhoneNoScreen - phoneNumber:', phoneNumber);
    navigation.navigate('SponsorName', { email, accessToken, phone: phoneNumber });
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
        {/* Header Section */}
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Go back" style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
        </View>

        <View style={styles.progressBarContainer}>
            <Text style={styles.stepText}>Step 3 of 8</Text>
            <ProgressBar progress={37} />
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>What's your number?</Text>
          <Text style={styles.subtitle}>
            We'll text you a code to verify your phone.
          </Text>

          {/* Phone Number Input */}
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
        </View>
      </ScrollView>

      {/* Fixed Footer/Button Section */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButtonContainer, phoneNumber.length !== 10 && styles.disabledButton]}
          onPress={handleContinue}
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
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  backButton: {
    padding: 5,
    marginLeft: -5,
  },
  progressBarContainer: {
    marginBottom: 40,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
  contentContainer: {
    flex: 1,
    paddingTop: 0,
    paddingHorizontal: 5,
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
  phoneInputContainer: {
    flexDirection: 'row',
    height: 56,
    backgroundColor: COLORS.inputBackground,
    borderRadius: 12,
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
    paddingHorizontal: 15,
    backgroundColor: 'transparent',
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
  footer: {
    padding: 20,
    backgroundColor: COLORS.background,
    borderTopWidth: 0,
    marginBottom: 20,
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
  disabledButton: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    fontWeight: '600',
  },
});

export default SponsorPhoneNumberInputScreen;