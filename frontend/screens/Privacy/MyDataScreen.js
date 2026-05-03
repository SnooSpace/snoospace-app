/**
 * MyDataScreen — Role-aware privacy transparency screen
 * member: personal AQI, interests, privacy controls, delete
 * community: same + event audience stats section
 * sponsor: brand summary + non-dismissable acknowledgment banner
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  StatusBar, Animated, ScrollView, Modal, TouchableWithoutFeedback,
} from "react-native";
import LottieView from "lottie-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus,
  Sparkles, Handshake, Users, Trash2, Zap,
  ShieldCheck, Calendar, BarChart2, CheckCircle,
  ChevronRight,
} from "lucide-react-native";
import { FONTS, COLORS } from "../../constants/theme";
import { getMyDataSummary, updateConsent, requestDataDeletion } from "../../api/privacy";
import { getActiveAccount } from "../../api/auth";
import loadingAnimation from "../../assets/animations/loading.json";

const { width } = Dimensions.get("window");

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

// Toggles per role ─────────────────────────────────────────────────────────────

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

const EVENT_AUDIENCE_TOGGLE = {
  icon: BarChart2, iconColor: "#F59E0B",
  title: "Event Audience Intelligence",
  description: "Let brands see aggregated quality reports of your event attendees",
  field: "eventAudienceIntelligence", apiField: "eventAudienceIntelligence",
};

const SPONSOR_BULLETS = [
  "Use match data only within SnooSpace for campaign planning",
  "Not attempt to re-identify individual users from aggregated reports",
  "Not share audience intelligence data with third parties outside SnooSpace",
];

// Main component ──────────────────────────────────────────────────────────────

const MyDataScreen = ({ navigation }) => {
  const [summary, setSummary]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [accountType, setAccountType]   = useState("member");
  const [consents, setConsents]         = useState({
    behavioral: false, brand: false, dataSharing: false, eventAudienceIntelligence: false,
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    try {
      const [result, account] = await Promise.all([getMyDataSummary(), getActiveAccount()]);
      if (result?.success) {
        setSummary(result.summary);
        setConsents({
          behavioral: result.summary.consentState?.behavioral ?? false,
          brand: result.summary.consentState?.brand ?? false,
          dataSharing: result.summary.consentState?.dataSharing ?? false,
          eventAudienceIntelligence: result.summary.consentState?.eventAudienceIntelligence ?? false,
        });
      }
      if (account?.type) setAccountType(account.type);
    } catch (e) {
      console.error("[MyDataScreen] load error:", e);
    } finally {
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggle = async (field, apiField) => {
    const newVal = !consents[field];
    setConsents((prev) => ({ ...prev, [field]: newVal }));
    if (apiField === "eventAudienceIntelligence") {
      try { await updateConsent({ eventAudienceIntelligence: newVal }); }
      catch (_) { setConsents((prev) => ({ ...prev, [field]: !newVal })); }
      return;
    }
    try { await updateConsent({ [apiField]: newVal }); }
    catch (_) { setConsents((prev) => ({ ...prev, [field]: !newVal })); }
  };

  const handleDeleteData = async () => {
    setDeleting(true);
    try {
      const result = await requestDataDeletion();
      if (result?.success) {
        setShowDeleteModal(false);
        loadData();
      }
    } catch (e) {
      console.error("[MyDataScreen] deletion error:", e);
    } finally { setDeleting(false); }
  };

  const handleSponsorAcknowledge = async () => {
    try {
      await updateConsent({ brandDataAcknowledged: true });
      setSummary((prev) => ({
        ...prev,
        brandDataAcknowledged: true,
        consentState: { ...prev?.consentState, brandDataAcknowledged: true },
      }));
    } catch (e) {
      console.error("[MyDataScreen] sponsor ack error:", e);
    }
  };

  const accountAge = summary?.accountCreatedAt
    ? Math.floor((Date.now() - new Date(summary.accountCreatedAt).getTime()) / 86400000)
    : 0;

  const tierColor  = TIER_COLORS[summary?.aqiTier || 4];
  const trajectory = TRAJECTORY_CONFIG[summary?.trajectory || "stable"];
  const TrajectoryIcon = trajectory.icon;
  
  const eventsAttended    = summary?.eventsAttended    || 0;
  const contentEngaged    = summary?.contentEngaged    || 0;
  const searchesPerformed = summary?.searchesPerformed || 0;
  const showInterests = (summary?.topInterests?.length > 0) && (eventsAttended + contentEngaged) >= 20;

  const dataDescription = eventsAttended === 0 && contentEngaged === 0
    ? "Start attending events and engaging with content to personalize your experience."
    : `${eventsAttended} events attended · ${contentEngaged} content interactions.`;

  const toggles = accountType === "community"
    ? [...MEMBER_TOGGLES, EVENT_AUDIENCE_TOGGLE]
    : MEMBER_TOGGLES;

  const sponsorAcknowledged = summary?.brandDataAcknowledged ?? summary?.consentState?.brandDataAcknowledged ?? false;

  // Loading state
  if (loading) {
    return (
      <View style={{ flex:1, backgroundColor:"#F8FAFC", justifyContent:"center", alignItems:"center" }}>
        <StatusBar barStyle="dark-content" />
        <LinearGradient colors={["#F8FAFC","#F1F5F9","#E2E8F0"]} style={StyleSheet.absoluteFillObject} />
        <LottieView source={loadingAnimation} autoPlay loop style={{ width:140, height:140 }} />
      </View>
    );
  }

  // ── Sponsor / Brand ──────────────────────────────────────────────────────
  if (accountType === "sponsor") {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <LinearGradient colors={["#F8FAFC","#F1F5F9","#E2E8F0"]} style={StyleSheet.absoluteFillObject} />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.headerBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
              <ArrowLeft size={22} color="#4B5563" strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Your Privacy</Text>
            <View style={{ width:40 }} />
          </View>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Animated.View style={{ opacity: fadeAnim }}>
              {/* Non-dismissable acknowledgment banner */}
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
                    <LinearGradient colors={["#7C3AED","#6D28D9"]} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.sponsorAckGradient}>
                      <Text style={styles.sponsorAckText}>I understand and agree</Text>
                      <ChevronRight size={18} color="#FFF" strokeWidth={2.5} />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* Campaign summary */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your Campaign Activity</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <View style={styles.statHeader}>
                      <View style={[styles.statIconWrap,{backgroundColor:"rgba(139,92,246,0.1)"}]}>
                        <BarChart2 size={14} color="#8B5CF6" strokeWidth={2} />
                      </View>
                    </View>
                    <Text style={styles.statValue}>{summary?.campaignCount || 0}</Text>
                    <Text style={styles.statLabel}>Campaigns</Text>
                  </View>
                  <View style={styles.statCard}>
                    <View style={styles.statHeader}>
                      <View style={[styles.statIconWrap,{backgroundColor:"rgba(59,130,246,0.1)"}]}>
                        <Users size={14} color="#3B82F6" strokeWidth={2} />
                      </View>
                    </View>
                    <Text style={styles.statValue}>{summary?.matchedCreators || 0}</Text>
                    <Text style={styles.statLabel}>Matches</Text>
                  </View>
                  <View style={styles.statCard}>
                    <View style={styles.statHeader}>
                      <View style={[styles.statIconWrap,{backgroundColor:"rgba(16,185,129,0.1)"}]}>
                        <ShieldCheck size={14} color="#10B981" strokeWidth={2} />
                      </View>
                    </View>
                    <Text style={styles.statValue}>{sponsorAcknowledged ? "✓" : "–"}</Text>
                    <Text style={styles.statLabel}>Acknowledged</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.section,{marginBottom:40}]}>
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

  // ── Member + Community ───────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={["#F8FAFC","#F1F5F9","#E2E8F0"]} style={StyleSheet.absoluteFillObject} />
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <LinearGradient colors={["#DDD6FE","#F5F3FF"]} style={styles.glowOrb1} />
        <LinearGradient colors={["#BFDBFE","#EFF6FF"]} style={styles.glowOrb2} />
      </View>
      <View style={[StyleSheet.absoluteFillObject,{backgroundColor:"rgba(255,255,255,0.5)"}]} pointerEvents="none" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color="#4B5563" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Privacy</Text>
          <View style={{ width:40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim }}>

            {/* Tier */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Audience Tier</Text>
              <View style={[styles.tierCard,{backgroundColor:tierColor.bg,borderColor:tierColor.border}]}>
                <Text style={styles.tierBadge}>{summary?.tierBadge || "👻"}</Text>
                <View style={styles.tierInfo}>
                  <Text style={[styles.tierLabel,{color:tierColor.text}]}>{summary?.tierLabel || "Unknown"}</Text>
                  <View style={styles.trajectoryRow}>
                    <TrajectoryIcon size={14} color={trajectory.color} strokeWidth={2} />
                    <Text style={[styles.trajectoryText,{color:trajectory.color}]}>{trajectory.label}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.tierExplanation}>{summary?.tierExplanation || ""}</Text>
            </View>

            {/* Your Data stats — 3 meaningful categories */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Data</Text>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <View style={styles.statHeader}><View style={[styles.statIconWrap,{backgroundColor:"rgba(245,158,11,0.1)"}]}><Calendar size={14} color="#F59E0B" strokeWidth={2} /></View></View>
                  <Text style={styles.statValue}>{eventsAttended}</Text>
                  <Text style={styles.statLabel}>Events</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={styles.statHeader}><View style={[styles.statIconWrap,{backgroundColor:"rgba(139,92,246,0.1)"}]}><Zap size={14} color="#8B5CF6" strokeWidth={2} /></View></View>
                  <Text style={styles.statValue}>{contentEngaged}</Text>
                  <Text style={styles.statLabel}>Content</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={styles.statHeader}><View style={[styles.statIconWrap,{backgroundColor:"rgba(59,130,246,0.1)"}]}><ShieldCheck size={14} color="#3B82F6" strokeWidth={2} /></View></View>
                  <Text style={styles.statValue}>{summary?.followQualityPct || 0}%</Text>
                  <Text style={styles.statLabel}>Quality</Text>
                </View>
              </View>
              <Text style={styles.positiveFrame}>{dataDescription}</Text>
            </View>

            {/* Top Interests */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Top Interests</Text>
              {showInterests ? (
                <>
                  <Text style={styles.sectionMeta}>Based on your last {eventCount} interactions</Text>
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

            {/* Community — Event Audience Stats */}
            {accountType === "community" && summary?.eventAudienceStats && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your Event Audience</Text>
                <Text style={styles.sectionMeta}>Aggregated quality profile of your followers</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <View style={styles.statHeader}><View style={[styles.statIconWrap,{backgroundColor:"rgba(245,158,11,0.1)"}]}><Users size={14} color="#F59E0B" strokeWidth={2} /></View></View>
                    <Text style={styles.statValue}>{summary.eventAudienceStats.totalFollowers || 0}</Text>
                    <Text style={styles.statLabel}>Followers</Text>
                  </View>
                  <View style={styles.statCard}>
                    <View style={styles.statHeader}><View style={[styles.statIconWrap,{backgroundColor:"rgba(16,185,129,0.1)"}]}><BarChart2 size={14} color="#10B981" strokeWidth={2} /></View></View>
                    <Text style={styles.statValue}>{summary.eventAudienceStats.followQualityScore || 0}%</Text>
                    <Text style={styles.statLabel}>Quality</Text>
                  </View>
                  <View style={styles.statCard}>
                    <View style={styles.statHeader}><View style={[styles.statIconWrap,{backgroundColor:"rgba(139,92,246,0.1)"}]}><Zap size={14} color="#8B5CF6" strokeWidth={2} /></View></View>
                    <Text style={styles.statValue}>{summary.eventAudienceStats.tier1Percentage || 0}%</Text>
                    <Text style={styles.statLabel}>Tier 1</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Privacy Controls */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Privacy Controls</Text>
              <View style={styles.controlsCard}>
                {toggles.map((t, i) => (
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

            {/* Delete */}
            <View style={[styles.section,{marginBottom:40}]}>
              <TouchableOpacity style={styles.deleteButton} activeOpacity={0.8} onPress={() => setShowDeleteModal(true)}>
                <Trash2 size={18} color="#EF4444" strokeWidth={1.8} />
                <Text style={styles.deleteText}>Delete My Behavioral Data</Text>
              </TouchableOpacity>
            </View>

          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {/* Delete Modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade" statusBarTranslucent>
        <TouchableWithoutFeedback onPress={() => !deleting && setShowDeleteModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalIconWrap}><Trash2 size={24} color="#EF4444" strokeWidth={1.8} /></View>
                <Text style={styles.modalTitle}>Delete Behavioral Data?</Text>
                <Text style={styles.modalBody}>
                  This will remove your interest profiles, engagement history, and audience scoring. Your account and posts stay intact.
                </Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalCancel} onPress={() => setShowDeleteModal(false)} disabled={deleting}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalConfirm} onPress={handleDeleteData} disabled={deleting}>
                    <Text style={styles.modalConfirmText}>{deleting ? "Deleting..." : "Delete Data"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:"#F8FAFC" },
  safeArea: { flex:1 },
  glowOrb1: { position:"absolute", top:-width*0.3, left:-width*0.3, width:width*0.9, height:width*0.9, borderRadius:width*0.45, opacity:0.6 },
  glowOrb2: { position:"absolute", bottom:-width*0.2, right:-width*0.3, width:width*1.1, height:width*1.1, borderRadius:width*0.55, opacity:0.5 },
  headerBar: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:16, paddingVertical:12 },
  backBtn: { width:40, height:40, borderRadius:20, alignItems:"center", justifyContent:"center", backgroundColor:"rgba(0,0,0,0.04)" },
  headerTitle: { fontSize:17, fontFamily:FONTS.semiBold, color:"#111827" },
  scrollContent: { paddingHorizontal:20, paddingTop:8, paddingBottom:40 },
  section: { marginBottom:28 },
  sectionTitle: { fontSize:18, fontFamily:FONTS.primary, color:"#1F2937", marginBottom:10 },
  sectionMeta: { fontSize:13, fontFamily:FONTS.medium, color:"#6B7280", marginBottom:12 },
  // Tier
  tierCard: { flexDirection:"row", alignItems:"center", padding:16, borderRadius:14, borderWidth:1, gap:14, marginBottom:10 },
  tierBadge: { fontSize:32 },
  tierInfo: { flex:1, gap:4 },
  tierLabel: { fontSize:18, fontFamily:FONTS.semiBold },
  trajectoryRow: { flexDirection:"row", alignItems:"center", gap:5 },
  trajectoryText: { fontSize:13, fontFamily:FONTS.medium },
  tierExplanation: { fontSize:14, fontFamily:FONTS.regular, color:"#4B5563", lineHeight:20 },
  // Stats
  statsRow: { flexDirection:"row", gap:8, marginBottom:12 },
  statCard: { flex:1, backgroundColor:"#FFFFFF", borderRadius:20, padding:14, alignItems:"flex-start", gap:8, borderWidth:1, borderColor:"rgba(0,0,0,0.03)", shadowColor:"#000", shadowOffset:{width:0,height:4}, shadowOpacity:0.03, shadowRadius:10, elevation:2 },
  statHeader: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", width:"100%", marginBottom:2 },
  statIconWrap: { width:30, height:30, borderRadius:15, alignItems:"center", justifyContent:"center" },
  statValue: { fontSize:22, fontFamily:FONTS.semiBold, color:"#111827" },
  statLabel: { fontSize:11, fontFamily:FONTS.medium, color:"#6B7280" },
  positiveFrame: { fontSize:14, fontFamily:FONTS.regular, color:"#4B5563", lineHeight:20 },
  // Chips
  chipRow: { flexDirection:"row", flexWrap:"wrap", gap:8 },
  chip: { backgroundColor:"rgba(139,92,246,0.08)", borderRadius:20, paddingHorizontal:14, paddingVertical:7, borderWidth:1, borderColor:"rgba(139,92,246,0.15)" },
  chipText: { fontSize:13, fontFamily:FONTS.medium, color:"#7C3AED" },
  interestPlaceholder: { fontSize:14, fontFamily:FONTS.regular, color:"#9CA3AF", lineHeight:20, fontStyle:"italic" },
  // Toggles
  controlsCard: { backgroundColor:"#FFFFFF", borderRadius:24, paddingVertical:8, borderWidth:1, borderColor:"rgba(0,0,0,0.03)", shadowColor:"#000", shadowOffset:{width:0,height:4}, shadowOpacity:0.03, shadowRadius:10, elevation:2 },
  toggleRow: { flexDirection:"row", alignItems:"center", padding:16 },
  toggleIcon: { width:44, height:44, borderRadius:22, alignItems:"center", justifyContent:"center", marginRight:14 },
  toggleInfo: { flex:1, gap:2 },
  toggleTitle: { fontSize:15, fontFamily:FONTS.semiBold, color:"#111827" },
  toggleDescription: { fontSize:13, fontFamily:FONTS.regular, color:"#6B7280", lineHeight:18 },
  separator: { height:1, backgroundColor:"#F3F4F6", marginHorizontal:16 },
  toggle: { width:44, height:26, borderRadius:13, padding:3, justifyContent:"center", marginLeft:12 },
  toggleKnob: { width:20, height:20, borderRadius:10, backgroundColor:"#FFFFFF", shadowColor:"#000", shadowOffset:{width:0,height:2}, shadowOpacity:0.1, shadowRadius:2, elevation:2 },
  // Delete
  deleteButton: { flexDirection:"row", alignItems:"center", justifyContent:"center", gap:10, backgroundColor:"rgba(239,68,68,0.06)", borderRadius:14, paddingVertical:16, borderWidth:1, borderColor:"rgba(239,68,68,0.15)" },
  deleteText: { fontSize:15, fontFamily:FONTS.semiBold, color:"#DC2626" },
  // Modal
  modalOverlay: { flex:1, backgroundColor:"rgba(0,0,0,0.4)", justifyContent:"center", alignItems:"center", padding:32 },
  modalContent: { backgroundColor:"#FFFFFF", borderRadius:20, padding:24, width:"100%", alignItems:"center", borderWidth:1, borderColor:"rgba(0,0,0,0.05)", shadowColor:"#000", shadowOffset:{width:0,height:10}, shadowOpacity:0.1, shadowRadius:20, elevation:10 },
  modalIconWrap: { width:52, height:52, borderRadius:26, backgroundColor:"rgba(239,68,68,0.1)", alignItems:"center", justifyContent:"center", marginBottom:16 },
  modalTitle: { fontSize:18, fontFamily:FONTS.semiBold, color:"#111827", marginBottom:10, textAlign:"center" },
  modalBody: { fontSize:14, fontFamily:FONTS.regular, color:"#4B5563", lineHeight:20, textAlign:"center", marginBottom:24 },
  modalActions: { flexDirection:"row", gap:12, width:"100%" },
  modalCancel: { flex:1, paddingVertical:14, borderRadius:12, alignItems:"center", backgroundColor:"rgba(0,0,0,0.03)", borderWidth:1, borderColor:"rgba(0,0,0,0.05)" },
  modalCancelText: { fontSize:15, fontFamily:FONTS.semiBold, color:"#4B5563" },
  modalConfirm: { flex:1, paddingVertical:14, borderRadius:12, alignItems:"center", backgroundColor:"rgba(239,68,68,0.1)", borderWidth:1, borderColor:"rgba(239,68,68,0.2)" },
  modalConfirmText: { fontSize:15, fontFamily:FONTS.semiBold, color:"#DC2626" },
  // Sponsor
  sponsorBanner: { backgroundColor:"#FFFFFF", borderRadius:20, padding:20, marginBottom:24, borderWidth:1, borderColor:"rgba(139,92,246,0.15)", gap:12, shadowColor:"#000", shadowOffset:{width:0,height:4}, shadowOpacity:0.05, shadowRadius:12, elevation:3 },
  sponsorBannerTitle: { fontSize:17, fontFamily:FONTS.semiBold, color:"#111827", textAlign:"center" },
  sponsorBannerBody: { fontSize:14, fontFamily:FONTS.regular, color:"#4B5563", lineHeight:22 },
  bulletRow: { flexDirection:"row", alignItems:"flex-start", gap:10 },
  bulletText: { flex:1, fontSize:14, fontFamily:FONTS.regular, color:"#374151", lineHeight:22 },
  sponsorAckBtn: { borderRadius:14, overflow:"hidden", marginTop:4 },
  sponsorAckGradient: { flexDirection:"row", alignItems:"center", justifyContent:"center", paddingVertical:16, gap:8 },
  sponsorAckText: { fontSize:16, fontFamily:FONTS.semiBold, color:"#FFFFFF" },
  dataUsageCard: { backgroundColor:"rgba(139,92,246,0.06)", borderRadius:16, padding:18, borderWidth:1, borderColor:"rgba(139,92,246,0.12)" },
  dataUsageTitle: { fontSize:15, fontFamily:FONTS.semiBold, color:"#6D28D9", marginBottom:8 },
  dataUsageBody: { fontSize:14, fontFamily:FONTS.regular, color:"#4B5563", lineHeight:22 },
});

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

export default MyDataScreen;
