import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Used for the back arrow

// --- MOCKING THE SCROLL WHEEL COMPONENT ---
// In a real application, you would use a custom component or a library
// like 'react-native-wheel-scrollview-picker' to implement this exact scrolling effect.
// For this example, we'll create a static visual mock using a View.

const PickerRow = ({ month, day, year, isSelected }) => (
  <View style={styles.pickerRow}>
    <Text style={[styles.pickerText, isSelected && styles.selectedText]}>{month}</Text>
    <Text style={[styles.pickerText, isSelected && styles.selectedText]}>{day}</Text>
    <Text style={[styles.pickerText, isSelected && styles.selectedText]}>{year}</Text>
  </View>
);

// --- Design Constants ---
const PRIMARY_COLOR = '#5f27cd'; // Deep purple for the button and progress bar
const TEXT_COLOR = '#1e1e1e'; // Dark text color
const LIGHT_TEXT_COLOR = '#6c757d'; // Lighter grey for step text
const BACKGROUND_COLOR = '#ffffff'; // White background
const SCREEN_WIDTH = Dimensions.get('window').width;

const BirthdayInputScreen = ({ navigation, route }) => {
  const { email, accessToken, phone, name, gender } = route.params || {};
  // In a real app, this state would hold the selected date from the wheel picker
  const [selectedDate, setSelectedDate] = useState({ month: 'Jan', day: 1, year: 2000 });
  const isDateSelected = true; // Assuming a default date is always selected

  const handleNext = () => {
    const dob = `${selectedDate.year}-${String(1).padStart(2,'0')}-${String(selectedDate.day).padStart(2,'0')}`;
    navigation.navigate('MemberInterests', { email, accessToken, phone, name, gender, dob });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header Section (Back Button and Progress Bar) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => console.log('Go back')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>

        {/* Progress Bar Container */}
        <View style={styles.progressBarContainer}>
          {/* Assuming this is Step 2 of 4 (50% filled) */}
          <View style={[styles.progressBarActive, { width: '50%' }]} />
          <View style={styles.progressBarInactive} />
        </View>
      </View>

      {/* Content Section */}
      <View style={styles.contentContainer}>
        <Text style={styles.title}>When's your birthday?</Text>
        <Text style={styles.subtitle}>
          This won't be part of your public profile.
        </Text>

        {/* --- MOCK DATE PICKER --- */}
        <View style={styles.pickerWrapper}>
          {/* Picker Highlight/Overlay */}
          <View style={styles.pickerHighlightOverlay} />

          {/* Static Mock of the Scrolling Rows */}
          <PickerRow month="Jan" day={1} year={2000} isSelected={true} />
          <PickerRow month="Feb" day={2} year={2001} isSelected={false} />
          <PickerRow month="Mar" day={3} year={2002} isSelected={false} />
        </View>
        {/* --- END MOCK DATE PICKER --- */}
      </View>

      {/* Fixed Footer/Button Section */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, !isDateSelected && styles.disabledButton]}
          onPress={handleNext}
          disabled={!isDateSelected}
        >
          <Text style={styles.buttonText}>Next</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
  },
  backButton: {
    paddingRight: 15,
  },
  progressBarContainer: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e9ecef',
    overflow: 'hidden',
    flexDirection: 'row',
    marginRight: 20, // To give space on the right
  },
  progressBarActive: {
    height: '100%',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 2,
  },
  progressBarInactive: {
    flex: 1,
    height: '100%',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 25,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 40,
  },

  // --- Picker Styles ---
  pickerWrapper: {
    height: 200, // Fixed height for the picker area
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  pickerHighlightOverlay: {
    position: 'absolute',
    top: '33.33%', // Center the overlay over one row (3 rows visible)
    width: '100%',
    height: '33.33%',
    backgroundColor: PRIMARY_COLOR + '20', // Purple with some transparency
    borderRadius: 10,
  },
  pickerRow: {
    flexDirection: 'row',
    width: '100%',
    height: '33.33%', // Each row takes up one-third of the picker height
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  pickerText: {
    fontSize: 20,
    color: LIGHT_TEXT_COLOR,
    fontWeight: '500',
    width: SCREEN_WIDTH / 4, // Distribute width evenly
    textAlign: 'center',
  },
  selectedText: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_COLOR, // Darker text color for the selected row
  },

  // --- Footer/Button Styles ---
  footer: {
    padding: 20,
    backgroundColor: BACKGROUND_COLOR,
    borderTopWidth: 0,
  },
  nextButton: {
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

export default BirthdayInputScreen;