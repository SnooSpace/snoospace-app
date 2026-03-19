import React, { useState, useEffect } from "react";
import { CommonActions } from "@react-navigation/native";
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
  Dimensions,
  KeyboardAvoidingView,
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

const { width } = Dimensions.get("window");

// --- Components ---
const PhoneInput = ({ placeholder, isRequired, value, onChangeText }) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputScale = useSharedValue(1);

  const animatedInputStyle = useAnimatedStyle(() => ({
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
        styles.phoneInputContainer,
        isFocused && styles.phoneInputContainerFocused,
        animatedInputStyle,
      ]}
    >
      <View style={styles.countryCodePill}>
        <Text style={styles.flagEmoji}>🇮🇳</Text>
        <Text style={styles.countryCodeText}>+91</Text>
      </View>
      <TextInput
        style={styles.phoneNumberInput}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textSecondary}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        importantForAutofill="yes"
        maxLength={10}
        autoFocus={isRequired}
      />
    </Animated.View>
  );
};

// --- Main Screen Component ---
const CommunityPhoneNoScreen = ({ navigation, route }) => {
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
    community_type,
    college_id,
    college_name,
    college_subtype,
    club_type,
    community_theme,
    college_pending,
    isStudentCommunity,
    isResumingDraft,
    heads,
    head_photo_url,
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
    community_type,
    college_id,
    college_name,
    college_subtype,
    club_type,
    community_theme,
    college_pending,
    isStudentCommunity,
    heads,
    head_photo_url,
    sponsor_types,
  });

  // Individual organizers show a simplified single-number UI
  const isIndividual = params.community_type === "individual_organizer";

  const [primaryNumber, setPrimaryNumber] = useState("");
  const [secondaryNumber, setSecondaryNumber] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);

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

      // 1. Hydrate phone
      if (draftData.phone) {
        console.log("[CommunityPhoneNoScreen] Hydrating phone from draft");
        setPrimaryNumber(draftData.phone);
        if (draftData.secondary_phone) {
          setSecondaryNumber(draftData.secondary_phone);
        }
      }

      // 2. Hydrate all shared parameters
      const updatedParams = { ...params };
      let paramChanged = false;

      const keysToHydrate = [
        "email", "accessToken", "refreshToken", "name", "logo_url", "bio",
        "category", "categories", "location", "community_type", "college_id",
        "college_name", "college_subtype", "club_type", "community_theme",
        "college_pending", "isStudentCommunity", "heads", "head_photo_url",
        "sponsor_types"
      ];

      keysToHydrate.forEach(key => {
        if (!params[key] && draftData[key] !== undefined && draftData[key] !== null) {
          updatedParams[key] = draftData[key];
          paramChanged = true;
        }
      });

      if (paramChanged) {
        console.log("[CommunityPhoneNoScreen] Hydrated shared parameters from draft");
        setParams(updatedParams);
      }
    };
    hydrateFromDraft();
  }, []);

  const handleSkip = () => {
    navigation.navigate("CommunityHeadName", {
      ...params,
      phone: null,
      secondary_phone: null,
    });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleContinue = async () => {
    if (!primaryNumber.trim()) {
      alert("Primary phone number is required.");
      return;
    }

    const phoneDigits = primaryNumber.replace(/\D/g, "");
    if (phoneDigits.length !== 10) {
      alert("Phone number must be exactly 10 digits.");
      return;
    }

    const secondaryPhoneDigits = secondaryNumber.trim()
      ? secondaryNumber.replace(/\D/g, "")
      : null;
    if (secondaryPhoneDigits && secondaryPhoneDigits.length !== 10) {
      alert("Secondary phone number must be exactly 10 digits if provided.");
      return;
    }

    // Save phone to draft
    try {
      await updateCommunitySignupDraft("CommunityPhone", {
        phone: phoneDigits,
        secondary_phone: secondaryPhoneDigits || null,
      });
      console.log("[CommunityPhoneNoScreen] Draft updated with phone");
    } catch (e) {
      console.log(
        "[CommunityPhoneNoScreen] Draft update failed (non-critical):",
        e.message
      );
    }

    // Creators collect sponsor types before location, so they skip it here.
    // College and Creator both go directly to Username; only Organization goes to SponsorType.
    const isCollege = params.community_type === "college_affiliated";
    if (isIndividual || isCollege) {
      navigation.navigate("CommunityUsername", {
        ...params,
        phone: phoneDigits,
        secondary_phone: secondaryPhoneDigits || null,
      });
    } else {
      navigation.navigate("CommunitySponsorType", {
        ...params,
        phone: phoneDigits,
        secondary_phone: secondaryPhoneDigits || null,
      });
    }
  };

  const handleCancel = async () => {
    await deleteCommunitySignupDraft();
    setShowCancelModal(false);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "AuthGate" }],
      })
    );
  };

  const isButtonDisabled = primaryNumber.replace(/\D/g, "").length !== 10;

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
        <SignupHeader
          role="Community"
          onBack={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.replace("CommunityHeadProfilePic", {
                ...params,
              });
            }
          }}
          onCancel={() => setShowCancelModal(true)}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.contentScrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.contentArea}>
              <Animated.Text 
                entering={FadeInDown.delay(100).duration(600).springify()}
                style={styles.mainTitle}
              >
                {isIndividual ? "Your contact number" : "What's your number?"}
              </Animated.Text>
              <Animated.Text 
                entering={FadeInDown.delay(200).duration(600).springify()}
                style={styles.subtitle}
              >
                {isIndividual
                  ? "Members & sponsors can reach you here."
                  : "Your number is private and never shared."}
              </Animated.Text>

              <Animated.View 
                entering={FadeInDown.delay(300).duration(600).springify()}
                style={styles.card}
              >
              <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
              <View style={styles.cardContent}>
                <PhoneInput
                  placeholder="(000) 000-0000"
                  isRequired={true}
                  value={primaryNumber}
                  onChangeText={setPrimaryNumber}
                />

                {/* Secondary number — hidden for Individual organizers */}
                {!isIndividual && (
                  <>
                    <View style={styles.optionalInputSection}>
                      <Text style={styles.optionalInputLabel}>Add another number</Text>
                      <Text style={styles.optionalLabel}>Optional</Text>
                    </View>
                    <PhoneInput
                      placeholder="(000) 000-0000"
                      isRequired={false}
                      value={secondaryNumber}
                      onChangeText={setSecondaryNumber}
                    />
                  </>
                )}
              </View>
            </Animated.View>

            <View style={{ width: "100%", alignItems: "flex-end", marginTop: 40 }}>
              <Animated.View 
                entering={FadeInDown.delay(500).duration(600).springify()}
                style={animatedButtonStyle}
              >
                <TouchableOpacity
                  style={[
                    styles.continueButtonContainer,
                    isButtonDisabled && styles.disabledButton,
                    { minWidth: 160, paddingHorizontal: 32, marginRight: -33 },
                  ]}
                  onPress={handleContinue}
                  activeOpacity={0.8}
                  disabled={isButtonDisabled}
                >
                  <LinearGradient
                    colors={COLORS.primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.continueButton}
                  >
                    <Text style={styles.buttonText}>Next</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
  contentScrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  contentArea: {
    flex: 1,
    marginTop: 40,
  },
  mainTitle: {
    fontSize: 34,
    fontFamily: "BasicCommercial-Black",
    color: COLORS.textPrimary,
    marginBottom: 4,
    letterSpacing: -1,
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
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
  phoneInputContainer: {
    flexDirection: "row",
    height: 56,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
    overflow: "hidden",
    marginBottom: 10,
  },
  phoneInputContainerFocused: {
    borderColor: "rgba(255, 255, 255, 0.9)",
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  countryCodePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "transparent",
    borderRightWidth: 1,
    borderRightColor: "rgba(0,0,0,0.05)",
  },
  flagEmoji: {
    fontSize: 20,
    marginRight: 6,
  },
  countryCodeText: {
    fontSize: 16,
    fontFamily: "Manrope-Medium",
    color: COLORS.textPrimary,
  },
  phoneNumberInput: {
    flex: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "Manrope-Medium",
    color: COLORS.textPrimary,
    backgroundColor: "transparent",
  },
  optionalInputSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  optionalInputLabel: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: COLORS.textPrimary,
  },
  optionalLabel: {
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
    opacity: 0.8,
  },
  continueButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
  },
  continueButton: {
    height: 56,
    borderRadius: BORDER_RADIUS.pill,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    fontFamily: "Manrope-SemiBold",
  },
  disabledButton: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
});

export default CommunityPhoneNoScreen;



