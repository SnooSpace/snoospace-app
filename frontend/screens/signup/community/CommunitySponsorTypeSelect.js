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
} from "react-native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withSequence } from "react-native-reanimated";

import { apiPost } from "../../../api/client";
import { getSponsorTypes } from "../../../api/client";
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
import { updateCommunitySignupDraft } from "../../../utils/signupDraftManager";

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
 * Sponsor Chip Component (Selectable Tag)
 */
const SponsorChip = ({ type, isSelected, onPress }) => (
  <TouchableOpacity
    style={[
      styles.chip,
      {
        backgroundColor: isSelected ? COLORS.primary : COLORS.background,
        borderColor: isSelected ? COLORS.primary : COLORS.border,
      },
    ]}
    onPress={() => onPress(type)}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityState={{ selected: isSelected }}
    accessibilityLabel={`Sponsor Type: ${type}. ${
      isSelected ? "Selected" : "Tap to select"
    }.`}
  >
    <Text
      style={[
        styles.chipText,
        // Using consistent TEXT_COLOR for inactive text
        { color: isSelected ? COLORS.textInverted : COLORS.textPrimary },
      ]}
    >
      {type}
    </Text>
  </TouchableOpacity>
);

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

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
    if (draftData.sponsor_types) {
      console.log("[CommunitySponsorTypeSelect] Hydrating sponsor types from draft");
      if (draftData.sponsor_types.includes("Open to All")) {
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

  const handleFinish = async () => {
    if (!isOpenToAll && selectedTypes.length < 3) {
      Alert.alert(
        "Select Sponsor Types",
        'Please select at least 3 sponsor types or choose "Open to All".',
      );
      return;
    }

    if (isSubmitting) {
      return;
    }

    const sponsor_types = isOpenToAll ? ["Open to All"] : selectedTypes;
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

    // Save sponsor_types to draft
    try {
      await updateCommunitySignupDraft("CommunitySponsorType", {
        sponsor_types,
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

    navigation.navigate("CommunityUsername", {
      userData,
      accessToken: params.accessToken,
      refreshToken: params.refreshToken,
    });
  };

  const openToAllIsSelected = isOpenToAll;
  const isButtonDisabled =
    (!isOpenToAll && selectedTypes.length < 3) || isSubmitting;

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
          role="Community"
          showCancel={false}
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
              Choose Sponsor Type
            </Animated.Text>
            <Animated.Text 
              entering={FadeInDown.delay(200).duration(600).springify()}
              style={styles.subtitle}
            >
              Select the types of sponsors you are looking for.
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
                {/* Sponsor Type Chips Container */}
                <View style={styles.chipsContainer}>
                  {loading ? (
                    <Text style={styles.subtitle}>
                      Loading sponsor types...
                    </Text>
                  ) : (
                    sponsorTypes.map((type, index) => (
                      <Animated.View 
                        key={type}
                        entering={FadeInDown.delay(400 + index * 50).duration(600).springify()}
                      >
                        <SponsorChip
                          type={type}
                          isSelected={isOpenToAll || selectedTypes.includes(type)}
                          onPress={toggleType}
                        />
                      </Animated.View>
                    ))
                  )}
                </View>

                <TouchableOpacity
                  style={[
                    styles.openToAllButton,
                    {
                      backgroundColor: openToAllIsSelected
                        ? COLORS.primary
                        : "rgba(255, 255, 255, 0.4)",
                      borderColor: openToAllIsSelected
                        ? COLORS.primary
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
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.pill,
    borderWidth: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  chipText: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
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



