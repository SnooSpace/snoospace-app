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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getAuthToken } from "../../api/auth";
import { apiGet } from "../../api/client";
import { updateMemberProfile } from "../../api/members";
import { uploadMultipleImages } from "../../api/cloudinary";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../constants/theme";
import ChipSelector from "../../components/ChipSelector";
import HapticsService from "../../services/HapticsService";
import ImageUploader from "../../components/ImageUploader";

const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;
const PRIMARY_COLOR = COLORS.primary;

// Goal Badge Presets
const GOAL_BADGE_PRESETS = [
  // Networking Intent
  "Looking for a co-founder",
  "Seeking mentorship",
  "Open to collaborations",
  "Exploring opportunities",
  // Social Intent
  "Open to friendships",
  "New to the city",
  "Wants to play sports",
  "Looking for study partners",
  // Event-Specific
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
          pronouns: profile.pronouns || [],
          showPronouns: profile.show_pronouns !== false,
          photos: profile.discover_photos || [],
          goalBadges: profile.intent_badges || [],
          openers: profile.openers || [],
          appearInDiscover: profile.appear_in_discover !== false,
        };

        setName(loadedState.name);
        setAge(loadedState.age);
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
        ]
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
      }
    );
    return () => backHandler.remove();
  }, [handleBackPress]);

  const handleSave = async () => {
    // Validation
    if (photos.length < 3) {
      Alert.alert(
        "Photos Required",
        "Please add at least 3 photos to appear in discovery"
      );
      return;
    }
    if (goalBadges.length === 0) {
      Alert.alert(
        "Required",
        "Please add at least 1 goal badge to appear in discovery"
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
        (p) => p.startsWith("file://") || p.startsWith("content://")
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
        "You can add up to 3 conversation starters"
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

  const getCompletionPercentage = () => {
    let score = 0;
    if (photos.length >= 3) score += 40; // 3+ photos required
    else if (photos.length > 0) score += Math.floor((photos.length / 3) * 40);
    if (goalBadges.length > 0) score += 25;
    if (openers.length > 0) score += 25;
    if (openers.length >= 2) score += 10;
    return Math.min(score, 100);
  };

  const changesExist = hasChanges();
  const completion = getCompletionPercentage();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      </SafeAreaView>
    );
  }

  const getCompletionColor = (percentage) => {
    if (percentage < 50) return "#FF3B30"; // Red
    if (percentage < 80) return "#FF9500"; // Orange
    return "#34C759"; // Green
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          My Discover Profile{" "}
          <Text style={{ color: getCompletionColor(completion) }}>
            {completion}%
          </Text>
        </Text>
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

      {/* Success Toast */}
      {showSuccess && (
        <View style={styles.successToast}>
          <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
          <Text style={styles.successToastText}>Saved successfully!</Text>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* SECTION 1: Photos */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>My photos & videos</Text>
          </View>

          <ImageUploader
            ref={imageUploaderRef}
            onImagesChange={handlePhotosChange}
            maxImages={6}
            minRequired={3}
            enableCrop={true}
            cropPreset="feed_portrait"
            initialImages={photos}
            hingeStyle={true}
            style={{ marginBottom: 0 }}
          />
        </View>

        {/* SECTION 2: Identity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identity</Text>
          <Text style={styles.sectionHint}>
            Auto-imported from your profile
          </Text>

          <View style={styles.identityRow}>
            <Text style={styles.identityLabel}>Name</Text>
            <View style={styles.identityValueRow}>
              <Text style={styles.identityValue}>{name}</Text>
              <Ionicons name="lock-closed" size={14} color={LIGHT_TEXT_COLOR} />
            </View>
          </View>

          <View style={styles.identityRow}>
            <Text style={styles.identityLabel}>Age</Text>
            <View style={styles.identityValueRow}>
              <Text style={styles.identityValue}>{age || "—"}</Text>
              <Ionicons name="lock-closed" size={14} color={LIGHT_TEXT_COLOR} />
            </View>
          </View>

          <View style={styles.identityRow}>
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

        {/* SECTION 3: Goal Badges */}
        <View style={[styles.section, styles.highlightedSection]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Goal Badges</Text>
            <Text style={styles.requiredBadge}>Required</Text>
          </View>
          <Text style={styles.sectionHint}>
            What are you looking for? Select 1-3 goals that show your intent.
          </Text>

          <ChipSelector
            selected={goalBadges}
            onSelectionChange={(newVal) => {
              HapticsService.triggerSelection();
              setGoalBadges(newVal.slice(0, 3));
            }}
            presets={GOAL_BADGE_PRESETS}
            allowCustom={true}
            maxSelections={3}
            placeholder="Select your networking goals"
            variant="glass"
          />

          {goalBadges.length === 0 && (
            <Text style={styles.warningText}>
              ⚠️ Add at least 1 goal badge to appear in discovery
            </Text>
          )}
        </View>

        {/* SECTION 4: Conversation Starters */}
        <View style={[styles.section, styles.highlightedSection]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Conversation Starters</Text>
            <Text style={styles.requiredBadge}>Required</Text>
          </View>
          <Text style={styles.sectionHint}>
            Help others start a conversation with you. Add 1-3 openers.
          </Text>

          {openers.map((opener, index) => (
            <View key={index} style={styles.openerCard}>
              <View style={styles.openerContent}>
                <Text style={styles.openerPrompt}>{opener.prompt}</Text>
                <Text style={styles.openerResponse}>{opener.response}</Text>
              </View>
              <TouchableOpacity
                style={styles.openerRemove}
                onPress={() => handleRemoveOpener(index)}
              >
                <Ionicons
                  name="close-circle"
                  size={22}
                  color={LIGHT_TEXT_COLOR}
                />
              </TouchableOpacity>
            </View>
          ))}

          {openers.length < 3 && (
            <TouchableOpacity
              style={styles.addOpenerButton}
              onPress={handleAddOpener}
            >
              <Ionicons
                name="add-circle-outline"
                size={22}
                color={PRIMARY_COLOR}
              />
              <Text style={styles.addOpenerText}>Add Opener</Text>
            </TouchableOpacity>
          )}

          {openers.length === 0 && (
            <Text style={styles.warningText}>
              ⚠️ Add at least 1 conversation starter
            </Text>
          )}
        </View>

        {/* SECTION 5: Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabelContainer}>
              <Text style={styles.toggleLabel}>Appear in Discover</Text>
              <Text style={styles.toggleHint}>
                Let others find you at events
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, appearInDiscover && styles.toggleActive]}
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

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.s,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  saveButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.m,
  },
  saveButtonDisabled: {
    backgroundColor: "#E0E0E0",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  saveButtonTextDisabled: {
    color: "#A0A0A0",
  },
  successToast: {
    position: "absolute",
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: "#2E7D32",
    borderRadius: BORDER_RADIUS.m,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    zIndex: 1000,
    ...SHADOWS.md,
  },
  successToastText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  completionBar: {
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    backgroundColor: "#F8FFF8",
  },
  completionTrack: {
    height: 6,
    backgroundColor: "#E0E0E0",
    borderRadius: 3,
    overflow: "hidden",
  },
  completionFill: {
    height: "100%",
    backgroundColor: "#2E7D32",
    borderRadius: 3,
  },
  completionText: {
    fontSize: 12,
    color: "#2E7D32",
    marginTop: 6,
    fontWeight: "500",
  },
  content: {
    flex: 1,
  },
  section: {
    padding: SPACING.l,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  highlightedSection: {
    backgroundColor: "#FAFAFA",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 16,
  },
  requiredBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
    backgroundColor: "#2E7D32",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  warningText: {
    fontSize: 13,
    color: "#E65100",
    marginTop: 12,
  },

  // Photos
  photoGrid: {
    gap: 12,
  },
  heroPhotoContainer: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: BORDER_RADIUS.l,
    overflow: "hidden",
    position: "relative",
  },
  heroPhoto: {
    width: "100%",
    height: "100%",
  },
  heroPhotoPlaceholder: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: BORDER_RADIUS.l,
    backgroundColor: "#F5F5F5",
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  addPhotoText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  photoRemoveBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    padding: 4,
  },
  thumbnailRow: {
    flexDirection: "row",
    gap: 8,
  },
  thumbnailContainer: {
    width: 80,
    height: 100,
    borderRadius: BORDER_RADIUS.m,
    overflow: "hidden",
    position: "relative",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  thumbnailPlaceholder: {
    width: 80,
    height: 100,
    borderRadius: BORDER_RADIUS.m,
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  thumbnailRemoveBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8,
    padding: 2,
  },

  // Identity
  identityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  identityLabel: {
    fontSize: 15,
    color: TEXT_COLOR,
  },
  identityLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  identityValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  identityValue: {
    fontSize: 15,
    color: LIGHT_TEXT_COLOR,
  },
  pronounsPreview: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    fontStyle: "italic",
  },
  toggleHintText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 6,
  },

  // Toggle
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#E5E5EA",
    padding: 2,
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
  },
  toggleKnobActive: {
    alignSelf: "flex-end",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  toggleLabelContainer: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 15,
    color: TEXT_COLOR,
  },
  toggleHint: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },

  // Openers
  openerCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: BORDER_RADIUS.m,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 10,
  },
  openerContent: {
    flex: 1,
  },
  openerPrompt: {
    fontSize: 13,
    color: PRIMARY_COLOR,
    fontWeight: "500",
    marginBottom: 4,
  },
  openerResponse: {
    fontSize: 14,
    color: TEXT_COLOR,
    lineHeight: 20,
  },
  openerRemove: {
    padding: 4,
  },
  addOpenerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.m,
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    borderStyle: "dashed",
    gap: 8,
  },
  addOpenerText: {
    fontSize: 15,
    color: PRIMARY_COLOR,
    fontWeight: "500",
  },
});
