import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  ScrollView,
  StatusBar,
  ImageBackground,
} from "react-native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withSequence } from "react-native-reanimated";

import { BlurView } from "expo-blur";
import { User, ArrowDownToLine } from "lucide-react-native";

import { KeyboardStickyView } from "react-native-keyboard-controller";
import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import {
  updateSignupDraft,
  deleteSignupDraft,
  getDraftData,
} from "../../../utils/signupDraftManager";
import { triggerTransitionHaptic } from "../../../hooks/useCelebrationHaptics";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";
import SignupHeader from "../../../components/SignupHeader";

// --- Design Constants ---
// Removed local constants in favor of theme constants

const NameInputScreen = ({ navigation, route }) => {
  const { email, accessToken, refreshToken, isResumingDraft, prefill, fromCommunitySignup } =
    route.params || {};
  // If resuming a People-profile draft, restore prefill from draft data too
  const [name, setName] = useState(route.params?.name || prefill?.name || "");
  const [isPrefilled, setIsPrefilled] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Apply prefill from community signup
  useEffect(() => {
    if (prefill?.name && !route.params?.name) {
      console.log("[MemberNameScreen] Applying prefill name:", prefill.name);
      setName(prefill.name);
      setIsPrefilled(true);
    }
  }, []);

  // Hydrate from draft if route.params is missing name
  useEffect(() => {
    const hydrateFromDraft = async () => {
      if (!route.params?.name && !prefill?.name) {
        const draftData = await getDraftData();
        if (draftData?.name) {
          console.log("[MemberNameScreen] Hydrating from draft");
          setName(draftData.name);
        }
      }
    };
    hydrateFromDraft();
  }, []);

  const handleNext = async () => {
    triggerTransitionHaptic();
    if (!name.trim()) {
      // If name is empty, do not proceed.
      // This might be handled by the disabled button, but good to have a fallback.
      return;
    }
    // Update client-side draft with name
    try {
      await updateSignupDraft("MemberName", { name });
      console.log("[MemberNameScreen] Draft updated with name");
    } catch (e) {
      console.log(
        "[MemberNameScreen] Draft update failed (non-critical):",
        e.message,
      );
    }

    navigation.navigate("MemberProfilePic", {
      email,
      accessToken,
      refreshToken,
      name,
      prefill,
      fromCommunitySignup,
    });
  };

  /**
   * Cancel the People / Member signup.
   * • fromCommunitySignup: true  → user is already in their community account.
   *   Delete the draft and return to CommunityHome, not AuthGate.
   * • Normal flow → reset to AuthGate as before.
   */
  const handleCancel = async () => {
    await deleteSignupDraft();
    setShowCancelModal(false);

    if (fromCommunitySignup) {
      // Show celebrations screen instead of just resetting to community home
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

  /**
   * Back arrow on the first step of People-profile creation.
   * Goes back to PeopleProfilePromptScreen and deletes the draft so that
   * LandingScreen won't show a stale draft recovery modal.
   */
  const handleBack = async () => {
    await deleteSignupDraft();
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // Fallback: Show celebrations screen instead of just resetting to community home
      navigation.navigate("Celebration", {
        role: "Community",
        fromCommunitySignup: true,
        createdPeopleProfile: false,
      });
    }
  };

  // Determine if the button should be disabled (e.g., if the name is empty)
  const isButtonDisabled = name.trim().length === 0;

  // Animation values
  const inputScale = useSharedValue(1);
  const buttonScale = useSharedValue(1);

  const animatedInputStyle = useAnimatedStyle(() => ({
    transform: [{ scale: inputScale.value }],
  }));

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Trigger button bounce when validity changes to true
  useEffect(() => {
    if (!isButtonDisabled) {
      buttonScale.value = withSequence(
        withSpring(1.05, { damping: 10, stiffness: 100 }),
        withSpring(1, { damping: 12, stiffness: 90 })
      );
    }
  }, [isButtonDisabled]);

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
          onBack={fromCommunitySignup ? handleBack : undefined}
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
              What's the name behind the profile?
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
                <Animated.View style={animatedInputStyle}>
                  <View style={[styles.inputContainer, isFocused && styles.inputFocusedContainer]}>
                    <User size={20} color="#8AADC4" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      onChangeText={(text) => { setName(text); }}
                      onFocus={() => {
                        setIsFocused(true);
                        inputScale.value = withSpring(1.02);
                      }}
                      onBlur={() => {
                        setIsFocused(false);
                        inputScale.value = withSpring(1);
                      }}
                      value={name}
                      placeholder="Enter your name"
                      placeholderTextColor="#8AADC4"
                      keyboardType="default"
                      autoCapitalize="words"
                      textContentType="name"
                      autoComplete="name"
                      importantForAutofill="no"
                    />
                  </View>
                </Animated.View>
                {/* Imported badge */}
                {isPrefilled && (
                  <View style={styles.importedBadge}>
                    <ArrowDownToLine size={12} color="#0D9488" strokeWidth={2.5} />
                    <Text style={styles.importedBadgeText}>Imported from community</Text>
                  </View>
                )}
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
                    <Text style={[styles.buttonText, { fontFamily: 'Manrope-SemiBold' }]}>Next</Text>
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
    marginTop: 40,
  },
  title: {
    fontSize: 34,
    fontFamily: "BasicCommercial-Black",
    color: COLORS.textPrimary,
    marginBottom: 40,
    letterSpacing: -0.5,
    lineHeight: 42,
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
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F2F5",
    borderColor: "transparent", // Premium greyish background
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 0,
    borderWidth: 1,
  },
  inputFocusedContainer: {
    borderColor: "rgba(255, 255, 255, 0.9)",
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  inputIcon: {
    marginRight: 12,
  },
  importedBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "rgba(13, 148, 136, 0.1)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
    borderWidth: 1,
    borderColor: "rgba(13, 148, 136, 0.25)",
  },
  importedBadgeText: {
    fontSize: 12,
    fontFamily: "Manrope-SemiBold",
    color: "#0D9488",
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Manrope-Medium",
    color: COLORS.textPrimary,
  },
  nextButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    shadowColor: "#74adf2",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButton: {
    height: 56,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.5,
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 16,
    fontFamily: "Manrope-Bold",
  },
});

export default NameInputScreen;



