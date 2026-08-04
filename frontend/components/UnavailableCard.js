import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";

/**
 * UnavailableCard — styled like a chat message bubble for deleted/unsent shared items.
 * Text styled identically to "This message was unsent" (italic, soft muted text, left-aligned).
 * Logs missing item IDs internally for developer tracking.
 */
const UnavailableCard = ({ label = "Post", id, isMyMessage = false }) => {
  useEffect(() => {
    if (id) {
      console.warn(`[UnavailableCard] ${label} no longer available. ID: ${id}`);
    }
  }, [label, id]);

  return (
    <View
      style={[
        styles.bubble,
        isMyMessage ? styles.myBubble : styles.otherBubble,
      ]}
    >
      <Text style={styles.text} numberOfLines={1}>
        {label} no longer available
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
    marginVertical: 2,
  },
  myBubble: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 16,
  },
  otherBubble: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 16,
  },
  text: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    fontStyle: "italic",
    color: "#8E8E93",
  },
});

export default UnavailableCard;
