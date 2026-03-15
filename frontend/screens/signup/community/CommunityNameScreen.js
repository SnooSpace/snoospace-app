import React, { useState, useEffect } from "react";
import { CommonActions } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
  ImageBackground,
  ScrollView,
  BackHandler,
} from "react-native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withSequence } from "react-native-reanimated";

import { BlurView } from "expo-blur";
import { User } from "lucide-react-native";

import { LinearGradient } from "expo-linear-gradient";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import { triggerTransitionHaptic } from "../../../hooks/useCelebrationHaptics";
import SignupHeader from "../../../components/SignupHeader";
import {
  updateCommunitySignupDraft,
  deleteCommunitySignupDraft,
  getCommunityDraftData,
} from "../../../utils/signupDraftManager";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";
import TypeSelectWarningModal from "../../../components/modals/TypeSelectWarningModal";

const CommunityNameScreen = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    refreshToken,
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
  const [name, setName] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showTypeSelectModal, setShowTypeSelectModal] = useState(false);

  // Animation values
  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Trigger button bounce when validity changes to true (name.trim().length > 0)
  useEffect(() => {
    if (name.trim().length > 0) {
      buttonScale.value = withSequence(
        withSpring(1.05, { damping: 10, stiffness: 100 }),
        withSpring(1, { damping: 12, stiffness: 90 })
      );
    }
  }, [name.trim().length > 0]);

  // Hydrate from draft if route.params is missing name
  useEffect(() => {
    const hydrateFromDraft = async () => {
      if (!route.params?.name) {
        const draftData = await getCommunityDraftData();
        if (draftData?.name) {
          console.log("[CommunityNameScreen] Hydrating from draft");
          setName(draftData.name);
        }
      }
    };
    hydrateFromDraft();
  }, []);


  const handleNext = async () => {
    triggerTransitionHaptic();
    // Update client-side draft with name
    try {
      await updateCommunitySignupDraft("CommunityName", { name });
      console.log("[CommunityNameScreen] Draft updated with name");
    } catch (e) {
      console.log(
        "[CommunityNameScreen] Draft update failed (non-critical):",
        e.message,
      );
    }

    navigation.navigate("CommunityLogo", {
      email,
      accessToken,
      refreshToken,
      name,
      // Pass community type fields forward
      community_type,
      college_id,
      college_name,
      college_subtype,
      club_type,
      community_theme,
      college_pending,
      isStudentCommunity,
    });
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

  const handleBack = () => {
    triggerTransitionHaptic();
    // College communities reach CommunityName AFTER CollegeSearch/Subtype/ClubType,
    // so back should go to the previous screen normally (not TypeSelect).
    // Individual and Organization have TypeSelect as their immediate predecessor.
    const isCollegeAffiliated =
      community_type === "college_affiliated" && college_id;

    if (isCollegeAffiliated) {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate("CollegeSubtypeSelect", {
          email,
          accessToken,
          refreshToken,
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
    } else {
      // Individual or Organization: going back resets type — warn user
      setShowTypeSelectModal(true);
    }
  };

  // Called when user confirms reset on the TypeSelect warning modal
  const handleConfirmGoBackToTypeSelect = async () => {
    triggerTransitionHaptic();
    setShowTypeSelectModal(false);
    // Reset type-specific draft fields so a resumed draft doesn't carry stale type data
    try {
      await updateCommunitySignupDraft("CommunityTypeSelect", {
        community_type: null,
        college_id: null,
        college_name: null,
        college_subtype: null,
        club_type: null,
        community_theme: null,
        college_pending: false,
        isStudentCommunity: false,
      });
    } catch (e) {
      console.log("[CommunityName] Draft reset failed (non-critical):", e.message);
    }
    navigation.navigate("CommunityTypeSelect", {
      email,
      accessToken,
      refreshToken,
    });
  };

  // Android hardware back button interception — placed after handleBack is defined
  useFocusEffect(
    React.useCallback(() => {
      const onHardwareBack = () => {
        handleBack();
        return true; // Prevent default back
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onHardwareBack);
      return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [community_type, college_id, email, accessToken, refreshToken])
  );

  const isButtonDisabled = name.trim().length === 0;

  return (
    <ImageBackground
      source={require("../../../assets/wave.png")}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.3, transform: [{ scaleX: -1 }, { scaleY: -1 }] }}
      resizeMode="cover"
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        <SignupHeader
          onBack={handleBack}
          onCancel={() => setShowCancelModal(true)}
          role="Community"
        />

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Content Section */}
          <View style={styles.contentContainer}>
            <Animated.Text 
              entering={FadeInDown.delay(100).duration(600).springify()}
              style={styles.title}
            >
              Enter your Community Name
            </Animated.Text>

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
                <View style={styles.inputContainer}>
                  <User size={20} color="#8AADC4" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    onChangeText={setName}
                    value={name}
                    placeholder="Enter your community name"
                    placeholderTextColor="#8AADC4"
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    keyboardType="default"
                    autoCapitalize="words"
                    textContentType="name"
                    autoComplete="name"
                    importantForAutofill="no"
                  />
                </View>
              </View>
            </Animated.View>

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
                    { minWidth: 160, paddingHorizontal: 32, marginRight: -33 },
                  ]}
                  onPress={handleNext}
                  disabled={isButtonDisabled}
                  activeOpacity={0.8}
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
        <CancelSignupModal
          visible={showCancelModal}
          onKeepEditing={() => setShowCancelModal(false)}
          onDiscard={handleCancel}
        />
        <TypeSelectWarningModal
          visible={showTypeSelectModal}
          onStay={() => setShowTypeSelectModal(false)}
          onGoBack={handleConfirmGoBackToTypeSelect}
        />
      </SafeAreaView>
    </ImageBackground>
  );
};

// --- Styles ---

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  contentContainer: {
    flex: 1,
    marginTop: 40,
  },
  title: {
    fontSize: 34,
    fontFamily: "BasicCommercial-Black",
    color: COLORS.textPrimary,
    marginBottom: 40,
    letterSpacing: -1,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
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
  },
  cardContent: {
    padding: 24,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F2F5",
    borderColor: "transparent", // Premium greyish background
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 24,
    borderWidth: 1,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Manrope-Medium",
    color: COLORS.textPrimary,
  },
  nextButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    shadowColor: "#74adf2",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButton: {
    height: 56,
    borderRadius: BORDER_RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.5,
    elevation: 0,
    shadowOpacity: 0,
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },
});

export default CommunityNameScreen;



