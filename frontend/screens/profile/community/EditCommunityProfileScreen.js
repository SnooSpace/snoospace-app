import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
  Modal,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import {
  ArrowLeft,
  Camera,
  User,
  NotebookText,
  MapPin,
  Mail,
  Phone,
  Tag,
  Award,
  ChevronRight,
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
import ChipSelector from "../../../components/ChipSelector";
import EmailChangeModal from "../../../components/EmailChangeModal";
import LocationPicker from "../../../components/LocationPicker/LocationPicker";

import {
  COLORS,
  FONTS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import HapticsService from "../../../services/HapticsService";

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

  const [saving, setSaving] = useState(false);
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
      if (!hasChanges || saving || allowLeaveRef.current) {
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
  }, [navigation, hasChanges, saving]);

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
      setSaving(true);
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
        setSaving(false);
        return;
      }

      if (primaryPhone.length !== 10) {
        Alert.alert(
          "Invalid phone",
          "Primary phone number must be exactly 10 digits.",
        );
        setSaving(false);
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
      setSaving(false);
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
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Camera size={14} color="#FFF" />
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
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Camera size={14} color="#FFF" />
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
                <ActivityIndicator size="small" color={ACCENT_COLOR} />
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

        {/* Categories */}
        <View style={styles.card}>
          {renderSectionHeader("CATEGORIES", Tag)}
          <View style={[styles.inputGroupLast, { paddingTop: 10 }]}>
            <ChipSelector
              selected={categories}
              onSelectionChange={(selected) => {
                HapticsService.triggerSelection();
                const sanitized = Array.from(new Set(selected || [])).slice(
                  0,
                  3,
                );
                setCategories(sanitized);
              }}
              presets={CATEGORIES}
              allowCustom={true}
              maxSelections={3}
              placeholder="Add category"
            />
          </View>
        </View>

        {/* Sponsor Types */}
        <View style={styles.card}>
          {renderSectionHeader("SPONSOR TYPES", Award)}
          <View style={styles.subheaderRow}>
            <Text style={styles.helperText}>Select Min 3</Text>
          </View>
          <View style={[styles.inputGroupLast, { paddingTop: 10 }]}>
            <ChipSelector
              selected={sponsorTypes}
              onSelectionChange={(selected) => {
                if (selected.includes("Open to All")) {
                  setSponsorTypes(["Open to All"]);
                } else {
                  setSponsorTypes(selected.filter((s) => s !== "Open to All"));
                }
              }}
              presets={["Open to All", ...availableSponsorTypes]}
              allowCustom={false}
              maxSelections={20}
              placeholder="Add sponsor type"
            />
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
          {renderSectionHeader("LOCATION", MapPin)}
          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => setLocationPickerVisible(true)}
          >
            <View style={styles.locationInfo}>
              <View style={styles.locationIconBg}>
                <MapPin
                  size={20}
                  color={ACCENT_COLOR}
                  fill={COLORS.primaryLight}
                />
              </View>
              <View>
                <Text style={styles.locationTitle}>
                  {location
                    ? location.name || location.city || "Selected Location"
                    : "Add Location"}
                </Text>
                <Text style={styles.locationSubtitle}>
                  {location
                    ? location.address ||
                      [location.city, location.state].filter(Boolean).join(", ")
                    : "Tap to set location"}
                </Text>
              </View>
            </View>
            <Text style={styles.changeText}>Change</Text>
          </TouchableOpacity>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
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
    borderWidth: 4,
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
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  bannerCamera: {
    bottom: 12,
    right: 12,
  },
  logoCamera: {
    bottom: 0,
    right: 0,
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
});
