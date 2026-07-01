import React, { useState, useEffect, useRef, useCallback } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Image, Alert, BackHandler, Platform, TextInput, Modal, Animated, TouchableWithoutFeedback } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Svg, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { getAuthToken } from "../../api/auth";
import { apiGet } from "../../api/client";
import { updateMemberProfile, fetchPronouns } from "../../api/members";
import { uploadMultipleImages } from "../../api/cloudinary";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  FONTS,
} from "../../constants/theme";
import HapticsService from "../../services/HapticsService";
import ImageUploader from "../../components/ImageUploader";
import {
  Lock,
  Plus,
  X,
  MessageSquare,
  Shield,
  Camera,
  User,
  Sparkles,
  ArrowLeft,
  CircleCheck,
  AlertCircle,
  ChevronRight,
  Music,
} from "lucide-react-native";
import { INTEREST_CATEGORIES } from "../profile/member/EditProfileConstants";
import SnooLoader from "../../components/ui/SnooLoader";
import SpotifyConnectorWidget from "../../components/SpotifyConnectorWidget";

// STRICT CONSTANTS - ITERATION 2
const CONSTANTS_COLORS = {
  primaryBlue: "#2962FF",
  surfaceLight: "#F8FAFC", // Surface Light
  surfaceNeutral: "#F3F6F8", // Unselected chips
  secondaryAccent: "#D4EEEF", // Selected chips
  border: "#F1F5F9", // Lighter border
  textPrimary: "#0F172A",
  textSecondary: "#6B7280",
  disabledIcon: "#9CA3AF",
  surface: "#FFFFFF",
  error: "#DC2626",
  toggleOff: "#E5E5EA", // Neutral gray for toggle off
};

const TEXT_COLOR = CONSTANTS_COLORS.textPrimary;
const LIGHT_TEXT_COLOR = CONSTANTS_COLORS.textSecondary;
const PRIMARY_COLOR = CONSTANTS_COLORS.primaryBlue;

// Spark Presets
const GOAL_BADGE_PRESETS = [
  "Looking for a co-founder",
  "Seeking mentorship",
  "Open to collaborations",
  "Exploring opportunities",
  "Open to friendships",
  "New to the city",
  "Wants to play sports",
  "Looking for study partners",
  "Here to learn",
  "Just curious",
  "Looking for teammates",
];

const EDGES = ["top"];

export default function EditDiscoverProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [unsavedModalVisible, setUnsavedModalVisible] = useState(false);
  const [incompleteSaveModalVisible, setIncompleteSaveModalVisible] = useState(false);
  const [incompleteMissingMsg, setIncompleteMissingMsg] = useState("");

  // Profile data
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState(null);
  const [gender, setGender] = useState(""); // Added Gender
  const [pronouns, setPronouns] = useState([]);
  const [showPronouns, setShowPronouns] = useState(true);
  const [showPronounsModal, setShowPronounsModal] = useState(false);
  const [pronounPresets, setPronounPresets] = useState(["He/Him", "She/Her", "They/Them"]);
  const [photos, setPhotos] = useState([]);
  const [goalBadges, setGoalBadges] = useState([]);
  const [openers, setOpeners] = useState([]);
  const [appearInDiscover, setAppearInDiscover] = useState(true);
  const [customGoal, setCustomGoal] = useState("");
  const [showCustomGoalInput, setShowCustomGoalInput] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyTopArtists, setSpotifyTopArtists] = useState([]);

  // Initial state for change detection
  const [initialState, setInitialState] = useState(null);
  const imageUploaderRef = useRef(null);
  const hasLoadedRef = useRef(false);

  // Scroll and validation tracking
  const scrollViewRef = useRef(null);
  const sectionCoords = useRef({});
  const [validationErrors, setValidationErrors] = useState({
    photos: false,
    sparks: false,
    openers: false,
  });

  // Shake animations for validation feedback
  const photosShakeAnim = useRef(new Animated.Value(0)).current;
  const sparksShakeAnim = useRef(new Animated.Value(0)).current;
  const openersShakeAnim = useRef(new Animated.Value(0)).current;

  // Trigger error highlight and animation helper
  const triggerSectionError = useCallback((sectionKey, shakeAnim) => {
    setValidationErrors((prev) => ({ ...prev, [sectionKey]: true }));
    HapticsService.triggerNotificationWarning();

    // Scroll to the failing section
    const yCoord = sectionCoords.current[sectionKey];
    if (yCoord !== undefined && scrollViewRef.current) {
      const scrollToY = Math.max(0, yCoord - 16);
      scrollViewRef.current.scrollTo({ y: scrollToY, animated: true });
    }

    // Micro-animation: Shake sequence
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -4, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 45, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadProfile = useCallback(async () => {
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

        // Fetch pronouns catalog
        try {
          const pronounsData = await fetchPronouns();
          if (pronounsData && pronounsData.length > 0) {
            setPronounPresets(pronounsData.map((p) => p.label || p));
          }
        } catch (err) {
          console.error("Error loading pronouns catalog:", err);
        }

        const loadedState = {
          name: profile.name || "",
          nickname: profile.nickname || "",
          age: calculatedAge,
          gender: profile.gender || "Not Specified", // Handle Gender
          pronouns: profile.pronouns || [],
          showPronouns: profile.show_pronouns !== false,
          photos: profile.discover_photos || [],
          goalBadges: profile.intent_badges || [],
          openers: profile.openers || [],
          appearInDiscover: profile.appear_in_discover !== false,
          spotifyConnected: !!profile.spotify_connected,
          spotifyTopArtists: profile.spotify_top_artists || [],
        };

        setName(loadedState.name);
        setNickname(loadedState.nickname);
        setAge(loadedState.age);
        setGender(loadedState.gender);
        setPronouns(loadedState.pronouns);
        setShowPronouns(loadedState.showPronouns);
        setPhotos(loadedState.photos);
        setGoalBadges(loadedState.goalBadges);
        setOpeners(loadedState.openers);
        setAppearInDiscover(loadedState.appearInDiscover);
        setSpotifyConnected(loadedState.spotifyConnected);
        setSpotifyTopArtists(loadedState.spotifyTopArtists);
        setInitialState(loadedState);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Only load profile once on mount, not on every focus
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadProfile();
    }
  }, [loadProfile]);

  const hasChanges = useCallback(() => {
    if (!initialState) return false;
    return (
      JSON.stringify(photos) !== JSON.stringify(initialState.photos) ||
      JSON.stringify(goalBadges) !== JSON.stringify(initialState.goalBadges) ||
      JSON.stringify(openers) !== JSON.stringify(initialState.openers) ||
      showPronouns !== initialState.showPronouns ||
      appearInDiscover !== initialState.appearInDiscover ||
      JSON.stringify(pronouns) !== JSON.stringify(initialState.pronouns) ||
      nickname !== initialState.nickname ||
      spotifyConnected !== initialState.spotifyConnected ||
      JSON.stringify(spotifyTopArtists) !== JSON.stringify(initialState.spotifyTopArtists)
    );
  }, [photos, goalBadges, openers, showPronouns, appearInDiscover, pronouns, nickname, spotifyConnected, spotifyTopArtists, initialState]);

  // Handle back button with unsaved changes confirmation
  const handleBackPress = useCallback(() => {
    if (hasChanges()) {
      setUnsavedModalVisible(true);
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
      },
    );
    return () => backHandler.remove();
  }, [handleBackPress]);

  const saveProfileData = useCallback(async (autoExit = true) => {
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
        (p) => p.startsWith("file://") || p.startsWith("content://"),
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
        pronouns: pronouns.length > 0 ? pronouns : null,
        nickname: nickname.trim() || null,
        spotify_connected: spotifyConnected,
        spotify_top_artists: spotifyTopArtists,
      });
      HapticsService.triggerNotificationSuccess();

      // Update photos state with Cloudinary URLs
      setPhotos(finalPhotos);

      setInitialState({
        name,
        nickname,
        age,
        gender,
        pronouns,
        showPronouns,
        photos: finalPhotos,
        goalBadges,
        openers,
        appearInDiscover,
        spotifyConnected,
        spotifyTopArtists,
      });

      if (autoExit) {
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          navigation.goBack();
        }, 1500);
      }
      return true;
    } catch (error) {
      console.error("Error saving:", error);
      Alert.alert("Error", "Failed to save. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    name,
    nickname,
    age,
    gender,
    pronouns,
    showPronouns,
    photos,
    goalBadges,
    openers,
    appearInDiscover,
    navigation,
  ]);

  const handleSave = useCallback(async () => {
    // Reset validation errors
    setValidationErrors({ photos: false, sparks: false, openers: false });

    // Photos are strictly required to save/exit discover profile at all
    if (photos.length < 3) {
      triggerSectionError("photos", photosShakeAnim);
      return;
    }

    const hasSparks = goalBadges.length > 0;
    const hasOpeners = openers.length > 0;

    if (!hasSparks || !hasOpeners) {
      let missingMsg = "";
      if (!hasSparks && !hasOpeners) {
        missingMsg = "at least 1 Spark and 1 conversation starter";
      } else if (!hasSparks) {
        missingMsg = "at least 1 Spark";
      } else {
        missingMsg = "at least 1 conversation starter";
      }
      setIncompleteMissingMsg(missingMsg);

      const success = await saveProfileData(false);
      if (success) {
        setIncompleteSaveModalVisible(true);
      }
      return;
    }

    await saveProfileData(true);
  }, [
    photos,
    goalBadges,
    openers,
    triggerSectionError,
    photosShakeAnim,
    saveProfileData,
  ]);

  // ImageUploader callback - receives array of image URIs
  const handlePhotosChange = useCallback((newPhotos) => {
    setPhotos(newPhotos);
    if (newPhotos.length >= 3) {
      setValidationErrors((prev) => ({ ...prev, photos: false }));
    }
    HapticsService.triggerSelection();
  }, []);

  const handleAddOpener = useCallback(() => {
    if (openers.length >= 3) {
      Alert.alert(
        "Maximum Openers",
        "You can add up to 3 conversation starters",
      );
      return;
    }
    navigation.navigate("OpenerSelection", {
      onSelect: (opener) => {
        setOpeners((prev) => {
          const next = [...prev, opener];
          setValidationErrors((prevErrors) => ({ ...prevErrors, openers: false }));
          return next;
        });
      },
    });
  }, [navigation, openers.length]);

  const handleRemoveOpener = useCallback((index) => {
    setOpeners((prev) => {
      const newOpeners = [...prev];
      newOpeners.splice(index, 1);
      if (newOpeners.length > 0) {
        setValidationErrors((prevErrors) => ({ ...prevErrors, openers: false }));
      }
      return newOpeners;
    });
    HapticsService.triggerSelection();
  }, []);

  const toggleGoal = useCallback((goal) => {
    HapticsService.triggerSelection();
    setGoalBadges((prev) => {
      let next;
      if (prev.includes(goal)) {
        next = prev.filter((g) => g !== goal);
      } else {
        if (prev.length >= 3) {
          Alert.alert("Limit Reached", "You can select up to 3 Sparks.");
          return prev;
        }
        next = [...prev, goal];
      }
      if (next.length > 0) {
        setValidationErrors((prevErrors) => ({ ...prevErrors, sparks: false }));
      }
      return next;
    });
  }, []);

  const handleAddCustomGoal = useCallback(() => {
    const trimmed = customGoal.trim();
    if (!trimmed) return;
    if (goalBadges.includes(trimmed)) {
      Alert.alert("Already Added", "This Spark is already selected.");
      return;
    }
    if (goalBadges.length >= 3) {
      Alert.alert("Limit Reached", "You can select up to 3 Sparks.");
      return;
    }
    setGoalBadges((prev) => {
      const next = [...prev, trimmed];
      setValidationErrors((prevErrors) => ({ ...prevErrors, sparks: false }));
      return next;
    });
    setCustomGoal("");
    setShowCustomGoalInput(false);
    HapticsService.triggerSelection();
  }, [customGoal, goalBadges]);

  const getCompletionPercentage = useCallback(() => {
    let pct = 0;
    
    // Photos (40% max)
    const photoCount = photos.length;
    if (photoCount === 1) pct += 10;
    else if (photoCount === 2) pct += 20;
    else if (photoCount >= 3) {
      pct += 30; // Min requirement met
      // Extra photos add to the score
      if (photoCount === 4) pct += 3.3;
      else if (photoCount === 5) pct += 6.6;
      else if (photoCount >= 6) pct += 10;
    }

    // Sparks (30% max)
    const badgeCount = goalBadges.length;
    if (badgeCount === 1) {
      pct += 20; // Min requirement met
    } else if (badgeCount === 2) {
      pct += 25;
    } else if (badgeCount >= 3) {
      pct += 30;
    }

    // Icebreakers/Openers (30% max)
    const openerCount = openers.length;
    if (openerCount === 1) {
      pct += 20; // Min requirement met
    } else if (openerCount === 2) {
      pct += 25;
    } else if (openerCount >= 3) {
      pct += 30;
    }

    return Math.min(Math.round(pct), 100);
  }, [photos.length, goalBadges.length, openers.length]);

  const completionPercentage = getCompletionPercentage();
  const changesExist = hasChanges();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <SnooLoader size="large" color={PRIMARY_COLOR} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with background covering status bar */}
      <SafeAreaView
        style={{ backgroundColor: CONSTANTS_COLORS.surface }}
        edges={EDGES}
      >
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBackPress}
            >
              <ArrowLeft size={24} color={TEXT_COLOR} strokeWidth={2} />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>My Discover Profile</Text>
            </View>
            {/* Circular Progress Indicator */}
            <View style={styles.progressContainer}>
              <Svg width="44" height="44" viewBox="0 0 44 44">
                <Defs>
                  <LinearGradient
                    id="progressGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <Stop offset="0%" stopColor="#2962FF" />
                    <Stop offset="100%" stopColor="#60A5FA" />
                  </LinearGradient>
                </Defs>
                {/* Background Ring */}
                <Circle
                  cx="22"
                  cy="22"
                  r="18"
                  stroke="#F1F5F9"
                  strokeWidth="4"
                  fill="transparent"
                />

                {/* Outer Glow (Subtle expansion) */}
                <Circle
                  cx="22"
                  cy="22"
                  r="18"
                  stroke={CONSTANTS_COLORS.primaryBlue}
                  strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 18}`}
                  strokeDashoffset={`${
                    2 * Math.PI * 18 * (1 - completionPercentage / 100)
                  }`}
                  fill="transparent"
                  strokeLinecap="round"
                  opacity={0.15}
                  rotation="-90"
                  origin="22, 22"
                />

                {/* Main Progress Ring */}
                <Circle
                  cx="22"
                  cy="22"
                  r="18"
                  stroke="url(#progressGradient)"
                  strokeWidth="4.5"
                  strokeDasharray={`${2 * Math.PI * 18}`}
                  strokeDashoffset={`${
                    2 * Math.PI * 18 * (1 - completionPercentage / 100)
                  }`}
                  fill="transparent"
                  strokeLinecap="round"
                  rotation="-90"
                  origin="22, 22"
                />
              </Svg>
              <View style={styles.progressTextContainer}>
                <Text style={styles.progressText}>
                  {Math.round(completionPercentage)}
                </Text>
              </View>
            </View>

            {/* Spacer to push Save button to the right */}
            <View style={{ flex: 1 }} />

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
        </View>
      </SafeAreaView>

      {showSuccess && (
        <View style={styles.successToast}>
          <CircleCheck size={24} color="#FFFFFF" strokeWidth={2} />
          <Text style={styles.successToastText}>Saved successfully!</Text>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION 1: Photos (Edge-to-Edge Editorial) */}
        <Animated.View
          onLayout={(event) => {
            sectionCoords.current.photos = event.nativeEvent.layout.y;
          }}
          style={[
            styles.sectionEditorial,
            { transform: [{ translateX: photosShakeAnim }] }
          ]}
        >
          <View
            style={[
              styles.sectionCardEditorial,
              validationErrors.photos && styles.cardErrorEditorial,
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View
                  style={[
                    styles.sectionIconContainer,
                    { backgroundColor: "#F5F3FF" },
                  ]}
                >
                  <Camera size={18} color="#7C3AED" />
                </View>
                <Text style={styles.cardTitle}>Photos & Videos</Text>
              </View>
            </View>

            <View style={styles.cardContent}>
              <ImageUploader
                ref={imageUploaderRef}
                onImagesChange={handlePhotosChange}
                maxImages={6}
                minRequired={3}
                enableCrop={true}
                cropPreset="feed_portrait"
                lockAspectRatio={true}
                initialImages={photos}
                hingeStyle={true}
                containerPadding={32}
                style={{ marginBottom: 0 }}
              />
              {photos.length < 3 && (
                <View style={styles.inlineWarning}>
                  <AlertCircle
                    size={16}
                    color={CONSTANTS_COLORS.error}
                    strokeWidth={2}
                  />
                  <Text style={styles.inlineWarningText}>
                    Add {3 - photos.length} more photo
                    {3 - photos.length !== 1 ? "s" : ""} to appear in discovery
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* SECTION 2: Identity (Rounded Card) */}
        <View style={styles.section}>
          <View style={styles.sectionCardRounded}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View
                  style={[
                    styles.sectionIconContainer,
                    { backgroundColor: "#EEF2FF" },
                  ]}
                >
                  <User size={18} color="#4F46E5" />
                </View>
                <Text style={styles.cardTitle}>Identity</Text>
              </View>
            </View>

            <View style={styles.cardContent}>
              <View style={styles.identityRowNoLine}>
                <Text style={styles.identityLabel}>Name</Text>
                <View style={styles.identityValueRow}>
                  <Text style={styles.identityValue}>{name}</Text>
                  <Lock size={16} color={CONSTANTS_COLORS.disabledIcon} />
                </View>
              </View>

              <View style={styles.identityRowNoLine}>
                <Text style={styles.identityLabel}>Nick Name</Text>
                <TextInput
                  style={styles.identityInput}
                  value={nickname}
                  onChangeText={(text) => {
                    setNickname(text);
                  }}
                  placeholder="Set a nickname"
                  placeholderTextColor={CONSTANTS_COLORS.textSecondary}
                  maxLength={50}
                  returnKeyType="done"
                />
              </View>

              <View style={styles.identityRowNoLine}>
                <Text style={styles.identityLabel}>Age</Text>
                <View style={styles.identityValueRow}>
                  <Text style={styles.identityValue}>{age || "—"}</Text>
                  <Lock size={16} color={CONSTANTS_COLORS.disabledIcon} />
                </View>
              </View>

              <View style={styles.identityRowNoLine}>
                <Text style={styles.identityLabel}>Gender</Text>
                <View style={styles.identityValueRow}>
                  <Text style={styles.identityValue}>{gender || "—"}</Text>
                  <Lock size={16} color={CONSTANTS_COLORS.disabledIcon} />
                </View>
              </View>

              <TouchableOpacity
                style={styles.identityRowNoLine}
                onPress={() => {
                  HapticsService.triggerSelection();
                  setShowPronounsModal(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.identityLabel}>Pronouns</Text>
                <View style={styles.identityValueRow}>
                  <Text style={styles.identityValue}>
                    {pronouns.length > 0 ? pronouns.join(", ") : "Add Pronouns"}
                  </Text>
                  <ChevronRight size={18} color={CONSTANTS_COLORS.disabledIcon} />
                </View>
              </TouchableOpacity>

              <View style={styles.identityRowNoLine}>
                <Text style={styles.identityLabel}>Show Pronouns</Text>
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
          </View>
        </View>

        {/* SECTION 2.5: Connections (Spotify) */}
        <View style={styles.section}>
          <View style={styles.sectionCardRounded}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View
                  style={[
                    styles.sectionIconContainer,
                    { backgroundColor: "#E8FBF0" },
                  ]}
                >
                  <Music size={18} color="#1DB954" />
                </View>
                <Text style={styles.cardTitle}>Connections</Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              <SpotifyConnectorWidget
                connected={spotifyConnected}
                onConnectedChange={setSpotifyConnected}
                topArtists={spotifyTopArtists}
                onArtistsChange={setSpotifyTopArtists}
                accentColor={PRIMARY_COLOR}
                onRefreshProfile={loadProfile}
              />
            </View>
          </View>
        </View>

        {/* SECTION 3: Sparks (Edge-to-Edge Editorial) */}
        <Animated.View
          onLayout={(event) => {
            sectionCoords.current.sparks = event.nativeEvent.layout.y;
          }}
          style={[
            styles.sectionEditorial,
            { transform: [{ translateX: sparksShakeAnim }] }
          ]}
        >
          <View
            style={[
              styles.sectionCardEditorial,
              validationErrors.sparks && styles.cardErrorEditorial,
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View
                  style={[
                    styles.sectionIconContainer,
                    { backgroundColor: "#FFF7ED" },
                  ]}
                >
                  <Sparkles size={18} color="#EA580C" />
                </View>
                <Text style={styles.cardTitle}>Sparks</Text>
              </View>
              <View style={styles.cardRequiredBadge}>
                <Text style={styles.cardRequiredBadgeText}>REQUIRED</Text>
              </View>
            </View>
            <Text style={styles.sectionHint}>
              What are you looking for? Select 1-3 sparks.
            </Text>

            <View style={styles.cardContent}>
              {/* Wrapped in surface light container, no border */}
              <View style={styles.chipsContainerSoft}>
                {GOAL_BADGE_PRESETS.map((goal, index) => {
                  const isSelected = goalBadges.includes(goal);

                  return (
                     <TouchableOpacity
                       key={goal}
                       onPress={() => toggleGoal(goal)}
                       activeOpacity={0.7}
                       style={[
                         styles.goalChip,
                         isSelected
                           ? styles.goalChipSelected
                           : styles.goalChipUnselected,
                       ]}
                     >
                       <Text style={styles.goalChipText}>
                         {goal}
                       </Text>
                     </TouchableOpacity>
                   );
                 })}
                 {goalBadges.filter(g => !GOAL_BADGE_PRESETS.includes(g)).map((goal) => (
                   <TouchableOpacity
                     key={goal}
                     onPress={() => toggleGoal(goal)}
                     activeOpacity={0.7}
                     style={[styles.goalChip, styles.goalChipSelected]}
                   >
                     <Text style={styles.goalChipText}>
                       {goal}
                     </Text>
                   </TouchableOpacity>
                 ))}
              </View>

              {showCustomGoalInput ? (
                <View style={styles.customGoalInputContainer}>
                  <TextInput
                    style={styles.customGoalInput}
                    placeholder="Enter custom spark..."
                    placeholderTextColor={CONSTANTS_COLORS.textSecondary}
                    value={customGoal}
                    onChangeText={setCustomGoal}
                    maxLength={25}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={styles.customGoalAddButton}
                    onPress={handleAddCustomGoal}
                  >
                    <Plus size={16} color="#FFFFFF" strokeWidth={3} />
                    <Text style={styles.customGoalAddButtonText}>Add</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.customGoalCancelButton}
                    onPress={() => {
                      setShowCustomGoalInput(false);
                      setCustomGoal("");
                    }}
                  >
                    <X size={18} color={CONSTANTS_COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addCustomGoalTrigger}
                  onPress={() => {
                    HapticsService.triggerSelection();
                    setShowCustomGoalInput(true);
                  }}
                >
                  <Plus size={16} color={PRIMARY_COLOR} strokeWidth={2.5} />
                  <Text style={styles.addCustomGoalTriggerText}>Add Custom Spark</Text>
                </TouchableOpacity>
              )}

              {goalBadges.length === 0 && (
                <View style={styles.inlineWarning}>
                  <AlertCircle
                    size={16}
                    color={CONSTANTS_COLORS.error}
                    strokeWidth={2}
                  />
                  <Text style={styles.inlineWarningText}>
                    Select at least 1 Spark
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* SECTION 4: Conversation Starters (Rounded Card) */}
        <Animated.View
          onLayout={(event) => {
            sectionCoords.current.openers = event.nativeEvent.layout.y;
          }}
          style={[
            styles.section,
            { transform: [{ translateX: openersShakeAnim }] }
          ]}
        >
          <View
            style={[
              styles.sectionCardRounded,
              validationErrors.openers && styles.cardErrorRounded,
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View
                  style={[
                    styles.sectionIconContainer,
                    { backgroundColor: "#E6F7F5" },
                  ]}
                >
                  <MessageSquare size={18} color="#059669" />
                </View>
                <Text style={styles.cardTitle}>Icebreakers</Text>
              </View>
              <View style={styles.cardRequiredBadge}>
                <Text style={styles.cardRequiredBadgeText}>REQUIRED</Text>
              </View>
            </View>
            <Text style={styles.sectionHint}>
              Help others start a conversation with you. Add 1-3 openers.
            </Text>

            <View style={styles.cardContent}>
              {openers.map((opener, index) => (
                <View key={index} style={styles.openerCardFormatted}>
                  <View style={styles.openerContent}>
                    <Text style={styles.openerPromptSmall}>
                      {opener.prompt}
                    </Text>
                    <Text style={styles.openerResponseBold}>
                      {opener.response}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.openerRemove}
                    onPress={() => handleRemoveOpener(index)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={18} color={CONSTANTS_COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}

              {openers.length < 3 && (
                <TouchableOpacity
                  style={styles.openerAddButton}
                  onPress={handleAddOpener}
                >
                  <Plus size={20} color="#FFFFFF" strokeWidth={3} />
                  <Text style={styles.openerAddButtonText}>Add Opener</Text>
                </TouchableOpacity>
              )}

              {openers.length === 0 && (
                <View style={styles.inlineWarning}>
                  <AlertCircle
                    size={16}
                    color={CONSTANTS_COLORS.error}
                    strokeWidth={2}
                  />
                  <Text style={styles.inlineWarningText}>
                    Add at least 1 starter
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* SECTION 5: Privacy (Rounded Card) */}
        <View style={styles.section}>
          <View style={styles.sectionCardRounded}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View
                  style={[
                    styles.sectionIconContainer,
                    { backgroundColor: "#F1F5F9" },
                  ]}
                >
                  <Shield size={18} color="#475569" />
                </View>
                <Text style={styles.cardTitle}>Privacy</Text>
              </View>
            </View>

            <View style={styles.cardContent}>
              <View style={styles.privacyRow}>
                <View style={styles.privacyTextContainer}>
                  <Text style={styles.privacyLabel}>Appear in Discover</Text>
                  <Text style={styles.privacySubtitle}>
                    Others can find and message you
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggle,
                    appearInDiscover && {
                      backgroundColor: CONSTANTS_COLORS.primaryBlue,
                    },
                  ]}
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
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Unsaved Changes Custom Alert Modal */}
      <Modal
        visible={unsavedModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setUnsavedModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Close / Discard Icon in Top Right */}
            <TouchableOpacity
              style={styles.modalCloseButton}
              activeOpacity={0.7}
              onPress={() => {
                setUnsavedModalVisible(false);
                navigation.goBack();
              }}
            >
              <X size={20} color="#64748B" strokeWidth={2.5} />
            </TouchableOpacity>

            {/* Warning Icon with Tinted Background */}
            <View style={styles.modalIconContainer}>
              <AlertCircle size={22} color="#EA580C" />
            </View>

            {/* Title */}
            <Text style={styles.modalTitle}>Unsaved Changes</Text>

            {/* Description */}
            <Text style={styles.modalDescription}>
              You have unsaved changes. What would you like to do?
            </Text>

            {/* Action Buttons */}
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={styles.modalPrimaryButton}
                activeOpacity={0.8}
                onPress={async () => {
                  setUnsavedModalVisible(false);
                  await handleSave();
                }}
              >
                <Text style={styles.modalPrimaryButtonText}>Save & Exit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSecondaryButton}
                activeOpacity={0.8}
                onPress={() => setUnsavedModalVisible(false)}
              >
                <Text style={styles.modalSecondaryButtonText}>Keep Editing</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Incomplete Profile Save Custom Modal */}
      <Modal
        visible={incompleteSaveModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setIncompleteSaveModalVisible(false);
          navigation.goBack();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Warning Icon with Tinted Background */}
            <View style={[styles.modalIconContainer, { backgroundColor: "#FEF2F2" }]}>
              <AlertCircle size={22} color="#DC2626" />
            </View>

            {/* Title */}
            <Text style={styles.modalTitle}>Profile Saved (Incomplete)</Text>

            {/* Description */}
            <Text style={styles.modalDescription}>
              Your changes have been saved. Note that you won't be able to access Discover People until you add {incompleteMissingMsg}.
            </Text>

            {/* Action Buttons */}
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={styles.modalPrimaryButton}
                activeOpacity={0.8}
                onPress={() => {
                  setIncompleteSaveModalVisible(false);
                  navigation.goBack();
                }}
              >
                <Text style={styles.modalPrimaryButtonText}>Got It</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Pronouns Selection Modal */}
      <Modal
        visible={showPronounsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPronounsModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowPronounsModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.pronounsModalContainer}>
                <View style={styles.pronounsModalHeader}>
                  <Text style={styles.pronounsModalTitle}>Select Pronouns</Text>
                  <TouchableOpacity
                    onPress={() => setShowPronounsModal(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={24} color={TEXT_COLOR} />
                  </TouchableOpacity>
                </View>

                <View style={styles.pronounsPillsContainer}>
                  {pronounPresets.map((p) => {
                    const isSelected = pronouns.includes(p);
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
                          styles.pronounPresetPill,
                          isSelected && styles.pronounPresetPillSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.pronounPresetText,
                            isSelected && styles.pronounPresetTextSelected,
                          ]}
                        >
                          {p}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={styles.pronounsDoneButton}
                  onPress={() => setShowPronounsModal(false)}
                >
                  <Text style={styles.pronounsDoneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB", // Keeping screen background neutral
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Header
  header: {
    backgroundColor: CONSTANTS_COLORS.surface,
    paddingTop: SPACING.m,
    paddingBottom: SPACING.m, // Added padding for better height
    borderBottomWidth: 0, // No border as per cleaner look request, or keep? "Neutral Border" specified in rules.
    borderBottomColor: CONSTANTS_COLORS.border,
    paddingHorizontal: SPACING.m, // Ensure horizontal padding for flex layout
    flexDirection: "row", // Horizontal layout for the whole header
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTopRow: {
    flex: 1, // Take up remaining space
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTextContainer: {
    marginLeft: 8,
  },
  headerTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 20, // Slightly larger
    color: TEXT_COLOR,
  },
  headerSubtitle: {
    display: "none", // Hidden as per "Circular Progress" driving status
  },
  saveButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 16,
    height: 36,
    borderRadius: BORDER_RADIUS.pill,
    justifyContent: "center",
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: CONSTANTS_COLORS.border,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: FONTS.semiBold,
  },
  saveButtonTextDisabled: {
    color: CONSTANTS_COLORS.textSecondary,
  },

  // Header Progress
  progressContainer: {
    // Space handled by gap in headerTopRow
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  progressTextContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  progressText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: CONSTANTS_COLORS.primaryBlue,
  },
  // Removed old progressBar styling

  // Section Card Layouts
  sectionCardEditorial: {
    backgroundColor: CONSTANTS_COLORS.surface,
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  sectionCardRounded: {
    backgroundColor: CONSTANTS_COLORS.surface,
    borderRadius: 28,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 0,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: {
    fontFamily: FONTS.primary,
    fontSize: 20,
    color: "#0F172A",
  },
  cardRequiredBadge: {
    backgroundColor: "#FFF1F2",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  cardRequiredBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: "#F43F5E",
  },
  cardContent: {
    width: "100%",
  },

  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16, // Padding for floating cards
    marginBottom: 16,
  },
  sectionEditorial: {
    paddingHorizontal: 0, // Edge-to-edge
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 18,
    color: TEXT_COLOR,
    marginBottom: 12,
  },
  sectionHint: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 16,
    lineHeight: 20,
  },

  // CARD NO BORDER STYLE (Identity)
  cardContainerNoBorder: {
    backgroundColor: CONSTANTS_COLORS.surface,
    paddingHorizontal: 0, // Align with text
  },
  identityRowNoLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12, // Reduced padding
    // NO BORDER
  },
  identityLabel: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
  },
  identityLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  identityValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  identityValue: {
    fontFamily: FONTS.medium,
    fontSize: 16,
    color: TEXT_COLOR,
  },
  pronounsPreview: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: CONSTANTS_COLORS.textPrimary, // Selected state Primary Text
  },

  // Privacy Styling inside Card
  privacyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  privacyTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  privacyLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 17,
    color: "#1E293B",
  },
  privacySubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: "#64748B",
    marginTop: 2,
  },

  // Warning
  inlineWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
    alignSelf: "flex-start",
  },
  inlineWarningText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: CONSTANTS_COLORS.error,
  },
  requiredBadge: {
    display: "none", // Removed "Required" badge visually if strict layout
  },
  requiredBadgeText: {
    display: "none",
  },

  // Toggle
  toggle: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#E2E8F0",
    padding: 3,
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: "#3B82F6",
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleKnobActive: {
    alignSelf: "flex-end",
  },
  toggleHintText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    marginTop: 4,
  },

  // CHIPS CONTAINER SOFT
  chipsContainerSoft: {
    backgroundColor: CONSTANTS_COLORS.surfaceLight, // Surface Light
    padding: 12,
    borderRadius: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  goalChip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 8, // Soft rectangle look
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0, // No border
  },
  goalChipUnselected: {
    backgroundColor: CONSTANTS_COLORS.surfaceNeutral, // #F3F6F8
  },
  goalChipSelected: {
    backgroundColor: CONSTANTS_COLORS.secondaryAccent, // #D4EEEF
  },
  goalChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: CONSTANTS_COLORS.textPrimary,
  },

  // Icebreakers / Openers
  openerCardFormatted: {
    backgroundColor: "#F8FAFC",
    padding: 20,
    marginBottom: 16,
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  openerContent: {
    flex: 1,
    marginRight: 12,
  },
  openerPromptSmall: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: "#94A3B8",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  openerResponseBold: {
    fontFamily: FONTS.semiBold,
    fontSize: 18,
    color: "#0F172A",
    lineHeight: 26,
  },
  openerRemove: {
    padding: 4,
    marginTop: -4,
  },

  // New Opener Add Button (Solid Blue)
  openerAddButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 27,
    backgroundColor: "#3B82F6",
    gap: 10,
    marginTop: 8,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  openerAddButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 17,
    color: "#FFFFFF",
  },
  customGoalInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
    backgroundColor: CONSTANTS_COLORS.surfaceLight,
    borderRadius: 12,
    padding: 8,
  },
  customGoalInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: CONSTANTS_COLORS.textPrimary,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  customGoalAddButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 8,
    gap: 4,
  },
  customGoalAddButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#FFFFFF",
  },
  customGoalCancelButton: {
    padding: 8,
  },
  addCustomGoalTrigger: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    gap: 6,
  },
  addCustomGoalTriggerText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: PRIMARY_COLOR,
  },
  
  // Custom Alert Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.4)", // Slate overlay
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "86%",
    maxWidth: 340,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  modalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF7ED", // Soft Orange Tint background
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 20,
    color: "#0F172A",
    marginBottom: 8,
    textAlign: "center",
  },
  modalDescription: {
    fontFamily: FONTS.regular, // Manrope Regular
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButtonContainer: {
    width: "100%",
    gap: 10,
  },
  modalPrimaryButton: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    backgroundColor: "#2962FF", // Brand Blue
    justifyContent: "center",
    alignItems: "center",
  },
  modalPrimaryButtonText: {
    fontFamily: FONTS.semiBold, // Manrope SemiBold
    fontSize: 16,
    color: "#FFFFFF",
  },
  modalSecondaryButton: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F1F5F9", // Neutral Slate background
    justifyContent: "center",
    alignItems: "center",
  },
  modalSecondaryButtonText: {
    fontFamily: FONTS.semiBold, // Manrope SemiBold
    fontSize: 16,
    color: "#475569",
  },
  modalCloseButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  cardErrorEditorial: {
    backgroundColor: "#FFF5F5",
    borderBottomColor: "#FCA5A5",
  },
  cardErrorRounded: {
    backgroundColor: "#FFF5F5",
    borderColor: "#FCA5A5",
  },
  pronounsModalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    width: "100%",
    position: "absolute",
    bottom: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 10,
  },
  pronounsModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  pronounsModalTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 20,
    color: "#0F172A",
  },
  pronounsPillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 28,
  },
  pronounPresetPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  pronounPresetPillSelected: {
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    borderColor: "#2962FF",
  },
  pronounPresetText: {
    fontFamily: FONTS.medium, // Manrope-Medium
    fontSize: 15,
    color: "#475569",
  },
  pronounPresetTextSelected: {
    color: "#2962FF",
    fontFamily: FONTS.semiBold, // Manrope-SemiBold
  },
  pronounsDoneButton: {
    backgroundColor: "#2962FF",
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  pronounsDoneButtonText: {
    fontFamily: FONTS.semiBold, // Manrope-SemiBold
    fontSize: 16,
    color: "#FFFFFF",
  },
  identityInput: {
    fontFamily: FONTS.medium,
    fontSize: 16,
    color: "#0F172A",
    textAlign: "right",
    flex: 1,
    marginLeft: 16,
    paddingVertical: 4,
  },
});
