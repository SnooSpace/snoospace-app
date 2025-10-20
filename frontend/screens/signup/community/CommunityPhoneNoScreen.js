import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
} from 'react-native';

// --- Constants & Styling ---
const { width } = Dimensions.get('window');
const PRIMARY_COLOR = '#6C63FF';    // Vibrant purple for accents
const LIGHT_GRAY = '#F0F0F0';      // Screen background color
const DARK_TEXT = '#1F1F39';       // Main text color
const PLACEHOLDER_TEXT = '#8888AA';// Placeholder text color
const INPUT_BACKGROUND = '#FFFFFF'; // White background for inputs

// --- Components ---

/**
 * Custom Phone Number Input Field
 */
const PhoneInput = ({ placeholder, isRequired, value, onChangeText }) => (
  <View style={styles.phoneInputContainer}>
    {/* Mock Country Code/Flag Picker */}
    <TouchableOpacity
      style={styles.countryCodePicker}
      onPress={() => console.log('Action: Open country code selection modal')}
      activeOpacity={0.7}
      accessibilityLabel="Select country code"
    >
      {/* Indian Flag and Country Code */}
      <Text style={styles.countryCodeText}>🇮🇳 +91 </Text> 
      <Text style={styles.countryCodeDropdown}>▼</Text>
    </TouchableOpacity>

    {/* Phone Number Input */}
    <TextInput
      style={styles.phoneNumberInput}
      placeholder={placeholder}
      placeholderTextColor={PLACEHOLDER_TEXT}
      value={value}
      onChangeText={onChangeText}
      keyboardType="phone-pad"
      dataDetectorTypes="phoneNumber"
      maxLength={10} // Exactly 10 digits for Indian phone numbers
      autoFocus={isRequired}
    />
  </View>
);

/**
 * Main Screen Component
 */
const CommunityPhoneNoScreen = ({ navigation, route }) => {
  const { email, accessToken, name, logo_url, bio, category, location } = route.params || {};
  const [primaryNumber, setPrimaryNumber] = useState('');
  const [secondaryNumber, setSecondaryNumber] = useState('');

  const handleSkip = () => {
    navigation.navigate("CommunityHeadName", {
      email,
      accessToken,
      name,
      logo_url,
      bio,
      category,
      location,
      phone: null,
    });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleContinue = () => {
    // Basic validation for the required field
    if (!primaryNumber.trim()) {
      alert('Primary phone number is required.');
      return;
    }
    
    // Extract only digits from phone number
    const phoneDigits = primaryNumber.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      alert('Phone number must be exactly 10 digits.');
      return;
    }
    
    navigation.navigate("CommunityHeadName", {
      email,
      accessToken,
      name,
      logo_url,
      bio,
      category,
      location,
      phone: phoneDigits,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.background}>
        
        {/* Header with Back and Skip */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} accessibilityLabel="Go back" style={styles.headerButton}>
            <Text style={styles.backIcon}>&larr;</Text> 
          </TouchableOpacity>
        </View>
        
        {/* ScrollView allows content to be scrollable if the screen is small */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.contentArea}>
            
            {/* Main Prompt */}
            <Text style={styles.mainTitle}>
              What's your number?
            </Text>
            <Text style={styles.subtitle}>
              We'll text you a code to verify your phone.
            </Text>

            {/* Primary Phone Input (Required) */}
            <PhoneInput
              placeholder="(000) 000-0000"
              isRequired={true}
              value={primaryNumber}
              onChangeText={setPrimaryNumber}
            />

            {/* Secondary Phone Input (Optional) */}
            <View style={styles.optionalInputSection}>
              <Text style={styles.optionalInputLabel}>Add another number</Text>
              <Text style={styles.optionalLabel}>Optional</Text>
            </View>
            <PhoneInput
              placeholder="(000) 000-0000"
              isRequired={false}
              value={secondaryNumber}
              onChangeText={setSecondaryNumber}
            />
            
          </View>
        </ScrollView>

        {/* Fixed Button Container */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Continue to verification code input"
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

// --- Stylesheet ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: LIGHT_GRAY,
  },
  background: {
    flex: 1,
    backgroundColor: 'white', // The whole screen body is white for this design
    alignItems: 'center',
    paddingHorizontal: width * 0.05, // Use screen width for padding
  },
  
  // --- Header Styles ---
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: '100%',
    paddingTop: 15,
    paddingBottom: 25,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backIcon: {
    fontSize: 28,
    fontWeight: '300',
    color: DARK_TEXT,
  },
  skipButton: {
    paddingHorizontal: 10,
    height: 40,
    justifyContent: 'center',
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },

  // --- Content Styles ---
  scrollContent: {
    flexGrow: 1,
    width: width * 0.9,
    paddingBottom: 100, // Space for the fixed button
  },
  contentArea: {
    flex: 1,
    alignItems: 'flex-start',
    paddingTop: 40,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: DARK_TEXT,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: PLACEHOLDER_TEXT,
    marginBottom: 40,
  },

  // --- Phone Input Styles ---
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 55,
    backgroundColor: INPUT_BACKGROUND,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LIGHT_GRAY,
    // Soft shadow for input fields
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 20,
  },
  countryCodePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    borderRightWidth: 1,
    borderRightColor: LIGHT_GRAY,
    height: '100%',
    justifyContent: 'center',
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK_TEXT,
  },
  countryCodeDropdown: {
    fontSize: 10,
    color: PLACEHOLDER_TEXT,
    marginLeft: 5,
  },
  phoneNumberInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 15,
    fontSize: 16,
    color: DARK_TEXT,
  },

  // --- Optional Input Section Styles ---
  optionalInputSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: '100%',
    marginTop: 20,
    marginBottom: 10,
  },
  optionalInputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: DARK_TEXT,
  },
  optionalLabel: {
    fontSize: 14,
    color: PLACEHOLDER_TEXT,
    opacity: 0.8,
  },

  // --- Button Styles ---
  buttonContainer: {
    paddingVertical: 15,
    position: 'absolute',
    bottom: 0,
    width: width * 0.9, // Match the padding of the screen
    backgroundColor: 'white',
  },
  continueButton: {
    width: '100%',
    height: 60,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default CommunityPhoneNoScreen;
