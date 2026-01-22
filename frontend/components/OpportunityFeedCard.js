import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../constants/theme";

const OpportunityFeedCard = ({ opportunity, onPress }) => {
  const formatTimeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(opportunity)}
      activeOpacity={0.85}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.creatorInfo}>
          {opportunity.creator_photo ? (
            <Image
              source={{ uri: opportunity.creator_photo }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="business" size={16} color="#FFFFFF" />
            </View>
          )}
          <View style={styles.creatorText}>
            <Text style={styles.creatorName} numberOfLines={1}>
              {opportunity.creator_name}
            </Text>
            <Text style={styles.timeAgo}>
              {formatTimeAgo(opportunity.created_at)} · Hiring
            </Text>
          </View>
        </View>
        <View style={styles.hiringBadge}>
          <Ionicons name="briefcase" size={12} color="#8B5CF6" />
          <Text style={styles.hiringText}>Opportunity</Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {opportunity.title}
        </Text>

        {/* Role Tags */}
        <View style={styles.rolesContainer}>
          {(opportunity.opportunity_types || opportunity.roles || [])
            .slice(0, 3)
            .map((role, index) => (
              <View key={index} style={styles.roleTag}>
                <Text style={styles.roleTagText}>{role}</Text>
              </View>
            ))}
          {(opportunity.opportunity_types || opportunity.roles || []).length >
            3 && (
            <Text style={styles.moreRoles}>
              +{(opportunity.opportunity_types || opportunity.roles).length - 3}
            </Text>
          )}
        </View>

        {/* Meta Info */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons
              name={
                opportunity.work_mode === "remote"
                  ? "globe-outline"
                  : "location-outline"
              }
              size={14}
              color={COLORS.textSecondary}
            />
            <Text style={styles.metaText}>
              {opportunity.work_mode === "remote" ? "Remote" : "On-site"}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons
              name="cash-outline"
              size={14}
              color={COLORS.textSecondary}
            />
            <Text style={styles.metaText}>
              {opportunity.payment_nature === "paid"
                ? "Paid"
                : opportunity.payment_nature}
            </Text>
          </View>
          {opportunity.applicant_count > 0 && (
            <View style={styles.metaItem}>
              <Ionicons
                name="people-outline"
                size={14}
                color={COLORS.textSecondary}
              />
              <Text style={styles.metaText}>
                {opportunity.applicant_count} applied
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Apply CTA */}
      <TouchableOpacity
        style={styles.applyButton}
        onPress={() => onPress?.(opportunity)}
      >
        <LinearGradient
          colors={["#8B5CF6", "#6366F1"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.applyGradient}
        >
          <Text style={styles.applyText}>View & Apply</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  creatorInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#8B5CF6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  creatorText: {
    flex: 1,
  },
  creatorName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  timeAgo: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  hiringBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#8B5CF620",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  hiringText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8B5CF6",
  },
  content: {
    padding: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 12,
    lineHeight: 22,
  },
  rolesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  roleTag: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  roleTagText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textPrimary,
  },
  moreRoles: {
    fontSize: 13,
    color: COLORS.textSecondary,
    alignSelf: "center",
  },
  metaRow: {
    flexDirection: "row",
    gap: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  applyButton: {
    margin: 14,
    marginTop: 0,
    borderRadius: 12,
    overflow: "hidden",
  },
  applyGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  applyText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

export default OpportunityFeedCard;
