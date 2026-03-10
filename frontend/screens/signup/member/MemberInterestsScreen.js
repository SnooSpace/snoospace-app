import React, { useState, useEffect, useMemo } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons"; // Used for the back arrow
import { ChevronDown, ChevronRight, X } from "lucide-react-native";

import HapticsService from "../../../services/HapticsService";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import wave from "../../../assets/wave.png";
import {
  INTEREST_CATEGORIES,
  getInterestStyle,
} from "../../profile/member/EditProfileConstants";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";
import { getSignupInterests } from "../../../api/categories";
import {
  updateSignupDraft,
  deleteSignupDraft,
  getDraftData,
} from "../../../utils/signupDraftManager";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";
import SnooLoader from "../../../components/ui/SnooLoader";

// --- Design Constants ---
// Removed local constants in favor of theme constants
// --- Helpers ---
const MIN_SELECTIONS = 3; // Requirement from the design text
const MAX_SELECTIONS = 7; // Maximum selections allowed

const InterestsScreen = ({ navigation, route }) => {
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
    interests: initialInterests,
  } = route.params || {};
  const [selectedInterests, setSelectedInterests] = useState(
    initialInterests || [],
  );
  const [allInterests, setAllInterests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Hydrate from draft if route.params is missing interests
  useEffect(() => {
    const hydrateFromDraft = async () => {
      if ((!initialInterests || initialInterests.length === 0) && !loading) {
        const draftData = await getDraftData();
        if (draftData?.interests && draftData.interests.length > 0) {
          console.log("[MemberInterestsScreen] Hydrating from draft");
          setSelectedInterests(draftData.interests);
        }
      }
    };
    hydrateFromDraft();
  }, [loading]);

  // Fetch interests from API on mount
  useEffect(() => {
    const loadInterests = async () => {
      try {
        const interests = await getSignupInterests();
        // Extract labels from interest objects
        const labels = interests.map((i) => i.label || i);
        setAllInterests(labels);
      } catch (error) {
        console.error("Error loading interests:", error);
        // Fallback to empty array - user will see "no interests available"
        setAllInterests([]);
      } finally {
        setLoading(false);
      }
    };
    loadInterests();
  }, []);

  const [expandedCategory, setExpandedCategory] = useState("LIFESTYLE");

  const handleCancel = async () => {
    await deleteSignupDraft();
    setShowCancelModal(false);
    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: "AuthGate" }],
    });
  };

  const toggleInterest = (interest) => {
    HapticsService.triggerSelection();
    setSelectedInterests((prev) => {
      if (prev.includes(interest)) {
        // Deselect
        return prev.filter((i) => i !== interest);
      } else {
        // Select - but only if we haven't reached the maximum
        if (prev.length < MAX_SELECTIONS) {
          return [...prev, interest];
        }
        return prev; // Don't add if at maximum
      }
    });
  };

  const handleFinish = async () => {
    // Update client-side draft
    try {
      await updateSignupDraft("MemberInterests", {
        interests: selectedInterests,
      });
      console.log("[MemberInterestsScreen] Draft updated");
    } catch (e) {
      console.log("[MemberInterestsScreen] Draft update failed:", e.message);
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
      interests: selectedInterests,
    });
  };

  // Check if the selection requirement is met
  const isButtonDisabled = selectedInterests.length < MIN_SELECTIONS;

  return (
    <ImageBackground
      source={wave}
      style={styles.backgroundImage}
      imageStyle={{
        opacity: 0.3,
        transform: [{ scaleX: 1 }, { scaleY: -1 }], // Different orientation from Location Screen, but no rotation to preserve aspect ratio filling
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
              navigation.replace("MemberLocation", {
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
            <Text style={styles.title}>What gets you out the door?</Text>
            <Text style={styles.subtitle}>
              Select {MIN_SELECTIONS}-{MAX_SELECTIONS} interests to personalize
              your experience.
            </Text>

            <View style={styles.card}>
              <BlurView
                intensity={60}
                tint="light"
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.cardContent}>
                {/* Top Section: Selected Interests */}
                {selectedInterests.length > 0 && (
                  <View style={styles.selectedSection}>
                    <View style={styles.chipsContainer}>
                      {selectedInterests.map((interest) => {
                        const style = getInterestStyle(interest);
                        const Icon = style.icon;
                        return (
                          <TouchableOpacity
                            key={`selected-${interest}`}
                            activeOpacity={0.7}
                            onPress={() => toggleInterest(interest)}
                            style={[
                              styles.vibeChip,
                              { backgroundColor: style.bg, paddingRight: 8 },
                            ]}
                          >
                            <View style={styles.vibeContent}>
                              <Icon
                                size={14}
                                color={style.text}
                                strokeWidth={2.5}
                              />
                              <Text
                                style={[styles.vibeText, { color: style.text }]}
                              >
                                {interest}
                              </Text>
                            </View>
                            <View style={styles.removeIconContainer}>
                              <X size={12} color={style.text} strokeWidth={3} />
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <View style={styles.divider} />
                  </View>
                )}

                {/* Categories */}
                <View style={styles.categoriesContainer}>
                  {loading ? (
                    <SnooLoader size="large" color={COLORS.primary} />
                  ) : allInterests.length === 0 ? (
                    <Text
                      style={[
                        styles.subtitle,
                        { fontFamily: "Manrope-Medium", marginTop: 20 },
                      ]}
                    >
                      No interests available
                    </Text>
                  ) : (
                    Object.keys(INTEREST_CATEGORIES)
                      .filter((key) => key !== "DEFAULT")
                      .map((key) => {
                        const category = INTEREST_CATEGORIES[key];
                        const isExpanded = expandedCategory === key;
                        const Icon = category.icon;

                        // Filter interests for this category
                        const categoryInterests = allInterests.filter(
                          (i) =>
                            !selectedInterests.includes(i) &&
                            category.keywords.some((k) =>
                              i.toLowerCase().includes(k),
                            ),
                        );

                        // Skip rendering category if it has no unselected interests available
                        if (categoryInterests.length === 0) return null;

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
                                  {categoryInterests.map((interest) => (
                                    <TouchableOpacity
                                      key={interest}
                                      onPress={() => toggleInterest(interest)}
                                      style={[
                                        styles.optionChip,
                                        selectedInterests.length >= MAX_SELECTIONS && styles.optionChipDisabled
                                      ]}
                                      disabled={selectedInterests.length >= MAX_SELECTIONS}
                                    >
                                      <Text style={[
                                        styles.optionText,
                                        selectedInterests.length >= MAX_SELECTIONS && styles.optionTextDisabled
                                      ]}>{interest}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })
                  )}
                </View>
              </View>
            </View>

            <View
              style={{ width: "100%", alignItems: "flex-end", marginTop: 40 }}
            >
              <TouchableOpacity
                style={[
                  styles.finishButtonContainer,
                  isButtonDisabled && styles.disabledButton,
                  { minWidth: 160, paddingHorizontal: 32, marginRight: -33 },
                ]}
                onPress={handleFinish}
                disabled={isButtonDisabled}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={COLORS.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.finishButton}
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

  // --- Layout Styles (Categories / Accordion) ---
  selectedSection: {
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
    marginVertical: 16,
  },
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

  // --- Chip Styles (My Vibes Redesign matching EditProfileScreen) ---
  vibeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: BORDER_RADIUS.pill,
    gap: 8,
  },
  vibeContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  vibeText: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
  },
  removeIconContainer: {
    marginLeft: 2,
    opacity: 0.6,
  },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.4)", // Glass style
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: BORDER_RADIUS.pill,
  },
  optionText: {
    fontSize: 15,
    fontFamily: "Manrope-Medium",
    color: COLORS.textPrimary,
  },
  optionChipDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderColor: "rgba(255, 255, 255, 0.3)",
    opacity: 0.5,
  },
  optionTextDisabled: {
    color: COLORS.textSecondary,
  },

  // --- Footer/Button Styles Extracted ---
  finishButtonContainer: {
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
  finishButton: {
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

export default InterestsScreen;
