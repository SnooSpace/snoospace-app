import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Platform,
  StatusBar,
  ImageBackground,
  Dimensions,
  BackHandler,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Users, Sparkles } from "lucide-react-native";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import {
  createPeopleProfileDraft,
  updateSignupDraft,
  deleteSignupDraft,
} from "../../../utils/signupDraftManager";
import { getActiveAccount } from "../../../api/auth";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";

const { width } = Dimensions.get("window");

export default function PeopleProfilePromptScreen({ navigation, route }) {
  // userData → normal community signup flow
  // prefillRecovery → draft crash-recovery: we landed here from AuthGate/Landing
  const { userData, prefillRecovery } = route.params || {};

  const [showCancelModal, setShowCancelModal] = useState(false);

  // Animation values
  const iconScale = useSharedValue(0.8);
  const iconGlow = useSharedValue(0.5);
  const primaryButtonScale = useSharedValue(1);
  const ghostButtonScale = useSharedValue(1);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
    opacity: iconGlow.value,
  }));

  const animatedPrimaryStyle = useAnimatedStyle(() => ({
    transform: [{ scale: primaryButtonScale.value }],
  }));

  const animatedGhostStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ghostButtonScale.value }],
  }));

  useEffect(() => {
    // Bounce icon in
    iconScale.value = withSpring(1, { damping: 12, stiffness: 90 });
    // Subtle pulse glow
    iconGlow.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    const onBackPress = () => {
      setShowCancelModal(true);
      return true;
    };
    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, []);

  const handleSetupNow = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    primaryButtonScale.value = withSequence(
      withSpring(0.95, { damping: 10 }),
      withSpring(1, { damping: 12 })
    );

    let prefill;

    if (prefillRecovery) {
      // Draft-recovery path: prefill was stored in the draft itself
      prefill = prefillRecovery;
    } else {
      // Normal community signup path: extract prefill from community userData
      const primaryHead = userData?.heads?.find((h) => h.is_primary);
      const memberName = primaryHead?.name ?? userData?.heads?.[0]?.name ?? "";
      const memberPhoto = userData?.head_photo_url ?? userData?.logo_url ?? null;
      const memberPhone = userData?.phone ?? "";
      const memberLocation = userData?.location ?? null;
      const memberEmail = userData?.email ?? null;

      prefill = {
        name: memberName,
        photo: memberPhoto,
        phone: memberPhone,
        location: memberLocation,
        email: memberEmail,
      };
    }

    // Advance the draft step to "MemberName" so AuthGate will resume there
    // (not back on PeopleProfilePromptScreen).
    try {
      // If draft doesn't exist yet (edge case), create it; otherwise just update step.
      const activeAccount = await getActiveAccount();
      await createPeopleProfileDraft(prefill, activeAccount?.id ?? null, "MemberName");
      console.log("[PeopleProfilePromptScreen] Draft step advanced to MemberName");
    } catch (e) {
      console.warn("[PeopleProfilePromptScreen] Could not update draft:", e.message);
    }

    navigation.navigate("MemberSignup", {
      screen: "MemberName",
      params: {
        email: prefill.email,
        prefill,
        fromCommunitySignup: true,
      },
    });
  };

  const handleCreateLater = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    ghostButtonScale.value = withSequence(
      withSpring(0.95, { damping: 10 }),
      withSpring(1, { damping: 12 })
    );

    // Delete the People-profile draft so it doesn't resurface later
    try {
      await deleteSignupDraft();
    } catch (e) {}

    navigation.navigate("Celebration", {
      role: "Community",
      fromCommunitySignup: true,
      createdPeopleProfile: false,
    });
  };

  const handleDiscard = () => {
    setShowCancelModal(false);
    handleCreateLater();
  };

  return (
    <ImageBackground
      source={require("../../../assets/wave.png")}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.25, transform: [{ scaleX: -1 }, { scaleY: -1 }] }}
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        <CancelSignupModal
          visible={showCancelModal}
          onKeepEditing={() => setShowCancelModal(false)}
          onDiscard={handleDiscard}
        />
        <View style={styles.container}>
          {/* Illustration / Icon Area */}
          <Animated.View
            entering={FadeInUp.delay(100).duration(700).springify()}
            style={styles.illustrationWrapper}
          >
            <Animated.View style={[styles.iconCircle, animatedIconStyle]}>
              <LinearGradient
                colors={COLORS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGradient}
              >
                <Users size={44} color="#FFFFFF" strokeWidth={1.8} />
              </LinearGradient>
            </Animated.View>

            {/* Floating sparkle accent */}
            <Animated.View
              entering={FadeInUp.delay(400).duration(600).springify()}
              style={styles.sparkleAccent}
            >
              <Sparkles size={20} color={COLORS.primary} strokeWidth={2} />
            </Animated.View>
          </Animated.View>

          {/* Text Content */}
          <View style={styles.textBlock}>
            <Animated.Text
              entering={FadeInDown.delay(200).duration(700).springify()}
              style={styles.heading}
            >
              Want to join as a member too?
            </Animated.Text>

            <Animated.Text
              entering={FadeInDown.delay(300).duration(700).springify()}
              style={styles.subtext}
            >
              Set up your people profile to discover events, follow communities,
              and connect with others.
            </Animated.Text>
          </View>

          {/* Card with buttons */}
          <Animated.View
            entering={FadeInDown.delay(400).duration(700).springify()}
            style={styles.card}
          >
            <BlurView intensity={55} tint="light" style={StyleSheet.absoluteFill} />
            <View style={styles.cardContent}>
              {/* "Set up now" pill badge */}
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedText}>✦ Recommended</Text>
              </View>

              {/* Primary Button — Set up now */}
              <Animated.View style={animatedPrimaryStyle}>
                <TouchableOpacity
                  style={styles.primaryButtonContainer}
                  onPress={handleSetupNow}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={COLORS.primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>Set up now</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              {/* Ghost Button — Create later */}
              <Animated.View style={animatedGhostStyle}>
                <TouchableOpacity
                  style={styles.ghostButton}
                  onPress={handleCreateLater}
                  activeOpacity={0.7}
                >
                  <Text style={styles.ghostButtonText}>Create later</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Animated.View>

          {/* Bottom reassurance note */}
          <Animated.Text
            entering={FadeInDown.delay(600).duration(700).springify()}
            style={styles.footerNote}
          >
            You can always create a member profile from Settings later.
          </Animated.Text>

        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingBottom: 24,
  },

  // --- Illustration ---
  illustrationWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 36,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
      },
      android: { elevation: 10 },
    }),
  },
  iconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  sparkleAccent: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 20,
    padding: 6,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },

  // --- Text Block ---
  textBlock: {
    alignItems: "center",
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  heading: {
    fontSize: 30,
    fontFamily: "BasicCommercial-Black",
    color: COLORS.textPrimary,
    textAlign: "center",
    letterSpacing: -0.8,
    lineHeight: 38,
    marginBottom: 14,
  },
  subtext: {
    fontSize: 15,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 23,
  },

  // --- Card ---
  card: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 28,
    ...Platform.select({
      ios: {
        ...SHADOWS.xl,
        shadowOpacity: 0.1,
        shadowRadius: 24,
      },
      android: { elevation: 0 },
    }),
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    overflow: "hidden",
    marginBottom: 20,
  },
  cardContent: {
    padding: 24,
    gap: 12,
  },
  recommendedBadge: {
    alignSelf: "center",
    backgroundColor: "rgba(53, 101, 242, 0.1)",
    borderRadius: BORDER_RADIUS.pill,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "rgba(53, 101, 242, 0.2)",
  },
  recommendedText: {
    fontSize: 12,
    fontFamily: "Manrope-SemiBold",
    color: COLORS.primary,
    letterSpacing: 0.3,
  },

  // --- Primary Button ---
  primaryButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
      },
      android: { elevation: 8 },
    }),
  },
  primaryButton: {
    height: 58,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },

  // --- Ghost Button ---
  ghostButton: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BORDER_RADIUS.pill,
    borderWidth: 1.5,
    borderColor: "rgba(0, 0, 0, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  ghostButtonText: {
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
    color: COLORS.textSecondary,
  },

  // --- Footer ---
  footerNote: {
    fontSize: 12,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
    textAlign: "center",
    opacity: 0.7,
    paddingHorizontal: 16,
    marginBottom: 16,
  },

});
