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
import { Ionicons } from "@expo/vector-icons";
import { apiPost } from "../../../api/client";
import { getSponsorTypes } from "../../../api/client";

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
  } = route.params || {};
  const [sponsorTypes, setSponsorTypes] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [isOpenToAll, setIsOpenToAll] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

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
    if (draftData?.sponsor_types) {
      console.log("[CommunitySponsorTypeSelect] Hydrating from draft");
      if (draftData.sponsor_types.includes("Open to All")) {
        setIsOpenToAll(true);
        setSelectedTypes([...sponsorTypes]);
      } else {
        setSelectedTypes(draftData.sponsor_types);
      }
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
        'Please select at least 3 sponsor types or choose "Open to All".'
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
          .filter((c) => c)
      )
    ).slice(0, 3);
    if (categoryList.length === 0) {
      Alert.alert(
        "Missing Categories",
        "Please go back and select at least one category."
      );
      return;
    }

    // DON'T create the community record here - pass all data to username screen
    // Record will be created when username is set (final step)
    const userData = {
      name,
      logo_url,
      bio,
      category: categoryList[0],
      categories: categoryList,
      location: location ?? null,
      email,
      phone,
      secondary_phone,
      sponsor_types,
      heads,
    };

    // Save sponsor_types to draft
    try {
      await updateCommunitySignupDraft("CommunitySponsorType", {
        sponsor_types,
      });
      console.log(
        "[CommunitySponsorTypeSelect] Draft updated with sponsor_types"
      );
    } catch (e) {
      console.log(
        "[CommunitySponsorTypeSelect] Draft update failed (non-critical):",
        e.message
      );
    }

    navigation.navigate("CommunityUsername", {
      userData,
      accessToken,
      refreshToken,
    });
  };

  const openToAllIsSelected = isOpenToAll;
  const isButtonDisabled =
    (!isOpenToAll && selectedTypes.length < 3) || isSubmitting;

  return (
    // FIX 1: Consistent Safe Area implementation
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <SignupHeader onBack={() => navigation.goBack()} showCancel={false} />

        {/* Scrollable Content */}
        <ScrollView
          style={styles.contentScrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentArea}>
            <Text style={styles.mainTitle}>Choose Sponsor Type</Text>
            <Text style={styles.subtitle}>
              Select the types of sponsors you are looking for.
            </Text>

            {/* Sponsor Type Chips Container */}
            <View style={styles.chipsContainer}>
              {loading ? (
                <Text style={styles.subtitle}>Loading sponsor types...</Text>
              ) : (
                sponsorTypes.map((type) => (
                  <SponsorChip
                    key={type}
                    type={type}
                    isSelected={isOpenToAll || selectedTypes.includes(type)}
                    onPress={toggleType}
                  />
                ))
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.openToAllButton,
                {
                  backgroundColor: openToAllIsSelected
                    ? COLORS.primary
                    : COLORS.background,
                  borderColor: openToAllIsSelected
                    ? COLORS.primary
                    : COLORS.border,
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
        </ScrollView>
      </View>

      <View style={styles.buttonFixedContainer}>
        <TouchableOpacity
          style={[
            styles.finishButtonContainer,
            isButtonDisabled && styles.disabledButton,
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
      </View>
    </SafeAreaView>
  );
};

// --- Stylesheet ---
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    paddingHorizontal: width * 0.05, // Consistent horizontal padding
    backgroundColor: COLORS.background,
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

  // --- Progress Bar Styles ---
  progressContainer: {
    width: "100%",
    marginBottom: 40,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 5,
    textAlign: "left", // Aligned left for consistency
  },

  // --- Content Styles ---
  contentScrollView: {
    flex: 1,
    width: "100%",
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 110, // Space for the fixed button
  },
  contentArea: {
    alignItems: "flex-start",
    width: "100%",
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 10,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 30,
  },

  // --- Chips/Tags Styles ---
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 30, // Reduced space before next button/chip
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 12, // Slightly increased padding for consistency
    borderRadius: 25,
    borderWidth: 2, // Consistent border width
  },
  chipText: {
    fontSize: 16, // Consistent font size
    fontWeight: "600",
  },

  // --- Open to All Button Styles ---
  openToAllButton: {
    alignSelf: "stretch",
    height: 60, // Consistent height with input fields/other buttons
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 15,
    borderWidth: 2, // Consistent border width
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  openToAllText: {
    fontSize: 18,
    fontWeight: "700",
  },

  // --- Fixed Button Container ---
  buttonFixedContainer: {
    position: "absolute",
    bottom: 0,
    width: width,
    paddingHorizontal: width * 0.05,
    paddingVertical: 15,
    backgroundColor: COLORS.background,
    paddingBottom: Platform.OS === "ios" ? 40 : 25,
    zIndex: 10,
  },
  finishButtonContainer: {
    width: "100%",
    borderRadius: BORDER_RADIUS.pill,
    ...SHADOWS.primaryGlow,
  },
  finishButton: {
    width: "100%",
    height: 70, // Consistent button height
    borderRadius: BORDER_RADIUS.pill,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 18,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
});

export default CommunitySponsorTypeSelect;
