import React, { useState, useEffect, useCallback, useRef } from "react";
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Alert, LayoutAnimation, UIManager, Platform, Image, Keyboard, TouchableWithoutFeedback } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle, XCircle } from "lucide-react-native";
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
  Briefcase,
  Check,
  Trash2,
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
import CollegePickerModal from "../../../components/modals/CollegePickerModal";
import DegreePickerModal from "../../../components/modals/DegreePickerModal";

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
import { OCCUPATION_CATEGORIES, getOccupationLabel, getOccupationCategory } from "../../../constants/OccupationConstants";
import { getSubFieldsForOccupation, getSubFieldsForCategory, shouldShowPortfolio, CATEGORY_GENERIC_FIELDS } from "../../../constants/OccupationSubFields";
import SnooLoader from "../../../components/ui/SnooLoader";

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
  const phoneInputRef = useRef(null);

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
  // Structured education fields (stored in occupation_details under edu_degree / edu_year)
  const [educationDegree, setEducationDegree] = useState(profile?.education_details?.edu_degree || "");
  const [educationYear, setEducationYear] = useState(profile?.education_details?.edu_year || "");
  const [pronouns, setPronouns] = useState(
    profile?.pronouns
      ? (Array.isArray(profile.pronouns)
          ? profile.pronouns
          : [profile.pronouns]
        ).map(cleanLabel)
      : [],
  );
  const [interests, setInterests] = useState(profile?.interests || []);

  // Occupation state
  const initialOccupation = profile?.occupation || null;
  const [selectedOccupation, setSelectedOccupation] = useState(
    initialOccupation && initialOccupation.startsWith("other:") ? "other" : initialOccupation
  );
  const [customOccupation, setCustomOccupation] = useState(
    initialOccupation && initialOccupation.startsWith("other:") ? initialOccupation.substring(6) : ""
  );
  const [occupationCategoryExpanded, setOccupationCategoryExpanded] = useState(null);

  // Occupation sub-fields state
  const [occupationDetails, setOccupationDetails] = useState(profile?.occupation_details || {});
  const [occupationCategory, setOccupationCategory] = useState(profile?.occupation_category || null);
  const [portfolioLink, setPortfolioLink] = useState(profile?.portfolio_link || "");

  // College state
  const [campusId, setCampusId] = useState(profile?.campus_id || null);
  const [showCollege, setShowCollege] = useState(profile?.show_college !== false);
  const [collegeDisplayName, setCollegeDisplayName] = useState(
    profile?.college_info?.college_name ||
    profile?.college_info?.college_abbreviation ||
    ""
  );
  const [collegeCampusName, setCollegeCampusName] = useState(
    profile?.college_info?.campus_name || ""
  );
  const [showCollegePicker, setShowCollegePicker] = useState(false);
  // Degree picker — shared between Education card (non-student) and Student degree sub-field
  const [showDegreePicker, setShowDegreePicker] = useState(false);
  // 'education' = non-student education card, 'student' = student occupation sub-field
  const [degreePickerTarget, setDegreePickerTarget] = useState('education');

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
  // pendingPhotoUri: locally staged photo that hasn't been saved yet
  const [pendingPhotoUri, setPendingPhotoUri] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(
    profile?.profile_photo_url ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        profile?.name || "Member",
      )}&background=6A0DAD&color=FFFFFF&size=120&bold=true`,
  );

  // My Vibes Redesign State
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategory, setExpandedCategory] = useState(null); // Default closed
  const [showAllSelected, setShowAllSelected] = useState(false);

  const allowLeaveRef = useRef(false);
  const pendingActionRef = useRef(null);

  useEffect(() => {
    loadInterestsCatalog();
    loadPronounsCatalog();
  }, []);

  useEffect(() => {
    checkForChanges();
  }, [name, bio, username, phone, pronouns, interests, email, educationDegree, educationYear, selectedOccupation, customOccupation, occupationDetails, occupationCategory, portfolioLink, campusId, showCollege, pendingPhotoUri]);

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
    const originalEducationDegree = profile?.education_details?.edu_degree || "";
    const originalEducationYear = profile?.education_details?.edu_year || "";
    const originalOccupation = profile?.occupation || null;
    const originalOccupationDetails = profile?.occupation_details || {};
    const originalOccupationCategory = profile?.occupation_category || null;
    const originalPortfolioLink = profile?.portfolio_link || "";

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

    // Compute current occupation value
    const currentOccupation = selectedOccupation === "other"
      ? `other:${customOccupation.trim()}`
      : selectedOccupation;

    const changed =
      name !== originalName ||
      bio !== originalBio ||
      username !== originalUsername ||
      phone !== originalPhone ||
      email !== originalEmail ||
      currentOccupation !== originalOccupation ||
      occupationCategory !== originalOccupationCategory ||
      portfolioLink !== originalPortfolioLink ||
      JSON.stringify(occupationDetails) !== JSON.stringify(originalOccupationDetails) ||
      JSON.stringify(currentPronouns) !== JSON.stringify(originalPronouns) ||
      JSON.stringify(currentInterests) !== JSON.stringify(originalInterests) ||
      campusId !== (profile?.campus_id || null) ||
      showCollege !== (profile?.show_college !== false) ||
      educationDegree !== originalEducationDegree ||
      educationYear !== originalEducationYear ||
      !!pendingPhotoUri;

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
      // Stage the photo locally — it will be uploaded when the user taps Save
      setPendingPhotoUri(result.uri);
      setPhotoUrl(result.uri);
      HapticsService.triggerSelection();
    } catch (e) {
      Alert.alert("Update failed", e?.message || "Could not update photo");
    }
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    try {
      setSaving(true);
      const token = await getAuthToken();

      // Upload the staged photo first (if the user changed it)
      let finalPhotoUrl = null;
      if (pendingPhotoUri) {
        setUploadingPhoto(true);
        const secureUrl = await uploadImage(pendingPhotoUri);
        await (
          await import("../../../api/client")
        ).apiPost(
          "/members/profile/photo",
          { photo_url: secureUrl },
          15000,
          token,
        );
        setUploadingPhoto(false);
        finalPhotoUrl = secureUrl;
        setPendingPhotoUri(null);
      }

      // Compute final occupation value
      const finalOccupation = selectedOccupation === "other"
        ? `other:${customOccupation.trim()}`
        : selectedOccupation;

      // Build clean occupation details (strip empty values)
      const cleanDetails = {};
      Object.entries(occupationDetails).forEach(([k, v]) => {
        if (typeof v === "string" && v.trim()) cleanDetails[k] = v.trim();
      });

      // Merge structured education fields into occupation_details for non-student occupations
      // (Students already store degree/year via occupationDetails — no double-write needed)
      if (selectedOccupation !== 'student') {
        if (educationDegree.trim()) cleanDetails.edu_degree = educationDegree.trim();
        else delete cleanDetails.edu_degree;
        if (educationYear.trim()) cleanDetails.edu_year = educationYear.trim();
        else delete cleanDetails.edu_year;
      }

      const updates = {
        name: name.trim(),
        bio: bio.trim(),
        phone: phone.trim(),
        occupation: finalOccupation,
        occupation_details: Object.keys(cleanDetails).length > 0 ? cleanDetails : null,
        occupation_category: selectedOccupation === "other" ? occupationCategory : null,
        portfolio_link: portfolioLink.trim() || null,
        pronouns: pronouns.length > 0 ? pronouns.map(cleanLabel) : null,
        interests: interests.length > 0 ? interests : [],
        campus_id: campusId,
        show_college: showCollege,
      };

      await updateMemberProfile(updates, token);

      if (username !== profile?.username) {
        await changeUsername(username, token);
      }

      if (finalPhotoUrl) {
        setPhotoUrl(finalPhotoUrl);
      }

      HapticsService.triggerNotificationSuccess();
      allowLeaveRef.current = true;
      setHasChanges(false);
      navigation.navigate("Profile", { refreshProfile: true });
    } catch (error) {
      console.error("Error saving profile:", error);
      setUploadingPhoto(false);
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
            <SnooLoader size="small" color="#FFFFFF" />
          ) : (
            <Text style={[styles.saveButtonText, { fontFamily: 'Manrope-SemiBold' }]}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        ref={scrollViewRef}
        style={[styles.content, { backgroundColor: BG_COLOR }]}
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
            disabled={saving}
            style={styles.photoWrapper}
          >
            <Image source={{ uri: photoUrl }} style={styles.profileImage} />
            <View style={[styles.cameraButton, pendingPhotoUri && { backgroundColor: '#F59E0B' }]}>
              <Camera size={16} color="#FFFFFF" strokeWidth={2.5} />
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
                <SnooLoader size="small" color={ACCENT_COLOR} />
              )}
              {!usernameChecking && usernameAvailable === true && (
                <CheckCircle size={18} color="green" />
              )}
              {!usernameChecking &&
                usernameAvailable === false &&
                username !== profile?.username && (
                  <XCircle size={18} color="red" />
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

        {/* Card 3: Occupation */}
        <View style={styles.card}>
          {renderSectionHeader("OCCUPATION", Briefcase)}

          <View style={styles.inputGroupLast}>
            {/* Selected Occupation Display */}
            {selectedOccupation && (
              <View style={styles.selectedVibesSection}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setSelectedOccupation(null);
                    setCustomOccupation("");
                    setOccupationDetails({});
                    setOccupationCategory(null);
                    setPortfolioLink("");
                    HapticsService.triggerSelection();
                  }}
                  style={[
                    styles.vibeChip,
                    { backgroundColor: getOccupationCategory(selectedOccupation).bg, paddingRight: 8 },
                  ]}
                >
                  <View style={styles.vibeContent}>
                    <Check size={14} color={getOccupationCategory(selectedOccupation).text} strokeWidth={2.5} />
                    <Text style={[styles.vibeText, { color: getOccupationCategory(selectedOccupation).text }]}>
                      {selectedOccupation === "other"
                        ? (customOccupation.trim() || "Other")
                        : getOccupationLabel(selectedOccupation)}
                    </Text>
                  </View>
                  <View style={styles.removeIconContainer}>
                    <X size={12} color={getOccupationCategory(selectedOccupation).text} strokeWidth={3} />
                  </View>
                </TouchableOpacity>

                {/* Free-text input when "Other" is selected */}
                {selectedOccupation === "other" && (
                  <View style={{ marginTop: 12 }}>
                    <TextInput
                      style={styles.input}
                      value={customOccupation}
                      onChangeText={setCustomOccupation}
                      placeholder="Type your occupation..."
                      placeholderTextColor={TEXT_SECONDARY}
                      maxLength={50}
                      autoCapitalize="words"
                      returnKeyType="done"
                    />
                  </View>
                )}

                {/* Category picker for "Other" */}
                {selectedOccupation === "other" && customOccupation.trim().length > 0 && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={[styles.inputLabel, { marginBottom: 10 }]}>WHICH CATEGORY FITS YOU BEST?</Text>
                    <View style={styles.vibesContainer}>
                      {Object.keys(CATEGORY_GENERIC_FIELDS).filter(k => k !== "OTHER").map((catKey) => {
                        const catInfo = OCCUPATION_CATEGORIES[catKey];
                        const isSelected = occupationCategory === catKey;
                        return (
                          <TouchableOpacity
                            key={catKey}
                            onPress={() => {
                              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                              setOccupationCategory(isSelected ? null : catKey);
                              if (isSelected) setOccupationDetails({});
                              HapticsService.triggerSelection();
                            }}
                            style={[
                              styles.optionChip,
                              isSelected && { backgroundColor: catInfo?.bg || "#F5F5F5", borderColor: catInfo?.text || "#424242" },
                            ]}
                          >
                            <Text style={[
                              styles.optionText,
                              isSelected && { color: catInfo?.text || "#424242", fontFamily: "Manrope-SemiBold" },
                            ]}>
                              {catInfo?.label || catKey}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Dynamic sub-fields based on occupation or category */}
                {(() => {
                  const subFields = selectedOccupation === "other"
                    ? getSubFieldsForCategory(occupationCategory)
                    : getSubFieldsForOccupation(selectedOccupation);
                  if (!subFields || subFields.length === 0) return null;
                  return (
                    <View style={{ marginTop: 16 }}>
                      {subFields.map((field) => {
                        // For students: replace the institution text field with the CollegePickerModal button
                        if (selectedOccupation === 'student' && field.key === 'institution') {
                          const displayLabel = collegeDisplayName
                            ? `${collegeDisplayName}${collegeCampusName ? ` • ${collegeCampusName}` : ''}`
                            : null;
                          return (
                            <View key={field.key} style={{ marginBottom: 14 }}>
                              <Text style={styles.inputLabel}>{field.label}</Text>
                              <TouchableOpacity
                                style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                                onPress={() => setShowCollegePicker(true)}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[styles.inputText, !displayLabel && { color: TEXT_SECONDARY }]}
                                  numberOfLines={1}
                                >
                                  {displayLabel || field.placeholder}
                                </Text>
                                <ChevronRight size={16} color={TEXT_SECONDARY} strokeWidth={2} />
                              </TouchableOpacity>
                              {campusId && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                                  <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                                    onPress={() => { setShowCollege(!showCollege); HapticsService.triggerSelection(); }}
                                    activeOpacity={0.7}
                                  >
                                    <View style={{
                                      width: 18, height: 18, borderRadius: 5, borderWidth: 2,
                                      borderColor: showCollege ? ACCENT_COLOR : BORDER_COLOR,
                                      backgroundColor: showCollege ? ACCENT_COLOR : 'transparent',
                                      alignItems: 'center', justifyContent: 'center',
                                    }}>
                                      {showCollege && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                                    </View>
                                    <Text style={{ fontFamily: 'Manrope-Regular', fontSize: 13, color: TEXT_SECONDARY }}>
                                      Show college on my profile
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                    onPress={() => {
                                      setCampusId(null);
                                      setCollegeDisplayName("");
                                      setCollegeCampusName("");
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    <Trash2 size={13} color="#EF4444" strokeWidth={2} />
                                    <Text style={{ fontFamily: 'Manrope-Medium', fontSize: 13, color: '#EF4444' }}>
                                      Remove
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          );
                        }
                        // For students: replace the 'degree' field with the DegreePickerModal button
                        if (selectedOccupation === 'student' && field.key === 'degree') {
                          const currentDegree = occupationDetails['degree'] || '';
                          return (
                            <View key={field.key} style={{ marginBottom: 14 }}>
                              <Text style={styles.inputLabel}>{field.label}</Text>
                              <TouchableOpacity
                                style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                                onPress={() => { setDegreePickerTarget('student'); setShowDegreePicker(true); }}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[styles.inputText, !currentDegree && { color: TEXT_SECONDARY }]}
                                  numberOfLines={1}
                                >
                                  {currentDegree || field.placeholder}
                                </Text>
                                <ChevronRight size={16} color={TEXT_SECONDARY} strokeWidth={2} />
                              </TouchableOpacity>
                            </View>
                          );
                        }
                        return (
                          <View key={field.key} style={{ marginBottom: 14 }}>
                            <Text style={styles.inputLabel}>
                              {field.label}{field.optional ? " (OPTIONAL)" : ""}
                            </Text>
                            <TextInput
                              style={styles.input}
                              value={occupationDetails[field.key] || ""}
                              onChangeText={(text) => setOccupationDetails(prev => ({ ...prev, [field.key]: text }))}
                              placeholder={field.placeholder}
                              placeholderTextColor={TEXT_SECONDARY}
                              maxLength={200}
                              keyboardType={field.keyboardType || "default"}
                              autoCapitalize="words"
                              returnKeyType="done"
                            />
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}

                {/* Portfolio link for relevant occupations */}
                {shouldShowPortfolio(selectedOccupation, occupationCategory) && (
                  <View style={{ marginTop: selectedOccupation === "other" ? 2 : 16, marginBottom: 4 }}>
                    <Text style={styles.inputLabel}>PORTFOLIO / WEBSITE</Text>
                    <TextInput
                      style={styles.input}
                      value={portfolioLink}
                      onChangeText={setPortfolioLink}
                      placeholder="https://yourportfolio.com"
                      placeholderTextColor={TEXT_SECONDARY}
                      maxLength={255}
                      keyboardType="url"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                    />
                  </View>
                )}

                <View style={styles.divider} />
              </View>
            )}

            {/* Occupation Categories Accordion */}
            <View style={styles.categoriesContainer}>
              {Object.keys(OCCUPATION_CATEGORIES).map((key) => {
                const category = OCCUPATION_CATEGORIES[key];
                const isExpanded = occupationCategoryExpanded === key;
                const Icon = category.icon;

                // Filter out the currently selected occupation
                const availableOccupations = category.occupations.filter(
                  (occ) => occ.value !== selectedOccupation
                );

                const hasAnyOccupations = category.occupations.length > 0;
                if (!hasAnyOccupations) return null;

                return (
                  <View key={key} style={styles.categoryRow}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setOccupationCategoryExpanded(isExpanded ? null : key);
                      }}
                      style={[
                        styles.categoryHeader,
                        isExpanded && styles.categoryHeaderExpanded,
                        { backgroundColor: isExpanded ? category.bg : "transparent" },
                      ]}
                    >
                      <View style={styles.categoryHeaderLeft}>
                        <View style={[styles.categoryIcon, { backgroundColor: category.bg }]}>
                          <Icon size={14} color={category.text} />
                        </View>
                        <Text
                          style={[
                            styles.categoryTitle,
                            isExpanded && { color: category.text, fontWeight: "600" },
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
                        {availableOccupations.length === 0 ? (
                          <Text style={[styles.optionText, { color: TEXT_SECONDARY, fontStyle: 'italic', paddingLeft: 4 }]}>
                            All selected
                          </Text>
                        ) : (
                          <View style={styles.vibesContainer}>
                            {availableOccupations.map((occ) => (
                              <TouchableOpacity
                                key={occ.value}
                                onPress={() => {
                                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                  setSelectedOccupation(occ.value);
                                  if (occ.value !== "other") setCustomOccupation("");
                                  setOccupationDetails({});
                                  setOccupationCategory(null);
                                  setPortfolioLink("");
                                  HapticsService.triggerSelection();
                                }}
                                style={styles.optionChip}
                              >
                                <Text style={styles.optionText}>{occ.label}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            <Text style={styles.helperText}>Optional • Shown on your profile</Text>
          </View>
        </View>

        {/* Card 4: Education / College
             Hidden when occupation = student because student sub-fields already capture institution & degree.
             The college picker (campus_id) is surfaced inside the Occupation card when student is selected.
        */}
        {selectedOccupation !== 'student' && (
          <View style={styles.card}>
            {renderSectionHeader("EDUCATION", GraduationCap)}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>COLLEGE / UNIVERSITY</Text>
              <TouchableOpacity
                style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                onPress={() => setShowCollegePicker(true)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.inputText,
                    !collegeDisplayName && { color: TEXT_SECONDARY },
                  ]}
                  numberOfLines={1}
                >
                  {collegeDisplayName
                    ? `${collegeDisplayName}${collegeCampusName ? ` • ${collegeCampusName}` : ''}`
                    : 'Select your college...'}
                </Text>
                <ChevronRight size={16} color={TEXT_SECONDARY} strokeWidth={2} />
              </TouchableOpacity>

              {/* Show College Toggle */}
              {campusId && (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 10,
                    gap: 8,
                  }}
                  onPress={() => {
                    setShowCollege(!showCollege);
                    HapticsService.triggerSelection();
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: showCollege ? ACCENT_COLOR : BORDER_COLOR,
                      backgroundColor: showCollege ? ACCENT_COLOR : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {showCollege && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                  <Text style={{ fontFamily: 'Manrope-Regular', fontSize: 13, color: TEXT_SECONDARY }}>
                    Show college on my profile
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DEGREE / MAJOR</Text>
            <TouchableOpacity
              style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              onPress={() => { setDegreePickerTarget('education'); setShowDegreePicker(true); }}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.inputText, !educationDegree && { color: TEXT_SECONDARY }]}
                numberOfLines={1}
              >
                {educationDegree || "e.g. B.Tech Computer Science"}
              </Text>
              <ChevronRight size={16} color={TEXT_SECONDARY} strokeWidth={2} />
            </TouchableOpacity>
            </View>

            <View style={styles.inputGroupLast}>
              <Text style={styles.inputLabel}>GRADUATION YEAR</Text>
              <TextInput
                style={styles.input}
                value={educationYear}
                onChangeText={setEducationYear}
                placeholder="e.g. 2026"
                placeholderTextColor={TEXT_SECONDARY}
                maxLength={4}
                keyboardType="number-pad"
                returnKeyType="done"
              />
            </View>
          </View>
        )}

        {/* Card 5: My Vibes (Scalable Redesign) */}
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

                    const hasAnyInterests = interestsCatalog.some(
                      (i) => category.keywords.some((k) => i.toLowerCase().includes(k))
                    );

                    if (!hasAnyInterests) return null;

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
                                <Text style={[styles.optionText, { color: TEXT_SECONDARY, fontStyle: 'italic', paddingLeft: 4 }]}>
                                  All selected
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

        {/* Card 6: Private Details */}
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.helperText}>Only visible to you</Text>
              <TouchableOpacity 
                onPress={() => setEmailChangeModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.helperText, { color: ACCENT_COLOR, fontFamily: 'Manrope-SemiBold' }]}>Tap to change →</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroupLast}>
            <Text style={styles.inputLabel}>PHONE</Text>
            <TouchableWithoutFeedback onPress={() => phoneInputRef.current?.focus()}>
              <View style={[
                styles.input,
                styles.rowInput,
                { backgroundColor: "#F8F8F8" }
              ]}>
                <Phone size={16} color={"#8B95A5"} style={{ marginRight: 10 }} />
                <TextInput
                  ref={phoneInputRef}
                  style={[styles.flexInput, { color: TEXT_SECONDARY }]}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="Add phone number"
                  placeholderTextColor={TEXT_SECONDARY}
                />
              </View>
            </TouchableWithoutFeedback>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.helperText}>Only visible to you</Text>
              <TouchableOpacity 
                onPress={() => phoneInputRef.current?.focus()}
                activeOpacity={0.7}
              >
                <Text style={[styles.helperText, { color: ACCENT_COLOR, fontFamily: 'Manrope-SemiBold' }]}>Tap to change →</Text>
              </TouchableOpacity>
            </View>
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

      <CollegePickerModal
        visible={showCollegePicker}
        onClose={() => setShowCollegePicker(false)}
        currentCampusId={campusId}
        onSelect={({ campusId: newCampusId, collegeName, campusName }) => {
          setCampusId(newCampusId);
          setCollegeDisplayName(collegeName);
          setCollegeCampusName(campusName || '');
          setShowCollege(true);
        }}
        onClear={() => {
          setCampusId(null);
          setCollegeDisplayName('');
          setCollegeCampusName('');
          setShowCollege(true);
        }}
      />

      <DegreePickerModal
        visible={showDegreePicker}
        initialValue={
          degreePickerTarget === 'student'
            ? (occupationDetails['degree'] || '')
            : educationDegree
        }
        onConfirm={(degree) => {
          if (degreePickerTarget === 'student') {
            setOccupationDetails((prev) => ({ ...prev, degree }));
          } else {
            setEducationDegree(degree);
          }
        }}
        onClose={() => setShowDegreePicker(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
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
  pendingPhotoText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 2,
    textAlign: 'center',
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
  inputText: {
    fontSize: 15,
    fontFamily: FONT_INPUT,
    color: TEXT_PRIMARY,
    flex: 1,
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
