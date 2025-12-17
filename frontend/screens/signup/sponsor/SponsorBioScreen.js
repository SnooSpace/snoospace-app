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
import ProgressBar from "../../../components/Progressbar";
import { Ionicons } from "@expo/vector-icons"; 

import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../../constants/theme";

// --- Constants & Styling ---
const { width } = Dimensions.get('window');

/**
 * Main Screen Component
 */
const SponsorBioScreen = ({ navigation, route }) => {
  const { email, accessToken, name, logo_url, phone } = route.params || {};
  const [bioText, setBioText] = useState('');

  const handleSkip = () => {
    navigation.navigate("SponsorCategory", { 
      email, 
      accessToken, 
      name, 
      phone,
      logo_url, 
      bio: null 
    });
  };

  const handleNext = () => {
    navigation.navigate("SponsorCategory", { 
      email, 
      accessToken, 
      name, 
      phone,
      logo_url, 
      bio: bioText 
    });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
  const [isFocused, setIsFocused] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Custom Header with Back and Skip */}
        <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} accessibilityLabel="Go back" style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSkip} accessibilityLabel="Skip this step" style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
            <Text style={styles.stepText}>Step 6 of 8</Text>
            <ProgressBar progress={75} />
        </View>

        <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
        >
            <View style={styles.contentArea}>
                <Text style={styles.title}>About You</Text>
                <Text style={styles.subtitle}>
                  Tell us a bit about your brand or sponsorship goals.
                </Text>

                <View style={[styles.inputContainer, isFocused && styles.inputFocused]}>
                    <TextInput
                        style={styles.bioInput}
                        placeholder="Start typing here..."
                        placeholderTextColor={COLORS.textSecondary}
                        value={bioText}
                        onChangeText={setBioText}
                        multiline={true}
                        textAlignVertical="top"
                        maxLength={500}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                    />
                </View>
            </View>
        </ScrollView>

        {/* Fixed Button Container */}
        <View style={styles.buttonContainer}>
            <TouchableOpacity
            style={styles.nextButtonContainer}
            onPress={handleNext}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Next step"
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
      </View>
    </SafeAreaView>
  );
    </SafeAreaView>
  );
};

// --- Stylesheet ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    paddingHorizontal: width * 0.05,
    backgroundColor: COLORS.background,
  },
  
  // --- Header Styles ---
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 15,
    paddingBottom: 5,
  },
  headerButton: {
    padding: 10,
    marginLeft: -10,
  },
  skipButton: {
    padding: 10,
    marginRight: -10,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.primary,
  },

  // --- Title Styles ---
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 10,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },

  // --- Progress Bar Styles ---
  progressBarContainer: {
    marginBottom: 30,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },

  // --- Content Styles ---
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 110,
  },
  contentArea: {
    flex: 1,
    paddingTop: 0,
  },

  // --- Input Styles ---
  inputContainer: {
    width: '100%',
    minHeight: 200,
    backgroundColor: COLORS.inputBackground || '#f8f9fa',
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "#fff",
  },
  bioInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    textAlignVertical: 'top',
    height: '100%',
  },

  // --- Button Styles ---
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    width: width,
    paddingHorizontal: width * 0.05,
    paddingVertical: 15,
    backgroundColor: COLORS.background,
    paddingBottom: Platform.OS === 'ios' ? 40 : 25,
    zIndex: 10,
  },
  nextButtonContainer: {
    width: '100%',
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
  },
  nextButton: {
    width: '100%',
    height: 70,
    borderRadius: BORDER_RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    fontWeight: '700',
  },
});

export default SponsorBioScreen;
