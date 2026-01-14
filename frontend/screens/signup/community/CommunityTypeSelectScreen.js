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

const COMMUNITY_TYPES = [
  {
    id: "individual_organizer",
    title: "Individual Organizer",
    subtitle: "For solo creators & hosts running events",
    icon: "sparkles-outline",
    gradientColors: ["#FF6B6B", "#FF8E53"],
    nextScreen: "CommunityName", // Same flow, simplified
  },
  {
    id: "college_affiliated",
    title: "College",
    subtitle: "For college clubs, fests & student communities",
    icon: "school-outline",
    gradientColors: ["#667eea", "#764ba2"],
    nextScreen: "CollegeSearch",
  },
  {
    id: "organization",
    title: "Community / Organization",
    subtitle: "For NGOs, startups, run clubs & brands",
    icon: "business-outline",
    gradientColors: ["#11998e", "#38ef7d"],
    nextScreen: "CommunityName",
  },
];

/**
 * Type Selection Card Component
 */
const TypeCard = ({ type, onPress, isLast }) => (
  <TouchableOpacity
    style={[styles.card, isLast && styles.cardLast]}
    onPress={() => onPress(type)}
    activeOpacity={0.8}
    accessibilityRole="button"
    accessibilityLabel={`Select ${type.title}`}
  >
    <LinearGradient
      colors={type.gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.cardGradient}
    >
      <View style={styles.cardIconContainer}>
        <Ionicons name={type.icon} size={36} color="#fff" />
      </View>
    </LinearGradient>
    <View style={styles.cardContent}>
      <Text style={styles.cardTitle}>{type.title}</Text>
      <Text style={styles.cardSubtitle}>{type.subtitle}</Text>
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
 * Community Type Selection Screen
 * Shown after OTP verification - user selects what type of community they're creating
 */
const CommunityTypeSelectScreen = ({ navigation, route }) => {
  const { email, accessToken, refreshToken } = route.params || {};

  const handleTypeSelect = (type) => {
    console.log("[CommunityTypeSelect] Selected type:", type.id);

    // Navigate to appropriate next screen based on type
    navigation.navigate(type.nextScreen, {
      email,
      accessToken,
      refreshToken,
      community_type: type.id,
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
        <Text style={styles.title}>What are you creating?</Text>
        <Text style={styles.subtitle}>
          Choose the option that best describes your community
        </Text>

        {/* Type Cards */}
        <View style={styles.cardsContainer}>
          {COMMUNITY_TYPES.map((type, index) => (
            <TypeCard
              key={type.id}
              type={type}
              onPress={handleTypeSelect}
              isLast={index === COMMUNITY_TYPES.length - 1}
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
    marginBottom: 30,
  },
  cardsContainer: {
    gap: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBackground || "#fff",
    borderRadius: 16,
    padding: 16,
    ...SHADOWS.medium,
  },
  cardLast: {
    marginBottom: 0,
  },
  cardGradient: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  cardIconContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: {
    flex: 1,
    marginLeft: 16,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  cardArrow: {
    opacity: 0.5,
  },
});

export default CommunityTypeSelectScreen;
