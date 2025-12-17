import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons"; // Used for the back arrow and location icon
import ProgressBar from "../../../components/Progressbar";

import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../../constants/theme";

const VenueLocationScreen = ({ navigation, route }) => {
  const { email, accessToken, phone, name, category, logo_url, bio, interests, capacity_max } =
    route.params || {};
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const [isCityFocused, setIsCityFocused] = useState(false);

  const handleNext = () => {
    navigation.navigate("VenueMaxCap", {
      email,
      accessToken,
      phone,
      name,
      category,
      logo_url,
      bio,
      interests,
      address,
      city,
    });
  };

  // Determine if the button should be disabled (e.g., if the location is empty)
  const isButtonDisabled = address.trim().length === 0 || city.trim().length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Section (Only Back Button) */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          {/* Progress bar and Skip button removed as per request */}
        </View>

        {/* Header Section (Progress Bar and Step Text) */}
        <View style={styles.header}>
          <Text style={styles.stepText}>Step 8 of 11</Text>

          {/* Progress Bar Container */}
          <View style={styles.progressBarContainer}>
            <ProgressBar progress={72} />
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Where is your venue located?</Text>

          {/* Location Input Field */}
          {/* Location Input Field */}
          <View style={[styles.inputWrapper, isAddressFocused && styles.inputFocused]}>
            <Ionicons
              name="location-outline"
              size={20}
              color={COLORS.textSecondary}
              style={styles.locationIcon}
            />
            <TextInput
              style={styles.input}
              onChangeText={setAddress}
              value={address}
              placeholder="Enter address"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="default"
              autoCapitalize="words"
              textContentType="addressCity" // iOS specific (best fit)
              autoComplete="postal-address-locality" // Android specific (best fit)
              onFocus={() => setIsAddressFocused(true)}
              onBlur={() => setIsAddressFocused(false)}
            />
          </View>

          <View style={[styles.inputWrapper, { marginTop: 12 }, isCityFocused && styles.inputFocused]}>
            <Ionicons
              name="business-outline"
              size={20}
              color={COLORS.textSecondary}
              style={styles.locationIcon}
            />
            <TextInput
              style={styles.input}
              onChangeText={setCity}
              value={city}
              placeholder="Enter city"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="default"
              autoCapitalize="words"
              textContentType="addressCity"
              autoComplete="postal-address-locality"
              onFocus={() => setIsCityFocused(true)}
              onBlur={() => setIsCityFocused(false)}
            />
          </View>
        </View>
      </ScrollView>

      {/* Fixed Footer/Button Section */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButtonContainer, isButtonDisabled && styles.disabledButton]}
          onPress={handleNext}
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

// --- Styles ---

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 5,
    backgroundColor: COLORS.background,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  backButton: {
    paddingRight: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: "center",
    marginLeft: -40,
  },
  progressSection: {
    paddingHorizontal: 5,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
  progressBarContainer: {
    marginBottom: 20,
  },
  contentContainer: {
    flex: 1,
    marginTop: 30,
    paddingHorizontal: 25,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    marginBottom: 40,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    backgroundColor: COLORS.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 15,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "#fff",
  },
  locationIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textPrimary,
    paddingVertical: 0,
  },

  // --- Footer/Button Styles ---
  footer: {
    padding: 20,
    backgroundColor: COLORS.background,
    marginBottom: 50,
  },
  nextButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
  },
  nextButton: {
    paddingVertical: 15,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    fontWeight: "600",
  },
  backButton: {
    padding: 15,
    marginLeft: -15,
  },
});

export default VenueLocationScreen;
