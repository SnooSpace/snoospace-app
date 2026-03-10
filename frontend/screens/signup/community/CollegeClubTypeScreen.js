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
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import wave from "../../../assets/wave.png";
import { COLORS, SPACING, BORDER_RADIUS } from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";
import { updateCommunitySignupDraft } from "../../../utils/signupDraftManager";

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
    style={styles.clubTypeItem}
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
    <View style={styles.clubTypeContent}>
      <Text style={styles.clubTypeTitle}>{clubType.title}</Text>
      <Text style={styles.clubTypeSubtitle}>{clubType.subtitle}</Text>
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

  const handleClubTypeSelect = async (clubType) => {
    console.log("[CollegeClubType] Selected:", clubType.id);

    // Save club_type to draft
    try {
      await updateCommunitySignupDraft("CollegeClubType", {
        club_type: clubType.id,
      });
      console.log("[CollegeClubType] Draft updated with club_type");
    } catch (e) {
      console.log(
        "[CollegeClubType] Draft update failed (non-critical):",
        e.message,
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
      club_type: clubType.id,
      college_pending,
    });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <ImageBackground
      source={wave}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.3, transform: [{ scaleX: -1 }, { scaleY: -1 }] }}
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
              <Animated.Text 
                entering={FadeInDown.delay(100).duration(600).springify()}
                style={styles.title}
              >
                What type of club?
              </Animated.Text>
              <Animated.Text 
                entering={FadeInDown.delay(200).duration(600).springify()}
                style={styles.globalHelperText}
              >
                Select the category that best describes your club at{" "}
                <Text style={styles.collegeName}>
                  {college_name || "your college"}
                </Text>
              </Animated.Text>
            </View>

            <Animated.View 
              entering={FadeInDown.delay(300).duration(600).springify()}
              style={styles.card}
            >
              <BlurView
                intensity={60}
                tint="light"
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.cardContent}>
                {/* Club Type Cards */}
                <View style={styles.cardsContainer}>
                  {CLUB_TYPES.map((clubType, index) => (
                    <Animated.View 
                      key={clubType.id}
                      entering={FadeInDown.delay(400 + index * 100).duration(600).springify()}
                    >
                      <ClubTypeCard
                        clubType={clubType}
                        onPress={handleClubTypeSelect}
                      />
                    </Animated.View>
                  ))}
                  </View>
                </View>
              </Animated.View>
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
  clubTypeItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(116, 173, 242, 0.1)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(116, 173, 242, 0.2)",
  },
  cardGradient: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  clubTypeContent: {
    flex: 1,
    marginLeft: 16,
    marginRight: 8,
  },
  clubTypeTitle: {
    fontSize: 17,
    fontFamily: "Manrope-Bold",
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  clubTypeSubtitle: {
    fontSize: 13,
    fontFamily: "Manrope-Medium",
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  cardArrow: {
    opacity: 0.5,
  },
});

export default CollegeClubTypeScreen;



