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
import { COLORS, SPACING, BORDER_RADIUS } from "../../constants/theme";
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
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Choose a Prompt</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.subtitle}>
          Pick a conversation starter that represents you
        </Text>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {OPENER_CATEGORIES.map((category) => (
            <View key={category.id} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Ionicons
                  name={category.icon}
                  size={20}
                  color={PRIMARY_COLOR}
                />
                <Text style={styles.categoryTitle}>{category.title}</Text>
              </View>

              {category.presets.map((prompt, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.promptCard}
                  onPress={() => handlePromptSelect(prompt)}
                >
                  <Text style={styles.promptText}>{prompt}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={LIGHT_TEXT_COLOR}
                  />
                </TouchableOpacity>
              ))}
            </View>
          ))}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Step 2: Write your response
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Answer</Text>
          <TouchableOpacity
            style={[
              styles.saveHeaderButton,
              !canSave && styles.saveHeaderButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!canSave}
          >
            <Text
              style={[
                styles.saveHeaderText,
                !canSave && styles.saveHeaderTextDisabled,
              ]}
            >
              Done
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.selectedPromptCard}>
            <Text style={styles.selectedPromptLabel}>PROMPT</Text>
            <Text style={styles.selectedPromptText}>{selectedPrompt}</Text>
          </View>

          <View style={styles.responseSection}>
            <Text style={styles.responseLabel}>YOUR ANSWER</Text>
            <TextInput
              style={styles.responseInput}
              placeholder="Write something that helps others start a conversation with you..."
              placeholderTextColor={LIGHT_TEXT_COLOR}
              value={response}
              onChangeText={setResponse}
              multiline
              maxLength={200}
              autoFocus
            />
            <View style={styles.charCountRow}>
              <Text
                style={[
                  styles.charCount,
                  response.length < 10 && styles.charCountWarning,
                ]}
              >
                {response.length < 10
                  ? `${10 - response.length} more characters needed`
                  : `${response.length}/200`}
              </Text>
            </View>
          </View>

          {/* Example Answers */}
          <View style={styles.examplesSection}>
            <Text style={styles.examplesTitle}>💡 Great answers are...</Text>
            <View style={styles.examplesList}>
              <View style={styles.exampleItem}>
                <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                <Text style={styles.exampleText}>Specific and personal</Text>
              </View>
              <View style={styles.exampleItem}>
                <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                <Text style={styles.exampleText}>Easy to respond to</Text>
              </View>
              <View style={styles.exampleItem}>
                <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
                <Text style={styles.exampleText}>Show personality</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
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
  saveHeaderButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveHeaderButtonDisabled: {},
  saveHeaderText: {
    fontSize: 16,
    fontWeight: "600",
    color: PRIMARY_COLOR,
  },
  saveHeaderTextDisabled: {
    color: LIGHT_TEXT_COLOR,
  },
  subtitle: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
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
    paddingVertical: SPACING.s,
    backgroundColor: "#F8F8F8",
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  promptCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.l,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: "#FFFFFF",
  },
  promptText: {
    flex: 1,
    fontSize: 15,
    color: TEXT_COLOR,
    marginRight: 12,
  },

  // Response Step
  selectedPromptCard: {
    margin: SPACING.l,
    padding: SPACING.m,
    backgroundColor: "#F0F8FF",
    borderRadius: BORDER_RADIUS.m,
    borderLeftWidth: 3,
    borderLeftColor: PRIMARY_COLOR,
  },
  selectedPromptLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: PRIMARY_COLOR,
    letterSpacing: 1,
    marginBottom: 6,
  },
  selectedPromptText: {
    fontSize: 15,
    color: TEXT_COLOR,
    fontWeight: "500",
  },
  responseSection: {
    paddingHorizontal: SPACING.l,
  },
  responseLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: LIGHT_TEXT_COLOR,
    letterSpacing: 1,
    marginBottom: 8,
  },
  responseInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.m,
    padding: 14,
    fontSize: 16,
    color: TEXT_COLOR,
    minHeight: 120,
    textAlignVertical: "top",
    backgroundColor: "#FFFFFF",
  },
  charCountRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 6,
  },
  charCount: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
  },
  charCountWarning: {
    color: "#E65100",
  },
  examplesSection: {
    margin: SPACING.l,
    padding: SPACING.m,
    backgroundColor: "#FFFBF0",
    borderRadius: BORDER_RADIUS.m,
  },
  examplesTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: 10,
  },
  examplesList: {
    gap: 8,
  },
  exampleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  exampleText: {
    fontSize: 13,
    color: TEXT_COLOR,
  },
});
