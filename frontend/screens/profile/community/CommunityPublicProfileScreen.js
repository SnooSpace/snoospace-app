import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  Dimensions,
  Animated,
  RefreshControl,
  Platform,
  Alert,
  StatusBar,
  Linking,
  Pressable,
  InteractionManager,
} from "react-native";
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Pressable as GHPressable, GestureHandlerRootView } from "react-native-gesture-handler";
import { BlurView } from "expo-blur";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { useFocusEffect } from "@react-navigation/native";
import { CommonActions } from "@react-navigation/native";
import {
  Settings,
  MoreVertical,
  X,
  MapPin,
  Calendar,
  Users,
  ChevronRight,
  Pencil,
  ArrowLeft,
  Play,
  Star,
  Image as LucideImage,
  Clock,
  Video,
  AlertCircle,
  Mail,
  Phone,
  User,
  Pin,
  ShieldOff,
  CalendarDays,
  UserX,
  TriangleAlert,
  CircleCheck,
} from "lucide-react-native";
import CustomAlertModal from "../../../components/ui/CustomAlertModal";
import DynamicStatusBar from "../../../components/DynamicStatusBar";
import GradientSafeArea from "../../../components/GradientSafeArea";
import CollegeChip from "../../../components/CollegeChip";
import CollegeHubSheet from "../../../components/modals/CollegeHubSheet";
import EventCard from "../../../components/EventCard";
import HapticsService from "../../../services/HapticsService";

import {
  getPublicCommunity,
  getCommunityPosts,
  followCommunity,
  unfollowCommunity,
  blockCommunity,
  unblockCommunity,
} from "../../../api/communities";
import {
  getMemberCommunityCircleStatus,
  respondToCommunityCircleInvite,
} from "../../../api/members";
import { resolveConversation } from "../../../api/messages";
import { getCommunityPublicEvents } from "../../../api/events";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import EventBus from "../../../utils/EventBus";
import CommentsModal from "../../../components/CommentsModal";
import { getAuthToken, getAuthEmail, getActiveAccount } from "../../../api/auth";
import { apiPost, apiDelete, apiGet } from "../../../api/client";
import LikeStateManager from "../../../utils/LikeStateManager";
import {
  getGradientForName,
  getInitials,
} from "../../../utils/AvatarGenerator";
import {
  COLORS,
  FONTS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from "../../../constants/theme";
import GradientButton from "../../../components/GradientButton";
import ThemeChip from "../../../components/ThemeChip";
import SkeletonProfileHeader from "../../../components/SkeletonProfileHeader";
import SkeletonPostGrid from "../../../components/SkeletonPostGrid";
import EditorialPostCard from "../../../components/EditorialPostCard";
import OpportunityFeedCard from "../../../components/OpportunityFeedCard";
import ProfilePostFeed from "../../../components/ProfilePostFeed";
import EmptyPostsState from "../../../components/EmptyPostsState";
import EmptyCommunityState from "../../../components/EmptyCommunityState";
import EmptyEventsState from "../../../components/EmptyEventsState";
import CommunityVoiceBox, { VoicePostCard } from "../../../components/CommunityVoiceBox";
import SnooLoader from "../../../components/ui/SnooLoader";

// Normalize Theme Constants
const PRIMARY_COLOR = COLORS.primary;
const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;

const formatPhoneNumber = (value) => {
  if (!value) return "";
  const digits = String(value).replace(/[^0-9]/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits || String(value);
};

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const BANNER_HEIGHT = screenHeight * 0.28; // 28% of screen height
const AVATAR_SIZE = 120;
const GAP = 2;
const ITEM_SIZE = (screenWidth - GAP * 2) / 3;

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
  },
  scrollView: {
    flex: 1,
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
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
  },
  summarySection: {
    paddingHorizontal: 20,
    paddingTop: 0,
  },
  profileHeader: {
    alignItems: "center",
    gap: 6,
    marginTop: -(AVATAR_SIZE * 0.4),
    marginBottom: 16,
  },
  profileHeaderNoBanner: {
    marginTop: 0,
  },
  avatarWrapper: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
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
  bio: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: TEXT_COLOR,
    textAlign: "center",
    marginTop: 8,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
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
  sectionCard: {
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.9)",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 18,
    color: "#0F172A",
    letterSpacing: -0.3,
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
    fontFamily: FONTS.semiBold,
    fontSize: 16,
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
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
  },
  emptyText: {
    color: LIGHT_TEXT_COLOR,
    fontSize: 14,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 0, // Handled by gap/sectionHeader
  },
  sponsorTypesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
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
  postsSection: {
    paddingHorizontal: 0,
    paddingTop: 8,
  },
  postsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
  },
  gridItem: {
    backgroundColor: "#F2F2F7",
    position: "relative",
  },
  gridImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  gridPlaceholder: {
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyPostsContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyPostsText: {
    color: LIGHT_TEXT_COLOR,
    fontSize: 14,
  },
  headerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  contactModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  contactModalContent: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  contactModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  contactModalTitle: {
    fontSize: 18,
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    color: "#0F172A",
  },
  contactModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  contactModalBody: {
    gap: 12,
  },
  contactModalOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EEF2F6",
    gap: 12,
  },
  contactIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  contactOptionTextContainer: {
    flex: 1,
    gap: 2,
  },
  contactOptionTitle: {
    fontSize: 15,
    fontFamily: FONTS.semiBold, // Manrope-SemiBold
    color: "#0F172A",
  },
  contactOptionSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular, // Manrope-Regular
    color: "#64748B",
  },
  // Community Posts List
  communityPostsList: {
    paddingHorizontal: 0,
  },
  communityPostItem: {
    marginBottom: 8,
  },
});

const CommunityPublicPostGridCell = React.memo(({ item, itemSize, onPress }) => {
  const scale = useSharedValue(1);

  const animatedScaleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  let firstImageUrl = null;
  if (item?.image_urls && item.resolvedVideoThumbnail === undefined) {
    if (Array.isArray(item.image_urls)) {
      const flatUrls = item.image_urls.flat();
      firstImageUrl = flatUrls.find(
        (u) => typeof u === "string" && u.startsWith("http"),
      );
    } else if (
      typeof item.image_urls === "string" &&
      item.image_urls.startsWith("http")
    ) {
      firstImageUrl = item.image_urls;
    }
  }

  const isVideo = item.isVideo !== undefined ? item.isVideo : (
    !!item.video_url ||
    (firstImageUrl &&
      (firstImageUrl.toLowerCase().includes(".mp4") ||
        firstImageUrl.toLowerCase().includes(".mov") ||
        firstImageUrl.toLowerCase().includes(".webm")))
  );

  let mediaUrl = item.resolvedVideoThumbnail;
  if (mediaUrl === undefined) {
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
    if (!mediaUrl) {
      mediaUrl = firstImageUrl;
    }
  }

  return (
    <Pressable
      onPress={() => onPress(item.id)}
      onPressIn={() => {
        scale.value = withSpring(0.95, { damping: 10, stiffness: 150 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 10, stiffness: 150 });
      }}
      style={[
        styles.gridItem,
        {
          width: itemSize,
          height: itemSize * 1.35,
        },
      ]}
    >
      <Reanimated.View style={[{ width: "100%", height: "100%", overflow: "hidden", borderRadius: 3 }, animatedScaleStyle]}>
        {mediaUrl ? (
          <>
            <ExpoImage
              source={{ uri: mediaUrl }}
              style={styles.gridImage}
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
                <Play size={16} color="#FFF" fill="#FFF" />
              </View>
            )}
          </>
        ) : (
          <View style={[styles.gridImage, styles.gridPlaceholder]}>
            <LucideImage size={30} color="#999" />
          </View>
        )}

        {/* Pinned indicator on grid tile */}
        {item.is_pinned && (
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

const normalizePosts = (postsArray) => {
  if (!Array.isArray(postsArray)) return [];
  return postsArray.map((post) => {
    if (!post) return post;
    let firstImageUrl = null;
    if (post.image_urls) {
      if (Array.isArray(post.image_urls)) {
        const flatUrls = post.image_urls.flat();
        firstImageUrl = flatUrls.find(
          (u) => typeof u === "string" && u.startsWith("http"),
        );
      } else if (
        typeof post.image_urls === "string" &&
        post.image_urls.startsWith("http")
      ) {
        firstImageUrl = post.image_urls;
      }
    }

    const isVideo =
      !!post.video_url ||
      (firstImageUrl &&
        (firstImageUrl.toLowerCase().includes(".mp4") ||
          firstImageUrl.toLowerCase().includes(".mov") ||
          firstImageUrl.toLowerCase().includes(".webm")));

    let mediaUrl = null;
    if (post.video_thumbnail) {
      try {
        if (
          typeof post.video_thumbnail === "string" &&
          post.video_thumbnail.startsWith("[")
        ) {
          const parsed = JSON.parse(post.video_thumbnail);
          mediaUrl = Array.isArray(parsed) ? parsed[0] : post.video_thumbnail;
        } else {
          mediaUrl = post.video_thumbnail;
        }
      } catch (e) {
        mediaUrl = post.video_thumbnail;
      }
    }
    const videoSourceUrl = firstImageUrl || post.video_url;
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
    if (!mediaUrl) {
      mediaUrl = firstImageUrl;
    }

    return {
      ...post,
      is_liked: post.is_liked === true,
      isLiked: post.is_liked === true,
      resolvedVideoThumbnail: mediaUrl,
      isVideo,
    };
  });
};

export default function CommunityPublicProfileScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const communityId = route?.params?.communityId;
  const viewerRoleParam = route?.params?.viewerRole || "member";
  const viewerRole =
    typeof viewerRoleParam === "string"
      ? viewerRoleParam.toLowerCase()
      : "member";
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [posts, setPosts] = useState([]);
  const [preResolvedConversationId, setPreResolvedConversationId] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState(null);

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
  const [youHaveBlocked, setYouHaveBlocked] = useState(false);
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

  const handleBlockCommunity = useCallback(async () => {
    setMenuVisible(false);
    setTimeout(() => {
      const communityName = profile?.name || "this community";
      showAlert({
        title: `Block ${communityName}?`,
        message: "You won't see posts, events, or opportunities from this community. You can unblock them anytime.",
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
              await blockCommunity(communityId, token);
              showAlert({
                title: "Blocked",
                message: `${communityName} has been blocked.`,
                icon: CircleCheck,
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
                message: err?.message || "Failed to block community. Please try again.",
                primaryAction: { text: "OK", onPress: hideAlert },
                icon: TriangleAlert,
                iconColor: "#E53935",
              });
            } finally {
              setBlocking(false);
            }
          },
        },
      });
    }, 300);
  }, [communityId, profile, navigation, showAlert, hideAlert]);

  const handleUnblockCommunity = useCallback(async () => {
    try {
      setUnblocking(true);
      const token = await getAuthToken();
      await unblockCommunity(communityId, token);
      setYouHaveBlocked(false);
    } catch (err) {
      showAlert({
        title: "Error",
        message: err?.message || "Failed to unblock. Please try again.",
        primaryAction: { text: "OK", onPress: hideAlert },
        icon: TriangleAlert,
        iconColor: "#E53935",
      });
    } finally {
      setUnblocking(false);
    }
  }, [communityId, showAlert, hideAlert]);

  useEffect(() => {
    async function checkUserRole() {
      try {
        const account = await getActiveAccount();
        if (account?.type) {
          setCurrentUserRole(account.type.toLowerCase());
        }
      } catch (e) {
        console.warn("[CommunityPublicProfile] Error getting active account:", e);
      }
    }
    checkUserRole();
  }, []);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [theyFollowYou, setTheyFollowYou] = useState(false);

  // Member viewer: community circle invite status
  const [memberCommCircleStatus, setMemberCommCircleStatus] = useState('none'); // 'none' | 'pending_invite' | 'in_circle'
  const [memberCommCircleInviteId, setMemberCommCircleInviteId] = useState(null);
  const [memberCommCircleLoading, setMemberCommCircleLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [commentsModalState, setCommentsModalState] = useState({
    visible: false,
    postId: null,
    postType: "post",
  });
  const pendingPostUpdateRef = useRef(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showCollegeHub, setShowCollegeHub] = useState(false);
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [selectedHeadForContact, setSelectedHeadForContact] = useState(null);

  const postsCount = profile?.posts_count ?? profile?.post_count ?? 0;
  const followersCount =
    profile?.followers_count ?? profile?.follower_count ?? 0;
  const followingCount = profile?.following_count ?? profile?.following ?? 0;

  // Scroll Animation state
  const scrollY = useRef(new Animated.Value(0)).current;

  // Tabs state
  const [activeTab, setActiveTab] = useState("posts");
  const [renderedTab, setRenderedTab] = useState("posts");
  const [renderedPostsLimit, setRenderedPostsLimit] = useState(12);
  const [renderedEventsLimit, setRenderedEventsLimit] = useState(3);
  const [renderedCommunityLimit, setRenderedCommunityLimit] = useState(2);
  const [communityEvents, setCommunityEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Community Voice Posts
  const [voicePosts, setVoicePosts] = useState([]);
  const [loadingVoicePosts, setLoadingVoicePosts] = useState(false);
  const communityVoiceFetchedRef = useRef(false);

  const scrollViewRef = useRef(null);
  const scrollToPostIdRef = useRef(route?.params?.postId);
  const postsSectionYRef = useRef(0);
  const interactiveListYRef = useRef(0);

  const loadCommunityVoicePosts = useCallback(async () => {
    if (!communityId) return;
    communityVoiceFetchedRef.current = true;
    try {
      setLoadingVoicePosts(true);
      const token = await getAuthToken();
      const res = await apiGet(
        `/community-voice-posts?target_id=${communityId}&target_type=community`,
        15000,
        token,
      );
      setVoicePosts(res?.posts || []);
    } catch (e) {
      console.warn('[CommunityPublicProfile] loadVoicePosts error:', e);
    } finally {
      setLoadingVoicePosts(false);
    }
  }, [communityId]);

  useEffect(() => {
    if (route?.params?.postId) {
      scrollToPostIdRef.current = route.params.postId;
    }
    if (route?.params?.initialTab === "community") {
      setRenderedPostsLimit(12);
      setRenderedEventsLimit(3);
      setRenderedCommunityLimit(2);
      setRenderedTab(null);
      setActiveTab("community");
      InteractionManager.runAfterInteractions(() => {
        setRenderedTab("community");
      });
      if (!communityVoiceFetchedRef.current) {
        communityVoiceFetchedRef.current = true;
        loadCommunityVoicePosts();
      }
      navigation.setParams({ initialTab: undefined, postId: undefined });
    }
  }, [route?.params?.initialTab, route?.params?.postId, loadCommunityVoicePosts, navigation]);

  const [tabLayouts, setTabLayouts] = useState({});
  // Tab underline animation (Reanimated)
  const tabUnderlineX = useSharedValue(0);
  const tabUnderlineScale = useSharedValue(0);

  const animatedUnderlineStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: tabUnderlineX.value }],
      width: tabUnderlineScale.value,
    };
  });

  const handleTabLayout = (key, event) => {
    const { x, width } = event.nativeEvent.layout;
    setTabLayouts((prev) => ({ ...prev, [key]: { x, width } }));
  };

  useEffect(() => {
    const layout = tabLayouts[activeTab];
    if (layout) {
      tabUnderlineX.value = withTiming(layout.x, { duration: 200 });
      tabUnderlineScale.value = withTiming(layout.width, { duration: 200 });
    }
  }, [activeTab, tabLayouts]);

  const loadProfile = useCallback(async () => {
    try {
      const p = await getPublicCommunity(communityId);
      const normalizedCategories = Array.isArray(p?.categories)
        ? p.categories
        : p?.category
          ? [p.category]
          : [];
      setProfile({
        ...p,
        categories: normalizedCategories,
        category: normalizedCategories[0] || p?.category || null,
      });
      setIsFollowing(!!p?.is_following);
      setTheyFollowYou(!!p?.they_follow_you);
      setYouHaveBlocked(!!p?.you_have_blocked);
    } catch (e) {
      setError(e?.message || "Failed to load profile");
    }
  }, [communityId]);

  const loadMemberCommCircleStatus = useCallback(async () => {
    // Only relevant for member viewers
    if (currentUserRole && currentUserRole !== 'member') return;
    try {
      const res = await getMemberCommunityCircleStatus(communityId);
      setMemberCommCircleStatus(res?.status || 'none');
      setMemberCommCircleInviteId(res?.invite_id || null);
    } catch (e) {
      console.warn('[CommunityPublicProfile] loadMemberCommCircleStatus error:', e);
    }
  }, [communityId, currentUserRole]);

  const loadEvents = useCallback(async () => {
    console.log(
      "[CommunityPublicProfile] loadEvents called with communityId:",
      communityId,
    );
    try {
      setEventsLoading(true);
      const res = await getCommunityPublicEvents(communityId);
      console.log(
        "[CommunityPublicProfile] getCommunityPublicEvents response:",
        {
          hasEvents: !!res?.events,
          eventsLength: res?.events?.length,
          eventsData: res?.events,
          fullResponse: res,
        },
      );
      const allEvents = Array.isArray(res?.events) ? res.events : [];
      console.log(
        "[CommunityPublicProfile] Setting communityEvents to:",
        allEvents,
      );
      setCommunityEvents(allEvents);
    } catch (err) {
      console.log("[CommunityPublicProfile] Failed to load events:", err);
      setCommunityEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [communityId]);

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
        const data = await getCommunityPosts(communityId, {
          limit: 21,
          offset: reset ? 0 : offset,
        });
        const rawPosts = reset
          ? data?.posts || data || []
          : [...posts, ...(data?.posts || data || [])];

        // Normalize is_liked field for all posts - ensure it's explicitly true or false
        let mergedPosts = normalizePosts(rawPosts);

        // On initial/reset load, also fetch & merge community's public opportunities
        // (opportunities live in a separate table, not returned by getCommunityPosts)
        if (reset) {
          try {
            const token = await getAuthToken();
            const oppsRes = await apiGet(
              `/communities/${communityId}/opportunities`,
              15000,
              token,
            );
            const rawOpps = Array.isArray(oppsRes?.opportunities)
              ? oppsRes.opportunities
              : [];
            const normalizedOpps = rawOpps.map((o) => ({
              ...o,
              post_type: "opportunity",
              // Use API-returned is_liked/is_saved — do NOT hardcode false
              is_liked: o.is_liked === true,
              is_saved: o.is_saved === true,
              like_count: o.like_count || 0,
              comment_count: o.comment_count || 0,
              view_count: o.view_count || 0,
              is_pinned: o.is_pinned || false,
            }));
            mergedPosts = [...mergedPosts, ...normalizedOpps];
            console.log(
              `[CommunityPublicProfile] Merged ${normalizedOpps.length} opportunities. Total: ${mergedPosts.length}`,
            );
          } catch (oppErr) {
            console.log("[CommunityPublicProfile] Could not load opportunities:", oppErr?.message);
          }
        }

        setPosts(mergedPosts);
        const received = (data?.posts || data || []).length;
        const nextOffset = (reset ? 0 : offset) + received;
        setOffset(nextOffset);
        setHasMore(received >= 21);
      } catch (e) {
        console.error("[CommunityPublicProfile] loadPosts error:", e);
        setError(e?.message || "Failed to load posts");
      } finally {
        setLoadingMore(false);
      }
    },
    [communityId, offset, posts, hasMore, loadingMore],
  );

  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
      loadMemberCommCircleStatus();
    }, [loadProfile, loadMemberCommCircleStatus]),
  );

  useEffect(() => {
    let mounted = true;
    setPreResolvedConversationId(null);
    const task = InteractionManager.runAfterInteractions(() => {
      (async () => {
        if (!mounted) return;
        setLoading(true);
        await Promise.all([
          loadProfile(),
          loadPosts(true),
          loadEvents(),
          loadCommunityVoicePosts(),
        ]);
        if (mounted) setLoading(false);
      })();

      // Background resolve conversation to warm cache
      resolveConversation(communityId, 'community')
        .then((res) => {
          if (mounted && res?.conversationId) {
            setPreResolvedConversationId(res.conversationId);
          }
        })
        .catch((err) => console.log('[PERF] Background resolveConversation error:', err));
    });

    return () => {
      mounted = false;
      task.cancel();
    };
  }, [communityId]);

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
    const handlePostLikeUpdate = async (payload) => {
      console.log(
        "[CommunityPublicProfile] EventBus post-like-updated received:",
        payload,
      );
      if (!payload?.postId) return;

      // Cache the like state to persist across component unmounts
      await LikeStateManager.setLikeState(payload.postId, payload.isLiked);

      setPosts((prevPosts) => {
        const updatedPosts = prevPosts.map((post) =>
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
        );
        console.log(
          "[CommunityPublicProfile] Posts updated via EventBus, updated post:",
          updatedPosts.find((p) => p.id === payload.postId),
        );
        return updatedPosts;
      });
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

    const handlePostDeleted = ({ postId }) => {
      if (!postId) return;
      setPosts((prevPosts) => prevPosts.filter((p) => p.id !== postId));
      if (selectedPost?.id === postId) {
        setPostModalVisible(false);
        setSelectedPost(null);
      }
    };

    const unsubscribeLike = EventBus.on(
      "post-like-updated",
      handlePostLikeUpdate,
    );
    const unsubscribeComment = EventBus.on(
      "post-comment-updated",
      handlePostCommentUpdate,
    );
    const unsubscribeDeleted = EventBus.on("post-deleted", handlePostDeleted);

    const handlePostViewUpdate = (payload) => {
      if (!payload?.postId) return;
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === payload.postId
            ? { ...post, public_view_count: (post.public_view_count || 0) + 1 }
            : post,
        ),
      );
      setSelectedPost((prev) => {
        if (prev && prev.id === payload.postId) {
          return { ...prev, public_view_count: (prev.public_view_count || 0) + 1 };
        }
        return prev;
      });
    };

    const handlePostShareUpdate = (payload) => {
      if (!payload?.postId) return;
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === payload.postId
            ? { ...post, share_count: (post.share_count || 0) + (payload.increment || 1) }
            : post,
        ),
      );
      setSelectedPost((prev) => {
        if (prev && prev.id === payload.postId) {
          return { ...prev, share_count: (prev.share_count || 0) + (payload.increment || 1) };
        }
        return prev;
      });
    };

    const handlePostSaveUpdate = (payload) => {
      if (!payload?.postId) return;
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === payload.postId
            ? { ...post, is_saved: payload.isSaved, save_count: payload.saveCount }
            : post,
        ),
      );
      setSelectedPost((prev) => {
        if (prev && prev.id === payload.postId) {
          return { ...prev, is_saved: payload.isSaved, save_count: payload.saveCount };
        }
        return prev;
      });
    };

    const unsubscribeView = EventBus.on("post-view-updated", handlePostViewUpdate);
    const unsubscribeShare = EventBus.on("post-share-updated", handlePostShareUpdate);
    const unsubscribeSave = EventBus.on("post-save-updated", handlePostSaveUpdate);

    return () => {
      if (unsubscribeLike) unsubscribeLike();
      if (unsubscribeComment) unsubscribeComment();
      if (unsubscribeDeleted) unsubscribeDeleted();
      if (unsubscribeView) unsubscribeView();
      if (unsubscribeShare) unsubscribeShare();
      if (unsubscribeSave) unsubscribeSave();
    };
  }, [selectedPost]); // Added selectedPost dependency

  const openPostModal = useCallback((postId) => {
    console.log(
      "[CommunityPublicProfile] openPostModal called with postId:",
      postId,
    );
    // Look up the post from current state to ensure we have fresh data
    const post = posts.find((p) => p.id === postId);
    console.log(
      "[CommunityPublicProfile] Found post from state:",
      post
        ? { id: post.id, is_liked: post.is_liked, like_count: post.like_count }
        : "NOT FOUND",
    );
    if (!post) return;

    // Normalize is_liked field - only use is_liked, ignore isLiked completely
    const normalizedIsLiked = post.is_liked === true;
    console.log(
      "[CommunityPublicProfile] Normalized is_liked:",
      normalizedIsLiked,
      "from post.is_liked:",
      post.is_liked,
    );
    const normalizedPost = {
      ...post,
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

  const openCommentsModal = useCallback((postId, postType = "post") => {
    if (postId) {
      setCommentsModalState({ visible: true, postId, postType });
    }
  }, []);

  const closeCommentsModal = useCallback(() => {
    setCommentsModalState({ visible: false, postId: null, postType: "post" });
  }, []);

  const handlePostLike = (postId, isLiked, likeCount) => {
    pendingPostUpdateRef.current = {
      postId,
      is_liked: isLiked,
      like_count: likeCount,
    };
  };

  const renderGridItem = useCallback(({ item, index }) => {
    return (
      <CommunityPublicPostGridCell
        item={item}
        itemSize={ITEM_SIZE}
        onPress={openPostModal}
      />
    );
  }, [openPostModal]);

  const handleHeadPress = (head) => {
    if (!head) return;
    const hasProfile = !!head.member_id;
    const hasEmail = !!head.email;
    const hasPhone = !!head.phone;

    if (!hasProfile && !hasEmail && !hasPhone) return;

    HapticsService.triggerImpactLight();

    const navigateToProfile = (memberId) => {
      const isOwnProfile = currentUserId && memberId === currentUserId;
      if (isOwnProfile) {
        const root = navigation.getParent()?.getParent();
        if (root) {
          root.navigate("MemberHome", {
            screen: "Profile",
            params: {
              screen: "MemberProfile",
            },
          });
        } else {
          navigation.navigate("MemberProfile");
        }
      } else {
        navigation.navigate("MemberPublicProfile", {
          memberId: memberId,
        });
      }
    };

    // If ONLY profile is available and no other details, directly navigate
    if (hasProfile && !hasEmail && !hasPhone) {
      navigateToProfile(head.member_id);
      return;
    }

    setSelectedHeadForContact(head);
    setContactModalVisible(true);
  };

  const handleScroll = useCallback(({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const isNearBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 300;
    if (isNearBottom) {
      if (activeTab === "posts") {
        if (renderedPostsLimit < posts.length) {
          setRenderedPostsLimit((prev) => prev + 12);
        }
      } else if (activeTab === "events") {
        if (renderedEventsLimit < communityEvents.length) {
          setRenderedEventsLimit((prev) => prev + 5);
        }
      } else if (activeTab === "community") {
        const interactivePostsCount = posts.filter((p) =>
          ["poll", "prompt", "qna", "challenge", "opportunity"].includes(
            p.post_type || p.type
          )
        ).length;
        const totalCommunity = interactivePostsCount + voicePosts.length;
        if (renderedCommunityLimit < totalCommunity) {
          setRenderedCommunityLimit((prev) => prev + 5);
        }
      }
    }
  }, [
    activeTab,
    renderedPostsLimit,
    posts.length,
    renderedEventsLimit,
    communityEvents.length,
    renderedCommunityLimit,
    voicePosts.length,
  ]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar translucent backgroundColor="transparent" style="dark" />
        <ScrollView style={{ flex: 1, backgroundColor: "#fff" }}>
          <SkeletonProfileHeader type="community" />
          <SkeletonPostGrid />
        </ScrollView>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar translucent backgroundColor="transparent" style="dark" />
        <Text style={{ color: "#FF3B30" }}>{error}</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <DynamicStatusBar style="light-content" />

      {/* Add gradient overlay only when no banner */}
      {!profile?.banner_url && <GradientSafeArea variant="primary" />}

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
                outputRange: [0, 1],
                extrapolate: "clamp",
              }),
            },
          ]}
        />
      </View>

      <GHPressable
        onPress={() => {
          HapticsService.triggerBack();
          navigation.goBack();
        }}
        style={[
          styles.backBtn,
          {
            position: "absolute",
            top: insets.top + 8,
            left: 16,
            zIndex: 1100,
          },
        ]}
      >
        <ArrowLeft size={24} color="#1D1D1F" />
      </GHPressable>

      {!loading && !error && !(currentUserRole === "community" && String(profile?.id) === String(currentUserId)) && (
        <GHPressable
          onPress={() => setMenuVisible(true)}
          style={[
            styles.backBtn,
            {
              position: "absolute",
              top: insets.top + 8,
              right: 16,
              zIndex: 1100,
            },
          ]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MoreVertical size={24} color="#1D1D1F" />
        </GHPressable>
      )}

      <Animated.ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true, listener: handleScroll },
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              HapticsService.triggerImpactLight();
              loadProfile();
              loadPosts(true);
              loadEvents();
              loadCommunityVoicePosts();
            }}
            colors={[PRIMARY_COLOR]}
            tintColor={PRIMARY_COLOR}
          />
        }
      >
        {/* You've blocked this community banner */}
        {youHaveBlocked && !loading && (
          <View style={[blockBannerStyles.banner, { marginTop: insets.top + 48 }]}>
            <View style={blockBannerStyles.left}>
              <ShieldOff size={18} color="#BE123C" strokeWidth={2} style={{ marginRight: 8 }} />
              <Text style={blockBannerStyles.text}>You've blocked this community</Text>
            </View>
            <GHPressable
              style={({ pressed }) => [blockBannerStyles.btn, pressed && { opacity: 0.75 }]}
              onPress={handleUnblockCommunity}
              disabled={unblocking}
            >
              <Text style={blockBannerStyles.btnText}>{unblocking ? 'Unblocking…' : 'Unblock'}</Text>
            </GHPressable>
          </View>
        )}

        {/* Banner - only render if banner exists */}
        {profile?.banner_url && !youHaveBlocked && (
          <View style={styles.bannerContainer}>
            <Image
              source={{ uri: profile.banner_url }}
              style={styles.bannerImage}
            />
            <BlurView intensity={15} tint="dark" style={styles.bannerOverlay} />
          </View>
        )}

        <View
          style={[
            styles.summarySection,
            !profile?.banner_url && { paddingTop: insets.top + 60 },
            youHaveBlocked && { paddingTop: 20 },
          ]}
        >
          <View
            style={[
              styles.profileHeader,
              !profile?.banner_url && styles.profileHeaderNoBanner,
            ]}
          >
            <View style={styles.avatarWrapper}>
              {profile?.logo_url && /^https?:\/\//.test(profile.logo_url) ? (
                <Image
                  source={{ uri: profile.logo_url }}
                  style={styles.avatar}
                />
              ) : (
                <LinearGradient
                  colors={getGradientForName(profile?.name || "Community")}
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
                    {getInitials(profile?.name || "Community")}
                  </Text>
                </LinearGradient>
              )}
            </View>
            {/* Identity Block */}
            <Text style={styles.communityName}>
              {profile?.name || "Community"}
            </Text>
            {profile?.username && (
              <View style={styles.usernameRow}>
                <Text style={styles.usernameText}>@{profile.username}</Text>
              </View>
            )}
            {Array.isArray(profile?.categories) &&
              profile.categories.length > 0 && (
                <View style={styles.categoriesRow}>
                  {profile.categories.map((cat, idx) => (
                    <ThemeChip key={cat} label={cat} index={idx} />
                  ))}
                </View>
              )}

            {/* College Chip */}
            {profile?.college_info && (
              <View style={{ marginTop: 8 }}>
                <CollegeChip
                  collegeInfo={profile.college_info}
                  onPress={() => setShowCollegeHub(true)}
                />
              </View>
            )}

            {!!profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <GHPressable
              style={styles.statItem}
              onPress={() => {
                HapticsService.triggerStatsTap();
                navigation.navigate("CommunityPublicEventsList", {
                  communityId: profile.id,
                  initialTab: "upcoming",
                });
              }}
            >
              <Text style={styles.statNumber}>
                {(profile.events_scheduled_count || 0) +
                  (profile.events_hosted_count || 0)}
              </Text>
              <Text style={styles.statLabel}>Events</Text>
            </GHPressable>
            <GHPressable
              style={styles.statItem}
              onPress={() => {
                HapticsService.triggerStatsTap();
                navigation.navigate("UniversalFollowersList", {
                  userId: communityId,
                  userType: "community",
                  title: "Followers",
                });
              }}
            >
              <Text style={styles.statNumber}>
                {profile.followers_count || 0}
              </Text>
              <Text style={styles.statLabel}>Followers</Text>
            </GHPressable>
            <GHPressable
              style={styles.statItem}
              onPress={() => {
                HapticsService.triggerStatsTap();
                navigation.navigate("UniversalFollowingList", {
                  userId: communityId,
                  userType: "community",
                  title: "Following",
                });
              }}
            >
              <Text style={styles.statNumber}>{followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </GHPressable>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profile.posts_count || 0}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
          </View>

          <View
            style={{
              marginTop: 12,
              flexDirection: "row",
              gap: 10,
              width: "100%",
              marginBottom: 25,
            }}
          >
            {isFollowing ? (
              <GHPressable
                style={({ pressed }) => [
                  {
                    flex: 1,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: "rgba(68, 138, 255, 0.2)",
                    backgroundColor: "rgba(68, 138, 255, 0.12)",
                    justifyContent: "center",
                    alignItems: "center",
                    paddingVertical: 12,
                  },
                  pressed && { opacity: 0.8 },
                ]}
                onPress={async () => {
                  HapticsService.triggerClose();
                  // Optimistic update
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
                  EventBus.emit("follow-updated", {
                    communityId,
                    isFollowing: false,
                  });
                  try {
                    await unfollowCommunity(communityId);
                  } catch (e) {
                    console.error("Unfollow failed", e);
                    // Revert on failure
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
              </GHPressable>
            ) : (
              <GradientButton
                title={theyFollowYou ? "Follow Back" : "Follow"}
                colors={["#448AFF", "#2962FF"]}
                textStyle={{ fontFamily: FONTS.semiBold, color: "#FFFFFF" }}
                style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}
                gradientStyle={{ borderRadius: 16 }}
                useGHPressable={true}
                onPress={async () => {
                  HapticsService.triggerFollow();
                  // Optimistic update
                  setIsFollowing(true);
                  setProfile((prev) =>
                    prev
                      ? {
                          ...prev,
                          followers_count: (prev.followers_count || 0) + 1,
                        }
                      : prev,
                  );
                  EventBus.emit("follow-updated", {
                    communityId,
                    isFollowing: true,
                  });
                  // Trigger group-chat join prompt if community has autoJoin enabled
                  EventBus.emit("community-followed", { communityId });
                  try {
                    await followCommunity(communityId);
                  } catch (e) {
                    console.error("Follow failed", e);
                    // Revert on failure
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
              colors={["#111827", "#111827"]} // Charcoal Black
              style={{ flex: 1, borderRadius: 16, overflow: "hidden" }}
              gradientStyle={{ borderRadius: 16 }}
              textStyle={{ fontFamily: FONTS.semiBold, color: "#FFFFFF" }}
              useGHPressable={true}
              onPress={() => {
                HapticsService.triggerMessageSend();
                const tappedAt = global.performance ? global.performance.now() : Date.now();
                setTimeout(() => {
                  navigation.navigate("Chat", {
                    conversationId: preResolvedConversationId,
                    recipientId: communityId,
                    recipientType: "community",
                    recipientName: profile?.name,
                    recipientUsername: profile?.username,
                    recipientAvatar: profile?.logo_url,
                    tappedAt,
                  });
                }, 50);
              }}
            />
          </View>

          {/* Circle invite banner: shown when member has a pending circle invite from this community */}
          {memberCommCircleStatus === 'pending_invite' && (
            <View style={{
              marginTop: 10,
              backgroundColor: 'rgba(68,138,255,0.10)',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: 'rgba(68,138,255,0.22)',
              paddingHorizontal: 14,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}>
              <Text style={{ fontFamily: FONTS.medium, color: '#90CAF9', fontSize: 13, flex: 1 }}>
                This community invited you to their circle
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <GHPressable
                  onPress={async () => {
                    setMemberCommCircleLoading(true);
                    try {
                      await respondToCommunityCircleInvite(memberCommCircleInviteId, 'declined');
                      setMemberCommCircleStatus('none');
                      setMemberCommCircleInviteId(null);
                      HapticsService.triggerImpactLight();
                    } catch (e) { console.warn('[CommProfile] decline circle invite error:', e); }
                    finally { setMemberCommCircleLoading(false); }
                  }}
                  disabled={memberCommCircleLoading}
                  style={({ pressed }) => ({
                    backgroundColor: 'rgba(229,57,53,0.12)',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontFamily: FONTS.semiBold, color: '#EF9A9A', fontSize: 13 }}>Decline</Text>
                </GHPressable>
                <GHPressable
                  onPress={async () => {
                    setMemberCommCircleLoading(true);
                    try {
                      await respondToCommunityCircleInvite(memberCommCircleInviteId, 'accepted');
                      setMemberCommCircleStatus('in_circle');
                      setMemberCommCircleInviteId(null);
                      HapticsService.triggerAddToCircle();
                    } catch (e) { console.warn('[CommProfile] accept circle invite error:', e); }
                    finally { setMemberCommCircleLoading(false); }
                  }}
                  disabled={memberCommCircleLoading}
                  style={({ pressed }) => ({
                    backgroundColor: 'rgba(68,138,255,0.22)',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontFamily: FONTS.semiBold, color: '#90CAF9', fontSize: 13 }}>Accept</Text>
                </GHPressable>
              </View>
            </View>
          )}
          {memberCommCircleStatus === 'in_circle' && (
            <View style={{
              marginTop: 10,
              backgroundColor: 'rgba(46,213,115,0.08)',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: 'rgba(46,213,115,0.20)',
              paddingHorizontal: 14,
              paddingVertical: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}>
              <CircleCheck size={15} color="#69F0AE" strokeWidth={2} />
              <Text style={{ fontFamily: FONTS.medium, color: '#69F0AE', fontSize: 13 }}>You're in this community's circle</Text>
            </View>
          )}

          {profile?.show_heads !== false && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {profile?.heads && profile.heads.length > 1
                  ? "Meet the Hosts"
                  : "Meet the Host"}
              </Text>
            </View>
            {profile?.heads && profile.heads.length > 0 ? (
              <View style={{ paddingVertical: 4 }}>
                {profile.heads.map((head, idx) => {
                  const isClickable = !!head.member_id || !!head.email || !!head.phone;
                  return (
                    <GHPressable
                      key={head.id || idx}
                      style={({ pressed }) => [
                        styles.headRow,
                        !isClickable && { opacity: 0.85 },
                        pressed && isClickable && { opacity: 0.7 },
                      ]}
                      onPress={() => handleHeadPress(head)}
                      disabled={!isClickable}
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
                        {(head.email || head.phone) ? (
                          <Text style={styles.headSub} numberOfLines={1}>
                            {[head.email, head.phone].filter(Boolean).join("  •  ")}
                          </Text>
                        ) : null}
                      </View>
                      {isClickable && (
                        <ChevronRight size={20} color="#8E8E93" />
                      )}
                    </GHPressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>No hosts listed</Text>
            )}
          </View>
          )}

          {profile?.sponsor_types &&
            profile.sponsor_types.length > 0 &&
            (viewerRole === "sponsor" || currentUserRole === "sponsor") && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Looking for Sponsors</Text>
                </View>
                <View style={styles.sponsorTypesList}>
                  {profile.sponsor_types.map((type, idx) => (
                    <ThemeChip
                      key={`st-${idx}`}
                      label={String(type)}
                      index={idx}
                    />
                  ))}
                </View>
              </View>
            )}
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {["posts", "community", "events"].map((tab) => (
            <GHPressable
              key={tab}
              style={styles.tabItem}
              onPress={() => {
                HapticsService.triggerImpactLight();
                setRenderedPostsLimit(12);
                setRenderedEventsLimit(3);
                setRenderedCommunityLimit(2);
                setRenderedTab(null);
                setActiveTab(tab);
                InteractionManager.runAfterInteractions(() => {
                  setRenderedTab(tab);
                });
                // Lazy-load voice posts when Community tab first opened
                if (tab === 'community' && !communityVoiceFetchedRef.current) {
                  communityVoiceFetchedRef.current = true;
                  InteractionManager.runAfterInteractions(() => {
                    loadCommunityVoicePosts();
                  });
                }
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
            </GHPressable>
          ))}
          <Reanimated.View
            style={[
              styles.activeTabIndicator,
              animatedUnderlineStyle,
            ]}
          />
        </View>

        <View
        style={styles.postsSection}
          onLayout={(e) => {
            postsSectionYRef.current = e.nativeEvent.layout.y;
          }}
        >
            {renderedTab === null && (
              <View style={{ paddingVertical: 40, alignItems: "center" }}>
                <SnooLoader size="small" color={PRIMARY_COLOR} />
              </View>
            )}

          {/* Posts Tab - Media Only (Images/Videos) */}
          {renderedTab === "posts" && (
            <View style={{ display: "flex" }}>
              {(() => {
                const INTERACTIVE_TYPES = [
                  "poll",
                  "prompt",
                  "qna",
                  "challenge",
                  "opportunity",
                ];
                const mediaPosts = posts.filter((p) => {
                  const postType = p.post_type || p.type;
                  return !INTERACTIVE_TYPES.includes(postType);
                });

                const visiblePosts = mediaPosts.slice(0, renderedPostsLimit);
                const numRows = Math.ceil(visiblePosts.length / 3);
                const gridHeight = numRows > 0 ? numRows * (ITEM_SIZE * 1.35) + (numRows - 1) * GAP : 0;

                return mediaPosts.length > 0 ? (
                  <>
                    <View style={{ height: gridHeight }}>
                      <FlatList
                        data={visiblePosts}
                        keyExtractor={(item) => String(item.id)}
                        numColumns={3}
                        columnWrapperStyle={{
                          justifyContent: "flex-start",
                          marginBottom: GAP,
                          gap: GAP,
                        }}
                        scrollEnabled={false}
                        renderItem={renderGridItem}
                        initialNumToRender={12}
                        maxToRenderPerBatch={6}
                        windowSize={5}
                        removeClippedSubviews={false}
                        updateCellsBatchingPeriod={50}
                        getItemLayout={(data, index) => ({
                          length: ITEM_SIZE * 1.35,
                          offset: (ITEM_SIZE * 1.35 + GAP) * Math.floor(index / 3),
                          index,
                        })}
                      />
                    </View>
                    {renderedPostsLimit < mediaPosts.length && (
                      <View style={{ paddingVertical: 20, alignItems: "center" }}>
                        <SnooLoader size="small" color={PRIMARY_COLOR} />
                      </View>
                    )}
                  </>
                ) : (
                  <EmptyPostsState isOwnProfile={false} />
                );
              })()}
            </View>
          )}

          {/* Community Tab - Interactive Posts + Voice Box */}
          {renderedTab === "community" && (
            <View style={{ display: "flex" }}>
              {(() => {
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

                // Sort: pinned first, then by created_at
                const sortedPosts = [...interactivePosts].sort((a, b) => {
                  if (a.is_pinned && !b.is_pinned) return -1;
                  if (!a.is_pinned && b.is_pinned) return 1;
                  return new Date(b.created_at) - new Date(a.created_at);
                });

                const mappedInteractive = sortedPosts.map((p) => ({
                  ...p,
                  itemType: "interactive",
                }));
                const mappedVoice = voicePosts.map((vp) => ({
                  ...vp,
                  itemType: "voice",
                }));
                const allItems = [...mappedInteractive, ...mappedVoice];
                const visibleItems = allItems.slice(0, renderedCommunityLimit);

                const visibleInteractive = visibleItems
                  .filter((item) => item.itemType === "interactive")
                  .map((item) => {
                    const { itemType, ...rest } = item;
                    return rest;
                  });
                const visibleVoice = visibleItems
                  .filter((item) => item.itemType === "voice")
                  .map((item) => {
                    const { itemType, ...rest } = item;
                    return rest;
                  });

                return (
                  <View style={{ paddingBottom: 8 }}>
                    {/* Voice Box — any viewer can post */}
                    <CommunityVoiceBox
                      targetId={communityId}
                      targetType="community"
                      currentUser={null}
                      onPostCreated={(newPost) => {
                        setVoicePosts((prev) => [newPost, ...prev]);
                      }}
                    />

                    {/* Community's own interactive posts */}
                    {visibleInteractive.length > 0 && (
                      <View
                        style={styles.communityPostsList}
                        onLayout={(e) => {
                          interactiveListYRef.current = e.nativeEvent.layout.y;
                        }}
                      >
                        {visibleInteractive.map((post) => {
                          const postType = post.post_type || post.type;
                          const isOpportunity = postType === "opportunity";
                          return (
                            <View
                              key={post.id}
                              onLayout={(e) => {
                                if (String(post.id) === String(scrollToPostIdRef.current)) {
                                  scrollToPostIdRef.current = null;
                                  const itemY = e.nativeEvent.layout.y;
                                  const targetY = postsSectionYRef.current + interactiveListYRef.current + itemY;
                                  setTimeout(() => {
                                    scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY - 60), animated: true });
                                  }, 100);
                                }
                              }}
                              style={styles.communityPostItem}
                            >
                              {isOpportunity ? (
                                <OpportunityFeedCard
                                  opportunity={post}
                                  onPress={(opp) =>
                                    navigation.navigate("OpportunityView", {
                                      opportunityId: opp.id,
                                      opportunity: opp,
                                    })
                                  }
                                  onLike={(postId, isLiked, count) => {
                                    setPosts((prevPosts) =>
                                      prevPosts.map((p) =>
                                        p.id === postId
                                          ? { ...p, is_liked: isLiked, like_count: count }
                                          : p,
                                      ),
                                    );
                                  }}
                                  onSave={(postId, isSaved) => {
                                    setPosts((prevPosts) =>
                                      prevPosts.map((p) =>
                                        p.id === postId
                                          ? { ...p, is_saved: isSaved }
                                          : p,
                                      ),
                                    );
                                  }}
                                  onShare={() => {}}
                                  onUserPress={(userId, userType) => {
                                    if (userType === "community") {
                                      navigation.navigate("CommunityPublicProfile", {
                                        communityId: userId,
                                        viewerRole: viewerRole || "member",
                                      });
                                    } else {
                                      navigation.navigate("MemberPublicProfile", { memberId: userId });
                                    }
                                  }}
                                />
                              ) : (
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
                                  currentUserType="member"
                                  onUserPress={(userId, userType) => {}}
                                  onPostUpdate={(updatedPost) => {
                                    setPosts((prevPosts) =>
                                      prevPosts.map((p) =>
                                        p.id === updatedPost.id ? updatedPost : p,
                                      ),
                                    );
                                  }}
                                />
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* Voice posts from members */}
                    {loadingVoicePosts ? (
                      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                        <SnooLoader size="small" color={COLORS.primary} />
                      </View>
                    ) : (
                      visibleVoice.map((vp) => (
                        <View
                          key={vp.id}
                          onLayout={(e) => {
                            if (String(vp.id) === String(scrollToPostIdRef.current)) {
                              scrollToPostIdRef.current = null;
                              const itemY = e.nativeEvent.layout.y;
                              const targetY = postsSectionYRef.current + itemY;
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

                    {sortedPosts.length === 0 && voicePosts.length === 0 && !loadingVoicePosts && (
                      <EmptyCommunityState isOwnProfile={false} />
                    )}
                    {renderedCommunityLimit < allItems.length && (
                      <View style={{ paddingVertical: 20, alignItems: "center" }}>
                        <SnooLoader size="small" color={PRIMARY_COLOR} />
                      </View>
                    )}
                  </View>
                );
              })()}
            </View>
          )}

          {/* Events Tab */}
          {renderedTab === "events" && (
            <View style={{ display: "flex" }}>
              {(() => {
                if (communityEvents.length === 0) {
                  return <EmptyEventsState isOwnProfile={false} />;
                }

                return (
                  <View style={{ paddingTop: 16 }}>
                    {communityEvents.slice(0, renderedEventsLimit).map((item) => (
                      <EventCard
                        key={item.id}
                        event={item}
                        onPress={(eventData) =>
                          navigation.navigate("EventDetails", {
                            eventId: item.id,
                            eventData: item,
                          })
                        }
                        onComment={(id) => openCommentsModal(id, "event")}
                      />
                    ))}
                    {renderedEventsLimit < communityEvents.length && (
                      <View style={{ paddingVertical: 20, alignItems: "center" }}>
                        <SnooLoader size="small" color={PRIMARY_COLOR} />
                      </View>
                    )}
                  </View>
                );
              })()}
            </View>
          )}
        </View>
      </Animated.ScrollView>
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
            return !isInteractive;
          })}
          initialPostId={selectedPost?.id}
          onClose={closePostModal}
          currentUserId={currentUserId}
          currentUserType="member"
          navigation={navigation}
          onLikeUpdate={(postId, isLiked, count) => {
            // Update local state
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
            // Share logic
          }}
          onSave={(postId, isSaved) => {
            // Save logic
          }}
          onFollow={() => {}}
          onUserPress={(userId, userType) => {
            // Navigate to user profile
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

      <CommentsModal
        visible={commentsModalState.visible}
        postId={commentsModalState.postId}
        baseRoute={
          commentsModalState.postType === "opportunity"
            ? "/opportunities"
            : commentsModalState.postType === "event"
            ? "/events"
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
              setCommunityEvents((prevEvents) =>
                prevEvents.map((e) =>
                  e.id === commentsModalState.postId
                    ? { ...e, comment_count: newCount }
                    : e,
                ),
              );
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

      {/* College Hub Bottom Sheet */}
      <CollegeHubSheet
        visible={showCollegeHub}
        collegeId={profile?.college_info?.college_id}
        onClose={() => setShowCollegeHub(false)}
        onCommunityPress={(communityId) => {
          setShowCollegeHub(false);
          // Navigate to the tapped community's public profile
          if (communityId !== profile?.id) {
            navigation.push("CommunityPublicProfile", { communityId });
          }
        }}
      />

      {/* Premium Contact Info Modal */}
      <Modal
        visible={contactModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setContactModalVisible(false)}
        statusBarTranslucent={true}
      >
        <TouchableOpacity
          style={styles.contactModalOverlay}
          activeOpacity={1}
          onPress={() => setContactModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.contactModalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.contactModalHeader}>
              <Text style={styles.contactModalTitle}>
                {selectedHeadForContact ? `${selectedHeadForContact.name}'s Contact Info` : "Contact Info"}
              </Text>
              <TouchableOpacity
                onPress={() => setContactModalVisible(false)}
                style={styles.contactModalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#0F172A" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            {/* Options Body */}
            <View style={styles.contactModalBody}>
              {selectedHeadForContact?.member_id && (
                <TouchableOpacity
                  style={styles.contactModalOption}
                  onPress={() => {
                    setContactModalVisible(false);
                    const memberId = selectedHeadForContact.member_id;
                    const isOwnProfile = currentUserId && memberId === currentUserId;
                    if (isOwnProfile) {
                      const root = navigation.getParent()?.getParent();
                      if (root) {
                        root.navigate("MemberHome", {
                          screen: "Profile",
                          params: {
                            screen: "MemberProfile",
                          },
                        });
                      } else {
                        navigation.navigate("MemberProfile");
                      }
                    } else {
                      navigation.navigate("MemberPublicProfile", {
                        memberId: memberId,
                      });
                    }
                  }}
                >
                  <View style={[styles.contactIconWrapper, { backgroundColor: "rgba(41, 98, 255, 0.08)" }]}>
                    <User size={20} color="#2962FF" strokeWidth={2.2} />
                  </View>
                  <View style={styles.contactOptionTextContainer}>
                    <Text style={styles.contactOptionTitle}>Visit Profile</Text>
                    <Text style={styles.contactOptionSubtitle}>Go to user profile</Text>
                  </View>
                  <ChevronRight size={16} color="#8E8E93" />
                </TouchableOpacity>
              )}

              {selectedHeadForContact?.email && (
                <TouchableOpacity
                  style={styles.contactModalOption}
                  onPress={() => {
                    setContactModalVisible(false);
                    Linking.openURL(`mailto:${selectedHeadForContact.email}`).catch(() => {
                      Alert.alert("Error", "Could not open mail app");
                    });
                  }}
                >
                  <View style={[styles.contactIconWrapper, { backgroundColor: "rgba(16, 185, 129, 0.08)" }]}>
                    <Mail size={20} color="#10B981" strokeWidth={2.2} />
                  </View>
                  <View style={styles.contactOptionTextContainer}>
                    <Text style={styles.contactOptionTitle}>Email</Text>
                    <Text style={styles.contactOptionSubtitle}>{selectedHeadForContact.email}</Text>
                  </View>
                  <ChevronRight size={16} color="#8E8E93" />
                </TouchableOpacity>
              )}

              {selectedHeadForContact?.phone && (
                <TouchableOpacity
                  style={styles.contactModalOption}
                  onPress={() => {
                    setContactModalVisible(false);
                    Linking.openURL(`tel:${selectedHeadForContact.phone}`).catch(() => {
                      Alert.alert("Error", "Could not initiate call");
                    });
                  }}
                >
                  <View style={[styles.contactIconWrapper, { backgroundColor: "rgba(245, 158, 11, 0.08)" }]}>
                    <Phone size={20} color="#F59E0B" strokeWidth={2.2} />
                  </View>
                  <View style={styles.contactOptionTextContainer}>
                    <Text style={styles.contactOptionTitle}>Call / Message</Text>
                    <Text style={styles.contactOptionSubtitle}>{formatPhoneNumber(selectedHeadForContact.phone)}</Text>
                  </View>
                  <ChevronRight size={16} color="#8E8E93" />
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Options/Block Bottom Sheet */}
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
                const accountAge = Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / 86400000));
                const joinDate = createdDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                return (
                  <>
                    <View style={menuStyles.row}>
                      <View style={[menuStyles.iconBox, { backgroundColor: 'rgba(59,130,246,0.08)' }]}>
                        <CalendarDays size={20} color="#3B82F6" strokeWidth={2} />
                      </View>
                      <View style={menuStyles.rowText}>
                        <Text style={[menuStyles.rowLabel, { color: COLORS.textPrimary, fontFamily: FONTS.semiBold }]}>
                          {accountAge}d
                        </Text>
                        <Text style={[menuStyles.rowSub, { fontFamily: FONTS.regular }]}>
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
                onPress={youHaveBlocked ? () => { setMenuVisible(false); handleUnblockCommunity(); } : handleBlockCommunity}
                activeOpacity={0.7}
                disabled={blocking || unblocking}
              >
                <View style={[menuStyles.iconBox, youHaveBlocked && { backgroundColor: 'rgba(53,101,242,0.08)' }]}>
                  {youHaveBlocked
                    ? <ShieldOff size={20} color="#3565F2" strokeWidth={2.5} />
                    : <UserX size={20} color="#E53935" strokeWidth={2.5} />}
                </View>
                <View style={menuStyles.rowText}>
                  <Text style={[menuStyles.rowLabel, { fontFamily: FONTS.semiBold }, youHaveBlocked && { color: '#3565F2' }]}>
                    {youHaveBlocked ? 'Unblock Community' : 'Block Community'}
                  </Text>
                  <Text style={[menuStyles.rowSub, { fontFamily: FONTS.regular }]}>
                    {youHaveBlocked ? 'Remove block and restore access' : "You won't see their posts, events, or opportunities"}
                  </Text>
                </View>
              </TouchableOpacity>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      <CustomAlertModal onClose={hideAlert} {...alertConfig} />
      </View>
    </GestureHandlerRootView>
  );
}

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
    fontSize: 16,
    color: '#E53935',
  },
  rowSub: {
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
