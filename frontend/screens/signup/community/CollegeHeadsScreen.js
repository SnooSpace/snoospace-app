/**
 * CollegeHeadsScreen.js
 *
 * Heads screen for College-affiliated communities.
 * Features: name + role fields, 2 initial entries, 1 required, '+' button to add more.
 */

import React, { useState, useEffect } from "react";
import { CommonActions } from "@react-navigation/native";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Platform,
  StatusBar,
  Alert,
  ImageBackground,
} from "react-native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withSequence } from "react-native-reanimated";
import { XCircle, PlusCircle } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import wave from "../../../assets/wave.png";
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
  getCommunityDraftData,
} from "../../../utils/signupDraftManager";
import CancelSignupModal from "../../../components/modals/CancelSignupModal";

/**
 * Head Entry Component with Name and Role
 */
const HeadEntry = ({
  index,
  name,
  role,
  onNameChange,
  onRoleChange,
  onRemove,
  isRequired,
  showRemove,
}) => {
  const [nameFocused, setNameFocused] = useState(false);
  const [roleFocused, setRoleFocused] = useState(false);

  // Animation values for inputs
  const nameScale = useSharedValue(1);
  const roleScale = useSharedValue(1);

  const animatedNameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nameScale.value }],
  }));

  const animatedRoleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: roleScale.value }],
  }));

  useEffect(() => {
    nameScale.value = withSpring(nameFocused ? 1.02 : 1, { damping: 15, stiffness: 120 });
  }, [nameFocused]);

  useEffect(() => {
    roleScale.value = withSpring(roleFocused ? 1.02 : 1, { damping: 15, stiffness: 120 });
  }, [roleFocused]);

  return (
    <View style={styles.headEntry}>
      <View style={styles.entryHeader}>
        <Text style={styles.entryLabel}>
          {isRequired ? "Head 1 (Required)" : `Head ${index + 1} (Optional)`}
        </Text>
        {showRemove && (
          <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
            <XCircle size={22} color={COLORS.error} />
          </TouchableOpacity>
        )}
      </View>

      <Animated.View style={animatedNameStyle}>
        <TextInput
          style={[styles.input, nameFocused && styles.inputFocused]}
          placeholder="Name"
          placeholderTextColor={COLORS.textSecondary}
          value={name}
          onChangeText={onNameChange}
          autoCapitalize="words"
          onFocus={() => setNameFocused(true)}
          onBlur={() => setNameFocused(false)}
        />
      </Animated.View>

      <Animated.View style={animatedRoleStyle}>
        <TextInput
          style={[styles.input, roleFocused && styles.inputFocused]}
          placeholder="Role (e.g., Coordinator, President, Organizer)"
          placeholderTextColor={COLORS.textSecondary}
          value={role}
          onChangeText={onRoleChange}
          autoCapitalize="words"
          onFocus={() => setRoleFocused(true)}
          onBlur={() => setRoleFocused(false)}
        />
      </Animated.View>
    </View>
  );
};

/**
 * Main Screen Component
 */
const CollegeHeadsScreen = ({ navigation, route }) => {
  const {
    email,
    accessToken,
    refreshToken,
    name,
    logo_url,
    bio,
    category,
    categories,
    location,
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

  // States for shared params that need hydration from draft if missing
  const [params, setParams] = useState({
    email,
    accessToken,
    refreshToken,
    name,
    logo_url,
    bio,
    category,
    categories,
    location,
    community_type,
    college_id,
    college_name,
    college_subtype,
    club_type,
    community_theme,
    college_pending,
    isStudentCommunity,
  });

  // Initial 2 entries
  const [heads, setHeads] = useState([
    { name: "", role: "" },
    { name: "", role: "" },
  ]);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Animation values
  const buttonScale = useSharedValue(1);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Trigger button bounce when validity changes to true (isButtonDisabled becomes false)
  useEffect(() => {
    if (!isButtonDisabled) {
      buttonScale.value = withSequence(
        withSpring(1.05, { damping: 10, stiffness: 100 }),
        withSpring(1, { damping: 12, stiffness: 90 })
      );
    }
  }, [isButtonDisabled]);

  // Update step on mount and hydrate from draft
  useEffect(() => {
    const initScreen = async () => {
      // Mark step
      try {
        await updateCommunitySignupDraft("CollegeHeads", {});
        console.log("[CollegeHeadsScreen] Step set to CollegeHeads");
      } catch (e) {
        console.log("[CollegeHeadsScreen] Step update failed:", e.message);
      }

      // Hydrate from draft
      const draftData = await getCommunityDraftData();
      if (!draftData) return;

      // 1. Hydrate heads
      if (draftData.heads && draftData.heads.length > 0) {
        console.log("[CollegeHeadsScreen] Hydrating heads from draft");
        const hydratedHeads = draftData.heads.map((h) => ({
          name: h.name || "",
          role: h.role || "",
        }));
        // Ensure at least 2 entries
        while (hydratedHeads.length < 2) {
          hydratedHeads.push({ name: "", role: "" });
        }
        setHeads(hydratedHeads);
      }

      // 2. Hydrate all shared parameters
      const updatedParams = { ...params };
      let paramChanged = false;

      const keysToHydrate = [
        "email", "accessToken", "refreshToken", "name", "logo_url", "bio",
        "category", "categories", "location", "community_type", "college_id",
        "college_name", "college_subtype", "club_type", "community_theme",
        "college_pending", "isStudentCommunity"
      ];

      keysToHydrate.forEach(key => {
        if (!params[key] && draftData[key] !== undefined && draftData[key] !== null) {
          updatedParams[key] = draftData[key];
          paramChanged = true;
        }
      });

      if (paramChanged) {
        console.log("[CollegeHeadsScreen] Hydrated shared parameters from draft");
        setParams(updatedParams);
      }
    };
    initScreen();
  }, []);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
    const previousScreen = params.isStudentCommunity
      ? "CommunityBio"
      : "CommunityLocation";

    navigation.replace(previousScreen, {
      ...params,
    });
    }
  };

  const updateHead = (index, field, value) => {
    const newHeads = [...heads];
    newHeads[index] = { ...newHeads[index], [field]: value };
    setHeads(newHeads);
  };

  const addHead = () => {
    setHeads([...heads, { name: "", role: "" }]);
  };

  const removeHead = (index) => {
    if (heads.length > 2) {
      const newHeads = heads.filter((_, i) => i !== index);
      setHeads(newHeads);
    }
  };

  const handleNext = async () => {
    // Validate first head is filled
    if (!heads[0].name.trim()) {
      Alert.alert("Required", "Please enter at least one head name.");
      return;
    }

    // Build heads array for submission (filter out empty entries)
    const validHeads = heads
      .filter((h) => h.name.trim())
      .map((h, idx) => ({
        name: h.name.trim(),
        role: h.role.trim() || null,
        is_primary: idx === 0,
      }));

    // Save heads to draft
    try {
      await updateCommunitySignupDraft("CollegeHeads", { heads: validHeads });
      console.log("[CollegeHeadsScreen] Draft updated with heads");
    } catch (e) {
      console.log(
        "[CollegeHeadsScreen] Draft update failed (non-critical):",
        e.message,
      );
    }

    // College communities now go through HeadProfilePic → Phone → Username
    navigation.navigate("CommunityHeadProfilePic", {
      ...params,
      heads: validHeads,
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

  // First head name is required
  const isButtonDisabled = !heads[0].name.trim();

  return (
    <ImageBackground
      source={wave}
      style={styles.backgroundImage}
      imageStyle={{ opacity: 0.3, transform: [{ scaleX: -1 }, { scaleY: -1 }] }}
      blurRadius={10}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <SignupHeader
            role={params.isStudentCommunity ? "People" : "Communities"}
            onBack={handleBack}
            onCancel={() => setShowCancelModal(true)}
          />

          {/* Scrollable Content */}
          <ScrollView
            style={styles.contentScrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.contentArea}>
              <View style={styles.headerTitle}>
                <Animated.Text 
                  entering={FadeInDown.delay(100).duration(600).springify()}
                  style={styles.mainTitle}
                >
                  Who manages this community?
                </Animated.Text>
                <Animated.Text 
                  entering={FadeInDown.delay(200).duration(600).springify()}
                  style={styles.globalHelperText}
                >
                  Add the people who handle this page with their roles.
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
                  {/* Head Entries */}
                  {heads.map((head, index) => (
                    <Animated.View 
                      key={index}
                      entering={FadeInDown.delay(400 + index * 100).duration(600).springify()}
                    >
                      <HeadEntry
                        index={index}
                        name={head.name}
                        role={head.role}
                        onNameChange={(value) => updateHead(index, "name", value)}
                        onRoleChange={(value) => updateHead(index, "role", value)}
                        onRemove={() => removeHead(index)}
                        isRequired={index === 0}
                        showRemove={index >= 2}
                      />
                    </Animated.View>
                  ))}

                  {/* Add More Button */}
                  <TouchableOpacity style={styles.addButton} onPress={addHead}>
                    <PlusCircle
                      size={24}
                      color={COLORS.primary}
                    />
                    <Text style={styles.addButtonText}>Add Another Head</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>

              {/* Next Button Container placed beneath the card */}
              <View
                style={{ width: "100%", alignItems: "flex-end", marginTop: 40 }}
              >
                <Animated.View 
                  entering={FadeInDown.delay(600).duration(600).springify()}
                  style={animatedButtonStyle}
                >
                  <TouchableOpacity
                    style={[
                      styles.nextButtonContainer,
                      isButtonDisabled && styles.disabledButton,
                      { minWidth: 160, paddingHorizontal: 32, marginRight: -8 },
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
        </View>

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

// --- Styles ---
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
  container: {
    flex: 1,
  },
  contentScrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingBottom: 40,
  },
  contentArea: {
    marginTop: 40,
  },
  headerTitle: {
    marginBottom: 40,
    paddingRight: 10,
  },
  mainTitle: {
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
    marginBottom: 24,
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
  headEntry: {
    marginBottom: 20,
    backgroundColor: "rgba(116, 173, 242, 0.1)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(116, 173, 242, 0.2)",
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  entryLabel: {
    fontSize: 14,
    fontFamily: "Manrope-Bold",
    color: COLORS.primary,
  },
  removeButton: {
    padding: 4,
  },
  input: {
    height: 56,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "Manrope-Medium",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(116, 173, 242, 0.5)",
    borderStyle: "dashed",
    marginTop: 8,
  },
  addButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    marginLeft: 8,
  },
  nextButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    shadowColor: "#74adf2",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButton: {
    height: 56,
    borderRadius: BORDER_RADIUS.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  disabledButton: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },
});

export default CollegeHeadsScreen;



