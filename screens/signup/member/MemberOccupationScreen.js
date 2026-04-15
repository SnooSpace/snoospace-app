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
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from "react-native-reanimated";
import { ChevronDown, ChevronRight, Check } from "lucide-react-native";

import { triggerChipSelectHaptic, triggerInputValidHaptic } from "../../../hooks/useCelebrationHaptics";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import wave from "../../../assets/wave.png";
import { OCCUPATION_CATEGORIES, getOccupationLabel, getOccupationCategory } from "../../../constants/OccupationConstants";
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

const OccupationScreen = ({ navigation, route }) => {
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
    occupation: initialOccupation,
    prefill,
    fromCommunitySignup,
  } = route.params || {};

  const [selectedOccupation, setSelectedOccupation] = useState(initialOccupation || null);
  const [customOccupation, setCustomOccupation] = useState("");
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // If initial occupation is a custom one (starts with "other:"), extract the text
  useEffect(() => {
    if (initialOccupation && initialOccupation.startsWith("other:")) {
      setSelectedOccupation("other");
      setCustomOccupation(initialOccupation.substring(6));
    }
  }, []);

  // Animation values
  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Trigger button bounce when an occupation is selected
  useEffect(() => {
    if (selectedOccupation !== null) {
      triggerInputValidHaptic();
      buttonScale.value = withSequence(
        withSpring(1.05, { damping: 10, stiffness: 100 }),
        withSpring(1, { damping: 12, stiffness: 90 })
      );
    }
  }, [selectedOccupation]);

  // Hydrate from draft if route.params is missing occupation
  useEffect(() => {
    const hydrateFromDraft = async () => {
      if (!initialOccupation) {
        const draftData = await getDraftData();
        if (draftData?.occupation) {
          console.log("[MemberOccupationScreen] Hydrating from draft");
          setSelectedOccupation(draftData.occupation);
        }
      }
    };
    hydrateFromDraft();
  }, []);

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

  const selectOccupation = (value) => {
    triggerChipSelectHaptic();
    // Toggle off if tapping the already-selected one
    if (selectedOccupation === value) {
      setSelectedOccupation(null);
      if (value === "other") setCustomOccupation("");
    } else {
      setSelectedOccupation(value);
      // Clear custom text when switching away from "other"
      if (value !== "other") setCustomOccupation("");
    }
  };

  const handleNext = async () => {
    // Determine final occupation value
    const finalOccupation = selectedOccupation === "other"
      ? `other:${customOccupation.trim()}`
      : selectedOccupation;

    // Update client-side draft
    try {
      await updateSignupDraft("MemberOccupation", {
        occupation: finalOccupation,
      });
      console.log("[MemberOccupationScreen] Draft updated");
    } catch (e) {
      console.log("[MemberOccupationScreen] Draft update failed:", e.message);
    }

    navigation.navigate("MemberPhone", {
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
      occupation: finalOccupation,
      prefill,
      fromCommunitySignup,
    });
  };

  const isButtonDisabled = selectedOccupation === null || 
    (selectedOccupation === "other" && customOccupation.trim().length < 2);

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
              What keeps you busy?
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(200).duration(600).springify()}
              style={styles.subtitle}
            >
              Pick what best describes you right now.
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
                {/* Selected Occupation Display */}
                {selectedOccupation && (
                  <View style={styles.selectedSection}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => selectOccupation(selectedOccupation)}
                      style={[
                        styles.selectedChip,
                        {
                          backgroundColor: getOccupationCategory(selectedOccupation).bg,
                        },
                      ]}
                    >
                      <View style={styles.selectedChipContent}>
                        <Check
                          size={14}
                          color={getOccupationCategory(selectedOccupation).text}
                          strokeWidth={2.5}
                        />
                        <Text
                          style={[
                            styles.selectedChipText,
                            { color: getOccupationCategory(selectedOccupation).text },
                          ]}
                        >
                          {selectedOccupation === "other"
                            ? (customOccupation.trim() || "Other")
                            : getOccupationLabel(selectedOccupation)}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Free-text input when "Other" is selected */}
                    {selectedOccupation === "other" && (
                      <View style={styles.customInputContainer}>
                        <TextInput
                          style={styles.customInput}
                          value={customOccupation}
                          onChangeText={setCustomOccupation}
                          placeholder="Type your occupation..."
                          placeholderTextColor={COLORS.textSecondary}
                          maxLength={50}
                          autoFocus={true}
                          autoCapitalize="words"
                          returnKeyType="done"
                        />
                      </View>
                    )}

                    <View style={styles.divider} />
                  </View>
                )}

                {/* Categories Accordion */}
                <View style={styles.categoriesContainer}>
                  {Object.keys(OCCUPATION_CATEGORIES).map((key) => {
                    const category = OCCUPATION_CATEGORIES[key];
                    const isExpanded = expandedCategory === key;
                    const Icon = category.icon;

                    // Filter out the currently selected occupation from this category's list
                    const availableOccupations = category.occupations.filter(
                      (occ) => occ.value !== selectedOccupation
                    );

                    // Skip rendering category if all its occupations are selected (only 1 can be selected, so skip if it has none left)
                    if (availableOccupations.length === 0) return null;

                    return (
                      <View key={key} style={styles.categoryRow}>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => {
                            setExpandedCategory(isExpanded ? null : key);
                          }}
                          style={[
                            styles.categoryHeader,
                            isExpanded && styles.categoryHeaderExpanded,
                            {
                              backgroundColor: isExpanded
                                ? category.bg
                                : "transparent",
                            },
                          ]}
                        >
                          <View style={styles.categoryHeaderLeft}>
                            <View
                              style={[
                                styles.categoryIcon,
                                { backgroundColor: category.bg },
                              ]}
                            >
                              <Icon size={14} color={category.text} />
                            </View>
                            <Text
                              style={[
                                styles.categoryTitle,
                                isExpanded && {
                                  color: category.text,
                                  fontWeight: "600",
                                },
                              ]}
                            >
                              {category.label}
                            </Text>
                          </View>
                          {isExpanded ? (
                            <ChevronDown size={16} color={COLORS.textSecondary} />
                          ) : (
                            <ChevronRight size={16} color={COLORS.textSecondary} />
                          )}
                        </TouchableOpacity>

                        {isExpanded && (
                          <View style={styles.categoryContent}>
                            <View style={styles.chipsContainer}>
                              {availableOccupations.map((occ) => (
                                <TouchableOpacity
                                  key={occ.value}
                                  onPress={() => selectOccupation(occ.value)}
                                  style={styles.optionChip}
                                >
                                  <Text style={styles.optionText}>
                                    {occ.label}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
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
    fontSize: 16,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
    marginBottom: 20,
    lineHeight: 24,
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

  // --- Selected Section ---
  selectedSection: {
    marginBottom: 16,
  },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: BORDER_RADIUS.pill,
    alignSelf: "flex-start",
  },
  selectedChipContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  selectedChipText: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
    marginVertical: 16,
  },

  // --- Categories Accordion ---
  categoriesContainer: {
    marginTop: 8,
  },
  categoryRow: {
    marginBottom: 8,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  categoryHeaderExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  categoryHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryTitle: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: COLORS.textPrimary,
  },
  categoryContent: {
    padding: 16,
    backgroundColor: "transparent",
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: BORDER_RADIUS.pill,
  },
  optionText: {
    fontSize: 15,
    fontFamily: "Manrope-Medium",
    color: COLORS.textPrimary,
  },

  // --- Custom "Other" Input ---
  customInputContainer: {
    marginTop: 12,
  },
  customInput: {
    height: 48,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "Manrope-Medium",
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.7)",
  },

  // --- Footer/Button Styles ---
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

export default OccupationScreen;



