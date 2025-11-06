import React, { useState, useEffect, useCallback } from "react";
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
import {
  launchImageLibraryAsync,
  requestMediaLibraryPermissionsAsync,
  MediaTypeOptions,
} from "expo-image-picker";
import { uploadImage } from "../../../api/cloudinary";
import ChipSelector from "../../../components/ChipSelector";
import EmailChangeModal from "../../../components/EmailChangeModal";
import * as Location from "expo-location";

const PRIMARY_COLOR = "#6A0DAD";
const TEXT_COLOR = "#1D1D1F";
const LIGHT_TEXT_COLOR = "#8E8E93";

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
  const [location, setLocation] = useState(() => {
    if (profile?.location && typeof profile.location === "object") {
      return {
        city: profile.location.city || profile?.city || "",
        state: profile.location.state || "",
        country: profile.location.country || "",
        lat: profile.location.lat || null,
        lng: profile.location.lng || null,
      };
    }
    return {
      city: profile?.city || "",
      state: "",
      country: "",
      lat: null,
      lng: null,
    };
  });

  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [emailChangeModalVisible, setEmailChangeModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [interestsCatalog, setInterestsCatalog] = useState([]);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    loadInterestsCatalog();
  }, []);

  useEffect(() => {
    checkForChanges();
  }, [bio, username, phone, pronouns, interests, location, email]);

  const loadInterestsCatalog = async () => {
    try {
      const catalog = await fetchInterests();
      setInterestsCatalog(catalog || []);
    } catch (error) {
      console.error("Error loading interests catalog:", error);
    }
  };

  const checkForChanges = () => {
    const originalBio = profile?.bio || "";
    const originalUsername = profile?.username || "";
    const originalPhone = profile?.phone || "";
    const originalEmail = profile?.email || "";
    const originalPronouns = profile?.pronouns
      ? Array.isArray(profile.pronouns)
        ? profile.pronouns
        : [profile.pronouns]
      : [];
    const originalInterests = profile?.interests || [];
    const originalCity = profile?.city || "";
    const originalLocation = profile?.location || {
      city: originalCity,
      state: "",
      country: "",
      lat: null,
      lng: null,
    };

    const changed =
      bio !== originalBio ||
      username !== originalUsername ||
      phone !== originalPhone ||
      email !== originalEmail ||
      JSON.stringify(pronouns.sort()) !==
        JSON.stringify(originalPronouns.sort()) ||
      JSON.stringify(interests.sort()) !==
        JSON.stringify(originalInterests.sort()) ||
      JSON.stringify(location) !== JSON.stringify(originalLocation);

    setHasChanges(changed);
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
      Alert.alert("Updated", "Profile photo updated");
      // Trigger parent refresh by marking changes (no-op field) or simply navigate back after save
    } catch (e) {
      Alert.alert("Update failed", e?.message || "Could not update photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleGetLocation = async () => {
    try {
      setLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required to auto-detect your location."
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;

      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      if (reverseGeocode && reverseGeocode.length > 0) {
        const addr = reverseGeocode[0];
        setLocation({
          city: addr.city || addr.subAdministrativeArea || "",
          state: addr.region || addr.administrativeArea || "",
          country: addr.country || "",
          lat: latitude,
          lng: longitude,
        });
      } else {
        setLocation((prev) => ({ ...prev, lat: latitude, lng: longitude }));
      }
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert("Error", "Failed to get your location. Please try again.");
    } finally {
      setLoadingLocation(false);
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
        location: location,
      };

      await updateMemberProfile(updates, token);

      if (username !== profile?.username) {
        await changeUsername(username, token);
      }

      Alert.alert("Success", "Profile updated successfully!", [
        { text: "OK", onPress: () => navigation.goBack() },
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
          {/* Photo Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile Photo</Text>
            <TouchableOpacity
              onPress={handleChangePhoto}
              style={[styles.changeButton, styles.photoButton]}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={PRIMARY_COLOR} />
              ) : (
                <Text style={styles.changeButtonText}>Change Photo</Text>
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
            />
          </View>

          {/* Interests Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <ChipSelector
              selected={interests}
              onSelectionChange={setInterests}
              presets={interestsCatalog}
              allowCustom={true}
              maxSelections={20}
              placeholder="Select interests or add custom"
              searchable={true}
            />
          </View>

          {/* Location Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <TouchableOpacity
              style={styles.locationButton}
              onPress={handleGetLocation}
              disabled={loadingLocation}
            >
              {loadingLocation ? (
                <ActivityIndicator size="small" color={PRIMARY_COLOR} />
              ) : (
                <Ionicons name="location" size={20} color={PRIMARY_COLOR} />
              )}
              <Text style={styles.locationButtonText}>
                {loadingLocation
                  ? "Getting location..."
                  : "Use Current Location"}
              </Text>
            </TouchableOpacity>

            <View style={styles.locationFields}>
              <TextInput
                style={[styles.textInput, styles.locationInput]}
                placeholder="City"
                placeholderTextColor={LIGHT_TEXT_COLOR}
                value={location.city}
                onChangeText={(text) =>
                  setLocation((prev) => ({ ...prev, city: text }))
                }
              />
              <TextInput
                style={[styles.textInput, styles.locationInput]}
                placeholder="State"
                placeholderTextColor={LIGHT_TEXT_COLOR}
                value={location.state}
                onChangeText={(text) =>
                  setLocation((prev) => ({ ...prev, state: text }))
                }
              />
              <TextInput
                style={[styles.textInput, styles.locationInput]}
                placeholder="Country"
                placeholderTextColor={LIGHT_TEXT_COLOR}
                value={location.country}
                onChangeText={(text) =>
                  setLocation((prev) => ({ ...prev, country: text }))
                }
              />
            </View>
          </View>
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
    alignSelf: "flex-start",
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
