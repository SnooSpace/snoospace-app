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

import React, { useState, useRef, useCallback } from 'react';
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
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  ImagePlus,
  X,
  Send,
  EyeOff,
  Eye,
  ChevronDown,
} from 'lucide-react-native';
import { COLORS, FONTS, SHADOWS } from '../constants/theme';
import HapticsService from '../services/HapticsService';
import { getAuthToken } from '../api/auth';
import { apiPost } from '../api/client';

// Cloudinary direct upload helper
const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

async function uploadVoiceImage(uri) {
  const formData = new FormData();
  formData.append('file', { uri, type: 'image/jpeg', name: 'voice-post.jpg' });
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', 'snoospace/community-voice');
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );
  if (!response.ok) throw new Error('Image upload failed');
  const data = await response.json();
  return data.secure_url;
}

// ─────────────────────────────────────────────────────────────
// Helper: time-ago formatter
// ─────────────────────────────────────────────────────────────
const timeAgo = (dateStr) => {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// ─────────────────────────────────────────────────────────────
// Voice Post Card (renders posted voice posts in the feed)
// ─────────────────────────────────────────────────────────────
export const VoicePostCard = React.memo(({ post }) => {
  const isAnon = post?.type_data?.is_anonymous;
  return (
    <View style={cardStyles.card}>
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
              <EyeOff size={16} color="#9CA3AF" strokeWidth={2} />
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.authorName}>
            {isAnon ? 'Anonymous' : (post.author_name || 'Member')}
          </Text>
          <Text style={cardStyles.timestamp}>{timeAgo(post.created_at)}</Text>
        </View>
      </View>

      {/* Content */}
      {!!post.caption && (
        <Text style={cardStyles.content}>{post.caption}</Text>
      )}

      {/* Image */}
      {Array.isArray(post.image_urls) && post.image_urls.length > 0 && (
        <ExpoImage
          source={{ uri: post.image_urls[0] }}
          style={cardStyles.postImage}
          cachePolicy="memory-disk"
          contentFit="cover"
        />
      )}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function CommunityVoiceBox({
  targetId,
  targetType,       // 'community' | 'member'
  currentUser,      // { profile_photo_url, name, full_name }
  onPostCreated,    // (post) => void — called after a successful submission
}) {
  const [composerVisible, setComposerVisible] = useState(false);
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const inputRef = useRef(null);

  const charCount = text.length;
  const MAX_CHARS = 500;
  const canPost = (text.trim().length > 0 || imageUri) && !submitting;

  // ── Open composer ──────────────────────────────────────────
  const openComposer = useCallback(() => {
    HapticsService.triggerImpactLight();
    setComposerVisible(true);
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  // ── Close & reset ──────────────────────────────────────────
  const closeComposer = useCallback(() => {
    setComposerVisible(false);
    setText('');
    setImageUri(null);
    setIsAnonymous(false);
  }, []);

  // ── Pick image ─────────────────────────────────────────────
  const pickImage = useCallback(async () => {
    HapticsService.triggerImpactLight();
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setImageUri(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('[VoiceBox] pickImage error:', e);
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
        '/community-voice-posts',
        {
          target_id: targetId,
          target_type: targetType,
          content: text.trim() || null,
          image_url: uploadedImageUrl,
          is_anonymous: isAnonymous,
        },
        10000,
        token
      );

      if (res?.success && res?.post) {
        onPostCreated?.(res.post);
        closeComposer();
        HapticsService.triggerNotificationSuccess();
      }
    } catch (e) {
      console.error('[VoiceBox] submit error:', e);
    } finally {
      setSubmitting(false);
      setUploadingImage(false);
    }
  }, [canPost, targetId, targetType, text, imageUri, isAnonymous, onPostCreated, closeComposer]);

  // ── Avatar for the trigger bar ─────────────────────────────
  const avatarUri = currentUser?.profile_photo_url;

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
                {(currentUser?.name || currentUser?.full_name || 'U')[0].toUpperCase()}
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
      <Modal
        visible={composerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeComposer}
      >
        <KeyboardAvoidingView
          style={styles.modal}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
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
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.postBtnText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={{ paddingBottom: 40 }}
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
                  <View style={[styles.avatar, isAnonymous ? styles.anonAvatar : styles.avatarFallback]}>
                    {isAnonymous ? (
                      <EyeOff size={16} color="#9CA3AF" strokeWidth={2} />
                    ) : (
                      <Text style={styles.avatarInitial}>
                        {(currentUser?.name || currentUser?.full_name || 'U')[0].toUpperCase()}
                      </Text>
                    )}
                  </View>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.authorName}>
                  {isAnonymous ? 'Anonymous' : (currentUser?.name || currentUser?.full_name || 'You')}
                </Text>
                {/* Identity toggle */}
                <TouchableOpacity
                  style={styles.anonToggle}
                  onPress={() => {
                    HapticsService.triggerImpactLight();
                    setIsAnonymous((v) => !v);
                  }}
                >
                  {isAnonymous ? (
                    <Eye size={12} color={COLORS.primary} strokeWidth={2} />
                  ) : (
                    <EyeOff size={12} color={COLORS.textSecondary} strokeWidth={2} />
                  )}
                  <Text style={[styles.anonLabel, isAnonymous && { color: COLORS.primary }]}>
                    {isAnonymous ? 'Posting anonymously' : 'Post anonymously'}
                  </Text>
                </TouchableOpacity>
              </View>
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
            <Text style={[
              styles.charCount,
              charCount > MAX_CHARS * 0.9 && { color: '#E53935' },
            ]}>
              {charCount}/{MAX_CHARS}
            </Text>

            {/* Attached image preview */}
            {imageUri && (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
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

          {/* Toolbar */}
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
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Trigger row ──
  triggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    ...SHADOWS.sm,
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarFallback: {
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anonAvatar: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: FONTS.primary,
    fontSize: 16,
    color: '#fff',
  },
  placeholderBox: {
    flex: 1,
    backgroundColor: '#F3F4F6',
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
    backgroundColor: 'rgba(41,98,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Modal ──
  modal: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
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
    alignItems: 'center',
  },
  postBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  postBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#fff',
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 16,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    paddingBottom: 12,
  },
  authorName: {
    fontFamily: FONTS.primary,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  anonToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  anonLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  textInput: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textPrimary,
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: 0,
  },
  charCount: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: 8,
  },
  imagePreviewWrap: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'flex-start',
  },
  imagePreview: {
    width: 200,
    height: 150,
    borderRadius: 16,
  },
  removeImgBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 12,
  },
  toolbarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(41,98,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─────────────────────────────────────────────────────────────
// VoicePostCard styles
// ─────────────────────────────────────────────────────────────
const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    ...SHADOWS.sm,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  anonAvatar: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
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
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 4,
  },
});
