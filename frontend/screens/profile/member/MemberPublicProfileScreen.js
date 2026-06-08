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
  View, Text, Image, StyleSheet, TouchableOpacity, FlatList, Dimensions, Modal, ScrollView, Platform, Pressable } from "react-native";
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Image as ExpoImage } from "expo-image";
import { ArrowLeft, Play, Pin, BadgeCheck, Ticket, Users, MoreVertical, UserX, AlertTriangle, CheckCircle, ShieldOff, CalendarDays } from "lucide-react-native";
import CustomAlertModal from "../../../components/ui/CustomAlertModal";
import {
  getPublicMemberProfile,
  getMemberPosts,
  followMember,
  unfollowMember,
  getMemberPublicEvents,
  getMemberPublicPlans,
} from "../../../api/members";
import { SafeAreaView } from "react-native-safe-area-context";
import EventBus from "../../../utils/EventBus";
import { getAuthToken, getAuthEmail } from "../../../api/auth";
import { blockUser, unblockUser } from "../../../api/plans";
import { apiPost, apiDelete } from "../../../api/client";
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
import CollegeChip from "../../../components/CollegeChip";

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
import EmptyPostsState from "../../../components/EmptyPostsState";

export default function MemberPublicProfileScreen({ route, navigation }) {
  const memberId = route?.params?.memberId;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [posts, setPosts] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showAllInterests, setShowAllInterests] = useState(false);
  const [showAllPronouns, setShowAllPronouns] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [showCollegeHub, setShowCollegeHub] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [unblocking, setUnblocking] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [youHaveBlocked, setYouHaveBlocked] = useState(false);
  const pendingPostUpdateRef = useRef(null);

  // Events tab state
  const [activeProfileTab, setActiveProfileTab] = useState('posts');
  const [profileEvents, setProfileEvents] = useState([]);
  const [profilePlans, setProfilePlans] = useState({ hosted: [], attending: [] });
  const [loadingEvents, setLoadingEvents] = useState(false);
  const eventsFetchedRef = useRef(false);

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
      setIsFollowing(!!p?.is_following);
      setYouHaveBlocked(!!p?.you_have_blocked);
    } catch (e) {
      if (e?.status === 403 && e?.data?.error === 'user_unavailable') {
        setBlocked(true);
      } else {
        setError(e?.message || "Failed to load profile");
      }
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

  // Refresh profile when screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await Promise.all([loadProfile(), loadPosts(true)]);
      if (mounted) setLoading(false);
    })();
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        {profile?.username && (
          <Text style={styles.headerUsername}>@{profile.username}</Text>
        )}
        {/* 3-dot menu — only for other users, not self */}
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => setMenuVisible(true)}
          hitSlop={12}
        >
          <MoreVertical size={22} color={COLORS.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Block / Options Bottom Sheet */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={menuStyles.overlay} onPress={() => setMenuVisible(false)}>
          <Pressable style={menuStyles.sheet} onPress={(e) => e.stopPropagation()}>
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
          <Text style={{ fontFamily: FONTS.bold, fontSize: 18, color: COLORS.textPrimary, marginBottom: 8, textAlign: 'center' }}>Profile Unavailable</Text>
          <Text style={{ fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 }}>
            This profile isn't available.
          </Text>
        </View>
      ) : error ? (
        <View style={{ padding: 16 }}>
          <Text style={{ color: "#FF3B30" }}>{error}</Text>
        </View>
      ) : (
          <FlatList
            key={activeProfileTab === 'posts' ? 'posts-3col' : 'events-1col'}
            data={activeProfileTab === 'posts' ? posts : []}
            keyExtractor={(item) => String(item.id)}
            renderItem={activeProfileTab === 'posts' ? renderGridItem : null}
            numColumns={activeProfileTab === 'posts' ? 3 : 1}
            columnWrapperStyle={
              activeProfileTab === 'posts'
                ? { justifyContent: "flex-start", marginBottom: GAP, gap: GAP }
                : undefined
            }
            contentContainerStyle={{
              paddingHorizontal: 0,
              paddingTop: 0,
              paddingBottom: 120,
              flexGrow: 1,
            }}
            initialNumToRender={12}
            maxToRenderPerBatch={6}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            updateCellsBatchingPeriod={50}
            getItemLayout={activeProfileTab === 'posts' ? (data, index) => ({
              length: ITEM_SIZE * 1.35,
              offset: (ITEM_SIZE * 1.35 + GAP) * Math.floor(index / 3),
              index,
            }) : undefined}
            onEndReachedThreshold={0.5}
            onEndReached={() => activeProfileTab === 'posts' && loadPosts(false)}
            ListHeaderComponent={
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
                    profile?.events_attended_count > 0 && { icon: Ticket, label: `${profile.events_attended_count} events` },
                    profile?.communities_count > 0 && { icon: Users, label: `${profile.communities_count} communities` },
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

                {/* College chip — only shown when show_college is enabled */}
                {profile?.college_info && profile?.show_college !== false ? (
                  <View style={{ marginTop: 10, marginBottom: 16, alignItems: 'center' }}>
                    <CollegeChip
                      collegeInfo={profile.college_info}
                      onPress={() => setShowCollegeHub(true)}
                    />
                  </View>
                ) : null}

                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>
                      {profile?.posts_count || 0}
                    </Text>
                    <Text style={styles.statLabel}>Posts</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.statItem}
                    onPress={() => {
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
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.statItem}
                    onPress={() => {
                      navigation.navigate("UniversalFollowersList", {
                        userId: memberId,
                        userType: "member",
                        title: "Followers",
                      });
                    }}
                  >
                    <Text style={styles.statNumber}>
                      {profile?.followers_count || 0}
                    </Text>
                    <Text style={styles.statLabel}>Followers</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.statItem}
                    onPress={() => {
                      navigation.navigate("UniversalFollowingList", {
                        userId: memberId,
                        userType: "member",
                        title: "Following",
                      });
                    }}
                  >
                    <Text style={styles.statNumber}>
                      {profile?.following_count || 0}
                    </Text>
                    <Text style={styles.statLabel}>Following</Text>
                  </TouchableOpacity>
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
                        <TouchableOpacity
                          onPress={() => setShowAllInterests(true)}
                          style={[
                            styles.chip,
                            styles.chipBlue,
                            styles.chipGridItem,
                          ]}
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
                            {
                              backgroundColor: "#FF3B30",
                              borderColor: "#FF3B30",
                            },
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

                <View
                  style={{
                    marginTop: 12,
                    flexDirection: "row",
                    gap: 10,
                    width: "100%",
                  }}
                >
                  {isFollowing ? (
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: "rgba(68, 138, 255, 0.2)",
                        backgroundColor: "rgba(68, 138, 255, 0.12)",
                        justifyContent: "center",
                        alignItems: "center",
                        paddingVertical: 12,
                      }}
                      onPress={async () => {
                        const next = false;
                        setIsFollowing(next);
                        HapticsService.triggerImpactLight();
                        setProfile((prev) =>
                          prev
                            ? {
                                ...prev,
                                followers_count: Math.max(
                                  0,
                                  (prev.followers_count || 0) - 1,
                                ),
                              }
                            : prev,
                        );
                        EventBus.emit("follow-updated", {
                          memberId,
                          isFollowing: next,
                        });
                        try {
                          await unfollowMember(memberId);
                        } catch (e) {
                          setIsFollowing(true);
                          setProfile((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  followers_count: (prev.followers_count || 0) + 1,
                                }
                              : prev,
                          );
                        }
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: FONTS.medium,
                          color: "#2962FF",
                          fontSize: 16,
                          fontWeight: "600",
                        }}
                      >
                        Following
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <GradientButton
                      title="Follow"
                      colors={["#448AFF", "#2962FF"]}
                      textStyle={{ fontFamily: FONTS.semiBold, color: "#FFFFFF" }}
                      style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}
                      gradientStyle={{ borderRadius: 16 }}
                      onPress={async () => {
                        const next = true;
                        setIsFollowing(next);
                        HapticsService.triggerImpactLight();
                        setProfile((prev) =>
                          prev
                            ? {
                                ...prev,
                                followers_count: (prev.followers_count || 0) + 1,
                              }
                            : prev,
                        );
                        EventBus.emit("follow-updated", {
                          memberId,
                          isFollowing: next,
                        });
                        try {
                          await followMember(memberId);
                        } catch (e) {
                          setIsFollowing(false);
                          setProfile((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  followers_count: Math.max(
                                    0,
                                    (prev.followers_count || 0) - 1,
                                  ),
                                }
                              : prev,
                          );
                        }
                      }}
                    />
                  )}
                  <GradientButton
                    title="Message"
                    style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}
                    gradientStyle={{ borderRadius: 16 }}
                    colors={["#111827", "#111827"]}
                    textStyle={{ fontFamily: FONTS.semiBold, color: "#FFFFFF" }}
                    onPress={() => {
                      let rootNav = navigation;
                      while (rootNav.getParent && rootNav.getParent()) {
                        rootNav = rootNav.getParent();
                      }
                      rootNav.dispatch(
                        CommonActions.navigate("MemberHome", {
                          screen: "Home",
                          params: {
                            screen: "Chat",
                            params: { recipientId: memberId, recipientType: "member" },
                          },
                        })
                      );
                    }}
                  />
                </View>

                {/* Posts / Events Tab Bar */}
                <View style={pubTabStyles.tabBar}>
                  {['posts', 'events'].map((tab) => (
                    <TouchableOpacity
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
                      }}
                    >
                      <Text style={[
                        pubTabStyles.tabText,
                        activeProfileTab === tab && pubTabStyles.tabTextActive,
                      ]}>
                        {tab === 'posts' ? 'Posts' : 'Events'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <Reanimated.View
                    style={[
                      pubTabStyles.activeTabIndicator,
                      animatedUnderlineStyle,
                    ]}
                  />
                </View>

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
                            <Text style={pubTabStyles.sectionHeader}>Events Attended</Text>
                            {profileEvents.map((ev) => (
                              <EventCard
                                key={`ev-${ev.id}`}
                                event={ev}
                                onPress={(eventData) => navigation.navigate('EventDetails', { eventId: eventData.id, eventData })}
                              />
                            ))}
                          </>
                        )}

                        {/* Open Plans */}
                        {(profilePlans.hosted.length > 0 || profilePlans.attending.length > 0) && (
                          <>
                            <Text style={pubTabStyles.sectionHeader}>Open Plans</Text>
                            {[...profilePlans.hosted, ...profilePlans.attending].map((plan) => {
                              const d = plan.scheduled_at ? new Date(plan.scheduled_at) : null;
                              const dateStr = d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
                              const actColors = { sports: '#EEF2FF', study: '#E8F5E9', food: '#FFF8E1', gaming: '#FCE4EC', other: '#F5F5F5' };
                              const actTextColors = { sports: '#3B5BDB', study: '#2E7D32', food: '#B45309', gaming: '#C2185B', other: '#555555' };
                              const actKey = actColors[plan.activity_type] ? plan.activity_type : 'other';
                              const actLabel = plan.activity_type === 'other' ? (plan.custom_activity_label || 'Other') : plan.activity_type.charAt(0).toUpperCase() + plan.activity_type.slice(1);
                              const isHost = plan.role === 'host';
                              return (
                                <View
                                  key={`plan-${plan.id}-${plan.role}`}
                                  style={pubTabStyles.planRow}
                                >
                                  {/* Icon avatar */}
                                  <View style={[pubTabStyles.planIconWrap, { backgroundColor: actColors[actKey] }]}>
                                    <CalendarDays size={18} color={actTextColors[actKey]} strokeWidth={2} />
                                  </View>
                                  <View style={pubTabStyles.planLeft}>
                                    <View style={pubTabStyles.planPillRow}>
                                      <View style={[pubTabStyles.planPill, { backgroundColor: isHost ? '#EEF2FF' : '#E8F5E9' }]}>
                                        <Text style={[pubTabStyles.planPillText, { color: isHost ? '#3B5BDB' : '#2E7D32' }]}>{isHost ? 'Hosting' : 'Attending'}</Text>
                                      </View>
                                      <View style={[pubTabStyles.planPill, { backgroundColor: actColors[actKey] + '99' }]}>
                                        <Text style={[pubTabStyles.planPillText, { color: actTextColors[actKey] }]}>{actLabel}</Text>
                                      </View>
                                    </View>
                                    <Text style={pubTabStyles.planTitle} numberOfLines={1}>{plan.title}</Text>
                                    <Text style={pubTabStyles.planMeta}>
                                      {dateStr}{plan.location_public ? ` · ${plan.location_public}` : ''}
                                    </Text>
                                  </View>
                                </View>
                              );
                            })}
                          </>
                        )}

                        {/* Empty state */}
                        {profileEvents.length === 0 && profilePlans.hosted.length === 0 && profilePlans.attending.length === 0 && (
                          <View style={pubTabStyles.emptyWrap}>
                            <Ticket size={36} color={COLORS.textSecondary} strokeWidth={1.5} />
                            <Text style={pubTabStyles.emptyText}>No events yet</Text>
                            <Text style={pubTabStyles.emptySubText}>Events and plans this member attends will show here.</Text>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                )}
              </View>
            }
            ListEmptyComponent={
              !loading && activeProfileTab === 'posts' && (
                <EmptyPostsState isOwnProfile={false} />
              )
            }
            ListFooterComponent={
              loadingMore && activeProfileTab === 'posts' ? (
                <SnooLoader style={{ marginVertical: 12 }} />
              ) : null
            }
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
          onComment={(postId) => {}}
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

      <CustomAlertModal onClose={hideAlert} {...alertConfig} />
    </SafeAreaView>
  );
}

// ─── Public profile tab bar & events feed styles ────────────────────────────
const pubTabStyles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    marginTop: 20,
    marginHorizontal: -20,
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
    marginHorizontal: -20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  sectionHeader: {
    fontFamily: FONTS.bold || FONTS.semiBold,
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
