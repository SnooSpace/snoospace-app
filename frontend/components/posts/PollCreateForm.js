/**
 * PollCreateForm
 * Form for creating poll posts
 */

import React, { useState, Platform } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, BORDER_RADIUS } from "../../constants/theme";

const MAX_OPTIONS = 6;
const MIN_OPTIONS = 2;

const PollCreateForm = ({ onDataChange, disabled = false }) => {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [showResultsBeforeVote, setShowResultsBeforeVote] = useState(false);
  const [expiresAt, setExpiresAt] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Notify parent of data changes
  const updateData = (updates) => {
    const newData = {
      question: updates.question !== undefined ? updates.question : question,
      options: updates.options !== undefined ? updates.options : options,
      allow_multiple:
        updates.allowMultiple !== undefined
          ? updates.allowMultiple
          : allowMultiple,
      show_results_before_vote:
        updates.showResultsBeforeVote !== undefined
          ? updates.showResultsBeforeVote
          : showResultsBeforeVote,
      expires_at:
        updates.expiresAt !== undefined ? updates.expiresAt : expiresAt,
    };
    onDataChange?.(newData);
  };

  const handleQuestionChange = (text) => {
    setQuestion(text);
    updateData({ question: text });
  };

  const handleOptionChange = (index, text) => {
    const newOptions = [...options];
    newOptions[index] = text;
    setOptions(newOptions);
    updateData({ options: newOptions });
  };

  const addOption = () => {
    if (options.length < MAX_OPTIONS) {
      const newOptions = [...options, ""];
      setOptions(newOptions);
      updateData({ options: newOptions });
    }
  };

  const removeOption = (index) => {
    if (options.length > MIN_OPTIONS) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
      updateData({ options: newOptions });
    }
  };

  const toggleSetting = (setting) => {
    if (setting === "multiple") {
      const newValue = !allowMultiple;
      setAllowMultiple(newValue);
      updateData({ allowMultiple: newValue });
    } else if (setting === "showResults") {
      const newValue = !showResultsBeforeVote;
      setShowResultsBeforeVote(newValue);
      updateData({ showResultsBeforeVote: newValue });
    }
  };

  const setDeadlinePreset = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(23, 59, 59, 999); // End of day
    setExpiresAt(date);
    updateData({ expiresAt: date.toISOString() });
  };

  const handleDateChange = (event, selectedDate) => {
    // Always close the picker after an interaction
    setShowDatePicker(false);

    // Save the selected date if provided
    if (selectedDate) {
      // Set to end of the selected day to match preset behavior
      const date = new Date(selectedDate);
      date.setHours(23, 59, 59, 999);

      setExpiresAt(date);
      updateData({ expiresAt: date.toISOString() });
    }
  };

  const clearDeadline = () => {
    setShowDatePicker(false); // Close picker first
    setExpiresAt(null);
    updateData({ expiresAt: null });
  };

  return (
    <View style={styles.container}>
      {/* Question Input */}
      <View style={styles.section}>
        <Text style={styles.label}>Poll Question</Text>
        <TextInput
          style={styles.questionInput}
          placeholder="Ask your community something..."
          placeholderTextColor={COLORS.textSecondary}
          value={question}
          onChangeText={handleQuestionChange}
          maxLength={200}
          multiline
          editable={!disabled}
        />
        <Text style={styles.charCount}>{question.length}/200</Text>
      </View>

      {/* Options */}
      <View style={styles.section}>
        <Text style={styles.label}>Options</Text>
        {options.map((option, index) => (
          <View key={index} style={styles.optionRow}>
            <View style={styles.optionNumber}>
              <Text style={styles.optionNumberText}>{index + 1}</Text>
            </View>
            <TextInput
              style={styles.optionInput}
              placeholder={`Option ${index + 1}`}
              placeholderTextColor={COLORS.textSecondary}
              value={option}
              onChangeText={(text) => handleOptionChange(index, text)}
              maxLength={80}
              editable={!disabled}
            />
            {options.length > MIN_OPTIONS && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeOption(index)}
                disabled={disabled}
              >
                <Ionicons
                  name="close-circle"
                  size={22}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        ))}

        {options.length < MAX_OPTIONS && (
          <TouchableOpacity
            style={styles.addOptionButton}
            onPress={addOption}
            disabled={disabled}
          >
            <Ionicons
              name="add-circle-outline"
              size={20}
              color={COLORS.primary}
            />
            <Text style={styles.addOptionText}>Add option</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Settings */}
      <View style={styles.section}>
        <Text style={styles.label}>Settings</Text>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => toggleSetting("multiple")}
          disabled={disabled}
        >
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Allow multiple selections</Text>
            <Text style={styles.settingDescription}>
              Voters can choose more than one option
            </Text>
          </View>
          <View
            style={[styles.checkbox, allowMultiple && styles.checkboxChecked]}
          >
            {allowMultiple && (
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => toggleSetting("showResults")}
          disabled={disabled}
        >
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Show results before voting</Text>
            <Text style={styles.settingDescription}>
              Users can see current results without voting
            </Text>
          </View>
          <View
            style={[
              styles.checkbox,
              showResultsBeforeVote && styles.checkboxChecked,
            ]}
          >
            {showResultsBeforeVote && (
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            )}
          </View>
        </TouchableOpacity>

        {/* Deadline */}
        <View style={styles.deadlineSection}>
          <Text style={styles.settingTitle}>Poll Deadline (Optional)</Text>
          <Text style={styles.settingDescription}>
            Set when voting should close
          </Text>

          {!expiresAt ? (
            <View style={styles.presetButtons}>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => setDeadlinePreset(1)}
                disabled={disabled}
              >
                <Text style={styles.presetButtonText}>1 Day</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => setDeadlinePreset(3)}
                disabled={disabled}
              >
                <Text style={styles.presetButtonText}>3 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => setDeadlinePreset(7)}
                disabled={disabled}
              >
                <Text style={styles.presetButtonText}>1 Week</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetButton}
                onPress={() => setShowDatePicker(true)}
                disabled={disabled}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={COLORS.primary}
                />
                <Text style={styles.presetButtonText}>Custom</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.deadlineDisplay}>
              <View style={styles.deadlineInfo}>
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={COLORS.primary}
                />
                <Text style={styles.deadlineText}>
                  {expiresAt.toLocaleDateString()} at{" "}
                  {expiresAt.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
              <TouchableOpacity onPress={clearDeadline} disabled={disabled}>
                <Text style={styles.clearButton}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}

          {showDatePicker && (
            <DateTimePicker
              value={expiresAt || new Date()}
              mode="date"
              is24Hour={false}
              display="default"
              onChange={handleDateChange}
              minimumDate={new Date()}
            />
          )}
        </View>
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
    marginBottom: SPACING.s,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  questionInput: {
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    fontSize: 16,
    color: COLORS.textPrimary,
    minHeight: 80,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "right",
    marginTop: SPACING.xs,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.s,
  },
  optionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.screenBackground,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACING.s,
  },
  optionNumberText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  optionInput: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  removeButton: {
    padding: SPACING.s,
    marginLeft: SPACING.xs,
  },
  addOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.m,
    marginTop: SPACING.xs,
  },
  addOptionText: {
    fontSize: 14,
    color: COLORS.primary,
    marginLeft: SPACING.s,
    fontWeight: "500",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  deadlineSection: {
    paddingTop: SPACING.m,
    marginTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  presetButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.s,
    marginTop: SPACING.m,
  },
  presetButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.m,
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  presetButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.primary,
  },
  deadlineDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SPACING.m,
    padding: SPACING.m,
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
  },
  deadlineInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.s,
  },
  deadlineText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textPrimary,
  },
  clearButton: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.error,
  },
});

export default PollCreateForm;
