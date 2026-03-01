import React, { useState, useEffect } from "react";
import { CommonActions } from "@react-navigation/native";
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
  Alert, // 👈 Imported  for the spinner
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCrop } from "../../../components/MediaCrop";

import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";

const CIRCLE_SIZE = 180;

import { apiPost } from "../../../api/client";
import { uploadImage } from "../../../api/cloudinary";
import {
  updateCommunitySignupDraft,
  deleteCommunitySignupDraft,
  getCommunityDraftData,
} from "../../../utils/signupDraftManager";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";
import SnooLoader from "../../../components/ui/SnooLoader";

const CommunityLogoScreen = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    refreshToken,
    name,
    // NEW: Community type fields
    community_type,
    college_id,
    college_name,
    college_subtype,
    club_type,
    community_theme,
    college_pending,
    isStudentCommunity,
    isResumingDraft,
  } = route.params || {};
  const [imageUri, setImageUri] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Update step on mount AND hydrate from draft
  useEffect(() => {
    const initScreen = async () => {
      // Mark that we are now on CommunityLogo step (so crash resumes here)
      try {
        await updateCommunitySignupDraft("CommunityLogo", {});
        console.log("[CommunityLogoScreen] Step set to CommunityLogo");
      } catch (e) {
        console.log("[CommunityLogoScreen] Step update failed:", e.message);
      }

      // Hydrate from draft if we have a saved logo
      const draftData = await getCommunityDraftData();
      if (draftData?.logo_url) {
        console.log("[CommunityLogoScreen] Hydrating logo from draft");
        setImageUri(draftData.logo_url);
      }
    };
    initScreen();
  }, []);

  // Instagram-style crop hook for logo
  const { pickAndCrop } = useCrop();

  const handleAddPhoto = async () => {
    try {
      // Use Instagram-style crop for 1:1 avatar/logo
      const result = await pickAndCrop("avatar");

      if (result) {
        setImageUri(result.uri);
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
        [{ text: "OK" }],
      );
      return;
    }

    setIsLoading(true);
    try {
      const secureUrl = await uploadImage(imageUri, () => {});

      // Save logo_url to draft
      try {
        await updateCommunitySignupDraft("CommunityLogo", {
          logo_url: secureUrl,
        });
        console.log("[CommunityLogoScreen] Draft updated with logo_url");
      } catch (e) {
        console.log(
          "[CommunityLogoScreen] Draft update failed (non-critical):",
          e.message,
        );
      }

      // Navigate on success
      navigation.navigate("CommunityBio", {
        email,
        accessToken,
        refreshToken,
        name,
        logo_url: secureUrl,
        // Pass community type fields forward
        community_type,
        college_id,
        college_name,
        college_subtype,
        club_type,
        community_theme,
        college_pending,
        isStudentCommunity,
      });
    } catch (e) {
      console.error("Image upload failed:", e);
      Alert.alert(
        "Upload failed",
        e?.message || "Unable to upload logo. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    await deleteCommunitySignupDraft();
    setShowCancelModal(false);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "AuthGate" }],
      }),
    );
  };

  // Button is disabled if no photo is selected OR if it is loading
  const isButtonDisabled = !imageUri || isLoading;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <SignupHeader
          onBack={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.replace("CommunityName", {
                email,
                accessToken,
                refreshToken,
                community_type,
                college_id,
                college_name,
                college_subtype,
                club_type,
                community_theme,
                college_pending,
                isStudentCommunity,
              });
            }
          }}
          onCancel={() => setShowCancelModal(true)}
        />

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
            {/* 👈 Display ActivityIndicator when loading, otherwise display text */}
            {isLoading ? (
              <SnooLoader color={COLORS.textInverted} size="small" />
            ) : (
              <Text style={[styles.buttonText, { fontFamily: 'Manrope-SemiBold' }]}>Next</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Cancel Confirmation Modal */}
      <CancelSignupModal
        visible={showCancelModal}
        onKeepEditing={() => setShowCancelModal(false)}
        onDiscard={handleCancel}
      />
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

  // Adjusted header structure for consistency
  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 15,
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 10,
    marginLeft: -10,
  },

  // Consistent Progress Container Styles
  progressContainer: {
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
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
    color: COLORS.textPrimary,
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
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: CIRCLE_SIZE / 2,
  },

  // --- Footer/Button Styles (Consistent) ---
  footer: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 50,
    borderTopWidth: 0,
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
    height: 60,
  },
  disabledButton: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    
    fontFamily: "Manrope-SemiBold",
  },
});

export default CommunityLogoScreen;
