import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
  Platform,
  Image,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
// Use transparent Lucid icons if available or standard Ionicons
import {
  Camera,
  Lock,
  Mail,
  Phone,
  GraduationCap,
  User,
  ArrowLeft,
  X,
  Plus,
  TreeDeciduous,
  Laptop,
  Coffee,
  Zap,
  Tent,
  Rocket,
  Heart,
  Dumbbell,
  Plane,
  Film,
  Search,
  Gamepad2,
  Utensils,
  PartyPopper,
  Palette as Art,
  Clapperboard,
  Mountain,
  MoreHorizontal,
  RollerCoaster,
  NotebookText,
  ChevronDown,
  ChevronRight,
  Search as SearchIcon,
} from "lucide-react-native";

import { getAuthToken } from "../../../api/auth";
import {
  updateMemberProfile,
  changeUsername,
  fetchInterests,
  fetchPronouns,
} from "../../../api/members";
import HapticsService from "../../../services/HapticsService";
import { useCrop } from "../../../components/MediaCrop";
import { uploadImage } from "../../../api/cloudinary";
import ChipSelector from "../../../components/ChipSelector";
import EmailChangeModal from "../../../components/EmailChangeModal";
import UnsavedChangesModal from "../../../components/UnsavedChangesModal";

import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONTS,
  SHADOWS,
} from "../../../constants/theme";

// Typography constants based on user request
const FONT_HEADER = FONTS.primary || "BasicCommercial-Bold"; // Edit Profile
const FONT_CARD_TITLE = FONTS.primary || "BasicCommercial-Bold"; // THE BASICS, etc.
const FONT_LABEL = FONTS.medium; // Input Labels
const FONT_INPUT = FONTS.regular; // Input Values
const FONT_BUTTON = FONTS.medium; // Cancel / Save

// Colors
const ACCENT_COLOR = COLORS.primary;
const BG_COLOR = COLORS.screenBackground || "#F9FAFB";
const CARD_BG = "#FFFFFF";
const TEXT_PRIMARY = COLORS.textPrimary;
const TEXT_SECONDARY = COLORS.textSecondary;
const INPUT_BG = "#F3F4F6"; // Soft filled input
const BORDER_COLOR = "#E5E7EB";

// Enable LayoutAnimation for Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { INTEREST_CATEGORIES, getInterestStyle } from "./EditProfileConstants";

// Pronoun Category Tints
const PRONOUN_STYLE_CONFIG = {
  masculine: {
    bg: "#E2E8F1", // Deepened Cool slate
    text: "#2F3A55",
    keywords: ["he", "him", "his"],
  },
  feminine: {
    bg: "#F2E2E6", // Deepened Muted rose
    text: "#5A2F3C",
    keywords: ["she", "her", "hers"],
  },
  neutral: {
    bg: "#E2EFED", // Deepened Soft teal-sage
    text: "#1F4E4A",
    keywords: ["they", "them", "theirs"],
  },
  unselected: {
    bg: "#F3F4F6",
    text: "#8A8A8A",
  },
};

const getPronounStyles = (pronoun, isSelected) => {
  if (!isSelected) return PRONOUN_STYLE_CONFIG.unselected;

  const lower = pronoun.toLowerCase();
  // Use word-based matching to avoid "she" matching "he"
  const words = lower.split(/[\/\s,.]+/);

  if (words.some((w) => PRONOUN_STYLE_CONFIG.feminine.keywords.includes(w)))
    return PRONOUN_STYLE_CONFIG.feminine;
  if (words.some((w) => PRONOUN_STYLE_CONFIG.masculine.keywords.includes(w)))
    return PRONOUN_STYLE_CONFIG.masculine;
  if (words.some((w) => PRONOUN_STYLE_CONFIG.neutral.keywords.includes(w)))
    return PRONOUN_STYLE_CONFIG.neutral;

  return PRONOUN_STYLE_CONFIG.neutral; // Default to neutral tinted if selected but unknown
};

export default function EditProfileScreen({ route, navigation }) {
  const profile = route?.params?.profile;
  const scrollViewRef = useRef(null);

  const cleanLabel = (val) => {
    if (typeof val !== "string") return val;
    return val.replace(/^[{\"]+|[}\"]+$/g, "");
  };

  // State
  const [name, setName] = useState(profile?.name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [email, setEmail] = useState(profile?.email || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [education, setEducation] = useState(profile?.education || ""); // New Field
  const [pronouns, setPronouns] = useState(
    profile?.pronouns
      ? (Array.isArray(profile.pronouns)
          ? profile.pronouns
          : [profile.pronouns]
        ).map(cleanLabel)
      : [],
  );
  const [interests, setInterests] = useState(profile?.interests || []);

  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [emailChangeModalVisible, setEmailChangeModalVisible] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [interestsCatalog, setInterestsCatalog] = useState([]);
  const [pronounPresets, setPronounPresets] = useState([
    "He/Him",
    "She/Her",
    "They/Them",
  ]);
  const [hasChanges, setHasChanges] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(
    profile?.profile_photo_url ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        profile?.name || "Member",
      )}&background=6A0DAD&color=FFFFFF&size=120&bold=true`,
  );

  // My Vibes Redesign State
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategory, setExpandedCategory] = useState("LIFESTYLE"); // Default open
  const [showAllSelected, setShowAllSelected] = useState(false);

  const allowLeaveRef = useRef(false);
  const pendingActionRef = useRef(null);

  useEffect(() => {
    loadInterestsCatalog();
    loadPronounsCatalog();
  }, []);

  useEffect(() => {
    checkForChanges();
  }, [name, bio, username, phone, pronouns, interests, email, education]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (!hasChanges || saving || allowLeaveRef.current) {
        return;
      }
      e.preventDefault();
      pendingActionRef.current = e.data.action;
      setShowUnsavedModal(true);
    });
    return unsubscribe;
  }, [navigation, hasChanges, saving]);

  const handleDiscardChanges = () => {
    setShowUnsavedModal(false);
    allowLeaveRef.current = true;
    if (pendingActionRef.current) {
      navigation.dispatch(pendingActionRef.current);
      pendingActionRef.current = null;
    }
  };

  const handleKeepEditing = () => {
    setShowUnsavedModal(false);
    pendingActionRef.current = null;
  };

  const loadPronounsCatalog = async () => {
    try {
      const data = await fetchPronouns();
      if (data && data.length > 0) {
        setPronounPresets(data.map((p) => p.label));
      }
    } catch (error) {
      console.error("Error loading pronouns:", error);
    }
  };

  const loadInterestsCatalog = async () => {
    try {
      const catalog = await fetchInterests();
      setInterestsCatalog(catalog || []);
    } catch (error) {
      console.error("Error loading interests catalog:", error);
    }
  };

  const checkForChanges = () => {
    const originalName = profile?.name || "";
    const originalBio = profile?.bio || "";
    const originalUsername = profile?.username || "";
    const originalPhone = profile?.phone || "";
    const originalEmail = profile?.email || "";
    const originalEducation = profile?.education || "";

    const normalizePronouns = (arr) =>
      (arr ? (Array.isArray(arr) ? arr : [arr]) : [])
        .map(cleanLabel)
        .slice()
        .sort();

    const originalPronouns = normalizePronouns(profile?.pronouns);
    const currentPronouns = normalizePronouns(pronouns);

    const normalizeInterests = (arr) => (arr ? [...arr].sort() : []);
    const originalInterests = normalizeInterests(profile?.interests || []);
    const currentInterests = normalizeInterests(interests || []);

    const changed =
      name !== originalName ||
      bio !== originalBio ||
      username !== originalUsername ||
      phone !== originalPhone ||
      email !== originalEmail ||
      education !== originalEducation ||
      JSON.stringify(currentPronouns) !== JSON.stringify(originalPronouns) ||
      JSON.stringify(currentInterests) !== JSON.stringify(originalInterests);

    setHasChanges(!!changed);
  };

  const checkUsernameAvailability = useCallback(
    async (value) => {
      if (!value || value === profile?.username) {
        setUsernameAvailable(null);
        return;
      }

      if (!/^[a-z0-9._]{3,30}$/.test(value.toLowerCase())) {
        setUsernameAvailable(false);
        return;
      }

      setUsernameChecking(true);
      try {
        const token = await getAuthToken();
        const { apiPost } = await import("../../../api/client");
        const result = await apiPost(
          "/username/check",
          { username: value },
          10000,
          token,
        );
        setUsernameAvailable(result?.available === true);
      } catch (error) {
        setUsernameAvailable(false);
      } finally {
        setUsernameChecking(false);
      }
    },
    [profile?.username],
  );

  const handleUsernameChange = (value) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9._]/g, "");
    setUsername(sanitized);
    if (sanitized.length >= 3) {
      const timeoutId = setTimeout(
        () => checkUsernameAvailability(sanitized),
        500,
      );
      return () => clearTimeout(timeoutId);
    } else {
      setUsernameAvailable(null);
    }
  };

  const { pickAndCrop } = useCrop();

  const handleChangePhoto = async () => {
    try {
      const result = await pickAndCrop("avatar");
      if (!result) return;

      setUploadingPhoto(true);
      const secureUrl = await uploadImage(result.uri);
      const token = await getAuthToken();
      await (
        await import("../../../api/client")
      ).apiPost(
        "/members/profile/photo",
        { photo_url: secureUrl },
        15000,
        token,
      );
      setPhotoUrl(secureUrl);
      HapticsService.triggerNotificationSuccess();
    } catch (e) {
      Alert.alert("Update failed", e?.message || "Could not update photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    try {
      setSaving(true);
      const token = await getAuthToken();

      const updates = {
        name: name.trim(),
        bio: bio.trim(),
        phone: phone.trim(),
        education: education.trim(),
        pronouns: pronouns.length > 0 ? pronouns.map(cleanLabel) : null,
        interests: interests.length > 0 ? interests : [],
      };

      await updateMemberProfile(updates, token);

      if (username !== profile?.username) {
        await changeUsername(username, token);
      }

      HapticsService.triggerNotificationSuccess();
      allowLeaveRef.current = true;
      setHasChanges(false);
      navigation.navigate("Profile", { refreshProfile: true });
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert(
        "Error",
        error?.message || "Failed to update profile. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEmailChangeComplete = (newEmail) => {
    setEmail(newEmail);
    setEmailChangeModalVisible(false);
  };

  const renderSectionHeader = (title, IconComponent) => (
    <View style={styles.cardHeader}>
      {IconComponent && (
        <View style={styles.cardIcon}>
          <IconComponent
            size={18}
            color={TEXT_PRIMARY}
            strokeWidth={1.5}
            style={{ opacity: 0.7 }}
          />
        </View>
      )}
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButtonLeft}
          hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}
        >
          <ArrowLeft size={26} color={TEXT_SECONDARY} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Edit Profile</Text>

        <TouchableOpacity
          onPress={handleSave}
          disabled={!hasChanges || saving}
          style={[
            styles.saveButton,
            (!hasChanges || saving) && styles.saveButtonDisabled,
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={15}
      >
        {/* Profile Photo - Global Section 2 */}
        <View style={styles.photoSection}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleChangePhoto}
            disabled={uploadingPhoto}
            style={styles.photoWrapper}
          >
            <Image source={{ uri: photoUrl }} style={styles.profileImage} />
            <View style={styles.cameraButton}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Camera size={16} color="#FFFFFF" strokeWidth={2.5} />
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Card 1: The Basics */}
        <View style={styles.card}>
          {renderSectionHeader("THE BASICS", User)}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>DISPLAY NAME</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your Name"
              placeholderTextColor={TEXT_SECONDARY}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>USERNAME</Text>
            <View style={[styles.input, styles.rowInput]}>
              <Text style={styles.prefix}>@</Text>
              <TextInput
                style={styles.flexInput}
                value={username}
                onChangeText={handleUsernameChange}
                autoCapitalize="none"
                placeholder="username"
                placeholderTextColor={TEXT_SECONDARY}
              />
              {usernameChecking && (
                <ActivityIndicator size="small" color={ACCENT_COLOR} />
              )}
              {!usernameChecking && usernameAvailable === true && (
                <Ionicons name="checkmark-circle" size={18} color="green" />
              )}
              {!usernameChecking &&
                usernameAvailable === false &&
                username !== profile?.username && (
                  <Ionicons name="close-circle" size={18} color="red" />
                )}
            </View>
            <Text style={styles.helperText}>Your public handle</Text>
          </View>

          <View style={styles.inputGroupLast}>
            <Text style={styles.inputLabel}>PRONOUNS</Text>
            {/* Custom "Pill" selector for pronouns */}
            <View style={styles.pillRow}>
              {pronounPresets.map((p) => {
                const isSelected = pronouns.includes(p);
                const pStyle = getPronounStyles(p, isSelected);
                return (
                  <TouchableOpacity
                    key={p}
                    activeOpacity={0.8}
                    onPress={() => {
                      const newPronouns = isSelected
                        ? pronouns.filter((pr) => pr !== p)
                        : [...pronouns, p];
                      setPronouns(newPronouns);
                      HapticsService.triggerSelection();
                    }}
                    style={[
                      styles.pronounPill,
                      { backgroundColor: pStyle.bg },
                      isSelected && styles.pronounPillSelected,
                    ]}
                  >
                    <Text style={[styles.pronounText, { color: pStyle.text }]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Card 2: About Me */}
        <View style={styles.card}>
          {renderSectionHeader("ABOUT ME", NotebookText)}
          <View style={styles.inputGroupLast}>
            <TextInput
              style={styles.bioInput}
              value={bio}
              onChangeText={setBio}
              multiline
              placeholder="Tell us about yourself..."
              placeholderTextColor={TEXT_SECONDARY}
              maxLength={150}
            />
            <Text style={styles.charCount}>{bio.length} / 150</Text>
          </View>
        </View>

        {/* Card 3: Education */}
        <View style={styles.card}>
          {renderSectionHeader("EDUCATION", GraduationCap)}
          <View style={styles.inputGroupLast}>
            <Text style={styles.inputLabel}>COLLEGE / UNIVERSITY</Text>
            <TextInput
              style={styles.input}
              value={education}
              onChangeText={setEducation}
              placeholder="Where did you study?"
              placeholderTextColor={TEXT_SECONDARY}
            />
            <Text style={styles.helperText}>
              Optional • Shown on your profile
            </Text>
          </View>
        </View>

        {/* Card 4: My Vibes (Scalable Redesign) */}
        <View style={styles.card}>
          {renderSectionHeader("MY VIBES", RollerCoaster)}

          <View style={[styles.inputGroupLast, { marginTop: 12 }]}>
            {/* 1. Selected Vibes (Pinned Top) */}
            {interests.length > 0 && (
              <View style={styles.selectedVibesSection}>
                <View style={styles.vibesContainer}>
                  {interests
                    .slice(0, showAllSelected ? undefined : 8)
                    .map((interest) => {
                      const style = getInterestStyle(interest);
                      const Icon = style.icon;
                      return (
                        <TouchableOpacity
                          key={interest}
                          activeOpacity={0.7}
                          onPress={() => {
                            LayoutAnimation.configureNext(
                              LayoutAnimation.Presets.easeInEaseOut,
                            );
                            setInterests(
                              interests.filter((i) => i !== interest),
                            );
                            HapticsService.triggerSelection();
                          }}
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
                  {interests.length > 8 && !showAllSelected && (
                    <TouchableOpacity
                      onPress={() => {
                        LayoutAnimation.configureNext(
                          LayoutAnimation.Presets.easeInEaseOut,
                        );
                        setShowAllSelected(true);
                      }}
                      style={styles.moreCountChip}
                    >
                      <Text style={styles.moreCountText}>
                        +{interests.length - 8} more
                      </Text>
                    </TouchableOpacity>
                  )}
                  {showAllSelected && (
                    <TouchableOpacity
                      onPress={() => {
                        LayoutAnimation.configureNext(
                          LayoutAnimation.Presets.easeInEaseOut,
                        );
                        setShowAllSelected(false);
                      }}
                      style={styles.moreCountChip}
                    >
                      <Text style={styles.moreCountText}>Show less</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.divider} />
              </View>
            )}

            {/* 2. Search & Add */}
            <View style={styles.searchContainer}>
              <SearchIcon
                size={16}
                color={TEXT_SECONDARY}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search interests..."
                placeholderTextColor={TEXT_SECONDARY}
                value={searchQuery}
                onChangeText={(text) => {
                  LayoutAnimation.configureNext(
                    LayoutAnimation.Presets.easeInEaseOut,
                  );
                  setSearchQuery(text);
                  if (text) setExpandedCategory(null); // Close categories when searching
                }}
              />
            </View>

            {/* 3. Categories or Search Results */}
            <View style={styles.categoriesContainer}>
              {searchQuery ? (
                // Search Results
                <View style={styles.vibesContainer}>
                  {interestsCatalog
                    .filter(
                      (i) =>
                        !interests.includes(i) &&
                        i.toLowerCase().includes(searchQuery.toLowerCase()),
                    )
                    .map((interest) => (
                      <TouchableOpacity
                        key={interest}
                        onPress={() => {
                          setInterests([...interests, interest]);
                          setSearchQuery(""); // Clear search after add
                          HapticsService.triggerSelection();
                        }}
                        style={styles.optionChip}
                      >
                        <Text style={styles.optionText}>{interest}</Text>
                        <Plus size={14} color={TEXT_SECONDARY} />
                      </TouchableOpacity>
                    ))}
                  {/* Add Custom Interest in Search */}
                  <TouchableOpacity
                    onPress={() => {
                      if (!interests.includes(searchQuery)) {
                        setInterests([...interests, searchQuery]);
                        setSearchQuery("");
                        HapticsService.triggerSelection();
                      }
                    }}
                    style={styles.addCustomSearchResult}
                  >
                    <Plus size={14} color={ACCENT_COLOR} />
                    <Text style={styles.addCustomText}>
                      Add "{searchQuery}"
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                // Category List
                Object.keys(INTEREST_CATEGORIES)
                  .filter((key) => key !== "DEFAULT")
                  .map((key) => {
                    const category = INTEREST_CATEGORIES[key];
                    const isExpanded = expandedCategory === key;
                    const Icon = category.icon;

                    // Filter interests for this category
                    const categoryInterests = interestsCatalog.filter(
                      (i) =>
                        !interests.includes(i) &&
                        category.keywords.some((k) =>
                          i.toLowerCase().includes(k),
                        ),
                    );

                    // If no interests in this category available to add, maybe skip?
                    // Spec says "Show all categories", so keeping it.

                    return (
                      <View key={key} style={styles.categoryRow}>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => {
                            LayoutAnimation.configureNext(
                              LayoutAnimation.Presets.easeInEaseOut,
                            );
                            setExpandedCategory(isExpanded ? null : key);
                          }}
                          style={[
                            styles.categoryHeader,
                            isExpanded && styles.categoryHeaderExpanded,
                            {
                              backgroundColor: isExpanded
                                ? category.bg
                                : "transparent",
                            }, // Tint on expand
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
                            <ChevronDown size={16} color={TEXT_SECONDARY} />
                          ) : (
                            <ChevronRight size={16} color={TEXT_SECONDARY} />
                          )}
                        </TouchableOpacity>

                        {isExpanded && (
                          <View style={styles.categoryContent}>
                            <View style={styles.vibesContainer}>
                              {categoryInterests.map((interest) => (
                                <TouchableOpacity
                                  key={interest}
                                  onPress={() => {
                                    setInterests([...interests, interest]);
                                    HapticsService.triggerSelection();
                                  }}
                                  style={styles.optionChip}
                                >
                                  <Text style={styles.optionText}>
                                    {interest}
                                  </Text>
                                  <Plus size={14} color={TEXT_SECONDARY} />
                                </TouchableOpacity>
                              ))}
                              {categoryInterests.length === 0 && (
                                <Text style={styles.helperText}>
                                  No more interests in this category.
                                </Text>
                              )}
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

        {/* Card 5: Private Details */}
        <View style={styles.card}>
          {renderSectionHeader("PRIVATE DETAILS", Lock)}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>EMAIL</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setEmailChangeModalVisible(true)}
              style={[
                styles.input,
                styles.rowInput,
                { backgroundColor: "#F8F8F8" },
              ]}
            >
              <Mail size={16} color={"#8B95A5"} style={{ marginRight: 10 }} />
              <TextInput
                style={[styles.flexInput, { color: TEXT_SECONDARY }]}
                value={email}
                editable={false}
                pointerEvents="none"
              />
            </TouchableOpacity>
            <Text style={styles.helperText}>Only visible to you</Text>
          </View>

          <View style={styles.inputGroupLast}>
            <Text style={styles.inputLabel}>PHONE</Text>
            <View style={[styles.input, styles.rowInput]}>
              <Phone size={16} color={"#8B95A5"} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.flexInput}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="Add phone number"
                placeholderTextColor={TEXT_SECONDARY}
                onFocus={() => {
                  // Removed manual scrollToEnd to let KeyboardAwareScrollView handle it
                }}
              />
            </View>
            <Text style={styles.helperText}>Only visible to you</Text>
          </View>
        </View>

        <View style={{ height: 0 }} />
      </KeyboardAwareScrollView>

      <EmailChangeModal
        visible={emailChangeModalVisible}
        currentEmail={email}
        onClose={() => setEmailChangeModalVisible(false)}
        onComplete={handleEmailChangeComplete}
      />

      <UnsavedChangesModal
        visible={showUnsavedModal}
        onKeepEditing={handleKeepEditing}
        onDiscard={handleDiscardChanges}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
    backgroundColor: BG_COLOR,
    position: "relative",
    minHeight: 60,
  },
  headerButtonLeft: {
    position: "absolute",
    left: 8,
    padding: 12,
    zIndex: 1,
  },
  cancelText: {
    fontSize: 16,
    fontFamily: FONT_BUTTON,
    color: TEXT_PRIMARY,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: FONT_HEADER,
    color: TEXT_PRIMARY,
    letterSpacing: 0.3,
  },
  saveButton: {
    position: "absolute",
    right: 20,
    backgroundColor: ACCENT_COLOR,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: BORDER_RADIUS.pill,
    minWidth: 70,
    alignItems: "center",
    zIndex: 1,
  },
  saveButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
    fontFamily: FONT_BUTTON,
  },

  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 10,
    gap: 24,
  },

  // Photo Section
  photoSection: {
    alignItems: "center",
    marginBottom: 8,
  },
  photoWrapper: {
    position: "relative",
    marginBottom: 12,
    // Add subtle shadow/halo
    shadowColor: ACCENT_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  profileImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  cameraButton: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: ACCENT_COLOR,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  changePhotoText: {
    color: ACCENT_COLOR,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: FONTS.medium,
  },

  // Cards
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 20,
    ...SHADOWS.sm, // Soft elevation
    shadowOpacity: 0.05,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.02)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  cardIcon: {
    marginRight: 10,
    backgroundColor: "rgba(0,0,0,0.03)", // Subtle circular container (3%)
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: FONT_CARD_TITLE,
    color: TEXT_PRIMARY,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  addNewText: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: ACCENT_COLOR,
    textTransform: "uppercase",
  },

  // Inputs
  inputGroup: {
    marginBottom: 20,
  },
  inputGroupLast: {
    marginBottom: 0,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: FONT_LABEL,
    color: TEXT_SECONDARY,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: INPUT_BG,
    borderRadius: 12, // Soft rounded
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: FONT_INPUT,
    color: TEXT_PRIMARY,
  },
  rowInput: {
    flexDirection: "row",
    alignItems: "center",
  },
  flexInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONT_INPUT,
    color: TEXT_PRIMARY,
    padding: 0, // Reset default padding in row
  },
  prefix: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    marginRight: 2,
    fontWeight: "500",
  },
  helperText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 6,
    marginLeft: 4,
  },

  // Pronouns
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pronounPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.pill,
    borderWidth: 1,
    borderColor: "transparent", // Prevent layout shift on select
  },
  pronounPillSelected: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)", // Subtle inset shadow simulation
  },
  pronounText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
  },

  // Bio
  bioInput: {
    backgroundColor: INPUT_BG,
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    fontFamily: FONT_INPUT,
    color: TEXT_PRIMARY,
    minHeight: 100,
    textAlignVertical: "top",
  },
  charCount: {
    textAlign: "right",
    fontSize: 11,
    color: TEXT_SECONDARY,
    marginTop: 6,
    marginRight: 4,
  },

  // Vibes
  staticChipText: {
    fontSize: 13,
    color: "#0369A1",
    fontWeight: "500",
  },

  // New Vibes Redesign Styles
  selectedVibesSection: {
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 12,
  },
  vibesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  vibeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: 999, // Full pill
    marginBottom: 4,
    // Soft shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  vibeContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginRight: 6,
  },
  vibeText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
  },
  removeIconContainer: {
    opacity: 0.5,
  },
  moreCountChip: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    justifyContent: "center",
    marginBottom: 4,
  },
  moreCountText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontFamily: FONTS.medium,
  },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: TEXT_PRIMARY,
  },
  addCustomSearchResult: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 8,
  },

  // Categories
  categoriesContainer: {
    gap: 4,
  },
  categoryRow: {
    overflow: "hidden", // For animation clipping
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  categoryHeaderExpanded: {
    // backgroundColor handled inline for tint
  },
  categoryHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  categoryIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryTitle: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: TEXT_PRIMARY,
  },
  categoryContent: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },

  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF", // Neutral surface
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginBottom: 4,
    gap: 6,
  },
  optionText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: TEXT_PRIMARY,
  },
  helperText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginTop: 8,
  },
});
