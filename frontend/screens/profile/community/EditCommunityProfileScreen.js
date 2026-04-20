import React, { useState, useEffect, useCallback, useRef } from "react";
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, Platform, Image, Modal, LayoutAnimation, UIManager, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import {
  ArrowLeft,
  Camera,
  User,
  NotebookText,
  MapPinned,
  Mail,
  Phone,
  Tag,
  Award,
  ChevronRight,
  ChevronDown,
  X,
  Plus,
  MoreHorizontal,
  Check,
  GraduationCap,
  Search,
  Users,
} from "lucide-react-native";


import { getAuthToken } from "../../../api/auth";
import {
  updateCommunityProfile,
  changeUsername,
  startEmailChange,
  verifyEmailChange,
  getCommunityProfile,
} from "../../../api/communities";
import { useCrop } from "../../../components/MediaCrop";
import { uploadImage } from "../../../api/cloudinary";
import { getSponsorTypes, apiGet } from "../../../api/client";
import EmailChangeModal from "../../../components/EmailChangeModal";
import LocationPicker from "../../../components/LocationPicker/LocationPicker";
import {
  COMMUNITY_CATEGORIES_CONFIG,
  getCategoryStyle,
  getSponsorTypeStyle,
  SPONSOR_TYPES_CONFIG,
} from "./EditCommunityProfileConstants";

import {
  COLORS,
  FONTS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import HapticsService from "../../../services/HapticsService";
import SnooLoader from "../../../components/ui/SnooLoader";

// Typography constants
const FONT_HEADER = FONTS.primary || "BasicCommercial-Bold";
const FONT_LABEL = FONTS.medium;
const INPUT_BG = "#F3F4F6";
const TEXT_PRIMARY = COLORS.textPrimary;
const TEXT_SECONDARY = COLORS.textSecondary;
const ACCENT_COLOR = COLORS.primary;
const BG_COLOR = COLORS.screenBackground || "#F9FAFB";

// Enable LayoutAnimation for Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FALLBACK_SPONSOR_TYPES = [
  "Protein brands",
  "Energy Drinks",
  "Supplements",
  "Apparel",
  "Tech Gadgets",
  "Local Businesses",
];

const CATEGORIES = [
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

export default function EditCommunityProfileScreen({ route, navigation }) {
  const profile = route?.params?.profile;

  // State initialization
  const [name, setName] = useState(profile?.name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [email, setEmail] = useState(profile?.email || "");

  const getPrimaryFromProfile = (p) =>
    p?.phone ?? p?.primary_phone ?? p?.primaryPhone ?? p?.phone_primary ?? "";
  const getSecondaryFromProfile = (p) =>
    p?.secondary_phone ??
    p?.secondaryPhone ??
    p?.secondary_phone_number ??
    p?.secondaryPhoneNumber ??
    p?.phone_secondary ??
    "";
  const sanitizePhoneValue = (value) =>
    String(value || "")
      .replace(/\D/g, "")
      .slice(0, 10);

  const initialPrimaryPhone = sanitizePhoneValue(
    getPrimaryFromProfile(profile),
  );
  const initialSecondaryPhone = sanitizePhoneValue(
    getSecondaryFromProfile(profile),
  );

  const profileRef = useRef({
    ...(profile || {}),
    phone: initialPrimaryPhone,
    secondary_phone: initialSecondaryPhone,
  });

  const [primaryPhone, setPrimaryPhone] = useState(initialPrimaryPhone);
  const [secondaryPhone, setSecondaryPhone] = useState(initialSecondaryPhone);

  const initialCategories =
    Array.isArray(profile?.categories) && profile.categories.length
      ? profile.categories
      : profile?.category
        ? [profile.category]
        : [];
  const [categories, setCategories] = useState(initialCategories);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [sponsorTypes, setSponsorTypes] = useState(
    profile?.sponsor_types || [],
  );
  // sponsoringEnabled: true if community is actively seeking sponsors
  const [sponsoringEnabled, setSponsoringEnabled] = useState(
    Array.isArray(profile?.sponsor_types) && profile.sponsor_types.length > 0,
  );
  // autoJoinEnabled: community automatically invites followers to its group chat
  const [autoJoinEnabled, setAutoJoinEnabled] = useState(
    profile?.auto_join_group_chat === true,
  );

  const [location, setLocation] = useState(profile?.location || null);


  const [availableSponsorTypes, setAvailableSponsorTypes] = useState(
    FALLBACK_SPONSOR_TYPES,
  );
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [emailChangeModalVisible, setEmailChangeModalVisible] = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [locationActionsModalVisible, setLocationActionsModalVisible] =
    useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const [logoUrl, setLogoUrl] = useState(
    profile?.logo_url ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        profile?.name || "Community",
      )}&background=5f27cd&color=FFFFFF&size=120&bold=true`,
  );
  const [bannerUrl, setBannerUrl] = useState(profile?.banner_url || null);

  // College affiliation
  const [collegeInfo, setCollegeInfo] = useState(profile?.college_info || null);
  const [showCollegeSearch, setShowCollegeSearch] = useState(false);
  const [collegeSearchQuery, setCollegeSearchQuery] = useState("");
  const [collegeSearchResults, setCollegeSearchResults] = useState([]);
  const [collegeSearching, setCollegeSearching] = useState(false);
  const [savingCollege, setSavingCollege] = useState(false);

  const allowLeaveRef = useRef(false);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    const loadSponsorTypes = async () => {
      try {
        const types = await getSponsorTypes();
        setAvailableSponsorTypes(types.map((t) => t.name));
      } catch (error) {
        console.error("Failed to load sponsor types:", error);
      }
    };
    loadSponsorTypes();
  }, []);

  useEffect(() => {
    checkForChanges();
  }, [
    name,
    bio,
    username,
    primaryPhone,
    secondaryPhone,
    categories,
    sponsorTypes,
    sponsoringEnabled,
    autoJoinEnabled,
    email,
    location,
  ]);


  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (!hasChanges || isSaving || allowLeaveRef.current) {
        return;
      }
      e.preventDefault();
      Alert.alert(
        "Unsaved changes",
        "You have unsaved changes. Are you sure you want to cancel?",
        [
          { text: "No", style: "cancel" },
          {
            text: "Yes",
            style: "destructive",
            onPress: () => {
              allowLeaveRef.current = true;
              navigation.dispatch(e.data.action);
            },
          },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, hasChanges, isSaving]);

  const checkForChanges = () => {
    const sourceProfile = profileRef.current || {};
    const normalizeArray = (arr) => (arr ? [...arr].sort() : []);

    // Normalization logic matching original file
    const originalCategories =
      Array.isArray(sourceProfile?.categories) &&
      sourceProfile.categories.length
        ? sourceProfile.categories
        : sourceProfile?.category
          ? [sourceProfile.category]
          : [];

    const changed =
      name !== (sourceProfile?.name || "") ||
      bio !== (sourceProfile?.bio || "") ||
      username !== (sourceProfile?.username || "") ||
      primaryPhone !==
        sanitizePhoneValue(getPrimaryFromProfile(sourceProfile)) ||
      secondaryPhone !==
        sanitizePhoneValue(getSecondaryFromProfile(sourceProfile)) ||
      email !== (sourceProfile?.email || "") ||
      JSON.stringify(normalizeArray(categories)) !==
        JSON.stringify(normalizeArray(originalCategories)) ||
      JSON.stringify(normalizeArray(sponsorTypes)) !==
        JSON.stringify(normalizeArray(sourceProfile?.sponsor_types || [])) ||
      sponsoringEnabled !== (Array.isArray(sourceProfile?.sponsor_types) && sourceProfile.sponsor_types.length > 0) ||
      autoJoinEnabled !== (sourceProfile?.auto_join_group_chat === true) ||
      JSON.stringify(location) !==
        JSON.stringify(sourceProfile?.location || null);


    setHasChanges(!!changed);
  };

  const checkUsernameAvailability = useCallback(async (value) => {
    if (!value || value === profileRef.current?.username) {
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
  }, []);

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

  const handleCollegeSearch = async (query) => {
    setCollegeSearchQuery(query);
    if (query.length < 2) { setCollegeSearchResults([]); return; }
    setCollegeSearching(true);
    try {
      const token = await getAuthToken();
      const res = await apiGet(`/colleges?search=${encodeURIComponent(query)}`, 10000, token);
      setCollegeSearchResults(Array.isArray(res?.colleges) ? res.colleges : []);
    } catch (e) {
      setCollegeSearchResults([]);
    } finally {
      setCollegeSearching(false);
    }
  };

  const handleSelectCollege = async (college) => {
    setSavingCollege(true);
    try {
      const token = await getAuthToken();
      // search API returns: { id: campus_id, college_id, name: college_name, campus_name, city, abbreviation }
      const campusId = college.id || college.campus_id || null;
      const collegeId = college.college_id || null;
      await updateCommunityProfile({ college_id: collegeId, campus_id: campusId }, token);
      setCollegeInfo({
        college_id: collegeId,
        college_name: college.name || college.college_name,
        college_abbreviation: college.abbreviation || null,
        college_status: 'approved', // search only returns approved colleges
        campus_id: campusId,
        campus_name: college.campus_name || null,
        campus_city: college.city || null,
        community_type: profile?.community_type,
        college_subtype: (profile?.college_info || collegeInfo)?.college_subtype,
        club_type: (profile?.college_info || collegeInfo)?.club_type,
      });
      setShowCollegeSearch(false);
      setCollegeSearchQuery('');
      setCollegeSearchResults([]);
      HapticsService.triggerNotificationSuccess();
      Alert.alert('College linked!', `${college.name || college.college_name} has been linked to your community.`);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to link college');
    } finally {
      setSavingCollege(false);
    }
  };

  const handleChangeLogo = async () => {
    try {
      const result = await pickAndCrop("avatar");
      if (!result) return;

      setUploadingPhoto(true);
      const secureUrl = await uploadImage(result.uri);
      const token = await getAuthToken();
      await (
        await import("../../../api/client")
      ).apiPost(
        "/communities/profile/logo",
        { logo_url: secureUrl },
        15000,
        token,
      );
      setLogoUrl(secureUrl);
      HapticsService.triggerNotificationSuccess();
    } catch (e) {
      Alert.alert("Update failed", e?.message || "Could not update logo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleChangeBanner = async () => {
    try {
      const result = await pickAndCrop("banner");
      if (!result) return;

      setUploadingBanner(true);
      const secureUrl = await uploadImage(result.uri);
      const token = await getAuthToken();
      await updateCommunityProfile({ banner_url: secureUrl }, token);
      setBannerUrl(secureUrl);
      HapticsService.triggerNotificationSuccess();
    } catch (e) {
      Alert.alert("Update failed", e?.message || "Could not update banner");
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    // If sponsoring is enabled, require at least 3 types before saving
    if (sponsoringEnabled && sponsorTypes.length < 3) {
      Alert.alert(
        "Select more sponsor types",
        "Please select at least 3 sponsor types before saving.",
      );
      return;
    }

    try {
      setIsSaving(true);
      const token = await getAuthToken();

      const normalizedCategories = Array.from(
        new Set(
          (categories || [])
            .map((c) => (typeof c === "string" ? c.trim() : ""))
            .filter((c) => c),
        ),
      ).slice(0, 3);

      if (normalizedCategories.length === 0) {
        Alert.alert("Error", "Please select at least one category.");
        setIsSaving(false);
        return;
      }

      if (primaryPhone.length !== 10) {
        Alert.alert(
          "Invalid phone",
          "Primary phone number must be exactly 10 digits.",
        );
        setIsSaving(false);
        return;
      }

      const updates = {
        name: name.trim(),
        bio: bio.trim(),
        phone: primaryPhone,
        primary_phone: primaryPhone,
        secondary_phone: secondaryPhone || null,
        category: normalizedCategories[0],
        categories: normalizedCategories,
        // If sponsoring is disabled, send empty array; otherwise send selected types
        sponsor_types: sponsoringEnabled ? sponsorTypes : [],
        auto_join_group_chat: autoJoinEnabled,
        location: location,
      };


      await updateCommunityProfile(updates, token);

      if (username !== (profileRef.current?.username || profile?.username)) {
        await changeUsername(username, token);
      }

      HapticsService.triggerNotificationSuccess();
      allowLeaveRef.current = true;
      setHasChanges(false);
      navigation.navigate("Profile", { refreshProfile: true });
    } catch (error) {
      Alert.alert("Error", error?.message || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
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
      {/* Header Matches EditProfileScreen exactly */}
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
          disabled={!hasChanges || isSaving || (sponsoringEnabled && sponsorTypes.length < 3)}
          style={[
            styles.saveButton,
            (!hasChanges || isSaving || (sponsoringEnabled && sponsorTypes.length < 3)) && styles.saveButtonDisabled,
          ]}
        >
          {isSaving ? (
            <SnooLoader size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
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
        {/* Visuals Card */}
        <View style={styles.visualsContainer}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleChangeBanner}
            style={styles.bannerWrapper}
          >
            {bannerUrl ? (
              <Image source={{ uri: bannerUrl }} style={styles.bannerImage} />
            ) : (
              <View style={styles.bannerPlaceholder}>
                <Text style={styles.bannerPlaceholderText}>
                  Tap to add cover
                </Text>
              </View>
            )}
            <View style={[styles.cameraButton, styles.bannerCamera]}>
              {uploadingBanner ? (
                <SnooLoader size="small" color="#FFFFFF" />
              ) : (
                <Camera size={16} color="#FFFFFF" strokeWidth={2.5} />
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleChangeLogo}
            style={styles.logoWrapper}
          >
            <Image source={{ uri: logoUrl }} style={styles.logoImage} />
            <View style={[styles.cameraButton, styles.logoCamera]}>
              {uploadingPhoto ? (
                <SnooLoader size="small" color="#FFFFFF" />
              ) : (
                <Camera size={16} color="#FFFFFF" strokeWidth={2.5} />
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* The Basics */}
        <View style={styles.card}>
          {renderSectionHeader("THE BASICS", User)}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>COMMUNITY NAME</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Community Name"
              placeholderTextColor={TEXT_SECONDARY}
              maxLength={50}
            />
          </View>
          <View style={styles.inputGroupLast}>
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
                <View style={[styles.indicator, { marginLeft: 8 }]}>
                  <Check size={16} color="#10B981" strokeWidth={3} />
                </View>
              )}
              {!usernameChecking &&
                usernameAvailable === false &&
                username !== profile?.username && (
                  <X size={16} color="#EF4444" strokeWidth={3} />
                )}
            </View>
            <Text style={styles.helperText}>
              This will be your unique handle.
            </Text>
          </View>
        </View>

        {/* About */}
        <View style={styles.card}>
          {renderSectionHeader("ABOUT", NotebookText)}
          <View style={styles.inputGroupLast}>
            <TextInput
              style={styles.bioInput}
              value={bio}
              onChangeText={setBio}
              multiline
              placeholder="Describe your community..."
              placeholderTextColor={TEXT_SECONDARY}
              maxLength={500}
            />
            <Text style={styles.charCount}>{bio.length} / 500</Text>
          </View>
        </View>

        {/* Categories (My Vibes Style) */}
        <View style={styles.card}>
          {renderSectionHeader("CATEGORIES", Tag)}
          <View style={[styles.inputGroupLast, { paddingTop: 10 }]}>
            {/* Selected Categories */}
            {categories.length > 0 && (
              <View style={styles.selectedVibesSection}>
                <View style={styles.vibesContainer}>
                  {categories.map((cat) => {
                    const style = getCategoryStyle(cat);
                    const Icon = style.icon;
                    return (
                      <TouchableOpacity
                        key={cat}
                        activeOpacity={0.7}
                        onPress={() => {
                          LayoutAnimation.configureNext(
                            LayoutAnimation.Presets.easeInEaseOut,
                          );
                          setCategories(categories.filter((c) => c !== cat));
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

            {/* Category Groups */}
            <View style={styles.categoriesContainer}>
              {Object.keys(COMMUNITY_CATEGORIES_CONFIG)
                .filter((key) => key !== "DEFAULT")
                .map((key) => {
                  const categoryConfig = COMMUNITY_CATEGORIES_CONFIG[key];
                  const isExpanded = expandedCategory === key;
                  const Icon = categoryConfig.icon;

                  // Filter predefined categories (basic list + matches)
                  const categoryItems = CATEGORIES.filter((c) => {
                    const style = getCategoryStyle(c);
                    // Match if style matches current config block, excluding already selected
                    return (
                      style.label === categoryConfig.label &&
                      !categories.includes(c)
                    );
                  });

                  const hasAnyItems = CATEGORIES.some((c) => {
                    const style = getCategoryStyle(c);
                    return style.label === categoryConfig.label;
                  });

                  if (!hasAnyItems) return null;

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
                              ? categoryConfig.bg
                              : "transparent",
                          },
                        ]}
                      >
                        <View style={styles.categoryHeaderLeft}>
                          <View
                            style={[
                              styles.categoryIcon,
                              { backgroundColor: categoryConfig.bg },
                            ]}
                          >
                            <Icon size={14} color={categoryConfig.text} />
                          </View>
                          <Text
                            style={[
                              styles.categoryTitle,
                              isExpanded && {
                                color: categoryConfig.text,
                                fontWeight: "600",
                              },
                            ]}
                          >
                            {categoryConfig.label}
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
                          {categoryItems.length === 0 ? (
                            <Text style={[styles.optionText, { color: TEXT_SECONDARY, fontStyle: 'italic', paddingLeft: 4 }]}>
                              All selected
                            </Text>
                          ) : (
                            <View style={styles.vibesContainer}>
                              {categoryItems.map((item) => (
                                <TouchableOpacity
                                key={item}
                                onPress={() => {
                                  if (categories.length >= 3) {
                                    Alert.alert(
                                      "Limit Reached",
                                      "You can select up to 3 categories.",
                                    );
                                    return;
                                  }
                                  setCategories([...categories, item]);
                                  HapticsService.triggerSelection();
                                }}
                                style={styles.optionChip}
                              >
                                  <Text style={styles.optionText}>{item}</Text>
                                  <Plus size={14} color={TEXT_SECONDARY} />
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
          </View>
        </View>

        {/* Sponsor Types */}
        <View style={styles.card}>
          {renderSectionHeader("SPONSOR TYPES", Award)}

          {/* Toggle row */}
          <View style={styles.sponsorToggleRow}>
            <View style={styles.sponsorToggleTextGroup}>
              <Text style={styles.sponsorToggleLabel}>Looking for Sponsors</Text>
              <Text style={styles.sponsorToggleSubLabel}>
                {sponsoringEnabled ? "Select the types you want" : "Not seeking sponsors right now"}
              </Text>
            </View>
            <Switch
              value={sponsoringEnabled}
              onValueChange={(val) => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setSponsoringEnabled(val);
                // Do NOT clear sponsorTypes — preserve silently so selections restore on re-enable
                HapticsService.triggerSelection();
              }}
              trackColor={{ false: "rgba(0,0,0,0.08)", true: ACCENT_COLOR }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="rgba(0,0,0,0.08)"
            />
          </View>

          {/* Picker (only shown when looking for sponsors) */}
          {sponsoringEnabled && (
          <View style={[styles.inputGroupLast, { paddingTop: 10 }]}>
            <View style={styles.vibesContainer}>
              {["Open to All", ...availableSponsorTypes].map((type) => {
                const isSelected = sponsorTypes.includes(type);
                const style = getSponsorTypeStyle(type);
                return (
                  <TouchableOpacity
                    key={type}
                    activeOpacity={0.7}
                    onPress={() => {
                      let newTypes;
                      if (type === "Open to All") {
                        // If selecting Open, clear others
                        newTypes = isSelected ? [] : ["Open to All"];
                      } else {
                        // If selecting others, remove Open
                        newTypes = isSelected
                          ? sponsorTypes.filter((t) => t !== type)
                          : [
                              ...sponsorTypes.filter(
                                (t) => t !== "Open to All",
                              ),
                              type,
                            ];
                      }
                      setSponsorTypes(newTypes);
                      HapticsService.triggerSelection();
                    }}
                    style={[
                      isSelected ? styles.vibeChip : styles.optionChip,
                      isSelected && {
                        backgroundColor: style.bg,
                        paddingRight: 8,
                        borderColor: "transparent",
                      },
                    ]}
                  >
                    {isSelected ? (
                      <>
                        <View style={styles.vibeContent}>
                          <Text
                            style={[
                              styles.vibeText,
                              { color: style.text, marginLeft: 0 },
                            ]}
                          >
                            {type}
                          </Text>
                        </View>
                        <View style={styles.removeIconContainer}>
                          <X size={12} color={style.text} strokeWidth={3} />
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={styles.optionText}>{type}</Text>
                        <Plus size={14} color={TEXT_SECONDARY} />
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* Inline hint — only shown when toggle is ON and fewer than 3 types selected */}
            {sponsorTypes.length < 3 && (
              <Text style={styles.sponsorHintText}>
                Select at least 3 sponsor types
              </Text>
            )}
          </View>
          )}
        </View>

        {/* Contact Details */}
        <View style={styles.card}>
          {renderSectionHeader("CONTACT DETAILS", Phone)}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>EMAIL</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setEmailChangeModalVisible(true)}
            >
              <Text style={{ color: TEXT_PRIMARY }}>{email}</Text>
            </TouchableOpacity>
            <Text style={styles.helperText}>Only visible to you</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>PRIMARY PHONE</Text>
            <TextInput
              style={styles.input}
              value={primaryPhone}
              onChangeText={(val) => setPrimaryPhone(sanitizePhoneValue(val))}
              keyboardType="phone-pad"
              placeholder="+1 (555) 000-0000"
              placeholderTextColor={TEXT_SECONDARY}
            />
          </View>

          <View style={styles.inputGroupLast}>
            <Text style={styles.inputLabel}>SECONDARY PHONE</Text>
            <TextInput
              style={styles.input}
              value={secondaryPhone}
              onChangeText={(val) => setSecondaryPhone(sanitizePhoneValue(val))}
              keyboardType="phone-pad"
              placeholder="Optional"
              placeholderTextColor={TEXT_SECONDARY}
            />
          </View>
        </View>

        {/* Location */}
        <View style={styles.card}>
          {renderSectionHeader("LOCATION", MapPinned)}
          <View style={styles.locationRow}>
            <TouchableOpacity
              style={styles.locationInfo}
              onPress={() => setLocationPickerVisible(true)}
            >
              <View>
                <Text style={styles.locationTitle} numberOfLines={1}>
                  {location
                    ? location.address
                      ? location.address.split(",")[0]
                      : "Location Set"
                    : "Add Location"}
                </Text>
                {location && (
                  <Text style={styles.locationSubtitle} numberOfLines={2}>
                    {location.address || "Tap to set location"}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setLocationActionsModalVisible(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MoreHorizontal size={24} color="#22C55E" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>



        {/* College Affiliation — only for college_affiliated communities */}
        {profile?.community_type === 'college_affiliated' && (
          <View style={styles.card}>
            {renderSectionHeader("COLLEGE AFFILIATION", GraduationCap)}
            <View style={styles.inputGroupLast}>
              {collegeInfo?.college_name ? (
                <View style={styles.collegeLinkedRow}>
                  <View style={styles.collegeLinkedInfo}>
                    <Text style={styles.collegeLinkedName}>{collegeInfo.college_name}</Text>
                    {collegeInfo.campus_name && (
                      <Text style={styles.collegeLinkedSub}>{collegeInfo.campus_name} • {collegeInfo.campus_city}</Text>
                    )}
                    <View style={[styles.statusBadge, collegeInfo.college_status === 'approved' ? styles.statusApproved : styles.statusPending]}>
                      <Text style={[styles.statusText, collegeInfo.college_status === 'approved' ? styles.statusTextApproved : styles.statusTextPending]}>
                        {collegeInfo.college_status === 'approved' ? '✓ Verified' : '⏳ Pending verification'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowCollegeSearch(true)}
                    style={styles.changeCollegeBtn}
                  >
                    <Text style={styles.changeCollegeBtnText}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.linkCollegeBtn}
                  onPress={() => setShowCollegeSearch(true)}
                >
                  <GraduationCap size={18} color={ACCENT_COLOR} strokeWidth={2} />
                  <Text style={styles.linkCollegeBtnText}>Link your college</Text>
                  <ChevronRight size={16} color={ACCENT_COLOR} />
                </TouchableOpacity>
              )}
              <Text style={styles.helperText}>
                Linking your college lets your community appear in the college hub.
              </Text>
            </View>
          </View>
        )}


        {/* Group Chat Settings */}
        <View style={styles.card}>
          {renderSectionHeader("GROUP CHAT SETTINGS", Users)}
          <View style={styles.inputGroupLast}>
            <View style={gcStyles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={gcStyles.toggleTitle}>Auto-add followers</Text>
                <Text style={gcStyles.toggleSub}>
                  When someone follows your community, show them an invite to join your group chat. Members who register for your events will also be prompted even if they don't follow yet.
                </Text>
              </View>
              <Switch
                value={autoJoinEnabled}
                onValueChange={(v) => { setAutoJoinEnabled(v); HapticsService.triggerSelection(); }}
                trackColor={{ false: "#E5E7EB", true: ACCENT_COLOR }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#E5E7EB"
              />
            </View>
            {autoJoinEnabled && (
              <Text style={gcStyles.hint}>
                Make sure you have created a group chat first. Members can leave at any time.
              </Text>
            )}
          </View>
        </View>

        <View style={{ height: 40 }} />

      </KeyboardAwareScrollView>

      <EmailChangeModal
        visible={emailChangeModalVisible}
        currentEmail={email}
        onClose={() => setEmailChangeModalVisible(false)}
        onComplete={(newEmail) => {
          setEmail(newEmail);
          setEmailChangeModalVisible(false);
        }}
        startEmailChange={startEmailChange}
        verifyEmailChange={verifyEmailChange}
      />

      <Modal
        visible={locationPickerVisible}
        animationType="slide"
        onRequestClose={() => setLocationPickerVisible(false)}
      >
        <LocationPicker
          businessName={profile?.name}
          initialLocation={location}
          onLocationSelected={(loc) => {
            setLocation(loc);
            setLocationPickerVisible(false);
          }}
          onCancel={() => setLocationPickerVisible(false)}
        />
      </Modal>

      {/* Location Actions Modal */}
      <Modal
        visible={locationActionsModalVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setLocationActionsModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLocationActionsModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setLocationActionsModalVisible(false)}
            >
              <X size={24} color={TEXT_PRIMARY} />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Edit Location</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setLocationActionsModalVisible(false);
                  setLocationPickerVisible(true);
                }}
              >
                <Text style={styles.modalButtonText}>Change Location</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDestructive]}
                onPress={() => {
                  setLocationActionsModalVisible(false);
                  setLocation(null);
                }}
              >
                <Text
                  style={[
                    styles.modalButtonText,
                    styles.modalButtonTextDestructive,
                  ]}
                >
                  Remove Location
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* College Search Modal */}
      <Modal
        visible={showCollegeSearch}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowCollegeSearch(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => { setShowCollegeSearch(false); setCollegeSearchQuery(''); setCollegeSearchResults([]); }}
              style={styles.headerButtonLeft}
            >
              <X size={24} color={TEXT_SECONDARY} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Link College</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
            <View style={styles.collegeSearchBox}>
              <GraduationCap size={18} color={TEXT_SECONDARY} strokeWidth={1.5} />
              <TextInput
                style={styles.collegeSearchInput}
                placeholder="Search by college name or city..."
                placeholderTextColor={TEXT_SECONDARY}
                value={collegeSearchQuery}
                onChangeText={handleCollegeSearch}
                autoFocus
              />
              {collegeSearching && <SnooLoader size="small" color={ACCENT_COLOR} />}
            </View>
          </View>

          <KeyboardAwareScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16 }}>
            {collegeSearchResults.length === 0 && collegeSearchQuery.length >= 2 && !collegeSearching && (
              <Text style={{ color: TEXT_SECONDARY, textAlign: 'center', marginTop: 32, fontFamily: 'Manrope-Regular' }}>
                No colleges found. Try a different name.
              </Text>
            )}
            {collegeSearchResults.map((college, i) => (
              <TouchableOpacity
                key={college.campus_id || college.college_id || i}
                style={styles.collegeResultRow}
                onPress={() => handleSelectCollege(college)}
                disabled={savingCollege}
              >
                <View style={styles.collegeResultIcon}>
                  <GraduationCap size={18} color={ACCENT_COLOR} strokeWidth={1.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.collegeResultName}>{college.college_name || college.name}</Text>
                  {(college.campus_name || college.city) && (
                    <Text style={styles.collegeResultSub}>
                      {[college.campus_name, college.city].filter(Boolean).join(' • ')}
                    </Text>
                  )}
                </View>
                {college.status === 'approved' && (
                  <Check size={16} color="#16A34A" strokeWidth={2.5} />
                )}
              </TouchableOpacity>
            ))}
          </KeyboardAwareScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
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
  headerTitle: {
    fontSize: 17,
    fontFamily: FONT_HEADER,
    color: TEXT_PRIMARY,
    letterSpacing: 0.3,
  },
  headerButtonLeft: {
    position: "absolute",
    left: 8,
    padding: 12,
    zIndex: 1,
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
    fontFamily: FONTS.medium,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    gap: 24,
  },

  // Visuals
  visualsContainer: {
    marginBottom: 8,
    alignItems: "center",
  },
  bannerWrapper: {
    width: "100%",
    aspectRatio: 2.8,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
    marginBottom: -40, // overlap with logo
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  bannerPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D1D5DB",
  },
  bannerPlaceholderText: {
    fontFamily: FONTS.medium,
    color: "#6B7280",
  },
  logoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 50,
  },
  cameraButton: {
    position: "absolute",
    backgroundColor: ACCENT_COLOR,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  bannerCamera: {
    bottom: 12,
    right: 12,
  },
  logoCamera: {
    bottom: 2,
    right: 2,
  },

  // Card
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...SHADOWS.sm,
    shadowOpacity: 0.05,
    elevation: 2,
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
    backgroundColor: "rgba(0,0,0,0.03)",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: FONT_HEADER,
    color: TEXT_PRIMARY,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  subheaderRow: {
    position: "absolute",
    right: 16,
    top: 16,
  },
  sponsorToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
  },
  sponsorToggleTextGroup: {
    flex: 1,
    marginRight: 12,
  },
  sponsorToggleLabel: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  sponsorToggleSubLabel: {
    fontSize: 12,
    fontFamily: "Manrope-Regular",
    color: TEXT_SECONDARY,
  },
  sponsorHintText: {
    fontSize: 12,
    fontFamily: "Manrope-Regular",
    color: "#B45309",
    marginTop: 10,
    marginLeft: 2,
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
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: INPUT_BG,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: TEXT_PRIMARY,
  },
  bioInput: {
    backgroundColor: INPUT_BG,
    borderRadius: 16,
    padding: 16,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: TEXT_PRIMARY,
    minHeight: 120,
    textAlignVertical: "top",
  },
  rowInput: {
    flexDirection: "row",
    alignItems: "center",
  },
  prefix: {
    color: TEXT_SECONDARY,
    marginRight: 4,
    fontFamily: FONTS.medium,
    fontSize: 15,
  },
  flexInput: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: TEXT_PRIMARY,
    padding: 0,
  },
  helperText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 6,
    marginLeft: 4,
  },
  charCount: {
    textAlign: "right",
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 6,
    marginRight: 4,
  },
  indicator: {
    flexDirection: "row",
    alignItems: "center",
  },

  // Location
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: INPUT_BG,
    padding: 12,
    borderRadius: 12,
  },
  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  locationIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  locationTitle: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  locationSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: TEXT_SECONDARY,
    maxWidth: 200,
  },
  changeText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    color: TEXT_PRIMARY,
  },

  // Chip Styling (My Vibes Match)
  selectedVibesSection: {
    marginBottom: 12,
  },
  vibesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  vibeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 20,
    // Minimum touch area
    minHeight: 32,
  },
  vibeContent: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 6,
  },
  vibeText: {
    marginLeft: 6,
    fontSize: 13,
    fontFamily: FONTS.medium,
  },
  removeIconContainer: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    gap: 6,
    marginBottom: 4,
  },
  optionText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: TEXT_PRIMARY,
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 12,
  },
  categoriesContainer: {
    marginTop: 4,
  },
  categoryRow: {
    marginBottom: 8,
    borderRadius: 16,
    overflow: "hidden",
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  categoryHeaderExpanded: {
    // Background color applied dynamically
  },
  categoryHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  categoryTitle: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: TEXT_PRIMARY,
  },
  categoryContent: {
    padding: 16,
    paddingTop: 8,
    gap: 12,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalCloseButton: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: FONT_HEADER,
    color: TEXT_PRIMARY,
    marginBottom: 32,
    marginTop: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: TEXT_SECONDARY,
    marginBottom: 24,
    textAlign: "center",
  },
  modalButtons: {
    width: "100%",
    gap: 12,
  },
  modalButton: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonDestructive: {
    backgroundColor: "#FEF2F2",
  },
  modalButtonText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: TEXT_PRIMARY,
  },
  modalButtonTextDestructive: {
    color: "#EF4444",
  },

  // College affiliation styles
  collegeLinkedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  collegeLinkedInfo: {
    flex: 1,
    marginRight: 12,
  },
  collegeLinkedName: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 14,
    color: '#1E40AF',
    marginBottom: 2,
  },
  collegeLinkedSub: {
    fontFamily: 'Manrope-Regular',
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusApproved: {
    backgroundColor: '#DCFCE7',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 11,
  },
  statusTextApproved: {
    color: '#16A34A',
  },
  statusTextPending: {
    color: '#D97706',
  },
  changeCollegeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  changeCollegeBtnText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 13,
    color: '#2563EB',
  },
  linkCollegeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  linkCollegeBtnText: {
    flex: 1,
    fontFamily: 'Manrope-SemiBold',
    fontSize: 14,
    color: '#2563EB',
  },
  collegeSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  collegeSearchInput: {
    flex: 1,
    fontFamily: 'Manrope-Regular',
    fontSize: 14,
    color: TEXT_PRIMARY,
    padding: 0,
  },
  collegeResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  collegeResultIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collegeResultName: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 14,
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  collegeResultSub: {
    fontFamily: 'Manrope-Regular',
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
});

const gcStyles = StyleSheet.create({
  toggleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    paddingVertical: 4,
  },
  toggleTitle: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  toggleSub: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 18,
    paddingRight: 8,
  },
  hint: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: ACCENT_COLOR,
    marginTop: 10,
    lineHeight: 17,
  },
});


