import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Easing,
  Modal,
  Keyboard,
  LayoutAnimation,
  UIManager,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Camera, Info, X, Video, Trophy, AlertTriangle } from "lucide-react-native";
import { apiPost } from "../api/client";
import ImageUploader from "./ImageUploader";
import MentionInput from "./MentionInput";
import EntityTagSelector from "./EntityTagSelector";
import { getAuthToken } from "../api/auth";
import { uploadMultipleImages, uploadMultipleMedia } from "../api/cloudinary";
import EventBus from "../utils/EventBus";

import HapticsService from "../services/HapticsService";
import GradientButton from "./GradientButton";
import { COLORS, SHADOWS, FONTS } from "../constants/theme";
import KeyboardAwareToolbar from "./KeyboardAwareToolbar";
import { Ionicons } from "@expo/vector-icons";
import SnooLoader from "./ui/SnooLoader";
import CustomAlertModal from "./ui/CustomAlertModal";

// ── Creator post-type components (only loaded/used when Creator Mode is ON) ────
import PostTypeSelector from "./posts/PostTypeSelector";
import PollCreateForm from "./posts/PollCreateForm";
import PromptCreateForm from "./posts/PromptCreateForm";
import QnACreateForm from "./posts/QnACreateForm";
import ChallengeCreateForm from "./posts/ChallengeCreateForm";
import SuccessCard from "./feedback/SuccessCard";

// Enable LayoutAnimation for Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CreatePostScreen = ({ navigation, route, onPostCreated }) => {
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState([]);
  const [aspectRatios, setAspectRatios] = useState([]);
  const [cropMetadata, setCropMetadata] = useState([]); // Track crop metadata (scale, translate)
  const cropMetadataRef = useRef([]); // Ref mirror — always current, survives async closures
  const [mediaTypes, setMediaTypes] = useState([]); // Track 'image' or 'video' for each media item
  const [mutedVideoIndices, setMutedVideoIndices] = useState(new Set()); // NEW: Track muted video indices
  const [taggedEntities, setTaggedEntities] = useState([]);
  const [entityTags, setEntityTags] = useState([]); // From EntityTagSelector (challenges, etc.)

  // Derive the tagged challenge's submission_type to lock the media picker
  const taggedChallenge = entityTags.find((e) => e.type === "challenge");
  const challengeSubmissionType = taggedChallenge?.submission_type || null; // null = no restriction
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showEntityTagger, setShowEntityTagger] = useState(false);
  const [parentScrollEnabled, setParentScrollEnabled] = useState(true);
  // Media-challenge conflict modal
  const [conflictModal, setConflictModal] = useState({
    visible: false,
    title: "",
    message: "",
    onProceed: null,
  });

  // ── Creator Mode post type state ─────────────────────────────────────────────
  // postType is only used when currentUser.is_creator_mode_enabled = true.
  // Default is 'media' so the existing flow is unchanged for non-creators.
  const [postType, setPostType] = useState("media");
  const [showRemoveMediaModal, setShowRemoveMediaModal] = useState(false);
  const [pendingPostType, setPendingPostType] = useState(null);
  const [successCardData, setSuccessCardData] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);

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

  const imageUploaderRef = useRef(null);
  const scrollViewRef = useRef(null);
  // ...

  // Auto-close the tagger the moment a challenge is selected
  // (EntityTagSelector returns null at that point, but showEntityTagger
  //  would stay true — causing scrollToEnd to fire every time the
  //  keyboard opens, which scrolls the caption off-screen)
  useEffect(() => {
    if (entityTags.some((e) => e.type === "challenge")) {
      setShowEntityTagger(false);
    }
  }, [entityTags]);

  // Auto-scroll when entity tagger opens (only while no challenge tagged)
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

  // Handle keyboard show to ensure entity tagger search is visible
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => {
        // Only scroll to end when the tagger panel is actively open
        // (not when a challenge is tagged — that causes caption to scroll off-screen)
        if (showEntityTagger && !entityTags.some((e) => e.type === "challenge")) {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }
      },
    );

    return () => {
      keyboardDidShowListener.remove();
    };
  }, [showEntityTagger]);

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

  // Load current user profile for self-tagging + creator mode flag
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
            // Creator Mode flag — gates the PostTypeSelector UI
            is_creator_mode_enabled: userData.is_creator_mode_enabled === true,
          });
        }
      } catch (error) {
        console.error("Error loading current user for tagging:", error);
        // Silent fail - self-tagging just won't be available
      }
    };

    loadCurrentUser();
  }, []);

  const isCreator = currentUser?.is_creator_mode_enabled === true;

  const handleImagesChange = (newImages) => {
    setImages(newImages);
  };

  const handleAspectRatiosChange = (newAspectRatios) => {
    setAspectRatios(newAspectRatios);
  };

  const handleCropMetadataChange = (newMetadata) => {
    console.log("[CreatePostScreen] handleCropMetadataChange called:", {
      length: newMetadata?.length,
      items: newMetadata?.map((m) => ({
        mediaType: m?.mediaType,
        hasUserCrop: m?.hasUserCrop,
        scale: m?.scale,
      })),
    });
    setCropMetadata(newMetadata);
    cropMetadataRef.current = newMetadata; // Keep ref in sync
  };

  const handleMediaTypesChange = (newMediaTypes) => {
    setMediaTypes(newMediaTypes);
  };

  // NEW: Handle muted video indices from ImageUploader
  const handleMutedIndicesChange = (newMutedSet) => {
    setMutedVideoIndices(newMutedSet);
  };

  const navigateHome = async () => {
    // Navigate to the correct Home screen based on user role
    try {
      // Determine the target screen based on user type
      // Priority: 1. route params, 2. currentUser state, 3. AsyncStorage (fallback)
      let userType = route.params?.role || currentUser?.type;

      if (!userType) {
        // Fallback: try to get from AsyncStorage if not available in state/params
        try {
          const storedUserType = await AsyncStorage.getItem("user_type"); // If we store this
          // Or try to fetch profile again quickly if needed, but for now default to member
          // Actually, let's try to infer from the previous screen or just default to member
          // But wait, if we are community, we MUST know it.

          // Let's check if we can get it from auth_email and profile fetch if absolutely needed
          // But we already tried loading it in useEffect.

          // If we are here, it means load failed or is too slow.
          // Let's check if we have a stored profile in AsyncStorage
          const storedProfile = await AsyncStorage.getItem("user_profile");
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
  };



  // ── canSubmit — accounts for all post types ──────────────────────────────────
  const canSubmit = (() => {
    if (postType === "media") {
      return images.length > 0 || caption.trim().length > 0;
    }
    if (postType === "poll") {
      return pollData.question.trim().length > 0 &&
        pollData.options.filter((o) => o.trim()).length >= 2;
    }
    if (postType === "prompt") return promptData.prompt_text.trim().length > 0;
    if (postType === "qna")  return qnaData.title.trim().length >= 3;
    if (postType === "challenge") return challengeData.title.trim().length >= 3;
    return false;
  })();

  const handleSubmit = async () => {
    // ── Media post (original flow) ─────────────────────────────────────────────
    if (postType === "media") {
      if (images.length === 0) {
        Alert.alert("No Media", "Please add at least one photo or video to your post");
        return;
      }

      if (!caption.trim() && taggedEntities.length === 0) {
        Alert.alert("Empty Post", "Please add a caption or tag someone");
        return;
      }

      // Validate media type matches tagged challenge requirement
      if (challengeSubmissionType) {
        const hasVideo = mediaTypes.some((t) => t === "video");
        const hasImage = mediaTypes.some((t) => t === "image" || !t);

        if (challengeSubmissionType === "video" && !hasVideo) {
          Alert.alert("Wrong Media Type", "This challenge requires a video submission. Please add a video.");
          return;
        }
        if (challengeSubmissionType === "video" && hasImage) {
          Alert.alert("Wrong Media Type", "This challenge only accepts videos. Please remove any photos.");
          return;
        }
        if (challengeSubmissionType === "image" && hasVideo) {
          Alert.alert("Wrong Media Type", "This challenge only accepts photos. Please remove the video.");
          return;
        }
      }

      setIsSubmitting(true);
      try {
        const mediaItems = images.map((uri, index) => ({
          uri,
          type: mediaTypes[index] || "image",
        }));

        const uploadedResults = await uploadMultipleMedia(mediaItems);
        const imageUrls = uploadedResults.map((result) => result.url);

        const allTaggedEntities = [
          ...taggedEntities.map((entity) => ({ id: entity.id, type: entity.type })),
          ...entityTags.map((entity) => ({ id: entity.id, type: entity.type })),
        ];

        const token = await getAuthToken();
        if (!token) throw new Error("Authentication token not found.");

        const resolvedCropMetadata =
          cropMetadataRef.current?.length > 0
            ? cropMetadataRef.current
            : cropMetadata;

        console.log("[CreatePostScreen] Submitting media post:", {
          imageCount: imageUrls.length,
          cropMetadataLength: resolvedCropMetadata.length,
          cropMetadataSource: cropMetadataRef.current?.length > 0 ? "ref" : "state",
          cropMetadataLengthMatch: resolvedCropMetadata.length === imageUrls.length,
          cropMeta: resolvedCropMetadata.map((m) => ({
            mediaType: m?.mediaType,
            hasUserCrop: m?.hasUserCrop,
            scale: m?.scale,
            translateX: m?.translateX,
            translateY: m?.translateY,
            displayWidth: m?.displayWidth,
            displayHeight: m?.displayHeight,
            videoPixelWidth: m?.videoPixelWidth,
            videoPixelHeight: m?.videoPixelHeight,
            hasAspectRatio: !!m?.aspectRatio,
            aspectRatio: m?.aspectRatio,
          })),
        });

        const formattedAspectRatios = aspectRatios.map((ar) => {
          if (Array.isArray(ar) && ar.length === 2) return ar[0] / ar[1];
          return typeof ar === "number" ? ar : 1;
        });

        let finalCropMetadata = null;
        if (resolvedCropMetadata.length > 0) {
          if (resolvedCropMetadata.length === imageUrls.length) {
            finalCropMetadata = resolvedCropMetadata;
          } else if (resolvedCropMetadata.length > imageUrls.length) {
            finalCropMetadata = resolvedCropMetadata.slice(0, imageUrls.length);
          } else {
            finalCropMetadata = [
              ...resolvedCropMetadata,
              ...Array(imageUrls.length - resolvedCropMetadata.length).fill(null),
            ];
          }
          console.log("[CreatePostScreen] Final cropMetadata:", finalCropMetadata?.length, "items (was", resolvedCropMetadata.length, ")");
        }

        await apiPost(
          "/posts",
          {
            post_type: "media",
            caption: caption.trim(),
            imageUrls,
            aspectRatios: formattedAspectRatios.length === imageUrls.length ? formattedAspectRatios : null,
            mediaTypes: mediaTypes.length === imageUrls.length ? mediaTypes : null,
            cropMetadata: finalCropMetadata,
            mutedIndices: mutedVideoIndices.size > 0 ? [...mutedVideoIndices] : null,
            taggedEntities: allTaggedEntities,
          },
          15000,
          token,
        );

        EventBus.emit("post-created");
        navigation.goBack();
        setTimeout(() => { navigateHome(); }, 100);
      } catch (error) {
        console.error("Error creating post:", error);
        Alert.alert("Error", error.message || "Failed to create post. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // ── Creator-only post types (Poll / Prompt / Q&A / Challenge) ──────────────
    setIsSubmitting(true);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Authentication token not found.");

      let typePayload = {};

      if (postType === "poll") {
        if (!pollData.question.trim()) throw new Error("Poll question is required");
        if (pollData.options.filter((o) => o.trim()).length < 2) throw new Error("At least 2 options are required");
        typePayload = {
          question: pollData.question,
          options: pollData.options.filter((o) => o.trim()),
          allow_multiple: pollData.allow_multiple,
          show_results_before_vote: pollData.show_results_before_vote,
          expires_at: pollData.expires_at,
        };
      } else if (postType === "prompt") {
        if (!promptData.prompt_text.trim()) throw new Error("Prompt text is required");
        typePayload = {
          prompt_text: promptData.prompt_text,
          submission_type: promptData.submission_type,
          max_length: promptData.max_length,
          require_approval: promptData.require_approval,
          expires_at: promptData.expires_at,
        };
      } else if (postType === "qna") {
        if (!qnaData.title.trim()) throw new Error("Q&A title is required");
        typePayload = {
          title: qnaData.title,
          description: qnaData.description,
          allow_anonymous: qnaData.allow_anonymous,
          max_questions_per_user: qnaData.max_questions_per_user,
          expires_at: qnaData.expires_at,
        };
      } else if (postType === "challenge") {
        if (!challengeData.title.trim()) throw new Error("Challenge title is required");
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
        { post_type: postType, ...typePayload },
        15000,
        token,
      );

      EventBus.emit("post-created");

      // Show the SuccessCard overlay (same as CommunityCreatePostScreen)
      let successData = {};
      if (postType === "poll")        successData = { ...pollData };
      if (postType === "prompt")      successData = { ...promptData };
      if (postType === "qna")         successData = { ...qnaData };
      if (postType === "challenge")   successData = { ...challengeData };
      setSuccessCardData(successData);
      setShowCelebration(true);
    } catch (error) {
      console.error("[CreatePostScreen] Creator post error:", error);
      Alert.alert("Error", error.message || "Failed to create post. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── SuccessCard handlers ───────────────────────────────────────────────────
  const handleCreateAnother = () => {
    setShowCelebration(false);
    setCaption("");
    setImages([]);
    setAspectRatios([]);
    setMediaTypes([]);
    setTaggedEntities([]);
    setEntityTags([]);
    setCropMetadata([]);
    cropMetadataRef.current = [];
    setMutedVideoIndices(new Set());
    setShowEntityTagger(false);
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleViewCreatorPost = () => {
    setShowCelebration(false);
    navigation.goBack();
    HapticsService.triggerImpactLight();
    setTimeout(() => { navigateHome(); }, 100);
  };

  // ── Remove-media confirmation (when switching type while media is attached) ──
  const renderRemoveMediaModal = () => (
    <CustomAlertModal
      visible={showRemoveMediaModal}
      onClose={() => setShowRemoveMediaModal(false)}
      title="Remove Media?"
      message="Switching post types will remove your attached media. Continue?"
      icon={AlertTriangle}
      iconColor="#FF3B30"
      primaryAction={{
        text: "Remove & Switch",
        style: "destructive",
        onPress: () => {
          setImages([]);
          setAspectRatios([]);
          setMediaTypes([]);
          setMutedVideoIndices(new Set());
          setCropMetadata([]);
          cropMetadataRef.current = [];
          setEntityTags([]);
          setShowEntityTagger(false);
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          if (pendingPostType) setPostType(pendingPostType);
          setShowRemoveMediaModal(false);
          setPendingPostType(null);
        },
      }}
      secondaryAction={{
        text: "Cancel",
        onPress: () => {
          setShowRemoveMediaModal(false);
          setPendingPostType(null);
        },
      }}
    />
  );

  const handleCancel = () => {
    if (caption.trim() || images.length > 0) {
      setShowDiscardModal(true);
    } else {
      navigation.goBack();
    }
  };

  /**
   * handleBeforeChallengeSelect
   * Intercepts challenge selection from EntityTagSelector.
   * If the already-loaded media conflicts with the challenge's submission_type,
   * shows a modal explaining what will be selectively removed, then calls proceed().
   * Selective removal: only the incompatible media type is cleared; compatible media stays.
   */
  const handleBeforeChallengeSelect = (challenge, proceed) => {
    const subType = challenge.type_data?.submission_type || "image";
    const hasVideos = mediaTypes.some((t) => t === "video");
    const hasPhotos = mediaTypes.some((t) => t !== "video") && images.length > 0;
    const hasAnyMedia = images.length > 0;

    if (!hasAnyMedia) {
      // No media attached — no conflict, proceed immediately
      proceed();
      return;
    }

    let title = "";
    let message = "";
    let typeToRemove = null;

    if (subType === "video" && hasPhotos) {
      typeToRemove = "image";
      if (hasVideos) {
        // Mixed: photos + video — only photos will go, video stays
        title = "Photos Will Be Removed";
        message = `“${challenge.title}” only accepts video submissions. Your selected photos will be removed, but your video will stay. Tap Continue to proceed.`;
      } else {
        // Only photos — all cleared
        title = "Photos Will Be Removed";
        message = `“${challenge.title}” only accepts video submissions. Your selected photos will be removed. You’ll need to add a video before submitting.`;
      }
    } else if (subType === "image" && hasVideos) {
      typeToRemove = "video";
      if (hasPhotos) {
        // Mixed: photos + video — only video will go, photos stay
        title = "Video Will Be Removed";
        message = `“${challenge.title}” only accepts photo submissions. Your video will be removed, but your selected photos will stay.`;
      } else {
        // Only video — all cleared
        title = "Video Will Be Removed";
        message = `“${challenge.title}” only accepts photo submissions. Your selected video will be removed. You’ll need to add photos before submitting.`;
      }
    } else {
      // No conflict (photos → photo challenge, or video → video challenge)
      proceed();
      return;
    }

    setConflictModal({
      visible: true,
      title,
      message,
      onProceed: () => {
        if (typeToRemove) {
          imageUploaderRef.current?.removeItemsOfType(typeToRemove);
        }
        proceed();
      },
    });
  };

  const renderDiscardModal = () => (
    <CustomAlertModal
      visible={showDiscardModal}
      onClose={() => setShowDiscardModal(false)}
      title="Discard Post"
      message="Are you sure you want to discard this post? All your progress will be lost."
      icon={AlertTriangle}
      iconColor="#FF3B30"
      primaryAction={{
        text: "Discard",
        style: "destructive",
        onPress: () => {
          setCaption("");
          setImages([]);
          setTaggedEntities([]);
          navigation.goBack();
        },
      }}
      secondaryAction={{
        text: "Keep Editing",
        onPress: () => setShowDiscardModal(false),
      }}
    />
  );

  const renderConflictModal = () => (
    <CustomAlertModal
      visible={conflictModal.visible}
      onClose={() => setConflictModal((prev) => ({ ...prev, visible: false }))}
      title={conflictModal.title}
      message={conflictModal.message}
      icon={AlertTriangle}
      iconColor="#F59E0B"
      primaryAction={{
        text: "Continue",
        onPress: () => {
          setConflictModal((prev) => ({ ...prev, visible: false }));
          conflictModal.onProceed?.();
        },
      }}
      secondaryAction={{
        text: "Cancel",
        onPress: () => setConflictModal((prev) => ({ ...prev, visible: false })),
      }}
    />
  );

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
      {/* SuccessCard for creator post types */}
      {showCelebration && (
        <SuccessCard
          visible={showCelebration}
          type={postType}
          data={successCardData}
          onPrimaryAction={handleViewCreatorPost}
          onSecondaryAction={handleCreateAnother}
        />
      )}
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
          <Text style={styles.headerTitle}>
            {postType === "poll" ? "New Poll"
              : postType === "prompt" ? "New Prompt"
              : postType === "qna" ? "New Q&A"
              : postType === "challenge"    ? "New Challenge"
              : "New Post"}
          </Text>
        </View>

        <GradientButton
          title="Post"
          onPress={() => {
            HapticsService.triggerImpactLight();
            handleSubmit();
          }}
          disabled={!canSubmit || isSubmitting}
          loading={isSubmitting}
          style={[
            {
              width: 80,
              paddingHorizontal: 0,
              paddingVertical: 0,
              borderRadius: 20,
              height: 36,
              justifyContent: "center",
            },
            (!canSubmit || isSubmitting) && {
              shadowOpacity: 0,
              elevation: 0,
              shadowColor: "transparent",
              backgroundColor: "#D1D5DB",
            },
          ]}
          gradientStyle={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          }}
          colors={
            !canSubmit || isSubmitting
              ? ["#D1D5DB", "#D1D5DB"]
              : ["#448AFF", "#2962FF"]
          }
          textStyle={{
            fontFamily: FONTS.semiBold,
            color: "#FFFFFF",
            fontSize: 14,
          }}
          {...(canSubmit && !isSubmitting
            ? {
                shadowColor: "rgba(41, 98, 255, 0.18)",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 1,
                shadowRadius: 8,
                elevation: 4,
              }
            : {})}
        />
      </BlurView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          scrollEnabled={parentScrollEnabled}
        >
          {/* Identity Row */}
          {currentUser && (
            <View style={styles.identityRow}>
              <View style={styles.avatarContainer}>
                {currentUser.profile_photo_url ? (
                  <Animated.Image
                    source={{ uri: currentUser.profile_photo_url }}
                    style={styles.identityAvatar}
                  />
                ) : (
                  <View
                    style={[
                      styles.identityAvatar,
                      { backgroundColor: "#E5E7EB" },
                    ]}
                  />
                )}
              </View>
              <View style={styles.identityTextContainer}>
                <Text style={styles.identityName}>{currentUser.name}</Text>
                <Text style={styles.identityUsername}>
                  @{currentUser.username}
                </Text>
              </View>
            </View>
          )}

          {/* Post Type Selector — only visible to Creator Mode members */}
          {isCreator && (
            <PostTypeSelector
              selectedType={postType}
              onSelectType={(type) => {
                if (type === postType) return;
                // Opportunity → navigate to the full wizard
                if (type === "opportunity") {
                  navigation.navigate("CreateOpportunity");
                  return;
                }
                // Guard: switching away from media while items are attached
                if (postType === "media" && images.length > 0) {
                  setPendingPostType(type);
                  setShowRemoveMediaModal(true);
                  return;
                }
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setPostType(type);
              }}
              disabled={isSubmitting}
            />
          )}

          {/* ── Media composer (shown for 'media' type) ──────────────────────── */}
          {postType === "media" && (
            <View style={styles.composerSection}>
              <MentionInput
                value={caption}
                onChangeText={setCaption}
                onTaggedEntitiesChange={setTaggedEntities}
                placeholder={
                  taggedChallenge
                    ? challengeSubmissionType === "video"
                      ? "Describe what you did in this video...\nUse @ to mention"
                      : "Describe how you completed this challenge...\nUse @ to mention"
                    : "Share something with your network...\nUse @ to mention"
                }
                placeholderTextColor="#9CA3AF"
                maxLength={2000}
                inputStyle={styles.mainInput}
                currentUser={currentUser}
                autoFocus={postType === "media"}
                multiline={true}
              />

              {caption.length > 0 && (
                <Text style={styles.counterText}>{caption.length}/2000</Text>
              )}
            </View>
          )}

          {/* ── Poll form ────────────────────────────────────────────────────── */}
          {postType === "poll" && (
            <View style={styles.formContainer}>
              <View style={styles.formSectionHeader}>
                <Text style={styles.formSectionTitle}>POLL DETAILS</Text>
              </View>
              <PollCreateForm onDataChange={setPollData} disabled={isSubmitting} />
            </View>
          )}

          {/* ── Prompt form ──────────────────────────────────────────────────── */}
          {postType === "prompt" && (
            <View style={styles.formContainer}>
              <View style={styles.formSectionHeader}>
                <Text style={styles.formSectionTitle}>PROMPT DETAILS</Text>
              </View>
              <PromptCreateForm onDataChange={setPromptData} disabled={isSubmitting} />
            </View>
          )}

          {/* ── Q&A form ─────────────────────────────────────────────────────── */}
          {postType === "qna" && (
            <View style={styles.formContainer}>
              <View style={styles.formSectionHeader}>
                <Text style={styles.formSectionTitle}>Q&A DETAILS</Text>
              </View>
              <QnACreateForm onSubmit={setQnaData} isSubmitting={isSubmitting} />
            </View>
          )}

          {/* ── Challenge form (Create new Challenge) ────────────────────────── */}
          {/* Note: posting TO an existing challenge is still via Trophy button   */}
          {/* in the media toolbar (EntityTagSelector). This form CREATES one.    */}
          {postType === "challenge" && (
            <View style={styles.formContainer}>
              <View style={styles.formSectionHeader}>
                <Text style={styles.formSectionTitle}>CHALLENGE DETAILS</Text>
              </View>
              <ChallengeCreateForm onSubmit={setChallengeData} isSubmitting={isSubmitting} />
            </View>
          )}


          {/* ── Media tray, EntityTagSelector, challenge banner — media type only */}
          {postType === "media" && (
            <>
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
                  onMediaTypesChange={handleMediaTypesChange}
                  onCropMetadataChange={handleCropMetadataChange}
                  onMutedIndicesChange={handleMutedIndicesChange}
                  initialImages={images}
                  caption={caption}
                  currentUser={currentUser}
                  horizontal={true}
                  allowVideos={challengeSubmissionType !== "image"}
                  allowImages={challengeSubmissionType !== "video"}
                />
              </View>

              {showEntityTagger && (
                <View style={styles.entityTaggerContainer}>
                  <EntityTagSelector
                    onEntitiesChange={setEntityTags}
                    initialEntities={entityTags}
                    onInteractionStart={() => setParentScrollEnabled(false)}
                    onInteractionEnd={() => setParentScrollEnabled(true)}
                    onBeforeChallengeSelect={handleBeforeChallengeSelect}
                  />
                </View>
              )}

              {entityTags.some((e) => e.type === "challenge") && (
                <View style={styles.challengeBanner}>
                  <Trophy size={16} color="#FF6B35" strokeWidth={2.5} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.challengeBannerText} numberOfLines={1}>
                      {entityTags.find((e) => e.type === "challenge")?.name}
                    </Text>
                    {challengeSubmissionType && (
                      <Text style={styles.challengeBannerHint}>
                        {challengeSubmissionType === "video"
                          ? "📹 Video required for this challenge"
                          : "🖼 Photo required for this challenge"}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setEntityTags(
                        entityTags.filter((e) => e.type !== "challenge"),
                      );
                      setShowEntityTagger(false);
                    }}
                    style={styles.closeButtonContainer}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={12} color="#1F2937" strokeWidth={3} />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Toolbar: only for media type (challenge-tagging via Trophy is media-only) */}
      {postType === "media" && <KeyboardAwareToolbar>
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
              if (entityTags.some((e) => e.type === "challenge")) {
                // Already tagged — clear the challenge and close the tagger
                setEntityTags(entityTags.filter((e) => e.type !== "challenge"));
                setShowEntityTagger(false);
              } else {
                setShowEntityTagger(!showEntityTagger);
              }
            }}
            style={styles.toolbarButton}
          >
            <Trophy
              size={32}
              color={
                showEntityTagger || entityTags.some((e) => e.type === "challenge")
                  ? "#FF6B35"
                  : COLORS.editorial.textSecondary
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
      </KeyboardAwareToolbar>}
      {renderGuidelinesModal()}
      {renderDiscardModal()}
      {renderConflictModal()}
      {renderRemoveMediaModal()}
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
    paddingHorizontal: 20,
    paddingBottom: 12,
    zIndex: 100,
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
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 200,
  },
  formContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  formSectionHeader: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
  },
  formSectionTitle: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  avatarContainer: {
    marginRight: 12,
  },
  identityAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  identityTextContainer: {
    justifyContent: "center",
  },
  identityName: {
    fontFamily: FONTS.medium,
    fontSize: 16,
    color: "#111827",
  },
  identityUsername: {
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
    color: COLORS.textDark,
    minHeight: 150, // Slightly taller
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
    marginTop: 20,
    paddingLeft: 20,
  },
  toolbarContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 12,
    gap: 32,
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
  // Entity tagger & challenge banner
  entityTaggerContainer: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  challengeBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF3ED",
    marginHorizontal: 20,
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    gap: 8,
    maxWidth: "85%",
  },
  challengeBannerText: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#1F2937",
  },
  challengeBannerHint: {
    fontSize: 12,
    fontFamily: "Manrope-Regular",
    color: "#6B7280",
    marginTop: 2,
  },
  closeButtonContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default CreatePostScreen;
