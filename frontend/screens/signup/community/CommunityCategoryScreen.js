import React, { useState, useEffect } from "react";
import { CommonActions } from "@react-navigation/native";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Platform,
  StatusBar,
  ImageBackground,
} from "react-native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withSequence } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ChevronDown, ChevronRight, X } from "lucide-react-native";
import { BlurView } from "expo-blur";
import wave from "../../../assets/wave.png";
import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import {
  INTEREST_CATEGORIES,
  getInterestStyle,
} from "../../profile/member/EditProfileConstants";
import SignupHeader from "../../../components/SignupHeader";
import {
  updateCommunitySignupDraft,
  deleteCommunitySignupDraft,
  getCommunityDraftData,
} from "../../../utils/signupDraftManager";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";
import { apiGet, apiPost } from "../../../api/client";
import SnooLoader from "../../../components/ui/SnooLoader";
// Fallback categories in case API fails
const fallbackCategories = [
  "Sports",
  "Music",
  "Technology",
  "Travel",
  "Food & Drink",
  "Art & Culture",
  "Fitness",
  "Gaming",
  "Movies",
  "Books",
  "Fashion",
  "Photography",
  "Outdoors",
  "Volunteering",
  "Networking",
];

const MAX_CATEGORIES = 3;

// --- Components ---

/**
 * Category Chip Component (Selectable Tag)
 */
const CategoryChip = ({ category, isSelected, onPress }) => (
  <TouchableOpacity
    style={[
      styles.chip,
      {
        backgroundColor: isSelected
          ? COLORS.primary
          : "rgba(255, 255, 255, 0.6)",
        borderColor: isSelected ? COLORS.primary : "rgba(255, 255, 255, 0.5)",
      },
    ]}
    onPress={() => onPress(category)}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityState={{ selected: isSelected }}
    accessibilityLabel={`Category: ${category}. ${
      isSelected ? "Selected" : "Tap to select"
    }.`}
  >
    <Text
      style={[
        styles.chipText,
        { color: isSelected ? COLORS.textInverted : COLORS.textPrimary },
      ]}
    >
      {category}
    </Text>
  </TouchableOpacity>
);

/**
 * Main Screen Component
 */
const CommunityCategoryScreen = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    refreshToken,
    name,
    logo_url,
    bio,
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
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);

  // Animation values
  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Trigger button bounce when validity changes to true (selectedCategories.length > 0)
  useEffect(() => {
    if (selectedCategories.length > 0) {
      buttonScale.value = withSequence(
        withSpring(1.05, { damping: 10, stiffness: 100 }),
        withSpring(1, { damping: 12, stiffness: 90 })
      );
    }
  }, [selectedCategories.length > 0]);

  // Load categories from API on component mount
  useEffect(() => {
    loadCategoriesFromAPI();
    hydrateFromDraft();
  }, []);

  const loadCategoriesFromAPI = async () => {
    setLoadingCategories(true);
    try {
      const response = await apiGet("/community-categories");
      if (response?.categories && response.categories.length > 0) {
        const categoryNames = response.categories.map((c) => c.name);
        setAvailableCategories(categoryNames);
      } else {
        // Fallback to hardcoded if API returns empty
        setAvailableCategories(fallbackCategories);
      }
    } catch (error) {
      console.error("Error loading categories from API:", error);
      // Fallback to hardcoded categories on error
      setAvailableCategories(fallbackCategories);
    } finally {
      setLoadingCategories(false);
    }
  };

  const hydrateFromDraft = async () => {
    const draftData = await getCommunityDraftData();
    if (draftData?.categories) {
      console.log("[CommunityCategoryScreen] Hydrating from draft");
      setSelectedCategories(draftData.categories);
    }
  };

  // Toggle selection state for a category chip
  const toggleCategory = (category) => {
    setSelectedCategories((prevSelected) => {
      if (prevSelected.includes(category)) {
        return prevSelected.filter((c) => c !== category);
      }
      if (prevSelected.length >= MAX_CATEGORIES) {
        Alert.alert(
          "Limit Reached",
          `You can select up to ${MAX_CATEGORIES} categories.`,
        );
        return prevSelected;
      }
      return [...prevSelected, category];
    });
  };


  const handleBack = () => {
    navigation.goBack();
  };

  const handleNext = async () => {
    if (selectedCategories.length === 0) {
      Alert.alert(
        "Selection Required",
        "Please select at least one category before proceeding.",
      );
      return;
    }

    // Save categories to draft
    try {
      await updateCommunitySignupDraft("CommunityCategory", {
        category: selectedCategories[0],
        categories: selectedCategories,
      });
      console.log("[CommunityCategoryScreen] Draft updated with categories");
    } catch (e) {
      console.log(
        "[CommunityCategoryScreen] Draft update failed (non-critical):",
        e.message,
      );
    }

    const categoryParams = {
      email,
      accessToken,
      refreshToken,
      name,
      logo_url,
      bio,
      category: selectedCategories[0],
      categories: selectedCategories,
      community_type,
      college_id,
      college_name,
      college_subtype,
      club_type,
      community_theme,
      college_pending,
      isStudentCommunity,
    };

    // Individual organizers skip LocationQuestion and use GPS-based location
    if (community_type === "individual_organizer") {
      navigation.navigate("IndividualLocation", categoryParams);
    } else if (community_type === "college_affiliated") {
      // College-affiliated communities skip LocationQuestion and go directly to Google Maps URL input
      navigation.navigate("CommunityLocation", categoryParams);
    } else {
      // Organizations use the LocationQuestion flow
      navigation.navigate("CommunityLocationQuestion", categoryParams);
    }
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

  // Button is enabled if at least one category is selected
  const isButtonDisabled = selectedCategories.length === 0;

  return (
    <ImageBackground
      source={wave}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.3, transform: [{ scaleX: -1 }, { scaleY: -1 }] }}
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <SignupHeader
          role="Community"
          onBack={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.replace("CommunityBio", {
                email,
                accessToken,
                refreshToken,
                name,
                logo_url,
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
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Content Section */}
          <View style={styles.contentContainer}>
            <Animated.Text 
              entering={FadeInDown.delay(100).duration(600).springify()}
              style={styles.title}
            >
              Choose your community's category
            </Animated.Text>
            <Animated.Text 
              entering={FadeInDown.delay(200).duration(600).springify()}
              style={styles.subtitle}
            >
              Select up to 3 categories that best fit your community.
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
                {/* Top Section: Selected Categories */}
                {selectedCategories.length > 0 && (
                  <View style={styles.selectedSection}>
                    <View style={styles.chipsContainer}>
                      {selectedCategories.map((cat) => {
                        const style = getInterestStyle(cat);
                        const Icon = style.icon;
                        return (
                          <TouchableOpacity
                            key={`selected-${cat}`}
                            activeOpacity={0.7}
                            onPress={() => toggleCategory(cat)}
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
                                {cat}
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

                {/* Categories Accordion */}
                <View style={styles.categoriesContainer}>
                  {loadingCategories ? (
                    <SnooLoader size="large" color={COLORS.primary} />
                  ) : availableCategories.length === 0 ? (
                    <Text style={styles.emptyText}>No categories available</Text>
                  ) : (
                    Object.keys(INTEREST_CATEGORIES)
                      .filter((key) => key !== "DEFAULT")
                      .map((key) => {
                        const categoryGroup = INTEREST_CATEGORIES[key];
                        const isExpanded = expandedCategory === key;
                        const GroupIcon = categoryGroup.icon;

                        // Filter categories for this group
                        const groupCats = availableCategories.filter(
                          (cat) =>
                            !selectedCategories.includes(cat) &&
                            categoryGroup.keywords.some((k) =>
                              cat.toLowerCase().includes(k),
                            ),
                        );

                        if (groupCats.length === 0) return null;

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
                                <View style={styles.chipsContainer}>
                                  {groupCats.map((cat) => (
                                    <TouchableOpacity
                                      key={cat}
                                      onPress={() => toggleCategory(cat)}
                                      style={[
                                        styles.optionChip,
                                        selectedCategories.length >= MAX_CATEGORIES && styles.optionChipDisabled
                                      ]}
                                      disabled={selectedCategories.length >= MAX_CATEGORIES}
                                    >
                                      <Text style={[
                                        styles.optionText,
                                        selectedCategories.length >= MAX_CATEGORIES && styles.optionTextDisabled
                                      ]}>{cat}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })
                  )}

                  {/* Handle uncategorized categories if any */}
                  {!loadingCategories && availableCategories.some(cat => 
                    !selectedCategories.includes(cat) && 
                    !Object.values(INTEREST_CATEGORIES).some(group => group.keywords.some(k => cat.toLowerCase().includes(k)))
                  ) && (
                    <View style={styles.categoryRow}>
                       <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => {
                                setExpandedCategory(expandedCategory === 'OTHER' ? null : 'OTHER');
                              }}
                              style={[
                                styles.categoryHeader,
                                expandedCategory === 'OTHER' && styles.categoryHeaderExpanded,
                                {
                                  backgroundColor: expandedCategory === 'OTHER'
                                    ? INTEREST_CATEGORIES.DEFAULT.bg
                                    : "transparent",
                                },
                              ]}
                            >
                              <View style={styles.categoryHeaderLeft}>
                                <View
                                  style={[
                                    styles.categoryIcon,
                                    { backgroundColor: INTEREST_CATEGORIES.DEFAULT.bg },
                                  ]}
                                >
                                  <INTEREST_CATEGORIES.DEFAULT.icon size={14} color={INTEREST_CATEGORIES.DEFAULT.text} />
                                </View>
                                <Text
                                  style={[
                                    styles.categoryTitle,
                                    expandedCategory === 'OTHER' && {
                                      color: INTEREST_CATEGORIES.DEFAULT.text,
                                      fontWeight: "600",
                                    },
                                  ]}
                                >
                                  {INTEREST_CATEGORIES.DEFAULT.label}
                                </Text>
                              </View>
                              {expandedCategory === 'OTHER' ? (
                                <ChevronDown size={16} color={COLORS.textSecondary} />
                              ) : (
                                <ChevronRight size={16} color={COLORS.textSecondary} />
                              )}
                            </TouchableOpacity>
                            {expandedCategory === 'OTHER' && (
                              <View style={styles.categoryContent}>
                                <View style={styles.chipsContainer}>
                                  {availableCategories.filter(cat => 
                                    !selectedCategories.includes(cat) && 
                                    !Object.values(INTEREST_CATEGORIES).some(group => group.keywords.some(k => cat.toLowerCase().includes(k)))
                                  ).map((cat) => (
                                    <TouchableOpacity
                                      key={cat}
                                      onPress={() => toggleCategory(cat)}
                                      style={[
                                        styles.optionChip,
                                        selectedCategories.length >= MAX_CATEGORIES && styles.optionChipDisabled
                                      ]}
                                      disabled={selectedCategories.length >= MAX_CATEGORIES}
                                    >
                                      <Text style={[
                                        styles.optionText,
                                        selectedCategories.length >= MAX_CATEGORIES && styles.optionTextDisabled
                                      ]}>{cat}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                            )}
                    </View>
                  )}
                </View>
              </View>
            </Animated.View>

            <View
              style={{ width: "100%", alignItems: "flex-end", marginTop: 40 }}
            >
              <Animated.View 
                entering={FadeInDown.delay(600).duration(600).springify()}
                style={animatedButtonStyle}
              >
                <TouchableOpacity
                  style={[
                    styles.nextButtonContainer,
                    isButtonDisabled && styles.disabledButton,
                    { minWidth: 160, paddingHorizontal: 32, marginRight: -33 },
                  ]}
                  onPress={handleNext}
                  activeOpacity={0.8}
                  disabled={isButtonDisabled}
                  accessibilityRole="button"
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
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // --- Content Styles ---
  contentContainer: {
    marginTop: 40,
    flex: 1,
  },
  title: {
    fontSize: 34,
    fontFamily: "BasicCommercial-Black",
    color: COLORS.textPrimary,
    marginBottom: 10,
    letterSpacing: -1,
    lineHeight: 42,
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

  // --- Chip Styles ---
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

  emptyText: {
    textAlign: 'center',
    padding: 20,
    color: COLORS.textSecondary,
    fontFamily: 'Manrope-Medium',
  },

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

export default CommunityCategoryScreen;
