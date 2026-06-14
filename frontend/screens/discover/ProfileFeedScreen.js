import React, { useState, useEffect, useMemo, useCallback } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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
} from "lucide-react-native";
import { apiGet } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { getEventDetails } from "../../api/events";
import { COLORS, SPACING, SHADOWS, FONTS } from "../../constants/theme";
import DiscoverFilterSheet from "../../components/DiscoverFilterSheet";
import HapticsService from "../../services/HapticsService";
import ThemeChip from "../../components/ThemeChip";
import SnooLoader from "../../components/ui/SnooLoader";

const { width } = Dimensions.get("window");
const CARD_RADIUS = 24;
const CARD_SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.08,
  shadowRadius: 32,
  elevation: 5,
};

// Strict Typography Mappings
const TYPOGRAPHY = {
  name: { fontFamily: "BasicCommercial-Bold", fontSize: 20, color: "#1E293B" },
  role: { fontFamily: FONTS.regular, fontSize: 14, color: "#64748B" },
  body: { fontFamily: FONTS.regular, fontSize: 16, color: "#334155" },
  chip: { fontFamily: FONTS.medium, fontSize: 12, color: "#475569" },
  button: { fontFamily: FONTS.medium, fontSize: 14, color: "#FFFFFF" },
  header: { fontFamily: FONTS.semiBold, fontSize: 18, color: "#0F172A" },
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
  const [loading, setLoading] = useState(true);
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [selectedContent, setSelectedContent] = useState(null);
  const [activeFilters, setActiveFilters] = useState({});
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [profileGated, setProfileGated] = useState(false); // true if user's own profile is incomplete
  const [profileProgress, setProfileProgress] = useState({
    photos: 0,
    sparks: 0,
    icebreakers: 0,
  });

  console.log("[ProfileFeedScreen] Render. event:", eventData?.id, "title:", eventData?.title, "loading:", loading, "attendees:", attendees.length);

  const checkAndLoadAttendees = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      if (!token) { setLoading(false); return; }

      // 0. Fetch full event details if title is missing
      let currentEvent = eventData;
      if (initialEvent?.id && (!currentEvent || !currentEvent.title)) {
        try {
          console.log("[ProfileFeedScreen] Fetching full event details for ID:", initialEvent.id);
          const response = await getEventDetails(initialEvent.id);
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

      // 2. Load attendees (backend already filters incomplete profiles)
      if (currentEvent) {
        console.log("[ProfileFeedScreen] Fetching attendees for event ID:", currentEvent.id);
        const response = await apiGet(`/events/${currentEvent.id}/attendees`, 15000, token);
        console.log("[ProfileFeedScreen] Fetch success. Count:", response?.attendees?.length);
        setAttendees(response.attendees || []);
      } else {
        console.warn("[ProfileFeedScreen] Mounted without an event object in route params!");
      }
    } catch (error) {
      console.error("[ProfileFeedScreen] Error:", error);
      setAttendees([]);
    } finally {
      setLoading(false);
    }
  }, [initialEvent, eventData]);

  useEffect(() => {
    checkAndLoadAttendees();
  }, [checkAndLoadAttendees]);

  // Reload when filters change (only if not gated)
  const loadAttendees = useCallback(async (filters = activeFilters) => {
    if (profileGated) return;
    try {
      setLoading(true);
      const token = await getAuthToken();
      if (token && eventData) {
        const response = await apiGet(`/events/${eventData.id}/attendees`, 15000, token);
        setAttendees(response.attendees || []);
      }
    } catch (error) {
      console.error("[ProfileFeedScreen] Error loading attendees:", error);
      setAttendees([]);
    } finally {
      setLoading(false);
    }
  }, [eventData, activeFilters, profileGated]);

  const currentAttendee = attendees[currentIndex];

  // Data Extraction
  const name = (currentAttendee?.name || "Unknown").trim() || "Unknown";
  const role =
    (currentAttendee?.role || currentAttendee?.job_title || "Member").trim() ||
    "Member";
  const age = currentAttendee?.age;
  const gender = currentAttendee?.gender;
  const pronouns = currentAttendee?.pronouns;
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

  const handleNext = useCallback(() => {
    if (currentIndex < attendees.length - 1)
      setCurrentIndex((prev) => prev + 1);
    else Alert.alert("All Done", "You've seen everyone.");
  }, [currentIndex, attendees.length]);

  const handleConnect = useCallback(() => {
    HapticsService.triggerImpactMedium();
    Alert.alert("Request Sent", `Connection request sent to ${name}`);
    handleNext();
  }, [name, handleNext]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleOpenFilters = useCallback(() => {
    setFilterSheetVisible(true);
  }, []);

  const handleCloseFilters = useCallback(() => {
    setFilterSheetVisible(false);
  }, []);

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
        <SafeAreaView style={styles.gateScreenContainer} edges={EDGES}>
          <View style={styles.gateHeader}>
            <TouchableOpacity onPress={handleBack} style={styles.gateBackBtn}>
              <ArrowLeft size={26} color="#0F172A" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.gateHeaderTitle}>Discover People</Text>
              {subtitle ? (
                <Text style={styles.gateHeaderSubtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <View style={{ width: 40 }} />
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
      );
    }

    if (!currentAttendee) {
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
    <SafeAreaView style={styles.container} edges={EDGES}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
        >
          <ArrowLeft size={26} color={COLORS.editorial.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Discover</Text>
        <TouchableOpacity
          onPress={handleOpenFilters}
          style={styles.filterBtn}
        >
          <SlidersHorizontal size={26} color={COLORS.editorial.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Profile Header (Name) */}
        <View style={styles.profileHeader}>
          <Text style={styles.nameText}>{name}</Text>
        </View>

        {/* Hero Photo */}
        {photos[0] && <PhotoCard url={photos[0].url} />}

        {/* Vitals & Goals Group (Positioned after the first photo) */}
        <View style={styles.vitalsSection}>
          {/* Top Row: Demographics */}
          <View style={styles.vitalsRow}>
            {/* Age */}
            {!!age && (
              <View style={[styles.chip, styles.ageChip]}>
                <Text style={styles.ageChipText}>
                  <Text style={styles.cakeEmoji}>🎂 </Text>
                  <Text style={styles.ageNumber}>{age}</Text>
                </Text>
              </View>
            )}
            {/* Gender */}
            {gender && (
              <View
                style={[
                  styles.chip,
                  gender.toLowerCase() === "binary"
                    ? styles.binaryGenderChip
                    : styles.genderChip,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    gender.toLowerCase() === "binary"
                      ? styles.binaryGenderChipText
                      : styles.genderChipText,
                  ]}
                >
                  {gender}
                </Text>
              </View>
            )}
          </View>

          {/* Bottom Row: Goals */}
          {goalBadges.length > 0 && (
            <View style={[styles.vitalsRow, styles.marginTop20]}>
              {goalBadges.map((badge, i) => {
                const goalStyle = getGoalStyle(badge);
                return (
                  <View
                    key={`goal-${i}`}
                    style={[
                      styles.chip,
                      styles.goalChip,
                      { backgroundColor: goalStyle.bg },
                    ]}
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
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Interleaved Prompts & Photos */}
        {interleavedContent.map((item, i) => (
          <View key={i} style={styles.feedItem}>
            {item.type === "prompt" ? (
              <PromptCard item={item} />
            ) : (
              <PhotoCard url={item.data.url} />
            )}
          </View>
        ))}

        {/* Interests Group (Bottom of Profile) */}
        {interests.length > 0 && (
          <View style={styles.interestsSection}>
            <Text style={styles.sectionLabel}>Interests</Text>
            <View style={styles.interestsContainer}>
              {interests.map((interest, i) => (
                <ThemeChip
                  key={`int-${i}`}
                  label={interest}
                  index={i}
                  style={styles.interestChipOverride}
                />
              ))}
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Floating Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.skipButton} onPress={handleNext}>
          <Ionicons name="close" size={24} color="#64748B" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.connectButton} onPress={handleConnect}>
          <Text style={styles.connectButtonText}>Connect</Text>
        </TouchableOpacity>
      </View>

      {filterSheetVisible && (
        <DiscoverFilterSheet
          visible={filterSheetVisible}
          onClose={handleCloseFilters}
          onApply={setActiveFilters}
          initialFilters={activeFilters}
        />
      )}
    </SafeAreaView>
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

const ContentCard = React.memo(({ children, onPress, style }) => (
  <TouchableOpacity
    style={[styles.cardContainer, style]}
    activeOpacity={0.9}
    onPress={onPress}
  >
    {children}
  </TouchableOpacity>
));

const PromptCard = React.memo(({ item }) => (
  <ContentCard onPress={() => {}} style={styles.promptCardContainer}>
    <View style={styles.promptContent}>
      <Text style={styles.promptLabel}>{item.data.prompt}</Text>
      <Text style={styles.promptAnswer}>{item.data.response}</Text>
    </View>
    <View style={styles.actionIconBubble}>
      <MessageCircle size={22} color="#0F3D3E" />
    </View>
  </ContentCard>
));

const PhotoCard = React.memo(({ url }) => (
  <ContentCard onPress={() => {}} style={styles.photoCardContainer}>
    <Image
      source={{ uri: url }}
      style={styles.photoImage}
      contentFit="cover"
      cachePolicy="memory-disk"
    />
    <LinearGradient
      colors={["transparent", "rgba(0,0,0,0.2)"]}
      style={styles.gradientOverlay}
    />
    <View style={styles.actionIconBubble}>
      <MessageCircle size={22} color="#0F3D3E" />
    </View>
  </ContentCard>
));

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#faf9f7", // Soft Off-White
  },
  // Profile completion gate styles (Premium Light Theme)
  gateScreenContainer: {
    flex: 1,
    backgroundColor: "#faf9f7",
  },
  gateHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    backgroundColor: "#faf9f7",
  },
  gateHeaderTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 18,
    color: "#0F172A",
    textAlign: "center",
  },
  gateHeaderSubtitle: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#64748B",
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
    backgroundColor: "#faf9f7",
  },
  headerTitle: {
    ...TYPOGRAPHY.header,
  },
  backBtn: {
    padding: 4,
  },
  filterBtn: {
    padding: 4,
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
  vitalsSection: {
    marginTop: 12,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  interestsSection: {
    marginTop: 32,
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: "#64748B",
    marginBottom: 12,
    marginLeft: 4,
  },
  nameText: {
    fontFamily: FONTS.semiBold,
    fontSize: 32,
    color: "#0F172A",
    marginBottom: 8,
    marginLeft: 4, // Align visually with chips
    letterSpacing: -0.5,
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
    backgroundColor: "#F3F4F6", // Soft neutral (Cool Gray 100)
    height: 30, // Compact height for base chips
    borderRadius: 999, // Pill shape
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0,
  },
  goalChip: {
    height: 34, // Taller than Gender/Age as requested
    paddingHorizontal: 16,
  },
  genderChip: {
    backgroundColor: "#EEE9FF",
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
  },
  chipText: {
    fontFamily: FONTS.regular, // Strict Manrope Regular
    fontSize: 14,
    color: "#374151", // Gray 700
  },
  genderChipText: {
    color: "#4C3B8F",
  },
  goalChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
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
    fontFamily: FONTS.semiBold,
    fontSize: 19,
    color: "#374151", // Slightly darker Neutral-800
  },

  // Cards
  cardContainer: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: CARD_RADIUS,
    marginBottom: SPACING.l,
    ...CARD_SHADOW,
    overflow: "visible", // For shadow
  },
  photoCardContainer: {
    aspectRatio: 4 / 5, // Portrait Cards (Photos)
  },
  promptCardContainer: {
    minHeight: 140, // Ensure a base presence even for very short text
    paddingBottom: 40, // Extra space for the floating chat icon
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
  promptContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: CARD_RADIUS,
    padding: 24,
    paddingTop: 32,
    justifyContent: "flex-start",
    overflow: "hidden",
  },
  promptLabel: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: "#64748B",
    marginBottom: 8,
  },
  promptAnswer: {
    fontFamily: FONTS.semiBold,
    fontSize: 24, // Filling space better
    color: "#0F172A",
    lineHeight: 32,
  },

  // Interactive Elements on Cards
  actionIconBubble: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#D4EEEF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
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
    left: SPACING.l,
    right: SPACING.l,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  skipButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.md,
  },
  connectButton: {
    flex: 1,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#4186ff", // Calm, confident blue
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.sm,
  },
  connectButtonText: {
    ...TYPOGRAPHY.button,
    fontSize: 16,
  },
  binaryGenderChip: {
    backgroundColor: "#E2E8F1",
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
});
