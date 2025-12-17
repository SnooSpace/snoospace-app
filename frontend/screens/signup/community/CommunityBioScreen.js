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

import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../../constants/theme";

/**
 * Main Screen Component
 */
const CommunityBioScreen = ({ navigation, route }) => {
  const { email, accessToken, refreshToken, name, logo_url } = route.params || {};
  const [bioText, setBioText] = useState('');
  const [isFocused, setIsFocused] = useState(false);

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
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
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
            style={[
              styles.bioInput,
              isFocused && styles.bioInputFocused,
            ]}
            placeholder="Write a brief description of your community. What is its purpose? Who is it for? (500 characters max)"
            placeholderTextColor={COLORS.textSecondary} 
            value={bioText}
            onChangeText={setBioText}
            multiline={true}
            textAlignVertical="top" 
            maxLength={500} 
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
          <Text style={styles.charCount}>
            {bioText.length} / 500
          </Text>
        </View>
      </ScrollView>

      {/* Fixed Footer/Button Section */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButtonContainer, isButtonDisabled && styles.disabledButton]}
          onPress={handleNext}
          activeOpacity={0.8}
          disabled={isButtonDisabled} // Apply disabled prop
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

// --- Stylesheet ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    color: COLORS.primary,
  },
  // New styles for disabled Skip button
  disabledSkipButton: {
    // No visual changes to the container needed, relying on text opacity
  },
  disabledSkipText: {
    color: COLORS.textSecondary, // Change color to light grey when disabled
    opacity: 0.7,
  },

  // --- Progress Bar Styles ---
  progressContainer: {
    marginBottom: 40,
    paddingHorizontal: 5,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
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
    color: COLORS.textPrimary,
    marginBottom: 30,
  },
  bioInput: {
    fontSize: 16,
    color: COLORS.textPrimary,
    minHeight: 180, 
    backgroundColor: COLORS.inputBackground || "#f8f9fa",
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    lineHeight: 24,
  },
  bioInputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "#fff",
  },
  charCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'right',
  },

  // --- Footer/Button Styles (Fixed at bottom) ---
  footer: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingTop: 10, 
    paddingBottom: 0, 
    borderTopWidth: 0,
  },
  nextButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
    marginBottom: 280,
  },
  nextButton: {
    paddingVertical: 15,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    height: 60,
  },
  disabledButton: {
    opacity: 0.6, // Visually dim the button when disabled
    shadowOpacity: 0,
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    fontWeight: '700',
  },
});

export default CommunityBioScreen;