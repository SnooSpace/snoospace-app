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
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// import ProgressBar from '../../../components/Progressbar'; // Removed problematic import

// --- Consistent Design Constants ---
const { width } = Dimensions.get('window');
const PRIMARY_COLOR = '#5f27cd'; // Consistent Deep Purple
const TEXT_COLOR = '#1e1e1e';
const LIGHT_TEXT_COLOR = '#6c757d';
const BACKGROUND_COLOR = '#ffffff';
const INPUT_BACKGROUND = '#f8f9fa';
const PLACEHOLDER_TEXT = '#6c757d';
const TRACK_COLOR = '#e0e0e0'; // Light gray for the progress bar background/track

// --- Custom Progress Bar Reimplementation ---

/**
 * Custom Simple Progress Bar Component (Guaranteed to work)
 */
const SimpleProgressBar = ({ progress }) => {
  return (
    <View style={progressBarStyles.track}>
      <View style={[progressBarStyles.fill, { width: `${progress}%` }]} />
    </View>
  );
};

const progressBarStyles = StyleSheet.create({
  track: {
    height: 8,
    width: '100%',
    backgroundColor: TRACK_COLOR,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 4,
  }
});

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
    aria-label={placeholder}
    accessibilityRole="text"
    autoCapitalize="words"
  />
);

/**
 * Main Screen Component
 */
const CommunityHeadNameScreen = ({ navigation, route }) => {
  const { email, accessToken, refreshToken, name, logo_url, bio, category, categories, location, phone, secondary_phone } = route.params || {};
  
  const [headName, setHeadName] = useState('');
  const [optionalName1, setOptionalName1] = useState('');
  const [optionalName2, setOptionalName2] = useState('');

  const handleBack = () => {
    navigation.goBack();
  };

  const handleNext = () => {
    // Basic validation for the required field
    if (!headName.trim()) {
      alert('Community head name is required.');
      return;
    }
    
    const heads = [
      { name: headName.trim(), is_primary: true }
    ];
    
    if (optionalName1.trim()) {
      heads.push({ name: optionalName1.trim(), is_primary: false });
    }
    
    if (optionalName2.trim()) {
      heads.push({ name: optionalName2.trim(), is_primary: false });
    }
    
    navigation.navigate("CommunitySponsorType", {
      email,
      accessToken,
      refreshToken,
      name,
      logo_url,
      bio,
      category,
      categories,
      location,
      phone,
      secondary_phone,
      heads,
    });
  };

  const isButtonDisabled = !headName.trim();

  return (
    <SafeAreaView style={styles.safeArea}>
      
      <View style={styles.container}>
        
        {/* Header Row (Back Button) */}
        <View style={styles.headerRow}>
          <TouchableOpacity 
            onPress={handleBack} 
            style={styles.backButton}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
        </View>

        {/* Progress Bar and Step Text */}
        <View style={styles.progressContainer}>
          <Text style={styles.stepText}>Step 7 of 9</Text>
          <SimpleProgressBar progress={78} />
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={styles.contentScrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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
      </View>

      {/* Fixed Button Container (Outside ScrollView) */}
      <View style={styles.buttonFixedContainer}>
        <TouchableOpacity
          style={[
            styles.nextButton,
            isButtonDisabled && styles.disabledButton,
          ]}
          onPress={handleNext}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Next step"
          disabled={isButtonDisabled}
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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    paddingHorizontal: width * 0.05,
    backgroundColor: BACKGROUND_COLOR,
  },
  
  // --- Header Styles ---
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: '100%',
    paddingTop: 15,
    paddingBottom: 5,
  },
  backButton: {
    padding: 10,
    marginLeft: -10,
  },

  // --- Progress Bar Styles ---
  progressContainer: {
    width: '100%',
    marginBottom: 40,
    height: 20,
  },
  stepText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 5,
  },

  // --- Content Styles ---
  contentScrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 110, 
  },
  contentArea: {
    flex: 1,
    alignItems: 'flex-start',
    paddingTop: 0,
    width: '100%',
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: TEXT_COLOR,
    textAlign: 'left',
    marginBottom: 60,
    lineHeight: 38,
  },

  // --- Input Styles ---
  inputGroup: {
    width: '100%',
    gap: 15,
  },
  input: {
    width: '100%',
    height: 60,
    backgroundColor: INPUT_BACKGROUND,
    borderRadius: 15,
    paddingHorizontal: 20,
    fontSize: 16,
    color: TEXT_COLOR,
    borderWidth: 1,
    borderColor: TRACK_COLOR,
  },

  // --- Button Styles ---
  buttonFixedContainer: {
    position: 'absolute',
    bottom: 0,
    width: width,
    paddingHorizontal: width * 0.05,
    paddingVertical: 15,
    backgroundColor: BACKGROUND_COLOR,
    paddingBottom: Platform.OS === 'ios' ? 40 : 25,
    zIndex: 10,
    // FIX: Removed borderTopWidth and borderTopColor to eliminate the line separator
    // borderTopWidth: 1,
    // borderTopColor: TRACK_COLOR,
  },
  nextButton: {
    width: '100%',
    height: 70,
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
  disabledButton: {
    opacity: 0.6,
  },
});

export default CommunityHeadNameScreen;