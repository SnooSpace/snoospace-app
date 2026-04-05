/**
 * CollegeHeadsScreen.js
 *
 * Combined "Who manages this community?" + per-head profile photo screen
 * for College-affiliated communities. Each head card lets the user enter a
 * name, role, AND pick a photo inline — so the whole heads setup is done
 * in one place.
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
  Image,
} from "react-native";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from "react-native-reanimated";
import { XCircle, PlusCircle, Camera } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import wave from "../../../assets/wave.png";
import {
  COLORS,
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
import SnooLoader from "../../../components/ui/SnooLoader";
import { useCrop } from "../../../components/MediaCrop";
import { uploadImage } from "../../../api/cloudinary";

const AVATAR_SIZE = 64;

// ---------------------------------------------------------------------------
// HeadEntry — single card with avatar, name, and role
// ---------------------------------------------------------------------------
const HeadEntry = ({
  index,
  name,
  role,
  photoUri,
  onNameChange,
  onRoleChange,
  onRemove,
  onPickPhoto,
  isRequired,
  showRemove,
}) => {
  const [nameFocused, setNameFocused] = useState(false);
  const [roleFocused, setRoleFocused] = useState(false);

  const nameScale = useSharedValue(1);
  const roleScale = useSharedValue(1);

  const animatedNameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nameScale.value }],
  }));
  const animatedRoleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: roleScale.value }],
  }));

  useEffect(() => {
    nameScale.value = withSpring(nameFocused ? 1.02 : 1, {
      damping: 15,
      stiffness: 120,
    });
  }, [nameFocused]);

  useEffect(() => {
    roleScale.value = withSpring(roleFocused ? 1.02 : 1, {
      damping: 15,
      stiffness: 120,
    });
  }, [roleFocused]);

  return (
    <View style={styles.headEntry}>
      {/* Entry header row */}
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

      {/* Avatar + inputs row */}
      <View style={styles.entryBody}>
        {/* Avatar picker */}
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={onPickPhoto}
          activeOpacity={0.8}
        >
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Camera size={24} color={COLORS.textTertiary || "#999"} strokeWidth={1.5} />
            </View>
          )}
          {/* Small camera badge */}
          <View style={styles.cameraBadge}>
            <View style={styles.cameraBadgeInner}>
              <Camera size={10} color="#fff" />
            </View>
          </View>
        </TouchableOpacity>

        {/* Name + Role inputs */}
        <View style={styles.inputsColumn}>
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
              style={[
                styles.input,
                styles.inputRole,
                roleFocused && styles.inputFocused,
              ]}
              placeholder="Role (e.g., President, Coordinator)"
              placeholderTextColor={COLORS.textSecondary}
              value={role}
              onChangeText={onRoleChange}
              autoCapitalize="words"
              onFocus={() => setRoleFocused(true)}
              onBlur={() => setRoleFocused(false)}
            />
          </Animated.View>
        </View>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------
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

  // Each entry: { name, role, photoUri (local), uploadedUrl (remote) }
  const [heads, setHeads] = useState([
    { name: "", role: "", photoUri: null, uploadedUrl: null },
    { name: "", role: "", photoUri: null, uploadedUrl: null },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const { pickAndCrop } = useCrop();

  // Animation
  const buttonScale = useSharedValue(1);
  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const isButtonDisabled = !heads[0].name.trim() || isSubmitting;

  useEffect(() => {
    if (!isButtonDisabled) {
      buttonScale.value = withSequence(
        withSpring(1.05, { damping: 10, stiffness: 100 }),
        withSpring(1, { damping: 12, stiffness: 90 })
      );
    }
  }, [isButtonDisabled]);

  // ---------------------------------------------------------------------------
  // Draft hydration
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const initScreen = async () => {
      try {
        await updateCommunitySignupDraft("CollegeHeads", {});
      } catch (e) {
        console.log("[CollegeHeadsScreen] Step update failed:", e.message);
      }

      const draftData = await getCommunityDraftData();
      if (!draftData) return;

      // Hydrate heads (name & role; photos can't be restored from draft easily)
      if (draftData.heads && draftData.heads.length > 0) {
        const hydrated = draftData.heads.map((h) => ({
          name: h.name || "",
          role: h.role || "",
          photoUri: h.profile_pic_url || null, // restore uploaded URL as preview
          uploadedUrl: h.profile_pic_url || null,
        }));
        while (hydrated.length < 2) {
          hydrated.push({ name: "", role: "", photoUri: null, uploadedUrl: null });
        }
        setHeads(hydrated);
      }

      // Hydrate shared params
      const updatedParams = { ...params };
      let paramChanged = false;
      const keysToHydrate = [
        "email", "accessToken", "refreshToken", "name", "logo_url", "bio",
        "category", "categories", "location", "community_type", "college_id",
        "college_name", "college_subtype", "club_type", "community_theme",
        "college_pending", "isStudentCommunity",
      ];
      keysToHydrate.forEach((key) => {
        if (
          !params[key] &&
          draftData[key] !== undefined &&
          draftData[key] !== null
        ) {
          updatedParams[key] = draftData[key];
          paramChanged = true;
        }
      });
      if (paramChanged) {
        setParams(updatedParams);
      }
    };
    initScreen();
  }, []);

  // ---------------------------------------------------------------------------
  // Head management helpers
  // ---------------------------------------------------------------------------
  const updateHead = (index, field, value) => {
    const next = [...heads];
    next[index] = { ...next[index], [field]: value };
    setHeads(next);
  };

  const addHead = () => {
    setHeads([...heads, { name: "", role: "", photoUri: null, uploadedUrl: null }]);
  };

  const removeHead = (index) => {
    if (heads.length > 2) {
      setHeads(heads.filter((_, i) => i !== index));
    }
  };

  const handlePickPhoto = async (index) => {
    try {
      const result = await pickAndCrop("avatar");
      if (result) {
        const next = [...heads];
        next[index] = {
          ...next[index],
          photoUri: result.uri,
          uploadedUrl: null, // mark as needing upload
        };
        setHeads(next);
      }
    } catch (error) {
      console.error("[CollegeHeadsScreen] Photo pick error:", error);
      Alert.alert("Error", `Failed to pick image: ${error.message}`);
    }
  };

  // ---------------------------------------------------------------------------
  // Next — upload all local photos in parallel, then navigate
  // ---------------------------------------------------------------------------
  const handleNext = async () => {
    if (!heads[0].name.trim()) {
      Alert.alert("Required", "Please enter at least one head name.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Build the valid heads (non-empty names)
      const validHeads = heads.filter((h) => h.name.trim());

      // Upload any new local photos in parallel
      const uploadedHeads = await Promise.all(
        validHeads.map(async (h, idx) => {
          let picUrl = h.uploadedUrl || null;

          // Only upload if we have a NEW local URI (not already a remote URL)
          if (h.photoUri && !h.photoUri.startsWith("http")) {
            try {
              picUrl = await uploadImage(h.photoUri, () => {});
            } catch (uploadErr) {
              console.warn(
                `[CollegeHeadsScreen] Photo upload failed for head ${idx}:`,
                uploadErr.message
              );
              // Non-fatal: continue without photo
            }
          } else if (h.photoUri && h.photoUri.startsWith("http")) {
            picUrl = h.photoUri; // already uploaded remote URL
          }

          return {
            name: h.name.trim(),
            role: h.role.trim() || null,
            is_primary: idx === 0,
            profile_pic_url: picUrl,
          };
        })
      );

      // The primary head's photo is also stored as head_photo_url (legacy compat)
      const headPhotoUrl = uploadedHeads[0]?.profile_pic_url || null;

      // Save to draft
      try {
        await updateCommunitySignupDraft("CollegeHeads", {
          heads: uploadedHeads,
          head_photo_url: headPhotoUrl,
        });
      } catch (e) {
        console.log("[CollegeHeadsScreen] Draft update failed (non-critical):", e.message);
      }

      // Navigate straight to CommunityPhone (skipping HeadProfilePic)
      navigation.navigate("CommunityPhone", {
        ...params,
        heads: uploadedHeads,
        head_photo_url: headPhotoUrl,
      });
    } catch (err) {
      console.error("[CollegeHeadsScreen] handleNext error:", err);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      const previousScreen = params.isStudentCommunity
        ? "CommunityBio"
        : "CommunityCategory";
      navigation.replace(previousScreen, { ...params });
    }
  };

  const handleCancel = async () => {
    await deleteCommunitySignupDraft();
    setShowCancelModal(false);
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "AuthGate" }],
      })
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
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

          {/* Scrollable content */}
          <ScrollView
            style={styles.contentScrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.contentArea}>
              {/* Title */}
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
                  Add the people who run this page. Tap the circle to add a photo.
                </Animated.Text>
              </View>

              {/* Head cards */}
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
                  {heads.map((head, index) => (
                    <Animated.View
                      key={index}
                      entering={FadeInDown.delay(400 + index * 80)
                        .duration(600)
                        .springify()}
                    >
                      <HeadEntry
                        index={index}
                        name={head.name}
                        role={head.role}
                        photoUri={head.photoUri}
                        onNameChange={(v) => updateHead(index, "name", v)}
                        onRoleChange={(v) => updateHead(index, "role", v)}
                        onRemove={() => removeHead(index)}
                        onPickPhoto={() => handlePickPhoto(index)}
                        isRequired={index === 0}
                        showRemove={index >= 2}
                      />
                    </Animated.View>
                  ))}

                  {/* Add more button */}
                  <TouchableOpacity style={styles.addButton} onPress={addHead} activeOpacity={0.7}>
                    <View style={styles.addButtonIconContainer}>
                      <PlusCircle size={20} color={COLORS.primary} strokeWidth={2.5} />
                    </View>
                    <Text style={styles.addButtonText}>Add Another Head</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>

              {/* Next button */}
              <View style={{ width: "100%", alignItems: "flex-end", marginTop: 40 }}>
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
                      {isSubmitting ? (
                        <View style={styles.loadingRow}>
                          <SnooLoader
                            size="small"
                            color={COLORS.textInverted}
                            style={{ marginRight: 8 }}
                          />
                          <Text style={styles.buttonText}>Uploading…</Text>
                        </View>
                      ) : (
                        <Text style={styles.buttonText}>Next</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Cancel modal */}
        <CancelSignupModal
          visible={showCancelModal}
          onKeepEditing={() => setShowCancelModal(false)}
          onDiscard={handleCancel}
        />
      </SafeAreaView>
    </ImageBackground>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
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
  container: { flex: 1 },
  contentScrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 25,
    paddingBottom: 40,
  },
  contentArea: { marginTop: 40 },
  headerTitle: {
    marginBottom: 32,
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
    fontSize: 15,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
    lineHeight: 22,
  },

  /* Card */
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
      android: { elevation: 0 },
    }),
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
    overflow: "hidden",
  },
  cardContent: { padding: 20, gap: 16 },

  /* Head entry card */
  headEntry: {
    backgroundColor: "rgba(116, 173, 242, 0.08)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(116, 173, 242, 0.18)",
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  entryLabel: {
    fontSize: 13,
    fontFamily: "Manrope-SemiBold",
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  removeButton: { padding: 4 },

  /* Avatar + inputs */
  entryBody: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  avatarButton: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "visible",
    position: "relative",
    flexShrink: 0,
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: "rgba(116, 173, 242, 0.4)",
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.05)",
  },
  cameraBadgeInner: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Inputs column */
  inputsColumn: { flex: 1, gap: 10 },
  input: {
    height: 48,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Manrope-Medium",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    color: COLORS.textPrimary,
  },
  inputRole: {
    height: 44,
    fontSize: 14,
  },
  inputFocused: {
    borderColor: "rgba(255, 255, 255, 0.9)",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
  },

  /* Add button */
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.03)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginTop: 8,
    gap: 12,
  },
  addButtonIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(116, 173, 242, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    color: COLORS.primary,
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
  },

  /* Next button */
  nextButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
  },
  nextButton: {
    height: 56,
    borderRadius: BORDER_RADIUS.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  disabledButton: { opacity: 0.6, shadowOpacity: 0 },
  buttonText: {
    color: COLORS.textInverted,
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});

export default CollegeHeadsScreen;
