import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { CalendarDays, Clock, MapPin, Sparkles, MoveRight } from "lucide-react-native";
import { COLORS, FONTS } from "../constants/theme";
import { getPlanById } from "../api/plans";
import { getAuthToken } from "../api/auth";
import SnooLoader from "./ui/SnooLoader";
import UnavailableCard from "./UnavailableCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.65; // Matches SharedPostCard and SharedEventCard

const formatPlanDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
};

const formatPlanTime = (dateStr) => {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return null;
  }
};

const ACTIVITY_LABELS = {
  coffee: "Coffee",
  drink: "Drink",
  food: "Food & Dining",
  workout: "Workout",
  study: "Study Session",
  other: "Other Activity",
};

import { markCardUnavailable, isCardUnavailableSync } from "../utils/cardAvailabilityCache";

// ── Module-level plan cache ──────────────────────────────────────────────────
const planCache = new Map();

export const isPlanUnavailable = (id) => {
  if (!id) return true;
  if (planCache.get(id)?.unavailable === true) return true;
  return isCardUnavailableSync("plan_share", { planId: id });
};

const SharedPlanCard = React.memo(({ metadata, onPress, style, isMyMessage = false }) => {
  if (!metadata) return null;

  const {
    planId,
    title: metaTitle,
    activityType: metaActivityType,
    customActivityLabel: metaCustomActivityLabel,
    scheduledAt: metaScheduledAt,
    locationPublic: metaLocationPublic,
    hostName: metaHostName,
    hostPhoto: metaHostPhoto,
  } = metadata;

  const targetId = planId || metadata.plan_id || metadata.id;

  const cached = targetId ? planCache.get(targetId) : null;
  const isUnavailableCached = !targetId || cached?.unavailable === true;

  const [plan, setPlan] = useState(cached && !isUnavailableCached ? cached : null);
  const [loading, setLoading] = useState(!cached && Boolean(targetId));
  const [deleted, setDeleted] = useState(isUnavailableCached);

  useEffect(() => {
    let isMounted = true;

    if (!targetId) {
      setDeleted(true);
      setLoading(false);
      return;
    }

    if (planCache.has(targetId)) {
      const c = planCache.get(targetId);
      if (c?.unavailable) {
        setDeleted(true);
        setPlan(null);
      } else {
        setPlan(c);
        setDeleted(false);
      }
      setLoading(false);
      return;
    }

    const fetchPlan = async () => {
      try {
        const token = await getAuthToken();
        const response = await getPlanById(targetId, token);
        const data = response?.plan || response;
        if (isMounted && data && (data.id || data.title)) {
          planCache.set(targetId, data);
          setPlan(data);
          setDeleted(false);
        } else if (isMounted) {
          planCache.set(targetId, { unavailable: true });
          setDeleted(true);
        }
      } catch (err) {
        console.warn("[SharedPlanCard] Plan unavailable (likely deleted):", err?.message);
        planCache.set(targetId, { unavailable: true });
        markCardUnavailable("plan_share", targetId);
        if (isMounted) setDeleted(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPlan();
    return () => {
      isMounted = false;
    };
  }, [targetId]);

  // Resolve display values
  const displayTitle = plan?.title || metaTitle || "Untitled Plan";
  const displayHostName =
    plan?.host_profile?.name ||
    plan?.host_name ||
    metaHostName ||
    "Host";
  const displayHostPhoto =
    plan?.host_profile?.profile_photo_url ||
    plan?.host_photo ||
    metaHostPhoto ||
    null;
  const displayDate = plan?.scheduled_at || metaScheduledAt || null;
  const displayLocation = plan?.location_public || metaLocationPublic || "Location TBD";
  const activityKey = plan?.activity_type || metaActivityType || "other";
  const customLabel = plan?.custom_activity_label || metaCustomActivityLabel;

  const activityLabel =
    activityKey === "other"
      ? (customLabel || "Activity")
      : (ACTIVITY_LABELS[activityKey] || activityKey);

  const formattedDate = formatPlanDate(displayDate);
  const formattedTime = formatPlanTime(displayDate);

  const handlePress = useCallback(() => {
    if (onPress && targetId) onPress(targetId);
  }, [onPress, targetId]);

  // Loading state (Option A: compact 44px footprint while checking to prevent collapse drift)
  if (loading) {
    return (
      <View style={[styles.container, styles.compactContainer, style]}>
        <View style={styles.compactLoadingCard}>
          <SnooLoader size="small" color={COLORS.primary || "#3565F2"} />
        </View>
      </View>
    );
  }

  if (deleted) {
    return (
      <View style={[styles.container, styles.compactContainer, style, { alignSelf: isMyMessage ? "flex-end" : "flex-start" }]}>
        <UnavailableCard label="Plan" id={targetId} isMyMessage={isMyMessage} />
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* Plan Label */}
      <View style={styles.planLabel}>
        <Sparkles size={12} color={COLORS.primary || "#3565F2"} strokeWidth={2} />
        <Text style={styles.planLabelText}>Open Plan</Text>
      </View>

      <TouchableOpacity
        style={styles.card}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={["#EFF6FF", "#FFFFFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientContainer}
        >
          {/* Header Row - Host info & Activity Chip */}
          <View style={styles.hostRow}>
            <View style={styles.hostLeft}>
              <Image
                source={
                  displayHostPhoto
                    ? { uri: displayHostPhoto }
                    : {
                        uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          displayHostName
                        )}&background=3565F2&color=FFFFFF&size=88`,
                      }
                }
                style={styles.hostAvatar}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={`plan-host-${String(targetId)}`}
              />
              <Text style={styles.hostName} numberOfLines={1}>
                {displayHostName}
              </Text>
            </View>

            <View style={styles.activityChip}>
              <Text style={styles.activityChipText} numberOfLines={1}>
                {activityLabel}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title} numberOfLines={2}>
            {displayTitle}
          </Text>

          {/* Metadata */}
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Clock size={12} color="#8E8E93" strokeWidth={2} />
              <Text style={styles.metaText} numberOfLines={1}>
                {formattedDate || "TBD"}{formattedTime ? ` • ${formattedTime}` : ""}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <MapPin size={12} color="#8E8E93" strokeWidth={2} />
              <Text style={styles.metaText} numberOfLines={1}>
                {displayLocation}
              </Text>
            </View>
          </View>

          {/* Footer - CTA */}
          <View style={styles.footerRow}>
            <View style={styles.viewDetailsRow}>
              <Text style={styles.viewDetailsText}>View details</Text>
              <MoveRight size={12} color={COLORS.primary || "#3565F2"} strokeWidth={2.2} />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
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
    width: "auto",
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
  planLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  planLabelText: {
    fontSize: 11,
    fontFamily: "Manrope-SemiBold",
    color: COLORS.primary || "#3565F2",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    width: "100%",
  },
  gradientContainer: {
    padding: 12,
  },
  loadingCard: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  hostRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  hostLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  hostAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  hostName: {
    fontSize: 12,
    fontFamily: "Manrope-Medium",
    color: "#5E8D9B",
    flex: 1,
  },
  activityChip: {
    backgroundColor: "rgba(53, 101, 242, 0.08)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activityChipText: {
    fontSize: 10,
    fontFamily: "Manrope-Medium",
    color: COLORS.primary || "#3565F2",
  },
  title: {
    fontSize: 14,
    fontFamily: "BasicCommercial-Bold",
    color: "#1A1826",
    lineHeight: 18,
    marginBottom: 8,
  },
  metaGrid: {
    gap: 4,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 11,
    fontFamily: "Manrope-Medium",
    color: "#8E8E93",
    flex: 1,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  viewDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 12,
    fontFamily: "Manrope-SemiBold",
    color: COLORS.primary || "#3565F2",
  },
});

export default React.memo(SharedPlanCard);
