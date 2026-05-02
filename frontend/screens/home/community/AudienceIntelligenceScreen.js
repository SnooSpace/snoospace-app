import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity,
  Dimensions, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay,
  FadeInDown, interpolate,
} from "react-native-reanimated";
import Svg, { Circle as SvgCircle, Polyline, Line, Text as SvgText } from "react-native-svg";
import {
  ArrowLeft, TrendingUp, TrendingDown, Users, Target,
  Sparkles, ShieldCheck, BarChart3, Zap,
} from "lucide-react-native";

import { COLORS, FONTS, SPACING, SHADOWS } from "../../../constants/theme";
import { getCreatorStats } from "../../../api/audienceIntelligence";
import { getActiveAccount } from "../../../api/auth";
import SnooLoader from "../../../components/ui/SnooLoader";

const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);

const SCREEN_WIDTH = Dimensions.get("window").width;
const LIGHT_BG = "#F9FAFB"; 
const CARD_BG = "#FFFFFF";
const CARD_BORDER = "#F3F4F6"; 
const ACCENT_BLUE = "#3B82F6";
const ACCENT_GREEN = "#10B981";
const ACCENT_AMBER = "#F59E0B";
const ACCENT_GOLD = "#D97706";
const MUTED_TEXT = "#9CA3AF"; 
const SECONDARY_TEXT = "#4B5563"; 
const PRIMARY_TEXT = "#111827"; 
const SURFACE_NEUTRAL = "#F3F4F6"; 

// ── Shimmer Skeleton ──
const ShimmerBlock = ({ width, height, style }) => {
  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.value = withTiming(1, { duration: 1200 });
    const interval = setInterval(() => {
      shimmer.value = 0;
      shimmer.value = withTiming(1, { duration: 1200 });
    }, 1500);
    return () => clearInterval(interval);
  }, []);
  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.5, 1, 0.5]),
  }));
  return (
    <Animated.View
      style={[{ width, height, borderRadius: 12, backgroundColor: "#E5E7EB" }, style, animStyle]}
    />
  );
};

// ── Glass Card Wrapper ──
const GlassCard = ({ children, style, entering }) => (
  <Animated.View entering={entering} style={[styles.glassCard, style]}>
    <View style={styles.glassCardInner}>{children}</View>
  </Animated.View>
);

// ── Section 1: Follow Quality Hero ──
const FollowQualityHero = ({ stats }) => {
  const [activeMetric, setActiveMetric] = useState("score");

  const score = stats.follow_quality_score || 0;
  
  const contentPct = stats.total_followers > 0
    ? Math.round((stats.content_follows / stats.total_followers) * 100) : 0;
  const discoveryPct = stats.total_followers > 0
    ? Math.round((stats.discovery_follows / stats.total_followers) * 100) : 0;
  const socialPct = stats.total_followers > 0
    ? Math.round((stats.social_follows / stats.total_followers) * 100) : 0;

  let currentValue = score;
  let currentLabel = "FOLLOW QUALITY SCORE";
  if (activeMetric === "content") {
    currentValue = contentPct;
    currentLabel = "CONTENT BREAKDOWN";
  } else if (activeMetric === "discovery") {
    currentValue = discoveryPct;
    currentLabel = "DISCOVERY BREAKDOWN";
  } else if (activeMetric === "social") {
    currentValue = socialPct;
    currentLabel = "SOCIAL BREAKDOWN";
  }

  const radius = 70;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(currentValue / 100, { duration: 800 });
  }, [currentValue]);

  const animStroke = useAnimatedStyle(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <GlassCard entering={FadeInDown.delay(0).duration(500)}>
      <LinearGradient
        colors={["rgba(59,130,246,0.05)", "rgba(59,130,246,0.0)"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      />
      <Text style={styles.sectionLabel}>{currentLabel}</Text>

      <View style={styles.heroRingContainer}>
        <Svg width={180} height={180} viewBox="0 0 180 180">
          <SvgCircle cx="90" cy="90" r={radius} stroke="#F3F4F6"
            strokeWidth={strokeWidth} fill="none" />
          <AnimatedCircle cx="90" cy="90" r={radius} stroke={ACCENT_BLUE}
            strokeWidth={strokeWidth} fill="none"
            strokeDasharray={circumference}
            animatedProps={animStroke}
            strokeLinecap="round"
            transform="rotate(-90 90 90)" />
        </Svg>
        <View style={[StyleSheet.absoluteFill, { justifyContent: "center", alignItems: "center", flexDirection: "row" }]}>
          {/* Invisible spacer for perfect centering */}
          <Text style={{ fontFamily: FONTS.primary, fontSize: 25, color: MUTED_TEXT, marginRight: 2, marginTop: 4, opacity: 0 }}>
            %
          </Text>
          <Text style={{ fontFamily: FONTS.primary, fontSize: 44, color: PRIMARY_TEXT, letterSpacing: -1 }}>
            {Math.round(currentValue)}
          </Text>
          <Text style={{ fontFamily: FONTS.primary, fontSize: 25, color: MUTED_TEXT, marginLeft: 2, marginTop: 4 }}>
            %
          </Text>
        </View>
      </View>

      <View style={styles.pillRow}>
        <TouchableOpacity 
          activeOpacity={0.7}
          style={[styles.pill, { backgroundColor: activeMetric === "content" ? "rgba(59,130,246,0.15)" : SURFACE_NEUTRAL }]}
          onPress={() => setActiveMetric(activeMetric === "content" ? "score" : "content")}
        >
          <Text style={[styles.pillText, { color: activeMetric === "content" ? ACCENT_BLUE : SECONDARY_TEXT }]}>Content: {contentPct}%</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          activeOpacity={0.7}
          style={[styles.pill, { backgroundColor: activeMetric === "discovery" ? "rgba(59,130,246,0.15)" : SURFACE_NEUTRAL }]}
          onPress={() => setActiveMetric(activeMetric === "discovery" ? "score" : "discovery")}
        >
          <Text style={[styles.pillText, { color: activeMetric === "discovery" ? ACCENT_BLUE : SECONDARY_TEXT }]}>Discovery: {discoveryPct}%</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          activeOpacity={0.7}
          style={[styles.pill, { backgroundColor: activeMetric === "social" ? "rgba(59,130,246,0.15)" : SURFACE_NEUTRAL }]}
          onPress={() => setActiveMetric(activeMetric === "social" ? "score" : "social")}
        >
          <Text style={[styles.pillText, { color: activeMetric === "social" ? ACCENT_BLUE : SECONDARY_TEXT }]}>Social: {socialPct}%</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.heroSubtext}>
        Your followers found you through your content — this is what brands pay for
      </Text>
    </GlassCard>
  );
};

// ── Section 2: Audience Tier Breakdown ──
const TIER_CONFIG = [
  { tier: 1, icon: "🏆", name: "The Buyers", color: ACCENT_GOLD, bg: "rgba(217,119,6,0.1)" },
  { tier: 2, icon: "⭐", name: "The Aspirants", color: ACCENT_GREEN, bg: "rgba(16,185,129,0.1)" },
  { tier: 3, icon: "👥", name: "The Browsers", color: SECONDARY_TEXT, bg: SURFACE_NEUTRAL },
  { tier: 4, icon: "👻", name: "The Ghosts", color: MUTED_TEXT, bg: SURFACE_NEUTRAL },
];

const TierRow = ({ config, count, percentage, delay }) => {
  const barWidth = useSharedValue(0);
  useEffect(() => {
    barWidth.value = withDelay(delay, withTiming(percentage, { duration: 800 }));
  }, [percentage]);
  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value}%`,
  }));

  return (
    <View style={styles.tierRow}>
      <View style={[styles.tierIconCircle, { backgroundColor: config.bg }]}>
        <Text style={{ fontSize: 18 }}>{config.icon}</Text>
      </View>
      <View style={styles.tierInfo}>
        <View style={styles.tierHeader}>
          <Text style={styles.tierName}>{config.name}</Text>
          <Text style={styles.tierCount}>{count} <Text style={styles.tierPct}>({Math.round(percentage)}%)</Text></Text>
        </View>
        <View style={styles.tierBarBg}>
          <Animated.View style={[styles.tierBarFill, { backgroundColor: config.color }, barStyle]} />
        </View>
      </View>
    </View>
  );
};

const AudienceTierBreakdown = ({ stats }) => {
  const total = stats.total_followers || 1;
  const tiers = [
    { count: stats.tier1_followers, pct: (stats.tier1_followers / total) * 100 },
    { count: stats.tier2_followers, pct: (stats.tier2_followers / total) * 100 },
    { count: stats.tier3_followers, pct: (stats.tier3_followers / total) * 100 },
    { count: stats.tier4_followers, pct: (stats.tier4_followers / total) * 100 },
  ];

  return (
    <GlassCard entering={FadeInDown.delay(80).duration(500)}>
      <Text style={styles.sectionLabel}>AUDIENCE TIER BREAKDOWN</Text>
      {TIER_CONFIG.map((cfg, i) => (
        <TierRow key={cfg.tier} config={cfg} count={tiers[i].count} percentage={tiers[i].pct} delay={i * 100} />
      ))}
    </GlassCard>
  );
};

// ── Section 3: Follow Quality Trend (SVG Sparkline) ──
const FollowQualityTrend = ({ stats }) => {
  const trend = stats.weekly_follow_quality_trend || [];
  if (trend.length < 2) {
    return (
      <GlassCard entering={FadeInDown.delay(160).duration(500)}>
        <Text style={styles.sectionLabel}>FOLLOW QUALITY TREND</Text>
        <Text style={styles.emptyText}>Not enough data yet. Check back next week.</Text>
      </GlassCard>
    );
  }

  const scores = trend.map(w => w.score || 0);
  const maxScore = Math.max(...scores, 1);
  const chartW = SCREEN_WIDTH - 80;
  const chartH = 80;
  const points = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * chartW;
    const y = chartH - (s / maxScore) * (chartH - 10);
    return `${x},${y}`;
  }).join(" ");

  const isUp = scores[scores.length - 1] >= scores[scores.length - 2];

  return (
    <GlassCard entering={FadeInDown.delay(160).duration(500)}>
      <Text style={styles.sectionLabel}>FOLLOW QUALITY TREND</Text>
      <View style={{ marginVertical: 16 }}>
        <Svg width={chartW} height={chartH + 20}>
          <Polyline points={points} fill="none" stroke={isUp ? ACCENT_GREEN : ACCENT_AMBER}
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {scores.map((s, i) => {
            const x = (i / (scores.length - 1)) * chartW;
            const y = chartH - (s / maxScore) * (chartH - 10);
            return <SvgCircle key={i} cx={x} cy={y} r="3" fill={isUp ? ACCENT_GREEN : ACCENT_AMBER} />;
          })}
          {trend.map((w, i) => {
            const x = (i / (scores.length - 1)) * chartW;
            const label = w.week ? w.week.slice(5) : `W${i + 1}`;
            return <SvgText key={i} x={x} y={chartH + 16} textAnchor="middle" fill={MUTED_TEXT} fontSize="9">{label}</SvgText>;
          })}
        </Svg>
      </View>
      <View style={styles.trendIndicator}>
        {isUp ? <TrendingUp size={16} color={ACCENT_GREEN} /> : <TrendingDown size={16} color={ACCENT_AMBER} />}
        <Text style={[styles.trendText, { color: isUp ? ACCENT_GREEN : ACCENT_AMBER }]}>
          {isUp ? "Quality trending up" : "Quality trending down"}
        </Text>
      </View>
    </GlassCard>
  );
};

// ── Section 4: Spending Fingerprint ──
const SpendingFingerprint = ({ stats }) => {
  const categories = stats.top_spending_categories || [];
  const defaultCats = [
    { name: "Fitness", pct: 0 }, { name: "Tech", pct: 0 }, { name: "Lifestyle", pct: 0 },
    { name: "Food", pct: 0 }, { name: "Business", pct: 0 }, { name: "Wellness", pct: 0 },
  ];
  const display = categories.length > 0
    ? categories.map((c, i) => ({ name: typeof c === "string" ? c : c.name || "Other", pct: c.pct || 0 }))
    : defaultCats;

  return (
    <GlassCard entering={FadeInDown.delay(240).duration(500)}>
      <Text style={styles.sectionLabel}>AUDIENCE SPENDING FINGERPRINT</Text>
      <Text style={styles.sectionHelper}>What your Tier 1 & 2 audience spends on</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
        {display.map((cat, i) => (
          <View key={i} style={styles.categoryChip}>
            <Text style={styles.categoryChipText}>{cat.name}</Text>
            {cat.pct > 0 && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{cat.pct}%</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </GlassCard>
  );
};

// ── Section 5: Insights ──
const generateInsights = (stats) => {
  const insights = [];
  if (stats.follow_quality_score >= 70) {
    insights.push({
      icon: <ShieldCheck size={20} color={ACCENT_GREEN} />,
      title: "You're brand-ready",
      body: `${Math.round(stats.follow_quality_score)}%+ content follows is the threshold premium brands look for.`,
    });
  } else if (stats.follow_quality_score >= 40) {
    insights.push({
      icon: <Target size={20} color={ACCENT_BLUE} />,
      title: "Growing quality audience",
      body: "Keep creating engaging content to push past the 70% brand-ready threshold.",
    });
  }
  if (stats.tier1_percentage >= 30) {
    insights.push({
      icon: <Zap size={20} color={ACCENT_GOLD} />,
      title: "High-value audience",
      body: "Your audience outperforms creators with 5x your follower count.",
    });
  }
  const trend = stats.weekly_follow_quality_trend || [];
  if (trend.length >= 2 && trend[trend.length - 1]?.score > trend[trend.length - 2]?.score) {
    insights.push({
      icon: <Sparkles size={20} color={ACCENT_BLUE} />,
      title: "Momentum building",
      body: "Your content is attracting higher quality followers each week.",
    });
  }
  if (insights.length === 0) {
    insights.push({
      icon: <BarChart3 size={20} color={MUTED_TEXT} />,
      title: "Building your profile",
      body: "Host events and create content to build audience intelligence data.",
    });
  }
  return insights.slice(0, 3);
};

const InsightCards = ({ stats }) => {
  const insights = generateInsights(stats);
  return (
    <GlassCard entering={FadeInDown.delay(320).duration(500)}>
      <Text style={styles.sectionLabel}>WHAT THIS MEANS FOR YOU</Text>
      {insights.map((insight, i) => (
        <View key={i} style={[styles.insightRow, i < insights.length - 1 && styles.insightDivider]}>
          <View style={styles.insightIcon}>{insight.icon}</View>
          <View style={styles.insightText}>
            <Text style={styles.insightTitle}>{insight.title}</Text>
            <Text style={styles.insightBody}>{insight.body}</Text>
          </View>
        </View>
      ))}
    </GlassCard>
  );
};

// ── Loading Skeleton ──
const LoadingSkeleton = () => (
  <View style={{ padding: 20, gap: 20 }}>
    <ShimmerBlock width="100%" height={280} />
    <ShimmerBlock width="100%" height={220} />
    <ShimmerBlock width="100%" height={140} />
    <ShimmerBlock width="100%" height={100} />
    <ShimmerBlock width="100%" height={160} />
  </View>
);

// ── Error State ──
const ErrorState = ({ onRetry }) => (
  <View style={styles.errorContainer}>
    <BarChart3 size={48} color={MUTED_TEXT} />
    <Text style={styles.errorTitle}>Couldn't load audience data</Text>
    <Text style={styles.errorBody}>Please check your connection and try again.</Text>
    <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
      <Text style={styles.retryButtonText}>Retry</Text>
    </TouchableOpacity>
  </View>
);

// ── Main Screen ──
export default function AudienceIntelligenceScreen({ navigation }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setError(false);
      const account = await getActiveAccount();
      if (!account?.id) { setLoading(false); setError(true); return; }
      const response = await getCreatorStats(account.id);
      if (response?.success) {
        setStats(response.stats);
      } else {
        setError(true);
      }
    } catch (e) {
      console.error("[AQI Screen] fetch error:", e);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleRefresh = () => { setRefreshing(true); fetchStats(); };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#F9FAFB", "#F3F4F6"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color={PRIMARY_TEXT} />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Audience Intelligence</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState onRetry={fetchStats} />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={MUTED_TEXT} />}
          >
            <FollowQualityHero stats={stats} />
            <AudienceTierBreakdown stats={stats} />
            <FollowQualityTrend stats={stats} />
            <SpendingFingerprint stats={stats} />
            <InsightCards stats={stats} />
            <View style={{ height: 100 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LIGHT_BG },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", ...SHADOWS.sm },
  screenTitle: { fontFamily: FONTS.black, fontSize: 20, color: PRIMARY_TEXT, letterSpacing: -0.5 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, gap: 16 },
  // Glass card
  glassCard: { borderRadius: 24, backgroundColor: CARD_BG, ...SHADOWS.md, borderWidth: 1, borderColor: CARD_BORDER },
  glassCardInner: { padding: 20 },
  // Section labels
  sectionLabel: { fontFamily: FONTS.primary, fontSize: 13, color: MUTED_TEXT, letterSpacing: 1, marginBottom: 16 },
  sectionHelper: { fontFamily: FONTS.regular, fontSize: 13, color: MUTED_TEXT, marginTop: -8, marginBottom: 4 },
  // Hero
  heroRingContainer: { alignItems: "center", marginBottom: 20 },
  pillRow: { flexDirection: "row", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  pillText: { fontFamily: FONTS.semiBold, fontSize: 12 },
  heroSubtext: { fontFamily: FONTS.regular, fontSize: 13, color: MUTED_TEXT, textAlign: "center", lineHeight: 18 },
  // Tier breakdown
  tierRow: { flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 12 },
  tierIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  tierInfo: { flex: 1 },
  tierHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  tierName: { fontFamily: FONTS.semiBold, fontSize: 14, color: PRIMARY_TEXT },
  tierCount: { fontFamily: FONTS.medium, fontSize: 14, color: SECONDARY_TEXT },
  tierPct: { fontFamily: FONTS.regular, fontSize: 12, color: MUTED_TEXT },
  tierBarBg: { height: 6, borderRadius: 3, backgroundColor: SURFACE_NEUTRAL },
  tierBarFill: { height: 6, borderRadius: 3, minWidth: 2 },
  // Trend
  trendIndicator: { flexDirection: "row", alignItems: "center", gap: 6 },
  trendText: { fontFamily: FONTS.semiBold, fontSize: 13 },
  // Category chips
  categoryChip: { flexDirection: "row", alignItems: "center", backgroundColor: SURFACE_NEUTRAL, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, gap: 6 },
  categoryChipText: { fontFamily: FONTS.medium, fontSize: 13, color: SECONDARY_TEXT },
  categoryBadge: { backgroundColor: "rgba(59,130,246,0.15)", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  categoryBadgeText: { fontFamily: FONTS.semiBold, fontSize: 10, color: ACCENT_BLUE },
  // Insights
  insightRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12 },
  insightDivider: { borderBottomWidth: 1, borderBottomColor: SURFACE_NEUTRAL },
  insightIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: SURFACE_NEUTRAL, alignItems: "center", justifyContent: "center" },
  insightText: { flex: 1 },
  insightTitle: { fontFamily: FONTS.primary, fontSize: 15, color: PRIMARY_TEXT, marginBottom: 4 },
  insightBody: { fontFamily: FONTS.regular, fontSize: 13, color: MUTED_TEXT, lineHeight: 18 },
  // Empty/Error
  emptyText: { fontFamily: FONTS.regular, fontSize: 14, color: MUTED_TEXT, textAlign: "center", paddingVertical: 20 },
  errorContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 },
  errorTitle: { fontFamily: FONTS.primary, fontSize: 18, color: PRIMARY_TEXT, textAlign: "center" },
  errorBody: { fontFamily: FONTS.regular, fontSize: 14, color: MUTED_TEXT, textAlign: "center" },
  retryButton: { marginTop: 12, backgroundColor: ACCENT_BLUE, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 },
  retryButtonText: { fontFamily: FONTS.semiBold, fontSize: 14, color: "white" },
});
