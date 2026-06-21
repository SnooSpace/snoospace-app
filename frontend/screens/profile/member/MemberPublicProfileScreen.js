import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { useFocusEffect } from "@react-navigation/native";
import { CommonActions } from "@react-navigation/native";
import {
  View, Text, Image, StyleSheet, TouchableOpacity, FlatList, Dimensions, Modal, ScrollView, Platform, Pressable, RefreshControl, Animated } from "react-native";
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Pressable as GHPressable, GestureHandlerRootView } from "react-native-gesture-handler";
import { Image as ExpoImage } from "expo-image";
import { ArrowLeft, Play, Pin, BadgeCheck, Ticket, Users, MoreVertical, UserX, AlertTriangle, CheckCircle, ShieldOff, CalendarDays, UserPlus, UserCheck, UserMinus, Clock } from "lucide-react-native";
import CustomAlertModal from "../../../components/ui/CustomAlertModal";
import {
  getPublicMemberProfile,
  getMemberPosts,
  getMemberPublicEvents,
  getMemberPublicPlans,
  getCircleStatus,
  sendCircleRequest,
  cancelCircleRequest,
  respondToCircleRequest,
  removeFromCircle,
} from "../../../api/members";
import { resolveConversation } from "../../../api/messages";
import { SafeAreaView } from "react-native-safe-area-context";
import EventBus from "../../../utils/EventBus";
import { getAuthToken, getAuthEmail } from "../../../api/auth";
import { blockUser, unblockUser, likePlan, unlikePlan } from "../../../api/plans";
import { apiGet, apiPost, apiDelete } from "../../../api/client";
import CommentsModal from "../../../components/CommentsModal";
import EventCard from "../../../components/EventCard";
import LikeStateManager from "../../../utils/LikeStateManager";

import ThemeChip from "../../../components/ThemeChip";
import GradientButton from "../../../components/GradientButton";
import HapticsService from "../../../services/HapticsService";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  FONTS,
} from "../../../constants/theme";

const { width: screenWidth } = Dimensions.get("window");
const GAP = 2;
const ITEM_SIZE = (screenWidth - GAP * 2) / 3;

// Map legacy constants to new theme for backward compatibility
const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;
const PRIMARY_COLOR = COLORS.primary;

import SkeletonProfileHeader from "../../../components/SkeletonProfileHeader";
import SkeletonPostGrid from "../../../components/SkeletonPostGrid";
import EditorialPostCard from "../../../components/EditorialPostCard";
import ProfilePostFeed from "../../../components/ProfilePostFeed";
import SnooLoader from "../../../components/ui/SnooLoader";
import EmptyPostsState from "../../../components/EmptyPostsState";
import EmptyEventsState from "../../../components/EmptyEventsState";
import CollegeChip from "../../../components/CollegeChip";
import OpenPlanCard from "../../../components/plans/OpenPlanCard";
import RequestBottomSheet from "../../plans/RequestBottomSheet";
import CommunityVoiceBox, { VoicePostCard } from "../../../components/CommunityVoiceBox";
import EmptyCommunityState from "../../../components/EmptyCommunityState";
import OpportunityFeedCard from "../../../components/OpportunityFeedCard";

const MemberPublicPostGridCell = React.memo(({ item, index, itemSize, gap, onPress }) => {
  const scale = useSharedValue(1);

  const animatedScaleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  if (!item) {
    return <View style={{ width: itemSize, height: itemSize * 1.35, backgroundColor: "#F2F2F7" }} />;
  }

  const firstImageUrl = Array.isArray(item?.image_urls)
    ? item.image_urls
        .flat()
        .find((u) => typeof u === "string" && u.startsWith("http"))
    : undefined;

  const isVideo =
    !!item.video_url ||
    (firstImageUrl &&
      (firstImageUrl.toLowerCase().includes(".mp4") ||
        firstImageUrl.toLowerCase().includes(".mov") ||
        firstImageUrl.toLowerCase().includes(".webm")));

  let mediaUrl = null;
  if (item.video_thumbnail) {
    try {
      if (
        typeof item.video_thumbnail === "string" &&
        item.video_thumbnail.startsWith("[")
      ) {
        const parsed = JSON.parse(item.video_thumbnail);
        mediaUrl = Array.isArray(parsed) ? parsed[0] : item.video_thumbnail;
      } else {
        mediaUrl = item.video_thumbnail;
      }
    } catch (e) {
      mediaUrl = item.video_thumbnail;
    }
  }
  const videoSourceUrl = firstImageUrl || item.video_url;
  if (
    !mediaUrl &&
    isVideo &&
    videoSourceUrl &&
    videoSourceUrl.includes("cloudinary.com")
  ) {
    mediaUrl = videoSourceUrl
      .replace("/upload/", "/upload/so_0,f_jpg,q_auto,w_800/")
      .replace(/\.(mp4|mov|webm|avi|mkv|m3u8)$/i, ".jpg");
  }
  if (!mediaUrl) {
    mediaUrl = videoSourceUrl;
  }

  return (
    <Pressable
      style={{
        width: itemSize,
        height: itemSize * 1.35,
        marginBottom: 0,
      }}
      onPressIn={() => {
        scale.value = withSpring(0.95, { damping: 10, stiffness: 150 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 10, stiffness: 150 });
      }}
      onPress={() => onPress(item)}
    >
      <Reanimated.View style={[{ width: "100%", height: "100%", overflow: "hidden", borderRadius: 3 }, animatedScaleStyle]}>
        <ExpoImage
          source={{ uri: mediaUrl || "https://via.placeholder.com/150" }}
          style={{ width: "100%", height: "100%" }}
          cachePolicy="memory-disk"
          contentFit="cover"
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
            <Play size={16} color="#FFF" />
          </View>
        )}

        {item?.is_pinned && (
          <View
            style={{
              position: "absolute",
              top: 6,
              left: 6,
              zIndex: 10,
              backgroundColor: "rgba(255, 255, 255, 0.22)",
              borderRadius: 10,
              padding: 5,
              borderWidth: 0.6,
              borderColor: "rgba(255, 255, 255, 0.5)",
              overflow: "visible",
            }}
          >
            <View style={{ transform: [{ rotate: "27deg" }], overflow: "visible" }}>
              <Pin size={10} color="#10B981" strokeWidth={2.5} fill="#10B981" />
            </View>
          </View>
        )}
      </Reanimated.View>
    </Pressable>
  );
});
import CollegeHubSheet from "../../../components/modals/CollegeHubSheet";
import InstagramRow from "../../../components/InstagramRow";

export default function MemberPublicProfileScreen({ route, navigation }) {
  const memberId = route?.params?.memberId;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [posts, setPosts] = useState([]);
  const [preResolvedConversationId, setPreResolvedConversationId] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // Circle relationship state
  const [circleStatus, setCircleStatus] = useState('none'); // none | pending_outgoing | pending_incoming | in_circle
  const [circleRequestId, setCircleRequestId] = useState(null);
  const [circleActionLoading, setCircleActionLoading] = useState(false);
  const [circleCount, setCircleCount] = useState(0);
  const [showAllInterests, setShowAllInterests] = useState(false);
  const [showAllPronouns, setShowAllPronouns] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [showCollegeHub, setShowCollegeHub] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (menuVisible) {
      slideAnim.setValue(0);
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    }
  }, [menuVisible]);

  const sheetTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });
  const [blocking, setBlocking] = useState(false);
  const [unblocking, setUnblocking] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [youHaveBlocked, setYouHaveBlocked] = useState(false);
  const pendingPostUpdateRef = useRef(null);

  // Events tab state
  const [activeProfileTab, setActiveProfileTab] = useState('posts');
  const [profileEvents, setProfileEvents] = useState([]);
  const [profilePlans, setProfilePlans] = useState({ hosted: [], attending: [] });
  const [planRequestSheet, setPlanRequestSheet] = useState(null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const eventsFetchedRef = useRef(false);

  // Community Posts tab state (Creator Mode)
  const [voicePosts, setVoicePosts] = useState([]);
  const [loadingVoicePosts, setLoadingVoicePosts] = useState(false);
  const communityPostsFetchedRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  const scrollViewRef = useRef(null);
  const scrollToPostIdRef = useRef(route?.params?.postId);
  const tabContentYRef = useRef(0);

  // Comments modal state
  const [commentsModalState, setCommentsModalState] = useState({
    visible: false,
    postId: null,
    postType: "post",
  });

  const openCommentsModal = useCallback((postId, postType = "post") => {
    if (postId) {
      setCommentsModalState({ visible: true, postId, postType });
    }
  }, []);

  const closeCommentsModal = useCallback(() => {
    setCommentsModalState({ visible: false, postId: null, postType: "post" });
  }, []);

  // Underline sliding animation (Reanimated)
  const tabUnderlineX = useSharedValue(0);
  const tabUnderlineScale = useSharedValue(0);
  const tabWidths = useRef({}).current;
  const tabOffsets = useRef({}).current;

  const animatedUnderlineStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: tabUnderlineX.value }],
      width: tabUnderlineScale.value,
    };
  });

  useEffect(() => {
    if (tabOffsets[activeProfileTab] !== undefined) {
      tabUnderlineX.value = withTiming(tabOffsets[activeProfileTab], { duration: 200 });
      tabUnderlineScale.value = withTiming(tabWidths[activeProfileTab], { duration: 200 });
    }
  }, [activeProfileTab]);

  const handleTabLayout = (tab, event) => {
    const { x, width } = event.nativeEvent.layout;
    tabOffsets[tab] = x;
    tabWidths[tab] = width;

    if (tab === activeProfileTab) {
      tabUnderlineX.value = x;
      tabUnderlineScale.value = width;
    }
  };

  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: "",
    message: "",
    icon: null,
    iconColor: undefined,
    primaryAction: null,
    secondaryAction: null,
  });

  const showAlert = useCallback((config) => setAlertConfig({ ...config, visible: true }), []);
  const hideAlert = useCallback(() => setAlertConfig((p) => ({ ...p, visible: false })), []);

  const handleBlockUser = useCallback(async () => {
    setMenuVisible(false);
    setTimeout(() => {
      const recipientName = profile?.full_name || "this user";
      showAlert({
        title: `Block ${recipientName}?`,
        message: "They won't be able to message you or find your profile. You can unblock them anytime from Settings → Blocked Users.",
        icon: UserX,
        iconColor: "#E53935",
        secondaryAction: { text: "Cancel", onPress: hideAlert },
        primaryAction: {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            hideAlert();
            try {
              setBlocking(true);
              const token = await getAuthToken();
              await blockUser(memberId, token);
              showAlert({
                title: "Blocked",
                message: `${recipientName} has been blocked.`,
                icon: CheckCircle,
                iconColor: "#34C759",
                primaryAction: {
                  text: "OK",
                  onPress: () => {
                    hideAlert();
                    navigation.goBack();
                  },
                },
              });
            } catch (err) {
              showAlert({
                title: "Error",
                message: err?.message || "Failed to block user. Please try again.",
                primaryAction: { text: "OK", onPress: hideAlert },
                icon: AlertTriangle,
                iconColor: "#E53935",
              });
            } finally {
              setBlocking(false);
            }
          },
        },
      });
    }, 300);
  }, [memberId, profile, navigation, showAlert, hideAlert]);

  const handleUnblockUser = useCallback(async () => {
    try {
      setUnblocking(true);
      const token = await getAuthToken();
      await unblockUser(memberId, token);
      setYouHaveBlocked(false);
    } catch (err) {
      showAlert({
        title: "Error",
        message: err?.message || "Failed to unblock. Please try again.",
        primaryAction: { text: "OK", onPress: hideAlert },
        icon: AlertTriangle,
        iconColor: "#E53935",
      });
    } finally {
      setUnblocking(false);
    }
  }, [memberId, showAlert, hideAlert]);

  const loadProfile = useCallback(async () => {
    try {
      const p = await getPublicMemberProfile(memberId);
      // Normalize interests/pronouns fields - backend now returns them as arrays
      const normalized = {
        ...p,
        interests: Array.isArray(p?.interests)
          ? p.interests.filter((i) => i && String(i).trim())
          : typeof p?.interests === "string" && p.interests
            ? (() => {
                try {
                  const parsed = JSON.parse(p.interests);
                  return Array.isArray(parsed)
                    ? parsed.filter((i) => i && String(i).trim())
                    : [];
                } catch {
                  return [];
                }
              })()
            : [],
        pronouns: Array.isArray(p?.pronouns)
          ? p.pronouns.filter(
              (pron) =>
                pron && String(pron).trim() && pron !== "Prefer not to say",
            )
          : p?.pronouns &&
              String(p.pronouns).trim() &&
              p.pronouns !== "Prefer not to say"
            ? [String(p.pronouns).trim()]
            : [],
      };
      setProfile(normalized);
      setCircleCount(p?.circle_count || 0);
      setYouHaveBlocked(!!p?.you_have_blocked);
    } catch (e) {
      if (e?.status === 403 && e?.data?.error === 'user_unavailable') {
        setBlocked(true);
      } else {
        setError(e?.message || "Failed to load profile");
      }
    }
  }, [memberId]);

  const loadCircleStatus = useCallback(async () => {
    try {
      const res = await getCircleStatus(memberId);
      setCircleStatus(res?.status || 'none');
      setCircleRequestId(res?.request_id || null);
    } catch (e) {
      console.warn('[MemberPublicProfile] loadCircleStatus error:', e);
    }
  }, [memberId]);

  // Lazy load events/plans for public profile when Events tab is first opened
  const loadPublicMemberEvents = useCallback(async () => {
    if (loadingEvents) return;
    try {
      setLoadingEvents(true);
      const [eventsRes, plansRes] = await Promise.all([
        getMemberPublicEvents(memberId).catch(() => ({ events: [] })),
        getMemberPublicPlans(memberId).catch(() => ({ hosted: [], attending: [] })),
      ]);
      setProfileEvents(eventsRes?.events || []);
      setProfilePlans({
        hosted: plansRes?.hosted || [],
        attending: plansRes?.attending || [],
      });
    } catch (err) {
      console.error('[MemberPublicProfile] loadPublicMemberEvents error:', err);
    } finally {
      setLoadingEvents(false);
    }
  }, [memberId, loadingEvents]);

  const loadCommunityVoicePosts = useCallback(async () => {
    if (!memberId) return;
    try {
      setLoadingVoicePosts(true);
      const token = await getAuthToken();
      const res = await apiGet(
        `/community-voice-posts?target_id=${memberId}&target_type=member`,
        15000,
        token
      );
      setVoicePosts(res?.posts || []);
    } catch (e) {
      console.warn('[MemberPublicProfile] loadVoicePosts error:', e);
    } finally {
      setLoadingVoicePosts(false);
    }
  }, [memberId]);

  useEffect(() => {
    if (route?.params?.postId) {
      scrollToPostIdRef.current = route.params.postId;
    }
    if (route?.params?.initialTab === "community") {
      setActiveProfileTab("community");
      if (!communityPostsFetchedRef.current) {
        communityPostsFetchedRef.current = true;
        loadCommunityVoicePosts();
      }
      navigation.setParams({ initialTab: undefined, postId: undefined });
    }
  }, [route?.params?.initialTab, route?.params?.postId, loadCommunityVoicePosts, navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadProfile(),
      loadPosts(true),
      loadCircleStatus(),
      activeProfileTab === 'events' ? loadPublicMemberEvents() : Promise.resolve(),
      activeProfileTab === 'community' ? loadCommunityVoicePosts() : Promise.resolve()
    ]);
    setRefreshing(false);
  }, [activeProfileTab, loadProfile, loadPosts, loadCircleStatus, loadPublicMemberEvents, loadCommunityVoicePosts]);

  const loadPosts = useCallback(
    async (reset = false) => {
      if (loadingMore) return;
      if (!hasMore && !reset) return;
      try {
        if (reset) {
          setOffset(0);
          setHasMore(true);
        }
        setLoadingMore(true);
        const data = await getMemberPosts(memberId, {
          limit: 21,
          offset: reset ? 0 : offset,
        });
        const rawPosts = reset
          ? data?.posts || data || []
          : [...posts, ...(data?.posts || data || [])];
        // Normalize is_liked field for all posts - ensure it's explicitly true or false
        const normalizedPosts = rawPosts.map((post) => ({
          ...post,
          is_liked: post.is_liked === true,
          isLiked: post.is_liked === true,
        }));

        // Merge with cached like states to fix backend returning stale is_liked data
        const mergedPosts =
          await LikeStateManager.mergeLikeStates(normalizedPosts);

        setPosts(mergedPosts);
        const received = (data?.posts || data || []).length;
        const nextOffset = (reset ? 0 : offset) + received;
        setOffset(nextOffset);
        setHasMore(received >= 21);
      } catch (e) {
        setError(e?.message || "Failed to load posts");
      } finally {
        setLoadingMore(false);
      }
    },
    [memberId, offset, posts, hasMore, loadingMore],
  );

  // Refresh profile + circle status when screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
      loadCircleStatus();
    }, [loadProfile, loadCircleStatus]),
  );

  useEffect(() => {
    let mounted = true;
    setPreResolvedConversationId(null);
    (async () => {
      setLoading(true);
      await Promise.all([loadProfile(), loadPosts(true), loadCircleStatus()]);
      if (mounted) setLoading(false);
    })();
    
    // Background resolve conversation to warm cache
    resolveConversation(memberId, 'member')
      .then((res) => {
        if (mounted && res?.conversationId) {
          setPreResolvedConversationId(res.conversationId);
        }
      })
      .catch((err) => console.log('[PERF] Background resolveConversation error:', err));

    return () => {
      mounted = false;
    };
  }, [memberId]);

  // Listen for like updates from other screens (e.g., home feed)
  useEffect(() => {
    const unsubscribe = EventBus.on("post-like-updated", async (payload) => {
      if (!payload?.postId) return;

      // Cache the like state to persist across component unmounts
      await LikeStateManager.setLikeState(payload.postId, payload.isLiked);

      setPosts((prev) =>
        prev.map((post) =>
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
      // Also update selectedPost if it matches
      setSelectedPost((prevSelected) => {
        if (prevSelected && prevSelected.id === payload.postId) {
          return {
            ...prevSelected,
            is_liked: payload.isLiked,
            isLiked: payload.isLiked,
            like_count:
              typeof payload.likeCount === "number"
                ? payload.likeCount
                : prevSelected.like_count,
            comment_count:
              typeof payload.commentCount === "number"
                ? payload.commentCount
                : prevSelected.comment_count,
          };
        }
        return prevSelected;
      });
    });

    const handlePostViewUpdate = (payload) => {
      if (!payload?.postId) return;
      setPosts((prev) =>
        prev.map((post) =>
          post.id === payload.postId
            ? { ...post, public_view_count: (post.public_view_count || 0) + 1 }
            : post,
        ),
      );
      setSelectedPost((prevSelected) => {
        if (prevSelected && prevSelected.id === payload.postId) {
          return { ...prevSelected, public_view_count: (prevSelected.public_view_count || 0) + 1 };
        }
        return prevSelected;
      });
    };

    const handlePostShareUpdate = (payload) => {
      if (!payload?.postId) return;
      setPosts((prev) =>
        prev.map((post) =>
          post.id === payload.postId
            ? { ...post, share_count: (post.share_count || 0) + (payload.increment || 1) }
            : post,
        ),
      );
      setSelectedPost((prevSelected) => {
        if (prevSelected && prevSelected.id === payload.postId) {
          return { ...prevSelected, share_count: (prevSelected.share_count || 0) + (payload.increment || 1) };
        }
        return prevSelected;
      });
    };

    const handlePostSaveUpdate = (payload) => {
      if (!payload?.postId) return;
      setPosts((prev) =>
        prev.map((post) =>
          post.id === payload.postId
            ? { ...post, is_saved: payload.isSaved, save_count: payload.saveCount }
            : post,
        ),
      );
      setSelectedPost((prevSelected) => {
        if (prevSelected && prevSelected.id === payload.postId) {
          return { ...prevSelected, is_saved: payload.isSaved, save_count: payload.saveCount };
        }
        return prevSelected;
      });
    };

    const unsubscribeView = EventBus.on("post-view-updated", handlePostViewUpdate);
    const unsubscribeShare = EventBus.on("post-share-updated", handlePostShareUpdate);
    const unsubscribeSave = EventBus.on("post-save-updated", handlePostSaveUpdate);

    return () => {
      unsubscribe && unsubscribe();
      if (unsubscribeView) unsubscribeView();
      if (unsubscribeShare) unsubscribeShare();
      if (unsubscribeSave) unsubscribeSave();
    };
  }, []);

  const openPostModal = useCallback((post) => {
    const latestPost = posts.find((p) => p.id === post.id) || post;
    const normalizedIsLiked = latestPost.is_liked === true;
    const normalizedPost = {
      ...latestPost,
      is_liked: normalizedIsLiked,
      isLiked: normalizedIsLiked,
    };
    setSelectedPost(normalizedPost);
    setPostModalVisible(true);
  }, [posts]);

  const closePostModal = useCallback(() => {
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
  }, []);

  const renderGridItem = useCallback(({ item, index }) => {
    return (
      <MemberPublicPostGridCell
        item={item}
        index={index}
        itemSize={ITEM_SIZE}
        gap={GAP}
        onPress={openPostModal}
      />
    );
  }, [openPostModal]);

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <GHPressable
            onPress={() => {
              HapticsService.triggerBack();
              navigation.goBack();
            }}
            style={styles.backBtn}
          >
            <ArrowLeft size={24} color={COLORS.textPrimary} />
          </GHPressable>
          {profile?.username ? (
            <Text style={styles.headerUsername}>@{profile.username}</Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {/* 3-dot menu — only for other users, not self */}
          <GHPressable
            style={styles.menuBtn}
            onPress={() => setMenuVisible(true)}
            hitSlop={12}
          >
            <MoreVertical size={22} color={COLORS.textSecondary} strokeWidth={2} />
          </GHPressable>
      </View>

      {/* Block / Options Bottom Sheet */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={menuStyles.overlay} onPress={() => setMenuVisible(false)}>
          <Animated.View
            style={[menuStyles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}
          >
            <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%' }}>
              <View style={menuStyles.handle} />
            {profile?.created_at && (() => {
              const createdDate = new Date(profile.created_at);
              const accountAge = Math.floor((Date.now() - createdDate.getTime()) / 86400000);
              const joinDate = createdDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              return (
                <>
                  <View style={menuStyles.row}>
                    <View style={[menuStyles.iconBox, { backgroundColor: 'rgba(59,130,246,0.08)' }]}>
                      <CalendarDays size={20} color="#3B82F6" strokeWidth={2} />
                    </View>
                    <View style={menuStyles.rowText}>
                      <Text style={[menuStyles.rowLabel, { color: COLORS.textPrimary }]}>
                        {accountAge}d
                      </Text>
                      <Text style={menuStyles.rowSub}>
                        Joined on {joinDate}
                      </Text>
                    </View>
                  </View>
                  <View style={{ height: 1, backgroundColor: '#F3F4F6', marginVertical: 8 }} />
                </>
              );
            })()}
            <TouchableOpacity
              style={menuStyles.row}
              onPress={youHaveBlocked ? () => { setMenuVisible(false); handleUnblockUser(); } : handleBlockUser}
              activeOpacity={0.7}
              disabled={blocking || unblocking}
            >
              <View style={[menuStyles.iconBox, youHaveBlocked && { backgroundColor: 'rgba(53,101,242,0.08)' }]}>
                {youHaveBlocked
                  ? <ShieldOff size={20} color="#3565F2" strokeWidth={2.5} />
                  : <UserX    size={20} color="#E53935" strokeWidth={2.5} />}
              </View>
              <View style={menuStyles.rowText}>
                <Text style={[menuStyles.rowLabel, youHaveBlocked && { color: '#3565F2' }]}>
                  {youHaveBlocked ? 'Unblock User' : 'Block User'}
                </Text>
                <Text style={menuStyles.rowSub}>
                  {youHaveBlocked ? 'Remove block and restore access' : "They won't be able to message or find you"}
                </Text>
              </View>
            </TouchableOpacity>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* "You've blocked this user" banner */}
      {youHaveBlocked && !loading && (
        <View style={blockBannerStyles.banner}>
          <View style={blockBannerStyles.left}>
            <ShieldOff size={18} color="#E11D48" strokeWidth={2} style={{ marginRight: 8 }} />
            <Text style={blockBannerStyles.text}>You've blocked this user</Text>
          </View>
          <TouchableOpacity
            style={blockBannerStyles.btn}
            onPress={handleUnblockUser}
            disabled={unblocking}
            activeOpacity={0.75}
          >
            <Text style={blockBannerStyles.btnText}>{unblocking ? 'Unblocking…' : 'Unblock'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ScrollView style={{ flex: 1, backgroundColor: "#fff" }}>
          <SkeletonProfileHeader type="member" />
          <SkeletonPostGrid />
        </ScrollView>
      ) : blocked ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#fff' }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(229,57,53,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <UserX size={32} color="#E53935" strokeWidth={1.8} />
          </View>
          <Text style={{ fontFamily: FONTS.primary, fontSize: 18, color: COLORS.textPrimary, marginBottom: 8, textAlign: 'center' }}>Profile Unavailable</Text>
          <Text style={{ fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 }}>
            This profile isn't available.
          </Text>
        </View>
      ) : error ? (
        <View style={{ padding: 16 }}>
          <Text style={{ color: "#FF3B30" }}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{
            paddingBottom: 120,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PRIMARY_COLOR}
              colors={[PRIMARY_COLOR]}
            />
          }
          scrollEventThrottle={400}
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 200;
            if (isNearBottom && activeProfileTab === 'posts' && !loading && !loadingMore && hasMore) {
              loadPosts(false);
            }
          }}
        >
          <View style={styles.profileSection}>
            <View style={styles.profileImageContainer}>
              <Image
                source={{
                  uri:
                    profile?.profile_photo_url ||
                    "https://via.placeholder.com/160",
                }}
                style={styles.profileImage}
              />
            </View>
            {(() => {
              const visiblePronouns = Array.isArray(profile?.pronouns)
                ? profile.pronouns.filter((p) => p !== "Prefer not to say")
                : [];
              const hasBio = !!profile?.bio;
              const hasPronouns = visiblePronouns.length > 0;

              const trustSignals = [
                profile?.events_attended_count > 0 && {
                  icon: Ticket,
                  label: `${profile.events_attended_count} ${profile.events_attended_count === 1 ? "event" : "events"}`,
                },
                profile?.communities_count > 0 && {
                  icon: Users,
                  label: `${profile.communities_count} ${profile.communities_count === 1 ? "community" : "communities"}`,
                },
              ].filter(Boolean);

              return (
                <View
                  style={[
                    styles.nameAndPronounsContainer,
                    !hasBio && !hasPronouns && { marginBottom: trustSignals.length > 0 ? 10 : 30 },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Text style={styles.profileName}>
                      {profile?.full_name || "Member"}
                    </Text>
                    {profile?.is_verified && (
                      <BadgeCheck size={20} color="#2962FF" strokeWidth={2} />
                    )}
                  </View>
                  {hasPronouns ? (
                    <View style={styles.pronounsRowCentered}>
                      <View
                        key={`p-0`}
                        style={[styles.chip, styles.pronounChipSmall]}
                      >
                        <Text style={styles.chipText}>
                          {visiblePronouns
                            .map((p) =>
                              String(p).replace(/^[{"]+|[}"]+$/g, ""),
                            )
                            .join(" / ")}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  {trustSignals.length > 0 && (
                    <View style={trustStyles.row}>
                      {trustSignals.map((sig, idx) => (
                        <View key={idx} style={trustStyles.pill}>
                          <sig.icon size={11} color={COLORS.textSecondary} strokeWidth={2} />
                          <Text style={trustStyles.pillText}>{sig.label}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })()}
            {!!profile?.bio && renderBio(profile.bio)}

            {/* College & Socials Row */}
            {(profile?.instagram_username || (profile?.college_info && profile?.show_college !== false)) ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10, marginBottom: 8 }}>
                {profile?.college_info && profile?.show_college !== false && (
                  <CollegeChip
                    collegeInfo={profile.college_info}
                    onPress={() => setShowCollegeHub(true)}
                  />
                )}
                {profile?.instagram_username && (
                  <InstagramRow username={profile.instagram_username} />
                )}
              </View>
            ) : null}

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {profile?.posts_count || 0}
                </Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <GHPressable
                style={styles.statItem}
                onPress={() => {
                  HapticsService.triggerStatsTap();
                  setActiveProfileTab('events');
                  if (!eventsFetchedRef.current) {
                    eventsFetchedRef.current = true;
                    loadPublicMemberEvents();
                  }
                }}
              >
                <Text style={styles.statNumber}>
                  {profile?.events_attended_count || 0}
                </Text>
                <Text style={styles.statLabel}>Events</Text>
              </GHPressable>
              <GHPressable
                style={styles.statItem}
                onPress={() => {
                  HapticsService.triggerStatsTap();
                  navigation.navigate('CircleList', {
                    memberId: profile?.id,
                    memberName: profile?.full_name,
                    readOnly: true,
                  });
                }}
              >
                <Text style={styles.statNumber}>
                  {circleCount}
                </Text>
                <Text style={styles.statLabel}>Circle</Text>
              </GHPressable>
              <GHPressable
                style={styles.statItem}
                onPress={() => {
                  HapticsService.triggerStatsTap();
                  navigation.navigate('FollowingList', {
                    memberId: profile?.id,
                    title: 'Following',
                  });
                }}
              >
                <Text style={styles.statNumber}>
                  {profile?.following_count || 0}
                </Text>
                <Text style={styles.statLabel}>Following</Text>
              </GHPressable>
            </View>
            {Array.isArray(profile?.interests) &&
            profile.interests.length > 0 ? (
              <View style={styles.metaChipsSection}>
                <View style={[styles.chipGridRow, { marginTop: 6 }]}>
                  {(showAllInterests
                    ? profile.interests
                    : profile.interests.slice(0, 6)
                  ).map((i, idx) => (
                    <ThemeChip
                      key={`i-${idx}`}
                      label={String(i)}
                      index={idx}
                      style={styles.chipGridItem}
                    />
                  ))}
                  {profile.interests.length > 6 && !showAllInterests ? (
                    <GHPressable
                      onPress={() => setShowAllInterests(true)}
                      style={({ pressed }) => [
                        styles.chip,
                        styles.chipBlue,
                        styles.chipGridItem,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={[styles.chipText, styles.chipTextBlue]}>
                        See all
                      </Text>
                    </GHPressable>
                  ) : null}
                  {profile.interests.length > 6 && showAllInterests ? (
                    <GHPressable
                      onPress={() => setShowAllInterests(false)}
                      style={({ pressed }) => [
                        styles.chip,
                        styles.chipGridItem,
                        {
                          backgroundColor: "#FF3B30",
                          borderColor: "#FF3B30",
                        },
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: "#FFFFFF" }]}>
                        Collapse
                      </Text>
                    </GHPressable>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View
              style={{
                marginTop: 12,
                flexDirection: "row",
                gap: 10,
                width: "100%",
              }}
            >
              {/* ── Circle CTA — 4 states ── */}
              {circleStatus === 'in_circle' ? (
                <GHPressable
                  style={({ pressed }) => [circleCTAStyles.inCircleBtn, pressed && { opacity: 0.7 }]}
                  disabled={circleActionLoading}
                  onPress={() => {
                    showAlert({
                      title: 'Remove from Circle?',
                      message: `${profile?.full_name || 'This person'} will be removed from your circle. They can still find your profile and message you.`,
                      icon: UserMinus,
                      iconColor: '#E53935',
                      secondaryAction: { text: 'Keep', onPress: hideAlert },
                      primaryAction: {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: async () => {
                          hideAlert();
                          setCircleActionLoading(true);
                          try {
                            await removeFromCircle(memberId);
                            setCircleStatus('none');
                            setCircleCount((c) => Math.max(0, c - 1));
                            HapticsService.triggerImpactLight();
                          } catch (e) {
                            loadCircleStatus();
                          } finally { setCircleActionLoading(false); }
                        },
                      },
                    });
                  }}
                >
                  <UserCheck size={16} color="#2962FF" strokeWidth={2.5} style={{ marginRight: 6 }} />
                  <Text style={circleCTAStyles.inCircleText}>In Circle</Text>
                </GHPressable>
              ) : circleStatus === 'pending_outgoing' ? (
                <GHPressable
                  style={({ pressed }) => [circleCTAStyles.requestedBtn, pressed && { opacity: 0.7 }]}
                  disabled={circleActionLoading}
                  onPress={() => {
                    showAlert({
                      title: 'Cancel Request?',
                      message: 'Withdraw your circle request?',
                      icon: Clock,
                      iconColor: '#FF9500',
                      secondaryAction: { text: 'Keep', onPress: hideAlert },
                      primaryAction: {
                        text: 'Cancel Request',
                        style: 'destructive',
                        onPress: async () => {
                          hideAlert();
                          setCircleActionLoading(true);
                          try {
                            await cancelCircleRequest(circleRequestId);
                            setCircleStatus('none');
                            setCircleRequestId(null);
                            HapticsService.triggerImpactLight();
                          } catch (e) {
                            loadCircleStatus();
                          } finally { setCircleActionLoading(false); }
                        },
                      },
                    });
                  }}
                >
                  <Clock size={16} color="#FF9500" strokeWidth={2.5} style={{ marginRight: 6 }} />
                  <Text style={circleCTAStyles.requestedText}>Requested</Text>
                </GHPressable>
              ) : circleStatus === 'pending_incoming' ? (
                <View style={circleCTAStyles.incomingRow}>
                  <GHPressable
                    style={({ pressed }) => [circleCTAStyles.acceptBtn, pressed && { opacity: 0.7 }]}
                    disabled={circleActionLoading}
                    onPress={async () => {
                      setCircleActionLoading(true);
                      try {
                        await respondToCircleRequest(circleRequestId, 'accepted');
                        setCircleStatus('in_circle');
                        setCircleCount((c) => c + 1);
                        HapticsService.triggerAddToCircle();
                      } catch (e) {
                        loadCircleStatus();
                      } finally { setCircleActionLoading(false); }
                    }}
                  >
                    <UserCheck size={16} color="#fff" strokeWidth={2.5} style={{ marginRight: 6 }} />
                    <Text style={circleCTAStyles.acceptText}>Accept</Text>
                  </GHPressable>
                  <GHPressable
                    style={({ pressed }) => [circleCTAStyles.declineBtn, pressed && { opacity: 0.7 }]}
                    disabled={circleActionLoading}
                    onPress={async () => {
                      setCircleActionLoading(true);
                      try {
                        await respondToCircleRequest(circleRequestId, 'declined');
                        setCircleStatus('none');
                        setCircleRequestId(null);
                        HapticsService.triggerClose();
                      } catch (e) {
                        loadCircleStatus();
                      } finally { setCircleActionLoading(false); }
                    }}
                  >
                    <UserX size={16} color={COLORS.textSecondary} strokeWidth={2.5} style={{ marginRight: 6 }} />
                    <Text style={circleCTAStyles.declineText}>Decline</Text>
                  </GHPressable>
                </View>
              ) : (
                <GradientButton
                  title="Add to Circle"
                  colors={["#448AFF", "#2962FF"]}
                  textStyle={{ fontFamily: FONTS.semiBold, color: "#FFFFFF" }}
                  style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}
                  gradientStyle={{ borderRadius: 16 }}
                  disabled={circleActionLoading}
                  useGHPressable={true}
                  onPress={async () => {
                    setCircleActionLoading(true);
                    try {
                      const res = await sendCircleRequest(memberId);
                      if (res?.auto_accepted) {
                        setCircleStatus('in_circle');
                        setCircleCount((c) => c + 1);
                      } else {
                        setCircleStatus('pending_outgoing');
                        setCircleRequestId(res?.request_id || null);
                      }
                      HapticsService.triggerAddToCircle();
                    } catch (e) {
                      loadCircleStatus();
                    } finally { setCircleActionLoading(false); }
                  }}
                >
                  <UserPlus size={16} color="#fff" strokeWidth={2.5} />
                </GradientButton>
              )}
              <GradientButton
                title="Message"
                style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}
                gradientStyle={{ borderRadius: 16 }}
                colors={["#111827", "#111827"]}
                textStyle={{ fontFamily: FONTS.semiBold, color: "#FFFFFF" }}
                useGHPressable={true}
                onPress={() => {
                  HapticsService.triggerMessageSend();
                  const tappedAt = global.performance ? global.performance.now() : Date.now();
                  setTimeout(() => {
                    navigation.navigate("Chat", {
                      conversationId: preResolvedConversationId,
                      recipientId: memberId,
                      recipientType: "member",
                      recipientName: profile?.full_name || profile?.name,
                      recipientUsername: profile?.username,
                      recipientAvatar: profile?.profile_photo_url,
                      tappedAt,
                    });
                  }, 50);
                }}
              />
            </View>
          </View>

          {/* Posts / Events / Community Posts Tab Bar */}
          <View style={pubTabStyles.tabBar}>
            {[
              'posts',
              ...(profile?.is_creator_mode_enabled ? ['community'] : []),
              'events',
            ].map((tab) => (
              <GHPressable
                key={tab}
                style={pubTabStyles.tab}
                onLayout={(e) => handleTabLayout(tab, e)}
                onPress={() => {
                  HapticsService.triggerImpactLight();
                  setActiveProfileTab(tab);
                  if (tab === 'events' && !eventsFetchedRef.current) {
                    eventsFetchedRef.current = true;
                    loadPublicMemberEvents();
                  }
                  if (tab === 'community' && !communityPostsFetchedRef.current) {
                    communityPostsFetchedRef.current = true;
                    loadCommunityVoicePosts();
                  }
                }}
              >
                <Text style={[
                  pubTabStyles.tabText,
                  activeProfileTab === tab && pubTabStyles.tabTextActive,
                ]}>
                  {tab === 'posts' ? 'Posts' : tab === 'events' ? 'Events' : 'Community'}
                </Text>
              </GHPressable>
            ))}
            <Reanimated.View
              style={[
                pubTabStyles.activeTabIndicator,
                animatedUnderlineStyle,
              ]}
            />
          </View>

          {/* Posts Tab Content */}
          {activeProfileTab === 'posts' && (
            <View style={{ display: 'flex' }}>
              {(() => {
                const numRows = Math.ceil(posts.length / 3);
                const gridHeight = numRows > 0 ? numRows * (ITEM_SIZE * 1.35) + (numRows - 1) * GAP : 0;
                return posts.length > 0 ? (
                  <View style={{ height: gridHeight, marginTop: 10 }}>
                    <FlatList
                      data={posts}
                      keyExtractor={(item) => String(item.id)}
                      numColumns={3}
                      columnWrapperStyle={{ justifyContent: "flex-start", marginBottom: GAP, gap: GAP }}
                      scrollEnabled={false}
                      renderItem={renderGridItem}
                      initialNumToRender={12}
                      maxToRenderPerBatch={6}
                      windowSize={5}
                      removeClippedSubviews={Platform.OS === 'android'}
                      updateCellsBatchingPeriod={50}
                      getItemLayout={(data, index) => ({
                        length: ITEM_SIZE * 1.35,
                        offset: (ITEM_SIZE * 1.35 + GAP) * Math.floor(index / 3),
                        index,
                      })}
                    />
                  </View>
                ) : (
                  <EmptyPostsState isOwnProfile={false} />
                );
              })()}
            </View>
          )}

          {loadingMore && activeProfileTab === 'posts' && (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <SnooLoader size="small" color={COLORS.primary} />
            </View>
          )}

          {/* Community Posts Tab Content */}
          {profile?.is_creator_mode_enabled && activeProfileTab === 'community' && (
            <View
              style={{ paddingTop: 4, paddingBottom: 8 }}
              onLayout={(e) => {
                tabContentYRef.current = e.nativeEvent.layout.y;
              }}
            >
              {/* Voice Box — any viewer can post */}
              <CommunityVoiceBox
                targetId={profile.id}
                targetType="member"
                currentUser={null}
                onPostCreated={(newPost) => {
                  setVoicePosts((prev) => [newPost, ...prev]);
                }}
              />

              {/* Creator's own interactive posts */}
              {posts
                .filter((p) => ['poll', 'prompt', 'qna', 'challenge', 'opportunity'].includes(p.post_type || p.type))
                .sort((a, b) => {
                  if (a.is_pinned && !b.is_pinned) return -1;
                  if (!a.is_pinned && b.is_pinned) return 1;
                  return new Date(b.created_at) - new Date(a.created_at);
                })
                .map((post) => {
                  const postType = post.post_type || post.type;
                  if (postType === 'opportunity') {
                    return (
                      <View
                        key={post.id}
                        onLayout={(e) => {
                          if (String(post.id) === String(scrollToPostIdRef.current)) {
                            scrollToPostIdRef.current = null;
                            const itemY = e.nativeEvent.layout.y;
                            const targetY = tabContentYRef.current + itemY;
                            setTimeout(() => {
                              scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY - 60), animated: true });
                            }, 100);
                          }
                        }}
                        style={{ marginHorizontal: 16, marginBottom: 12 }}
                      >
                        <OpportunityFeedCard
                          opportunity={post}
                          showManagementControls={false}
                          onPress={(opp) => navigation.navigate('OpportunityView', { opportunityId: opp.id, opportunity: opp })}
                          onLike={(postId, isLiked, count) =>
                            setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_liked: isLiked, like_count: count } : p))
                          }
                          onComment={(postId) => openCommentsModal(postId, "opportunity")}
                          onSave={(postId, isSaved) =>
                            setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_saved: isSaved } : p))
                          }
                          onShare={() => {}}
                        />
                      </View>
                    );
                  }
                  return (
                    <View
                      key={post.id}
                      onLayout={(e) => {
                        if (String(post.id) === String(scrollToPostIdRef.current)) {
                          scrollToPostIdRef.current = null;
                          const itemY = e.nativeEvent.layout.y;
                          const targetY = tabContentYRef.current + itemY;
                          setTimeout(() => {
                            scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY - 60), animated: true });
                          }, 100);
                        }
                      }}
                      style={{ marginBottom: 4 }}
                    >
                      <EditorialPostCard
                        post={post}
                        onLike={(postId, isLiked, count) =>
                          setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_liked: isLiked, like_count: count } : p))
                        }
                        onComment={(postId) => openCommentsModal(postId)}
                        onShare={() => {}}
                        onFollow={() => {}}
                        showFollowButton={false}
                        currentUserId={null}
                        currentUserType="member"
                        onUserPress={() => {}}
                        showManagementControls={false}
                        onPostUpdate={(updatedPost) =>
                          setPosts((prev) => prev.map((p) => p.id === updatedPost.id ? updatedPost : p))
                        }
                      />
                    </View>
                  );
                })
              }

              {/* Voice posts from community members */}
              {loadingVoicePosts ? (
                <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                  <SnooLoader size="small" color={COLORS.primary} />
                </View>
              ) : (
                voicePosts.map((vp) => (
                  <View
                    key={vp.id}
                    onLayout={(e) => {
                      if (String(vp.id) === String(scrollToPostIdRef.current)) {
                        scrollToPostIdRef.current = null;
                        const itemY = e.nativeEvent.layout.y;
                        const targetY = tabContentYRef.current + itemY;
                        setTimeout(() => {
                          scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY - 60), animated: true });
                        }, 100);
                      }
                    }}
                  >
                    <VoicePostCard
                      post={vp}
                      onComment={(postId) => openCommentsModal(postId)}
                    />
                  </View>
                ))
              )}

              {posts.filter((p) => ['poll', 'prompt', 'qna', 'challenge', 'opportunity'].includes(p.post_type || p.type)).length === 0 &&
               voicePosts.length === 0 && !loadingVoicePosts && (
                <EmptyCommunityState
                  isOwnProfile={false}
                  onCreatePost={() => {}}
                />
              )}
            </View>
          )}

          {/* Events Tab Content */}
          {activeProfileTab === 'events' && (
            <View style={pubTabStyles.eventsContainer}>
              {loadingEvents ? (
                <View style={pubTabStyles.loadingWrap}>
                  <SnooLoader size="large" color={PRIMARY_COLOR} />
                </View>
              ) : (
                <>
                  {/* Attended Events */}
                  {profileEvents.length > 0 && (
                    <>
                      {profileEvents.map((ev) => (
                        <EventCard
                          key={`ev-${ev.id}`}
                          event={ev}
                          onPress={(eventData) => navigation.navigate('EventDetails', { eventId: eventData.id, eventData })}
                          onComment={(id) => openCommentsModal(id, "event")}
                        />
                      ))}
                    </>
                  )}

                  {/* Open Plans — full OpenPlanCard */}
                  {(profilePlans.hosted.length > 0 || profilePlans.attending.length > 0) && (
                    <>
                      {[...profilePlans.hosted, ...profilePlans.attending].map((plan) => (
                        <View key={`plan-${plan.id}-${plan.role ?? 'member'}`} style={{ paddingHorizontal: 16 }}>
                          <OpenPlanCard
                            plan={plan}
                            currentUserId={null}
                            onPress={(id) => navigation.navigate('PlanDetail', { planId: id })}
                            onRequestPress={(id) => setPlanRequestSheet({ planId: id, planTitle: plan.title })}
                            onLike={async (planId, liked) => {
                              const token = await getAuthToken();
                              if (liked) await likePlan(planId, token);
                              else await unlikePlan(planId, token);
                            }}
                            onComment={(id) => openCommentsModal(id, "plan")}
                            navigation={navigation}
                          />
                        </View>
                      ))}
                    </>
                  )}

                  {/* Empty state */}
                  {profileEvents.length === 0 && profilePlans.hosted.length === 0 && profilePlans.attending.length === 0 && (
                    <EmptyEventsState
                      isOwnProfile={false}
                      title="No events yet"
                      subtitle="Events and plans this member attends will show here."
                    />
                  )}
                </>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {planRequestSheet && (
        <RequestBottomSheet
          isVisible={!!planRequestSheet}
          planId={planRequestSheet.planId}
          planTitle={planRequestSheet.planTitle}
          onClose={() => setPlanRequestSheet(null)}
          onRequested={() => setPlanRequestSheet(null)}
        />
      )}


      {selectedPost && (
        <ProfilePostFeed
          visible={postModalVisible}
          posts={posts}
          initialPostId={selectedPost?.id}
          onClose={closePostModal}
          currentUserId={profile?.id}
          currentUserType="member"
          navigation={navigation}
          onLikeUpdate={(postId, isLiked, count) => {
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
          onComment={openCommentsModal}
          onShare={(postId) => {}}
          onSave={(postId, isSaved) => {}}
          onFollow={() => {}}
          onUserPress={(userId, userType) => {
            if (userType === "community") {
              navigation.navigate("CommunityPublicProfile", {
                communityId: userId,
              });
            } else {
              navigation.navigate("MemberPublicProfile", { memberId: userId });
            }
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
        />
      )}

      {/* College Hub Sheet */}
      <CollegeHubSheet
        visible={showCollegeHub}
        collegeId={profile?.college_info?.college_id}
        onClose={() => setShowCollegeHub(false)}
        currentUserId={null}
        onMemberPress={(mId) => {
          setShowCollegeHub(false);
          navigation.push('MemberPublicProfile', { memberId: mId });
        }}
        onCommunityPress={(communityId) => {
          setShowCollegeHub(false);
          navigation.push('CommunityPublicProfile', { communityId });
        }}
      />

      {commentsModalState.visible && (
        <CommentsModal
          visible={commentsModalState.visible}
          postId={commentsModalState.postId}
          baseRoute={
            commentsModalState.postType === "opportunity"
              ? "/opportunities"
              : commentsModalState.postType === "event"
              ? "/events"
              : commentsModalState.postType === "plan"
              ? "/plans"
              : "/posts"
          }
          replyBaseRoute={
            commentsModalState.postType === "opportunity"
              ? "/opportunity-comments"
              : commentsModalState.postType === "event"
              ? "/event-comments"
              : "/comments"
          }
          onClose={closeCommentsModal}
          onCommentCountChange={(newCount) => {
            if (commentsModalState.postId) {
              if (commentsModalState.postType === "event") {
                setProfileEvents((prevEvents) =>
                  prevEvents.map((e) =>
                    e.id === commentsModalState.postId
                      ? { ...e, comment_count: newCount }
                      : e,
                  ),
                );
              } else if (commentsModalState.postType === "plan") {
                setProfilePlans((prev) => ({
                  ...prev,
                  hosted: prev.hosted.map((p) =>
                    p.id === commentsModalState.postId
                      ? { ...p, comment_count: newCount }
                      : p,
                  ),
                  attending: prev.attending.map((p) =>
                    p.id === commentsModalState.postId
                      ? { ...p, comment_count: newCount }
                      : p,
                  ),
                }));
              } else {
                setPosts((prevPosts) =>
                  prevPosts.map((p) =>
                    p.id === commentsModalState.postId
                      ? { ...p, comment_count: newCount }
                      : p,
                  ),
                );
              }
            }
          }}
          navigation={navigation}
        />
      )}

      <CustomAlertModal onClose={hideAlert} {...alertConfig} />
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ─── Public profile tab bar & events feed styles ────────────────────────────
const pubTabStyles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    marginTop: 20,
    marginHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: COLORS.background,
    position: 'relative',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 1,
  },
  tabText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  eventsContainer: {
    alignSelf: 'stretch',
    marginHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 16,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  sectionHeader: {
    fontFamily: FONTS.primary,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginTop: 16,
    marginBottom: 10,
    letterSpacing: 0.1,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface || '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  eventThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: '#EEF2FF',
  },
  eventThumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventRowInfo: { flex: 1, gap: 3 },
  eventRowTitle: { fontFamily: FONTS.semiBold, fontSize: 14, color: COLORS.textPrimary },
  eventRowMeta: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.textSecondary },
  eventRowSub: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  planRow: {
    backgroundColor: COLORS.surface || '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  planLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    marginHorizontal: 20,
    paddingHorizontal: 4,
  },
  planLabelText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  planIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  planLeft: { flex: 1, gap: 4 },
  planPillRow: { flexDirection: 'row', gap: 6, marginBottom: 2 },
  planPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  planPillText: { fontFamily: FONTS.medium, fontSize: 11 },
  planTitle: { fontFamily: FONTS.semiBold, fontSize: 15, color: COLORS.textPrimary },
  planMeta: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  emptyWrap: { paddingVertical: 48, alignItems: 'center', gap: 10 },
  emptyText: { fontFamily: FONTS.semiBold, fontSize: 16, color: COLORS.textPrimary },
  emptySubText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 10,
  },
  headerUsername: {
    flex: 1,
    fontFamily: FONTS.primary,
    fontSize: 18,
    color: "#3B82F6",
    fontWeight: "600",
    marginLeft: 8,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignSelf: "flex-start",
  },
  profileSection: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  profileImageContainer: {
    marginBottom: 20,
    ...SHADOWS.medium,
  },
  profileImage: {
    width: 125,
    height: 125,
    borderRadius: 60,
    backgroundColor: "#F2F2F7",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  profileName: {
    fontFamily: FONTS.primary,
    fontSize: 24,
    color: "#0F172A",
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
  pronounChipSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "#F2F2F7",
  },
  bioLeft: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: "#1f2937",
    marginBottom: 20,
    textAlign: "left",
    alignSelf: "flex-start",
    width: "100%",
    lineHeight: 22,
  },
  metaChipsSection: {
    width: "100%",
    marginBottom: 16,
    alignItems: "center",
  },
  chipGridRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: "#F2F2F7",
  },
  chipGridItem: {
    alignItems: "center",
  },
  chipText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: "#374151",
  },
  chipBlue: {
    backgroundColor: "#E1F0FF",
  },
  chipTextBlue: {
    color: "#007AFF",
    fontWeight: "600",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    width: "100%",
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
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
});

const trustStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pillText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});

const menuStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  iconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(229,57,53,0.08)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  rowText: { flex: 1 },
  rowLabel: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 16,
    color: '#E53935',
  },
  rowSub: {
    fontFamily: 'Manrope-Regular',
    fontSize: 12,
    color: '#8FA1B8',
    marginTop: 2,
  },
});

const blockBannerStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF1F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE4E6',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  text: {
    fontFamily: 'Manrope-Medium',
    fontSize: 13,
    color: '#BE123C',
    flexShrink: 1,
  },
  btn: {
    backgroundColor: '#E11D48',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginLeft: 12,
  },
  btnText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
  },
});

const circleCTAStyles = StyleSheet.create({
  // "In Circle" — outlined blue, tap to remove
  inCircleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(41, 98, 255, 0.35)',
    backgroundColor: 'rgba(41, 98, 255, 0.08)',
    paddingVertical: 12,
  },
  inCircleText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 15,
    color: '#2962FF',
  },
  // "Requested" — amber tint, tap to cancel
  requestedBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 149, 0, 0.3)',
    backgroundColor: 'rgba(255, 149, 0, 0.08)',
    paddingVertical: 12,
  },
  requestedText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 15,
    color: '#FF9500',
  },
  // Pending incoming — row with two buttons side by side
  incomingRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#2962FF',
    paddingVertical: 12,
  },
  acceptText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 15,
    color: '#fff',
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#F2F2F7',
    paddingVertical: 12,
  },
  declineText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 15,
    color: '#3C3C43',
  },
});

