import React, { useState, useEffect } from "react";
import { CommonActions } from "@react-navigation/native";
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

import { Ionicons } from "@expo/vector-icons";

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

const CommunityNameScreen = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    refreshToken,
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
  const [name, setName] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Hydrate from draft if route.params is missing name
  useEffect(() => {
    const hydrateFromDraft = async () => {
      if (!route.params?.name) {
        const draftData = await getCommunityDraftData();
        if (draftData?.name) {
          console.log("[CommunityNameScreen] Hydrating from draft");
          setName(draftData.name);
        }
      }
    };
    hydrateFromDraft();
  }, []);

  const handleNext = async () => {
    // Update client-side draft with name
    try {
      await updateCommunitySignupDraft("CommunityName", { name });
      console.log("[CommunityNameScreen] Draft updated with name");
    } catch (e) {
      console.log(
        "[CommunityNameScreen] Draft update failed (non-critical):",
        e.message
      );
    }

    navigation.navigate("CommunityLogo", {
      email,
      accessToken,
      refreshToken,
      name,
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

  const isButtonDisabled = name.trim().length === 0;

  return (
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
              navigation.replace("CommunityTypeSelect", {
                email,
                accessToken,
                refreshToken,
              });
            }
          }}
          onCancel={() => setShowCancelModal(true)}
        />

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Enter your Community Name</Text>

          {/* Name Input */}
          <TextInput
            style={[styles.input, isFocused && styles.inputFocused]}
            onChangeText={setName}
            value={name}
            placeholder="Enter your name"
            placeholderTextColor={COLORS.textSecondary}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            keyboardType="default"
            autoCapitalize="words"
            textContentType="name"
            autoComplete="name"
          />
        </View>

        {/* 👇 Button moved inside the ScrollView for dynamic positioning 👇 */}
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
      </ScrollView>

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
    paddingBottom: 20,
  },
  header: {
    paddingVertical: 15,
  },
  headerProgress: {
    paddingVertical: 15,
    paddingHorizontal: 5,
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
    marginBottom: 0,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "#fff",
  },
  nextButtonContainer: {
    marginTop: 40,
    marginHorizontal: 5,
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

export default CommunityNameScreen;
