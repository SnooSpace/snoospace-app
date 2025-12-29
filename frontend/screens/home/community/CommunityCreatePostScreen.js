import React, { useEffect, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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
              setAspectRatios([]); // NEW: Reset aspect ratios
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

  return (
    <SafeAreaView style={styles.container}>
      <CelebrationModal
        visible={showCelebration}
        onClose={handleCelebrationClose}
        type="post"
      />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Create Post</Text>

          <TouchableOpacity
            onPress={handlePost}
            style={[
              styles.postButton,
              images.length === 0 && styles.postButtonDisabled,
            ]}
            disabled={images.length === 0 || isPosting}
          >
            <Text
              style={[
                styles.postButtonText,
                images.length === 0 && styles.postButtonTextDisabled,
              ]}
            >
              {isPosting ? "Posting..." : "Post"}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
                <Ionicons name="people" size={24} color={COLORS.primary} />
              )}
            </View>
            <View style={styles.authorDetails}>
              <Text style={styles.authorName}>
                {profile?.name || "Your Community"}
              </Text>
              {profileError ? (
                <Text style={styles.authorError}>{profileError}</Text>
              ) : (
                <Text style={styles.authorType}>
                  {profile?.username ? `@${profile.username}` : "Community"}
                </Text>
              )}
            </View>
          </View>

          {/* Caption Input with @ Mention Support */}
          <View style={styles.captionContainer}>
            <MentionInput
              value={caption}
              onChangeText={setCaption}
              onTaggedEntitiesChange={setTaggedEntities}
              placeholder="What's happening in your community? Use @ to mention someone..."
              placeholderTextColor={COLORS.textSecondary}
              maxLength={2000}
              style={styles.mentionInput}
            />
          </View>

          {/* Image Uploader */}
          <View style={styles.imageSection}>
            <Text style={styles.sectionTitle}>Add Photos</Text>
            <ImageUploader
              onImagesChange={handleImageSelect}
              onAspectRatiosChange={handleAspectRatiosChange}
              maxImages={5}
            />
          </View>

          {/* Post Guidelines */}
          <View style={styles.guidelinesContainer}>
            <Text style={styles.guidelinesTitle}>
              Community Post Guidelines
            </Text>
            <Text style={styles.guidelinesText}>
              • Share updates about community events and activities{"\n"}• Tag
              relevant members and partners{"\n"}• Keep content relevant to your
              community{"\n"}• Be respectful and inclusive
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  cancelButton: {
    padding: 5,
  },
  cancelText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.textPrimary,
  },
  postButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonDisabled: {
    backgroundColor: "#E5E5EA",
  },
  postButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  postButtonTextDisabled: {
    color: COLORS.textSecondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  authorInfo: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  authorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F8F5FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  authorAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  authorDetails: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.textPrimary,
  },
  authorType: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  authorError: {
    fontSize: 12,
    color: "#FF3B30",
  },
  captionContainer: {
    paddingVertical: 20,
  },
  captionInput: {
    fontSize: 16,
    color: COLORS.textPrimary,
    minHeight: 100,
    textAlignVertical: "top",
  },
  imageSection: {
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  tagSection: {
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 15,
  },
  guidelinesContainer: {
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
    marginBottom: 20,
  },
  guidelinesTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  guidelinesText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  errorBanner: {
    backgroundColor: "#FFE5E5",
    padding: 12,
    borderRadius: 8,
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
});
