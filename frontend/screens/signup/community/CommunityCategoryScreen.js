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
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Ionicons } from "@expo/vector-icons"; // Import Ionicons for the back arrow
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);

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

  const handleCreateNewCategory = () => {
    setShowCreateModal(true);
  };

  const handleCreateCategory = async () => {
    const trimmedName = newCategoryName.trim();

    if (!trimmedName) {
      Alert.alert("Error", "Please enter a category name.");
      return;
    }

    // Check if category already exists (case-insensitive check)
    if (
      availableCategories
        .map((c) => c.toLowerCase())
        .includes(trimmedName.toLowerCase())
    ) {
      Alert.alert("Error", "This category already exists.");
      return;
    }

    setSubmittingRequest(true);
    try {
      const response = await apiPost("/community-categories/request", {
        name: trimmedName,
      });

      console.log(
        "[CommunityCategoryScreen] Category request response:",
        response,
      );

      // Add to local list immediately
      setAvailableCategories((prev) => [...prev, trimmedName]);

      // Close modal and reset
      setShowCreateModal(false);
      setNewCategoryName("");

      if (response?.status === "approved") {
        Alert.alert("Success", "Category added successfully!");
      } else {
        Alert.alert(
          "Request Submitted",
          "Thanks! Your category request has been submitted for review. You can still use it now.",
        );
      }
    } catch (error) {
      console.error("Error requesting category:", error);
      Alert.alert(
        "Error",
        "Failed to submit category request. Please try again.",
      );
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleCancelCreate = () => {
    setShowCreateModal(false);
    setNewCategoryName("");
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
      imageStyle={{ opacity: 0.3, transform: [{ rotate: "180deg" }] }}
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <SignupHeader
            role="Communities"
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

          {/* Content Section */}
          <View style={styles.contentContainer}>
            <Text style={styles.title}>Choose Community Category</Text>
            <Text style={styles.subtitle}>
              Select up to 3 categories that best fit your community.
            </Text>

            <View style={styles.card}>
              <BlurView
                intensity={60}
                tint="light"
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.cardContent}>
                {/* Category Chips Container */}
                <View style={styles.chipsContainer}>
                  {availableCategories.map((category) => (
                    <CategoryChip
                      key={category}
                      category={category}
                      isSelected={selectedCategories.includes(category)}
                      onPress={toggleCategory}
                    />
                  ))}
                </View>

                {/* Create New Category Button */}
                <TouchableOpacity
                  style={styles.createNewButton}
                  onPress={handleCreateNewCategory}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={24}
                    color={COLORS.primary}
                    style={styles.createNewIcon}
                  />
                  <Text style={styles.createNewText}>Create New</Text>
                </TouchableOpacity>
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
            </View>
          </View>
        </ScrollView>

        {/* Create New Category Modal */}
        <Modal
          visible={showCreateModal}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCancelCreate}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create New Category</Text>

              <TextInput
                style={styles.modalInput}
                placeholder="Enter category name"
                placeholderTextColor={COLORS.textSecondary}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                autoFocus={true}
                maxLength={30}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={handleCancelCreate}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.createButton]}
                  onPress={handleCreateCategory}
                >
                  <Text style={styles.createButtonText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
    paddingHorizontal: 25,
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
    marginBottom: 30,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.pill,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
  },

  // --- Create New Button Styles ---
  createNewButton: {
    flexDirection: "row",
    alignSelf: "stretch", // full width within card
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingVertical: 15, // matching input height
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: "dashed",
    backgroundColor: "rgba(255, 255, 255, 0.5)",
  },
  createNewIcon: {
    marginRight: 8,
  },
  createNewText: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: COLORS.primary,
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

  // --- Modal Styles (Consistent) ---
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderRadius: 15,
    padding: 25,
    width: "100%",
    maxWidth: 350,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 20,
    textAlign: "center",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 25,
    backgroundColor: COLORS.inputBackground || "#f8f9fa",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 15,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: COLORS.inputBackground || "#f8f9fa",
  },
  createButton: {
    backgroundColor: COLORS.primary,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textInverted,
  },
});

export default CommunityCategoryScreen;
