import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Image,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";

import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  Clock,
  Star,
  XCircle,
  Undo2,
  AlertCircle,
  Link,
  ExternalLink,
  FileText,
  Download,
  MessageCircle,
  X,
} from "lucide-react-native";
import SnooLoader from "../../../components/ui/SnooLoader";
import {
  getApplicationDetail,
  updateApplicationStatus,
} from "../../../api/opportunities";
import { useToast } from "../../../context/ToastContext";
import { FONTS } from "../../../constants/theme";

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
  pending: { label: "New", color: COLORS.primary, icon: Clock },
  shortlisted: { label: "Shortlisted", color: COLORS.success, icon: Star },
  rejected: { label: "Rejected", color: COLORS.error, icon: XCircle },
  withdrawn: {
    label: "Withdrawn",
    color: COLORS.textLight,
    icon: Undo2,
  },
};

export default function ApplicantDetailScreen({ route, navigation }) {
  const { applicationId } = route.params || {};
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [application, setApplication] = useState(null);
  const [error, setError] = useState(null);
  const [downloadingResume, setDownloadingResume] = useState(false);

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
                showToast("Success", `Application ${newStatus} successfully`);
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

  const openPortfolio = (url) => {
    const target = url || application?.portfolio_link;
    if (target) {
      Linking.openURL(target).catch(() => {
        Alert.alert("Error", "Could not open link");
      });
    }
  };

  const openResume = async () => {
    if (!application?.resume_url) return;
    try {
      setDownloadingResume(true);
      const filename =
        decodeURIComponent(
          application.resume_url.split("/").pop().split("?")[0],
        ) || "resume.pdf";
      const fileUri = FileSystem.cacheDirectory + filename;

      // Download to cache — don't check status strictly since Cloudinary may redirect
      const download = await FileSystem.downloadAsync(
        application.resume_url,
        fileUri,
      );

      // Open the local cached file in the device's PDF viewer
      await Linking.openURL(download.uri);
    } catch (err) {
      console.error("Resume download error:", err);
      // Fallback: open the URL directly in browser with fl_attachment to force download
      try {
        let fallbackUrl = application.resume_url;
        if (
          fallbackUrl.includes("cloudinary.com") &&
          fallbackUrl.includes("/upload/")
        ) {
          fallbackUrl = fallbackUrl.replace("/upload/", "/upload/fl_attachment/");
        }
        await Linking.openURL(fallbackUrl);
      } catch {
        Alert.alert("Error", "Could not open the resume file.");
      }
    } finally {
      setDownloadingResume(false);
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
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.card} />
        <View style={styles.loadingContainer}>
          <SnooLoader size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !application) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.card} />
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={COLORS.textLight} />
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
  const StatusIcon = statusConfig.icon;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.card} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Application</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.contentWrapper}>
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
                    {application.applicant_name?.charAt(0)?.toUpperCase() ||
                      "?"}
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
              <StatusIcon size={16} color={statusConfig.color} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          {/* Applied Role + Skills Chips */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Applied For</Text>
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>{application.applied_role}</Text>
            </View>
            {/* Extract and show skills from portfolio_note */}
            {(() => {
              const note = application.portfolio_note || "";
              const prefix = "Applied with skills: ";
              if (!note.startsWith(prefix)) return null;
              const skills = note
                .replace(prefix, "")
                .split(", ")
                .filter(Boolean);
              if (skills.length === 0) return null;
              return (
                <View style={styles.skillsRow}>
                  {skills.map((skill, i) => (
                    <View key={i} style={styles.skillChip}>
                      <Text style={styles.skillChipText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}
          </View>

          {/* Intro Pitch — applicant self-description */}
          {application.intro_pitch ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About Themselves</Text>
              <View style={styles.noteCard}>
                <Text style={styles.noteText}>{application.intro_pitch}</Text>
              </View>
            </View>
          ) : null}

          {/* Portfolio Links — supports multiple */}
          {(() => {
            const allLinks =
              application.portfolio_links?.filter(Boolean).length > 0
                ? application.portfolio_links.filter(Boolean)
                : application.portfolio_link
                  ? [application.portfolio_link]
                  : [];
            if (allLinks.length === 0) return null;
            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Portfolio</Text>
                {allLinks.map((link, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.portfolioCard,
                      index > 0 && { marginTop: 10 },
                    ]}
                    onPress={() => openPortfolio(link)}
                  >
                    <View style={styles.portfolioIcon}>
                      <Link size={20} color={COLORS.primary} />
                    </View>
                    <View style={styles.portfolioInfo}>
                      <Text style={styles.portfolioLink} numberOfLines={1}>
                        {link}
                      </Text>
                      <Text style={styles.portfolioHint}>Tap to open</Text>
                    </View>
                    <ExternalLink size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            );
          })()}

          {/* Resume / Uploaded File — downloads to device */}
          {application.resume_url ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Resume / File</Text>
              <TouchableOpacity
                style={styles.portfolioCard}
                onPress={openResume}
                disabled={downloadingResume}
              >
                <View
                  style={[
                    styles.portfolioIcon,
                    { backgroundColor: COLORS.error + "15" },
                  ]}
                >
                  <FileText size={20} color={COLORS.error} />
                </View>
                <View style={styles.portfolioInfo}>
                  <Text style={styles.portfolioLink} numberOfLines={1}>
                    {decodeURIComponent(
                      application.resume_url.split("/").pop().split("?")[0],
                    ) || "Attached File"}
                  </Text>
                  <Text style={[styles.portfolioHint, { color: COLORS.error }]}>
                    {downloadingResume ? "Downloading..." : "Tap to download"}
                  </Text>
                </View>
                {downloadingResume ? (
                  <ActivityIndicator size="small" color={COLORS.error} />
                ) : (
                  <Download size={20} color={COLORS.error} />
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Portfolio Note — only show if it's NOT a skills note (those are shown as chips above) */}
          {application.portfolio_note &&
            !application.portfolio_note.startsWith("Applied with skills:") && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Additional Notes</Text>
                <View style={styles.noteCard}>
                  <Text style={styles.noteText}>
                    {application.portfolio_note}
                  </Text>
                </View>
              </View>
            )}

          {/* Creator's Questions + Applicant's Answers */}
          {application.responses?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Questions &amp; Answers</Text>
              {application.responses.map((response, index) => (
                <View
                  key={response.question_id || response.id || index}
                  style={[styles.responseCard, index > 0 && { marginTop: 10 }]}
                >
                  <View style={styles.questionRow}>
                    <View style={styles.questionBadge}>
                      <Text style={styles.questionBadgeText}>Q{index + 1}</Text>
                    </View>
                    <Text style={styles.questionPrompt}>{response.prompt}</Text>
                  </View>
                  <View style={styles.answerBlock}>
                    <Text style={styles.answerText}>
                      {response.response_text ||
                        response.answer ||
                        "(No answer provided)"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Applicant's Questions for the Community */}
          {application.applicant_questions?.filter(Boolean).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Questions for You</Text>
              {application.applicant_questions.filter(Boolean).map((q, i) => (
                <View
                  key={i}
                  style={[styles.responseCard, i > 0 && { marginTop: 10 }]}
                >
                  <View style={styles.applicantQuestionHeader}>
                    <MessageCircle size={14} color={COLORS.primary} />
                    <Text style={styles.applicantQuestionLabel}>
                      Question {i + 1}
                    </Text>
                  </View>
                  <Text style={styles.noteText}>{q}</Text>
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
              <X size={20} color={COLORS.error} />
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
                    <Star size={20} color="#FFFFFF" />
                    <Text
                      style={[
                        styles.shortlistButtonText,
                        { fontFamily: "Manrope-SemiBold" },
                      ]}
                    >
                      Shortlist
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.card,
  },
  contentWrapper: {
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
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    textAlign: "center",
  },
  goBackText: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
    marginTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: FONTS.black,
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
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  applicantName: {
    fontSize: 22,
    fontFamily: FONTS.primary,
    color: COLORS.text,
    marginBottom: 4,
  },
  applicantUsername: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    marginBottom: 8,
  },
  applicantBio: {
    fontSize: 14,
    fontFamily: FONTS.regular,
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
    fontFamily: FONTS.medium,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: FONTS.primary,
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
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  portfolioCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
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
    fontFamily: FONTS.medium,
    color: COLORS.text,
    marginBottom: 2,
  },
  portfolioHint: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },
  noteCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
  },
  noteText: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    lineHeight: 22,
  },
  responseCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  questionPrompt: {
    fontSize: 14,
    fontFamily: FONTS.primary,
    color: COLORS.text,
    marginBottom: 8,
  },
  answerText: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.textLight,
    lineHeight: 22,
  },
  skillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  skillChip: {
    backgroundColor: COLORS.primary + "12",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  skillChipText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
  },
  questionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  questionBadge: {
    backgroundColor: COLORS.primary + "15",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    flexShrink: 0,
  },
  questionBadgeText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  answerBlock: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 10,
  },
  appliedDate: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textLight,
    textAlign: "center",
    marginTop: 8,
  },
  applicantQuestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  applicantQuestionLabel: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
    fontFamily: FONTS.semiBold,
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
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
  },
});
