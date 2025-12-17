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
const VenueBioScreen = ({ navigation, route }) => {
  const { email, accessToken, name, logo_url, phone } = route.params || {};
  const [bioText, setBioText] = useState('');

  const handleSkip = () => {
    navigation.navigate("VenueCategory", { 
      email, 
      accessToken, 
      name, 
      phone,
      logo_url, 
      bio: null 
    });
  };

  const handleNext = () => {
    navigation.navigate("VenueCategory", { 
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
      <View style={styles.background}>
        
        {/* Main Card */}
        <View style={styles.card}>

          {/* Custom Header with Back and Skip */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} accessibilityLabel="Go back" style={styles.headerButton}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>About You</Text>
            
            <TouchableOpacity onPress={handleSkip} accessibilityLabel="Skip this step" style={styles.headerButton}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <Text style={styles.stepText}>Step 5 of 11</Text>
            <ProgressBar progress={45} />
          </View>
          
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Bio Input Card */}
            <View style={styles.bioCard}>
              <Text style={styles.bioPrompt}>
                Tell us about yourself...
              </Text>

              <TextInput
                style={styles.bioInput}
                placeholder="Start typing here..."
                placeholderTextColor={COLORS.textSecondary}
                value={bioText}
                onChangeText={setBioText}
                multiline={true}
                textAlignVertical="top" // Ensure text starts at the top
                maxLength={500} // Example limit
                autoFocus={true}
              />
            </View>
          </ScrollView>

          {/* Fixed Button Container */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.finishButtonContainer}
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
      </View>
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
  background: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: width * 0.05,
    paddingTop: 10,
  },
  card: {
    flex: 1,
  },
  
  // --- Header Styles ---
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
    paddingHorizontal: 0,
    marginTop: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.primary,
  },

  // --- Progress Bar Styles ---
  progressBarContainer: {
    marginBottom: 40,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
    textAlign: 'center', // Center the step text
    opacity: 0.8,
  },

  // --- Bio Input Styles ---
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 120, // Space for the fixed button
  },
  bioCard: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: 20,
    padding: 20,
    flex: 1,
    minHeight: 300, 
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bioPrompt: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    opacity: 0.7,
    marginBottom: 10,
  },
  bioInput: {
    fontSize: 16,
    color: COLORS.textPrimary,
    minHeight: 250, 
    backgroundColor: 'transparent', 
    padding: 0, 
    lineHeight: 24,
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
    left: -width * 0.05,
  },
  finishButtonContainer: {
    width: '100%',
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
  },
  nextButton: {
    width: '100%',
    height: 60,
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

export default VenueBioScreen;