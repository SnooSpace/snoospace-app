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

import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../../constants/theme";

const VenueCapacityScreen = ({ navigation, route }) => {
  const { email, accessToken, phone, name, category, logo_url, bio, interests, address, city } = route.params || {};
  const [capacity, setCapacity] = useState('');
  const [isFocused, setIsFocused] = useState(false);
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
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
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
              style={[
                  styles.capacityInput,
                  isFocused && { borderColor: COLORS.primary } 
               ]}
              value={capacity}
              onChangeText={handleTextChange}
              placeholder="0"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="number-pad"
              maxLength={5}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
            {/* Underline removed as we are using border style for input now, or we can keep it if we want a specific look. 
                Let's stick to a clean input style. */}
          </View>
        </View>

      </View>

      {/* Fixed Next Button Footer */}
      {/* Fixed Next Button Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButtonContainer, isButtonDisabled && styles.disabledButton]}
          onPress={handleNext}
          disabled={isButtonDisabled}
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

export default VenueCapacityScreen;

// --- Styles ---

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  backButton: {
    padding: 5,
    marginLeft: -5,
  },
  placeholder: {
    width: 24, 
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
    color: COLORS.textPrimary,
    alignSelf: 'center',
    marginBottom: 10,
    textAlign: 'center',
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 60,
  },
  capacityDisplayArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  capacityValueContainer: {
    width: '100%',
    alignItems: 'center',
  },
  capacityInput: {
    fontSize: 80,
    fontWeight: '300',
    color: COLORS.textPrimary,
    textAlign: 'center',
    minWidth: 150,
    paddingVertical: 10,
    borderBottomWidth: 2, // Minimalist underline style matching the "modern" field
    borderBottomColor: COLORS.border,
  },
  
  // Footer
  footer: {
    padding: 20,
    backgroundColor: COLORS.background,
    marginBottom: 20,
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
    fontWeight: '700',
  },
});
