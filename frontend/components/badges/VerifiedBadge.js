import React, { useState } from "react";
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
    body: "Confirms this person's identity for hosting and joining Open Plans.",
    color: "#00BFA5",
    badgeBg: "rgba(0, 191, 165, 0.12)",
  },
  selfie_verified: {
    key: "selfie_verified",
    title: "Discover verified",
    body: "Confirms this person's Discover photos match their live verification video. Also grants Open Plans access.",
    color: "#2962FF",
    badgeBg: "rgba(41, 98, 255, 0.10)",
  },
  discover_verified: {
    key: "selfie_verified",
    title: "Discover verified",
    body: "Confirms this person's Discover photos match their live verification video. Also grants Open Plans access.",
    color: "#2962FF",
    badgeBg: "rgba(41, 98, 255, 0.10)",
  },
  id_verified: {
    key: "id_verified",
    title: "ID verified",
    body: "The highest verification level, confirmed with official ID.",
    color: "#2962FF",
    badgeBg: "rgba(41, 98, 255, 0.10)",
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

  if (!resolvedTier || !TIER_CONFIG[resolvedTier]) {
    return null;
  }

  const badgeConfig = TIER_CONFIG[resolvedTier];

  const handleBadgePress = () => {
    HapticsService.triggerImpactLight();
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
          {/* Badge Icon Container */}
          <View style={[styles.iconContainer, { backgroundColor: badgeConfig.badgeBg }]}>
            <RosetteBadgeIcon color={badgeConfig.color} size={36} />
          </View>

          {/* Title */}
          <Text style={styles.sheetTitle}>{badgeConfig.title}</Text>

          {/* Description */}
          <Text style={styles.sheetBody}>{badgeConfig.body}</Text>

          {/* Got it button */}
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: badgeConfig.color }]}
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
    paddingHorizontal: 24,
    paddingTop: 8,
    backgroundColor: "#FFFFFF",
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  sheetTitle: {
    fontFamily: FONTS.basicCommercialBold,
    fontSize: 22,
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 10,
  },
  sheetBody: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 8,
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
