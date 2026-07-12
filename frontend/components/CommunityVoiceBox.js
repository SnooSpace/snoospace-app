/**
 * CommunityVoiceBox
 *
 * "What's on your mind?" input bar for Community and Creator profile
 * Community Posts tabs. Expands into a full composer with:
 *   - Multi-line text input
 *   - Optional image attachment
 *   - Toggle: post as yourself or anonymously
 *   - Submit button
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
  Switch,
  Dimensions,
  Alert,
  TouchableWithoutFeedback,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import {
  ImagePlus,
  X,
  Send,
  EyeOff,
  Eye,
  ChevronDown,
  HatGlasses,
  Heart,
  MessageCircle,
  Bookmark,
  ChartNoAxesCombined,
} from "lucide-react-native";
import { GradientHeart } from "./ui/GradientHeart";
import { COLORS, FONTS, SHADOWS } from "../constants/theme";
import HapticsService from "../services/HapticsService";
import { getAuthToken, getActiveAccount } from "../api/auth";
import { apiGet, apiPost, apiDelete, savePost, unsavePost } from "../api/client";
import KeyboardAwareToolbar from "./KeyboardAwareToolbar";
import CustomImagePicker from "./CustomImagePicker";
import EventBus from "../utils/EventBus";
import ShareModal from "./ShareModal";
import ContentActionsSheet from "./ContentActionsSheet";

// Cloudinary direct upload helper
const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

async function uploadVoiceImage(uri) {
  const formData = new FormData();
  formData.append("file", { uri, type: "image/jpeg", name: "voice-post.jpg" });
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", "snoospace/community-voice");
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData },
  );
  if (!response.ok) throw new Error("Image upload failed");
  const data = await response.json();
  return data.secure_url;
}

// ─────────────────────────────────────────────────────────────
// Helper: time-ago formatter
// ─────────────────────────────────────────────────────────────
const timeAgo = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// ─────────────────────────────────────────────────────────────
// Voice Post Card (renders posted voice posts in the feed)
// ─────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_PADDING = 16;
const CARD_MARGIN = 16;
const CARD_CONTENT_WIDTH = SCREEN_WIDTH - (CARD_MARGIN * 2) - (CARD_PADDING * 2);

// ─────────────────────────────────────────────────────────────
// Voice Post Card (renders posted voice posts in the feed)
// ─────────────────────────────────────────────────────────────
export const VoicePostCard = React.memo(({ post, onComment }) => {
  const isAnon = post?.type_data?.is_anonymous;

  const [isLiked, setIsLiked] = useState(post?.is_liked === true);
  const [likeCount, setLikeCount] = useState(post?.like_count || 0);
  const [isLiking, setIsLiking] = useState(false);

  const [isSaved, setIsSaved] = useState(post?.is_saved === true);
  const [saveCount, setSaveCount] = useState(post?.save_count || post?.saves_count || 0);

  const [viewCount, setViewCount] = useState(post?.public_view_count || post?.view_count || 0);
  const [shareCount, setShareCount] = useState(post?.share_count || 0);
  const [shareModalVisible, setShareModalVisible] = useState(false);

  // Active account tracking for ownership
  const [currentUserAccount, setCurrentUserAccount] = useState(null);

  useEffect(() => {
    getActiveAccount()
      .then((account) => {
        if (account) {
          setCurrentUserAccount(account);
        }
      })
      .catch((err) =>
        console.error("[VoicePostCard] Error fetching account:", err),
      );
  }, []);

  const isOwnPost =
    currentUserAccount &&
    String(post?.author_id) === String(currentUserAccount.id) &&
    post?.author_type === currentUserAccount.type;

  const lastTapRef = useRef(0);
  const cardRef = useRef(null);
  const heartScale = useRef(new Animated.Value(0)).current;
  const [heartPos, setHeartPos] = useState({ x: 0, y: 0 });
  const [heartRot, setHeartRot] = useState(0);
  const [showHeart, setShowHeart] = useState(false);

  const triggerHeartAnimation = (x, y) => {
    setHeartPos({ x, y });
    setHeartRot(Math.random() * 30 - 15);
    setShowHeart(true);
    heartScale.setValue(0);

    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 1.2,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(heartScale, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(heartScale, {
        toValue: 1.05,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(heartScale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.delay(800),
      Animated.timing(heartScale, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowHeart(false);
    });
  };

  const handleDoubleTap = (event) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      const { pageX, pageY } = event.nativeEvent;
      cardRef.current?.measure((x, y, width, height, cardPageX, cardPageY) => {
        const relativeX = pageX - cardPageX;
        const relativeY = pageY - cardPageY;
        triggerHeartAnimation(relativeX, relativeY);
      });
      if (!isLiked) {
        handleLike();
      } else {
        HapticsService.triggerImpactLight();
      }
    }
    lastTapRef.current = now;
  };

  // Sync state when post prop changes
  useEffect(() => {
    setIsLiked(post?.is_liked === true);
    setLikeCount(post?.like_count || 0);
    setIsSaved(post?.is_saved === true);
    setSaveCount(post?.save_count || post?.saves_count || 0);
    setViewCount(post?.public_view_count || post?.view_count || 0);
    setShareCount(post?.share_count || 0);
  }, [post?.is_liked, post?.like_count, post?.is_saved, post?.save_count, post?.saves_count, post?.public_view_count, post?.view_count, post?.share_count]);

  // Sync via EventBus
  useEffect(() => {
    const handleLikeUpdate = (payload) => {
      if (payload.postId === post.id) {
        setIsLiked(payload.isLiked);
        setLikeCount(payload.likeCount);
      }
    };
    const handleSaveUpdate = (payload) => {
      if (payload.postId === post.id) {
        setIsSaved(payload.isSaved);
        setSaveCount(payload.saveCount);
      }
    };
    const handleViewUpdate = (payload) => {
      if (payload.postId === post.id) {
        setViewCount((prev) => prev + 1);
      }
    };
    const handleShareUpdate = (payload) => {
      if (payload.postId === post.id) {
        setShareCount((prev) => prev + (payload.increment || 1));
      }
    };

    const unsubLike = EventBus.on("post-like-updated", handleLikeUpdate);
    const unsubSave = EventBus.on("post-save-updated", handleSaveUpdate);
    const unsubView = EventBus.on("post-view-updated", handleViewUpdate);
    const unsubShare = EventBus.on("post-share-updated", handleShareUpdate);

    return () => {
      unsubLike();
      unsubSave();
      unsubView();
      unsubShare();
    };
  }, [post.id]);

  const handleLike = async () => {
    if (isLiking) return;
    HapticsService.triggerLike();
    const prevLiked = isLiked;
    const prevLikeCount = likeCount;
    const nextLiked = !prevLiked;
    const delta = nextLiked ? 1 : -1;
    const nextLikes = Math.max(0, prevLikeCount + delta);

    setIsLiked(nextLiked);
    setLikeCount(nextLikes);

    setIsLiking(true);
    try {
      const token = await getAuthToken();
      if (nextLiked) {
        await apiPost(`/posts/${post.id}/like`, {}, 15000, token);
      } else {
        await apiDelete(`/posts/${post.id}/like`, null, 15000, token);
      }
      EventBus.emit("post-like-updated", {
        postId: post.id,
        isLiked: nextLiked,
        likeCount: nextLikes,
      });
    } catch (error) {
      console.error("Error liking voice post:", error);
      setIsLiked(prevLiked);
      setLikeCount(prevLikeCount);
    } finally {
      setIsLiking(false);
    }
  };

  const handleSave = async () => {
    HapticsService.triggerSave();
    const newSaveState = !isSaved;
    const prevSaveCount = saveCount;
    const nextSaveCount = Math.max(0, saveCount + (newSaveState ? 1 : -1));

    setIsSaved(newSaveState);
    setSaveCount(nextSaveCount);

    try {
      const token = await getAuthToken();
      if (newSaveState) {
        await savePost(post.id, token);
      } else {
        await unsavePost(post.id, token);
      }
      EventBus.emit("post-save-updated", {
        postId: post.id,
        isSaved: newSaveState,
        saveCount: nextSaveCount,
      });
    } catch (error) {
      console.error("Failed to save/unsave voice post:", error);
      setIsSaved(!newSaveState);
      setSaveCount(prevSaveCount);
    }
  };

  const handleCommentPress = () => {
    HapticsService.triggerComment();
    if (onComment) {
      onComment(post.id);
    }
  };

  const handleShare = () => {
    HapticsService.triggerShare();
    setShareModalVisible(true);
  };

  const rawAspectRatio = post?.aspect_ratios;
  const firstAspectRatio = Array.isArray(rawAspectRatio)
    ? rawAspectRatio[0] || 4 / 5
    : typeof rawAspectRatio === "number"
      ? rawAspectRatio
      : 4 / 5;

  const imageHeight = CARD_CONTENT_WIDTH / firstAspectRatio;

  return (
    <TouchableWithoutFeedback onPress={handleDoubleTap}>
      <View ref={cardRef} style={cardStyles.card}>
        {/* Author row */}
        <View style={cardStyles.authorRow}>
          <View style={cardStyles.avatarWrap}>
            {!isAnon && post.author_photo_url ? (
              <ExpoImage
                source={{ uri: post.author_photo_url }}
                style={cardStyles.avatar}
                cachePolicy="memory-disk"
                contentFit="cover"
              />
            ) : (
              <View style={[cardStyles.avatar, cardStyles.anonAvatar]}>
                <HatGlasses size={16} color={COLORS.primary} strokeWidth={2} />
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={cardStyles.authorName}>
              {isAnon ? "Anonymous" : post.author_name || "Member"}
            </Text>
            <Text style={cardStyles.timestamp}>{timeAgo(post.created_at)}</Text>
          </View>

          {/* Ellipsis Menu / ContentActionsSheet */}
          {!isOwnPost && (
            <View style={cardStyles.ellipsisButton}>
              <ContentActionsSheet
                type="post"
                targetId={post.id}
                targetName={isAnon ? "Anonymous" : post.author_name}
                label="Post"
                iconColor={COLORS.textSecondary}
                iconSize={20}
              />
            </View>
          )}
        </View>

        {/* Content */}
        {!!post.caption && <Text style={cardStyles.content}>{post.caption}</Text>}

        {/* Image */}
        {Array.isArray(post.image_urls) && post.image_urls.length > 0 && (
          <ExpoImage
            source={{ uri: post.image_urls[0] }}
            style={[cardStyles.postImage, { height: imageHeight }]}
            cachePolicy="memory-disk"
            contentFit="cover"
          />
        )}

        {/* Divider */}
        <View style={cardStyles.divider} />

        {/* Engagement Row */}
        <View style={cardStyles.engagementRow}>
          {/* Like */}
          <Pressable
            style={cardStyles.engagementButton}
            onPress={handleLike}
            disabled={isLiking}
          >
            <Heart
              size={20}
              strokeWidth={2}
              color={isLiked ? COLORS.error : COLORS.textSecondary}
              fill={isLiked ? COLORS.error : "transparent"}
            />
            <Text style={[cardStyles.engagementCount, isLiked && cardStyles.likedCount]}>
              {likeCount}
            </Text>
          </Pressable>

          {/* Comment */}
          <Pressable style={cardStyles.engagementButton} onPress={handleCommentPress}>
            <MessageCircle
              size={20}
              strokeWidth={2}
              color={COLORS.textSecondary}
            />
            <Text style={cardStyles.engagementCount}>
              {post.comment_count || 0}
            </Text>
          </Pressable>

          {/* Views */}
          <Pressable
            style={cardStyles.engagementButton}
            onPress={() => HapticsService.triggerView()}
          >
            <ChartNoAxesCombined
              size={20}
              strokeWidth={2}
              color={COLORS.textSecondary}
            />
            <Text style={cardStyles.engagementCount}>
              {viewCount}
            </Text>
          </Pressable>

          {/* Share */}
          <Pressable style={cardStyles.engagementButton} onPress={handleShare}>
            <Send
              size={20}
              strokeWidth={2}
              color={COLORS.textSecondary}
            />
            <Text style={cardStyles.engagementCount}>
              {shareCount}
            </Text>
          </Pressable>

          {/* Bookmark */}
          <Pressable style={cardStyles.engagementButton} onPress={handleSave}>
            <Bookmark
              size={20}
              strokeWidth={2}
              color={COLORS.textSecondary}
              fill={isSaved ? COLORS.textSecondary : "transparent"}
            />
            {saveCount > 0 && (
              <Text style={cardStyles.engagementCount}>
                {saveCount}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Share Modal */}
        {shareModalVisible && (
          <ShareModal
            visible={shareModalVisible}
            post={post}
            onClose={() => setShareModalVisible(false)}
          />
        )}

        {/* Floating Heart */}
        {showHeart && (
          <Animated.View
            style={{
              position: 'absolute',
              top: heartPos.y - 75,
              left: heartPos.x - 75,
              transform: [
                { scale: heartScale },
                { rotate: `${heartRot}deg` }
              ],
              opacity: heartScale.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
              zIndex: 9999,
            }}
            pointerEvents="none"
          >
            <GradientHeart />
          </Animated.View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}, (prev, next) => {
  return (
    prev.post?.id === next.post?.id &&
    prev.post?.like_count === next.post?.like_count &&
    prev.post?.is_liked === next.post?.is_liked &&
    prev.post?.comment_count === next.post?.comment_count &&
    prev.post?.public_view_count === next.post?.public_view_count &&
    prev.post?.save_count === next.post?.save_count &&
    prev.post?.saves_count === next.post?.saves_count &&
    prev.post?.is_saved === next.post?.is_saved
  );
});

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function CommunityVoiceBox({
  targetId,
  targetType, // 'community' | 'member'
  currentUser, // { profile_photo_url, name, full_name }
  onPostCreated, // (post) => void — called after a successful submission
}) {
  const [composerVisible, setComposerVisible] = useState(false);
  const [text, setText] = useState("");
  const [imageUri, setImageUri] = useState(null);
  const [aspectRatio, setAspectRatio] = useState(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const inputRef = useRef(null);

  const charCount = text.length;
  const MAX_CHARS = 500;
  const canPost = (text.trim().length > 0 || imageUri) && !submitting;

  // Fetch active logged in user's profile
  useEffect(() => {
    async function loadOwnProfile() {
      try {
        const token = await getAuthToken();
        if (token) {
          const account = await getActiveAccount();
          const endpoint =
            account?.type === "community"
              ? "/communities/profile"
              : "/members/profile";
          const res = await apiGet(endpoint, 10000, token);
          if (res?.profile) {
            setUserProfile(res.profile);
          }
        }
      } catch (e) {
        console.warn("[CommunityVoiceBox] loadOwnProfile error:", e);
      }
    }
    loadOwnProfile();
  }, []);

  // ── Open composer ──────────────────────────────────────────
  const openComposer = useCallback(() => {
    HapticsService.triggerImpactLight();
    setComposerVisible(true);
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  // ── Close & reset ──────────────────────────────────────────
  const closeComposer = useCallback(() => {
    setComposerVisible(false);
    setText("");
    setImageUri(null);
    setAspectRatio(null);
    setIsAnonymous(false);
  }, []);

  // ── Pick image ─────────────────────────────────────────────
  const pickImage = useCallback(async () => {
    HapticsService.triggerImpactLight();
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === "granted") {
        setPickerVisible(true);
      }
    } catch (e) {
      console.warn("[VoiceBox] pickImage error:", e);
    }
  }, []);

  const handlePickerDone = useCallback((selectedAssets) => {
    setPickerVisible(false);
    if (selectedAssets && selectedAssets.length > 0) {
      const asset = selectedAssets[0];
      setImageUri(asset.uri);
      if (asset.width && asset.height) {
        setAspectRatio(asset.width / asset.height);
      } else {
        Image.getSize(asset.uri, (w, h) => {
          setAspectRatio(w / h);
        });
      }
    }
  }, []);

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!canPost) return;
    HapticsService.triggerImpactMedium();

    try {
      setSubmitting(true);
      const token = await getAuthToken();

      let uploadedImageUrl = null;
      if (imageUri) {
        setUploadingImage(true);
        uploadedImageUrl = await uploadVoiceImage(imageUri);
        setUploadingImage(false);
      }

      const res = await apiPost(
        "/community-voice-posts",
        {
          target_id: targetId,
          target_type: targetType,
          content: text.trim() || null,
          image_url: uploadedImageUrl,
          is_anonymous: isAnonymous,
          aspect_ratio: aspectRatio,
        },
        10000,
        token,
      );

      if (res?.success && res?.post) {
        onPostCreated?.(res.post);
        closeComposer();
        HapticsService.triggerNotificationSuccess();
      }
    } catch (e) {
      console.error("[VoiceBox] submit error:", e);
    } finally {
      setSubmitting(false);
      setUploadingImage(false);
    }
  }, [
    canPost,
    targetId,
    targetType,
    text,
    imageUri,
    isAnonymous,
    aspectRatio,
    onPostCreated,
    closeComposer,
  ]);

  // ── Avatar for the trigger bar ─────────────────────────────
  const resolvedUser = userProfile || currentUser;
  const avatarUri = resolvedUser?.profile_photo_url || resolvedUser?.logo_url;

  return (
    <>
      {/* ── Trigger Row ─────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.triggerRow}
        onPress={openComposer}
        activeOpacity={0.8}
      >
        {/* User Avatar */}
        <View style={styles.avatarWrap}>
          {avatarUri ? (
            <ExpoImage
              source={{ uri: avatarUri }}
              style={styles.avatar}
              cachePolicy="memory-disk"
              contentFit="cover"
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>
                {(resolvedUser?.name ||
                  resolvedUser?.full_name ||
                  "U")[0].toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Placeholder text */}
        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderText}>What's on your mind?</Text>
        </View>

        {/* Image icon */}
        <View style={styles.triggerIconBox}>
          <ImagePlus size={18} color={COLORS.primary} strokeWidth={2} />
        </View>
      </TouchableOpacity>

      {/* ── Full-Screen Composer Modal ───────────────────────── */}
      {composerVisible && (
        <Modal
          visible={composerVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeComposer}
        >
          <>
            <SafeAreaView style={styles.safeArea} edges={["top"]}>
              <KeyboardAvoidingView
                style={styles.modal}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
              >
                {/* Header */}
                <View style={styles.modalHeader}>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={closeComposer}
                    hitSlop={12}
                  >
                    <X size={20} color={COLORS.textPrimary} strokeWidth={2} />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Share a Thought</Text>
                  <TouchableOpacity
                    style={[styles.postBtn, !canPost && styles.postBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={!canPost}
                  >
                    {submitting ? (
                      <ActivityIndicator
                        size="small"
                        color={canPost ? "#fff" : "#9CA3AF"}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.postBtnText,
                          !canPost && styles.postBtnTextDisabled,
                        ]}
                      >
                        Post
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.modalBody}
                  contentContainerStyle={{ paddingBottom: 120 }}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Author identity row */}
                  <View style={styles.authorRow}>
                    <View style={styles.avatarWrap}>
                      {!isAnonymous && avatarUri ? (
                        <ExpoImage
                          source={{ uri: avatarUri }}
                          style={styles.avatar}
                          cachePolicy="memory-disk"
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[styles.avatar, styles.anonAvatar]}>
                          <HatGlasses
                            size={18}
                            color={COLORS.primary}
                            strokeWidth={2}
                          />
                        </View>
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.authorName}>
                        {isAnonymous
                          ? "Anonymous"
                          : resolvedUser?.name || resolvedUser?.full_name || "You"}
                      </Text>
                      <Text style={styles.authorSub}>
                        {isAnonymous ? "Posting anonymously" : "Posting publicly"}
                      </Text>
                    </View>
                  </View>

                  {/* Dedicated toggle row below the author row */}
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleLeft}>
                      <HatGlasses
                        size={18}
                        color={isAnonymous ? COLORS.primary : COLORS.textSecondary}
                        strokeWidth={2}
                      />
                      <Text style={styles.toggleText}>Post Anonymously</Text>
                    </View>
                    <Switch
                      trackColor={{
                        false: "#E5E5EA",
                        true: "rgba(41, 98, 255, 0.3)",
                      }}
                      thumbColor={isAnonymous ? COLORS.primary : "#FFFFFF"}
                      ios_backgroundColor="#E5E5EA"
                      onValueChange={(value) => {
                        HapticsService.triggerImpactLight();
                        setIsAnonymous(value);
                      }}
                      value={isAnonymous}
                    />
                  </View>

                  {/* Text input */}
                  <TextInput
                    ref={inputRef}
                    style={styles.textInput}
                    placeholder="Share what's on your mind…"
                    placeholderTextColor={COLORS.textMuted}
                    value={text}
                    onChangeText={(t) => {
                      if (t.length <= MAX_CHARS) setText(t);
                    }}
                    multiline
                    maxLength={MAX_CHARS}
                    autoFocus
                    textAlignVertical="top"
                    selectionColor={COLORS.primary}
                  />

                  {/* Char count */}
                  <Text
                    style={[
                      styles.charCount,
                      charCount > MAX_CHARS * 0.9 && { color: "#E53935" },
                    ]}
                  >
                    {charCount}/{MAX_CHARS}
                  </Text>

                  {/* Attached image preview */}
                  {imageUri && (
                    <View style={styles.imagePreviewWrap}>
                      <ExpoImage
                        source={{ uri: imageUri }}
                        style={styles.imagePreview}
                        contentFit="cover"
                        cachePolicy="memory"
                      />
                      <TouchableOpacity
                        style={styles.removeImgBtn}
                        onPress={() => setImageUri(null)}
                        hitSlop={8}
                      >
                        <X size={14} color="#fff" strokeWidth={2.5} />
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              </KeyboardAvoidingView>

              {/* Toolbar outside KeyboardAvoidingView using KeyboardAwareToolbar */}
              <KeyboardAwareToolbar>
                <View style={styles.toolbar}>
                  <TouchableOpacity
                    style={styles.toolbarBtn}
                    onPress={pickImage}
                    disabled={uploadingImage}
                  >
                    {uploadingImage ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <ImagePlus size={22} color={COLORS.primary} strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                </View>
              </KeyboardAwareToolbar>
            </SafeAreaView>

            {/* Custom Image Picker Modal */}
            {pickerVisible && (
              <CustomImagePicker
                visible={pickerVisible}
                onClose={() => setPickerVisible(false)}
                onDone={handlePickerDone}
                selectionLimit={1}
                allowVideos={false}
                allowImages={true}
              />
            )}
          </>
        </Modal>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Trigger row ──
  triggerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: "hidden",
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarFallback: {
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  anonAvatar: {
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontFamily: FONTS.primary,
    fontSize: 16,
    color: "#fff",
  },
  placeholderBox: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  placeholderText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  triggerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(41,98,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Modal ──
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modal: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
    backgroundColor: "#fff",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    flex: 1,
    fontFamily: FONTS.primary,
    fontSize: 17,
    color: COLORS.textPrimary,
  },
  postBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 9,
    minWidth: 64,
    alignItems: "center",
  },
  postBtnDisabled: {
    backgroundColor: "#F3F4F6",
  },
  postBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#fff",
  },
  postBtnTextDisabled: {
    color: "#9CA3AF",
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: "#FAF8F5",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 16,
    paddingBottom: 12,
  },
  authorName: {
    fontFamily: FONTS.primary,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  authorSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#EAE6DF",
  },
  toggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  toggleText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  textInput: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textPrimary,
    minHeight: 120,
    textAlignVertical: "top",
    paddingTop: 0,
  },
  charCount: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: "right",
    marginTop: 8,
  },
  imagePreviewWrap: {
    marginTop: 16,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    alignSelf: "flex-start",
  },
  imagePreview: {
    width: 200,
    height: 150,
    borderRadius: 16,
  },
  removeImgBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: "transparent",
  },
  toolbarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});

// VoicePostCard styles
// ─────────────────────────────────────────────────────────────
const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    position: "relative",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  anonAvatar: {
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  authorName: {
    fontFamily: FONTS.primary,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  timestamp: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  content: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  postImage: {
    width: "100%",
    borderRadius: 12,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 12,
  },
  engagementRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  engagementButton: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
    minWidth: 40,
    justifyContent: "center",
    gap: 8,
  },
  engagementCount: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  likedCount: {
    color: COLORS.error,
  },
  ellipsisButton: {
    padding: 6,
  },
});
