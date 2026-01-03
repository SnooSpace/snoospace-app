/**
 * PromptCreateForm
 * Form for creating prompt posts
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, BORDER_RADIUS } from "../../constants/theme";

const SUBMISSION_TYPES = [
  { id: "text", label: "Text", icon: "document-text-outline" },
  { id: "image", label: "Image", icon: "image-outline" },
];

const PromptCreateForm = ({ onDataChange, disabled = false }) => {
  const [promptText, setPromptText] = useState("");
  const [submissionType, setSubmissionType] = useState("text");
  const [maxLength, setMaxLength] = useState(500);
  const [requireApproval, setRequireApproval] = useState(true);

  // Notify parent of data changes
  const updateData = (updates) => {
    const newData = {
      prompt_text:
        updates.promptText !== undefined ? updates.promptText : promptText,
      submission_type:
        updates.submissionType !== undefined
          ? updates.submissionType
          : submissionType,
      max_length:
        updates.maxLength !== undefined ? updates.maxLength : maxLength,
      require_approval:
        updates.requireApproval !== undefined
          ? updates.requireApproval
          : requireApproval,
    };
    onDataChange?.(newData);
  };

  const handlePromptTextChange = (text) => {
    setPromptText(text);
    updateData({ promptText: text });
  };

  const handleSubmissionTypeChange = (type) => {
    setSubmissionType(type);
    updateData({ submissionType: type });
  };

  const handleMaxLengthChange = (text) => {
    const num = parseInt(text) || 0;
    const clamped = Math.min(Math.max(num, 50), 2000);
    setMaxLength(clamped);
    updateData({ maxLength: clamped });
  };

  const handleRequireApprovalChange = (value) => {
    setRequireApproval(value);
    updateData({ requireApproval: value });
  };

  return (
    <View style={styles.container}>
      {/* Prompt Text Input */}
      <View style={styles.section}>
        <Text style={styles.label}>Prompt</Text>
        <Text style={styles.sublabel}>
          What would you like your community to share?
        </Text>
        <TextInput
          style={styles.promptInput}
          placeholder="e.g., Share your favorite memory from this year..."
          placeholderTextColor={COLORS.textSecondary}
          value={promptText}
          onChangeText={handlePromptTextChange}
          maxLength={300}
          multiline
          editable={!disabled}
        />
        <Text style={styles.charCount}>{promptText.length}/300</Text>
      </View>

      {/* Submission Type */}
      <View style={styles.section}>
        <Text style={styles.label}>Response Type</Text>
        <View style={styles.typeSelector}>
          {SUBMISSION_TYPES.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.typeOption,
                submissionType === type.id && styles.typeOptionSelected,
              ]}
              onPress={() => handleSubmissionTypeChange(type.id)}
              disabled={disabled}
            >
              <Ionicons
                name={type.icon}
                size={20}
                color={
                  submissionType === type.id
                    ? COLORS.primary
                    : COLORS.textSecondary
                }
              />
              <Text
                style={[
                  styles.typeOptionText,
                  submissionType === type.id && styles.typeOptionTextSelected,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Max Length (for text only) */}
      {submissionType === "text" && (
        <View style={styles.section}>
          <Text style={styles.label}>Max Characters</Text>
          <View style={styles.lengthSelector}>
            {[100, 250, 500, 1000].map((len) => (
              <TouchableOpacity
                key={len}
                style={[
                  styles.lengthOption,
                  maxLength === len && styles.lengthOptionSelected,
                ]}
                onPress={() => {
                  setMaxLength(len);
                  updateData({ maxLength: len });
                }}
                disabled={disabled}
              >
                <Text
                  style={[
                    styles.lengthOptionText,
                    maxLength === len && styles.lengthOptionTextSelected,
                  ]}
                >
                  {len}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Settings */}
      <View style={styles.section}>
        <Text style={styles.label}>Moderation</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Require approval</Text>
            <Text style={styles.settingDescription}>
              Review submissions before they're published
            </Text>
          </View>
          <Switch
            value={requireApproval}
            onValueChange={handleRequireApprovalChange}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor="#FFFFFF"
            disabled={disabled}
          />
        </View>

        {!requireApproval && (
          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={16} color="#F9A825" />
            <Text style={styles.warningText}>
              Submissions will be visible immediately without review
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: SPACING.m,
  },
  section: {
    marginBottom: SPACING.l,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sublabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.s,
  },
  promptInput: {
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    fontSize: 16,
    color: COLORS.textPrimary,
    minHeight: 100,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "right",
    marginTop: SPACING.xs,
  },
  typeSelector: {
    flexDirection: "row",
    gap: SPACING.s,
  },
  typeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.m,
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    borderWidth: 2,
    borderColor: "transparent",
    gap: SPACING.s,
  },
  typeOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "#E3F2FD",
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  typeOptionTextSelected: {
    color: COLORS.primary,
  },
  lengthSelector: {
    flexDirection: "row",
    gap: SPACING.s,
  },
  lengthOption: {
    flex: 1,
    alignItems: "center",
    padding: SPACING.m,
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    borderWidth: 2,
    borderColor: "transparent",
  },
  lengthOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "#E3F2FD",
  },
  lengthOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  lengthOptionTextSelected: {
    color: COLORS.primary,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.m,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.textPrimary,
  },
  settingDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF8E1",
    borderRadius: BORDER_RADIUS.s,
    padding: SPACING.s,
    gap: SPACING.s,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: "#F57C00",
  },
});

export default PromptCreateForm;
