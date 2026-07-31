import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";

/**
 * UnavailableCard — styled like a chat message bubble for deleted/unsent shared items.
 * Text styled identically to "This message was unsent" (italic, soft muted text, left-aligned).
 * Logs missing item IDs internally for developer tracking.
 */
const UnavailableCard = ({ label = "Post", id }) => {
  useEffect(() => {
    if (id) {
      console.warn(`[UnavailableCard] ${label} no longer available. ID: ${id}`);
    }
  }, [label, id]);

  return (
    <View style={styles.bubble}>
      <Text style={styles.text}>{label} no longer available</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  bubble: {
    alignSelf: "flex-start",
    backgroundColor: "#F3F4F6",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    maxWidth: "85%",
    marginVertical: 2,
  },
  text: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    fontStyle: "italic",
    color: "#8E8E93",
    textAlign: "left",
  },
});

export default UnavailableCard;
