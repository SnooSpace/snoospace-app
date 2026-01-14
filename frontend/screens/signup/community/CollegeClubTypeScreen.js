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

const CLUB_TYPES = [
  {
    id: "official_club",
    title: "Official Club",
    subtitle: "Recognized student organizations, cultural/tech clubs",
    icon: "ribbon-outline",
    gradientColors: ["#667eea", "#764ba2"],
  },
  {
    id: "department",
    title: "Department",
    subtitle: "Department societies, academic groups",
    icon: "school-outline",
    gradientColors: ["#11998e", "#38ef7d"],
  },
  {
    id: "society",
    title: "Society",
    subtitle: "Literary, cultural, or special interest societies",
    icon: "people-outline",
    gradientColors: ["#FF512F", "#F09819"],
  },
];

/**
 * Club Type Card Component
 */
const ClubTypeCard = ({ clubType, onPress }) => (
  <TouchableOpacity
    style={styles.card}
    onPress={() => onPress(clubType)}
    activeOpacity={0.8}
    accessibilityRole="button"
    accessibilityLabel={`Select ${clubType.title}`}
  >
    <LinearGradient
      colors={clubType.gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.cardGradient}
    >
      <Ionicons name={clubType.icon} size={28} color="#fff" />
    </LinearGradient>
    <View style={styles.cardContent}>
      <Text style={styles.cardTitle}>{clubType.title}</Text>
      <Text style={styles.cardSubtitle}>{clubType.subtitle}</Text>
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
 * College Club Type Selection Screen
 * User selects whether their club is Official, Department, or Society
 */
const CollegeClubTypeScreen = ({ navigation, route }) => {
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

  const handleClubTypeSelect = (clubType) => {
    console.log("[CollegeClubType] Selected:", clubType.id);

    // Navigate to name screen with all params
    navigation.navigate("CommunityName", {
      email,
      accessToken,
      refreshToken,
      community_type,
      college_id,
      college_name,
      college_subtype,
      club_type: clubType.id,
      college_pending,
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
        <Text style={styles.title}>What type of club?</Text>
        <Text style={styles.subtitle}>
          Select the category that best describes your club at{" "}
          <Text style={styles.collegeName}>
            {college_name || "your college"}
          </Text>
        </Text>

        {/* Club Type Cards */}
        <View style={styles.cardsContainer}>
          {CLUB_TYPES.map((clubType) => (
            <ClubTypeCard
              key={clubType.id}
              clubType={clubType}
              onPress={handleClubTypeSelect}
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
    lineHeight: 22,
  },
  collegeName: {
    fontWeight: "600",
    color: COLORS.primary,
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
  cardGradient: {
    width: 56,
    height: 56,
    borderRadius: 14,
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

export default CollegeClubTypeScreen;
