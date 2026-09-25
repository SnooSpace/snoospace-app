import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { FONTS } from "../../constants/theme";

/**
 * ActiveBadge — shows the user's online/active status
 * 
 * Props:
 *   lastActiveAt: ISO timestamp string | null
 *   size: "small" | "medium" (default: "small")
 *   style: optional container style override
 */
const getActiveInfo = (lastActiveAt) => {
  if (!lastActiveAt) return null;

  const diffMs = Date.now() - new Date(lastActiveAt).getTime();
  if (diffMs < 0) return { text: "Active now", color: "#22C55E", dotColor: "#22C55E" };

  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 5)   return { text: "Active now",               color: "#22C55E", dotColor: "#22C55E" };
  if (diffMin < 60)  return { text: `Active ${diffMin}m ago`,    color: "#22C55E", dotColor: "#22C55E" };
  if (diffHrs < 24)  return { text: `Active ${diffHrs}h ago`,    color: "#F59E0B", dotColor: "#F59E0B" };
  if (diffDays < 1)  return { text: "Active today",              color: "#F59E0B", dotColor: "#F59E0B" };
  if (diffDays <= 7) return { text: `Active ${diffDays}d ago`,   color: "#9CA3AF", dotColor: "#9CA3AF" };
  return null; // Don't show if >7 days inactive
};

const ActiveBadge = React.memo(({ lastActiveAt, size = "small", style }) => {
  const info = getActiveInfo(lastActiveAt);
  if (!info) return null;

  const isSmall = size === "small";
  const dotSize = isSmall ? 6 : 8;
  const fontSize = isSmall ? 11 : 13;

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.dot, { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: info.dotColor }]} />
      <Text style={[styles.text, { fontSize, color: info.color }]}>{info.text}</Text>
    </View>
  );
});

// Also export the helper for use in other components (e.g. 3-dot menu rows)
export { getActiveInfo };
export default ActiveBadge;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    // Dynamic sizing applied inline
  },
  text: {
    fontFamily: FONTS.medium,
    // Dynamic sizing applied inline
  },
});
