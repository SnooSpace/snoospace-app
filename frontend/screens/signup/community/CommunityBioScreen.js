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

// --- Constants & Styling ---
const { width } = Dimensions.get('window');
const PRIMARY_COLOR = '#6C63FF';    // Vibrant purple for accents
const LIGHT_GRAY = '#F0F0F0';      // Screen background color
const DARK_TEXT = '#1F1F39';       // Main text color
const PLACEHOLDER_TEXT = '#8888AA';// Placeholder text color
const LIGHT_PURPLE = '#EDE9FF';    // Light purple background for the bio input

/**
 * Main Screen Component
 */
const CommunityBioScreen = ({ navigation, route }) => {
  const { email, accessToken, name, logo_url } = route.params || {};
  const [bioText, setBioText] = useState('');

  const handleSkip = () => {
    navigation.navigate("CommunityCategory", { 
      email, 
      accessToken, 
      name, 
      logo_url, 
      bio: null 
    });
  };

  const handleNext = () => {
    navigation.navigate("CommunityCategory", { 
      email, 
      accessToken, 
      name, 
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
              {/* Placeholder for Back Icon */}
              <Text style={styles.backIcon}>&larr;</Text> 
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>About You</Text>
            
            <TouchableOpacity onPress={handleSkip} accessibilityLabel="Skip this step" style={styles.headerButton}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <Text style={styles.stepText}>Step 4 of 7</Text>
            <ProgressBar progress={57} />
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
                placeholderTextColor={PRIMARY_COLOR + '60'} // Semi-transparent purple
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
  card: {
    backgroundColor: 'white',
    width: width * 0.9, 
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
  
  // --- Header Styles ---
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
    paddingHorizontal: 5, // Small padding to align content with edges
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 28,
    fontWeight: '300',
    color: DARK_TEXT,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: DARK_TEXT,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
    color: PRIMARY_COLOR,
  },

  // --- Progress Bar Styles ---
  progressBarContainer: {
    marginBottom: 40,
  },
  stepText: {
    fontSize: 14,
    color: PLACEHOLDER_TEXT,
    marginBottom: 8,
    textAlign: 'center', // Center the step text
    opacity: 0.8,
  },

  // --- Bio Input Styles ---
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100, // Space for the fixed button
  },
  bioCard: {
    backgroundColor: LIGHT_PURPLE,
    borderRadius: 20,
    padding: 20,
    flex: 1,
    minHeight: 300, // Ensure a minimum visible height
  },
  bioPrompt: {
    fontSize: 18,
    fontWeight: '600',
    color: DARK_TEXT,
    opacity: 0.7,
    marginBottom: 10,
  },
  bioInput: {
    fontSize: 16,
    color: DARK_TEXT,
    minHeight: 250, // Height for the input area itself
    // Removes default background from TextInput to let bioCard background show
    backgroundColor: 'transparent', 
    padding: 0, 
    lineHeight: 24,
  },

  // --- Button Styles (Reused) ---
  buttonContainer: {
    paddingVertical: 15,
    position: 'absolute',
    bottom: 0,
    left: 20, 
    right: 20, 
    backgroundColor: 'white',
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

export default CommunityBioScreen;
