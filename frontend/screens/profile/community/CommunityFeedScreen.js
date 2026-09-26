import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar,
  Modal,
  Pressable,
  FlatList,
  RefreshControl,
  PanResponder,
  Animated as RNAnimated,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  Search,
  X,
  ChevronDown,
  Check,
  RotateCcw,
  Sparkles,
  MessageSquare,
  HelpCircle,
  Vote,
  Trophy,
  Briefcase,
  Layers,
  Clock,
  ArrowUpDown,
  Flame,
} from "lucide-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
  interpolate,
  Extrapolate,
  runOnJS,
} from "react-native-reanimated";

import { COLORS, FONTS, SPACING } from "../../../constants/theme";
import HapticsService from "../../../services/HapticsService";
import VerifiedBadge from "../../../components/badges/VerifiedBadge";
import CommunityVoiceBox, { VoicePostCard } from "../../../components/feed/CommunityVoiceBox";
import EditorialPostCard from "../../../components/cards/EditorialPostCard";
import OpportunityFeedCard from "../../../components/cards/OpportunityFeedCard";
import PollPostCard from "../../../components/posts/PollPostCard";
import QnAPostCard from "../../../components/posts/QnAPostCard";
import PromptPostCard from "../../../components/posts/PromptPostCard";
import CommunityVoteBar from "../../../components/posts/CommunityVoteBar";
import SnooLoader from "../../../components/ui/SnooLoader";
import EventBus from "../../../utils/EventBus";
import { apiGet, getAuthToken } from "../../../api/client";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PRIMARY_COLOR = COLORS.primary;

// Fallback premium bluish-silver slate gradient (light theme)
const FALLBACK_GRADIENT = ["#D9E2EC", "#E8EFF6", "#F4F7FB"];

export default function CommunityFeedScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const {
    profile: initialProfile,
    communityId,
    targetType = "community",
    isOwnProfile = false,
    initialPosts = [],
    initialVoicePosts = [],
  } = route.params || {};

  const [profile, setProfile] = useState(initialProfile || null);
  const [posts, setPosts] = useState(initialPosts || []);
  const [voicePosts, setVoicePosts] = useState(initialVoicePosts || []);
  const [loading, setLoading] = useState(!initialPosts.length && !initialVoicePosts.length);
  const [refreshing, setRefreshing] = useState(false);

  // Search State
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);

  // Filter States
  const [authorFilter, setAuthorFilter] = useState("all"); // 'all' | 'owner' | 'members' | 'promotions'
  const [typeFilter, setTypeFilter] = useState("all"); // 'all' | 'voice' | 'poll' | 'qna' | 'prompt' | 'challenge' | 'opportunity'
  const [sortFilter, setSortFilter] = useState("newest"); // 'newest' | 'oldest' | 'top' | 'discussed'

  // Dropdown Picker Modal
  const [activeDropdown, setActiveDropdown] = useState(null); // 'author' | 'type' | 'sort' | null

  // Member stats (real counts from /profile/counts)
  const initialTotal = useMemo(() => {
    return (
      (profile?.followers_count ?? profile?.follower_count ?? 0) +
      (profile?.circle_count ?? 0)
    );
  }, [profile]);

  const [memberStats, setMemberStats] = useState({
    total: initialTotal,
    activeNow: 0,
  });

  // ── SHARED ELEMENT MORPH (FLIP Technique) ──
  // Matches exact physics from MotionCraft prototype:
  // Card geometry expands to full viewport: cubic-bezier(0.16, 1, 0.3, 1) over 480ms
  const sourceRect = route.params?.sourceRect;
  const defaultStartWidth = 120;
  const defaultStartHeight = 44;
  const defaultStartTop = 275;
  const defaultStartLeft = (SCREEN_WIDTH - defaultStartWidth) / 2;

  const startX = sourceRect?.x ?? defaultStartLeft;
  const startY = sourceRect?.y ?? defaultStartTop;
  const startW = sourceRect?.width ?? defaultStartWidth;
  const startH = sourceRect?.height ?? defaultStartHeight;

  const sourceCenterX = startX + startW / 2;
  const sourceCenterY = startY + startH / 2;
  const screenCenterX = SCREEN_WIDTH / 2;
  const screenCenterY = SCREEN_HEIGHT / 2;

  const deltaX = sourceCenterX - screenCenterX;
  const deltaY = sourceCenterY - screenCenterY;

  const initialScaleX = Math.max(0.18, startW / SCREEN_WIDTH);
  const initialScaleY = Math.max(0.045, startH / SCREEN_HEIGHT);

  const morphProgress = useSharedValue(0);
  const contentStagger = useSharedValue(0);
  const dragTranslateY = useSharedValue(0);
  const isClosingRef = useRef(false);

  useEffect(() => {
    HapticsService.triggerImpactLight();

    // 01: Shared FLIP Morph — Duration: 480ms, Easing: cubic-bezier(0.16, 1, 0.3, 1)
    morphProgress.value = withTiming(1, {
      duration: 480,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });

    // Stagger in children (Header elements, filter chips, feed items)
    contentStagger.value = withDelay(
      120,
      withTiming(1, {
        duration: 360,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      })
    );
  }, []);

  const handleBack = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    HapticsService.triggerImpactLight();

    // Staggered children fade out
    contentStagger.value = withTiming(0, {
      duration: 150,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
    });

    // Morph collapses back to source anchor with cubic-bezier(0.32, 0.72, 0, 1) over 380ms
    morphProgress.value = withTiming(
      0,
      {
        duration: 380,
        easing: Easing.bezier(0.32, 0.72, 0, 1),
      },
      (finished) => {
        if (finished) {
          runOnJS(navigation.goBack)();
        }
      }
    );
  }, [navigation, morphProgress, contentStagger]);

  // Pull-to-dismiss PanResponder
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return gestureState.dy > 8 && Math.abs(gestureState.dx) < 24;
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            dragTranslateY.value = gestureState.dy;
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 80 || gestureState.vy > 0.8) {
            handleBack();
          } else {
            dragTranslateY.value = withSpring(0, { damping: 18, stiffness: 220 });
          }
        },
        onPanResponderTerminate: () => {
          dragTranslateY.value = withSpring(0, { damping: 18, stiffness: 220 });
        },
      }),
    [handleBack, dragTranslateY]
  );

  const morphContainerStyle = useAnimatedStyle(() => {
    const p = morphProgress.value;

    const scaleX = interpolate(p, [0, 1], [initialScaleX, 1], Extrapolate.CLAMP);
    const scaleY = interpolate(p, [0, 1], [initialScaleY, 1], Extrapolate.CLAMP);
    const translateX = interpolate(p, [0, 1], [deltaX, 0], Extrapolate.CLAMP);
    const translateY =
      interpolate(p, [0, 1], [deltaY, 0], Extrapolate.CLAMP) + dragTranslateY.value;

    const borderRadius = interpolate(p, [0, 0.75, 1], [24, 14, 0], Extrapolate.CLAMP);
    const opacity = interpolate(p, [0, 0.08, 1], [0.65, 0.95, 1], Extrapolate.CLAMP);

    return {
      transform: [
        { translateX },
        { translateY },
        { scaleX },
        { scaleY },
      ],
      borderRadius,
      opacity,
      overflow: "hidden",
    };
  });

  const staggeredContentStyle = useAnimatedStyle(() => {
    const s = contentStagger.value;
    return {
      flex: 1,
      opacity: s,
      transform: [
        {
          translateY: interpolate(s, [0, 1], [20, 0], Extrapolate.CLAMP),
        },
      ],
    };
  });

  // Fetch Community Posts, Voice Posts, and Real Member/Active Counts
  const loadCommunityData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const token = await getAuthToken();
      const targetId = profile?.id || communityId;

      if (!targetId) return;

      const [voiceRes, postsRes, countsRes] = await Promise.allSettled([
        apiGet(
          `/community-voice-posts?target_id=${targetId}&target_type=${targetType}&limit=40`,
          15000,
          token
        ),
        apiGet(
          `/posts/user/${targetId}/${targetType}?limit=40`,
          15000,
          token
        ),
        apiGet(
          `/profile/counts/${targetId}/${targetType}`,
          10000,
          token
        ),
      ]);

      if (voiceRes.status === "fulfilled" && voiceRes.value?.posts) {
        setVoicePosts(voiceRes.value.posts);
      }

      if (postsRes.status === "fulfilled" && postsRes.value?.posts) {
        setPosts(postsRes.value.posts);
      }

      if (countsRes.status === "fulfilled" && countsRes.value) {
        const c = countsRes.value;
        const total =
          targetType === "community"
            ? (c.followers_count || 0) + (c.circle_count || 0)
            : (c.creator_follower_count || c.followers_count || 0);
        const active = typeof c.active_now_count === "number" ? c.active_now_count : 0;
        setMemberStats({
          total: Math.max(total, 0),
          activeNow: Math.min(active, Math.max(total, 0)),
        });
      }
    } catch (e) {
      console.warn("[CommunityFeedScreen] Failed to load community data:", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id, communityId, targetType]);

  useEffect(() => {
    loadCommunityData();
  }, [loadCommunityData]);

  // Sync post interactions via EventBus
  useEffect(() => {
    const handleLikeUpdate = (payload) => {
      if (!payload?.postId) return;
      setPosts((prev) =>
        prev.map((p) =>
          p.id === payload.postId
            ? { ...p, is_liked: payload.isLiked, like_count: payload.likeCount }
            : p
        )
      );
      setVoicePosts((prev) =>
        prev.map((p) =>
          p.id === payload.postId
            ? { ...p, is_liked: payload.isLiked, like_count: payload.likeCount }
            : p
        )
      );
    };

    const handleVoteUpdate = (payload) => {
      if (!payload?.postId) return;
      setPosts((prev) =>
        prev.map((p) =>
          p.id === payload.postId
            ? {
                ...p,
                community_vote_score: payload.voteScore,
                viewer_vote: payload.userVote,
              }
            : p
        )
      );
      setVoicePosts((prev) =>
        prev.map((p) =>
          p.id === payload.postId
            ? {
                ...p,
                community_vote_score: payload.voteScore,
                viewer_vote: payload.userVote,
              }
            : p
        )
      );
    };

    const unsubLike = EventBus.on("post-like-updated", handleLikeUpdate);
    const unsubVote = EventBus.on("community-vote-updated", handleVoteUpdate);

    return () => {
      if (unsubLike) unsubLike();
      if (unsubVote) unsubVote();
    };
  }, []);

  // Filter & Search Logic
  const allCombinedItems = useMemo(() => {
    // Interactive posts from posts array
    const interactive = posts
      .filter((p) =>
        ["poll", "prompt", "qna", "challenge", "opportunity"].includes(
          p.post_type || p.type
        )
      )
      .map((p) => ({ ...p, itemType: "interactive" }));

    // Voice posts
    const voice = voicePosts.map((vp) => ({
      ...vp,
      itemType: "voice",
    }));

    return [...interactive, ...voice];
  }, [posts, voicePosts]);

  const filteredAndSortedItems = useMemo(() => {
    let list = [...allCombinedItems];

    // 1. Author Filter
    if (authorFilter === "owner") {
      list = list.filter((item) => {
        const isInteractive = item.itemType === "interactive";
        const isAnon =
          item.type_data?.is_anonymous === true || item.is_anonymous === true;
        return (
          isInteractive ||
          (!isAnon &&
            String(item.author_id) === String(profile?.id) &&
            item.author_type === targetType)
        );
      });
    } else if (authorFilter === "members") {
      list = list.filter((item) => {
        const isInteractive = item.itemType === "interactive";
        const isAnon =
          item.type_data?.is_anonymous === true || item.is_anonymous === true;
        const isOwner =
          isInteractive ||
          (!isAnon &&
            String(item.author_id) === String(profile?.id) &&
            item.author_type === targetType);
        return !isOwner;
      });
    } else if (authorFilter === "promotions") {
      list = list.filter((item) => !!item.type_data?.promo_source_type);
    }

    // 2. Post Type Filter
    if (typeFilter !== "all") {
      list = list.filter((item) => {
        if (typeFilter === "voice") return item.itemType === "voice";
        const pType = item.post_type || item.type;
        return pType === typeFilter;
      });
    }

    // 3. Search Query Filter
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => {
        const caption = (item.caption || item.text || item.content || "").toLowerCase();
        const author = (item.author_name || item.author_username || "").toLowerCase();
        const typeData = item.type_data || {};
        const title = (item.title || typeData.title || typeData.question || typeData.prompt || "").toLowerCase();
        const tags = Array.isArray(item.tags) ? item.tags.join(" ").toLowerCase() : "";

        return (
          caption.includes(q) ||
          author.includes(q) ||
          title.includes(q) ||
          tags.includes(q)
        );
      });
    }

    // 4. Sort Filter
    list.sort((a, b) => {
      // Pinned posts always stay on top if not searching
      if (!searchQuery.trim()) {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
      }

      if (sortFilter === "oldest") {
        return new Date(a.created_at) - new Date(b.created_at);
      }
      if (sortFilter === "top") {
        const scoreA = a.community_vote_score || 0;
        const scoreB = b.community_vote_score || 0;
        return scoreB - scoreA;
      }
      if (sortFilter === "discussed") {
        const commentsA = a.comment_count || 0;
        const commentsB = b.comment_count || 0;
        return commentsB - commentsA;
      }
      // default: newest
      return new Date(b.created_at) - new Date(a.created_at);
    });

    return list;
  }, [allCombinedItems, authorFilter, typeFilter, sortFilter, searchQuery, profile?.id, targetType]);

  // Real member & active now count formatting
  const formattedTotalMembers = useMemo(() => {
    const raw = memberStats.total;
    if (raw >= 1000) return `${(raw / 1000).toFixed(1)}k`;
    return `${raw}`;
  }, [memberStats.total]);

  const memberLabel = memberStats.total === 1 ? "member" : "members";
  const activeNowCount = memberStats.activeNow;

  // Render Post Item
  const renderFeedItem = useCallback(
    ({ item }) => {
      if (item.itemType === "voice") {
        return (
          <View style={styles.postCardWrapper}>
            <VoicePostCard
              post={item}
              onComment={(id) => navigation.navigate("CommentsScreen", { postId: id })}
            />
            {/* Dedicated Upvote & Downvote Row */}
            <View style={styles.voteBarWrapper}>
              <CommunityVoteBar
                postId={item.id}
                initialVoteScore={item.community_vote_score || 0}
                initialUserVote={item.viewer_vote || 0}
              />
            </View>
          </View>
        );
      }

      const pType = item.post_type || item.type;

      if (pType === "opportunity") {
        return (
          <View style={styles.postCardWrapper}>
            <OpportunityFeedCard
              opportunity={item}
              showManagementControls={isOwnProfile}
              onPress={(opp) =>
                navigation.navigate("OpportunityView", {
                  opportunityId: opp.id,
                  opportunity: opp,
                })
              }
            />
            <View style={styles.voteBarWrapper}>
              <CommunityVoteBar
                postId={item.id}
                initialVoteScore={item.community_vote_score || 0}
                initialUserVote={item.viewer_vote || 0}
              />
            </View>
          </View>
        );
      }

      if (pType === "poll") {
        return (
          <View style={styles.postCardWrapper}>
            <PollPostCard post={item} />
            <View style={styles.voteBarWrapper}>
              <CommunityVoteBar
                postId={item.id}
                initialVoteScore={item.community_vote_score || 0}
                initialUserVote={item.viewer_vote || 0}
              />
            </View>
          </View>
        );
      }

      if (pType === "qna") {
        return (
          <View style={styles.postCardWrapper}>
            <QnAPostCard post={item} />
            <View style={styles.voteBarWrapper}>
              <CommunityVoteBar
                postId={item.id}
                initialVoteScore={item.community_vote_score || 0}
                initialUserVote={item.viewer_vote || 0}
              />
            </View>
          </View>
        );
      }

      if (pType === "prompt") {
        return (
          <View style={styles.postCardWrapper}>
            <PromptPostCard post={item} />
            <View style={styles.voteBarWrapper}>
              <CommunityVoteBar
                postId={item.id}
                initialVoteScore={item.community_vote_score || 0}
                initialUserVote={item.viewer_vote || 0}
              />
            </View>
          </View>
        );
      }

      // Default Editorial Card for other interactive / discussion posts
      return (
        <View style={styles.postCardWrapper}>
          <EditorialPostCard post={item} />
          <View style={styles.voteBarWrapper}>
            <CommunityVoteBar
              postId={item.id}
              initialVoteScore={item.community_vote_score || 0}
              initialUserVote={item.viewer_vote || 0}
            />
          </View>
        </View>
      );
    },
    [isOwnProfile, navigation]
  );

  const filterChipsActiveCount =
    (authorFilter !== "all" ? 1 : 0) +
    (typeFilter !== "all" ? 1 : 0) +
    (sortFilter !== "newest" ? 1 : 0);

  const resetFilters = useCallback(() => {
    HapticsService.triggerImpactLight();
    setAuthorFilter("all");
    setTypeFilter("all");
    setSortFilter("newest");
    setSearchQuery("");
  }, []);

  return (
    <View style={styles.screenWrapper}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Shared Element FLIP Morph Container */}
      <Animated.View style={[styles.root, morphContainerStyle]}>
        <Animated.View style={staggeredContentStyle}>
          {/* ── TOP BANNER & NAVIGATION HEADER ── */}
          <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
            {/* Top Pull-to-Dismiss Gesture Handle */}
            <View style={styles.dragHandleContainer} {...panResponder.panHandlers}>
              <View style={styles.dragHandleBar} />
            </View>
        {/* Blurred Banner Background or Bluish-Silver Gradient Fallback */}
        {profile?.banner_url ? (
          <View style={StyleSheet.absoluteFill}>
            <ExpoImage
              source={{ uri: profile.banner_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <BlurView intensity={45} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={["rgba(255, 255, 255, 0.72)", "rgba(255, 255, 255, 0.92)"]}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ) : (
          <LinearGradient
            colors={FALLBACK_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          >
            <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={["rgba(255, 255, 255, 0.35)", "rgba(255, 255, 255, 0.85)"]}
              style={StyleSheet.absoluteFill}
            />
          </LinearGradient>
        )}

        {/* Header Bar Controls */}
        <View style={styles.headerBar}>
          {isSearching ? (
            // Expanded In-Community Search Bar
            <View style={styles.searchBarRow}>
              <Search size={18} color="#6B7280" style={{ marginRight: 8 }} />
              <TextInput
                ref={searchInputRef}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={`Search in ${profile?.name || "community"}...`}
                placeholderTextColor="#9CA3AF"
                style={styles.searchInput}
                autoFocus
                returnKeyType="search"
              />
              <TouchableOpacity
                style={styles.searchCloseButton}
                onPress={() => {
                  HapticsService.triggerImpactLight();
                  setSearchQuery("");
                  setIsSearching(false);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color="#4B5563" />
              </TouchableOpacity>
            </View>
          ) : (
            // Standard Header with Back, Title, Subtitle, Search
            <>
              {/* Back Button */}
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={handleBack}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ArrowLeft size={20} color="#111827" strokeWidth={2.2} />
              </TouchableOpacity>

              {/* Title & Stats */}
              <View style={styles.headerCenter}>
                <View style={styles.headerTitleRow}>
                  {/* Rule: BasicCommercialBlack used only once per screen */}
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    {profile?.name || "Community"}
                  </Text>
                  {profile?.community_verification_tier &&
                    profile.community_verification_tier !== "none" && (
                      <VerifiedBadge
                        tier={profile.community_verification_tier}
                        size={15}
                        style={{ marginLeft: 6 }}
                      />
                    )}
                </View>
                {/* Rule: Manrope Medium for metadata/counters */}
                <View style={styles.headerSubtitleRow}>
                  <Text style={styles.headerSubtitle}>
                    {formattedTotalMembers} {memberLabel} • {activeNowCount} active now
                  </Text>
                  <View style={styles.activeDot} />
                </View>
              </View>

              {/* Search Button */}
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => {
                  HapticsService.triggerImpactLight();
                  setIsSearching(true);
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Search size={20} color="#111827" strokeWidth={2.2} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ── CATEGORIZED FILTER CHIPS (Directly Below Banner) ── */}
        <View style={styles.filtersBar}>
          {/* Chip 1: Author */}
          <TouchableOpacity
            style={[
              styles.filterChip,
              authorFilter !== "all" && styles.filterChipActive,
            ]}
            onPress={() => {
              HapticsService.triggerImpactLight();
              setActiveDropdown(activeDropdown === "author" ? null : "author");
            }}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.filterChipText,
                authorFilter !== "all" && styles.filterChipTextActive,
              ]}
              numberOfLines={1}
            >
              {authorFilter === "all"
                ? "Author: All"
                : authorFilter === "owner"
                ? "Author: Community"
                : authorFilter === "members"
                ? "Author: Members"
                : "Author: Promo"}
            </Text>
            <ChevronDown
              size={14}
              color={authorFilter !== "all" ? PRIMARY_COLOR : "#6B7280"}
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>

          {/* Chip 2: Post Type */}
          <TouchableOpacity
            style={[
              styles.filterChip,
              typeFilter !== "all" && styles.filterChipActive,
            ]}
            onPress={() => {
              HapticsService.triggerImpactLight();
              setActiveDropdown(activeDropdown === "type" ? null : "type");
            }}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.filterChipText,
                typeFilter !== "all" && styles.filterChipTextActive,
              ]}
              numberOfLines={1}
            >
              {typeFilter === "all"
                ? "Type: All"
                : typeFilter === "voice"
                ? "Type: Voice"
                : typeFilter === "poll"
                ? "Type: Polls"
                : typeFilter === "qna"
                ? "Type: Q&A"
                : typeFilter === "prompt"
                ? "Type: Prompts"
                : typeFilter === "opportunity"
                ? "Type: Opps"
                : "Type: Challenges"}
            </Text>
            <ChevronDown
              size={14}
              color={typeFilter !== "all" ? PRIMARY_COLOR : "#6B7280"}
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>

          {/* Chip 3: Sort Order */}
          <TouchableOpacity
            style={[
              styles.filterChip,
              sortFilter !== "newest" && styles.filterChipActive,
            ]}
            onPress={() => {
              HapticsService.triggerImpactLight();
              setActiveDropdown(activeDropdown === "sort" ? null : "sort");
            }}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.filterChipText,
                sortFilter !== "newest" && styles.filterChipTextActive,
              ]}
              numberOfLines={1}
            >
              {sortFilter === "newest"
                ? "Sort: Newest"
                : sortFilter === "oldest"
                ? "Sort: Oldest"
                : sortFilter === "top"
                ? "Sort: Top Voted"
                : "Sort: Discussed"}
            </Text>
            <ChevronDown
              size={14}
              color={sortFilter !== "newest" ? PRIMARY_COLOR : "#6B7280"}
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>

          {/* Reset Filters Icon Button */}
          {filterChipsActiveCount > 0 && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetFilters}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <RotateCcw size={14} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── MAIN FEED FlatList ── */}
      <FlatList
        data={filteredAndSortedItems}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderFeedItem}
        contentContainerStyle={[
          styles.feedContent,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadCommunityData(true)}
            tintColor={PRIMARY_COLOR}
            colors={[PRIMARY_COLOR]}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeaderContainer}>
            {/* Community Voice Box — Placed directly below the filter chips as top entry of feed */}
            <CommunityVoiceBox
              targetId={profile?.id || communityId}
              targetType={targetType}
              currentUser={profile}
              onPostCreated={(newPost) => {
                setVoicePosts((prev) => [newPost, ...prev]);
              }}
            />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centerContainer}>
              <SnooLoader size="small" color={PRIMARY_COLOR} />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Layers size={40} color="#9CA3AF" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>
                {searchQuery ? "No matching posts found" : "No community posts yet"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? `We couldn't find any posts matching "${searchQuery}".`
                  : "Be the first to share a thought or create a discussion!"}
              </Text>
              {filterChipsActiveCount > 0 && (
                <TouchableOpacity style={styles.emptyResetBtn} onPress={resetFilters}>
                  <Text style={styles.emptyResetBtnText}>Clear all filters</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
      />
        </Animated.View>
      </Animated.View>

      {/* ── DROPDOWN POPUP MODAL ── */}
      <Modal
        visible={activeDropdown !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveDropdown(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setActiveDropdown(null)}
        >
          <View
            style={[
              styles.dropdownCard,
              { top: insets.top + 105 },
            ]}
          >
            {/* Author Dropdown */}
            {activeDropdown === "author" && (
              <View>
                <Text style={styles.dropdownTitle}>Filter by Author</Text>
                {[
                  { id: "all", label: "All Posts" },
                  { id: "owner", label: "Community / Creator Only" },
                  { id: "members", label: "Members Only" },
                  ...(targetType === "member"
                    ? [{ id: "promotions", label: "Promotions (Collabs)" }]
                    : []),
                ].map((opt) => {
                  const isSelected = authorFilter === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.dropdownItem,
                        isSelected && styles.dropdownItemSelected,
                      ]}
                      onPress={() => {
                        HapticsService.triggerImpactLight();
                        setAuthorFilter(opt.id);
                        setActiveDropdown(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          isSelected && styles.dropdownItemTextSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {isSelected && <Check size={16} color={PRIMARY_COLOR} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Post Type Dropdown */}
            {activeDropdown === "type" && (
              <View>
                <Text style={styles.dropdownTitle}>Filter by Post Type</Text>
                {[
                  { id: "all", label: "All Post Types" },
                  { id: "voice", label: "Voice & Community Thoughts" },
                  { id: "poll", label: "Polls" },
                  { id: "qna", label: "Q&A" },
                  { id: "prompt", label: "Prompts" },
                  { id: "challenge", label: "Challenges" },
                  { id: "opportunity", label: "Opportunities" },
                ].map((opt) => {
                  const isSelected = typeFilter === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.dropdownItem,
                        isSelected && styles.dropdownItemSelected,
                      ]}
                      onPress={() => {
                        HapticsService.triggerImpactLight();
                        setTypeFilter(opt.id);
                        setActiveDropdown(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          isSelected && styles.dropdownItemTextSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {isSelected && <Check size={16} color={PRIMARY_COLOR} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Sort Order Dropdown */}
            {activeDropdown === "sort" && (
              <View>
                <Text style={styles.dropdownTitle}>Sort Order</Text>
                {[
                  { id: "newest", label: "Newest First" },
                  { id: "oldest", label: "Oldest First" },
                  { id: "top", label: "Top Voted (Community Score)" },
                  { id: "discussed", label: "Most Discussed" },
                ].map((opt) => {
                  const isSelected = sortFilter === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.dropdownItem,
                        isSelected && styles.dropdownItemSelected,
                      ]}
                      onPress={() => {
                        HapticsService.triggerImpactLight();
                        setSortFilter(opt.id);
                        setActiveDropdown(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          isSelected && styles.dropdownItemTextSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {isSelected && <Check size={16} color={PRIMARY_COLOR} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: "transparent",
  },
  root: {
    flex: 1,
    backgroundColor: "#F6F7F9",
  },
  dragHandleContainer: {
    width: "100%",
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 2,
    zIndex: 20,
  },
  dragHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0, 0, 0, 0.16)",
  },
  headerContainer: {
    position: "relative",
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 52,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: FONTS.basicCommercialBlack,
    fontSize: 18,
    color: "#111827",
    letterSpacing: 0.3,
  },
  headerSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  headerSubtitle: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#6B7280",
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10B981",
    marginLeft: 6,
  },
  searchBarRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 42,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: "#111827",
    paddingVertical: 0,
  },
  searchCloseButton: {
    padding: 4,
    marginLeft: 6,
  },
  filtersBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 4,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  filterChipActive: {
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    borderColor: "#2962FF",
  },
  filterChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: "#374151",
  },
  filterChipTextActive: {
    color: "#2962FF",
  },
  resetButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  feedContent: {
    paddingTop: 4,
  },
  listHeaderContainer: {
    marginBottom: 4,
  },
  postCardWrapper: {
    marginBottom: 10,
  },
  voteBarWrapper: {
    marginHorizontal: 16,
    marginTop: -4,
    marginBottom: 8,
  },
  centerContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  emptyContainer: {
    paddingVertical: 60,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontFamily: FONTS.basicCommercialBold,
    fontSize: 17,
    color: "#1F2937",
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  emptyResetBtn: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(41, 98, 255, 0.25)",
  },
  emptyResetBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: "#2962FF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  dropdownCard: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 12,
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 10,
  },
  dropdownTitle: {
    fontFamily: FONTS.basicCommercialBold,
    fontSize: 13,
    color: "#9CA3AF",
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
  },
  dropdownItemSelected: {
    backgroundColor: "rgba(41, 98, 255, 0.08)",
  },
  dropdownItemText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: "#1F2937",
  },
  dropdownItemTextSelected: {
    fontFamily: FONTS.semiBold,
    color: "#2962FF",
  },
});
