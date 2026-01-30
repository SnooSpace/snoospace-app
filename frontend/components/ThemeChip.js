import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, BORDER_RADIUS, SPACING, FONTS } from "../constants/theme";
import { getInterestStyle } from "../screens/profile/member/EditProfileConstants";

const ThemeChip = ({ label, style, index = 0, useCategorizedStyle = true }) => {
  if (useCategorizedStyle) {
    const interestStyle = getInterestStyle(label);
    const Icon = interestStyle.icon;

    return (
      <View
        style={[
          styles.chip,
          { backgroundColor: interestStyle.bg, borderRadius: 999 },
          style,
        ]}
      >
        <View style={styles.content}>
          {Icon && (
            <Icon
              size={12}
              color={interestStyle.text}
              style={styles.icon}
              strokeWidth={2.5}
            />
          )}
          <Text
            style={[styles.text, { color: interestStyle.text }]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      </View>
    );
  }

  // Fallback to legacy behavior
  const colorSet = COLORS.semantic[index % COLORS.semantic.length];

  return (
    <View style={[styles.chip, { backgroundColor: colorSet.bg }, style]}>
      <Text style={[styles.text, { color: colorSet.text }]} numberOfLines={1}>
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
    alignSelf: "flex-start",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
});

export default ThemeChip;
