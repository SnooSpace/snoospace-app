/**
 * QnACreateForm
 * Form for community admins to create Q&A posts
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
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../constants/theme";

const QnACreateForm = ({ onSubmit, isSubmitting }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [allowAnonymous, setAllowAnonymous] = useState(false);
  const [maxQuestionsPerUser, setMaxQuestionsPerUser] = useState(1);
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiresAt, setExpiresAt] = useState(null);

  // Sync data with parent on every change
  useEffect(() => {
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      allow_anonymous: allowAnonymous,
      max_questions_per_user: maxQuestionsPerUser,
      expires_at: hasExpiry && expiresAt ? expiresAt.toISOString() : null,
    });
  }, [
    title,
    description,
    allowAnonymous,
    maxQuestionsPerUser,
    hasExpiry,
    expiresAt,
  ]);

  const handleSubmit = () => {
    if (!title.trim() || isSubmitting) return;

    onSubmit({
      post_type: "qna",
      title: title.trim(),
      description: description.trim(),
      allow_anonymous: allowAnonymous,
      max_questions_per_user: maxQuestionsPerUser,
      expires_at: hasExpiry && expiresAt ? expiresAt.toISOString() : null,
    });
  };

  const formatExpiry = (date) => {
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
          name="frequently-asked-questions"
          size={40}
          color="#5856D6"
        />
      </View>

      {/* Title Input */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Ask me anything about our event"
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
          placeholder="Share what this Q&A is about..."
          placeholderTextColor={COLORS.textSecondary}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={300}
        />
        <Text style={styles.charCount}>{description.length}/300</Text>
      </View>

      {/* Settings */}
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Settings</Text>

        {/* Max Questions Per User */}
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons
              name="help-circle-outline"
              size={20}
              color={COLORS.textSecondary}
            />
            <Text style={styles.settingLabel}>Questions per user</Text>
          </View>
          <View style={styles.counterContainer}>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() =>
                setMaxQuestionsPerUser(Math.max(1, maxQuestionsPerUser - 1))
              }
            >
              <Ionicons name="remove" size={18} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.counterValue}>{maxQuestionsPerUser}</Text>
            <TouchableOpacity
              style={styles.counterButton}
              onPress={() =>
                setMaxQuestionsPerUser(Math.min(5, maxQuestionsPerUser + 1))
              }
            >
              <Ionicons name="add" size={18} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Allow Anonymous */}
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons
              name="eye-off-outline"
              size={20}
              color={COLORS.textSecondary}
            />
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Allow anonymous</Text>
              <Text style={styles.settingDescription}>
                Users can ask without showing name
              </Text>
            </View>
          </View>
          <Switch
            value={allowAnonymous}
            onValueChange={setAllowAnonymous}
            trackColor={{ false: COLORS.border, true: "#5856D650" }}
            thumbColor={allowAnonymous ? "#5856D6" : COLORS.textSecondary}
          />
        </View>

        {/* Expiry Toggle */}
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
                Q&A ends at a specific time
              </Text>
            </View>
          </View>
          <Switch
            value={hasExpiry}
            onValueChange={(val) => {
              setHasExpiry(val);
              if (val && !expiresAt) {
                // Default to 24 hours from now
                const defaultExpiry = new Date();
                defaultExpiry.setDate(defaultExpiry.getDate() + 1);
                setExpiresAt(defaultExpiry);
              }
            }}
            trackColor={{ false: COLORS.border, true: "#5856D650" }}
            thumbColor={hasExpiry ? "#5856D6" : COLORS.textSecondary}
          />
        </View>

        {/* Date Picker (if expiry enabled) */}
        {hasExpiry && (
          <View style={styles.datePickerButton}>
            <Ionicons name="calendar-outline" size={18} color="#5856D6" />
            <Text style={styles.datePickerText}>{formatExpiry(expiresAt)}</Text>
          </View>
        )}
      </View>

      {/* Submit Button (handled by parent, but show preview) */}
      <View style={styles.previewSection}>
        <Text style={styles.previewTitle}>Preview</Text>
        <View style={styles.previewCard}>
          <View style={styles.previewTypeIndicator}>
            <MaterialCommunityIcons
              name="frequently-asked-questions"
              size={14}
              color="#5856D6"
            />
            <Text style={styles.previewTypeLabel}>Q&A</Text>
          </View>
          <Text style={styles.previewTitleText}>
            {title || "Your Q&A title"}
          </Text>
          {description && (
            <Text style={styles.previewDescription} numberOfLines={2}>
              {description}
            </Text>
          )}
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
  settingsSection: {
    marginBottom: SPACING.l,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
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
    borderColor: "#5856D630",
  },
  datePickerText: {
    flex: 1,
    marginLeft: SPACING.s,
    fontSize: 14,
    color: "#5856D6",
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
    color: "#5856D6",
    marginLeft: 4,
  },
  previewTitleText: {
    fontSize: 16,
    fontWeight: "600",
    color: (title) => (title ? COLORS.textPrimary : COLORS.textSecondary),
  },
  previewDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
});

export default QnACreateForm;
