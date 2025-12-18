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
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../../constants/theme";
import ProgressBar from "../../../components/Progressbar";

const { width } = Dimensions.get('window');

// --- Components ---

/**
 * Custom TextInput Component
 */
/**
 * Custom TextInput Component
 */
const CustomInput = ({ placeholder, required = false, value, onChangeText }) => {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <TextInput
        style={[styles.input, isFocused && styles.inputFocused]}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textSecondary}
        value={value}
        onChangeText={onChangeText}
        aria-label={placeholder}
        accessibilityRole="text"
        autoCapitalize="words"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
    />
  );
};

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
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Progress Bar and Step Text */}
        <View style={styles.progressContainer}>
          <Text style={styles.stepText}>Step 7 of 9</Text>
          <ProgressBar progress={78} />
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
            styles.nextButtonContainer,
            isButtonDisabled && styles.disabledButton,
          ]}
          onPress={handleNext}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Next step"
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
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
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
    color: COLORS.textPrimary,
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
    backgroundColor: COLORS.inputBackground || '#f8f9fa',
    borderRadius: 15,
    paddingHorizontal: 20,
    fontSize: 16,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "#fff",
  },

  // --- Button Styles ---
  buttonFixedContainer: {
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
  disabledButton: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
});

export default CommunityHeadNameScreen;