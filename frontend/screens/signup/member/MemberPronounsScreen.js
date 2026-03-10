import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  ImageBackground,
  ScrollView,
} from "react-native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withSequence } from "react-native-reanimated";
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
import HapticsService from "../../../services/HapticsService";
import { fetchPronouns } from "../../../api/members";
import {
  updateSignupDraft,
  deleteSignupDraft,
  getDraftData,
} from "../../../utils/signupDraftManager";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";
import SnooLoader from "../../../components/ui/SnooLoader";

const MAX_SELECTIONS = 4;
const PREFER_NOT_TO_SAY = "Prefer not to say";

// --- Pronoun Row Component ---
const PronounRow = ({ label, isSelected, onPress, disabled }) => {
  return (
    <TouchableOpacity
      style={[styles.pronounRow, disabled && styles.pronounRowDisabled]}
      onPress={() => !disabled && onPress(label)}
      activeOpacity={disabled ? 1 : 0.7}
      disabled={disabled}
    >
      <Text
        style={[styles.pronounText, disabled && styles.pronounTextDisabled]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.checkbox,
          isSelected && styles.checkboxSelected,
          disabled && styles.checkboxDisabled,
        ]}
      >
        {isSelected && (
          <Ionicons name="checkmark" size={16} color={COLORS.textInverted} />
        )}
      </View>
    </TouchableOpacity>
  );
};

const MemberPronounsScreen = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    refreshToken,
    name,
    profile_photo_url,
    dob,
    pronouns: initialPronouns,
    showPronouns: initialShowPronouns,
  } = route.params || {};
  const [selectedPronouns, setSelectedPronouns] = useState(
    initialPronouns || [],
  );
  const [visibleOnProfile, setVisibleOnProfile] = useState(
    initialShowPronouns !== false,
  );
  const [allPronouns, setAllPronouns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Animation values
  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Trigger button bounce when validity changes to true (selected length > 0)
  useEffect(() => {
    if (selectedPronouns.length > 0) {
      buttonScale.value = withSequence(
        withSpring(1.05, { damping: 10, stiffness: 100 }),
        withSpring(1, { damping: 12, stiffness: 90 })
      );
    }
  }, [selectedPronouns.length > 0]);

  // Hydrate from draft if route.params is missing pronouns
  useEffect(() => {
    const hydrateFromDraft = async () => {
      if ((!initialPronouns || initialPronouns.length === 0) && !loading) {
        const draftData = await getDraftData();
        if (draftData?.pronouns && draftData.pronouns.length > 0) {
          console.log("[MemberPronounsScreen] Hydrating from draft");
          setSelectedPronouns(draftData.pronouns);
        }
        if (draftData?.showPronouns !== undefined) {
          setVisibleOnProfile(draftData.showPronouns);
        }
      }
    };
    hydrateFromDraft();
  }, [loading]);

  // Fetch pronouns from API on mount
  useEffect(() => {
    const loadPronouns = async () => {
      try {
        const pronouns = await fetchPronouns();
        // Extract labels from pronoun objects
        const labels = pronouns.map((p) => p.label || p);
        setAllPronouns(labels);
      } catch (error) {
        console.error("Error loading pronouns:", error);
        // Fallback to empty array - user will see "no pronouns available"
        setAllPronouns([]);
      } finally {
        setLoading(false);
      }
    };
    loadPronouns();
  }, []);

  // Check if "Prefer not to say" is selected
  const preferNotToSaySelected = selectedPronouns.includes(PREFER_NOT_TO_SAY);
  // Check if any other pronoun is selected
  const hasOtherPronounSelected = selectedPronouns.some(
    (p) => p !== PREFER_NOT_TO_SAY,
  );

  const togglePronoun = (pronoun) => {
    HapticsService.triggerSelection();
    setSelectedPronouns((prev) => {
      if (prev.includes(pronoun)) {
        // Deselect
        return prev.filter((p) => p !== pronoun);
      } else {
        // If selecting "Prefer not to say", clear all others
        if (pronoun === PREFER_NOT_TO_SAY) {
          return [PREFER_NOT_TO_SAY];
        }
        // If selecting a regular pronoun, remove "Prefer not to say" if present
        const filtered = prev.filter((p) => p !== PREFER_NOT_TO_SAY);
        // Select - but only if we haven't reached the maximum
        if (filtered.length < MAX_SELECTIONS) {
          return [...filtered, pronoun];
        }
        return filtered; // Don't add if at maximum
      }
    });
  };

  // Button is disabled if no pronoun is selected
  const isButtonDisabled = selectedPronouns.length === 0;

  const handleCancel = async () => {
    await deleteSignupDraft();
    setShowCancelModal(false);
    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: "AuthGate" }],
    });
  };

  const handleNext = async () => {
    // Filter out "Prefer not to say" - it should not be stored in the database
    const pronounsToSave = selectedPronouns.filter(
      (p) => p !== PREFER_NOT_TO_SAY,
    );
    // If "Prefer not to say" is selected, force showPronouns to false
    const shouldShowPronouns = preferNotToSaySelected
      ? false
      : visibleOnProfile;

    // Update client-side draft
    try {
      await updateSignupDraft("MemberPronouns", {
        pronouns: pronounsToSave,
        showPronouns: shouldShowPronouns,
      });
      console.log("[MemberPronounsScreen] Draft updated");
    } catch (e) {
      console.log("[MemberPronounsScreen] Draft update failed:", e.message);
    }

    navigation.navigate("MemberGender", {
      email,
      accessToken,
      refreshToken,
      name,
      profile_photo_url,
      dob,
      pronouns: pronounsToSave,
      showPronouns: shouldShowPronouns,
    });
  };

  return (
    <ImageBackground
      source={wave}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.3, transform: [{ scaleX: -1 }, { scaleY: -1 }] }}
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
              navigation.replace("MemberAge", {
                email,
                accessToken,
                refreshToken,
                name,
                profile_photo_url,
                dob,
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
            <Animated.Text 
              entering={FadeInDown.delay(100).duration(600).springify()}
              style={styles.title}
            >
              What pronouns feel like you?
            </Animated.Text>
            <Animated.Text 
              entering={FadeInDown.delay(200).duration(600).springify()}
              style={styles.subtitle}
            >
              Select up to {MAX_SELECTIONS}
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
                {/* Pronouns List */}
                <View style={styles.pronounsList}>
                  {loading ? (
                    <SnooLoader size="large" color={COLORS.primary} />
                  ) : allPronouns.length === 0 ? (
                    <Text
                      style={[
                        styles.subtitle,
                        { fontFamily: "Manrope-Medium" },
                      ]}
                    >
                      No pronouns available
                    </Text>
                  ) : (
                    <>
                      {allPronouns.map((pronoun) => {
                        const isSelected = selectedPronouns.includes(pronoun);
                        const isMaxSelected = selectedPronouns.filter(p => p !== PREFER_NOT_TO_SAY).length >= MAX_SELECTIONS;
                        const isDisabled = (preferNotToSaySelected && pronoun !== PREFER_NOT_TO_SAY) || (!isSelected && isMaxSelected);
                        
                        return (
                          <PronounRow
                            key={pronoun}
                            label={pronoun}
                            isSelected={isSelected}
                            onPress={togglePronoun}
                            disabled={isDisabled}
                          />
                        );
                      })}
                      {/* Prefer not to say option */}
                      <PronounRow
                        key={PREFER_NOT_TO_SAY}
                        label={PREFER_NOT_TO_SAY}
                        isSelected={preferNotToSaySelected}
                        onPress={togglePronoun}
                        disabled={hasOtherPronounSelected}
                      />
                    </>
                  )}
                </View>

                {/* Visible on Profile Toggle */}
                <TouchableOpacity
                  style={[
                    styles.visibilityToggle,
                    preferNotToSaySelected && styles.visibilityToggleDisabled,
                  ]}
                  onPress={() =>
                    !preferNotToSaySelected &&
                    setVisibleOnProfile(!visibleOnProfile)
                  }
                  activeOpacity={preferNotToSaySelected ? 1 : 0.7}
                  disabled={preferNotToSaySelected}
                >
                  <View
                    style={[
                      styles.toggleCheckbox,
                      visibleOnProfile &&
                        !preferNotToSaySelected &&
                        styles.toggleCheckboxSelected,
                      preferNotToSaySelected && styles.checkboxDisabled,
                    ]}
                  >
                    {visibleOnProfile && !preferNotToSaySelected && (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={COLORS.textInverted}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.visibilityText,
                      preferNotToSaySelected && styles.visibilityTextDisabled,
                    ]}
                  >
                    Visible on profile
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* Next Button */}
            <View
              style={{ width: "100%", alignItems: "flex-end", marginTop: 40 }}
            >
              <Animated.View 
                entering={FadeInDown.delay(500).duration(600).springify()}
                style={animatedButtonStyle}
              >
                <TouchableOpacity
                  style={[
                    styles.nextButtonContainer,
                    isButtonDisabled && styles.nextButtonDisabled,
                    { minWidth: 160, paddingHorizontal: 32, marginRight: -33 },
                  ]}
                  onPress={handleNext}
                  activeOpacity={0.8}
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

  // --- Pronouns List Styles ---
  pronounsList: {
    flex: 1,
  },
  pronounRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pronounText: {
    fontSize: 16,
    fontFamily: "Manrope-Medium",
    color: COLORS.textPrimary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pronounRowDisabled: {
    opacity: 0.4,
  },
  pronounTextDisabled: {
    color: COLORS.textSecondary,
  },
  checkboxDisabled: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBackground || "#f0f0f0",
  },

  // --- Footer Styles Removed since it was extracted into content block ---
  visibilityToggle: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
  },
  toggleCheckbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
    marginRight: 12,
  },
  toggleCheckboxSelected: {
    backgroundColor: COLORS.primary,
  },
  visibilityText: {
    fontSize: 15,
    fontFamily: "Manrope-Regular",
    color: COLORS.textPrimary,
  },
  visibilityToggleDisabled: {
    opacity: 0.4,
  },
  visibilityTextDisabled: {
    color: COLORS.textSecondary,
  },
  nextButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    shadowColor: "#74adf2",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButtonDisabled: {
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

export default MemberPronounsScreen;



