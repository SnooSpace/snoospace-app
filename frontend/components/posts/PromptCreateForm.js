/**
 * PromptCreateForm
 * Form for creating prompt posts with a premium, card-based design.
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
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { FileText, Image as ImageIcon } from "lucide-react-native"; // Using Lucide for cleaner icons
import { COLORS, FONTS, SHADOWS } from "../../constants/theme";
import HapticsService from "../../services/HapticsService";

// Enable LayoutAnimation
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SUBMISSION_TYPES = [
  { id: "text", label: "Text", icon: FileText },
  { id: "image", label: "Image", icon: ImageIcon },
];

const PromptCreateForm = ({ onDataChange, disabled = false }) => {
  const [promptText, setPromptText] = useState("");
  const [submissionType, setSubmissionType] = useState("text");
  const [maxLength, setMaxLength] = useState(500);
  const [requireApproval, setRequireApproval] = useState(true);

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;

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
    HapticsService.triggerImpactLight();
    // Micro-animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.98,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    setSubmissionType(type);
    updateData({ submissionType: type });
  };

  const handleMaxLengthChange = (val) => {
    // Snap to increments of 50 for cleaner numbers
    const snapped = Math.round(val / 50) * 50;
    if (snapped !== maxLength) {
      setMaxLength(snapped);
      updateData({ maxLength: snapped });
      // Optional: very light haptic on change, but slider might fire often
    }
  };

  const handleRequireApprovalChange = (value) => {
    setRequireApproval(value);
    updateData({ requireApproval: value });
    HapticsService.triggerImpactLight();
  };

  return (
    <View style={styles.container}>
      {/* Prompt Question Card */}
      <View style={styles.card}>
        <Text style={styles.subtleLabel}>ASK YOUR COMMUNITY</Text>
        <TextInput
          style={styles.promptInput}
          placeholder="What would you like your community to share?"
          placeholderTextColor={COLORS.textMuted}
          value={promptText}
          onChangeText={handlePromptTextChange}
          maxLength={300}
          multiline
          editable={!disabled}
          selectionColor={COLORS.primary}
        />
        <Text style={styles.helperText}>
          e.g., Share your favorite memory from this year.
        </Text>
        <Text style={styles.charCount}>{promptText.length}/300</Text>
      </View>

      {/* Response Type Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Response Type</Text>
      </View>

      <View style={styles.typeContainer}>
        {SUBMISSION_TYPES.map((type) => {
          const isSelected = submissionType === type.id;
          const IconComponent = type.icon;

          return (
            <TouchableOpacity
              key={type.id}
              style={[styles.typeCard, isSelected && styles.typeCardSelected]}
              onPress={() => handleSubmissionTypeChange(type.id)}
              disabled={disabled}
              activeOpacity={0.8}
            >
              <View style={styles.iconWrapper}>
                <IconComponent
                  size={24}
                  color={isSelected ? COLORS.primary : "#9CA3AF"}
                  strokeWidth={2}
                />
              </View>
              <Text
                style={[
                  styles.typeLabel,
                  isSelected && styles.typeLabelSelected,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Max Characters (Slider) - Only for Text */}
      {submissionType === "text" && (
        <View style={styles.sliderSection}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sectionTitle}>Max Characters</Text>
            <Text style={styles.sliderValue}>{maxLength}</Text>
          </View>

          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabelLeft}>100</Text>
            <Slider
              style={{ flex: 1, height: 40 }} // Ensure height is set for touch area
              minimumValue={100}
              maximumValue={2000}
              step={50}
              value={maxLength}
              onValueChange={handleMaxLengthChange}
              minimumTrackTintColor={COLORS.primary}
              maximumTrackTintColor="#E5E7EB"
              thumbTintColor={COLORS.primary} // Android
              // iOS thumb image/tint works differently, standardized via props
            />
            <Text style={styles.sliderLabelRight}>2000</Text>
          </View>
        </View>
      )}

      {/* Moderation Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Moderation</Text>
        </View>

        <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Require approval</Text>
            <Text style={styles.settingSubLabel}>
              Review submissions before they're published
            </Text>
          </View>
          <Switch
            trackColor={{ false: "#E5E7EB", true: COLORS.primary }}
            thumbColor={"#FFFFFF"}
            ios_backgroundColor="#E5E7EB"
            onValueChange={handleRequireApprovalChange}
            value={requireApproval}
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
    padding: 22,
    marginBottom: 28,
    ...SHADOWS.sm,
    shadowColor: "rgba(0,0,0,0.04)", // Very subtle shadow
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  subtleLabel: {
    fontSize: 12,
    fontFamily: "Manrope-Bold",
    color: COLORS.textSecondary,
    opacity: 0.6,
    letterSpacing: 0.8,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  promptInput: {
    fontFamily: "Manrope-Regular",
    fontSize: 18,
    lineHeight: 26,
    color: COLORS.textPrimary,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 12,
    padding: 0, // Remove default padding for clean look
  },
  helperText: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: "#6B7280",
    marginBottom: 8,
  },
  charCount: {
    fontSize: 11,
    fontFamily: "Manrope-Medium",
    color: COLORS.textMuted, // Using defined textMuted or similar hex
    textAlign: "right",
    opacity: 0.8,
  },
  sectionHeader: {
    marginBottom: 16,
    paddingHorizontal: 4, // Slight indent alignment
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "BasicCommercial-Bold",
    color: COLORS.textPrimary,
  },
  typeContainer: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 32,
  },
  typeCard: {
    flex: 1,
    height: 64, // Mini card height
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FB",
    borderRadius: 16, // Smoother radius
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  typeCardSelected: {
    backgroundColor: "#EEF4FF", // Very light blue tint
    borderColor: COLORS.primary,
  },
  typeLabel: {
    fontSize: 15,
    fontFamily: "Manrope-Medium",
    color: "#6B7280",
  },
  typeLabelSelected: {
    color: COLORS.primary,
    fontFamily: "Manrope-SemiBold",
  },
  sliderSection: {
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sliderValue: {
    fontSize: 15,
    fontFamily: "Manrope-Bold",
    color: COLORS.primary,
  },
  sliderContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F6F7F9", // Soft container backing optional, or keep simple
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sliderLabelLeft: {
    fontSize: 12,
    fontFamily: "Manrope-Medium",
    color: "#9CA3AF",
    marginRight: 10,
    width: 30,
    textAlign: "center",
  },
  sliderLabelRight: {
    fontSize: 12,
    fontFamily: "Manrope-Medium",
    color: "#9CA3AF",
    marginLeft: 10,
    width: 35,
    textAlign: "center",
  },
  cardHeader: {
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "BasicCommercial-Bold",
    color: COLORS.textPrimary,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4, // Tighter inside card
  },
  settingInfo: {
    flex: 1,
    paddingRight: 16,
  },
  settingLabel: {
    fontSize: 15,
    fontFamily: "Manrope-Medium",
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  settingSubLabel: {
    fontSize: 12,
    fontFamily: "Manrope-Regular",
    color: "#9CA3AF",
  },
});

export default PromptCreateForm;
