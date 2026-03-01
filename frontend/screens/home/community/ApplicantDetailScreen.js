import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import SnooLoader from "../../../components/ui/SnooLoader";
import {
  getApplicationDetail,
  updateApplicationStatus,
} from "../../../api/opportunities";

const COLORS = {
  background: "#FAFAFA",
  card: "#FFFFFF",
  primary: "#007AFF",
  text: "#1A1A2E",
  textLight: "#6B7280",
  border: "#E5E7EB",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
};

const STATUS_CONFIG = {
  pending: { label: "New", color: COLORS.primary, icon: "time-outline" },
  shortlisted: { label: "Shortlisted", color: COLORS.success, icon: "star" },
  rejected: { label: "Rejected", color: COLORS.error, icon: "close-circle" },
  withdrawn: {
    label: "Withdrawn",
    color: COLORS.textLight,
    icon: "arrow-undo",
  },
};

export default function ApplicantDetailScreen({ route, navigation }) {
  const { applicationId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [application, setApplication] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadApplication();
  }, [applicationId]);

  const loadApplication = async () => {
    try {
      setLoading(true);
      const response = await getApplicationDetail(applicationId);
      if (response?.success) {
        setApplication(response.application);
      } else {
        setError("Application not found");
      }
    } catch (err) {
      console.error("Error loading application:", err);
      setError("Failed to load application");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    const statusLabels = {
      shortlisted: "shortlist",
      rejected: "reject",
    };

    Alert.alert(
      `${statusLabels[newStatus]?.charAt(0).toUpperCase()}${statusLabels[newStatus]?.slice(1)} Applicant`,
      `Are you sure you want to ${statusLabels[newStatus]} this application?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              setUpdating(true);
              const response = await updateApplicationStatus(applicationId, {
                status: newStatus,
              });
              if (response?.success) {
                setApplication({ ...application, status: newStatus });
                Alert.alert("Success", `Application ${newStatus} successfully`);
              }
            } catch (err) {
              console.error("Error updating status:", err);
              Alert.alert("Error", "Failed to update application status");
            } finally {
              setUpdating(false);
            }
          },
        },
      ],
    );
  };

  const openPortfolio = () => {
    if (application?.portfolio_link) {
      Linking.openURL(application.portfolio_link).catch(() => {
        Alert.alert("Error", "Could not open link");
      });
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <SnooLoader size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !application) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={COLORS.textLight}
          />
          <Text style={styles.errorText}>
            {error || "Application not found"}
          </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.goBackText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig =
    STATUS_CONFIG[application.status] || STATUS_CONFIG.pending;

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
        <Text style={styles.headerTitle}>Application</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Applicant Card */}
        <View style={styles.applicantCard}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            {application.applicant_photo ? (
              <Image
                source={{ uri: application.applicant_photo }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {application.applicant_name?.charAt(0)?.toUpperCase() || "?"}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.applicantName}>
            {application.applicant_name || "Unknown"}
          </Text>
          <Text style={styles.applicantUsername}>
            @{application.applicant_username || "unknown"}
          </Text>

          {application.applicant_bio && (
            <Text style={styles.applicantBio} numberOfLines={3}>
              {application.applicant_bio}
            </Text>
          )}

          {/* Status Badge */}
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusConfig.color + "15" },
            ]}
          >
            <Ionicons
              name={statusConfig.icon}
              size={16}
              color={statusConfig.color}
            />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        {/* Applied Role */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Applied For</Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleTagText}>{application.applied_role}</Text>
          </View>
        </View>

        {/* Portfolio */}
        {application.portfolio_link && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Portfolio</Text>
            <TouchableOpacity
              style={styles.portfolioCard}
              onPress={openPortfolio}
            >
              <View style={styles.portfolioIcon}>
                <Ionicons name="link" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.portfolioInfo}>
                <Text style={styles.portfolioLink} numberOfLines={1}>
                  {application.portfolio_link}
                </Text>
                <Text style={styles.portfolioHint}>Tap to open</Text>
              </View>
              <Ionicons name="open-outline" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Portfolio Note */}
        {application.portfolio_note && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Notes</Text>
            <View style={styles.noteCard}>
              <Text style={styles.noteText}>{application.portfolio_note}</Text>
            </View>
          </View>
        )}

        {/* Question Responses */}
        {application.responses?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Responses</Text>
            {application.responses.map((response, index) => (
              <View key={response.id || index} style={styles.responseCard}>
                <Text style={styles.questionPrompt}>{response.prompt}</Text>
                <Text style={styles.answerText}>
                  {response.answer || "(No answer)"}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Applied Date */}
        <Text style={styles.appliedDate}>
          Applied {formatDate(application.created_at)}
        </Text>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Action Buttons */}
      {application.status === "pending" && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => handleStatusUpdate("rejected")}
            disabled={updating}
          >
            <Ionicons name="close" size={20} color={COLORS.error} />
            <Text style={styles.rejectButtonText}>Reject</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortlistButton}
            onPress={() => handleStatusUpdate("shortlisted")}
            disabled={updating}
          >
            <LinearGradient
              colors={["#10B981", "#059669"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shortlistGradient}
            >
              {updating ? (
                <SnooLoader color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="star" size={20} color="#FFFFFF" />
                  <Text style={[styles.shortlistButtonText, { fontFamily: 'Manrope-SemiBold' }]}>Shortlist</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
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
  goBackText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.primary,
    marginTop: 8,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  applicantCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: "600",
    color: COLORS.primary,
  },
  applicantName: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 4,
  },
  applicantUsername: {
    fontSize: 15,
    color: COLORS.textLight,
    marginBottom: 8,
  },
  applicantBio: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textLight,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  roleTag: {
    backgroundColor: COLORS.primary + "15",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  roleTagText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.primary,
  },
  portfolioCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  portfolioIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.primary + "15",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  portfolioInfo: {
    flex: 1,
  },
  portfolioLink: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 2,
  },
  portfolioHint: {
    fontSize: 12,
    color: COLORS.primary,
  },
  noteCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  noteText: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
  },
  responseCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  questionPrompt: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  answerText: {
    fontSize: 15,
    color: COLORS.textLight,
    lineHeight: 22,
  },
  appliedDate: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: "center",
    marginTop: 8,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 12,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  rejectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: COLORS.error + "15",
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.error,
  },
  shortlistButton: {
    flex: 2,
    borderRadius: 14,
    overflow: "hidden",
  },
  shortlistGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  shortlistButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
