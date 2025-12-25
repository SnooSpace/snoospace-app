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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getAuthToken } from "../../../api/auth";
import {
  updateMemberProfile,
  changeUsername,
  startEmailChange,
  verifyEmailChange,
  fetchInterests,
} from "../../../api/members";
import HapticsService from "../../../services/HapticsService";
import {
  launchImageLibraryAsync,
  requestMediaLibraryPermissionsAsync,
  MediaTypeOptions,
} from "expo-image-picker";
import { uploadImage } from "../../../api/cloudinary";
import ChipSelector from "../../../components/ChipSelector";
import EmailChangeModal from "../../../components/EmailChangeModal";

import { COLORS, SPACING, BORDER_RADIUS } from "../../../constants/theme";
import GradientButton from "../../../components/GradientButton";

// Map to new theme
const PRIMARY_COLOR = COLORS.primary;
const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;

const PRONOUN_PRESETS = [
  "He/Him",
  "She/Her",
  "They/Them",
  "He/They",
  "She/They",
  "Any Pronouns",
  "Prefer not to say",
];

export default function EditProfileScreen({ route, navigation }) {
  const profile = route?.params?.profile;

  const cleanLabel = (val) => {
    if (typeof val !== "string") return val;
    return val.replace(/^[{\"]+|[}\"]+$/g, "");
  };

  const [bio, setBio] = useState(profile?.bio || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [email, setEmail] = useState(profile?.email || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [pronouns, setPronouns] = useState(
    profile?.pronouns
      ? (Array.isArray(profile.pronouns)
          ? profile.pronouns
          : [profile.pronouns]
        ).map(cleanLabel)
      : []
  );
  const [interests, setInterests] = useState(profile?.interests || []);
  const [location] = useState(profile?.location || null);

  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [emailChangeModalVisible, setEmailChangeModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [interestsCatalog, setInterestsCatalog] = useState([]);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(
    profile?.profile_photo_url ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(
        profile?.name || "Member"
      )}&background=6A0DAD&color=FFFFFF&size=120&bold=true`
  );
  const allowLeaveRef = useRef(false);

  useEffect(() => {
    loadInterestsCatalog();
  }, []);

  useEffect(() => {
    checkForChanges();
  }, [bio, username, phone, pronouns, interests, email]);

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

  const loadInterestsCatalog = async () => {
    try {
      const catalog = await fetchInterests();
      setInterestsCatalog(catalog || []);

      // Filter out legacy interests that are no longer in the catalog
      if (catalog && catalog.length > 0 && interests.length > 0) {
        const catalogSet = new Set(catalog.map((i) => i.toLowerCase()));
        const filteredInterests = interests.filter((interest) =>
          catalogSet.has(interest.toLowerCase())
        );
        if (filteredInterests.length !== interests.length) {
          setInterests(filteredInterests);
        }
      }
    } catch (error) {
      console.error("Error loading interests catalog:", error);
    }
  };

  const checkForChanges = () => {
    const originalBio = profile?.bio || "";
    const originalUsername = profile?.username || "";
    const originalPhone = profile?.phone || "";
    const originalEmail = profile?.email || "";

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
      bio !== originalBio ||
      username !== originalUsername ||
      phone !== originalPhone ||
      email !== originalEmail ||
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
          token
        );
        setUsernameAvailable(result?.available === true);
      } catch (error) {
        setUsernameAvailable(false);
      } finally {
        setUsernameChecking(false);
      }
    },
    [profile?.username]
  );

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

  const handleChangePhoto = async () => {
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
        "/members/profile/photo",
        { photo_url: secureUrl },
        15000,
        token
      );
      setPhotoUrl(secureUrl);
      Alert.alert("Updated", "Profile photo updated");
      // Trigger parent refresh by marking changes (no-op field) or simply navigate back after save
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
        bio: bio.trim(),
        phone: phone.trim(),
        pronouns: pronouns.length > 0 ? pronouns.map(cleanLabel) : null,
        interests: interests.length > 0 ? interests : [],
        // location is now handled automatically by the app while in use
      };

      await updateMemberProfile(updates, token);

      if (username !== profile?.username) {
        await changeUsername(username, token);
      }

      // Prevent the unsaved guard and go back after user acknowledges
      HapticsService.triggerNotificationSuccess();
      Alert.alert("Success", "Profile updated successfully!", [
        {
          text: "OK",
          onPress: () => {
            allowLeaveRef.current = true;
            setHasChanges(false);
            // Navigate back to Profile with refresh flag to trigger reload
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
          <GradientButton
            title="Save"
            onPress={handleSave}
            disabled={!hasChanges || saving}
            loading={saving}
            style={[
              { minWidth: 80, paddingHorizontal: 16, paddingVertical: 8 },
              (!hasChanges || saving) && {
                shadowOpacity: 0,
                elevation: 0,
                shadowColor: "transparent",
              },
            ]}
          />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Photo Section */}
          <View style={[styles.section, styles.photoSection]}>
            <Image source={{ uri: photoUrl }} style={styles.profileImage} />
            <TouchableOpacity
              onPress={handleChangePhoto}
              style={[styles.changeButton, styles.photoButton]}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={PRIMARY_COLOR} />
              ) : (
                <Text style={styles.changeButtonText}>
                  Change Profile Photo
                </Text>
              )}
            </TouchableOpacity>
          </View>
          {/* Bio Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bio</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Tell us about yourself"
              placeholderTextColor={LIGHT_TEXT_COLOR}
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={150}
            />
            <Text style={styles.charCount}>{bio.length}/150</Text>
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
                username !== profile?.username && (
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color="#FF4444"
                    style={styles.checkIndicator}
                  />
                )}
            </View>
            {usernameAvailable === false && username !== profile?.username && (
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
            <Text style={styles.sectionTitle}>Phone</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Phone number"
              placeholderTextColor={LIGHT_TEXT_COLOR}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>

          {/* Pronouns Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pronouns</Text>
            <ChipSelector
              selected={pronouns}
              onSelectionChange={setPronouns}
              presets={PRONOUN_PRESETS}
              allowCustom={true}
              maxSelections={10}
              placeholder="Select pronouns or add custom"
              variant="glass"
            />
          </View>

          {/* Interests Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <ChipSelector
              selected={interests}
              onSelectionChange={(newVal) => {
                HapticsService.triggerSelection();
                setInterests(newVal);
              }}
              presets={interestsCatalog}
              allowCustom={true}
              maxSelections={Math.min(10, interestsCatalog.length) || 10}
              placeholder="Select interests or add custom"
              searchable={true}
              variant="gradient-pastel"
            />
          </View>

          {/* Location is managed automatically while the app is in use */}
        </ScrollView>
      </KeyboardAvoidingView>

      <EmailChangeModal
        visible={emailChangeModalVisible}
        currentEmail={email}
        onClose={() => setEmailChangeModalVisible(false)}
        onComplete={handleEmailChangeComplete}
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
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    zIndex: -1,
  },
  // saveButton styles removed as GradientButton handles them
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
  profileImage: {
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
  locationFields: {
    gap: 12,
  },
  locationInput: {
    marginBottom: 0,
  },
});
