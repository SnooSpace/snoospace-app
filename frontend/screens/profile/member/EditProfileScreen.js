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
  LayoutAnimation,
  UIManager,
  Platform,
  Image,
} from "react-native";
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
  Palette,
  Music,
  TreeDeciduous,
  Laptop,
  Coffee,
  Zap,
  Tent,
  Rocket,
  Heart,
  Dumbbell,
  Plane,
  BookOpen,
  Film,
  Search,
  Gamepad2,
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

// Interest Categories Configuration
const INTEREST_CATEGORIES = {
  CREATIVE: {
    bg: "#FFEBEE",
    text: "#C62828",
    icon: Palette,
    keywords: ["art", "design", "photo", "fashion", "write", "draw", "dance"],
  },
  MUSIC: {
    bg: "#F3E5F5",
    text: "#7B1FA2",
    icon: Music,
    keywords: ["music", "concert", "fest", "guitar", "piano", "sing"],
  },
  NATURE: {
    bg: "#E8F5E9",
    text: "#2E7D32",
    icon: TreeDeciduous,
    keywords: ["nature", "hik", "camp", "outdoors", "garden", "flower"],
  },
  TECH: {
    bg: "#E0F7FA",
    text: "#00838F",
    icon: Laptop,
    keywords: ["tech", "code", "gam", "pc", "data", "scifi", "ai"],
  },
  FOOD: {
    bg: "#FFF8E1",
    text: "#F9A825",
    icon: Coffee,
    keywords: ["food", "cof", "cook", "bak", "drink", "bar", "cafe"],
  },
  FITNESS: {
    bg: "#E3F2FD",
    text: "#1565C0",
    icon: Dumbbell,
    keywords: ["fit", "gym", "run", "sport", "yoga", "ball"],
  },
  TRAVEL: {
    bg: "#E0F2F1",
    text: "#00695C",
    icon: Plane,
    keywords: ["travel", "trip", "explor", "adv"],
  },
  MOVIES: {
    bg: "#F3E5F5",
    text: "#6A1B9A",
    icon: Film,
    keywords: ["movi", "film", "cinem", "show", "netflix"],
  },
  BOOKS: {
    bg: "#FFF3E0",
    text: "#EF6C00",
    icon: BookOpen,
    keywords: ["book", "read", "novel", "lit"],
  },
  MYSTERY: {
    bg: "#ECEFF1",
    text: "#37474F",
    icon: Search,
    keywords: ["crime", "myst", "thrill", "detect"],
  },
  ROMANCE: {
    bg: "#FCE4EC",
    text: "#C2185B",
    icon: Heart,
    keywords: ["roman", "love", "date"],
  },
  DEFAULT: { bg: "#F5F5F5", text: "#424242", icon: Zap, keywords: [] },
};

const getInterestStyle = (interest) => {
  if (!interest) return INTEREST_CATEGORIES.DEFAULT;
  const lower = interest.toLowerCase();

  // Special overrides
  if (lower.includes("bar hopping") || lower.includes("cafe"))
    return INTEREST_CATEGORIES.FOOD;
  if (lower.includes("run")) return INTEREST_CATEGORIES.FITNESS;

  for (const key in INTEREST_CATEGORIES) {
    const category = INTEREST_CATEGORIES[key];
    if (
      category.keywords.some((k) => lower.includes(k)) ||
      key === interest.toUpperCase()
    ) {
      return category;
    }
  }
  return INTEREST_CATEGORIES.DEFAULT;
};

export default function EditProfileScreen({ route, navigation }) {
  const profile = route?.params?.profile;

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

  const [showAllOptions, setShowAllOptions] = useState(false);

  const allowLeaveRef = useRef(false);

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

  const renderSectionHeader = (title, icon) => (
    <View style={styles.cardHeader}>
      {icon && <View style={styles.cardIcon}>{icon}</View>}
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
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

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
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
            {renderSectionHeader(
              "THE BASICS",
              <User size={16} color={ACCENT_COLOR} fill={ACCENT_COLOR} />,
            )}

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
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => {
                        // Toggle single select style per specs or multi?
                        // Spec says "Selected state clearly visible". Usually pronouns can be multi, but segmented pill implies single.
                        // I'll keep multi supported logic but style implies choice.
                        const newPronouns = isSelected
                          ? pronouns.filter((pr) => pr !== p)
                          : [...pronouns, p];
                        setPronouns(newPronouns);
                        HapticsService.triggerSelection();
                      }}
                      style={[
                        styles.pronounPill,
                        isSelected && styles.pronounPillSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pronounText,
                          isSelected && styles.pronounTextSelected,
                        ]}
                      >
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
            {renderSectionHeader("ABOUT ME")}
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
            {renderSectionHeader(
              "EDUCATION",
              <GraduationCap size={16} color={ACCENT_COLOR} />,
            )}
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

          {/* Card 4: My Vibes */}
          <View style={styles.card}>
            <View style={[styles.cardHeader, { marginBottom: 12 }]}>
              <Text style={styles.cardTitle}>MY VIBES</Text>
            </View>

            <View style={styles.inputGroupLast}>
              {/* Selected Vibes Section */}
              <View style={styles.vibesContainer}>
                {interests.map((interest) => {
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
                        setInterests(interests.filter((i) => i !== interest));
                        HapticsService.triggerSelection();
                      }}
                      style={[
                        styles.vibeChip,
                        { backgroundColor: style.bg, paddingRight: 8 },
                      ]}
                    >
                      <View style={styles.vibeContent}>
                        <Icon size={14} color={style.text} strokeWidth={2.5} />
                        <Text style={[styles.vibeText, { color: style.text }]}>
                          {interest}
                        </Text>
                      </View>
                      <View style={styles.removeIconContainer}>
                        <X size={12} color={style.text} strokeWidth={3} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Options Section */}
              <View style={styles.optionsHeader}>
                <Text style={styles.optionsLabel}>Options:</Text>
              </View>

              <View style={styles.vibesContainer}>
                {interestsCatalog
                  .filter((i) => !interests.includes(i))
                  .slice(0, showAllOptions ? undefined : 15)
                  .map((interest) => (
                    <TouchableOpacity
                      key={interest}
                      activeOpacity={0.7}
                      onPress={() => {
                        LayoutAnimation.configureNext(
                          LayoutAnimation.Presets.easeInEaseOut,
                        );
                        setInterests([...interests, interest]);
                        HapticsService.triggerSelection();
                      }}
                      style={styles.optionChip}
                    >
                      <Text style={styles.optionText}>{interest}</Text>
                      <Plus size={14} color={TEXT_SECONDARY} />
                    </TouchableOpacity>
                  ))}
              </View>

              {/* Show More / Add Custom Actions */}
              <View style={styles.vibesActions}>
                {interestsCatalog.filter((i) => !interests.includes(i)).length >
                  15 && (
                  <TouchableOpacity
                    onPress={() => {
                      LayoutAnimation.configureNext(
                        LayoutAnimation.Presets.easeInEaseOut,
                      );
                      setShowAllOptions(!showAllOptions);
                    }}
                    style={styles.showMoreButton}
                  >
                    <Text style={styles.showMoreText}>
                      {showAllOptions ? "Show Less" : "Show More"}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => {
                    // Logic for custom interest addition if needed
                    Alert.prompt("Add Custom Interest", null, (text) => {
                      if (text && !interests.includes(text)) {
                        LayoutAnimation.configureNext(
                          LayoutAnimation.Presets.easeInEaseOut,
                        );
                        setInterests([...interests, text]);
                      }
                    });
                  }}
                  style={styles.addCustomButton}
                >
                  <Plus size={16} color={ACCENT_COLOR} />
                  <Text style={styles.addCustomText}>Add custom interest</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Card 5: Private Details */}
          <View style={styles.card}>
            {renderSectionHeader(
              "PRIVATE DETAILS",
              <Lock size={14} color={TEXT_SECONDARY} />,
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EMAIL</Text>
              <View
                style={[
                  styles.input,
                  styles.rowInput,
                  { backgroundColor: "#F8F8F8" },
                ]}
              >
                <Mail
                  size={16}
                  color={TEXT_SECONDARY}
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  style={[styles.flexInput, { color: TEXT_SECONDARY }]}
                  value={email}
                  editable={false}
                />
                <TouchableOpacity
                  onPress={() => setEmailChangeModalVisible(true)}
                >
                  <Ionicons
                    name="create-outline"
                    size={20}
                    color={ACCENT_COLOR}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.helperText}>Only visible to you</Text>
            </View>

            <View style={styles.inputGroupLast}>
              <Text style={styles.inputLabel}>PHONE</Text>
              <View style={[styles.input, styles.rowInput]}>
                <Phone
                  size={16}
                  color={TEXT_SECONDARY}
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  style={styles.flexInput}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="Add phone number"
                  placeholderTextColor={TEXT_SECONDARY}
                />
              </View>
              <Text style={styles.helperText}>Only visible to you</Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
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
    paddingBottom: 40,
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
    gap: 8,
  },
  cardIcon: {
    // Optional additional styling for icon container
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: FONT_CARD_TITLE,
    color: TEXT_PRIMARY, // Neutral color as requested
    letterSpacing: 0.5,
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
    backgroundColor: INPUT_BG,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.pill,
  },
  pronounPillSelected: {
    backgroundColor: "#E3F2FD", // Light blue bg
    borderWidth: 1,
    borderColor: ACCENT_COLOR,
    paddingVertical: 9, // Compensate border
    paddingHorizontal: 15,
  },
  pronounText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontFamily: FONTS.medium,
  },
  pronounTextSelected: {
    color: ACCENT_COLOR,
    fontWeight: "600",
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
  vibesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  vibeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 12,
    borderRadius: 20, // Full rounded pill
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
  },
  vibeText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    fontWeight: "600",
  },
  removeIconContainer: {
    marginLeft: 6,
    opacity: 0.6,
  },
  optionsHeader: {
    marginTop: 8,
    marginBottom: 12,
  },
  optionsLabel: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontFamily: FONTS.medium,
  },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6", // Neutral
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
  },
  optionText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: TEXT_PRIMARY,
  },
  vibesActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  showMoreButton: {
    paddingVertical: 8,
  },
  showMoreText: {
    fontSize: 13,
    color: ACCENT_COLOR,
    fontFamily: FONTS.medium,
  },
  addCustomButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
  },
  addCustomText: {
    fontSize: 13,
    color: ACCENT_COLOR,
    fontFamily: FONTS.bold,
  },
});
