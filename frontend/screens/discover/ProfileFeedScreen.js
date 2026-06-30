import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, Keyboard, Animated, InteractionManager } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  MessageCircle,
  ArrowLeft,
  SlidersHorizontal,
  User,
  Lock,
  Camera,
  Target,
  Check,
  X,
  UserPlus,
  ChevronsRight,
  Undo2,
} from "lucide-react-native";
import { apiGet } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { getEventDetails } from "../../api/events";
import { COLORS, SPACING, SHADOWS, FONTS } from "../../constants/theme";
import DiscoverFilterSheet from "../../components/DiscoverFilterSheet";
import HapticsService from "../../services/HapticsService";
import ThemeChip from "../../components/ThemeChip";
import SnooLoader from "../../components/ui/SnooLoader";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Path, Circle, Rect, G, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";
import { SpotifyArtistsCard } from "../../components/profile/SpotifyArtistsCard";

const { width } = Dimensions.get("window");
const CARD_RADIUS = 24;

// Strict Typography Mappings
const TYPOGRAPHY = {
  name: { fontFamily: "BasicCommercial-Black", fontSize: 20, color: "#1E293B" },
  role: { fontFamily: FONTS.regular, fontSize: 14, color: "#64748B" },
  body: { fontFamily: FONTS.regular, fontSize: 15, color: "#334155" },
  chip: { fontFamily: FONTS.medium, fontSize: 12, color: "#475569" },
  button: { fontFamily: FONTS.semiBold, fontSize: 16, color: "#FFFFFF" },
  header: { fontFamily: FONTS.primary, fontSize: 18, color: "#0F172A" },
};

const GOAL_COLORS = {
  "looking for study partners": { bg: "#E0F2FE", text: "#075985" },
  "new to the city": { bg: "#ECFDF5", text: "#065F46" },
  "exploring opportunities": { bg: "#FFF7ED", text: "#9A3412" },
  default: { bg: "#F3F4F6", text: "#374151" },
};

const getGoalStyle = (goal) => {
  const lower = goal?.toLowerCase() || "";
  for (const key in GOAL_COLORS) {
    if (lower.includes(key)) return GOAL_COLORS[key];
  }
  return GOAL_COLORS.default;
};

const EDGES = ["top"];

export default function ProfileFeedScreen({ route, navigation }) {
  const { event: initialEvent } = route.params || {};
  const [eventData, setEventData] = useState(initialEvent || null);
  const [attendees, setAttendees] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const translateX = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(1)).current;
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [selectedContent, setSelectedContent] = useState(null);
  const [activeFilters, setActiveFilters] = useState({});
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [profileGated, setProfileGated] = useState(false); // true if user's own profile is incomplete
  const [hasSeenSkipInfo, setHasSeenSkipInfo] = useState(false);
  const [showSkipTooltip, setShowSkipTooltip] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const toastY = React.useRef(new Animated.Value(-20)).current;
  const toastOpacity = React.useRef(new Animated.Value(0)).current;
  const [profileProgress, setProfileProgress] = useState({
    photos: 0,
    sparks: 0,
    icebreakers: 0,
  });

  const renderCount = useRef(0);
  useEffect(() => {
    console.log("[ProfileFeedScreen] Mounted");
    return () => console.log("[ProfileFeedScreen] Unmounted");
  }, []);
  console.log(`[ProfileFeedScreen] Render #${++renderCount.current} (loading: ${loading}, filterLoading: ${filterLoading}, filterSheetVisible: ${filterSheetVisible}, attendees: ${attendees.length})`);

  // Pure callback: no outer component state or props referenced, depend only on arguments
  const loadAttendees = useCallback(async (filters, targetEventId, showGlobalLoader = false) => {
    if (!targetEventId) return;
    try {
      if (showGlobalLoader) {
        setLoading(true);
      } else {
        setFilterLoading(true);
      }
      const token = await getAuthToken();
      if (token) {
        // Build query string based on filters
        const params = [];
        if (filters?.badges && filters.badges.length > 0) {
          params.push(`badges=${encodeURIComponent(filters.badges.join(","))}`);
        }
        if (filters?.interests && filters.interests.length > 0) {
          params.push(`interests=${encodeURIComponent(filters.interests.join(","))}`);
        }
        if (filters?.genders && filters.genders.length > 0) {
          params.push(`genders=${encodeURIComponent(filters.genders.join(","))}`);
        }
        if (filters?.ageMin !== undefined) {
          params.push(`ageMin=${filters.ageMin}`);
        }
        if (filters?.ageMax !== undefined) {
          params.push(`ageMax=${filters.ageMax}`);
        }

        const queryString = params.length > 0 ? `?${params.join("&")}` : "";
        const url = `/events/${targetEventId}/attendees${queryString}`;
        console.log("[ProfileFeedScreen] Fetching attendees url:", url);

        const response = await apiGet(url, 15000, token);
        setAttendees(response.attendees || []);
        setCurrentIndex(0); // Reset index to first attendee when filters change
      }
    } catch (error) {
      console.error("[ProfileFeedScreen] Error loading attendees:", error);
      setAttendees([]);
    } finally {
      setLoading(false);
      setFilterLoading(false);
    }
  }, []);

  const checkAndLoadAttendees = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      if (!token) { setLoading(false); return; }

      // 0. Fetch full event details if title is missing
      let currentEvent = initialEvent || null;
      const targetEventId = initialEvent?.id;
      if (targetEventId && (!currentEvent || !currentEvent.title)) {
        try {
          console.log("[ProfileFeedScreen] Fetching full event details for ID:", targetEventId);
          const response = await getEventDetails(targetEventId);
          if (response?.event) {
            currentEvent = response.event;
            setEventData(response.event);
          }
        } catch (err) {
          console.error("[ProfileFeedScreen] Error fetching event details:", err);
        }
      }

      // 1. Gate check: verify the viewer's own profile meets minimum requirements
      const profileRes = await apiGet("/members/profile", 15000, token);
      const profile = profileRes.profile || profileRes;
      const ownPhotos = Array.isArray(profile.discover_photos) ? profile.discover_photos : [];
      const ownBadges = Array.isArray(profile.intent_badges) ? profile.intent_badges : [];
      const ownOpeners = Array.isArray(profile.openers) ? profile.openers : [];
      const isComplete = ownPhotos.length >= 3 && ownBadges.length >= 1 && ownOpeners.length >= 1;

      setProfileProgress({
        photos: ownPhotos.length,
        sparks: ownBadges.length,
        icebreakers: ownOpeners.length,
      });

      if (!isComplete) {
        setProfileGated(true);
        setLoading(false);
        return;
      }

      // 2. Load attendees (initial load, so show global loader)
      if (currentEvent) {
        await loadAttendees({}, currentEvent.id, true);
      } else {
        console.warn("[ProfileFeedScreen] Mounted without an event object in route params!");
      }
    } catch (error) {
      console.error("[ProfileFeedScreen] Error:", error);
      setAttendees([]);
    } finally {
      setLoading(false);
    }
  }, [initialEvent, loadAttendees]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      checkAndLoadAttendees();
    });
    return () => task.cancel();
  }, [checkAndLoadAttendees]);

  useEffect(() => {
    const checkSkipInfo = async () => {
      try {
        const val = await AsyncStorage.getItem("has_seen_skip_info");
        setHasSeenSkipInfo(!!val);
      } catch (e) {
        console.warn(e);
      }
    };
    checkSkipInfo();
  }, []);

  const isInitialMountRef = useRef(true);

  // Reload when filters change (only if not gated)
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (!loading && eventData?.id && !profileGated) {
      loadAttendees(activeFilters, eventData.id);
    }
  }, [activeFilters, eventData?.id, profileGated, loading, loadAttendees]);

  const currentAttendee = attendees[currentIndex];

  // Data Extraction
  const name = (currentAttendee?.nickname || currentAttendee?.name || "Unknown").trim() || "Unknown";
  const role =
    (currentAttendee?.role || currentAttendee?.job_title || "Member").trim() ||
    "Member";
  const age = currentAttendee?.age;
  const gender = currentAttendee?.gender;
  const pronouns = useMemo(() => {
    const raw = currentAttendee?.pronouns;
    if (!raw) return null;
    if (Array.isArray(raw)) {
      const filtered = raw.filter(
        (p) => p && String(p).trim() && String(p).trim() !== "Prefer not to say"
      );
      return filtered.length > 0 ? filtered.join("/") : null;
    }
    if (typeof raw === "string") {
      let clean = raw.trim();
      if (clean.startsWith("{") && clean.endsWith("}")) {
        clean = clean.substring(1, clean.length - 1);
      }
      const parts = clean
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && s !== "Prefer not to say");
      return parts.length > 0 ? parts.join("/") : null;
    }
    return null;
  }, [currentAttendee?.pronouns]);

  console.log("[ProfileFeedScreen] Render attendee:", name, "Age:", age, "Gender:", gender, "Pronouns:", pronouns);
  const goalBadges = currentAttendee?.intent_badges || [];
  const interests = currentAttendee?.interests || [];
  const openers = currentAttendee?.openers || [];

  const photos = useMemo(() => {
    if (!currentAttendee) return [];
    const p = currentAttendee.discover_photos || currentAttendee.photos || [];
    return p
      .map((ph, i) => ({ id: i, url: ph.url || ph.photo_url || ph }))
      .filter((x) => x.url);
  }, [currentAttendee]);

  const interleavedContent = useMemo(() => {
    const content = [];
    let pIndex = 1;
    let oIndex = 0;
    while (oIndex < openers.length || pIndex < photos.length) {
      if (oIndex < openers.length) {
        content.push({ type: "prompt", data: openers[oIndex], index: oIndex });
        oIndex++;
      }
      if (pIndex < photos.length) {
        content.push({ type: "photo", data: photos[pIndex], index: pIndex });
        pIndex++;
      }
    }
    return content;
  }, [photos, openers]);

  const handleNext = useCallback((direction = "left") => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: direction === "left" ? -width : width,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentIndex((prev) => prev + 1);
      translateX.setValue(width); // Always slide in from right
      opacity.setValue(0);

      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [translateX, opacity]);

  const handleSkip = useCallback(() => {
    HapticsService.triggerImpactLight();
    if (!hasSeenSkipInfo) {
      setShowSkipTooltip(true);
    } else {
      handleNext("left");
    }
  }, [hasSeenSkipInfo, handleNext]);

  const handleConnect = useCallback(() => {
    HapticsService.triggerImpactMedium();
    
    // Capture the name of the attendee before moving index
    const targetName = name;
    setToastMessage(`Connection request sent to ${targetName}`);

    // Animate toast in
    Animated.parallel([
      Animated.timing(toastY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-hide toast after 2.5 seconds
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastY, {
          toValue: -20,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setToastMessage("");
      });
    }, 2500);

    handleNext("right");
  }, [name, handleNext, toastY, toastOpacity]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleOpenFilters = useCallback(() => {
    setFilterSheetVisible(true);
  }, []);

  const handleCloseFilters = useCallback(() => {
    setFilterSheetVisible(false);
  }, []);

  const [messageText, setMessageText] = useState("");

  const handleOpenCommentModal = useCallback((content) => {
    HapticsService.triggerImpactLight();
    setSelectedContent(content);
    setMessageModalVisible(true);
  }, []);

  const handleSendIcebreaker = useCallback(() => {
    if (!messageText.trim()) {
      Alert.alert("Empty Message", "Please type a message before sending.");
      return;
    }
    HapticsService.triggerImpactMedium();
    setMessageModalVisible(false);
    setMessageText("");
    Alert.alert(
      "Message Sent!",
      `Your icebreaker has been sent to ${name} along with a connection request.`,
      [
        {
          text: "OK",
          onPress: () => {
            handleNext();
          }
        }
      ]
    );
  }, [name, messageText, handleNext]);

  try {
    if (loading) {
      return (
        <View style={[styles.container, styles.center]}>
          <SnooLoader size="large" color={COLORS.primary} />
        </View>
      );
    }

    // Profile gate — user hasn't completed their Discover Profile
    if (profileGated) {
      const dateStr = eventData?.formatted_date || (eventData?.event_date && new Date(eventData.event_date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }));
      const subtitle = eventData?.title ? `${eventData.title}${dateStr ? ` • ${dateStr}` : ""}` : (dateStr || "");
      
      const photosMet = profileProgress.photos >= 3;
      const sparksMet = profileProgress.sparks >= 1;
      const icebreakersMet = profileProgress.icebreakers >= 1;
      const metCount = (photosMet ? 1 : 0) + (sparksMet ? 1 : 0) + (icebreakersMet ? 1 : 0);
      const attendeeCount = eventData?.attendee_count || 0;

      return (
        <LinearGradient
          colors={["#ace1ff", "#ebfff6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientContainer}
        >
          <SafeAreaView style={styles.gateScreenContainer} edges={EDGES}>
            <View style={styles.gateHeader}>
              <TouchableOpacity onPress={handleBack} activeOpacity={0.8}>
                <View style={styles.glassButton}>
                  <ArrowLeft size={20} color="#1a2d4a" strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.gateHeaderTitle}>Discover People</Text>
                {subtitle ? (
                  <Text style={styles.gateHeaderSubtitle} numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <View style={{ width: 42 }} />
            </View>
            <View style={styles.gateContainer}>
              {/* Locked Card Stack Illustration */}
              <View style={styles.lockIllustrationContainer}>
                <View style={[styles.lockedCard, styles.lockedCardLeft]}>
                  <View style={styles.cardAvatarPlaceholder} />
                  <View style={styles.cardTextPlaceholderLong} />
                  <View style={styles.cardTextPlaceholderShort} />
                </View>
                <View style={[styles.lockedCard, styles.lockedCardRight]}>
                  <View style={styles.cardAvatarPlaceholder} />
                  <View style={styles.cardTextPlaceholderLong} />
                  <View style={styles.cardTextPlaceholderShort} />
                </View>
                <View style={styles.lockBadge}>
                  <Lock size={20} color="#FFFFFF" strokeWidth={2.5} />
                </View>
              </View>

              <Text style={styles.gateTitle}>
                {attendeeCount > 0 
                  ? `${attendeeCount} ${attendeeCount === 1 ? 'person is' : 'people are'} waiting to connect`
                  : "People are waiting to connect"}
              </Text>
              <Text style={styles.gateBody}>
                Complete your Discover Profile to start matching with people from this event.
              </Text>

              {/* Checklist Container */}
              <View style={styles.checklistCard}>
                <View style={styles.checklistHeader}>
                  <Text style={styles.checklistTitle}>Profile completion</Text>
                  <Text style={styles.checklistProgressText}>{metCount} of 3</Text>
                </View>
                
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${(metCount / 3) * 100}%` }]} />
                </View>

                <View style={styles.checklistItems}>
                  {/* Item 1: Photos */}
                  <View style={styles.checklistItem}>
                    <View style={[styles.checkIconContainer, photosMet && styles.checkIconContainerMet]}>
                      {photosMet ? (
                        <Check size={18} color="#16A34A" strokeWidth={3} />
                      ) : (
                        <Camera size={18} color="#64748B" strokeWidth={2} />
                      )}
                    </View>
                    <Text style={[styles.checkItemText, photosMet && styles.checkItemTextMet]}>
                      At least 3 photos
                    </Text>
                    <Text style={[styles.checkItemCount, photosMet && styles.checkItemCountMet]}>
                      {Math.min(profileProgress.photos, 3)}/3
                    </Text>
                  </View>

                  {/* Item 2: Spark */}
                  <View style={styles.checklistItem}>
                    <View style={[styles.checkIconContainer, sparksMet && styles.checkIconContainerMet]}>
                      {sparksMet ? (
                        <Check size={18} color="#16A34A" strokeWidth={3} />
                      ) : (
                        <Target size={18} color="#64748B" strokeWidth={2} />
                      )}
                    </View>
                    <Text style={[styles.checkItemText, sparksMet && styles.checkItemTextMet]}>
                      At least 1 Spark
                    </Text>
                    <Text style={[styles.checkItemCount, sparksMet && styles.checkItemCountMet]}>
                      {Math.min(profileProgress.sparks, 1)}/1
                    </Text>
                  </View>

                  {/* Item 3: Icebreaker */}
                  <View style={styles.checklistItem}>
                    <View style={[styles.checkIconContainer, icebreakersMet && styles.checkIconContainerMet]}>
                      {icebreakersMet ? (
                        <Check size={18} color="#16A34A" strokeWidth={3} />
                      ) : (
                        <MessageCircle size={18} color="#64748B" strokeWidth={2} />
                      )}
                    </View>
                    <Text style={[styles.checkItemText, icebreakersMet && styles.checkItemTextMet]}>
                      At least 1 icebreaker
                    </Text>
                    <Text style={[styles.checkItemCount, icebreakersMet && styles.checkItemCountMet]}>
                      {Math.min(profileProgress.icebreakers, 1)}/1
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.gateButton}
                onPress={() => navigation.navigate("EditDiscoverProfile")}
                activeOpacity={0.85}
              >
                <Text style={styles.gateButtonText}>Complete My Profile</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (attendees.length > 0 && currentIndex >= attendees.length) {
      return (
        <LinearGradient
          colors={["#DCEFFE", "#F0F7FF", "#FFFFFF"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.gradientContainer}
        >
          <SafeAreaView style={styles.container} edges={EDGES}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={handleBack} activeOpacity={0.8}>
                <View style={styles.glassButton}>
                  <ArrowLeft size={20} color="#1a2d4a" strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Discover</Text>
              <View style={{ width: 42 }} />
            </View>

            <View style={styles.endOfFeedContainer}>
              <View style={styles.endOfFeedCard}>
                {/* Coffee Break Illustration */}
                <View style={styles.coffeeIllustrationContainer}>
                  <Svg width="100%" height="100%" viewBox="80 30 240 200">
                    <Defs>
                      {/* Emerald / Mint Gradient */}
                      <SvgLinearGradient id="emeraldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor="#A7F3D0" />
                        <Stop offset="100%" stopColor="#10B981" />
                      </SvgLinearGradient>
                      <SvgLinearGradient id="mugGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor="#34D399" />
                        <Stop offset="100%" stopColor="#059669" />
                      </SvgLinearGradient>
                    </Defs>

                    {/* Ambient window shadow backdrop dynamic design */}
                    <Rect x={110} y={60} width={180} height={150} rx={12} fill="url(#emeraldGradient)" opacity={0.06} />
                    <Path d="M 200 60 L 200 210" stroke="url(#emeraldGradient)" strokeWidth={1.5} opacity={0.15} />
                    <Path d="M 110 135 L 290 135" stroke="url(#emeraldGradient)" strokeWidth={1.5} opacity={0.15} />

                    {/* Tabletop line */}
                    <Path d="M 90 210 L 310 210" stroke="#E2E8F0" strokeWidth={3} strokeLinecap="round" />

                    {/* Laptop outline / notebook */}
                    <G transform="translate(105, 150)">
                      {/* Laptop Drop Shadow */}
                      <Rect x={2} y={4} width={90} height={55} rx={8} fill="#000000" opacity={0.04} />
                      {/* Laptop Body */}
                      <Rect width={90} height={55} rx={8} fill="#FFFFFF" stroke="#F1F5F9" strokeWidth={1.5} />
                      {/* Mock text lines */}
                      <Rect x={15} y={15} width={45} height={5} rx={2.5} fill="#E2E8F0" />
                      <Rect x={15} y={25} width={30} height={5} rx={2.5} fill="#E2E8F0" />
                      <Circle cx={70} cy={35} r={5} fill="#10B981" opacity={0.8} />
                    </G>

                    {/* Warm Mug */}
                    <G transform="translate(215, 150)">
                      {/* Mug handle */}
                      <Path
                        d="M 38 12 C 48 12, 48 38, 38 38"
                        fill="none"
                        stroke="#A7F3D0"
                        strokeWidth={5}
                        strokeLinecap="round"
                      />
                      {/* Mug handle core */}
                      <Path
                        d="M 38 12 C 48 12, 48 38, 38 38"
                        fill="none"
                        stroke="#FFFFFF"
                        strokeWidth={2}
                        strokeLinecap="round"
                      />
                      {/* Mug Body */}
                      <Rect width={40} height={50} rx={10} fill="url(#mugGrad)" />
                      {/* Steam */}
                      <Path
                        d="M 12 -6 Q 19 -14, 11 -22"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        opacity={0.7}
                      />
                      <Path
                        d="M 24 -4 Q 17 -11, 26 -19"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        opacity={0.5}
                      />
                    </G>
                  </Svg>
                </View>

                {/* Bold Title */}
                <Text style={styles.endOfFeedTitle}>All caught up!</Text>

                {/* Description */}
                <Text style={styles.endOfFeedBody}>
                  You've viewed all participants.
                </Text>

                {/* Revisit Profiles Button */}
                <TouchableOpacity
                  style={styles.revisitButtonContainer}
                  activeOpacity={0.85}
                  onPress={() => {
                    HapticsService.triggerImpactLight();
                    setCurrentIndex(0);
                  }}
                >
                  <LinearGradient
                    colors={["#10B981", "#059669"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.revisitButtonGradient}
                  >
                    <Text style={styles.revisitButtonText}>Revisit Profiles</Text>
                    <Undo2 size={16} color="#FFFFFF" strokeWidth={2.5} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }    const hasFilters = (activeFilters.badges?.length > 0) || 
                       (activeFilters.interests?.length > 0) || 
                       (activeFilters.genders?.length > 0) || 
                       (activeFilters.ageMin !== undefined && activeFilters.ageMin !== 18) || 
                       (activeFilters.ageMax !== undefined && activeFilters.ageMax !== 30);

    if (!currentAttendee) {
      if (hasFilters) {
        return (
          <LinearGradient
            colors={["#DCEFFE", "#F0F7FF", "#FFFFFF"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.gradientContainer}
          >
            <SafeAreaView style={styles.container} edges={EDGES}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} activeOpacity={0.8}>
                  <View style={styles.glassButton}>
                    <ArrowLeft size={20} color="#1a2d4a" strokeWidth={2.5} />
                  </View>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Discover</Text>
                <TouchableOpacity onPress={handleOpenFilters} activeOpacity={0.8}>
                  <View style={styles.glassButton}>
                    <SlidersHorizontal size={20} color="#1a2d4a" strokeWidth={2.5} />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.endOfFeedContainer}>
                <View style={styles.endOfFeedCard}>
                  {/* Premium red/coral icon with tinted container */}
                  <View style={styles.emptyFiltersIconContainer}>
                    <SlidersHorizontal size={36} color="#EF4444" strokeWidth={2} />
                  </View>

                  {/* Bold Title */}
                  <Text style={styles.endOfFeedTitle}>No matches found</Text>

                  {/* Description */}
                  <Text style={styles.endOfFeedBody}>
                    Try widening your search criteria or clearing your filters to see more people at this event.
                  </Text>

                  {/* Clear Filters Button */}
                  <TouchableOpacity
                    style={styles.clearFiltersButton}
                    activeOpacity={0.85}
                    onPress={() => {
                      HapticsService.triggerImpactLight();
                      setActiveFilters({});
                    }}
                  >
                    <Text style={styles.clearFiltersButtonText}>Clear All Filters</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </SafeAreaView>
          </LinearGradient>
        );
      }

      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backBtn}
            >
              <ArrowLeft size={26} color={COLORS.editorial.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{eventData?.title || "Attendees"}</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.center}>
            <Text style={styles.emptyText}>No one here yet.</Text>
          </View>
        </SafeAreaView>
      );
    }

  return (
    <LinearGradient
      colors={["#DCEFFE", "#F0F7FF", "#FFFFFF"]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.gradientContainer}
    >
      <SafeAreaView style={styles.container} edges={EDGES}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} activeOpacity={0.8}>
            <View style={styles.glassButton}>
              <ArrowLeft size={20} color="#1a2d4a" strokeWidth={2.5} />
            </View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Discover</Text>
          <TouchableOpacity onPress={handleOpenFilters} activeOpacity={0.8}>
            <View style={styles.glassButton}>
              <SlidersHorizontal size={20} color="#1a2d4a" strokeWidth={2.5} />
            </View>
          </TouchableOpacity>
        </View>

        <Animated.View style={{ flex: 1, transform: [{ translateX }], opacity }}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
          {/* Hero Photo with Name, Age & Gender Overlay */}
          {photos[0] && (
            <PhotoCard
              url={photos[0].url}
              isHero={true}
              name={name}
              age={age}
              gender={gender}
              pronouns={pronouns}
              onCommentPress={() => handleOpenCommentModal({ type: "photo", url: photos[0].url })}
            />
          )}

          {/* Goals Group (Positioned after the first photo) */}
          {goalBadges.length > 0 && (
            <View style={styles.sparksGlassContainer}>
              <Text style={styles.sectionLabel}>Sparks</Text>
              <View style={styles.vitalsRow}>
                {goalBadges.map((badge, i) => {
                  const goalStyle = getGoalStyle(badge);
                  return (
                    <TouchableOpacity
                      key={`goal-${i}`}
                      style={[
                        styles.chip,
                        styles.goalChip,
                        { backgroundColor: goalStyle.bg },
                      ]}
                      onPress={() => handleOpenCommentModal({ type: "spark", label: badge })}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          styles.goalChipText,
                          { color: goalStyle.text },
                        ]}
                      >
                        {badge}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Interleaved Prompts & Photos */}
          {interleavedContent.map((item, i) => (
            <View key={i} style={styles.feedItem}>
              {item.type === "prompt" ? (
                <PromptCard
                  item={item}
                  onCommentPress={() => handleOpenCommentModal({ type: "prompt", prompt: item.data.prompt, response: item.data.response })}
                />
              ) : (
                <PhotoCard
                  url={item.data.url}
                  onCommentPress={() => handleOpenCommentModal({ type: "photo", url: item.data.url })}
                />
              )}
            </View>
          ))}

          {currentAttendee?.spotify_connected && (
            <View style={{ marginBottom: 24 }}>
              <SpotifyArtistsCard
                artists={currentAttendee.spotify_top_artists}
                targetUsername={name}
              />
            </View>
          )}

          {/* Interests Group (Bottom of Profile) */}
          {interests.length > 0 && (
            <View style={styles.interestsGlassContainer}>
              <Text style={styles.sectionLabel}>Interests</Text>
              <View style={styles.interestsContainer}>
                {interests.map((interest, i) => (
                  <TouchableOpacity
                    key={`int-${i}`}
                    onPress={() => handleOpenCommentModal({ type: "interest", label: interest })}
                    activeOpacity={0.8}
                  >
                    <ThemeChip
                      label={interest}
                      index={i}
                      style={styles.interestChipOverride}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
        </Animated.View>

        {filterLoading && (
          <View style={styles.filterLoadingOverlay}>
            <SnooLoader size="large" color={COLORS.primary} />
          </View>
        )}

        {/* Floating Action Bar */}
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.8}>
            <View style={styles.skipButtonGradientContainer}>
              <Text style={styles.skipButtonText}>Skip</Text>
              <ChevronsRight size={18} color="#64748B" strokeWidth={2.5} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.connectButton} onPress={handleConnect} activeOpacity={0.8}>
            <View style={styles.connectButtonGradientContainer}>
              {/* Frosted glass backing */}
              <LinearGradient
                colors={["rgba(255, 255, 255, 0.25)", "rgba(255, 255, 255, 0.65)"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.connectButtonBacking}
              />
              
              {/* Gorgeous diagonal blue glow wash across the glass button */}
              <LinearGradient
                colors={["rgba(0, 82, 255, 0.72)", "rgba(0, 136, 255, 0.45)", "rgba(0, 136, 255, 0.1)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.connectButtonGlowBubble}
              />
              
              {/* Text & Icon content */}
              <View style={styles.connectButtonContent}>
                <Text style={styles.connectButtonText}>Connect</Text>
                <UserPlus size={18} color="#133d70" strokeWidth={2.5} />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <DiscoverFilterSheet
          visible={filterSheetVisible}
          onClose={handleCloseFilters}
          onApply={setActiveFilters}
          initialFilters={activeFilters}
        />

        {/* Comment/Message Icebreaker Modal */}
        <Modal
          visible={messageModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setMessageModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <TouchableOpacity 
              style={StyleSheet.absoluteFillObject} 
              activeOpacity={1} 
              onPress={() => {
                Keyboard.dismiss();
                setMessageModalVisible(false);
              }}
            />
            <KeyboardAvoidingView 
              behavior={Platform.OS === "ios" ? "padding" : "height"} 
              style={styles.modalContainer}
            >
              <View style={styles.modalContentCard}>
                <Text style={styles.modalTitle}>Send a message to {name}</Text>
                
                {selectedContent?.type === "prompt" ? (
                  <View style={styles.modalPromptPreview}>
                    <Text style={styles.modalPromptLabel}>{selectedContent.prompt}</Text>
                    <Text style={styles.modalPromptAnswer} numberOfLines={2}>{selectedContent.response}</Text>
                  </View>
                ) : selectedContent?.type === "photo" ? (
                  <View style={styles.modalPhotoPreviewContainer}>
                    <Image source={{ uri: selectedContent.url }} style={styles.modalPhotoPreview} />
                    <Text style={styles.modalPhotoPreviewText}>Commenting on their photo</Text>
                  </View>
                ) : selectedContent?.type === "spark" ? (
                  <View style={styles.modalChipPreviewContainer}>
                    <Text style={styles.modalChipPreviewLabel}>Commenting on spark:</Text>
                    <View style={[styles.chip, styles.goalChip, { backgroundColor: getGoalStyle(selectedContent.label).bg, borderStyle: "solid" }]}>
                      <Text style={[styles.chipText, styles.goalChipText, { color: getGoalStyle(selectedContent.label).text }]}>
                        {selectedContent.label}
                      </Text>
                    </View>
                  </View>
                ) : selectedContent?.type === "interest" ? (
                  <View style={styles.modalChipPreviewContainer}>
                    <Text style={styles.modalChipPreviewLabel}>Commenting on interest:</Text>
                    <ThemeChip
                      label={selectedContent.label}
                      style={{ alignSelf: "flex-start" }}
                    />
                  </View>
                ) : null}

                <TextInput
                  style={styles.modalInput}
                  placeholder="Type an icebreaker..."
                  placeholderTextColor="#64748B"
                  multiline={true}
                  numberOfLines={4}
                  value={messageText}
                  onChangeText={setMessageText}
                  autoFocus={true}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={styles.modalCancelButton} 
                    onPress={() => {
                      Keyboard.dismiss();
                      setMessageModalVisible(false);
                    }}
                  >
                    <Text style={styles.modalCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.modalSendButton} 
                    onPress={() => {
                      Keyboard.dismiss();
                      handleSendIcebreaker();
                    }}
                  >
                    <Text style={styles.modalSendButtonText}>Send</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* Custom Skipping Onboarding Modal */}
        <Modal
          visible={showSkipTooltip}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSkipTooltip(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.skipInfoCard}>
              {/* Custom Graphic Illustration */}
              <View style={styles.skipIllustrationContainer}>
                <Svg width="100%" height="100%" viewBox="50 70 300 200">
                  <Defs>
                    {/* Gradients and Visual Shadows */}
                    <SvgLinearGradient id="primaryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <Stop offset="0%" stopColor="#C7D2FE" />
                      <Stop offset="100%" stopColor="#6366F1" />
                    </SvgLinearGradient>
                    <SvgLinearGradient id="avatarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <Stop offset="0%" stopColor="#E0E7FF" />
                      <Stop offset="100%" stopColor="#4F46E5" />
                    </SvgLinearGradient>
                  </Defs>

                  {/* Dynamic Curved Path representing "revisit / loop" motion */}
                  <Path
                    d="M 120 180 C 120 100, 280 100, 280 180 C 280 230, 210 240, 185 200"
                    fill="none"
                    stroke="url(#primaryGradient)"
                    strokeWidth={5}
                    strokeLinecap="round"
                    strokeDasharray={[8, 8]}
                  />
                  
                  {/* Decorative glowing orbit stars */}
                  <Circle cx={215} cy={90} r={4} fill="#6366F1" opacity={0.6} />
                  <Circle cx={265} cy={115} r={3} fill="#6366F1" opacity={0.4} />
                  <Circle cx={100} cy={150} r={5} fill="#6366F1" opacity={0.5} />
                  <Circle cx={160} cy={100} r={3} fill="#6366F1" opacity={0.3} />

                  {/* Playful Skipped Card (Tilts and fades away into loop) */}
                  <G transform="translate(65, 120) rotate(-12)">
                    {/* Simulated Shadow */}
                    <Rect x={2} y={6} width={80} height={110} rx={16} fill="#000000" opacity={0.08} />
                    
                    {/* Card shape */}
                    <Rect width={80} height={110} rx={16} fill="#FFFFFF" stroke="#F1F5F9" strokeWidth={1.5} />
                    {/* Inner Avatar Placeholder */}
                    <Rect x={8} y={8} width={64} height={74} rx={10} fill="url(#avatarGrad)" opacity={0.8} />
                    {/* Cute face silhouette */}
                    <Circle cx={40} cy={40} r={14} fill="#FFFFFF" opacity={0.85} />
                    <Path d="M18,72 C18,58 28,56 40,56 C52,56 62,58 62,72" fill="#FFFFFF" opacity={0.85} />
                    {/* Heart icon overlay placeholder */}
                    <Rect x={25} y={90} width={30} height={8} rx={4} fill="#6366F1" opacity={0.15} />
                  </G>

                  {/* Dynamic Destination Arrow representing history box/revisit */}
                  <G transform="translate(160, 185)">
                    {/* Base glow ring */}
                    <Circle cx={35} cy={35} r={35} fill="url(#primaryGradient)" opacity={0.15} />
                    <Circle cx={35} cy={35} r={25} fill="url(#primaryGradient)" opacity={0.3} />
                    <Circle cx={35} cy={35} r={16} fill="#6366F1" />
                    
                    {/* Beautiful Arrow shape */}
                    <Path
                      d="M 31 35 L 35 31 M 31 35 L 35 39 M 31 35 L 41 35"
                      stroke="white"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </G>

                  {/* Dotted connections looping back */}
                  <Path
                    d="M 195 220 Q 155 240, 130 200"
                    fill="none"
                    stroke="#6366F1"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeDasharray={[3, 3]}
                    opacity={0.5}
                  />
                </Svg>
              </View>

              {/* Bold Title */}
              <Text style={styles.skipInfoTitle}>Skipping</Text>

              {/* Centered Description */}
              <Text style={styles.skipInfoBody}>
                Revisit this event to view the skipped People.
              </Text>

              {/* Got It Button with Gradient */}
              <TouchableOpacity
                style={styles.skipInfoButtonContainer}
                activeOpacity={0.85}
                onPress={async () => {
                  HapticsService.triggerImpactLight();
                  setShowSkipTooltip(false);
                  setHasSeenSkipInfo(true);
                  try {
                    await AsyncStorage.setItem("has_seen_skip_info", "true");
                  } catch (e) {
                    console.warn(e);
                  }
                  handleNext();
                }}
              >
                <LinearGradient
                  colors={["#818CF8", "#6366F1"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.skipInfoButtonGradient}
                >
                  <Text style={styles.skipInfoButtonText}>Got It</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Floating Toast Notification */}
        {!!toastMessage && (
          <Animated.View
            style={[
              styles.toastContainer,
              {
                opacity: toastOpacity,
                transform: [{ translateY: toastY }],
              },
            ]}
          >
            <View style={styles.toastInner}>
              <View style={styles.toastIconBg}>
                <Check size={14} color="#FFFFFF" strokeWidth={3} />
              </View>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          </Animated.View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
  } catch (err) {
    console.error("[ProfileFeedScreen] Render crash:", err);
    return (
      <SafeAreaView style={[styles.container, { justifyContent: "center", alignItems: "center", padding: 20 }]}>
        <Text style={{ fontFamily: "Manrope-Bold", fontSize: 18, color: "#E53E3E", marginBottom: 12 }}>
          An error occurred
        </Text>
        <Text style={{ fontFamily: "Manrope-Regular", fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 20 }}>
          {err.message}
        </Text>
        <TouchableOpacity style={{ backgroundColor: "#2962FF", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }} onPress={() => navigation.goBack()}>
          <Text style={{ fontFamily: "Manrope-SemiBold", color: "#FFFFFF" }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
}

// Utility to convert hex color to rgba with opacity
const hexToRgba = (hex, alpha) => {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const ContentCard = React.memo(({ children, onPress, style, innerStyle, variant, seed }) => {
  const isPrompt = variant === "prompt";
  // Prompt: warm horizontal amber→magenta→cyan→blue
  // Photo: soft vertical pastel mint green→pastel yellow→soft sky blue (base aurora flow)
  const baseColors = isPrompt
    ? ["#f59e0b", "#d150e0", "#3db4f4", "#2b3ca7"]
    : ["#A7F3D0", "#FED7AA", "#BAE6FD", "#C4B5FD"];
  
  // Deterministic shuffle for photo variant based on unique seed (like url)
  const colors = useMemo(() => {
    if (isPrompt || !seed) return baseColors;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const result = [...baseColors];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.abs(hash + i) % (i + 1);
      const temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }
    return result;
  }, [isPrompt, seed]);

  const locations = useMemo(() => {
    if (isPrompt) return null;
    return [0, 0.15, 0.65, 1]; // Uneven color boundaries
  }, [isPrompt]);

  const start = isPrompt ? { x: 0, y: 1 } : { x: 0, y: 0 };
  const end = isPrompt ? { x: 1, y: 0 } : { x: 0, y: 1 };
  const shadowStyle = isPrompt ? styles.promptShadow : styles.photoShadow;

  // Dynamic shadow color matching the bottom of the card gradient
  const dynamicShadowStyle = useMemo(() => {
    if (isPrompt) return {};
    return {
      shadowColor: colors[colors.length - 1],
    };
  }, [colors, isPrompt]);

  // Dynamically derive the layers based on the selected colors
  const glowColorsLayer1 = useMemo(() => {
    const alpha = isPrompt ? 0.22 : 0.28;
    return colors.map((c) => hexToRgba(c, alpha));
  }, [colors, isPrompt]);

  const glowColorsLayer2 = useMemo(() => {
    const alpha = isPrompt ? 0.11 : 0.13;
    return colors.map((c) => hexToRgba(c, alpha));
  }, [colors, isPrompt]);

  const glowColorsLayer3 = useMemo(() => {
    const alpha = isPrompt ? 0.04 : 0.05;
    return colors.map((c) => hexToRgba(c, alpha));
  }, [colors, isPrompt]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[shadowStyle, dynamicShadowStyle, style]}
    >
      {/* Glow Layer 3 (Toned-down widest spread, 12px) */}
      <LinearGradient
        colors={glowColorsLayer3}
        locations={locations}
        start={start}
        end={end}
        style={[styles.glowHalo, { top: -12, bottom: -12, left: -12, right: -12, borderRadius: CARD_RADIUS + 12 }]}
        pointerEvents="none"
      />
      {/* Glow Layer 2 (Toned-down medium spread, 7px) */}
      <LinearGradient
        colors={glowColorsLayer2}
        locations={locations}
        start={start}
        end={end}
        style={[styles.glowHalo, { top: -7, bottom: -7, left: -7, right: -7, borderRadius: CARD_RADIUS + 7 }]}
        pointerEvents="none"
      />
      {/* Glow Layer 1 (Toned-down tightest spread, 3px) */}
      <LinearGradient
        colors={glowColorsLayer1}
        locations={locations}
        start={start}
        end={end}
        style={[styles.glowHalo, { top: -3, bottom: -3, left: -3, right: -3, borderRadius: CARD_RADIUS + 3 }]}
        pointerEvents="none"
      />

      {isPrompt ? (
        <View style={[styles.cardInnerContentPrompt, innerStyle]}>
          {children}
        </View>
      ) : (
        <LinearGradient
          colors={colors}
          locations={locations}
          start={start}
          end={end}
          style={[styles.gradientBorder, innerStyle]}
        >
          <View style={[styles.cardInnerContent, innerStyle]}>
            {children}
          </View>
        </LinearGradient>
      )}
    </TouchableOpacity>
  );
});


const PromptCard = React.memo(({ item, onCommentPress }) => (
  <ContentCard onPress={onCommentPress} style={styles.promptCardContainer} variant="prompt">
    <View style={styles.promptContent}>
      <Text style={styles.promptLabel}>{item.data.prompt}</Text>
      <Text style={styles.promptAnswer}>{item.data.response}</Text>
    </View>
    <TouchableOpacity 
      style={styles.actionIconBubble}
      onPress={onCommentPress}
      activeOpacity={0.8}
    >
      <MessageCircle size={20} color={COLORS.primary} strokeWidth={2} />
    </TouchableOpacity>
  </ContentCard>
));

const PhotoCard = React.memo(({ url, isHero, name, age, gender, pronouns, onCommentPress }) => (
  <ContentCard
    onPress={onCommentPress}
    style={styles.photoCardContainer}
    innerStyle={{ flex: 1, height: "100%" }}
    variant="photo"
    seed={url}
  >
    <Image
      source={{ uri: url }}
      style={styles.photoImage}
      contentFit="cover"
      cachePolicy="memory-disk"
    />
    <LinearGradient
      colors={["transparent", isHero ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.2)"]}
      style={isHero ? styles.gradientOverlayHero : styles.gradientOverlay}
    />
    {isHero ? (
      <View style={styles.heroOverlayContent}>
        <Text style={styles.heroNameText} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.heroVitalsRow}>
          {!!age && (
            <View style={styles.heroAgeChip}>
              <Text style={styles.heroAgeText}>🎂 {age}</Text>
            </View>
          )}
          {!!gender && (
            <View style={styles.heroGenderChip}>
              <Text style={styles.heroGenderText}>{gender}</Text>
            </View>
          )}
          {!!pronouns && pronouns !== "Prefer not to say" && (
            <View style={styles.heroGenderChip}>
              <Text style={styles.heroGenderText}>{pronouns}</Text>
            </View>
          )}
        </View>
      </View>
    ) : null}
    <TouchableOpacity 
      style={styles.actionIconBubble}
      onPress={onCommentPress}
      activeOpacity={0.8}
    >
      <MessageCircle size={20} color={COLORS.primary} strokeWidth={2} />
    </TouchableOpacity>
  </ContentCard>
));

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  gradientContainer: {
    flex: 1,
  },
  // Profile completion gate styles (Premium Light Theme)
  gateScreenContainer: {
    flex: 1,
    backgroundColor: "transparent",
  },
  gateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    backgroundColor: "transparent",
  },
  gateHeaderTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 18,
    color: "#1a2d4a",
    textAlign: "center",
  },
  gateHeaderSubtitle: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "rgba(26, 45, 74, 0.7)",
    marginTop: 2,
    textAlign: "center",
  },
  gateBackBtn: {
    padding: 4,
  },
  headerTitleContainer: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  gateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  lockIllustrationContainer: {
    height: 120,
    width: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
    position: 'relative',
  },
  lockedCard: {
    width: 90,
    height: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    position: 'absolute',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  lockedCardLeft: {
    transform: [{ rotate: '-12deg' }, { translateX: -20 }],
  },
  lockedCardRight: {
    transform: [{ rotate: '12deg' }, { translateX: 20 }],
  },
  cardAvatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    marginBottom: 8,
  },
  cardTextPlaceholderLong: {
    width: '80%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    marginBottom: 6,
  },
  cardTextPlaceholderShort: {
    width: '50%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
  },
  lockBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2962FF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    zIndex: 10,
    shadowColor: '#2962FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  gateTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 22,
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  gateBody: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  checklistCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    elevation: 2,
  },
  checklistHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  checklistTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 15,
    color: "#0F172A",
  },
  checklistProgressText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#2962FF",
  },
  progressBarBg: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F1F5F9",
    marginBottom: 20,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#2962FF",
  },
  checklistItems: {
    gap: 16,
  },
  checklistItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  checkIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  checkIconContainerMet: {
    backgroundColor: "#DCFCE7",
  },
  checkItemText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#64748B",
    flex: 1,
  },
  checkItemTextMet: {
    color: "#0F172A",
  },
  checkItemCount: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#64748B",
  },
  checkItemCountMet: {
    color: "#16A34A",
  },
  gateButton: {
    width: "100%",
    height: 52,
    backgroundColor: "#2962FF",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2962FF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  },
  gateButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#FFFFFF",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    backgroundColor: "transparent",
  },
  headerTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 18,
    color: "#1a2d4a",
  },
  backBtn: {
    padding: 4,
  },
  filterBtn: {
    padding: 4,
  },
  glassButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.65)", // Opaque frosted glass background
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.85)", // Defined white edge border
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },

  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: 12, // Reduced empty feeling at the very top
    paddingBottom: 40,
  },

  // Profile Info
  profileHeader: {
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  vitalsSection: {},
  interestsSection: {},
  sparksGlassContainer: {
    backgroundColor: "rgba(119, 141, 94, 0.18)", // Sage Green tinted glass (#778d5e)
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "rgba(119, 141, 94, 0.35)", // Tinted matching border
    marginBottom: 24, // spacing between components
    shadowColor: "#778d5e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  interestsGlassContainer: {
    backgroundColor: "rgba(139, 140, 223, 0.18)", // Soft Purple tinted glass (#8b8cdf)
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "rgba(139, 140, 223, 0.35)", // Tinted matching border
    marginBottom: 24, // spacing between components
    shadowColor: "#8b8cdf",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  sectionLabel: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 18, // Bigger title size
    color: "#1e2d4a", // Premium dark contrast color
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  nameText: {
    fontFamily: FONTS.black, // BasicCommercial-Black only once
    fontSize: 36,
    color: "#0F172A",
    marginBottom: 8,
    marginLeft: 4, // Align visually with chips
    letterSpacing: -0.8,
  },
  roleText: {
    fontFamily: FONTS.medium,
    fontSize: 16,
    color: "#64748B",
    marginBottom: 16,
  },
  vitalsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  interestsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.45)",
    alignSelf: "flex-start", // Prevents chips from stretching to 100% width
  },
  goalChip: {
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
  },
  genderChip: {
    backgroundColor: "rgba(238, 233, 255, 0.85)",
    borderColor: "rgba(238, 233, 255, 0.95)",
  },
  interestChipOverride: {
    marginRight: 0,
    marginBottom: 0, // Container handles gap
  },
  ageChip: {
    backgroundColor: "transparent",
    height: 30,
    paddingHorizontal: 0,
    marginRight: 4,
    borderWidth: 0,
  },
  chipText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: "#374151", // Gray 700
  },
  genderChipText: {
    color: "#4C3B8F",
  },
  goalChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },
  ageChipText: {
    flexDirection: "row",
    alignItems: "center",
  },
  cakeEmoji: {
    fontSize: 20,
    textShadowColor: "rgba(251, 191, 36, 0.9)", // Increased opacity for stronger glow
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15, // Increased radius for more spread
  },
  ageNumber: {
    fontFamily: FONTS.medium,
    fontSize: 18,
    color: "#374151", // Slightly darker Neutral-800
  },

  // Cards
  promptShadow: {
    width: "100%",
    marginBottom: SPACING.l,
    shadowColor: "#d150e0", // Vibrant magenta/purple glow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 0, // Disable native Android dark shadow to let gradient glows shine
    overflow: "visible",
  },
  photoShadow: {
    width: "100%",
    marginBottom: SPACING.l,
    shadowColor: "#93C5FD", // Soft pastel sky blue glow matching the bottom of the photo card
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 0, // Disable native Android dark shadow to let gradient glows shine
    overflow: "visible",
  },
  glowHalo: {
    position: "absolute",
  },
  gradientBorder: {
    width: "100%",
    padding: 3, // Slightly thicker colored halo ring
    borderRadius: CARD_RADIUS,
  },
  cardInnerContent: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: CARD_RADIUS - 3,
    overflow: "hidden", // Clip inner contents to the border radius
    borderWidth: 1, // Inner white core of the neon light
    borderColor: "rgba(255, 255, 255, 0.85)", // High brightness core line
  },
  cardInnerContentPrompt: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.82)", // Frosted glass backing to let background glow show through
    borderRadius: CARD_RADIUS,
    overflow: "hidden", // Clip inner contents to the border radius
    borderWidth: 1.5, // Crisp white outline glass highlight rim
    borderColor: "rgba(255, 255, 255, 0.9)", // White glass edge
    paddingBottom: 40, // Move padding here to center absolute glows correctly
  },
  photoCardContainer: {
    aspectRatio: 4 / 5, // Portrait Cards (Photos)
  },
  promptCardContainer: {
    minHeight: 140, // Ensure a base presence even for very short text
  },
  photoImage: {
    width: "100%",
    height: "100%",
    borderRadius: CARD_RADIUS,
    backgroundColor: "#F1F5F9",
  },
  gradientOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "30%",
    borderBottomLeftRadius: CARD_RADIUS,
    borderBottomRightRadius: CARD_RADIUS,
  },
  gradientOverlayHero: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "45%",
    borderBottomLeftRadius: CARD_RADIUS,
    borderBottomRightRadius: CARD_RADIUS,
  },
  heroOverlayContent: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 70, // Maintain spacing for actionIconBubble
  },
  heroNameText: {
    fontFamily: FONTS.black, // BasicCommercial-Black
    fontSize: 32,
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroVitalsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  heroAgeChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  heroGenderChip: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  heroAgeText: {
    fontFamily: FONTS.medium, // Manrope-Medium
    fontSize: 13,
    color: "#FFFFFF",
  },
  heroGenderText: {
    fontFamily: FONTS.medium, // Manrope-Medium
    fontSize: 13,
    color: "#FFFFFF",
  },
  promptContent: {
    backgroundColor: "transparent",
    borderRadius: CARD_RADIUS,
    padding: 24,
    paddingTop: 32,
    justifyContent: "flex-start",
    overflow: "hidden",
  },
  promptLabel: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: "#64748B",
    marginBottom: 8,
  },
  promptAnswer: {
    fontFamily: FONTS.semiBold,
    fontSize: 22, // Filling space better
    color: "#0F172A",
    lineHeight: 30,
  },

  // Interactive Elements on Cards
  actionIconBubble: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(41, 98, 255, 0.25)", // Subtle brand blue glass border core
    shadowColor: "#2962FF", // Premium brand blue glow
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },

  // Feed Items
  feedItem: {
    marginBottom: 0, // Spacing handled by card margin
  },

  // Bottom Action Bar
  actionBar: {
    position: "absolute",
    bottom: 24, // Floating
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  skipButton: {
    width: 120,
    height: 56,
    borderRadius: 28,
    backgroundColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  skipButtonGradientContainer: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.75)", // Frosted glass backing
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.85)", // Outer glass highlight border
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  skipButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#64748B", // Slate grey text color
    letterSpacing: 0.3,
  },
  connectButton: {
    width: 200,
    height: 56,
    borderRadius: 28,
    backgroundColor: "transparent",
    shadowColor: "#1a2d4a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  connectButtonGradientContainer: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
    overflow: "hidden", // Crucial for clipping the glow bubble!
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.85)", // Outer glass highlight border
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  connectButtonBacking: {
    ...StyleSheet.absoluteFillObject,
  },
  connectButtonGlowBubble: {
    ...StyleSheet.absoluteFillObject,
  },
  connectButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    zIndex: 2, // Ensure text is above the glow bubble
  },
  connectButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#133d70", // Deep slate blue matching the reference
    letterSpacing: 0.3,
  },
  binaryGenderChip: {
    backgroundColor: "rgba(226, 232, 241, 0.85)",
    borderColor: "rgba(226, 232, 241, 0.95)",
  },
  binaryGenderChipText: {
    color: "#2F3A55",
  },
  marginTop20: {
    marginTop: 20,
  },
  bottomSpacer: {
    height: 120,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.45)", // Smooth dark backdrop wash
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "100%",
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContentCard: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.9)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  modalTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 20,
    color: "#0F172A",
    marginBottom: 16,
    letterSpacing: -0.4,
  },
  modalPromptPreview: {
    backgroundColor: "rgba(241, 245, 249, 0.6)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
  },
  modalPromptLabel: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: "#64748B",
    marginBottom: 4,
  },
  modalPromptAnswer: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#0F172A",
  },
  modalPhotoPreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(241, 245, 249, 0.6)",
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
  },
  modalPhotoPreview: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
  },
  modalPhotoPreviewText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#334155",
  },
  modalInput: {
    width: "100%",
    height: 100,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: "#0F172A",
    textAlignVertical: "top",
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalCancelButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: "#64748B",
  },
  modalSendButton: {
    backgroundColor: "#2962FF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#2962FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  modalSendButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: "#FFFFFF",
  },
  modalChipPreviewContainer: {
    gap: 8,
    backgroundColor: "rgba(241, 245, 249, 0.6)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
    alignItems: "flex-start",
  },
  modalChipPreviewLabel: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: "#64748B",
  },
  skipInfoCard: {
    width: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 32, // Matches rx="32" from the reference HTML!
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  skipIllustrationContainer: {
    width: 270,
    height: 180,
    position: "relative",
    marginBottom: 24,
  },
  skipInfoTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 24,
    color: "#0F172A",
    marginBottom: 10,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  skipInfoBody: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  skipInfoButtonContainer: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  skipInfoButtonGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  skipInfoButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  endOfFeedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  endOfFeedCard: {
    width: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  coffeeIllustrationContainer: {
    width: 270,
    height: 180,
    position: "relative",
    marginBottom: 24,
  },
  endOfFeedTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 24,
    color: "#0F172A",
    marginBottom: 10,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  endOfFeedBody: {
    fontFamily: FONTS.regular, // Manrope-Regular
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  revisitButtonContainer: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  revisitButtonGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  revisitButtonText: {
    fontFamily: FONTS.semiBold, // Manrope-SemiBold
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  toastContainer: {
    position: "absolute",
    top: 90, // Just below the header
    left: 20,
    right: 20,
    alignItems: "center",
    zIndex: 999, // Ensure it's on top of everything
  },
  toastInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    gap: 10,
  },
  toastIconBg: {
    width: 22,
    height: 22,
  },
  modalCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalCancelButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: "#64748B",
  },
  modalSendButton: {
    backgroundColor: "#2962FF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#2962FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  modalSendButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: "#FFFFFF",
  },
  modalChipPreviewContainer: {
    gap: 8,
    backgroundColor: "rgba(241, 245, 249, 0.6)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
    alignItems: "flex-start",
  },
  modalChipPreviewLabel: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: "#64748B",
  },
  skipInfoCard: {
    width: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 32, // Matches rx="32" from the reference HTML!
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  skipIllustrationContainer: {
    width: 270,
    height: 180,
    position: "relative",
    marginBottom: 24,
  },
  skipInfoTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 24,
    color: "#0F172A",
    marginBottom: 10,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  skipInfoBody: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  skipInfoButtonContainer: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  skipInfoButtonGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  skipInfoButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  endOfFeedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  endOfFeedCard: {
    width: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  coffeeIllustrationContainer: {
    width: 270,
    height: 180,
    position: "relative",
    marginBottom: 24,
  },
  endOfFeedTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 24,
    color: "#0F172A",
    marginBottom: 10,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  endOfFeedBody: {
    fontFamily: FONTS.regular, // Manrope-Regular
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  revisitButtonContainer: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  revisitButtonGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  revisitButtonText: {
    fontFamily: FONTS.semiBold, // Manrope-SemiBold
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  toastContainer: {
    position: "absolute",
    top: 90, // Just below the header
    left: 20,
    right: 20,
    alignItems: "center",
    zIndex: 999, // Ensure it's on top of everything
  },
  toastInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    gap: 10,
  },
  toastIconBg: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#10B981", // Growth green circle
    justifyContent: "center",
    alignItems: "center",
  },
  toastText: {
    fontFamily: FONTS.medium, // Manrope-Medium
    fontSize: 14,
    color: "#0F172A",
  },
  emptyFiltersIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  clearFiltersButton: {
    backgroundColor: "#EF4444",
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    marginTop: 8,
    width: "100%",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  clearFiltersButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  filterLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
});
