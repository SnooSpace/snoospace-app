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
import ProgressBar from "../../../components/Progressbar";
import { Ionicons } from "@expo/vector-icons";

// --- Design Constants ---
const PRIMARY_COLOR = "#5f27cd";
const TEXT_COLOR = "#1e1e1e";
const LIGHT_TEXT_COLOR = "#6c757d";
const BACKGROUND_COLOR = "#ffffff";

const CommunityNameScreen = ({ navigation, route }) => {
  const { email, accessToken } = route.params || {};
  const [name, setName] = useState("");

  const handleNext = () => {
    navigation.navigate("CommunityLogo", { email, accessToken, name });
  };

  const isButtonDisabled = name.trim().length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Section (Back Button) */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
        </View>

        {/* Header Section (Progress Bar and Step Text) */}
        <View style={styles.headerProgress}>
          <Text style={styles.stepText}>Step 1 of 9</Text>

          {/* Progress Bar Container */}
          <View style={styles.progressBarContainer}>
            <ProgressBar progress={11} />
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Enter your Community Name</Text>

          {/* Name Input */}
          <TextInput
            style={styles.input}
            onChangeText={setName}
            value={name}
            placeholder="Enter your name"
            placeholderTextColor="#adb5bd"
            keyboardType="default"
            autoCapitalize="words"
            textContentType="name"
            autoComplete="name"
          />
        </View>

        {/* 👇 Button moved inside the ScrollView for dynamic positioning 👇 */}
        <TouchableOpacity
          style={[styles.nextButton, isButtonDisabled && styles.disabledButton]}
          onPress={handleNext}
          disabled={isButtonDisabled}
        >
          <Text style={styles.buttonText}>Next</Text>
        </TouchableOpacity>
      </ScrollView>
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
    paddingHorizontal: 20,
    // Add bottom padding to the ScrollView container
    paddingBottom: 20, 
  },
  header: {
    paddingVertical: 15,
  },
  headerProgress: {
    paddingVertical: 15,
    paddingHorizontal: 5, // Match content container's padding
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
  contentContainer: {
    // Removed flex: 1 to allow the button below to flow correctly
    marginTop: 50,
    paddingHorizontal: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: TEXT_COLOR,
    marginBottom: 40,
  },
  input: {
    height: 50,
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ced4da",
    color: TEXT_COLOR,
    marginBottom: 0, // Ensure no unexpected margin here
  },
  // 👇 Next button styles adapted for flow positioning 👇
  nextButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    // Added margin to position it after the input content
    marginTop: 40, 
    marginHorizontal: 5, // Match content padding
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
    padding: 15,
    marginLeft: -15,
  },
});

export default CommunityNameScreen;