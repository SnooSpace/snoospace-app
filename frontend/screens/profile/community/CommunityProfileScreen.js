import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  FlatList,
  TextInput,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Animated,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Settings,
  Bookmark,
  ChevronDown,
  Camera,
  Pencil,
  ChevronRight,
  Play,
  Image as LucideImage,
  Star,
  X,
} from "lucide-react-native";
import { CommonActions, useFocusEffect } from "@react-navigation/native";
import {
  clearAuthSession,
  getAuthToken,
  getAuthEmail,
  logoutCurrentAccount,
  clearAllAccounts,
  getAllAccounts,
} from "../../../api/auth";
import { deleteAccount as apiDeleteAccount } from "../../../api/account";
import { apiGet, apiPost, apiDelete } from "../../../api/client";
import {
  getCommunityProfile,
  updateCommunityProfile,
  updateCommunityHeads,
} from "../../../api/communities";
import { getCommunityEvents } from "../../../api/events";
import {
  getGradientForName,
  getInitials,
} from "../../../utils/AvatarGenerator";
import {
  launchImageLibraryAsync,
  requestMediaLibraryPermissionsAsync,
  MediaTypeOptions,
} from "expo-image-picker";
import { uploadImage } from "../../../api/cloudinary";
import { useCrop } from "../../../components/MediaCrop";
import PostCard from "../../../components/PostCard";
import ProfilePostFeed from "../../../components/ProfilePostFeed";
import EditorialPostCard from "../../../components/EditorialPostCard";
import VideoPlayer from "../../../components/VideoPlayer";
import { mockData } from "../../../data/mockData";
import HeadsEditorModal from "../../../components/modals/HeadsEditorModal";
import CommentsModal from "../../../components/CommentsModal";
import SettingsModal from "../../../components/modals/SettingsModal";
import AccountSwitcherModal from "../../../components/modals/AccountSwitcherModal";
import ActionSheet from "../../../components/modals/ActionSheet";
import AddAccountModal from "../../../components/modals/AddAccountModal";
import LogoutModal from "../../../components/modals/LogoutModal";
import EventBus from "../../../utils/EventBus";
import MentionTextRenderer from "../../../components/MentionTextRenderer";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import SkeletonProfileHeader from "../../../components/SkeletonProfileHeader";
import SkeletonPostGrid from "../../../components/SkeletonPostGrid";
import DynamicStatusBar from "../../../components/DynamicStatusBar";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  FONTS,
} from "../../../constants/theme";
import GradientButton from "../../../components/GradientButton";
import ThemeChip from "../../../components/ThemeChip";
import HapticsService from "../../../services/HapticsService";
import { useProfileCountsPolling } from "../../../hooks/useProfileCountsPolling";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const BANNER_HEIGHT = screenHeight * 0.28; // 28% of screen height
const AVATAR_SIZE = 120;

const formatPhoneNumber = (value) => {
  if (!value) return "";
  const digits = String(value).replace(/[^0-9]/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits || String(value);
};

// Map to new theme
// Map to new theme (consistent with MemberProfile)
const PRIMARY_COLOR = COLORS.primary;
const TEXT_COLOR = "#0F172A"; // Slate 900
const LIGHT_TEXT_COLOR = "#6B7280"; // Slate 500

export default function CommunityProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadCompleted, setInitialLoadCompleted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHeadsModal, setShowHeadsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutModalData, setLogoutModalData] = useState({
    hasMultiple: false,
    currentAccount: null,
  });
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Standard Animated Value for Scroll (Native Driver)
  const scrollY = useRef(new Animated.Value(0)).current;

  const [headsModalVisible, setHeadsModalVisible] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("posts"); // "posts", "community", or "events"
  const [communityEvents, setCommunityEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [commentsModalState, setCommentsModalState] = useState({
    visible: false,
    postId: null,
  });
  const [showBannerActionSheet, setShowBannerActionSheet] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [activeEmail, setActiveEmail] = useState("");
  const pendingPostUpdateRef = useRef(null);
  const hasInitialLoadRef = useRef(false);
  const initialLoadCompletedRef = useRef(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserType, setCurrentUserType] = useState(null);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  // Tab underline animation
  const tabUnderlineX = useRef(new Animated.Value(0)).current;
  const tabUnderlineScale = useRef(new Animated.Value(0)).current;
  const tabWidths = useRef({}).current;
  const tabOffsets = useRef({}).current;

  // Real-time counts polling (5-second interval)
  // Pauses when modals are open to avoid distracting updates
  const isAnyModalOpen =
    postModalVisible ||
    showSettingsModal ||
    showAccountSwitcher ||
    showAddAccountModal ||
    showLogoutModal ||
    showDeleteModal ||
    headsModalVisible ||
    showBannerActionSheet ||
    commentsModalState.visible;
  const { pickAndCrop } = useCrop();

  const { counts: polledCounts, initializeCounts } = useProfileCountsPolling({
    userId: profile?.id,
    userType: "community",
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

  useEffect(() => {
    // Underline sliding animation
    if (tabOffsets[activeTab] !== undefined) {
      Animated.parallel([
        Animated.spring(tabUnderlineX, {
          toValue: tabOffsets[activeTab],
          useNativeDriver: false,
          tension: 50,
          friction: 8,
        }),
        Animated.spring(tabUnderlineScale, {
          toValue: tabWidths[activeTab],
          useNativeDriver: false,
          tension: 50,
          friction: 8,
        }),
      ]).start();
    }
  }, [activeTab]);

  const handleTabLayout = (tab, event) => {
    const { x, width } = event.nativeEvent.layout;
    tabOffsets[tab] = x;
    tabWidths[tab] = width;

    // Set initial position for active tab underline
    if (tab === activeTab) {
      tabUnderlineX.setValue(x);
      tabUnderlineScale.setValue(width);
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      await loadProfile();
      if (isMounted) {
        hasInitialLoadRef.current = true;
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      if (hasInitialLoadRef.current) {
        loadProfile(true);
      }
    }, [loadProfile]),
  );

  // Listen for follow updates to refresh follower and following counts
  useEffect(() => {
    const handleFollowUpdate = (data) => {
      if (!profile) return;

      // Case 1: Someone followed/unfollowed the current community (update follower_count)
      if (data?.communityId && data.communityId === profile.id) {
        setProfile((prev) => {
          if (!prev) return prev;
          const change = data.isFollowing ? 1 : -1;
          return {
            ...prev,
            follower_count: Math.max(0, (prev.follower_count || 0) + change),
          };
        });
      }

      // Case 2: Current community followed/unfollowed someone (update following_count)
      if (
        data?.followerId &&
        data?.followerType === "community" &&
        data.followerId === profile.id
      ) {
        setProfile((prev) => {
          if (!prev) return prev;
          const change = data.isFollowing ? 1 : -1;
          return {
            ...prev,
            following_count: Math.max(0, (prev.following_count || 0) + change),
          };
        });
      }
    };

    EventBus.on("follow-updated", handleFollowUpdate);
    return () => {
      EventBus.off("follow-updated", handleFollowUpdate);
    };
  }, [profile]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = await getAuthToken();
        const email = await getAuthEmail();
        if (token && email && mounted) {
          const profileResponse = await apiPost(
            "/auth/get-user-profile",
            { email },
            10000,
            token,
          );
          if (profileResponse?.profile?.id && mounted) {
            setCurrentUserId(profileResponse.profile.id);
            // Get user type from API response
            const userType =
              profileResponse?.role || profileResponse?.profile?.type;
            setCurrentUserType(userType);
          }
        }
      } catch (error) {
        console.error("Failed to load current user info:", error);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Listen for post like/comment updates to refresh posts immediately
  useEffect(() => {
    const handlePostLikeUpdate = (payload) => {
      if (!payload?.postId) return;
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === payload.postId
            ? {
                ...post,
                is_liked: payload.isLiked,
                isLiked: payload.isLiked,
                like_count:
                  typeof payload.likeCount === "number"
                    ? payload.likeCount
                    : post.like_count,
                comment_count:
                  typeof payload.commentCount === "number"
                    ? payload.commentCount
                    : post.comment_count,
              }
            : post,
        ),
      );
    };

    const handlePostCommentUpdate = (payload) => {
      if (!payload?.postId) return;
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === payload.postId
            ? {
                ...post,
                comment_count:
                  typeof payload.commentCount === "number"
                    ? payload.commentCount
                    : post.comment_count,
              }
            : post,
        ),
      );
    };

    const unsubscribeLike = EventBus.on(
      "post-like-updated",
      handlePostLikeUpdate,
    );
    const unsubscribeComment = EventBus.on(
      "post-comment-updated",
      handlePostCommentUpdate,
    );

    return () => {
      if (unsubscribeLike) unsubscribeLike();
      if (unsubscribeComment) unsubscribeComment();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = EventBus.on("post-created", () => {
      loadProfile();
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loadProfile]);

  const loadProfile = useCallback(async (isRefresh = false) => {
    try {
      if (initialLoadCompletedRef.current === false) {
        setLoading(true);
      }
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setPosts([]); // clear posts to prevent stale data
      }
      setAuthError(false); // Clear any previous errors as early as possible
      try {
        const email = await AsyncStorage.getItem("auth_email");
        if (email) setActiveEmail(email);
      } catch {}

      const token = await getAuthToken();

      // Fetch profile using communities/profile endpoint to get full profile with heads
      let role = "community";
      let fullProfile = null;
      try {
        const profileRes = await getCommunityProfile();
        fullProfile = profileRes?.profile || null;
        role = "community";
      } catch (e) {
        try {
          const email = await AsyncStorage.getItem("auth_email");
          const profRes = await apiPost(
            "/auth/get-user-profile",
            email ? { email } : {},
            15000,
            token,
          );
          role = profRes?.role || "community";
          fullProfile = profRes?.profile || null;
        } catch {}
      }

      if (fullProfile?.email) {
        setActiveEmail(fullProfile.email);
      }

      if (!fullProfile) {
        setAuthError(true);
        setProfile(null);
        setPosts([]);
        return;
      }

      const userId = fullProfile.id;
      const userType = role || "community";

      // Fetch follow counts
      let followerCount = 0;
      let followingCount = 0;
      try {
        const counts = await apiGet(
          `/follow/counts/${userId}/${userType}`,
          15000,
          token,
        );
        const followersRaw = counts?.followers_count ?? counts?.followers;
        const followingRaw = counts?.following_count ?? counts?.following;
        followerCount =
          typeof followersRaw === "number"
            ? followersRaw
            : parseInt(followersRaw || "0", 10) || 0;
        followingCount =
          typeof followingRaw === "number"
            ? followingRaw
            : parseInt(followingRaw || "0", 10) || 0;
      } catch {}

      // Fetch posts by this user
      let userPosts = [];
      try {
        const postsRes = await apiGet(
          `/posts/user/${userId}/${userType}`,
          15000,
          token,
        );
        userPosts = Array.isArray(postsRes?.posts) ? postsRes.posts : [];

        // Debug: Check if poll posts have vote data
        const pollPosts = userPosts.filter(
          (p) => p.post_type === "poll" || p.type === "poll",
        );
        if (pollPosts.length > 0) {
          console.log("[CommunityProfile] Poll post data:", {
            postId: pollPosts[0].id,
            has_voted: pollPosts[0].has_voted,
            voted_indexes: pollPosts[0].voted_indexes,
            typeData: pollPosts[0].type_data,
          });
        }
      } catch {}

      const normalizedCategories = (() => {
        if (Array.isArray(fullProfile?.categories))
          return fullProfile.categories;
        if (
          fullProfile?.categories &&
          typeof fullProfile.categories === "string"
        ) {
          try {
            const parsed = JSON.parse(fullProfile.categories);
            if (Array.isArray(parsed)) return parsed;
          } catch (err) {
            // ignore parse errors
          }
        }
        return fullProfile?.category ? [fullProfile.category] : [];
      })();

      const primaryPhone =
        fullProfile?.phone ??
        fullProfile?.primary_phone ??
        fullProfile?.primaryPhone ??
        fullProfile?.phone_primary ??
        "";
      const secondaryPhone =
        fullProfile?.secondary_phone ??
        fullProfile?.secondaryPhone ??
        fullProfile?.secondary_phone_number ??
        fullProfile?.secondaryPhoneNumber ??
        fullProfile?.phone_secondary ??
        "";

      const mappedProfile = {
        id: userId,
        name: fullProfile?.name || "Community",
        username: fullProfile?.username || "",
        bio: fullProfile?.bio || "",
        email: fullProfile?.email || "",
        phone: String(primaryPhone || ""),
        secondary_phone: String(secondaryPhone || ""),
        categories: normalizedCategories,
        location: fullProfile?.location || "",
        logo_url: fullProfile?.logo_url || "",
        banner_url: fullProfile?.banner_url || null,
        sponsor_types: fullProfile?.sponsor_types || [],
        heads: fullProfile?.heads || [],
        follower_count: followerCount,
        following_count: followingCount,
        post_count: userPosts.length,
        events_scheduled_count: fullProfile?.events_scheduled_count || 0,
        events_hosted_count: fullProfile?.events_hosted_count || 0,
      };
      console.log(
        "[CommunityProfile] phones",
        {
          rawPhone: fullProfile?.phone,
          rawPrimary: fullProfile?.primary_phone ?? fullProfile?.primaryPhone,
          rawSecondary:
            fullProfile?.secondary_phone ??
            fullProfile?.secondaryPhone ??
            fullProfile?.secondary_phone_number,
        },
        {
          mappedPhone: mappedProfile.phone,
          mappedSecondary: mappedProfile.secondary_phone,
        },
      );
      mappedProfile.category = mappedProfile.categories[0] || "";

      setProfile(mappedProfile);
      setPosts(userPosts);

      // Fetch community events
      try {
        const eventsRes = await getCommunityEvents();
        const allEvents = Array.isArray(eventsRes?.events)
          ? eventsRes.events
          : [];
        setCommunityEvents(allEvents);
      } catch (evErr) {
        console.log("[CommunityProfile] Failed to load events:", evErr);
        setCommunityEvents([]);
      }
      setAuthError(false);
      // Initialize counts polling with initial values
      initializeCounts({
        follower_count: followerCount,
        following_count: followingCount,
        post_count: userPosts.length,
      });
    } catch (error) {
      console.error("[CommunityProfile] error loading profile:", error);
      setAuthError(true);
      setProfile(null);
      setPosts([]);
    } finally {
      if (!initialLoadCompletedRef.current) {
        setLoading(false);
        initialLoadCompletedRef.current = true;
        setInitialLoadCompleted(true);
      }
      setRefreshing(false);
    }
  }, []);

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

      // Pre-filled email priority: state -> storage
      let emailToUse = activeEmail;
      if (!emailToUse) {
        emailToUse = await AsyncStorage.getItem("auth_email");
      }

      console.log(
        "[CommunityProfile] Navigating to login with email:",
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
      "[CommunityProfile] Navigating to:",
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

  const performLogout = async (logoutAll = false) => {
    try {
      setShowSettingsModal(false);
      setShowLogoutModal(false);

      if (logoutAll) {
        console.log("[CommunityProfile] Logging out all accounts");
        await clearAllAccounts();
        await AsyncStorage.multiRemove([
          "accessToken",
          "userData",
          "auth_token",
          "auth_email",
          "pending_otp",
        ]);

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
        console.log("[CommunityProfile] Logging out current account");
        const { switchToAccount, navigateToLanding } =
          await logoutCurrentAccount();

        if (navigateToLanding) {
          console.log(
            "[CommunityProfile] No other logged-in accounts, navigating to landing",
          );
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
            "[CommunityProfile] Switching to account:",
            switchToAccount.type,
            switchToAccount.username,
          );
          navigateToAccountHome(switchToAccount.type);
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to logout properly");
    }
  };

  const handleBannerAction = () => {
    if (!profile) return;
    setShowBannerActionSheet(true);
  };

  const pickBannerImage = async () => {
    try {
      const result = await pickAndCrop("banner");
      if (!result) return; // User cancelled

      setBannerUploading(true);
      const secureUrl = await uploadImage(result.uri);
      await updateCommunityProfile({ banner_url: secureUrl });
      setProfile((prev) => (prev ? { ...prev, banner_url: secureUrl } : prev));
    } catch (e) {
      Alert.alert("Update failed", e?.message || "Could not update banner");
    } finally {
      setBannerUploading(false);
    }
  };

  const removeBanner = async () => {
    if (!profile?.banner_url) return;
    try {
      setBannerUploading(true);
      await updateCommunityProfile({ banner_url: null });
      setProfile((prev) => (prev ? { ...prev, banner_url: null } : prev));
    } catch (e) {
      Alert.alert("Update failed", e?.message || "Could not remove banner");
    } finally {
      setBannerUploading(false);
    }
  };

  const handleHeadsSave = async (nextHeads) => {
    try {
      await updateCommunityHeads(nextHeads);
      await loadProfile();
      setHeadsModalVisible(false);
    } catch (e) {
      Alert.alert("Update failed", e?.message || "Could not update heads");
    }
  };

  const handleHeadPress = (head) => {
    if (head?.member_id) {
      // Check if it's the current user's own profile
      const isOwnProfile = currentUserId && head.member_id === currentUserId;
      if (isOwnProfile) {
        // Navigate to own profile screen
        const root = navigation.getParent()?.getParent();
        if (root) {
          root.navigate("MemberHome", {
            screen: "Profile",
            params: {
              screen: "MemberProfile",
            },
          });
        } else {
          // Fallback navigation
          navigation.navigate("MemberProfile");
        }
      } else {
        // Navigate to MemberPublicProfile within Community's Profile stack
        navigation.navigate("MemberPublicProfile", {
          memberId: head.member_id,
        });
      }
    }
  };

  const postsCount =
    polledCounts.posts || (profile?.posts_count ?? profile?.post_count ?? 0);
  const followersCount =
    polledCounts.followers ||
    (profile?.followers_count ?? profile?.follower_count ?? 0);
  const followingCount =
    polledCounts.following ||
    (profile?.following_count ?? profile?.following ?? 0);

  const openPostModal = (post) => {
    // Normalize is_liked field - only use is_liked, ignore isLiked completely
    const normalizedIsLiked = post.is_liked === true;
    const normalizedPost = {
      ...post,
      is_liked: normalizedIsLiked,
      isLiked: normalizedIsLiked,
    };
    setSelectedPost(normalizedPost);
    setPostModalVisible(true);
  };

  const closePostModal = () => {
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

  const openCommentsModal = useCallback((postId) => {
    if (postId) {
      setCommentsModalState({ visible: true, postId });
    }
  }, []);

  const closeCommentsModal = useCallback(() => {
    setCommentsModalState({ visible: false, postId: null });
  }, []);

  const updatePostsGlobalState = (postId, isLiked, likes) => {
    setPosts((prevPosts) =>
      prevPosts.map((p) =>
        p.id === postId
          ? { ...p, isLiked, is_liked: isLiked, like_count: likes }
          : p,
      ),
    );
  };

  const handlePostLike = (postId, isLiked, likeCount) => {
    pendingPostUpdateRef.current = {
      postId,
      is_liked: isLiked,
      like_count: likeCount,
    };
  };

  const handlePostComment = (postId) => {
    openCommentsModal(postId);
  };

  if (!initialLoadCompleted && (loading || !profile)) {
    return (
      <View style={styles.container}>
        <DynamicStatusBar style="dark" />
        <ScrollView scrollEnabled={false}>
          <SkeletonProfileHeader type="community" />
          <SkeletonPostGrid />
        </ScrollView>
      </View>
    );
  }

  if (authError) {
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
  return (
    <View style={styles.container}>
      <DynamicStatusBar style="light-content" />

      {/* Add gradient overlay only when no banner */}
      {!profile.banner_url && <GradientSafeArea variant="primary" />}

      {/* Custom Fixed Header (Status Bar Scrim Only) */}
      <View style={[styles.headerContainer, { height: insets.top }]}>
        {/* iOS Blur */}
        {Platform.OS === "ios" && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: scrollY.interpolate({
                  inputRange: [0, 20],
                  outputRange: [0, 1],
                  extrapolate: "clamp",
                }),
              },
            ]}
          >
            <BlurView
              intensity={20}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}

        {/* Background Fade */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: "rgba(250, 249, 247, 0.98)",
              opacity: scrollY.interpolate({
                inputRange: [0, 20],
                outputRange: [0, 1], // Fades in background
                extrapolate: "clamp",
              }),
            },
          ]}
        />
      </View>

      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadProfile(true)}
            colors={[PRIMARY_COLOR]}
            tintColor={PRIMARY_COLOR}
          />
        }
      >
        {/* Banner - only render if banner exists */}
        {profile.banner_url && (
          <View style={styles.bannerContainer}>
            <Image
              source={{ uri: profile.banner_url }}
              style={styles.bannerImage}
            />
            {/* Blur + Dim Overlay for mood effect */}
            <BlurView intensity={15} tint="dark" style={styles.bannerOverlay} />
            <TouchableOpacity
              style={styles.bannerEdit}
              onPress={handleBannerAction}
            >
              {bannerUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Camera size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Settings Icon - positioned based on banner presence */}
        <TouchableOpacity
          onPress={() => setShowSettingsModal(true)}
          style={[
            styles.settingsIconAbsolute,
            !profile.banner_url && { top: insets.top + 16 },
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Settings
            size={26}
            color={COLORS.editorial?.textSecondary || "#6B7280"}
          />
        </TouchableOpacity>

        {/* Bookmark Icon */}
        <TouchableOpacity
          onPress={() => navigation.navigate("SavedPostsScreen")}
          style={[
            styles.settingsIconAbsolute,
            !profile.banner_url && { top: insets.top + 16 },
            { right: 60 }, // Position to the left of settings
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Bookmark
            size={26}
            color={COLORS.editorial?.textSecondary || "#6B7280"}
          />
        </TouchableOpacity>

        <View
          style={[
            styles.summarySection,
            !profile.banner_url && { paddingTop: insets.top + 60 },
          ]}
        >
          <View
            style={[
              styles.profileHeader,
              !profile.banner_url && styles.profileHeaderNoBanner,
            ]}
          >
            <View style={styles.avatarWrapper}>
              {profile.logo_url && /^https?:\/\//.test(profile.logo_url) ? (
                <Image
                  source={{ uri: profile.logo_url }}
                  style={styles.avatar}
                />
              ) : (
                <LinearGradient
                  colors={getGradientForName(profile.name)}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.avatar,
                    { justifyContent: "center", alignItems: "center" },
                  ]}
                >
                  <Text
                    style={{ fontSize: 36, fontWeight: "bold", color: "#fff" }}
                  >
                    {getInitials(profile.name)}
                  </Text>
                </LinearGradient>
              )}
            </View>
            {/* Identity Block: Name → Username (with dropdown) → Categories → Bio */}
            <Text style={styles.communityName}>{profile.name}</Text>
            <TouchableOpacity
              style={styles.usernameRow}
              onPress={() => setShowAccountSwitcher(true)}
            >
              <Text style={styles.usernameText}>
                {profile.username ? `@${profile.username}` : ""}
              </Text>
              <ChevronDown
                size={26}
                color="#3B82F6"
                style={{ marginLeft: -2 }}
              />
            </TouchableOpacity>
            {Array.isArray(profile.categories) &&
              profile.categories.length > 0 && (
                <View style={styles.categoriesRow}>
                  {profile.categories.map((cat, idx) => (
                    <ThemeChip key={cat} label={cat} index={idx} />
                  ))}
                </View>
              )}

            {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() =>
                navigation.navigate("CommunityEventsList", {
                  initialTab: "upcoming",
                })
              }
            >
              <Text style={styles.statNumber}>
                {(profile.events_scheduled_count || 0) +
                  (profile.events_hosted_count || 0)}
              </Text>
              <Text style={styles.statLabel}>Events</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() =>
                navigation.navigate("CommunityFollowersList", {
                  communityId: profile.id,
                  title: "Followers",
                })
              }
            >
              <Text style={styles.statNumber}>{profile.follower_count}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() =>
                navigation.navigate("CommunityFollowingList", {
                  communityId: profile.id,
                  title: "Following",
                })
              }
            >
              <Text style={styles.statNumber}>{profile.following_count}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profile.post_count}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              gap: 10,
              marginTop: 10,
              marginBottom: 20,
              width: "100%",
            }}
          >
            <GradientButton
              title="Edit Profile"
              onPress={() => {
                HapticsService.triggerImpactLight();
                navigation.navigate("EditCommunityProfile", { profile });
              }}
              style={{
                flex: 1,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "rgba(68, 138, 255, 0.2)",
                backgroundColor: "rgba(68, 138, 255, 0.12)",
                shadowColor: "transparent",
                shadowOpacity: 0,
                shadowRadius: 0,
                elevation: 0,
                overflow: "hidden",
              }}
              gradientStyle={{
                borderRadius: 0,
                paddingHorizontal: 20,
              }}
              colors={["transparent", "transparent"]}
              textStyle={{ fontFamily: FONTS.medium, color: "#2962FF" }}
            />
            <GradientButton
              title="Create Post"
              onPress={() => {
                HapticsService.triggerImpactLight();
                navigation.navigate("CommunityCreatePost", {
                  role: "community",
                });
              }}
              style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}
              gradientStyle={{ borderRadius: 16 }}
              textStyle={{ fontFamily: FONTS.semiBold }}
            />
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Community Heads</Text>
              <TouchableOpacity onPress={() => setHeadsModalVisible(true)}>
                <Pencil size={20} color={PRIMARY_COLOR} />
              </TouchableOpacity>
            </View>
            {profile.heads && profile.heads.length > 0 ? (
              <View style={{ paddingVertical: 4 }}>
                {profile.heads.map((head, index) => {
                  const canNavigate = !!head.member_id;
                  return (
                    <TouchableOpacity
                      key={head.id || index}
                      onPress={() => handleHeadPress(head)}
                      disabled={!canNavigate}
                      style={[
                        styles.headRow,
                        !canNavigate && { opacity: 0.85 },
                      ]}
                    >
                      {head.profile_pic_url ? (
                        <Image
                          source={{
                            uri: head.profile_pic_url,
                          }}
                          style={styles.headAvatar}
                        />
                      ) : (
                        <LinearGradient
                          colors={getGradientForName(head.name || "Head")}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[
                            styles.headAvatar,
                            { justifyContent: "center", alignItems: "center" },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 18,
                              fontWeight: "bold",
                              color: "#fff",
                            }}
                          >
                            {getInitials(head.name || "H")}
                          </Text>
                        </LinearGradient>
                      )}
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.headName}>{head.name}</Text>
                        {head.is_primary && (
                          <LinearGradient
                            colors={["#FFF1F2", "#FFE4E6"]}
                            style={styles.primaryStarGradient}
                          >
                            <Star size={14} color="#E11D48" fill="#E11D48" />
                          </LinearGradient>
                        )}
                        {/* Hide contacts in premium card view for cleaner look, usually click to see details? 
                            Ref image only shows Name + Role. 
                            I'll hide phone/email to match "Premium" minimalist look unless space permits.
                            But user said "Match the Ref". Ref has Name + Role. */}
                      </View>
                      {canNavigate && (
                        <ChevronRight size={20} color={LIGHT_TEXT_COLOR} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>No heads added yet</Text>
            )}
          </View>

          {profile.sponsor_types && profile.sponsor_types.length > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Looking for Sponsors</Text>
              </View>
              <View style={styles.sponsorTypesList}>
                {profile.sponsor_types.map((type, index) => (
                  <ThemeChip
                    key={index}
                    label={type}
                    index={index} // Removed the +2 shift to allow keyword-based styling to take precedence properly
                  />
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {["posts", "community", "events"].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={styles.tabItem}
              onPress={() => {
                HapticsService.triggerImpactLight();
                setActiveTab(tab);
              }}
              onLayout={(e) => handleTabLayout(tab, e)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
          {/* Sliding indicator */}
          <Animated.View
            style={[
              styles.activeTabIndicator,
              {
                transform: [{ translateX: tabUnderlineX }],
                width: tabUnderlineScale,
              },
            ]}
          />
        </View>

        <View style={styles.postsSection}>
          {/* Posts Tab - Media Only (Images/Videos) */}
          {activeTab === "posts" &&
            (() => {
              const mediaPosts = posts.filter((p) => {
                // Exclude interactive post types from Posts tab
                const postType = p.post_type || p.type;
                const isInteractive = [
                  "poll",
                  "prompt",
                  "qna",
                  "challenge",
                  "opportunity",
                ].includes(postType);

                // Only show media posts that are NOT interactive types
                const hasImages = p.image_urls && p.image_urls.length > 0;
                const hasVideo = !!p.video_url;
                const hasMedia = hasImages || hasVideo;

                return hasMedia && !isInteractive;
              });

              return mediaPosts.length > 0 ? (
                <View style={styles.postsGrid}>
                  <FlatList
                    data={mediaPosts}
                    keyExtractor={(item) => item.id.toString()}
                    numColumns={3}
                    scrollEnabled={false}
                    columnWrapperStyle={{
                      justifyContent: "flex-start",
                      marginBottom: 2,
                      gap: 2,
                    }}
                    renderItem={({ item, index }) => {
                      const gap = 2; // Modern, tight gap
                      const itemSize = (screenWidth - gap * 2) / 3;

                      return (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          style={{
                            width: itemSize,
                            height: itemSize * 1.35, // Portrait aspect ratio
                            marginBottom: 0,
                            marginRight: 0, // Handled by gap
                            borderRadius: 3, // Subtle radius
                            overflow: "hidden",
                          }}
                          onPress={() => openPostModal(item)}
                        >
                          {(() => {
                            let firstImageUrl = null;
                            if (item?.image_urls) {
                              if (Array.isArray(item.image_urls)) {
                                const flatUrls = item.image_urls.flat();
                                firstImageUrl = flatUrls.find(
                                  (u) =>
                                    typeof u === "string" &&
                                    u.startsWith("http"),
                                );
                              } else if (
                                typeof item.image_urls === "string" &&
                                item.image_urls.startsWith("http")
                              ) {
                                firstImageUrl = item.image_urls;
                              }
                            }

                            // Detect video by: explicit video_url OR URL extension
                            const isVideo =
                              !!item.video_url ||
                              (firstImageUrl &&
                                (firstImageUrl.toLowerCase().includes(".mp4") ||
                                  firstImageUrl
                                    .toLowerCase()
                                    .includes(".mov") ||
                                  firstImageUrl
                                    .toLowerCase()
                                    .includes(".webm")));

                            // Generate thumbnail: use video_thumbnail, or Cloudinary jpg conversion, or original URL
                            // video_thumbnail might be stored as JSON array string '["url"]' in database
                            let mediaUrl = null;
                            if (item.video_thumbnail) {
                              try {
                                if (
                                  typeof item.video_thumbnail === "string" &&
                                  item.video_thumbnail.startsWith("[")
                                ) {
                                  const parsed = JSON.parse(
                                    item.video_thumbnail,
                                  );
                                  mediaUrl = Array.isArray(parsed)
                                    ? parsed[0]
                                    : item.video_thumbnail;
                                } else {
                                  mediaUrl = item.video_thumbnail;
                                }
                              } catch (e) {
                                mediaUrl = item.video_thumbnail;
                              }
                            }
                            const videoSourceUrl =
                              firstImageUrl || item.video_url;
                            if (
                              !mediaUrl &&
                              isVideo &&
                              videoSourceUrl &&
                              videoSourceUrl.includes("cloudinary.com")
                            ) {
                              // Convert Cloudinary video URL to thumbnail with transformation params
                              mediaUrl = videoSourceUrl
                                .replace(
                                  "/upload/",
                                  "/upload/so_0,f_jpg,q_auto,w_800/",
                                )
                                .replace(
                                  /\.(mp4|mov|webm|avi|mkv|m3u8)$/i,
                                  ".jpg",
                                );
                            }
                            if (!mediaUrl) {
                              mediaUrl = videoSourceUrl;
                            }

                            return mediaUrl ? (
                              <>
                                <Image
                                  source={{ uri: mediaUrl }}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    backgroundColor: "#E5E5EA",
                                  }}
                                  resizeMode="cover"
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
                                    <Play size={16} color="#FFF" fill="#FFF" />
                                  </View>
                                )}
                              </>
                            ) : (
                              <View
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  backgroundColor: "#E5E5EA",
                                  justifyContent: "center",
                                  alignItems: "center",
                                }}
                              >
                                <LucideImage
                                  size={30}
                                  color={LIGHT_TEXT_COLOR}
                                />
                              </View>
                            );
                          })()}
                        </TouchableOpacity>
                      );
                    }}
                  />
                </View>
              ) : (
                <View style={styles.emptyPostsContainer}>
                  <Text style={[styles.emptyPostsText, { fontWeight: "bold" }]}>
                    No posts
                  </Text>
                </View>
              );
            })()}

          {/* Community Tab - Interactive Posts */}
          {activeTab === "community" &&
            (() => {
              const interactivePosts = posts.filter((p) => {
                const postType = p.post_type || p.type;
                return [
                  "poll",
                  "prompt",
                  "qna",
                  "challenge",
                  "opportunity",
                ].includes(postType);
              });

              return interactivePosts.length > 0 ? (
                <View style={styles.communityPostsList}>
                  {interactivePosts.map((post) => (
                    <View key={post.id} style={styles.communityPostItem}>
                      <EditorialPostCard
                        post={post}
                        onLike={(postId, isLiked, count) => {
                          setPosts((prevPosts) =>
                            prevPosts.map((p) =>
                              p.id === postId
                                ? { ...p, is_liked: isLiked, like_count: count }
                                : p,
                            ),
                          );
                        }}
                        onComment={(postId) => openCommentsModal(postId)}
                        onShare={() => {}}
                        onFollow={() => {}}
                        showFollowButton={false}
                        currentUserId={currentUserId}
                        currentUserType={currentUserType}
                        onUserPress={(userId, userType) => {}}
                        onPostUpdate={(updatedPost) => {
                          setPosts((prevPosts) =>
                            prevPosts.map((p) =>
                              p.id === updatedPost.id ? updatedPost : p,
                            ),
                          );
                        }}
                      />
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyPostsContainer}>
                  <Text style={[styles.emptyPostsText, { fontWeight: "bold" }]}>
                    No community posts yet
                  </Text>
                  <Text style={styles.emptyPostsSubtext}>
                    Engage your community with polls, challenges and more.
                  </Text>
                </View>
              );
            })()}

          {/* Events Tab */}
          {activeTab === "events" &&
            (() => {
              if (communityEvents.length === 0) {
                return (
                  <View style={styles.emptyPostsContainer}>
                    <Text
                      style={[styles.emptyPostsText, { fontWeight: "bold" }]}
                    >
                      No events yet
                    </Text>
                    <Text style={styles.emptyPostsSubtext}>
                      Create events to engage with your community
                    </Text>
                  </View>
                );
              }

              const formatEventDate = (dateString) => {
                const date = new Date(dateString);
                const day = date.getDate();
                const months = [
                  "Jan",
                  "Feb",
                  "Mar",
                  "Apr",
                  "May",
                  "Jun",
                  "Jul",
                  "Aug",
                  "Sep",
                  "Oct",
                  "Nov",
                  "Dec",
                ];
                return `${day} ${months[date.getMonth()]}`;
              };
              const formatEventTime = (dateString) => {
                const date = new Date(dateString);
                return date.toLocaleTimeString("en-IN", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                });
              };
              const getLowestPrice = (item) => {
                if (item.ticket_types && item.ticket_types.length > 0) {
                  const prices = item.ticket_types
                    .map((t) => parseFloat(t.base_price) || 0)
                    .filter((p) => p > 0);
                  if (prices.length > 0) return Math.min(...prices);
                }
                if (item.min_price && parseFloat(item.min_price) > 0)
                  return parseFloat(item.min_price);
                if (item.base_price && parseFloat(item.base_price) > 0)
                  return parseFloat(item.base_price);
                return null;
              };
              const monthNames = [
                "JAN",
                "FEB",
                "MAR",
                "APR",
                "MAY",
                "JUN",
                "JUL",
                "AUG",
                "SEP",
                "OCT",
                "NOV",
                "DEC",
              ];

              return (
                <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                  {communityEvents.map((item) => {
                    const displayImage =
                      item.banner_carousel?.[0]?.image_url ||
                      item.banner_url ||
                      item.image_url;
                    const lowestPrice = getLowestPrice(item);
                    const dateObj = new Date(
                      item.event_date || item.start_datetime,
                    );
                    const month = monthNames[dateObj.getMonth()];
                    const day = dateObj.getDate();
                    const isPast = dateObj < new Date();
                    const isCancelled = item.is_cancelled;
                    const locationDisplay =
                      item.event_type === "virtual"
                        ? "Virtual Event"
                        : item.location_name || item.venue_name || "In-person";

                    return (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.85}
                        onPress={() =>
                          navigation.navigate("EventDetails", {
                            eventId: item.id,
                            eventData: item,
                          })
                        }
                        style={{
                          backgroundColor: COLORS.surface,
                          borderRadius: 20,
                          marginBottom: 24,
                          overflow: "hidden",
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.06,
                          shadowRadius: 6,
                          elevation: 4,
                        }}
                      >
                        <View
                          style={{
                            width: "100%",
                            height: 200,
                            position: "relative",
                          }}
                        >
                          {displayImage ? (
                            <Image
                              source={{ uri: displayImage }}
                              style={{ width: "100%", height: "100%" }}
                              resizeMode="cover"
                            />
                          ) : (
                            <LinearGradient
                              colors={getGradientForName(item.title || "Event")}
                              style={{ width: "100%", height: "100%" }}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                            />
                          )}
                          {isPast && (
                            <View
                              style={{
                                ...StyleSheet.absoluteFillObject,
                                backgroundColor: "rgba(0,0,0,0.08)",
                              }}
                            />
                          )}
                          <View
                            style={{
                              position: "absolute",
                              top: 12,
                              left: 12,
                              backgroundColor: "rgba(255,255,255,0.95)",
                              paddingHorizontal: 8,
                              paddingVertical: 6,
                              borderRadius: 10,
                              alignItems: "center",
                              minWidth: 44,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontFamily: FONTS.semiBold,
                                color: PRIMARY_COLOR,
                                marginBottom: 2,
                              }}
                            >
                              {month}
                            </Text>
                            <Text
                              style={{
                                fontSize: 16,
                                fontFamily: FONTS.primary,
                                color: TEXT_COLOR,
                              }}
                            >
                              {day}
                            </Text>
                          </View>
                          {isCancelled && (
                            <View
                              style={{
                                ...StyleSheet.absoluteFillObject,
                                backgroundColor: "rgba(0,0,0,0.5)",
                                justifyContent: "center",
                                alignItems: "center",
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 14,
                                  fontFamily: FONTS.primary,
                                  color: "#FFFFFF",
                                  letterSpacing: 1,
                                }}
                              >
                                CANCELLED
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={{ padding: 16 }}>
                          <Text
                            style={{
                              fontSize: 18,
                              fontFamily: FONTS.semiBold,
                              color: TEXT_COLOR,
                              marginBottom: 10,
                            }}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 6,
                            }}
                          >
                            <Ionicons
                              name="time-outline"
                              size={14}
                              color={isPast ? "#9CA3AF" : LIGHT_TEXT_COLOR}
                            />
                            <Text
                              style={{
                                fontSize: 13,
                                fontFamily: FONTS.regular,
                                color: isPast ? "#9CA3AF" : LIGHT_TEXT_COLOR,
                              }}
                            >
                              {formatEventDate(
                                item.event_date || item.start_datetime,
                              )}{" "}
                              •{" "}
                              {formatEventTime(
                                item.event_date || item.start_datetime,
                              )}
                            </Text>
                          </View>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 6,
                            }}
                          >
                            <Ionicons
                              name={
                                item.event_type === "virtual"
                                  ? "videocam-outline"
                                  : "location-outline"
                              }
                              size={14}
                              color={isPast ? "#9CA3AF" : LIGHT_TEXT_COLOR}
                            />
                            <Text
                              style={{
                                fontSize: 13,
                                fontFamily: FONTS.regular,
                                color: isPast ? "#9CA3AF" : LIGHT_TEXT_COLOR,
                              }}
                              numberOfLines={1}
                            >
                              {locationDisplay}
                            </Text>
                          </View>
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginTop: 12,
                              paddingTop: 12,
                              borderTopWidth: 1,
                              borderTopColor: "#F3F4F6",
                            }}
                          >
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                              }}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                }}
                              >
                                <View
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 14,
                                    borderWidth: 2,
                                    borderColor: "#FFFFFF",
                                    backgroundColor: "#E5E7EB",
                                    zIndex: 3,
                                  }}
                                />
                                <View
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 14,
                                    borderWidth: 2,
                                    borderColor: "#FFFFFF",
                                    backgroundColor: "#D1D5DB",
                                    marginLeft: -8,
                                    zIndex: 2,
                                  }}
                                />
                                <View
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 14,
                                    borderWidth: 2,
                                    borderColor: "#FFFFFF",
                                    backgroundColor: "#9CA3AF",
                                    marginLeft: -8,
                                    zIndex: 1,
                                  }}
                                />
                              </View>
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontFamily: FONTS.medium,
                                  color: "#36454F",
                                  marginLeft: 6,
                                }}
                              >
                                +
                                {item.attendee_count ||
                                  item.registration_count ||
                                  0}
                              </Text>
                            </View>
                            <View>
                              {lowestPrice ? (
                                <Text
                                  style={{
                                    fontSize: 16,
                                    fontFamily: FONTS.semiBold,
                                    color: isPast ? "#36454F" : "#36454F",
                                  }}
                                >
                                  ₹{lowestPrice}
                                </Text>
                              ) : (
                                <Text
                                  style={{
                                    fontSize: 16,
                                    fontFamily: FONTS.semiBold,
                                    color: "#5fab56",
                                  }}
                                >
                                  Free
                                </Text>
                              )}
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })()}
        </View>
      </Animated.ScrollView>

      <SettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onNotificationsPress={() =>
          Alert.alert(
            "Notifications",
            "Notifications settings will be implemented soon!",
          )
        }
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
                  <X size={24} color={TEXT_COLOR} />
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

      <HeadsEditorModal
        visible={headsModalVisible}
        initialHeads={profile.heads || []}
        onCancel={() => setHeadsModalVisible(false)}
        onSave={handleHeadsSave}
        maxHeads={5}
      />

      {selectedPost && (
        <ProfilePostFeed
          visible={postModalVisible}
          posts={posts.filter((p) => {
            // Only show media posts in modal (exclude Community tab content)
            const postType = p.post_type || p.type;
            const isInteractive = [
              "poll",
              "prompt",
              "qna",
              "challenge",
              "opportunity",
            ].includes(postType);

            const hasImages = p.image_urls && p.image_urls.length > 0;
            const hasVideo = !!p.video_url;
            const hasMedia = hasImages || hasVideo;

            return hasMedia && !isInteractive;
          })}
          initialPostId={selectedPost?.id}
          onClose={closePostModal}
          currentUserId={currentUserId}
          currentUserType="community"
          navigation={navigation}
          onLikeUpdate={(postId, isLiked, count) => {
            // Optimistically update local state
            console.log(
              "[CommunityProfile] Post like update:",
              postId,
              "isLiked:",
              isLiked,
              "count:",
              count,
            );
            setPosts((prevPosts) =>
              prevPosts.map((p) =>
                p.id === postId
                  ? { ...p, is_liked: isLiked, like_count: count }
                  : p,
              ),
            );
            if (selectedPost && selectedPost.id === postId) {
              setSelectedPost((prev) =>
                prev ? { ...prev, is_liked: isLiked, like_count: count } : prev,
              );
            }
          }}
          onComment={(postId) => openCommentsModal(postId)}
          onShare={(postId) => {
            Alert.alert("Share", "Sharing not implemented yet");
          }}
          onSave={(postId, isSaved) => {
            // Save logic
          }}
          onFollow={() => {}}
          onUserPress={(userId, userType) => {
            // Handle navigation
          }}
          onPostUpdate={(updatedPost) => {
            setPosts((prevPosts) =>
              prevPosts.map((p) =>
                p.id === updatedPost.id ? { ...p, ...updatedPost } : p,
              ),
            );
            if (selectedPost && selectedPost.id === updatedPost.id) {
              setSelectedPost((prev) =>
                prev ? { ...prev, ...updatedPost } : prev,
              );
            }
          }}
          onDelete={async (postId) => {
            try {
              const token = await getAuthToken();
              if (!token) {
                Alert.alert("Error", "Not authenticated");
                return;
              }

              // Delete post via API
              await apiDelete(`/posts/${postId}`, null, 15000, token);

              // Remove post from local state
              setPosts((prevPosts) => prevPosts.filter((p) => p.id !== postId));

              // Emit event for other screens listening
              EventBus.emit("post-deleted", { postId });

              // Close modal if the deleted post was being viewed
              if (selectedPost?.id === postId) {
                closePostModal();
              }

              Alert.alert("Success", "Post deleted successfully");
            } catch (error) {
              console.error("Error deleting post:", error);
              Alert.alert("Error", "Failed to delete post");
            }
          }}
        />
      )}

      <CommentsModal
        visible={commentsModalState.visible}
        postId={commentsModalState.postId}
        onClose={closeCommentsModal}
        onCommentCountChange={(postId) => {
          // Update comment count in posts
          setPosts((prevPosts) =>
            prevPosts.map((p) =>
              p.id === postId
                ? { ...p, comment_count: (p.comment_count || 0) + 1 }
                : p,
            ),
          );
        }}
        navigation={navigation}
      />

      <AccountSwitcherModal
        visible={showAccountSwitcher}
        onClose={() => setShowAccountSwitcher(false)}
        currentAccountId={profile?.id ? `community_${profile.id}` : undefined}
        currentProfile={profile ? { ...profile, type: "community" } : null}
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
            // ProfileStackNavigator → CommunityHomeTabNavigator → RootNavigator
            if (navigation.getParent) {
              const parent1 = navigation.getParent(); // CommunityHomeTabNavigator
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
        onAddAccount={() => setShowAddAccountModal(true)}
        onLoginRequired={(account) => {
          console.log(
            "[CommunityProfile] ============================================",
          );
          console.log("[CommunityProfile] onLoginRequired called!");
          console.log("[CommunityProfile] Account:", {
            id: account?.id,
            username: account?.username,
            email: account?.email,
            type: account?.type,
          });

          setShowAccountSwitcher(false);
          console.log("[CommunityProfile] Closed account switcher modal");

          let rootNavigator = navigation;
          console.log(
            "[CommunityProfile] Initial navigation object:",
            !!navigation,
          );

          try {
            if (navigation.getParent) {
              const parent1 = navigation.getParent();
              console.log("[CommunityProfile] Parent navigator:", !!parent1);
              if (parent1 && parent1.getParent) {
                const parent2 = parent1.getParent();
                console.log(
                  "[CommunityProfile] Grand parent navigator:",
                  !!parent2,
                );
                rootNavigator = parent2 || parent1;
              }
            }
          } catch (error) {
            console.warn(
              "[CommunityProfile] Error getting root navigator:",
              error,
            );
          }

          console.log(
            "[CommunityProfile] Root navigator obtained:",
            !!rootNavigator,
          );
          console.log("[CommunityProfile] Attempting navigation to Login...");

          try {
            console.log(
              '[CommunityProfile] Calling rootNavigator.navigate("Login", ...)',
            );
            rootNavigator.navigate("Login", {
              email: account.email,
              isAddingAccount: false,
            });
            console.log(
              "[CommunityProfile] Navigation call completed successfully",
            );
          } catch (error) {
            console.error(
              "[CommunityProfile] Navigation to Login failed!",
              error,
            );
            console.error("[CommunityProfile] Error details:", {
              message: error.message,
              name: error.name,
            });
            console.log(
              "[CommunityProfile] Attempting fallback: reset to Landing",
            );
            try {
              rootNavigator.reset({
                index: 0,
                routes: [{ name: "Landing" }],
              });
              console.log("[CommunityProfile] Fallback navigation completed");
            } catch (fallbackError) {
              console.error(
                "[CommunityProfile] Fallback navigation ALSO failed!",
                fallbackError,
              );
            }
          }
          console.log(
            "[CommunityProfile] ============================================",
          );
        }}
      />

      <AddAccountModal
        visible={showAddAccountModal}
        onClose={() => setShowAddAccountModal(false)}
        onLoginExisting={() =>
          navigation.navigate("Login", { isAddingAccount: true })
        }
        onCreateNew={() =>
          navigation.navigate("Landing", { fromSwitcher: true })
        }
      />

      <ActionSheet
        visible={showBannerActionSheet}
        onClose={() => setShowBannerActionSheet(false)}
        title="Banner"
        message="Update your community banner"
        actions={[
          {
            text: "Change banner",
            icon: "image-outline",
            onPress: () => {
              setShowBannerActionSheet(false);
              pickBannerImage();
            },
          },
          ...(profile?.banner_url
            ? [
                {
                  text: "Remove banner",
                  icon: "trash-outline",
                  style: "destructive",
                  onPress: () => {
                    setShowBannerActionSheet(false);
                    removeBanner();
                  },
                },
              ]
            : []),
        ]}
      />
    </View>
  );
}

// PostModal Component

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  bannerContainer: {
    width: "100%",
    height: BANNER_HEIGHT,
    backgroundColor: "#EFEFF4",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  bannerPlaceholder: {
    backgroundColor: "#E5E5EA",
    justifyContent: "center",
    alignItems: "center",
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.15)", // Subtle dim on top of blur
  },
  bannerEdit: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
    padding: 8,
    zIndex: 5,
  },
  settingsIconAbsolute: {
    position: "absolute",
    right: 16,
    top: BANNER_HEIGHT + 12, // Default case (with banner)
    zIndex: 10,
    padding: 8,
  },
  headerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  headerContent: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    height: 50, // Match header content height
  },

  summarySection: {
    paddingHorizontal: 20,
    paddingTop: 0, // Avatar overlap handles spacing
  },
  profileHeader: {
    alignItems: "center",
    gap: 6,
    marginTop: -(AVATAR_SIZE * 0.4), // 40% overlap on banner
    marginBottom: 16,
  },
  // Styles for when no banner exists
  settingsIconNoBanner: {
    // top: handled dynamically via insets.top
  },
  summarySectionNoBanner: {
    // paddingTop: handled dynamically via insets.top
  },
  profileHeaderNoBanner: {
    marginTop: 0, // No overlap when no banner
  },
  avatarWrapper: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden", // Member profile uses hidden? Member has simple image.
    // Member Style: No shadow, simple border
    backgroundColor: "#E5E5EA",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: AVATAR_SIZE / 2,
  },
  usernameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  usernameText: {
    fontFamily: FONTS.primary,
    fontSize: 18,
    color: "#3B82F6",
  },
  communityName: {
    fontFamily: FONTS.primary,
    fontSize: 24,
    color: "#0F172A",
    textAlign: "center",
  },
  categoriesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  categoryChip: {
    backgroundColor: "#F2F2F7",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryChipText: {
    fontSize: 13,
    color: PRIMARY_COLOR,
    fontWeight: "600",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locationText: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
  },
  bio: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 22,
    color: TEXT_COLOR,
    textAlign: "center",
    marginTop: 8,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 16,
    marginBottom: 16,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontFamily: FONTS.primary,
    fontSize: 20,
    color: "#0F172A",
    marginBottom: 5,
  },
  statLabel: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#6B7280",
  },
  editProfileButton: {
    alignSelf: "center",
    marginBottom: 20,
    width: "60%", // Give it some width
  },
  editProfileText: {
    // Used in GradientButton? No, handled by component props
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    // Soft premium shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: FONTS.primary, // Bold font
    fontSize: 18,
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  sponsorTypesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  sponsorTypeTag: {
    // Legacy style, unused if using ThemeChip
  },
  sponsorTypeText: {
    // Legacy style
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 8,
  },
  headAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F2F2F7",
  },
  headName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  primaryTag: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: "600",
  },
  primaryStarGradient: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  headSub: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
  },
  emptyText: {
    color: LIGHT_TEXT_COLOR,
    fontSize: 14,
  },
  // Tab Bar Styles
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
    backgroundColor: COLORS.background,
    marginTop: 8,
    position: "relative",
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    // borderBottomWidth: 2, // Handled by animated indicator
    // borderBottomColor: "transparent",
  },
  tabItemActive: {
    // borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: LIGHT_TEXT_COLOR,
  },
  tabTextActive: {
    color: PRIMARY_COLOR,
  },
  activeTabIndicator: {
    position: "absolute",
    bottom: 0,
    height: 2,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 1,
  },
  // Community Posts List
  communityPostsList: {
    paddingHorizontal: 0,
  },
  communityPostItem: {
    marginBottom: 8,
  },
  emptyPostsSubtext: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 32,
  },
  postsSection: {
    paddingHorizontal: 0,
    paddingTop: 8,
  },
  postsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  bannerPlaceholderText: {
    color: "#8E8E93",
    fontSize: 12,
    textAlign: "center",
  },
  emptyPostsContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyPostsText: {
    color: LIGHT_TEXT_COLOR,
    fontSize: 14,
  },
});
