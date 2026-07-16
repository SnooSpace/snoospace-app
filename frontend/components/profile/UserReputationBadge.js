import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Users } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import { getUserReputation } from '../../api/reviews';
import { getAuthToken } from '../../api/auth';

/**
 * UserReputationBadge
 *
 * Displays the user's people-reputation.
 * - status='building' → neutral pill: "Building reputation"
 * - status='active'   → "{percentage}% would meet again"
 * - No percentage shown until server returns status='active' (≥5 ratings gate)
 *
 * Props:
 *   userId   — BIGINT member ID to fetch reputation for
 *   style    — optional outer container style override
 *   compact  — if true, hides icon and renders inline text only
 */
export default function UserReputationBadge({ userId, style, compact = false }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      try {
        const token = await getAuthToken();
        const result = await getUserReputation(userId, token);
        if (!cancelled) setData(result);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return (
      <View style={[styles.pill, styles.pillBuilding, style]}>
        <ActivityIndicator size="small" color={COLORS.textMuted} />
      </View>
    );
  }

  if (error || !data) return null;

  const isActive   = data.status === 'active';
  const percentage = data.percentage ?? 0;

  if (compact) {
    return (
      <Text style={[styles.compactText, isActive && styles.compactTextActive]}>
        {isActive ? `${percentage}% would meet again` : 'Building reputation'}
      </Text>
    );
  }

  return (
    <View style={[
      styles.pill,
      isActive ? styles.pillActive : styles.pillBuilding,
      style,
    ]}>
      <Users
        size={13}
        color={isActive ? COLORS.primary : COLORS.textMuted}
        strokeWidth={2}
        style={styles.icon}
      />
      <Text style={[styles.label, isActive && styles.labelActive]}>
        {isActive
          ? `${percentage}% would meet again`
          : 'Building reputation'}
      </Text>
      {isActive && data.sample_size_bucket && (
        <Text style={styles.bucket}>
          {data.sample_size_bucket} ratings
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 50,
    gap: 5,
  },
  pillBuilding: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pillActive: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  icon: {
    marginRight: 2,
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  labelActive: {
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
  },
  bucket: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textMuted,
    marginLeft: 2,
    opacity: 0.7,
  },
  compactText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  compactTextActive: {
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
  },
});
