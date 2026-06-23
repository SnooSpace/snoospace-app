import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet, View, Text, ScrollView,
  TouchableOpacity, Dimensions, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps,
  withTiming, withDelay, FadeInDown, interpolate,
} from "react-native-reanimated";
import Svg, {
  Circle as SvgCircle,
  Defs, LinearGradient as SvgLinearGradient, Stop,
} from "react-native-svg";
import {
  ArrowLeft, Award, Users, TrendingUp, Target,
  BarChart3, Sparkles, ShieldCheck, Clock,
  CircleCheck, AlertCircle,
} from "lucide-react-native";

import { COLORS, FONTS, SHADOWS } from "../../../constants/theme";
import { getEventQualityScore } from "../../../api/audienceIntelligence";
import SnooLoader from "../../../components/ui/SnooLoader";

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const LIGHT_BG     = "#F9FAFB";
const CARD_BG      = "#FFFFFF";
const CARD_BORDER  = "#F3F4F6";
const PRIMARY_TEXT = "#111827";
const SECONDARY    = "#4B5563";
const MUTED        = "#9CA3AF";
const SURFACE      = "#F3F4F6";

const GOLD         = "#D97706";
const GREEN        = "#10B981";
const BLUE         = "#3B82F6";
const AMBER        = "#F59E0B";
const RED          = "#EF4444";
const PURPLE       = "#8B5CF6";

const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);

// ─── Tier config (mirrors backend logic) ──────────────────────────────────────

const TIER_CONFIG = [
  { key: "tier1", emoji: "🏆", name: "The Buyers",    color: GOLD,      bg: GOLD + "18"   },
  { key: "tier2", emoji: "⭐", name: "The Aspirants", color: GREEN,     bg: GREEN + "18"  },
  { key: "tier3", emoji: "👥", name: "The Browsers",  color: SECONDARY, bg: SURFACE       },
  { key: "tier4", emoji: "👻", name: "The Ghosts",    color: MUTED,     bg: SURFACE       },
];

// quality tier → display config
const QUALITY_TIER_CONFIG = {
  premium:    { label: "Premium",    color: GOLD,   bg: GOLD   + "18", icon: Award       },
  quality:    { label: "Quality",    color: GREEN,  bg: GREEN  + "18", icon: ShieldCheck },
  standard:   { label: "Standard",   color: BLUE,   bg: BLUE   + "18", icon: Target      },
  developing: { label: "Developing", color: AMBER,  bg: AMBER  + "18", icon: TrendingUp  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pct = (v) => Math.round(parseFloat(v ?? 0));
const num = (v) => parseFloat(v ?? 0);

const formatDate = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const GlassCard = ({ children, style, entering }) => (
  <Animated.View entering={entering} style={[styles.card, style]}>
    {children}
  </Animated.View>
);

const SectionLabel = ({ children }) => (
  <Text style={styles.sectionLabel}>{children}</Text>
);

/** Shimmer skeleton while loading */
const Shimmer = ({ w = "100%", h = 120 }) => {
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    const pulse = () => {
      opacity.value = withTiming(1, { duration: 700 }, () => {
        opacity.value = withTiming(0.4, { duration: 700 }, pulse);
      });
    };
    pulse();
  }, []);
  const aStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[{ width: w, height: h, borderRadius: 20, backgroundColor: "#E5E7EB", marginBottom: 16 }, aStyle]}
    />
  );
};

const LoadingSkeleton = () => (
  <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
    <Shimmer h={200} />
    <Shimmer h={160} />
    <Shimmer h={220} />
    <Shimmer h={130} />
  </View>
);

/** Animated horizontal bar */
const AnimatedBar = ({ pct: targetPct, color, delay = 0 }) => {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withDelay(delay, withTiming(targetPct, { duration: 900 }));
  }, [targetPct]);
  const barStyle = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, { backgroundColor: color }, barStyle]} />
    </View>
  );
};

/** Animated ring (SVG stroke-dashoffset) */
const RingChart = ({ value, color = BLUE, size = 160, strokeWidth = 14, label, sublabel }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(value / 100, { duration: 1000 });
  }, [value]);

  const animProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ alignItems: "center", justifyContent: "center", width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <SvgLinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity="1" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.6" />
          </SvgLinearGradient>
        </Defs>
        {/* Track */}
        <SvgCircle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={SURFACE} strokeWidth={strokeWidth} fill="none"
        />
        {/* Fill */}
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={`url(#ringGrad)`}
          strokeWidth={strokeWidth} fill="none"
          strokeDasharray={circumference}
          animatedProps={animProps}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={[styles.ringNumber, { color }]}>{Math.round(value)}</Text>
        <Text style={styles.ringUnit}>%</Text>
        {sublabel ? <Text style={styles.ringSublabel}>{sublabel}</Text> : null}
      </View>
    </View>
  );
};

/** Score tier badge pill */
const TierBadge = ({ tier }) => {
  const cfg = QUALITY_TIER_CONFIG[tier] ?? QUALITY_TIER_CONFIG.developing;
  const Icon = cfg.icon;
  return (
    <View style={[styles.tierBadge, { backgroundColor: cfg.bg }]}>
      <Icon size={14} color={cfg.color} />
      <Text style={[styles.tierBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
};

// ─── Hero: Overall Score ──────────────────────────────────────────────────────

const ScoreHero = ({ quality }) => {
  const score = num(quality.event_quality_score);
  const isPostEvent = quality.is_post_event;
  const tier = quality.event_quality_tier ?? "developing";
  const cfg = QUALITY_TIER_CONFIG[tier] ?? QUALITY_TIER_CONFIG.developing;

  return (
    <GlassCard entering={FadeInDown.delay(0).duration(500)} style={{ overflow: "hidden" }}>
      <LinearGradient
        colors={[cfg.color + "08", "transparent"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      />
      <View style={styles.heroRow}>
        <View style={{ flex: 1 }}>
          <SectionLabel>
            {isPostEvent ? "EVENT QUALITY SCORE" : "PREDICTED QUALITY"}
          </SectionLabel>

          <View style={styles.scoreNumberRow}>
            <Text style={[styles.scoreBig, { color: cfg.color }]}>
              {Math.round(score)}
            </Text>
            <Text style={styles.scoreMax}>/100</Text>
          </View>

          <TierBadge tier={tier} />

          <Text style={styles.heroCaption}>
            {isPostEvent
              ? "Based on who actually attended"
              : "Based on current RSVPs — updates as more people register"}
          </Text>
        </View>

        <RingChart
          value={score}
          color={cfg.color}
          size={130}
          strokeWidth={12}
          sublabel={isPostEvent ? "actual" : "predicted"}
        />
      </View>

      {/* Status pill */}
      <View style={[styles.statusPill, { backgroundColor: isPostEvent ? GREEN + "15" : BLUE + "15" }]}>
        {isPostEvent
          ? <CircleCheck size={14} color={GREEN} />
          : <Clock size={14} color={BLUE} />
        }
        <Text style={[styles.statusPillText, { color: isPostEvent ? GREEN : BLUE }]}>
          {isPostEvent ? "Final score — event completed" : "Live prediction — will update at RSVPs 10 · 20 · 50 · 100"}
        </Text>
      </View>
    </GlassCard>
  );
};

// ─── Buying Class Density ─────────────────────────────────────────────────────

const BuyingClassCard = ({ quality }) => {
  const bcd = num(quality.buying_class_density ?? quality.predicted_buying_class_density);
  const t1 = num(quality.tier1_attendee_pct);
  const t2 = num(quality.tier2_attendee_pct);
  const confidence = quality.prediction_confidence;

  const bcdColor = bcd >= 60 ? GOLD : bcd >= 40 ? GREEN : bcd >= 20 ? BLUE : MUTED;
  const bcdLabel = bcd >= 60
    ? "Exceptional — top 10% of SnooSpace events"
    : bcd >= 40
    ? "Strong — this event attracts genuine buyers"
    : bcd >= 20
    ? "Growing — solid foundation for brand deals"
    : "Building — more premium RSVPs needed";

  return (
    <GlassCard entering={FadeInDown.delay(80).duration(500)}>
      <SectionLabel>BUYING CLASS DENSITY</SectionLabel>
      <Text style={styles.cardHelper}>
        Combined % of Tier 1 (Buyers) + Tier 2 (Aspirants) — the headline metric brands look at
      </Text>

      <View style={styles.bcdRow}>
        <RingChart value={bcd} color={bcdColor} size={120} strokeWidth={11} />
        <View style={styles.bcdRight}>
          <View style={styles.bcdTierRow}>
            <View style={[styles.bcdDot, { backgroundColor: GOLD }]} />
            <Text style={styles.bcdTierLabel}>Tier 1 Buyers</Text>
            <Text style={[styles.bcdTierPct, { color: GOLD }]}>{pct(t1)}%</Text>
          </View>
          <View style={styles.bcdTierRow}>
            <View style={[styles.bcdDot, { backgroundColor: GREEN }]} />
            <Text style={styles.bcdTierLabel}>Tier 2 Aspirants</Text>
            <Text style={[styles.bcdTierPct, { color: GREEN }]}>{pct(t2)}%</Text>
          </View>

          {confidence && (
            <View style={[styles.confidencePill, {
              backgroundColor: confidence === "high" ? GREEN + "15" : confidence === "medium" ? AMBER + "15" : SURFACE,
            }]}>
              <Text style={[styles.confidenceText, {
                color: confidence === "high" ? GREEN : confidence === "medium" ? AMBER : MUTED,
              }]}>
                {confidence === "high" ? "High confidence" : confidence === "medium" ? "Medium confidence" : "Low confidence (< 10 RSVPs)"}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.bcdLabel}>{bcdLabel}</Text>
    </GlassCard>
  );
};

// ─── Full Tier Breakdown ──────────────────────────────────────────────────────

const TierBreakdownCard = ({ quality }) => {
  const tiers = [
    { ...TIER_CONFIG[0], pct: num(quality.tier1_attendee_pct) },
    { ...TIER_CONFIG[1], pct: num(quality.tier2_attendee_pct) },
    { ...TIER_CONFIG[2], pct: num(quality.tier3_attendee_pct) },
    { ...TIER_CONFIG[3], pct: num(quality.tier4_attendee_pct) },
  ];

  const label = quality.is_post_event ? "ATTENDEE TIER BREAKDOWN" : "RSVP TIER BREAKDOWN";

  return (
    <GlassCard entering={FadeInDown.delay(160).duration(500)}>
      <SectionLabel>{label}</SectionLabel>
      {tiers.map((t, i) => (
        <View key={t.key} style={styles.fullTierRow}>
          <View style={[styles.fullTierIcon, { backgroundColor: t.bg }]}>
            <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.fullTierHeader}>
              <Text style={styles.fullTierName}>{t.name}</Text>
              <Text style={[styles.fullTierPct, { color: t.color }]}>{pct(t.pct)}%</Text>
            </View>
            <AnimatedBar pct={t.pct} color={t.color} delay={i * 120} />
          </View>
        </View>
      ))}
      <Text style={styles.cardHelper} numberOfLines={2}>
        Tier classification is based on AQI signals from each attendee's profile
      </Text>
    </GlassCard>
  );
};

// ─── Engagement Signals (post-event only) ────────────────────────────────────

const EngagementCard = ({ quality }) => {
  if (!quality.is_post_event) return null;

  const attended = parseInt(quality.total_verified_attendees ?? 0);
  const rsvps    = parseInt(quality.total_rsvps ?? 0);
  const ratio    = num(quality.rsvp_to_attend_ratio) * 100;
  const echo     = parseInt(quality.echo_signal_count ?? 0);
  const follows  = parseInt(quality.post_event_follows ?? 0);
  const content  = parseInt(quality.content_generated ?? 0);

  const ratioColor = ratio >= 70 ? GREEN : ratio >= 50 ? BLUE : AMBER;

  const metrics = [
    {
      icon: Users, color: BLUE, label: "Verified Attendance",
      value: attended, sub: `of ${rsvps} RSVPs`,
    },
    {
      icon: TrendingUp, color: ratioColor, label: "Show-up Rate",
      value: `${pct(ratio)}%`, sub: ratio >= 70 ? "Excellent" : ratio >= 50 ? "Good" : "Below avg",
    },
    {
      icon: Sparkles, color: PURPLE, label: "Post-event Echoes",
      value: echo, sub: "shares & reposts",
    },
    {
      icon: Users, color: GREEN, label: "New Followers Gained",
      value: follows, sub: "within 48h of event",
    },
  ];

  return (
    <GlassCard entering={FadeInDown.delay(240).duration(500)}>
      <SectionLabel>ENGAGEMENT SIGNALS</SectionLabel>
      <View style={styles.metricsGrid}>
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <View key={i} style={styles.metricCell}>
              <View style={[styles.metricIcon, { backgroundColor: m.color + "15" }]}>
                <Icon size={18} color={m.color} />
              </View>
              <Text style={[styles.metricValue, { color: m.color }]}>{m.value}</Text>
              <Text style={styles.metricLabel}>{m.label}</Text>
              <Text style={styles.metricSub}>{m.sub}</Text>
            </View>
          );
        })}
      </View>
    </GlassCard>
  );
};

// ─── Brand Readiness Insight ──────────────────────────────────────────────────

const BrandReadinessCard = ({ quality }) => {
  const bcd   = num(quality.buying_class_density ?? quality.predicted_buying_class_density);
  const score = num(quality.event_quality_score);
  const tier  = quality.event_quality_tier ?? "developing";

  const insights = [];

  if (tier === "premium") {
    insights.push({
      icon: Award, color: GOLD,
      title: "Brand-ready at premium tier",
      body: `${pct(bcd)}% buying class density puts this event in the top bracket for luxury and lifestyle brand placements.`,
    });
  } else if (tier === "quality") {
    insights.push({
      icon: ShieldCheck, color: GREEN,
      title: "Attractive to quality-focused brands",
      body: "Strong audience quality signals. Ideal for mid-to-premium brand activations.",
    });
  } else if (tier === "standard") {
    insights.push({
      icon: Target, color: BLUE,
      title: "Suitable for broad-reach campaigns",
      body: `Push buying class density above 40% to unlock higher-value brand placements.`,
    });
  } else {
    insights.push({
      icon: TrendingUp, color: AMBER,
      title: "Building audience quality",
      body: "Focus on attracting Tier 1 & 2 attendees. Consider ticket pricing and exclusivity signals.",
    });
  }

  if (bcd >= 50 && score >= 70) {
    insights.push({
      icon: Sparkles, color: PURPLE,
      title: "Strong post-event echo potential",
      body: "High-quality audiences share more. Your event content will reach networks brands value.",
    });
  }

  return (
    <GlassCard entering={FadeInDown.delay(320).duration(500)}>
      <SectionLabel>WHAT THIS MEANS FOR BRAND DEALS</SectionLabel>
      {insights.map((insight, i) => {
        const Icon = insight.icon;
        return (
          <View
            key={i}
            style={[
              styles.insightRow,
              i < insights.length - 1 && styles.insightDivider,
            ]}
          >
            <View style={[styles.insightIcon, { backgroundColor: insight.color + "15" }]}>
              <Icon size={20} color={insight.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.insightTitle}>{insight.title}</Text>
              <Text style={styles.insightBody}>{insight.body}</Text>
            </View>
          </View>
        );
      })}
    </GlassCard>
  );
};

// ─── No Data State ────────────────────────────────────────────────────────────

const NoDataState = ({ event, navigation }) => (
  <View style={styles.noDataContainer}>
    <BarChart3 size={56} color={MUTED} />
    <Text style={styles.noDataTitle}>Score Not Available Yet</Text>
    <Text style={styles.noDataBody}>
      Quality scores appear once {"\n"}
      <Text style={{ color: BLUE }}>10 or more people RSVP</Text>
      {" "}to this event.
    </Text>
    <TouchableOpacity style={styles.noDataButton} onPress={() => navigation.goBack()}>
      <Text style={styles.noDataButtonText}>Back to events</Text>
    </TouchableOpacity>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EventQualityScreen({ navigation, route }) {
  const { eventId, eventTitle } = route.params ?? {};

  const [quality, setQuality] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(false);
      const res = await getEventQualityScore(eventId);
      if (res?.success) {
        setQuality(res.quality);
      } else if (res?.status === "not_enough_data") {
        setQuality(null); // no data state
      } else {
        setError(true);
      }
    } catch (e) {
      console.error("[EventQualityScreen] fetch error:", e);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = () => { setRefreshing(true); fetchData(); };

  const renderContent = () => {
    if (loading) return <LoadingSkeleton />;
    if (error)   return (
      <View style={styles.noDataContainer}>
        <AlertCircle size={56} color={RED} />
        <Text style={styles.noDataTitle}>Couldn't load data</Text>
        <TouchableOpacity style={[styles.noDataButton, { backgroundColor: BLUE }]} onPress={fetchData}>
          <Text style={styles.noDataButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
    if (!quality) return <NoDataState event={{ id: eventId, title: eventTitle }} navigation={navigation} />;

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={MUTED} />}
      >
        {/* Event meta row */}
        {quality.start_datetime && (
          <Animated.View entering={FadeInDown.delay(0).duration(400)} style={styles.eventMetaRow}>
            <Text style={styles.eventMetaDate}>{formatDate(quality.start_datetime)}</Text>
            {quality.category && (
              <View style={styles.categoryPill}>
                <Text style={styles.categoryPillText}>{quality.category}</Text>
              </View>
            )}
          </Animated.View>
        )}

        <ScoreHero quality={quality} />
        <BuyingClassCard quality={quality} />
        <TierBreakdownCard quality={quality} />
        <EngagementCard quality={quality} />
        <BrandReadinessCard quality={quality} />

        {/* Score formula footnote */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.footnote}>
          <Text style={styles.footnoteText}>
            Score = buying class density (40%) · avg AQI (25%) · show-up rate (15%) · post-event echo (10%) · new follows (10%)
          </Text>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#F9FAFB", "#F3F4F6"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={22} color={PRIMARY_TEXT} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {eventTitle ?? "Event Quality"}
            </Text>
            <Text style={styles.headerSub}>Audience Quality Score</Text>
          </View>
        </View>

        {renderContent()}
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LIGHT_BG },

  // header
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CARD_BG, alignItems: "center", justifyContent: "center",
    ...SHADOWS.sm,
  },
  headerTitle: {
    fontFamily: FONTS.black, fontSize: 18, color: PRIMARY_TEXT, letterSpacing: -0.5,
  },
  headerSub: {
    fontFamily: FONTS.regular, fontSize: 12, color: MUTED, marginTop: 1,
  },

  // scroll
  scrollContent: { paddingHorizontal: 16, paddingTop: 4, gap: 16 },

  // card
  card: {
    borderRadius: 24, backgroundColor: CARD_BG,
    borderWidth: 1, borderColor: CARD_BORDER,
    ...SHADOWS.md, padding: 20,
  },
  sectionLabel: {
    fontFamily: FONTS.primary, fontSize: 12, color: MUTED,
    letterSpacing: 1, marginBottom: 14,
  },
  cardHelper: {
    fontFamily: FONTS.regular, fontSize: 12, color: MUTED,
    lineHeight: 17, marginTop: 12,
  },

  // event meta row
  eventMetaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  eventMetaDate: { fontFamily: FONTS.medium, fontSize: 13, color: SECONDARY },
  categoryPill: {
    backgroundColor: BLUE + "15", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  categoryPillText: { fontFamily: FONTS.semiBold, fontSize: 12, color: BLUE },

  // hero
  heroRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 },
  scoreNumberRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginBottom: 12 },
  scoreBig: { fontFamily: FONTS.black, fontSize: 56, letterSpacing: -2 },
  scoreMax: { fontFamily: FONTS.medium, fontSize: 18, color: MUTED },
  heroCaption: {
    fontFamily: FONTS.regular, fontSize: 13, color: SECONDARY,
    lineHeight: 18, marginTop: 10,
  },
  tierBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  tierBadgeText: { fontFamily: FONTS.semiBold, fontSize: 13 },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
  },
  statusPillText: { fontFamily: FONTS.medium, fontSize: 12, flex: 1, lineHeight: 16 },

  // ring
  ringNumber: { fontFamily: FONTS.black, fontSize: 30, letterSpacing: -1 },
  ringUnit: { fontFamily: FONTS.medium, fontSize: 14, color: MUTED, marginTop: -4 },
  ringSublabel: { fontFamily: FONTS.regular, fontSize: 10, color: MUTED, marginTop: 2 },

  // buying class
  bcdRow: { flexDirection: "row", alignItems: "center", gap: 20, marginTop: 8, marginBottom: 12 },
  bcdRight: { flex: 1, gap: 10 },
  bcdTierRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bcdDot: { width: 10, height: 10, borderRadius: 5 },
  bcdTierLabel: { fontFamily: FONTS.medium, fontSize: 13, color: SECONDARY, flex: 1 },
  bcdTierPct: { fontFamily: FONTS.semiBold, fontSize: 14 },
  bcdLabel: { fontFamily: FONTS.regular, fontSize: 13, color: SECONDARY, lineHeight: 18 },
  confidencePill: {
    alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 4,
  },
  confidenceText: { fontFamily: FONTS.medium, fontSize: 11 },

  // tier breakdown
  fullTierRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  fullTierIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  fullTierHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  fullTierName: { fontFamily: FONTS.semiBold, fontSize: 14, color: PRIMARY_TEXT },
  fullTierPct: { fontFamily: FONTS.semiBold, fontSize: 14 },

  // bar
  barTrack: { height: 6, borderRadius: 3, backgroundColor: SURFACE },
  barFill: { height: 6, borderRadius: 3, minWidth: 2 },

  // metrics grid
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metricCell: {
    flex: 1, minWidth: (SCREEN_WIDTH - 32 - 20 - 12) / 2,
    backgroundColor: SURFACE, borderRadius: 16, padding: 14, gap: 4,
  },
  metricIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  metricValue: { fontFamily: FONTS.black, fontSize: 24, letterSpacing: -0.5 },
  metricLabel: { fontFamily: FONTS.semiBold, fontSize: 12, color: PRIMARY_TEXT },
  metricSub: { fontFamily: FONTS.regular, fontSize: 11, color: MUTED },

  // insights
  insightRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12 },
  insightDivider: { borderBottomWidth: 1, borderBottomColor: SURFACE },
  insightIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  insightTitle: { fontFamily: FONTS.primary, fontSize: 15, color: PRIMARY_TEXT, marginBottom: 4 },
  insightBody: { fontFamily: FONTS.regular, fontSize: 13, color: SECONDARY, lineHeight: 18 },

  // no data
  noDataContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12, paddingTop: 80 },
  noDataTitle: { fontFamily: FONTS.primary, fontSize: 20, color: PRIMARY_TEXT, textAlign: "center" },
  noDataBody: { fontFamily: FONTS.regular, fontSize: 14, color: MUTED, textAlign: "center", lineHeight: 20 },
  noDataButton: {
    marginTop: 8, backgroundColor: BLUE,
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 20,
  },
  noDataButtonText: { fontFamily: FONTS.semiBold, fontSize: 15, color: "#FFFFFF" },

  // footnote
  footnote: {
    backgroundColor: SURFACE, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  footnoteText: { fontFamily: FONTS.regular, fontSize: 11, color: MUTED, textAlign: "center", lineHeight: 16 },
});
