import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import ProgressBar from "../../../components/Progressbar";
import { Ionicons } from "@expo/vector-icons"; 

// --- Consistent Design Constants ---
const PRIMARY_COLOR = "#5f27cd";    // Deep purple
const TEXT_COLOR = "#1e1e1e";      // Dark text
const LIGHT_TEXT_COLOR = "#6c757d"; // Lighter grey for step text
const BACKGROUND_COLOR = "#ffffff"; // White background
const INPUT_BG_COLOR = "#f8f9fa";  // Light grey background for input
const INPUT_BORDER_COLOR = "#ced4da"; // Light border for input

/**
 * Main Screen Component
 */
const CommunityBioScreen = ({ navigation, route }) => {
  const { email, accessToken, refreshToken, name, logo_url } = route.params || {};
  const [bioText, setBioText] = useState('');

  const handleSkip = () => {
    navigation.navigate("CommunityCategory", { 
      email, 
      accessToken, 
      refreshToken,
      name, 
      logo_url, 
      bio: null 
    });
  };

  const handleNext = () => {
    navigation.navigate("CommunityCategory", { 
      email, 
      accessToken, 
      refreshToken,
      name, 
      logo_url, 
      bio: bioText 
    });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  // 1. Next button is disabled if: text is empty OR text exceeds 500 characters.
  const isButtonDisabled = bioText.length > 500 || bioText.trim().length === 0;

  // 2. Skip button is disabled if: text is NOT empty.
  const isSkipDisabled = bioText.trim().length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Row (Back Button and Skip Button) */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={handleSkip} 
            style={[styles.skipButton, isSkipDisabled && styles.disabledSkipButton]} // Apply disabled style
            disabled={isSkipDisabled} // Apply disabled prop
          >
            <Text style={[styles.skipText, isSkipDisabled && styles.disabledSkipText]}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Progress Bar and Step Text */}
        <View style={styles.progressContainer}>
          <Text style={styles.stepText}>Step 3 of 9</Text>
          <ProgressBar progress={33} />
        </View>
        
        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>
            Tell us about your community...
          </Text>

          <TextInput
            style={styles.bioInput}
            placeholder="Write a brief description of your community. What is its purpose? Who is it for? (500 characters max)"
            placeholderTextColor={LIGHT_TEXT_COLOR} 
            value={bioText}
            onChangeText={setBioText}
            multiline={true}
            textAlignVertical="top" 
            maxLength={500} 
          />
          <Text style={styles.charCount}>
            {bioText.length} / 500
          </Text>
        </View>
      </ScrollView>

      {/* Fixed Footer/Button Section */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, isButtonDisabled && styles.disabledButton]}
          onPress={handleNext}
          activeOpacity={0.8}
          disabled={isButtonDisabled} // Apply disabled prop
        >
          <Text style={styles.buttonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// --- Stylesheet ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  
  // --- Header Styles ---
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 15,
    paddingBottom: 10,
    paddingHorizontal: 5,
  },
  backButton: {
    padding: 10,
    marginLeft: -10,
  },
  skipButton: {
    padding: 10,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
    color: PRIMARY_COLOR,
  },
  // New styles for disabled Skip button
  disabledSkipButton: {
    // No visual changes to the container needed, relying on text opacity
  },
  disabledSkipText: {
    color: LIGHT_TEXT_COLOR, // Change color to light grey when disabled
    opacity: 0.7,
  },

  // --- Progress Bar Styles ---
  progressContainer: {
    marginBottom: 40,
    paddingHorizontal: 5,
  },
  stepText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 5,
  },
  
  // --- Content & Input Styles ---
  contentContainer: {
    marginTop: 10,
    paddingHorizontal: 5,
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: TEXT_COLOR,
    marginBottom: 30,
  },
  bioInput: {
    fontSize: 16,
    color: TEXT_COLOR,
    minHeight: 180, 
    backgroundColor: INPUT_BG_COLOR,
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: INPUT_BORDER_COLOR,
    lineHeight: 24,
  },
  charCount: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 8,
    textAlign: 'right',
  },

  // --- Footer/Button Styles (Fixed at bottom) ---
  footer: {
    backgroundColor: BACKGROUND_COLOR,
    paddingHorizontal: 20,
    paddingTop: 10, 
    paddingBottom: 0, 
    borderTopWidth: 0,
  },
  nextButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    height: 60,
    marginBottom: 280,
  },
  disabledButton: {
    opacity: 0.6, // Visually dim the button when disabled
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default CommunityBioScreen;