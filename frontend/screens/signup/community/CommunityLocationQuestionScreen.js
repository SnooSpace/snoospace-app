import React, { useState, useEffect } from "react";
import { CommonActions } from "@react-navigation/native";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  SafeAreaView,
  Platform,
  StatusBar,
  Dimensions,
  ImageBackground,
  ScrollView,
} from "react-native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withSequence, interpolate } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
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
import {
  updateCommunitySignupDraft,
  deleteCommunitySignupDraft,
} from "../../../utils/signupDraftManager";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";

const CommunityLocationQuestionScreen = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    refreshToken,
    name,
    logo_url,
    bio,
    category,
    categories,
    // NEW: Community type fields
    community_type,
    college_id,
    college_name,
    college_subtype,
    club_type,
    community_theme,
    college_pending,
    isStudentCommunity,
    isResumingDraft,
  } = route.params || {};

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [hasLocation, setHasLocation] = useState(null); // 'yes' or 'no'

  // Animation values
  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Trigger button bounce when validity changes to true (hasLocation !== null)
  useEffect(() => {
    if (hasLocation !== null) {
      buttonScale.value = withSequence(
        withSpring(1.05, { damping: 10, stiffness: 100 }),
        withSpring(1, { damping: 12, stiffness: 90 })
      );
    }
  }, [hasLocation]);

  // Update step on mount
  useEffect(() => {
    const initScreen = async () => {
      try {
        await updateCommunitySignupDraft("CommunityLocationQuestion", {});
        console.log("[LocationQuestion] Step set to CommunityLocationQuestion");
      } catch (e) {
        console.log("[LocationQuestion] Step update failed:", e.message);
      }
    };
    initScreen();
  }, []);

  // Determine if this is an organization type (requires phone/heads)
  const isOrganization = !community_type || community_type === "organization";

  // Build common params to pass forward
  const commonParams = {
    email,
    accessToken,
    refreshToken,
    name,
    logo_url,
    bio,
    category,
    categories,
    community_type,
    college_id,
    college_name,
    college_subtype,
    club_type,
    community_theme,
    college_pending,
    isStudentCommunity,
  };

  const handleYes = () => {
    setHasLocation("yes");
  };

  const handleNo = () => {
    setHasLocation("no");
  };

  const handleNext = async () => {
    if (hasLocation === null) return;

    if (hasLocation === "yes") {
      try {
        await updateCommunitySignupDraft("CommunityLocationQuestion", {
          hasLocation: true,
        });
        console.log("[CommunityLocationQuestion] Draft updated - has location");
      } catch (e) {
        console.log(
          "[CommunityLocationQuestion] Draft update failed (non-critical):",
          e.message,
        );
      }
      navigation.navigate("CommunityLocation", commonParams);
    } else {
      try {
        await updateCommunitySignupDraft("CommunityLocationQuestion", {
          hasLocation: false,
          location: null,
        });
        console.log("[CommunityLocationQuestion] Draft updated - no location");
      } catch (e) {
        console.log(
          "[CommunityLocationQuestion] Draft update failed (non-critical):",
          e.message,
        );
      }

      if (isOrganization) {
        navigation.navigate("CommunityPhone", {
          ...commonParams,
          location: null,
        });
      } else {
        navigation.navigate("CommunityUsername", {
          ...commonParams,
          location: null,
        });
      }
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace("CommunityCategory", {
        email,
        accessToken,
        refreshToken,
        name,
        logo_url,
        bio,
        community_type,
        college_id,
        college_name,
        college_subtype,
        club_type,
        community_theme,
        college_pending,
        isStudentCommunity,
      });
    }
  };

  const handleCancel = async () => {
    await deleteCommunitySignupDraft();
    setShowCancelModal(false);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "AuthGate" }],
      }),
    );
  };

  const isButtonDisabled = hasLocation === null;

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
          role="Communities"
          onCancel={() => setShowCancelModal(true)}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.contentBody}>
            <Animated.Text 
              entering={FadeInDown.delay(100).duration(600).springify()}
              style={styles.mainTitle}
            >
              Do you have a permanent location?
            </Animated.Text>
            <Animated.Text 
              entering={FadeInDown.delay(200).duration(600).springify()}
              style={styles.subtitle}
            >
              This helps us show your community to nearby members and sponsors.
            </Animated.Text>

            <View style={styles.optionsContainer}>
              <Animated.View entering={FadeInDown.delay(300).duration(600).springify()}>
                <TouchableOpacity
                  style={[
                    styles.optionCard,
                    hasLocation === "yes" && styles.optionCardSelected,
                  ]}
                  onPress={handleYes}
                  activeOpacity={0.8}
                >
                  <BlurView
                    intensity={hasLocation === "yes" ? 80 : 40}
                    tint="light"
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.optionContent}>
                    <Ionicons
                      name="location"
                      size={24}
                      color={
                        hasLocation === "yes"
                          ? COLORS.primary
                          : COLORS.textPrimary
                      }
                      style={{ marginRight: 15 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.optionTitle,
                          hasLocation === "yes" && styles.optionTitleSelected,
                        ]}
                      >
                        Yes
                      </Text>
                      <Text style={styles.optionDescription}>
                        We have a physical office or recurring meetup spot
                      </Text>
                    </View>
                    <Ionicons
                      name={
                        hasLocation === "yes"
                          ? "radio-button-on"
                          : "radio-button-off"
                      }
                      size={24}
                      color={
                        hasLocation === "yes"
                          ? COLORS.primary
                          : COLORS.textSecondary
                      }
                    />
                  </View>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(400).duration(600).springify()}>
                <TouchableOpacity
                  style={[
                    styles.optionCard,
                    hasLocation === "no" && styles.optionCardSelected,
                  ]}
                  onPress={handleNo}
                  activeOpacity={0.8}
                >
                  <BlurView
                    intensity={hasLocation === "no" ? 80 : 40}
                    tint="light"
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.optionContent}>
                    <Ionicons
                      name="earth-outline"
                      size={24}
                      color={
                        hasLocation === "no" ? COLORS.primary : COLORS.textPrimary
                      }
                      style={{ marginRight: 15 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.optionTitle,
                          hasLocation === "no" && styles.optionTitleSelected,
                        ]}
                      >
                        No
                      </Text>
                      <Text style={styles.optionDescription}>
                        We are online-only or host events in different places
                      </Text>
                    </View>
                    <Ionicons
                      name={
                        hasLocation === "no"
                          ? "radio-button-on"
                          : "radio-button-off"
                      }
                      size={24}
                      color={
                        hasLocation === "no"
                          ? COLORS.primary
                          : COLORS.textSecondary
                      }
                    />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            </View>

            <View
              style={{ width: "100%", alignItems: "flex-end", marginTop: 40 }}
            >
              <Animated.View 
                entering={FadeInDown.delay(500).duration(600).springify()}
                style={animatedButtonStyle}
              >
                <TouchableOpacity
                  style={[
                    styles.nextButtonContainer,
                    isButtonDisabled && styles.disabledButton,
                    { minWidth: 160, paddingHorizontal: 32, marginRight: -8 },
                  ]}
                  onPress={handleNext}
                  activeOpacity={0.8}
                  disabled={isButtonDisabled}
                >
                  <LinearGradient
                    colors={COLORS.primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.nextButton}
                  >
                    <Text style={styles.buttonText}>Next</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </ScrollView>

        {/* Cancel Confirmation Modal */}
        <CancelSignupModal
          visible={showCancelModal}
          onKeepEditing={() => setShowCancelModal(false)}
          onDiscard={handleCancel}
        />
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
  contentBody: {
    flex: 1,
    paddingTop: 40,
  },
  mainTitle: {
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
  optionsContainer: {
    gap: 16,
  },
  optionCard: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.4)",
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
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.8)",
    overflow: "hidden",
  },
  optionCardSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderColor: COLORS.primary,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 24,
  },
  optionTitle: {
    fontSize: 18,
    fontFamily: "Manrope-Bold",
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  optionTitleSelected: {
    color: COLORS.primary,
  },
  optionDescription: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  nextButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    shadowColor: "#74adf2",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  disabledButton: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  nextButton: {
    height: 56,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },
});

export default CommunityLocationQuestionScreen;



