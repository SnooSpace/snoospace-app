import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons"; // Used for the back arrow
import ProgressBar from "../../../components/Progressbar";

// --- Design Constants ---
const PRIMARY_COLOR = "#5f27cd"; // Deep purple for the button and selected chips
const TEXT_COLOR = "#1e1e1e"; // Dark text color
const LIGHT_TEXT_COLOR = "#6c757d"; // Lighter grey for subtitle and unselected chips
const BACKGROUND_COLOR = "#ffffff"; // White background
const MIN_SELECTIONS = 3; // Requirement from the design text
const MAX_SELECTIONS = 7; // Maximum selections allowed

// --- Reusable Interest Chip Component ---
const InterestChip = ({ label, isSelected, onPress, isDisabled }) => {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        isSelected ? styles.chipSelected : styles.chipUnselected,
        isDisabled && styles.chipDisabled,
      ]}
      onPress={() => !isDisabled && onPress(label)}
      activeOpacity={isDisabled ? 1 : 0.7}
      disabled={isDisabled}
    >
      <Text
        style={[
          styles.chipText,
          isSelected ? styles.chipTextSelected : styles.chipTextUnselected,
          isDisabled && styles.chipTextDisabled,
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
    "Sports",
    "Music",
    "Technology",
    "Travel",
    "Food & Drink",
    "Art & Culture",
    "Fitness",
    "Gaming",
    "Movies",
    "Books",
    "Fashion",
    "Photography",
    "Outdoors",
    "Volunteering",
    "Networking",
  ];

  const toggleInterest = (interest) => {
    setSelectedInterests((prev) => {
      if (prev.includes(interest)) {
        // Deselect
        return prev.filter((i) => i !== interest);
      } else {
        // Select - but only if we haven't reached the maximum
        if (prev.length < MAX_SELECTIONS) {
          return [...prev, interest];
        }
        return prev; // Don't add if at maximum
      }
    });
  };

  const handleFinish = () => {
    navigation.navigate("MemberLocation", {
      email,
      accessToken,
      phone,
      name,
      gender,
      dob,
      interests: selectedInterests,
    });
  };

  // Check if the selection requirement is met
  const isButtonDisabled = selectedInterests.length < MIN_SELECTIONS;

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
        </View>

        {/* Header Section (Progress Bar and Step Text) */}
        <View style={styles.header}>
          <Text style={styles.stepText}>Step 5 of 7</Text>

          {/* Progress Bar Container */}
          <View style={styles.progressBarContainer}>
            <ProgressBar progress={71} />
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>What are you interested in?</Text>
          <Text style={styles.subtitle}>
            Select {MIN_SELECTIONS}-{MAX_SELECTIONS} interests to personalize
            your experience.
          </Text>

          {/* Interest Chips Container */}
          <View style={styles.chipsContainer}>
            {allInterests.map((interest) => {
              const isSelected = selectedInterests.includes(interest);
              const isDisabled =
                !isSelected && selectedInterests.length >= MAX_SELECTIONS;

              return (
                <InterestChip
                  key={interest}
                  label={interest}
                  isSelected={isSelected}
                  isDisabled={isDisabled}
                  onPress={toggleInterest}
                />
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Fixed Footer/Button Section */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.finishButton,
            isButtonDisabled && styles.disabledButton,
          ]}
          onPress={handleFinish}
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
    paddingBottom: 10,
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
    flex: 1,
    textAlign: "center",
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
    position: "absolute",
    top: 0,
    right: 5,
    fontSize: 14,
    color: TEXT_COLOR,
    fontWeight: "600",
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
  contentContainer: {
    flex: 1,
    marginTop: 30,
    paddingHorizontal: 25,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
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
    flexDirection: "row",
    flexWrap: "wrap",
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
    borderColor: LIGHT_TEXT_COLOR + "80", // Lighter border for unselected
  },
  chipText: {
    fontSize: 16,
    fontWeight: "600",
  },
  chipTextSelected: {
    color: BACKGROUND_COLOR, // White text on purple background
  },
  chipTextUnselected: {
    color: TEXT_COLOR,
  },
  chipDisabled: {
    backgroundColor: "#f8f9fa",
    borderColor: "#e9ecef",
    opacity: 0.5,
  },
  chipTextDisabled: {
    color: LIGHT_TEXT_COLOR,
  },

  // --- Footer/Button Styles ---
  footer: {
    padding: 20,
    backgroundColor: BACKGROUND_COLOR,
    marginBottom: 50,
  },
  finishButton: {
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

export default InterestsScreen;
