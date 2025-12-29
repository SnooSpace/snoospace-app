import React, { useEffect, useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Camera, Image as ImageIcon, Hash, Info, X } from "lucide-react-native";
import ImageUploader from "../../../components/ImageUploader";
import MentionInput from "../../../components/MentionInput";
import { apiPost } from "../../../api/client";
import { getAuthToken } from "../../../api/auth";
import { uploadMultipleImages } from "../../../api/cloudinary";
import { getCommunityProfile } from "../../../api/communities";
import EventBus from "../../../utils/EventBus";
import { COLORS } from "../../../constants/theme";

// Local constants removed in favor of theme constants

export default function CommunityCreatePostScreen({ navigation }) {
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState([]);
  const [aspectRatios, setAspectRatios] = useState([]); // NEW: Track aspect ratios for images
  const [taggedEntities, setTaggedEntities] = useState([]);
  const [isPosting, setIsPosting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState("");

  const [showCelebration, setShowCelebration] = useState(false);
  const [createdPostData, setCreatedPostData] = useState(null);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const insets = useSafeAreaInsets();
  const imageUploaderRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      try {
        setLoadingProfile(true);
        const res = await getCommunityProfile();
        if (!isMounted) return;
        const profileData = res?.profile || res || null;
        setProfile(profileData);
      } catch (error) {
        if (!isMounted) return;
        setProfileError(error?.message || "Failed to load community profile");
      } finally {
        if (isMounted) setLoadingProfile(false);
      }
    };
    loadProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleImageSelect = (selectedUris) => {
    // selectedUris is an array of strings (local URIs before upload, HTTPS URLs after upload)
    setImages(selectedUris);
  };

  // NEW: Handle aspect ratios from ImageUploader
  const handleAspectRatiosChange = (newAspectRatios) => {
    setAspectRatios(newAspectRatios);
  };

  const handlePost = async () => {
    if (images.length === 0) {
      Alert.alert("Error", "Please add at least one image to your post");
      return;
    }

    try {
      setIsPosting(true);
      setErrorMsg("");

      const token = await getAuthToken();
      if (!token) {
        throw new Error("Authentication token not found.");
      }

      let finalImageUrls = [];
      if (images.length > 0) {
        const localUris = [];
        const remoteUris = [];
        images.forEach((uri) => {
          if (uri && uri.startsWith("http")) {
            remoteUris.push(uri);
          } else if (uri) {
            localUris.push(uri);
          }
        });

        let uploadedUrls = [];
        if (localUris.length > 0) {
          uploadedUrls = await uploadMultipleImages(localUris);
        }

        let uploadIndex = 0;
        images.forEach((uri) => {
          if (uri && uri.startsWith("http")) {
            finalImageUrls.push(uri);
          } else if (uri) {
            finalImageUrls.push(uploadedUrls[uploadIndex++] || null);
          }
        });

        finalImageUrls = finalImageUrls.filter(Boolean);
      }

      const taggedPayload = taggedEntities
        .map((entity) => ({
          id: entity.id,
          type:
            entity.type || entity.entityType || entity.entity_type || "member",
        }))
        .filter((entry) => entry.id && entry.type);

      console.log("[CreatePost] Sending post data:", {
        captionLength: caption?.trim()?.length || 0,
        imageCount: finalImageUrls.length,
        aspectRatiosCount: aspectRatios.length,
        aspectRatios,
        lengthsMatch: aspectRatios.length === finalImageUrls.length,
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
        "[CreatePost] Formatted aspectRatios:",
        formattedAspectRatios
      );

      await apiPost(
        "/posts",
        {
          caption: caption.trim() || null,
          imageUrls: finalImageUrls,
          aspectRatios:
            formattedAspectRatios.length === finalImageUrls.length
              ? formattedAspectRatios
              : null,
          taggedEntities: taggedPayload.length > 0 ? taggedPayload : null,
        },
        15000,
        token
      );

      EventBus.emit("post-created");

      // PEAK MOMENT: Trigger celebration instead of immediate navigation
      setShowCelebration(true);
    } catch (error) {
      console.error("Error creating post:", error);
      const message =
        error?.response?.data?.error ||
        error?.message ||
        "Failed to create post";
      setErrorMsg(message);
      Alert.alert("Error", message);
    } finally {
      setIsPosting(false);
    }
  };

  const handleCelebrationClose = () => {
    setShowCelebration(false);
    setCaption("");
    setImages([]);
    setAspectRatios([]); // NEW: Reset aspect ratios
    setTaggedEntities([]);

    // DELAYED END: Navigate after potential interaction
    navigation.navigate("CommunityHome", {
      screen: "Home",
      params: {
        screen: "HomeFeed",
        params: { refresh: Date.now() },
      },
    });
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
              setAspectRatios([]);
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

  const renderGuidelinesModal = () => (
    <Modal
      visible={showGuidelines}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowGuidelines(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowGuidelines(false)}
      >
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Community Post Guidelines</Text>
          </View>
          <View style={styles.sheetContent}>
            <Text style={styles.guidelineText}>
              • Share updates about community events and activities
            </Text>
            <Text style={styles.guidelineText}>
              • Tag relevant members and partners
            </Text>
            <Text style={styles.guidelineText}>
              • Keep content relevant to your community
            </Text>
            <Text style={styles.guidelineText}>
              • Be respectful and inclusive
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

  const canSubmit = images.length > 0 || caption.trim().length > 0;

  return (
    <View style={styles.container}>
      <CelebrationModal
        visible={showCelebration}
        onClose={handleCelebrationClose}
        type="post"
      />

      <BlurView
        intensity={80}
        tint="light"
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
          <X size={24} color={COLORS.textPrimary} strokeWidth={2.5} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>New Post</Text>

        <TouchableOpacity
          onPress={handlePost}
          disabled={!canSubmit || isPosting}
          style={[
            styles.postButton,
            (!canSubmit || isPosting) && styles.postButtonDisabled,
          ]}
        >
          {isPosting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </BlurView>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {errorMsg ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMsg}</Text>
              <TouchableOpacity onPress={handlePost} disabled={isPosting}>
                <Text style={styles.retryText}>
                  {isPosting ? "Posting..." : "Retry"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Author Info */}
          <View style={styles.authorInfo}>
            <View style={styles.authorAvatar}>
              {loadingProfile ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : profile?.logo_url ? (
                <Image
                  source={{ uri: profile.logo_url }}
                  style={styles.authorAvatarImage}
                />
              ) : (
                <Ionicons name="people" size={20} color={COLORS.primary} />
              )}
            </View>
            <View style={styles.authorDetails}>
              <Text style={styles.authorName}>
                {profile?.name || "Your Community"}
              </Text>
              <Text style={styles.authorType}>
                {profile?.username ? `@${profile.username}` : "Community"}
              </Text>
            </View>
          </View>

          {/* Caption Input */}
          <View style={styles.composerSection}>
            <MentionInput
              value={caption}
              onChangeText={setCaption}
              onTaggedEntitiesChange={setTaggedEntities}
              placeholder="What's happening? Use @ to mention..."
              placeholderTextColor="#A0A0A0"
              maxLength={2000}
              style={styles.mainInput}
              autoFocus={true}
            />

            {caption.length > 0 && (
              <Text style={styles.counterText}>{caption.length}/2000</Text>
            )}
          </View>

          {/* Horizontal Image Tray */}
          <View
            style={[
              styles.mediaTrayContainer,
              images.length === 0 && { marginTop: 0, height: 0, opacity: 0 },
            ]}
          >
            <ImageUploader
              ref={imageUploaderRef}
              onImagesChange={handleImageSelect}
              onAspectRatiosChange={handleAspectRatiosChange}
              maxImages={5}
              horizontal={true}
              initialImages={images}
            />
          </View>
        </ScrollView>

        <View style={styles.toolbar}>
          <View style={styles.toolbarContent}>
            <TouchableOpacity
              onPress={() => {
                imageUploaderRef.current?.openCamera();
              }}
            >
              <Camera size={22} color={COLORS.primary} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                imageUploaderRef.current?.pick();
              }}
            >
              <ImageIcon size={22} color={COLORS.primary} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                /* Trigger Hash/Tag */
              }}
            >
              <Hash size={22} color={COLORS.primary} strokeWidth={2} />
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            <TouchableOpacity onPress={() => setShowGuidelines(true)}>
              <Info size={22} color={COLORS.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
      {renderGuidelinesModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  keyboardView: {
    flex: 1,
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
    color: COLORS.textPrimary,
  },
  postButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 25,
    minWidth: 70,
    alignItems: "center",
  },
  postButtonDisabled: {
    opacity: 0.5,
    backgroundColor: "#E5E5EA",
  },
  postButtonText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  authorInfo: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F8F5FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  authorAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  authorDetails: {
    flex: 1,
  },
  authorName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  authorType: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  composerSection: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  mainInput: {
    fontSize: 18,
    lineHeight: 26,
    color: COLORS.textPrimary,
    minHeight: 120,
    textAlignVertical: "top",
  },
  counterText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: "right",
    marginTop: 8,
    fontWeight: "500",
  },
  mediaTrayContainer: {
    marginTop: 20,
    paddingLeft: 20,
  },
  toolbar: {
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    backgroundColor: "#FFF",
    paddingBottom: Platform.OS === "ios" ? 34 : 10,
  },
  toolbarContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 24,
  },
  errorBanner: {
    backgroundColor: "#FFE5E5",
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 20,
    marginVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  errorText: {
    fontSize: 14,
    color: "#FF3B30",
    flex: 1,
  },
  retryText: {
    fontSize: 14,
    color: "#FF3B30",
    fontWeight: "600",
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
    color: COLORS.textPrimary,
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
    backgroundColor: "#F8F9FA",
    marginHorizontal: 24,
    marginTop: 30,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  sheetCloseButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
});
