// screens/LandingScreen.js
import React, { useState, useRef, useCallback, memo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Pressable,
  ImageBackground,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import { ArrowRight, Users, Building2, ArrowLeft } from "lucide-react-native";
import GlassBackButton from "../../components/GlassBackButton";
import { SvgXml } from "react-native-svg";
import { BlurView } from "expo-blur";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS, BORDER_RADIUS, SHADOWS, FONTS } from "../../constants/theme";
import HapticsService from "../../services/HapticsService";
import DynamicStatusBar from "../../components/DynamicStatusBar";
import DraftRecoveryModal from "../../components/modals/DraftRecoveryModal";
import {
  getSignupDraft,
  deleteSignupDraft,
  getResumeScreen as getMemberResumeScreen,
  getMemberResumeStack,
  getPeopleProfileResumeScreen,
  getCommunitySignupDraft,
  deleteCommunitySignupDraft,
  getCommunityResumeScreen,
  getCommunityResumeStack,
} from "../../utils/signupDraftManager";

const SnooSpaceIconSvg = `<svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M66.667 0.5C103.181 0.500189 132.833 31.9995 132.833 70.9219C132.833 109.844 103.181 141.344 66.667 141.344C30.1528 141.344 0.5 109.844 0.5 70.9219C0.500058 31.9993 30.1529 0.5 66.667 0.5Z" fill="#3565F2" stroke="#3D79F2"/>
<ellipse cx="133.333" cy="129.078" rx="66.6667" ry="70.922" fill="#CEF2F2"/>
<path d="M132.257 58.1671C132.963 62.3048 133.334 66.5674 133.334 70.9219C133.334 109.709 104.065 141.222 67.7419 141.833C67.0355 137.695 66.6667 133.433 66.6667 129.078C66.6667 90.2916 95.9342 58.779 132.257 58.1671Z" fill="#6BB3F2"/>
</svg>`;

const PARTICIPATION_ROLES = [
  {
    id: "member",
    title: "People",
    subtitle:
      "Join events, discover communities, and connect with people nearby.",
    quote: "Where every event is a chance to meet someone worth knowing.",
    buttonText: "Start Exploring",
    animation: require("../../assets/animations/gossipers.json"),
    icon: Users,
    accentColor: "#448AFF",
  },
  {
    id: "community",
    title: "Community",
    subtitle: "Host events, grow your audience, and track what's working.",
    quote: "The people worth gathering are out there. Bring them in.",
    buttonText: "Start Building",
    animation: require("../../assets/animations/Community svg.json"),
    icon: Building2,
    accentColor: "#06D6A0",
  },
];

// ─── Animated Card ────────────────────────────────────────────────────────────
const AnimatedCard = memo(
  ({
    item,
    index,
    cardBaseHeight,
    selectedIndex,
    onSelect,
    onContinue,
    cardWidth,
  }) => {
    const isSelected = selectedIndex === index;
    const isOtherSelected = selectedIndex !== -1 && selectedIndex !== index;
    const IconComponent = item.icon;

    const cardStyle = useAnimatedStyle(() => {
      const currentScale = withTiming(isOtherSelected ? 0.88 : 1, {
        duration: 350,
      });
      const currentOpacity = withTiming(isOtherSelected ? 0.75 : 1, {
        duration: 350,
      });
      const currentHeight = withTiming(
        isSelected ? cardBaseHeight + 130 : cardBaseHeight,
        { duration: 420 },
      );
      return {
        transform: [{ scale: currentScale }],
        opacity: currentOpacity,
        height: currentHeight,
        zIndex: isSelected ? 10 : 1,
      };
    });

    const expandedAreaStyle = useAnimatedStyle(() => ({
      opacity: withTiming(isSelected ? 1 : 0, {
        duration: 280,
        easing: Easing.out(Easing.quad),
      }),
      transform: [
        {
          translateY: withTiming(isSelected ? 0 : 16, {
            duration: 380,
            easing: Easing.out(Easing.cubic),
          }),
        },
      ],
      height: withTiming(isSelected ? 140 : 0, {
        duration: 420,
        easing: Easing.bezier(0.33, 1, 0.68, 1),
      }),
      overflow: "hidden",
    }));

    return (
      <Animated.View
        style={[
          styles.cardContainer,
          { width: cardWidth, marginHorizontal: 8 },
          cardStyle,
        ]}
      >
        {/* ── Outer glow ring — colored border + deep shadow ── */}
        <View
          style={[
            styles.cardGlowRing,
            {
              borderColor: isSelected
                ? item.accentColor + "55"
                : "rgba(255,255,255,0.18)",
            },
          ]}
        >
          <Pressable
            onPress={() => onSelect(index)}
            style={styles.cardPressable}
          >
            <View style={styles.cardInner}>
              {/* Lottie Background */}
              <LottieView
                source={item.animation}
                autoPlay
                loop
                style={[
                  styles.lottieAnimation,
                  item.id === "member" && styles.gossipersAnimation,
                ]}
                resizeMode="cover"
              />

              {/* ── Cinematic gradient — 4-stop, stays clear longer ── */}
              <LinearGradient
                colors={[
                  "transparent",
                  "rgba(8,10,20,0.12)",
                  "rgba(8,10,20,0.58)",
                  "rgba(8,10,20,0.92)",
                ]}
                locations={[0.25, 0.5, 0.72, 1]}
                style={styles.cardGradientOverlay}
              />

              {/* ── Card Content ── */}
              <View style={styles.cardContent}>
                {/* ── Frosted glass header panel ── */}
                <BlurView intensity={22} tint="dark" style={styles.glassPanel}>
                  {/* Accent hairline on top of glass panel */}
                  <View
                    style={[
                      styles.glassPanelAccentLine,
                      { backgroundColor: item.accentColor + "60" },
                    ]}
                  />

                  <View style={styles.cardHeaderRow}>
                    {/* Icon badge — tinted with accent */}
                    <View
                      style={[
                        styles.cardIconContainer,
                        {
                          backgroundColor: item.accentColor + "28",
                          borderColor: item.accentColor + "55",
                        },
                      ]}
                    >
                      <IconComponent
                        size={20}
                        color={COLORS.surface}
                        strokeWidth={2.2}
                      />
                    </View>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                  </View>

                  {/* Collapsed subtitle */}
                  {!isSelected && (
                    <View style={styles.cardSubtitleClipContainer}>
                      <Text
                        style={styles.cardSubtitleCollapsed}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {item.subtitle}
                      </Text>
                    </View>
                  )}
                </BlurView>

                {/* Expanded area — outside glass panel, below it */}
                {isSelected && (
                  <Animated.View
                    style={[expandedAreaStyle, styles.expandedArea]}
                  >
                    {item.quote ? (
                      <Text style={styles.cardQuoteExpanded}>{item.quote}</Text>
                    ) : (
                      <Text style={styles.cardSubtitleExpanded}>
                        {item.subtitle}
                      </Text>
                    )}
                    <TouchableOpacity
                      activeOpacity={0.82}
                      onPress={onContinue}
                      style={[
                        styles.cardContinueButton,
                        {
                          backgroundColor: item.accentColor,
                          shadowColor: item.accentColor,
                        },
                      ]}
                    >
                      <Text style={styles.cardContinueButtonText}>
                        {item.buttonText}
                      </Text>
                      <ArrowRight
                        size={18}
                        color={COLORS.surface}
                        strokeWidth={2.5}
                      />
                    </TouchableOpacity>
                  </Animated.View>
                )}
              </View>

              {/* Blur overlay for de-emphasised cards */}
              {isOtherSelected && Platform.OS !== "web" && (
                <BlurView
                  intensity={4}
                  style={StyleSheet.absoluteFill}
                  tint="light"
                />
              )}
            </View>
          </Pressable>
        </View>
      </Animated.View>
    );
  },
);

const LandingScreen = ({ navigation, route }) => {
  const fromSwitcher = route?.params?.fromSwitcher || false;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const scrollX = useSharedValue(0);
  const flatListRef = useRef(null);

  // Draft recovery state
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [activeDraft, setActiveDraft] = useState(null); // { type: "Member"|"Community", email: string, step: string }
  // Prevent draft modal from re-appearing when navigating back from signup flow
  const draftModalShown = useRef(false);

  // Check for any existing drafts when landing screen appears
  useFocusEffect(
    useCallback(() => {
      // Only show draft modal once per session to avoid re-showing it
      // when the user navigates back from within the signup flow
      if (draftModalShown.current) return;

      const checkForDrafts = async () => {
        try {
          // Check both drafts
          const [communityDraft, memberDraft] = await Promise.all([
            getCommunitySignupDraft(),
            getSignupDraft(),
          ]);

          // Priority: Community draft if exists, else Member draft
          // (Or could compare lastUpdatedAt, but a simple priority is fine)
          if (communityDraft && communityDraft.data?.email) {
            setActiveDraft({
              type: "Community",
              email: communityDraft.data.email,
              step: communityDraft.currentStep,
              data: communityDraft.data,
            });
            draftModalShown.current = true;
            setShowDraftModal(true);
          } else if (memberDraft && memberDraft.data?.email) {
            setActiveDraft({
              type: "Member",
              email: memberDraft.data.email,
              step: memberDraft.currentStep,
              data: memberDraft.data,
            });
            draftModalShown.current = true;
            setShowDraftModal(true);
          } else if (memberDraft && memberDraft.data?.fromCommunitySignup) {
            // People-profile draft: no email (flow started from community account)
            setActiveDraft({
              type: "Member",
              // Show a friendly label since there's no email in this flow
              email: "your People profile",
              step: memberDraft.currentStep,
              data: memberDraft.data,
              fromCommunitySignup: true,
            });
            draftModalShown.current = true;
            setShowDraftModal(true);
          }
        } catch (e) {
          console.log("[LandingScreen] Draft check failed:", e.message);
        }
      };

      // Delay slightly to not interrupt splash screen transition
      const timer = setTimeout(checkForDrafts, 600);
      return () => clearTimeout(timer);
    }, []),
  );

  const handleContinueDraft = () => {
    HapticsService.triggerImpactLight();
    setShowDraftModal(false);

    if (!activeDraft) return;

    if (activeDraft.type === "Community") {
      const screenStack = getCommunityResumeStack(
        activeDraft.step,
        activeDraft.data || {},
      );
      const sharedParams = {
        ...activeDraft.data,
        isResumingDraft: true,
      };
      console.log(
        "[LandingScreen] Resuming community draft. Stack:",
        screenStack,
      );
      navigation.reset({
        index: 0,
        routes: [
          {
            name: "CommunitySignup",
            state: {
              index: screenStack.length - 1,
              routes: screenStack.map((screenName, i) => ({
                name: screenName,
                params: { ...sharedParams, isResumingDraft: true },
              })),
            },
          },
        ],
      });
    } else if (activeDraft.fromCommunitySignup) {
      // People-profile draft: the community session is still active.
      if (activeDraft.step === "PeopleProfilePrompt") {
        // User hadn't chosen "Set up now" yet — return to the prompt screen.
        console.log(
          "[LandingScreen] People-profile draft at PeopleProfilePrompt → returning to prompt screen",
        );
        navigation.navigate("PeopleProfilePromptScreen", {
          prefillRecovery: activeDraft.data?.prefill || {},
        });
      } else {
        // User had started filling in the member form — resume there.
        const resumeScreen = getPeopleProfileResumeScreen(activeDraft.step);
        console.log(
          "[LandingScreen] Resuming People-profile draft at:",
          resumeScreen,
        );
        navigation.navigate("MemberSignup", {
          screen: resumeScreen,
          params: {
            ...activeDraft.data,
            prefill: activeDraft.data?.prefill || {},
            fromCommunitySignup: true,
            isResumingDraft: true,
          },
        });
      }
    } else {
      // Regular member draft — rebuild the full nested-navigator stack so
      // every back button has proper history (mirrors the Community approach).
      const screenStack = getMemberResumeStack(activeDraft.step);
      const sharedParams = {
        ...activeDraft.data,
        isResumingDraft: true,
      };
      console.log(
        "[LandingScreen] Resuming member draft. Stack:",
        screenStack,
      );
      navigation.reset({
        index: 0,
        routes: [
          {
            name: "MemberSignup",
            state: {
              index: screenStack.length - 1,
              routes: screenStack.map((screenName) => ({
                name: screenName,
                params: { ...sharedParams },
              })),
            },
          },
        ],
      });
    }
  };

  const handleDiscardDraft = async () => {
    HapticsService.triggerImpactLight();
    setShowDraftModal(false);

    if (!activeDraft) return;

    if (activeDraft.type === "Community") {
      await deleteCommunitySignupDraft();
    } else {
      await deleteSignupDraft();
    }
    setActiveDraft(null);
    // Reset so a fresh draft can be shown if user starts again
    draftModalShown.current = false;
  };

  const CARD_WIDTH = width * 0.85;
  const CARD_SPACING = 16;
  const ITEM_SIZE = CARD_WIDTH + CARD_SPACING;
  const CARD_BASE_HEIGHT = height * 0.42;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const handleSelect = useCallback(
    (index) => {
      HapticsService.triggerImpactLight();
      setSelectedIndex((prev) => {
        if (prev === index) return -1;
        flatListRef.current?.scrollToOffset({
          offset: index * ITEM_SIZE,
          animated: true,
        });
        return index;
      });
    },
    [ITEM_SIZE],
  );

  const handleContinue = useCallback(() => {
    if (selectedIndex === -1) return;
    const roleId = PARTICIPATION_ROLES[selectedIndex].id;
    HapticsService.triggerImpactLight();
    if (roleId === "member") {
      navigation.navigate("MemberSignup", { selectedRole: roleId });
    } else {
      navigation.navigate("CommunitySignup", { selectedRole: roleId });
    }
  }, [selectedIndex, navigation]);

  const handleLoginPress = () => {
    HapticsService.triggerImpactLight();
    navigation.navigate("Login");
  };

  const renderCard = useCallback(
    ({ item, index }) => (
      <AnimatedCard
        key={item.id}
        item={item}
        index={index}
        cardBaseHeight={CARD_BASE_HEIGHT}
        selectedIndex={selectedIndex}
        onSelect={handleSelect}
        onContinue={handleContinue}
        cardWidth={CARD_WIDTH}
      />
    ),
    [selectedIndex, CARD_BASE_HEIGHT, CARD_WIDTH, handleSelect, handleContinue],
  );

  return (
    <ImageBackground
      source={require("../../assets/wave.png")}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.3 }}
      resizeMode="cover"
      blurRadius={10}
    >
      <View style={styles.screenContainer}>
        <DynamicStatusBar style="dark-content" />
        <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
          {/* ── Header ── */}
          <View style={styles.headerContainer}>
            {fromSwitcher && (
              <GlassBackButton
                style={styles.closeButtonAbsolute}
                onPress={() => navigation.goBack()}
              />
            )}
            <View style={styles.logoContainer}>
              <SvgXml xml={SnooSpaceIconSvg} width={48} height={48} />
            </View>
            <Text style={styles.headerTitle}>
              <Text style={{ color: COLORS.textPrimary }}>
                Welcome to{"\n"}
              </Text>
              <Text style={{ color: COLORS.primary }}>SnooSpace</Text>
            </Text>
            <Text style={styles.headerSubtitle}>Step into your experience</Text>
          </View>

          {/* ── Carousel ── */}
          <View style={styles.carouselContainer}>
            <Animated.FlatList
              ref={flatListRef}
              data={PARTICIPATION_ROLES}
              keyExtractor={(item) => item.id}
              renderItem={renderCard}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={ITEM_SIZE}
              decelerationRate="fast"
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              contentContainerStyle={{
                paddingHorizontal: (width - ITEM_SIZE) / 2,
                alignItems: "center",
                overflow: "visible",
              }}
              style={{ overflow: "visible" }}
            />
          </View>

          {/* ── Pagination Dots ── */}
          <View style={styles.paginationContainer}>
            {PARTICIPATION_ROLES.map((_, i) => {
              // eslint-disable-next-line react-hooks/rules-of-hooks
              const dotStyle = useAnimatedStyle(() => {
                const progress = scrollX.value / ITEM_SIZE;
                const distanceFromActive = Math.abs(progress - i);
                const dotWidth = withTiming(distanceFromActive < 0.5 ? 24 : 8, {
                  duration: 250,
                });
                const opacity = withTiming(distanceFromActive < 0.5 ? 1 : 0.3, {
                  duration: 250,
                });
                const backgroundColor =
                  distanceFromActive < 0.5 ? COLORS.primary : COLORS.textMuted;
                return { width: dotWidth, opacity, backgroundColor };
              });
              return <Animated.View key={i} style={[styles.dot, dotStyle]} />;
            })}
          </View>

          {/* ── Footer ── */}
          <View
            style={[
              styles.footerContainer,
              { bottom: insets.bottom > 0 ? insets.bottom + 32 : 56 },
            ]}
          >
            <View style={styles.loginPromptContainer}>
              <Text style={styles.loginPromptText}>
                Already have an account?{" "}
              </Text>
              <TouchableOpacity
                onPress={handleLoginPress}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                <Text style={styles.loginLinkText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>

      {activeDraft && (
        <DraftRecoveryModal
          visible={showDraftModal}
          draftEmail={
            activeDraft.fromCommunitySignup ? null : activeDraft.email
          }
          draftType={activeDraft.type}
          isPeopleProfile={!!activeDraft.fromCommunitySignup}
          onContinue={handleContinueDraft}
          onDiscard={handleDiscardDraft}
        />
      )}
    </ImageBackground>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.background,
  },
  screenContainer: { flex: 1, backgroundColor: "transparent" },
  safeArea: { flex: 1 },

  // ── Header ──
  headerContainer: {
    alignItems: "center",
    paddingTop: 24,
    paddingHorizontal: 24,
    position: "relative",
  },
  closeButtonAbsolute: {
    position: "absolute",
    top: 24,
    left: 24,
    zIndex: 10,
  },
  logoContainer: { marginBottom: 20 },
  headerTitle: {
    fontFamily: FONTS.black,
    fontSize: 34,
    textAlign: "center",
    lineHeight: 38,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
  },

  // ── Carousel ──
  carouselContainer: {
    justifyContent: "center",
    marginTop: 44,
  },
  cardContainer: {
    backgroundColor: "transparent",
  },

  // ── Glow ring — NEW: colored border + deep shadow ──
  cardGlowRing: {
    flex: 1,
    borderRadius: 34,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.32,
    shadowRadius: 32,
    elevation: 20,
  },

  cardPressable: { flex: 1 },
  cardInner: {
    flex: 1,
    borderRadius: 32,
    backgroundColor: COLORS.surface,
    overflow: "hidden",
  },

  lottieAnimation: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  gossipersAnimation: {
    transform: [{ scale: 1.1 }],
    marginTop: -20,
    marginLeft: 145,
  },

  // ── Cinematic gradient — NEW: 4-stop ──
  cardGradientOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "100%",
  },

  cardContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
  },

  // ── Frosted glass panel — NEW ──
  glassPanel: {
    borderRadius: 20,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  glassPanelAccentLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
  },

  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  // ── Icon badge — NEW: accent tinted border ──
  cardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  cardTitle: {
    fontFamily: FONTS.primary,
    fontSize: 26,
    color: COLORS.surface,
    letterSpacing: -0.5,
  },
  cardSubtitleClipContainer: {
    marginTop: 4,
    overflow: "hidden",
    height: 42,
    width: "100%",
  },
  cardSubtitleCollapsed: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    width: "100%",
  },

  // Expanded area — sits below glass panel
  expandedArea: {
    paddingHorizontal: 4,
    paddingTop: 12,
  },
  cardSubtitleExpanded: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 22,
    marginBottom: 8,
  },
  cardQuoteExpanded: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    fontStyle: "italic",
    color: "rgba(255,255,255,0.9)",
    marginBottom: 16,
    lineHeight: 22,
  },

  // ── CTA button — accent color driven by role ──
  cardContinueButton: {
    borderRadius: BORDER_RADIUS.pill,
    height: 50,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  cardContinueButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.surface,
    marginRight: 8,
  },

  // ── Pagination ──
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },

  // ── Footer ──
  footerContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: 24,
  },
  loginPromptContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginPromptText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  loginLinkText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.primary,
  },
});

export default LandingScreen;
