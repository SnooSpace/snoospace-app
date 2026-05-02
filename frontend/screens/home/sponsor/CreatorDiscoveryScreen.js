import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  FlatList, Dimensions, Modal, Animated as RNAnimated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown } from "react-native-reanimated";
import Svg, { Polyline, Circle as SvgCircle, Text as SvgText } from "react-native-svg";
import {
  Search, SlidersHorizontal, ChevronDown, ChevronUp,
  Users, Target, BarChart3, TrendingUp, X, Handshake,
  ArrowUpDown,
} from "lucide-react-native";

import { COLORS, FONTS, SPACING } from "../../../constants/theme";
import { getBrandMatches } from "../../../api/audienceIntelligence";
import { getActiveAccount } from "../../../api/auth";
import SnooLoader from "../../../components/ui/SnooLoader";

const SCREEN_WIDTH = Dimensions.get("window").width;
const DARK_BG = "#0F0F1A";
const CARD_BG = "rgba(255,255,255,0.06)";
const CARD_BORDER = "rgba(255,255,255,0.10)";
const ACCENT_BLUE = "#4F8EF7";
const ACCENT_GREEN = "#34D399";
const ACCENT_AMBER = "#FBBF24";
const MUTED = "rgba(255,255,255,0.50)";
const SECONDARY = "rgba(255,255,255,0.70)";

// ── Filter Chips ──
const TIER_FILTERS = ["All tiers", "Tier 1 heavy", "Tier 1+2 balanced"];
const CATEGORY_FILTERS = ["All", "Fitness", "Tech", "Lifestyle", "Business", "Food", "Wellness"];
const SORT_OPTIONS = [
  { key: "match", label: "By Match Score" },
  { key: "reach", label: "By Quality Reach" },
  { key: "aqi", label: "By Audience Score" },
];

const FilterChip = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.filterChip, active && styles.filterChipActive]}
    onPress={onPress}
  >
    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

// ── Match Score Badge ──
const MatchBadge = ({ score }) => {
  const color = score >= 80 ? ACCENT_GREEN : score >= 60 ? ACCENT_AMBER : MUTED;
  const bg = score >= 80 ? "rgba(52,211,153,0.15)" : score >= 60 ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.06)";
  return (
    <View style={[styles.matchBadge, { backgroundColor: bg }]}>
      <Text style={[styles.matchScore, { color }]}>{Math.round(score)}</Text>
      <Text style={[styles.matchLabel, { color }]}>Brand Fit</Text>
    </View>
  );
};

// ── Creator Card ──
const CreatorCard = ({ match, onPress }) => {
  const [expanded, setExpanded] = useState(false);
  const qualityReach = (match.tier1_followers || 0) + (match.tier2_followers || 0);

  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <TouchableOpacity style={styles.creatorCard} onPress={() => onPress(match)} activeOpacity={0.85}>
        <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.creatorCardInner}>
          {/* Header row */}
          <View style={styles.creatorHeader}>
            <View style={styles.creatorAvatar}>
              <Text style={styles.avatarInitial}>
                {(match.creator_name || "?").charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.creatorInfo}>
              <Text style={styles.creatorName}>{match.creator_name || "Unknown"}</Text>
              <Text style={styles.creatorHandle}>@{match.creator_username || "—"}</Text>
            </View>
            <MatchBadge score={match.total_match_score || 0} />
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{qualityReach.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Quality Reach</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{Math.round(match.audience_buying_power_score || 0)}</Text>
              <Text style={styles.statLabel}>Audience Score</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{Math.round(match.follow_quality_score || 0)}%</Text>
              <Text style={styles.statLabel}>Content Follow</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, styles.statMuted]}>{match.total_followers || 0}</Text>
              <Text style={[styles.statLabel, styles.statMuted]}>Followers</Text>
            </View>
          </View>

          {/* Category chips */}
          {match.top_spending_categories && match.top_spending_categories.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
              {match.top_spending_categories.slice(0, 4).map((cat, i) => (
                <View key={i} style={styles.miniChip}>
                  <Text style={styles.miniChipText}>{typeof cat === "string" ? cat : cat.name}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Why this match? */}
          <TouchableOpacity style={styles.whyMatchRow} onPress={() => setExpanded(!expanded)}>
            <Text style={styles.whyMatchText}>Why this match?</Text>
            {expanded ? <ChevronUp size={14} color={MUTED} /> : <ChevronDown size={14} color={MUTED} />}
          </TouchableOpacity>

          {expanded && (
            <View style={styles.matchBreakdown}>
              <MatchBar label="AQI Density" value={match.audience_aqi_density_score || 0} />
              <MatchBar label="Category Fit" value={match.category_alignment_score || 0} />
              <MatchBar label="Geographic Fit" value={match.geographic_fit_score || 0} />
              <MatchBar label="Past Performance" value={match.past_performance_score || 0} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const MatchBar = ({ label, value }) => (
  <View style={styles.matchBarRow}>
    <Text style={styles.matchBarLabel}>{label}</Text>
    <View style={styles.matchBarBg}>
      <View style={[styles.matchBarFill, { width: `${Math.min(100, value)}%` }]} />
    </View>
    <Text style={styles.matchBarValue}>{Math.round(value)}</Text>
  </View>
);

// ── Detail Bottom Sheet ──
const CreatorDetailSheet = ({ visible, creator, onClose }) => {
  const slideAnim = useRef(new RNAnimated.Value(SCREEN_WIDTH)).current;

  useEffect(() => {
    if (visible) {
      RNAnimated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 4 }).start();
    } else {
      RNAnimated.timing(slideAnim, { toValue: SCREEN_WIDTH, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!creator) return null;

  const qualityReach = (creator.tier1_followers || 0) + (creator.tier2_followers || 0);
  const trend = creator.weekly_follow_quality_trend || [];

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <RNAnimated.View style={[styles.sheetContainer, { transform: [{ translateY: slideAnim }] }]}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.sheetInner}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.creatorAvatar}>
                <Text style={styles.avatarInitial}>{(creator.creator_name || "?").charAt(0)}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.sheetName}>{creator.creator_name}</Text>
                <Text style={styles.sheetHandle}>@{creator.creator_username}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.sheetClose}>
                <X size={20} color="white" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {/* Match score */}
              <View style={styles.sheetSection}>
                <Text style={styles.sheetSectionTitle}>Match Score</Text>
                <MatchBadge score={creator.total_match_score || 0} />
              </View>

              {/* Key stats */}
              <View style={styles.sheetStatsRow}>
                <View style={styles.sheetStat}>
                  <Text style={styles.sheetStatVal}>{qualityReach}</Text>
                  <Text style={styles.sheetStatLbl}>Quality Reach</Text>
                </View>
                <View style={styles.sheetStat}>
                  <Text style={styles.sheetStatVal}>{Math.round(creator.audience_buying_power_score || 0)}</Text>
                  <Text style={styles.sheetStatLbl}>Audience Score</Text>
                </View>
                <View style={styles.sheetStat}>
                  <Text style={styles.sheetStatVal}>{Math.round(creator.follow_quality_score || 0)}%</Text>
                  <Text style={styles.sheetStatLbl}>Content Follow</Text>
                </View>
              </View>

              {/* Match breakdown */}
              <View style={styles.sheetSection}>
                <Text style={styles.sheetSectionTitle}>Match Breakdown</Text>
                <MatchBar label="AQI Density" value={creator.audience_aqi_density_score || 0} />
                <MatchBar label="Category Fit" value={creator.category_alignment_score || 0} />
                <MatchBar label="Geographic Fit" value={creator.geographic_fit_score || 0} />
                <MatchBar label="Past Performance" value={creator.past_performance_score || 0} />
              </View>

              {/* Trend sparkline */}
              {trend.length >= 2 && (
                <View style={styles.sheetSection}>
                  <Text style={styles.sheetSectionTitle}>Follow Quality Trend</Text>
                  <View style={{ marginTop: 8 }}>
                    <Svg width={SCREEN_WIDTH - 80} height={60}>
                      <Polyline
                        points={trend.map((w, i) => {
                          const x = (i / (trend.length - 1)) * (SCREEN_WIDTH - 80);
                          const y = 50 - ((w.score || 0) / 100) * 40;
                          return `${x},${y}`;
                        }).join(" ")}
                        fill="none" stroke={ACCENT_GREEN} strokeWidth="2" strokeLinecap="round"
                      />
                    </Svg>
                  </View>
                </View>
              )}

              <View style={{ height: 24 }} />
            </ScrollView>

            {/* CTA */}
            <TouchableOpacity style={styles.ctaButton}>
              <LinearGradient colors={[ACCENT_BLUE, "#3B6FE8"]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <Handshake size={18} color="white" />
              <Text style={styles.ctaText}>Propose Collaboration</Text>
            </TouchableOpacity>
          </View>
        </RNAnimated.View>
      </View>
    </Modal>
  );
};

// ── Main Screen ──
export default function CreatorDiscoveryScreen({ navigation }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedTier, setSelectedTier] = useState("All tiers");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("match");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const fetchMatches = useCallback(async () => {
    try {
      setError(false);
      setLoading(true);
      const account = await getActiveAccount();
      if (!account?.id) { setLoading(false); setError(true); return; }
      // Use a default campaign_id of 0 for discovery browsing
      const response = await getBrandMatches(account.id, 0);
      if (response?.success) {
        setMatches(response.matches || []);
      } else {
        // Fallback: show empty state, not error
        setMatches([]);
      }
    } catch (e) {
      console.error("[Discovery] fetch error:", e);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  // Sort
  const sortedMatches = [...matches].sort((a, b) => {
    if (sortBy === "reach") return ((b.tier1_followers || 0) + (b.tier2_followers || 0)) - ((a.tier1_followers || 0) + (a.tier2_followers || 0));
    if (sortBy === "aqi") return (b.audience_buying_power_score || 0) - (a.audience_buying_power_score || 0);
    return (b.total_match_score || 0) - (a.total_match_score || 0);
  });

  const handleCreatorPress = (creator) => {
    setSelectedCreator(creator);
    setShowDetail(true);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[DARK_BG, "#1A1A2E"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Creator Discovery</Text>
          <TouchableOpacity style={styles.sortButton} onPress={() => setShowSortMenu(!showSortMenu)}>
            <ArrowUpDown size={18} color={SECONDARY} />
            <Text style={styles.sortLabel}>{SORT_OPTIONS.find(o => o.key === sortBy)?.label}</Text>
          </TouchableOpacity>
        </View>

        {/* Sort menu */}
        {showSortMenu && (
          <View style={styles.sortMenu}>
            {SORT_OPTIONS.map(opt => (
              <TouchableOpacity key={opt.key} style={styles.sortOption}
                onPress={() => { setSortBy(opt.key); setShowSortMenu(false); }}>
                <Text style={[styles.sortOptionText, sortBy === opt.key && { color: ACCENT_BLUE }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Filter bar */}
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {TIER_FILTERS.map(f => (
              <FilterChip key={f} label={f} active={selectedTier === f} onPress={() => setSelectedTier(f)} />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {CATEGORY_FILTERS.map(f => (
              <FilterChip key={f} label={f} active={selectedCategory === f} onPress={() => setSelectedCategory(f)} />
            ))}
          </ScrollView>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <SnooLoader size="large" color={ACCENT_BLUE} />
            <Text style={styles.loadingText}>Finding best matches...</Text>
          </View>
        ) : sortedMatches.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Target size={48} color={MUTED} />
            <Text style={styles.emptyTitle}>No matches yet</Text>
            <Text style={styles.emptyBody}>Audience intelligence data is being built. Check back soon.</Text>
          </View>
        ) : (
          <FlatList
            data={sortedMatches}
            keyExtractor={(item) => `${item.creator_id}-${item.id}`}
            renderItem={({ item }) => <CreatorCard match={item} onPress={handleCreatorPress} />}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, gap: 12 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>

      <CreatorDetailSheet
        visible={showDetail}
        creator={selectedCreator}
        onClose={() => { setShowDetail(false); setSelectedCreator(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  screenTitle: { fontFamily: FONTS.black, fontSize: 22, color: "white", letterSpacing: -0.5 },
  sortButton: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  sortLabel: { fontFamily: FONTS.medium, fontSize: 12, color: SECONDARY },
  sortMenu: { position: "absolute", top: 100, right: 20, zIndex: 100, backgroundColor: "#1E1E30", borderRadius: 12, borderWidth: 1, borderColor: CARD_BORDER, overflow: "hidden" },
  sortOption: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: CARD_BORDER },
  sortOptionText: { fontFamily: FONTS.medium, fontSize: 14, color: SECONDARY },
  filterSection: { paddingHorizontal: 16, marginBottom: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.06)", marginRight: 8, borderWidth: 1, borderColor: "transparent" },
  filterChipActive: { backgroundColor: "rgba(79,142,247,0.15)", borderColor: ACCENT_BLUE },
  filterChipText: { fontFamily: FONTS.medium, fontSize: 13, color: MUTED },
  filterChipTextActive: { color: ACCENT_BLUE },
  // Creator card
  creatorCard: { borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: CARD_BORDER, backgroundColor: CARD_BG },
  creatorCardInner: { padding: 16 },
  creatorHeader: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  creatorAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(79,142,247,0.20)", alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontFamily: FONTS.primary, fontSize: 18, color: ACCENT_BLUE },
  creatorInfo: { flex: 1, marginLeft: 12 },
  creatorName: { fontFamily: FONTS.primary, fontSize: 16, color: "white" },
  creatorHandle: { fontFamily: FONTS.medium, fontSize: 13, color: MUTED },
  matchBadge: { alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  matchScore: { fontFamily: FONTS.primary, fontSize: 22 },
  matchLabel: { fontFamily: FONTS.medium, fontSize: 10, marginTop: 2 },
  // Stats
  statsRow: { flexDirection: "row", alignItems: "center" },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontFamily: FONTS.primary, fontSize: 16, color: "white" },
  statLabel: { fontFamily: FONTS.medium, fontSize: 10, color: MUTED, marginTop: 2 },
  statMuted: { color: "rgba(255,255,255,0.30)" },
  statDivider: { width: 1, height: 24, backgroundColor: "rgba(255,255,255,0.06)" },
  // Mini chips
  miniChip: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6 },
  miniChipText: { fontFamily: FONTS.medium, fontSize: 11, color: MUTED },
  // Why match
  whyMatchRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  whyMatchText: { fontFamily: FONTS.medium, fontSize: 12, color: MUTED },
  matchBreakdown: { marginTop: 10, gap: 8 },
  matchBarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  matchBarLabel: { fontFamily: FONTS.medium, fontSize: 11, color: MUTED, width: 100 },
  matchBarBg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.06)" },
  matchBarFill: { height: 4, borderRadius: 2, backgroundColor: ACCENT_BLUE },
  matchBarValue: { fontFamily: FONTS.medium, fontSize: 11, color: SECONDARY, width: 24, textAlign: "right" },
  // Loading/Empty
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontFamily: FONTS.medium, fontSize: 14, color: MUTED },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontFamily: FONTS.primary, fontSize: 18, color: "white" },
  emptyBody: { fontFamily: FONTS.regular, fontSize: 14, color: MUTED, textAlign: "center" },
  // Detail sheet
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheetContainer: { height: "85%", borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden", backgroundColor: CARD_BG, borderWidth: 1, borderColor: CARD_BORDER },
  sheetInner: { flex: 1, padding: 20 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.20)", alignSelf: "center", marginBottom: 16 },
  sheetHeader: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  sheetName: { fontFamily: FONTS.primary, fontSize: 18, color: "white" },
  sheetHandle: { fontFamily: FONTS.medium, fontSize: 14, color: MUTED },
  sheetClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  sheetSection: { marginBottom: 20 },
  sheetSectionTitle: { fontFamily: FONTS.primary, fontSize: 14, color: SECONDARY, marginBottom: 10, letterSpacing: 0.5 },
  sheetStatsRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 20 },
  sheetStat: { alignItems: "center" },
  sheetStatVal: { fontFamily: FONTS.primary, fontSize: 22, color: "white" },
  sheetStatLbl: { fontFamily: FONTS.medium, fontSize: 11, color: MUTED, marginTop: 4 },
  // CTA
  ctaButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 16, overflow: "hidden", marginTop: 8 },
  ctaText: { fontFamily: FONTS.semiBold, fontSize: 16, color: "white" },
});
