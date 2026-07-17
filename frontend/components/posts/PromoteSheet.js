/**
 * PromoteSheet
 * A full-screen bottom-sheet modal for promoting Events and Open Plans.
 *
 * Flow:
 *   1. Promo text (optional caption)
 *   2. Choose engagement type (Poll | Q&A | Prompt | Opportunity — filtered by allowedEngagementTypes)
 *   3. Configure the chosen type
 *   Submit → POST /posts { post_type: "event_promo" | "plan_promo", ... }
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import SwipeableModal from "../modals/SwipeableModal";
import EventBus from "../../utils/EventBus";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import {
  X,
  Megaphone,
  BarChart3,
  MessageCircle,
  Lightbulb,
  HelpCircle,
} from "lucide-react-native";
import { COLORS, FONTS } from "../../constants/theme";
import GradientButton from "../GradientButton";
import HapticsService from "../../services/HapticsService";
import { promoteEvent, promotePlan, getPromoteQuota } from "../../api/posts";
import { formatQuotaResetLabel } from "../../utils/promoteUtils";

// Inline form components
import PollCreateForm from "./PollCreateForm";
import QnACreateForm from "./QnACreateForm";
import PromptCreateForm from "./PromptCreateForm";
import OpportunityCreateForm from "./OpportunityCreateForm";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── Engagement Type Config ───────────────────────────────────────────────────

const ENGAGEMENT_TYPES = [
  {
    key: "poll",
    label: "Poll",
    description: "Let your audience vote",
    Icon: BarChart3,
    color: "#7C3AED",
    bg: "#F3EFFE",
  },
  {
    key: "qna",
    label: "Q&A",
    description: "Answer their questions",
    Icon: MessageCircle,
    color: "#0EA5E9",
    bg: "#E0F6FF",
  },
  {
    key: "prompt",
    label: "Prompt",
    description: "Invite responses",
    Icon: HelpCircle,
    color: "#F59E0B",
    bg: "#FEF3C7",
  },
  {
    key: "opportunity",
    label: "Opportunity",
    description: "Find collaborators",
    Icon: Lightbulb,
    color: "#10B981",
    bg: "#D1FAE5",
  },
];

// ─── Quota Bar ─────────────────────────────────────────────────────────────────

const QuotaBar = ({ used, max, resetsAt }) => {
  const remaining = Math.max(0, max - used);
  const filled = Math.min(used, max);
  const exceeded = used >= max;

  // Format reset date to e.g. "Resets Monday, 21 Jul"
  const resetLabel = formatQuotaResetLabel(resetsAt);

  return (
    <View style={quotaStyles.container}>
      <View style={quotaStyles.row}>
        <Text style={quotaStyles.label}>Promotes used this week</Text>
        <Text
          style={[quotaStyles.count, exceeded && quotaStyles.countExceeded]}
        >
          {used} / {max}
        </Text>
      </View>
      <View style={quotaStyles.track}>
        {Array.from({ length: max }).map((_, i) => (
          <View
            key={i}
            style={[
              quotaStyles.segment,
              i < filled &&
                (exceeded
                  ? quotaStyles.segmentExceeded
                  : quotaStyles.segmentFilled),
              i < max - 1 && quotaStyles.segmentGap,
            ]}
          />
        ))}
      </View>
      <Text style={[quotaStyles.sub, exceeded && quotaStyles.subExceeded]}>
        {exceeded
          ? `Promote limit reached${resetLabel ? ` · Resets ${resetLabel}` : ""}`
          : `${remaining} promote${remaining !== 1 ? "s" : ""} remaining${resetLabel ? ` · Resets ${resetLabel}` : ""}`}
      </Text>
    </View>
  );
};

const quotaStyles = StyleSheet.create({
  container: {
    marginTop: 4,
    marginBottom: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F8F7FF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EDE9FE",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  count: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#7C3AED",
  },
  countExceeded: {
    color: "#EF4444",
  },
  track: {
    flexDirection: "row",
    height: 6,
    borderRadius: 3,
    marginBottom: 6,
    overflow: "hidden",
  },
  segment: {
    flex: 1,
    backgroundColor: "#E9E4FB",
    borderRadius: 3,
  },
  segmentFilled: {
    backgroundColor: "#7C3AED",
  },
  segmentExceeded: {
    backgroundColor: "#EF4444",
  },
  segmentGap: {
    marginRight: 2,
  },
  sub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  subExceeded: {
    color: "#EF4444",
    fontFamily: FONTS.medium,
    fontSize: 13,
  },
});

// ─── Main Component ───────────────────────────────────────────────────────────

const PromoteSheet = ({
  visible,
  onClose,
  onSuccess,
  sourceType = "event", // 'event' | 'plan'
  sourceData = null, // event or plan object
  allowedEngagementTypes = ["poll", "qna", "prompt", "opportunity"],
}) => {
  // State
  const [promoText, setPromoText] = useState("");
  const [engagementType, setEngagementType] = useState(null);
  const [engagementData, setEngagementData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quota, setQuota] = useState(null);
  const [quotaLoading, setQuotaLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setPromoText("");
      setEngagementType(null);
      setEngagementData(null);
      loadQuota();
      EventBus.emit("hide-tab-bar");
    } else {
      EventBus.emit("show-tab-bar");
    }
    return () => {
      EventBus.emit("show-tab-bar");
    };
  }, [visible]);

  const loadQuota = async () => {
    try {
      setQuotaLoading(true);
      const res = await getPromoteQuota(sourceType);
      if (res?.quota) setQuota(res.quota);
    } catch (_) {
      // Non-fatal — proceed without quota display
    } finally {
      setQuotaLoading(false);
    }
  };

  const quotaExceeded = quota && quota.used >= quota.max;

  // ── Engagement type filter ──────────────────────────────────────────────────
  const availableTypes = ENGAGEMENT_TYPES.filter((t) =>
    allowedEngagementTypes.includes(t.key),
  );

  // ── Validation ─────────────────────────────────────────────────────────────
  const canSubmit = useCallback(() => {
    if (!engagementType) return false;
    if (quotaExceeded) return false;
    if (!engagementData) return false;
    if (engagementType === "poll") {
      return (
        engagementData.question?.trim().length > 0 &&
        Array.isArray(engagementData.options) &&
        engagementData.options.filter((o) => o?.trim()).length >= 2
      );
    }
    if (engagementType === "qna") {
      return engagementData.title?.trim().length >= 3;
    }
    if (engagementType === "prompt") {
      return engagementData.prompt_text?.trim().length > 0;
    }
    if (engagementType === "opportunity") {
      return engagementData.title?.trim().length >= 3;
    }
    return false;
  }, [engagementType, engagementData, quotaExceeded]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit()) return;
    HapticsService.triggerImpactLight();
    try {
      setIsSubmitting(true);
      const payload = {
        source_id: sourceData?.id,
        promo_text: promoText.trim() || null,
        engagement_type: engagementType,
        engagement_data: engagementData,
      };
      const result =
        sourceType === "event"
          ? await promoteEvent(payload)
          : await promotePlan(payload);

      if (result?.success) {
        HapticsService.triggerSuccess?.() ||
          HapticsService.triggerImpactLight();
        onSuccess?.(result.post);
        onClose();
      } else {
        Alert.alert(
          "Error",
          result?.error || "Failed to promote. Please try again.",
        );
      }
    } catch (error) {
      const msg =
        error?.response?.data?.error ||
        error?.message ||
        "Something went wrong.";
      if (msg.toLowerCase().includes("limit")) {
        Alert.alert(
          "Promote Limit Reached",
          "You've used all your promotes for this week. They reset every Monday.",
        );
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Engagement data handler ─────────────────────────────────────────────────
  const handleEngagementData = useCallback((data) => {
    setEngagementData(data);
  }, []);

  // ── Source subtitle ─────────────────────────────────────────────────────────
  const getSourceSubtitle = () => {
    if (!sourceData) return "";
    if (sourceType === "event") {
      const title = sourceData.title || "Event";
      const date = sourceData.event_date || sourceData.start_datetime;
      if (date) {
        const d = new Date(date);
        const label = d.toLocaleDateString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
        });
        return `${title} · ${label}`;
      }
      return title;
    }
    // plan
    return sourceData.title || "Open Plan";
  };

  // ── Render engagement form ──────────────────────────────────────────────────
  const renderEngagementForm = () => {
    if (!engagementType) return null;
    switch (engagementType) {
      case "poll":
        return (
          <PollCreateForm
            onDataChange={handleEngagementData}
            disabled={isSubmitting}
          />
        );
      case "qna":
        return (
          <QnACreateForm
            onSubmit={handleEngagementData}
            isSubmitting={isSubmitting}
          />
        );
      case "prompt":
        return (
          <PromptCreateForm
            onDataChange={handleEngagementData}
            disabled={isSubmitting}
          />
        );
      case "opportunity":
        return (
          <OpportunityCreateForm
            onDataChange={handleEngagementData}
            disabled={isSubmitting}
          />
        );
      default:
        return null;
    }
  };

  const headerEl = (
    <View style={styles.header} collapsable={false}>
      <View style={styles.headerHandle} />
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Megaphone size={18} color="#7C3AED" strokeWidth={2} />
          </View>
          <View>
            <Text style={styles.headerTitle}>
              Promote {sourceType === "event" ? "Event" : "Open Plan"}
            </Text>
            {sourceData && (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {getSourceSubtitle()}
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <X size={20} color={COLORS.textSecondary} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SwipeableModal
      visible={visible}
      onClose={onClose}
      sheetStyle={styles.sheet}
      avoidKeyboard={false}
      navigationBarTranslucent={Platform.OS === "android"}
      header={headerEl}
    >
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: (Platform.OS === "ios" ? 34 : 20) + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Promo text input */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Add a message</Text>
          <View style={styles.textInputWrap}>
            <TextInput
              style={styles.textInput}
              placeholder={
                sourceType === "event"
                  ? "Don't miss this one — grab your tickets now! 🎟️"
                  : "Looking for people to join this plan..."
              }
              placeholderTextColor="#9CA3AF"
              value={promoText}
              onChangeText={setPromoText}
              multiline
              maxLength={300}
              editable={!isSubmitting}
              returnKeyType="done"
            />
            {promoText.length > 0 && (
              <Text style={styles.charCount}>{promoText.length}/300</Text>
            )}
          </View>
        </View>

        {/* Engagement type selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Choose engagement type</Text>
          <View style={styles.typeGrid}>
            {availableTypes.map((type) => {
              const { Icon } = type;
              const selected = engagementType === type.key;
              return (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.typeCard,
                    selected && { borderColor: type.color, borderWidth: 2 },
                  ]}
                  onPress={() => {
                    HapticsService.triggerImpactLight();
                    setEngagementType(type.key);
                    setEngagementData(null);
                  }}
                  activeOpacity={0.75}
                >
                  <View
                    style={[styles.typeIconWrap, { backgroundColor: type.bg }]}
                  >
                    <Icon size={18} color={type.color} strokeWidth={2} />
                  </View>
                  <Text
                    style={[
                      styles.typeLabel,
                      selected && { color: type.color },
                    ]}
                  >
                    {type.label}
                  </Text>
                  <Text style={styles.typeDesc}>{type.description}</Text>
                  {selected && (
                    <View
                      style={[
                        styles.selectedDot,
                        { backgroundColor: type.color },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Engagement form */}
        {engagementType && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {engagementType === "poll"
                ? "Configure Poll"
                : engagementType === "qna"
                  ? "Configure Q&A"
                  : engagementType === "prompt"
                    ? "Configure Prompt"
                    : "Add Opportunity"}
            </Text>
            {renderEngagementForm()}
          </View>
        )}

        {/* Quota bar */}
        {quotaLoading ? (
          <ActivityIndicator
            size="small"
            color="#7C3AED"
            style={{ marginVertical: 12 }}
          />
        ) : quota ? (
          <QuotaBar
            used={quota.used}
            max={quota.max}
            resetsAt={quota.resets_at}
          />
        ) : null}
      </KeyboardAwareScrollView>

      {/* Submit bar */}
      <View style={styles.footer}>
        <GradientButton
          title={isSubmitting ? "Promoting..." : "Promote"}
          onPress={handleSubmit}
          disabled={!canSubmit() || isSubmitting}
          loading={isSubmitting}
          style={[
            styles.submitBtn,
            (!canSubmit() || isSubmitting) && styles.submitBtnDisabled,
          ]}
          gradientStyle={styles.submitBtnGradient}
          colors={
            !canSubmit() || isSubmitting
              ? ["#E5E7EB", "#E5E7EB"]
              : ["#7C3AED", "#9333EA"]
          }
          textStyle={{
            fontFamily: FONTS.semiBold,
            fontSize: 16,
            color: !canSubmit() || isSubmitting ? "#9CA3AF" : "#FFFFFF",
          }}
        />
      </View>
    </SwipeableModal>
  );
};

export default PromoteSheet;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SCREEN_HEIGHT * 0.88,
    overflow: "hidden",
  },
  header: {
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    backgroundColor: "#FFFFFF",
  },
  headerHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3EFFE",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: FONTS.primary,
    fontSize: 17,
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontFamily: FONTS.primary,
    fontSize: 14,
    color: COLORS.textPrimary,
    letterSpacing: 0.1,
  },
  textInputWrap: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 80,
  },
  textInput: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  charCount: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "right",
    marginTop: 4,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  typeCard: {
    width: "47%",
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    position: "relative",
  },
  typeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  typeLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  typeDesc: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  selectedDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  submitBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  submitBtnDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnGradient: {
    height: "100%",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
});
