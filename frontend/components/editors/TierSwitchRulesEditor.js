/**
 * TierSwitchRulesEditor - Host configuration for allowed ticket switching pairs
 *
 * Enforces strict gender invariant: Male tickets can NEVER be mapped to Female tickets.
 * Features connecting dots, flow arrows, gender-coded themes, and compulsory rule enforcement.
 */
import React, { useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import {
  ArrowRight,
  Lock,
  Check,
  ShieldCheck,
  Sparkles,
  RotateCcw,
  AlertCircle,
  Users,
  MapPin,
  Video,
} from "lucide-react-native";
import { COLORS, FONTS } from "../../constants/theme";

// Gender visual tokens
const GENDER_THEMES = {
  male: {
    label: "Men Only",
    primary: "#007AFF",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    badgeText: "#1D4ED8",
  },
  female: {
    label: "Women Only",
    primary: "#FF2D92",
    bg: "#FDF2F8",
    border: "#FBCFE8",
    badgeText: "#BE185D",
  },
  all: {
    label: "Open to All",
    primary: "#6A0DAD",
    bg: "#F5F3FF",
    border: "#DDD6FE",
    badgeText: "#6D28D9",
  },
};

const getAccessModeInfo = (mode) => {
  const m = (mode || "in_person").toLowerCase().trim();
  if (m === "virtual") {
    return { label: "Virtual", icon: Video, color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" };
  }
  if (m === "both" || m === "hybrid") {
    return { label: "Hybrid", icon: Sparkles, color: "#0D9488", bg: "#F0FDFA", border: "#99F6E4" };
  }
  return { label: "In-Person", icon: MapPin, color: "#4B5563", bg: "#F3F4F6", border: "#E5E7EB" };
};

const getTierKey = (tier, index) => {
  if (tier.id !== undefined && tier.id !== null) return String(tier.id);
  if (tier.temp_id) return String(tier.temp_id);
  return `idx_${index}`;
};

const getGender = (tier) => {
  const r = (tier.gender_restriction || "all").toLowerCase().trim();
  if (r === "male") return "male";
  if (r === "female") return "female";
  return "all";
};

export default function TierSwitchRulesEditor({
  ticketTypes = [],
  rules = [],
  onChange,
}) {
  // Normalize rules into a lookup map: { [fromKey]: Set of targetKeys }
  const ruleMap = useMemo(() => {
    const map = {};
    (rules || []).forEach((r) => {
      // Find matching source tier
      const fromTier = ticketTypes.find(
        (t, idx) =>
          (r.from_tier_id && String(t.id) === String(r.from_tier_id)) ||
          (r.from_tier_name &&
            t.name?.trim().toLowerCase() === r.from_tier_name?.trim().toLowerCase()) ||
          (r.from_tier_index !== undefined && idx === r.from_tier_index)
      );
      if (!fromTier) return;
      const fromIdx = ticketTypes.indexOf(fromTier);
      const fromKey = getTierKey(fromTier, fromIdx);

      const targetKeys = new Set();
      const rawTargets = r.to_tier_ids || r.to_tier_names || r.to_tier_indices || [];

      rawTargets.forEach((raw) => {
        const toTier = ticketTypes.find(
          (t, idx) =>
            String(t.id) === String(raw) ||
            t.name?.trim().toLowerCase() === String(raw).trim().toLowerCase() ||
            idx === raw
        );
        if (toTier) {
          const toIdx = ticketTypes.indexOf(toTier);
          targetKeys.add(getTierKey(toTier, toIdx));
        }
      });

      map[fromKey] = targetKeys;
    });
    return map;
  }, [ticketTypes, rules]);

  // Convert map back to serializable rules array for backend/draft
  const emitChange = useCallback(
    (newMap) => {
      const serialized = [];
      ticketTypes.forEach((fromTier, fromIdx) => {
        const fromKey = getTierKey(fromTier, fromIdx);
        const targetKeys = newMap[fromKey];
        if (!targetKeys || targetKeys.size === 0) return;

        const targetIds = [];
        const targetNames = [];
        targetKeys.forEach((tKey) => {
          const toTier = ticketTypes.find((t, idx) => getTierKey(t, idx) === tKey);
          if (toTier) {
            if (toTier.id) targetIds.push(toTier.id);
            targetNames.push(toTier.name);
          }
        });

        if (targetNames.length > 0) {
          serialized.push({
            from_tier_id: fromTier.id || null,
            from_tier_name: fromTier.name,
            from_tier_index: fromIdx,
            to_tier_ids: targetIds,
            to_tier_names: targetNames,
          });
        }
      });

      if (onChange) {
        onChange(serialized);
      }
    },
    [ticketTypes, onChange]
  );

  // Toggle a switch pair
  const togglePair = useCallback(
    (fromKey, toKey) => {
      const newMap = { ...ruleMap };
      const currentSet = new Set(newMap[fromKey] || []);

      if (currentSet.has(toKey)) {
        currentSet.delete(toKey);
      } else {
        currentSet.add(toKey);
      }

      if (currentSet.size > 0) {
        newMap[fromKey] = currentSet;
      } else {
        delete newMap[fromKey];
      }

      emitChange(newMap);
    },
    [ruleMap, emitChange]
  );

  // Convenience helper: Auto-link all compatible upgrades
  const autoLinkUpgrades = useCallback(() => {
    const newMap = {};
    ticketTypes.forEach((fromTier, fromIdx) => {
      const fromKey = getTierKey(fromTier, fromIdx);
      const fromGender = getGender(fromTier);
      const fromPrice = parseFloat(fromTier.base_price) || 0;

      ticketTypes.forEach((toTier, toIdx) => {
        if (fromIdx === toIdx) return;
        const toKey = getTierKey(toTier, toIdx);
        const toGender = getGender(toTier);
        const toPrice = parseFloat(toTier.base_price) || 0;

        // Gender invariant: cannot cross Male <-> Female
        if (
          (fromGender === "male" && toGender === "female") ||
          (fromGender === "female" && toGender === "male")
        ) {
          return;
        }

        // Only auto-link upgrades or equal tiers
        if (toPrice >= fromPrice) {
          if (!newMap[fromKey]) newMap[fromKey] = new Set();
          newMap[fromKey].add(toKey);
        }
      });
    });

    emitChange(newMap);
  }, [ticketTypes, emitChange]);

  // Clear all configured rules
  const clearAllRules = useCallback(() => {
    emitChange({});
  }, [emitChange]);

  // Total paths configured
  const totalPathsCount = useMemo(() => {
    return Object.values(ruleMap).reduce((sum, set) => sum + (set?.size || 0), 0);
  }, [ruleMap]);

  return (
    <View style={styles.container}>
      {/* Header with counter and quick actions */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <View style={styles.badgeRow}>
            <View style={styles.statusBadge}>
              <ShieldCheck size={14} color="#16A34A" strokeWidth={2} />
              <Text style={styles.statusBadgeText}>
                {totalPathsCount} Switch {totalPathsCount === 1 ? "Path" : "Paths"} Active
              </Text>
            </View>
          </View>
          <Text style={styles.helperText}>
            Select which destination tickets each tier can switch into. Cross-gender switching is strictly blocked.
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.actionBtn}
            onPress={autoLinkUpgrades}
          >
            <Sparkles size={13} color={COLORS.primary} strokeWidth={2} />
            <Text style={styles.actionBtnText}>Auto Upgrades</Text>
          </TouchableOpacity>

          {totalPathsCount > 0 && (
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.actionBtn, styles.clearBtn]}
              onPress={clearAllRules}
            >
              <RotateCcw size={13} color="#EF4444" strokeWidth={2} />
              <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tier Switch Mapping Cards */}
      <View style={styles.cardsList}>
        {ticketTypes.map((fromTier, fromIdx) => {
          const fromKey = getTierKey(fromTier, fromIdx);
          const fromGender = getGender(fromTier);
          const fromTheme = GENDER_THEMES[fromGender];
          const fromPrice = parseFloat(fromTier.base_price) || 0;
          const activeTargets = ruleMap[fromKey] || new Set();

          // Compatible candidate tiers (excluding self)
          const candidateTiers = ticketTypes.filter((_, idx) => idx !== fromIdx);
          const compatibleCandidates = candidateTiers.filter((toTier) => {
            const toGender = getGender(toTier);
            return !(
              (fromGender === "male" && toGender === "female") ||
              (fromGender === "female" && toGender === "male")
            );
          });
          const hasAccessModes = ticketTypes.some(
            (t) => t.access_mode && t.access_mode !== "in_person"
          );

          return (
            <View key={fromKey} style={styles.tierCard}>
              {/* Source Tier Node */}
              <View style={styles.sourceRow}>
                {/* Connecting Origin Dot */}
                <View style={[styles.originDot, { backgroundColor: fromTheme.primary }]} />

                <View style={styles.sourceTextWrap}>
                  <View style={styles.titlePriceRow}>
                    <Text style={styles.tierTitle} numberOfLines={1}>
                      {fromTier.name || `Tier ${fromIdx + 1}`}
                    </Text>
                    <Text style={styles.tierPrice}>₹{fromPrice}</Text>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <View
                      style={[
                        styles.genderTag,
                        { backgroundColor: fromTheme.bg, borderColor: fromTheme.border },
                      ]}
                    >
                      <Text style={[styles.genderTagText, { color: fromTheme.badgeText }]}>
                        {fromTheme.label}
                      </Text>
                    </View>

                    {hasAccessModes && (() => {
                      const modeInfo = getAccessModeInfo(fromTier.access_mode);
                      const ModeIcon = modeInfo.icon;
                      return (
                        <View
                          style={[
                            styles.accessModePill,
                            { backgroundColor: modeInfo.bg, borderColor: modeInfo.border },
                          ]}
                        >
                          <ModeIcon size={10} color={modeInfo.color} strokeWidth={2.2} />
                          <Text style={[styles.accessModeText, { color: modeInfo.color }]}>
                            {modeInfo.label}
                          </Text>
                        </View>
                      );
                    })()}
                  </View>
                </View>
              </View>

              {/* Connector Line and Flow Marker */}
              <View style={styles.flowRow}>
                <View style={styles.connectorLine} />
                <View style={styles.flowLabelRow}>
                  <ArrowRight size={13} color="#94A3B8" strokeWidth={2} />
                  <Text style={styles.flowLabel}>Can switch to:</Text>
                </View>
              </View>

              {/* Destination Options */}
              <View style={styles.destinationsContainer}>
                {candidateTiers.length === 0 ? (
                  <Text style={styles.emptyNote}>Add another ticket tier to configure switching.</Text>
                ) : compatibleCandidates.length === 0 ? (
                  <View style={styles.incompatibleNotice}>
                    <AlertCircle size={13} color="#F59E0B" strokeWidth={2} />
                    <Text style={styles.incompatibleNoticeText}>
                      No other {fromGender === "male" ? "Men" : "Women"} tiers to switch into.
                    </Text>
                  </View>
                ) : (
                  candidateTiers.map((toTier, toIdx) => {
                    const toKey = getTierKey(toTier, toIdx);
                    const toGender = getGender(toTier);
                    const toTheme = GENDER_THEMES[toGender];
                    const toPrice = parseFloat(toTier.base_price) || 0;
                    const priceDiff = toPrice - fromPrice;

                    // Invariant: strictly lock cross-gender
                    const isGenderLocked =
                      (fromGender === "male" && toGender === "female") ||
                      (fromGender === "female" && toGender === "male");

                    const isSelected = activeTargets.has(toKey);

                    if (isGenderLocked) {
                      return (
                        <View
                          key={toKey}
                          style={[styles.destinationCard, styles.destinationLocked]}
                        >
                          <View style={styles.destLeft}>
                            <Lock size={13} color="#94A3B8" strokeWidth={2} />
                            <Text style={styles.destLockedTitle} numberOfLines={1}>
                              {toTier.name} (₹{toPrice})
                            </Text>
                          </View>
                          <View style={styles.lockedBadge}>
                            <Text style={styles.lockedBadgeText}>
                              {toGender === "male" ? "Men only" : "Women only"}
                            </Text>
                          </View>
                        </View>
                      );
                    }

                    return (
                      <TouchableOpacity
                        key={toKey}
                        activeOpacity={0.7}
                        onPress={() => togglePair(fromKey, toKey)}
                        style={[
                          styles.destinationCard,
                          isSelected && {
                            borderColor: fromTheme.primary,
                            backgroundColor: fromTheme.bg,
                          },
                        ]}
                      >
                        <View style={styles.destLeft}>
                          {/* Checkbox indicator */}
                          <View
                            style={[
                              styles.checkbox,
                              isSelected && {
                                backgroundColor: fromTheme.primary,
                                borderColor: fromTheme.primary,
                              },
                            ]}
                          >
                            {isSelected && <Check size={11} color="#FFFFFF" strokeWidth={2.5} />}
                          </View>

                          <View style={styles.destTextWrap}>
                            <Text style={styles.destTitle} numberOfLines={1}>
                              {toTier.name}
                            </Text>
                            <Text style={styles.destSubtext}>
                              ₹{toPrice} •{" "}
                              {priceDiff > 0 ? (
                                <Text style={styles.upgradeText}>+₹{priceDiff} (Upgrade)</Text>
                              ) : priceDiff < 0 ? (
                                <Text style={styles.downgradeText}>
                                  -₹{Math.abs(priceDiff)} (Downgrade)
                                </Text>
                              ) : (
                                "Same price"
                              )}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          {hasAccessModes && (() => {
                            const destModeInfo = getAccessModeInfo(toTier.access_mode);
                            const DestModeIcon = destModeInfo.icon;
                            return (
                              <View
                                style={[
                                  styles.accessModePill,
                                  { backgroundColor: destModeInfo.bg, borderColor: destModeInfo.border },
                                ]}
                              >
                                <DestModeIcon size={9} color={destModeInfo.color} strokeWidth={2.2} />
                                <Text style={[styles.accessModeText, { color: destModeInfo.color, fontSize: 10 }]}>
                                  {destModeInfo.label}
                                </Text>
                              </View>
                            );
                          })()}

                          <View
                            style={[
                              styles.destGenderPill,
                              { backgroundColor: toTheme.bg, borderColor: toTheme.border },
                            ]}
                          >
                            <Text style={[styles.destGenderText, { color: toTheme.badgeText }]}>
                              {toGender === "male" ? "Men" : toGender === "female" ? "Women" : "All"}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
  },
  header: {
    marginBottom: 16,
  },
  headerInfo: {
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "#DCFCE7",
  },
  statusBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: "#15803D",
  },
  helperText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#EEF2FF",
  },
  clearBtn: {
    backgroundColor: "#FEE2E2",
  },
  actionBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.primary,
  },
  cardsList: {
    gap: 16,
  },
  tierCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  originDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  sourceTextWrap: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titlePriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  tierTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  tierPrice: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  genderTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  genderTagText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
  },
  accessModePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  accessModeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
  },
  flowRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
    paddingLeft: 5,
  },
  connectorLine: {
    width: 2,
    height: 14,
    backgroundColor: "#CBD5E1",
    marginRight: 12,
  },
  flowLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  flowLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#64748B",
  },
  destinationsContainer: {
    gap: 8,
    paddingLeft: 16,
  },
  destinationCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  destinationLocked: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
    opacity: 0.6,
  },
  destLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#94A3B8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  destTextWrap: {
    flex: 1,
  },
  destTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  destSubtext: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  destLockedTitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: "#64748B",
  },
  upgradeText: {
    color: "#16A34A",
    fontFamily: FONTS.semiBold,
  },
  downgradeText: {
    color: "#D97706",
    fontFamily: FONTS.semiBold,
  },
  destGenderPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  destGenderText: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
  },
  lockedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#E2E8F0",
  },
  lockedBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: "#64748B",
  },
  emptyNote: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: "#94A3B8",
    fontStyle: "italic",
  },
  incompatibleNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#FEF3C7",
  },
  incompatibleNoticeText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#B45309",
  },
});
