import React, { useState, useEffect, useLayoutEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getOpportunityDetail } from "../../../api/opportunities";

const { width } = Dimensions.get("window");
const COLORS = {
  background: "#FAFAFA",
  card: "#FFFFFF",
  primary: "#007AFF",
  text: "#1A1A2E",
  textLight: "#6B7280",
  border: "#E5E7EB",
  success: "#10B981",
  warning: "#F59E0B",
};

const EXPERIENCE_LABELS = {
  beginner: { label: "Beginner", color: "#10B981" },
  intermediate: { label: "Intermediate", color: "#F59E0B" },
  expert: { label: "Expert", color: "#EF4444" },
  any: { label: "Any Level", color: "#6B7280" },
};

const WORK_MODE_ICONS = {
  remote: "globe-outline",
  onsite: "location-outline",
  hybrid: "git-branch-outline",
};

export default function OpportunityViewScreen({ route, navigation }) {
  const { opportunityId, opportunity: passedOpportunity } = route.params || {};
  const [opportunity, setOpportunity] = useState(passedOpportunity || null);
  const [loading, setLoading] = useState(!passedOpportunity);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!passedOpportunity && opportunityId) {
      fetchOpportunity();
    }
  }, [opportunityId]);

  // Hide bottom tab bar
  useLayoutEffect(() => {
    navigation.getParent()?.setOptions({ tabBarStyle: { display: "none" } });
    return () => {
      navigation.getParent()?.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation]);

  const fetchOpportunity = async () => {
    try {
      setLoading(true);
      const response = await getOpportunityDetail(opportunityId);
      if (response?.success && response?.opportunity) {
        setOpportunity(response.opportunity);
      } else {
        setError("Failed to load opportunity");
      }
    } catch (err) {
      console.error("Error fetching opportunity:", err);
      setError("Failed to load opportunity details");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    navigation.navigate("ApplyToOpportunity", { opportunity });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading opportunity...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !opportunity) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={COLORS.textLight}
          />
          <Text style={styles.errorText}>
            {error || "Opportunity not found"}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const experienceInfo =
    EXPERIENCE_LABELS[opportunity.experience_level] || EXPERIENCE_LABELS.any;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Opportunity</Text>
        <TouchableOpacity style={styles.shareButton}>
          <Ionicons name="share-outline" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Title & Community */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>{opportunity.title}</Text>
          {opportunity.community_name && (
            <TouchableOpacity style={styles.communityRow}>
              <View style={styles.communityAvatar}>
                <Text style={styles.communityInitial}>
                  {opportunity.community_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.communityName}>
                {opportunity.community_name}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={COLORS.textLight}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Role Tags */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Roles</Text>
          <View style={styles.tagsContainer}>
            {(opportunity.opportunity_types || []).map((type, index) => (
              <View key={index} style={styles.roleTag}>
                <Text style={styles.roleTagText}>{type}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Info Cards */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Ionicons
              name={
                WORK_MODE_ICONS[opportunity.work_mode] || "briefcase-outline"
              }
              size={20}
              color={COLORS.primary}
            />
            <Text style={styles.infoLabel}>Work Mode</Text>
            <Text style={styles.infoValue}>
              {opportunity.work_mode?.charAt(0).toUpperCase() +
                opportunity.work_mode?.slice(1)}
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Ionicons name="time-outline" size={20} color={COLORS.primary} />
            <Text style={styles.infoLabel}>Type</Text>
            <Text style={styles.infoValue}>
              {opportunity.work_type === "ongoing" ? "Ongoing" : "One-time"}
            </Text>
          </View>
          <View style={styles.infoCard}>
            <View
              style={[
                styles.expBadge,
                { backgroundColor: experienceInfo.color + "20" },
              ]}
            >
              <Text
                style={[styles.expBadgeText, { color: experienceInfo.color }]}
              >
                {experienceInfo.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Requirements Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Requirements</Text>
          <View style={styles.requirementsList}>
            {opportunity.availability && (
              <View style={styles.requirementRow}>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={COLORS.textLight}
                />
                <Text style={styles.requirementText}>
                  <Text style={styles.requirementLabel}>Availability: </Text>
                  {opportunity.availability}
                </Text>
              </View>
            )}
            {opportunity.turnaround && (
              <View style={styles.requirementRow}>
                <Ionicons
                  name="hourglass-outline"
                  size={18}
                  color={COLORS.textLight}
                />
                <Text style={styles.requirementText}>
                  <Text style={styles.requirementLabel}>Turnaround: </Text>
                  {opportunity.turnaround}
                </Text>
              </View>
            )}
            {opportunity.timezone && (
              <View style={styles.requirementRow}>
                <Ionicons
                  name="globe-outline"
                  size={18}
                  color={COLORS.textLight}
                />
                <Text style={styles.requirementText}>
                  <Text style={styles.requirementLabel}>Timezone: </Text>
                  {opportunity.timezone}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Skills & Tools */}
        {opportunity.skill_groups?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills & Tools</Text>
            {opportunity.skill_groups.map((group, index) => (
              <View key={index} style={styles.skillGroup}>
                <Text style={styles.skillGroupRole}>{group.role}</Text>
                {group.tools?.length > 0 && (
                  <View style={styles.toolsRow}>
                    {group.tools.map((tool, i) => (
                      <View key={i} style={styles.toolChip}>
                        <Text style={styles.toolChipText}>{tool}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {group.sample_type && (
                  <View style={styles.sampleTypeRow}>
                    <Ionicons
                      name="document-outline"
                      size={14}
                      color={COLORS.textLight}
                    />
                    <Text style={styles.sampleTypeText}>
                      Portfolio sample: {group.sample_type}
                    </Text>
                  </View>
                )}
              </View>
            ))}
            {opportunity.eligibility_mode && (
              <View style={styles.eligibilityNote}>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={COLORS.primary}
                />
                <Text style={styles.eligibilityText}>
                  {opportunity.eligibility_mode === "any_one"
                    ? "You can apply for any one role"
                    : "You can apply for multiple roles"}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Compensation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compensation</Text>
          <View style={styles.compensationCard}>
            <View style={styles.compensationRow}>
              <Ionicons name="cash-outline" size={20} color={COLORS.success} />
              <View style={styles.compensationInfo}>
                <Text style={styles.compensationType}>
                  {opportunity.payment_type === "fixed"
                    ? "Fixed Rate"
                    : "Hourly Rate"}
                </Text>
                {opportunity.budget_range && (
                  <Text style={styles.compensationAmount}>
                    {opportunity.budget_range}
                  </Text>
                )}
              </View>
            </View>
            <View
              style={[
                styles.paymentNatureBadge,
                opportunity.payment_nature === "paid" && styles.paidBadge,
                opportunity.payment_nature === "trial" && styles.trialBadge,
                opportunity.payment_nature === "revenue_share" &&
                  styles.revShareBadge,
              ]}
            >
              <Text
                style={[
                  styles.paymentNatureText,
                  opportunity.payment_nature === "paid" && styles.paidText,
                  opportunity.payment_nature === "trial" && styles.trialText,
                  opportunity.payment_nature === "revenue_share" &&
                    styles.revShareText,
                ]}
              >
                {opportunity.payment_nature === "paid" && "Paid"}
                {opportunity.payment_nature === "trial" && "Trial Period"}
                {opportunity.payment_nature === "revenue_share" &&
                  "Revenue Share"}
              </Text>
            </View>
          </View>
        </View>

        {/* Application Questions Preview */}
        {opportunity.questions?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Application Questions</Text>
            <Text style={styles.questionsNote}>
              You'll be asked {opportunity.questions.length} question
              {opportunity.questions.length > 1 ? "s" : ""} as part of your
              application.
            </Text>
          </View>
        )}

        {/* Applicant count */}
        {opportunity.applicant_count > 0 && (
          <View style={styles.applicantInfo}>
            <Ionicons
              name="people-outline"
              size={16}
              color={COLORS.textLight}
            />
            <Text style={styles.applicantText}>
              {opportunity.applicant_count} applicant
              {opportunity.applicant_count !== 1 ? "s" : ""}
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Apply Button Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
          <LinearGradient
            colors={["#00C6FF", "#007AFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.applyGradient}
          >
            <Text style={styles.applyButtonText}>Apply Now</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: COLORS.textLight,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 20,
  },
  errorText: {
    fontSize: 15,
    color: COLORS.textLight,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primary + "15",
    borderRadius: 8,
    marginTop: 8,
  },
  retryText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.primary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.text,
  },
  shareButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  titleSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 12,
    lineHeight: 32,
  },
  communityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  communityAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  communityInitial: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  communityName: {
    fontSize: 15,
    color: COLORS.textLight,
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  roleTag: {
    backgroundColor: COLORS.primary + "15",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  roleTagText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.primary,
  },
  infoGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  infoCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  expBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  expBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  requirementsList: {
    gap: 12,
  },
  requirementRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  requirementText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  requirementLabel: {
    fontWeight: "600",
  },
  skillGroup: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  skillGroupRole: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  toolsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  toolChip: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  toolChipText: {
    fontSize: 13,
    color: COLORS.text,
  },
  sampleTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sampleTypeText: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  eligibilityNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.primary + "10",
    padding: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  eligibilityText: {
    fontSize: 13,
    color: COLORS.primary,
    flex: 1,
  },
  compensationCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  compensationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  compensationInfo: {
    gap: 2,
  },
  compensationType: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  compensationAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  paymentNatureBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  paidBadge: {
    backgroundColor: "#10B98120",
  },
  trialBadge: {
    backgroundColor: "#F59E0B20",
  },
  revShareBadge: {
    backgroundColor: "#8B5CF620",
  },
  paymentNatureText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textLight,
  },
  paidText: {
    color: "#10B981",
  },
  trialText: {
    color: "#F59E0B",
  },
  revShareText: {
    color: "#8B5CF6",
  },
  questionsNote: {
    fontSize: 14,
    color: COLORS.textLight,
    lineHeight: 20,
  },
  applicantInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    paddingVertical: 12,
  },
  applicantText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  applyButton: {
    borderRadius: 14,
    overflow: "hidden",
  },
  applyGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  applyButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
