import React, { useState, useRef, useEffect } from "react";
import {
  Animated as RNAnimated,
  StyleSheet,
  SafeAreaView,
  View,
  TouchableOpacity,
  Text,
  TextInput,
  Platform,
  StatusBar,
  ImageBackground,
  ScrollView,
} from "react-native";
import Reanimated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence } from "react-native-reanimated";


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
  updateSignupDraft,
  deleteSignupDraft,
  getDraftData,
} from "../../../utils/signupDraftManager";
import { triggerTransitionHaptic } from "../../../hooks/useCelebrationHaptics";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";
import AgeConfirmationModal from "../../../components/modals/AgeConfirmationModal";

// --- Design Constants ---
// Removed local constants in favor of theme constants

export default function MemberAgeScreen({ navigation, route }) {
  const {
    email,
    accessToken,
    refreshToken,
    name,
    profile_photo_url,
    dob: initialDob,
    prefill,
    fromCommunitySignup,
  } = route?.params || {};
  const [form, setForm] = useState(
    initialDob ? { dateOfBirth: initialDob } : {},
  );
  const [input, setInput] = useState(
    initialDob
      ? initialDob.replace(/-/g, "").slice(4) +
          initialDob.replace(/-/g, "").slice(0, 4)
      : "",
  );
  const [isFocused, setIsFocused] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [calculatedAge, setCalculatedAge] = useState(0);
  const [formattedBirthDate, setFormattedBirthDate] = useState("");
  const [error, setError] = useState("");

  // Animation values
  const inputScale = useSharedValue(1);
  const buttonScale = useSharedValue(1);

  const animatedInputStyle = useAnimatedStyle(() => ({
    transform: [{ scale: inputScale.value }],
  }));

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Trigger button bounce when validity changes to true (8 digits)
  useEffect(() => {
    if (input.length === 8 && !error) {
      buttonScale.value = withSequence(
        withSpring(1.05, { damping: 10, stiffness: 100 }),
        withSpring(1, { damping: 12, stiffness: 90 })
      );
    }
  }, [input.length, error]);

  // Hydrate from draft if route.params is missing dob
  useEffect(() => {
    const hydrateFromDraft = async () => {
      if (!initialDob) {
        const draftData = await getDraftData();
        if (draftData?.dob) {
          console.log("[MemberAgeScreen] Hydrating from draft");
          setForm({ dateOfBirth: draftData.dob });
          // Format input as MMDDYYYY
          const parts = draftData.dob.split("-");
          if (parts.length === 3) {
            const [year, month, day] = parts;
            setInput(`${month.padStart(2, "0")}${day.padStart(2, "0")}${year}`);
          }
        }
      }
    };
    hydrateFromDraft();
  }, []);

  // Animation Refs (RNAnimated)
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;
  const slideAnim = useRef(new RNAnimated.Value(20)).current;

  useEffect(() => {
    if (error) {
      // Reset values
      fadeAnim.setValue(0);
      slideAnim.setValue(20);

      // Animate In
      RNAnimated.parallel([
        RNAnimated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        RNAnimated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after 5s
      const timer = setTimeout(() => {
        RNAnimated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setError(""));
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleInputChange = (value) => {
    setInput(value);
    if (error) setError("");

    if (value.length === 8) {
      try {
        const year = parseInt(value.slice(4, 8), 10);

        if (Number.isNaN(year) || year < 1900 || year > 2025) {
          throw new Error("Invalid year.");
        }

        const month = parseInt(value.slice(0, 2), 10);

        if (Number.isNaN(month) || month < 1 || month > 12) {
          throw new Error("Invalid month.");
        }

        const day = parseInt(value.slice(2, 4), 10);
        const maxDaysInMonth = new Date(year, month, 0).getDate();

        if (Number.isNaN(day) || day < 1 || day > maxDaysInMonth) {
          throw new Error("Invalid day.");
        }

        setForm({ dateOfBirth: `${year}-${month}-${day}` });
      } catch (_) {
        setError("Enter a valid date");
        setInput("");
      }
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

  const handleNext = async () => {
    triggerTransitionHaptic();
    if (!form.dateOfBirth) {
      setError("Enter a valid date");
      return;
    }

    // Calculate age
    const birthDate = new Date(form.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    // Format birth date: "30 November 2004"
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const formattedDate = `${birthDate.getDate()} ${
      months[birthDate.getMonth()]
    } ${birthDate.getFullYear()}`;

    setCalculatedAge(age);
    setFormattedBirthDate(formattedDate);
    setShowAgeModal(true);
  };

  const onConfirmAge = async () => {
    setShowAgeModal(false);
    // Update client-side draft
    try {
      await updateSignupDraft("MemberAge", { dob: form.dateOfBirth });
      console.log("[MemberAgeScreen] Draft updated with dob");
    } catch (e) {
      console.log("[MemberAgeScreen] Draft update failed:", e.message);
    }

    navigation?.navigate?.("MemberPronouns", {
      email,
      accessToken,
      refreshToken,
      name,
      profile_photo_url,
      dob: form.dateOfBirth,
      prefill,
      fromCommunitySignup,
    });
  };

  const handleBack = () => {
    triggerTransitionHaptic();
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace("MemberProfilePic", {
        email,
        accessToken,
        refreshToken,
        name,
        prefill,
        fromCommunitySignup,
      });
    }
  };

  return (
    <ImageBackground
      source={wave}
      style={styles.backgroundImage}
      imageStyle={{
        opacity: 0.3,
        transform: [{ scaleX: 1 }, { scaleY: -1 }],
      }}
      resizeMode="cover"
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        <SignupHeader
          role="People"
          onBack={handleBack}
          onCancel={() => setShowCancelModal(true)}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.contentContainer}>
            {/* Title */}
            <Reanimated.Text 
              entering={FadeInDown.delay(100).duration(600).springify()}
              style={styles.title}
            >
              Blow out the candles — when's your birthday?
            </Reanimated.Text>
            <Reanimated.Text 
              entering={FadeInDown.delay(200).duration(600).springify()}
              style={styles.subtitle}
            >
              Provide your birth date to complete your profile.
            </Reanimated.Text>

            {/* Input Card */}
            <Reanimated.View 
              entering={FadeInDown.delay(300).duration(600).springify()}
              style={styles.card}
            >
              <BlurView
                intensity={60}
                tint="light"
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.cardContent}>
                <View style={styles.form}>
                  <Reanimated.View style={[styles.input, animatedInputStyle]}>
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus={true}
                      caretHidden={true}
                      keyboardType="number-pad"
                      maxLength={8}
                      onChangeText={handleInputChange}
                      onFocus={() => {
                        setIsFocused(true);
                        inputScale.value = withSpring(1.02);
                      }}
                      onBlur={() => {
                        setIsFocused(false);
                        inputScale.value = withSpring(1);
                      }}
                      returnKeyType="done"
                      style={[
                        styles.inputControl,
                        isFocused && styles.inputControlFocused,
                      ]}
                      value={input}
                    />

                    <View style={styles.inputOverflow}>
                      {"MM/DD/YYYY".split("").map((placeholder, index, arr) => {
                        const countDelimiters = arr
                          .slice(0, index)
                          .filter((char) => char === "/").length;
                        const indexWithoutDelimeter = index - countDelimiters;
                        const current = input[indexWithoutDelimeter];
                        const isSlash = placeholder === "/";

                        return (
                          <View
                            key={index}
                            style={
                              isSlash
                                ? styles.inputCharContainerSlash
                                : styles.inputCharContainer
                            }
                          >
                            {isSlash ? (
                              <Text style={styles.slashText}>/</Text>
                            ) : (
                              <Text
                                style={[
                                  styles.inputChar,
                                  !current && styles.placeholderChar,
                                ]}
                              >
                                {current || placeholder}
                              </Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </Reanimated.View>

                  <Text style={styles.formSubtitle}>
                    Your profile will show your age, not your date of birth.
                  </Text>
                  {error ? (
                    <RNAnimated.Text
                      style={[
                        styles.errorText,
                        {
                          opacity: fadeAnim,
                          transform: [{ translateY: slideAnim }],
                        },
                      ]}
                    >
                      {error}
                    </RNAnimated.Text>
                  ) : null}
                </View>
              </View>
            </Reanimated.View>

            {/* Button Moved Outside */}
            <View
              style={{ width: "100%", alignItems: "flex-end", marginTop: 40 }}
            >
              <Reanimated.View 
                entering={FadeInDown.delay(500).duration(600).springify()}
                style={animatedButtonStyle}
              >
                <TouchableOpacity
                  onPress={handleNext}
                  style={[
                    styles.nextButtonContainer,
                    { minWidth: 160, paddingHorizontal: 32, marginRight: -33 },
                  ]}
                  activeOpacity={0.8}
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
              </Reanimated.View>
            </View>
          </View>
        </ScrollView>

        <AgeConfirmationModal
          visible={showAgeModal}
          age={calculatedAge}
          birthDate={formattedBirthDate}
          onConfirm={onConfirmAge}
          onEdit={() => setShowAgeModal(false)}
        />
        {/* Cancel Confirmation Modal */}
        <CancelSignupModal
          visible={showCancelModal}
          onKeepEditing={() => setShowCancelModal(false)}
          onDiscard={handleCancel}
        />
      </SafeAreaView>
    </ImageBackground>
  );
}

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
  contentContainer: {
    flex: 1,
    marginTop: 40,
  },
  title: {
    fontSize: 34,
    fontFamily: "BasicCommercial-Black",
    color: COLORS.textPrimary,
    marginBottom: 40,
    letterSpacing: -1,
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
    marginBottom: 30,
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
  form: {
    marginBottom: 20,
  },
  input: {
    marginBottom: 30, // Increased spacing
    position: "relative",
    alignItems: "center", // Center the input container
  },
  inputControl: {
    height: 50,
    width: "100%",
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 1,
    color: "transparent",
    borderWidth: 0, // Removed border
    zIndex: 2,
  },
  inputControlFocused: {
    // No specific focus style needed for the invisible input itself
  },
  inputOverflow: {
    backgroundColor: "transparent", // Removed background
    zIndex: 1,
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    bottom: 0,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center", // Center the characters
    alignItems: "center",
    gap: 8, // Add gap between characters
  },
  inputCharContainer: {
    width: 30,
    height: 45,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "#000",
  },
  inputCharContainerSlash: {
    width: 20,
    height: 45,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 0, // No underline for slash
  },
  inputChar: {
    fontSize: 24,
    fontFamily: "Manrope-Medium",
    color: "#000",
    textAlign: "center",
  },
  placeholderChar: {
    color: "#C7C7CC",
  },
  inputCharEmpty: {
    // No placeholder needed for empty lines in this design, or could clearly show empty space
    // But user image implies just the line is visible when empty.
  },
  slashText: {
    fontSize: 24,
    fontFamily: "Manrope-Medium",
    color: "#C7C7CC", // Lighter color for slash
  },
  formSubtitle: {
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 10,
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
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },
  errorText: {
    marginTop: 10,
    color: "rgba(255, 59, 48, 0.8)", // Slightly dimmed red
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    textAlign: "center",
  },
});



