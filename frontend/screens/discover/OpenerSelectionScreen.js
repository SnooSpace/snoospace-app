import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  FONTS,
  SHADOWS,
} from "../../constants/theme";
import HapticsService from "../../services/HapticsService";

const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;
const PRIMARY_COLOR = COLORS.primary;

// Conversation Starter Categories and Presets
const OPENER_CATEGORIES = [
  {
    id: "curiosity",
    title: "Curiosity & Thinking",
    icon: "bulb-outline",
    presets: [
      "Something I'm currently curious about...",
      "A topic I could talk about for hours...",
      "The last thing that made me think differently...",
      "A question I've been sitting with lately...",
      "Something I recently learned that surprised me...",
    ],
  },
  {
    id: "projects",
    title: "Projects & Learning",
    icon: "rocket-outline",
    presets: [
      "A project I'm working on that excites me...",
      "Something I'm trying to get better at...",
      "A skill I'd love to learn from someone...",
      "The most interesting thing in my field right now...",
      "A problem I'd love help thinking through...",
    ],
  },
  {
    id: "events",
    title: "Event Context",
    icon: "calendar-outline",
    presets: [
      "The reason I'm attending this event...",
      "What I hope to get out of this...",
      "I'd love to meet someone who...",
      "After this event, I want to...",
      "The best conversation I've had at an event was about...",
    ],
  },
  {
    id: "collaboration",
    title: "Collaboration & Help",
    icon: "people-outline",
    presets: [
      "I'm looking for people who are into...",
      "I can help you with...",
      "Let's team up if you're interested in...",
      "I want to build something around...",
      "An idea I've been wanting to explore with others...",
    ],
  },
  {
    id: "fun",
    title: "Fun & Approachable",
    icon: "sparkles-outline",
    presets: [
      "My go-to icebreaker at events is...",
      "You should come say hi if...",
      "The best way to start a conversation with me is...",
      "I'm the person at events who...",
      "Ask me about...",
    ],
  },
];

export default function OpenerSelectionScreen({ navigation, route }) {
  const { onSelect } = route.params || {};
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [response, setResponse] = useState("");
  const [step, setStep] = useState("select"); // "select" or "respond"

  const handlePromptSelect = (prompt) => {
    HapticsService.triggerSelection();
    setSelectedPrompt(prompt);
    setStep("respond");
  };

  const handleSave = () => {
    if (!selectedPrompt || !response.trim()) return;

    HapticsService.triggerNotificationSuccess();
    if (onSelect) {
      onSelect({
        prompt: selectedPrompt,
        response: response.trim(),
      });
    }
    navigation.goBack();
  };

  const handleBack = () => {
    if (step === "respond") {
      setStep("select");
      setResponse("");
    } else {
      navigation.goBack();
    }
  };

  const canSave = selectedPrompt && response.trim().length >= 10;

  // Step 1: Select a prompt
  if (step === "select") {
    return (
      <View style={styles.container}>
        <SafeAreaView
          style={{ backgroundColor: COLORS.surface }}
          edges={["top"]}
        >
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Choose a Prompt</Text>
            <View style={{ width: 40 }} />
          </View>
        </SafeAreaView>

        <Text style={styles.subtitle}>
          Select a spark to ignite your next conversation
        </Text>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {OPENER_CATEGORIES.map((category) => (
            <View key={category.id} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Ionicons
                  name={category.icon.replace("-outline", "")}
                  size={16}
                  color={PRIMARY_COLOR}
                />
                <Text style={styles.categoryTitle}>{category.title}</Text>
              </View>

              <View style={styles.cardContainer}>
                {category.presets.map((prompt, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.promptRow,
                      index < category.presets.length - 1 && styles.rowDivider,
                    ]}
                    onPress={() => handlePromptSelect(prompt)}
                  >
                    <Text style={styles.promptText}>{prompt}</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={COLORS.border}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // Step 2: Write your response
  return (
    <View style={styles.container}>
      <SafeAreaView style={{ backgroundColor: COLORS.surface }} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Answer</Text>
          <TouchableOpacity
            style={[styles.doneButton, !canSave && styles.doneButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            <Text
              style={[
                styles.doneButtonText,
                !canSave && styles.doneButtonTextDisabled,
              ]}
            >
              Done
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.content}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <View style={styles.shadowWrapper}>
            <View style={styles.selectedPromptCardNew}>
              <Text style={styles.selectedPromptLabelNew}>PROMPT</Text>
              <Text style={styles.selectedPromptTextNew}>{selectedPrompt}</Text>
            </View>
          </View>

          <View style={styles.responseSectionNew}>
            <View style={styles.responseInputContainer}>
              <TextInput
                style={styles.responseInputNew}
                placeholder="Write something that helps others start a conversation with you..."
                placeholderTextColor={LIGHT_TEXT_COLOR}
                value={response}
                onChangeText={setResponse}
                multiline
                maxLength={200}
                autoFocus
              />
            </View>
            <View style={styles.helperRow}>
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={LIGHT_TEXT_COLOR}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.helperText}>
                {response.length < 10
                  ? `${10 - response.length} more characters needed`
                  : `${response.length}/200`}
              </Text>
            </View>
          </View>

          {/* Guidance Card */}
          <View style={styles.guidanceCard}>
            <View style={styles.guidanceHeader}>
              <Text style={styles.guidanceTitle}>💡 GREAT ANSWERS ARE...</Text>
            </View>
            <View style={styles.guidanceList}>
              <View style={styles.guidanceItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color="#D1D5DB"
                  style={{ opacity: 0.8 }}
                />
                <Text style={styles.guidanceText}>Specific and personal</Text>
              </View>
              <View style={styles.guidanceItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color="#D1D5DB"
                  style={{ opacity: 0.8 }}
                />
                <Text style={styles.guidanceText}>Easy to respond to</Text>
              </View>
              <View style={styles.guidanceItem}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color="#D1D5DB"
                  style={{ opacity: 0.8 }}
                />
                <Text style={styles.guidanceText}>Show personality</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.s,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: TEXT_COLOR,
  },
  headerMinimal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
  },
  doneButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18, // Pill shape
    justifyContent: "center",
    alignItems: "center",
  },
  doneButtonDisabled: {
    backgroundColor: "#E5E7EB", // Match border/muted color
  },
  doneButtonText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: "#FFFFFF",
  },
  doneButtonTextDisabled: {
    color: LIGHT_TEXT_COLOR,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: LIGHT_TEXT_COLOR,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    textAlign: "center", // Centered as per some modern styles, but keeping Image 2 in mind
  },
  content: {
    flex: 1,
  },
  categorySection: {
    marginBottom: SPACING.l,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    marginTop: SPACING.s,
  },
  categoryTitle: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: LIGHT_TEXT_COLOR,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  cardContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginHorizontal: SPACING.m,
    ...SHADOWS.sm,
    shadowOpacity: 0.05, // Extra subtle shadow
    overflow: "hidden",
  },
  promptRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  promptText: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: TEXT_COLOR,
    marginRight: 12,
  },

  // New Response Styles
  shadowWrapper: {
    margin: SPACING.m,
    // Shadow properties on the outer wrapper
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  selectedPromptCardNew: {
    padding: 24,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    overflow: "hidden", // Clips the white corners perfectly
  },
  selectedPromptLabelNew: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: LIGHT_TEXT_COLOR,
    opacity: 0.6,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  selectedPromptTextNew: {
    fontSize: 20,
    fontFamily: FONTS.black,
    color: TEXT_COLOR,
    lineHeight: 26,
  },
  responseSectionNew: {
    paddingHorizontal: SPACING.m,
  },
  responseInputContainer: {
    backgroundColor: "#F4F7FA", // Very subtle background fill
    borderRadius: 20,
    padding: 20,
    minHeight: 180,
  },
  responseInputNew: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: TEXT_COLOR,
    lineHeight: 24,
    textAlignVertical: "top",
    flex: 1,
  },
  helperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  helperText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: LIGHT_TEXT_COLOR,
  },
  guidanceCard: {
    margin: SPACING.m,
    marginTop: 32,
    padding: 24,
    backgroundColor: "#F3F7FF", // Soft subtle blue tint
    borderRadius: 24,
  },
  guidanceHeader: {
    marginBottom: 16,
  },
  guidanceTitle: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: PRIMARY_COLOR,
    letterSpacing: 1,
    opacity: 0.8,
  },
  guidanceList: {
    gap: 12,
  },
  guidanceItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  guidanceText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: "#4B5563",
  },
});
