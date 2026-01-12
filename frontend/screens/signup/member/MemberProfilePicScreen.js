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
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons"; // Used for icons
import { useCrop } from "../../../components/MediaCrop";

import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
// Removed local constants in favor of theme constants
const CIRCLE_SIZE = 180; // Diameter of the profile picture circle

import { apiPost } from "../../../api/client";
import { uploadImage } from "../../../api/cloudinary";

const ProfilePictureScreen = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    refreshToken,
    phone,
    name,
    gender,
    pronouns,
    showPronouns,
    dob,
    interests,
    location,
  } = route.params || {};
  const [imageUri, setImageUri] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Instagram-style crop hook for avatar
  const { pickAndCrop } = useCrop();

  const handleAddPhoto = async () => {
    console.log("handleAddPhoto called"); // Debug log
    try {
      // Use Instagram-style crop for 1:1 avatar
      const result = await pickAndCrop("avatar");

      if (result) {
        setImageUri(result.uri);
        console.log("Image selected:", result.uri); // Debug log
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", `Failed to pick image: ${error.message}`);
    }
  };

  const handleNext = async () => {
    try {
      setUploading(true);
      let profileUrl = null;
      if (imageUri) {
        // Upload to Cloudinary and use secure URL
        profileUrl = await uploadImage(imageUri, () => {});
      }

      // DON'T create the member record here - pass all data to username screen
      // Record will be created when username is set (final step)
      navigation.navigate("MemberUsername", {
        userData: {
          name,
          email,
          phone,
          dob,
          gender,
          pronouns,
          showPronouns,
          location,
          interests,
          profile_photo_url: profileUrl || null,
        },
        accessToken,
        refreshToken,
      });
    } catch (e) {
      alert(e.message || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  // Button is disabled while uploading
  const isButtonDisabled = uploading;

  // Note: The progress bar is marked as Step 3/5 in the image.
  const progressPercentage = "60%";

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

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Add your profile picture</Text>
          <Text style={styles.subtitle}>This will be your main photo.</Text>

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
                    color={COLORS.primary}
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
          style={[
            styles.nextButtonContainer,
            isButtonDisabled && styles.disabledButton,
          ]}
          onPress={handleNext}
          disabled={isButtonDisabled}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={COLORS.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nextButton}
          >
            {uploading ? (
              <View style={styles.buttonLoadingContainer}>
                <ActivityIndicator
                  size="small"
                  color={COLORS.textInverted}
                  style={styles.buttonSpinner}
                />
                <Text style={styles.buttonText}>Uploading...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Next</Text>
            )}
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
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: "center",
    marginLeft: -40, // Visual centering adjustment
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
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e9ecef",
    overflow: "hidden",
    flexDirection: "row",
  },
  progressBarActive: {
    height: "100%",
    backgroundColor: COLORS.primary,
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
    alignItems: "center", // Center content horizontally
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
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
    borderColor: COLORS.primary + "80",
    borderStyle: "dashed",
    backgroundColor: COLORS.primary + "10",
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
    color: COLORS.primary,
  },
  imagePlaceholderText: {
    color: COLORS.primary,
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: CIRCLE_SIZE / 2,
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
  buttonLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSpinner: {
    marginRight: 8,
  },
  backButton: {
    padding: 15,
    marginLeft: -15,
  },
});

export default ProfilePictureScreen;
