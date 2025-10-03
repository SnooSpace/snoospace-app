import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Used for the back arrow

// --- Design Constants ---
const PRIMARY_COLOR = '#5f27cd'; // Deep purple for the button and selected chips
const TEXT_COLOR = '#1e1e1e'; // Dark text color
const LIGHT_TEXT_COLOR = '#6c757d'; // Lighter grey for subtitle and unselected chips
const BACKGROUND_COLOR = '#ffffff'; // White background
const MIN_SELECTIONS = 3; // Requirement from the design text

// --- Reusable Interest Chip Component ---
const InterestChip = ({ label, isSelected, onPress }) => {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        isSelected ? styles.chipSelected : styles.chipUnselected,
      ]}
      onPress={() => onPress(label)}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.chipText,
          isSelected ? styles.chipTextSelected : styles.chipTextUnselected,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const InterestsScreen = ({ navigation, route }) => {
  const { email, accessToken, phone, name, gender, dob } = route.params || {};
  const [selectedInterests, setSelectedInterests] = useState([]);

  // All available interests as shown in the design
  const allInterests = [
    'Sports', 'Music', 'Technology',
    'Travel', 'Food & Drink', 'Art & Culture',
    'Fitness', 'Gaming', 'Movies',
    'Books', 'Fashion', 'Photography',
    'Outdoors', 'Volunteering', 'Networking',
  ];

  const toggleInterest = (interest) => {
    setSelectedInterests((prev) => {
      if (prev.includes(interest)) {
        // Deselect
        return prev.filter((i) => i !== interest);
      } else {
        // Select
        return [...prev, interest];
      }
    });
  };

  const handleFinish = () => {
    navigation.navigate('MemberLocation', { email, accessToken, phone, name, gender, dob, interests: selectedInterests });
  };

  // Check if the selection requirement is met
  const isButtonDisabled = selectedInterests.length < MIN_SELECTIONS;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Section (Back Button, Title, Progress Bar) */}
        <View style={styles.header}>
          {/* Top Row: Back Button and Title */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => console.log('Go back')} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Interests</Text>
          </View>

          {/* Step Text and Progress Bar */}
          <View style={styles.progressSection}>
            <Text style={styles.stepText}>Step 3 of 3</Text>
            <Text style={styles.percentageText}>100%</Text>
            <View style={styles.progressBarContainer}>
              {/* 100% filled since it's Step 3 of 3 */}
              <View style={[styles.progressBarActive, { width: '100%' }]} />
            </View>
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>What are you interested in?</Text>
          <Text style={styles.subtitle}>
            Select at least {MIN_SELECTIONS} interests to personalize your experience.
          </Text>

          {/* Interest Chips Container */}
          <View style={styles.chipsContainer}>
            {allInterests.map((interest) => (
              <InterestChip
                key={interest}
                label={interest}
                isSelected={selectedInterests.includes(interest)}
                onPress={toggleInterest}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Fixed Footer/Button Section */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.finishButton, isButtonDisabled && styles.disabledButton]}
          onPress={handleFinish}
          disabled={isButtonDisabled}
        >
          <Text style={styles.buttonText}>Finish</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// --- Styles ---

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  backButton: {
    paddingRight: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_COLOR,
    flex: 1,
    textAlign: 'center',
    marginLeft: -40, // Visual centering adjustment
  },
  progressSection: {
    paddingHorizontal: 5,
  },
  stepText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 5,
  },
  percentageText: {
    position: 'absolute',
    top: 0,
    right: 5,
    fontSize: 14,
    color: TEXT_COLOR,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e9ecef',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  progressBarActive: {
    height: '100%',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 2,
  },
  contentContainer: {
    flex: 1,
    marginTop: 30,
    paddingHorizontal: 25,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 30,
  },

  // --- Chip Styles ---
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10, // Use gap for modern RN, or margin/padding if gap is not supported
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipSelected: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  chipUnselected: {
    backgroundColor: BACKGROUND_COLOR,
    borderColor: LIGHT_TEXT_COLOR + '80', // Lighter border for unselected
  },
  chipText: {
    fontSize: 16,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: BACKGROUND_COLOR, // White text on purple background
  },
  chipTextUnselected: {
    color: TEXT_COLOR,
  },

  // --- Footer/Button Styles ---
  footer: {
    padding: 20,
    backgroundColor: BACKGROUND_COLOR,
  },
  finishButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default InterestsScreen;