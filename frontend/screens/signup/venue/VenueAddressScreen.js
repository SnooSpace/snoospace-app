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

// --- Design Constants ---
const PRIMARY_COLOR = "#5f27cd"; // Deep purple for the button and progress bar
const TEXT_COLOR = "#1e1e1e"; // Dark text color
const LIGHT_TEXT_COLOR = "#6c757d"; // Lighter grey for step text
const BACKGROUND_COLOR = "#ffffff"; // White background
const BORDER_COLOR = "#ced4da"; // Light border color

const VenueLocationScreen = ({ navigation, route }) => {
  const { email, accessToken, phone, name, category, logo_url, bio, interests, capacity_max } =
    route.params || {};
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");

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
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
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
          <View style={styles.inputWrapper}>
            <Ionicons
              name="location-outline"
              size={20}
              color={LIGHT_TEXT_COLOR}
              style={styles.locationIcon}
            />
            <TextInput
              style={styles.input}
              onChangeText={setAddress}
              value={address}
              placeholder="Enter address"
              placeholderTextColor="#adb5bd"
              keyboardType="default"
              autoCapitalize="words"
              textContentType="addressCity" // iOS specific (best fit)
              autoComplete="postal-address-locality" // Android specific (best fit)
            />
          </View>

          <View style={[styles.inputWrapper, { marginTop: 12 }]}>
            <Ionicons
              name="business-outline"
              size={20}
              color={LIGHT_TEXT_COLOR}
              style={styles.locationIcon}
            />
            <TextInput
              style={styles.input}
              onChangeText={setCity}
              value={city}
              placeholder="Enter city"
              placeholderTextColor="#adb5bd"
              keyboardType="default"
              autoCapitalize="words"
              textContentType="addressCity"
              autoComplete="postal-address-locality"
            />
          </View>
        </View>
      </ScrollView>

      {/* Fixed Footer/Button Section */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, isButtonDisabled && styles.disabledButton]}
          onPress={handleNext}
          disabled={isButtonDisabled}
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
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 5,
    backgroundColor: BACKGROUND_COLOR, // Ensure header is white
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
    color: TEXT_COLOR,
    flex: 1, // Pushes back button to the left
    textAlign: "center",
    marginLeft: -40, // Adjust to center the text visually
  },
  progressSection: {
    paddingHorizontal: 5,
  },
  stepText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 5,
  },
  progressBarContainer: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e9ecef",
    overflow: "hidden",
    flexDirection: "row",
  },
  progressBarActive: {
    height: "100%",
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 2,
  },
  progressBarInactive: {
    flex: 1,
    height: "100%",
  },
  contentContainer: {
    flex: 1,
    marginTop: 30,
    paddingHorizontal: 25,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: TEXT_COLOR,
    marginBottom: 40,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    backgroundColor: "#f8f9fa", // Light background for the input field
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    paddingHorizontal: 15,
  },
  locationIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: TEXT_COLOR,
    paddingVertical: 0, // Ensures text is centered vertically
  },

  // --- Footer/Button Styles ---
  footer: {
    padding: 20,
    backgroundColor: BACKGROUND_COLOR,
    marginBottom: 50,
  },
  nextButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  backButton: {
    padding: 15, // Increase this value to make the touch area larger
    marginLeft: -15, // Optional: Offset to visually align the icon with the screen edge
  },
});

export default VenueLocationScreen;
