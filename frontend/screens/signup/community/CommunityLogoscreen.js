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
  Alert,
  ImageBackground,
  Image,
  ScrollView,
} from "react-native";
import wave from "../../../assets/wave.png";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
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
  const [imageUri, setImageUri] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Animation values
  const buttonScale = useSharedValue(1);
  const uploadAreaScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const animatedUploadAreaStyle = useAnimatedStyle(() => ({
    transform: [{ scale: uploadAreaScale.value }],
  }));

  // Trigger button bounce when validity changes to true (imageUri)
  useEffect(() => {
    if (imageUri) {
      buttonScale.value = withSequence(
        withSpring(1.05, { damping: 10, stiffness: 100 }),
        withSpring(1, { damping: 12, stiffness: 90 })
      );
    }
  }, [imageUri]);

  // Bounce upload area when image is picked
  useEffect(() => {
    if (imageUri) {
      uploadAreaScale.value = withSequence(
        withSpring(1.1, { damping: 10, stiffness: 100 }),
        withSpring(1, { damping: 12, stiffness: 90 })
      );
    }
  }, [imageUri]);

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
          <Animated.Text 
            entering={FadeInDown.delay(100).duration(600).springify()}
            style={styles.title}
          >
            Add your Community Logo
          </Animated.Text>

          <Animated.View 
            entering={FadeInDown.delay(300).duration(600).springify()}
            style={styles.card}
          >
            <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
            <View style={styles.cardContent}>
          {/* Profile Picture Upload Area */}
          <TouchableOpacity
            onPress={handleAddPhoto}
            activeOpacity={0.7}
          >
            {/* The Dashed Circle Wrapper */}
            <Animated.View style={[styles.dashedCircle, animatedUploadAreaStyle]}>
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
            </Animated.View>
          </TouchableOpacity>
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
                  {isLoading ? (
                    <SnooLoader color={COLORS.textInverted} size="small" />
                  ) : (
                    <Text style={[styles.buttonText, { fontFamily: 'Manrope-SemiBold' }]}>Next</Text>
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
    paddingBottom: 40,
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
    paddingTop: 40,
    paddingHorizontal: 25,
    alignItems: "center",
  },
  title: {
    fontSize: 34,
    fontFamily: 'BasicCommercial-Black',
    color: '#1a2d4a',
    marginBottom: 40,
    letterSpacing: -0.5,
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
    fontFamily: 'Manrope-SemiBold',
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







