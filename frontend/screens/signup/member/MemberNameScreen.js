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
  ScrollView,
  ImageBackground,
} from "react-native";

import { BlurView } from "expo-blur";
import { User } from "lucide-react-native";

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
import CancelSignupModal from "../../../components/modals/CancelSignupModal";
import SignupHeader from "../../../components/SignupHeader";

// --- Design Constants ---
// Removed local constants in favor of theme constants

const NameInputScreen = ({ navigation, route }) => {
  const { email, accessToken, refreshToken, isResumingDraft } =
    route.params || {};
  const [name, setName] = useState(route.params?.name || "");
  const [isFocused, setIsFocused] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Hydrate from draft if route.params is missing name
  useEffect(() => {
    const hydrateFromDraft = async () => {
      if (!route.params?.name) {
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
    // Update client-side draft with name
    try {
      await updateSignupDraft("MemberName", { name });
      console.log("[MemberNameScreen] Draft updated with name");
    } catch (e) {
      console.log(
        "[MemberNameScreen] Draft update failed (non-critical):",
        e.message
      );
    }

    navigation.navigate("MemberProfilePic", {
      email,
      accessToken,
      refreshToken,
      name,
    });
  };

  const handleCancel = async () => {
    await deleteSignupDraft();
    setShowCancelModal(false);
    // Return to home (will use origin account)
    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: "AuthGate" }],
    });
  };

  // Determine if the button should be disabled (e.g., if the name is empty)
  const isButtonDisabled = name.trim().length === 0;

  return (
    <ImageBackground
      source={require("../../../assets/wave.png")}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.3 }}
      resizeMode="cover"
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        <SignupHeader onCancel={() => setShowCancelModal(true)} role="People" />

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Content Section */}
          <View style={styles.contentContainer}>
            <Text style={styles.title}>What should we call you?</Text>

            <View style={styles.card}>
              <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
              <View style={styles.cardContent}>
                <View style={styles.inputContainer}>
                  <User
                    size={20}
                    color="#8AADC4"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    onChangeText={setName}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
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

                <TouchableOpacity
                  style={[
                    styles.nextButtonContainer,
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
                    <Text style={styles.buttonText}>Next</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
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
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 24,
    ...Platform.select({
      ios: {
        ...SHADOWS.xl,
        shadowOpacity: 0.10,
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
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(180, 210, 245, 0.6)",
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Manrope-Medium",
    color: COLORS.textPrimary,
  },
  nextButtonContainer: {
    borderRadius: BORDER_RADIUS.l,
    shadowColor: "#74adf2",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButton: {
    height: 56,
    borderRadius: BORDER_RADIUS.l,
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
