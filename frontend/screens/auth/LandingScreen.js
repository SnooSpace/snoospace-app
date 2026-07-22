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
  Image,
} from "react-native";
import { FlatList as GHFlatList } from "react-native-gesture-handler";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowRight,
  Users,
  Building2,
  Sparkles,
  UserPlus,
  MessageCircle,
  Calendar,
  Handshake,
  Sparkle,
} from "lucide-react-native";
import GlassBackButton from "../../components/GlassBackButton";
import { SvgXml } from "react-native-svg";
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

// RNGH-compatible animated FlatList — ensures carousel swipe gestures
// win over the stack navigator's horizontal swipe-back recogniser.
const AnimatedGHFlatList = Animated.createAnimatedComponent(GHFlatList);
const AnimatedImage = Animated.createAnimatedComponent(Image);

const SnooSpaceIconSvg = `<svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M66.667 0.5C103.181 0.500189 132.833 31.9995 132.833 70.9219C132.833 109.844 103.181 141.344 66.667 141.344C30.1528 141.344 0.5 109.844 0.5 70.9219C0.500058 31.9993 30.1529 0.5 66.667 0.5Z" fill="#3565F2" stroke="#3D79F2"/>
<ellipse cx="133.333" cy="129.078" rx="66.6667" ry="70.922" fill="#CEF2F2"/>
<path d="M132.257 58.1671C132.963 62.3048 133.334 66.5674 133.334 70.9219C133.334 109.709 104.065 141.222 67.7419 141.833C67.0355 137.695 66.6667 133.433 66.6667 129.078C66.6667 90.2916 95.9342 58.779 132.257 58.1671Z" fill="#6BB3F2"/>
</svg>`;

const PARTICIPATION_ROLES = [
  {
    id: "member",
    title: "People",
    collapsedSubtitle:
      "Meet real people, join events, and connect over shared interests.",
    subtitle:
      "Join events, discover communities, and connect with people nearby.",
    buttonText: "Start Exploring",
    image: require("../../assets/Illustrations/People.webp"),
    icon: Users,
    accentColor: "#7C3AED",
    badgeBg: "#F0EBFF",
    buttonGradient: ["#8B5CF6", "#7C3AED"],
    features: [
      {
        icon: UserPlus,
        iconBg: "#F3E8FF",
        iconColor: "#8B5CF6",
        title: "Meet New People",
        desc: "Find like-minded people who share your interests.",
      },
      {
        icon: Sparkle,
        iconBg: "#DCFCE7",
        iconColor: "#22C55E",
        title: "Join & Participate",
        desc: "Engage in events and activities happening around you.",
      },
      {
        icon: MessageCircle,
        iconBg: "#FEF3C7",
        iconColor: "#F59E0B",
        title: "Build Connections",
        desc: "Start conversations and create lasting connections.",
      },
    ],
  },
  {
    id: "community",
    title: "Community",
    collapsedSubtitle:
      "Host events, grow your audience, and build a thriving community.",
    subtitle:
      "Host events, grow your audience, and build a thriving community.",
    buttonText: "Start Building",
    image: require("../../assets/Illustrations/Community.webp"),
    icon: Users,
    accentColor: "#FF5B37",
    badgeBg: "#FFF0E6",
    buttonGradient: ["#FF7A59", "#FF5252"],
    features: [
      {
        icon: Calendar,
        iconBg: "#FFEDD5",
        iconColor: "#EA580C",
        title: "Create & Host",
        desc: "Bring your ideas to life with events.",
      },
      {
        icon: Users,
        iconBg: "#DCFCE7",
        iconColor: "#22C55E",
        title: "Engage & Grow",
        desc: "Grow your audience and increase impact.",
      },
      {
        icon: Handshake,
        iconBg: "#FFEDD5",
        iconColor: "#EA580C",
        title: "Collaborate",
        desc: "Partner with others and do more together.",
      },
    ],
  },
];

// ─── Animated Card ────────────────────────────────────────────────────────────
const AnimatedCard = memo(
  ({
    item,
    index,
    cardBaseHeight,
    cardExpandedHeight,
    selectedIndex,
    onSelect,
    onContinue,
    cardWidth,
  }) => {
    const isSelected = selectedIndex === index;
    const isOtherSelected = selectedIndex !== -1 && selectedIndex !== index;
    const IconComponent = item.icon;

    const cardStyle = useAnimatedStyle(() => {
      const currentScale = withTiming(isOtherSelected ? 0.9 : 1, {
        duration: 350,
      });
      const currentOpacity = withTiming(isOtherSelected ? 0.75 : 1, {
        duration: 350,
      });
      const currentHeight = withTiming(
        isSelected ? cardExpandedHeight : cardBaseHeight,
        {
          duration: 420,
          easing: Easing.bezier(0.25, 1, 0.5, 1),
        },
      );
      const translateY = withTiming(isSelected ? 0 : 28, {
        duration: 420,
        easing: Easing.bezier(0.25, 1, 0.5, 1),
      });

      return {
        transform: [{ scale: currentScale }, { translateY }],
        opacity: currentOpacity,
        height: currentHeight,
        zIndex: isSelected ? 10 : 1,
      };
    });

    const heroImageStyle = useAnimatedStyle(() => {
      const targetHeight = withTiming(
        isSelected ? Math.round(cardBaseHeight * 0.48) : cardBaseHeight,
        {
          duration: 420,
          easing: Easing.bezier(0.25, 1, 0.5, 1),
        },
      );
      return {
        height: targetHeight,
      };
    });

    const collapsedViewStyle = useAnimatedStyle(() => ({
      opacity: withTiming(isSelected ? 0 : 1, {
        duration: 250,
        easing: Easing.out(Easing.quad),
      }),
    }));

    const expandedViewStyle = useAnimatedStyle(() => ({
      opacity: withTiming(isSelected ? 1 : 0, {
        duration: 320,
        easing: Easing.out(Easing.quad),
      }),
      transform: [
        {
          translateY: withTiming(isSelected ? 0 : 20, {
            duration: 380,
            easing: Easing.out(Easing.cubic),
          }),
        },
      ],
    }));

    return (
      <Animated.View
        style={[
          styles.cardContainer,
          { width: cardWidth, marginHorizontal: 8 },
          cardStyle,
        ]}
      >
        <View
          style={[
            styles.cardGlowRing,
            isSelected && styles.cardGlowRingExpanded,
          ]}
        >
          <Pressable
            onPress={() => onSelect(index)}
            style={styles.cardPressable}
          >
            <View style={styles.cardInner}>
              {/* Top Hero Background Image */}
              <AnimatedImage
                source={item.image}
                style={[styles.heroImage, heroImageStyle]}
                resizeMode="cover"
              />

              {/* ── Collapsed View Content (Dark Overlay + Title + Subtext) ── */}
              <Animated.View
                style={[styles.collapsedContainer, collapsedViewStyle]}
                pointerEvents={isSelected ? "none" : "auto"}
              >
                <LinearGradient
                  colors={[
                    "transparent",
                    "rgba(8,10,20,0.35)",
                    "rgba(8,10,20,0.88)",
                  ]}
                  locations={[0.2, 0.55, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.collapsedContent}>
                  <View style={styles.collapsedHeaderRow}>
                    <View
                      style={[
                        styles.collapsedIconBadge,
                        { backgroundColor: item.accentColor },
                      ]}
                    >
                      <IconComponent
                        size={22}
                        color="#FFFFFF"
                        strokeWidth={2.2}
                      />
                    </View>
                    <Text style={styles.collapsedTitle}>{item.title}</Text>
                  </View>
                  <Text style={styles.collapsedSubtitle}>
                    {item.collapsedSubtitle}
                  </Text>
                </View>
              </Animated.View>

              {/* ── Expanded View Content (Clean White Sheet) ── */}
              {isSelected && (
                <Animated.View
                  style={[styles.expandedSheet, expandedViewStyle]}
                >
                  {/* Header Row */}
                  <View style={styles.expandedHeaderRow}>
                    <View
                      style={[
                        styles.expandedIconBadge,
                        { backgroundColor: item.badgeBg },
                      ]}
                    >
                      <IconComponent
                        size={24}
                        color={item.accentColor}
                        strokeWidth={2.2}
                      />
                    </View>
                    <Text style={styles.expandedTitle}>{item.title}</Text>
                  </View>

                  {/* Main Subtitle */}
                  <Text style={styles.expandedSubtitle}>{item.subtitle}</Text>

                  {/* 3 Features Columns Row */}
                  <View style={styles.featuresRow}>
                    {item.features.map((feat, fIdx) => {
                      const FeatIcon = feat.icon;
                      return (
                        <View
                          key={fIdx}
                          style={[
                            styles.featureCol,
                            fIdx < item.features.length - 1 &&
                              styles.featureColDivider,
                          ]}
                        >
                          <View
                            style={[
                              styles.featureIconCircle,
                              { backgroundColor: feat.iconBg },
                            ]}
                          >
                            <FeatIcon
                              size={20}
                              color={feat.iconColor}
                              strokeWidth={2.2}
                            />
                          </View>
                          <View style={styles.featureTitleContainer}>
                            <Text style={styles.featureTitle} numberOfLines={2}>
                              {feat.title}
                            </Text>
                          </View>
                          <Text style={styles.featureDesc} numberOfLines={4}>
                            {feat.desc}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Vibrant Gradient Button with Sparkles */}
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={onContinue}
                    style={styles.cardContinueButtonWrapper}
                  >
                    <LinearGradient
                      colors={item.buttonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.cardContinueButton,
                        { shadowColor: item.accentColor },
                      ]}
                    >
                      <Sparkles size={18} color="#FFFFFF" style={{ opacity: 0.9 }} />
                      <View style={styles.buttonCenterRow}>
                        <Text style={styles.cardContinueButtonText}>
                          {item.buttonText}
                        </Text>
                        <ArrowRight
                          size={18}
                          color="#FFFFFF"
                          strokeWidth={2.5}
                          style={{ marginLeft: 6 }}
                        />
                      </View>
                      <Sparkles size={18} color="#FFFFFF" style={{ opacity: 0.9 }} />
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
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
  const [activeDraft, setActiveDraft] = useState(null);
  const draftModalShown = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (draftModalShown.current) return;

      const checkForDrafts = async () => {
        try {
          const [communityDraft, memberDraft] = await Promise.all([
            getCommunitySignupDraft(),
            getSignupDraft(),
          ]);

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
            setActiveDraft({
              type: "Member",
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
      navigation.reset({
        index: 0,
        routes: [
          {
            name: "CommunitySignup",
            state: {
              index: screenStack.length - 1,
              routes: screenStack.map((screenName) => ({
                name: screenName,
                params: { ...sharedParams, isResumingDraft: true },
              })),
            },
          },
        ],
      });
    } else if (activeDraft.fromCommunitySignup) {
      if (activeDraft.step === "PeopleProfilePrompt") {
        navigation.navigate("PeopleProfilePromptScreen", {
          prefillRecovery: activeDraft.data?.prefill || {},
        });
      } else {
        const resumeScreen = getPeopleProfileResumeScreen(activeDraft.step);
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
      const screenStack = getMemberResumeStack(activeDraft.step);
      const sharedParams = {
        ...activeDraft.data,
        isResumingDraft: true,
      };
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
    draftModalShown.current = false;
  };

  const CARD_WIDTH = width * 0.86;
  const CARD_SPACING = 16;
  const ITEM_SIZE = CARD_WIDTH + CARD_SPACING;
  const CARD_BASE_HEIGHT = Math.min(height * 0.44, 380);
  const CARD_EXPANDED_HEIGHT = Math.min(height * 0.66, 530);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const carouselHeightStyle = useAnimatedStyle(() => {
    const isExpanded = selectedIndex !== -1;
    const targetHeight = isExpanded
      ? CARD_EXPANDED_HEIGHT + 24
      : CARD_BASE_HEIGHT + 56;
    return {
      height: withTiming(targetHeight, {
        duration: 420,
        easing: Easing.bezier(0.25, 1, 0.5, 1),
      }),
    };
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
        cardExpandedHeight={CARD_EXPANDED_HEIGHT}
        selectedIndex={selectedIndex}
        onSelect={handleSelect}
        onContinue={handleContinue}
        cardWidth={CARD_WIDTH}
      />
    ),
    [
      selectedIndex,
      CARD_BASE_HEIGHT,
      CARD_EXPANDED_HEIGHT,
      CARD_WIDTH,
      handleSelect,
      handleContinue,
    ],
  );

  const activeRole = selectedIndex !== -1 ? PARTICIPATION_ROLES[selectedIndex] : null;

  return (
    <ImageBackground
      source={require("../../assets/background/wave.webp")}
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
          <View style={[styles.carouselContainer, { overflow: "visible" }]}>
            <AnimatedGHFlatList
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
              }}
              style={carouselHeightStyle}
            />
          </View>

          {/* ── Pagination Dots ── */}
          <View style={styles.paginationContainer}>
            {PARTICIPATION_ROLES.map((role, i) => {
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
                  distanceFromActive < 0.5
                    ? role.accentColor
                    : COLORS.textMuted;
                return { width: dotWidth, opacity, backgroundColor };
              });
              return <Animated.View key={i} style={[styles.dot, dotStyle]} />;
            })}
          </View>

          {/* ── Footer ── */}
          <View style={styles.footerContainer}>
            <View style={styles.loginPromptContainer}>
              <Text style={styles.loginPromptText}>
                Already have an account?{" "}
              </Text>
              <TouchableOpacity
                onPress={handleLoginPress}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                <Text
                  style={[
                    styles.loginLinkText,
                    activeRole && { color: activeRole.accentColor },
                  ]}
                >
                  Sign In
                </Text>
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
    paddingTop: 12,
    paddingHorizontal: 24,
    position: "relative",
  },
  closeButtonAbsolute: {
    position: "absolute",
    top: 16,
    left: 24,
    zIndex: 10,
  },
  logoContainer: { marginBottom: 8 },
  headerTitle: {
    fontFamily: FONTS.black, // BasicCommercial-Black per authority rule
    fontSize: 32,
    textAlign: "center",
    lineHeight: 36,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontFamily: FONTS.regular, // Manrope-Regular
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
  },

  // ── Carousel ──
  carouselContainer: {
    justifyContent: "center",
    marginTop: 16,
  },
  cardContainer: {
    backgroundColor: "transparent",
  },

  cardGlowRing: {
    flex: 1,
    borderRadius: 30,
    backgroundColor: COLORS.surface,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  cardGlowRingExpanded: {
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    shadowColor: "transparent",
  },
  cardPressable: { flex: 1 },
  cardInner: {
    flex: 1,
    borderRadius: 28,
    backgroundColor: COLORS.surface,
    overflow: "hidden",
  },

  heroImage: {
    width: "100%",
  },

  // ── Collapsed Overlay ──
  collapsedContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  collapsedContent: {
    padding: 20,
  },
  collapsedHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  collapsedIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  collapsedTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 26,
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  collapsedSubtitle: {
    fontFamily: FONTS.regular, // Manrope-Regular
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.92)",
    lineHeight: 20,
  },

  // ── Expanded White Sheet Panel ──
  expandedSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    marginTop: -16,
    flex: 1,
    justifyContent: "space-between",
  },
  expandedHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  expandedIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  expandedTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 26,
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  expandedSubtitle: {
    fontFamily: FONTS.regular, // Manrope-Regular
    fontSize: 13.5,
    color: "#475569",
    lineHeight: 19,
    marginBottom: 12,
  },

  // ── 3 Feature Columns Row ──
  featuresRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 10,
    marginBottom: 12,
  },
  featureCol: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 2,
  },
  featureColDivider: {
    borderRightWidth: 1,
    borderRightColor: "rgba(0, 0, 0, 0.07)",
  },
  featureIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  featureTitleContainer: {
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
    width: "100%",
  },
  featureTitle: {
    fontFamily: FONTS.semiBold, // Manrope-SemiBold
    fontSize: 11.5,
    color: "#0F172A",
    textAlign: "center",
    lineHeight: 15,
  },
  featureDesc: {
    fontFamily: FONTS.regular, // Manrope-Regular
    fontSize: 10.2,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 14,
  },

  // ── CTA Button ──
  cardContinueButtonWrapper: {
    width: "100%",
    borderRadius: BORDER_RADIUS.pill,
    overflow: "hidden",
  },
  cardContinueButton: {
    borderRadius: BORDER_RADIUS.pill,
    height: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonCenterRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardContinueButtonText: {
    fontFamily: FONTS.semiBold, // Manrope-SemiBold
    fontSize: 15.5,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },

  // ── Pagination ──
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },

  // ── Footer ──
  footerContainer: {
    paddingHorizontal: 24,
    marginTop: "auto",
    paddingBottom: 16,
    alignItems: "center",
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
