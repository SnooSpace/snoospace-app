import React, { useState, useEffect } from "react";
import { exitSignupToAuthGate } from "../../../utils/signupNavigation";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
  ImageBackground,
  ScrollView,
} from "react-native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withSequence } from "react-native-reanimated";


import { BlurView } from "expo-blur";
import wave from "../../../assets/wave.png";

import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";
import {
  updateCommunitySignupDraft,
  deleteCommunitySignupDraft,
  getCommunityDraftData,
} from "../../../utils/signupDraftManager";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";

/**
 * Main Screen Component
 */
const CommunityBioScreen = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    refreshToken,
    name,
    logo_url,
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
  const [bioText, setBioText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // States for shared params that need hydration from draft if missing
  const [params, setParams] = useState({
    email,
    accessToken,
    refreshToken,
    name,
    logo_url,
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

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Trigger button bounce when validity changes to true (bioText.trim().length > 0)
  useEffect(() => {
    if (bioText.trim().length > 0) {
      buttonScale.value = withSequence(
        withSpring(1.05, { damping: 10, stiffness: 100 }),
        withSpring(1, { damping: 12, stiffness: 90 })
      );
    }
  }, [bioText.trim().length > 0]);

  // Hydrate from draft
  useEffect(() => {
    const hydrateFromDraft = async () => {
      const draftData = await getCommunityDraftData();
      if (!draftData) return;

      // 1. Hydrate bio
      if (draftData.bio) {
        console.log("[CommunityBioScreen] Hydrating bio from draft");
        setBioText(draftData.bio);
      }

      // 2. Hydrate all shared parameters
      const updatedParams = { ...params };
      let paramChanged = false;

      const keysToHydrate = [
        "email", "accessToken", "refreshToken", "name", "logo_url",
        "community_type", "college_id", "college_name", "college_subtype",
        "club_type", "community_theme", "college_pending", "isStudentCommunity"
      ];

      keysToHydrate.forEach(key => {
        if (!params[key] && draftData[key] !== undefined && draftData[key] !== null) {
          updatedParams[key] = draftData[key];
          paramChanged = true;
        }
      });

      if (paramChanged) {
        console.log("[CommunityBioScreen] Hydrated shared parameters from draft");
        setParams(updatedParams);
      }
    };
    hydrateFromDraft();
  }, []);

  // Build common params to pass forward
  const commonParams = {
    email,
    accessToken,
    refreshToken,
    name,
    logo_url,
    community_type,
    college_id,
    college_name,
    college_subtype,
    club_type,
    community_theme,
    college_pending,
    isStudentCommunity,
  };

  const handleSkip = () => {
    // Student communities skip category AND location screens - go directly to heads
    if (params.isStudentCommunity) {
      navigation.navigate("CollegeHeads", {
        ...params,
        bio: null,
        category: null,
        categories: [],
        location: null,
      });
    } else {
      navigation.navigate("CommunityCategory", {
        ...params,
        bio: null,
      });
    }
  };

  const handleNext = async () => {
    // Save bio to draft
    try {
      await updateCommunitySignupDraft("CommunityBio", { bio: bioText });
      console.log("[CommunityBioScreen] Draft updated with bio");
    } catch (e) {
      console.log(
        "[CommunityBioScreen] Draft update failed (non-critical):",
        e.message,
      );
    }

    // Student communities skip category AND location screens - go directly to heads
    if (params.isStudentCommunity) {
      navigation.navigate("CollegeHeads", {
        ...params,
        bio: bioText,
        category: null,
        categories: [],
        location: null,
      });
    } else {
      navigation.navigate("CommunityCategory", {
        ...params,
        bio: bioText,
      });
    }
  };

  const handleCancel = async () => {
    await deleteCommunitySignupDraft();
    setShowCancelModal(false);
    exitSignupToAuthGate(navigation);
  };

  // 1. Next button is disabled if: text is empty OR text exceeds 500 characters.
  const isButtonDisabled = bioText.length > 500 || bioText.trim().length === 0;

  // 2. Skip button is disabled if: text is NOT empty.
  const isSkipDisabled = bioText.trim().length > 0;

  return (
    <ImageBackground
      source={wave}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.3, transform: [{ scaleX: -1 }, { scaleY: -1 }] }}
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <SignupHeader
          role="Community"
          onBack={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.replace("CommunityLogo", {
                ...params,
              });
            }
          }}
          onCancel={handleSkip}
          cancelText="Add later"
          cancelDisabled={isSkipDisabled}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Content Section */}
          <View style={styles.contentContainer}>
            <Animated.Text 
              entering={FadeInDown.delay(100).duration(600).springify()}
              style={styles.title}
            >
              Tell us about your community...
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
                <TextInput
                  style={[styles.bioInput, isFocused && styles.bioInputFocused]}
                  placeholder="Write a brief description of your community. What is its purpose? Who is it for? (500 characters max)"
                  placeholderTextColor={COLORS.textSecondary}
                  value={bioText}
                  onChangeText={setBioText}
                  multiline={true}
                  textAlignVertical="top"
                  maxLength={500}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                />
                <Text style={styles.charCount}>{bioText.length} / 500</Text>
              </View>
            </Animated.View>

            <View
              style={{
                width: "100%",
                alignItems: "flex-end",
                marginTop: 40,
              }}
            >
              <Animated.View 
                entering={FadeInDown.delay(500).duration(600).springify()}
                style={animatedButtonStyle}
              >
                <TouchableOpacity
                  style={[
                    styles.nextButtonContainer,
                    isButtonDisabled && styles.disabledButton,
                    { minWidth: 160, paddingHorizontal: 32, marginRight: -33 },
                  ]}
                  onPress={handleNext}
                  activeOpacity={0.8}
                  disabled={isButtonDisabled} // Apply disabled prop
                >
                  <LinearGradient
                    colors={COLORS.primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.nextButton}
                  >
                    <Text style={styles.buttonText}>Next</Text>
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

// --- Stylesheet ---
const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // --- Content & Input Styles ---
  contentContainer: {
    marginTop: 40,
    flex: 1,
  },
  title: {
    fontSize: 34,
    fontFamily: "BasicCommercial-Black",
    color: COLORS.textPrimary,
    marginBottom: 40,
    letterSpacing: -1,
  },
  // --- Card Styles ---
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 24,
    ...Platform.select({
      ios: {
        ...SHADOWS.xl,
        shadowOpacity: 0.1,
        shadowRadius: 24,
      },
      android: {
        elevation: 0,
      },
    }),
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    overflow: "hidden",
  },
  cardContent: {
    padding: 24,
  },
  bioInput: {
    fontSize: 16,
    fontFamily: "Manrope-Medium",
    color: COLORS.textPrimary,
    minHeight: 180,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.5)",
    lineHeight: 24,
  },
  bioInputFocused: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  charCount: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: COLORS.textSecondary,
    marginTop: 12,
    textAlign: "right",
  },
  nextButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    shadowColor: "#74adf2",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  disabledButton: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  nextButton: {
    height: 56,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },
});

export default CommunityBioScreen;



