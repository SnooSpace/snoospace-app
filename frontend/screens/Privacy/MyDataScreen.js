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
  ActivityIndicator,
} from "react-native";
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
} from "lucide-react-native";
import { FONTS } from "../../constants/theme";
import { getMyDataSummary, updateConsent, requestDataDeletion } from "../../api/privacy";

const { width } = Dimensions.get("window");

const TIER_COLORS = {
  1: { bg: "rgba(251, 191, 36, 0.15)", border: "rgba(251, 191, 36, 0.3)", text: "#FCD34D" },
  2: { bg: "rgba(96, 165, 250, 0.15)", border: "rgba(96, 165, 250, 0.3)", text: "#93C5FD" },
  3: { bg: "rgba(156, 163, 175, 0.15)", border: "rgba(156, 163, 175, 0.3)", text: "#D1D5DB" },
  4: { bg: "rgba(107, 114, 128, 0.12)", border: "rgba(107, 114, 128, 0.2)", text: "#9CA3AF" },
};

const TRAJECTORY_CONFIG = {
  rising: { icon: TrendingUp, color: "#34D399", label: "Rising" },
  declining: { icon: TrendingDown, color: "#F87171", label: "Declining" },
  stable: { icon: Minus, color: "#9CA3AF", label: "Stable" },
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
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={["#0B0F19", "#131628", "#0F172A"]} style={StyleSheet.absoluteFillObject} />
        <ActivityIndicator size="large" color="#A78BFA" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#0B0F19", "#131628", "#0F172A"]} style={StyleSheet.absoluteFillObject} />
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <LinearGradient colors={["#4C1D95", "#1E1B4B"]} style={styles.glowOrb1} />
        <LinearGradient colors={["#1E3A8A", "#0F172A"]} style={styles.glowOrb2} />
      </View>
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(10,15,25,0.6)" }]} pointerEvents="none" />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color="#D1D5DB" strokeWidth={2} />
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
                  <Activity size={18} color="#A78BFA" strokeWidth={1.8} />
                  <Text style={styles.statValue}>{summary?.behaviorEventCount || 0}</Text>
                  <Text style={styles.statLabel}>Interactions</Text>
                </View>
                <View style={styles.statCard}>
                  <Heart size={18} color="#F472B6" strokeWidth={1.8} />
                  <Text style={styles.statValue}>{summary?.followQualityPct || 0}%</Text>
                  <Text style={styles.statLabel}>Follow Quality</Text>
                </View>
                <View style={styles.statCard}>
                  <Eye size={18} color="#60A5FA" strokeWidth={1.8} />
                  <Text style={styles.statValue}>{accountAge}d</Text>
                  <Text style={styles.statLabel}>Account Age</Text>
                </View>
              </View>
              <Text style={styles.positiveFrame}>
                {summary?.behaviorEventCount > 0
                  ? `${summary.behaviorEventCount} interactions have helped personalize your experience.`
                  : "Start attending events and engaging to personalize your experience."}
              </Text>
            </View>

            {/* Privacy Controls */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Privacy Controls</Text>
              <ToggleRow
                icon={Sparkles} iconColor="#A78BFA" title="Personalized Experience"
                active={consents.behavioral}
                onToggle={() => handleToggle("behavioral", "behavioralTracking")}
              />
              <ToggleRow
                icon={Handshake} iconColor="#60A5FA" title="Brand Partnerships"
                active={consents.brand}
                onToggle={() => handleToggle("brand", "brandTargeting")}
              />
              <ToggleRow
                icon={Users} iconColor="#34D399" title="Community Insights"
                active={consents.dataSharing}
                onToggle={() => handleToggle("dataSharing", "dataSharing")}
              />
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

const ToggleRow = ({ icon: Icon, iconColor, title, active, onToggle }) => (
  <TouchableOpacity style={styles.toggleRow} activeOpacity={0.85} onPress={onToggle}>
    <View style={[styles.toggleIcon, { backgroundColor: iconColor + "20" }]}>
      <Icon size={18} color={iconColor} strokeWidth={1.8} />
    </View>
    <Text style={styles.toggleTitle}>{title}</Text>
    <View style={[styles.toggle, active && styles.toggleActive]}>
      <View style={[styles.toggleKnob, active && styles.toggleKnobActive]} />
    </View>
  </TouchableOpacity>
);

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0F19" },
  safeArea: { flex: 1 },
  glowOrb1: {
    position: "absolute", top: -width * 0.3, left: -width * 0.3,
    width: width * 0.9, height: width * 0.9, borderRadius: width * 0.45, opacity: 0.4,
  },
  glowOrb2: {
    position: "absolute", bottom: -width * 0.2, right: -width * 0.3,
    width: width * 1.1, height: width * 1.1, borderRadius: width * 0.55, opacity: 0.3,
  },

  // Header
  headerBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  headerTitle: { fontSize: 17, fontFamily: FONTS.semiBold, color: "#F9FAFB" },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  // Sections
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 18, fontFamily: FONTS.primary, color: "#E5E7EB", marginBottom: 10 },
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
  tierExplanation: { fontSize: 14, fontFamily: FONTS.regular, color: "#9CA3AF", lineHeight: 20 },

  // Chips
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "rgba(167,139,250,0.12)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: "rgba(167,139,250,0.2)",
  },
  chipText: { fontSize: 13, fontFamily: FONTS.medium, color: "#C4B5FD" },

  // Stats
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 14,
    alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  statValue: { fontSize: 20, fontFamily: FONTS.semiBold, color: "#F9FAFB" },
  statLabel: { fontSize: 11, fontFamily: FONTS.medium, color: "#6B7280" },
  positiveFrame: { fontSize: 14, fontFamily: FONTS.regular, color: "#9CA3AF", lineHeight: 20 },

  // Toggle rows
  toggleRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  toggleIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginRight: 12 },
  toggleTitle: { flex: 1, fontSize: 15, fontFamily: FONTS.semiBold, color: "#D1D5DB" },
  toggle: {
    width: 44, height: 26, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.1)", padding: 3, justifyContent: "center",
  },
  toggleActive: { backgroundColor: "#7C3AED" },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#6B7280", alignSelf: "flex-start" },
  toggleKnobActive: { backgroundColor: "#FFF", alignSelf: "flex-end" },

  // Delete
  deleteButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 14, paddingVertical: 16,
    borderWidth: 1, borderColor: "rgba(239,68,68,0.2)",
  },
  deleteText: { fontSize: 15, fontFamily: FONTS.semiBold, color: "#EF4444" },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 32,
  },
  modalContent: {
    backgroundColor: "#1F2937", borderRadius: 20, padding: 24, width: "100%",
    alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  modalIconWrap: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(239,68,68,0.12)",
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontFamily: FONTS.semiBold, color: "#F9FAFB", marginBottom: 10, textAlign: "center" },
  modalBody: { fontSize: 14, fontFamily: FONTS.regular, color: "#9CA3AF", lineHeight: 20, textAlign: "center", marginBottom: 24 },
  modalActions: { flexDirection: "row", gap: 12, width: "100%" },
  modalCancel: {
    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  modalCancelText: { fontSize: 15, fontFamily: FONTS.semiBold, color: "#D1D5DB" },
  modalConfirm: {
    flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.15)", borderWidth: 1, borderColor: "rgba(239,68,68,0.3)",
  },
  modalConfirmText: { fontSize: 15, fontFamily: FONTS.semiBold, color: "#EF4444" },
});

export default MyDataScreen;
