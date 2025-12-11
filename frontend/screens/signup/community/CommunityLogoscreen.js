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
  ActivityIndicator, // 👈 Imported ActivityIndicator for the spinner
} from "react-native";
import { Ionicons } from "@expo/vector-icons"; 
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
  const { email, accessToken, refreshToken, name } = route.params || {};
  const [imageUri, setImageUri] = useState(null);
  const [isLoading, setIsLoading] = useState(false); // 👈 New state for loading

  const handleAddPhoto = async () => {
    try {
      // Request permission to access media library
      const permissionResult = await requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert(
          "Permission Required",
          "Permission to access camera roll is required!"
        );
        return;
      }

      // Launch image picker
      const result = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio for profile picture
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
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
    
    setIsLoading(true); // 👈 Start loading
    try {
      const secureUrl = await uploadImage(imageUri, () => {});
      
      // Navigate on success
      navigation.navigate("CommunityBio", { 
        email, 
        accessToken, 
        refreshToken,
        name, 
        logo_url: secureUrl
      });
      
    } catch (e) {
      console.error('Image upload failed:', e);
      Alert.alert('Upload failed', e?.message || 'Unable to upload logo. Please try again.');
    } finally {
      setIsLoading(false); // 👈 Stop loading regardless of success/failure
    }
  };

  // Button is disabled if no photo is selected OR if it is loading
  const isButtonDisabled = !imageUri || isLoading;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Section (Back Button) */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
        </View>

        {/* Progress Bar and Step Text */}
        <View style={styles.progressContainer}>
          <Text style={styles.stepText}>Step 2 of 9</Text>
          <ProgressBar progress={22} />
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
          activeOpacity={0.8}
        >
          {/* 👈 Display ActivityIndicator when loading, otherwise display text */}
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Next</Text>
          )}
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
  
  // Adjusted header structure for consistency
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 15,
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 10,
    marginLeft: -10, // Adjust negative margin to align icon
  },
  
  // Consistent Progress Container Styles
  progressContainer: {
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  stepText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 5,
  },

  contentContainer: {
    flex: 1,
    marginTop: 30,
    paddingHorizontal: 25,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: TEXT_COLOR,
    marginBottom: 50, // Increased spacing for better look
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
    borderColor: PRIMARY_COLOR + "80", 
    borderStyle: "dashed",
    backgroundColor: PRIMARY_COLOR + "10", 
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
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: CIRCLE_SIZE / 2,
  },

  // --- Footer/Button Styles (Consistent) ---
  footer: {
    backgroundColor: BACKGROUND_COLOR,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 50,
    borderTopWidth: 0,
  },
  nextButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    height: 60,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700", // Changed from 600 to 700 for better contrast
  },
});

export default CommunityLogoScreen;