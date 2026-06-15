import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Instagram, Unlink, ExternalLink } from 'lucide-react-native';
import HapticsService from '../../../services/HapticsService';
import { COLORS, FONTS, SHADOWS, BORDER_RADIUS } from '../../../constants/theme';
import { buildInstagramUrl } from '../../../utils/instagramUtils';

/**
 * LinkedAccountsScreen
 *
 * Displays the user's linked social accounts (Instagram only for now).
 * Navigated to from SettingsScreen.
 *
 * Props via route.params:
 *   - instagramUsername: string | null   (current linked username)
 *   - onUnlink: () => void               (callback to clear from SettingsScreen/Profile)
 */
export default function LinkedAccountsScreen({ route, navigation }) {
  const { instagramUsername: initialUsername, onUnlink } = route?.params || {};
  const [instagramUsername] = useState(initialUsername || null);

  const handleOpenInstagram = useCallback(async () => {
    if (!instagramUsername) return;
    HapticsService.triggerImpactLight();
    const url = buildInstagramUrl(instagramUsername);
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Open Instagram', `Visit instagram.com/${instagramUsername}`);
      }
    } catch {
      Alert.alert('Error', `Could not open https://www.instagram.com/${instagramUsername}`);
    }
  }, [instagramUsername]);

  const handleManage = useCallback(() => {
    HapticsService.triggerImpactLight();
    // Navigate to EditProfile — user can update / remove from the Social Profiles card
    navigation.navigate('EditProfile');
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <ArrowLeft size={24} color={COLORS.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Linked Accounts</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Section label */}
        <Text style={styles.sectionLabel}>SOCIAL PROFILES</Text>

        {/* Instagram card */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            {/* Icon */}
            <View style={styles.iconCircle}>
              <Instagram size={22} color="#EC4899" strokeWidth={1.8} />
            </View>

            {/* Info */}
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Instagram</Text>
              {instagramUsername ? (
                <Text style={styles.cardSub} numberOfLines={1}>
                  @{instagramUsername}
                </Text>
              ) : (
                <Text style={[styles.cardSub, styles.cardSubMuted]}>
                  Not linked
                </Text>
              )}
            </View>

            {/* Status badge */}
            {instagramUsername ? (
              <View style={styles.linkedBadge}>
                <Text style={styles.linkedBadgeText}>Linked</Text>
              </View>
            ) : (
              <View style={styles.notLinkedBadge}>
                <Text style={styles.notLinkedBadgeText}>Not linked</Text>
              </View>
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Actions */}
          {instagramUsername ? (
            <View style={styles.actionsRow}>
              {/* View on Instagram */}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleOpenInstagram}
                activeOpacity={0.75}
              >
                <ExternalLink size={15} color={COLORS.primary} strokeWidth={2} />
                <Text style={styles.actionBtnText}>View Profile</Text>
              </TouchableOpacity>

              {/* Manage (go to Edit Profile) */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSecondary]}
                onPress={handleManage}
                activeOpacity={0.75}
              >
                <Unlink size={15} color={COLORS.textSecondary} strokeWidth={2} />
                <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>
                  Change / Remove
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={handleManage}
              activeOpacity={0.75}
            >
              <Instagram size={16} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.linkBtnText}>Link Instagram</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Explainer */}
        <Text style={styles.explainer}>
          Linking your Instagram shows a trust signal on your profile so other
          members know you're a real person. SnooSpace never posts on your behalf
          and does not require Instagram login.
        </Text>

        {/* Future placeholder — more platforms coming later */}
        <Text style={styles.comingSoon}>More platforms coming soon.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    backgroundColor: '#FFFFFF',
    minHeight: 56,
  },
  backBtn: {
    padding: 12,
  },
  headerTitle: {
    fontFamily: FONTS.primary,
    fontSize: 17,
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },
  headerRight: {
    width: 48,
  },

  // Content
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },

  sectionLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginLeft: 4,
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.xl,
    padding: 18,
    ...SHADOWS.sm,
    shadowOpacity: 0.05,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    marginBottom: 16,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(244, 114, 182, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontFamily: FONTS.primary,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  cardSub: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  cardSubMuted: {
    color: COLORS.textMuted,
  },

  // Badges
  linkedBadge: {
    backgroundColor: 'rgba(236, 72, 153, 0.10)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.pill,
  },
  linkedBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: '#EC4899',
  },
  notLinkedBadge: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.pill,
  },
  notLinkedBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textMuted,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginBottom: 14,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(41, 98, 255, 0.08)',
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.m,
  },
  actionBtnSecondary: {
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  actionBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.primary,
  },
  actionBtnTextSecondary: {
    color: COLORS.textSecondary,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EC4899',
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.m,
  },
  linkBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },

  // Explainer
  explainer: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    marginHorizontal: 4,
    marginBottom: 12,
  },
  comingSoon: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textMuted,
    marginHorizontal: 4,
    textAlign: 'center',
  },
});
