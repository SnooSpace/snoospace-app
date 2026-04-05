import React, { useState, useEffect } from "react";
import { exitSignupToAuthGate } from "../../../utils/signupNavigation";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  Alert,
  ImageBackground,
  Image,
  ScrollView,
} from "react-native";
import wave from "../../../assets/wave.png";
import { Camera } from "lucide-react-native";
import { BlurView } from "expo-blur";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  Easing,
} from "react-native-reanimated";
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
  const [imageUri, setImageUri] = useState(route.params?.logo_url || null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // States for shared params that need hydration from draft if missing
  const [params, setParams] = useState({
    email,
    accessToken,
    refreshToken,
    name,
    community_type,
    college_id,
    college_name,
    college_subtype,
    club_type,
    community_theme,
    college_pending,
    isStudentCommunity,
  });

  // Animation values
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
    "A logo makes you recognizable",
    "Keep it simple and bold",
    "Square images work best",
  ];

  // Trigger button bounce when validity changes to true (imageUri)
  useEffect(() => {
    if (imageUri) {
      buttonScale.value = withSequence(
        withSpring(1.05, { damping: 10, stiffness: 100 }),
        withSpring(1, { damping: 12, stiffness: 90 }),
      );
    }
  }, [imageUri]);

  useEffect(() => {
    // 1. Bounce Animation on Load
    bounceScale.value = withSpring(1, { damping: 12, stiffness: 90 });

    // 2. Slow Pulsing Animation Loop
    pulseScale.value = withRepeat(
      withTiming(1.15, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    pulseOpacity.value = withRepeat(
      withTiming(0.2, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );

    // 3. Rotating Hints Animation
    const hintInterval = setInterval(() => {
      hintOpacity.value = withSequence(
        withTiming(0, { duration: 500 }),
        withTiming(1, { duration: 500 }),
      );

      setTimeout(() => {
        setCurrentHintIndex((prev) => (prev + 1) % HINTS.length);
      }, 500);
    }, 4000);

    return () => clearInterval(hintInterval);
  }, []);

  // Update step on mount AND hydrate from draft
  useEffect(() => {
    const initScreen = async () => {
      // Mark that we are now on CommunityLogo step
      try {
        await updateCommunitySignupDraft("CommunityLogo", {});
        console.log("[CommunityLogoScreen] Step set");
      } catch (e) {
        console.log("[CommunityLogoScreen] Step update failed:", e.message);
      }

      const draftData = await getCommunityDraftData();
      if (!draftData) return;

      // 1. Hydrate logo if missing from route
      if (!imageUri && !route.params?.logo_url && draftData.logo_url) {
        console.log("[CommunityLogoScreen] Hydrating logo from draft");
        setImageUri(draftData.logo_url);
      }

      // 2. Hydrate all shared parameters
      const updatedParams = { ...params };
      let paramChanged = false;

      const keysToHydrate = [
        "email", "accessToken", "refreshToken", "name", "community_type",
        "college_id", "college_name", "college_subtype", "club_type",
        "community_theme", "college_pending", "isStudentCommunity"
      ];

      keysToHydrate.forEach(key => {
        if (!params[key] && draftData[key] !== undefined && draftData[key] !== null) {
          updatedParams[key] = draftData[key];
          paramChanged = true;
        }
      });

      if (paramChanged) {
        console.log("[CommunityLogoScreen] Hydrated shared parameters from draft");
        setParams(updatedParams);
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
      let secureUrl;
      if (imageUri && !imageUri.startsWith("http")) {
        // Only upload if it's a local file URI (not already uploaded)
        secureUrl = await uploadImage(imageUri, () => {});
      } else {
        // Already a remote URL (e.g. came back from next screen)
        secureUrl = imageUri;
      }

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
        ...params,
        logo_url: secureUrl,
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
    exitSignupToAuthGate(navigation);
  };

  // Button is disabled if no photo is selected OR if it is loading
  const isButtonDisabled = !imageUri || isLoading;

  return (
    <ImageBackground
      source={wave}
      style={styles.backgroundImage}
      imageStyle={{
        opacity: 0.3,
        transform: [{ scaleX: -1 }, { scaleY: -1 }],
      }}
      resizeMode="cover"
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <SignupHeader
          onBack={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.replace("CommunityName", {
                ...params,
              });
            }
          }}
          onCancel={() => setShowCancelModal(true)}
          role="Community"
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
              Create your Identity
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(200).duration(600).springify()}
              style={styles.subtitle}
            >
              A strong logo helps others identify and trust your community.
            </Animated.Text>

            <Animated.View
              entering={FadeInDown.delay(300).duration(600).springify()}
              style={styles.card}
            >
              <BlurView
                intensity={60}
                tint="light"
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.cardContent}>
                {/* Animated Logo Upload Area */}
                <Animated.View style={[animatedBounceStyle]}>
                  {/* Pulsing Ring Background */}
                  <Animated.View
                    style={[styles.pulsingRing, animatedPulseStyle]}
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
                          <Text style={styles.uploadText}>Add Logo</Text>
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
                  <Animated.Text style={[styles.hintText, animatedHintStyle]}>
                    {HINTS[currentHintIndex]}
                  </Animated.Text>
                </View>
              </View>
            </Animated.View>

            {/* Next Button Moved Outside Card */}
            <View
              style={{ width: "100%", alignItems: "flex-end", marginTop: 40 }}
            >
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
                    {isLoading ? (
                      <View style={styles.buttonLoadingContainer}>
                        <SnooLoader
                          size="small"
                          color={COLORS.textInverted}
                          style={styles.buttonSpinner}
                        />
                        <Text
                          style={[
                            styles.buttonText,
                            { fontFamily: "Manrope-Medium" },
                          ]}
                        >
                          Uploading...
                        </Text>
                      </View>
                    ) : (
                      <Text
                        style={[
                          styles.buttonText,
                          { fontFamily: "Manrope-SemiBold" },
                        ]}
                      >
                        Next
                      </Text>
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
    backgroundColor: "transparent",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  contentContainer: {
    flex: 1,
    paddingTop: 40,
  },
  title: {
    fontSize: 34,
    fontFamily: "BasicCommercial-Black",
    color: "#1a2d4a",
    marginBottom: 40,
    letterSpacing: -1,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 24,
    ...Platform.select({
      ios: { ...SHADOWS.xl, shadowOpacity: 0.1, shadowRadius: 24 },
      android: { elevation: 0 },
    }),
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    overflow: "hidden",
    width: "100%",
  },
  cardContent: {
    padding: 24,
    alignItems: "center",
  },

  subtitle: {
    fontSize: 16,
    fontFamily: "Manrope-Regular",
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
  uploadContent: {
    alignItems: "center",
  },
  uploadText: {
    marginTop: 8,
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
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
    color: "#8E8E93",
    fontFamily: "Manrope-Regular",
    textAlign: "center",
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
  buttonLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSpinner: {
    marginRight: 8,
  },
});

export default CommunityLogoScreen;
