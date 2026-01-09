import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getAuthToken } from "../../api/auth";
import { apiGet } from "../../api/client";
import { updateMemberProfile } from "../../api/members";
import { COLORS, SPACING, BORDER_RADIUS } from "../../constants/theme";
import ChipSelector from "../../components/ChipSelector";
import HapticsService from "../../services/HapticsService";
import GradientButton from "../../components/GradientButton";

const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;
const PRIMARY_COLOR = COLORS.primary;

export default function EditDiscoverProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [goalBadges, setGoalBadges] = useState([]);
  const [availableToday, setAvailableToday] = useState(false);
  const [availableThisWeek, setAvailableThisWeek] = useState(false);
  const [promptQuestion, setPromptQuestion] = useState("");
  const [promptAnswer, setPromptAnswer] = useState("");
  const [appearInDiscover, setAppearInDiscover] = useState(true);

  // Track initial values for change detection
  const [initialState, setInitialState] = useState(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const token = await getAuthToken();
      if (token) {
        const response = await apiGet("/members/profile", 15000, token);
        const profile = response.profile || response;
        const loadedState = {
          goalBadges: profile.intent_badges || [],
          availableToday: profile.available_today || false,
          availableThisWeek: profile.available_this_week || false,
          promptQuestion: profile.prompt_question || "",
          promptAnswer: profile.prompt_answer || "",
          appearInDiscover: profile.appear_in_discover !== false,
        };
        setGoalBadges(loadedState.goalBadges);
        setAvailableToday(loadedState.availableToday);
        setAvailableThisWeek(loadedState.availableThisWeek);
        setPromptQuestion(loadedState.promptQuestion);
        setPromptAnswer(loadedState.promptAnswer);
        setAppearInDiscover(loadedState.appearInDiscover);
        setInitialState(loadedState);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  // Check if any changes have been made
  const hasChanges = () => {
    if (!initialState) return false;
    return (
      JSON.stringify(goalBadges) !== JSON.stringify(initialState.goalBadges) ||
      availableToday !== initialState.availableToday ||
      availableThisWeek !== initialState.availableThisWeek ||
      promptQuestion !== initialState.promptQuestion ||
      promptAnswer !== initialState.promptAnswer ||
      appearInDiscover !== initialState.appearInDiscover
    );
  };

  const handleSave = async () => {
    if (goalBadges.length === 0) {
      Alert.alert(
        "Required",
        "Please add at least 1 goal badge to appear in discovery"
      );
      return;
    }

    try {
      setSaving(true);
      await updateMemberProfile({
        intent_badges: goalBadges,
        available_today: availableToday,
        available_this_week: availableThisWeek,
        prompt_question: promptQuestion,
        prompt_answer: promptAnswer,
        appear_in_discover: appearInDiscover,
      });
      HapticsService.triggerNotificationSuccess();

      // Update initial state to current (so hasChanges becomes false)
      setInitialState({
        goalBadges,
        availableToday,
        availableThisWeek,
        promptQuestion,
        promptAnswer,
        appearInDiscover,
      });

      // Show success toast
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        navigation.goBack();
      }, 1500);
    } catch (error) {
      console.error("Error saving:", error);
      Alert.alert("Error", "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const getCompletionPercentage = () => {
    let score = 0;
    if (goalBadges.length > 0) score += 50;
    if (promptQuestion && promptAnswer) score += 30;
    if (availableToday || availableThisWeek) score += 20;
    return score;
  };

  const changesExist = hasChanges();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      </SafeAreaView>
    );
  }

  const completion = getCompletionPercentage();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Discover Profile</Text>
        <TouchableOpacity
          style={[
            styles.saveButton,
            (!changesExist || saving) && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!changesExist || saving}
        >
          <Text
            style={[
              styles.saveButtonText,
              (!changesExist || saving) && styles.saveButtonTextDisabled,
            ]}
          >
            {saving ? "Saving..." : "Save"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Success Toast */}
      {showSuccess && (
        <View style={styles.successToast}>
          <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
          <Text style={styles.successToastText}>Saved successfully!</Text>
        </View>
      )}

      {/* Completion Indicator */}
      <View style={styles.completionBar}>
        <View style={styles.completionTrack}>
          <View style={[styles.completionFill, { width: `${completion}%` }]} />
        </View>
        <Text style={styles.completionText}>
          {completion}% complete{" "}
          {completion < 50 && "· Add goals to appear in discovery"}
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Goal Badges - MANDATORY */}
        <View style={[styles.section, styles.highlightedSection]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Goal Badges</Text>
            <Text style={styles.requiredBadge}>Required</Text>
          </View>
          <Text style={styles.sectionHint}>
            What are you looking for? Select 1-3 goals that drive your
            networking.
          </Text>
          <ChipSelector
            selected={goalBadges}
            onSelectionChange={(newVal) => {
              HapticsService.triggerSelection();
              setGoalBadges(newVal.slice(0, 3));
            }}
            presets={[
              "Looking for a co-founder",
              "New to the city",
              "Wants to play sports",
              "Exploring opportunities",
              "Open to friendships",
              "Looking for study partners",
              "Seeking mentorship",
              "Open to collaborations",
            ]}
            allowCustom={true}
            maxSelections={3}
            placeholder="Select your networking goals"
            variant="glass"
          />
          {goalBadges.length === 0 && (
            <Text style={styles.warningText}>
              ⚠️ Add at least 1 goal badge to appear in discovery
            </Text>
          )}
        </View>

        {/* Conversation Prompt */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conversation Starter</Text>
          <Text style={styles.sectionHint}>
            Help others start a conversation with you
          </Text>
          <View style={styles.promptSelector}>
            {[
              "Something I'm currently curious about...",
              "Ask me about...",
              "A project I'd love help with...",
            ].map((prompt) => (
              <TouchableOpacity
                key={prompt}
                style={[
                  styles.promptOption,
                  promptQuestion === prompt && styles.promptOptionActive,
                ]}
                onPress={() => {
                  HapticsService.triggerSelection();
                  setPromptQuestion(prompt);
                }}
              >
                <Text
                  style={[
                    styles.promptOptionText,
                    promptQuestion === prompt && styles.promptOptionTextActive,
                  ]}
                >
                  {prompt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.promptInput}
            placeholder="Your answer..."
            placeholderTextColor={LIGHT_TEXT_COLOR}
            value={promptAnswer}
            onChangeText={setPromptAnswer}
            multiline
            maxLength={200}
          />
          <Text style={styles.charCount}>{promptAnswer.length}/200</Text>
        </View>

        {/* Availability */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability</Text>
          <Text style={styles.sectionHint}>
            Let others know when you're open to connect
          </Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Open to chat today</Text>
            <TouchableOpacity
              style={[styles.toggle, availableToday && styles.toggleActive]}
              onPress={() => {
                HapticsService.triggerSelection();
                setAvailableToday(!availableToday);
              }}
            >
              <View
                style={[
                  styles.toggleKnob,
                  availableToday && styles.toggleKnobActive,
                ]}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Available this week</Text>
            <TouchableOpacity
              style={[styles.toggle, availableThisWeek && styles.toggleActive]}
              onPress={() => {
                HapticsService.triggerSelection();
                setAvailableThisWeek(!availableThisWeek);
              }}
            >
              <View
                style={[
                  styles.toggleKnob,
                  availableThisWeek && styles.toggleKnobActive,
                ]}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabelContainer}>
              <Text style={styles.toggleLabel}>Appear in Discover</Text>
              <Text style={styles.toggleHint}>
                Let others find you in events
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, appearInDiscover && styles.toggleActive]}
              onPress={() => {
                HapticsService.triggerSelection();
                setAppearInDiscover(!appearInDiscover);
              }}
            >
              <View
                style={[
                  styles.toggleKnob,
                  appearInDiscover && styles.toggleKnobActive,
                ]}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.s,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  completionBar: {
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    backgroundColor: "#F8FFF8",
  },
  completionTrack: {
    height: 6,
    backgroundColor: "#E0E0E0",
    borderRadius: 3,
    overflow: "hidden",
  },
  completionFill: {
    height: "100%",
    backgroundColor: "#2E7D32",
    borderRadius: 3,
  },
  completionText: {
    fontSize: 12,
    color: "#2E7D32",
    marginTop: 6,
    fontWeight: "500",
  },
  content: {
    flex: 1,
  },
  section: {
    padding: SPACING.l,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  highlightedSection: {
    backgroundColor: "#F8FFF8",
    borderLeftWidth: 3,
    borderLeftColor: "#2E7D32",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 12,
  },
  requiredBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
    backgroundColor: "#2E7D32",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  warningText: {
    fontSize: 13,
    color: "#E65100",
    marginTop: 8,
  },
  promptSelector: {
    flexDirection: "column",
    gap: 8,
    marginBottom: 12,
  },
  promptOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#FAFAFA",
  },
  promptOptionActive: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: "#F8F5FF",
  },
  promptOptionText: {
    fontSize: 14,
    color: TEXT_COLOR,
  },
  promptOptionTextActive: {
    color: PRIMARY_COLOR,
    fontWeight: "500",
  },
  promptInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: TEXT_COLOR,
    minHeight: 80,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    textAlign: "right",
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  toggleLabelContainer: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 15,
    color: TEXT_COLOR,
  },
  toggleHint: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#E5E5EA",
    padding: 2,
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  toggleKnob: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
  },
  toggleKnobActive: {
    alignSelf: "flex-end",
  },
  saveButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.m,
  },
  saveButtonDisabled: {
    backgroundColor: "#E0E0E0",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  saveButtonTextDisabled: {
    color: "#A0A0A0",
  },
  successToast: {
    position: "absolute",
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: "#2E7D32",
    borderRadius: BORDER_RADIUS.m,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  successToastText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
