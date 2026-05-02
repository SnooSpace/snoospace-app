/**
 * MyDataScreen
 *
 * Privacy transparency screen — accessible from Settings → Privacy → "See My Data".
 * Shows a plain-language view of what SnooSpace knows about the user.
 * Powered by GET /privacy/my-data-summary.
 *
 * Typography: BasicCommercial-Black (page title only), Manrope hierarchy for rest.
 * Icons: All from lucide-react-native.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Animated,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import LottieView from "lottie-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Handshake,
  Users,
  Trash2,
  Eye,
  Heart,
  Activity,
  Zap,
  ShieldCheck,
  Calendar,
} from "lucide-react-native";
import { FONTS, COLORS } from "../../constants/theme";
import { getMyDataSummary, updateConsent, requestDataDeletion } from "../../api/privacy";
import loadingAnimation from "../../assets/animations/loading.json";

const { width } = Dimensions.get("window");

const TIER_COLORS = {
  1: { bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.2)", text: "#D97706" },
  2: { bg: "rgba(59, 130, 246, 0.1)", border: "rgba(59, 130, 246, 0.2)", text: "#2563EB" },
  3: { bg: "rgba(107, 114, 128, 0.1)", border: "rgba(107, 114, 128, 0.2)", text: "#4B5563" },
  4: { bg: "rgba(156, 163, 175, 0.1)", border: "rgba(156, 163, 175, 0.2)", text: "#6B7280" },
};

const TRAJECTORY_CONFIG = {
  rising: { icon: TrendingUp, color: "#10B981", label: "Rising" },
  declining: { icon: TrendingDown, color: "#EF4444", label: "Declining" },
  stable: { icon: Minus, color: "#6B7280", label: "Stable" },
};

const MyDataScreen = ({ navigation }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [consents, setConsents] = useState({ behavioral: false, brand: false, dataSharing: false });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    try {
      const result = await getMyDataSummary();
      if (result?.success) {
        setSummary(result.summary);
        setConsents(result.summary.consentState || {});
      }
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
    try {
      await updateConsent({ [apiField]: newVal });
    } catch (e) {
      setConsents((prev) => ({ ...prev, [field]: !newVal }));
    }
  };

  const handleDeleteData = async () => {
    setDeleting(true);
    try {
      const result = await requestDataDeletion();
      if (result?.success) {
        setShowDeleteModal(false);
        setConsents({ behavioral: false, brand: false, dataSharing: false });
        loadData();
      }
    } catch (e) {
      console.error("[MyDataScreen] deletion error:", e);
    } finally {
      setDeleting(false);
    }
  };

  const accountAge = summary?.accountCreatedAt
    ? Math.floor((Date.now() - new Date(summary.accountCreatedAt).getTime()) / (86400000))
    : 0;

  const tierColor = TIER_COLORS[summary?.aqiTier || 4];
  const trajectory = TRAJECTORY_CONFIG[summary?.trajectory || "stable"];
  const TrajectoryIcon = trajectory.icon;

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <StatusBar barStyle="dark-content" />
        <LinearGradient colors={["#F8FAFC", "#F1F5F9", "#E2E8F0"]} style={StyleSheet.absoluteFillObject} />
        <LottieView
          source={loadingAnimation}
          autoPlay
          loop
          style={{ width: 140, height: 140 }}
        />
      </View>
    );
  }

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
        {/* Header */}
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color="#4B5563" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Privacy</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* Tier Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Audience Tier</Text>
              <View style={[styles.tierCard, { backgroundColor: tierColor.bg, borderColor: tierColor.border }]}>
                <Text style={styles.tierBadge}>{summary?.tierBadge || "👻"}</Text>
                <View style={styles.tierInfo}>
                  <Text style={[styles.tierLabel, { color: tierColor.text }]}>{summary?.tierLabel || "Unknown"}</Text>
                  <View style={styles.trajectoryRow}>
                    <TrajectoryIcon size={14} color={trajectory.color} strokeWidth={2} />
                    <Text style={[styles.trajectoryText, { color: trajectory.color }]}>{trajectory.label}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.tierExplanation}>{summary?.tierExplanation || ""}</Text>
            </View>

            {/* Interests */}
            {summary?.topInterests?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Your Top Interests</Text>
                <Text style={styles.sectionMeta}>
                  Based on your last {summary?.behaviorEventCount || 0} interactions
                </Text>
                <View style={styles.chipRow}>
                  {summary.topInterests.map((interest, i) => (
                    <View key={i} style={styles.chip}>
                      <Text style={styles.chipText}>{interest}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Your Data */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Data</Text>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <View style={[styles.statIconWrap, { backgroundColor: "rgba(139, 92, 246, 0.1)" }]}>
                      <Zap size={14} color="#8B5CF6" strokeWidth={2} />
                    </View>
                  </View>
                  <Text style={styles.statValue}>{summary?.behaviorEventCount || 0}</Text>
                  <Text style={styles.statLabel}>Interactions</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <View style={[styles.statIconWrap, { backgroundColor: "rgba(236, 72, 153, 0.1)" }]}>
                      <ShieldCheck size={14} color="#EC4899" strokeWidth={2} />
                    </View>
                  </View>
                  <Text style={styles.statValue}>{summary?.followQualityPct || 0}%</Text>
                  <Text style={styles.statLabel}>Quality</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <View style={[styles.statIconWrap, { backgroundColor: "rgba(59, 130, 246, 0.1)" }]}>
                      <Calendar size={14} color="#3B82F6" strokeWidth={2} />
                    </View>
                  </View>
                  <Text style={styles.statValue}>{accountAge}d</Text>
                  <Text style={styles.statLabel}>Age</Text>
                </View>
              </View>
            </View>

            {/* Privacy Controls */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Privacy Controls</Text>
              <View style={styles.controlsCard}>
                <ToggleRow
                  icon={Sparkles} iconColor="#8B5CF6" 
                  title="Personalized Experience"
                  description="Customize content based on your activity"
                  active={consents.behavioral}
                  onToggle={() => handleToggle("behavioral", "behavioralTracking")}
                />
                <View style={styles.separator} />
                <ToggleRow
                  icon={Handshake} iconColor="#3B82F6" 
                  title="Brand Partnerships"
                  description="Share affinity data with brand partners"
                  active={consents.brand}
                  onToggle={() => handleToggle("brand", "brandTargeting")}
                />
                <View style={styles.separator} />
                <ToggleRow
                  icon={Users} iconColor="#10B981" 
                  title="Community Insights"
                  description="Contribute to anonymous community stats"
                  active={consents.dataSharing}
                  onToggle={() => handleToggle("dataSharing", "dataSharing")}
                />
              </View>
            </View>

            {/* Delete */}
            <View style={[styles.section, { marginBottom: 40 }]}>
              <TouchableOpacity
                style={styles.deleteButton}
                activeOpacity={0.8}
                onPress={() => setShowDeleteModal(true)}
              >
                <Trash2 size={18} color="#EF4444" strokeWidth={1.8} />
                <Text style={styles.deleteText}>Delete My Behavioral Data</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {/* Delete Confirmation Modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade" statusBarTranslucent>
        <TouchableWithoutFeedback onPress={() => !deleting && setShowDeleteModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalIconWrap}>
                  <Trash2 size={24} color="#EF4444" strokeWidth={1.8} />
                </View>
                <Text style={styles.modalTitle}>Delete Behavioral Data?</Text>
                <Text style={styles.modalBody}>
                  This will remove your personalized experience data including interest profiles,
                  engagement history, and audience scoring. Your account and posts stay intact.
                </Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancel}
                    onPress={() => setShowDeleteModal(false)}
                    disabled={deleting}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalConfirm}
                    onPress={handleDeleteData}
                    disabled={deleting}
                  >
                    <Text style={styles.modalConfirmText}>
                      {deleting ? "Deleting..." : "Delete Data"}
                    </Text>
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

// ── Toggle Row Component ─────────────────────────────────────────────────────

const ToggleRow = ({ icon: Icon, iconColor, title, description, active, onToggle }) => {
  const animatedValue = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: active ? 1 : 0,
      friction: 8,
      tension: 50,
      useNativeDriver: false,
    }).start();
  }, [active]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 18],
  });

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(0,0,0,0.08)", COLORS.primary],
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
      <Animated.View style={[styles.toggle, { backgroundColor }]}>
        <Animated.View style={[styles.toggleKnob, { transform: [{ translateX }] }]} />
      </Animated.View>
    </TouchableOpacity>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  safeArea: { flex: 1 },
  glowOrb1: {
    position: "absolute", top: -width * 0.3, left: -width * 0.3,
    width: width * 0.9, height: width * 0.9, borderRadius: width * 0.45, opacity: 0.6,
  },
  glowOrb2: {
    position: "absolute", bottom: -width * 0.2, right: -width * 0.3,
    width: width * 1.1, height: width * 1.1, borderRadius: width * 0.55, opacity: 0.5,
  },

  // Header
  headerBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  headerTitle: { fontSize: 17, fontFamily: FONTS.semiBold, color: "#111827" },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  // Sections
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 18, fontFamily: FONTS.primary, color: "#1F2937", marginBottom: 10 },
  sectionMeta: { fontSize: 13, fontFamily: FONTS.medium, color: "#6B7280", marginBottom: 12 },

  // Tier
  tierCard: {
    flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 14,
    borderWidth: 1, gap: 14, marginBottom: 10,
  },
  tierBadge: { fontSize: 32 },
  tierInfo: { flex: 1, gap: 4 },
  tierLabel: { fontSize: 18, fontFamily: FONTS.semiBold },
  trajectoryRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  trajectoryText: { fontSize: 13, fontFamily: FONTS.medium },
  tierExplanation: { fontSize: 14, fontFamily: FONTS.regular, color: "#4B5563", lineHeight: 20 },

  // Chips
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "rgba(139,92,246,0.08)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: "rgba(139,92,246,0.15)",
  },
  chipText: { fontSize: 13, fontFamily: FONTS.medium, color: "#7C3AED" },

  // Stats
  statsRow: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 14,
    alignItems: "flex-start", gap: 8, borderWidth: 1, borderColor: "rgba(0,0,0,0.03)",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2,
  },
  statHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 2 },
  statIconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 22, fontFamily: FONTS.semiBold, color: "#111827" },
  statLabel: { fontSize: 11, fontFamily: FONTS.medium, color: "#6B7280" },

  // Toggle rows
  controlsCard: {
    backgroundColor: "#FFFFFF", borderRadius: 24, paddingVertical: 8,
    borderWidth: 1, borderColor: "rgba(0,0,0,0.03)",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2,
  },
  toggleRow: {
    flexDirection: "row", alignItems: "center", padding: 16,
  },
  toggleIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginRight: 14 },
  toggleInfo: { flex: 1, gap: 2 },
  toggleTitle: { fontSize: 15, fontFamily: FONTS.semiBold, color: "#111827" },
  toggleDescription: { fontSize: 13, fontFamily: FONTS.regular, color: "#6B7280" },
  separator: { height: 1, backgroundColor: "#F3F4F6", marginHorizontal: 16 },
  toggle: {
    width: 44, height: 26, borderRadius: 13, padding: 3, justifyContent: "center", marginLeft: 12,
  },
  toggleKnob: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: "#FFFFFF",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2
  },

  // Delete
  deleteButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "rgba(239,68,68,0.06)", borderRadius: 14, paddingVertical: 16,
    borderWidth: 1, borderColor: "rgba(239,68,68,0.15)",
  },
  deleteText: { fontSize: 15, fontFamily: FONTS.semiBold, color: "#DC2626" },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: 32,
  },
  modalContent: {
    backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24, width: "100%",
    alignItems: "center", borderWidth: 1, borderColor: "rgba(0,0,0,0.05)", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10,
  },
  modalIconWrap: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(239,68,68,0.1)",
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontFamily: FONTS.semiBold, color: "#111827", marginBottom: 10, textAlign: "center" },
  modalBody: { fontSize: 14, fontFamily: FONTS.regular, color: "#4B5563", lineHeight: 20, textAlign: "center", marginBottom: 24 },
  modalActions: { flexDirection: "row", gap: 12, width: "100%" },
  modalCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.03)", borderWidth: 1, borderColor: "rgba(0,0,0,0.05)",
  },
  modalCancelText: { fontSize: 15, fontFamily: FONTS.semiBold, color: "#4B5563" },
  modalConfirm: {
    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.1)", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)",
  },
  modalConfirmText: { fontSize: 15, fontFamily: FONTS.semiBold, color: "#DC2626" },
});

export default MyDataScreen;
