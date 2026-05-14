/**
 * MetricBar — Animated horizontal labeled bar.
 *
 * Props:
 *   label        — string
 *   value        — number (raw, used for fill ratio)
 *   max          — number (denominator for ratio)
 *   displayValue — string (shown on the right; defaults to value.toLocaleString())
 *   color        — bar fill color
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { COLORS, FONTS } from '../../constants/theme';

export default function MetricBar({
  label,
  value,
  max,
  displayValue,
  color = COLORS.primary,
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: max > 0 ? value / max : 0,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [value, max]);

  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.val}>{displayValue ?? value.toLocaleString()}</Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: color,
              width: anim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: 12 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontFamily: FONTS.regular,   // Manrope Regular — helper text
    color: COLORS.textSecondary,
  },
  val: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,  // Manrope SemiBold — functional UI
    color: COLORS.textPrimary,
  },
  track: {
    height: 6,
    backgroundColor: COLORS.screenBackground,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
