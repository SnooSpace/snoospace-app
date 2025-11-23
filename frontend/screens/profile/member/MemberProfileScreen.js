import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Dimensions,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CommonActions, useRoute, useFocusEffect } from "@react-navigation/native";
import { clearAuthSession, getAuthToken } from "../../../api/auth";
import { apiGet, apiPost, apiDelete } from "../../../api/client";
import { deleteAccount as apiDeleteAccount } from "../../../api/account";
import {
  launchImageLibraryAsync,
  requestMediaLibraryPermissionsAsync,
  MediaTypeOptions,
} from "expo-image-picker";
import { uploadImage } from "../../../api/cloudinary";
import PostCard from "../../../components/PostCard"; // Assuming PostCard exists for a full post view
import CommentsModal from "../../../components/CommentsModal";
import EventBus from "../../../utils/EventBus";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const PRIMARY_COLOR = "#6A0DAD";
const TEXT_COLOR = "#1D1D1F";
const LIGHT_TEXT_COLOR = "#8E8E93";

export default function MemberProfileScreen({ navigation }) {
  const route = useRoute();
  console.log(
    "[Profile] MemberProfileScreen component function START (mount or render)"
  );
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [showAllInterests, setShowAllInterests] = useState(false);
  const [showAllPronouns, setShowAllPronouns] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  // Combine comments modal state into one object to reduce state updates
  const [commentsModalState, setCommentsModalState] = useState({
    visible: false,
    postId: null,
  });
  // Buffer for avoiding parent re-renders during like/unlike inside PostModal
  const pendingPostUpdateRef = React.useRef(null);
  const loadProfileRef = React.useRef(null);

  const loadProfile = async (isRefresh = false) => {
    console.log("[Profile] loadProfile: start", isRefresh ? "(refresh)" : "");
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const token = await getAuthToken();
      console.log(`[Profile] Token: ${token}`);
      if (!token) throw new Error("No auth token found");
      const email = await AsyncStorage.getItem("auth_email");
      if (!email) throw new Error("No user email in AsyncStorage");
      const userProfileResponse = await apiPost(
        "/auth/get-user-profile",
        { email },
        15000,
        token
      );
      console.log("[Profile] userProfileResponse:", userProfileResponse);
      const fullProfile = userProfileResponse?.profile;
      const userRole = userProfileResponse?.role;
      if (!fullProfile || userRole !== "member") {
        console.log(
          "[Profile] No fullProfile or not member:",
          fullProfile,
          userRole
        );
        throw new Error("Failed to fetch member profile or incorrect role.");
      }
      const userId = fullProfile.id;
      const userType = "member";
      const [countsResponse, postsResponse] = await Promise.all([
        apiGet(`/follow/counts/${userId}/${userType}`, 15000, token),
        apiGet(`/posts/user/${userId}/${userType}`, 15000, token),
      ]);
      console.log("[Profile] countsResponse:", countsResponse);
      console.log("[Profile] postsResponse:", postsResponse);
      const followerCount =
        typeof countsResponse?.followers_count === "number"
          ? countsResponse.followers_count
          : parseInt(countsResponse?.followers_count || 0, 10);
      const followingCount =
        typeof countsResponse?.following_count === "number"
          ? countsResponse.following_count
          : parseInt(countsResponse?.following_count || 0, 10);
      const userPosts = Array.isArray(postsResponse?.posts)
        ? postsResponse.posts
        : [];
      const mappedProfile = {
        id: userId,
        name: fullProfile.name || "",
        username: fullProfile.username || "",
        email: fullProfile.email || "",
        phone: fullProfile.phone || "",
        bio: fullProfile.bio || "",
        profile_photo_url: fullProfile.profile_photo_url || "",
        interests: Array.isArray(fullProfile.interests)
          ? fullProfile.interests
          : fullProfile.interests
          ? JSON.parse(fullProfile.interests)
          : [],
        pronouns: Array.isArray(fullProfile.pronouns)
          ? fullProfile.pronouns
          : fullProfile.pronouns
          ? [fullProfile.pronouns]
          : null,
        location:
          typeof fullProfile.location === "string"
            ? JSON.parse(fullProfile.location)
            : fullProfile.location || null,
        city: fullProfile.city || "",
        follower_count: followerCount,
        following_count: followingCount,
      };
      setProfile(mappedProfile);
      setPosts(
        userPosts.map((post) => ({
          ...post,
          isLiked: !!post.is_liked,
        }))
      );
      console.log("[Profile] loadProfile: setProfile & setPosts");
    } catch (err) {
      console.log("[Profile] loadProfile: error caught:", err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
      console.log(
        "[Profile] loadProfile: finally, loading/refreshing set to false"
      );
    }
  };

  // Handle pull-to-refresh
  const onRefresh = useCallback(() => {
    console.log("[Profile] onRefresh: user pulled to refresh");
    loadProfile(true);
  }, []);

  // Store loadProfile in ref so it can be accessed in navigation listener
  loadProfileRef.current = loadProfile;

  useEffect(() => {
    // Always load profile once on mount
    console.log("[Profile] useEffect: initial mount loadProfile call");
    loadProfile();
    const off = EventBus.on("follow-updated", (payload) => {
      // Optimistically adjust following_count for current user when they follow/unfollow someone
      setProfile((prev) => {
        if (!prev) return prev;
        const delta = payload?.isFollowing ? 1 : -1;
        const next = Math.max(0, (prev.following_count || 0) + delta);
        return { ...prev, following_count: next };
      });
    });
    return () => {
      console.log("[Profile] useEffect cleanup (unsubscribing)");
      off();
    };
  }, []);

  // Refresh profile when screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      loadProfile(true);
    }, [])
  );

  // Navigation listener to detect when returning from EditProfile with changes
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      // Check route params for refresh flag from EditProfile
      const params = route.params;
      if (params?.refreshProfile === true) {
        console.log(
          "[Profile] Navigation listener: returning from EditProfile with changes, reloading profile"
        );
        if (loadProfileRef.current) {
          loadProfileRef.current();
        }
        // Clear the param to avoid reloading again
        navigation.setParams({ refreshProfile: undefined });
      }
    });

    return unsubscribe;
  }, [navigation, route.params]);

  const handleEditProfile = () => {
    // Navigate to EditProfile (same stack - ProfileStackNavigator)
    navigation.navigate("EditProfile", { profile });
  };
  // Render bio preserving explicit newlines exactly as typed
  const renderBio = (bioText) => {
    if (!bioText) return null;
    const lines = String(bioText).replace(/\r\n/g, "\n").split("\n");
    return (
      <Text style={styles.bioLeft}>
        {lines.map((line, idx) => (
          <Text key={`bio-${idx}`}>
            {line}
            {idx !== lines.length - 1 ? "\n" : ""}
          </Text>
        ))}
      </Text>
    );
  };

  // Change Photo moved to Edit Profile screen

  const handleFollow = async () => {
    try {
      // Toggle follow status
      Alert.alert("Follow", "Follow functionality will be implemented soon!");
    } catch (error) {
      console.error("Error following:", error);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            // Close settings modal first
            setShowSettingsModal(false);

            // Clear all authentication data
            await clearAuthSession();
            await AsyncStorage.multiRemove([
              "accessToken",
              "userData",
              "auth_token",
              "auth_email",
              "pending_otp",
            ]);

            // Get the root navigator by going up the navigation hierarchy
            let rootNavigator = navigation;

            // Try to get parent navigator (go up from MemberProfileScreen to MemberBottomTabNavigator)
            if (navigation.getParent) {
              const parent = navigation.getParent();
              if (parent) {
                // Go up one more level (from MemberBottomTabNavigator to AppNavigator)
                rootNavigator = parent.getParent ? parent.getParent() : parent;
              }
            }

            // Reset navigation stack to Landing using root navigator
            rootNavigator.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: "Landing" }],
              })
            );
          } catch (error) {
            console.error("Error during logout:", error);
            Alert.alert("Error", "Failed to logout properly");
          }
        },
      },
    ]);
  };

  const openPostModal = (post) => {
    setSelectedPost(post);
    setPostModalVisible(true);
  };
  const closePostModal = () => {
    // Apply any buffered like updates once when the modal closes
    const pending = pendingPostUpdateRef.current;
    if (pending && pending.postId != null) {
      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p.id === pending.postId
            ? {
                ...p,
                is_liked: pending.is_liked,
                isLiked: pending.is_liked,
                like_count: pending.like_count,
              }
            : p
        )
      );
      pendingPostUpdateRef.current = null;
    }
    setPostModalVisible(false);
    setSelectedPost(null);
  };

  // Memoized callback to open comments modal - uses single state update to prevent unnecessary re-renders
  const openCommentsModal = useCallback((postId) => {
    if (postId) {
      // Single state update instead of two separate updates
      setCommentsModalState({ visible: true, postId });
    }
  }, []);

  // Memoized callback to close comments modal
  const closeCommentsModal = useCallback(() => {
    setCommentsModalState({ visible: false, postId: null });
  }, []);

  // Add utility for updating posts global state (so modal & grid stay in sync)
  function updatePostsGlobalState(postId, isLiked, likes) {
    setPosts((prevPosts) =>
      prevPosts.map((p) =>
        p.id === postId ? { ...p, isLiked, like_count: likes } : p
      )
    );
  }

  const renderPostGrid = () => {
    const gap = 10;
    const itemSize = (screenWidth - 40 - gap * 2) / 3; // (screenWidth - padding(40) - gaps(20)) / 3
    const data = posts.length > 0 ? posts : new Array(6).fill(null);

    return (
      <FlatList
        data={data}
        keyExtractor={(_, index) =>
          data[index]?.id ? String(data[index].id) : `ph-${index}`
        }
        numColumns={3}
        columnWrapperStyle={{ justifyContent: "flex-start", marginBottom: gap }}
        renderItem={({ item, index }) => {
          const isLastInRow = (index + 1) % 3 === 0;
          return (
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.postGridItem,
                {
                  width: itemSize,
                  height: itemSize,
                  marginRight: isLastInRow ? 0 : gap,
                },
              ]}
              onPress={() => item && openPostModal(item)}
              disabled={!item}
            >
              {item ? (
                (() => {
                  const firstImageUrl = Array.isArray(item.image_urls)
                    ? item.image_urls
                        .flat()
                        .find(
                          (u) => typeof u === "string" && u.startsWith("http")
                        )
                    : undefined;
                  return (
                    <Image
                      source={{
                        uri: firstImageUrl || "https://via.placeholder.com/150",
                      }}
                      style={styles.postImage}
                    />
                  );
                })()
              ) : (
                <View style={styles.placeholderPost}>
                  <Ionicons
                    name="image-outline"
                    size={30}
                    color={LIGHT_TEXT_COLOR}
                  />
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        scrollEnabled={false}
      />
    );
  };

  // --- Full Post Modal Component ---
  const PostModal = ({
    visible,
    post,
    onClose,
    onLikeUpdate,
    profile: profileProp,
    onOpenComments,
    onCloseComments,
  }) => {
    // Initialize from post data (like PostCard does)
    const initialIsLiked = post?.is_liked === true || post?.isLiked === true;
    const [likes, setLikes] = useState(post?.like_count || 0);
    const [isLiked, setIsLiked] = useState(initialIsLiked);
    const [commentCount, setCommentCount] = useState(post?.comment_count || 0);
    const [showDeleteMenu, setShowDeleteMenu] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [isLiking, setIsLiking] = useState(false);
    const [localCommentsVisible, setLocalCommentsVisible] = useState(false);
    const justUpdatedRef = React.useRef(false);

    // Sync state when post prop changes (exactly like PostCard)
    // But skip syncing immediately after we manually updated to avoid overwriting our changes
    useEffect(() => {
      if (!visible) return;
      if (justUpdatedRef.current) {
        // We just manually updated, skip this sync cycle
        justUpdatedRef.current = false;
        return;
      }
      const newIsLiked = post?.is_liked === true || post?.isLiked === true;
      setIsLiked(newIsLiked);
      setLikes(post?.like_count || 0);
      setCommentCount(post?.comment_count || 0);
    }, [
      post?.is_liked,
      post?.isLiked,
      post?.like_count,
      post?.comment_count,
      visible,
    ]);

    // Reset delete menu when modal closes
    useEffect(() => {
      if (!visible) {
        setShowDeleteMenu(false);
      }
    }, [visible]);

    // Check if current user owns the post
    const isOwnPost = () => {
      // Since this is the member's own profile screen, all posts should belong to them
      // But we'll verify by checking if the post's author matches the profile
      return (
        post?.author_id === profileProp?.id && post?.author_type === "member"
      );
    };

    // Handle delete post
    const handleDeletePost = async () => {
      if (!post?.id) return;

      if (!isOwnPost()) {
        Alert.alert("Error", "You can only delete your own posts");
        setShowDeleteMenu(false);
        return;
      }

      Alert.alert(
        "Delete Post",
        "Are you sure you want to delete this post? This action cannot be undone.",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setShowDeleteMenu(false),
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              setDeleting(true);
              try {
                const token = await getAuthToken();
                await apiDelete(`/posts/${post.id}`, null, 15000, token);

                // Remove post from local state
                setPosts((prevPosts) =>
                  prevPosts.filter((p) => p.id !== post.id)
                );

                // Clear comments modal if it was open for this post
                if (onCloseComments) {
                  onCloseComments();
                }

                // Close modal
                onClose();
                Alert.alert("Success", "Post deleted successfully");
              } catch (error) {
                Alert.alert("Error", error?.message || "Failed to delete post");
              } finally {
                setDeleting(false);
                setShowDeleteMenu(false);
              }
            },
          },
        ]
      );
    };

    // Like/unlike logic - exactly like PostCard
    const handleLikeToggle = async () => {
      if (isLiking) return;

      setIsLiking(true);
      justUpdatedRef.current = true; // Mark that we're manually updating
      try {
        const token = await getAuthToken();

        if (isLiked) {
          await apiDelete(`/posts/${post.id}/like`, null, 15000, token);
          setLikes((prev) => {
            const newCount = prev - 1;
            if (onLikeUpdate) {
              onLikeUpdate(post.id, false, newCount);
            }
            return newCount;
          });
          setIsLiked(false);
        } else {
          await apiPost(`/posts/${post.id}/like`, {}, 15000, token);
          setLikes((prev) => {
            const newCount = prev + 1;
            if (onLikeUpdate) {
              onLikeUpdate(post.id, true, newCount);
            }
            return newCount;
          });
          setIsLiked(true);
        }
      } catch (error) {
        console.error("Error liking post:", error);
        // Silently handle "Post already liked" and "Post not liked" errors
        const errorMessage = error?.message || '';
        if (errorMessage.includes('already liked') || errorMessage.includes('not liked')) {
          // These are expected errors when double-clicking, just ignore
          justUpdatedRef.current = false;
          return;
        }
        // Only show alert for unexpected errors
        // Alert.alert("Error", error?.message || "Failed to like post");
        justUpdatedRef.current = false; // Reset on error so we can sync
      } finally {
        setIsLiking(false);
        // Reset the flag after a short delay to allow useEffect to run normally again
        setTimeout(() => {
          justUpdatedRef.current = false;
        }, 100);
      }
    };

    if (!post) return null;
    const images = Array.isArray(post.image_urls)
      ? post.image_urls
          .flat()
          .filter((u) => typeof u === "string" && u.startsWith("http"))
      : [];

    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Keep track of post ID to prevent unnecessary re-renders
    const [currentPostId, setCurrentPostId] = useState(post?.id);
    useEffect(() => {
      if (post?.id && post.id !== currentPostId) {
        setCurrentPostId(post.id);
      }
    }, [post?.id]);
    const formatDate = (timestamp) => {
      const date = new Date(timestamp);
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      return `${date.getDate()} ${
        months[date.getMonth()]
      } ${date.getFullYear()}`;
    };

    return (
      <Modal
        visible={visible}
        transparent={false}
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent={true}
      >
        <SafeAreaView style={styles.postModalSafeArea}>
          <View style={styles.postModalContainer}>
            {/* Header */}
            <View style={styles.postModalHeader}>
              <View style={styles.postModalHeaderTop}>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.postModalBackButton}
                >
                  <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.postModalHeaderTitle}>Posts</Text>
                <TouchableOpacity
                  style={styles.postModalMoreButton}
                  onPress={() => {
                    if (isOwnPost()) {
                      setShowDeleteMenu(true);
                    }
                  }}
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color="#000" />
                </TouchableOpacity>
              </View>
              <View style={styles.postModalHeaderUserInfo}>
                <Image
                  source={{
                    uri:
                      post.author_photo_url ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        post.author_name || "User"
                      )}&background=6A0DAD&color=FFFFFF`,
                  }}
                  style={styles.postModalHeaderAvatar}
                />
                <View style={styles.postModalHeaderText}>
                  <Text style={styles.postModalHeaderUsername}>
                    {post.author_username}
                  </Text>
                  <Text style={styles.postModalHeaderDate}>
                    {formatDate(post.created_at)}
                  </Text>
                </View>
              </View>
            </View>

            <ScrollView
              style={styles.postModalScrollView}
              showsVerticalScrollIndicator={false}
            >
              {/* Image Carousel */}
              <View style={styles.postModalImageWrapper}>
                {images.length > 0 && (
                  <>
                    <FlatList
                      data={images}
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      keyExtractor={(_, idx) => idx.toString()}
                      onMomentumScrollEnd={(e) => {
                        const index = Math.round(
                          e.nativeEvent.contentOffset.x / screenWidth
                        );
                        setCurrentImageIndex(index);
                      }}
                      renderItem={({ item }) => (
                        <View style={styles.postModalImageFrame}>
                          <Image
                            source={{ uri: item }}
                            style={styles.postModalImage}
                            resizeMode="cover"
                          />
                        </View>
                      )}
                      style={styles.modalImageCarousel}
                    />
                    {images.length > 1 && (
                      <View style={styles.postModalImageIndicator}>
                        <Text style={styles.postModalImageIndicatorText}>
                          {currentImageIndex + 1}/{images.length}
                        </Text>
                      </View>
                    )}
                    {images.length > 1 && (
                      <View style={styles.postModalImageDots}>
                        {images.map((_, idx) => (
                          <View
                            key={idx}
                            style={[
                              styles.postModalDot,
                              idx === currentImageIndex &&
                                styles.postModalDotActive,
                            ]}
                          />
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.postModalActionsRow}>
                <TouchableOpacity
                  onPress={handleLikeToggle}
                  style={styles.modalActionButton}
                  disabled={isLiking}
                >
                  <Ionicons
                    name={isLiked ? "heart" : "heart-outline"}
                    size={28}
                    color={isLiked ? "#FF3040" : "#000"}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setLocalCommentsVisible(true);
                  }}
                  style={styles.modalActionButton}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons
                      name="chatbubble-outline"
                      size={26}
                      color="#000"
                    />
                    {commentCount > 0 && (
                      <Text style={styles.postModalCommentCount}>
                        {commentCount}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View>

              {/* Likes Count */}
              {likes > 0 && (
                <View style={styles.postModalLikesSection}>
                  <Text style={styles.postModalLikesText}>
                    {likes === 1 ? "1 like" : `${likes} likes`}
                  </Text>
                </View>
              )}

              {/* Caption */}
              <View style={styles.postModalCaptionSection}>
                <Text style={styles.postModalCaption}>
                  <Text style={styles.postModalCaptionUsername}>
                    {post.author_username}
                  </Text>
                  {post.caption && ` ${post.caption}`}
                </Text>
              </View>

              {/* View Comments Button */}
              {commentCount > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setLocalCommentsVisible(true);
                  }}
                  style={styles.postModalViewCommentsButton}
                >
                  <Text style={styles.postModalViewCommentsText}>
                    View all {commentCount}{" "}
                    {commentCount === 1 ? "comment" : "comments"}
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* Delete Menu Modal */}
          <Modal
            visible={showDeleteMenu}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowDeleteMenu(false)}
          >
            <TouchableOpacity
              style={styles.deleteMenuOverlay}
              activeOpacity={1}
              onPress={() => setShowDeleteMenu(false)}
            >
              <View style={styles.deleteMenuContainer}>
                <TouchableOpacity
                  style={[
                    styles.deleteMenuOption,
                    deleting && styles.deleteMenuOptionDisabled,
                  ]}
                  onPress={handleDeletePost}
                  disabled={deleting}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#FF3B30" />
                  ) : (
                    <>
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color="#FF3B30"
                      />
                      <Text style={styles.deleteMenuOptionText}>
                        Delete Post
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteMenuOption}
                  onPress={() => setShowDeleteMenu(false)}
                >
                  <Text style={styles.deleteMenuCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        </SafeAreaView>
        {/* Replace the existing CommentsModal inside PostModal with this */}
        <CommentsModal
          visible={localCommentsVisible}
          postId={post?.id}
          onClose={() => setLocalCommentsVisible(false)}
          onCommentCountChange={(newCount) => setCommentCount(newCount)}
          isNestedModal={true} // Added this prop instead of embedded
          navigation={navigation}
        />
      </Modal>
    );
  };

  // Removed loading spinner - content loads immediately with RefreshControl for updates

  if (error) {
    console.log("[Profile] rendering: error banner", error);
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          {error === "No auth token found" ? (
            <TouchableOpacity
              onPress={async () => {
                await clearAuthSession();
                await AsyncStorage.multiRemove([
                  "accessToken",
                  "userData",
                  "auth_token",
                  "auth_email",
                  "pending_otp",
                ]);
                navigation.reset({ index: 0, routes: [{ name: "Landing" }] });
              }}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Login</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={loadProfile} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    console.log("[Profile] rendering: no profile");
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load profile</Text>
        </View>
      </SafeAreaView>
    );
  }

  console.log("[Profile] rendering: main profile UI");
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.username}>@{profile.username}</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setShowSettingsModal(true)}
        >
          <Ionicons name="settings-outline" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PRIMARY_COLOR}
            colors={[PRIMARY_COLOR]}
          />
        }
      >
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            <Image
              source={{
                uri:
                  profile.profile_photo_url &&
                  /^https?:\/\//.test(profile.profile_photo_url)
                    ? profile.profile_photo_url
                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        profile.name || "Member"
                      )}&background=6A0DAD&color=FFFFFF&size=120&bold=true`,
              }}
              style={styles.profileImage}
            />
          </View>

          <View style={styles.nameAndPronounsContainer}>
            <Text style={styles.profileName}>{profile.name}</Text>
            {Array.isArray(profile.pronouns) && profile.pronouns.length > 0 ? (
              <View style={styles.pronounsRowCentered}>
                <View
                  key={`pronoun-0`}
                  style={[styles.chip, styles.pronounChipSmall]}
                >
                  <Text style={styles.chipText}>
                    {String(profile.pronouns[0]).replace(
                      /^[{\"]+|[}\"]+$/g,
                      ""
                    )}
                  </Text>
                </View>
                {profile.pronouns.length > 1 && !showAllPronouns ? (
                  <TouchableOpacity
                    onPress={() => setShowAllPronouns(true)}
                    style={[styles.chip, styles.pronounChipSmall]}
                  >
                    <Text style={styles.chipText}>
                      +{profile.pronouns.length - 1}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {profile.pronouns.length > 1 && showAllPronouns ? (
                  <TouchableOpacity
                    onPress={() => setShowAllPronouns(false)}
                    style={[
                      styles.chip,
                      styles.pronounChipSmall,
                      styles.chipRed,
                    ]}
                  >
                    <Text style={[styles.chipText, styles.chipTextRed]}>-</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
          {Array.isArray(profile.pronouns) &&
          profile.pronouns.length > 1 &&
          showAllPronouns ? (
            <View style={styles.expandedPronounsRow}>
              {profile.pronouns.slice(1).map((p, idx) => (
                <View
                  key={`pronoun-expanded-${idx}`}
                  style={[styles.chip, styles.pronounChipSmall]}
                >
                  <Text style={styles.chipText}>
                    {String(p).replace(/^[{\"]+|[}\"]+$/g, "")}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {profile.bio ? renderBio(profile.bio) : null}

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{posts.length}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => {
                // Navigate to FollowersList (same stack - ProfileStackNavigator)
                navigation.navigate("FollowersList", {
                  memberId: profile.id,
                  title: "Followers",
                });
              }}
            >
              <Text style={styles.statNumber}>{profile.follower_count}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => {
                // Navigate to FollowingList (same stack - ProfileStackNavigator)
                navigation.navigate("FollowingList", {
                  memberId: profile.id,
                  title: "Following",
                });
              }}
            >
              <Text style={styles.statNumber}>{profile.following_count}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
          </View>

          {/* Interests */}
          {Array.isArray(profile.interests) && profile.interests.length > 0 ? (
            <View style={styles.metaChipsSection}>
              <View style={[styles.chipGridRow, { marginTop: 6 }]}>
                {(showAllInterests
                  ? profile.interests
                  : profile.interests.slice(0, 6)
                ).map((i, idx) => (
                  <View
                    key={`interest-${idx}`}
                    style={[styles.chip, styles.chipGridItem]}
                  >
                    <Text style={styles.chipText}>{String(i)}</Text>
                  </View>
                ))}
                {profile.interests.length > 6 && !showAllInterests ? (
                  <TouchableOpacity
                    onPress={() => setShowAllInterests(true)}
                    style={[styles.chip, styles.chipBlue, styles.chipGridItem]}
                  >
                    <Text style={[styles.chipText, styles.chipTextBlue]}>
                      See all
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {profile.interests.length > 6 && showAllInterests ? (
                  <TouchableOpacity
                    onPress={() => setShowAllInterests(false)}
                    style={[styles.chip, styles.chipBlue, styles.chipGridItem]}
                  >
                    <Text style={[styles.chipText, styles.chipTextBlue]}>
                      Collapse
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Action Buttons */}
          {isOwnProfile ? (
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                marginTop: 10,
                width: "100%",
              }}
            >
              <TouchableOpacity
                style={[styles.actionButton, { flex: 1 }]}
                onPress={handleEditProfile}
              >
                <Text style={styles.actionButtonText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { flex: 1 }]}
                onPress={() => {
                  navigation.navigate("CreatePost");
                }}
              >
                <Text style={styles.actionButtonText}>Create Post</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, { marginTop: 10 }]}
              onPress={handleFollow}
            >
              <Text style={styles.actionButtonText}>Follow</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Posts Grid */}
        <View style={styles.postsSection}>
          <View style={styles.postsGrid}>{renderPostGrid()}</View>
        </View>
      </ScrollView>
      {/* --- Full Post Modal Viewer --- */}
      <PostModal
        visible={postModalVisible}
        post={selectedPost}
        onClose={closePostModal}
        profile={profile}
        onOpenComments={openCommentsModal}
        onCloseComments={closeCommentsModal}
        onLikeUpdate={(postId, newIsLiked, newLikeCount) => {
          // Buffer the update; apply once on modal close to avoid parent re-renders
          pendingPostUpdateRef.current = {
            postId,
            is_liked: newIsLiked,
            like_count: newLikeCount,
          };
          // Do NOT set state here. PostModal manages its own UI state.
        }}
      />

      {/* Comments Modal - Render after PostModal to ensure proper z-index */}
      <CommentsModal
        visible={commentsModalState.visible && !postModalVisible}
        postId={commentsModalState.postId}
        onClose={() => {
          setCommentsModalState({ visible: false, postId: null });
        }}
        onCommentCountChange={(newCount) => {
          // Update comment count in posts array
          if (commentsModalState.postId) {
            setPosts((prevPosts) =>
              prevPosts.map((p) =>
                p.id === commentsModalState.postId
                  ? { ...p, comment_count: newCount }
                  : p
              )
            );
            // Update selectedPost so PostModal's comment count updates immediately
            if (selectedPost && selectedPost.id === commentsModalState.postId) {
              setSelectedPost((prev) =>
                prev ? { ...prev, comment_count: newCount } : prev
              );
            }
          }
          // IMPORTANT: Modal should remain open - don't change commentsModalState
        }}
        navigation={navigation}
      />

      {/* Settings Modal */}
      <Modal
        visible={showSettingsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowSettingsModal(false)}
              >
                <Ionicons name="close" size={24} color={TEXT_COLOR} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TouchableOpacity
                style={styles.settingsOption}
                onPress={() => {
                  setShowSettingsModal(false);
                  handleEditProfile();
                }}
              >
                <Ionicons
                  name="notifications-outline"
                  size={24}
                  color={TEXT_COLOR}
                />
                <Text style={styles.settingsOptionText}>Notifications</Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={LIGHT_TEXT_COLOR}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingsOption}
                onPress={() => {
                  setShowSettingsModal(false);
                  Alert.alert(
                    "Privacy",
                    "Privacy settings will be implemented soon!"
                  );
                }}
              >
                <Ionicons name="shield-outline" size={24} color={TEXT_COLOR} />
                <Text style={styles.settingsOptionText}>Privacy</Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={LIGHT_TEXT_COLOR}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingsOption}
                onPress={() => {
                  setShowSettingsModal(false);
                  Alert.alert(
                    "Help",
                    "Help & Support will be implemented soon!"
                  );
                }}
              >
                <Ionicons
                  name="help-circle-outline"
                  size={24}
                  color={TEXT_COLOR}
                />
                <Text style={styles.settingsOptionText}>Help & Support</Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={LIGHT_TEXT_COLOR}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.settingsOption, styles.logoutOption]}
                onPress={handleLogout}
              >
                <Ionicons name="log-out-outline" size={24} color="#007AFF" />
                <Text style={[styles.settingsOptionText, styles.logoutText]}>
                  Logout
                </Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity
                style={styles.settingsOption}
                onPress={() => {
                  setShowSettingsModal(false);
                  setShowDeleteModal(true);
                }}
              >
                <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                <Text style={[styles.settingsOptionText, styles.deleteText]}>
                  Delete Account
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={LIGHT_TEXT_COLOR}
                />
              </TouchableOpacity>

              <View style={styles.divider} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delete Account</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeleteInput("");
                }}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={TEXT_COLOR} />
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
              <Text style={{ color: LIGHT_TEXT_COLOR, marginBottom: 12 }}>
                This is permanent and cannot be undone. Type "delete" to
                confirm.
              </Text>
              <TextInput
                value={deleteInput}
                onChangeText={setDeleteInput}
                placeholder="Type delete"
                autoCapitalize="none"
                style={{
                  borderWidth: 1,
                  borderColor: "#E5E5EA",
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  marginBottom: 16,
                }}
              />
              <TouchableOpacity
                disabled={
                  deleting || deleteInput.trim().toLowerCase() !== "delete"
                }
                onPress={async () => {
                  if (deleteInput.trim().toLowerCase() !== "delete") return;
                  setDeleting(true);
                  try {
                    await apiDeleteAccount();
                    await clearAuthSession();
                    await AsyncStorage.multiRemove([
                      "accessToken",
                      "userData",
                      "auth_token",
                      "auth_email",
                      "pending_otp",
                    ]);
                    setShowDeleteModal(false);
                    // Get the root navigator
                    let rootNavigator = navigation;
                    if (navigation.getParent) {
                      const parent = navigation.getParent();
                      if (parent) {
                        rootNavigator = parent.getParent
                          ? parent.getParent()
                          : parent;
                      }
                    }
                    rootNavigator.dispatch(
                      CommonActions.reset({
                        index: 0,
                        routes: [{ name: "Landing" }],
                      })
                    );
                  } catch (e) {
                    Alert.alert(
                      "Delete failed",
                      e?.message || "Could not delete account"
                    );
                  } finally {
                    setDeleting(false);
                  }
                }}
                style={{
                  backgroundColor:
                    deleteInput.trim().toLowerCase() === "delete"
                      ? "#FF3B30"
                      : "#FFAAA3",
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>
                  {deleting ? "Deleting..." : "Delete Account"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  username: {
    fontSize: 18,
    fontWeight: "bold",
    color: TEXT_COLOR,
  },
  settingsButton: {
    padding: 5,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  profileImageContainer: {
    marginBottom: 20,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profileName: {
    fontSize: 24,
    fontWeight: "bold",
    color: TEXT_COLOR,
    textAlign: "center",
  },
  nameAndPronounsContainer: {
    alignItems: "center",
    marginBottom: 5,
    width: "100%",
  },
  pronounsRowCentered: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
  },
  expandedPronounsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
    width: "100%",
  },
  nameSpacer: {
    flex: 0,
  },
  pronounChipSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
  },
  profileTagline: {
    fontSize: 16,
    color: PRIMARY_COLOR,
    marginBottom: 20,
    lineHeight: 22,
  },
  bioLeft: {
    fontSize: 16,
    color: PRIMARY_COLOR,
    marginBottom: 20,
    textAlign: "left",
    alignSelf: "flex-start",
    width: "100%",
  },
  metaChipsSection: {
    width: "100%",
    marginBottom: 16,
    alignItems: "center",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  chipGridRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    width: "100%",
  },
  chip: {
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
  },
  chipGridItem: {
    width: (screenWidth - 40 - 8 * 3) / 4,
    alignItems: "center",
  },
  chipFilled: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  chipText: {
    fontSize: 12,
    color: TEXT_COLOR,
  },
  chipBlue: {
    borderColor: "#007AFF",
  },
  chipTextBlue: {
    color: "#007AFF",
  },
  chipRed: {
    borderColor: "#FF3B30",
  },
  chipTextRed: {
    color: "#FF3B30",
  },
  chipTextFilled: {
    color: "#FFFFFF",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 20,
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: TEXT_COLOR,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: "500",
  },
  bioContainer: {
    width: "100%",
    marginBottom: 20,
  },
  bioText: {
    fontSize: 16,
    color: TEXT_COLOR,
    textAlign: "center",
    lineHeight: 22,
  },
  actionButton: {
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingHorizontal: 30,
    paddingVertical: 12,
  },
  actionButtonText: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: PRIMARY_COLOR,
  },
  postsSection: {
    paddingHorizontal: 20,
  },
  postsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    width: screenWidth - 40,
  },
  postGridItem: {
    borderRadius: 8,
    overflow: "hidden",
  },
  postImage: {
    width: "100%",
    height: "100%",
  },
  placeholderPost: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: TEXT_COLOR,
  },
  closeButton: {
    padding: 5,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  settingsOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    gap: 15,
  },
  settingsOptionText: {
    flex: 1,
    fontSize: 16,
    color: TEXT_COLOR,
  },
  logoutOption: {
    marginTop: 10,
  },
  logoutText: {
    color: "#007AFF",
  },
  deleteText: {
    color: "#FF3B30",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E5EA",
    marginVertical: 10,
  },
  // Full Post Modal Styles
  postModalSafeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  postModalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  postModalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  postModalHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  postModalBackButton: {
    padding: 8,
    marginLeft: -8,
  },
  postModalHeaderTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  postModalHeaderUserInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  postModalHeaderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  postModalHeaderText: {
    flex: 1,
  },
  postModalHeaderUsername: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  postModalHeaderDate: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 2,
  },
  postModalMoreButton: {
    padding: 8,
    marginLeft: 8,
  },
  postModalScrollView: {
    flex: 1,
  },
  postModalImageWrapper: {
    width: screenWidth,
    height: screenWidth,
    backgroundColor: "#000",
    position: "relative",
  },
  modalImageCarousel: {
    width: screenWidth,
    height: screenWidth,
  },
  postModalImageFrame: {
    width: screenWidth,
    height: screenWidth,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  postModalImage: {
    width: screenWidth,
    height: screenWidth,
  },
  postModalImageIndicator: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  postModalImageIndicatorText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  postModalImageDots: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  postModalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  postModalDotActive: {
    backgroundColor: "#FFFFFF",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  postModalActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalActionButton: {
    padding: 8,
    marginRight: 16,
  },
  postModalCommentCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
    marginLeft: 6,
  },
  postModalLikesSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  postModalLikesText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  postModalCaptionSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  postModalCaption: {
    fontSize: 14,
    color: "#000",
    lineHeight: 20,
  },
  postModalCaptionUsername: {
    fontWeight: "600",
    color: "#000",
  },
  postModalViewCommentsButton: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  postModalViewCommentsText: {
    fontSize: 14,
    color: "#8E8E93",
  },
  // Delete Menu Styles
  deleteMenuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  deleteMenuContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  deleteMenuOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  deleteMenuOptionDisabled: {
    opacity: 0.5,
  },
  deleteMenuOptionText: {
    fontSize: 18,
    color: "#FF3B30",
    fontWeight: "600",
    marginLeft: 12,
  },
  deleteMenuCancelText: {
    fontSize: 18,
    color: "#000",
    fontWeight: "600",
  },
  commentsContainer: {
    flexGrow: 1,
    minHeight: 170,
    maxHeight: 220,
    backgroundColor: "rgba(30,30,30,0.92)",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderTopColor: "#222",
    borderTopWidth: 1,
    justifyContent: "flex-end",
  },
  commentList: {
    maxHeight: 120,
    marginBottom: 9,
  },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  commentInput: {
    flex: 1,
    backgroundColor: "#242424",
    color: "#fff",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    marginRight: 9,
  },
  sendCommentButton: {
    padding: 7,
  },
  commentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  commentAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 7,
  },
  commentName: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  commentText: {
    color: "#ccc",
    fontSize: 13,
    marginTop: 1,
  },
});
