import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Briefcase, ArrowRight } from "lucide-react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.68;

/**
 * SharedOpportunityCard — compact preview rendered in chat when
 * someone shares an opportunity (message_type === "opportunity_share").
 *
 * Metadata shape (from shareOpportunity backend):
 *   { opportunityId, title, opportunityTypes, creatorId, creatorType,
 *     creatorName, creatorUsername }
 */
const SharedOpportunityCard = ({ metadata, onPress, style }) => {
  if (!metadata) return null;

  const {
    opportunityId,
    title,
    opportunityTypes,
    creatorName,
    creatorUsername,
  } = metadata;

  // Normalise opportunity_types — could be array or comma-string
  const types = Array.isArray(opportunityTypes)
    ? opportunityTypes
    : typeof opportunityTypes === "string" && opportunityTypes.length > 0
    ? opportunityTypes.split(",").map((t) => t.trim())
    : [];

  const displayTypes = types.slice(0, 2);

  const handlePress = () => {
    if (onPress && opportunityId) onPress(opportunityId);
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handlePress}
      activeOpacity={0.85}
    >
      {/* Header accent bar */}
      <View style={styles.accentBar} />

      <View style={styles.body}>
        {/* Icon + label */}
        <View style={styles.iconRow}>
          <View style={styles.iconWrap}>
            <Briefcase size={16} color="#5B4FE9" strokeWidth={2} />
          </View>
          <Text style={styles.label}>Opportunity</Text>
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {title || "Untitled Opportunity"}
        </Text>

        {/* Type chips */}
        {displayTypes.length > 0 && (
          <View style={styles.chipsRow}>
            {displayTypes.map((t, i) => (
              <View key={i} style={styles.chip}>
                <Text style={styles.chipText}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Creator */}
        {(creatorName || creatorUsername) && (
          <Text style={styles.creator} numberOfLines={1}>
            by{" "}
            {creatorName ||
              (creatorUsername ? `@${creatorUsername}` : "Community")}
          </Text>
        )}

        {/* CTA */}
        <View style={styles.cta}>
          <Text style={styles.ctaText}>View Opportunity</Text>
          <ArrowRight size={13} color="#5B4FE9" strokeWidth={2.5} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    marginVertical: 6,
    alignSelf: "flex-start",
    shadowColor: "#5B4FE9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  accentBar: {
    height: 4,
    backgroundColor: "#5B4FE9",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  body: {
    padding: 14,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#F0EEFF",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 11,
    color: "#5B4FE9",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 15,
    color: "#1A1826",
    lineHeight: 20,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    backgroundColor: "#F0EEFF",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: {
    fontFamily: "Manrope-Medium",
    fontSize: 11,
    color: "#5B4FE9",
  },
  creator: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: "#8E8E93",
    marginBottom: 10,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
    paddingTop: 10,
  },
  ctaText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
    color: "#5B4FE9",
  },
});

export default SharedOpportunityCard;
