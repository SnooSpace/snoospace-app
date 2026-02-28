import React, { useState, useEffect, useCallback, useRef } from "react";
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, Platform, Image, Modal, LayoutAnimation, UIManager } from "react-native";
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
import { getSponsorTypes } from "../../../api/client";
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
  const [expandedCategory, setExpandedCategory] = useState("LIFESTYLE");
  const [sponsorTypes, setSponsorTypes] = useState(
    profile?.sponsor_types || [],
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

    const isOpenToAll =
      sponsorTypes.length === 1 && sponsorTypes[0] === "Open to All";
    if (!isOpenToAll && sponsorTypes.length < 3) {
      Alert.alert(
        "Error",
        "Please select at least 3 sponsor types or 'Open to All'",
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
        sponsor_types: sponsorTypes,
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
          disabled={!hasChanges || isSaving}
          style={[
            styles.saveButton,
            (!hasChanges || isSaving) && styles.saveButtonDisabled,
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
                <View style={styles.indicator}>
                  <Text style={{ color: "green" }}>✓</Text>
                </View>
              )}
              {!usernameChecking &&
                usernameAvailable === false &&
                username !== profile?.username && (
                  <Text style={{ color: "red" }}>✕</Text>
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
          <View style={styles.subheaderRow}>
            <Text style={styles.helperText}>Select Min 3</Text>
          </View>
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
          </View>
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
});
