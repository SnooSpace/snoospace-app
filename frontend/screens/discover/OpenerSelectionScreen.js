import React, { useState, useCallback, useMemo } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  ChevronRight,
  Info,
  CircleCheck,
  Lightbulb,
  Rocket,
  Calendar,
  Users,
  Sparkles,
  Flame,
  Coffee,
  Music,
  PenLine,
  Check,
  Palette,
} from "lucide-react-native";
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

// Curated Conversation Starter Categories and Presets
export const OPENER_CATEGORIES = [
  {
    id: "curiosity",
    title: "Curiosity & Thinking",
    icon: Lightbulb,
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
    icon: Rocket,
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
    icon: Calendar,
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
    icon: Users,
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
    icon: Sparkles,
    presets: [
      "My go-to icebreaker at events is...",
      "You should come say hi if...",
      "The best way to start a conversation with me is...",
      "I'm the person at events who...",
      "Ask me about...",
    ],
  },
];

// Aura Glow Aesthetic Themes for Icebreaker Cards
export const ICEBREAKER_THEMES = {
  cosmic: {
    id: "cosmic",
    name: "Cosmic Violet",
    colors: ["#6366F1", "#8B5CF6", "#D946EF"],
    glowColors: [
      "rgba(99,102,241,0.45)",
      "rgba(139,92,246,0.25)",
      "rgba(217,70,239,0.12)",
    ],
    badgeBg: "#F5F3FF",
    badgeText: "#7C3AED",
  },
  sunset: {
    id: "sunset",
    name: "Sunset Coral",
    colors: ["#FF5E62", "#FF9966", "#FFA07A"],
    glowColors: [
      "rgba(255,94,98,0.45)",
      "rgba(255,153,102,0.25)",
      "rgba(255,160,122,0.12)",
    ],
    badgeBg: "#FFF1F2",
    badgeText: "#E11D48",
  },
  emerald: {
    id: "emerald",
    name: "Emerald Mint",
    colors: ["#059669", "#10B981", "#34D399"],
    glowColors: [
      "rgba(5,150,105,0.45)",
      "rgba(16,185,129,0.25)",
      "rgba(52,211,153,0.12)",
    ],
    badgeBg: "#ECFDF5",
    badgeText: "#059669",
  },
  cyber: {
    id: "cyber",
    name: "Cyber Blue",
    colors: ["#0284C7", "#0EA5E9", "#38BDF8"],
    glowColors: [
      "rgba(2,132,199,0.45)",
      "rgba(14,165,233,0.25)",
      "rgba(56,189,248,0.12)",
    ],
    badgeBg: "#F0F9FF",
    badgeText: "#0284C7",
  },
  amber: {
    id: "amber",
    name: "Warm Amber",
    colors: ["#D97706", "#F59E0B", "#FBBF24"],
    glowColors: [
      "rgba(217,119,6,0.45)",
      "rgba(245,158,11,0.25)",
      "rgba(251,191,36,0.12)",
    ],
    badgeBg: "#FFFBEB",
    badgeText: "#D97706",
  },
  slate: {
    id: "slate",
    name: "Midnight Slate",
    colors: ["#334155", "#475569", "#64748B"],
    glowColors: [
      "rgba(51,65,85,0.45)",
      "rgba(71,85,105,0.25)",
      "rgba(100,116,139,0.12)",
    ],
    badgeBg: "#F1F5F9",
    badgeText: "#334155",
  },
};

// Vibe categories for custom icebreakers
export const CUSTOM_VIBES = [
  {
    id: "curiosity",
    label: "Curiosity",
    icon: Lightbulb,
    color: "#2563EB",
    bg: "#EFF6FF",
  },
  {
    id: "hottakes",
    label: "Hot Takes",
    icon: Flame,
    color: "#DC2626",
    bg: "#FEF2F2",
  },
  {
    id: "fun",
    label: "Fun & Social",
    icon: Sparkles,
    color: "#7C3AED",
    bg: "#F5F3FF",
  },
  {
    id: "projects",
    label: "Projects",
    icon: Rocket,
    color: "#059669",
    bg: "#ECFDF5",
  },
  {
    id: "chill",
    label: "Chill & Casual",
    icon: Coffee,
    color: "#D97706",
    bg: "#FFFBEB",
  },
  {
    id: "music",
    label: "Music & Vibe",
    icon: Music,
    color: "#DB2777",
    bg: "#FDF2F8",
  },
];

// Quick inspiration starters for writer's block
export const INSPIRATION_STARTERS = [
  "Two truths & a lie: ",
  "Hot take: ",
  "Ask me about: ",
  "Change my mind on: ",
  "My comfort food is: ",
  "The best advice I ever got: ",
  "A weird habit of mine: ",
  "My weekend usually looks like: ",
  "A topic I could talk about forever: ",
];

const EDGES = ["top"];

export default function OpenerSelectionScreen({ navigation, route }) {
  const { onSelect, initialOpener } = route.params || {};
  const isEditMode = !!initialOpener;

  // Active mode tab: "preset" or "custom"
  const [activeTab, setActiveTab] = useState(
    initialOpener?.is_custom ? "custom" : "preset"
  );

  // Preset mode state
  const [selectedPrompt, setSelectedPrompt] = useState(
    !initialOpener?.is_custom && initialOpener?.prompt ? initialOpener.prompt : null
  );
  const [presetResponse, setPresetResponse] = useState(
    !initialOpener?.is_custom && initialOpener?.response ? initialOpener.response : ""
  );
  const [step, setStep] = useState(
    !initialOpener?.is_custom && initialOpener?.prompt ? "respond" : "select"
  );

  // Custom mode state
  const [customPrompt, setCustomPrompt] = useState(
    initialOpener?.is_custom && initialOpener?.prompt ? initialOpener.prompt : ""
  );
  const [customResponse, setCustomResponse] = useState(
    initialOpener?.is_custom && initialOpener?.response ? initialOpener.response : ""
  );
  const [selectedVibe, setSelectedVibe] = useState(
    initialOpener?.category || "curiosity"
  );
  const [selectedTheme, setSelectedTheme] = useState(
    initialOpener?.theme || "cosmic"
  );

  // Resolve current active vibe object
  const activeVibeObj = useMemo(() => {
    return (
      CUSTOM_VIBES.find((v) => v.id === selectedVibe) || CUSTOM_VIBES[0]
    );
  }, [selectedVibe]);

  // Resolve current active theme object
  const activeThemeObj = useMemo(() => {
    return ICEBREAKER_THEMES[selectedTheme] || ICEBREAKER_THEMES.cosmic;
  }, [selectedTheme]);

  // Handle selecting a curated preset prompt
  const handlePromptSelect = useCallback((prompt) => {
    HapticsService.triggerSelection();
    setSelectedPrompt(prompt);
    setStep("respond");
  }, []);

  // Preset save validation
  const canSavePreset = selectedPrompt && presetResponse.trim().length >= 10;

  // Custom save validation
  const canSaveCustom =
    customPrompt.trim().length >= 5 && customResponse.trim().length >= 10;

  // Save curated preset icebreaker
  const handleSavePreset = useCallback(() => {
    if (!canSavePreset) return;

    HapticsService.triggerNotificationSuccess();
    if (onSelect) {
      onSelect({
        prompt: selectedPrompt.trim(),
        response: presetResponse.trim(),
        category: "curiosity",
        theme: "cosmic",
        is_custom: false,
      });
    }
    navigation.goBack();
  }, [canSavePreset, selectedPrompt, presetResponse, onSelect, navigation]);

  // Save custom icebreaker
  const handleSaveCustom = useCallback(() => {
    if (!canSaveCustom) return;

    HapticsService.triggerNotificationSuccess();
    if (onSelect) {
      onSelect({
        prompt: customPrompt.trim(),
        response: customResponse.trim(),
        category: selectedVibe,
        theme: selectedTheme,
        is_custom: true,
      });
    }
    navigation.goBack();
  }, [
    canSaveCustom,
    customPrompt,
    customResponse,
    selectedVibe,
    selectedTheme,
    onSelect,
    navigation,
  ]);

  // Back button handling
  const handleBack = useCallback(() => {
    if (activeTab === "preset" && step === "respond" && !isEditMode) {
      setStep("select");
      setPresetResponse("");
    } else {
      navigation.goBack();
    }
  }, [activeTab, step, isEditMode, navigation]);

  // Starter chip tap handler
  const handleApplyStarter = useCallback(
    (starter) => {
      HapticsService.triggerSelection();
      setCustomPrompt((prev) => {
        if (!prev.trim()) {
          return starter;
        }
        // If user already typed something, replace prefix or append
        return `${starter}${prev.replace(/^[A-Za-z0-9\s&]+:\s*/, "")}`;
      });
    },
    []
  );

  // Active Vibe Icon
  const ActiveVibeIcon = activeVibeObj.icon;

  // ==========================================
  // VIEW: Preset Step 2 - Respond to selected preset
  // ==========================================
  if (activeTab === "preset" && step === "respond") {
    return (
      <View style={styles.container}>
        <SafeAreaView style={{ backgroundColor: COLORS.surface }} edges={EDGES}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <ArrowLeft size={22} color={TEXT_COLOR} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {isEditMode ? "Edit Icebreaker" : "Icebreakers"}
            </Text>
            <TouchableOpacity
              style={[
                styles.doneButton,
                !canSavePreset && styles.doneButtonDisabled,
              ]}
              onPress={handleSavePreset}
              disabled={!canSavePreset}
            >
              <Text
                style={[
                  styles.doneButtonText,
                  !canSavePreset && styles.doneButtonTextDisabled,
                ]}
              >
                {isEditMode ? "Update" : "Done"}
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
                  value={presetResponse}
                  onChangeText={setPresetResponse}
                  multiline
                  maxLength={200}
                  autoFocus
                />
              </View>
              <View style={styles.helperRow}>
                <Info
                  size={14}
                  color={LIGHT_TEXT_COLOR}
                  strokeWidth={2}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.helperText}>
                  {presetResponse.length < 10
                    ? `${10 - presetResponse.length} more characters needed`
                    : `${presetResponse.length}/200`}
                </Text>
              </View>
            </View>

            {/* Guidance Card */}
            <View style={styles.guidanceCard}>
              <View style={styles.guidanceHeader}>
                <Text style={styles.guidanceTitle}>GREAT ANSWERS ARE...</Text>
              </View>
              <View style={styles.guidanceList}>
                <View style={styles.guidanceItem}>
                  <CircleCheck
                    size={18}
                    color="#9CA3AF"
                    strokeWidth={2}
                    style={{ opacity: 0.8 }}
                  />
                  <Text style={styles.guidanceText}>Specific and personal</Text>
                </View>
                <View style={styles.guidanceItem}>
                  <CircleCheck
                    size={18}
                    color="#9CA3AF"
                    strokeWidth={2}
                    style={{ opacity: 0.8 }}
                  />
                  <Text style={styles.guidanceText}>Easy to respond to</Text>
                </View>
                <View style={styles.guidanceItem}>
                  <CircleCheck
                    size={18}
                    color="#9CA3AF"
                    strokeWidth={2}
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

  // ==========================================
  // VIEW: Main Selection Screen (Tabs: Curated vs Custom)
  // ==========================================
  return (
    <View style={styles.container}>
      <SafeAreaView style={{ backgroundColor: COLORS.surface }} edges={EDGES}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ArrowLeft size={22} color={TEXT_COLOR} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditMode ? "Edit Icebreaker" : "Icebreakers"}
          </Text>
          {activeTab === "custom" ? (
            <TouchableOpacity
              style={[
                styles.doneButton,
                !canSaveCustom && styles.doneButtonDisabled,
              ]}
              onPress={handleSaveCustom}
              disabled={!canSaveCustom}
            >
              <Text
                style={[
                  styles.doneButtonText,
                  !canSaveCustom && styles.doneButtonTextDisabled,
                ]}
              >
                {isEditMode ? "Update" : "Done"}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        {/* Top Segmented Mode Control */}
        <View style={styles.tabBarContainer}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "preset" && styles.tabButtonActive,
            ]}
            onPress={() => {
              HapticsService.triggerSelection();
              setActiveTab("preset");
            }}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "preset" && styles.tabTextActive,
              ]}
            >
              Curated Prompts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "custom" && styles.tabButtonActive,
            ]}
            onPress={() => {
              HapticsService.triggerSelection();
              setActiveTab("custom");
            }}
            activeOpacity={0.7}
          >
            <View style={styles.tabLabelWithIcon}>
              <Sparkles
                size={14}
                color={activeTab === "custom" ? PRIMARY_COLOR : LIGHT_TEXT_COLOR}
                strokeWidth={2}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "custom" && styles.tabTextActive,
                ]}
              >
                Write Your Own
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* TAB 1: CURATED PROMPTS */}
      {activeTab === "preset" ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Write Your Own Prompt Hero Banner */}
          <TouchableOpacity
            style={styles.customBannerWrapper}
            onPress={() => {
              HapticsService.triggerSelection();
              setActiveTab("custom");
            }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#EFF6FF", "#DBEAFE"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.customBannerGradient}
            >
              <View style={styles.customBannerContent}>
                <View style={styles.customBannerIconCircle}>
                  <PenLine size={20} color={PRIMARY_COLOR} strokeWidth={2} />
                </View>
                <View style={styles.customBannerTextCol}>
                  <Text style={styles.customBannerTitle}>
                    Write Your Own Prompt
                  </Text>
                  <Text style={styles.customBannerSubtitle}>
                    Create a unique question and pick your aura vibe
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color={PRIMARY_COLOR} strokeWidth={2} />
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.subtitle}>
            Or pick from our curated conversation starters
          </Text>

          {OPENER_CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <View key={category.id} style={styles.categorySection}>
                <View style={styles.categoryHeader}>
                  <View style={styles.categoryIconCircle}>
                    <Icon size={16} color={PRIMARY_COLOR} strokeWidth={2} />
                  </View>
                  <Text style={styles.categoryTitle}>{category.title}</Text>
                </View>

                <View style={styles.cardContainer}>
                  {category.presets.map((prompt, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.promptRow,
                        index < category.presets.length - 1 &&
                          styles.rowDivider,
                      ]}
                      onPress={() => handlePromptSelect(prompt)}
                    >
                      <Text style={styles.promptText}>{prompt}</Text>
                      <ChevronRight
                        size={18}
                        color={COLORS.border}
                        strokeWidth={2}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}

          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        /* TAB 2: CUSTOM ICEBREAKER CREATOR */
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            style={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 48 }}
          >
            {/* 1. Real-Time Live Card Preview */}
            <View style={styles.previewContainer}>
              <View style={styles.previewHeaderRow}>
                <Sparkles size={16} color={PRIMARY_COLOR} strokeWidth={2} />
                <Text style={styles.previewSectionTitle}>LIVE CARD PREVIEW</Text>
              </View>

              <View
                style={[
                  styles.previewCardOuter,
                  { shadowColor: activeThemeObj.colors[0] },
                ]}
              >
                {/* Diffusion Glow Layer */}
                <LinearGradient
                  colors={activeThemeObj.glowColors}
                  start={{ x: 0, y: 1 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.previewGlowLayer}
                />

                <View style={styles.previewCardInner}>
                  <View style={styles.previewCardTopRow}>
                    <View
                      style={[
                        styles.previewVibeBadge,
                        { backgroundColor: activeVibeObj.bg },
                      ]}
                    >
                      <ActiveVibeIcon
                        size={13}
                        color={activeVibeObj.color}
                        strokeWidth={2}
                      />
                      <Text
                        style={[
                          styles.previewVibeBadgeText,
                          { color: activeVibeObj.color },
                        ]}
                      >
                        {activeVibeObj.label.toUpperCase()}
                      </Text>
                    </View>

                    <LinearGradient
                      colors={activeThemeObj.colors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.previewThemePill}
                    >
                      <Text style={styles.previewThemePillText}>
                        {activeThemeObj.name.split(" ")[0]}
                      </Text>
                    </LinearGradient>
                  </View>

                  <Text style={styles.previewPromptText} numberOfLines={3}>
                    {customPrompt.trim()
                      ? customPrompt.trim()
                      : "Type your icebreaker question below..."}
                  </Text>

                  <Text style={styles.previewAnswerText} numberOfLines={4}>
                    {customResponse.trim()
                      ? customResponse.trim()
                      : "Your authentic answer will preview here..."}
                  </Text>
                </View>
              </View>
            </View>

            {/* 2. Quick Inspiration Starters */}
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionIconCircle}>
                <Lightbulb size={16} color={PRIMARY_COLOR} strokeWidth={2} />
              </View>
              <Text style={styles.sectionTitle}>QUICK INSPIRATION</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.startersScroll}
            >
              {INSPIRATION_STARTERS.map((starter, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.starterChip}
                  onPress={() => handleApplyStarter(starter)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.starterChipText}>{starter}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 3. Custom Prompt Input */}
            <View style={styles.inputSection}>
              <View style={styles.inputLabelRow}>
                <Text style={styles.inputLabel}>YOUR ICEBREAKER QUESTION</Text>
                <Text
                  style={[
                    styles.inputCounter,
                    customPrompt.length > 100 && styles.inputCounterError,
                  ]}
                >
                  {customPrompt.length}/100
                </Text>
              </View>
              <View style={styles.promptInputContainer}>
                <TextInput
                  style={styles.promptTextInput}
                  placeholder="e.g., A controversial food opinion I will defend forever..."
                  placeholderTextColor={LIGHT_TEXT_COLOR}
                  value={customPrompt}
                  onChangeText={setCustomPrompt}
                  maxLength={100}
                  multiline
                />
              </View>
              {customPrompt.trim().length > 0 &&
                customPrompt.trim().length < 5 && (
                  <Text style={styles.fieldErrorText}>
                    Question must be at least 5 characters
                  </Text>
                )}
            </View>

            {/* 4. Your Answer Input */}
            <View style={styles.inputSection}>
              <View style={styles.inputLabelRow}>
                <Text style={styles.inputLabel}>YOUR ANSWER</Text>
                <Text
                  style={[
                    styles.inputCounter,
                    customResponse.length > 200 && styles.inputCounterError,
                  ]}
                >
                  {customResponse.length < 10
                    ? `${10 - customResponse.length} more chars needed`
                    : `${customResponse.length}/200`}
                </Text>
              </View>
              <View style={styles.responseInputContainerMultiline}>
                <TextInput
                  style={styles.responseTextInput}
                  placeholder="Write something that gives attendees an easy opening to message you..."
                  placeholderTextColor={LIGHT_TEXT_COLOR}
                  value={customResponse}
                  onChangeText={setCustomResponse}
                  maxLength={200}
                  multiline
                />
              </View>
            </View>

            {/* 5. Vibe Category Selection */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconCircle}>
                  <Sparkles size={16} color={PRIMARY_COLOR} strokeWidth={2} />
                </View>
                <Text style={styles.sectionTitle}>CHOOSE A VIBE</Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                Tag your card so other attendees instantly know the tone
              </Text>

              <View style={styles.vibesGrid}>
                {CUSTOM_VIBES.map((vibe) => {
                  const isSelected = selectedVibe === vibe.id;
                  const Icon = vibe.icon;
                  return (
                    <TouchableOpacity
                      key={vibe.id}
                      style={[
                        styles.vibeCard,
                        isSelected && {
                          borderColor: vibe.color,
                          backgroundColor: vibe.bg,
                        },
                      ]}
                      onPress={() => {
                        HapticsService.triggerSelection();
                        setSelectedVibe(vibe.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.vibeIconCircle,
                          {
                            backgroundColor: isSelected ? "#FFFFFF" : vibe.bg,
                          },
                        ]}
                      >
                        <Icon size={18} color={vibe.color} strokeWidth={2} />
                      </View>
                      <Text
                        style={[
                          styles.vibeLabel,
                          isSelected && {
                            color: vibe.color,
                            fontFamily: FONTS.semiBold,
                          },
                        ]}
                      >
                        {vibe.label}
                      </Text>
                      {isSelected && (
                        <View
                          style={[
                            styles.vibeCheckBadge,
                            { backgroundColor: vibe.color },
                          ]}
                        >
                          <Check size={12} color="#FFFFFF" strokeWidth={2.5} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 6. Aura Glow Theme Selector */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconCircle}>
                  <Palette size={16} color={PRIMARY_COLOR} strokeWidth={2} />
                </View>
                <Text style={styles.sectionTitle}>AURA GLOW THEME</Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                Select the ambient color glow your card radiates on Discover
              </Text>

              <View style={styles.themesRow}>
                {Object.values(ICEBREAKER_THEMES).map((thm) => {
                  const isSelected = selectedTheme === thm.id;
                  return (
                    <TouchableOpacity
                      key={thm.id}
                      style={[
                        styles.themeOption,
                        isSelected && styles.themeOptionSelected,
                      ]}
                      onPress={() => {
                        HapticsService.triggerSelection();
                        setSelectedTheme(thm.id);
                      }}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={thm.colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.themeCircle}
                      >
                        {isSelected && (
                          <Check size={16} color="#FFFFFF" strokeWidth={3} />
                        )}
                      </LinearGradient>
                      <Text
                        style={[
                          styles.themeName,
                          isSelected && styles.themeNameSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {thm.name.split(" ")[0]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Bottom Action CTA Button */}
            <View style={styles.bottomCtaWrapper}>
              <TouchableOpacity
                style={[
                  styles.primaryCtaButton,
                  !canSaveCustom && styles.primaryCtaButtonDisabled,
                ]}
                onPress={handleSaveCustom}
                disabled={!canSaveCustom}
                activeOpacity={0.85}
              >
                <Sparkles
                  size={18}
                  color="#FFFFFF"
                  strokeWidth={2}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.primaryCtaText}>
                  {isEditMode ? "Update Icebreaker" : "Save Icebreaker"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  // Authority Rule: Used only once per screen for the top page title
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.basicCommercialBlack,
    color: TEXT_COLOR,
    textAlign: "center",
  },
  doneButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  doneButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  doneButtonText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
  },
  doneButtonTextDisabled: {
    color: LIGHT_TEXT_COLOR,
  },

  // Segmented Mode Switcher
  tabBarContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
    marginHorizontal: SPACING.m,
    marginVertical: SPACING.s,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: "#FFFFFF",
    ...SHADOWS.sm,
  },
  tabText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: LIGHT_TEXT_COLOR,
  },
  tabTextActive: {
    color: TEXT_COLOR,
  },
  tabLabelWithIcon: {
    flexDirection: "row",
    alignItems: "center",
  },

  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: LIGHT_TEXT_COLOR,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    textAlign: "center",
  },
  content: {
    flex: 1,
  },

  // Hero Banner for Custom Prompt
  customBannerWrapper: {
    marginHorizontal: SPACING.m,
    marginTop: SPACING.m,
    marginBottom: SPACING.s,
    borderRadius: 16,
    overflow: "hidden",
    ...SHADOWS.sm,
  },
  customBannerGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 16,
  },
  customBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  customBannerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  customBannerTextCol: {
    flex: 1,
  },
  customBannerTitle: {
    fontSize: 15,
    fontFamily: FONTS.basicCommercialBold,
    color: TEXT_COLOR,
    marginBottom: 2,
  },
  customBannerSubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: LIGHT_TEXT_COLOR,
  },

  // Category Presets
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
  categoryIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  categoryTitle: {
    fontSize: 14,
    fontFamily: FONTS.basicCommercialBold,
    color: TEXT_COLOR,
    letterSpacing: 0.5,
  },
  cardContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginHorizontal: SPACING.m,
    ...SHADOWS.sm,
    shadowOpacity: 0.05,
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

  // Response Step Styles
  shadowWrapper: {
    margin: SPACING.m,
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
    overflow: "hidden",
  },
  selectedPromptLabelNew: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: LIGHT_TEXT_COLOR,
    opacity: 0.8,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  selectedPromptTextNew: {
    fontSize: 18,
    fontFamily: FONTS.basicCommercialBold,
    color: TEXT_COLOR,
    lineHeight: 24,
  },
  responseSectionNew: {
    paddingHorizontal: SPACING.m,
  },
  responseInputContainer: {
    backgroundColor: "#F4F7FA",
    borderRadius: 20,
    padding: 20,
    minHeight: 180,
  },
  responseInputNew: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: TEXT_COLOR,
    lineHeight: 22,
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
    backgroundColor: "#F3F7FF",
    borderRadius: 24,
  },
  guidanceHeader: {
    marginBottom: 16,
  },
  guidanceTitle: {
    fontSize: 12,
    fontFamily: FONTS.basicCommercialBold,
    color: PRIMARY_COLOR,
    letterSpacing: 1,
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

  // ----------------------------------------------------
  // Custom Icebreaker Creator Styles
  // ----------------------------------------------------
  previewContainer: {
    marginHorizontal: SPACING.m,
    marginTop: SPACING.m,
    marginBottom: SPACING.l,
  },
  previewHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  previewSectionTitle: {
    fontSize: 12,
    fontFamily: FONTS.basicCommercialBold,
    color: PRIMARY_COLOR,
    letterSpacing: 1,
  },
  previewCardOuter: {
    borderRadius: 22,
    position: "relative",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
  },
  previewGlowLayer: {
    position: "absolute",
    top: -4,
    bottom: -4,
    left: -4,
    right: -4,
    borderRadius: 26,
    opacity: 0.8,
  },
  previewCardInner: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
  },
  previewCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  previewVibeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  previewVibeBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    letterSpacing: 0.5,
  },
  previewThemePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  previewThemePillText: {
    fontSize: 10,
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  previewPromptText: {
    fontSize: 17,
    fontFamily: FONTS.basicCommercialBold,
    color: TEXT_COLOR,
    lineHeight: 23,
    marginBottom: 10,
  },
  previewAnswerText: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: "#4B5563",
    lineHeight: 21,
  },

  // Section Headers
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: SPACING.m,
    marginBottom: 8,
  },
  sectionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: FONTS.basicCommercialBold,
    color: TEXT_COLOR,
    letterSpacing: 0.8,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: LIGHT_TEXT_COLOR,
    paddingHorizontal: SPACING.m,
    marginBottom: 12,
  },

  // Starters Scroll
  startersScroll: {
    paddingHorizontal: SPACING.m,
    paddingBottom: SPACING.m,
    gap: 8,
  },
  starterChip: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  starterChipText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: TEXT_COLOR,
  },

  // Input Sections
  inputSection: {
    marginHorizontal: SPACING.m,
    marginBottom: SPACING.l,
  },
  inputLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: FONTS.basicCommercialBold,
    color: TEXT_COLOR,
    letterSpacing: 0.8,
  },
  inputCounter: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: LIGHT_TEXT_COLOR,
  },
  inputCounterError: {
    color: COLORS.error,
  },
  promptInputContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    minHeight: 80,
  },
  promptTextInput: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: TEXT_COLOR,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  responseInputContainerMultiline: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    minHeight: 120,
  },
  responseTextInput: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: TEXT_COLOR,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  fieldErrorText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.error,
    marginTop: 6,
  },

  // Vibe Selection Grid
  sectionBlock: {
    marginBottom: SPACING.l,
  },
  vibesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: SPACING.m,
    gap: 10,
  },
  vibeCard: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 12,
    position: "relative",
  },
  vibeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  vibeLabel: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: TEXT_COLOR,
    flex: 1,
  },
  vibeCheckBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },

  // Themes Row
  themesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.m,
    marginTop: 4,
  },
  themeOption: {
    alignItems: "center",
    padding: 6,
    borderRadius: 16,
  },
  themeOptionSelected: {
    backgroundColor: "#EFF6FF",
  },
  themeCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    ...SHADOWS.sm,
  },
  themeName: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: LIGHT_TEXT_COLOR,
    textAlign: "center",
  },
  themeNameSelected: {
    color: PRIMARY_COLOR,
    fontFamily: FONTS.semiBold,
  },

  // Bottom CTA
  bottomCtaWrapper: {
    marginHorizontal: SPACING.m,
    marginTop: SPACING.s,
  },
  primaryCtaButton: {
    flexDirection: "row",
    backgroundColor: PRIMARY_COLOR,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.sm,
  },
  primaryCtaButtonDisabled: {
    backgroundColor: "#CBD5E1",
  },
  primaryCtaText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
  },
});
