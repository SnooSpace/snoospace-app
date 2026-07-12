import React, { useState, useEffect, useRef, useCallback } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Image, Alert, BackHandler, Platform, TextInput, Modal, Animated, TouchableWithoutFeedback, InteractionManager, StatusBar, LayoutAnimation, UIManager, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Svg, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { getAuthToken } from "../../api/auth";
import { apiGet } from "../../api/client";
import { updateMemberProfile, fetchPronouns, fetchInterests } from "../../api/members";
import { getSystemSparks, searchSparks, addUserSpark, removeUserSpark, createCustomSpark } from "../../api/sparks";
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
  ChevronDown,
  Search as SearchIcon,
  RollerCoaster,
  Dumbbell,
  Palette as Art,
  Clapperboard,
  UtensilsCrossed,
  Mountain,
  Gamepad2,
  PartyPopper,
  Car,
  PawPrint,
  Zap,
} from "lucide-react-native";
import { INTEREST_CATEGORIES, getInterestStyle } from "../profile/member/EditProfileConstants";
import { useLocationSearch } from "../../services/location/useLocationSearch";
import SnooLoader from "../../components/ui/SnooLoader";
import { useToast } from "../../context/ToastContext";
import SpotifyConnectorWidget from "../../components/SpotifyConnectorWidget";

// Enable LayoutAnimation for Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

const EDGES = ["top"];

// ── Category colour palette for spark chips ───────────────────────────────────
const CATEGORY_COLORS = {
  professional: { bg: "#EFF6FF", text: "#1D4ED8" },
  social:       { bg: "#F0FDF4", text: "#15803D" },
  activity:     { bg: "#FFF7ED", text: "#C2410C" },
  learning:     { bg: "#F5F3FF", text: "#6D28D9" },
  travel:       { bg: "#E0F2FE", text: "#0369A1" },
  default:      { bg: "#F3F4F6", text: "#374151" },
};
const getSparkStyle = (category) => CATEGORY_COLORS[category] || CATEGORY_COLORS.default;

const CATEGORY_LABELS = {
  professional: "Professional",
  social:       "Social",
  activity:     "Activity",
  learning:     "Learning",
  travel:       "Travel",
};

export default function EditDiscoverProfileScreen({ navigation }) {
  const { showToast } = useToast();
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
  const [gender, setGender] = useState("");
  const [pronouns, setPronouns] = useState([]);
  const [showPronouns, setShowPronouns] = useState(true);
  const [showPronounsModal, setShowPronounsModal] = useState(false);
  const [pronounPresets, setPronounPresets] = useState(["He/Him", "She/Her", "They/Them"]);
  const [photos, setPhotos] = useState([]);
  // goalBadges: array of { id, label, category, requires_date_range, requires_location,
  //                         start_date?, end_date?, target_city? }
  const [goalBadges, setGoalBadges] = useState([]);
  const [openers, setOpeners] = useState([]);
  const [appearInDiscover, setAppearInDiscover] = useState(true);
  // Custom spark creation state
  const [customGoal, setCustomGoal] = useState("");
  const [showCustomGoalInput, setShowCustomGoalInput] = useState(false);
  const [customGoalSuggestions, setCustomGoalSuggestions] = useState([]);
  const [showCustomGoalSuggestions, setShowCustomGoalSuggestions] = useState(false);
  // Travel location + date picker state (one active panel at a time)
  const [travelDatePickerSparkId, setTravelDatePickerSparkId] = useState(null);
  const [travelStartDate, setTravelStartDate] = useState("");
  const [travelEndDate, setTravelEndDate] = useState("");
  // City autocomplete for the active travel spark
  const {
    query: cityQuery,
    setQuery: setCityQuery,
    results: cityResults,
    loading: citySearchLoading,
    clearResults: clearCityResults,
  } = useLocationSearch({ debounceMs: 350 });
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyTopArtists, setSpotifyTopArtists] = useState([]);
  const [interests, setInterests] = useState([]);
  const [interestsCatalog, setInterestsCatalog] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [showAllSelected, setShowAllSelected] = useState(false);
  // System sparks catalog
  const [sparkCategories, setSparkCategories] = useState([]); // [{ category, sparks }]
  const [sparksLoading, setSparksLoading] = useState(false);
  const [sparkSearch, setSparkSearch] = useState("");
  const [sparkSearchResults, setSparkSearchResults] = useState([]);
  const [sparkSearchLoading, setSparkSearchLoading] = useState(false);
  const sparkSearchTimer = useRef(null);

  // Initial state for change detection
  const [initialState, setInitialState] = useState(null);
  const imageUploaderRef = useRef(null);
  const hasLoadedRef = useRef(false);

  // Scroll and validation tracking
  const scrollViewRef = useRef(null);
  const sectionCoords = useRef({});
  const customInputTextRef = useRef(null);
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
          gender: profile.gender || "Not Specified",
          pronouns: profile.pronouns || [],
          showPronouns: profile.show_pronouns !== false,
          photos: profile.discover_photos || [],
          // sparks: array of { id, label, category, requires_date_range, start_date, end_date }
          goalBadges: Array.isArray(profile.sparks) ? profile.sparks : [],
          openers: profile.openers || [],
          appearInDiscover: profile.appear_in_discover !== false,
          spotifyConnected: !!profile.spotify_connected,
          spotifyTopArtists: profile.spotify_top_artists || [],
          interests: profile.interests || [],
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
        setInterests(loadedState.interests);
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
      const task = InteractionManager.runAfterInteractions(() => {
        loadProfile();
      });
      return () => task.cancel();
    }
  }, [loadProfile]);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const catalog = await fetchInterests();
        setInterestsCatalog(catalog || []);
      } catch (err) {
        console.error("Error loading interests catalog:", err);
      }
    };
    loadCatalog();
  }, []);

  // Load system sparks catalog once on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setSparksLoading(true);
      try {
        const data = await getSystemSparks();
        if (!cancelled) setSparkCategories(data);
      } catch (e) {
        console.warn("[EditDiscoverProfile] Failed to load sparks:", e.message);
      } finally {
        if (!cancelled) setSparksLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Debounced spark search
  useEffect(() => {
    if (sparkSearchTimer.current) clearTimeout(sparkSearchTimer.current);
    const q = sparkSearch.trim();
    if (q.length < 2) {
      setSparkSearchResults([]);
      return;
    }
    setSparkSearchLoading(true);
    sparkSearchTimer.current = setTimeout(async () => {
      try {
        const results = await searchSparks(q);
        setSparkSearchResults(results);
      } catch (e) {
        setSparkSearchResults([]);
      } finally {
        setSparkSearchLoading(false);
      }
    }, 300);
    return () => { if (sparkSearchTimer.current) clearTimeout(sparkSearchTimer.current); };
  }, [sparkSearch]);

  const hasChanges = useCallback(() => {
    if (!initialState) return false;
    // Compare spark IDs (not full objects) for change detection
    const currentSparkIds = goalBadges.map((s) => s.id).sort().join(',');
    const initialSparkIds = (initialState.goalBadges || []).map((s) => s.id).sort().join(',');
    return (
      JSON.stringify(photos) !== JSON.stringify(initialState.photos) ||
      currentSparkIds !== initialSparkIds ||
      JSON.stringify(openers) !== JSON.stringify(initialState.openers) ||
      showPronouns !== initialState.showPronouns ||
      appearInDiscover !== initialState.appearInDiscover ||
      JSON.stringify(pronouns) !== JSON.stringify(initialState.pronouns) ||
      nickname !== initialState.nickname ||
      spotifyConnected !== initialState.spotifyConnected ||
      JSON.stringify(spotifyTopArtists) !== JSON.stringify(initialState.spotifyTopArtists) ||
      JSON.stringify(interests) !== JSON.stringify(initialState.interests)
    );
  }, [photos, goalBadges, openers, showPronouns, appearInDiscover, pronouns, nickname, spotifyConnected, spotifyTopArtists, interests, initialState]);

  // Handle back button with unsaved changes confirmation
  const handleBackPress = useCallback(() => {
    Keyboard.dismiss();
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
    interests,
    initialState,
    navigation,
    hasChanges,
  ]);

  useEffect(() => {
    const unsubscribeBlur = navigation.addListener("blur", () => {
      Keyboard.dismiss();
    });
    const unsubscribeRemove = navigation.addListener("beforeRemove", () => {
      Keyboard.dismiss();
    });
    return () => {
      unsubscribeBlur();
      unsubscribeRemove();
      Keyboard.dismiss();
    };
  }, [navigation]);

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

      // ── Spark diff: add/remove only what changed ────────────────────────────
      const initialSparkIds = new Set((initialState?.goalBadges || []).map((s) => s.id));
      const currentSparkIds = new Set(goalBadges.map((s) => s.id));

      const sparksToAdd = goalBadges.filter((s) => !initialSparkIds.has(s.id));
      const sparksToRemove = (initialState?.goalBadges || []).filter((s) => !currentSparkIds.has(s.id));

      await Promise.all([
        ...sparksToAdd.map((s) =>
          addUserSpark(s.id, {
            start_date: s.start_date || undefined,
            end_date: s.end_date || undefined,
            target_city: s.target_city || undefined,
          }).catch((e) => console.warn('addUserSpark failed for', s.id, e.message))
        ),
        ...sparksToRemove.map((s) =>
          removeUserSpark(s.id).catch((e) => console.warn('removeUserSpark failed for', s.id, e.message))
        ),
      ]);
      // ── End spark diff ──────────────────────────────────────────────────────

      await updateMemberProfile({
        discover_photos: finalPhotos,
        openers: openers,
        show_pronouns: showPronouns,
        appear_in_discover: appearInDiscover,
        pronouns: pronouns.length > 0 ? pronouns : null,
        nickname: nickname.trim() || null,
        spotify_connected: spotifyConnected,
        spotify_top_artists: spotifyTopArtists,
        interests: interests.length > 0 ? interests : [],
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
        interests,
      });

      if (autoExit) {
        setShowSuccess(true);
        Keyboard.dismiss();
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
    spotifyConnected,
    spotifyTopArtists,
    interests,
    navigation,
  ]);

  const handleSave = useCallback(async () => {
    Keyboard.dismiss();
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

  // Toggle a system spark on/off (uses spark object {id, label, category, requires_date_range})
  const toggleSpark = useCallback((spark) => {
    HapticsService.triggerSelection();
    setGoalBadges((prev) => {
      const alreadySelected = prev.some((g) => g.id === spark.id);
      let next;
      if (alreadySelected) {
        next = prev.filter((g) => g.id !== spark.id);
      } else {
        if (prev.length >= 5) {
          showToast("Limit Reached", "You can select up to 5 Sparks.", "error");
          return prev;
        }
        next = [...prev, { ...spark }];
      }
      if (next.length > 0) {
        setValidationErrors((prevErrors) => ({ ...prevErrors, sparks: false }));
      }
      // Auto scroll to the Sparks section / travel inputs to make them visible
      if (!alreadySelected && (spark.category === 'travel' || spark.requires_date_range || spark.requires_location)) {
        setTimeout(() => {
          if (scrollViewRef.current && sectionCoords.current.sparks) {
            scrollViewRef.current.scrollTo({
              y: Math.max(0, sectionCoords.current.sparks - 10),
              animated: true,
            });
          }
        }, 100);
      }
      return next;
    });
  }, []);

  // Update travel dates on an already-selected spark
  const updateSparkDates = useCallback((sparkId, start_date, end_date) => {
    setGoalBadges((prev) =>
      prev.map((g) => g.id === sparkId ? { ...g, start_date, end_date } : g)
    );
  }, []);

  // Update target_city on an already-selected spark
  const updateSparkCity = useCallback((sparkId, target_city) => {
    setGoalBadges((prev) =>
      prev.map((g) => g.id === sparkId ? { ...g, target_city } : g)
    );
  }, []);

  // Programmatic manual focus after mounting the custom input container
  useEffect(() => {
    if (showCustomGoalInput) {
      const timer = setTimeout(() => {
        customInputTextRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showCustomGoalInput]);

  // Custom spark creation (calls API, handles dedup suggestions)
  const handleCustomSparkSubmit = useCallback(async (category = 'social') => {
    const trimmed = customGoal.trim();
    if (!trimmed || trimmed.length < 3) {
      Alert.alert('Too Short', 'Spark must be at least 3 characters.');
      return;
    }
    if (goalBadges.length >= 5) {
      showToast('Limit Reached', 'You can select up to 5 Sparks.', 'error');
      return;
    }
    try {
      const result = await createCustomSpark(trimmed, category);
      if (result?.action === 'suggest') {
        // Show suggestions
        setCustomGoalSuggestions(result.suggestions || []);
        setShowCustomGoalSuggestions(true);
        return;
      }
      if (result?.success && result?.spark) {
        Keyboard.dismiss();
        setGoalBadges((prev) => [
          ...prev,
          { id: result.spark.id, label: result.spark.label, category: result.spark.category, requires_date_range: false },
        ]);
        setValidationErrors((prev) => ({ ...prev, sparks: false }));
        setCustomGoal('');
        setShowCustomGoalInput(false);
        setShowCustomGoalSuggestions(false);
        setCustomGoalSuggestions([]);
        HapticsService.triggerNotificationSuccess();
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to create custom spark. Please try again.');
    }
  }, [customGoal, goalBadges]);

  // Force-create custom spark (user dismissed suggestions)
  const handleForceCreateSpark = useCallback(async (category = 'social') => {
    const trimmed = customGoal.trim();
    if (!trimmed) return;
    try {
      const result = await createCustomSpark(trimmed, category, true);
      if (result?.success && result?.spark) {
        Keyboard.dismiss();
        setGoalBadges((prev) => [
          ...prev,
          { id: result.spark.id, label: result.spark.label, category: result.spark.category, requires_date_range: false },
        ]);
        setValidationErrors((prev) => ({ ...prev, sparks: false }));
        setCustomGoal('');
        setShowCustomGoalInput(false);
        setShowCustomGoalSuggestions(false);
        setCustomGoalSuggestions([]);
        HapticsService.triggerNotificationSuccess();
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to create custom spark. Please try again.');
    }
  }, [customGoal]);

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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={CONSTANTS_COLORS.surface} />
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
            {!loading && (
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
            )}

            {/* Spacer to push Save button to the right */}
            <View style={{ flex: 1 }} />

            {!loading && (
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
            )}
          </View>
        </View>
      </SafeAreaView>

      {showSuccess && (
        <View style={styles.successToast}>
          <CircleCheck size={24} color="#FFFFFF" strokeWidth={2} />
          <Text style={styles.successToastText}>Saved successfully!</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <SnooLoader size="large" color={PRIMARY_COLOR} />
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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

              {/* Selected sparks summary strip */}
              {goalBadges.length > 0 && (
                <View style={styles.selectedSparksStrip}>
                  {goalBadges.map((spark) => {
                    const catStyle = getSparkStyle(spark.category);
                    return (
                      <TouchableOpacity
                        key={`sel-${spark.id}`}
                        style={[styles.selectedSparkChip, { backgroundColor: catStyle.bg }]}
                        onPress={() => toggleSpark(spark)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.selectedSparkChipText, { color: catStyle.text }]}>
                          {spark.label}
                        </Text>
                        <X size={12} color={catStyle.text} strokeWidth={3} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Travel expansion panel: city autocomplete + date range */}
              {goalBadges
                .filter((s) => s.requires_date_range || s.requires_location || s.category === 'travel')
                .map((spark) => (
                  <View key={`travel-${spark.id}`} style={styles.travelDatesRow}>
                    <Text style={styles.travelDatesLabel}>
                      📍 {spark.label}{spark.target_city ? ` · ${spark.target_city}` : ''}
                    </Text>

                    {/* City autocomplete — only for requires_location sparks */}
                    {spark.requires_location !== false && (
                      <View style={{ marginBottom: 8 }}>
                        <View style={styles.citySearchBar}>
                          <SearchIcon size={14} color={CONSTANTS_COLORS.textSecondary} style={{ marginRight: 6 }} />
                          <TextInput
                            style={styles.citySearchInput}
                            placeholder="Search city or area..."
                            placeholderTextColor={CONSTANTS_COLORS.textSecondary}
                            value={spark.target_city || cityQuery}
                            onChangeText={(v) => {
                              // Clear stored city when user retypes
                              updateSparkCity(spark.id, '');
                              setCityQuery(v);
                            }}
                            onFocus={() => setCityQuery('')}
                          />
                          {(spark.target_city || cityQuery.length > 0) && (
                            <TouchableOpacity
                              onPress={() => {
                                updateSparkCity(spark.id, '');
                                setCityQuery('');
                                clearCityResults();
                              }}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <X size={14} color={CONSTANTS_COLORS.textSecondary} />
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Autocomplete dropdown */}
                        {citySearchLoading && !spark.target_city && (
                          <Text style={styles.cityLoadingText}>Searching...</Text>
                        )}
                        {!spark.target_city && cityResults.length > 0 && (
                          <View style={styles.cityDropdown}>
                            {cityResults.slice(0, 5).map((place) => (
                              <TouchableOpacity
                                key={place.placeId}
                                style={styles.cityDropdownItem}
                                onPress={() => {
                                  updateSparkCity(spark.id, place.name);
                                  setCityQuery(place.name);
                                  clearCityResults();
                                  HapticsService.triggerSelection();
                                }}
                              >
                                <Text style={styles.cityDropdownName}>{place.name}</Text>
                                <Text style={styles.cityDropdownAddress} numberOfLines={1}>
                                  {place.shortAddress}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    )}

                    {/* Date range inputs */}
                    {spark.requires_date_range !== false && (
                      <View style={styles.travelDateInputs}>
                        <TextInput
                          style={styles.travelDateInput}
                          placeholder="From  YYYY-MM-DD"
                          placeholderTextColor={CONSTANTS_COLORS.textSecondary}
                          value={spark.start_date || ''}
                          onChangeText={(v) => updateSparkDates(spark.id, v, spark.end_date || '')}
                          maxLength={10}
                          keyboardType="numeric"
                        />
                        <TextInput
                          style={styles.travelDateInput}
                          placeholder="To  YYYY-MM-DD"
                          placeholderTextColor={CONSTANTS_COLORS.textSecondary}
                          value={spark.end_date || ''}
                          onChangeText={(v) => updateSparkDates(spark.id, spark.start_date || '', v)}
                          maxLength={10}
                          keyboardType="numeric"
                        />
                      </View>
                    )}
                  </View>
                ))}

              {/* Spark search bar */}
              <View style={styles.sparkSearchBar}>
                <SearchIcon size={16} color={CONSTANTS_COLORS.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.sparkSearchInput}
                  placeholder="Search sparks..."
                  placeholderTextColor={CONSTANTS_COLORS.textSecondary}
                  value={sparkSearch}
                  onChangeText={setSparkSearch}
                />
                {sparkSearch.length > 0 && (
                  <TouchableOpacity
                    onPress={() => { setSparkSearch(''); setSparkSearchResults([]); }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={16} color={CONSTANTS_COLORS.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Search results */}
              {sparkSearch.trim().length >= 2 ? (
                sparkSearchLoading ? (
                  <Text style={styles.sparkLoadingText}>Searching...</Text>
                ) : sparkSearchResults.length === 0 ? (
                  <Text style={styles.sparkEmptyText}>No sparks found for "{sparkSearch}"</Text>
                ) : (
                  <View style={styles.chipsContainerSoft}>
                    {sparkSearchResults.map((spark) => {
                      const isSelected = goalBadges.some((g) => g.id === spark.id);
                      const catStyle = getSparkStyle(spark.category);
                      return (
                        <TouchableOpacity
                          key={spark.id}
                          onPress={() => toggleSpark(spark)}
                          activeOpacity={0.7}
                          style={[
                            styles.goalChip,
                            isSelected ? { backgroundColor: catStyle.bg, borderColor: catStyle.text } : styles.goalChipUnselected,
                          ]}
                        >
                          <Text style={[styles.goalChipText, isSelected && { color: catStyle.text }]}>
                            {spark.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )
              ) : (
                /* Grouped catalog */
                sparksLoading ? (
                  <Text style={styles.sparkLoadingText}>Loading sparks...</Text>
                ) : (
                  sparkCategories.map(({ category, sparks }) => {
                    const catStyle = getSparkStyle(category);
                    const catLabel = CATEGORY_LABELS[category] || category;
                    return (
                      <View key={category} style={styles.sparkCategoryGroup}>
                        <Text style={[styles.sparkCategoryLabel, { color: catStyle.text }]}>
                          {catLabel}
                        </Text>
                        <View style={styles.chipsContainerSoft}>
                          {sparks.map((spark) => {
                            const isSelected = goalBadges.some((g) => g.id === spark.id);
                            return (
                              <TouchableOpacity
                                key={spark.id}
                                onPress={() => toggleSpark(spark)}
                                activeOpacity={0.7}
                                style={[
                                  styles.goalChip,
                                  isSelected
                                    ? { backgroundColor: catStyle.bg, borderColor: catStyle.text }
                                    : styles.goalChipUnselected,
                                ]}
                              >
                                <Text style={[styles.goalChipText, isSelected && { color: catStyle.text }]}>
                                  {spark.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })
                )
              )}

              {/* Custom spark input */}
              {showCustomGoalInput ? (
                <View style={styles.customGoalInputContainer}>
                  <TextInput
                    ref={customInputTextRef}
                    style={styles.customGoalInput}
                    placeholder="Enter custom spark..."
                    placeholderTextColor={CONSTANTS_COLORS.textSecondary}
                    value={customGoal}
                    onChangeText={setCustomGoal}
                    maxLength={40}
                  />
                  <TouchableOpacity
                    style={styles.customGoalAddButton}
                    onPress={() => handleCustomSparkSubmit('social')}
                  >
                    <Plus size={16} color="#FFFFFF" strokeWidth={3} />
                    <Text style={styles.customGoalAddButtonText}>Add</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.customGoalCancelButton}
                    onPress={() => {
                      Keyboard.dismiss();
                      setShowCustomGoalInput(false);
                      setCustomGoal('');
                      setShowCustomGoalSuggestions(false);
                      setCustomGoalSuggestions([]);
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

              {/* Dedup suggestions */}
              {showCustomGoalSuggestions && customGoalSuggestions.length > 0 && (
                <View style={styles.dedupeContainer}>
                  <Text style={styles.dedupeTitle}>Similar sparks already exist:</Text>
                  <View style={styles.chipsContainerSoft}>
                    {customGoalSuggestions.map((spark) => {
                      const catStyle = getSparkStyle(spark.category);
                      const isSelected = goalBadges.some((g) => g.id === spark.id);
                      return (
                        <TouchableOpacity
                          key={spark.id}
                          style={[
                            styles.goalChip,
                            isSelected
                              ? { backgroundColor: catStyle.bg, borderColor: catStyle.text }
                              : styles.goalChipUnselected,
                          ]}
                          onPress={() => {
                            Keyboard.dismiss();
                            toggleSpark(spark);
                            setShowCustomGoalSuggestions(false);
                            setShowCustomGoalInput(false);
                            setCustomGoal('');
                          }}
                        >
                          <Text style={[styles.goalChipText, isSelected && { color: catStyle.text }]}>
                            {spark.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TouchableOpacity
                    style={styles.forceCreateButton}
                    onPress={() => handleForceCreateSpark('social')}
                  >
                    <Text style={styles.forceCreateButtonText}>None of these — create mine</Text>
                  </TouchableOpacity>
                </View>
              )}

              {goalBadges.length === 0 && (
                <View style={styles.inlineWarning}>
                  <AlertCircle size={16} color={CONSTANTS_COLORS.error} strokeWidth={2} />
                  <Text style={styles.inlineWarningText}>
                    Select at least 1 Spark
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* SECTION 3.5: My Vibes (Rounded Card) */}
        <View style={styles.section}>
          <View style={styles.sectionCardRounded}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View
                  style={[
                    styles.sectionIconContainer,
                    { backgroundColor: "rgba(229, 62, 62, 0.08)" },
                  ]}
                >
                  <RollerCoaster size={18} color="#E53E3E" />
                </View>
                <Text style={styles.cardTitle}>My Vibes</Text>
              </View>
            </View>
            <Text style={styles.sectionHint}>
              Select your interests or search to add custom ones.
            </Text>

            <View style={styles.cardContent}>
              {/* 1. Selected Vibes (Pinned Top) */}
              {interests.length > 0 && (
                <View style={styles.selectedVibesSection}>
                  <View style={styles.vibesContainer}>
                    {interests
                      .slice(0, showAllSelected ? undefined : 8)
                      .map((interest) => {
                        const style = getInterestStyle(interest);
                        const Icon = style.icon || RollerCoaster;
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
                  color={CONSTANTS_COLORS.textSecondary}
                  style={styles.searchIcon}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search interests..."
                  placeholderTextColor={CONSTANTS_COLORS.textSecondary}
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
                          <Plus size={14} color={CONSTANTS_COLORS.textSecondary} />
                        </TouchableOpacity>
                      ))}
                    {/* Add Custom Interest in Search */}
                    {searchQuery.trim().length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          const trimmed = searchQuery.trim();
                          if (trimmed && !interests.includes(trimmed)) {
                            setInterests([...interests, trimmed]);
                            setSearchQuery("");
                            HapticsService.triggerSelection();
                          }
                        }}
                        style={styles.addCustomSearchResult}
                      >
                        <Plus size={14} color={PRIMARY_COLOR} />
                        <Text style={[styles.optionText, { color: PRIMARY_COLOR, fontFamily: FONTS.medium }]}>
                          Add "{searchQuery.trim()}"
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  // Category List
                  Object.keys(INTEREST_CATEGORIES)
                    .filter((key) => key !== "DEFAULT")
                    .map((key) => {
                      const category = INTEREST_CATEGORIES[key];
                      const isExpanded = expandedCategory === key;
                      const Icon = category.icon || RollerCoaster;

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
                              },
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
                              <Text style={styles.categoryTitle}>
                                {category.label}
                              </Text>
                            </View>
                            {isExpanded ? (
                              <ChevronDown size={16} color={CONSTANTS_COLORS.textSecondary} />
                            ) : (
                              <ChevronRight size={16} color={CONSTANTS_COLORS.textSecondary} />
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
                                    <Plus size={14} color={CONSTANTS_COLORS.textSecondary} />
                                  </TouchableOpacity>
                                ))}
                                {categoryInterests.length === 0 && (
                                  <Text style={[styles.optionText, { color: CONSTANTS_COLORS.textSecondary, fontStyle: 'italic', paddingLeft: 4 }]}>
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
        </View>

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
      )}

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

  // ── Sparks UI new styles ──────────────────────────────────────────────────
  selectedSparksStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  selectedSparkChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  selectedSparkChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },
  sparkSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CONSTANTS_COLORS.surfaceNeutral,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
  },
  sparkSearchInput: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: CONSTANTS_COLORS.textPrimary,
  },
  sparkLoadingText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: CONSTANTS_COLORS.textSecondary,
    marginBottom: 8,
    textAlign: "center",
  },
  sparkEmptyText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: CONSTANTS_COLORS.textSecondary,
    marginBottom: 8,
    textAlign: "center",
  },
  sparkCategoryGroup: {
    marginBottom: 14,
  },
  sparkCategoryLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  // Travel date inputs
  travelDatesRow: {
    backgroundColor: "#E0F2FE",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  travelDatesLabel: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: "#0369A1",
    marginBottom: 8,
  },
  travelDateInputs: {
    flexDirection: "row",
    gap: 8,
  },
  travelDateInput: {
    flex: 1,
    height: 38,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 10,
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: CONSTANTS_COLORS.textPrimary,
  },
  // City autocomplete
  citySearchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  citySearchInput: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: CONSTANTS_COLORS.textPrimary,
  },
  cityLoadingText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: "#0369A1",
    marginTop: 4,
    paddingLeft: 4,
  },
  cityDropdown: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    overflow: "hidden",
  },
  cityDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F9FF",
  },
  cityDropdownName: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: CONSTANTS_COLORS.textPrimary,
  },
  cityDropdownAddress: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: CONSTANTS_COLORS.textSecondary,
    marginTop: 2,
  },
  // Dedup suggestion UI
  dedupeContainer: {
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  dedupeTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: "#92400E",
    marginBottom: 10,
  },
  forceCreateButton: {
    marginTop: 12,
    alignSelf: "flex-start",
  },
  forceCreateButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: PRIMARY_COLOR,
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

  // Selected Vibes (Interests) Section
  selectedVibesSection: {
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
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
    backgroundColor: "#F1F5F9",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    justifyContent: "center",
    marginBottom: 4,
  },
  moreCountText: {
    fontSize: 13,
    color: CONSTANTS_COLORS.textSecondary,
    fontFamily: FONTS.regular,
  },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: CONSTANTS_COLORS.textPrimary,
  },
  addCustomSearchResult: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 8,
  },

  // Categories Accordion
  categoriesContainer: {
    gap: 4,
  },
  categoryRow: {
    overflow: "hidden",
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  categoryHeaderExpanded: {},
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
    fontFamily: FONTS.regular,
    color: CONSTANTS_COLORS.textPrimary,
  },
  categoryContent: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginBottom: 4,
    gap: 6,
  },
  optionText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: CONSTANTS_COLORS.textPrimary,
  },
});
