/**
 * QnACreateForm
 * Form for community admins to create Q&A posts with premium design
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { HatGlasses } from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  FONTS,
} from "../../constants/theme";
import HapticsService from "../../services/HapticsService";

// Enable LayoutAnimation for Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const QnACreateForm = ({ onSubmit, isSubmitting }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [allowAnonymous, setAllowAnonymous] = useState(false);
  const [maxQuestionsPerUser, setMaxQuestionsPerUser] = useState(1);
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiresAt, setExpiresAt] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Animation values
  const stepperScale = useRef(new Animated.Value(1)).current;

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

  const animateStepper = () => {
    Animated.sequence([
      Animated.spring(stepperScale, {
        toValue: 1.1,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.spring(stepperScale, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleIncrement = () => {
    if (maxQuestionsPerUser < 10) {
      HapticsService.triggerImpactLight();
      animateStepper();
      setMaxQuestionsPerUser((prev) => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (maxQuestionsPerUser > 1) {
      HapticsService.triggerImpactLight();
      animateStepper();
      setMaxQuestionsPerUser((prev) => prev - 1);
    }
  };

  const toggleExpiry = (val) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setHasExpiry(val);
    if (val && !expiresAt) {
      const defaultExpiry = new Date();
      defaultExpiry.setDate(defaultExpiry.getDate() + 1);
      defaultExpiry.setHours(20, 0, 0, 0); // Default to 8 PM next day
      setExpiresAt(defaultExpiry);
    }
  };

  const formatExpiryDate = (date) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatExpiryTime = (date) => {
    if (!date) return "";
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero Card */}
      <View style={styles.heroCard}>
        <Text style={styles.subtleLabel}>START A Q&A</Text>

        <View style={styles.titleInputContainer}>
          <TextInput
            style={styles.titleInput}
            placeholder="Ask me anything about our event"
            placeholderTextColor={COLORS.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            selectionColor={COLORS.primary}
            multiline
          />
          <Text style={styles.charCount}>{title.length}/100</Text>
        </View>

        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionLabel}>Optional description</Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Add more details..."
            placeholderTextColor={COLORS.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={300}
            selectionColor={COLORS.primary}
          />
          <Text style={[styles.charCount, { marginTop: 4 }]}>
            {description.length}/300
          </Text>
        </View>
      </View>

      {/* Settings Card */}
      <View style={styles.settingsCard}>
        <Text style={styles.cardTitle}>Q&A Settings</Text>

        {/* Questions Per User Stepper */}
        <View style={styles.settingSection}>
          <Text style={styles.settingLabelCentered}>Questions per user</Text>
          <View style={styles.stepperContainer}>
            <TouchableOpacity
              style={styles.stepperButton}
              onPress={handleDecrement}
              activeOpacity={0.7}
            >
              <Ionicons name="remove" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>

            <Animated.Text
              style={[
                styles.stepperValue,
                { transform: [{ scale: stepperScale }] },
              ]}
            >
              {maxQuestionsPerUser}
            </Animated.Text>

            <TouchableOpacity
              style={styles.stepperButton}
              onPress={handleIncrement}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Allow Anonymous */}
        <View style={styles.settingRow}>
          <View style={styles.settingRowLeft}>
            <View style={styles.iconBox}>
              <HatGlasses
                size={20}
                color={COLORS.textPrimary}
                strokeWidth={2}
              />
            </View>
            <View>
              <Text style={styles.settingRowTitle}>Allow anonymous</Text>
              <Text style={styles.settingRowSubtitle}>
                Users can ask without showing name
              </Text>
            </View>
          </View>
          <Switch
            value={allowAnonymous}
            onValueChange={setAllowAnonymous}
            trackColor={{ false: "#E5E7EB", true: COLORS.primary }}
            thumbColor={"#FFFFFF"}
            ios_backgroundColor="#E5E7EB"
          />
        </View>

        {/* Set Deadline */}
        <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
          <View style={styles.settingRowLeft}>
            <View style={styles.iconBox}>
              <Ionicons
                name="time-outline"
                size={20}
                color={COLORS.textPrimary}
              />
            </View>
            <View>
              <Text style={styles.settingRowTitle}>Set deadline</Text>
              <Text style={styles.settingRowSubtitle}>
                Q&A ends at a specific time
              </Text>
            </View>
          </View>
          <Switch
            value={hasExpiry}
            onValueChange={toggleExpiry}
            trackColor={{ false: "#E5E7EB", true: COLORS.primary }}
            thumbColor={"#FFFFFF"}
            ios_backgroundColor="#E5E7EB"
          />
        </View>

        {/* Dynamic Deadline Expansion */}
        {hasExpiry && (
          <View style={styles.deadlineExpand}>
            <TouchableOpacity
              style={styles.datePreviewCard}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
              <View>
                <Text style={styles.dateLabel}>Ends on</Text>
                <Text style={styles.dateValue}>
                  {formatExpiryDate(expiresAt)} · {formatExpiryTime(expiresAt)}
                </Text>
              </View>
              <Ionicons name="pencil" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={expiresAt || new Date()}
          mode="date" // Ideally we'd have a combined picker or two steps
          is24Hour={false}
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              const date = new Date(selectedDate);
              // Preserve the default 8 PM time if only date changed, strictly speaking
              // DateTimePicker logic might vary. For now, we set date.
              // If we want time picking too, we'd need another step or mode="datetime" on iOS
              date.setHours(20, 0, 0, 0);
              setExpiresAt(date);
            }
          }}
          minimumDate={new Date()}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    ...SHADOWS.sm,
    shadowColor: "rgba(0,0,0,0.05)",
    shadowOpacity: 1,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  subtleLabel: {
    fontSize: 12,
    fontFamily: "Manrope-Bold",
    color: COLORS.textSecondary,
    opacity: 0.6,
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  titleInputContainer: {
    marginBottom: 24,
  },
  titleInput: {
    fontFamily: "Manrope-Regular", // Keeping standard weight, 18px
    fontSize: 18,
    lineHeight: 26,
    color: COLORS.textPrimary,
    padding: 0,
    minHeight: 30,
  },
  charCount: {
    fontSize: 11,
    fontFamily: "Manrope-Medium",
    color: "#9CA3AF",
    textAlign: "right",
    marginTop: 4,
  },
  descriptionContainer: {
    //
  },
  descriptionLabel: {
    fontSize: 12,
    fontFamily: "Manrope-Medium",
    color: COLORS.textSecondary,
    opacity: 0.6,
    marginBottom: 6,
  },
  descriptionInput: {
    backgroundColor: "#F8F9FB",
    borderRadius: 16,
    padding: 16,
    fontFamily: "Manrope-Medium",
    fontSize: 15,
    color: COLORS.textPrimary,
    minHeight: 80,
    textAlignVertical: "top",
  },
  settingsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    marginBottom: 40,
    ...SHADOWS.sm, // Using theme shadow but could override for softer look
    shadowColor: "rgba(0,0,0,0.04)",
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "BasicCommercial-Bold",
    color: COLORS.textPrimary,
    marginBottom: 20,
  },
  settingSection: {
    marginBottom: 24,
  },
  settingLabelCentered: {
    fontSize: 15,
    fontFamily: "Manrope-Medium",
    color: COLORS.textPrimary,
    marginBottom: 12,
    textAlign: "center",
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F6F7F9",
    borderRadius: 20,
    height: 48,
    paddingHorizontal: 8,
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  stepperValue: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: COLORS.textPrimary,
    minWidth: 40,
    textAlign: "center",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  settingRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  iconBox: {
    width: 20,
    alignItems: "center",
  },
  settingRowTitle: {
    fontSize: 15,
    fontFamily: "Manrope-Medium", // "Manrope 15" from spec
    color: COLORS.textPrimary,
  },
  settingRowSubtitle: {
    fontSize: 12,
    fontFamily: "Manrope-Regular",
    color: "#6B7280", // #6B7280
  },
  deadlineExpand: {
    marginTop: -8, // Pull closer to toggle
    marginBottom: 8,
    paddingLeft: 32, // Indent to align with text
  },
  datePreviewCard: {
    backgroundColor: "#F8F9FB",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateLabel: {
    fontSize: 11,
    fontFamily: "Manrope-Medium",
    color: "#6B7280",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  dateValue: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: COLORS.textPrimary,
  },
});

export default QnACreateForm;
