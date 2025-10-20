import React, { useState } from 'react';
// Note: The failure to resolve 'react-native' is an environmental issue.
// We keep the imports as they are required for React Native components to work.
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  TextInput,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

// --- Design Constants ---
const PRIMARY_COLOR = '#5f27cd'; // Deep purple for the button
const TEXT_COLOR = '#1e1e1e'; // Dark text color (for titles and labels)
const LIGHT_TEXT_COLOR = '#6c757d'; // Lighter grey (for helper text)
const BACKGROUND_COLOR = '#ffffff'; // White background
const BORDER_COLOR = '#e0e0e0'; // Light grey border

// Simple Text Back Arrow (Ensures compatibility by avoiding external dependencies)
const BackArrow = ({ color }) => (
    <Text style={{ fontSize: 24, color: color, transform: [{ scaleX: Platform.OS === 'ios' ? 1.5 : 1.2 }] }}>
        {'<'} 
    </Text>
);

// Main Screen Component
const VenueCapacityScreen = ({ navigation, route }) => {
  const { email, accessToken, phone, name, category, logo_url, bio, interests, address, city } = route.params || {};
  const [capacity, setCapacity] = useState('');
  const minCapacity = 0; // Minimum capacity allowed

  const handleTextChange = (text) => {
    const digits = text.replace(/\D/g, '');
    setCapacity(digits);
  };

  const handleNext = () => {
    navigation.navigate('VenuePricing', {
      email,
      accessToken,
      phone,
      name,
      category,
      logo_url,
      bio,
      interests,
      address,
      city,
      capacity_max: capacity,
    });
  };

  // Button is enabled if capacity is greater than 0
  const isButtonDisabled = !capacity || parseInt(capacity, 10) <= 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity 
            onPress={() => navigation && navigation.goBack ? navigation.goBack() : console.log('Go Back Action')}
            style={styles.backButton}
        >

          {/* Header Section (Only Back Button) */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
          {/* Progress bar and Skip button removed as per request */}
        </View>
        </TouchableOpacity>
      </View>
      
      <View style={styles.contentContainer}>
        <Text style={styles.questionText}>What's the maximum capacity?</Text>
        <Text style={styles.stepText}>Step 9 of 11</Text>

        {/* Large Capacity Display Area */}
        {/* Using a main View that handles touch interaction for increment/decrement 
            on the large number, if direct controls are too hard to hit. 
            However, we stick to the provided controls for accuracy. */}
        <View style={styles.capacityDisplayArea}>
          <View style={styles.capacityValueContainer}>
            <TextInput
              style={styles.capacityInput}
              value={capacity}
              onChangeText={handleTextChange}
              placeholder="0"
              keyboardType="number-pad"
              maxLength={5}
            />
            <View style={styles.underline} />
          </View>
        </View>

      </View>

      {/* Fixed Next Button Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, isButtonDisabled && styles.disabledButton]}
          onPress={handleNext}
          disabled={isButtonDisabled}
        >
          <Text style={styles.buttonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default VenueCapacityScreen;

// --- Styles ---

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: BACKGROUND_COLOR,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_COLOR,
  },
  backButton: {
    padding: 5,
  },
  placeholder: {
    width: 24, // Matches the size of the back icon for centering the title
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 30,
    paddingVertical: 40,
    alignItems: 'center',
  },
  questionText: {
    fontSize: 24,
    fontWeight: '700',
    color: TEXT_COLOR,
    alignSelf: 'flex-start',
    marginBottom: 80, // Space between question and counter
  },
  capacityDisplayArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  capacityValueContainer: {
    alignItems: 'center',
    marginHorizontal: 40, // Space between number and controls
    minWidth: 100, // Ensure the number area doesn't shrink
  },
  capacityValue: {
    fontSize: 80,
    fontWeight: '300', // Light font weight for a sleek look
    color: TEXT_COLOR,
    marginBottom: 5,
  },
  underline: {
    width: '100%',
    height: 2,
    backgroundColor: BORDER_COLOR,
  },
  controlButton: {
    padding: 10,
    // Increase hit area slightly
  },
  controlButtonDisabled: {
      opacity: 0.5,
  },
  controlText: {
    fontSize: 48,
    color: TEXT_COLOR,
    fontWeight: '200',
  },
  controlTextDisabled: {
    color: BORDER_COLOR,
  },
  footer: {
    padding: 20,
    backgroundColor: BACKGROUND_COLOR,
  },
  nextButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  disabledButton: {
    backgroundColor: '#9c88ff',
    opacity: 0.8,
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
