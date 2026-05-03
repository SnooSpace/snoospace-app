/**
 * ConsentScreen — Role-Aware
 *
 * People (member):  3 consent toggles
 * Community:        4 consent toggles (People + Event Audience Intelligence)
 * Sponsor/Brand:    Acknowledgment-only screen — no toggles, single CTA
 *
 * DPDP Act 2023 compliance: explicit informed consent before collecting
 * and processing behavioral data.
 *
 * Typography: FONTS.black (page title only), FONTS.semiBold (card titles/CTA),
 *             FONTS.regular (descriptions), FONTS.medium (subtitles/metadata)
 * Icons: All from lucide-react-native
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  StatusBar, Animated, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  Sparkles, Handshake, Users, BarChart2,
  ChevronRight, Shield, CheckCircle,
} from "lucide-react-native";
import { FONTS } from "../../constants/theme";
import { updateConsent } from "../../api/privacy";
import { getActiveAccount } from "../../api/auth";

const { width } = Dimensions.get("window");

// ── Consent card config by role ───────────────────────────────────────────────

const PEOPLE_CARDS = [
  {
    id: "behavioral",
    icon: Sparkles, iconColor: "#A78BFA", iconBg: "rgba(167,139,250,0.15)",
    title: "Personalized Experience",
    subtitle: "Help SnooSpace learn what you love",
    description:
      "We track which events you attend and content you engage with to personalize your experience. Your data is never sold — it stays on SnooSpace.",
    field: "behavioralTracking",
    required: true,
  },
  {
    id: "brand",
    icon: Handshake, iconColor: "#60A5FA", iconBg: "rgba(96,165,250,0.15)",
    title: "Brand Audience Inclusion",
    subtitle: "Appear in brand audience insights",
    description:
      "Allow your aggregated activity to contribute to creator audience reports that brands access. You are never individually identified — only counted as part of a group.",
    field: "brandTargeting",
  },
  {
    id: "dataSharing",
    icon: Users, iconColor: "#34D399", iconBg: "rgba(52,211,153,0.15)",
    title: "Community Insights",
    subtitle: "Contribute to community intelligence",
    description:
      "Your activity helps community organisers understand who their audience is. Always aggregated, never individual.",
    field: "dataSharing",
  },
];

const COMMUNITY_EXTRA_CARD = {
  id: "eventAudience",
  icon: BarChart2, iconColor: "#F59E0B", iconBg: "rgba(245,158,11,0.15)",
  title: "Event Audience Intelligence",
  subtitle: "Let brands see your event audience quality",
  description:
    "Allow brands to view aggregated audience quality reports for your events — who attends, what tier they fall in, what categories they care about. Individual attendee data is never shared.",
  field: "eventAudienceIntelligence",
};

const COMMUNITY_CARDS = [...PEOPLE_CARDS, COMMUNITY_EXTRA_CARD];

// ── Sponsor Acknowledgment bullets ───────────────────────────────────────────

const SPONSOR_BULLETS = [
  "Use match data only within SnooSpace for campaign planning",
  "Not attempt to re-identify individual users from aggregated reports",
  "Not share audience intelligence data with third parties outside SnooSpace",
];

// ─────────────────────────────────────────────────────────────────────────────

const ConsentScreen = ({ navigation, route }) => {
  const [accountType, setAccountType] = useState(null); // null = loading
  const [consents, setConsents] = useState({
    behavioralTracking: false, brandTargeting: false,
    dataSharing: false, eventAudienceIntelligence: false,
  });
  const [hasInteractedWithBehavioral, setHasInteractedWithBehavioral] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const nextRoute = route?.params?.nextRoute || "MemberHome";
  const nextParams = route?.params?.nextParams || {};

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const shieldAnim = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;

  // Card anims — sized for max (4 community cards)
  const cardAnims = useRef(
    Array.from({ length: 4 }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(30),
    }))
  ).current;

  useEffect(() => {
    getActiveAccount().then((acct) => {
      setAccountType(acct?.type || "member");
    }).catch(() => setAccountType("member"));
  }, []);

  useEffect(() => {
    if (accountType === null) return;

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();

    Animated.spring(shieldAnim, {
      toValue: 1, tension: 50, friction: 6, delay: 200, useNativeDriver: true,
    }).start();

    const cards = accountType === "community" ? COMMUNITY_CARDS : PEOPLE_CARDS;
    cards.forEach((_, index) => {
      Animated.parallel([
        Animated.timing(cardAnims[index].opacity, {
          toValue: 1, duration: 500, delay: 400 + index * 150, useNativeDriver: true,
        }),
        Animated.spring(cardAnims[index].translateY, {
          toValue: 0, tension: 60, friction: 10, delay: 400 + index * 150, useNativeDriver: true,
        }),
      ]).start();
    });

    Animated.timing(ctaAnim, {
      toValue: 1, duration: 500, delay: 900, useNativeDriver: true,
    }).start();
  }, [accountType]);

  const toggleConsent = (field) => {
    if (field === "behavioralTracking") setHasInteractedWithBehavioral(true);
    setConsents((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const navigate = () => navigation.replace(nextRoute, nextParams);

  const handleContinue = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await updateConsent(consents);
    } catch (e) {
      console.warn("[ConsentScreen] consent save error:", e);
    } finally {
      setSubmitting(false);
      navigate();
    }
  };

  const handleSponsorAcknowledge = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await updateConsent({ brandDataAcknowledged: true });
    } catch (e) {
      console.warn("[ConsentScreen] sponsor ack error:", e);
    } finally {
      setSubmitting(false);
      navigate();
    }
  };

  const canContinue = hasInteractedWithBehavioral;
  const cards = accountType === "community" ? COMMUNITY_CARDS : PEOPLE_CARDS;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (accountType === null) {
    return <View style={styles.container}><StatusBar barStyle="light-content" /></View>;
  }

  // ── Sponsor / Brand — Acknowledgment Screen ────────────────────────────────
  if (accountType === "sponsor") {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={["#0B0F19", "#131628", "#0F172A"]} style={StyleSheet.absoluteFillObject} />
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <LinearGradient colors={["#4C1D95", "#1E1B4B"]} style={styles.glowOrb1} />
          <LinearGradient colors={["#1E3A8A", "#0F172A"]} style={styles.glowOrb2} />
        </View>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
            <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <Animated.View style={[styles.shieldContainer, { transform: [{ scale: shieldAnim }] }]}>
                <LinearGradient colors={["rgba(167,139,250,0.2)", "rgba(96,165,250,0.1)"]} style={styles.shieldBg}>
                  <Shield size={28} color="#A78BFA" strokeWidth={1.8} />
                </LinearGradient>
              </Animated.View>
              <Text style={styles.pageTitle}>How audience data works on SnooSpace</Text>
              <Text style={styles.pageSubtitle}>
                The creator and community insights you see are built from aggregated, anonymised
                behavioral data. You are seeing group-level patterns — not individual user profiles.
              </Text>
            </Animated.View>

            <Animated.View style={[styles.sponsorCard, { opacity: ctaAnim }]}>
              <Text style={styles.sponsorCardTitle}>By using SnooSpace's audience intelligence tools you agree to:</Text>
              {SPONSOR_BULLETS.map((bullet, i) => (
                <View key={i} style={styles.bulletRow}>
                  <CheckCircle size={16} color="#A78BFA" strokeWidth={2} style={{ flexShrink: 0 }} />
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </Animated.View>

            <Animated.View style={[styles.ctaContainer, { opacity: ctaAnim }]}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSponsorAcknowledge}
                disabled={submitting}
                style={styles.ctaWrapper}
              >
                <LinearGradient
                  colors={["#7C3AED", "#6D28D9"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.ctaButton}
                >
                  <Text style={styles.ctaText}>
                    {submitting ? "Confirming..." : "I understand and agree"}
                  </Text>
                  <ChevronRight size={20} color="#FFFFFF" strokeWidth={2.5} />
                </LinearGradient>
              </TouchableOpacity>
              <Text style={styles.sponsorNote}>
                You cannot access audience data without this acknowledgment.
              </Text>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // ── People / Community — Toggle Consent Screen ─────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#0B0F19", "#131628", "#0F172A"]} style={StyleSheet.absoluteFillObject} />
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <LinearGradient colors={["#4C1D95", "#1E1B4B"]} style={styles.glowOrb1} />
        <LinearGradient colors={["#1E3A8A", "#0F172A"]} style={styles.glowOrb2} />
      </View>
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(10,15,25,0.6)" }]} pointerEvents="none" />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
          <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Animated.View style={[styles.shieldContainer, { transform: [{ scale: shieldAnim }] }]}>
              <LinearGradient colors={["rgba(167,139,250,0.2)", "rgba(96,165,250,0.1)"]} style={styles.shieldBg}>
                <Shield size={28} color="#A78BFA" strokeWidth={1.8} />
              </LinearGradient>
            </Animated.View>
            <Text style={styles.pageTitle}>Your Data, Your Choice</Text>
            <Text style={styles.pageSubtitle}>
              SnooSpace respects your privacy. Choose what you're comfortable sharing — you can always change this later.
            </Text>
          </Animated.View>

          {cards.map((card, index) => {
            const Icon = card.icon;
            const isActive = consents[card.field];
            return (
              <Animated.View
                key={card.id}
                style={[styles.cardWrapper, {
                  opacity: cardAnims[index].opacity,
                  transform: [{ translateY: cardAnims[index].translateY }],
                }]}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => toggleConsent(card.field)}
                  style={[styles.card, isActive && styles.cardActive]}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.iconContainer, { backgroundColor: isActive ? card.iconColor + "25" : card.iconBg }]}>
                      <Icon size={20} color={isActive ? card.iconColor : "#6B7280"} strokeWidth={1.8} />
                    </View>
                    <View style={styles.cardTitleBlock}>
                      <Text style={[styles.cardTitle, isActive && { color: "#F9FAFB" }]}>{card.title}</Text>
                      <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
                    </View>
                    <View style={[styles.toggle, isActive && styles.toggleActive]}>
                      <View style={[styles.toggleKnob, isActive && styles.toggleKnobActive]} />
                    </View>
                  </View>
                  <Text style={styles.cardDescription}>{card.description}</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}

          <Animated.View style={[styles.ctaContainer, { opacity: ctaAnim }]}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleContinue}
              disabled={!canContinue || submitting}
              style={styles.ctaWrapper}
            >
              <LinearGradient
                colors={canContinue ? ["#7C3AED", "#6D28D9"] : ["#374151", "#1F2937"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.ctaButton, !canContinue && styles.ctaDisabled]}
              >
                <Text style={[styles.ctaText, !canContinue && styles.ctaTextDisabled]}>
                  {submitting ? "Setting up..." : "Continue"}
                </Text>
                {canContinue && <ChevronRight size={20} color="#FFFFFF" strokeWidth={2.5} />}
              </LinearGradient>
            </TouchableOpacity>
            {!hasInteractedWithBehavioral && (
              <Text style={styles.ctaHint}>Toggle "Personalized Experience" to continue</Text>
            )}
          </Animated.View>

          <Animated.View style={[styles.footer, { opacity: ctaAnim }]}>
            <Text style={styles.footerText}>
              You can change these anytime in{" "}
              <Text style={styles.footerLink}>Settings → Privacy</Text>
            </Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0F19" },
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },

  glowOrb1: {
    position: "absolute", top: -width * 0.3, left: -width * 0.3,
    width: width * 0.9, height: width * 0.9, borderRadius: width * 0.45,
    opacity: 0.5, transform: [{ rotate: "25deg" }],
  },
  glowOrb2: {
    position: "absolute", bottom: -width * 0.2, right: -width * 0.3,
    width: width * 1.1, height: width * 1.1, borderRadius: width * 0.55,
    opacity: 0.35, transform: [{ rotate: "-15deg" }],
  },

  // Header
  header: { alignItems: "center", marginBottom: 28, gap: 12 },
  shieldContainer: { marginBottom: 8 },
  shieldBg: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(167,139,250,0.2)",
  },
  pageTitle: {
    fontSize: 26, fontFamily: FONTS.black, color: "#F9FAFB",
    textAlign: "center", letterSpacing: -0.8,
  },
  pageSubtitle: {
    fontSize: 15, fontFamily: FONTS.regular, color: "#9CA3AF",
    textAlign: "center", lineHeight: 22, paddingHorizontal: 8,
  },

  // Cards (People / Community)
  cardWrapper: { marginBottom: 14 },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16,
    padding: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  cardActive: { backgroundColor: "rgba(124,58,237,0.08)", borderColor: "rgba(124,58,237,0.25)" },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  iconContainer: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  cardTitleBlock: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontFamily: FONTS.semiBold, color: "#D1D5DB" },
  cardSubtitle: { fontSize: 13, fontFamily: FONTS.medium, color: "#6B7280" },
  cardDescription: {
    fontSize: 14, fontFamily: FONTS.regular, color: "#9CA3AF",
    lineHeight: 20, marginLeft: 52,
  },
  toggle: {
    width: 44, height: 26, borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.1)", padding: 3, justifyContent: "center",
  },
  toggleActive: { backgroundColor: "#7C3AED" },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#6B7280", alignSelf: "flex-start" },
  toggleKnobActive: { backgroundColor: "#FFFFFF", alignSelf: "flex-end" },

  // Sponsor card
  sponsorCard: {
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16,
    padding: 20, borderWidth: 1, borderColor: "rgba(167,139,250,0.15)",
    marginBottom: 24, gap: 14,
  },
  sponsorCardTitle: {
    fontSize: 15, fontFamily: FONTS.semiBold, color: "#D1D5DB", lineHeight: 22,
  },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bulletText: {
    flex: 1, fontSize: 14, fontFamily: FONTS.regular, color: "#9CA3AF", lineHeight: 22,
  },
  sponsorNote: {
    fontSize: 12, fontFamily: FONTS.medium, color: "#6B7280",
    textAlign: "center", marginTop: 8, lineHeight: 18,
  },

  // CTA
  ctaContainer: { marginTop: 12, alignItems: "center", gap: 10 },
  ctaWrapper: { width: "100%", borderRadius: 14, overflow: "hidden" },
  ctaButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 16, gap: 8,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { fontSize: 16, fontFamily: FONTS.semiBold, color: "#FFFFFF" },
  ctaTextDisabled: { color: "#6B7280" },
  ctaHint: { fontSize: 13, fontFamily: FONTS.medium, color: "#6B7280", textAlign: "center" },

  // Footer
  footer: { marginTop: 20, alignItems: "center", paddingBottom: 8 },
  footerText: { fontSize: 13, fontFamily: FONTS.regular, color: "#6B7280", textAlign: "center" },
  footerLink: { color: "#A78BFA", fontFamily: FONTS.medium },
});

export default ConsentScreen;
