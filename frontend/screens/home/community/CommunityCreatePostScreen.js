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
import { Camera, Info, X } from "lucide-react-native";
import { Ionicons } from "@expo/vector-icons";
import CelebrationModal from "../../../components/CelebrationModal";
import HapticsService from "../../../services/HapticsService";
import KeyboardAwareToolbar from "../../../components/KeyboardAwareToolbar";

import ImageUploader from "../../../components/ImageUploader";
import MentionInput from "../../../components/MentionInput";
import PostTypeSelector from "../../../components/posts/PostTypeSelector";
import PollCreateForm from "../../../components/posts/PollCreateForm";
import PromptCreateForm from "../../../components/posts/PromptCreateForm";
import QnACreateForm from "../../../components/posts/QnACreateForm";
import ChallengeCreateForm from "../../../components/posts/ChallengeCreateForm";
import { apiPost } from "../../../api/client";
import { getAuthToken } from "../../../api/auth";
import {
  uploadMultipleImages,
  uploadMultipleMedia,
} from "../../../api/cloudinary";
import { getCommunityProfile } from "../../../api/communities";
import EventBus from "../../../utils/EventBus";
import { COLORS, SHADOWS } from "../../../constants/theme";
import GradientButton from "../../../components/GradientButton";

// Local constants removed in favor of theme constants

export default function CommunityCreatePostScreen({ navigation }) {
  const [postType, setPostType] = useState("media"); // media, poll, prompt
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState([]);
  const [aspectRatios, setAspectRatios] = useState([]); // Track aspect ratios for images
  const [mediaTypes, setMediaTypes] = useState([]); // Track media types (image | video)
  const [taggedEntities, setTaggedEntities] = useState([]);
  const [pollData, setPollData] = useState({
    question: "",
    options: ["", ""],
    allow_multiple: false,
    show_results_before_vote: false,
  });
  const [promptData, setPromptData] = useState({
    prompt_text: "",
    submission_type: "text",
    max_length: 500,
    require_approval: true,
  });
  const [qnaData, setQnaData] = useState({
    title: "",
    description: "",
    allow_anonymous: false,
    max_questions_per_user: 1,
    expires_at: null,
  });
  const [challengeData, setChallengeData] = useState({
    title: "",
    description: "",
    challenge_type: "single",
    submission_type: "image",
    target_count: 1,
    max_submissions_per_user: 1,
    require_approval: true,
    deadline: null,
  });
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

  // Handle aspect ratios from ImageUploader
  const handleAspectRatiosChange = (newAspectRatios) => {
    setAspectRatios(newAspectRatios);
  };

  // Handle media types from ImageUploader (image | video)
  const handleMediaTypesChange = (newMediaTypes) => {
    setMediaTypes(newMediaTypes);
  };

  const handlePost = async () => {
    // Only require images for media posts
    if (postType === "media" && images.length === 0) {
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
      let finalMediaTypes = [...mediaTypes];
      if (images.length > 0) {
        const localItems = [];
        const remoteItems = [];
        images.forEach((uri, index) => {
          const type = mediaTypes[index] || "image";
          if (uri && uri.startsWith("http")) {
            remoteItems.push({ uri, type, index });
          } else if (uri) {
            localItems.push({ uri, type, index });
          }
        });

        // Upload local items using uploadMultipleMedia
        let uploadedItems = [];
        if (localItems.length > 0) {
          const uploadPayload = localItems.map((item) => ({
            uri: item.uri,
            type: item.type,
          }));
          uploadedItems = await uploadMultipleMedia(uploadPayload);
        }

        // Build final URLs array maintaining order
        let localIndex = 0;
        images.forEach((uri, index) => {
          if (uri && uri.startsWith("http")) {
            finalImageUrls.push(uri);
          } else if (uri) {
            const uploaded = uploadedItems[localIndex++];
            if (uploaded) {
              finalImageUrls.push(uploaded.url);
              // Update media type from upload result if available
              if (uploaded.type) {
                finalMediaTypes[index] = uploaded.type;
              }
            }
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

      const commonPayload = {
        post_type: postType,
        caption: (postType === "media" ? caption : null) || null,
      };

      let typePayload = {};

      if (postType === "media") {
        // ... Log media specific payload ...
        console.log("[CreatePost] Sending media post data:", {
          captionLength: caption?.trim()?.length || 0,
          imageCount: finalImageUrls.length,
          aspectRatiosCount: aspectRatios.length,
        });

        // Convert aspect ratios
        const formattedAspectRatios = aspectRatios.map((ar) => {
          if (Array.isArray(ar) && ar.length === 2) {
            return ar[0] / ar[1];
          }
          return typeof ar === "number" ? ar : 1;
        });

        typePayload = {
          imageUrls: finalImageUrls,
          aspectRatios:
            formattedAspectRatios.length === finalImageUrls.length
              ? formattedAspectRatios
              : null,
          mediaTypes:
            finalMediaTypes.length === finalImageUrls.length
              ? finalMediaTypes
              : null,
          taggedEntities: taggedPayload.length > 0 ? taggedPayload : null,
        };
      } else if (postType === "poll") {
        // Validate poll data
        if (!pollData.question.trim())
          throw new Error("Poll question is required");
        if (pollData.options.filter((o) => o.trim()).length < 2)
          throw new Error("At least 2 options are required");

        typePayload = {
          question: pollData.question,
          options: pollData.options.filter((o) => o.trim()), // Remove empty options
          allow_multiple: pollData.allow_multiple,
          show_results_before_vote: pollData.show_results_before_vote,
        };
      } else if (postType === "prompt") {
        // Validate prompt data
        if (!promptData.prompt_text.trim())
          throw new Error("Prompt text is required");

        typePayload = {
          prompt_text: promptData.prompt_text,
          submission_type: promptData.submission_type,
          max_length: promptData.max_length,
          require_approval: promptData.require_approval,
        };
      } else if (postType === "qna") {
        // Validate Q&A data
        if (!qnaData.title.trim()) throw new Error("Q&A title is required");

        typePayload = {
          title: qnaData.title,
          description: qnaData.description,
          allow_anonymous: qnaData.allow_anonymous,
          max_questions_per_user: qnaData.max_questions_per_user,
          expires_at: qnaData.expires_at,
        };
      } else if (postType === "challenge") {
        // Validate Challenge data
        if (!challengeData.title.trim())
          throw new Error("Challenge title is required");

        typePayload = {
          title: challengeData.title,
          description: challengeData.description,
          challenge_type: challengeData.challenge_type,
          submission_type: challengeData.submission_type,
          target_count: challengeData.target_count,
          max_submissions_per_user: challengeData.max_submissions_per_user,
          require_approval: challengeData.require_approval,
          deadline: challengeData.deadline,
        };
      }

      await apiPost(
        "/posts",
        {
          ...commonPayload,
          ...typePayload,
        },
        15000,
        token,
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
    setAspectRatios([]); // Reset aspect ratios
    setMediaTypes([]); // Reset media types
    setTaggedEntities([]);

    // DELAYED END: Navigate after potential interaction
    HapticsService.triggerImpactLight();
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
              setMediaTypes([]);
              setTaggedEntities([]);
              navigation.goBack();
            },
          },
        ],
      );
    } else {
      HapticsService.triggerImpactLight();
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

  // Determine if submit is allowed based on type
  const canSubmit =
    postType === "media"
      ? images.length > 0 || caption.trim().length > 0
      : postType === "poll"
        ? pollData.question.trim().length > 0 &&
          pollData.options.filter((o) => o.trim()).length >= 2
        : postType === "prompt"
          ? promptData.prompt_text.trim().length > 0
          : postType === "qna"
            ? qnaData.title.trim().length >= 3
            : postType === "challenge"
              ? challengeData.title.trim().length >= 3
              : false;

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

        <GradientButton
          title="Post"
          onPress={() => {
            HapticsService.triggerImpactLight();
            handlePost();
          }}
          disabled={!canSubmit || isPosting}
          loading={isPosting}
          style={[
            { minWidth: 80, paddingHorizontal: 16, paddingVertical: 8 },
            (!canSubmit || isPosting) && {
              shadowOpacity: 0,
              elevation: 0,
              shadowColor: "transparent",
            },
          ]}
        />
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
          {/* Post Type Selector */}
          <PostTypeSelector
            selectedType={postType}
            onSelectType={setPostType}
            disabled={isPosting}
          />

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

          {/* Media Post Form */}
          {postType === "media" && (
            <>
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
                  onImagesChange={handleImageSelect}
                  onAspectRatiosChange={handleAspectRatiosChange}
                  onMediaTypesChange={handleMediaTypesChange}
                  maxImages={5}
                  horizontal={true}
                  initialImages={images}
                  allowVideos={true}
                />
              </View>
            </>
          )}

          {/* Poll Post Form */}
          {postType === "poll" && (
            <PollCreateForm onDataChange={setPollData} disabled={isPosting} />
          )}

          {/* Prompt Post Form */}
          {postType === "prompt" && (
            <PromptCreateForm
              onDataChange={setPromptData}
              disabled={isPosting}
            />
          )}

          {/* Q&A Post Form */}
          {postType === "qna" && (
            <QnACreateForm onSubmit={setQnaData} isSubmitting={isPosting} />
          )}

          {/* Challenge Post Form */}
          {postType === "challenge" && (
            <ChallengeCreateForm
              onSubmit={setChallengeData}
              isSubmitting={isPosting}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {postType === "media" && (
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
      )}
      {renderGuidelinesModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
