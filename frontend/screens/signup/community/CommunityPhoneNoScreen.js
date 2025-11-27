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
// import ProgressBar from "../../../components/Progressbar"; // Removed problematic import

// --- Constants & Styling ---
const { width } = Dimensions.get("window");
const PRIMARY_COLOR = "#5f27cd";
const LIGHT_GRAY = "#e9ecef";
const TEXT_COLOR = "#1e1e1e";
const LIGHT_TEXT_COLOR = "#6c757d";
const INPUT_BACKGROUND = "#f8f9fa";
const PLACEHOLDER_TEXT = "#6c757d";
const TRACK_COLOR = "#e0e0e0"; 

// --- Custom Progress Bar Reimplementation ---
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
const PhoneInput = ({ placeholder, isRequired, value, onChangeText }) => (
  <View style={styles.phoneInputContainer}>
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
      placeholderTextColor={PLACEHOLDER_TEXT}
      value={value}
      onChangeText={onChangeText}
      keyboardType="phone-pad"
      dataDetectorTypes="phoneNumber"
      maxLength={10}
      autoFocus={isRequired}
    />
  </View>
);

// --- Main Screen Component ---
const CommunityPhoneNoScreen = ({ navigation, route }) => {
  const { email, accessToken, name, logo_url, bio, category, categories, location } =
    route.params || {};
  const [primaryNumber, setPrimaryNumber] = useState("");
  const [secondaryNumber, setSecondaryNumber] = useState("");

  const handleSkip = () => {
    navigation.navigate("CommunityHeadName", {
      email,
      accessToken,
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
          <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
      </View>

      {/* 2. Progress Bar and Step Text */}
      <View style={styles.progressContainer}>
        <Text style={styles.stepText}>Step 6 of 9</Text>
        <SimpleProgressBar progress={67} />
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
            styles.continueButton,
            isButtonDisabled && styles.disabledButton,
          ]}
          onPress={handleContinue}
          activeOpacity={0.8}
          disabled={isButtonDisabled}
          accessibilityRole="button"
          accessibilityLabel="Continue to verification code input"
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
    backgroundColor: "white",
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
    color: LIGHT_TEXT_COLOR,
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
    color: TEXT_COLOR,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: PLACEHOLDER_TEXT,
    marginBottom: 40,
  },

  // --- Phone Input Styles ---
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 60,
    backgroundColor: INPUT_BACKGROUND,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LIGHT_GRAY,
    marginBottom: 20,
  },
  countryCodePicker: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    borderRightWidth: 1,
    borderRightColor: LIGHT_GRAY,
    height: "100%",
    justifyContent: "center",
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  phoneNumberInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 15,
    fontSize: 16,
    color: TEXT_COLOR,
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
    color: TEXT_COLOR,
  },
  optionalLabel: {
    fontSize: 14,
    color: PLACEHOLDER_TEXT,
    opacity: 0.8,
  },

  // --- Button Styles ---
  buttonContainer: {
    paddingVertical: 15,
    position: "absolute",
    bottom: 0,
    width: width * 0.9,
    alignSelf: "center",
    backgroundColor: "white",
    // FIX: Increased bottom padding to push the button higher
    paddingBottom: Platform.OS === 'ios' ? 40 : 25, 
  },
  continueButton: {
    width: "100%",
    height: 70,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default CommunityPhoneNoScreen;