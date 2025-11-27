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
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getAuthToken } from "../../../api/auth";
import {
  updateCommunityProfile,
  changeUsername,
  startEmailChange,
  verifyEmailChange,
  getCommunityProfile,
} from "../../../api/communities";
import {
  launchImageLibraryAsync,
  requestMediaLibraryPermissionsAsync,
  MediaTypeOptions,
} from "expo-image-picker";
import { uploadImage } from "../../../api/cloudinary";
import ChipSelector from "../../../components/ChipSelector";
import EmailChangeModal from "../../../components/EmailChangeModal";
import LocationPicker from "../../../components/LocationPicker/LocationPicker";

const PRIMARY_COLOR = "#5f27cd";
const TEXT_COLOR = "#1e1e1e";
const LIGHT_TEXT_COLOR = "#6c757d";

const SPONSOR_TYPES = [
  'Protein brands', 'Energy Drinks', 'Supplements', 'Apparel',
  'Tech Gadgets', 'Local Businesses',
];

const CATEGORIES = [
  'Sports', 'Music', 'Technology', 'Travel', 'Food & Drink',
  'Art & Culture', 'Fitness', 'Gaming', 'Movies', 'Books',
  'Fashion', 'Photography', 'Outdoors', 'Volunteering', 'Networking',
];

export default function EditCommunityProfileScreen({ route, navigation }) {
  const profile = route?.params?.profile;
  useEffect(() => {
    console.log("[EditCommunityProfile] route profile", {
      phone: profile?.phone,
      primary_phone: profile?.primary_phone,
      secondary_phone: profile?.secondary_phone,
      secondaryPhone: profile?.secondaryPhone,
    });
  }, [profile]);

  const [bio, setBio] = useState(profile?.bio || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [email, setEmail] = useState(profile?.email || "");
  const getPrimaryFromProfile = (p) =>
    p?.phone ??
    p?.primary_phone ??
    p?.primaryPhone ??
    p?.phone_primary ??
    "";
  const getSecondaryFromProfile = (p) =>
    p?.secondary_phone ??
    p?.secondaryPhone ??
    p?.secondary_phone_number ??
    p?.secondaryPhoneNumber ??
    p?.phone_secondary ??
    "";
  const sanitizePhoneValue = (value) =>
    String(value || "").replace(/\D/g, "").slice(0, 10);
  const initialPrimaryPhone = sanitizePhoneValue(getPrimaryFromProfile(profile));
  const initialSecondaryPhone = sanitizePhoneValue(
    getSecondaryFromProfile(profile)
  );

  const profileRef = useRef({
    ...(profile || {}),
    phone: initialPrimaryPhone,
    secondary_phone: initialSecondaryPhone,
  });

  const [primaryPhone, setPrimaryPhone] = useState(initialPrimaryPhone);
  const [secondaryPhone, setSecondaryPhone] = useState(initialSecondaryPhone);
  const initialCategories = Array.isArray(profile?.categories) && profile.categories.length
    ? profile.categories
    : (profile?.category ? [profile.category] : []);
  const [categories, setCategories] = useState(initialCategories);
  const [sponsorTypes, setSponsorTypes] = useState(
    profile?.sponsor_types || []
  );
  const [location, setLocation] = useState(profile?.location || null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [emailChangeModalVisible, setEmailChangeModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [logoUrl, setLogoUrl] = useState(
    profile?.logo_url ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        profile?.name || "Community"
      )}&background=5f27cd&color=FFFFFF&size=120&bold=true`
  );
  const allowLeaveRef = useRef(false);

  useEffect(() => {
    checkForChanges();
  }, [
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
        ]
      );
    });
    return unsubscribe;
  }, [navigation, hasChanges, saving]);

  const checkForChanges = () => {
    const sourceProfile = profileRef.current || {};
    const originalBio = sourceProfile?.bio || "";
    const originalUsername = sourceProfile?.username || "";
    const originalPrimaryPhone = sanitizePhoneValue(
      getPrimaryFromProfile(sourceProfile)
    );
    const originalSecondaryPhone = sanitizePhoneValue(
      getSecondaryFromProfile(sourceProfile)
    );
    const originalEmail = sourceProfile?.email || "";
    const originalCategories =
      Array.isArray(sourceProfile?.categories) && sourceProfile.categories.length
        ? sourceProfile.categories
        : sourceProfile?.category
        ? [sourceProfile.category]
        : [];
    const originalSponsorTypes = (sourceProfile?.sponsor_types || []).sort();
    const originalLocation = sourceProfile?.location || null;

    const normalizeArray = (arr) => (arr ? [...arr].sort() : []);
    const currentSponsorTypes = normalizeArray(sponsorTypes);
    const currentCategories = normalizeArray(categories);
    const originalCategoriesNormalized = normalizeArray(originalCategories);

    const changed =
      bio !== originalBio ||
      username !== originalUsername ||
      primaryPhone !== originalPrimaryPhone ||
      secondaryPhone !== originalSecondaryPhone ||
      email !== originalEmail ||
      JSON.stringify(currentCategories) !== JSON.stringify(originalCategoriesNormalized) ||
      JSON.stringify(currentSponsorTypes) !== JSON.stringify(originalSponsorTypes) ||
      JSON.stringify(location) !== JSON.stringify(originalLocation);

    setHasChanges(!!changed);
  };

  const hydratePhonesFromProfile = useCallback((latestProfile) => {
    if (!latestProfile) return;
    const nextPrimary = sanitizePhoneValue(getPrimaryFromProfile(latestProfile));
    const nextSecondary = sanitizePhoneValue(
      getSecondaryFromProfile(latestProfile)
    );
    console.log("[EditCommunityProfile] hydratePhonesFromProfile", {
      latestProfilePhone: latestProfile?.phone,
      latestSecondary: latestProfile?.secondary_phone ?? latestProfile?.secondaryPhone,
      nextPrimary,
      nextSecondary,
    });
    profileRef.current = {
      ...(profileRef.current || {}),
      ...latestProfile,
      phone: nextPrimary,
      secondary_phone: nextSecondary,
    };
    setPrimaryPhone(nextPrimary);
    setSecondaryPhone(nextSecondary);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const refreshProfile = async () => {
      try {
        const response = await getCommunityProfile();
        const profileData = response?.profile || response || null;
        if (profileData && isMounted) {
          hydratePhonesFromProfile(profileData);
        }
      } catch (error) {
        console.warn("Failed to refresh community profile", error?.message);
      }
    };
    refreshProfile();
    return () => {
      isMounted = false;
    };
  }, [hydratePhonesFromProfile]);

  const handlePrimaryPhoneChange = (value) => {
    setPrimaryPhone(sanitizePhoneValue(value));
  };

  const handleSecondaryPhoneChange = (value) => {
    setSecondaryPhone(sanitizePhoneValue(value));
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
        token
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
        500
      );
      return () => clearTimeout(timeoutId);
    } else {
      setUsernameAvailable(null);
    }
  };

  const handleChangeLogo = async () => {
    try {
      const permissionResult = await requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Required",
          "Permission to access photos is required."
        );
        return;
      }
      const picker = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (picker.canceled || !picker.assets || !picker.assets[0]) return;
      setUploadingPhoto(true);
      const uri = picker.assets[0].uri;
      const secureUrl = await uploadImage(uri);
      const token = await getAuthToken();
      await (
        await import("../../../api/client")
      ).apiPost(
        "/communities/profile/logo",
        { logo_url: secureUrl },
        15000,
        token
      );
      setLogoUrl(secureUrl);
      Alert.alert("Updated", "Logo updated");
    } catch (e) {
      Alert.alert("Update failed", e?.message || "Could not update logo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    // Validate sponsor types
    const isOpenToAll = sponsorTypes.length === 1 && sponsorTypes[0] === 'Open to All';
    if (!isOpenToAll && sponsorTypes.length < 3) {
      Alert.alert("Error", "Please select at least 3 sponsor types or 'Open to All'");
      return;
    }

    try {
      setSaving(true);
      const token = await getAuthToken();

      const normalizedCategories = Array.from(
        new Set(
          (categories || [])
            .map((c) => (typeof c === 'string' ? c.trim() : ''))
            .filter((c) => c)
        )
      ).slice(0, 3);

      if (normalizedCategories.length === 0) {
        Alert.alert('Error', 'Please select at least one category.');
        setSaving(false);
        return;
      }

      const normalizedPrimary = sanitizePhoneValue(primaryPhone);
      const normalizedSecondary = sanitizePhoneValue(secondaryPhone) || null;

      if (normalizedPrimary.length !== 10) {
        Alert.alert(
          "Invalid phone",
          "Primary phone number must be exactly 10 digits."
        );
        setSaving(false);
        return;
      }

      if (normalizedSecondary && normalizedSecondary.length !== 10) {
        Alert.alert(
          "Invalid phone",
          "Secondary phone number must be exactly 10 digits when provided."
        );
        setSaving(false);
        return;
      }

      const updates = {
        bio: bio.trim(),
        phone: normalizedPrimary,
        primary_phone: normalizedPrimary,
        primaryPhone: normalizedPrimary,
        phone_primary: normalizedPrimary,
        secondary_phone: normalizedSecondary,
        secondaryPhone: normalizedSecondary,
        secondary_phone_number: normalizedSecondary,
        secondaryPhoneNumber: normalizedSecondary,
        phone_secondary: normalizedSecondary,
        category: normalizedCategories[0],
        categories: normalizedCategories,
        sponsor_types: sponsorTypes.length > 0 ? sponsorTypes : [],
        location: location,
      };

      await updateCommunityProfile(updates, token);
      console.log("[EditCommunityProfile] saved phones", updates);

      profileRef.current = {
        ...(profileRef.current || {}),
        phone: normalizedPrimary,
        primary_phone: normalizedPrimary,
        primaryPhone: normalizedPrimary,
        phone_primary: normalizedPrimary,
        secondary_phone: normalizedSecondary,
        secondaryPhone: normalizedSecondary,
        secondary_phone_number: normalizedSecondary,
        secondaryPhoneNumber: normalizedSecondary,
        phone_secondary: normalizedSecondary,
      };
      setPrimaryPhone(normalizedPrimary);
      setSecondaryPhone(normalizedSecondary || "");

      if (username !== (profileRef.current?.username || profile?.username)) {
        await changeUsername(username, token);
      }

      Alert.alert("Success", "Profile updated successfully!", [
        {
          text: "OK",
          onPress: () => {
            allowLeaveRef.current = true;
            setHasChanges(false);
            navigation.navigate("Profile", { refreshProfile: true });
          },
        },
      ]);
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert(
        "Error",
        error?.message || "Failed to update profile. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEmailChangeComplete = (newEmail) => {
    setEmail(newEmail);
    setEmailChangeModalVisible(false);
  };

  const handleLocationSelected = (selectedLocation) => {
    setLocation(selectedLocation);
    setShowLocationPicker(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
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

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Logo Section */}
          <View style={[styles.section, styles.photoSection]}>
            <Image source={{ uri: logoUrl }} style={styles.logoImage} />
            <TouchableOpacity
              onPress={handleChangeLogo}
              style={[styles.changeButton, styles.photoButton]}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={PRIMARY_COLOR} />
              ) : (
                <Text style={styles.changeButtonText}>
                  Change Logo
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Bio Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bio</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Tell us about your community"
              placeholderTextColor={LIGHT_TEXT_COLOR}
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={500}
            />
            <Text style={styles.charCount}>{bio.length}/500</Text>
          </View>

          {/* Username Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Username</Text>
            <View style={styles.usernameContainer}>
              <TextInput
                style={[styles.textInput, styles.usernameInput]}
                placeholder="username"
                placeholderTextColor={LIGHT_TEXT_COLOR}
                value={username}
                onChangeText={handleUsernameChange}
                autoCapitalize="none"
                maxLength={30}
              />
              {usernameChecking && (
                <ActivityIndicator
                  size="small"
                  color={PRIMARY_COLOR}
                  style={styles.checkIndicator}
                />
              )}
              {usernameAvailable === true && (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color="#00C851"
                  style={styles.checkIndicator}
                />
              )}
              {usernameAvailable === false &&
                username !== (profileRef.current?.username || profile?.username) && (
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color="#FF4444"
                    style={styles.checkIndicator}
                  />
                )}
            </View>
            {usernameAvailable === false &&
              username !== (profileRef.current?.username || profile?.username) && (
              <Text style={styles.errorText}>
                Username is already taken or invalid
              </Text>
            )}
          </View>

          {/* Email Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Email</Text>
            <View style={styles.emailContainer}>
              <TextInput
                style={[styles.textInput, styles.emailInput]}
                placeholder="email@example.com"
                placeholderTextColor={LIGHT_TEXT_COLOR}
                value={email}
                editable={false}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TouchableOpacity
                style={styles.changeButton}
                onPress={() => setEmailChangeModalVisible(true)}
              >
                <Text style={styles.changeButtonText}>Change</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Phone Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Phone Numbers</Text>
            <Text style={[styles.inputLabel, styles.inputLabelFirst]}>
              Primary Phone
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Primary phone number"
              placeholderTextColor={LIGHT_TEXT_COLOR}
              value={primaryPhone}
              onChangeText={handlePrimaryPhoneChange}
              keyboardType="phone-pad"
              maxLength={10}
            />
            <View style={styles.secondaryPhoneHeader}>
              <Text style={styles.inputLabel}>Secondary Phone</Text>
              <Text style={styles.optionalTag}>Optional</Text>
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="Secondary phone number"
              placeholderTextColor={LIGHT_TEXT_COLOR}
              value={secondaryPhone}
              onChangeText={handleSecondaryPhoneChange}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>

          {/* Category Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <Text style={styles.sectionSubtitle}>
              Select up to 3 categories that best describe your community
            </Text>
            <ChipSelector
              selected={categories}
              onSelectionChange={(selected) => {
                const sanitized = Array.from(
                  new Set(
                    (selected || [])
                      .map((c) => (typeof c === 'string' ? c.trim() : ''))
                      .filter((c) => c)
                  )
                ).slice(0, 3);
                setCategories(sanitized);
              }}
              presets={CATEGORIES}
              allowCustom={true}
              maxSelections={3}
              placeholder="Select categories"
            />
          </View>

          {/* Sponsor Types Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sponsor Types</Text>
            <Text style={styles.sectionSubtitle}>
              Select at least 3 sponsor types, or choose "Open to All"
            </Text>
            <ChipSelector
              selected={sponsorTypes}
              onSelectionChange={(selected) => {
                // Handle "Open to All" special case
                if (selected.includes('Open to All')) {
                  setSponsorTypes(['Open to All']);
                } else {
                  setSponsorTypes(selected.filter(s => s !== 'Open to All'));
                }
              }}
              presets={['Open to All', ...SPONSOR_TYPES]}
              allowCustom={false}
              maxSelections={20}
              placeholder="Select sponsor types"
            />
          </View>

          {/* Location Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <TouchableOpacity
              style={styles.locationButton}
              onPress={() => setShowLocationPicker(true)}
            >
              <Ionicons name="location" size={20} color={PRIMARY_COLOR} />
              <Text style={styles.locationButtonText}>
                {location?.address || location?.city || "Select Location"}
              </Text>
            </TouchableOpacity>
            {location && (
              <Text style={styles.locationText}>
                {[location.city, location.state, location.country]
                  .filter(Boolean)
                  .join(", ")}
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <EmailChangeModal
        visible={emailChangeModalVisible}
        currentEmail={email}
        onClose={() => setEmailChangeModalVisible(false)}
        onComplete={handleEmailChangeComplete}
        startEmailChange={startEmailChange}
        verifyEmailChange={verifyEmailChange}
      />

      {showLocationPicker && (
        <Modal
          visible={showLocationPicker}
          animationType="slide"
          onRequestClose={() => setShowLocationPicker(false)}
        >
          <LocationPicker
            businessName={profile?.name}
            initialLocation={location}
            onLocationSelected={handleLocationSelected}
            onCancel={() => setShowLocationPicker(false)}
          />
        </Modal>
      )}
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
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  saveButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: LIGHT_TEXT_COLOR,
    opacity: 0.5,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 6,
  },
  inputLabelFirst: {
    marginTop: 4,
  },
  secondaryPhoneHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  optionalTag: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT_COLOR,
    backgroundColor: "#FFFFFF",
  },
  charCount: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    textAlign: "right",
    marginTop: 4,
  },
  usernameContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  usernameInput: {
    flex: 1,
    marginRight: 8,
  },
  checkIndicator: {
    marginLeft: 8,
  },
  errorText: {
    fontSize: 12,
    color: "#FF4444",
    marginTop: 4,
  },
  emailContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  emailInput: {
    flex: 1,
    marginRight: 8,
    backgroundColor: "#F2F2F7",
  },
  changeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
  },
  changeButtonText: {
    color: PRIMARY_COLOR,
    fontSize: 14,
    fontWeight: "600",
  },
  photoButton: {
    alignSelf: "center",
  },
  logoImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 12,
    backgroundColor: "#E5E5EA",
  },
  photoSection: {
    alignItems: "center",
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    marginBottom: 12,
  },
  locationButtonText: {
    color: PRIMARY_COLOR,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  locationText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    textAlign: "center",
  },
});

