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
  return (
    <View
      style={[styles.inputWrapper, isFocused && styles.inputWrapperFocused]}
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
    </View>
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
    isResumingDraft,
  } = route.params || {};

  const [headName, setHeadName] = useState("");
  const [optionalName1, setOptionalName1] = useState("");
  const [optionalName2, setOptionalName2] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Hydrate from draft
  useEffect(() => {
    const hydrateFromDraft = async () => {
      const draftData = await getCommunityDraftData();
      if (draftData?.heads && draftData.heads.length > 0) {
        console.log("[CommunityHeadNameScreen] Hydrating from draft");
        setHeadName(draftData.heads[0].name || "");
        if (draftData.heads[1]) setOptionalName1(draftData.heads[1].name || "");
        if (draftData.heads[2]) setOptionalName2(draftData.heads[2].name || "");
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

    if (optionalName1.trim()) {
      heads.push({ name: optionalName1.trim(), is_primary: false });
    }

    if (optionalName2.trim()) {
      heads.push({ name: optionalName2.trim(), is_primary: false });
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

    navigation.navigate("CommunitySponsorType", {
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
      imageStyle={{ opacity: 0.3, transform: [{ scaleX: -1, scaleY: 1 }] }}
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <SignupHeader
          role="Communities"
          onBack={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.replace("CommunityPhone", {
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
            <Text style={styles.mainTitle}>Name of community head</Text>

            <View style={styles.card}>
              <BlurView
                intensity={60}
                tint="light"
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.cardContent}>
                {/* Input Fields Group */}
                <View style={styles.inputGroup}>
                  <CustomInput
                    placeholder="Enter name (required)"
                    required
                    value={headName}
                    onChangeText={setHeadName}
                  />
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
                </View>
              </View>
            </View>

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
    borderColor: COLORS.primary,
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
