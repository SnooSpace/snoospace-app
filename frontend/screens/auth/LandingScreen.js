// screens/LandingScreen.js
import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Animated,
  Platform,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import { ArrowRight, Users, Building2 } from "lucide-react-native";
import { SvgXml } from "react-native-svg";
import { COLORS, BORDER_RADIUS, SHADOWS, FONTS } from "../../constants/theme";
import HapticsService from "../../services/HapticsService";
import DynamicStatusBar from "../../components/DynamicStatusBar";

// Icon_Light.svg as string
const SnooSpaceIconSvg = `<svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M66.667 0.5C103.181 0.500189 132.833 31.9995 132.833 70.9219C132.833 109.844 103.181 141.344 66.667 141.344C30.1528 141.344 0.5 109.844 0.5 70.9219C0.500058 31.9993 30.1529 0.5 66.667 0.5Z" fill="#3565F2" stroke="#3D79F2"/>
<ellipse cx="133.333" cy="129.078" rx="66.6667" ry="70.922" fill="#CEF2F2"/>
<path d="M132.257 58.1671C132.963 62.3048 133.334 66.5674 133.334 70.9219C133.334 109.709 104.065 141.222 67.7419 141.833C67.0355 137.695 66.6667 133.433 66.6667 129.078C66.6667 90.2916 95.9342 58.779 132.257 58.1671Z" fill="#6BB3F2"/>
</svg>`;

const PARTICIPATION_ROLES = [
  {
    id: "member",
    title: "People",
    subtitle: "Discover events and connect with others in meaningful ways.",
    animation: require("../../assets/animations/gossipers.json"),
    icon: Users,
  },
  {
    id: "community",
    title: "Community",
    subtitle: "Host amazing events and grow your community presence.",
    animation: require("../../assets/animations/Community svg.json"),
    icon: Building2,
  },
];

const LandingScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  // The cards should take up roughly 85% of screen width
  const CARD_WIDTH = width * 0.85;
  const CARD_SPACING = 16;
  const ITEM_SIZE = CARD_WIDTH + CARD_SPACING;

  const handleSelection = () => {
    const roleConfig = PARTICIPATION_ROLES[activeIndex];
    const roleId = roleConfig.id;
    HapticsService.triggerImpactLight();

    switch (roleId) {
      case "member":
        navigation.navigate("MemberSignup", { selectedRole: roleId });
        break;
      case "community":
        navigation.navigate("CommunitySignup", { selectedRole: roleId });
        break;
      default:
        console.log("Unknown role:", roleId);
    }
  };

  const handleLoginPress = () => {
    HapticsService.triggerImpactLight();
    navigation.navigate("Login");
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index);
      HapticsService.triggerSelection();
    }
  }, []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderCard = ({ item }) => {
    const IconComponent = item.icon;

    return (
      <View
        style={[
          styles.cardContainer,
          { width: CARD_WIDTH, marginHorizontal: CARD_SPACING / 2 },
        ]}
      >
        <View style={styles.cardInner}>
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

          {/* Gradient Overlay for Text Readability */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.8)"]}
            style={styles.cardGradientOverlay}
          />

          <View style={styles.cardContent}>
            <View style={styles.cardIconContainer}>
              <IconComponent size={22} color={COLORS.surface} strokeWidth={2} />
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screenContainer}>
      <DynamicStatusBar style="dark-content" />
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        {/* Header Section */}
        <View style={styles.headerContainer}>
          <View style={styles.logoContainer}>
            <SvgXml xml={SnooSpaceIconSvg} width={48} height={48} />
          </View>
          <Text style={styles.headerTitle}>
            <Text style={{ color: COLORS.textPrimary }}>Welcome to{"\n"}</Text>
            <Text style={{ color: COLORS.primary }}>SnooSpace</Text>
          </Text>
          <Text style={styles.headerSubtitle}>
            Choose how you want to participate
          </Text>
        </View>

        {/* Carousel Section */}
        <View style={styles.carouselContainer}>
          <Animated.FlatList
            data={PARTICIPATION_ROLES}
            keyExtractor={(item) => item.id}
            renderItem={renderCard}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={ITEM_SIZE}
            decelerationRate="fast"
            bounces={false}
            contentContainerStyle={{
              paddingHorizontal: (width - ITEM_SIZE) / 2, // Centers first and last item
            }}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false },
            )}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
          />
        </View>

        {/* Pagination Dots */}
        <View style={styles.paginationContainer}>
          {PARTICIPATION_ROLES.map((_, index) => {
            const opacity = scrollX.interpolate({
              inputRange: [
                (index - 1) * ITEM_SIZE,
                index * ITEM_SIZE,
                (index + 1) * ITEM_SIZE,
              ],
              outputRange: [0.3, 1, 0.3],
              extrapolate: "clamp",
            });
            const dotWidth = scrollX.interpolate({
              inputRange: [
                (index - 1) * ITEM_SIZE,
                index * ITEM_SIZE,
                (index + 1) * ITEM_SIZE,
              ],
              outputRange: [8, 24, 8],
              extrapolate: "clamp",
            });
            const backgroundColor = scrollX.interpolate({
              inputRange: [
                (index - 1) * ITEM_SIZE,
                index * ITEM_SIZE,
                (index + 1) * ITEM_SIZE,
              ],
              outputRange: [COLORS.textMuted, COLORS.primary, COLORS.textMuted],
              extrapolate: "clamp",
            });

            return (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  { width: dotWidth, opacity, backgroundColor },
                ]}
              />
            );
          })}
        </View>

        {/* Footer Actions */}
        <View style={styles.footerContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSelection}
            style={[
              styles.continueButton,
              { marginBottom: Platform.OS === "ios" ? 10 : 20 },
            ]}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
            <ArrowRight size={20} color={COLORS.surface} strokeWidth={2.5} />
          </TouchableOpacity>

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
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: COLORS.background, // Off-white
  },
  safeArea: {
    flex: 1,
    justifyContent: "space-between",
  },
  // Header
  headerContainer: {
    alignItems: "center",
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  logoContainer: {
    marginBottom: 20,
  },
  headerTitle: {
    fontFamily: FONTS.black, // Authority Rule: Used only once
    fontSize: 34,
    textAlign: "center",
    lineHeight: 38,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontFamily: FONTS.regular, // Body Text Rule
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },

  // Carousel
  carouselContainer: {
    flex: 1,
    marginVertical: 24,
  },
  cardContainer: {
    height: "100%",
  },
  cardInner: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    overflow: "hidden",
    position: "relative",
    // Premium soft shadow
    ...SHADOWS.md,
  },
  lottieAnimation: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  gossipersAnimation: {
    transform: [{ scale: 1.3 }], // Zoom in to remove empty space
    marginTop: -40, // Shift up slightly
  },
  cardGradientOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "60%",
  },
  cardContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
  },
  cardIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 16, // Consistent rounded square
    backgroundColor: "rgba(255, 255, 255, 0.25)", // Soft tinted background (Glassmorphism)
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    ...SHADOWS.sm,
  },
  cardTitle: {
    fontFamily: FONTS.primary, // Structural Rule: Major card titles use Bold
    fontSize: 28,
    color: COLORS.surface,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  cardSubtitle: {
    fontFamily: FONTS.regular, // Body Text Rule
    fontSize: 15,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 22,
  },

  // Pagination
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },

  // Footer Actions
  footerContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  continueButton: {
    backgroundColor: COLORS.primary, // Brand Primary Instead of Orange
    borderRadius: BORDER_RADIUS.pill,
    height: 56,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    ...SHADOWS.md, // Glow/Shadow
    shadowColor: COLORS.primary,
  },
  continueButtonText: {
    fontFamily: FONTS.semiBold, // Functional UI Rule
    fontSize: 18,
    color: COLORS.surface,
    marginRight: 8,
  },
  loginPromptContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginPromptText: {
    fontFamily: FONTS.regular, // Body Text Rule
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  loginLinkText: {
    fontFamily: FONTS.semiBold, // Functional UI Rule
    fontSize: 15,
    color: COLORS.primary,
  },
});

export default LandingScreen;
