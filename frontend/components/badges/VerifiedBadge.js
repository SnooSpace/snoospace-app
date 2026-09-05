import React, { useState } from 'react';
import { StyleSheet, View, Text, Pressable, TouchableOpacity } from 'react-native';
import { BadgeCheck } from 'lucide-react-native';
import SwipeableModal from '../modals/SwipeableModal';
import { COLORS, FONTS } from '../../constants/theme';

const TIER_CONFIG = {
  plans_verified: {
    title: 'Plans Verified',
    body: "This confirms identity for hosting and joining Open Plans, but doesn't vouch for their Discover photos.",
    color: COLORS.secondary,
    badgeBg: 'rgba(0, 191, 165, 0.12)',
    label: 'Open Plans Access',
  },
  selfie_verified: {
    title: 'Discover Verified',
    body: 'Their Discover photos are confirmed to match their live video, and this also grants Open Plans access.',
    color: COLORS.primary,
    badgeBg: 'rgba(41, 98, 255, 0.10)',
    label: 'Discover + Plans Access',
  },
  id_verified: {
    title: 'ID Verified',
    body: 'This is the highest verification level, verified with official government identification.',
    color: COLORS.primary,
    badgeBg: 'rgba(41, 98, 255, 0.10)',
    label: 'Highest Trust Level',
  },
};

export default function VerifiedBadge({ tier, size = 16, style }) {
  const [modalVisible, setModalVisible] = useState(false);

  if (!tier || tier === 'none' || !TIER_CONFIG[tier]) {
    return null;
  }

  const config = TIER_CONFIG[tier];

  return (
    <>
      <Pressable
        onPress={() => setModalVisible(true)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={({ pressed }) => [
          styles.badgePressable,
          pressed && styles.badgePressed,
          style,
        ]}
      >
        <BadgeCheck size={size} color={config.color} strokeWidth={2} />
      </Pressable>

      <SwipeableModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.sheetContent}>
          <View style={[styles.iconContainer, { backgroundColor: config.badgeBg }]}>
            <BadgeCheck size={32} color={config.color} strokeWidth={2} />
          </View>

          <Text style={styles.sheetTitle}>{config.title}</Text>

          <View style={[styles.tagContainer, { backgroundColor: config.badgeBg }]}>
            <Text style={[styles.tagText, { color: config.color }]}>{config.label}</Text>
          </View>

          <Text style={styles.sheetBody}>{config.body}</Text>

          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: config.color }]}
            onPress={() => setModalVisible(false)}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePressed: {
    opacity: 0.7,
  },
  sheetContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: FONTS.basicCommercialBold,
    fontSize: 20,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  tagContainer: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 16,
  },
  tagText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  sheetBody: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  closeButton: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
