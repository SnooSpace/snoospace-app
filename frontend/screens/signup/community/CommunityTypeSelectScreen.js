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
import Animated, { FadeInDown } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import wave from "../../../assets/wave.png";
import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";
import { updateCommunitySignupDraft } from "../../../utils/signupDraftManager";
import { triggerTransitionHaptic } from "../../../hooks/useCelebrationHaptics";

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
const TypeCard = ({ type, onPress, isLast, index }) => (
  <Animated.View 
    entering={FadeInDown.delay(400 + index * 100).duration(600).springify()}
    style={[styles.card, isLast && styles.cardLast]}
  >
    <BlurView intensity={60} tint="light" style={styles.absoluteFill} />
    <TouchableOpacity
      style={styles.cardInner}
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
          <Ionicons name={type.icon} size={32} color="#fff" />
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
  </Animated.View>
);

/**
 * Community Type Selection Screen
 * Shown after OTP verification - user selects what type of community they're creating
 */
const CommunityTypeSelectScreen = ({ navigation, route }) => {
  const { email, accessToken, refreshToken } = route.params || {};

  const handleTypeSelect = async (type) => {
    triggerTransitionHaptic();
    console.log("[CommunityTypeSelect] Selected type:", type.id);

    // Save community_type to draft
    try {
      await updateCommunitySignupDraft("CommunityTypeSelect", {
        community_type: type.id,
      });
      console.log("[CommunityTypeSelect] Draft updated with community_type");
    } catch (e) {
      console.log(
        "[CommunityTypeSelect] Draft update failed (non-critical):",
        e.message,
      );
    }

    // Navigate to appropriate next screen based on type
    navigation.navigate(type.nextScreen, {
      email,
      accessToken,
      refreshToken,
      community_type: type.id,
    });
  };

  const handleBack = () => {
    triggerTransitionHaptic();
    navigation.goBack();
  };

  return (
    <ImageBackground
      source={wave}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.3, transform: [{ scaleX: -1, scaleY: -1 }] }}
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        <SignupHeader
          onBack={handleBack}
          role="Communities"
          showCancel={false}
        />

        {/* Content */}
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Animated.Text 
              entering={FadeInDown.delay(100).duration(600).springify()}
              style={styles.title}
            >
              What are you creating?
            </Animated.Text>
            <Animated.Text 
              entering={FadeInDown.delay(200).duration(600).springify()}
              style={styles.subtitle}
            >
              Choose the option that best describes your community
            </Animated.Text>

            {/* Type Cards */}
            <View style={styles.cardsContainer}>
              {COMMUNITY_TYPES.map((type, index) => (
                <TypeCard
                  key={type.id}
                  type={type}
                  onPress={handleTypeSelect}
                  isLast={index === COMMUNITY_TYPES.length - 1}
                  index={index}
                />
              ))}
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
    paddingTop: 40,
  },
  title: {
    fontSize: 34,
    fontFamily: "BasicCommercial-Black",
    color: COLORS.textPrimary,
    marginBottom: 10,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
    marginBottom: 40,
  },
  cardsContainer: {
    gap: 16,
  },
  card: {
    borderRadius: 24,
    ...Platform.select({
      ios: {
        ...SHADOWS.xl,
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
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
  },
  cardLast: {
    marginBottom: 0,
  },
  cardGradient: {
    width: 60,
    height: 60,
    borderRadius: 18,
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
    fontSize: 18,
    fontFamily: "Manrope-Bold",
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  cardArrow: {
    opacity: 0.5,
  },
});

export default CommunityTypeSelectScreen;



