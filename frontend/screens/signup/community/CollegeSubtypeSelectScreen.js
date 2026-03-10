import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
  ImageBackground,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import wave from "../../../assets/wave.png";
import { COLORS, SPACING, BORDER_RADIUS } from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";
import { updateCommunitySignupDraft } from "../../../utils/signupDraftManager";

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
    style={[styles.subtypeItem, isLast && styles.cardLast]}
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
    <View style={styles.subtypeContent}>
      <Text style={styles.subtypeTitle}>{subtype.title}</Text>
      <Text style={styles.subtypeSubtitle}>{subtype.subtitle}</Text>
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

  const handleSubtypeSelect = async (subtype) => {
    console.log(
      "[CollegeSubtypeSelect] Selected:",
      subtype.id,
      "for college:",
      college_name,
    );

    // Save college_subtype to draft
    try {
      await updateCommunitySignupDraft("CollegeSubtypeSelect", {
        college_subtype: subtype.id,
        isStudentCommunity: subtype.id === "student_community",
      });
      console.log("[CollegeSubtypeSelect] Draft updated with subtype");
    } catch (e) {
      console.log(
        "[CollegeSubtypeSelect] Draft update failed (non-critical):",
        e.message,
      );
    }

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
    <ImageBackground
      source={wave}
      style={styles.backgroundImage}
      imageStyle={{
        opacity: 0.3,
        transform: [{ scaleX: -1 }, { rotate: "90deg" }],
      }}
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <SignupHeader
            role="Communities"
            onBack={handleBack}
            onCancel={() => {}}
            hideCancel={true}
          />

          {/* Content */}
          <View style={styles.content}>
            <View style={styles.headerTitle}>
              <Text style={styles.title}>What are you creating?</Text>
              <Text style={styles.globalHelperText}>
                Choose the type for{" "}
                <Text style={styles.collegeName}>
                  {college_name || "your college"}
                </Text>
              </Text>
            </View>

            <View style={styles.card}>
              <BlurView
                intensity={60}
                tint="light"
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.cardContent}>
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
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 25,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    marginTop: 40,
  },
  headerTitle: {
    marginBottom: 40,
    paddingRight: 10,
  },
  title: {
    fontSize: 34,
    fontFamily: "BasicCommercial-Black",
    color: COLORS.textPrimary,
    marginBottom: 10,
    letterSpacing: -1,
    lineHeight: 38,
  },
  globalHelperText: {
    fontSize: 16,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
    marginBottom: 10,
    lineHeight: 24,
  },
  collegeName: {
    fontFamily: "Manrope-Bold",
    color: COLORS.primary,
  },
  card: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.1,
        shadowRadius: 24,
      },
      android: {
        elevation: 0,
      },
    }),
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    overflow: "hidden",
  },
  cardContent: {
    padding: 24,
  },
  cardsContainer: {
    gap: 16,
  },
  subtypeItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(116, 173, 242, 0.1)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(116, 173, 242, 0.2)",
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
  subtypeContent: {
    flex: 1,
    marginLeft: 16,
    marginRight: 8,
  },
  subtypeTitle: {
    fontSize: 17,
    fontFamily: "Manrope-Bold",
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtypeSubtitle: {
    fontSize: 13,
    fontFamily: "Manrope-Medium",
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  privateTag: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  privateTagText: {
    fontSize: 11,
    fontFamily: "Manrope-Medium",
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  cardArrow: {
    opacity: 0.5,
  },
});

export default CollegeSubtypeSelectScreen;
