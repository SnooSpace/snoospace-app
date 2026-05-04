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
  Sparkles, ShieldCheck, BarChart3, Zap, MapPin, AlertCircle,
} from "lucide-react-native";

import { COLORS, FONTS, SPACING, SHADOWS } from "../../../constants/theme";
import { getCreatorStats, getUserInterests, getCommunityHealthScore } from "../../../api/audienceIntelligence";
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
const ACCENT_RED = "#EF4444";
const MUTED_TEXT = "#9CA3AF"; 
const SECONDARY_TEXT = "#4B5563"; 
const PRIMARY_TEXT = "#111827"; 
const SURFACE_NEUTRAL = "#F3F4F6"; 

// ── Community Health Status Card ──────────────────────────────────────────
const HEALTH_CONFIG = {
  healthy: {
    icon: ShieldCheck,
    color: ACCENT_GREEN,
    label: "Healthy",
    message: "Your community signals look authentic. You're eligible for full brand discovery.",
  },
  under_review: {
    icon: Target,
    color: ACCENT_AMBER,
    label: "Under Review",
    message: "Some engagement patterns are being monitored. This may reduce your brand partnership visibility.",
  },
  restricted: {
    icon: AlertCircle,
    color: ACCENT_RED,
    label: "Restricted",
    message: "Your community has been removed from brand discovery due to engagement anomalies. Contact support to resolve.",
  },
};

const CommunityHealthCard = ({ healthData }) => {
  if (!healthData) return null;

  const status = healthData.health_status ?? "healthy";
  const config = HEALTH_CONFIG[status] ?? HEALTH_CONFIG.healthy;
  const IconComp = config.icon;
  const multiplier = parseFloat(healthData.brand_match_multiplier ?? 1.0);
  const flagCount = parseInt(healthData.active_flag_count ?? 0);

  return (
    <GlassCard
      entering={FadeInDown.delay(0).duration(400)}
      style={{
        borderLeftWidth: 3,
        borderLeftColor: config.color,
        marginBottom: 0,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
        <View
          style={[{
            width: 40, height: 40, borderRadius: 12,
            alignItems: "center", justifyContent: "center",
          }, { backgroundColor: config.color + "18" }]}
        >
          <IconComp size={20} color={config.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Text style={[
              styles.sectionLabel,
              { color: config.color, marginBottom: 0, letterSpacing: 0.5, fontSize: 12 }
            ]}>
              {config.label.toUpperCase()}
            </Text>
            {status !== "healthy" && (
              <View style={[
                styles.pill,
                { backgroundColor: config.color + "18", paddingHorizontal: 8, paddingVertical: 2 }
              ]}>
                <Text style={[styles.pillText, { color: config.color, fontSize: 10 }]}>
                  {flagCount} {flagCount === 1 ? "flag" : "flags"}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.heroSubtext, { textAlign: "left", color: SECONDARY_TEXT }]}>
            {config.message}
          </Text>
          {status !== "healthy" && multiplier < 1.0 && (
            <Text style={[
              styles.heroSubtext,
              { textAlign: "left", color: MUTED_TEXT, marginTop: 6, fontSize: 12 }
            ]}>
              Brand match score: {Math.round(multiplier * 100)}% of normal
            </Text>
          )}
        </View>
      </View>
    </GlassCard>
  );
};

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

// ── Section 2b: Audience Gender Composition ──
const GENDER_COLORS = {
  Female: "#EC4899",
  Male: ACCENT_BLUE,
  "Non-binary": "#8B5CF6",
  Unknown: MUTED_TEXT,
};

const AudienceGenderSection = ({ genderBreakdown }) => {
  if (!genderBreakdown || Object.keys(genderBreakdown).length === 0) {
    return (
      <GlassCard entering={FadeInDown.delay(140).duration(500)}>
        <Text style={styles.sectionLabel}>AUDIENCE COMPOSITION</Text>
        <Text style={styles.emptyText}>Building audience data…</Text>
      </GlassCard>
    );
  }

  const genders = ["Female", "Male", "Non-binary", "Unknown"].filter(
    (g) => (genderBreakdown[g] ?? 0) > 0,
  );

  return (
    <GlassCard entering={FadeInDown.delay(140).duration(500)}>
      <Text style={styles.sectionLabel}>AUDIENCE COMPOSITION</Text>
      <Text style={styles.sectionHelper}>Gender breakdown of your followers</Text>
      <View style={{ marginTop: 12, gap: 10 }}>
        {genders.map((key) => {
          const pct = genderBreakdown[key] ?? 0;
          const color = GENDER_COLORS[key] || MUTED_TEXT;
          return (
            <View key={key} style={styles.genderRow}>
              <Text style={styles.genderLabel}>{key}</Text>
              <View style={styles.genderBarTrack}>
                <View style={[styles.genderBarFill, { backgroundColor: color, width: `${pct}%` }]} />
              </View>
              <Text style={styles.genderPct}>{pct.toFixed(1)}%</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.privacyNote}>Aggregated audience data only — never individual</Text>
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

// ── Section 4: Dynamic Interest Fingerprint ──
const TREND_CONFIG = {
  rising: { icon: (props) => <TrendingUp {...props} />, color: ACCENT_GREEN, label: "Rising" },
  emerging: { icon: (props) => <TrendingUp {...props} />, color: ACCENT_BLUE, label: "New" },
  stable: { icon: null, color: MUTED_TEXT, label: "Stable" },
  declining: { icon: (props) => <TrendingDown {...props} />, color: ACCENT_AMBER, label: "Falling" },
  dormant: { icon: null, color: "#D1D5DB", label: "Dormant" },
};

const InterestFingerprint = ({ interests }) => {
  const display = (interests || []).filter((i) => parseFloat(i.decayed_score) > 5);
  if (display.length === 0) {
    return (
      <GlassCard entering={FadeInDown.delay(240).duration(500)}>
        <Text style={styles.sectionLabel}>INTEREST FINGERPRINT</Text>
        <Text style={styles.emptyText}>Not enough data yet. Keep creating events!</Text>
      </GlassCard>
    );
  }

  return (
    <GlassCard entering={FadeInDown.delay(240).duration(500)}>
      <Text style={styles.sectionLabel}>INTEREST FINGERPRINT</Text>
      <Text style={styles.sectionHelper}>
        Dynamic interests based on your audience's recent behavior
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
        {display.map((item, i) => {
          const trend = TREND_CONFIG[item.trend] || TREND_CONFIG.stable;
          const isDormant = item.trend === "dormant";
          return (
            <View key={i} style={[styles.interestChip, isDormant && { opacity: 0.5 }]}>
              <Text style={[styles.interestChipText, { color: isDormant ? "#9CA3AF" : SECONDARY_TEXT }]}>
                {item.category}
              </Text>
              {trend.icon && (
                <View style={[styles.trendBadge, { backgroundColor: trend.color + "20" }]}>
                  {trend.icon({ size: 12, color: trend.color })}
                </View>
              )}
              <View style={[styles.categoryBadge, { backgroundColor: trend.color + "20" }]}>
                <Text style={[styles.categoryBadgeText, { color: trend.color }]}>
                  {Math.round(parseFloat(item.decayed_score))}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </GlassCard>
  );
};

// ── Section 4b: Trajectory Card ──
const TrajectoryCard = ({ stats }) => {
  const trajectory = stats.aqi_trajectory || "stable";
  const isRising = trajectory === "rising";
  const isDeclining = trajectory === "declining";
  const color = isRising ? ACCENT_GREEN : isDeclining ? ACCENT_AMBER : MUTED_TEXT;
  const label = isRising
    ? "Your audience quality is rising"
    : isDeclining
      ? "Your audience quality is shifting"
      : "Your audience quality is stable";
  const IconComp = isRising ? TrendingUp : isDeclining ? TrendingDown : Target;

  return (
    <GlassCard entering={FadeInDown.delay(200).duration(500)}>
      <View style={styles.trajectoryRow}>
        <View style={[styles.trajectoryIcon, { backgroundColor: color + "15" }]}>
          <IconComp size={20} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.trajectoryLabel, { color }]}>{trajectory.toUpperCase()}</Text>
          <Text style={styles.trajectoryBody}>{label}</Text>
        </View>
      </View>
    </GlassCard>
  );
};

// ── Section 5: Geographic Breakdown ──
const GeographicBreakdown = ({ stats }) => {
  const geo = stats.geographic_breakdown || {};
  const cities = Object.entries(geo)
    .map(([city, data]) => ({
      city,
      count: data.count || 0,
      buyingPower: data.buyingPowerIndex,
      confidence: data.confidence || "insufficient",
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  if (cities.length === 0) {
    return (
      <GlassCard entering={FadeInDown.delay(280).duration(500)}>
        <Text style={styles.sectionLabel}>GEOGRAPHIC BREAKDOWN</Text>
        <Text style={styles.emptyText}>Location data will appear as your audience grows.</Text>
      </GlassCard>
    );
  }

  const maxCount = Math.max(...cities.map((c) => c.count), 1);

  const getBpiLabel = (score) => {
    if (score == null) return null;
    if (score >= 65) return { text: "High", color: ACCENT_GREEN };
    if (score >= 40) return { text: "Medium", color: ACCENT_AMBER };
    return { text: "Emerging", color: MUTED_TEXT };
  };

  return (
    <GlassCard entering={FadeInDown.delay(280).duration(500)}>
      <Text style={styles.sectionLabel}>GEOGRAPHIC BREAKDOWN</Text>
      <Text style={styles.sectionHelper}>Where your audience is — and their buying power</Text>
      <View style={{ marginTop: 12, gap: 10 }}>
        {cities.map((item, i) => {
          const bpi = getBpiLabel(item.buyingPower);
          return (
            <View key={i} style={styles.geoRow}>
              <View style={styles.geoIconCircle}>
                <MapPin size={14} color={ACCENT_BLUE} />
              </View>
              <View style={styles.geoInfo}>
                <View style={styles.geoHeader}>
                  <Text style={styles.geoCity}>{item.city}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {item.confidence === "insufficient" ? (
                      <Text style={styles.geoBuildingText}>Building data…</Text>
                    ) : bpi ? (
                      <View style={[styles.geoBpiBadge, { backgroundColor: bpi.color + "18" }]}>
                        <Text style={[styles.geoBpiText, { color: bpi.color }]}>{bpi.text}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.geoCount}>{item.count}</Text>
                  </View>
                </View>
                <View style={styles.geoBarBg}>
                  <View style={[styles.geoBarFill, { width: `${(item.count / maxCount) * 100}%` }]} />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </GlassCard>
  );
};

// ── Section 6: Insights ──
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
  const [interests, setInterests] = useState([]);
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setError(false);
      const account = await getActiveAccount();
      if (!account?.id) { setLoading(false); setError(true); return; }
      const [statsRes, interestsRes, healthRes] = await Promise.all([
        getCreatorStats(account.id),
        getUserInterests(account.id),
        getCommunityHealthScore().catch(() => null), // non-fatal
      ]);
      if (statsRes?.success) {
        setStats(statsRes.stats);
      } else {
        setError(true);
      }
      if (interestsRes?.success) {
        setInterests(interestsRes.interests || []);
      }
      if (healthRes && !healthRes.error) {
        setHealthData(healthRes);
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
        ) : error || !stats ? (
          <ErrorState onRetry={fetchStats} />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={MUTED_TEXT} />}
          >
            {/* Community health status — shown only when data is available */}
            <CommunityHealthCard healthData={healthData} />
            <FollowQualityHero stats={stats} />
            <AudienceTierBreakdown stats={stats} />
            <AudienceGenderSection genderBreakdown={stats.audience_gender_breakdown} />
            <TrajectoryCard stats={stats} />
            <FollowQualityTrend stats={stats} />
            <InterestFingerprint interests={interests} />
            <GeographicBreakdown stats={stats} />
            <InsightCards stats={stats} />
            <View style={{ height: 40 }} />
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
  // V2: Interest chips
  interestChip: { flexDirection: "row", alignItems: "center", backgroundColor: SURFACE_NEUTRAL, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, gap: 6 },
  interestChipText: { fontFamily: FONTS.medium, fontSize: 13 },
  trendBadge: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  // V2: Trajectory
  trajectoryRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  trajectoryIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  trajectoryLabel: { fontFamily: FONTS.semiBold, fontSize: 11, letterSpacing: 1, marginBottom: 2 },
  trajectoryBody: { fontFamily: FONTS.regular, fontSize: 14, color: SECONDARY_TEXT, lineHeight: 20 },
  // V2: Geographic breakdown
  geoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  geoIconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(59,130,246,0.08)", alignItems: "center", justifyContent: "center" },
  geoInfo: { flex: 1 },
  geoHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  geoCity: { fontFamily: FONTS.semiBold, fontSize: 14, color: PRIMARY_TEXT },
  geoCount: { fontFamily: FONTS.medium, fontSize: 13, color: MUTED_TEXT },
  geoBarBg: { height: 5, borderRadius: 3, backgroundColor: SURFACE_NEUTRAL },
  geoBarFill: { height: 5, borderRadius: 3, backgroundColor: ACCENT_BLUE, minWidth: 3 },
  geoBpiBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  geoBpiText: { fontFamily: FONTS.semiBold, fontSize: 10 },
  geoBuildingText: { fontFamily: FONTS.regular, fontSize: 11, color: MUTED_TEXT, fontStyle: "italic" },
  // V2: Gender breakdown
  genderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  genderLabel: { fontFamily: FONTS.medium, fontSize: 13, color: SECONDARY_TEXT, width: 80 },
  genderBarTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: SURFACE_NEUTRAL },
  genderBarFill: { height: 8, borderRadius: 4, minWidth: 3 },
  genderPct: { fontFamily: FONTS.semiBold, fontSize: 13, color: PRIMARY_TEXT, width: 50, textAlign: "right" },
  privacyNote: { fontFamily: FONTS.regular, fontSize: 11, color: MUTED_TEXT, marginTop: 14, textAlign: "center", fontStyle: "italic" },
});
