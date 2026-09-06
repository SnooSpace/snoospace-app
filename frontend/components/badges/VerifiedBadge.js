import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TouchableOpacity,
  Platform,
} from "react-native";
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
        sheetStyle={styles.sheet}
        header={
          <View style={styles.handleContainer}>
            <View style={styles.handleBar} />
          </View>
        }
      >
        <View style={styles.sheetContent}>
          {/* Active Badge Hero Container */}
          <View style={[styles.iconContainer, { backgroundColor: activeConfig.badgeBg }]}>
            <RosetteBadgeIcon color={activeConfig.color} size={36} />
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
                <View
                  style={[
                    styles.cardIconWrapper,
                    {
                      backgroundColor:
                        selectedTier === "plans_verified"
                          ? "#FFFFFF"
                          : TIER_CONFIG.plans_verified.badgeBg,
                    },
                  ]}
                >
                  <RosetteBadgeIcon color={TIER_CONFIG.plans_verified.color} size={22} />
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
                <View
                  style={[
                    styles.cardIconWrapper,
                    {
                      backgroundColor:
                        selectedTier === "selfie_verified" ||
                        selectedTier === "discover_verified" ||
                        selectedTier === "id_verified"
                          ? "#FFFFFF"
                          : TIER_CONFIG.selfie_verified.badgeBg,
                    },
                  ]}
                >
                  <RosetteBadgeIcon color={TIER_CONFIG.selfie_verified.color} size={22} />
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
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  handleContainer: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: "#FFFFFF",
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
  },
  sheetContent: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 4,
    backgroundColor: "#FFFFFF",
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  sheetTitle: {
    fontFamily: FONTS.basicCommercialBold,
    fontSize: 22,
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 6,
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
    lineHeight: 21,
    marginBottom: 22,
    paddingHorizontal: 10,
  },
  cardsSection: {
    width: "100%",
    marginBottom: 22,
  },
  sectionHeader: {
    fontFamily: FONTS.basicCommercialBold,
    fontSize: 12,
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  cardsRow: {
    flexDirection: "row",
    gap: 12,
  },
  referenceCard: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
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
    lineHeight: 15,
  },
  closeButton: {
    width: "100%",
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#FFFFFF",
  },
});
