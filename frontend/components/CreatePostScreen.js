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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiPost } from "../api/client";
import ImageUploader from "./ImageUploader";
import MentionInput from "./MentionInput";
import { getAuthToken } from "../api/auth";
import { uploadMultipleImages } from "../api/cloudinary";
import EventBus from "../utils/EventBus";
import HapticsService from "../services/HapticsService";

const COLORS = {
  primary: "#5E17EB",
  textDark: "#282C35",
  textLight: "#808080",
  background: "#FFFFFF",
  white: "#fff",
  border: "#E5E5E5",
  cardBg: "#FAFAFA",
};

const CreatePostScreen = ({ navigation, route, onPostCreated }) => {
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState([]);
  const [aspectRatios, setAspectRatios] = useState([]);
  const [taggedEntities, setTaggedEntities] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

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
        ])
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
          token
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
        formattedAspectRatios
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
        token
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
                    const storedUserType = await AsyncStorage.getItem(
                      "user_type"
                    ); // If we store this
                    // Or try to fetch profile again quickly if needed, but for now default to member
                    // Actually, let's try to infer from the previous screen or just default to member
                    // But wait, if we are community, we MUST know it.

                    // Let's check if we can get it from auth_email and profile fetch if absolutely needed
                    // But we already tried loading it in useEffect.

                    // If we are here, it means load failed or is too slow.
                    // Let's check if we have a stored profile in AsyncStorage
                    const storedProfile = await AsyncStorage.getItem(
                      "user_profile"
                    );
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
                  `[CreatePostScreen] Navigating to ${targetScreen} for user type ${userType}`
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
        error.message || "Failed to create post. Please try again."
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
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const canSubmit =
    images.length > 0 && (caption.trim() || taggedEntities.length > 0);

  return (
    <View style={styles.safeArea}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Post</Text>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            onPress={() => {
              HapticsService.triggerImpactLight();
              handleSubmit();
            }}
            disabled={!canSubmit || isSubmitting}
            style={[
              styles.shareButton,
              (!canSubmit || isSubmitting) && styles.shareButtonDisabled,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.shareButtonText}>Share</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
        >
          <View style={styles.composerCard}>
            {/* Caption Input with @ Mention Support */}
            <View style={styles.captionContainer}>
              <MentionInput
                value={caption}
                onChangeText={setCaption}
                onTaggedEntitiesChange={setTaggedEntities}
                placeholder="What's on your mind? Use @ to mention someone..."
                placeholderTextColor={COLORS.textLight}
                maxLength={2000}
                style={styles.mentionInput}
                currentUser={currentUser}
              />
              <Text style={styles.characterCount}>{caption.length}/2000</Text>
            </View>

            {/* Image Uploader */}
            <View style={styles.uploaderContainer}>
              <ImageUploader
                maxImages={10}
                onImagesChange={handleImagesChange}
                onAspectRatiosChange={handleAspectRatiosChange}
                initialImages={images}
              />
              <Text style={styles.addPhotosLabel}>Add Photos</Text>
            </View>
          </View>

          {/* Post Guidelines */}
          <View style={styles.guidelinesContainer}>
            <Text style={styles.guidelinesTitle}>Post Guidelines:</Text>
            <Text style={styles.guideline}>• Be respectful and kind</Text>
            <Text style={styles.guideline}>
              • No spam or inappropriate content
            </Text>
            <Text style={styles.guideline}>
              • Tag relevant people and places
            </Text>
            <Text style={styles.guideline}>• Share meaningful moments</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    zIndex: 10,
  },
  backButton: {
    padding: 4,
    marginRight: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800", // Bolder title as requested
    color: COLORS.textDark,
    textAlign: "center",
  },
  shareButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  shareButtonDisabled: {
    backgroundColor: COLORS.textLight,
  },
  shareButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "600",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 30,
  },
  composerCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 20,
  },
  captionContainer: {
    marginBottom: 12,
    minHeight: 100,
  },
  mentionInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textDark,
  },
  characterCount: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: "right",
    marginTop: 8,
  },
  uploaderContainer: {
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
    paddingTop: 12,
  },
  addPhotosLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textLight,
    marginTop: 4,
    textAlign: "center",
  },
  guidelinesContainer: {
    backgroundColor: "#F8F9FA",
    padding: 15,
    borderRadius: 12,
    marginBottom: 30,
  },
  guidelinesTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 8,
  },
  guideline: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 4,
    lineHeight: 18,
  },
});

export default CreatePostScreen;
