import React, { useEffect, useState, useRef } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform, Image, Modal, LayoutAnimation, UIManager, Keyboard } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Camera, Info, X, Video, Trophy } from "lucide-react-native";
import { Ionicons } from "@expo/vector-icons";
import SuccessCard from "../../../components/feedback/SuccessCard";
import HapticsService from "../../../services/HapticsService";
import KeyboardAwareToolbar from "../../../components/KeyboardAwareToolbar";

import ImageUploader from "../../../components/ImageUploader";
import MentionInput from "../../../components/MentionInput";
import EntityTagSelector from "../../../components/EntityTagSelector";
import PostTypeSelector from "../../../components/posts/PostTypeSelector";
import PollCreateForm from "../../../components/posts/PollCreateForm";
import PromptCreateForm from "../../../components/posts/PromptCreateForm";
import QnACreateForm from "../../../components/posts/QnACreateForm";
import ChallengeCreateForm from "../../../components/posts/ChallengeCreateForm";
import { apiPost } from "../../../api/client";
import { getAuthToken } from "../../../api/auth";
import { uploadMultipleMedia } from "../../../api/cloudinary";
import { getCommunityProfile } from "../../../api/communities";
import EventBus from "../../../utils/EventBus";
import { COLORS, FONTS } from "../../../constants/theme";
import GradientButton from "../../../components/GradientButton";
import SnooLoader from "../../../components/ui/SnooLoader";

// Enable LayoutAnimation for Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CommunityCreatePostScreen({ navigation }) {
  const [postType, setPostType] = useState("media"); // media, poll, prompt, qna, challenge
  const [successCardData, setSuccessCardData] = useState(null); // Track data for SuccessCard

  const [caption, setCaption] = useState("");
  const [images, setImages] = useState([]);
  const [aspectRatios, setAspectRatios] = useState([]); // Track aspect ratios for images
  const [mediaTypes, setMediaTypes] = useState([]); // Track media types (image | video)
  const [taggedEntities, setTaggedEntities] = useState([]);
  const [entityTags, setEntityTags] = useState([]); // From EntityTagSelector
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
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [showEntityTagger, setShowEntityTagger] = useState(false);
  const [parentScrollEnabled, setParentScrollEnabled] = useState(true);
  const insets = useSafeAreaInsets();
  const imageUploaderRef = useRef(null);
  const scrollViewRef = useRef(null);
  // ...

  // Auto-scroll when entity tagger opens
  useEffect(() => {
    if (showEntityTagger) {
      // Scroll once immediately after layout update
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Scroll again after keyboard animation might have finished
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 500);
    }
  }, [showEntityTagger]);

  // Handle keyboard show to ensure visibility
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => {
        if (showEntityTagger) {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }
      },
    );

    return () => {
      keyboardDidShowListener.remove();
    };
  }, [showEntityTagger]);

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

      const mergedTags = [
        ...taggedEntities.map((entity) => ({
          id: entity.id,
          type:
            entity.type || entity.entityType || entity.entity_type || "member",
        })),
        ...entityTags.map((entity) => ({
          id: entity.id,
          type:
            entity.type || entity.entityType || entity.entity_type || "member",
        })),
      ];

      const taggedPayload = mergedTags.filter(
        (entry) => entry.id && entry.type,
      );

      const commonPayload = {
        post_type: postType === "text" ? "media" : postType, // "text" is just media without images in backend usually, or treat as media
        caption:
          (postType === "media" || postType === "text" ? caption : null) ||
          null,
      };

      let typePayload = {};

      if (postType === "media" || postType === "text") {
        // ... Log media specific payload ...
        const captionLength = caption?.trim()?.length || 0;
        console.log("[CreatePost] Sending media post data:", {
          captionLength,
          imageCount: finalImageUrls.length,
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
          expires_at: pollData.expires_at,
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
          expires_at: promptData.expires_at,
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

      // Prepare data for SuccessCard
      let successData = {};
      switch (postType) {
        case "media":
          successData = {
            thumbnail: finalImageUrls[0],
            hasVideo: finalMediaTypes[0] === "video",
          };
          break;
        case "poll":
          successData = { ...pollData };
          break;
        case "prompt":
          successData = { ...promptData };
          break;
        case "qna":
          successData = { ...qnaData };
          break;
        case "challenge":
          successData = { ...challengeData };
          break;
      }
      setSuccessCardData(successData);
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

  const handleCreateAnother = () => {
    setShowCelebration(false);
    setCaption("");
    setImages([]);
    setAspectRatios([]);
    setMediaTypes([]);
    setTaggedEntities([]);
    // Optionally reset other forms or keep them for ease of re-creation if desireable,
    // but usually "Create another" implies fresh start or maybe keeping settings.
    // Let's reset the main content but maybe keep some settings?
    // For now, simple reset is safer.

    // Also scroll to top
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleViewPost = () => {
    setShowCelebration(false);
    setCaption("");
    setImages([]);

    // Navigate home/feed to see it
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
      <SuccessCard
        visible={showCelebration}
        type={postType}
        data={successCardData}
        onPrimaryAction={handleViewPost}
        onSecondaryAction={handleCreateAnother}
      />

      <BlurView
        intensity={80}
        tint="light"
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity
          onPress={handleCancel}
          style={styles.closeButton}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <X
            size={26}
            color={COLORS.editorial.textSecondary}
            strokeWidth={2.5}
          />
        </TouchableOpacity>

        <View
          style={[
            styles.headerTitleContainer,
            { top: insets.top + 10, bottom: 12, justifyContent: "center" },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.headerTitle}>New Post</Text>
        </View>

        <GradientButton
          title="Post"
          onPress={() => {
            HapticsService.triggerImpactLight();
            handlePost();
          }}
          disabled={!canSubmit || isPosting}
          loading={isPosting}
          style={[
            {
              width: 80, // Fixed width to match CreatePostScreen.js
              paddingHorizontal: 0,
              paddingVertical: 0,
              borderRadius: 100, // Keep the bill shape as per earlier redesign req
              height: 36,
              justifyContent: "center",
            },
            (!canSubmit || isPosting) && {
              shadowOpacity: 0,
              elevation: 0,
              shadowColor: "transparent",
              backgroundColor: "#E5E7EB", // Soft grey
            },
          ]}
          gradientStyle={{
            paddingHorizontal: 0, // Removed padding to center text in fixed width
            paddingVertical: 0,
            borderRadius: 100,
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          }}
          colors={
            !canSubmit || isPosting
              ? ["#E5E7EB", "#E5E7EB"]
              : ["#007AFF", "#007AFF"] // Solid Blue (iOS style) or Brand Blue
          }
          textStyle={{
            fontFamily: "Manrope-Medium",
            color: !canSubmit || isPosting ? "#9CA3AF" : "#FFFFFF",
            fontSize: 14,
          }}
        />
      </BlurView>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          nestedScrollEnabled={true}
          scrollEnabled={parentScrollEnabled}
        >
          {/* Author Info */}
          <View style={styles.authorInfo}>
            <View style={styles.authorAvatar}>
              {loadingProfile ? (
                <SnooLoader size="small" color={COLORS.primary} />
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

          {/* Post Type Selector (Segmented) */}
          <PostTypeSelector
            selectedType={postType}
            onSelectType={(type) => {
              LayoutAnimation.configureNext(
                LayoutAnimation.Presets.easeInEaseOut,
              );
              setPostType(type);
            }}
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

          {/* Adaptive Composer Section */}
          <View style={styles.composerContainer}>
            {/* Text & Media Composer */}
            {postType === "media" && (
              <View style={styles.composerSection}>
                <MentionInput
                  value={caption}
                  onChangeText={setCaption}
                  onTaggedEntitiesChange={setTaggedEntities}
                  placeholder={
                    "Share something with your network...\nUse @ to mention"
                  }
                  placeholderTextColor="#9CA3AF"
                  maxLength={2000}
                  inputStyle={styles.mainInput}
                  autoFocus={true}
                  multiline={true}
                />

                {caption.length > 0 && (
                  <Text style={styles.counterText}>{caption.length}/2000</Text>
                )}
              </View>
            )}

            {/* Media Specific Controls */}
            {postType === "media" && (
              <View style={styles.mediaSection}>
                {/* Media Uploader */}
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
                    onImagesChange={handleImageSelect}
                    onAspectRatiosChange={handleAspectRatiosChange}
                    onMediaTypesChange={handleMediaTypesChange}
                    initialImages={images}
                    horizontal={true}
                    allowVideos={true}
                  />
                </View>

                {/* Entity Tag Selector (Trophy) */}
                {showEntityTagger && (
                  <View style={styles.entityTaggerContainer}>
                    <EntityTagSelector
                      onEntitiesChange={setEntityTags}
                      initialEntities={entityTags}
                      onInteractionStart={() => setParentScrollEnabled(false)}
                      onInteractionEnd={() => setParentScrollEnabled(true)}
                    />
                  </View>
                )}

                {/* Challenge tag banner (shown when a challenge is tagged) */}
                {entityTags.some((e) => e.type === "challenge") && (
                  <View style={styles.challengeBanner}>
                    <Trophy size={16} color="#FF6B35" />
                    <Text style={styles.challengeBannerText}>
                      {entityTags.find((e) => e.type === "challenge")?.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setEntityTags(
                          entityTags.filter((e) => e.type !== "challenge"),
                        );
                      }}
                      style={styles.closeButtonContainer}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <X size={12} color="#1F2937" strokeWidth={3} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Poll Post Form */}
            {postType === "poll" && (
              <View style={styles.formContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>POLL DETAILS</Text>
                </View>
                <PollCreateForm
                  onDataChange={setPollData}
                  disabled={isPosting}
                />
              </View>
            )}

            {/* Prompt Post Form */}
            {postType === "prompt" && (
              <View style={styles.formContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>PROMPT DETAILS</Text>
                </View>
                <PromptCreateForm
                  onDataChange={setPromptData}
                  disabled={isPosting}
                />
              </View>
            )}

            {/* Q&A Post Form */}
            {postType === "qna" && (
              <View style={styles.formContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Q&A DETAILS</Text>
                </View>
                <QnACreateForm onSubmit={setQnaData} isSubmitting={isPosting} />
              </View>
            )}

            {/* Challenge Post Form */}
            {postType === "challenge" && (
              <View style={styles.formContainer}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>CHALLENGE DETAILS</Text>
                </View>
                <ChallengeCreateForm
                  onSubmit={setChallengeData}
                  isSubmitting={isPosting}
                />
              </View>
            )}
          </View>
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
              style={styles.toolbarButton}
            >
              <Camera
                size={32}
                color={COLORS.editorial.textSecondary}
                strokeWidth={2}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                HapticsService.triggerImpactLight();
                imageUploaderRef.current?.pickVideo();
              }}
              style={styles.toolbarButton}
            >
              <Video
                size={32}
                color={COLORS.editorial.textSecondary}
                strokeWidth={2}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                HapticsService.triggerImpactLight();
                setShowEntityTagger(!showEntityTagger);
              }}
              style={styles.toolbarButton}
            >
              <Trophy
                size={32}
                color={
                  showEntityTagger ? "#FF6B35" : COLORS.editorial.textSecondary
                }
                strokeWidth={2}
              />
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            <TouchableOpacity
              onPress={() => {
                HapticsService.triggerImpactLight();
                setShowGuidelines(true);
              }}
            >
              <Info
                size={32}
                color={COLORS.editorial.textSecondary}
                strokeWidth={2}
              />
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
    paddingHorizontal: 20,
    paddingBottom: 12,
    zIndex: 100,
    // borderBottomWidth: 1, // Removed heavy divider
    // borderBottomColor: "rgba(0,0,0,0.05)",
  },
  closeButton: {
    padding: 8,
  },
  headerTitleContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: -1, // Behind buttons
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: FONTS.black,
    color: COLORS.textPrimary,
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 40, // Reduced from 200 to reduce unused space
  },
  authorInfo: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  authorAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  authorDetails: {
    justifyContent: "center",
  },
  authorName: {
    fontFamily: FONTS.medium,
    fontSize: 16,
    color: "#111827",
  },
  authorType: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: "#6B7280",
  },
  composerSection: {
    paddingHorizontal: 24, // Breathing room
    paddingTop: 8,
  },
  mainInput: {
    fontFamily: FONTS.regular,
    fontSize: 18,
    lineHeight: 26,
    color: "#111827",
    minHeight: 150,
    textAlignVertical: "top",
    paddingTop: 0,
    backgroundColor: "transparent",
  },
  counterText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "right",
    marginTop: 8,
  },
  mediaTrayContainer: {
    marginTop: 16,
    paddingHorizontal: 0,
  },
  formContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  composerContainer: {
    marginTop: 20,
  },
  sectionHeader: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  toolbarContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 12,
    gap: 32,
  },
  toolbarButton: {
    padding: 0,
  },
  mediaSection: {
    paddingHorizontal: 20,
    marginTop: 12,
  },
  entityTaggerContainer: {
    marginTop: 12,
  },
  challengeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3ED",
    marginHorizontal: 20,
    alignSelf: "flex-start", // Left-aligned pill
    marginTop: 12,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    gap: 8,
  },
  challengeBannerText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: "#1F2937",
    marginRight: 4,
  },
  closeButtonContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  subSegmentContainer: {
    flexDirection: "row",
    marginBottom: 16,
  },
  subSegment: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  subSegmentActive: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(41, 98, 255, 0.05)",
  },
  subSegmentText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  subSegmentTextActive: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  mediaHelperText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 8,
    fontStyle: "italic",
    textAlign: "center",
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
