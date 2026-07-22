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
import { University, Building2, ChevronRight } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import wave from "../../../assets/background/wave.webp";
import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import SignupHeader from "../../../components/SignupHeader";
import { updateCommunitySignupDraft, getCommunityDraftData } from "../../../utils/signupDraftManager";
import { triggerTransitionHaptic } from "../../../hooks/useCelebrationHaptics";
import { COMMUNITY_TYPE_LABELS } from "../../../constants/communityTypeLabels";

const COMMUNITY_TYPES = [
  {
    id: "college_affiliated",
    title: COMMUNITY_TYPE_LABELS.college_affiliated.label,
    subtitle: COMMUNITY_TYPE_LABELS.college_affiliated.description,
    iconName: "University",
    iconColor: "#2962FF", // Sophisticated Brand Blue
    bgColor: "rgba(41, 98, 255, 0.08)", // Soft brand blue tint
    borderColor: "rgba(41, 98, 255, 0.15)", // Subtle brand border
    nextScreen: "CollegeSearch",
  },
  {
    id: "organization",
    title: COMMUNITY_TYPE_LABELS.organization.label,
    subtitle: COMMUNITY_TYPE_LABELS.organization.description,
    iconName: "Building2",
    iconColor: "#00BFA5", // Sophisticated Accent Teal
    bgColor: "rgba(0, 191, 165, 0.08)", // Soft teal tint
    borderColor: "rgba(0, 191, 165, 0.15)", // Subtle teal border
    nextScreen: "CommunityName",
  },
];

/**
 * Type Selection Card Component
 */
const TypeCard = ({ type, onPress, isLast, index }) => {
  const Icon = { University, Building2 }[type.iconName];
  return (
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
        <View
          style={[
            styles.cardIconContainer,
            {
              backgroundColor: type.bgColor,
              borderColor: type.borderColor,
              borderWidth: 1,
            }
          ]}
        >
          <Icon size={22} color={type.iconColor} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{type.title}</Text>
          <Text style={styles.cardSubtitle}>{type.subtitle}</Text>
        </View>
        <ChevronRight
          size={20}
          color={COLORS.textSecondary}
          style={styles.cardArrow}
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

/**
 * Community Type Selection Screen
 * Shown after OTP verification - user selects what type of community they're creating
 */
const CommunityTypeSelectScreen = ({ navigation, route }) => {
  const { email, accessToken, refreshToken, isResumingDraft } =
    route.params || {};

  // States for shared params that need hydration from draft if missing
  const [params, setParams] = React.useState({
    email,
    accessToken,
    refreshToken,
  });

  const [selectedType, setSelectedType] = React.useState(
    route.params?.community_type || null,
  );

  // Hydrate from draft if needed
  React.useEffect(() => {
    const hydrateFromDraft = async () => {
      const draftData = await getCommunityDraftData();
      if (!draftData) return;

      // 1. Hydrate community_type
      if (!route.params?.community_type && draftData?.community_type) {
        console.log("[CommunityTypeSelect] Hydrating from draft");
        setSelectedType(draftData.community_type);
      }

      // 2. Hydrate all shared parameters
      const updatedParams = { ...params };
      let paramChanged = false;

      const keysToHydrate = ["email", "accessToken", "refreshToken"];

      keysToHydrate.forEach(key => {
        if (!params[key] && draftData[key] !== undefined && draftData[key] !== null) {
          updatedParams[key] = draftData[key];
          paramChanged = true;
        }
      });

      if (paramChanged) {
        console.log("[CommunityTypeSelect] Hydrated shared parameters from draft");
        setParams(updatedParams);
      }
    };
    hydrateFromDraft();
  }, []);

  const handleTypeSelect = async (type) => {
    triggerTransitionHaptic();
    setSelectedType(type.id);
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
      ...params,
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
      imageStyle={{ opacity: 0.3, transform: [{ scaleX: -1 }, { scaleY: -1 }] }}
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        <SignupHeader
          onBack={handleBack}
          role="Community"
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
    fontFamily: "PlusJakartaSans-ExtraBold",
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
  cardIconContainer: {
    width: 48,
    height: 48,
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



