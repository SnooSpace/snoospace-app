/**
 * ConsentScreen
 *
 * Onboarding consent screen — appears once after profile setup,
 * before the user reaches the home feed for the first time.
 * Also re-appears if consent_version changes (policy update).
 *
 * DPDP Act 2023 compliance: explicit informed consent before
 * collecting and processing behavioral data.
 *
 * Typography Rules:
 *   - Page title: BasicCommercial-Black (single usage)
 *   - Card titles: Manrope-SemiBold
 *   - Descriptions: Manrope-Regular
 *   - Button: Manrope-SemiBold
 *   - Metadata: Manrope-Medium
 * Icons: All from lucide-react-native
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Animated,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  Sparkles,
  Handshake,
  Users,
  ChevronRight,
  Shield,
} from "lucide-react-native";
import { FONTS } from "../../constants/theme";
import { updateConsent } from "../../api/privacy";

const { width, height } = Dimensions.get("window");

// ── Consent Cards Configuration ──────────────────────────────────────────────
const CONSENT_CARDS = [
  {
    id: "behavioral",
    icon: Sparkles,
    iconColor: "#A78BFA",
    iconBg: "rgba(167, 139, 250, 0.15)",
    title: "Personalized Experience",
    subtitle: "Help SnooSpace learn what you love",
    description:
      "We track which events you attend and content you engage with to personalize your feed. Your data is never sold — it stays on SnooSpace.",
    field: "behavioralTracking",
  },
  {
    id: "brand",
    icon: Handshake,
    iconColor: "#60A5FA",
    iconBg: "rgba(96, 165, 250, 0.15)",
    title: "Brand Partnerships",
    subtitle: "Connect with brands that match your interests",
    description:
      "Allow relevant brands to discover creators and communities like yours. You can turn this off anytime — it won't affect your experience.",
    field: "brandTargeting",
  },
  {
    id: "dataSharing",
    icon: Users,
    iconColor: "#34D399",
    iconBg: "rgba(52, 211, 153, 0.15)",
    title: "Community Insights",
    subtitle: "Contribute to community intelligence",
    description:
      "Your aggregated (never individual) activity helps creators understand their audience quality. No personal data is ever shared.",
    field: "dataSharing",
  },
];

// ── Component ────────────────────────────────────────────────────────────────

const ConsentScreen = ({ navigation, route }) => {
  const [consents, setConsents] = useState({
    behavioralTracking: false,
    brandTargeting: false,
    dataSharing: false,
  });
  const [hasInteractedWithBehavioral, setHasInteractedWithBehavioral] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Where to navigate after consent
  const nextRoute = route?.params?.nextRoute || "MemberHome";
  const nextParams = route?.params?.nextParams || {};

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const cardAnims = useRef(
    CONSENT_CARDS.map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(30),
    }))
  ).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;
  const shieldAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Stagger entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();

    // Shield icon entrance
    Animated.spring(shieldAnim, {
      toValue: 1,
      tension: 50,
      friction: 6,
      delay: 200,
      useNativeDriver: true,
    }).start();

    // Stagger card entrance
    cardAnims.forEach((anim, index) => {
      Animated.parallel([
        Animated.timing(anim.opacity, {
          toValue: 1,
          duration: 500,
          delay: 400 + index * 150,
          useNativeDriver: true,
        }),
        Animated.spring(anim.translateY, {
          toValue: 0,
          tension: 60,
          friction: 10,
          delay: 400 + index * 150,
          useNativeDriver: true,
        }),
      ]).start();
    });

    // CTA button entrance
    Animated.timing(ctaAnim, {
      toValue: 1,
      duration: 500,
      delay: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  const toggleConsent = (field) => {
    if (field === "behavioralTracking") {
      setHasInteractedWithBehavioral(true);
    }
    setConsents((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleContinue = async () => {
    if (!hasInteractedWithBehavioral || submitting) return;

    setSubmitting(true);
    try {
      await updateConsent(consents);
      navigation.replace(nextRoute, nextParams);
    } catch (error) {
      console.error("[ConsentScreen] Error submitting consent:", error);
      // Navigate anyway — consent can be set later in settings
      navigation.replace(nextRoute, nextParams);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSettingsLink = () => {
    // This is informational — user hasn't entered the app yet
    // The tappable text just serves as reassurance
  };

  const canContinue = hasInteractedWithBehavioral;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background */}
      <LinearGradient
        colors={["#0B0F19", "#131628", "#0F172A"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Ambient glow orbs */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <LinearGradient
          colors={["#4C1D95", "#1E1B4B"]}
          style={styles.glowOrb1}
        />
        <LinearGradient
          colors={["#1E3A8A", "#0F172A"]}
          style={styles.glowOrb2}
        />
      </View>
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: "rgba(10, 15, 25, 0.6)" },
        ]}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Header */}
          <Animated.View
            style={[
              styles.header,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.shieldContainer,
                { transform: [{ scale: shieldAnim }] },
              ]}
            >
              <LinearGradient
                colors={["rgba(167, 139, 250, 0.2)", "rgba(96, 165, 250, 0.1)"]}
                style={styles.shieldBg}
              >
                <Shield
                  size={28}
                  color="#A78BFA"
                  strokeWidth={1.8}
                />
              </LinearGradient>
            </Animated.View>

            <Text style={styles.pageTitle}>Your Data, Your Choice</Text>
            <Text style={styles.pageSubtitle}>
              SnooSpace respects your privacy. Choose what you're comfortable
              sharing — you can always change this later.
            </Text>
          </Animated.View>

          {/* Consent Cards */}
          {CONSENT_CARDS.map((card, index) => {
            const IconComponent = card.icon;
            const isActive = consents[card.field];

            return (
              <Animated.View
                key={card.id}
                style={[
                  styles.cardWrapper,
                  {
                    opacity: cardAnims[index].opacity,
                    transform: [
                      { translateY: cardAnims[index].translateY },
                    ],
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => toggleConsent(card.field)}
                  style={[
                    styles.card,
                    isActive && styles.cardActive,
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: card.iconBg },
                        isActive && {
                          backgroundColor: card.iconColor + "25",
                        },
                      ]}
                    >
                      <IconComponent
                        size={20}
                        color={isActive ? card.iconColor : "#6B7280"}
                        strokeWidth={1.8}
                      />
                    </View>
                    <View style={styles.cardTitleBlock}>
                      <Text
                        style={[
                          styles.cardTitle,
                          isActive && { color: "#F9FAFB" },
                        ]}
                      >
                        {card.title}
                      </Text>
                      <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
                    </View>
                    <View
                      style={[
                        styles.toggle,
                        isActive && styles.toggleActive,
                      ]}
                    >
                      <Animated.View
                        style={[
                          styles.toggleKnob,
                          isActive && styles.toggleKnobActive,
                        ]}
                      />
                    </View>
                  </View>
                  <Text style={styles.cardDescription}>{card.description}</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}

          {/* CTA */}
          <Animated.View style={[styles.ctaContainer, { opacity: ctaAnim }]}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleContinue}
              disabled={!canContinue || submitting}
              style={styles.ctaWrapper}
            >
              <LinearGradient
                colors={
                  canContinue
                    ? ["#7C3AED", "#6D28D9"]
                    : ["#374151", "#1F2937"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.ctaButton,
                  !canContinue && styles.ctaDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.ctaText,
                    !canContinue && styles.ctaTextDisabled,
                  ]}
                >
                  {submitting ? "Setting up..." : "Continue"}
                </Text>
                {canContinue && (
                  <ChevronRight size={20} color="#FFFFFF" strokeWidth={2.5} />
                )}
              </LinearGradient>
            </TouchableOpacity>

            {!hasInteractedWithBehavioral && (
              <Text style={styles.ctaHint}>
                Toggle "Personalized Experience" to continue
              </Text>
            )}
          </Animated.View>

          {/* Footer */}
          <Animated.View style={[styles.footer, { opacity: ctaAnim }]}>
            <TouchableOpacity
              onPress={handleSettingsLink}
              activeOpacity={0.7}
            >
              <Text style={styles.footerText}>
                You can change these anytime in{" "}
                <Text style={styles.footerLink}>Settings → Privacy</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F19",
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },

  // Background orbs
  glowOrb1: {
    position: "absolute",
    top: -width * 0.3,
    left: -width * 0.3,
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: width * 0.45,
    opacity: 0.5,
    transform: [{ rotate: "25deg" }],
  },
  glowOrb2: {
    position: "absolute",
    bottom: -width * 0.2,
    right: -width * 0.3,
    width: width * 1.1,
    height: width * 1.1,
    borderRadius: width * 0.55,
    opacity: 0.35,
    transform: [{ rotate: "-15deg" }],
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: 28,
    gap: 12,
  },
  shieldContainer: {
    marginBottom: 8,
  },
  shieldBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.2)",
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: FONTS.black,
    color: "#F9FAFB",
    textAlign: "center",
    letterSpacing: -0.8,
  },
  pageSubtitle: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 12,
  },

  // Cards
  cardWrapper: {
    marginBottom: 14,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  cardActive: {
    backgroundColor: "rgba(124, 58, 237, 0.08)",
    borderColor: "rgba(124, 58, 237, 0.25)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardTitleBlock: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: "#D1D5DB",
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: "#6B7280",
  },
  cardDescription: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "#9CA3AF",
    lineHeight: 20,
    marginLeft: 52,
  },

  // Toggle
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: 3,
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: "#7C3AED",
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#6B7280",
    alignSelf: "flex-start",
  },
  toggleKnobActive: {
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-end",
  },

  // CTA
  ctaContainer: {
    marginTop: 12,
    alignItems: "center",
    gap: 10,
  },
  ctaWrapper: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
  },
  ctaTextDisabled: {
    color: "#6B7280",
  },
  ctaHint: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: "#6B7280",
    textAlign: "center",
  },

  // Footer
  footer: {
    marginTop: 20,
    alignItems: "center",
    paddingBottom: 8,
  },
  footerText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: "#6B7280",
    textAlign: "center",
  },
  footerLink: {
    color: "#A78BFA",
    fontFamily: FONTS.medium,
  },
});

export default ConsentScreen;
