import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  BackHandler,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Svg, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { getAuthToken } from "../../api/auth";
import { apiGet } from "../../api/client";
import { updateMemberProfile } from "../../api/members";
import { uploadMultipleImages } from "../../api/cloudinary";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  FONTS,
} from "../../constants/theme";
import HapticsService from "../../services/HapticsService";
import ImageUploader from "../../components/ImageUploader";
import {
  Lock,
  Plus,
  X,
  MessageSquare,
  Shield,
  Camera,
  User,
  Sparkles,
} from "lucide-react-native";
import { INTEREST_CATEGORIES } from "../profile/member/EditProfileConstants";

// STRICT CONSTANTS - ITERATION 2
const CONSTANTS_COLORS = {
  primaryBlue: "#2962FF",
  surfaceLight: "#F8FAFC", // Surface Light
  surfaceNeutral: "#F3F6F8", // Unselected chips
  secondaryAccent: "#D4EEEF", // Selected chips
  border: "#F1F5F9", // Lighter border
  textPrimary: "#0F172A",
  textSecondary: "#6B7280",
  disabledIcon: "#9CA3AF",
  surface: "#FFFFFF",
  error: "#DC2626",
  toggleOff: "#E5E5EA", // Neutral gray for toggle off
};

const TEXT_COLOR = CONSTANTS_COLORS.textPrimary;
const LIGHT_TEXT_COLOR = CONSTANTS_COLORS.textSecondary;
const PRIMARY_COLOR = CONSTANTS_COLORS.primaryBlue;

// Goal Badge Presets
const GOAL_BADGE_PRESETS = [
  "Looking for a co-founder",
  "Seeking mentorship",
  "Open to collaborations",
  "Exploring opportunities",
  "Open to friendships",
  "New to the city",
  "Wants to play sports",
  "Looking for study partners",
  "Here to learn",
  "Just curious",
  "Looking for teammates",
];

export default function EditDiscoverProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Profile data
  const [name, setName] = useState("");
  const [age, setAge] = useState(null);
  const [gender, setGender] = useState(""); // Added Gender
  const [pronouns, setPronouns] = useState([]);
  const [showPronouns, setShowPronouns] = useState(true);
  const [photos, setPhotos] = useState([]);
  const [goalBadges, setGoalBadges] = useState([]);
  const [openers, setOpeners] = useState([]);
  const [appearInDiscover, setAppearInDiscover] = useState(true);

  // Initial state for change detection
  const [initialState, setInitialState] = useState(null);
  const imageUploaderRef = useRef(null);
  const hasLoadedRef = useRef(false);

  // Only load profile once on mount, not on every focus
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadProfile();
    }
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      if (token) {
        const response = await apiGet("/members/profile", 15000, token);
        const profile = response.profile || response;

        // Calculate age from DOB
        let calculatedAge = null;
        if (profile.dob) {
          const dob = new Date(profile.dob);
          const today = new Date();
          calculatedAge = today.getFullYear() - dob.getFullYear();
          const m = today.getMonth() - dob.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
            calculatedAge--;
          }
        }

        const loadedState = {
          name: profile.name || "",
          age: calculatedAge,
          gender: profile.gender || "Not Specified", // Handle Gender
          pronouns: profile.pronouns || [],
          showPronouns: profile.show_pronouns !== false,
          photos: profile.discover_photos || [],
          goalBadges: profile.intent_badges || [],
          openers: profile.openers || [],
          appearInDiscover: profile.appear_in_discover !== false,
        };

        setName(loadedState.name);
        setAge(loadedState.age);
        setGender(loadedState.gender);
        setPronouns(loadedState.pronouns);
        setShowPronouns(loadedState.showPronouns);
        setPhotos(loadedState.photos);
        setGoalBadges(loadedState.goalBadges);
        setOpeners(loadedState.openers);
        setAppearInDiscover(loadedState.appearInDiscover);
        setInitialState(loadedState);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = () => {
    if (!initialState) return false;
    return (
      JSON.stringify(photos) !== JSON.stringify(initialState.photos) ||
      JSON.stringify(goalBadges) !== JSON.stringify(initialState.goalBadges) ||
      JSON.stringify(openers) !== JSON.stringify(initialState.openers) ||
      showPronouns !== initialState.showPronouns ||
      appearInDiscover !== initialState.appearInDiscover
    );
  };

  // Handle back button with unsaved changes confirmation
  const handleBackPress = useCallback(() => {
    if (hasChanges()) {
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved changes. What would you like to do?",
        [
          {
            text: "Discard",
            style: "destructive",
            onPress: () => navigation.goBack(),
          },
          {
            text: "Keep Editing",
            style: "cancel",
          },
          {
            text: "Save & Exit",
            onPress: async () => {
              await handleSave();
              // Note: handleSave navigates back on success
            },
          },
        ],
      );
      return true; // Prevent default back behavior
    }
    navigation.goBack();
    return true;
  }, [
    photos,
    goalBadges,
    openers,
    showPronouns,
    appearInDiscover,
    initialState,
    navigation,
  ]);

  // Handle Android hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handleBackPress();
        return true;
      },
    );
    return () => backHandler.remove();
  }, [handleBackPress]);

  const handleSave = async () => {
    // Validation
    if (photos.length < 3) {
      Alert.alert(
        "Photos Required",
        "Please add at least 3 photos to appear in discovery",
      );
      return;
    }
    if (goalBadges.length === 0) {
      Alert.alert(
        "Required",
        "Please add at least 1 goal badge to appear in discovery",
      );
      return;
    }
    if (openers.length === 0) {
      Alert.alert("Required", "Please add at least 1 conversation starter");
      return;
    }

    try {
      setSaving(true);

      // Upload any local photos to Cloudinary before saving
      let photosToSave = [];
      for (const photo of photos) {
        if (
          typeof photo === "string" &&
          (photo.startsWith("file://") || photo.startsWith("content://"))
        ) {
          // This is a local file, needs to be uploaded
          photosToSave.push(photo);
        } else if (typeof photo === "string" && photo.startsWith("http")) {
          // Already a Cloudinary URL, keep it
          photosToSave.push(photo);
        }
      }

      // Upload local photos to Cloudinary
      const localPhotos = photosToSave.filter(
        (p) => p.startsWith("file://") || p.startsWith("content://"),
      );
      const cloudinaryPhotos = photosToSave.filter((p) => p.startsWith("http"));

      let uploadedUrls = [];
      if (localPhotos.length > 0) {
        uploadedUrls = await uploadMultipleImages(localPhotos);
      }

      // Combine: keep existing Cloudinary URLs and add new uploaded ones
      const finalPhotos = [...cloudinaryPhotos, ...uploadedUrls];

      await updateMemberProfile({
        discover_photos: finalPhotos,
        intent_badges: goalBadges,
        openers: openers,
        show_pronouns: showPronouns,
        appear_in_discover: appearInDiscover,
      });
      HapticsService.triggerNotificationSuccess();

      // Update photos state with Cloudinary URLs
      setPhotos(finalPhotos);

      setInitialState({
        name,
        age,
        gender,
        pronouns,
        showPronouns,
        photos: finalPhotos,
        goalBadges,
        openers,
        appearInDiscover,
      });

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        navigation.goBack();
      }, 1500);
    } catch (error) {
      console.error("Error saving:", error);
      Alert.alert("Error", "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ImageUploader callback - receives array of image URIs
  const handlePhotosChange = (newPhotos) => {
    setPhotos(newPhotos);
    HapticsService.triggerSelection();
  };

  const handleAddOpener = () => {
    if (openers.length >= 3) {
      Alert.alert(
        "Maximum Openers",
        "You can add up to 3 conversation starters",
      );
      return;
    }
    navigation.navigate("OpenerSelection", {
      onSelect: (opener) => {
        setOpeners([...openers, opener]);
      },
    });
  };

  const handleRemoveOpener = (index) => {
    const newOpeners = [...openers];
    newOpeners.splice(index, 1);
    setOpeners(newOpeners);
    HapticsService.triggerSelection();
  };

  const toggleGoal = (goal) => {
    HapticsService.triggerSelection();
    setGoalBadges((prev) => {
      if (prev.includes(goal)) {
        return prev.filter((g) => g !== goal);
      } else {
        if (prev.length >= 3) {
          Alert.alert("Limit Reached", "You can select up to 3 goals.");
          return prev;
        }
        return [...prev, goal];
      }
    });
  };

  const getCompletionState = () => {
    let stepsTotal = 4; // Photos, Identity(done), Goals, Openers
    let stepsDone = 1; // Identity is mostly auto-filled/done
    if (photos.length >= 3) stepsDone++;
    if (goalBadges.length > 0) stepsDone++;
    if (openers.length > 0) stepsDone++;
    return { stepsDone, stepsTotal };
  };

  const { stepsDone, stepsTotal } = getCompletionState();
  const completionPercentage = (stepsDone / stepsTotal) * 100;
  const changesExist = hasChanges();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with background covering status bar */}
      <SafeAreaView
        style={{ backgroundColor: CONSTANTS_COLORS.surface }}
        edges={["top"]}
      >
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackPress}
            >
              <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>My Discover Profile</Text>
            </View>
            {/* Circular Progress Indicator */}
            <View style={styles.progressContainer}>
              <Svg width="44" height="44" viewBox="0 0 44 44">
                <Defs>
                  <LinearGradient
                    id="progressGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <Stop offset="0%" stopColor="#2962FF" />
                    <Stop offset="100%" stopColor="#60A5FA" />
                  </LinearGradient>
                </Defs>
                {/* Background Ring */}
                <Circle
                  cx="22"
                  cy="22"
                  r="18"
                  stroke="#F1F5F9"
                  strokeWidth="4"
                  fill="transparent"
                />

                {/* Outer Glow (Subtle expansion) */}
                <Circle
                  cx="22"
                  cy="22"
                  r="18"
                  stroke={CONSTANTS_COLORS.primaryBlue}
                  strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 18}`}
                  strokeDashoffset={`${
                    2 * Math.PI * 18 * (1 - completionPercentage / 100)
                  }`}
                  fill="transparent"
                  strokeLinecap="round"
                  opacity={0.15}
                  rotation="-90"
                  origin="22, 22"
                />

                {/* Main Progress Ring */}
                <Circle
                  cx="22"
                  cy="22"
                  r="18"
                  stroke="url(#progressGradient)"
                  strokeWidth="4.5"
                  strokeDasharray={`${2 * Math.PI * 18}`}
                  strokeDashoffset={`${
                    2 * Math.PI * 18 * (1 - completionPercentage / 100)
                  }`}
                  fill="transparent"
                  strokeLinecap="round"
                  rotation="-90"
                  origin="22, 22"
                />
              </Svg>
              <View style={styles.progressTextContainer}>
                <Text style={styles.progressText}>
                  {Math.round(completionPercentage)}
                </Text>
              </View>
            </View>

            {/* Spacer to push Save button to the right */}
            <View style={{ flex: 1 }} />

            <TouchableOpacity
              style={[
                styles.saveButton,
                (!changesExist || saving) && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={!changesExist || saving}
            >
              <Text
                style={[
                  styles.saveButtonText,
                  (!changesExist || saving) && styles.saveButtonTextDisabled,
                ]}
              >
                {saving ? "Saving..." : "Save"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {showSuccess && (
        <View style={styles.successToast}>
          <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
          <Text style={styles.successToastText}>Saved successfully!</Text>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* SECTION 1: Photos (Edge-to-Edge Editorial) */}
        <View style={styles.sectionEditorial}>
          <View style={styles.sectionCardEditorial}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View
                  style={[
                    styles.sectionIconContainer,
                    { backgroundColor: "#F5F3FF" },
                  ]}
                >
                  <Camera size={18} color="#7C3AED" />
                </View>
                <Text style={styles.cardTitle}>Photos & Videos</Text>
              </View>
            </View>

            <View style={styles.cardContent}>
              <ImageUploader
                ref={imageUploaderRef}
                onImagesChange={handlePhotosChange}
                maxImages={6}
                minRequired={3}
                enableCrop={true}
                cropPreset="feed_portrait"
                initialImages={photos}
                hingeStyle={true}
                containerPadding={32}
                style={{ marginBottom: 0 }}
              />
              {photos.length < 3 && (
                <View style={styles.inlineWarning}>
                  <Ionicons
                    name="alert-circle"
                    size={16}
                    color={CONSTANTS_COLORS.error}
                  />
                  <Text style={styles.inlineWarningText}>
                    Add {3 - photos.length} more photo
                    {3 - photos.length !== 1 ? "s" : ""} to appear in discovery
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* SECTION 2: Identity (Rounded Card) */}
        <View style={styles.section}>
          <View style={styles.sectionCardRounded}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View
                  style={[
                    styles.sectionIconContainer,
                    { backgroundColor: "#EEF2FF" },
                  ]}
                >
                  <User size={18} color="#4F46E5" />
                </View>
                <Text style={styles.cardTitle}>Identity</Text>
              </View>
            </View>

            <View style={styles.cardContent}>
              <View style={styles.identityRowNoLine}>
                <Text style={styles.identityLabel}>Name</Text>
                <View style={styles.identityValueRow}>
                  <Text style={styles.identityValue}>{name}</Text>
                  <Lock size={16} color={CONSTANTS_COLORS.disabledIcon} />
                </View>
              </View>

              <View style={styles.identityRowNoLine}>
                <Text style={styles.identityLabel}>Age</Text>
                <View style={styles.identityValueRow}>
                  <Text style={styles.identityValue}>{age || "—"}</Text>
                  <Lock size={16} color={CONSTANTS_COLORS.disabledIcon} />
                </View>
              </View>

              <View style={styles.identityRowNoLine}>
                <Text style={styles.identityLabel}>Gender</Text>
                <View style={styles.identityValueRow}>
                  <Text style={styles.identityValue}>{gender || "—"}</Text>
                  <Lock size={16} color={CONSTANTS_COLORS.disabledIcon} />
                </View>
              </View>

              <View style={styles.identityRowNoLine}>
                <View style={styles.identityLabelRow}>
                  <Text style={styles.identityLabel}>Pronouns</Text>
                  {pronouns.length > 0 && (
                    <Text style={styles.pronounsPreview}>
                      {pronouns.join(", ")}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.toggle, showPronouns && styles.toggleActive]}
                  onPress={() => {
                    HapticsService.triggerSelection();
                    setShowPronouns(!showPronouns);
                  }}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      showPronouns && styles.toggleKnobActive,
                    ]}
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.toggleHintText}>
                {showPronouns
                  ? "Pronouns visible on your profile"
                  : "Pronouns hidden from your profile"}
              </Text>
            </View>
          </View>
        </View>

        {/* SECTION 3: Goal Badges (Edge-to-Edge Editorial) */}
        <View style={styles.sectionEditorial}>
          <View style={styles.sectionCardEditorial}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View
                  style={[
                    styles.sectionIconContainer,
                    { backgroundColor: "#FFF7ED" },
                  ]}
                >
                  <Sparkles size={18} color="#EA580C" />
                </View>
                <Text style={styles.cardTitle}>Goal Badges</Text>
              </View>
              <View style={styles.cardRequiredBadge}>
                <Text style={styles.cardRequiredBadgeText}>REQUIRED</Text>
              </View>
            </View>
            <Text style={styles.sectionHint}>
              What are you looking for? Select 1-3 goals.
            </Text>

            <View style={styles.cardContent}>
              {/* Wrapped in surface light container, no border */}
              <View style={styles.chipsContainerSoft}>
                {GOAL_BADGE_PRESETS.map((goal, index) => {
                  const isSelected = goalBadges.includes(goal);

                  return (
                    <TouchableOpacity
                      key={goal}
                      onPress={() => toggleGoal(goal)}
                      activeOpacity={0.7}
                      style={[
                        styles.goalChip,
                        isSelected
                          ? styles.goalChipSelected
                          : styles.goalChipUnselected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.goalChipText,
                          isSelected
                            ? {
                                color: CONSTANTS_COLORS.textPrimary,
                                fontFamily: FONTS.semiBold,
                              }
                            : { color: CONSTANTS_COLORS.textPrimary },
                        ]}
                      >
                        {goal}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {goalBadges.length === 0 && (
                <View style={styles.inlineWarning}>
                  <Ionicons
                    name="alert-circle"
                    size={16}
                    color={CONSTANTS_COLORS.error}
                  />
                  <Text style={styles.inlineWarningText}>
                    Select at least 1 goal
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* SECTION 4: Conversation Starters (Rounded Card) */}
        <View style={styles.section}>
          <View style={styles.sectionCardRounded}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View
                  style={[
                    styles.sectionIconContainer,
                    { backgroundColor: "#E6F7F5" },
                  ]}
                >
                  <MessageSquare size={18} color="#059669" />
                </View>
                <Text style={styles.cardTitle}>Icebreakers</Text>
              </View>
              <View style={styles.cardRequiredBadge}>
                <Text style={styles.cardRequiredBadgeText}>REQUIRED</Text>
              </View>
            </View>
            <Text style={styles.sectionHint}>
              Help others start a conversation with you. Add 1-3 openers.
            </Text>

            <View style={styles.cardContent}>
              {openers.map((opener, index) => (
                <View key={index} style={styles.openerCardFormatted}>
                  <View style={styles.openerContent}>
                    <Text style={styles.openerPromptSmall}>
                      {opener.prompt}
                    </Text>
                    <Text style={styles.openerResponseBold}>
                      {opener.response}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.openerRemove}
                    onPress={() => handleRemoveOpener(index)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={18} color={CONSTANTS_COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}

              {openers.length < 3 && (
                <TouchableOpacity
                  style={styles.openerAddButton}
                  onPress={handleAddOpener}
                >
                  <Plus size={20} color="#FFFFFF" strokeWidth={3} />
                  <Text style={styles.openerAddButtonText}>Add Opener</Text>
                </TouchableOpacity>
              )}

              {openers.length === 0 && (
                <View style={styles.inlineWarning}>
                  <Ionicons
                    name="alert-circle"
                    size={16}
                    color={CONSTANTS_COLORS.error}
                  />
                  <Text style={styles.inlineWarningText}>
                    Add at least 1 starter
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* SECTION 5: Privacy (Rounded Card) */}
        <View style={styles.section}>
          <View style={styles.sectionCardRounded}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View
                  style={[
                    styles.sectionIconContainer,
                    { backgroundColor: "#F1F5F9" },
                  ]}
                >
                  <Shield size={18} color="#475569" />
                </View>
                <Text style={styles.cardTitle}>Privacy</Text>
              </View>
            </View>

            <View style={styles.cardContent}>
              <View style={styles.privacyRow}>
                <View style={styles.privacyTextContainer}>
                  <Text style={styles.privacyLabel}>Appear in Discover</Text>
                  <Text style={styles.privacySubtitle}>
                    Others can find and message you
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggle,
                    appearInDiscover && {
                      backgroundColor: CONSTANTS_COLORS.primaryBlue,
                    },
                  ]}
                  onPress={() => {
                    HapticsService.triggerSelection();
                    setAppearInDiscover(!appearInDiscover);
                  }}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      appearInDiscover && styles.toggleKnobActive,
                    ]}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB", // Keeping screen background neutral
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Header
  header: {
    backgroundColor: CONSTANTS_COLORS.surface,
    paddingTop: SPACING.m,
    paddingBottom: SPACING.m, // Added padding for better height
    borderBottomWidth: 0, // No border as per cleaner look request, or keep? "Neutral Border" specified in rules.
    borderBottomColor: CONSTANTS_COLORS.border,
    paddingHorizontal: SPACING.m, // Ensure horizontal padding for flex layout
    flexDirection: "row", // Horizontal layout for the whole header
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTopRow: {
    flex: 1, // Take up remaining space
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTextContainer: {
    marginLeft: 8,
  },
  headerTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 20, // Slightly larger
    color: TEXT_COLOR,
  },
  headerSubtitle: {
    display: "none", // Hidden as per "Circular Progress" driving status
  },
  saveButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 16,
    height: 36,
    borderRadius: BORDER_RADIUS.pill,
    justifyContent: "center",
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: CONSTANTS_COLORS.border,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: FONTS.medium,
  },
  saveButtonTextDisabled: {
    color: CONSTANTS_COLORS.textSecondary,
  },

  // Header Progress
  progressContainer: {
    // Space handled by gap in headerTopRow
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  progressTextContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  progressText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: CONSTANTS_COLORS.primaryBlue,
  },
  // Removed old progressBar styling

  // Section Card Layouts
  sectionCardEditorial: {
    backgroundColor: CONSTANTS_COLORS.surface,
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  sectionCardRounded: {
    backgroundColor: CONSTANTS_COLORS.surface,
    borderRadius: 28,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 0,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 20,
    color: "#0F172A",
  },
  cardRequiredBadge: {
    backgroundColor: "#FFF1F2",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  cardRequiredBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: "#F43F5E",
  },
  cardContent: {
    width: "100%",
  },

  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16, // Padding for floating cards
    marginBottom: 16,
  },
  sectionEditorial: {
    paddingHorizontal: 0, // Edge-to-edge
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 18,
    color: TEXT_COLOR,
    marginBottom: 12,
  },
  sectionHint: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 16,
    lineHeight: 20,
  },

  // CARD NO BORDER STYLE (Identity)
  cardContainerNoBorder: {
    backgroundColor: CONSTANTS_COLORS.surface,
    paddingHorizontal: 0, // Align with text
  },
  identityRowNoLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12, // Reduced padding
    // NO BORDER
  },
  identityLabel: {
    fontFamily: FONTS.medium,
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
  },
  identityLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  identityValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  identityValue: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: TEXT_COLOR,
  },
  pronounsPreview: {
    fontFamily: FONTS.medium,
    fontSize: 16,
    color: CONSTANTS_COLORS.textPrimary, // Selected state Primary Text
  },

  // Privacy Styling inside Card
  privacyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  privacyTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  privacyLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 17,
    color: "#1E293B",
  },
  privacySubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: "#64748B",
    marginTop: 2,
  },

  // Warning
  inlineWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
    alignSelf: "flex-start",
  },
  inlineWarningText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: CONSTANTS_COLORS.error,
  },
  requiredBadge: {
    display: "none", // Removed "Required" badge visually if strict layout
  },
  requiredBadgeText: {
    display: "none",
  },

  // Toggle
  toggle: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#E2E8F0",
    padding: 3,
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: "#3B82F6",
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobActive: {
    alignSelf: "flex-end",
  },
  toggleHintText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    marginTop: 4,
  },

  // CHIPS CONTAINER SOFT
  chipsContainerSoft: {
    backgroundColor: CONSTANTS_COLORS.surfaceLight, // Surface Light
    padding: 12,
    borderRadius: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  goalChip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 8, // Soft rectangle look
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0, // No border
  },
  goalChipUnselected: {
    backgroundColor: CONSTANTS_COLORS.surfaceNeutral, // #F3F6F8
  },
  goalChipSelected: {
    backgroundColor: CONSTANTS_COLORS.secondaryAccent, // #D4EEEF
  },
  goalChipText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
  },

  // Icebreakers / Openers
  openerCardFormatted: {
    backgroundColor: "#F8FAFC",
    padding: 20,
    marginBottom: 16,
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  openerContent: {
    flex: 1,
    marginRight: 12,
  },
  openerPromptSmall: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: "#94A3B8",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  openerResponseBold: {
    fontFamily: FONTS.semiBold,
    fontSize: 18,
    color: "#0F172A",
    lineHeight: 26,
  },
  openerRemove: {
    padding: 4,
    marginTop: -4,
  },

  // New Opener Add Button (Solid Blue)
  openerAddButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 27,
    backgroundColor: "#3B82F6",
    gap: 10,
    marginTop: 8,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  openerAddButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 17,
    color: "#FFFFFF",
  },
});
