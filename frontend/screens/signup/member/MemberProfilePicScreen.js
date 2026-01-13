import React, { useState, useEffect, useRef } from "react";
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
  Animated,
  Easing,
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
import SignupHeader from "../../../components/SignupHeader";
// Removed local constants in favor of theme constants
const CIRCLE_SIZE = 180; // Diameter of the profile picture circle

import { uploadImage } from "../../../api/cloudinary";
import {
  updateSignupDraft,
  deleteSignupDraft,
  getDraftData,
} from "../../../utils/signupDraftManager";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";

const ProfilePictureScreen = ({ navigation, route }) => {
  const { email, accessToken, refreshToken, name } = route.params || {};
  const [imageUri, setImageUri] = useState(
    route.params?.profile_photo_url || null
  );
  const [uploading, setUploading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0.5)).current;
  const hintOpacity = useRef(new Animated.Value(1)).current;

  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const HINTS = [
    "Use a clear face photo",
    "No logos or group photos",
    "Good lighting works best",
  ];

  // Instagram-style crop hook for avatar
  const { pickAndCrop } = useCrop();

  // Hydrate from draft if route.params is missing profile_photo_url
  useEffect(() => {
    const hydrateFromDraft = async () => {
      if (!imageUri && !route.params?.profile_photo_url) {
        const draftData = await getDraftData();
        if (draftData?.profile_photo_url) {
          console.log("[MemberProfilePicScreen] Hydrating from draft");
          setImageUri(draftData.profile_photo_url);
        }
      }
    };
    hydrateFromDraft();
  }, []);

  useEffect(() => {
    // 1. Bounce Animation on Load
    Animated.spring(bounceAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();

    // 2. Slow Pulsing Animation Loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 3. Rotating Hints Animation
    const hintInterval = setInterval(() => {
      Animated.sequence([
        Animated.timing(hintOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(hintOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        setCurrentHintIndex((prev) => (prev + 1) % HINTS.length);
      }, 500); // Change text halfway through fade out/in
    }, 4000);

    return () => clearInterval(hintInterval);
  }, []);

  const handleAddPhoto = async () => {
    console.log("handleAddPhoto called"); // Debug log
    try {
      // Use Instagram-style crop for 1:1 avatar
      // ... (Rest of the function remains same)
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
      if (imageUri && !imageUri.startsWith("http")) {
        // Upload to Cloudinary and use secure URL (only if local file)
        profileUrl = await uploadImage(imageUri, () => {});
      } else {
        profileUrl = imageUri; // Already a URL (from resume)
      }

      // Update client-side draft
      try {
        await updateSignupDraft("MemberProfilePic", {
          profile_photo_url: profileUrl,
        });
        console.log("[MemberProfilePicScreen] Draft updated");
      } catch (e) {
        console.log(
          "[MemberProfilePicScreen] Draft update failed (non-critical):",
          e.message
        );
      }

      // Navigate to Age screen with profile photo URL
      navigation.navigate("MemberAge", {
        email,
        accessToken,
        refreshToken,
        name,
        profile_photo_url: profileUrl || null,
      });
    } catch (e) {
      alert(e.message || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = async () => {
    await deleteSignupDraft();
    setShowCancelModal(false);
    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: "AuthGate" }],
    });
  };

  // Button is disabled if no image or while uploading
  const isButtonDisabled = !imageUri || uploading;

  // Pulse ring scale interpolation
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.6, 0.3, 0],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <SignupHeader
        onBack={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.replace("MemberName", {
              email,
              accessToken,
              refreshToken,
              name,
            });
          }
        }}
        onCancel={() => setShowCancelModal(true)}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Put a face to your profile</Text>
          <Text style={styles.subtitle}>
            People are more likely to connect with you when they can see you.
          </Text>

          {/* Animated Profile Picture Upload Area */}
          <Animated.View
            style={[
              {
                transform: [{ scale: bounceAnim }],
              },
            ]}
          >
            {/* Pulsing Ring Background */}
            <Animated.View
              style={[
                styles.pulsingRing,
                {
                  transform: [{ scale: pulseScale }],
                  opacity: pulseOpacity,
                },
              ]}
            />

            {/* Main Upload Circle */}
            <TouchableOpacity
              style={styles.photoUploadArea}
              onPress={handleAddPhoto}
              activeOpacity={0.9}
            >
              {/* Glow Shadow Container */}
              <View style={styles.glowContainer}>
                {/* Content when no photo is uploaded */}
                {!imageUri && (
                  <View style={styles.uploadContent}>
                    <Ionicons name="camera" size={40} color={COLORS.primary} />
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
          </Animated.View>

          {/* Rotating Hints */}
          <View style={styles.hintContainer}>
            <Animated.Text
              style={[
                styles.hintText,
                {
                  opacity: hintOpacity,
                },
              ]}
            >
              {HINTS[currentHintIndex]}
            </Animated.Text>
          </View>
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
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    flex: 1,
    textAlign: "center",
    marginLeft: -40, // Visual centering adjustment
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
  },
  subtitle: {
    fontSize: 16,
    padding: 20,
    paddingLeft: 25,
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
    backgroundColor: COLORS.background,
    shadowColor: "#6FE7D8",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  glowContainer: {
    width: "100%",
    height: "100%",
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 4,
    borderColor: "#F0F0FF", // Very light colored border
    overflow: "hidden",
  },
  pulsingRing: {
    position: "absolute",
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: "#6FE7D8",
    zIndex: -1,
  },
  dashedCircle: {
    // Deprecated/Removed
  },
  uploadContent: {
    alignItems: "center",
  },
  uploadText: {
    marginTop: 8,
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
  },

  // --- Hint Styles ---
  hintContainer: {
    marginTop: 40,
    height: 30, // Fixed height to prevent layout jumps
    alignItems: "center",
    justifyContent: "center",
  },
  hintText: {
    fontSize: 14,
    color: "#8E8E93", // Subtle gray for "tiny hint" feel
    fontWeight: "500",
    textAlign: "center",
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
});

export default ProfilePictureScreen;
