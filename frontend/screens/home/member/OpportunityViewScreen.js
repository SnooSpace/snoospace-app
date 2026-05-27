import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Share,
  Platform,
  Image,
  StatusBar,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import {
  ArrowLeft,
  Share2,
  Globe,
  MapPin,
  Layers,
  Clock,
  Repeat,
  Award,
  Hourglass,
  Calendar,
  CheckCircle2,
  Info,
  Banknote,
  HelpCircle,
  Users,
  ArrowRight,
  AlertCircle,
  ChevronRight,
  FileText,
  Star,
  MoveRight,
  Coins,
} from "lucide-react-native";
import { getOpportunityDetail } from "../../../api/opportunities";
import SnooLoader from "../../../components/ui/SnooLoader";
import { COLORS, FONTS, SHADOWS, SPACING, BORDER_RADIUS } from "../../../constants/theme";

const { width } = Dimensions.get("window");

// Custom soft shadows for a modern, minimalistic depth without harsh lines
const SOFT_SHADOWS = {
  card: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  button: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
};

const EXPERIENCE_INFO = {
  beginner: { label: "Beginner", tint: "rgba(52, 199, 89, 0.06)", text: "#34C759" },
  intermediate: { label: "Intermediate", tint: "rgba(245, 158, 11, 0.06)", text: "#F59E0B" },
  advanced: { label: "Expert", tint: "rgba(229, 62, 62, 0.06)", text: "#E53E3E" },
  expert: { label: "Expert", tint: "rgba(229, 62, 62, 0.06)", text: "#E53E3E" },
  any: { label: "Any Level", tint: "rgba(107, 114, 128, 0.06)", text: "#6B7280" },
};

const getWorkModeConfig = (mode) => {
  const normalized = (mode || "").toLowerCase().replace("_", "");
  if (normalized === "remote") {
    return { icon: Globe, label: "Remote", tint: "rgba(41, 98, 255, 0.06)", text: COLORS.primary };
  }
  if (normalized === "onsite" || normalized === "on_site") {
    return { icon: MapPin, label: "On-site", tint: "rgba(0, 191, 165, 0.06)", text: "#00BFA5" };
  }
  if (normalized === "hybrid") {
    return { icon: Layers, label: "Hybrid", tint: "rgba(139, 92, 246, 0.06)", text: "#8B5CF6" };
  }
  return { icon: Globe, label: mode || "Remote", tint: "rgba(41, 98, 255, 0.06)", text: COLORS.primary };
};

const getTypeConfig = (type) => {
  const normalized = (type || "").toLowerCase().replace("_", "");
  if (normalized === "ongoing") {
    return { icon: Repeat, label: "Ongoing", tint: "rgba(0, 191, 165, 0.06)", text: "#00BFA5" };
  }
  return { icon: Clock, label: "One-time", tint: "rgba(41, 98, 255, 0.06)", text: COLORS.primary };
};

const getPaymentNatureConfig = (nature, trialType) => {
  if (nature === "paid") {
    return { label: "Paid", bg: "rgba(52, 199, 89, 0.06)", border: "rgba(52, 199, 89, 0.1)", text: COLORS.success };
  }
  if (nature === "trial") {
    if (trialType === "free_trial") {
      return { label: "Free Trial", bg: "rgba(229, 62, 62, 0.06)", border: "rgba(229, 62, 62, 0.1)", text: COLORS.error };
    }
    return { label: "Paid Trial", bg: "rgba(245, 158, 11, 0.06)", border: "rgba(245, 158, 11, 0.1)", text: "#F59E0B" };
  }
  if (nature === "revenue_share") {
    return { label: "Rev Share", bg: "rgba(139, 92, 246, 0.06)", border: "rgba(139, 92, 246, 0.1)", text: "#8B5CF6" };
  }
  if (nature === "exposure") {
    return { label: "Exposure", bg: "rgba(107, 114, 128, 0.06)", border: "rgba(107, 114, 128, 0.1)", text: COLORS.textSecondary };
  }
  return { label: "Paid", bg: "rgba(52, 199, 89, 0.06)", border: "rgba(52, 199, 89, 0.15)", text: COLORS.success };
};

const formatDeadline = (dateStr) => {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (e) {
    return null;
  }
};

const getPaymentTypeLabel = (paymentType, paymentNature, trialType) => {
  if (paymentNature === "exposure") return "Compensation Mode";
  if (paymentNature === "trial" && trialType === "free_trial") return "Compensation Mode";
  
  switch (paymentType) {
    case "fixed":
      return "Fixed Budget";
    case "monthly":
      return "Monthly Rate";
    case "per_deliverable":
      return "Per Deliverable";
    default:
      return "Budget";
  }
};

const getPaymentAmountText = (budgetRange, paymentNature, trialType) => {
  if (paymentNature === "exposure") return "Exposure (Unpaid)";
  if (paymentNature === "trial" && trialType === "free_trial") return "Free Trial (Unpaid)";
  return budgetRange || "Not specified";
};

const getPaymentTypeDisplayText = (type) => {
  switch (type) {
    case "fixed":
      return "Fixed Budget";
    case "monthly":
      return "Monthly Rate";
    case "per_deliverable":
      return "Per Deliverable";
    default:
      return type ? (type.charAt(0).toUpperCase() + type.slice(1)) : "Not specified";
  }
};

export default function OpportunityViewScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { opportunityId, opportunity: passedOpportunity } = route.params || {};
  const hasFullOpportunity = !!(passedOpportunity && passedOpportunity.title);
  const [opportunity, setOpportunity] = useState(hasFullOpportunity ? passedOpportunity : null);
  const [loading, setLoading] = useState(!hasFullOpportunity);
  const [error, setError] = useState(null);

  const targetId = opportunityId || passedOpportunity?.id;

  useEffect(() => {
    if (targetId) {
      fetchOpportunity();
    }
  }, [targetId]);

  const fetchOpportunity = async () => {
    try {
      if (!hasFullOpportunity) {
        setLoading(true);
      }
      const response = await getOpportunityDetail(targetId);
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

  const handleShare = async () => {
    if (!opportunity) return;
    try {
      await Share.share({
        title: opportunity.title,
        message: `Check out this opportunity: ${opportunity.title} on SnooSpace!`,
      });
    } catch (err) {
      console.error("Error sharing opportunity:", err);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.loadingContainer}>
          <SnooLoader size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading opportunity...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !opportunity) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={COLORS.textMuted} />
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

  const workModeConfig = getWorkModeConfig(opportunity.work_mode);
  const typeConfig = getTypeConfig(opportunity.work_type);
  const expConfig = EXPERIENCE_INFO[opportunity.experience_level?.toLowerCase()] || EXPERIENCE_INFO.any;
  const natureConfig = getPaymentNatureConfig(opportunity.payment_nature, opportunity.trial_type);

  const creatorDisplayName = opportunity.creator_name || opportunity.community_name || "SnooSpace";
  const creatorUsernameVal = opportunity.creator_username || opportunity.community_username;
  const initialLetter = creatorDisplayName.charAt(0).toUpperCase();

  const showSplitFooter = !!opportunity.budget_range;
  const deadlineDate = formatDeadline(opportunity.expires_at);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* Header (Minimal, Borderless) */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Opportunity</Text>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={handleShare}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Share2 size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title & Host Row */}
        <View style={styles.heroSection}>
          {opportunity.opportunity_types && opportunity.opportunity_types.length > 0 && (
            <View style={styles.roleBadgesRow}>
              {opportunity.opportunity_types.map((role, idx) => (
                <View key={idx} style={styles.roleBadgePill}>
                  <Text style={styles.roleBadgeText}>{role.toUpperCase()}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.title}>{opportunity.title}</Text>
          
          <TouchableOpacity
            style={styles.hostRow}
            activeOpacity={0.7}
            onPress={() => {
              if (opportunity.creator_id) {
                navigation.navigate("CommunityPublicProfile", {
                  communityId: opportunity.creator_id,
                });
              }
            }}
          >
            <View style={styles.hostAvatarContainer}>
              {opportunity.creator_photo ? (
                <Image 
                  source={{ uri: opportunity.creator_photo }} 
                  style={styles.hostAvatarImage} 
                />
              ) : (
                <Text style={styles.hostAvatarInitial}>{initialLetter}</Text>
              )}
            </View>
            <View style={styles.hostTextContainer}>
              <Text style={styles.hostName}>{creatorDisplayName}</Text>
              {creatorUsernameVal && (
                <Text style={styles.hostUsername}>@{creatorUsernameVal}</Text>
              )}
            </View>
            <MoveRight size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.separator} />

        {/* Unified Quick Info Card (Flat Strip) */}
        <View style={styles.infoGridCard}>
          {/* Work Mode Column */}
          <View style={styles.infoColumn}>
            <View style={[styles.infoIconContainer, { backgroundColor: workModeConfig.tint }]}>
              <workModeConfig.icon size={18} color={workModeConfig.text} />
            </View>
            <Text style={styles.infoLabel}>Work Mode</Text>
            <Text style={styles.infoValue}>{workModeConfig.label}</Text>
          </View>

          <View style={styles.verticalDivider} />

          {/* Type Column */}
          <View style={styles.infoColumn}>
            <View style={[styles.infoIconContainer, { backgroundColor: typeConfig.tint }]}>
              <typeConfig.icon size={18} color={typeConfig.text} />
            </View>
            <Text style={styles.infoLabel}>Type</Text>
            <Text style={styles.infoValue}>{typeConfig.label}</Text>
          </View>

          <View style={styles.verticalDivider} />

          {/* Experience Column */}
          <View style={styles.infoColumn}>
            <View style={[styles.infoIconContainer, { backgroundColor: expConfig.tint }]}>
              <Award size={18} color={expConfig.text} />
            </View>
            <Text style={styles.infoLabel}>Experience</Text>
            <Text style={styles.infoValue}>{expConfig.label}</Text>
          </View>
        </View>

        <View style={styles.separator} />

        {/* About the Role */}
        {(opportunity.about_role || opportunity.description) && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>About the Role</Text>
              <Text style={styles.bodyText}>
                {opportunity.about_role || opportunity.description}
              </Text>
            </View>
            <View style={styles.separator} />
          </>
        )}

        {/* Key Responsibilities */}
        {opportunity.responsibilities && opportunity.responsibilities.length > 0 && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Key Responsibilities</Text>
              {opportunity.responsibilities.map((resp, idx) => (
                <View key={idx} style={styles.bulletRow}>
                  <CheckCircle2 size={16} color={COLORS.success} style={styles.bulletIcon} />
                  <Text style={styles.bulletText}>{resp}</Text>
                </View>
              ))}
            </View>
            <View style={styles.separator} />
          </>
        )}

        {/* Requirements */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Requirements</Text>
          <View style={styles.flatListContainer}>
            {opportunity.availability && (
              <View style={styles.flatListRow}>
                <View style={[styles.flatListIconContainer, { backgroundColor: "rgba(41, 98, 255, 0.04)" }]}>
                  <Clock size={18} color={COLORS.primary} />
                </View>
                <View style={styles.flatListTextContainer}>
                  <Text style={styles.flatListLabel}>Availability</Text>
                  <Text style={styles.flatListValue}>{opportunity.availability}</Text>
                </View>
              </View>
            )}
            {opportunity.turnaround && (
              <View style={styles.flatListRow}>
                <View style={[styles.flatListIconContainer, { backgroundColor: "rgba(41, 98, 255, 0.04)" }]}>
                  <Hourglass size={18} color={COLORS.primary} />
                </View>
                <View style={styles.flatListTextContainer}>
                  <Text style={styles.flatListLabel}>Turnaround</Text>
                  <Text style={styles.flatListValue}>{opportunity.turnaround}</Text>
                </View>
              </View>
            )}
            {opportunity.timezone && (
              <View style={styles.flatListRow}>
                <View style={[styles.flatListIconContainer, { backgroundColor: "rgba(41, 98, 255, 0.04)" }]}>
                  <Globe size={18} color={COLORS.primary} />
                </View>
                <View style={styles.flatListTextContainer}>
                  <Text style={styles.flatListLabel}>Timezone</Text>
                  <Text style={styles.flatListValue}>{opportunity.timezone}</Text>
                </View>
              </View>
            )}
            {deadlineDate && (
              <View style={styles.flatListRow}>
                <View style={[styles.flatListIconContainer, { backgroundColor: "rgba(41, 98, 255, 0.04)" }]}>
                  <Calendar size={18} color={COLORS.primary} />
                </View>
                <View style={styles.flatListTextContainer}>
                  <Text style={styles.flatListLabel}>Application Deadline</Text>
                  <Text style={styles.flatListValue}>{deadlineDate}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.separator} />

        {/* Skills & Tools */}
        {opportunity.skill_groups && opportunity.skill_groups.length > 0 && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Skills & Tools</Text>
              {opportunity.skill_groups.map((group, index) => (
                <View key={group.id || index} style={styles.skillGroupCard}>
                  <Text style={styles.skillGroupTitle}>{group.role}</Text>
                  {group.tools && group.tools.length > 0 && (
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
                      <FileText size={14} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
                      <Text style={styles.sampleTypeText}>
                        Work Sample:{" "}
                        {group.sample_type
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .join(", ")}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
              {opportunity.eligibility_mode && (
                <View style={styles.eligibilityAlert}>
                  <Info size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.eligibilityText}>
                    {opportunity.eligibility_mode === "any_one"
                      ? "You can apply for any one role"
                      : "You can apply for multiple roles"}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.separator} />
          </>
        )}

        {/* Who Can Apply */}
        {opportunity.who_can_apply && opportunity.who_can_apply.length > 0 && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Who Can Apply</Text>
              {opportunity.who_can_apply.map((item, index) => (
                <View key={index} style={styles.bulletRow}>
                  <Award size={16} color={COLORS.primary} style={styles.bulletIcon} />
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
            <View style={styles.separator} />
          </>
        )}

        {/* What You'll Gain */}
        {opportunity.gains && opportunity.gains.length > 0 && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>What You'll Gain</Text>
              {opportunity.gains.map((item, index) => (
                <View key={index} style={styles.bulletRow}>
                  <Star size={16} color={COLORS.secondary} style={styles.bulletIcon} />
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
            <View style={styles.separator} />
          </>
        )}

        {/* Compensation */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Compensation</Text>
          <View style={styles.flatListContainer}>
            {/* Payment Nature */}
            <View style={styles.flatListRow}>
              <View style={[styles.flatListIconContainer, { backgroundColor: "rgba(52, 199, 89, 0.04)" }]}>
                <Coins size={18} color={COLORS.success} />
              </View>
              <View style={styles.flatListTextContainer}>
                <Text style={styles.flatListLabel}>Payment Nature</Text>
                <Text style={[styles.flatListValue, { fontFamily: FONTS.semiBold, color: natureConfig.text }]}>
                  {natureConfig.label}
                </Text>
              </View>
            </View>

            {/* Payment Type */}
            {opportunity.payment_nature !== "exposure" && 
             opportunity.payment_nature !== "revenue_share" && 
             !(opportunity.payment_nature === "trial" && opportunity.trial_type === "free_trial") && 
             opportunity.payment_type && (
              <View style={styles.flatListRow}>
                <View style={[styles.flatListIconContainer, { backgroundColor: "rgba(41, 98, 255, 0.04)" }]}>
                  <Repeat size={18} color={COLORS.primary} />
                </View>
                <View style={styles.flatListTextContainer}>
                  <Text style={styles.flatListLabel}>Payment Type</Text>
                  <Text style={styles.flatListValue}>
                    {getPaymentTypeDisplayText(opportunity.payment_type)}
                  </Text>
                </View>
              </View>
            )}

            {/* Budget / Rate */}
            {opportunity.payment_nature !== "exposure" && !(opportunity.payment_nature === "trial" && opportunity.trial_type === "free_trial") && (
              <View style={styles.flatListRow}>
                <View style={[styles.flatListIconContainer, { backgroundColor: "rgba(41, 98, 255, 0.04)" }]}>
                  <Banknote size={18} color={COLORS.primary} />
                </View>
                <View style={styles.flatListTextContainer}>
                  <Text style={styles.flatListLabel}>Budget / Rate</Text>
                  <Text style={styles.flatListValue}>
                    {opportunity.budget_range || "Not specified"}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Application Questions */}
        {opportunity.questions && opportunity.questions.length > 0 && (
          <>
            <View style={styles.separator} />
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Application Questions</Text>
              <View style={styles.questionsCard}>
                <View style={styles.questionsIconContainer}>
                  <HelpCircle size={20} color={COLORS.primary} />
                </View>
                <Text style={styles.questionsText}>
                  You'll be asked {opportunity.questions.length} question
                  {opportunity.questions.length > 1 ? "s" : ""} as part of your application.
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Applicant count */}
        {opportunity.applicant_count > 0 && (
          <View style={styles.applicantInfo}>
            <Users size={16} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
            <Text style={styles.applicantText}>
              {opportunity.applicant_count} applicant
              {opportunity.applicant_count !== 1 ? "s" : ""}
            </Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Floating Apply Button Sticky Footer */}
      <View style={styles.footer}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={95} style={StyleSheet.absoluteFill} tint="light" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255, 255, 255, 0.95)" }]} />
        )}
        
        <View style={styles.footerContent}>
          {showSplitFooter ? (
            <View style={styles.footerLeft}>
              <Text style={styles.footerRateLabel}>
                {getPaymentTypeLabel(opportunity.payment_type, opportunity.payment_nature, opportunity.trial_type)}
              </Text>
              <Text style={styles.footerRateValue} numberOfLines={1}>
                {opportunity.budget_range}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity 
            style={[
              styles.applyButton, 
              showSplitFooter ? styles.applyButtonSplit : styles.applyButtonFull,
              SOFT_SHADOWS.button
            ]} 
            onPress={handleApply}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={COLORS.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.applyGradient}
            >
              <Text style={styles.applyButtonText}>Apply Now</Text>
              <ArrowRight size={16} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: FONTS.medium,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 20,
  },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    borderRadius: BORDER_RADIUS.s,
    marginTop: 16,
  },
  retryText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.primary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.screenBackground,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 17,
    color: COLORS.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 20,
  },
  heroSection: {
    gap: 10,
  },
  roleBadgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },
  roleBadgePill: {
    backgroundColor: "rgba(41, 98, 255, 0.05)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    color: COLORS.primary,
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: FONTS.black,
    fontSize: 26,
    color: COLORS.textPrimary,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  hostRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    marginTop: 4,
  },
  hostAvatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(41, 98, 255, 0.06)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    overflow: "hidden",
  },
  hostAvatarImage: {
    width: "100%",
    height: "100%",
  },
  hostAvatarInitial: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.primary,
  },
  hostTextContainer: {
    flex: 1,
  },
  hostName: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  hostUsername: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  separator: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 4,
  },
  infoGridCard: {
    flexDirection: "row",
    backgroundColor: "rgba(243, 244, 246, 0.4)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 0,
    alignItems: "center",
  },
  infoColumn: {
    flex: 1,
    alignItems: "center",
  },
  verticalDivider: {
    width: 1,
    backgroundColor: "rgba(229, 231, 235, 0.6)",
    height: "60%",
  },
  infoIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  infoLabel: {
    fontFamily: FONTS.medium,
    fontSize: 9,
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  infoValue: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    fontFamily: FONTS.primary,
    fontSize: 15,
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },
  bodyText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginVertical: 2,
  },
  bulletIcon: {
    marginTop: 2,
  },
  bulletText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
    flex: 1,
  },
  flatListContainer: {
    gap: 16,
    paddingVertical: 4,
  },
  flatListRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  flatListIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  flatListTextContainer: {
    flex: 1,
  },
  flatListLabel: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  flatListValue: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  skillGroupCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    marginBottom: 10,
  },
  skillGroupTitle: {
    fontFamily: FONTS.primary,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  toolsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  toolChip: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  toolChipText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  sampleTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  sampleTypeText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  eligibilityAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(41, 98, 255, 0.04)",
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    borderWidth: 0,
  },
  eligibilityText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.primary,
    flex: 1,
  },

  questionsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(41, 98, 255, 0.03)",
    borderRadius: 12,
    padding: 16,
    borderWidth: 0,
  },
  questionsIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(41, 98, 255, 0.06)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  questionsText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textPrimary,
    flex: 1,
    lineHeight: 18,
  },
  applicantInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  applicantText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(243, 244, 246, 0.8)",
  },
  footerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerLeft: {
    flex: 1,
    marginRight: 16,
  },
  footerRateLabel: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  footerRateValue: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  applyButton: {
    borderRadius: 999,
    overflow: "hidden",
  },
  applyButtonSplit: {
    flex: 1.2,
  },
  applyButtonFull: {
    width: "100%",
  },
  applyGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 6,
  },
  applyButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: "#FFFFFF",
  },
});

