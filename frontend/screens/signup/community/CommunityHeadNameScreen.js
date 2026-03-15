import React, { useState, useEffect } from "react";
import { CommonActions } from "@react-navigation/native";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
  Platform,
  StatusBar,
  ImageBackground,
} from "react-native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withSequence } from "react-native-reanimated";

import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import wave from "../../../assets/wave.png";
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

const { width } = Dimensions.get("window");

// --- Components ---

/**
 * Custom TextInput Component
 */
/**
 * Custom TextInput Component
 */
const CustomInput = ({
  placeholder,
  required = false,
  value,
  onChangeText,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: inputScale.value }],
  }));

  useEffect(() => {
    inputScale.value = withSpring(isFocused ? 1.02 : 1, {
      damping: 15,
      stiffness: 120,
    });
  }, [isFocused]);

  return (
    <Animated.View
      style={[
        styles.inputWrapper,
        isFocused && styles.inputWrapperFocused,
        animatedStyle,
      ]}
    >
      <TextInput
        style={styles.inputInner}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textSecondary}
        value={value}
        onChangeText={onChangeText}
        aria-label={placeholder}
        accessibilityRole="text"
        autoCapitalize="words"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
    </Animated.View>
  );
};

/**
 * Main Screen Component
 */
const CommunityHeadNameScreen = ({ navigation, route }) => {
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
    // Community type fields — needed for back handler fallback
    community_type,
    college_id,
    college_name,
    college_subtype,
    club_type,
    community_theme,
    college_pending,
    isStudentCommunity,
    isResumingDraft,
    heads: initialHeads,
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
    community_type,
    college_id,
    college_name,
    college_subtype,
    club_type,
    community_theme,
    college_pending,
    isStudentCommunity,
  });

  const [headName, setHeadName] = useState("");
  const [optionalName1, setOptionalName1] = useState("");
  const [optionalName2, setOptionalName2] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Individual organizers show a simplified single-name UI
  const isIndividual = params.community_type === "individual_organizer";

  // Animation values
  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Trigger button bounce when validity changes to true (isButtonDisabled becomes false)
  useEffect(() => {
    if (!isButtonDisabled) {
      buttonScale.value = withSequence(
        withSpring(1.05, { damping: 10, stiffness: 100 }),
        withSpring(1, { damping: 12, stiffness: 90 })
      );
    }
  }, [isButtonDisabled]);

  // Hydrate from draft
  useEffect(() => {
    const hydrateFromDraft = async () => {
      const draftData = await getCommunityDraftData();
      if (!draftData) return;

      // 1. Hydrate heads
      if (draftData.heads && draftData.heads.length > 0) {
        console.log("[CommunityHeadNameScreen] Hydrating heads from draft");
        setHeadName(draftData.heads[0].name || "");
        if (draftData.heads[1]) setOptionalName1(draftData.heads[1].name || "");
        if (draftData.heads[2]) setOptionalName2(draftData.heads[2].name || "");
      }

      // 2. Hydrate all shared parameters
      const updatedParams = { ...params };
      let paramChanged = false;

      const keysToHydrate = [
        "email", "accessToken", "refreshToken", "name", "logo_url", "bio",
        "category", "categories", "location", "phone", "secondary_phone",
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
        console.log("[CommunityHeadNameScreen] Hydrated shared parameters from draft");
        setParams(updatedParams);
      }
    };
    hydrateFromDraft();
  }, []);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleNext = async () => {
    // Basic validation for the required field
    if (!headName.trim()) {
      alert("Community head name is required.");
      return;
    }

    const heads = [{ name: headName.trim(), is_primary: true }];

    // Only add optional heads for non-Individual types
    if (!isIndividual) {
      if (optionalName1.trim()) {
        heads.push({ name: optionalName1.trim(), is_primary: false });
      }
      if (optionalName2.trim()) {
        heads.push({ name: optionalName2.trim(), is_primary: false });
      }
    }

    // Save heads to draft
    try {
      await updateCommunitySignupDraft("CommunityHeadName", { heads });
      console.log("[CommunityHeadNameScreen] Draft updated with heads");
    } catch (e) {
      console.log(
        "[CommunityHeadNameScreen] Draft update failed (non-critical):",
        e.message,
      );
    }

    // Navigate to Head Profile Pic screen (new step between HeadName and Phone)
    navigation.navigate("CommunityHeadProfilePic", {
      ...params,
      heads,
    });
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

  const isButtonDisabled = !headName.trim();

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
              // Resumed from draft - replace with previous screen based on type
              const prevScreen = isIndividual ? "IndividualLocation" : "CommunityLocation";
              navigation.replace(prevScreen, {
                ...params,
              });
            }
          }}
          onCancel={() => setShowCancelModal(true)}
        />

        <ScrollView
          style={styles.contentScrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.contentArea}>
            <Animated.Text 
              entering={FadeInDown.delay(100).duration(600).springify()}
              style={styles.mainTitle}
            >
              {isIndividual ? "Meet the host" : "Name of community head"}
            </Animated.Text>

            <Animated.View 
              entering={FadeInDown.delay(200).duration(600).springify()}
              style={styles.card}
            >
              <BlurView
                intensity={60}
                tint="light"
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.cardContent}>
                {/* Input Fields Group */}
                <View style={styles.inputGroup}>
                  <CustomInput
                    placeholder={isIndividual ? "Enter your name" : "Enter name (required)"}
                    required
                    value={headName}
                    onChangeText={setHeadName}
                  />
                  {/* Additional heads — only for Organization/College */}
                  {!isIndividual && (
                    <>
                      <CustomInput
                        placeholder="Enter name (optional)"
                        value={optionalName1}
                        onChangeText={setOptionalName1}
                      />
                      <CustomInput
                        placeholder="Enter name (optional)"
                        value={optionalName2}
                        onChangeText={setOptionalName2}
                      />
                    </>
                  )}
                </View>
              </View>
            </Animated.View>

            <View
              style={{ width: "100%", alignItems: "flex-end", marginTop: 40 }}
            >
              <Animated.View 
                entering={FadeInDown.delay(400).duration(600).springify()}
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
                  accessibilityRole="button"
                  accessibilityLabel="Next step"
                  disabled={isButtonDisabled}
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
  // --- Content Styles ---
  contentScrollView: {
    flex: 1,
    width: "100%",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 25,
    paddingBottom: 40,
  },
  contentArea: {
    flex: 1,
    paddingTop: 40,
  },
  mainTitle: {
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

  // --- Input Styles ---
  inputGroup: {
    width: "100%",
    gap: 15,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 16,
    paddingHorizontal: 20,
    height: 60,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  inputWrapperFocused: {
    borderColor: "rgba(255, 255, 255, 0.9)",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  inputInner: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Manrope-Medium",
    color: COLORS.textPrimary,
    height: "100%",
  },

  // --- Button Styles Extracted ---
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
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },
});

export default CommunityHeadNameScreen;


