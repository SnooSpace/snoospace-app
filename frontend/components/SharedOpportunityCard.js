import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Image } from "expo-image"; // ── PERF: memory-disk cache + off-thread decode
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSequence,
  withTiming,
  withRepeat,
  cancelAnimation,
} from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Briefcase, Globe, Coins, ArrowRight, Clock } from "lucide-react-native";
import { getOpportunityDetail } from "../api/opportunities";
import CountdownTimer from "./CountdownTimer";
import { COLORS, FONTS } from "../constants/theme";
import SnooLoader from "./ui/SnooLoader";
import UnavailableCard from "./UnavailableCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.72;

// Static Helper Functions (Extracted outside the component scope)
const formatTimeAgo = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// ── Auto-scrolling Marquee Chips Component using Reanimated ───────────────────
const MarqueeChips = React.memo(({ chips, chipType, styles }) => {
  const [contentWidth, setContentWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    const maxScroll = contentWidth - containerWidth;
    if (maxScroll > 0) {
      translateX.value = 0;
      translateX.value = withRepeat(
        withSequence(
          withDelay(1200, withTiming(-maxScroll, { duration: maxScroll * 50 })),
          withDelay(1500, withTiming(0, { duration: maxScroll * 50 }))
        ),
        -1, // infinite loop
        false // do not reverse automatically
      );
    } else {
      cancelAnimation(translateX);
      translateX.value = 0;
    }
    return () => {
      cancelAnimation(translateX);
    };
  }, [contentWidth, containerWidth, chips]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  return (
    <View
      style={[styles.chipsRow, { overflow: "hidden" }]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[{ flexDirection: "row", gap: 8 }, animatedStyle]}
        onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}
      >
        {chips.map((item, index) => (
          <View
            key={`${chipType}-${index}`}
            style={chipType === "role" ? styles.roleChip : styles.skillChip}
          >
            <Text
              style={chipType === "role" ? styles.roleChipText : styles.skillChipText}
            >
              {item}
            </Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
});

import { markCardUnavailable, isCardUnavailableSync } from "../utils/cardAvailabilityCache";

// ── Module-level opportunity cache ──────────────────────────────────────────
const opportunityCache = new Map();

export const isOpportunityUnavailable = (id) => {
  if (!id) return true;
  if (opportunityCache.get(id)?.unavailable === true) return true;
  return isCardUnavailableSync("opportunity_share", { opportunityId: id });
};

/**
 * SharedOpportunityCard — premium preview rendered in chat when
 * someone shares an opportunity (message_type === "opportunity_share").
 * Matches the layout and style of OpportunityFeedCard in a compact view.
 */
const SharedOpportunityCard = React.memo(({ metadata, onPress, style }) => {
  const navigation = useNavigation();

  if (!metadata) return null;

  const {
    opportunityId,
    title: metaTitle,
    opportunityTypes: metaTypes,
    creatorName: metaCreatorName,
    creatorUsername: metaCreatorUsername,
  } = metadata;

  const targetId = opportunityId || metadata.opportunity_id || metadata.id || metadata.opportunityId;

  const cached = targetId ? opportunityCache.get(targetId) : null;
  const isUnavailableCached = !targetId || cached?.unavailable === true;

  const [opp, setOpp] = useState(cached && !isUnavailableCached ? cached : null);
  const [loading, setLoading] = useState(!cached && Boolean(targetId));
  const [deleted, setDeleted] = useState(isUnavailableCached);

  // Normalise opportunity_types — could be array or comma-string
  const types = useMemo(() => {
    return Array.isArray(metaTypes)
      ? metaTypes
      : typeof metaTypes === "string" && metaTypes.length > 0
      ? metaTypes.split(",").map((t) => t.trim())
      : [];
  }, [metaTypes]);

  useEffect(() => {
    let isMounted = true;

    if (!targetId) {
      setDeleted(true);
      setLoading(false);
      return;
    }

    // ── PERF: Return cached result immediately — no network round-trip.
    if (opportunityCache.has(targetId)) {
      const c = opportunityCache.get(targetId);
      if (c?.unavailable) {
        setDeleted(true);
        setOpp(null);
      } else {
        setOpp(c);
        setDeleted(false);
      }
      setLoading(false);
      return;
    }

    const fetchDetails = async () => {
      try {
        const response = await getOpportunityDetail(targetId);
        const data = response.opportunity || response;
        if (isMounted && data && (data.id || data.title)) {
          opportunityCache.set(targetId, data); // cache before setState
          setOpp(data);
          setDeleted(false);
        } else if (isMounted) {
          opportunityCache.set(targetId, { unavailable: true });
          setDeleted(true);
        }
      } catch (err) {
        console.warn("[SharedOpportunityCard] Opportunity unavailable (likely deleted):", err?.message);
        opportunityCache.set(targetId, { unavailable: true });
        markCardUnavailable("opportunity_share", targetId);
        if (isMounted) setDeleted(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchDetails();
    return () => { isMounted = false; };
  }, [targetId]);

  const displayTitle = opp?.title || metaTitle || "Untitled Opportunity";
  const displayCreatorName = opp?.creator_name || metaCreatorName || "Anonymous";
  const displayCreatorUsername = opp?.creator_username || metaCreatorUsername;
  const displayCreatorPhoto = opp?.creator_photo || null;
  const createdAt = opp?.created_at || null;

  const workModeText = useMemo(() => {
    if (!opp) return "Remote";
    if (opp.work_mode === "hybrid") return "Hybrid";
    if (opp.work_mode === "remote") return "Remote";
    if (opp.work_mode === "on_site") return "On-site";
    return opp.work_mode || "Remote";
  }, [opp]);

  const workTypeText = useMemo(() => {
    if (!opp) return "Ongoing";
    const type = opp.work_type === "one_time" ? "One-time" : "Ongoing";
    return opp.availability ? `${type} (${opp.availability})` : type;
  }, [opp]);

  const compensationText = useMemo(() => {
    if (!opp) return "Negotiable";
    if (opp.payment_nature === "exposure") return "Exposure";
    if (opp.payment_nature === "revenue_share") {
      return opp.budget_range
        ? `Rev Share · ${opp.budget_range}`
        : "Rev Share";
    }
    if (opp.payment_nature === "trial") {
      const trialPrefix =
        opp.trial_type === "free_trial" ? "Free Trial" : "Paid Trial";
      return opp.budget_range
        ? `${trialPrefix} (${opp.budget_range})`
        : trialPrefix;
    }
    if (opp.payment_nature === "paid") {
      const payType = opp.payment_type
        ? ` (${
            opp.payment_type === "per_deliverable"
              ? "Task"
              : opp.payment_type === "monthly"
              ? "Mo"
              : "Fixed"
          })`
        : "";
      return opp.budget_range
        ? `${opp.budget_range}${payType}`
        : `Paid${payType}`;
    }
    return opp.budget_range || opp.payment_nature || "Negotiable";
  }, [opp]);

  const roleChips = useMemo(() => {
    const roles = opp?.opportunity_types || opp?.roles || types || [];
    return Array.isArray(roles) ? roles.slice(0, 2) : [];
  }, [opp, types]);

  const skillChips = useMemo(() => {
    if (!opp) return [];
    const tools = [];
    if (opp.skill_groups && Array.isArray(opp.skill_groups)) {
      opp.skill_groups.forEach((group) => {
        let groupTools = group.tools;
        if (!groupTools) return;
        if (typeof groupTools === "string") {
          try { groupTools = JSON.parse(groupTools); } catch { groupTools = [groupTools]; }
        }
        if (Array.isArray(groupTools)) {
          groupTools.forEach((tool) => {
            if (tool && !tools.includes(tool)) tools.push(tool);
          });
        }
      });
    }
    return tools.slice(0, 3);
  }, [opp]);

  const isClosed = opp
    ? opp.closed_at || (opp.expires_at && new Date(opp.expires_at) < new Date())
    : false;

  const handlePress = useCallback(() => {
    if (onPress && targetId) onPress(targetId, opp);
  }, [onPress, targetId, opp]);

  // ── Unified render: all states share the same root element type ────────────
  // CRITICAL for scroll stability: having the deleted state return a <View>
  // while loading/resolved returned <TouchableOpacity> caused a React
  // unmount+remount cycle on every loading→deleted transition, which combined
  // with the 10.28px height difference (250.28px loading → 240px deleted)
  // produced the visible scroll drift after opacity reveal.
  //
  // Fix: Single <TouchableOpacity> root for all states. The loading state
  // renders only a simple centered spinner (no header/author/title skeleton),
  // so its natural height also falls to the minHeight:240 floor — giving a
  // zero-height-change loading→deleted transition. Growth on loading→resolved
  // (valid card gets taller) is a one-time upward change handled natively by
  // maintainVisibleContentPosition.

  const hasMetaInfo = metaCreatorName || metaCreatorUsername || metaTitle;

  return (
    <TouchableOpacity
      style={[styles.container, (loading || deleted) && styles.compactContainer, style]}
      onPress={loading || deleted ? undefined : handlePress}
      activeOpacity={loading || deleted ? 1 : 0.9}
    >
      {loading ? (
        <View style={styles.compactLoadingCard}>
          <SnooLoader size="small" color={COLORS.primary} />
        </View>
      ) : deleted ? (
        <UnavailableCard label="Opportunity" id={targetId} />
      ) : (
        // Resolved valid opportunity — full card.
        // May grow taller than 240px — that's intentional and fine.
        <LinearGradient
          colors={["#C8E9EA", "#E8F7F8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          {/* ── Header Row: Badge & Icon ──────────────────────────────────── */}
          <View style={styles.headerRow}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>OPPORTUNITY</Text>
            </View>
            <View style={styles.iconContainer}>
              <Briefcase size={14} color="#2962FF" strokeWidth={2} />
            </View>
          </View>

          {/* ── Author Row ───────────────────────────────────────────────── */}
          <View style={styles.authorRow}>
            <Image
              source={
                displayCreatorPhoto
                  ? { uri: displayCreatorPhoto }
                  : {
                      uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        displayCreatorName
                      )}&background=E5E7EB&color=6B7280&size=88`,
                    }
              }
              style={styles.authorAvatar}
              cachePolicy="memory-disk"
              contentFit="cover"
              recyclingKey={`opp-auth-${String(targetId)}`}
            />
            <Text style={styles.authorUsername} numberOfLines={1}>
              {displayCreatorName}
            </Text>
            {createdAt && (
              <>
                <Text style={styles.separator}>•</Text>
                <Text style={styles.timestamp}>
                  {formatTimeAgo(createdAt)}
                </Text>
              </>
            )}
          </View>

          {/* ── Title ─────────────────────────────────────────────────────── */}
          <Text style={styles.title} numberOfLines={2}>
            {displayTitle}
          </Text>

          {/* ── Role Chips ─────────────────── */}
          {roleChips.length > 0 && (
            <MarqueeChips chips={roleChips} chipType="role" styles={styles} />
          )}

          {/* ── Skill Chips ─────────────────── */}
          {skillChips.length > 0 && (
            <MarqueeChips chips={skillChips} chipType="skill" styles={styles} />
          )}

          {/* ── Details Row ───────────────────────────────────────────────── */}
          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Globe size={13} color="#5e8d9b" strokeWidth={2} />
              <Text style={styles.detailText}>{workModeText}</Text>
            </View>

            <Text style={styles.detailSeparator}>•</Text>

            <View style={styles.detailItem}>
              <Clock size={13} color="#5e8d9b" strokeWidth={2} />
              <Text style={styles.detailText}>{workTypeText}</Text>
            </View>

            <Text style={styles.detailSeparator}>•</Text>

            <View style={styles.detailItem}>
              <Coins size={13} color="#5e8d9b" strokeWidth={2} />
              <Text style={styles.detailText}>{compensationText}</Text>
            </View>
          </View>

          {/* ── Footer Row ────────────────────────────────────────────────── */}
          <View style={styles.footerRow}>
            <View style={styles.footerLeft}>
              <View style={styles.applicantStack}>
                {opp?.applicants && opp.applicants.length > 0 ? (
                  <>
                    {opp.applicants.slice(0, 3).map((applicant, index) => (
                      <Image
                         key={index}
                         source={{ uri: applicant.photo_url }}
                         style={[
                           styles.applicantAvatar,
                           { marginLeft: index > 0 ? -8 : 0 },
                         ]}
                         cachePolicy="memory-disk"
                         contentFit="cover"
                         recyclingKey={`opp-app-${String(targetId)}-${index}`}
                      />
                    ))}
                    {opp?.applicant_count > 3 && (
                      <Text style={styles.applicantCount}>
                        +{opp.applicant_count - 3}
                      </Text>
                    )}
                  </>
                ) : opp?.applicant_count > 0 ? (
                  <Text style={styles.applicantCountText}>
                    {opp.applicant_count}
                  </Text>
                ) : (
                  <Text style={styles.applicantCountText}>Be first</Text>
                )}
              </View>

              {(opp.expires_at || opp.closed_at) && (
                <>
                  <Text style={styles.footerSeparator}>•</Text>
                  {isClosed ? (
                    <View style={styles.endedBadge}>
                      <Text style={styles.endedBadgeText}>Ended</Text>
                    </View>
                  ) : (
                    <View style={styles.activeBadge}>
                      <CountdownTimer
                        expiresAt={opp.expires_at}
                        style={styles.activeBadgeText}
                      />
                    </View>
                  )}
                </>
              )}
            </View>

            {/* View Details Button */}
            <View style={[styles.applyButton, isClosed && styles.applyButtonDisabled]}>
              <LinearGradient
                colors={isClosed ? ["#9CA3AF", "#6B7280"] : ["#448AFF", "#2962FF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.applyButtonGradient}
              >
                <Text style={styles.applyButtonText}>
                  {isClosed ? "Closed" : "View Details"}
                </Text>
                {!isClosed && (
                  <ArrowRight
                    size={12}
                    color="#FFFFFF"
                    style={{ marginLeft: 4 }}
                    strokeWidth={2.5}
                  />
                )}
              </LinearGradient>
            </View>
          </View>
        </LinearGradient>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    alignSelf: "flex-start",
    marginVertical: 8,
    minHeight: 240,
    justifyContent: "center",
  },
  compactContainer: {
    minHeight: 0,
    marginVertical: 4,
  },
  compactLoadingCard: {
    height: 44,
    width: "100%",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderRadius: 16,
    padding: 16,
    width: "100%",
  },
  // Simple centered loading state — no skeleton content.
  // Must not have a fixed height so the parent container's minHeight:240
  // is the sole height constraint, matching the deleted state floor exactly.
  simpleLoadingCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  typeBadge: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  typeBadgeText: {
    fontSize: 9,
    fontFamily: FONTS.semiBold,
    color: "#4A5568",
    letterSpacing: 0.5,
  },
  iconContainer: {
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  authorUsername: {
    fontSize: 13,
    color: "#1D1D1F",
    fontFamily: FONTS.semiBold,
    maxWidth: 110,
  },
  separator: {
    fontSize: 11,
    color: "#5e8d9b",
    marginHorizontal: 8,
  },
  timestamp: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#5e8d9b",
  },
  title: {
    fontFamily: FONTS.primary,
    fontSize: 16,
    color: "#1D1D1F",
    marginTop: 8,
    marginBottom: 8,
    lineHeight: 20,
  },
  chipsRow: {
    marginBottom: 8,
    maxHeight: 28,
  },
  chipsContent: {
    paddingRight: 8,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  roleChip: {
    backgroundColor: "rgba(41, 98, 255, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(41, 98, 255, 0.22)",
  },
  roleChipText: {
    fontSize: 10,
    color: "#2962FF",
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.1,
  },
  skillChip: {
    backgroundColor: "rgba(255,255,255,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(94, 141, 155, 0.35)",
  },
  skillChipText: {
    fontSize: 10,
    color: "#3D6B7A",
    fontFamily: FONTS.medium,
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 16,
    marginTop: 8,
    gap: 8,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    fontSize: 11,
    color: "#1D1D1F",
    fontFamily: FONTS.medium,
  },
  detailSeparator: {
    fontSize: 11,
    color: "#5e8d9b",
  },
  inlineLoading: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerSeparator: {
    color: COLORS.textTertiary,
    marginHorizontal: 8,
    fontSize: 12,
  },
  applicantStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  applicantAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  applicantCount: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: "#3B82F6",
    marginLeft: 8,
  },
  applicantCountText: {
    fontSize: 11,
    color: "#5e8d9b",
    fontFamily: FONTS.medium,
  },
  activeBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
  },
  endedBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  endedBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: "#DC2626",
  },
  applyButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  applyButtonDisabled: {
    opacity: 0.7,
  },
  applyButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  applyButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: FONTS.semiBold,
  },
});

export default SharedOpportunityCard;
