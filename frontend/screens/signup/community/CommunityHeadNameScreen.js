import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
} from 'react-native';
import ProgressBar from '../../../components/Progressbar';

// --- Constants & Styling ---
const { width } = Dimensions.get('window');
const PRIMARY_COLOR = '#6C63FF'; // Vibrant purple for the accent
const LIGHT_GRAY = '#F0F0F0';   // Screen background color
const DARK_TEXT = '#1F1F39';    // Main text color
const PLACEHOLDER_TEXT = '#8888AA'; // Placeholder text color

// --- Components ---

/**
 * Custom TextInput Component
 */
const CustomInput = ({ placeholder, required = false, value, onChangeText }) => (
  <TextInput
    style={styles.input}
    placeholder={placeholder}
    placeholderTextColor={PLACEHOLDER_TEXT}
    value={value}
    onChangeText={onChangeText}
    // Accessibility properties for screen readers
    aria-label={placeholder}
    accessibilityRole="text"
    autoCapitalize="words"
  />
);

/**
 * Main Screen Component
 */
const CommunityHeadNameScreen = ({ navigation, route }) => {
  const { email, accessToken, name, logo_url, bio, category, location, phone } = route.params || {};
  
  // State management for the three input fields
  const [headName, setHeadName] = useState('');
  const [optionalName1, setOptionalName1] = useState('');
  const [optionalName2, setOptionalName2] = useState('');

  const handleNext = () => {
    // Basic validation for the required field
    if (!headName.trim()) {
      alert('Community head name is required.');
      return;
    }
    
    // Create heads array with primary head and optional heads
    const heads = [
      { name: headName, is_primary: true }
    ];
    
    if (optionalName1.trim()) {
      heads.push({ name: optionalName1, is_primary: false });
    }
    
    if (optionalName2.trim()) {
      heads.push({ name: optionalName2, is_primary: false });
    }
    
    navigation.navigate("CommunitySponsorType", {
      email,
      accessToken,
      name,
      logo_url,
      bio,
      category,
      location,
      phone,
      heads,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.background}>
        {/* Optional Header Title - Faded as seen in the image */}
        <Text style={styles.mainHeaderTitle}>Member Name Input</Text>

        <View style={styles.card}>
          {/* ScrollView allows content to be scrollable if the screen is small */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <Text style={styles.stepText}>Step 6 of 7</Text>
              <ProgressBar progress={85} />
            </View>

            <View style={styles.contentArea}>
              <Text style={styles.mainTitle}>
                Name of community head
              </Text>

              {/* Input Fields Group */}
              <View style={styles.inputGroup}>
                <CustomInput
                  placeholder="Enter name (required)"
                  required
                  value={headName}
                  onChangeText={setHeadName}
                />
                <CustomInput
                  placeholder="Enter name (optional)"
                  value={optionalName1}
                  onChangeText={setOptionalName1}
                />
                <CustomInput
                  placeholder="Enter name (optional)"
                  value={optionalName2}
                  onChangeText={setOptionalName2}
                />
              </View>
            </View>
          </ScrollView>

          {/* Fixed Button Container */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.nextButton}
              onPress={handleNext}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Next step"
            >
              <Text style={styles.buttonText}>Next</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: LIGHT_GRAY,
    paddingTop: 10,
    alignItems: 'center',
  },
  mainHeaderTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: DARK_TEXT,
    opacity: 0.5, // Faded effect
    marginBottom: 20,
  },
  card: {
    backgroundColor: 'white',
    width: width * 0.9, // Responsive width
    flex: 1,
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 8,
    marginBottom: 20,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100, // Important: Creates space for the fixed button at the bottom
  },

  // Progress Bar Styles
  progressBarContainer: {
    marginBottom: 40,
  },
  stepText: {
    fontSize: 14,
    color: PLACEHOLDER_TEXT,
    marginBottom: 8,
  },

  // Content Styles
  contentArea: {
    flex: 1,
    alignItems: 'center',
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: DARK_TEXT,
    textAlign: 'center',
    marginBottom: 60,
    lineHeight: 30,
  },

  // Input Styles
  inputGroup: {
    width: '100%',
    gap: 15, // Space between inputs
  },
  input: {
    width: '100%',
    height: 55,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 16,
    color: DARK_TEXT,
    borderWidth: 1,
    borderColor: LIGHT_GRAY,
    // Subtle inner shadow effect on inputs
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  // Button Styles
  buttonContainer: {
    // This view creates the fixed positioning for the button at the card's bottom
    paddingVertical: 15,
    position: 'absolute',
    bottom: 0,
    left: 20, // Aligns with card's horizontal padding
    right: 20, // Aligns with card's horizontal padding
    backgroundColor: 'white',
    // The ScrollView padding ensures this content is never obscured
  },
  nextButton: {
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

export default CommunityHeadNameScreen;
