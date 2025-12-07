import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../constants/theme';

const ThemeChip = ({ label, style, index = 0 }) => {
  // Cycle through semantic colors based on index or simple hash
  const colorSet = COLORS.semantic[index % COLORS.semantic.length];

  return (
    <View style={[
      styles.chip, 
      { backgroundColor: colorSet.bg },
      style
    ]}>
      <Text style={[styles.text, { color: colorSet.text }]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.m,
    marginRight: 8,
    marginBottom: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  }
});

export default ThemeChip;
