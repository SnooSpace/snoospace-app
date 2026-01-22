/**
 * Global Text Configuration
 *
 * This file provides a custom Text component that automatically applies
 * the Basic Commercial Bold font to all text in the app.
 *
 * Usage:
 * 1. Import this instead of React Native's Text:
 *    import { Text } from '../components/StyledText';
 *
 * 2. Or set it globally in your component files
 */

import React from "react";
import { Text as RNText, StyleSheet } from "react-native";
import { FONTS } from "../constants/theme";

export function Text(props) {
  const { style, ...otherProps } = props;

  return <RNText {...otherProps} style={[styles.defaultFont, style]} />;
}

const styles = StyleSheet.create({
  defaultFont: {
    fontFamily: FONTS.primary,
  },
});

export default Text;
