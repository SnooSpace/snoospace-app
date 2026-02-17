/**
 * PollCreateForm
 * Form for creating poll posts with a premium, card-based design.
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Trash2, Plus, Calendar, Clock, BarChart2 } from "lucide-react-native";
import { COLORS, FONTS, SHADOWS } from "../../constants/theme";

// Enable LayoutAnimation
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MAX_OPTIONS = 6;
const MIN_OPTIONS = 2;

const PollCreateForm = ({ onDataChange, disabled = false }) => {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [showResultsBeforeVote, setShowResultsBeforeVote] = useState(false);
  const [expiresAt, setExpiresAt] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [focusedOptionIndex, setFocusedOptionIndex] = useState(null);

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
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const newOptions = [...options, ""];
      setOptions(newOptions);
      updateData({ options: newOptions });
    }
  };

  const removeOption = (index) => {
    if (options.length > MIN_OPTIONS) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const date = new Date(selectedDate);
      date.setHours(23, 59, 59, 999);
      setExpiresAt(date);
      updateData({ expiresAt: date.toISOString() });
    }
  };

  return (
    <View style={styles.container}>
      {/* Question Card */}
      <View style={styles.card}>
        <View style={styles.heroHeader}>
          <Text style={styles.subtleLabel}>ASK YOUR COMMUNITY</Text>
          <BarChart2 size={22} color={COLORS.primary} strokeWidth={2.5} />
        </View>
        <TextInput
          style={styles.questionInput}
          placeholder="What should we do this weekend?"
          placeholderTextColor={COLORS.textMuted}
          value={question}
          onChangeText={handleQuestionChange}
          maxLength={200}
          multiline
          editable={!disabled}
          selectionColor={COLORS.primary}
        />
        <Text style={styles.charCount}>{question.length}/200</Text>
      </View>

      {/* Options Section */}
      <View style={styles.optionsContainer}>
        {options.map((option, index) => {
          const isFocused = focusedOptionIndex === index;
          return (
            <View
              key={index}
              style={[styles.optionCard, isFocused && styles.optionCardFocused]}
            >
              <View style={styles.optionNumber}>
                <Text style={styles.optionNumberText}>{index + 1}</Text>
              </View>

              <TextInput
                style={styles.optionInput}
                placeholder={`Option ${index + 1}`}
                placeholderTextColor={COLORS.textMuted}
                value={option}
                onChangeText={(text) => handleOptionChange(index, text)}
                onFocus={() => setFocusedOptionIndex(index)}
                onBlur={() => setFocusedOptionIndex(null)}
                maxLength={80}
                editable={!disabled}
                selectionColor={COLORS.primary}
              />

              {/* Show delete only if > min options, and ideally on focus or always visible but subtle */}
              {options.length > MIN_OPTIONS && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => removeOption(index)}
                  disabled={disabled}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Trash2
                    size={20}
                    color={isFocused ? "#FF3B30" : "#D1D5DB"}
                    strokeWidth={2}
                  />
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {options.length < MAX_OPTIONS && (
          <TouchableOpacity
            style={styles.addOptionButton}
            onPress={addOption}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <Plus
              size={18}
              color={COLORS.textSecondary}
              strokeWidth={2.5}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.addOptionText}>Add option</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Settings Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Poll Settings</Text>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Allow multiple selections</Text>
            <Text style={styles.settingSubLabel}>
              Voters can choose more than one option
            </Text>
          </View>
          <Switch
            trackColor={{ false: "#E5E7EB", true: COLORS.primary }}
            thumbColor={"#FFFFFF"}
            ios_backgroundColor="#E5E7EB"
            onValueChange={() => toggleSetting("multiple")}
            value={allowMultiple}
            disabled={disabled}
          />
        </View>

        <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Show results before voting</Text>
            <Text style={styles.settingSubLabel}>
              Users can see results without voting
            </Text>
          </View>
          <Switch
            trackColor={{ false: "#E5E7EB", true: COLORS.primary }}
            thumbColor={"#FFFFFF"}
            ios_backgroundColor="#E5E7EB"
            onValueChange={() => toggleSetting("showResults")}
            value={showResultsBeforeVote}
            disabled={disabled}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    ...SHADOWS.sm,
    shadowColor: "rgba(0,0,0,0.04)",
    shadowOpacity: 1, // Using opacity 1 with very light color
    shadowRadius: 20,
    elevation: 2,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  subtleLabel: {
    fontSize: 12,
    fontFamily: "Manrope-Bold",
    color: COLORS.textSecondary,
    opacity: 0.6,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  questionInput: {
    fontFamily: "Manrope-Regular",
    fontSize: 18,
    lineHeight: 26,
    color: COLORS.textPrimary,
    minHeight: 60,
    textAlignVertical: "top",
    padding: 0,
  },
  charCount: {
    fontSize: 11,
    fontFamily: "Manrope-Medium",
    color: COLORS.textMuted,
    textAlign: "right",
    marginTop: 8,
  },
  optionsContainer: {
    marginBottom: 28,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FB",
    borderRadius: 16,
    height: 52,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  optionCardFocused: {
    backgroundColor: "#FFFFFF",
    borderColor: COLORS.primary,
    ...SHADOWS.sm,
  },
  optionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(41, 98, 255, 0.1)", // Light brand blue
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  optionNumberText: {
    fontSize: 12,
    fontFamily: "Manrope-Bold",
    color: COLORS.primary,
  },
  optionInput: {
    flex: 1,
    fontFamily: "Manrope-Medium",
    fontSize: 15,
    color: COLORS.textPrimary,
    height: "100%",
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  addOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderStyle: "dashed",
    marginTop: 4,
  },
  addOptionText: {
    fontFamily: "Manrope-Medium",
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  cardHeader: {
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "BasicCommercial-Bold", // Using the brand font
    color: COLORS.textPrimary,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    marginBottom: 8,
  },
  settingInfo: {
    flex: 1,
    paddingRight: 16,
  },
  settingLabel: {
    fontSize: 15,
    fontFamily: "Manrope-Medium",
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  settingSubLabel: {
    fontSize: 12,
    fontFamily: "Manrope-Regular",
    color: "#9CA3AF",
  },
});

export default PollCreateForm;
