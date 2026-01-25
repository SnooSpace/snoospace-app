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
import { KeyboardStickyView } from "react-native-keyboard-controller";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CommonActions,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import {
  clearAuthSession,
  getAuthToken,
  logoutCurrentAccount,
  clearAllAccounts,
  getAllAccounts,
  getActiveAccount,
} from "../../../api/auth";
import { apiGet, apiPost, apiDelete } from "../../../api/client";
import { deleteAccount as apiDeleteAccount } from "../../../api/account";
import {
  launchImageLibraryAsync,
  requestMediaLibraryPermissionsAsync,
  MediaTypeOptions,
} from "expo-image-picker";
import { uploadImage } from "../../../api/cloudinary";
import PostCard from "../../../components/PostCard"; // Assuming PostCard exists for a full post view
import VideoPlayer from "../../../components/VideoPlayer";
import CommentsModal from "../../../components/CommentsModal";
import SettingsModal from "../../../components/modals/SettingsModal";
import AccountSwitcherModal from "../../../components/modals/AccountSwitcherModal";
import AddAccountModal from "../../../components/modals/AddAccountModal";
import LogoutModal from "../../../components/modals/LogoutModal";
import EventBus from "../../../utils/EventBus";
import SkeletonProfileHeader from "../../../components/SkeletonProfileHeader";
import SkeletonPostGrid from "../../../components/SkeletonPostGrid";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import GradientButton from "../../../components/GradientButton";
import ThemeChip from "../../../components/ThemeChip";
import HapticsService from "../../../services/HapticsService";
import { useProfileCountsPolling } from "../../../hooks/useProfileCountsPolling";
import { useAuthState } from "../../../contexts/AuthStateContext";
import UnexpectedLogoutBanner from "../../../components/UnexpectedLogoutBanner";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Map legacy constants to new theme for backward compatibility during refactor
const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;
const PRIMARY_COLOR = COLORS.primary;

export default function MemberProfileScreen({ navigation }) {
  const route = useRoute();
  console.log(
    "[Profile] MemberProfileScreen component function START (mount or render)",
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
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutModalData, setLogoutModalData] = useState({
    hasMultiple: false,
    currentAccount: null,
  });
  const [commentsModalState, setCommentsModalState] = useState({
    visible: false,
    postId: null,
  });
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [activeEmail, setActiveEmail] = useState("");

  // Cursor-based pagination state for posts
  const [postCursor, setPostCursor] = useState(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);

  // Real-time counts polling (5-second interval)
  // Pauses when modals are open to avoid distracting updates
  const isAnyModalOpen =
    postModalVisible ||
    showSettingsModal ||
    showAccountSwitcher ||
    showAddAccountModal ||
    showLogoutModal ||
    showDeleteModal ||
    commentsModalState.visible;
  const { counts: polledCounts, initializeCounts } = useProfileCountsPolling({
    userId: profile?.id,
    userType: "member",
    interval: 5000, // 5 seconds
    enabled: !loading && !!profile?.id,
    paused: isAnyModalOpen,
  });

  // Load haptics preference asynchronously
  useEffect(() => {
    (async () => {
      const enabled = await HapticsService.getEnabled();
      setHapticsEnabled(enabled);
    })();
  }, []);

  const handleToggleHaptics = async (value) => {
    setHapticsEnabled(value);
    await HapticsService.setEnabled(value);
  };
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

      // CRITICAL: Try to capture email as early as possible for Re-login fallback
      const activeAccount = await getActiveAccount();
      if (activeAccount?.email) {
        setActiveEmail(activeAccount.email);
      }

      const token = await getAuthToken();
      console.log(`[Profile] Token: ${token}`);
      if (!token) throw new Error("No auth token found. Please re-login.");

      // Use getActiveAccount instead of AsyncStorage to get the correct email
      if (!activeAccount || !activeAccount.email) {
        throw new Error("No active account found. Please re-login.");
      }

      const email = activeAccount.email;
      console.log("[Profile] Active account email:", email);

      const userProfileResponse = await apiPost(
        "/auth/get-user-profile",
        { email },
        15000,
        token,
      );
      console.log("[Profile] userProfileResponse:", userProfileResponse);
      const fullProfile = userProfileResponse?.profile;
      const userRole = userProfileResponse?.role;
      if (!fullProfile || userRole !== "member") {
        console.log(
          "[Profile] No fullProfile or not member:",
          fullProfile,
          userRole,
        );
        throw new Error("Failed to fetch member profile or incorrect role.");
      }
      const userId = fullProfile.id;
      const userType = "member";
      const [countsResponse, postsResponse] = await Promise.all([
        apiGet(`/follow/counts/${userId}/${userType}`, 15000, token),
        apiGet(`/posts/user/${userId}/${userType}?limit=20`, 15000, token),
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
        })),
      );
      // Update pagination state from initial load
      setPostCursor(postsResponse?.next_cursor || null);
      setHasMorePosts(postsResponse?.has_more === true);
      // Initialize counts polling with initial values
      initializeCounts({
        follower_count: followerCount,
        following_count: followingCount,
        post_count: userPosts.length,
      });
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
        "[Profile] loadProfile: finally, loading/refreshing set to false",
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
    }, []),
  );

  // Navigation listener to detect when returning from EditProfile with changes
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      // Check route params for refresh flag from EditProfile
      const params = route.params;
      if (params?.refreshProfile === true) {
        console.log(
          "[Profile] Navigation listener: returning from EditProfile with changes, reloading profile",
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
    HapticsService.triggerImpactLight();
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

  const handleLogout = async () => {
    try {
      const allAccounts = await getAllAccounts();
      const loggedInAccounts = allAccounts.filter(
        (acc) => acc.isLoggedIn !== false,
      );
      const currentAccount = allAccounts.find(
        (acc) => String(acc.id) === String(profile?.id),
      );

      setLogoutModalData({
        hasMultiple: loggedInAccounts.length > 1,
        currentAccount: currentAccount || profile,
      });
      setShowLogoutModal(true);
    } catch (error) {
      console.error("Error preparing logout:", error);
      // Fallback to simple logout
      performLogout(true);
    }
  };

  const navigateToAccountHome = (accountType) => {
    let rootNavigator = navigation;
    if (navigation.getParent) {
      const parent = navigation.getParent();
      if (parent) {
        rootNavigator = parent.getParent ? parent.getParent() : parent;
      }
    }

    const routeMap = {
      member: "MemberHome",
      community: "CommunityHome",
      sponsor: "SponsorHome",
      venue: "VenueHome",
    };

    const routeName = routeMap[accountType] || "Landing";
    console.log(
      "[MemberProfile] Navigating to:",
      routeName,
      "for account type:",
      accountType,
    );

    rootNavigator.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: routeName }],
      }),
    );
  };

  const handleRelogin = async () => {
    try {
      setShowSettingsModal(false);
      setShowLogoutModal(false);

      // Simple cleanup before re-login flow
      await AsyncStorage.multiRemove([
        "accessToken",
        "userData",
        "auth_token",
        "pending_otp",
      ]);

      // Pre-filled email priority: state -> active account -> storage
      let emailToUse = activeEmail;
      if (!emailToUse) {
        const acc = await getActiveAccount();
        emailToUse = acc?.email;
      }
      if (!emailToUse) {
        emailToUse = await AsyncStorage.getItem("auth_email");
      }

      console.log(
        "[MemberProfile] Navigating to login with email:",
        emailToUse,
      );

      // Navigate to Login screen with email pre-filled
      let rootNavigator = navigation;
      while (rootNavigator.getParent && rootNavigator.getParent()) {
        rootNavigator = rootNavigator.getParent();
      }

      rootNavigator.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: "Login",
              params: { email: emailToUse },
            },
          ],
        }),
      );
    } catch (error) {
      console.error("Error during relogin:", error);
      // Final fallback to Landing if everything else fails
      navigation.reset({ index: 0, routes: [{ name: "Landing" }] });
    }
  };

  const performLogout = async (logoutAll = false) => {
    try {
      // Close modals first
      setShowSettingsModal(false);
      setShowLogoutModal(false);

      if (logoutAll) {
        // Logout all accounts
        console.log("[MemberProfile] Logging out all accounts");
        await clearAllAccounts();
        await AsyncStorage.multiRemove([
          "accessToken",
          "userData",
          "auth_token",
          "auth_email",
          "pending_otp",
        ]);

        // Navigate to landing
        let rootNavigator = navigation;
        if (navigation.getParent) {
          const parent = navigation.getParent();
          if (parent) {
            rootNavigator = parent.getParent ? parent.getParent() : parent;
          }
        }

        rootNavigator.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "Landing" }],
          }),
        );
      } else {
        // Logout current account only
        console.log("[MemberProfile] Logging out current account");
        const { switchToAccount, navigateToLanding } =
          await logoutCurrentAccount();

        if (navigateToLanding) {
          console.log(
            "[MemberProfile] No other logged-in accounts, navigating to landing",
          );
          // No other logged-in accounts
          let rootNavigator = navigation;
          if (navigation.getParent) {
            const parent = navigation.getParent();
            if (parent) {
              rootNavigator = parent.getParent ? parent.getParent() : parent;
            }
          }

          rootNavigator.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: "Landing" }],
            }),
          );
        } else if (switchToAccount) {
          console.log(
            "[MemberProfile] Switching to account:",
            switchToAccount.type,
            switchToAccount.username,
          );
          // Navigate to the appropriate screen for the account type
          navigateToAccountHome(switchToAccount.type);
        }
      }
    } catch (error) {
      console.error("Error during logout:", error);
      Alert.alert("Error", "Failed to logout properly");
    }
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
            : p,
        ),
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
        p.id === postId ? { ...p, isLiked, like_count: likes } : p,
      ),
    );
  }

  // Load more posts with cursor-based pagination
  const loadMorePosts = async () => {
    // Prevent duplicate calls
    if (loadingMorePosts) return;
    if (!hasMorePosts) return;
    if (!profile?.id) return;

    try {
      setLoadingMorePosts(true);
      const token = await getAuthToken();
      if (!token) return;

      // Build URL with cursor for pagination
      const url = postCursor
        ? `/posts/user/${profile.id}/member?cursor=${encodeURIComponent(postCursor)}&limit=20`
        : `/posts/user/${profile.id}/member?limit=20`;

      const response = await apiGet(url, 15000, token);
      const newPosts = Array.isArray(response?.posts) ? response.posts : [];

      // Append new posts, deduplicating by ID
      setPosts((prevPosts) => {
        const existingIds = new Set(prevPosts.map((p) => p.id));
        const uniqueNew = newPosts
          .filter((p) => !existingIds.has(p.id))
          .map((post) => ({
            ...post,
            isLiked: !!post.is_liked,
          }));
        return [...prevPosts, ...uniqueNew];
      });

      // Update pagination state
      setPostCursor(response?.next_cursor || null);
      setHasMorePosts(response?.has_more === true);
    } catch (err) {
      console.error("[Profile] loadMorePosts error:", err);
    } finally {
      setLoadingMorePosts(false);
    }
  };

  const renderPostGrid = () => {
    // Edge-to-edge grid configuration
    const gap = 2; // Modern, tight gap (Instagram style)
    const itemSize = (screenWidth - gap * 2) / 3;
    // Only show placeholders if there are NO posts (empty state)
    const data = posts;

    return (
      <FlatList
        data={data}
        keyExtractor={(item, index) =>
          item && item.id ? String(item.id) : `ph-${index}`
        }
        numColumns={3}
        // Use gap for cleaner spacing, remove marginBottom if gap covers it, but gap in columnWrapper handles horizontal spacing
        columnWrapperStyle={{
          justifyContent: "flex-start",
          marginBottom: gap,
          gap: gap,
        }}
        renderItem={({ item, index }) => {
          return (
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.postGridItem,
                {
                  width: itemSize,
                  height: itemSize * 1.35, // Portrait aspect ratio
                  // No margins needed as gap handles it
                  marginBottom: 0,
                  marginRight: 0,
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
                          (u) => typeof u === "string" && u.startsWith("http"),
                        )
                    : undefined;

                  // Detect video by: explicit video_url OR URL extension
                  const isVideo =
                    !!item.video_url ||
                    (firstImageUrl &&
                      (firstImageUrl.toLowerCase().includes(".mp4") ||
                        firstImageUrl.toLowerCase().includes(".mov") ||
                        firstImageUrl.toLowerCase().includes(".webm")));

                  // Generate thumbnail: use video_thumbnail, or Cloudinary jpg conversion, or original URL
                  let mediaUrl = item.video_thumbnail;
                  if (
                    !mediaUrl &&
                    isVideo &&
                    firstImageUrl &&
                    firstImageUrl.includes("cloudinary.com")
                  ) {
                    // Convert Cloudinary video URL to thumbnail by changing extension
                    mediaUrl = firstImageUrl.replace(/\.[^/.]+$/, ".jpg");
                  }
                  if (!mediaUrl) {
                    mediaUrl = firstImageUrl || item.video_url;
                  }

                  return (
                    <>
                      <Image
                        source={{
                          uri: mediaUrl || "https://via.placeholder.com/150",
                        }}
                        style={styles.postImage}
                      />
                      {isVideo && (
                        <View
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            backgroundColor: "rgba(0,0,0,0.5)",
                            borderRadius: 12,
                            padding: 4,
                          }}
                        >
                          <Ionicons name="play" size={16} color="#FFF" />
                        </View>
                      )}
                    </>
                  );
                })()
              ) : (
                <View style={styles.placeholderPost}>
                  <Ionicons
                    name="image-outline"
                    size={30}
                    color={COLORS.textSecondary}
                  />
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        scrollEnabled={false}
        ListEmptyComponent={
          <View
            style={{
              padding: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "bold",
                color: COLORS.textSecondary,
              }}
            >
              No posts
            </Text>
          </View>
        }
        onEndReached={() => {
          if (!loading && !loadingMorePosts && hasMorePosts) {
            loadMorePosts();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMorePosts ? (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : null
        }
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
                  prevPosts.filter((p) => p.id !== post.id),
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
        ],
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
            // Emit event for other screens to update
            EventBus.emit("post-like-updated", {
              postId: post.id,
              isLiked: false,
              likeCount: newCount,
              commentCount: commentCount,
            });
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
            // Emit event for other screens to update
            EventBus.emit("post-like-updated", {
              postId: post.id,
              isLiked: true,
              likeCount: newCount,
              commentCount: commentCount,
            });
            return newCount;
          });
          setIsLiked(true);
        }
      } catch (error) {
        console.error("Error liking post:", error);
        // Silently handle "Post already liked" and "Post not liked" errors
        const errorMessage = error?.message || "";
        if (
          errorMessage.includes("already liked") ||
          errorMessage.includes("not liked")
        ) {
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
                        post.author_name || "User",
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
                          e.nativeEvent.contentOffset.x / screenWidth,
                        );
                        setCurrentImageIndex(index);
                      }}
                      renderItem={({ item, index }) => {
                        // Detect if this media item is a video by URL extension
                        const isVideo =
                          item.toLowerCase().includes(".mp4") ||
                          item.toLowerCase().includes(".mov") ||
                          item.toLowerCase().includes(".webm");

                        // Get aspect ratio for this media item
                        const aspectRatio =
                          post.aspect_ratios?.[index] || 4 / 5;

                        return (
                          <View style={styles.postModalImageFrame}>
                            {isVideo ? (
                              <VideoPlayer
                                source={item}
                                aspectRatio={aspectRatio}
                                containerWidth={screenWidth}
                                autoplay={false}
                                muted={true}
                                loop={false}
                                showControls={true}
                                isVisible={visible}
                              />
                            ) : (
                              <Image
                                source={{ uri: item }}
                                style={styles.postModalImage}
                                resizeMode="cover"
                              />
                            )}
                          </View>
                        );
                      }}
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

    // Check if it's an auth-related error
    const isAuthError =
      error.includes("auth token") ||
      error.includes("No active account") ||
      error.includes("Unauthorized");

    if (isAuthError) {
      // Show centered error view with re-login button for auth errors
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.errorContainer}>
            <Ionicons
              name="alert-circle-outline"
              size={64}
              color={COLORS.error || "#FF4B2B"}
            />
            <Text style={styles.errorText}>
              Unexpected error. Please re-login
            </Text>
            <TouchableOpacity
              style={styles.reloginButton}
              onPress={handleRelogin}
            >
              <Text style={styles.reloginButtonText}>Re-login</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    // Non-auth errors - show retry
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadProfile} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !profile) {
    console.log("[Profile] rendering: skeleton loading");
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView scrollEnabled={false}>
          <SkeletonProfileHeader type="member" />
          <SkeletonPostGrid />
        </ScrollView>
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
        <TouchableOpacity
          style={styles.usernameContainer}
          onPress={() => setShowAccountSwitcher(true)}
        >
          <Text style={styles.username}>@{profile.username}</Text>
          <Ionicons
            name="chevron-down"
            size={16}
            color={TEXT_COLOR}
            style={{ marginLeft: 4 }}
          />
        </TouchableOpacity>
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
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PRIMARY_COLOR}
            colors={[PRIMARY_COLOR]}
          />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const paddingToBottom = 100;
          const isCloseToBottom =
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - paddingToBottom;
          if (
            isCloseToBottom &&
            !loading &&
            !loadingMorePosts &&
            hasMorePosts
          ) {
            loadMorePosts();
          }
        }}
        scrollEventThrottle={400}
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
                        profile.name || "Member",
                      )}&background=6A0DAD&color=FFFFFF&size=120&bold=true`,
              }}
              style={styles.profileImage}
            />
          </View>

          <View style={styles.nameAndPronounsContainer}>
            <Text style={styles.profileName}>{profile.name}</Text>
            {Array.isArray(profile.pronouns) &&
            profile.pronouns.filter((p) => p !== "Prefer not to say").length >
              0 ? (
              <View style={styles.pronounsRowCentered}>
                <View style={[styles.chip, styles.pronounChipSmall]}>
                  <Text style={styles.chipText}>
                    {profile.pronouns
                      .filter((p) => p !== "Prefer not to say")
                      .map((p) => String(p).replace(/^[{\"]+|[}\"]+$/g, ""))
                      .join(" / ")}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
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
              <Text style={styles.statNumber}>
                {polledCounts.followers || profile.follower_count}
              </Text>
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
              <Text style={styles.statNumber}>
                {polledCounts.following || profile.following_count}
              </Text>
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
                  <ThemeChip
                    key={`interest-${idx}`}
                    label={String(i)}
                    index={idx}
                    style={styles.chipGridItem}
                  />
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
                    style={[
                      styles.chip,
                      styles.chipGridItem,
                      { backgroundColor: "#FF3B30", borderColor: "#FF3B30" },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: "#FFFFFF" }]}>
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
              <GradientButton
                title="Edit Profile"
                onPress={handleEditProfile}
                style={{ flex: 1 }}
              />
              <GradientButton
                title="Create Post"
                onPress={() => {
                  HapticsService.triggerImpactLight();
                  navigation.navigate("CreatePost");
                }}
                style={{ flex: 1 }}
              />
            </View>
          ) : (
            <GradientButton
              title="Follow"
              onPress={handleFollow}
              style={{ marginTop: 10, width: "100%" }}
            />
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
                  : p,
              ),
            );
            // Update selectedPost so PostModal's comment count updates immediately
            if (selectedPost && selectedPost.id === commentsModalState.postId) {
              setSelectedPost((prev) =>
                prev ? { ...prev, comment_count: newCount } : prev,
              );
            }
          }
          // IMPORTANT: Modal should remain open - don't change commentsModalState
        }}
        navigation={navigation}
      />

      <AccountSwitcherModal
        visible={showAccountSwitcher}
        onClose={() => setShowAccountSwitcher(false)}
        currentAccountId={profile?.id ? `member_${profile.id}` : undefined}
        currentProfile={profile ? { ...profile, type: "member" } : null}
        onAccountSwitch={(account) => {
          // Navigate to correct home screen based on account type
          const routeName =
            account.type === "member"
              ? "MemberHome"
              : account.type === "community"
                ? "CommunityHome"
                : account.type === "sponsor"
                  ? "SponsorHome"
                  : account.type === "venue"
                    ? "VenueHome"
                    : "Landing";

          // Get the ROOT navigator (go up the parent chain)
          let rootNavigator = navigation;
          try {
            // ProfileStackNavigator → MemberHomeTabNavigator → RootNavigator
            if (navigation.getParent) {
              const parent1 = navigation.getParent(); // MemberHomeTabNavigator
              if (parent1 && parent1.getParent) {
                const parent2 = parent1.getParent(); // RootNavigator
                if (parent2) {
                  rootNavigator = parent2;
                }
              }
            }
          } catch (error) {
            console.warn(
              "[AccountSwitch] Could not get root navigator:",
              error,
            );
          }

          console.log("[AccountSwitch] Resetting to:", routeName);
          rootNavigator.reset({
            index: 0,
            routes: [{ name: routeName }],
          });
        }}
        onAddAccount={() => {
          setShowAddAccountModal(true);
        }}
        onLoginRequired={(account) => {
          // Navigate to login with pre-filled email using root navigator
          setShowAccountSwitcher(false);

          // Get root navigator to ensure we can navigate to Login
          let rootNavigator = navigation;
          if (navigation.getParent) {
            const parent = navigation.getParent();
            if (parent) {
              rootNavigator = parent.getParent ? parent.getParent() : parent;
            }
          }

          console.log(
            "[MemberProfile] Navigating to Login for logged-out account:",
            account.email,
          );

          // Navigate to Login screen
          try {
            rootNavigator.navigate("Login", {
              email: account.email,
              isAddingAccount: false,
            });
          } catch (error) {
            console.error(
              "[MemberProfile] Failed to navigate to Login:",
              error,
            );
            // Fallback: reset to Landing which has Login
            rootNavigator.reset({
              index: 0,
              routes: [{ name: "Landing" }],
            });
          }
        }}
      />

      <AddAccountModal
        visible={showAddAccountModal}
        onClose={() => setShowAddAccountModal(false)}
        onLoginExisting={() => {
          // Navigate to login with isAddingAccount flag
          navigation.navigate("Login", { isAddingAccount: true });
        }}
        onCreateNew={() => {
          // Navigate to signup landing
          navigation.navigate("Landing", { fromSwitcher: true });
        }}
      />

      <SettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onNotificationsPress={handleEditProfile}
        onPrivacyPress={() =>
          Alert.alert("Privacy", "Privacy settings will be implemented soon!")
        }
        onHelpPress={() =>
          Alert.alert("Help", "Help & Support will be implemented soon!")
        }
        onAddAccountPress={() => setShowAddAccountModal(true)}
        onLogoutPress={handleLogout}
        onDeleteAccountPress={() => setShowDeleteModal(true)}
        hapticsEnabled={hapticsEnabled}
        onToggleHaptics={handleToggleHaptics}
        textColor={TEXT_COLOR}
        lightTextColor={LIGHT_TEXT_COLOR}
      />

      <LogoutModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onLogoutCurrent={() => performLogout(false)}
        onLogoutAll={() => performLogout(true)}
        currentAccount={logoutModalData.currentAccount}
        hasMultipleAccounts={logoutModalData.hasMultiple}
      />

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
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
                      const { switchedToAccount, navigateToLanding } =
                        await apiDeleteAccount();
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

                      if (navigateToLanding || !switchedToAccount) {
                        // No other accounts or explicitly told to go to landing
                        rootNavigator.dispatch(
                          CommonActions.reset({
                            index: 0,
                            routes: [{ name: "Landing" }],
                          }),
                        );
                      } else {
                        // Switch to other account
                        const routeMap = {
                          member: "MemberHome",
                          community: "CommunityHome",
                          sponsor: "SponsorHome",
                          venue: "VenueHome",
                        };
                        const routeName =
                          routeMap[switchedToAccount.type] || "Landing";
                        rootNavigator.dispatch(
                          CommonActions.reset({
                            index: 0,
                            routes: [{ name: routeName }],
                          }),
                        );
                      }
                    } catch (e) {
                      Alert.alert(
                        "Delete failed",
                        e?.message || "Could not delete account",
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
          </KeyboardStickyView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  usernameContainer: {
    flexDirection: "row",
    alignItems: "center",
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.m,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: "#F2F2F7", // Default gray for non-theme chips (like See All)
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
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary, // or generic text
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
    // handled by GradientButton
  },
  actionButtonText: {
    // handled by GradientButton
  },
  postsSection: {
    paddingHorizontal: 0,
  },
  postsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    width: screenWidth,
  },
  postGridItem: {
    borderRadius: 3,
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
    fontSize: 18,
    color: COLORS.textPrimary || "#000",
    textAlign: "center",
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    fontWeight: "600",
  },
  reloginButton: {
    backgroundColor: COLORS.primary || "#00C6FF",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: BORDER_RADIUS.pill || 25,
    ...SHADOWS.small,
  },
  reloginButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "bold",
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
