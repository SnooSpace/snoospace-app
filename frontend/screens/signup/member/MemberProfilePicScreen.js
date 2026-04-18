import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Platform, StatusBar, ScrollView, Image, Alert } from "react-native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming, withRepeat, Easing } from "react-native-reanimated";

import { BlurView } from "expo-blur";
import { ImageBackground } from "react-native";
import { useCrop } from "../../../components/MediaCrop";
import { ArrowDownToLine, Camera } from "lucide-react-native";

import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";
const CIRCLE_SIZE = 180;

import { uploadImage } from "../../../api/cloudinary";
import {
  updateSignupDraft,
  deleteSignupDraft,
  getDraftData,
} from "../../../utils/signupDraftManager";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";
import SnooLoader from "../../../components/ui/SnooLoader";

const ProfilePictureScreen = ({ navigation, route }) => {
  const { email, accessToken, refreshToken, name, prefill, fromCommunitySignup } = route.params || {};
  const [imageUri, setImageUri] = useState(
    route.params?.profile_photo_url || null
  );
  const [isPrefilled, setIsPrefilled] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Animation values (Reanimated)
  const buttonScale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);
  const bounceScale = useSharedValue(0.5);
  const hintOpacity = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const animatedPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const animatedBounceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bounceScale.value }],
  }));

  const animatedHintStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
  }));

  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const HINTS = [
    "Use a clear face photo",
    "No logos or group photos",
    "Good lighting works best",
  ];

  // Instagram-style crop hook for avatar
  const { pickAndCrop } = useCrop();

  // Apply prefill photo from community signup (runs once on mount)
  useEffect(() => {
    if (prefill?.photo && !route.params?.profile_photo_url) {
      console.log("[MemberProfilePicScreen] Applying prefill photo:", prefill.photo);
      setImageUri(prefill.photo);
      setIsPrefilled(true);
    }
  }, []);

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
    bounceScale.value = withSpring(1, { damping: 12, stiffness: 90 });

    // 2. Slow Pulsing Animation Loop
    pulseScale.value = withRepeat(
      withTiming(1.15, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    pulseOpacity.value = withRepeat(
      withTiming(0.2, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    // 3. Rotating Hints Animation
    const hintInterval = setInterval(() => {
      hintOpacity.value = withSequence(
        withTiming(0, { duration: 500 }),
        withTiming(1, { duration: 500 })
      );

      setTimeout(() => {
        setCurrentHintIndex((prev) => (prev + 1) % HINTS.length);
      }, 500);
    }, 4000);

    return () => clearInterval(hintInterval);
  }, []);

  // Trigger button bounce when validity changes
  const isButtonDisabled = !imageUri || uploading;
  useEffect(() => {
    if (!isButtonDisabled) {
      buttonScale.value = withSequence(
        withSpring(1.05, { damping: 10, stiffness: 100 }),
        withSpring(1, { damping: 12, stiffness: 90 })
      );
    }
  }, [isButtonDisabled]);

  const handleAddPhoto = async () => {
    console.log("handleAddPhoto called");
    try {
      const result = await pickAndCrop("avatar");
      if (result) {
        setImageUri(result.uri);
        setIsPrefilled(false); // User replaced prefill with their own pick
        console.log("Image selected:", result.uri);
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
        profileUrl = imageUri; // Already a URL (from resume or prefill)
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
        prefill,
        fromCommunitySignup,
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

    if (fromCommunitySignup) {
      navigation.navigate("Celebration", {
        role: "Community",
        fromCommunitySignup: true,
        createdPeopleProfile: false,
      });
    } else {
      navigation.getParent()?.reset({
        index: 0,
        routes: [{ name: "AuthGate" }],
      });
    }
  };

  return (
    <ImageBackground
      source={require("../../../assets/wave.png")}
      style={styles.backgroundImage}
      imageStyle={{ transform: [{ scaleX: -1 }, { scaleY: -1 }], opacity: 0.3 }}
      resizeMode="cover"
      blurRadius={10}
    >
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
                prefill,
                fromCommunitySignup,
              });
            }
          }}
          onCancel={() => setShowCancelModal(true)}
          role="People"
        />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Animated.Text
            entering={FadeInDown.delay(100).duration(600).springify()}
            style={styles.title}
          >
            Time to be iconic
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(200).duration(600).springify()}
            style={styles.subtitle}
          >
            People are more likely to connect with you when they can see you.
          </Animated.Text>

          <Animated.View
            entering={FadeInDown.delay(300).duration(600).springify()}
            style={styles.card}
          >
            <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
            <View style={styles.cardContent}>
              {/* Animated Profile Picture Upload Area */}
              <Animated.View style={[animatedBounceStyle]}>
            {/* Pulsing Ring Background */}
            <Animated.View
              style={[
                styles.pulsingRing,
                animatedPulseStyle,
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
                    <Camera size={40} color={COLORS.primary} />
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

          {/* Imported Badge */}
          {isPrefilled && (
            <View style={styles.importedBadge}>
              <ArrowDownToLine size={12} color="#0D9488" strokeWidth={2.5} />
              <Text style={styles.importedBadgeText}>Imported from community</Text>
            </View>
          )}

          {/* Rotating Hints */}
          <View style={styles.hintContainer}>
            <Animated.Text
              style={[
                styles.hintText,
                animatedHintStyle,
              ]}
            >
              {HINTS[currentHintIndex]}
            </Animated.Text>
          </View>
        </View>
      </Animated.View>

      {/* Next Button Moved Outside Card */}
      <View style={{ width: "100%", alignItems: "flex-end", marginTop: 40 }}>
        <Animated.View
          entering={FadeInDown.delay(500).duration(600).springify()}
          style={animatedButtonStyle}
        >
          <TouchableOpacity
            style={[
              styles.nextButtonContainer,
              { minWidth: 160, paddingHorizontal: 32, marginRight: -33 },
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
                  <SnooLoader
                    size="small"
                    color={COLORS.textInverted}
                    style={styles.buttonSpinner}
                  />
                  <Text style={[styles.buttonText, { fontFamily: 'Manrope-Medium' }]}>Uploading...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Next</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  </ScrollView>

  {/* Cancel Confirmation Modal */}
      <CancelSignupModal
        visible={showCancelModal}
        onKeepEditing={() => setShowCancelModal(false)}
        onDiscard={handleCancel}
      />
      </SafeAreaView>
    </ImageBackground>
  );
};

// --- Styles ---

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  contentContainer: {
    paddingTop: 30,
    flex: 0,
  },
  title: {
    fontSize: 34,
    fontFamily: 'BasicCommercial-Black',
    color: '#1a2d4a',
    marginBottom: 12,
    letterSpacing: -0.5,
    lineHeight: 42,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 24,
    ...Platform.select({
      ios: { ...SHADOWS.xl, shadowOpacity: 0.1, shadowRadius: 24 },
      android: { elevation: 0 }
    }),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    overflow: 'hidden',
    width: '100%',
  },
  cardContent: {
    padding: 24,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Manrope-Regular',
    color: COLORS.textSecondary,
    marginBottom: 40,
    lineHeight: 24,
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
    borderColor: "#F0F0FF",
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
  uploadContent: {
    alignItems: "center",
  },
  uploadText: {
    marginTop: 8,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
    color: COLORS.primary,
  },
  profileImage: {
    width: "100%",
    height: "100%",
  },

  // --- Imported Badge ---
  importedBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    marginTop: 14,
    backgroundColor: "rgba(13, 148, 136, 0.1)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
    borderWidth: 1,
    borderColor: "rgba(13, 148, 136, 0.25)",
  },
  importedBadgeText: {
    fontSize: 12,
    fontFamily: "Manrope-SemiBold",
    color: "#0D9488",
  },

  // --- Hint Styles ---
  hintContainer: {
    marginTop: 40,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  hintText: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: 'Manrope-Regular',
    textAlign: 'center',
  },

  // --- Footer/Button Styles ---
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
    fontFamily: "Manrope-SemiBold",
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
