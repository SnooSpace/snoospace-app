import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
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
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiGet, apiPost, apiDelete } from "../api/client";
import { getAuthToken, getAuthEmail } from "../api/auth";
import { searchMembers } from "../api/search";
import EventBus from "../utils/EventBus";
import KeyboardAwareToolbar from "./KeyboardAwareToolbar";

const COLORS = {
  dark: "#FFFFFF",
  darkGray: "#F5F5F5",
  text: "#000000",
  textSecondary: "#737373",
  border: "#EBEBEB",
  primary: "#6A0DAD",
  error: "#FF4444",
};

// Simple indent for replies (no connectors)
const REPLY_INDENT = 48;

const CommentsModal = ({
  visible,
  postId,
  onClose,
  onCommentCountChange,
  embedded = false,
  navigation,
  isNestedModal = false,
}) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [posting, setPosting] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [postAuthorId, setPostAuthorId] = useState(null);
  const [postAuthorType, setPostAuthorType] = useState(null);
  const [taggedEntities, setTaggedEntities] = useState([]);
  const [showTagSearch, setShowTagSearch] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState("");
  const [tagSearchResults, setTagSearchResults] = useState([]);
  const [tagSearchLoading, setTagSearchLoading] = useState(false);
  const [atPosition, setAtPosition] = useState(-1);
  const [replyingTo, setReplyingTo] = useState(null); // {id, name} of parent comment
  const [collapsedThreads, setCollapsedThreads] = useState({}); // {commentId: boolean}
  const [focusTrigger, setFocusTrigger] = useState(0); // Trigger to focus input

  const prevPostIdRef = useRef(null);
  const prevVisibleRef = useRef(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (visible && postId) {
      const isNewlyOpened = !prevVisibleRef.current;
      const isPostChanged = postId !== prevPostIdRef.current;

      if (isNewlyOpened || isPostChanged) {
        loadComments();
        loadUserProfile();
      }

      prevPostIdRef.current = postId;
      prevVisibleRef.current = true;

      if (isNewlyOpened) {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 300);
      }
    } else if (!visible && prevVisibleRef.current) {
      setComments([]);
      setCommentInput("");
      prevVisibleRef.current = false;
    }
  }, [visible, postId]);

  // Robust focus strategy for the input field
  const triggerInputFocus = useCallback(() => {
    if (!inputRef.current) return;

    // Multi-stage focus attempt to overcome layout shifts and race conditions
    // 1. Immediate focus attempt
    inputRef.current.focus();

    // 2. Focus after next animation frame
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    // 3. Delayed focus after layout (increased from 250ms for stability)
    setTimeout(() => {
      inputRef.current?.focus();
    }, 200);

    // 4. Final safety focus
    setTimeout(() => {
      inputRef.current?.focus();
    }, 500);
  }, []);

  // Focus input when user taps Reply button (focusTrigger changes each tap)
  useEffect(() => {
    if (focusTrigger > 0) {
      triggerInputFocus();
    }
  }, [focusTrigger, triggerInputFocus]);

  const loadUserProfile = async () => {
    try {
      const token = await getAuthToken();
      const email = await getAuthEmail();
      if (!token || !email) return;

      const profileResponse = await apiPost(
        "/auth/get-user-profile",
        { email },
        10000,
        token
      );
      if (profileResponse?.profile) {
        setUserProfile(profileResponse.profile);
        const userId =
          profileResponse.profile.id || profileResponse.profile.user_id;
        if (userId) {
          setCurrentUserId(userId);
        }
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  };

  const loadComments = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const data = await apiGet(`/posts/${postId}/comments`, 10000, token);
      const normalizedComments = Array.isArray(data?.comments)
        ? data.comments.map((comment) => {
            let taggedEntities = comment.tagged_entities || [];
            if (typeof taggedEntities === "string") {
              try {
                taggedEntities = JSON.parse(taggedEntities);
              } catch (e) {
                console.warn("Failed to parse tagged_entities:", e);
                taggedEntities = [];
              }
            }

            return {
              ...comment,
              like_count:
                typeof comment.like_count === "string"
                  ? parseInt(comment.like_count, 10) || 0
                  : Number(comment.like_count) || 0,
              tagged_entities: Array.isArray(taggedEntities)
                ? taggedEntities
                : [],
            };
          })
        : [];
      setComments(normalizedComments);

      if (data?.post_author_id && data?.post_author_type) {
        setPostAuthorId(data.post_author_id);
        setPostAuthorType(data.post_author_type);
      }
    } catch (error) {
      console.error("Error loading comments:", error);
      Alert.alert("Error", "Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  // Build flat list for display - supports 3 levels of nesting
  const flatComments = useMemo(() => {
    const result = [];

    // Helper to count all nested replies recursively
    const countAllReplies = (replies) => {
      if (!replies) return 0;
      let count = replies.length;
      replies.forEach((r) => {
        if (r.replies) count += countAllReplies(r.replies);
      });
      return count;
    };

    comments.forEach((comment) => {
      // Add top-level comment (depth 0)
      result.push({
        ...comment,
        depth: 0,
        isTopLevel: true,
        hasReplies: comment.replies && comment.replies.length > 0,
        replyCount: comment.replies?.length || 0,
      });

      // Add replies only if not collapsed (depth 1)
      const isLevel1Collapsed = collapsedThreads[comment.id] !== false;
      if (!isLevel1Collapsed && comment.replies && comment.replies.length > 0) {
        comment.replies.forEach((reply) => {
          const hasSubReplies = reply.replies && reply.replies.length > 0;
          result.push({
            ...reply,
            depth: 1,
            isTopLevel: false,
            isReply: true,
            parentCommentId: comment.id,
            hasReplies: hasSubReplies,
            replyCount: reply.replies?.length || 0,
          });

          // Add sub-replies only if this reply is expanded (depth 2)
          const isLevel2Collapsed = collapsedThreads[reply.id] !== false;
          if (!isLevel2Collapsed && hasSubReplies) {
            reply.replies.forEach((subReply) => {
              result.push({
                ...subReply,
                depth: 2,
                isTopLevel: false,
                isReply: true,
                isSubReply: true,
                parentCommentId: reply.id,
                grandparentCommentId: comment.id,
                hasReplies: false, // Max 3 levels
                replyCount: 0,
              });
            });
          }
        });
      }
    });
    return result;
  }, [comments, collapsedThreads]);

  const handleDeleteComment = async (commentId) => {
    Alert.alert(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await getAuthToken();
              await apiDelete(`/comments/${commentId}`, null, 15000, token);

              setComments((prev) => prev.filter((c) => c.id !== commentId));

              const newCount = Math.max(0, comments.length - 1);
              if (onCommentCountChange) {
                onCommentCountChange(newCount);
              }
              // Emit event for other screens to update
              EventBus.emit("post-comment-updated", {
                postId: postId,
                commentCount: newCount,
              });
            } catch (error) {
              console.error("Error deleting comment:", error);
              Alert.alert("Error", "Failed to delete comment");
              loadComments();
            }
          },
        },
      ]
    );
  };

  const handleCommentInputChange = (text) => {
    setCommentInput(text);

    const lastAtIndex = text.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const afterAt = text.substring(lastAtIndex + 1);
      const spaceIndex = afterAt.indexOf(" ");

      if (spaceIndex === -1 || spaceIndex > 0) {
        setAtPosition(lastAtIndex);
        const query = afterAt.split(" ")[0];
        setTagSearchQuery(query);
        if (query.length >= 1) {
          searchForTagging(query);
        } else {
          setShowTagSearch(false);
        }
      } else {
        setShowTagSearch(false);
        setAtPosition(-1);
      }
    } else {
      setShowTagSearch(false);
      setAtPosition(-1);
    }
  };

  const searchForTagging = async (query) => {
    if (query.length < 1) {
      setShowTagSearch(false);
      return;
    }

    setTagSearchLoading(true);
    setShowTagSearch(true);
    try {
      const response = await searchMembers(query, { limit: 10, offset: 0 });
      setTagSearchResults(response.results || []);
    } catch (error) {
      console.error("Error searching for tagging:", error);
      setTagSearchResults([]);
    } finally {
      setTagSearchLoading(false);
    }
  };

  const selectTaggedUser = (user) => {
    if (atPosition === -1) return;

    const beforeAt = commentInput.substring(0, atPosition);
    const afterAt = commentInput.substring(atPosition + 1);
    const spaceIndex = afterAt.indexOf(" ");
    const afterTag = spaceIndex === -1 ? "" : afterAt.substring(spaceIndex);

    const newText = `${beforeAt}@${user.username}${afterTag}`;
    setCommentInput(newText);

    const existing = taggedEntities.find(
      (t) => t.id === user.id && t.type === "member"
    );
    if (!existing) {
      setTaggedEntities([
        ...taggedEntities,
        {
          id: user.id,
          type: "member",
          username: user.username,
        },
      ]);
    }

    setShowTagSearch(false);
    setAtPosition(-1);
    setTagSearchQuery("");
  };

  const handlePostComment = async () => {
    if (!commentInput.trim() || posting) return;

    setPosting(true);
    try {
      const token = await getAuthToken();
      const result = await apiPost(
        `/posts/${postId}/comments`,
        {
          commentText: commentInput.trim(),
          taggedEntities:
            taggedEntities.length > 0 ? taggedEntities : undefined,
        },
        15000,
        token
      );

      if (result?.comment) {
        let currentProfile = userProfile;
        if (
          !currentProfile ||
          (!currentProfile.profile_photo_url && !currentProfile.logo_url)
        ) {
          try {
            const email = await getAuthEmail();
            const profileResponse = await apiPost(
              "/auth/get-user-profile",
              { email },
              10000,
              token
            );
            if (profileResponse?.profile) {
              currentProfile = profileResponse.profile;
              setUserProfile(currentProfile);
            }
          } catch (e) {
            console.error("Error fetching profile for comment:", e);
          }
        }

        const enrichedComment = {
          ...result.comment,
          commenter_name: currentProfile?.name || "User",
          commenter_username: currentProfile?.username || "",
          commenter_photo_url:
            currentProfile?.profile_photo_url ||
            currentProfile?.logo_url ||
            null,
          like_count: 0,
          is_liked: false,
        };

        setComments((prev) => [...prev, enrichedComment]);
        setCommentInput("");
        setTaggedEntities([]);
        setShowTagSearch(false);
        setAtPosition(-1);

        // Calculate total count including all nested replies (3 levels)
        const getTotalCount = (arr) => {
          let count = arr.length;
          arr.forEach((c) => {
            if (c.replies) {
              count += c.replies.length;
              // Count sub-replies too (3rd level)
              c.replies.forEach((r) => {
                if (r.replies) count += r.replies.length;
              });
            }
          });
          return count;
        };
        const newCount = getTotalCount(comments) + 1; // +1 for the new comment
        if (onCommentCountChange) {
          onCommentCountChange(newCount);
        }
        // Emit event for other screens to update
        EventBus.emit("post-comment-updated", {
          postId: postId,
          commentCount: newCount,
        });
      }
    } catch (error) {
      console.error("Error posting comment:", error);
      Alert.alert("Error", error?.message || "Failed to post comment");
    } finally {
      setPosting(false);
    }
  };

  // Handle replying to a specific comment
  const handleReplyComment = async () => {
    if (!commentInput.trim() || posting || !replyingTo) return;

    setPosting(true);
    try {
      const token = await getAuthToken();

      // If replying to a nested comment, prepend @username to show who we're replying to
      let finalCommentText = commentInput.trim();
      if (replyingTo.isNestedReply && replyingTo.username) {
        // Only add @mention if user hasn't already typed it
        const mentionPrefix = `@${replyingTo.username}`;
        if (!finalCommentText.startsWith(mentionPrefix)) {
          finalCommentText = `${mentionPrefix} ${finalCommentText}`;
        }
      }

      const result = await apiPost(
        `/comments/${replyingTo.id}/reply`,
        {
          commentText: finalCommentText,
          taggedEntities:
            taggedEntities.length > 0 ? taggedEntities : undefined,
        },
        15000,
        token
      );

      if (result?.comment) {
        // Calculate total count BEFORE loadComments updates state (3 levels)
        const getTotalCount = (arr) => {
          let count = arr.length;
          arr.forEach((c) => {
            if (c.replies) {
              count += c.replies.length;
              c.replies.forEach((r) => {
                if (r.replies) count += r.replies.length;
              });
            }
          });
          return count;
        };
        const newCount = getTotalCount(comments) + 1; // +1 for the new reply

        // Reload comments to get updated replies with all data
        await loadComments();
        setCommentInput("");
        setTaggedEntities([]);
        setShowTagSearch(false);
        setAtPosition(-1);
        setReplyingTo(null);

        // Update count with the pre-calculated value
        if (onCommentCountChange) {
          onCommentCountChange(newCount);
        }
        EventBus.emit("post-comment-updated", {
          postId: postId,
          commentCount: newCount,
        });
      }
    } catch (error) {
      console.error("Error replying to comment:", error);
      Alert.alert("Error", error?.message || "Failed to post reply");
    } finally {
      setPosting(false);
    }
  };

  // Cancel replying mode
  const cancelReply = () => {
    setReplyingTo(null);
    setCommentInput("");
  };

  // Toggle thread collapse - undefined/true means collapsed, false means expanded
  const toggleThreadCollapse = (commentId) => {
    setCollapsedThreads((prev) => {
      const isCurrentlyExpanded = prev[commentId] === false;
      return {
        ...prev,
        [commentId]: isCurrentlyExpanded ? true : false, // Toggle to opposite state
      };
    });
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const commentTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - commentTime) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
    if (diffInSeconds < 2592000)
      return `${Math.floor(diffInSeconds / 604800)}w`;
    return `${Math.floor(diffInSeconds / 2592000)}mo`;
  };

  const handleCommentLike = async (commentId, isLiked, currentLikeCount) => {
    const newIsLiked = !isLiked;
    const numLikeCount =
      typeof currentLikeCount === "string"
        ? parseInt(currentLikeCount, 10) || 0
        : Number(currentLikeCount) || 0;
    const newLikeCount = isLiked
      ? Math.max(0, numLikeCount - 1)
      : numLikeCount + 1;

    setComments((prevComments) =>
      prevComments.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              is_liked: newIsLiked,
              isLiked: newIsLiked,
              like_count: newLikeCount,
            }
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
      console.error("Error toggling comment like:", error);
      const normalizedCurrentCount =
        typeof currentLikeCount === "string"
          ? parseInt(currentLikeCount, 10) || 0
          : Number(currentLikeCount) || 0;
      setComments((prevComments) =>
        prevComments.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                is_liked: isLiked,
                isLiked,
                like_count: normalizedCurrentCount,
              }
            : comment
        )
      );
      Alert.alert("Error", error?.message || "Failed to update like");
    }
  };

  const renderComment = ({ item }) => {
    const depth = item.depth || 0;
    const hasReplies = item.hasReplies && item.replyCount > 0;
    const isLiked = item.is_liked === true || item.isLiked === true;
    const likeCount =
      typeof item.like_count === "string"
        ? parseInt(item.like_count, 10) || 0
        : Number(item.like_count) || 0;

    // Check if this thread is expanded
    const isExpanded = collapsedThreads[item.id] === false;

    // Depth-based left margin for nested replies
    const leftMargin = depth * REPLY_INDENT;

    const handleProfilePress = () => {
      if (!navigation || !item.commenter_id) return;

      const isOwnProfile = currentUserId && item.commenter_id === currentUserId;
      const root = navigation.getParent()?.getParent()?.getParent();

      if (root) {
        if (isOwnProfile) {
          root.navigate("MemberHome", {
            screen: "Profile",
            params: { screen: "MemberProfile" },
          });
        } else {
          root.navigate("MemberHome", {
            screen: "Profile",
            params: {
              screen: "MemberPublicProfile",
              params: { memberId: item.commenter_id },
            },
          });
        }
      } else {
        const parent = navigation.getParent();
        if (parent) {
          if (isOwnProfile) {
            parent.navigate("Profile", { screen: "MemberProfile" });
          } else {
            parent.navigate("Profile", {
              screen: "MemberPublicProfile",
              params: { memberId: item.commenter_id },
            });
          }
        }
      }
    };

    // Photo URL with placeholder fallback
    const isCommunity = item.commenter_type === "community";
    const placeholderBg = isCommunity ? "5f27cd" : "6A0DAD";
    const photoUri =
      item.commenter_photo_url && item.commenter_photo_url.trim() !== ""
        ? item.commenter_photo_url
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(
            item.commenter_name || "User"
          )}&background=${placeholderBg}&color=FFFFFF`;

    return (
      <View style={[styles.commentItem, { marginLeft: leftMargin }]}>
        <TouchableOpacity onPress={handleProfilePress}>
          <Image source={{ uri: photoUri }} style={styles.commentAvatar} />
        </TouchableOpacity>
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <TouchableOpacity onPress={handleProfilePress}>
              <Text style={styles.commenterName}>{item.commenter_name}</Text>
            </TouchableOpacity>
            <Text style={styles.commentTime}>
              {formatTimeAgo(item.created_at)}
            </Text>
            {(currentUserId && item.commenter_id === currentUserId) ||
            (currentUserId &&
              postAuthorId === currentUserId &&
              postAuthorType === "member") ? (
              <TouchableOpacity
                onPress={() => handleDeleteComment(item.id)}
                style={styles.deleteButton}
              >
                <Ionicons
                  name="trash-outline"
                  size={16}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.commentText}>
            {(() => {
              let text = item.comment_text || "";
              const tagged = item.tagged_entities || [];

              if (!tagged || tagged.length === 0) {
                return text;
              }

              const parts = [];
              let lastIndex = 0;

              tagged.forEach((entity) => {
                const username = entity.username || entity.name || "";
                const searchText = `@${username}`;
                const index = text.indexOf(searchText, lastIndex);

                if (index !== -1) {
                  if (index > lastIndex) {
                    parts.push({
                      type: "text",
                      content: text.substring(lastIndex, index),
                    });
                  }
                  parts.push({ type: "tag", content: searchText, entity });
                  lastIndex = index + searchText.length;
                }
              });

              if (lastIndex < text.length) {
                parts.push({
                  type: "text",
                  content: text.substring(lastIndex),
                });
              }

              if (parts.length === 0) {
                return text;
              }

              return parts.map((part, idx) => {
                if (part.type === "tag") {
                  return (
                    <Text key={idx} style={styles.taggedUsername}>
                      {part.content}
                    </Text>
                  );
                }
                return <Text key={idx}>{part.content}</Text>;
              });
            })()}
          </Text>

          {/* Action row: Reply + Show/Hide replies */}
          <View style={styles.commentActionsRow}>
            <TouchableOpacity
              style={styles.replyButton}
              onPress={() => {
                setReplyingTo({
                  // Reply to this specific comment (up to depth 2)
                  // For depth 2, route to parent to keep max 3 levels
                  id: item.depth >= 2 ? item.parentCommentId : item.id,
                  name: item.commenter_name,
                  username: item.commenter_username,
                  isNestedReply: item.depth > 0,
                });
                setFocusTrigger((prev) => prev + 1); // Trigger robust focus logic

                // Reinforce focus immediately on button tap
                inputRef.current?.focus();
              }}
            >
              <Ionicons
                name="arrow-undo-outline"
                size={14}
                color={COLORS.textSecondary}
              />
              <Text style={styles.replyButtonText}>Reply</Text>
            </TouchableOpacity>

            {hasReplies && (
              <TouchableOpacity
                style={styles.showRepliesButton}
                onPress={() => toggleThreadCollapse(item.id)}
              >
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={COLORS.primary}
                />
                <Text style={styles.showRepliesText}>
                  {isExpanded
                    ? "Hide replies"
                    : `View ${item.replyCount} ${
                        item.replyCount === 1 ? "reply" : "replies"
                      }`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
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

  const content = (
    <View style={embedded ? styles.embeddedContainer : styles.container}>
      <View style={styles.modalContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Comments</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.textSecondary} />
          </View>
        ) : (
          <FlatList
            data={flatComments}
            keyExtractor={(item) => item.id?.toString()}
            renderItem={renderComment}
            style={styles.commentsList}
            contentContainerStyle={styles.commentsListContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No comments yet</Text>
                <Text style={styles.emptySubtext}>
                  Be the first to comment!
                </Text>
              </View>
            }
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>

      {/* Input bar using KeyboardAwareToolbar - placed OUTSIDE main content as sibling */}
      <KeyboardAwareToolbar style={styles.toolbarContainer}>
        <View style={styles.inputContainer}>
          {/* Replying indicator */}
          {replyingTo && (
            <View style={styles.replyingIndicator}>
              <Text style={styles.replyingText}>
                Replying to{" "}
                <Text style={styles.replyingName}>@{replyingTo.name}</Text>
              </Text>
              <TouchableOpacity
                onPress={cancelReply}
                style={styles.cancelReplyButton}
              >
                <Ionicons name="close" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <Image
              source={{
                uri:
                  (userProfile?.profile_photo_url &&
                    /^https?:\/\//.test(userProfile.profile_photo_url)) ||
                  (userProfile?.logo_url &&
                    /^https?:\/\//.test(userProfile.logo_url))
                    ? userProfile.profile_photo_url || userProfile.logo_url
                    : userProfile?.name
                    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        userProfile.name
                      )}&background=${
                        userProfile?.logo_url ? "5f27cd" : "6A0DAD"
                      }&color=FFFFFF&size=32`
                    : `https://ui-avatars.com/api/?name=User&background=6A0DAD&color=FFFFFF&size=32`,
              }}
              style={styles.inputAvatar}
            />
            <View style={{ flex: 1, position: "relative" }}>
              <TextInput
                ref={inputRef}
                value={commentInput}
                onChangeText={handleCommentInputChange}
                placeholder={
                  replyingTo
                    ? `Reply to @${replyingTo.name}...`
                    : "Add a comment..."
                }
                placeholderTextColor={COLORS.textSecondary}
                style={styles.input}
                multiline
                editable={!posting}
              />
              {showTagSearch && (
                <View style={styles.tagSearchContainer}>
                  {tagSearchLoading ? (
                    <View style={styles.tagSearchItem}>
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    </View>
                  ) : tagSearchResults.length > 0 ? (
                    <FlatList
                      data={tagSearchResults}
                      keyExtractor={(item) => String(item.id)}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.tagSearchItem}
                          onPress={() => selectTaggedUser(item)}
                        >
                          <Image
                            source={{
                              uri:
                                item.profile_photo_url ||
                                "https://via.placeholder.com/30",
                            }}
                            style={styles.tagSearchAvatar}
                          />
                          <View style={styles.tagSearchInfo}>
                            <Text
                              style={styles.tagSearchName}
                              numberOfLines={1}
                            >
                              {item.full_name || item.name || "User"}
                            </Text>
                            <Text
                              style={styles.tagSearchUsername}
                              numberOfLines={1}
                            >
                              @{item.username || "user"}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )}
                      style={styles.tagSearchList}
                      keyboardShouldPersistTaps="handled"
                    />
                  ) : (
                    <View style={styles.tagSearchItem}>
                      <Text style={styles.tagSearchEmpty}>No users found</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={replyingTo ? handleReplyComment : handlePostComment}
              disabled={!commentInput.trim() || posting}
              style={styles.sendButton}
            >
              <Ionicons
                name="send"
                size={20}
                color={
                  commentInput.trim() && !posting
                    ? COLORS.primary
                    : COLORS.textSecondary
                }
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareToolbar>
    </View>
  );

  if (!visible) return null;

  if (embedded) {
    return <View style={styles.embeddedOverlay}>{content}</View>;
  }

  if (isNestedModal) {
    return <View style={styles.nestedModalOverlay}>{content}</View>;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
    >
      {content}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  embeddedContainer: {
    flex: 1,
    backgroundColor: COLORS.dark,
  },
  embeddedOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: COLORS.dark,
  },
  nestedModalOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  modalContent: {
    height: "95%",
    backgroundColor: COLORS.dark,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text,
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  commentsList: {
    flex: 1,
  },
  commentsListContent: {
    paddingVertical: 10,
    paddingBottom: 100,
  },
  commentItem: {
    flexDirection: "row",
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
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  deleteButton: {
    marginLeft: "auto",
    padding: 4,
  },
  commenterName: {
    fontSize: 14,
    fontWeight: "600",
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
    fontWeight: "500",
  },
  commentLikeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 8,
  },
  commentLikeCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  toolbarContainer: {
    backgroundColor: COLORS.dark,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  inputContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: COLORS.dark,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.darkGray,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    padding: 8,
  },
  tagSearchContainer: {
    position: "absolute",
    bottom: "100%",
    left: 0,
    right: 0,
    backgroundColor: COLORS.dark,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    maxHeight: 200,
    marginBottom: 4,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  tagSearchList: {
    maxHeight: 200,
  },
  tagSearchItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tagSearchAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  tagSearchInfo: {
    flex: 1,
  },
  tagSearchName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 2,
  },
  tagSearchUsername: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  tagSearchEmpty: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    paddingVertical: 10,
  },
  taggedUsername: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  // Reply UI styles
  commentActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 16,
  },
  replyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  replyButtonText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  showRepliesButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  showRepliesText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "500",
  },
  replyingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.darkGray,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  replyingText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  replyingName: {
    fontWeight: "600",
    color: COLORS.primary,
  },
  cancelReplyButton: {
    padding: 4,
  },
});

export default CommentsModal;
