import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  ImageBackground,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
  updateSignupDraft,
  deleteSignupDraft,
  getDraftData,
} from "../../../utils/signupDraftManager";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";

// --- Design Constants ---
// Removed local constants in favor of theme constants

const PhoneNumberInputScreen = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    refreshToken,
    name,
    profile_photo_url,
    dob,
    pronouns,
    showPronouns,
    gender,
    location,
    interests,
    phone: initialPhone,
  } = route.params || {};
  const [phoneNumber, setPhoneNumber] = useState(initialPhone || "");
  const [isFocused, setIsFocused] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Hydrate from draft if route.params is missing phone
  useEffect(() => {
    const hydrateFromDraft = async () => {
      if (!initialPhone) {
        const draftData = await getDraftData();
        if (draftData?.phone) {
          console.log("[MemberPhoneScreen] Hydrating from draft");
          setPhoneNumber(draftData.phone);
        }
      }
    };
    hydrateFromDraft();
  }, []);

  const handleCancel = async () => {
    await deleteSignupDraft();
    setShowCancelModal(false);
    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: "AuthGate" }],
    });
  };

  const handleContinue = async () => {
    // Update client-side draft
    try {
      await updateSignupDraft("MemberPhone", { phone: phoneNumber });
      console.log("[MemberPhoneScreen] Draft updated");
    } catch (e) {
      console.log("[MemberPhoneScreen] Draft update failed:", e.message);
    }

    // Pass all collected data to Username screen for final signup
    navigation.navigate("MemberUsername", {
      userData: {
        email,
        name,
        profile_photo_url,
        dob,
        pronouns,
        showPronouns,
        gender,
        location,
        interests,
        phone: phoneNumber,
      },
      accessToken,
      refreshToken,
    });
  };

  // Function to format the phone number as the user types
  const formatPhoneNumber = (text) => {
    // Remove all non-digit characters
    const digits = text.replace(/\D/g, "");
    setPhoneNumber(digits);
  };

  return (
    <ImageBackground
      source={wave}
      style={styles.backgroundImage}
      imageStyle={{
        opacity: 0.3,
        transform: [{ scaleX: -1 }, { scaleY: 1 }], 
      }}
      resizeMode="cover"
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        <SignupHeader
          role="People"
          onBack={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.replace("MemberInterests", {
                email,
                accessToken,
                refreshToken,
                name,
                profile_photo_url,
                dob,
                pronouns,
                showPronouns,
                gender,
                location,
                interests,
              });
            }
          }}
          onCancel={() => setShowCancelModal(true)}
        />

        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
          >
            {/* Content Section */}
            <View style={styles.contentContainer}>
              <Text style={styles.title}>Drop your digits</Text>
              <Text style={styles.subtitle}>
                Your number is private and never shared.
              </Text>

              <View style={styles.card}>
                <BlurView
                  intensity={60}
                  tint="light"
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.cardContent}>
                  {/* Phone Number Input */}
                  <View
                    style={[
                      styles.phoneInputContainer,
                      isFocused && styles.phoneInputContainerFocused,
                    ]}
                  >
                    {/* Country Code and Flag for India */}
                    <View style={styles.countryCodePill}>
                      <Text style={styles.flagEmoji}>🇮🇳</Text>
                      <Text style={styles.countryCodeText}>+91</Text>
                    </View>

                    {/* Actual Phone Number Input Field */}
                    <TextInput
                      style={styles.inputField}
                      onChangeText={formatPhoneNumber}
                      value={phoneNumber}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                      placeholder="(000) 000-0000"
                      placeholderTextColor={COLORS.textSecondary}
                      keyboardType="phone-pad"
                      textContentType="telephoneNumber"
                      autoComplete="tel"
                      maxLength={10}
                    />
                  </View>
                </View>
              </View>

              {/* Next Button */}
              <View
                style={{ width: "100%", alignItems: "flex-end", marginTop: 40 }}
              >
                <TouchableOpacity
                  style={[
                    styles.nextButtonContainer,
                    phoneNumber.length !== 10 && styles.disabledButton,
                    { minWidth: 160, paddingHorizontal: 32, marginRight: -33 },
                  ]}
                  onPress={handleContinue}
                  disabled={phoneNumber.length !== 10}
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
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

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
  keyboardAvoidingView: {
    flex: 1,
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
  },
  phoneInputContainerFocused: {
    borderColor: "rgba(255, 255, 255, 0.9)", // Subtle premium border
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
  inputField: {
    flex: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "Manrope-Medium",
    color: COLORS.textPrimary,
    backgroundColor: "transparent",
  },
  // --- Footer/Button Styles Extracted ---
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

export default PhoneNumberInputScreen;
