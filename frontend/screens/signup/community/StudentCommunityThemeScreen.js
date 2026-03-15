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
import { updateCommunitySignupDraft, getCommunityDraftData } from "../../../utils/signupDraftManager";

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
    style={styles.themeItem}
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
    <View style={styles.themeContent}>
      <Text style={styles.themeTitle}>{theme.title}</Text>
      <Text style={styles.themeSubtitle}>{theme.subtitle}</Text>
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
    community_theme: routeTheme,
  } = route.params || {};

  const [selectedTheme, setSelectedTheme] = React.useState(routeTheme || null);

  // Hydrate from draft if needed
  React.useEffect(() => {
    const hydrateFromDraft = async () => {
      if (!routeTheme) {
        const draftData = await getCommunityDraftData();
        if (draftData?.community_theme) {
          console.log("[StudentCommunityTheme] Hydrating from draft");
          setSelectedTheme(draftData.community_theme);
        }
      }
    };
    hydrateFromDraft();
  }, []);

  const handleThemeSelect = async (theme) => {
    console.log("[StudentCommunityTheme] Selected:", theme.id);
    setSelectedTheme(theme.id);

    // Save community_theme to draft
    try {
      await updateCommunitySignupDraft("StudentCommunityTheme", {
        community_theme: theme.id,
      });
      console.log("[StudentCommunityTheme] Draft updated with theme");
    } catch (e) {
      console.log(
        "[StudentCommunityTheme] Draft update failed (non-critical):",
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
      community_theme: theme.id,
      college_pending,
      isStudentCommunity: true,
    });
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
        transform: [{ scaleX: -1 }, { scaleY: -1 }],
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
            role="Community"
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
                Choose a theme
              </Animated.Text>
              <Animated.Text 
                entering={FadeInDown.delay(200).duration(600).springify()}
                style={styles.globalHelperText}
              >
                What will your student community be about?
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
                {/* Privacy notice */}
                <View style={styles.privacyNotice}>
                  <Ionicons
                    name="lock-closed"
                    size={16}
                    color={COLORS.primary}
                  />
                  <Text style={styles.privacyText}>
                    Student communities are private and never visible to
                    sponsors
                  </Text>
                </View>

                {/* Theme Cards */}
                <View style={styles.cardsContainer}>
                  {COMMUNITY_THEMES.map((theme, index) => (
                    <Animated.View 
                      key={theme.id}
                      entering={FadeInDown.delay(400 + index * 100).duration(600).springify()}
                    >
                      <ThemeCard
                        theme={theme}
                        onPress={handleThemeSelect}
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
  privacyNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(116, 173, 242, 0.1)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 24,
  },
  privacyText: {
    fontSize: 13,
    fontFamily: "Manrope-Medium",
    color: COLORS.primary,
    marginLeft: 8,
    flex: 1,
  },
  cardsContainer: {
    gap: 14,
  },
  themeItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(116, 173, 242, 0.1)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(116, 173, 242, 0.2)",
  },
  cardGradient: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  themeContent: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  themeTitle: {
    fontSize: 16,
    fontFamily: "Manrope-Bold",
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  themeSubtitle: {
    fontSize: 12,
    fontFamily: "Manrope-Medium",
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  cardArrow: {
    opacity: 0.5,
  },
});

export default StudentCommunityThemeScreen;



