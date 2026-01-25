import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Easing,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Camera, Info, X } from "lucide-react-native";
import { apiPost } from "../api/client";
import ImageUploader from "./ImageUploader";
import MentionInput from "./MentionInput";
import { getAuthToken } from "../api/auth";
import { uploadMultipleImages } from "../api/cloudinary";
import EventBus from "../utils/EventBus";
import HapticsService from "../services/HapticsService";
import GradientButton from "./GradientButton";
import { COLORS, SHADOWS } from "../constants/theme";
import KeyboardAwareToolbar from "./KeyboardAwareToolbar";

// Use theme COLORS imported from constants

const CreatePostScreen = ({ navigation, route, onPostCreated }) => {
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState([]);
  const [aspectRatios, setAspectRatios] = useState([]);
  const [taggedEntities, setTaggedEntities] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const imageUploaderRef = useRef(null);

  // Animation for Share button
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (caption.length > 0 || images.length > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
      pulseAnim.stopAnimation();
    }
  }, [caption, images]);

  // Load current user profile for self-tagging
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const email = await AsyncStorage.getItem("auth_email");
        const token = await getAuthToken();
        if (!email || !token) return;

        const userProfileResponse = await apiPost(
          "/auth/get-user-profile",
          { email },
          15000,
          token,
        );

        const userData = userProfileResponse?.profile;
        if (userData) {
          setCurrentUser({
            id: userData.id,
            type: userData.user_type || "member",
            name: userData.full_name || userData.name || "",
            username: userData.username || "",
            profile_photo_url:
              userData.profile_photo_url || userData.logo_url || null,
          });
        }
      } catch (error) {
        console.error("Error loading current user for tagging:", error);
        // Silent fail - self-tagging just won't be available
      }
    };

    loadCurrentUser();
  }, []);

  const handleImagesChange = (newImages) => {
    setImages(newImages);
  };

  const handleAspectRatiosChange = (newAspectRatios) => {
    setAspectRatios(newAspectRatios);
  };

  const handleSubmit = async () => {
    if (images.length === 0) {
      Alert.alert("No Images", "Please add at least one image to your post");
      return;
    }

    if (!caption.trim() && taggedEntities.length === 0) {
      Alert.alert("Empty Post", "Please add a caption or tag someone");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Upload images to Cloudinary
      const imageUrls = await uploadMultipleImages(images);

      // 2. Prepare tagged entities data
      const taggedEntitiesData = taggedEntities.map((entity) => ({
        id: entity.id,
        type: entity.type,
      }));

      // 3. Get auth token
      const token = await getAuthToken();
      if (!token) {
        throw new Error("Authentication token not found.");
      }

      // 4. Send post data to the backend (include aspectRatios if available)
      console.log("[CreatePostScreen] Sending:", {
        imageCount: imageUrls.length,
        aspectRatiosCount: aspectRatios.length,
        aspectRatios,
      });

      // Convert aspect ratios from [width, height] format to float (width/height)
      // Backend expects floats like 1.0 for 1:1 or 0.8 for 4:5
      const formattedAspectRatios = aspectRatios.map((ar) => {
        if (Array.isArray(ar) && ar.length === 2) {
          return ar[0] / ar[1]; // [1, 1] → 1.0, [4, 5] → 0.8
        }
        return typeof ar === "number" ? ar : 1; // Fallback to 1:1
      });

      console.log(
        "[CreatePostScreen] Formatted aspectRatios:",
        formattedAspectRatios,
      );

      await apiPost(
        "/posts",
        {
          caption: caption.trim(),
          imageUrls,
          aspectRatios:
            formattedAspectRatios.length === imageUrls.length
              ? formattedAspectRatios
              : null,
          taggedEntities: taggedEntitiesData,
        },
        15000,
        token,
      );

      // Emit event to refresh feed
      EventBus.emit("post-created");

      // 5. Success: navigate to Home tab
      HapticsService.triggerNotificationSuccess();
      Alert.alert("Success", "Post created successfully!", [
        {
          text: "OK",
          onPress: () => {
            // Navigate to Home tab for all roles
            // First, close the CreatePost screen
            navigation.goBack();

            // Then navigate to the correct Home screen based on user role
            setTimeout(async () => {
              try {
                // Determine the target screen based on user type
                // Priority: 1. route params, 2. currentUser state, 3. AsyncStorage (fallback)
                let userType = route.params?.role || currentUser?.type;

                if (!userType) {
                  // Fallback: try to get from AsyncStorage if not available in state/params
                  try {
                    const storedUserType =
                      await AsyncStorage.getItem("user_type"); // If we store this
                    // Or try to fetch profile again quickly if needed, but for now default to member
                    // Actually, let's try to infer from the previous screen or just default to member
                    // But wait, if we are community, we MUST know it.

                    // Let's check if we can get it from auth_email and profile fetch if absolutely needed
                    // But we already tried loading it in useEffect.

                    // If we are here, it means load failed or is too slow.
                    // Let's check if we have a stored profile in AsyncStorage
                    const storedProfile =
                      await AsyncStorage.getItem("user_profile");
                    if (storedProfile) {
                      const parsed = JSON.parse(storedProfile);
                      userType = parsed.user_type || parsed.role;
                    }
                  } catch (e) {
                    console.log("Error fetching fallback user type:", e);
                  }
                }

                // Default to member if still unknown
                userType = userType || "member";

                let targetScreen = "MemberHome";
                let params = { screen: "Home" };

                switch (userType) {
                  case "community":
                    targetScreen = "CommunityHome";
                    params = { screen: "Home" };
                    break;
                  case "sponsor":
                    targetScreen = "SponsorHome";
                    params = undefined; // Sponsor uses custom tabs, default is Home
                    break;
                  case "venue":
                    targetScreen = "VenueHome";
                    params = undefined; // Venue uses custom tabs, default is Home
                    break;
                  case "member":
                  default:
                    targetScreen = "MemberHome";
                    params = { screen: "Home" };
                    break;
                }

                console.log(
                  `[CreatePostScreen] Navigating to ${targetScreen} for user type ${userType}`,
                );

                // Navigate to the target screen
                // We use the root navigator (AppNavigator) which CreatePostScreen is part of
                if (params) {
                  navigation.navigate(targetScreen, params);
                } else {
                  navigation.navigate(targetScreen);
                }
              } catch (error) {
                console.log("[CreatePostScreen] Navigation failed:", error);
              }
            }, 100);
          },
        },
      ]);
    } catch (error) {
      console.error("Error creating post:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to create post. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (caption.trim() || images.length > 0) {
      Alert.alert(
        "Discard Post",
        "Are you sure you want to discard this post?",
        [
          { text: "Keep Editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              setCaption("");
              setImages([]);
              setTaggedEntities([]);
              navigation.goBack();
            },
          },
        ],
      );
    } else {
      navigation.goBack();
    }
  };

  const canSubmit = images.length > 0 || caption.trim().length > 0;

  const renderGuidelinesModal = () => (
    <Modal
      visible={showGuidelines}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowGuidelines(false)}
      statusBarTranslucent={true}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowGuidelines(false)}
      >
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Post Guidelines</Text>
          </View>
          <View style={styles.sheetContent}>
            <Text style={styles.guidelineText}>
              • Be respectful and kind to everyone
            </Text>
            <Text style={styles.guidelineText}>
              • No spam or inappropriate content
            </Text>
            <Text style={styles.guidelineText}>
              • Tag relevant people and places
            </Text>
            <Text style={styles.guidelineText}>
              • Share meaningful moments with your community
            </Text>
          </View>
          <TouchableOpacity
            style={styles.sheetCloseButton}
            onPress={() => setShowGuidelines(false)}
          >
            <Text style={styles.sheetCloseButtonText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={styles.safeArea}>
      <BlurView
        intensity={80}
        tint="light"
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
          <X size={24} color={COLORS.textDark} strokeWidth={2.5} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>New Post</Text>

        <GradientButton
          title="Post"
          onPress={() => {
            HapticsService.triggerImpactLight();
            handleSubmit();
          }}
          disabled={!canSubmit || isSubmitting}
          loading={isSubmitting}
          style={[
            { minWidth: 80, paddingHorizontal: 16, paddingVertical: 8 },
            (!canSubmit || isSubmitting) && {
              shadowOpacity: 0,
              elevation: 0,
              shadowColor: "transparent",
            },
          ]}
        />
      </BlurView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.composerSection}>
            <MentionInput
              value={caption}
              onChangeText={setCaption}
              onTaggedEntitiesChange={setTaggedEntities}
              placeholder="What's on your mind? Use @ to mention..."
              placeholderTextColor="#A0A0A0"
              maxLength={2000}
              style={styles.mainInput}
              currentUser={currentUser}
              autoFocus={true}
              multiline={true}
            />

            {caption.length > 0 && (
              <Text style={styles.counterText}>{caption.length}/2000</Text>
            )}
          </View>

          <View
            style={[
              styles.mediaTrayContainer,
              images.length === 0 && {
                marginTop: 0,
                height: 0,
                opacity: 0,
                overflow: "hidden",
              },
            ]}
            pointerEvents={images.length === 0 ? "none" : "auto"}
          >
            <ImageUploader
              ref={imageUploaderRef}
              maxImages={10}
              onImagesChange={handleImagesChange}
              onAspectRatiosChange={handleAspectRatiosChange}
              initialImages={images}
              horizontal={true}
              allowVideos={true}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <KeyboardAwareToolbar>
        <View style={styles.toolbarContent}>
          <TouchableOpacity
            onPress={() => {
              HapticsService.triggerImpactLight();
              imageUploaderRef.current?.openCamera();
            }}
          >
            <Camera size={28} color="#8E8E93" strokeWidth={2} />
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            onPress={() => {
              HapticsService.triggerImpactLight();
              setShowGuidelines(true);
            }}
          >
            <Info size={28} color="#8E8E93" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </KeyboardAwareToolbar>
      {renderGuidelinesModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 100,
  },
  closeButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 10,
    paddingBottom: 100,
  },
  composerSection: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  mainInput: {
    fontSize: 18,
    lineHeight: 26,
    color: COLORS.textDark,
    minHeight: 120,
    textAlignVertical: "top",
  },
  counterText: {
    fontSize: 11,
    color: COLORS.textLight,
    textAlign: "right",
    marginTop: 8,
    fontWeight: "500",
  },
  mediaTrayContainer: {
    marginTop: 20,
    paddingLeft: 20,
  },
  toolbarContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 24,
  },
  // Bottom Sheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    minHeight: 300,
  },
  sheetHeader: {
    alignItems: "center",
    paddingVertical: 12,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: "#E5E5E5",
    borderRadius: 3,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  sheetContent: {
    paddingHorizontal: 24,
    gap: 16,
    marginTop: 10,
  },
  guidelineText: {
    fontSize: 15,
    color: "#555",
    lineHeight: 22,
  },
  sheetCloseButton: {
    backgroundColor: COLORS.cardBg,
    marginHorizontal: 24,
    marginTop: 30,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  sheetCloseButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textDark,
  },
});

export default CreatePostScreen;
