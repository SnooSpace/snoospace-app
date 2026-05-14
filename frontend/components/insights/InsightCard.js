/**
 * InsightCard — Reusable card wrapper used by all 4 insight tabs.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, BORDER_RADIUS } from '../../constants/theme';

export default function InsightCard({ title, subtitle, children, style }) {
  return (
    <View style={[styles.card, style]}>
      {title && <Text style={styles.title}>{title}</Text>}
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.m,
    padding: 14,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: 13,
    fontFamily: FONTS.primary,   // BasicCommercialBold — section titles
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,   // Manrope Regular — helper text
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
});
