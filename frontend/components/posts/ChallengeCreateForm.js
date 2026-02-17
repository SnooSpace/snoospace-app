/**
 * ChallengeCreateForm
 * Form for community admins to create Challenge posts with premium design
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
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Trophy,
  CheckCircle2,
  TrendingUp,
  Users,
  Camera,
  Video,
  ShieldCheck,
  Eye,
  Clock,
  Pencil,
  Plus,
  Minus,
} from "lucide-react-native";
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

const CHALLENGE_TYPES = [
  {
    id: "single",
    label: "Single Task",
    description: "One-time proof",
    icon: CheckCircle2,
  },
  {
    id: "progress",
    label: "Progress",
    description: "Track progress",
    icon: TrendingUp,
  },
  {
    id: "community",
    label: "Community",
    description: "Group goal",
    icon: Users,
  },
];

const SUBMISSION_TYPES = [
  { id: "image", label: "Photo", icon: Camera },
  { id: "video", label: "Video", icon: Video },
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

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const stepperScale = useRef(new Animated.Value(1)).current;

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

  const animateCardPress = () => {
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
  };

  const handleChallengeTypeChange = (type) => {
    HapticsService.triggerImpactLight();
    animateCardPress();
    setChallengeType(type);
  };

  const handleSubmissionTypeChange = (type) => {
    HapticsService.triggerImpactLight();
    animateCardPress();
    setSubmissionType(type);
  };

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
    if (maxSubmissionsPerUser < 10) {
      HapticsService.triggerImpactLight();
      animateStepper();
      setMaxSubmissionsPerUser((prev) => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (maxSubmissionsPerUser > 1) {
      HapticsService.triggerImpactLight();
      animateStepper();
      setMaxSubmissionsPerUser((prev) => prev - 1);
    }
  };

  const toggleDeadline = (val) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setHasDeadline(val);
    if (val && !deadline) {
      const defaultDeadline = new Date();
      defaultDeadline.setDate(defaultDeadline.getDate() + 7);
      defaultDeadline.setHours(20, 0, 0, 0);
      setDeadline(defaultDeadline);
    }
  };

  const formatDeadline = (date) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatDeadlineTime = (date) => {
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
        <View style={styles.heroHeader}>
          <Text style={styles.subtleLabel}>CREATE A CHALLENGE</Text>
          <MaterialCommunityIcons name="trophy" size={22} color="#FF9500" />
        </View>

        <View style={styles.titleInputContainer}>
          <TextInput
            style={styles.titleInput}
            placeholder="30-Day Fitness Challenge"
            placeholderTextColor={COLORS.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            selectionColor="#FF9500"
            multiline
          />
          <Text style={styles.charCount}>{title.length}/100</Text>
        </View>

        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionLabel}>Optional description</Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Tell participants what success looks like."
            placeholderTextColor={COLORS.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={500}
            selectionColor="#FF9500"
          />
          <Text style={styles.helperText}>
            Tell participants what success looks like.
          </Text>
        </View>
      </View>

      {/* Challenge Type */}
      <View style={styles.sectionGroup}>
        <Text style={styles.sectionTitle}>Challenge Type</Text>
        <View style={styles.typeOptionsRow}>
          {CHALLENGE_TYPES.map((type) => {
            const isSelected = challengeType === type.id;
            return (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.featureCard,
                  isSelected && styles.featureCardSelected,
                ]}
                onPress={() => handleChallengeTypeChange(type.id)}
                activeOpacity={0.9}
              >
                <type.icon
                  size={20}
                  color={isSelected ? "#FF9500" : COLORS.textSecondary}
                  strokeWidth={2.5}
                />
                <Text
                  style={[
                    styles.featureCardTitle,
                    isSelected && styles.featureCardTitleSelected,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {type.label}
                </Text>
                <Text style={styles.featureCardSubtitle}>
                  {type.description}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Submission Type */}
      <View style={styles.sectionGroup}>
        <Text style={styles.sectionTitle}>Submission Type</Text>
        <View style={styles.submissionTypesRow}>
          {SUBMISSION_TYPES.map((type) => {
            const isSelected = submissionType === type.id;
            return (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.miniFeatureCard,
                  isSelected && styles.miniFeatureCardSelected,
                ]}
                onPress={() => handleSubmissionTypeChange(type.id)}
                activeOpacity={0.9}
              >
                <type.icon
                  size={22}
                  color={isSelected ? "#FF9500" : COLORS.textSecondary}
                  strokeWidth={2.5}
                />
                <Text
                  style={[
                    styles.miniFeatureCardTitle,
                    isSelected && styles.miniFeatureCardTitleSelected,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Settings Card */}
      <View style={styles.settingsCard}>
        <Text style={styles.cardTitle}>Settings</Text>

        {/* Submissions Per User Stepper */}
        <View style={styles.settingSection}>
          <Text style={styles.settingLabelCentered}>Submissions per user</Text>
          <View style={styles.stepperContainer}>
            <TouchableOpacity
              style={styles.stepperButton}
              onPress={handleDecrement}
              activeOpacity={0.7}
            >
              <Minus size={20} color={COLORS.textPrimary} strokeWidth={2.5} />
            </TouchableOpacity>

            <Animated.Text
              style={[
                styles.stepperValue,
                { transform: [{ scale: stepperScale }] },
              ]}
            >
              {maxSubmissionsPerUser}
            </Animated.Text>

            <TouchableOpacity
              style={styles.stepperButton}
              onPress={handleIncrement}
              activeOpacity={0.7}
            >
              <Plus size={20} color={COLORS.textPrimary} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Require Approval */}
        <View style={styles.settingRow}>
          <View style={styles.settingRowLeft}>
            <View style={styles.iconBox}>
              <ShieldCheck
                size={20}
                color={COLORS.textPrimary}
                strokeWidth={2}
              />
            </View>
            <View>
              <Text style={styles.settingRowTitle}>Require approval</Text>
              <Text style={styles.settingRowSubtitle}>
                Review submissions before showing
              </Text>
            </View>
          </View>
          <Switch
            value={requireApproval}
            onValueChange={setRequireApproval}
            trackColor={{ false: "#E5E7EB", true: "#FF9500" }}
            thumbColor={"#FFFFFF"}
            ios_backgroundColor="#E5E7EB"
          />
        </View>

        {/* Show Proofs Immediately */}
        <View style={styles.settingRow}>
          <View style={styles.settingRowLeft}>
            <View style={styles.iconBox}>
              <Eye size={20} color={COLORS.textPrimary} strokeWidth={2} />
            </View>
            <View>
              <Text style={styles.settingRowTitle}>
                Show proofs immediately
              </Text>
              <Text style={styles.settingRowSubtitle}>
                When off, hidden until ended
              </Text>
            </View>
          </View>
          <Switch
            value={showProofsImmediately}
            onValueChange={setShowProofsImmediately}
            trackColor={{ false: "#E5E7EB", true: "#FF9500" }}
            thumbColor={"#FFFFFF"}
            ios_backgroundColor="#E5E7EB"
          />
        </View>

        {/* Deadline Toggle */}
        <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
          <View style={styles.settingRowLeft}>
            <View style={styles.iconBox}>
              <Clock size={20} color={COLORS.textPrimary} strokeWidth={2} />
            </View>
            <View>
              <Text style={styles.settingRowTitle}>Set deadline</Text>
              <Text style={styles.settingRowSubtitle}>
                Challenge ends at a specific time
              </Text>
            </View>
          </View>
          <Switch
            value={hasDeadline}
            onValueChange={toggleDeadline}
            trackColor={{ false: "#E5E7EB", true: "#FF9500" }}
            thumbColor={"#FFFFFF"}
            ios_backgroundColor="#E5E7EB"
          />
        </View>

        {/* Dynamic Deadline Expansion */}
        {hasDeadline && (
          <View style={styles.deadlineExpand}>
            <TouchableOpacity
              style={styles.datePreviewCard}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
              <View>
                <Text style={styles.dateLabel}>Ends on</Text>
                <Text style={styles.dateValue}>
                  {formatDeadline(deadline)} · {formatDeadlineTime(deadline)}
                </Text>
              </View>
              <Pencil size={16} color="#FF9500" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Date Picker Modal */}
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
              date.setHours(20, 0, 0, 0);
              setDeadline(date);
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
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  subtleLabel: {
    fontSize: 12,
    fontFamily: "Manrope-Bold",
    color: COLORS.textSecondary,
    opacity: 0.6,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  titleInputContainer: {
    marginBottom: 24,
    marginTop: 8,
  },
  titleInput: {
    fontFamily: "Manrope-Regular",
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
  helperText: {
    fontSize: 12,
    fontFamily: "Manrope-Regular",
    color: "#9CA3AF",
    marginTop: 6,
  },
  sectionGroup: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "BasicCommercial-Bold",
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  typeOptionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  featureCard: {
    flex: 1,
    height: 96,
    borderRadius: 20,
    backgroundColor: "#F8F9FB",
    paddingHorizontal: 12,
    paddingVertical: 16,
    justifyContent: "space-between",
  },
  featureCardSelected: {
    backgroundColor: "#FFF8F0", // Very light orange
    borderWidth: 1,
    borderColor: "#FF9500",
  },
  featureCardTitle: {
    fontSize: 13,
    fontFamily: "Manrope-Bold",
    color: COLORS.textPrimary,
    marginTop: 6,
  },
  featureCardTitleSelected: {
    color: "#FF9500",
  },
  featureCardSubtitle: {
    fontSize: 10,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
  },
  submissionTypesRow: {
    flexDirection: "row",
    gap: 12,
  },
  miniFeatureCard: {
    flex: 1,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#F8F9FB",
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  miniFeatureCardSelected: {
    backgroundColor: "#FFF8F0",
    borderWidth: 1,
    borderColor: "#FF9500",
  },
  miniFeatureCardTitle: {
    fontSize: 13,
    fontFamily: "Manrope-Bold",
    color: COLORS.textSecondary,
  },
  miniFeatureCardTitleSelected: {
    color: "#FF9500",
  },
  settingsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    marginBottom: 32,
    ...SHADOWS.sm,
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
    fontFamily: "Manrope-Medium",
    color: COLORS.textPrimary,
  },
  settingRowSubtitle: {
    fontSize: 12,
    fontFamily: "Manrope-Regular",
    color: "#9CA3AF",
  },
  deadlineExpand: {
    marginTop: -8,
    marginBottom: 8,
    paddingLeft: 32,
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
    color: "#9CA3AF", // Light grey
    marginBottom: 2,
    textTransform: "uppercase",
  },
  dateValue: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: COLORS.textPrimary,
  },
});

export default ChallengeCreateForm;
