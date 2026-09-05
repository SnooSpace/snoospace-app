import React, { useState, useEffect } from "react";
import { StyleSheet, View, Text, Pressable, TouchableOpacity } from "react-native";
import Svg, { Path } from "react-native-svg";
import SwipeableModal from "../modals/SwipeableModal";
import { COLORS, FONTS } from "../../constants/theme";
import HapticsService from "../../services/HapticsService";

export const TIER_CONFIG = {
  plans_verified: {
    key: "plans_verified",
    title: "Plans verified",
    subtitle: "Teal · hosting & joining",
    label: "Teal · Hosting & Joining",
    body: "This confirms identity for hosting and joining Open Plans on SnooSpace. Members with this badge have completed identity verification for plan activities.",
    color: "#00BFA5",
    badgeBg: "rgba(0, 191, 165, 0.12)",
    borderTint: "rgba(0, 191, 165, 0.35)",
  },
  selfie_verified: {
    key: "selfie_verified",
    title: "Discover verified",
    subtitle: "Blue · photos match video",
    label: "Blue · Photos Match Video",
    body: "This confirms profile photos match the member's live video verification, ensuring authentic discovery. This also grants full access to host and join Open Plans.",
    color: "#2962FF",
    badgeBg: "rgba(41, 98, 255, 0.10)",
    borderTint: "rgba(41, 98, 255, 0.35)",
  },
  discover_verified: {
    key: "selfie_verified",
    title: "Discover verified",
    subtitle: "Blue · photos match video",
    label: "Blue · Photos Match Video",
    body: "This confirms profile photos match the member's live video verification, ensuring authentic discovery. This also grants full access to host and join Open Plans.",
    color: "#2962FF",
    badgeBg: "rgba(41, 98, 255, 0.10)",
    borderTint: "rgba(41, 98, 255, 0.35)",
  },
  id_verified: {
    key: "id_verified",
    title: "ID verified",
    subtitle: "Blue · official government ID",
    label: "Blue · Government ID",
    body: "This is the highest level of verification on SnooSpace, authenticated using official government-issued photo identification.",
    color: "#2962FF",
    badgeBg: "rgba(41, 98, 255, 0.10)",
    borderTint: "rgba(41, 98, 255, 0.35)",
  },
};

/**
 * RosetteBadgeIcon
 * Vector representation of the 12-point scalloped starburst rosette with a centered white checkmark,
 * matching Lucide badge-check geometry with solid fill and white stroke.
 */
export function RosetteBadgeIcon({ color, size = 16, style }) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
          fill={color}
        />
        <Path
          d="m9 12 2 2 4-4"
          stroke="#FFFFFF"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

export default function VerifiedBadge({ tier, isVerified, size = 16, style }) {
  const [modalVisible, setModalVisible] = useState(false);

  // Normalize tier input (handles isVerified boolean or explicit tier string)
  const resolvedTier =
    tier && tier !== "none"
      ? tier
      : isVerified
      ? "plans_verified"
      : null;

  const [selectedTier, setSelectedTier] = useState(resolvedTier || "plans_verified");

  useEffect(() => {
    if (resolvedTier && TIER_CONFIG[resolvedTier]) {
      setSelectedTier(resolvedTier);
    }
  }, [resolvedTier]);

  if (!resolvedTier || !TIER_CONFIG[resolvedTier]) {
    return null;
  }

  const badgeConfig = TIER_CONFIG[resolvedTier];
  const activeConfig = TIER_CONFIG[selectedTier] || badgeConfig;

  const handleBadgePress = () => {
    HapticsService.triggerImpactLight();
    setSelectedTier(resolvedTier);
    setModalVisible(true);
  };

  return (
    <>
      <Pressable
        onPress={handleBadgePress}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={({ pressed }) => [
          styles.badgePressable,
          pressed && styles.badgePressed,
          style,
        ]}
      >
        <RosetteBadgeIcon color={badgeConfig.color} size={size} />
      </Pressable>

      <SwipeableModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.sheetContent}>
          {/* Active Badge Hero Container */}
          <View style={[styles.iconContainer, { backgroundColor: activeConfig.badgeBg }]}>
            <RosetteBadgeIcon color={activeConfig.color} size={40} />
          </View>

          {/* Hero Title */}
          <Text style={styles.sheetTitle}>{activeConfig.title}</Text>

          {/* Pill / Subtitle Tag */}
          <View style={[styles.tagContainer, { backgroundColor: activeConfig.badgeBg }]}>
            <Text style={[styles.tagText, { color: activeConfig.color }]}>
              {activeConfig.label}
            </Text>
          </View>

          {/* Detailed Explanation */}
          <Text style={styles.sheetBody}>{activeConfig.body}</Text>

          {/* Reference Cards: SnooSpace Verification Badges */}
          <View style={styles.cardsSection}>
            <Text style={styles.sectionHeader}>Verification Tiers</Text>
            <View style={styles.cardsRow}>
              {/* Plans verified card */}
              <Pressable
                onPress={() => {
                  HapticsService.triggerImpactLight();
                  setSelectedTier("plans_verified");
                }}
                style={[
                  styles.referenceCard,
                  selectedTier === "plans_verified" && {
                    borderColor: TIER_CONFIG.plans_verified.color,
                    backgroundColor: TIER_CONFIG.plans_verified.badgeBg,
                  },
                ]}
              >
                <View style={styles.cardIconWrapper}>
                  <RosetteBadgeIcon color={TIER_CONFIG.plans_verified.color} size={24} />
                </View>
                <Text style={styles.cardTitle}>Plans verified</Text>
                <Text style={styles.cardSubtitle}>Teal · hosting & joining</Text>
              </Pressable>

              {/* Discover verified card */}
              <Pressable
                onPress={() => {
                  HapticsService.triggerImpactLight();
                  setSelectedTier("selfie_verified");
                }}
                style={[
                  styles.referenceCard,
                  (selectedTier === "selfie_verified" ||
                    selectedTier === "discover_verified" ||
                    selectedTier === "id_verified") && {
                    borderColor: TIER_CONFIG.selfie_verified.color,
                    backgroundColor: TIER_CONFIG.selfie_verified.badgeBg,
                  },
                ]}
              >
                <View style={styles.cardIconWrapper}>
                  <RosetteBadgeIcon color={TIER_CONFIG.selfie_verified.color} size={24} />
                </View>
                <Text style={styles.cardTitle}>Discover verified</Text>
                <Text style={styles.cardSubtitle}>Blue · photos match video</Text>
              </Pressable>
            </View>
          </View>

          {/* Got it button */}
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: activeConfig.color }]}
            onPress={() => {
              HapticsService.triggerImpactLight();
              setModalVisible(false);
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.closeButtonText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </SwipeableModal>
    </>
  );
}

const styles = StyleSheet.create({
  badgePressable: {
    alignItems: "center",
    justifyContent: "center",
  },
  badgePressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
  sheetContent: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  sheetTitle: {
    fontFamily: FONTS.basicCommercialBold,
    fontSize: 20,
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 8,
  },
  tagContainer: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 14,
  },
  tagText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  sheetBody: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 6,
  },
  cardsSection: {
    width: "100%",
    marginBottom: 20,
  },
  sectionHeader: {
    fontFamily: FONTS.basicCommercialBold,
    fontSize: 13,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  cardsRow: {
    flexDirection: "row",
    gap: 10,
  },
  referenceCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconWrapper: {
    marginBottom: 8,
  },
  cardTitle: {
    fontFamily: FONTS.basicCommercialBold,
    fontSize: 13,
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  closeButton: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#FFFFFF",
  },
});
