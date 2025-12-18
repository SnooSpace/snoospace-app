import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
  Platform,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../../constants/theme";
import ProgressBar from "../../../components/Progressbar"; 

const { width } = Dimensions.get('window');


// --- Components ---
const PhoneInput = ({ placeholder, isRequired, value, onChangeText }) => {
  const [isFocused, setIsFocused] = useState(false);
  return (
  <View style={[styles.phoneInputContainer, isFocused && styles.phoneInputContainerFocused]}>
    <TouchableOpacity
      style={styles.countryCodePicker}
      onPress={() => console.log("Action: Open country code selection modal")}
      activeOpacity={0.7}
      accessibilityLabel="Select country code"
    >
      <Text style={styles.countryCodeText}>🇮🇳 +91 </Text>
    </TouchableOpacity>
    <TextInput
      style={styles.phoneNumberInput}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textSecondary}
      value={value}
      onChangeText={onChangeText}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      keyboardType="phone-pad"
      dataDetectorTypes="phoneNumber"
      maxLength={10}
      autoFocus={isRequired}
    />
  </View>
  );
};

// --- Main Screen Component ---
const CommunityPhoneNoScreen = ({ navigation, route }) => {
  const { email, accessToken, refreshToken, name, logo_url, bio, category, categories, location } =
    route.params || {};
  const [primaryNumber, setPrimaryNumber] = useState("");
  const [secondaryNumber, setSecondaryNumber] = useState("");

  const handleSkip = () => {
    navigation.navigate("CommunityHeadName", {
      email,
      accessToken,
      refreshToken,
      name,
      logo_url,
      bio,
      category,
      categories,
      location,
      phone: null,
      secondary_phone: null,
    });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleContinue = () => {
    if (!primaryNumber.trim()) {
      alert("Primary phone number is required.");
      return;
    }

    const phoneDigits = primaryNumber.replace(/\D/g, "");
    if (phoneDigits.length !== 10) {
      alert("Phone number must be exactly 10 digits.");
      return;
    }

    const secondaryPhoneDigits = secondaryNumber.trim()
      ? secondaryNumber.replace(/\D/g, "")
      : null;
    if (secondaryPhoneDigits && secondaryPhoneDigits.length !== 10) {
      alert("Secondary phone number must be exactly 10 digits if provided.");
      return;
    }

    navigation.navigate("CommunityHeadName", {
      email,
      accessToken,
      refreshToken,
      name,
      logo_url,
      bio,
      category,
      categories,
      location,
      phone: phoneDigits,
      secondary_phone: secondaryPhoneDigits || null,
    });
  };

  const isButtonDisabled = primaryNumber.replace(/\D/g, "").length !== 10;

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* 1. Header Row (Back and Skip) */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={handleBack}
          accessibilityLabel="Go back"
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* 2. Progress Bar and Step Text */}
      <View style={styles.progressContainer}>
        <Text style={styles.stepText}>Step 6 of 9</Text>
        <ProgressBar progress={67} />
      </View>

      {/* 3. Scrollable Content */}
      <ScrollView
        style={styles.contentScrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentArea}>
          <Text style={styles.mainTitle}>What's your number?</Text>

          <PhoneInput
            placeholder="(000) 000-0000"
            isRequired={true}
            value={primaryNumber}
            onChangeText={setPrimaryNumber}
          />

          <View style={styles.optionalInputSection}>
            <Text style={styles.optionalInputLabel}>Add another number</Text>
            <Text style={styles.optionalLabel}>Optional</Text>
          </View>
          <PhoneInput
            placeholder="(000) 000-0000"
            isRequired={false}
            value={secondaryNumber}
            onChangeText={setSecondaryNumber}
          />
        </View>
      </ScrollView>

      {/* 4. Fixed Button Container */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.continueButtonContainer,
            isButtonDisabled && styles.disabledButton,
          ]}
          onPress={handleContinue}
          activeOpacity={0.8}
          disabled={isButtonDisabled}
          accessibilityRole="button"
          accessibilityLabel="Continue to verification code input"
        >
          <LinearGradient
            colors={COLORS.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.continueButton}
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

  // --- Header Styles ---
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingTop: 15,
    paddingBottom: 5,
    paddingHorizontal: width * 0.05,
  },
  backButton: {
    padding: 10,
    marginLeft: -10,
  },

  // --- Progress Bar Styles ---
  progressContainer: {
    width: "100%",
    marginBottom: 40,
    height: 20, 
    paddingHorizontal: width * 0.05,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },

  // --- Content Styles ---
  contentScrollView: {
    flex: 1,
    width: "100%",
  },
  scrollContent: {
    flexGrow: 1,
    width: width * 0.9,
    alignSelf: "center",
    // FIX: Reduced padding bottom here to accommodate the slightly raised button footer
    paddingBottom: 70, 
  },
  contentArea: {
    flex: 1,
    alignItems: "flex-start",
    paddingTop: 0,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 40,
  },

  // --- Phone Input Styles ---
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 60,
    backgroundColor: COLORS.inputBackground || "#f8f9fa",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  phoneInputContainerFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "#fff",
  },
  countryCodePicker: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    height: "100%",
    justifyContent: "center",
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  phoneNumberInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 15,
    fontSize: 16,
    color: COLORS.textPrimary,
  },

  // --- Optional Input Section Styles ---
  optionalInputSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    width: "100%",
    marginTop: 20,
    marginBottom: 10,
  },
  optionalInputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  optionalLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    opacity: 0.8,
  },

  // --- Button Styles ---
  buttonContainer: {
    paddingVertical: 15,
    position: "absolute",
    bottom: 0,
    width: width * 0.9,
    alignSelf: "center",
    backgroundColor: COLORS.background,
    // FIX: Increased bottom padding to push the button higher
    paddingBottom: Platform.OS === 'ios' ? 40 : 25, 
  },
  continueButtonContainer: {
    width: "100%",
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
  },
  continueButton: {
    width: "100%",
    height: 70,
    borderRadius: BORDER_RADIUS.pill,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
});

export default CommunityPhoneNoScreen;