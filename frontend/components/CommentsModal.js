import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiGet, apiPost, apiDelete } from '../api/client';
import { getAuthToken, getAuthEmail } from '../api/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COLORS = {
  dark: '#000000',
  darkGray: '#1a1a1a',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  border: '#333333',
  primary: '#6A0DAD',
  error: '#FF4444',
};

const CommentsModal = ({ visible, postId, onClose, onCommentCountChange }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [posting, setPosting] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  // Track previous postId to prevent reloading when it's the same
  const prevPostIdRef = useRef(null);
  const prevVisibleRef = useRef(false);

  useEffect(() => {
    // Only reload if modal was closed and is now opening, or postId actually changed
    if (visible && postId) {
      const isNewlyOpened = !prevVisibleRef.current;
      const isPostChanged = postId !== prevPostIdRef.current;
      
      if (isNewlyOpened || isPostChanged) {
        loadComments();
        loadUserProfile();
      }
      
      prevPostIdRef.current = postId;
      prevVisibleRef.current = true;
    } else if (!visible && prevVisibleRef.current) {
      // Only reset when modal is actually closing (was visible, now not)
      setComments([]);
      setCommentInput('');
      prevVisibleRef.current = false;
    }
  }, [visible, postId]);

  const loadUserProfile = async () => {
    try {
      const token = await getAuthToken();
      const email = await getAuthEmail();
      if (!token || !email) return;
      
      const profileResponse = await apiPost('/auth/get-user-profile', { email }, 10000, token);
      if (profileResponse?.profile) {
        setUserProfile(profileResponse.profile);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      // Silently fail, use placeholder
    }
  };

  const loadComments = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const data = await apiGet(`/posts/${postId}/comments`, 10000, token);
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch (error) {
      console.error('Error loading comments:', error);
      Alert.alert('Error', 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handlePostComment = async () => {
    if (!commentInput.trim() || posting) return;
    
    setPosting(true);
    try {
      const token = await getAuthToken();
      const result = await apiPost(
        `/posts/${postId}/comments`,
        { commentText: commentInput.trim() },
        15000,
        token
      );
      
      if (result?.comment) {
        // Get latest user profile if needed
        let currentProfile = userProfile;
        if (!currentProfile || !currentProfile.profile_photo_url) {
          try {
            const email = await getAuthEmail();
            const profileResponse = await apiPost('/auth/get-user-profile', { email }, 10000, token);
            if (profileResponse?.profile) {
              currentProfile = profileResponse.profile;
              setUserProfile(currentProfile); // Update state for future use
            }
          } catch (e) {
            console.error('Error fetching profile for comment:', e);
          }
        }
        
        // Enrich comment with user profile data
        const enrichedComment = {
          ...result.comment,
          commenter_name: currentProfile?.name || 'User',
          commenter_username: currentProfile?.username || '',
          commenter_photo_url: currentProfile?.profile_photo_url || null,
          like_count: 0,
          is_liked: false,
        };
        
        // Add the new comment to the list
        setComments(prev => [...prev, enrichedComment]);
        setCommentInput('');
        if (onCommentCountChange) {
          // Calculate new count and call the callback
          const newCount = comments.length + 1;
          onCommentCountChange(newCount);
        }
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      Alert.alert('Error', error?.message || 'Failed to post comment');
    } finally {
      setPosting(false);
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const commentTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - commentTime) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w`;
    return `${Math.floor(diffInSeconds / 2592000)}mo`;
  };

  const handleCommentLike = async (commentId, isLiked, currentLikeCount) => {
    const newIsLiked = !isLiked;
    const newLikeCount = isLiked ? Math.max(0, currentLikeCount - 1) : (currentLikeCount + 1);
    
    // Optimistic update
    setComments(prevComments =>
      prevComments.map(comment =>
        comment.id === commentId
          ? { ...comment, is_liked: newIsLiked, isLiked: newIsLiked, like_count: newLikeCount }
          : comment
      )
    );

    try {
      const token = await getAuthToken();
      
      if (isLiked) {
        await apiDelete(`/comments/${commentId}/like`, null, 15000, token);
      } else {
        await apiPost(`/comments/${commentId}/like`, {}, 15000, token);
      }
    } catch (error) {
      console.error('Error toggling comment like:', error);
      // Revert optimistic update on error
      setComments(prevComments =>
        prevComments.map(comment =>
          comment.id === commentId
            ? { ...comment, is_liked: isLiked, isLiked, like_count: currentLikeCount }
            : comment
        )
      );
      Alert.alert('Error', error?.message || 'Failed to update like');
    }
  };

  const renderComment = ({ item }) => {
    const hasReplies = item.replies && item.replies.length > 0;
    const isLiked = item.is_liked === true || item.isLiked === true;
    const likeCount = item.like_count || 0;
    
    return (
      <View style={styles.commentItem}>
        <Image
          source={{
            uri: item.commenter_photo_url ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(item.commenter_name || 'User')}&background=6A0DAD&color=FFFFFF`
          }}
          style={styles.commentAvatar}
        />
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={styles.commenterName}>{item.commenter_name}</Text>
            <Text style={styles.commentTime}>{formatTimeAgo(item.created_at)}</Text>
          </View>
          <Text style={styles.commentText}>{item.comment_text}</Text>
          {hasReplies && (
            <TouchableOpacity style={styles.viewRepliesButton}>
              <Text style={styles.viewRepliesText}>
                View {item.replies.length} more {item.replies.length === 1 ? 'reply' : 'replies'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity 
          style={styles.commentLikeButton}
          onPress={() => handleCommentLike(item.id, isLiked, likeCount)}
        >
          <Ionicons 
            name={isLiked ? "heart" : "heart-outline"} 
            size={18} 
            color={isLiked ? COLORS.error : COLORS.textSecondary} 
          />
          {likeCount > 0 && (
            <Text style={styles.commentLikeCount}>{likeCount}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Comments</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Comments List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.text} />
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id?.toString()}
              renderItem={renderComment}
              style={styles.commentsList}
              contentContainerStyle={styles.commentsListContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No comments yet</Text>
                  <Text style={styles.emptySubtext}>Be the first to comment!</Text>
                </View>
              }
            />
          )}

          {/* Comment Input */}
          <View style={styles.inputContainer}>
            <View style={styles.inputRow}>
              <Image
                source={{
                  uri: userProfile?.profile_photo_url && /^https?:\/\//.test(userProfile.profile_photo_url)
                    ? userProfile.profile_photo_url
                    : userProfile?.name
                    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.name)}&background=6A0DAD&color=FFFFFF&size=32`
                    : `https://ui-avatars.com/api/?name=User&background=6A0DAD&color=FFFFFF&size=32`
                }}
                style={styles.inputAvatar}
              />
              <TextInput
                value={commentInput}
                onChangeText={setCommentInput}
                placeholder="Add a comment..."
                placeholderTextColor={COLORS.textSecondary}
                style={styles.input}
                multiline
                editable={!posting}
              />
              <TouchableOpacity
                onPress={handlePostComment}
                disabled={!commentInput.trim() || posting}
                style={styles.sendButton}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={commentInput.trim() && !posting ? COLORS.primary : COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    flex: 1,
    backgroundColor: COLORS.dark,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentsList: {
    flex: 1,
  },
  commentsListContent: {
    paddingVertical: 10,
  },
  commentItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commenterName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginRight: 8,
  },
  commentTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  commentText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  viewRepliesButton: {
    marginTop: 4,
  },
  viewRepliesText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  commentLikeButton: {
    padding: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentLikeCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  inputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.darkGray,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.dark,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    padding: 8,
  },
});

export default CommentsModal;

