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
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Image as ExpoImage } from "expo-image";
import { ArrowLeft, Play, Pin, BadgeCheck, Calendar, Users, Clock, MoreVertical, UserX, AlertTriangle, CheckCircle } from "lucide-react-native";
import CustomAlertModal from "../../../components/ui/CustomAlertModal";
import {
  getPublicMemberProfile,
  getMemberPosts,
  followMember,
  unfollowMember,
} from "../../../api/members";
import { SafeAreaView } from "react-native-safe-area-context";
import EventBus from "../../../utils/EventBus";
import { getAuthToken, getAuthEmail } from "../../../api/auth";
import { blockUser } from "../../../api/plans";
import { apiPost, apiDelete } from "../../../api/client";
import CommentsModal from "../../../components/CommentsModal";
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
  const [blocked, setBlocked] = useState(false); // true when a block exists between viewer and this profile
  const pendingPostUpdateRef = useRef(null);

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
    } catch (e) {
      // 403 user_unavailable = block exists in either direction
      if (e?.status === 403 && e?.data?.error === 'user_unavailable') {
        setBlocked(true);
      } else {
        setError(e?.message || "Failed to load profile");
      }
    }
  }, [memberId]);

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
            <TouchableOpacity
              style={menuStyles.row}
              onPress={handleBlockUser}
              activeOpacity={0.7}
              disabled={blocking}
            >
              <View style={menuStyles.iconBox}>
                <UserX size={20} color="#E53935" strokeWidth={2.5} />
              </View>
              <View style={menuStyles.rowText}>
                <Text style={menuStyles.rowLabel}>Block User</Text>
                <Text style={menuStyles.rowSub}>They won't be able to message or find you</Text>
              </View>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

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
        <>
          <FlatList
            data={posts}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderGridItem}
            numColumns={3}
            columnWrapperStyle={{
              justifyContent: "flex-start",
              marginBottom: GAP,
              gap: GAP,
            }}
            contentContainerStyle={{
              paddingHorizontal: 0,
              paddingTop: 0,
              paddingBottom: 120,
              flexGrow: posts.length === 0 ? 1 : 0,
            }}
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
            onEndReachedThreshold={0.5}
            onEndReached={() => loadPosts(false)}
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

                  // Trust signal helpers
                  const memberSince = profile?.created_at
                    ? (() => {
                        const d = new Date(profile.created_at);
                        const now = new Date();
                        const diffDays = Math.floor((now - d) / 86400000);
                        if (diffDays > 60) {
                          return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                        }
                        if (diffDays > 7) return `${Math.floor(diffDays / 7)}w ago`;
                        return `${diffDays}d ago`;
                      })()
                    : null;

                  const trustSignals = [
                    profile?.events_attended_count > 0 && { icon: Calendar, label: `${profile.events_attended_count} events` },
                    profile?.communities_count > 0 && { icon: Users, label: `${profile.communities_count} communities` },
                    memberSince && { icon: Clock, label: `Member ${memberSince}` },
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
                                  String(p).replace(/^[{\"]+|[}\"]+$/g, ""),
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
                        // Optimistic update
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
                          // Revert
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
                        // Optimistic update
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
                          // Revert
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
                      // Climb to the root navigator (AppNavigator) regardless of
                      // how many stacks deep this profile was opened from.
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
              </View>
            }
            ListEmptyComponent={
              !loading && (
                <EmptyPostsState isOwnProfile={false} />
              )
            }
            ListFooterComponent={
              loadingMore ? (
                <SnooLoader style={{ marginVertical: 12 }} />
              ) : null
            }
          />
        </>
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
