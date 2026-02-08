/**
 * ChallengeCreateForm
 * Form for community admins to create Challenge posts
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../constants/theme";

const CHALLENGE_TYPES = [
  {
    id: "single",
    label: "Single Task",
    description: "One-time proof",
    icon: "checkmark-circle",
  },
  {
    id: "progress",
    label: "Progress",
    description: "Track progress",
    icon: "trending-up",
  },
  {
    id: "community",
    label: "Community",
    description: "Group goal",
    icon: "people",
  },
];

const SUBMISSION_TYPES = [
  { id: "image", label: "Photo", icon: "camera" },
  { id: "video", label: "Video", icon: "videocam" },
  { id: "text", label: "Text", icon: "document-text" },
];

const ChallengeCreateForm = ({ onSubmit, isSubmitting }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [challengeType, setChallengeType] = useState("single");
  const [submissionType, setSubmissionType] = useState("image");
  const [targetCount, setTargetCount] = useState(1);
  const [maxSubmissionsPerUser, setMaxSubmissionsPerUser] = useState(1);
  const [requireApproval, setRequireApproval] = useState(true);
  const [showProofsImmediately, setShowProofsImmediately] = useState(true);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Sync data with parent on every change
  useEffect(() => {
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      challenge_type: challengeType,
      submission_type: submissionType,
      target_count: targetCount,
      max_submissions_per_user: maxSubmissionsPerUser,
      require_approval: requireApproval,
      show_proofs_immediately: showProofsImmediately,
      deadline: hasDeadline && deadline ? deadline.toISOString() : null,
    });
  }, [
    title,
    description,
    challengeType,
    submissionType,
    targetCount,
    maxSubmissionsPerUser,
    requireApproval,
    showProofsImmediately,
    hasDeadline,
    deadline,
  ]);

  const handleSubmit = () => {
    if (!title.trim() || isSubmitting) return;

    onSubmit({
      post_type: "challenge",
      title: title.trim(),
      description: description.trim(),
      challenge_type: challengeType,
      submission_type: submissionType,
      target_count: targetCount,
      max_submissions_per_user: maxSubmissionsPerUser,
      require_approval: requireApproval,
      deadline: hasDeadline && deadline ? deadline.toISOString() : null,
    });
  };

  const formatDeadline = (date) => {
    if (!date) return "Set deadline";
    const options = {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    };
    return date.toLocaleDateString("en-US", options);
  };

  const isValid = title.trim().length >= 3;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Icon */}
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons
          name="trophy-outline"
          size={40}
          color="#FF9500"
        />
      </View>

      {/* Title Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Challenge Title *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., 30-Day Fitness Challenge"
          placeholderTextColor={COLORS.textSecondary}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />
        <Text style={styles.charCount}>{title.length}/100</Text>
      </View>

      {/* Description Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe what participants need to do..."
          placeholderTextColor={COLORS.textSecondary}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={500}
        />
        <Text style={styles.charCount}>{description.length}/500</Text>
      </View>

      {/* Challenge Type */}
      <View style={styles.sectionGroup}>
        <Text style={styles.sectionTitle}>Challenge Type</Text>
        <View style={styles.typeOptionsRow}>
          {CHALLENGE_TYPES.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.typeOption,
                challengeType === type.id && styles.typeOptionSelected,
              ]}
              onPress={() => setChallengeType(type.id)}
            >
              <Ionicons
                name={type.icon}
                size={20}
                color={
                  challengeType === type.id ? "#FF9500" : COLORS.textSecondary
                }
              />
              <Text
                style={[
                  styles.typeOptionLabel,
                  challengeType === type.id && styles.typeOptionLabelSelected,
                ]}
              >
                {type.label}
              </Text>
              <Text style={styles.typeOptionDesc}>{type.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Target Count (for progress challenges) */}
      {challengeType === "progress" && (
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons
              name="flag-outline"
              size={20}
              color={COLORS.textSecondary}
            />
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Target Count</Text>
              <Text style={styles.settingDescription}>
                Number of submissions to complete
              </Text>
            </View>
          </View>
          <View style={styles.counterContainer}>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => setTargetCount(Math.max(1, targetCount - 1))}
            >
              <Ionicons name="remove" size={18} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.counterValue}>{targetCount}</Text>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() => setTargetCount(Math.min(100, targetCount + 1))}
            >
              <Ionicons name="add" size={18} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Submission Type */}
      <View style={styles.sectionGroup}>
        <Text style={styles.sectionTitle}>Submission Type</Text>
        <View style={styles.submissionTypesRow}>
          {SUBMISSION_TYPES.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.submissionTypeOption,
                submissionType === type.id &&
                  styles.submissionTypeOptionSelected,
              ]}
              onPress={() => setSubmissionType(type.id)}
            >
              <Ionicons
                name={type.icon}
                size={22}
                color={
                  submissionType === type.id ? "#FF9500" : COLORS.textSecondary
                }
              />
              <Text
                style={[
                  styles.submissionTypeLabel,
                  submissionType === type.id &&
                    styles.submissionTypeLabelSelected,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Settings */}
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Settings</Text>

        {/* Max Submissions Per User */}
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons
              name="repeat-outline"
              size={20}
              color={COLORS.textSecondary}
            />
            <Text style={styles.settingLabel}>Submissions per user</Text>
          </View>
          <View style={styles.counterContainer}>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() =>
                setMaxSubmissionsPerUser(Math.max(1, maxSubmissionsPerUser - 1))
              }
            >
              <Ionicons name="remove" size={18} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.counterValue}>{maxSubmissionsPerUser}</Text>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() =>
                setMaxSubmissionsPerUser(
                  Math.min(10, maxSubmissionsPerUser + 1),
                )
              }
            >
              <Ionicons name="add" size={18} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Require Approval */}
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={COLORS.textSecondary}
            />
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Require approval</Text>
              <Text style={styles.settingDescription}>
                Review submissions before showing
              </Text>
            </View>
          </View>
          <Switch
            value={requireApproval}
            onValueChange={setRequireApproval}
            trackColor={{ false: COLORS.border, true: "#FF950050" }}
            thumbColor={requireApproval ? "#FF9500" : COLORS.textSecondary}
          />
        </View>

        {/* Show Proofs Immediately Toggle */}
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons
              name="eye-outline"
              size={20}
              color={COLORS.textSecondary}
            />
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Show proofs immediately</Text>
              <Text style={styles.settingDescription}>
                When off, proofs are hidden until challenge ends (you can always
                view)
              </Text>
            </View>
          </View>
          <Switch
            value={showProofsImmediately}
            onValueChange={setShowProofsImmediately}
            trackColor={{ false: COLORS.border, true: "#FF950050" }}
            thumbColor={
              showProofsImmediately ? "#FF9500" : COLORS.textSecondary
            }
          />
        </View>

        {/* Deadline Toggle */}
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons
              name="time-outline"
              size={20}
              color={COLORS.textSecondary}
            />
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Set deadline</Text>
              <Text style={styles.settingDescription}>
                Challenge ends at a specific time
              </Text>
            </View>
          </View>
          <Switch
            value={hasDeadline}
            onValueChange={(val) => {
              setHasDeadline(val);
              if (val && !deadline) {
                // Default to 7 days from now
                const defaultDeadline = new Date();
                defaultDeadline.setDate(defaultDeadline.getDate() + 7);
                setDeadline(defaultDeadline);
              }
            }}
            trackColor={{ false: COLORS.border, true: "#FF950050" }}
            thumbColor={hasDeadline ? "#FF9500" : COLORS.textSecondary}
          />
        </View>

        {/* Date Picker (if deadline enabled) */}
        {hasDeadline && (
          <>
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={18} color="#FF9500" />
              <Text style={styles.datePickerText}>
                {formatDeadline(deadline)}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={deadline || new Date()}
                mode="date"
                is24Hour={false}
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    const date = new Date(selectedDate);
                    date.setHours(23, 59, 59, 999);
                    setDeadline(date);
                  }
                }}
                minimumDate={new Date()}
              />
            )}
          </>
        )}
      </View>

      {/* Preview */}
      <View style={styles.previewSection}>
        <Text style={styles.previewTitle}>Preview</Text>
        <View style={styles.previewCard}>
          <View style={styles.previewTypeIndicator}>
            <MaterialCommunityIcons
              name="trophy-outline"
              size={14}
              color="#FF9500"
            />
            <Text style={styles.previewTypeLabel}>Challenge</Text>
          </View>
          <Text
            style={[
              styles.previewTitleText,
              !title && { color: COLORS.textSecondary },
            ]}
          >
            {title || "Your challenge title"}
          </Text>
          {description && (
            <Text style={styles.previewDescription} numberOfLines={2}>
              {description}
            </Text>
          )}
          <View style={styles.previewBadges}>
            <View style={styles.previewBadge}>
              <Ionicons
                name={
                  SUBMISSION_TYPES.find((t) => t.id === submissionType)?.icon
                }
                size={12}
                color={COLORS.textSecondary}
              />
              <Text style={styles.previewBadgeText}>
                {SUBMISSION_TYPES.find((t) => t.id === submissionType)?.label}
              </Text>
            </View>
            <View style={styles.previewBadge}>
              <Ionicons
                name={CHALLENGE_TYPES.find((t) => t.id === challengeType)?.icon}
                size={12}
                color={COLORS.textSecondary}
              />
              <Text style={styles.previewBadgeText}>
                {CHALLENGE_TYPES.find((t) => t.id === challengeType)?.label}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.m,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: SPACING.l,
    marginTop: SPACING.m,
  },
  inputGroup: {
    marginBottom: SPACING.l,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    fontSize: 15,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "right",
    marginTop: 4,
  },
  sectionGroup: {
    marginBottom: SPACING.l,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
  },
  typeOptionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  typeOption: {
    flex: 1,
    alignItems: "center",
    padding: SPACING.m,
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: 4,
  },
  typeOptionSelected: {
    borderColor: "#FF9500",
    backgroundColor: "#FF950010",
  },
  typeOptionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  typeOptionLabelSelected: {
    color: "#FF9500",
  },
  typeOptionDesc: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  submissionTypesRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  submissionTypeOption: {
    alignItems: "center",
    padding: SPACING.m,
    paddingHorizontal: SPACING.l,
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  submissionTypeOptionSelected: {
    borderColor: "#FF9500",
    backgroundColor: "#FF950010",
  },
  submissionTypeLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  submissionTypeLabelSelected: {
    color: "#FF9500",
    fontWeight: "600",
  },
  settingsSection: {
    marginBottom: SPACING.l,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingTextContainer: {
    marginLeft: SPACING.s,
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textPrimary,
    marginLeft: SPACING.s,
  },
  settingDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  counterContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  counterButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.screenBackground,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  counterValue: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginHorizontal: SPACING.m,
    minWidth: 20,
    textAlign: "center",
  },
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    marginTop: SPACING.s,
    borderWidth: 1,
    borderColor: "#FF950030",
  },
  datePickerText: {
    flex: 1,
    marginLeft: SPACING.s,
    fontSize: 14,
    color: "#FF9500",
    fontWeight: "500",
  },
  previewSection: {
    marginTop: SPACING.m,
    marginBottom: SPACING.xl,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: SPACING.s,
  },
  previewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.l,
    padding: SPACING.m,
    ...SHADOWS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  previewTypeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  previewTypeLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FF9500",
    marginLeft: 4,
  },
  previewTitleText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  previewDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  previewBadges: {
    flexDirection: "row",
    marginTop: SPACING.s,
  },
  previewBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.screenBackground,
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.s,
    marginRight: SPACING.xs,
  },
  previewBadgeText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
});

export default ChallengeCreateForm;
