/**
 * MyDataScreen — Role-aware privacy transparency screen
 *
 * Shell component that detects account type and routes to:
 *   MemberPrivacyScreen  → member accounts (personal AQI, interests, controls)
 *   CommunityPrivacyScreen → community accounts (health, event focus, controls)
 *   SponsorPrivacyScreen → brand accounts (campaign summary + acknowledgment banner)
 *
 * BUG FIX: Toggle persistence — updateConsent in api/privacy.js no longer swallows
 * errors. handleToggle's catch block now properly fires and reverts local state.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  StatusBar, Animated, ScrollView, Modal, TouchableWithoutFeedback, Pressable,
} from "react-native";
import LottieView from "lottie-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus,
  Sparkles, Handshake, Users, Trash2, Zap,
  ShieldCheck, Calendar, BarChart2, CheckCircle,
  ChevronRight, Info, ThumbsUp, HelpCircle, MessageSquare, Share2, Play,
  AlertTriangle, XCircle, FileText, CalendarDays, Ticket,
} from "lucide-react-native";
import { FONTS, COLORS } from "../../constants/theme";
import {
  getMyDataSummary,
  getCommunityDataSummary,
  updateConsent,
  requestDataDeletion,
} from "../../api/privacy";
import { getActiveAccount, getAuthToken } from "../../api/auth";
import { apiGet } from "../../api/client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import loadingAnimation from "../../assets/animations/loading.json";

const { width } = Dimensions.get("window");

// ── Shared constants ──────────────────────────────────────────────────────────

const TIER_COLORS = {
  1: { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)", text: "#D97706" },
  2: { bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.2)", text: "#2563EB" },
  3: { bg: "rgba(107,114,128,0.1)", border: "rgba(107,114,128,0.2)", text: "#4B5563" },
  4: { bg: "rgba(156,163,175,0.1)", border: "rgba(156,163,175,0.2)", text: "#6B7280" },
};

const TRAJECTORY_CONFIG = {
  rising:   { icon: TrendingUp,   color: "#10B981", label: "Rising" },
  declining:{ icon: TrendingDown, color: "#EF4444", label: "Declining" },
  stable:   { icon: Minus,        color: "#6B7280", label: "Stable" },
};

const INFO_TIERS = [
  {
    tier: 1, badge: "🏆", label: "The Buyers",
    desc: "Highly active members who RSVP and engage frequently. Brands view this tier as high-value.",
    color: TIER_COLORS[1],
  },
  {
    tier: 2, badge: "⭐", label: "The Aspirants",
    desc: "Consistent engagement pattern, showing growing interest in events and content.",
    color: TIER_COLORS[2],
  },
  {
    tier: 3, badge: "👥", label: "The Browsers",
    desc: "Exploring what SnooSpace has to offer. Profile grows with attendance and interactions.",
    color: TIER_COLORS[3],
  },
  {
    tier: 4, badge: "👻", label: "The Ghosts",
    desc: "Just getting started. Explore events and content to build out your interest profile.",
    color: TIER_COLORS[4],
  },
];

// ── Toggle definitions ────────────────────────────────────────────────────────

const MEMBER_TOGGLES = [
  {
    icon: Sparkles,  iconColor: "#8B5CF6",
    title: "Personalized Experience",
    description: "Track events and content to improve your feed",
    field: "behavioral", apiField: "behavioralTracking",
  },
  {
    icon: Handshake, iconColor: "#3B82F6",
    title: "Brand Audience Inclusion",
    description: "Let your aggregated activity contribute to creator audience reports brands access",
    field: "brand", apiField: "brandTargeting",
  },
  {
    icon: Users,     iconColor: "#10B981",
    title: "Community Insights",
    description: "Contribute to anonymous community quality stats — always aggregated",
    field: "dataSharing", apiField: "dataSharing",
  },
];

const COMMUNITY_TOGGLES = [
  {
    icon: Sparkles,  iconColor: "#8B5CF6",
    title: "Personalized Experience",
    description: "Improve your browsing experience based on how you use SnooSpace",
    field: "behavioral", apiField: "behavioralTracking",
  },
  {
    icon: Handshake, iconColor: "#3B82F6",
    title: "Brand Audience Inclusion",
    description: "Let your aggregated activity contribute to platform-wide audience reports",
    field: "brand", apiField: "brandTargeting",
  },
  {
    icon: Users,     iconColor: "#10B981",
    title: "Community Insights",
    description: "Contribute to anonymous platform-wide community statistics",
    field: "dataSharing", apiField: "dataSharing",
  },
  {
    icon: BarChart2, iconColor: "#F59E0B",
    title: "Event Audience Intelligence",
    description: "Let brands see aggregated quality reports of who attends your events — group data only, never individual identities",
    field: "eventAudienceIntelligence", apiField: "eventAudienceIntelligence",
  },
];

// ── Community Health config ───────────────────────────────────────────────────

const HEALTH_CONFIG = {
  healthy: {
    Icon: ShieldCheck,
    color: "#10B981",
    bg: "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.2)",
    label: "Healthy",
    message: "Your community engagement signals look authentic.",
    subtext: "Brands can discover your community for partnerships.",
  },
  under_review: {
    Icon: AlertTriangle,
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.2)",
    label: "Under Review",
    message: "Some engagement patterns are being monitored.",
    subtext: "This may temporarily affect your brand partnership visibility.",
  },
  restricted: {
    Icon: XCircle,
    color: "#EF4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.2)",
    label: "Restricted",
    message: "Your community has been removed from brand discovery.",
    subtext: "Contact support@snoospace.in to resolve.",
  },
};

const SPONSOR_BULLETS = [
  "Use match data only within SnooSpace for campaign planning",
  "Not attempt to re-identify individual users from aggregated reports",
  "Not share audience intelligence data with third parties outside SnooSpace",
];

// ── Shared loading view ───────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC", justifyContent: "center", alignItems: "center" }}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={["#F8FAFC", "#F1F5F9", "#E2E8F0"]} style={StyleSheet.absoluteFillObject} />
      <LottieView source={loadingAnimation} autoPlay loop style={{ width: 140, height: 140 }} />
    </View>
  );
}

// ── ToggleRow ─────────────────────────────────────────────────────────────────

function ToggleRow({ icon: Icon, iconColor, title, description, active, onToggle }) {
  const anim = React.useRef(new Animated.Value(active ? 1 : 0)).current;
  React.useEffect(() => {
    Animated.spring(anim, {
      toValue: active ? 1 : 0, friction: 8, tension: 50, useNativeDriver: false,
    }).start();
  }, [active]);
  const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 18] });
  const bg = anim.interpolate({
    inputRange: [0, 1], outputRange: ["rgba(0,0,0,0.08)", COLORS.primary],
  });
  return (
    <TouchableOpacity style={styles.toggleRow} activeOpacity={0.85} onPress={onToggle}>
      <View style={[styles.toggleIcon, { backgroundColor: iconColor + "15" }]}>
        <Icon size={20} color={iconColor} strokeWidth={2} />
      </View>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <Animated.View style={[styles.toggle, { backgroundColor: bg }]}>
        <Animated.View style={[styles.toggleKnob, { transform: [{ translateX: tx }] }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── DeleteModal — shared by member and community ──────────────────────────────

function DeleteModal({ visible, deleting, onConfirm, onCancel }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <TouchableWithoutFeedback onPress={() => !deleting && onCancel()}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.modalIconWrap}><Trash2 size={24} color="#EF4444" strokeWidth={1.8} /></View>
              <Text style={styles.modalTitle}>Delete Behavioral Data?</Text>
              <Text style={styles.modalBody}>
                This will remove your interest profiles, engagement history, and audience scoring. Your account and posts stay intact.
              </Text>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={onCancel} disabled={deleting}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirm} onPress={onConfirm} disabled={deleting}>
                  <Text style={styles.modalConfirmText}>{deleting ? "Deleting..." : "Delete Data"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// In-memory cache for fast re-entry (stale-while-revalidate pattern)
const dataCache = {
  accountType: null,
  member: null,
  community: null,
  sponsor: null,
  timestamps: {
    member: 0,
    community: 0,
    sponsor: 0,
  }
};
const CACHE_DURATION = 15000; // Cache valid for 15 seconds

// ── MyDataScreen — router shell ───────────────────────────────────────────────

const MyDataScreen = ({ navigation, route }) => {
  const [accountType, setAccountType] = useState(dataCache.accountType || "member");
  const [loading, setLoading] = useState(!dataCache.accountType);
  const initialTab = route?.params?.initialTab || "personal";

  useEffect(() => {
    if (dataCache.accountType) return;
    let isMounted = true;
    getActiveAccount()
      .then((account) => {
        if (isMounted) {
          const type = account?.type || "member";
          dataCache.accountType = type;
          setAccountType(type);
        }
      })
      .catch(() => {
        if (isMounted) {
          dataCache.accountType = "member";
          setAccountType("member");
        }
      })
      .finally(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, []);

  if (loading) return <LoadingScreen />;
  if (accountType === "community") return <CommunityPrivacyScreen navigation={navigation} />;
  if (accountType === "sponsor") return <SponsorPrivacyScreen navigation={navigation} />;
  return <MemberPrivacyScreen navigation={navigation} initialTab={initialTab} />;
};

// ── MemberPrivacyScreen ───────────────────────────────────────────────────────

function MemberPrivacyScreen({ navigation, initialTab = "personal" }) {
  const cacheKey = 'member';
  const cachedData = dataCache[cacheKey];
  const cacheAge = cachedData ? Date.now() - dataCache.timestamps[cacheKey] : Infinity;
  const isCacheFresh = cacheAge < CACHE_DURATION;
  const hasCachedData = !!cachedData;

  const [summary, setSummary]     = useState(cachedData);
  const [loading, setLoading]     = useState(!hasCachedData);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isCreatorMode, setIsCreatorMode] = useState(false);
  const [creatorData, setCreatorData] = useState(null);
  const [creatorLoading, setCreatorLoading] = useState(false);
  const tabUnderlineX = useRef(new Animated.Value(initialTab === 'creator' ? 1 : 0)).current;
  const consents_init = {
      behavioral: cachedData?.consentState?.behavioral ?? false,
      brand: cachedData?.consentState?.brand ?? false,
      dataSharing: cachedData?.consentState?.dataSharing ?? false,
  };
  const [consents, setConsents]   = useState(() => consents_init);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [infoModal, setInfoModal] = useState({ visible: false, title: "", body: "", breakdown: null, showTiers: false });
  const fadeAnim = useRef(new Animated.Value(hasCachedData ? 1 : 0)).current;

  const loadData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const result = await getMyDataSummary();
      if (result?.success) {
        dataCache[cacheKey] = result.summary;
        dataCache.timestamps[cacheKey] = Date.now();

        setSummary(result.summary);
        setConsents({
          behavioral: result.summary.consentState?.behavioral ?? false,
          brand: result.summary.consentState?.brand ?? false,
          dataSharing: result.summary.consentState?.dataSharing ?? false,
        });
      }
    } catch (e) {
      console.error("[MemberPrivacyScreen] load error:", e);
    } finally {
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  }, []);

  useEffect(() => {
    if (!isCacheFresh) {
      loadData(!hasCachedData);
    }
  }, [loadData, isCacheFresh, hasCachedData]);

  // Read creator mode flag from AsyncStorage (persisted by SettingsScreen)
  useEffect(() => {
    AsyncStorage.getItem("creator_mode_enabled").then((val) => {
      setIsCreatorMode(val === "true");
    });
  }, []);

  // Load lightweight creator insights when Creator tab is first activated
  const loadCreatorData = useCallback(async () => {
    if (creatorData || creatorLoading) return;
    setCreatorLoading(true);
    try {
      const token = await getAuthToken();
      const result = await apiGet("/creator/me/insights", 15000, token);
      setCreatorData(result);
    } catch (e) {
      // Endpoint may not exist yet — show placeholder gracefully
      setCreatorData({ notAvailable: true });
    } finally {
      setCreatorLoading(false);
    }
  }, [creatorData, creatorLoading]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    Animated.spring(tabUnderlineX, {
      toValue: tab === 'creator' ? 1 : 0,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();
    if (tab === 'creator') loadCreatorData();
  };

  const handleToggle = async (field, apiField) => {
    const previousValue = consents[field];
    const newVal = !previousValue;

    console.log('[MemberPrivacy] Toggle fired:', apiField, '→', newVal);
    setConsents((prev) => ({ ...prev, [field]: newVal })); // optimistic

    if (dataCache[cacheKey]) {
      if (!dataCache[cacheKey].consentState) dataCache[cacheKey].consentState = {};
      dataCache[cacheKey].consentState[field] = newVal;
    }

    try {
      console.log('[MemberPrivacy] Calling updateConsent...');
      await updateConsent({ [apiField]: newVal });
      console.log('[MemberPrivacy] updateConsent resolved ✅');
    } catch (err) {
      console.error('[MemberPrivacy] updateConsent failed — reverting:', err?.message, 'status:', err?.status);
      setConsents((prev) => ({ ...prev, [field]: previousValue }));
      if (dataCache[cacheKey] && dataCache[cacheKey].consentState) {
        dataCache[cacheKey].consentState[field] = previousValue;
      }
    }
  };

  const handleDeleteData = async () => {
    setDeleting(true);
    try {
      const result = await requestDataDeletion();
      if (result?.success) {
        dataCache[cacheKey] = null;
        dataCache.timestamps[cacheKey] = 0;

        setShowDeleteModal(false);
        loadData(true);
      }
    } catch (e) {
      console.error("[MemberPrivacyScreen] deletion error:", e);
    } finally { setDeleting(false); }
  };

  const openInfo = (title, body, breakdown = null, showTiers = false) =>
    setInfoModal({ visible: true, title, body, breakdown, showTiers });

  const accountAge = summary?.accountCreatedAt
    ? Math.floor((Date.now() - new Date(summary.accountCreatedAt).getTime()) / 86400000)
    : 0;
  const joinDate = summary?.accountCreatedAt
    ? new Date(summary.accountCreatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Unknown";

  const tierColor      = TIER_COLORS[summary?.aqiTier || 4];
  const trajectory     = TRAJECTORY_CONFIG[summary?.trajectory || "stable"];
  const TrajectoryIcon = trajectory.icon;
  const eventsAttended    = summary?.eventsAttended || 0;
  const contentEngaged    = summary?.contentEngaged || 0;
  const totalSignals      = summary?.totalSignals || 0;
  const engagementQuality = summary?.engagementQualityPct || 0;
  const contentBreakdown  = summary?.contentBreakdown || {};
  const showInterests = (summary?.topInterests?.length > 0) && (eventsAttended + contentEngaged) >= 5;
  const aqiDrivers        = summary?.aqiDrivers     || [];
  const improvements      = summary?.improvements   || [];
  const activeDaysThisWeek = summary?.activeDaysThisWeek ?? 0;
  const aqiTier            = summary?.aqiTier ?? 4;

  // Fully dynamic description — uses activeDaysThisWeek from API when available
  const dataDescription = (() => {
    if (eventsAttended === 0 && contentEngaged === 0)
      return "Start engaging with SnooSpace to build your profile";
    if (eventsAttended === 0)
      return `${contentEngaged} content interaction${contentEngaged !== 1 ? "s" : ""} logged. Attend an event to unlock stronger signals.`;
    const dayStr = activeDaysThisWeek > 0
      ? ` · ${activeDaysThisWeek} active day${activeDaysThisWeek !== 1 ? "s" : ""} this week`
      : "";
    return `${eventsAttended} event${eventsAttended !== 1 ? "s" : ""} attended · ${contentEngaged} content interaction${contentEngaged !== 1 ? "s" : ""}${dayStr}`;
  })();

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={["#F8FAFC", "#F1F5F9", "#E2E8F0"]} style={StyleSheet.absoluteFillObject} />
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <LinearGradient colors={["#DDD6FE", "#F5F3FF"]} style={styles.glowOrb1} />
        <LinearGradient colors={["#BFDBFE", "#EFF6FF"]} style={styles.glowOrb2} />
      </View>
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(255,255,255,0.5)" }]} pointerEvents="none" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color="#4B5563" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Activity</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Tab bar — only visible when Creator Mode is ON */}
        {isCreatorMode && (
          <View style={tabStyles.tabBar}>
            {['personal', 'creator'].map((tab) => {
              const isActive = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[tabStyles.tabItem, isActive && tabStyles.tabItemActive]}
                  onPress={() => switchTab(tab)}
                  activeOpacity={0.8}
                >
                  <Text style={[tabStyles.tabLabel, isActive && tabStyles.tabLabelActive]}>
                    {tab === 'personal' ? 'Personal' : 'Creator'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── PERSONAL TAB ─────────────────────────────────── */}
        {activeTab === 'personal' && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim }}>

            {/* Tier */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Audience Tier</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.tierCard,
                  { backgroundColor: tierColor.bg, borderColor: tierColor.border },
                  pressed && { opacity: 0.85 }
                ]}
                onPress={() => openInfo(
                  "Audience Tiers",
                  "Tiers are calculated based on your event attendance and engagement depth over the last 30 days.",
                  null, true
                )}
              >
                <Text style={styles.tierBadge}>{summary?.tierBadge || "👻"}</Text>
                <View style={styles.tierInfo}>
                  <Text style={[styles.tierLabel, { color: tierColor.text }]}>{summary?.tierLabel || "Unknown"}</Text>
                  <View style={styles.trajectoryRow}>
                    <TrajectoryIcon size={14} color={trajectory.color} strokeWidth={2} />
                    <Text style={[styles.trajectoryText, { color: trajectory.color }]}>{trajectory.label}</Text>
                  </View>
                </View>
                <Info size={18} color={tierColor.text} strokeWidth={2} style={{ opacity: 0.7 }} />
              </Pressable>
              <Text style={styles.tierExplanation}>{summary?.tierExplanation || ""}</Text>
            </View>

            {/* AQI Drivers — what's building the profile */}
            {aqiDrivers.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>What's Building Your Profile</Text>
                {aqiDrivers.map((driver, index) => (
                  <View
                    key={index}
                    style={[
                      styles.driverCard,
                      driver.contribution === "positive"
                        ? styles.driverCardPositive
                        : styles.driverCardNegative,
                    ]}
                  >
                    <View style={styles.driverRow}>
                      <View
                        style={[
                          styles.driverIconWrap,
                          {
                            backgroundColor:
                              driver.contribution === "positive"
                                ? COLORS.success + "18"
                                : "rgba(245,158,11,0.12)",
                          },
                        ]}
                      >
                        {driver.contribution === "positive" ? (
                          <TrendingUp size={16} color={COLORS.success} strokeWidth={2} />
                        ) : (
                          <TrendingDown size={16} color="#F59E0B" strokeWidth={2} />
                        )}
                      </View>
                      <View style={styles.driverContent}>
                        <Text style={styles.driverLabel}>{driver.label}</Text>
                        <Text style={styles.driverDetail}>{driver.detail}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Your Data stats */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Data</Text>
              <View style={styles.statsRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.statCard,
                    pressed && { backgroundColor: '#F2F2F7' }
                  ]}
                  onPress={() => openInfo("Events Attended", "The number of events you have RSVPd to or registered for through SnooSpace.\n\nAttending events helps us understand what experiences matter to you and improves the recommendations you see.")}
                >
                  <View style={styles.statHeader}>
                    <View style={[styles.statIconWrap, { backgroundColor: "rgba(245,158,11,0.1)" }]}><Ticket size={14} color="#F59E0B" strokeWidth={2} /></View>
                    <Info size={13} color="#D1D5DB" strokeWidth={2} />
                  </View>
                  <Text style={styles.statValue}>{eventsAttended}</Text>
                  <Text style={styles.statLabel}>Events Attended</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.statCard,
                    pressed && { backgroundColor: '#F2F2F7' }
                  ]}
                  onPress={() => openInfo("Content Interactions", "How you engage with community content — polls, questions, challenges, prompts, and posts.", contentBreakdown)}
                >
                  <View style={styles.statHeader}>
                    <View style={[styles.statIconWrap, { backgroundColor: "rgba(139,92,246,0.1)" }]}><Zap size={14} color="#8B5CF6" strokeWidth={2} /></View>
                    <Info size={13} color="#D1D5DB" strokeWidth={2} />
                  </View>
                  <Text style={styles.statValue}>{contentEngaged}</Text>
                  <Text style={styles.statLabel}>Content Interactions</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.statCard,
                    pressed && { backgroundColor: '#F2F2F7' }
                  ]}
                  onPress={() => openInfo("Engagement Quality", "Reflects how varied your activity is across SnooSpace.\n\nA broader mix of engagement — events, posts, polls, challenges — builds a richer and more accurate profile, which leads to better recommendations for you.")}
                >
                  <View style={styles.statHeader}>
                    <View style={[styles.statIconWrap, { backgroundColor: "rgba(236,72,153,0.1)" }]}><ShieldCheck size={14} color="#EC4899" strokeWidth={2} /></View>
                    <Info size={13} color="#D1D5DB" strokeWidth={2} />
                  </View>
                  <Text style={styles.statValue}>{engagementQuality}%</Text>
                  <Text style={styles.statLabel}>Quality</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.statCard,
                    pressed && { backgroundColor: '#F2F2F7' }
                  ]}
                  onPress={() => openInfo("Member Since", `You joined SnooSpace on ${joinDate} — ${accountAge} day${accountAge !== 1 ? "s" : ""} ago.\n\nLonger membership paired with consistent activity builds a stronger audience profile over time.`)}
                >
                  <View style={styles.statHeader}>
                    <View style={[styles.statIconWrap, { backgroundColor: "rgba(59,130,246,0.1)" }]}><CalendarDays size={14} color="#3B82F6" strokeWidth={2} /></View>
                    <Info size={13} color="#D1D5DB" strokeWidth={2} />
                  </View>
                  <Text style={styles.statValue}>{accountAge}d</Text>
                  <Text style={styles.statLabel}>Joined on {joinDate}</Text>
                </Pressable>
              </View>
              <Text style={styles.positiveFrame}>{dataDescription}</Text>
            </View>

            {/* Top Interests */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Top Interests</Text>
              {showInterests ? (
                <>
                  <Text style={styles.sectionMeta}>Based on your last {totalSignals} interactions</Text>
                  <View style={styles.chipRow}>
                    {summary.topInterests.map((interest, i) => (
                      <View key={i} style={styles.chip}><Text style={styles.chipText}>{interest}</Text></View>
                    ))}
                  </View>
                </>
              ) : (
                <Text style={styles.interestPlaceholder}>Engage with more events to see your interest profile.</Text>
              )}
            </View>

            {/* Privacy Controls */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Privacy Controls</Text>
              <View style={styles.controlsCard}>
                {MEMBER_TOGGLES.map((t, i) => (
                  <React.Fragment key={t.field}>
                    {i > 0 && <View style={styles.separator} />}
                    <ToggleRow
                      icon={t.icon} iconColor={t.iconColor}
                      title={t.title} description={t.description}
                      active={consents[t.field]}
                      onToggle={() => handleToggle(t.field, t.apiField)}
                    />
                  </React.Fragment>
                ))}
              </View>
            </View>

            {/* Improvements — only for non-Tier-1 members with suggestions */}
            {improvements.length > 0 && aqiTier !== 1 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>How to Strengthen Your Profile</Text>
                <View style={styles.improvementsCard}>
                  {improvements.map((improvement, index) => (
                    <View
                      key={index}
                      style={[
                        styles.improvementRow,
                        index < improvements.length - 1 && styles.improvementDivider,
                      ]}
                    >
                      <View style={styles.improvementBulletWrap}>
                        <ChevronRight size={14} color={COLORS.primary} strokeWidth={2.5} />
                      </View>
                      <Text style={styles.improvementText}>{improvement}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Delete */}
            <View style={[styles.section, { marginBottom: 40 }]}>
              <TouchableOpacity style={styles.deleteButton} activeOpacity={0.8} onPress={() => setShowDeleteModal(true)}>
                <Trash2 size={18} color="#EF4444" strokeWidth={1.8} />
                <Text style={styles.deleteText}>Delete My Behavioral Data</Text>
              </TouchableOpacity>
            </View>

          </Animated.View>
        </ScrollView>
        )}

        {/* ── CREATOR TAB ─────────────────────────────────────── */}
        {activeTab === 'creator' && (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingTop: 8 }]}
            showsVerticalScrollIndicator={false}
          >
            {creatorLoading ? (
              <View style={{ flex: 1, alignItems: 'center', paddingTop: 60 }}>
                <LottieView source={loadingAnimation} autoPlay loop style={{ width: 100, height: 100 }} />
                <Text style={[styles.sectionTitle, { marginTop: 16, color: '#9CA3AF', textAlign: 'center' }]}>Loading creator insights…</Text>
              </View>
            ) : creatorData?.notAvailable ? (
              <View style={tabStyles.placeholderWrap}>
                <View style={tabStyles.comingSoonCard}>
                  <View style={tabStyles.comingSoonIcon}>
                    <BarChart2 size={32} color="#7C3AED" strokeWidth={1.5} />
                  </View>
                  <Text style={tabStyles.comingSoonTitle}>Creator Analytics</Text>
                  <Text style={tabStyles.comingSoonSub}>
                    Your creator-scoped audience intelligence — Follow Quality, Audience Score, and content reach — will appear here once the analytics pipeline is live.
                  </Text>
                  <View style={tabStyles.featureList}>
                    {[
                      { icon: TrendingUp, color: '#10B981', label: 'Follow Quality Score',  sub: 'How genuine & engaged your followers are' },
                      { icon: Sparkles,   color: '#8B5CF6', label: 'Audience Score',         sub: 'Overall creator audience strength' },
                      { icon: Users,      color: '#3B82F6', label: 'Follower Reach',         sub: 'Estimated reach of your content' },
                      { icon: Zap,        color: '#F59E0B', label: 'Content Interactions',  sub: 'Engagement across all post types' },
                    ].map(({ icon: Icon, color, label, sub }) => (
                      <View key={label} style={tabStyles.featureRow}>
                        <View style={[tabStyles.featureIconWrap, { backgroundColor: color + '18' }]}>
                          <Icon size={16} color={color} strokeWidth={2} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={tabStyles.featureLabel}>{label}</Text>
                          <Text style={tabStyles.featureSub}>{sub}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ) : (
              <Animated.View style={{ opacity: fadeAnim }}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Audience Score</Text>
                  <View style={tabStyles.scoreCard}>
                    <View style={tabStyles.scoreCircle}>
                      <Text style={tabStyles.scoreValue}>{creatorData?.audienceScore ?? '--'}</Text>
                      <Text style={tabStyles.scoreMax}>/100</Text>
                    </View>
                    <Text style={tabStyles.scoreSub}>A composite measure of how engaged and genuine your audience is.</Text>
                  </View>
                </View>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Follow Quality</Text>
                  <View style={styles.statsRow}>
                    <Pressable style={({ pressed }) => [styles.statCard, pressed && { backgroundColor: '#F2F2F7' }]}>
                      <View style={styles.statHeader}>
                        <View style={[styles.statIconWrap, { backgroundColor: 'rgba(16,185,129,0.1)' }]}><TrendingUp size={14} color="#10B981" strokeWidth={2} /></View>
                      </View>
                      <Text style={styles.statValue}>{creatorData?.followQuality ?? '--'}%</Text>
                      <Text style={styles.statLabel}>Follow Quality</Text>
                    </Pressable>
                    <Pressable style={({ pressed }) => [styles.statCard, pressed && { backgroundColor: '#F2F2F7' }]}>
                      <View style={styles.statHeader}>
                        <View style={[styles.statIconWrap, { backgroundColor: 'rgba(59,130,246,0.1)' }]}><Users size={14} color="#3B82F6" strokeWidth={2} /></View>
                      </View>
                      <Text style={styles.statValue}>{creatorData?.followerCount ?? '--'}</Text>
                      <Text style={styles.statLabel}>Followers</Text>
                    </Pressable>
                    <Pressable style={({ pressed }) => [styles.statCard, pressed && { backgroundColor: '#F2F2F7' }]}>
                      <View style={styles.statHeader}>
                        <View style={[styles.statIconWrap, { backgroundColor: 'rgba(139,92,246,0.1)' }]}><Zap size={14} color="#8B5CF6" strokeWidth={2} /></View>
                      </View>
                      <Text style={styles.statValue}>{creatorData?.engagementRate ?? '--'}%</Text>
                      <Text style={styles.statLabel}>Eng. Rate</Text>
                    </Pressable>
                  </View>
                </View>
              </Animated.View>
            )}
          </ScrollView>
        )}

      </SafeAreaView>

      <DeleteModal
        visible={showDeleteModal}
        deleting={deleting}
        onConfirm={handleDeleteData}
        onCancel={() => setShowDeleteModal(false)}
      />

      {/* Info Modal */}
      <Modal visible={infoModal.visible} transparent animationType="fade" statusBarTranslucent>
        <TouchableWithoutFeedback onPress={() => setInfoModal((m) => ({ ...m, visible: false }))}>
          <View style={styles.infoOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.infoSheet}>
                <View style={styles.infoHandle} />
                <View style={styles.infoTitleRow}>
                  <View style={styles.infoIconWrap}>
                    <Info size={18} color={COLORS.primary} strokeWidth={2} />
                  </View>
                  <Text style={styles.infoTitle}>{infoModal.title}</Text>
                </View>
                <Text style={styles.infoBody}>{infoModal.body}</Text>
                {infoModal.breakdown && (
                  <View style={styles.breakdownContainer}>
                    {[
                      { icon: ThumbsUp,      color: "#EC4899", label: "Post Likes",         key: "postLikes" },
                      { icon: BarChart2,     color: "#F59E0B", label: "Poll Votes",          key: "pollVotes" },
                      { icon: HelpCircle,    color: "#3B82F6", label: "Questions Asked",     key: "questionsAsked" },
                      { icon: TrendingUp,    color: "#10B981", label: "Question Upvotes",    key: "questionUpvotes" },
                      { icon: Zap,           color: "#8B5CF6", label: "Challenge Actions",   key: "challengeActions" },
                      { icon: MessageSquare, color: "#6366F1", label: "Prompt Responses",    key: "promptResponses" },
                      { icon: Play,          color: "#0EA5E9", label: "Videos Watched",      key: "videosWatched" },
                      { icon: Share2,        color: "#14B8A6", label: "Content Shared",      key: "contentShared" },
                    ].filter((item) => (infoModal.breakdown[item.key] || 0) > 0).map((item) => (
                      <View key={item.key} style={styles.breakdownRow}>
                        <View style={[styles.breakdownIcon, { backgroundColor: item.color + "18" }]}>
                          <item.icon size={13} color={item.color} strokeWidth={2} />
                        </View>
                        <Text style={styles.breakdownLabel}>{item.label}</Text>
                        <Text style={styles.breakdownCount}>{infoModal.breakdown[item.key]}</Text>
                      </View>
                    ))}
                    {Object.values(infoModal.breakdown).every((v) => !v) && (
                      <Text style={styles.breakdownEmpty}>No content interactions recorded yet.</Text>
                    )}
                  </View>
                )}
                {infoModal.showTiers && (
                  <View style={styles.tiersList}>
                    {INFO_TIERS.map((item) => (
                      <View key={item.tier} style={styles.tierRow}>
                        <View style={[styles.tierRowBadgeContainer, { backgroundColor: item.color.bg, borderColor: item.color.border }]}>
                          <Text style={styles.tierRowBadge}>{item.badge}</Text>
                        </View>
                        <View style={styles.tierRowContent}>
                          <Text style={[styles.tierRowLabel, { color: item.color.text }]}>{item.label} (Tier {item.tier})</Text>
                          <Text style={styles.tierRowDesc}>{item.desc}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
                <TouchableOpacity
                  style={styles.infoCloseBtn}
                  activeOpacity={0.85}
                  onPress={() => setInfoModal((m) => ({ ...m, visible: false }))}
                >
                  <Text style={styles.infoCloseText}>Got it</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

// ── SponsorPrivacyScreen ──────────────────────────────────────────────────────

function SponsorPrivacyScreen({ navigation }) {
  const cacheKey = 'sponsor';
  const cachedData = dataCache[cacheKey];
  const cacheAge = cachedData ? Date.now() - dataCache.timestamps[cacheKey] : Infinity;
  const isCacheFresh = cacheAge < CACHE_DURATION;
  const hasCachedData = !!cachedData;

  const [summary, setSummary]   = useState(cachedData);
  const [loading, setLoading]   = useState(!hasCachedData);
  const fadeAnim = useRef(new Animated.Value(hasCachedData ? 1 : 0)).current;

  const loadData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const result = await getMyDataSummary();
      if (result?.success) {
        dataCache[cacheKey] = result.summary;
        dataCache.timestamps[cacheKey] = Date.now();
        setSummary(result.summary);
      }
    } catch (e) {
      console.error("[SponsorPrivacyScreen] load error:", e);
    } finally {
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  }, []);

  useEffect(() => {
    if (!isCacheFresh) {
      loadData(!hasCachedData);
    }
  }, [loadData, isCacheFresh, hasCachedData]);

  const handleSponsorAcknowledge = async () => {
    try {
      await updateConsent({ brandDataAcknowledged: true });
      const updated = {
        ...summary,
        brandDataAcknowledged: true,
        consentState: { ...summary?.consentState, brandDataAcknowledged: true },
      };
      setSummary(updated);
      dataCache[cacheKey] = updated;
    } catch (e) {
      console.error("[SponsorPrivacyScreen] ack error:", e);
    }
  };

  const sponsorAcknowledged = summary?.brandDataAcknowledged ?? summary?.consentState?.brandDataAcknowledged ?? false;

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={["#F8FAFC", "#F1F5F9", "#E2E8F0"]} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color="#4B5563" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Activity</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim }}>
            {!sponsorAcknowledged && (
              <View style={styles.sponsorBanner}>
                <ShieldCheck size={28} color="#8B5CF6" strokeWidth={1.5} />
                <Text style={styles.sponsorBannerTitle}>Acknowledge data usage to continue</Text>
                <Text style={styles.sponsorBannerBody}>
                  The audience insights you access are built from aggregated, anonymised behavioral data. You are seeing group-level patterns — not individual user profiles.{"\n\n"}By tapping below, you agree to:
                </Text>
                {SPONSOR_BULLETS.map((b, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <CheckCircle size={14} color="#8B5CF6" strokeWidth={2} />
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
                <TouchableOpacity style={styles.sponsorAckBtn} activeOpacity={0.85} onPress={handleSponsorAcknowledge}>
                  <LinearGradient colors={["#7C3AED", "#6D28D9"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sponsorAckGradient}>
                    <Text style={styles.sponsorAckText}>I understand and agree</Text>
                    <ChevronRight size={18} color="#FFF" strokeWidth={2.5} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Campaign Activity</Text>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <View style={[styles.statIconWrap, { backgroundColor: "rgba(139,92,246,0.1)" }]}><BarChart2 size={14} color="#8B5CF6" strokeWidth={2} /></View>
                  </View>
                  <Text style={styles.statValue}>{summary?.campaignCount || 0}</Text>
                  <Text style={styles.statLabel}>Campaigns</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <View style={[styles.statIconWrap, { backgroundColor: "rgba(59,130,246,0.1)" }]}><Users size={14} color="#3B82F6" strokeWidth={2} /></View>
                  </View>
                  <Text style={styles.statValue}>{summary?.matchedCreators || 0}</Text>
                  <Text style={styles.statLabel}>Matches</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <View style={[styles.statIconWrap, { backgroundColor: "rgba(16,185,129,0.1)" }]}><ShieldCheck size={14} color="#10B981" strokeWidth={2} /></View>
                  </View>
                  <Text style={styles.statValue}>{sponsorAcknowledged ? "✓" : "–"}</Text>
                  <Text style={styles.statLabel}>Acknowledged</Text>
                </View>
              </View>
            </View>

            <View style={[styles.section, { marginBottom: 40 }]}>
              <View style={styles.dataUsageCard}>
                <Text style={styles.dataUsageTitle}>Data Usage Reminder</Text>
                <Text style={styles.dataUsageBody}>
                  All audience data shown to you is aggregated and anonymised. Individual users cannot be identified from match reports. Your agreement to responsible use is logged and timestamped.
                </Text>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ── CommunityPrivacyScreen ────────────────────────────────────────────────────

function CommunityPrivacyScreen({ navigation }) {
  const cacheKey = 'community';
  const cachedData = dataCache[cacheKey];
  const cacheAge = cachedData ? Date.now() - dataCache.timestamps[cacheKey] : Infinity;
  const isCacheFresh = cacheAge < CACHE_DURATION;
  const hasCachedData = !!cachedData;

  const [data, setData]           = useState(cachedData);
  const [loading, setLoading]     = useState(!hasCachedData);
  const [consents, setConsents]   = useState(() => {
    const cached = cachedData;
    return {
      behavioral: cached?.consentState?.behavioral ?? false,
      brand: cached?.consentState?.brand ?? false,
      dataSharing: cached?.consentState?.dataSharing ?? false,
      eventAudienceIntelligence: cached?.consentState?.eventAudienceIntelligence ?? false,
    };
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const fadeAnim = useRef(new Animated.Value(hasCachedData ? 1 : 0)).current;

  const loadData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const result = await getCommunityDataSummary();
      if (result?.success) {
        dataCache[cacheKey] = result;
        dataCache.timestamps[cacheKey] = Date.now();

        setData(result);
        setConsents({
          behavioral: result.consentState?.behavioral ?? false,
          brand: result.consentState?.brand ?? false,
          dataSharing: result.consentState?.dataSharing ?? false,
          eventAudienceIntelligence: result.consentState?.eventAudienceIntelligence ?? false,
        });
      }
    } catch (e) {
      console.error("[CommunityPrivacyScreen] load error:", e);
    } finally {
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  }, []);

  useEffect(() => {
    if (!isCacheFresh) {
      loadData(!hasCachedData);
    }
  }, [loadData, isCacheFresh, hasCachedData]);

  // Fix B: Optimistic update with explicit previousValue capture for safe revert.
  // Fix C: updateConsent in api/privacy.js normalises field names — no silent drops.
  const handleToggle = async (field, apiField) => {
    const previousValue = consents[field];
    const newVal = !previousValue;

    console.log('[CommunityPrivacy] Toggle fired:', apiField, '→', newVal);
    setConsents((prev) => ({ ...prev, [field]: newVal })); // optimistic

    if (dataCache[cacheKey]) {
      if (!dataCache[cacheKey].consentState) dataCache[cacheKey].consentState = {};
      dataCache[cacheKey].consentState[field] = newVal;
    }

    try {
      console.log('[CommunityPrivacy] Calling updateConsent...');
      await updateConsent({ [apiField]: newVal });
      console.log('[CommunityPrivacy] updateConsent resolved ✅');
    } catch (err) {
      console.error('[CommunityPrivacy] updateConsent failed — reverting:', err?.message, 'status:', err?.status);
      setConsents((prev) => ({ ...prev, [field]: previousValue }));
      if (dataCache[cacheKey] && dataCache[cacheKey].consentState) {
        dataCache[cacheKey].consentState[field] = previousValue;
      }
    }
  };

  const handleDeleteData = async () => {
    setDeleting(true);
    try {
      const result = await requestDataDeletion();
      if (result?.success) {
        dataCache[cacheKey] = null;
        dataCache.timestamps[cacheKey] = 0;

        setShowDeleteModal(false);
        loadData(true);
      }
    } catch (e) {
      console.error("[CommunityPrivacyScreen] deletion error:", e);
    } finally { setDeleting(false); }
  };

  const health = HEALTH_CONFIG[data?.healthScore?.healthStatus] || HEALTH_CONFIG.healthy;
  const HealthIcon = health.Icon;

  const joinDate = data?.joinedAt
    ? new Date(data.joinedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "Unknown";

  const accountAge = data?.joinedAt
    ? Math.floor((Date.now() - new Date(data.joinedAt).getTime()) / 86400000)
    : 0;

  const eventsHosted     = data?.eventsHosted     || 0;
  const memberCount      = data?.memberCount       || 0;
  const contentPublished = data?.contentPublished  || 0;
  const topCategories    = data?.topCategories     || [];

  const dataDescription =
    eventsHosted === 0
      ? `No events hosted yet · ${memberCount} member${memberCount !== 1 ? "s" : ""} · ${contentPublished} piece${contentPublished !== 1 ? "s" : ""} of content`
      : `${eventsHosted} event${eventsHosted !== 1 ? "s" : ""} hosted · ${memberCount} member${memberCount !== 1 ? "s" : ""} · ${contentPublished} piece${contentPublished !== 1 ? "s" : ""} of content`;

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={["#F8FAFC", "#F1F5F9", "#E2E8F0"]} style={StyleSheet.absoluteFillObject} />
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <LinearGradient colors={["#DDD6FE", "#F5F3FF"]} style={styles.glowOrb1} />
        <LinearGradient colors={["#BFDBFE", "#EFF6FF"]} style={styles.glowOrb2} />
      </View>
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(255,255,255,0.5)" }]} pointerEvents="none" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color="#4B5563" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Activity</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim }}>

            {/* Section 1 — Community Health */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Community Health</Text>
              <View style={[styles.healthCard, { backgroundColor: health.bg, borderColor: health.border }]}>
                <View style={[styles.healthIconWrap, { backgroundColor: health.color + "18" }]}>
                  <HealthIcon size={22} color={health.color} strokeWidth={1.8} />
                </View>
                <View style={styles.healthInfo}>
                  <Text style={[styles.healthLabel, { color: health.color }]}>{health.label}</Text>
                  <Text style={styles.healthMessage}>{health.message}</Text>
                  <Text style={styles.healthSubtext}>{health.subtext}</Text>
                </View>
              </View>
            </View>

            {/* Section 2 — Community Data */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Community Data</Text>
              <View style={styles.statsRow}>

                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <View style={[styles.statIconWrap, { backgroundColor: "rgba(245,158,11,0.1)" }]}><Ticket size={14} color="#F59E0B" strokeWidth={2} /></View>
                  </View>
                  <Text style={styles.statValue}>{eventsHosted}</Text>
                  <Text style={styles.statLabel}>Events Hosted</Text>
                </View>

                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <View style={[styles.statIconWrap, { backgroundColor: "rgba(59,130,246,0.1)" }]}><Users size={14} color="#3B82F6" strokeWidth={2} /></View>
                  </View>
                  <Text style={styles.statValue}>{memberCount}</Text>
                  <Text style={styles.statLabel}>Members</Text>
                </View>

                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <View style={[styles.statIconWrap, { backgroundColor: "rgba(139,92,246,0.1)" }]}><FileText size={14} color="#8B5CF6" strokeWidth={2} /></View>
                  </View>
                  <Text style={styles.statValue}>{contentPublished}</Text>
                  <Text style={styles.statLabel}>Posts & Videos</Text>
                </View>

                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <View style={[styles.statIconWrap, { backgroundColor: "rgba(16,185,129,0.1)" }]}><CalendarDays size={14} color="#10B981" strokeWidth={2} /></View>
                  </View>
                  <Text style={styles.statValue}>{accountAge}d</Text>
                  <Text style={styles.statLabel}>Since {joinDate}</Text>
                </View>

              </View>
              <Text style={styles.positiveFrame}>{dataDescription}</Text>
            </View>

            {/* Section 3 — Event Focus Areas */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Event Focus Areas</Text>
              {topCategories.length > 0 ? (
                <>
                  <Text style={styles.sectionMeta}>
                    Based on your {eventsHosted} hosted event{eventsHosted !== 1 ? "s" : ""}
                  </Text>
                  <View style={styles.chipRow}>
                    {topCategories.map((cat, i) => (
                      <View key={i} style={styles.chip}>
                        <Text style={styles.chipText}>{cat.category}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <Text style={styles.interestPlaceholder}>
                  Host events to see your community's focus areas.
                </Text>
              )}
            </View>

            {/* Section 4 — Privacy Controls */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Privacy Controls</Text>
              <View style={styles.controlsCard}>
                {COMMUNITY_TOGGLES.map((t, i) => (
                  <React.Fragment key={t.field}>
                    {i > 0 && <View style={styles.separator} />}
                    <ToggleRow
                      icon={t.icon} iconColor={t.iconColor}
                      title={t.title} description={t.description}
                      active={consents[t.field]}
                      onToggle={() => handleToggle(t.field, t.apiField)}
                    />
                  </React.Fragment>
                ))}
              </View>
            </View>

            {/* Section 5 — Delete */}
            <View style={[styles.section, { marginBottom: 40 }]}>
              <TouchableOpacity style={styles.deleteButton} activeOpacity={0.8} onPress={() => setShowDeleteModal(true)}>
                <Trash2 size={18} color="#EF4444" strokeWidth={1.8} />
                <Text style={styles.deleteText}>Delete My Behavioral Data</Text>
              </TouchableOpacity>
            </View>

          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      <DeleteModal
        visible={showDeleteModal}
        deleting={deleting}
        onConfirm={handleDeleteData}
        onCancel={() => setShowDeleteModal(false)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  safeArea: { flex: 1 },
  glowOrb1: { position: "absolute", top: -width * 0.3, left: -width * 0.3, width: width * 0.9, height: width * 0.9, borderRadius: width * 0.45, opacity: 0.6 },
  glowOrb2: { position: "absolute", bottom: -width * 0.2, right: -width * 0.3, width: width * 1.1, height: width * 1.1, borderRadius: width * 0.55, opacity: 0.5 },
  headerBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.04)" },
  headerTitle: { fontSize: 17, fontFamily: FONTS.semiBold, color: "#111827" },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 18, fontFamily: FONTS.primary, color: "#1F2937", marginBottom: 10 },
  sectionMeta: { fontSize: 13, fontFamily: FONTS.medium, color: "#6B7280", marginBottom: 12 },
  // Tier
  tierCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 14, borderWidth: 1, gap: 14, marginBottom: 10, overflow: 'hidden' },
  tierBadge: { fontSize: 32 },
  tierInfo: { flex: 1, gap: 4 },
  tierLabel: { fontSize: 18, fontFamily: FONTS.semiBold },
  trajectoryRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  trajectoryText: { fontSize: 13, fontFamily: FONTS.medium },
  tierExplanation: { fontSize: 14, fontFamily: FONTS.regular, color: "#4B5563", lineHeight: 20 },
  tiersList: { gap: 14, marginBottom: 20 },
  tierRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  tierRowBadgeContainer: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  tierRowBadge: { fontSize: 18 },
  tierRowContent: { flex: 1, gap: 2 },
  tierRowLabel: { fontSize: 14, fontFamily: FONTS.semiBold },
  tierRowDesc: { fontSize: 13, fontFamily: FONTS.regular, color: "#4B5563", lineHeight: 18 },
  // Community Health
  healthCard: { flexDirection: "row", alignItems: "flex-start", padding: 16, borderRadius: 16, borderWidth: 1, gap: 14 },
  healthIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  healthInfo: { flex: 1, gap: 4 },
  healthLabel: { fontSize: 16, fontFamily: FONTS.semiBold },
  healthMessage: { fontSize: 14, fontFamily: FONTS.medium, color: "#374151", lineHeight: 20 },
  healthSubtext: { fontSize: 13, fontFamily: FONTS.regular, color: "#6B7280", lineHeight: 18 },
  // Stats
  statsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 16 },
  statCard: { width: "48%", backgroundColor: "#FFFFFF", borderRadius: 20, padding: 14, alignItems: "flex-start", gap: 8, borderWidth: 1, borderColor: "rgba(0,0,0,0.03)", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2, overflow: 'hidden' },
  statHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 2 },
  statIconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 22, fontFamily: FONTS.semiBold, color: "#111827" },
  statLabel: { fontSize: 11, fontFamily: FONTS.medium, color: "#6B7280" },
  positiveFrame: { fontSize: 14, fontFamily: FONTS.regular, color: "#4B5563", lineHeight: 20 },
  // Info Modal
  infoOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  infoSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36, borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" },
  infoHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", alignSelf: "center", marginBottom: 20 },
  infoTitleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  infoIconWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(41, 98, 255, 0.1)", alignItems: "center", justifyContent: "center" },
  infoTitle: { fontSize: 17, fontFamily: FONTS.semiBold, color: "#111827", flex: 1 },
  infoBody: { fontSize: 14, fontFamily: FONTS.regular, color: "#4B5563", lineHeight: 22, marginBottom: 16 },
  breakdownContainer: { backgroundColor: "rgba(0,0,0,0.02)", borderRadius: 16, padding: 14, gap: 10, marginBottom: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.04)" },
  breakdownRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  breakdownIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  breakdownLabel: { flex: 1, fontSize: 13, fontFamily: FONTS.medium, color: "#374151" },
  breakdownCount: { fontSize: 14, fontFamily: FONTS.semiBold, color: "#111827" },
  breakdownEmpty: { fontSize: 13, fontFamily: FONTS.regular, color: "#9CA3AF", textAlign: "center", paddingVertical: 8 },
  infoCloseBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  infoCloseText: { fontSize: 16, fontFamily: FONTS.semiBold, color: "#FFFFFF" },
  // Chips
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: "rgba(139,92,246,0.08)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: "rgba(139,92,246,0.15)" },
  chipText: { fontSize: 13, fontFamily: FONTS.medium, color: "#7C3AED" },
  interestPlaceholder: { fontSize: 14, fontFamily: FONTS.regular, color: "#9CA3AF", lineHeight: 20, fontStyle: "italic" },
  // Toggles
  controlsCard: { backgroundColor: "#FFFFFF", borderRadius: 24, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(0,0,0,0.03)", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  toggleRow: { flexDirection: "row", alignItems: "center", padding: 16 },
  toggleIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginRight: 14 },
  toggleInfo: { flex: 1, gap: 2 },
  toggleTitle: { fontSize: 15, fontFamily: FONTS.semiBold, color: "#111827" },
  toggleDescription: { fontSize: 13, fontFamily: FONTS.regular, color: "#6B7280", lineHeight: 18 },
  separator: { height: 1, backgroundColor: "#F3F4F6", marginHorizontal: 16 },
  toggle: { width: 44, height: 26, borderRadius: 13, padding: 3, justifyContent: "center", marginLeft: 12 },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  // Delete
  deleteButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "rgba(239,68,68,0.06)", borderRadius: 14, paddingVertical: 16, borderWidth: 1, borderColor: "rgba(239,68,68,0.15)" },
  deleteText: { fontSize: 16, fontFamily: FONTS.semiBold, color: "#DC2626" },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: 32 },
  modalContent: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24, width: "100%", alignItems: "center", borderWidth: 1, borderColor: "rgba(0,0,0,0.05)", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  modalIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(239,68,68,0.1)", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: FONTS.semiBold, color: "#111827", marginBottom: 10, textAlign: "center" },
  modalBody: { fontSize: 14, fontFamily: FONTS.regular, color: "#4B5563", lineHeight: 20, textAlign: "center", marginBottom: 24 },
  modalActions: { flexDirection: "row", gap: 12, width: "100%" },
  modalCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "rgba(0,0,0,0.03)", borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" },
  modalCancelText: { fontSize: 16, fontFamily: FONTS.semiBold, color: "#4B5563" },
  modalConfirm: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "rgba(239,68,68,0.1)", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
  modalConfirmText: { fontSize: 16, fontFamily: FONTS.semiBold, color: "#DC2626" },
  // Sponsor
  sponsorBanner: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: "rgba(139,92,246,0.15)", gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
  sponsorBannerTitle: { fontSize: 17, fontFamily: FONTS.semiBold, color: "#111827", textAlign: "center" },
  sponsorBannerBody: { fontSize: 14, fontFamily: FONTS.regular, color: "#4B5563", lineHeight: 22 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bulletText: { flex: 1, fontSize: 14, fontFamily: FONTS.regular, color: "#374151", lineHeight: 22 },
  sponsorAckBtn: { borderRadius: 14, overflow: "hidden", marginTop: 4 },
  sponsorAckGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 8 },
  sponsorAckText: { fontSize: 16, fontFamily: FONTS.semiBold, color: "#FFFFFF" },
  dataUsageCard: { backgroundColor: "rgba(139,92,246,0.06)", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "rgba(139,92,246,0.12)" },
  dataUsageTitle: { fontSize: 15, fontFamily: FONTS.semiBold, color: "#6D28D9", marginBottom: 8 },
  dataUsageBody: { fontSize: 14, fontFamily: FONTS.regular, color: "#4B5563", lineHeight: 22 },
  // AQI Driver cards
  driverCard: {
    borderRadius: 16, borderWidth: 1, padding: 14,
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
  },
  driverCardPositive: {
    borderColor: COLORS.success + "30",
    backgroundColor: COLORS.success + "06",
  },
  driverCardNegative: {
    borderColor: "rgba(245,158,11,0.3)",
    backgroundColor: "rgba(245,158,11,0.05)",
  },
  driverRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  driverIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  driverContent: { flex: 1, gap: 2 },
  driverLabel: { fontSize: 14, fontFamily: FONTS.semiBold, color: "#111827" },
  driverDetail: { fontSize: 13, fontFamily: FONTS.regular, color: "#4B5563", lineHeight: 18 },
  // Improvements section
  improvementsCard: {
    backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1,
    borderColor: "rgba(41,98,255,0.08)",
    paddingVertical: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03, shadowRadius: 10, elevation: 2,
  },
  improvementRow: {
    flexDirection: "row", alignItems: "flex-start",
    gap: 10, padding: 14,
  },
  improvementDivider: { borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  improvementBulletWrap: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.primary + "12",
    alignItems: "center", justifyContent: "center",
    marginTop: 1,
  },
  improvementText: {
    flex: 1, fontSize: 14, fontFamily: FONTS.regular,
    color: "#374151", lineHeight: 20,
  },
});

// ── Tab bar styles (Personal / Creator) ──────────────────────────────────────

const tabStyles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 4,
    marginTop: 4,
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabItemActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabLabel: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: "#9CA3AF",
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    color: "#7C3AED",
  },

  // Creator placeholder
  placeholderWrap: {
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  comingSoonCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  comingSoonIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#F5F0FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  comingSoonTitle: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 22,
    color: "#111827",
    marginBottom: 10,
    textAlign: "center",
  },
  comingSoonSub: {
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  featureList: {
    width: "100%",
    gap: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureLabel: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: "#111827",
    marginBottom: 2,
  },
  featureSub: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 16,
  },

  // Live score card
  scoreCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  scoreCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F5F0FF",
    borderWidth: 2,
    borderColor: "#DDD6FE",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  scoreValue: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 22,
    color: "#7C3AED",
    lineHeight: 26,
  },
  scoreMax: {
    fontFamily: "Manrope-Regular",
    fontSize: 10,
    color: "#9CA3AF",
    lineHeight: 12,
  },
  scoreSub: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 19,
    flex: 1,
  },

  reachRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  reachLabel: {
    fontFamily: "Manrope-Medium",
    fontSize: 14,
    color: "#374151",
    textTransform: "capitalize",
  },
  reachVal: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: "#111827",
  },
});

export default MyDataScreen;
