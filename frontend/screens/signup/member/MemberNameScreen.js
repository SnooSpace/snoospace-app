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
} from "react-native";

import { KeyboardStickyView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
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
    <SafeAreaView style={styles.safeArea}>
      <SignupHeader onCancel={() => setShowCancelModal(true)} />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>What should we call you?</Text>

          {/* Name Input */}
          <TextInput
            style={[styles.input, isFocused && styles.inputFocused]}
            onChangeText={setName}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            value={name}
            placeholder="Enter your name"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="default"
            autoCapitalize="words"
            textContentType="name"
            autoComplete="name"
          />
        </View>
      </ScrollView>

      {/* Fixed Footer/Button Section */}
      <KeyboardStickyView
        offset={{
          closed: 0,
          opened: 0,
        }}
        style={styles.stickyFooter}
      >
        <View style={[styles.footer, { paddingBottom: 70 }]}>
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
      </KeyboardStickyView>

      {/* Cancel Confirmation Modal */}
      <CancelSignupModal
        visible={showCancelModal}
        onKeepEditing={() => setShowCancelModal(false)}
        onDiscard={handleCancel}
      />
    </SafeAreaView>
  );
};

// --- Styles ---

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },
  progressBarContainer: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e9ecef",
    overflow: "hidden",
    flexDirection: "row",
  },
  contentContainer: {
    flex: 1,
    marginTop: 50,
    paddingHorizontal: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    marginBottom: 40,
  },
  input: {
    height: 50,
    backgroundColor: COLORS.inputBackground || "#f8f9fa",
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "#fff",
  },
  footer: {
    padding: 20,
    backgroundColor: COLORS.background,
  },
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
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
  },
  disabledButton: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    fontWeight: "600",
  },
  backButton: {
    padding: 15,
    marginLeft: -15,
  },
});

export default NameInputScreen;
