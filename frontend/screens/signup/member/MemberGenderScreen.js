import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  ScrollView,
  ImageBackground,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
import CancelSignupModal from "../../../components/modals/CancelSignupModal";

const RadioOption = ({ label, isSelected, onPress, isLast }) => {
  const isChecked = isSelected === label;
  
  // Animation value
  const liftAnim = React.useRef(new Animated.Value(isChecked ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(liftAnim, {
      toValue: isChecked ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isChecked]);

  const scale = liftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02],
  });

  const translateY = liftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });

  return (
    <Animated.View
      style={[
        { transform: [{ scale }, { translateY }] },
        styles.animatedContainer,
      ]}
    >
      {isChecked && (
        <View style={StyleSheet.absoluteFill}>
          <BlurView
            intensity={60}
            tint="light"
            style={[StyleSheet.absoluteFill, styles.glassBackground]}
          />
          <View style={styles.glassTintLayer} />
        </View>
      )}
      <TouchableOpacity
        style={[
          styles.optionContainer,
          isLast && styles.optionContainerLast,
          isChecked && styles.selectedOptionContent,
        ]}
        onPress={() => onPress(label)}
        activeOpacity={0.7}
      >
        <Text style={styles.optionText}>{label}</Text>

        <View
          style={[styles.radio, isChecked && styles.radioSelected]}
        >
          {isChecked && <View style={styles.radioInner} />}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const GenderSelectionScreen = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    refreshToken,
    name,
    profile_photo_url,
    dob,
    pronouns,
    showPronouns,
    gender: initialGender,
  } = route.params || {};
  const [selectedGender, setSelectedGender] = useState(initialGender || null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Hydrate from draft if route.params is missing gender
  useEffect(() => {
    const hydrateFromDraft = async () => {
      if (!initialGender) {
        const draftData = await getDraftData();
        if (draftData?.gender) {
          console.log("[MemberGenderScreen] Hydrating from draft");
          setSelectedGender(draftData.gender);
        }
      }
    };
    hydrateFromDraft();
  }, []);

  const genderOptions = ["Male", "Female", "Non-binary"];

  const handleCancel = async () => {
    await deleteSignupDraft();
    setShowCancelModal(false);
    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: "AuthGate" }],
    });
  };

  const handleNext = async () => {
    // Update client-side draft
    try {
      await updateSignupDraft("MemberGender", { gender: selectedGender });
      console.log("[MemberGenderScreen] Draft updated");
    } catch (e) {
      console.log("[MemberGenderScreen] Draft update failed:", e.message);
    }

    navigation.navigate("MemberLocation", {
      email,
      accessToken,
      refreshToken,
      name,
      profile_photo_url,
      dob,
      pronouns,
      showPronouns,
      gender: selectedGender,
    });
  };

  // Button is enabled only when an option is selected
  const isButtonDisabled = selectedGender === null;

  return (
    <ImageBackground
      source={wave}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.3, transform: [{ scaleX: 1 }, { scaleY: -1 }] }}
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        <SignupHeader
          role="People"
          onBack={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.replace("MemberPronouns", {
                email,
                accessToken,
                refreshToken,
                name,
                profile_photo_url,
                dob,
                pronouns,
                showPronouns,
              });
            }
          }}
          onCancel={() => setShowCancelModal(true)}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Content Section */}
          <View style={styles.contentContainer}>
            <Text style={styles.title}>Your identity, your way</Text>

            {/* Gender Options */}
            <View style={styles.card}>
              <BlurView
                intensity={60}
                tint="light"
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.cardContent}>
                {genderOptions.map((option, index) => (
                  <RadioOption
                    key={option}
                    label={option}
                    isSelected={selectedGender}
                    onPress={setSelectedGender}
                    isLast={index === genderOptions.length - 1}
                  />
                ))}
              </View>
            </View>

            {/* Next Button */}
            <View
              style={{ width: "100%", alignItems: "flex-end", marginTop: 40 }}
            >
              <TouchableOpacity
                style={[
                  styles.nextButtonContainer,
                  isButtonDisabled && styles.disabledButton,
                  { minWidth: 160, paddingHorizontal: 32, marginRight: -33 },
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
                  <Text style={styles.buttonText}>Next</Text>
                </LinearGradient>
              </TouchableOpacity>
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
    marginBottom: 10,
    letterSpacing: -1,
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

  // --- Radio Option Styles ---
  animatedContainer: {
    marginBottom: 8,
    borderRadius: 16,
  },
  glassBackground: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
  },
  glassTintLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 16,
  },
  optionContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "transparent",
    borderRadius: 16,
  },
  selectedOptionContent: {
    // The visual separation is now handled by the glassBackground BlurView
  },
  optionContainerLast: {
    marginBottom: 0,
  },
  optionText: {
    fontSize: 16,
    fontFamily: "Manrope-Medium",
    color: COLORS.textPrimary,
  },
  radio: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  radioSelected: {
    borderColor: COLORS.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
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

export default GenderSelectionScreen;
