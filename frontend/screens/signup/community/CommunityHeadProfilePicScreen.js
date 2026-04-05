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
import { Camera, X } from "lucide-react-native";
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
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";

const CIRCLE_SIZE = 180;

import { uploadImage } from "../../../api/cloudinary";
import {
  updateCommunitySignupDraft,
  deleteCommunitySignupDraft,
  getCommunityDraftData,
} from "../../../utils/signupDraftManager";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";
import SnooLoader from "../../../components/ui/SnooLoader";

const CommunityHeadProfilePicScreen = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    refreshToken,
    name,
    logo_url,
    bio,
    category,
    categories,
    location,
    phone,
    secondary_phone,
    heads,
    head_photo_url: existingHeadPhoto,
    community_type,
    college_id,
    college_name,
    college_subtype,
    club_type,
    community_theme,
    college_pending,
    isStudentCommunity,
    sponsor_types,
  } = route.params || {};

  // States for shared params that need hydration from draft if missing
  const [params, setParams] = useState({
    email,
    accessToken,
    refreshToken,
    name,
    logo_url,
    bio,
    category,
    categories,
    location,
    phone,
    secondary_phone,
    heads,
    community_type,
    college_id,
    college_name,
    college_subtype,
    club_type,
    community_theme,
    college_pending,
    isStudentCommunity,
    sponsor_types,
  });

  const isIndividual = params.community_type === "individual_organizer";

  const [imageUri, setImageUri] = useState(existingHeadPhoto || null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);



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
    "Use a clear face photo",
    "Builds trust with your members",
    "Good lighting works best",
  ];

  useEffect(() => {
    if (imageUri) {
      buttonScale.value = withSequence(
        withSpring(1.05, { damping: 10, stiffness: 100 }),
        withSpring(1, { damping: 12, stiffness: 90 })
      );
    }
  }, [imageUri]);

  useEffect(() => {
    bounceScale.value = withSpring(1, { damping: 12, stiffness: 90 });

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

  // Update step on mount and hydrate from draft
  useEffect(() => {
    const initScreen = async () => {
      // Mark step
      try {
        await updateCommunitySignupDraft("CommunityHeadProfilePic", {});
        console.log("[CommunityHeadProfilePicScreen] Step set");
      } catch (e) {
        console.log("[CommunityHeadProfilePicScreen] Step update failed:", e.message);
      }

      const draftData = await getCommunityDraftData();
      if (!draftData) return;

      // 1. Hydrate photo
      if (!imageUri && !existingHeadPhoto && draftData.head_photo_url) {
        console.log("[CommunityHeadProfilePicScreen] Hydrating photo from draft");
        setImageUri(draftData.head_photo_url);
      }

      // 2. Hydrate all shared parameters
      const updatedParams = { ...params };
      let paramChanged = false;

      const keysToHydrate = [
        "email", "accessToken", "refreshToken", "name", "logo_url", "bio",
        "category", "categories", "location", "phone", "secondary_phone", "heads",
        "community_type", "college_id", "college_name", "college_subtype",
        "club_type", "community_theme", "college_pending", "isStudentCommunity",
        "sponsor_types"
      ];

      keysToHydrate.forEach(key => {
        if (!params[key] && draftData[key] !== undefined && draftData[key] !== null) {
          updatedParams[key] = draftData[key];
          paramChanged = true;
        }
      });

      if (paramChanged) {
        console.log("[CommunityHeadProfilePicScreen] Hydrated shared parameters from draft");
        setParams(updatedParams);
      }
    };
    initScreen();
  }, []);

  const { pickAndCrop } = useCrop();

  const handleAddPhoto = async () => {
    try {
      const result = await pickAndCrop("avatar");
      if (result) {
        setImageUri(result.uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", `Failed to pick image: ${error.message}`);
    }
  };

  const navigateNext = (headPhotoUrl) => {
    navigation.navigate("CommunityPhone", {
      ...params,
      head_photo_url: headPhotoUrl,
    });
  };

  const handleNext = async () => {
    if (!imageUri) return;

    setIsLoading(true);
    try {
      let secureUrl;
      if (imageUri && !imageUri.startsWith("http")) {
        // Only upload if it's a local file URI (not already uploaded)
        secureUrl = await uploadImage(imageUri, () => {});
      } else {
        // Already a remote URL (e.g. came back from next screen or resumed from draft)
        secureUrl = imageUri;
      }

      try {
        await updateCommunitySignupDraft("CommunityHeadProfilePic", {
          head_photo_url: secureUrl,
        });
        console.log("[CommunityHeadProfilePicScreen] Draft updated");
      } catch (e) {
        console.log("[CommunityHeadProfilePicScreen] Draft update failed:", e.message);
      }

      navigateNext(secureUrl);
    } catch (e) {
      console.error("Image upload failed:", e);
      Alert.alert("Upload failed", e?.message || "Unable to upload photo. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    await deleteCommunitySignupDraft();
    setShowCancelModal(false);
    exitSignupToAuthGate(navigation);
  };

  return (
    <ImageBackground
      source={wave}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.3, transform: [{ scaleX: -1 }, { scaleY: -1 }] }}
      resizeMode="cover"
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        <SignupHeader
          onBack={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.replace("CommunityHeadName", {
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
          <View style={styles.contentContainer}>
            <Animated.Text
              entering={FadeInDown.delay(100).duration(600).springify()}
              style={styles.title}
            >
              {isIndividual ? "Add your photo" : "Head's profile photo"}
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(200).duration(600).springify()}
              style={styles.subtitle}
            >
              {isIndividual
                ? "Put a face to your community — members love seeing who's behind it."
                : "Help members recognise the person heading this community."}
            </Animated.Text>

            <Animated.View
              entering={FadeInDown.delay(300).duration(600).springify()}
              style={styles.card}
            >
              <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
              <View style={styles.cardContent}>
                <Animated.View style={[animatedBounceStyle]}>
                  {/* Pulsing Ring */}
                  <Animated.View style={[styles.pulsingRing, animatedPulseStyle]} />

                  {/* Main Upload Circle Container */}
                  <View>
                    <TouchableOpacity
                      style={styles.photoUploadArea}
                      onPress={handleAddPhoto}
                      activeOpacity={0.9}
                    >
                      <View style={styles.glowContainer}>
                        {!imageUri && (
                          <View style={styles.uploadContent}>
                            <Camera size={40} color={COLORS.primary} />
                            <Text style={styles.uploadText}>Add Photo</Text>
                          </View>
                        )}
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
                </Animated.View>

                {/* Rotating Hints */}
                <View style={styles.hintContainer}>
                  <Animated.Text style={[styles.hintText, animatedHintStyle]}>
                    {HINTS[currentHintIndex]}
                  </Animated.Text>
                </View>
              </View>
            </Animated.View>

            {/* Buttons row */}
            <View style={styles.buttonsRow}>
              {/* Next */}
              <Animated.View
                entering={FadeInDown.delay(500).duration(600).springify()}
                style={animatedButtonStyle}
              >
                <TouchableOpacity
                  style={[
                    styles.nextButtonContainer,
                    !imageUri && styles.disabledButton,
                  ]}
                  onPress={handleNext}
                  disabled={isLoading || !imageUri}
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
                        <Text style={[styles.buttonText, { fontFamily: "Manrope-Medium" }]}>
                          Uploading...
                        </Text>
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

        <CancelSignupModal
          visible={showCancelModal}
          onKeepEditing={() => setShowCancelModal(false)}
          onDiscard={handleCancel}
        />
      </SafeAreaView>
    </ImageBackground>
  );
};

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
    marginBottom: 12,
    letterSpacing: -1,
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
    marginBottom: 36,
    lineHeight: 22,
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
    fontFamily: "Manrope-SemiBold",
    color: COLORS.primary,
  },
  profileImage: {
    width: "100%",
    height: "100%",
  },
  hintContainer: {
    marginTop: 32,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  hintText: {
    fontSize: 13,
    color: "#8E8E93",
    fontFamily: "Manrope-Regular",
    textAlign: "center",
  },
  // Buttons
  buttonsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 32,
    gap: 12,
  },
  nextButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
    minWidth: 120,
  },
  nextButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 16,
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

export default CommunityHeadProfilePicScreen;
