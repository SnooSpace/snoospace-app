import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons"; // Used for icons
import {
  launchImageLibraryAsync,
  requestMediaLibraryPermissionsAsync,
  MediaTypeOptions,
} from "expo-image-picker";
import ProgressBar from "../../../components/Progressbar";

// --- Design Constants ---
const PRIMARY_COLOR = "#5f27cd"; // Deep purple for the button and selected elements
const TEXT_COLOR = "#1e1e1e"; // Dark text color
const LIGHT_TEXT_COLOR = "#6c757d"; // Lighter grey for step text
const BACKGROUND_COLOR = "#ffffff"; // White background
const CIRCLE_SIZE = 180; // Diameter of the profile picture circle

import { apiPost } from "../../../api/client";
import { uploadImage } from "../../../api/cloudinary";

const CommunityLogoScreen = ({ navigation, route }) => {
  const { email, accessToken, name } = route.params || {};
  const [imageUri, setImageUri] = useState(null);

  const handleAddPhoto = async () => {
    console.log("handleAddPhoto called"); // Debug log
    try {
      console.log("Requesting permissions..."); // Debug log
      // Request permission to access media library
      const permissionResult = await requestMediaLibraryPermissionsAsync();
      console.log("Permission result:", permissionResult); // Debug log

      if (permissionResult.granted === false) {
        Alert.alert(
          "Permission Required",
          "Permission to access camera roll is required!"
        );
        return;
      }

      console.log("Launching image picker..."); // Debug log
      // Launch image picker
      const result = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio for profile picture
        quality: 0.8,
      });

      console.log("Image picker result:", result); // Debug log
      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        console.log("Image selected:", result.assets[0].uri); // Debug log
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", `Failed to pick image: ${error.message}`);
    }
  };

  const handleNext = async () => {
    if (!imageUri) {
      Alert.alert(
        "Photo Required",
        "Please add a community logo before proceeding.",
        [{ text: "OK" }]
      );
      return;
    }
    try {
      const secureUrl = await uploadImage(imageUri, () => {});
      navigation.navigate("CommunityBio", { 
        email, 
        accessToken, 
        name, 
        logo_url: secureUrl
      });
    } catch (e) {
      Alert.alert('Upload failed', e?.message || 'Unable to upload logo. Please try again.');
    }
  };

  // Button is disabled if no photo is selected
  const isButtonDisabled = !imageUri;

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
          <Text style={styles.stepText}>Step 3 of 7</Text>

          {/* Progress Bar Container */}
          <View style={styles.progressBarContainer}>
            <ProgressBar progress={43} />
          </View>
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Add your Community Logo</Text>

          {/* Profile Picture Upload Area */}
          <TouchableOpacity
            style={styles.photoUploadArea}
            onPress={handleAddPhoto}
            activeOpacity={0.7}
          >
            {/* The Dashed Circle Wrapper */}
            <View style={styles.dashedCircle}>
              {/* Content when no photo is uploaded */}
              {!imageUri && (
                <View style={styles.uploadContent}>
                  <Ionicons
                    name="camera-outline"
                    size={35}
                    color={PRIMARY_COLOR}
                  />
                  <Text style={styles.uploadText}>Add Photo</Text>
                </View>
              )}
              {/* Content when photo IS uploaded */}
              {imageUri && (
                <Image
                  source={{ uri: imageUri }}
                  style={styles.profileImage}
                  resizeMode="cover"
                />
              )}
            </View>
          </TouchableOpacity>
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
  progressBarContainer: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e9ecef",
    overflow: "hidden",
    flexDirection: "row",
  },
  contentContainer: {
    flex: 1,
    marginTop: 30,
    paddingHorizontal: 25,
    alignItems: "center", // Center content horizontally
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: TEXT_COLOR,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 50,
  },
  // --- Photo Upload Area Styles ---
  photoUploadArea: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dashedCircle: {
    width: "100%",
    height: "100%",
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2,
    borderColor: PRIMARY_COLOR + "80", // Slightly transparent purple
    borderStyle: "dashed",
    backgroundColor: PRIMARY_COLOR + "10", // Very light purple background
    alignItems: "center",
    justifyContent: "center",
  },
  uploadContent: {
    alignItems: "center",
  },
  uploadText: {
    marginTop: 5,
    fontSize: 16,
    fontWeight: "600",
    color: PRIMARY_COLOR,
  },
  imagePlaceholderText: {
    color: PRIMARY_COLOR,
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: CIRCLE_SIZE / 2,
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
    padding: 15,
    marginLeft: -15, 
  }
});

export default CommunityLogoScreen;
