import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, FONTS } from "../constants/theme";

const OpportunityFeedCard = ({ opportunity, onPress }) => {
  const formatTimeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getCompensationText = () => {
    if (opportunity.payment_nature === "paid") return "Paid";
    if (opportunity.payment_nature === "unpaid") return "Unpaid";
    return opportunity.payment_nature || "Negotiable";
  };

  const username = opportunity.creator_name
    ? `@${opportunity.creator_name.replace(/\s+/g, "").toLowerCase()}`
    : "@anonymous";

  const tags = (opportunity.opportunity_types || opportunity.roles || []).slice(
    0,
    5,
  );

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress?.(opportunity)}
    >
      <LinearGradient
        colors={["#C8E9EA", "#E8F7F8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Header Row: Badge & Icon */}
        <View style={styles.headerRow}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>GIG</Text>
          </View>
          <View style={styles.iconContainer}>
            <Ionicons name="briefcase" size={24} color="#2D3748" />
          </View>
        </View>

        {/* Author Row */}
        <View style={styles.authorRow}>
          <Image
            source={
              opportunity.creator_photo
                ? { uri: opportunity.creator_photo }
                : { uri: "https://via.placeholder.com/24" }
            }
            style={styles.authorAvatar}
          />
          <Text style={styles.authorUsername} numberOfLines={1}>
            {username}
          </Text>
          <Text style={styles.separator}>•</Text>
          <Text style={styles.timestamp}>
            {formatTimeAgo(opportunity.created_at)}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {opportunity.title}
        </Text>

        {/* Tags Row */}
        {tags.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tagsContainer}
            contentContainerStyle={styles.tagsContent}
          >
            {tags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Details Row */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Ionicons name="globe-outline" size={16} color="#5e8d9b" />
            <Text style={styles.detailText}>
              {opportunity.work_mode === "remote" ? "Remote" : "On-site"}
            </Text>
          </View>
          <Text style={styles.detailSeparator}>•</Text>
          <View style={styles.detailItem}>
            <Ionicons name="cash-outline" size={16} color="#5e8d9b" />
            <Text style={styles.detailText}>{getCompensationText()}</Text>
          </View>
        </View>

        {/* Footer Row */}
        <View style={styles.footerRow}>
          {/* Applicant Stack / Count */}
          <View style={styles.applicantStack}>
            {opportunity.applicants && opportunity.applicants.length > 0 ? (
              <>
                {opportunity.applicants.slice(0, 3).map((applicant, index) => (
                  <Image
                    key={index}
                    source={{ uri: applicant.photo_url }}
                    style={[
                      styles.applicantAvatar,
                      { marginLeft: index > 0 ? -10 : 0 },
                    ]}
                  />
                ))}
                {opportunity.applicant_count > 3 && (
                  <Text style={styles.applicantCount}>
                    +{opportunity.applicant_count - 3}
                  </Text>
                )}
              </>
            ) : opportunity.applicant_count > 0 ? (
              <Text style={styles.applicantCountText}>
                {opportunity.applicant_count} applicants
              </Text>
            ) : (
              <Text style={styles.applicantCountText}>Be the first</Text>
            )}
          </View>

          {/* Apply Button */}
          <TouchableOpacity
            style={styles.applyButton}
            onPress={() => onPress?.(opportunity)}
          >
            <LinearGradient
              colors={["#448AFF", "#2962FF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.applyButtonGradient}
            >
              <Text style={styles.applyButtonText}>Apply Now</Text>
              <Ionicons
                name="arrow-forward"
                size={18}
                color="#FFFFFF"
                style={{ marginLeft: 6 }}
              />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    // Add shadow if needed, but gradient usually suffices
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  typeBadge: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4A5568",
    letterSpacing: 0.5,
  },
  iconContainer: {
    backgroundColor: "#FFFFFF",
    padding: 10,
    borderRadius: 25,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  authorUsername: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5e8d9b",
    maxWidth: 120,
  },
  separator: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5e8d9b",
    marginHorizontal: 4,
  },
  timestamp: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5e8d9b",
  },
  title: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 24,
    color: "#1D1D1F",
    marginTop: 12,
    marginBottom: 12,
    lineHeight: 30,
  },
  tagsContainer: {
    marginBottom: 16,
    maxHeight: 34,
  },
  tagsContent: {
    paddingRight: 16,
  },
  tag: {
    backgroundColor: "#E8F4FD",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  tagText: {
    fontSize: 12,
    color: "#3B82F6",
    fontWeight: "500",
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: "#1D1D1F",
    fontWeight: "500",
  },
  detailSeparator: {
    fontSize: 14,
    color: "#5e8d9b",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  applicantStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  applicantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  applicantCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
    marginLeft: 6,
  },
  applicantCountText: {
    fontSize: 13,
    color: "#5e8d9b",
    fontWeight: "500",
  },
  applyButton: {
    borderRadius: 16,
    overflow: "hidden",
    // Shadow for elevation
    shadowColor: "#2962FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  applyButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  applyButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});

export default OpportunityFeedCard;
