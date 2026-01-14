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

const COLLEGE_SUBTYPES = [
  {
    id: "event",
    title: "Event",
    subtitle: "College fests, hackathons, concerts, workshops",
    icon: "calendar-outline",
    gradientColors: ["#FF512F", "#F09819"],
  },
  {
    id: "club",
    title: "Club",
    subtitle: "Official clubs, departments, societies",
    icon: "trophy-outline",
    gradientColors: ["#667eea", "#764ba2"],
  },
  {
    id: "student_community",
    title: "Student Community",
    subtitle: "Confessions, memes, discussions, campus life",
    icon: "chatbubbles-outline",
    gradientColors: ["#11998e", "#38ef7d"],
    isPrivate: true, // Never visible to sponsors
  },
];

/**
 * Subtype Selection Card Component
 */
const SubtypeCard = ({ subtype, collegeName, onPress, isLast }) => (
  <TouchableOpacity
    style={[styles.card, isLast && styles.cardLast]}
    onPress={() => onPress(subtype)}
    activeOpacity={0.8}
    accessibilityRole="button"
    accessibilityLabel={`Select ${subtype.title}`}
  >
    <LinearGradient
      colors={subtype.gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.cardGradient}
    >
      <View style={styles.cardIconContainer}>
        <Ionicons name={subtype.icon} size={32} color="#fff" />
      </View>
    </LinearGradient>
    <View style={styles.cardContent}>
      <Text style={styles.cardTitle}>{subtype.title}</Text>
      <Text style={styles.cardSubtitle}>{subtype.subtitle}</Text>
      {subtype.isPrivate && (
        <View style={styles.privateTag}>
          <Ionicons name="lock-closed" size={12} color={COLORS.textSecondary} />
          <Text style={styles.privateTagText}>
            Private - Not visible to sponsors
          </Text>
        </View>
      )}
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
 * College Subtype Selection Screen
 * User selects whether they're creating an Event, Club, or Student Community
 */
const CollegeSubtypeSelectScreen = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    refreshToken,
    community_type,
    college_id,
    college_name,
    college_pending,
  } = route.params || {};

  const handleSubtypeSelect = (subtype) => {
    console.log(
      "[CollegeSubtypeSelect] Selected:",
      subtype.id,
      "for college:",
      college_name
    );

    // Navigate to appropriate next screen based on subtype
    if (subtype.id === "student_community") {
      // Student community goes to theme selection first
      navigation.navigate("StudentCommunityTheme", {
        email,
        accessToken,
        refreshToken,
        community_type,
        college_id,
        college_name,
        college_subtype: subtype.id,
        college_pending,
      });
    } else if (subtype.id === "club") {
      // Club needs club type selection next
      navigation.navigate("CollegeClubType", {
        email,
        accessToken,
        refreshToken,
        community_type,
        college_id,
        college_name,
        college_subtype: subtype.id,
        college_pending,
      });
    } else {
      // Event goes directly to name
      navigation.navigate("CommunityName", {
        email,
        accessToken,
        refreshToken,
        community_type,
        college_id,
        college_name,
        college_subtype: subtype.id,
        college_pending,
      });
    }
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
          Choose the type for{" "}
          <Text style={styles.collegeName}>
            {college_name || "your college"}
          </Text>
        </Text>

        {/* Subtype Cards */}
        <View style={styles.cardsContainer}>
          {COLLEGE_SUBTYPES.map((subtype, index) => (
            <SubtypeCard
              key={subtype.id}
              subtype={subtype}
              collegeName={college_name}
              onPress={handleSubtypeSelect}
              isLast={index === COLLEGE_SUBTYPES.length - 1}
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
  cardLast: {
    marginBottom: 0,
  },
  cardGradient: {
    width: 60,
    height: 60,
    borderRadius: 14,
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
  privateTag: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: COLORS.inputBackground || "#f0f0f0",
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  privateTagText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  cardArrow: {
    opacity: 0.5,
  },
});

export default CollegeSubtypeSelectScreen;
