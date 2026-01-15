import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import GlassBackButton from "../../../components/GlassBackButton";
import { updateCommunitySignupDraft } from "../../../utils/signupDraftManager";

const COMMUNITY_THEMES = [
  {
    id: "confessions",
    title: "Confessions",
    subtitle: "Anonymous campus confessions and stories",
    icon: "chatbox-ellipses-outline",
    gradientColors: ["#667eea", "#764ba2"],
  },
  {
    id: "memes",
    title: "Memes",
    subtitle: "Campus humor, jokes, and relatable content",
    icon: "happy-outline",
    gradientColors: ["#FF512F", "#F09819"],
  },
  {
    id: "discussions",
    title: "Discussions",
    subtitle: "Campus news, debates, and conversations",
    icon: "chatbubbles-outline",
    gradientColors: ["#11998e", "#38ef7d"],
  },
  {
    id: "other",
    title: "Other",
    subtitle: "Something else - you decide the theme",
    icon: "sparkles-outline",
    gradientColors: ["#6366f1", "#8b5cf6"],
  },
];

/**
 * Theme Card Component
 */
const ThemeCard = ({ theme, onPress }) => (
  <TouchableOpacity
    style={styles.card}
    onPress={() => onPress(theme)}
    activeOpacity={0.8}
    accessibilityRole="button"
    accessibilityLabel={`Select ${theme.title}`}
  >
    <LinearGradient
      colors={theme.gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.cardGradient}
    >
      <Ionicons name={theme.icon} size={26} color="#fff" />
    </LinearGradient>
    <View style={styles.cardContent}>
      <Text style={styles.cardTitle}>{theme.title}</Text>
      <Text style={styles.cardSubtitle}>{theme.subtitle}</Text>
    </View>
    <Ionicons
      name="chevron-forward"
      size={24}
      color={COLORS.textSecondary}
      style={styles.cardArrow}
    />
  </TouchableOpacity>
);

/**
 * Student Community Theme Selection Screen
 * User selects the theme for their student community (confessions/memes/discussions)
 */
const StudentCommunityThemeScreen = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    refreshToken,
    community_type,
    college_id,
    college_name,
    college_subtype,
    college_pending,
  } = route.params || {};

  const handleThemeSelect = async (theme) => {
    console.log("[StudentCommunityTheme] Selected:", theme.id);

    // Save community_theme to draft
    try {
      await updateCommunitySignupDraft("StudentCommunityTheme", {
        community_theme: theme.id,
      });
      console.log("[StudentCommunityTheme] Draft updated with theme");
    } catch (e) {
      console.log(
        "[StudentCommunityTheme] Draft update failed (non-critical):",
        e.message
      );
    }

    // Navigate to name screen with all params
    navigation.navigate("CommunityName", {
      email,
      accessToken,
      refreshToken,
      community_type,
      college_id,
      college_name,
      college_subtype,
      community_theme: theme.id,
      college_pending,
      isStudentCommunity: true,
    });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <GlassBackButton onPress={handleBack} style={styles.backButton} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>Choose a theme</Text>
        <Text style={styles.subtitle}>
          What will your student community be about?
        </Text>

        {/* Privacy notice */}
        <View style={styles.privacyNotice}>
          <Ionicons name="lock-closed" size={16} color={COLORS.primary} />
          <Text style={styles.privacyText}>
            Student communities are private and never visible to sponsors
          </Text>
        </View>

        {/* Theme Cards */}
        <View style={styles.cardsContainer}>
          {COMMUNITY_THEMES.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              onPress={handleThemeSelect}
            />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    paddingRight: 15,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  privacyNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primaryLight || "#e8f4ff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 24,
  },
  privacyText: {
    fontSize: 13,
    color: COLORS.primary,
    marginLeft: 8,
    flex: 1,
  },
  cardsContainer: {
    gap: 14,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBackground || "#fff",
    borderRadius: 16,
    padding: 14,
    ...SHADOWS.medium,
  },
  cardGradient: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  cardArrow: {
    opacity: 0.5,
  },
});

export default StudentCommunityThemeScreen;
