/**
 * StatGrid — 2×N metric grid for quick summary stats.
 *
 * Props:
 *   stats: Array<{ label: string, value: string|number, sub?: string, subColor?: string }>
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, BORDER_RADIUS } from '../../constants/theme';

export default function StatGrid({ stats }) {
  return (
    <View style={styles.grid}>
      {stats.map((s, i) => (
        <View key={i} style={styles.cell}>
          <Text style={styles.label}>{s.label}</Text>
          <Text style={styles.value}>{s.value}</Text>
          {s.sub ? (
            <Text style={[styles.sub, s.subColor ? { color: s.subColor } : null]}>
              {s.sub}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  cell: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.s,
    padding: 14,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  label: {
    fontSize: 10,
    fontFamily: FONTS.medium,    // Manrope Medium — metadata
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    fontSize: 22,
    fontFamily: FONTS.semiBold,  // Manrope SemiBold — numbers
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  sub: {
    fontSize: 11,
    fontFamily: FONTS.regular,   // Manrope Regular — helper text
    color: COLORS.textSecondary,
  },
});
