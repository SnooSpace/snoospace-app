import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
  Platform,
  StatusBar,
  Alert,
  ImageBackground,
  Switch,
} from "react-native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withSequence } from "react-native-reanimated";

import { apiPost } from "../../../api/client";
import { getSponsorTypes } from "../../../api/client";
import { BlurView } from "expo-blur";
import wave from "../../../assets/wave.png";
import { LinearGradient } from "expo-linear-gradient";
import { X, ChevronDown, ChevronRight, Zap } from "lucide-react-native";
import { getInterestStyle, INTEREST_CATEGORIES } from "../../profile/member/EditProfileConstants";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";
import { updateCommunitySignupDraft, deleteCommunitySignupDraft } from "../../../utils/signupDraftManager";
import { exitSignupToAuthGate } from "../../../utils/signupNavigation";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";

const { width } = Dimensions.get("window");

// Fallback sponsor types in case API fails
const fallbackSponsorTypes = [
  "Protein brands",
  "Energy Drinks",
  "Supplements",
  "Apparel",
  "Tech Gadgets",
  "Local Businesses",
];

// --- Components ---

/**
 * Main Screen Component
 */
const CommunitySponsorTypeSelect = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    refreshToken,
    name,
    logo_url,
    bio,
    category,
    categories = [],
    location,
    phone,
    secondary_phone,
    heads,
    head_photo_url,
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

  // States for shared params that need hydration from draft if missing
  const [params, setParams] = useState({
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
    head_photo_url,
    community_type,
    college_id,
    college_name,
    college_subtype,
    club_type,
    community_theme,
    college_pending,
    isStudentCommunity,
  });
  const [sponsorTypes, setSponsorTypes] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [isOpenToAll, setIsOpenToAll] = useState(false);
  const [lookingForSponsors, setLookingForSponsors] = useState(true); // NEW: toggle
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Animation values
  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Trigger button bounce when validity changes to true (isButtonDisabled becomes false)
  useEffect(() => {
    if (!isButtonDisabled) {
      buttonScale.value = withSequence(
        withSpring(1.05, { damping: 10, stiffness: 100 }),
        withSpring(1, { damping: 12, stiffness: 90 })
      );
    }
  }, [isButtonDisabled]);

  // Fetch sponsor types from API on mount
  useEffect(() => {
    const loadSponsorTypes = async () => {
      try {
        const types = await getSponsorTypes();
        setSponsorTypes(types.map((t) => t.name));
      } catch (error) {
        console.error("Failed to load sponsor types:", error);
        setSponsorTypes(fallbackSponsorTypes);
      } finally {
        setLoading(false);
      }
    };
    loadSponsorTypes();
    hydrateFromDraft();
  }, []);

  const hydrateFromDraft = async () => {
    const {
      getCommunityDraftData,
    } = require("../../../utils/signupDraftManager");
    const draftData = await getCommunityDraftData();
    if (!draftData) return;

    // 1. Hydrate sponsor types
    if (draftData.sponsor_types !== undefined) {
      console.log("[CommunitySponsorTypeSelect] Hydrating sponsor types from draft");
      if (draftData.sponsoringEnabled === false) {
        setLookingForSponsors(false);
      } else if (draftData.sponsor_types.includes("Open to All")) {
        setIsOpenToAll(true);
        setSelectedTypes([...sponsorTypes]);
      } else {
        setSelectedTypes(draftData.sponsor_types);
      }
    }

    // 2. Hydrate all shared parameters
    const updatedParams = { ...params };
    let paramChanged = false;

    const keysToHydrate = [
      "email", "accessToken", "refreshToken", "name", "logo_url", "bio",
      "category", "categories", "location", "phone", "secondary_phone", "heads",
      "head_photo_url", "community_type", "college_id", "college_name",
      "college_subtype", "club_type", "community_theme", "college_pending",
      "isStudentCommunity"
    ];

    keysToHydrate.forEach(key => {
      if (!params[key] && draftData[key] !== undefined && draftData[key] !== null) {
        updatedParams[key] = draftData[key];
        paramChanged = true;
      }
    });

    if (paramChanged) {
      console.log("[CommunitySponsorTypeSelect] Hydrated shared parameters from draft");
      setParams(updatedParams);
    }
  };

  // Toggle selection state for a sponsor type chip
  const toggleType = (type) => {
    // If selecting a chip, automatically disable 'Open to All'
    setIsOpenToAll(false);

    setSelectedTypes((prevSelected) => {
      if (prevSelected.includes(type)) {
        return prevSelected.filter((t) => t !== type);
      }
      return [...prevSelected, type];
    });
  };

  const handleOpenToAll = () => {
    if (!isOpenToAll) {
      // When enabling "Open to All", select all sponsor types
      setSelectedTypes([...sponsorTypes]);
      setIsOpenToAll(true);
    } else {
      // When disabling "Open to All", clear all selections
      setSelectedTypes([]);
      setIsOpenToAll(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleCancel = async () => {
    await deleteCommunitySignupDraft();
    setShowCancelModal(false);
    exitSignupToAuthGate(navigation);
  };

  const handleFinish = async () => {
    if (isSubmitting) return;

    // When opted out, sponsor_types is empty
    const sponsor_types = !lookingForSponsors
      ? []
      : isOpenToAll
        ? ["Open to All"]
        : selectedTypes;

    // Validate only when looking for sponsors
    if (lookingForSponsors && !isOpenToAll && selectedTypes.length < 3) {
      Alert.alert(
        "Select Sponsor Types",
        'Please select at least 3 sponsor types, choose "Open to All", or turn off sponsor seeking.',
      );
      return;
    }
    const rawCategories =
      Array.isArray(categories) && categories.length > 0
        ? categories
        : category
          ? [category]
          : [];
    const categoryList = Array.from(
      new Set(
        rawCategories
          .map((c) => (typeof c === "string" ? c.trim() : ""))
          .filter((c) => c),
      ),
    ).slice(0, 3);
    if (categoryList.length === 0) {
      Alert.alert(
        "Missing Categories",
        "Please go back and select at least one category.",
      );
      return;
    }

    // DON'T create the community record here - pass all data to username screen
    // Record will be created when username is set (final step)
    const userData = {
      ...params,
      category: categoryList[0],
      categories: categoryList,
      sponsor_types,
    };

    // Save sponsor_types (and opted-out flag) to draft
    try {
      await updateCommunitySignupDraft("CommunitySponsorType", {
        sponsor_types,
        sponsoringEnabled: lookingForSponsors,
      });
      console.log(
        "[CommunitySponsorTypeSelect] Draft updated with sponsor_types",
      );
    } catch (e) {
      console.log(
        "[CommunitySponsorTypeSelect] Draft update failed (non-critical):",
        e.message,
      );
    }

    // Creators go to IndividualLocation next; Organizations go to Username (final step)
    const isCreator = params.community_type === "individual_organizer";
    if (isCreator) {
      navigation.navigate("IndividualLocation", {
        ...userData,
      });
    } else {
      navigation.navigate("CommunityUsername", {
        userData,
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
      });
    }
  };

  const openToAllIsSelected = isOpenToAll;
  // Button enabled when: opted out of sponsoring, OR openToAll, OR >=3 types picked
  const isButtonDisabled =
    (lookingForSponsors && !isOpenToAll && selectedTypes.length < 3) || isSubmitting;

  return (
    // FIX 1: Consistent Safe Area implementation
    <ImageBackground
      source={wave}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.3, transform: [{ scaleX: -1 }, { scaleY: -1 }] }}
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <SignupHeader
          onBack={() => navigation.goBack()}
          onCancel={() => setShowCancelModal(true)}
          role="Community"
        />

        {/* Scrollable Content */}
        <ScrollView
          style={styles.contentScrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentArea}>
            <Animated.Text 
              entering={FadeInDown.delay(100).duration(600).springify()}
              style={styles.mainTitle}
            >
              Sponsor Types
            </Animated.Text>
            <Animated.Text 
              entering={FadeInDown.delay(200).duration(600).springify()}
              style={styles.subtitle}
            >
              Are you looking for sponsors? You can always change this later.
            </Animated.Text>

            {/* Looking-for-sponsors toggle */}
            <Animated.View
              entering={FadeInDown.delay(250).duration(600).springify()}
              style={styles.toggleCard}
            >
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextGroup}>
                  <Text style={styles.toggleLabel}>Looking for Sponsors</Text>
                  <Text style={styles.toggleSubLabel}>
                    {lookingForSponsors ? "Select the types you want" : "Not seeking sponsors right now"}
                  </Text>
                </View>
                <Switch
                  value={lookingForSponsors}
                  onValueChange={(val) => {
                    setLookingForSponsors(val);
                    if (!val) {
                      // Clear selections when toggling off
                      setSelectedTypes([]);
                      setIsOpenToAll(false);
                    }
                  }}
                  trackColor={{ false: "rgba(0,0,0,0.1)", true: COLORS.primary }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="rgba(0,0,0,0.1)"
                />
              </View>
            </Animated.View>

            {/* Sponsor Type Picker (hidden when not looking for sponsors) */}
            {lookingForSponsors && (
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
                {/* Top Section: Selected Sponsor Types */}
                {!isOpenToAll && selectedTypes.length > 0 && (
                  <View style={styles.selectedSection}>
                    <View style={styles.chipsContainer}>
                      {selectedTypes.map((type) => {
                        const style = getInterestStyle(type);
                        const Icon = style.icon;
                        return (
                          <TouchableOpacity
                            key={`selected-${type}`}
                            activeOpacity={0.7}
                            onPress={() => toggleType(type)}
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
                                {type}
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

                {/* Available Sponsor Types (Grouped) */}
                <View 
                  style={[styles.categoriesContainer, { opacity: isOpenToAll ? 0.4 : 1 }]}
                  pointerEvents={isOpenToAll ? "none" : "auto"}
                >
                  {loading ? (
                    <Text style={styles.subtitle}>
                        Loading sponsor types...
                      </Text>
                    ) : (
                      <>
                        {Object.keys(INTEREST_CATEGORIES)
                          .filter((key) => key !== "DEFAULT")
                          .map((key) => {
                            const categoryGroup = INTEREST_CATEGORIES[key];
                            const isExpanded = expandedCategory === key;
                            const GroupIcon = categoryGroup.icon;

                            // Filter sponsors for this group
                            const groupSponsors = sponsorTypes.filter(
                              (type) =>
                                !selectedTypes.includes(type) &&
                                categoryGroup.keywords.some((k) =>
                                  type.toLowerCase().includes(k),
                                ),
                            );

                            const hasAnySponsors = sponsorTypes.some(
                              (type) => categoryGroup.keywords.some((k) => type.toLowerCase().includes(k))
                            );

                            if (!hasAnySponsors) return null;

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
                                        ? categoryGroup.bg
                                        : "transparent",
                                    },
                                  ]}
                                >
                                  <View style={styles.categoryHeaderLeft}>
                                    <View
                                      style={[
                                        styles.categoryIcon,
                                        { backgroundColor: categoryGroup.bg },
                                      ]}
                                    >
                                      <GroupIcon size={14} color={categoryGroup.text} />
                                    </View>
                                    <Text
                                      style={[
                                        styles.categoryTitle,
                                        isExpanded && {
                                          color: categoryGroup.text,
                                          fontWeight: "600",
                                        },
                                      ]}
                                    >
                                      {categoryGroup.label}
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
                                    {groupSponsors.length === 0 ? (
                                      <Text style={[styles.optionText, { color: COLORS.textSecondary, fontStyle: 'italic', paddingLeft: 4 }]}>
                                        All selected
                                      </Text>
                                    ) : (
                                      <View style={styles.chipsContainer}>
                                        {groupSponsors.map((type) => (
                                          <TouchableOpacity
                                            key={type}
                                            onPress={() => toggleType(type)}
                                            style={styles.optionChip}
                                          >
                                            <Text style={styles.optionText}>{type}</Text>
                                          </TouchableOpacity>
                                        ))}
                                      </View>
                                    )}
                                  </View>
                                )}
                              </View>
                            );
                          })}

                        {/* Uncategorized (Other) */}
                        {(() => {
                          const uncategorizedSponsors = sponsorTypes.filter(
                            (type) =>
                              !selectedTypes.includes(type) &&
                              !Object.values(INTEREST_CATEGORIES).some((group) =>
                                group.keywords.some((k) => type.toLowerCase().includes(k))
                              )
                          );

                          const hasAnyUncategorized = sponsorTypes.some(
                            (type) => !Object.values(INTEREST_CATEGORIES).some((group) =>
                                group.keywords.some((k) => type.toLowerCase().includes(k))
                              )
                          );

                          if (!hasAnyUncategorized) return null;
                          const isExpanded = expandedCategory === 'OTHER';
                          const defaultCategory = INTEREST_CATEGORIES.DEFAULT;

                          return (
                            <View key="OTHER" style={styles.categoryRow}>
                              <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => {
                                  setExpandedCategory(isExpanded ? null : 'OTHER');
                                }}
                                style={[
                                  styles.categoryHeader,
                                  isExpanded && styles.categoryHeaderExpanded,
                                  {
                                    backgroundColor: isExpanded
                                      ? defaultCategory.bg
                                      : "transparent",
                                  },
                                ]}
                              >
                                <View style={styles.categoryHeaderLeft}>
                                  <View
                                    style={[
                                      styles.categoryIcon,
                                      { backgroundColor: defaultCategory.bg },
                                    ]}
                                  >
                                    <Zap size={14} color={defaultCategory.text} />
                                  </View>
                                  <Text
                                    style={[
                                      styles.categoryTitle,
                                      isExpanded && {
                                        color: defaultCategory.text,
                                        fontWeight: "600",
                                      },
                                    ]}
                                  >
                                    Other
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
                                  {uncategorizedSponsors.length === 0 ? (
                                    <Text style={[styles.optionText, { color: COLORS.textSecondary, fontStyle: 'italic', paddingLeft: 4 }]}>
                                      All selected
                                    </Text>
                                  ) : (
                                    <View style={styles.chipsContainer}>
                                      {uncategorizedSponsors.map((type) => (
                                        <TouchableOpacity
                                          key={type}
                                          onPress={() => toggleType(type)}
                                          style={styles.optionChip}
                                        >
                                          <Text style={styles.optionText}>{type}</Text>
                                        </TouchableOpacity>
                                      ))}
                                    </View>
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        })()}
                      </>
                    )}
                  </View>

                <TouchableOpacity
                  style={[
                    styles.openToAllButton,
                    {
                      backgroundColor: openToAllIsSelected
                        ? COLORS.textPrimary
                        : "rgba(255, 255, 255, 0.4)",
                      borderColor: openToAllIsSelected
                        ? COLORS.textPrimary
                        : "rgba(255, 255, 255, 0.6)",
                    },
                  ]}
                  onPress={handleOpenToAll}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Open to All Sponsors"
                >
                  <Text
                    style={[
                      styles.openToAllText,
                      {
                        color: openToAllIsSelected
                          ? COLORS.textInverted
                          : COLORS.textPrimary,
                      },
                    ]}
                  >
                    Open to All
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
            )}

            <View
              style={{ width: "100%", alignItems: "flex-end", marginTop: 40 }}
            >
              <Animated.View 
                entering={FadeInDown.delay(600).duration(600).springify()}
                style={animatedButtonStyle}
              >
                <TouchableOpacity
                  style={[
                    styles.finishButtonContainer,
                    isButtonDisabled && styles.disabledButton,
                    { minWidth: 160, paddingHorizontal: 32, marginRight: -33 },
                  ]}
                  onPress={handleFinish}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Next step"
                  disabled={isButtonDisabled}
                >
                  <LinearGradient
                    colors={COLORS.primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.finishButton}
                  >
                    <Text style={styles.buttonText}>
                      {isSubmitting ? "Submitting..." : "Next"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
      <CancelSignupModal
        visible={showCancelModal}
        onKeepEditing={() => setShowCancelModal(false)}
        onDiscard={handleCancel}
      />
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

  // --- Toggle Card ---
  toggleCard: {
    width: "100%",
    marginBottom: 20,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  toggleTextGroup: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  toggleSubLabel: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
  },

  // --- Header Styles ---
  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    width: "100%",
    paddingTop: 15,
    paddingBottom: 5,
  },
  backButton: {
    padding: 10,
    marginLeft: -10,
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
    alignItems: "flex-start",
    width: "100%",
    paddingTop: 40,
  },
  mainTitle: {
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
    marginBottom: 40,
  },

  // --- Card Styles ---
  card: {
    width: "100%",
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

  // --- Chips/Tags Styles ---
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  
  // --- Split Layout Styles ---
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
  selectedSection: {
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
    marginVertical: 16,
  },
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

  // --- Open to All Button Styles ---
  openToAllButton: {
    alignSelf: "stretch",
    height: 56,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  openToAllText: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },

  // --- Fixed Button Container ---
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
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },
});

export default CommunitySponsorTypeSelect;



