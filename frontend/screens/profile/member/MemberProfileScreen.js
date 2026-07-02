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
  RefreshControl,
  Pressable,
  InteractionManager,
} from "react-native";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  Pressable as GHPressable,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CommonActions,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import {
  Settings,
  Bookmark,
  ChevronDown,
  Play,
  AlertCircle,
  Image as LucideImage,
  Pin,
  Ticket,
  MapPin,
  Users,
  CalendarDays,
  ChartNoAxesColumn,
  Music,
} from "lucide-react-native";
import {
  getHostedPlans,
  getAttendingPlans,
  likePlan,
  unlikePlan,
} from "../../../api/plans";
import {
  clearAuthSession,
  getAuthToken,
  logoutCurrentAccount,
  clearAllAccounts,
  getAllAccounts,
  getActiveAccount,
} from "../../../api/auth";
import {
  apiGet,
  apiPost,
  apiDelete,
  pinPost,
  unpinPost,
} from "../../../api/client";
import { deleteAccount as apiDeleteAccount } from "../../../api/account";
import {
  launchImageLibraryAsync,
  requestMediaLibraryPermissionsAsync,
  MediaTypeOptions,
} from "expo-image-picker";
import { uploadImage } from "../../../api/cloudinary";
import PostCard from "../../../components/PostCard"; // Assuming PostCard exists for a full post view
import ProfilePostFeed from "../../../components/ProfilePostFeed";
import VideoPlayer from "../../../components/VideoPlayer";
import CommentsModal from "../../../components/CommentsModal";
import EventCard from "../../../components/EventCard";
import SettingsModal from "../../../components/modals/SettingsModal";
import AccountSwitcherModal from "../../../components/modals/AccountSwitcherModal";
import AddAccountModal from "../../../components/modals/AddAccountModal";
import LogoutModal from "../../../components/modals/LogoutModal";
import EventBus from "../../../utils/EventBus";
import SkeletonProfileHeader from "../../../components/SkeletonProfileHeader";
import SkeletonPostGrid from "../../../components/SkeletonPostGrid";
import CollegeChip from "../../../components/CollegeChip";
import CollegeHubSheet from "../../../components/modals/CollegeHubSheet";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  EDITORIAL_SPACING,
  FONTS,
} from "../../../constants/theme";
import GradientButton from "../../../components/GradientButton";
import ThemeChip from "../../../components/ThemeChip";
import HapticsService from "../../../services/HapticsService";
import { useProfileCountsPolling } from "../../../hooks/useProfileCountsPolling";
import { useProfileCache } from "../../../context/ProfileCacheContext";
// import { useAuthState } from "../../../contexts/AuthStateContext"; // Unused
import UnexpectedLogoutBanner from "../../../components/UnexpectedLogoutBanner";
import SnooLoader from "../../../components/ui/SnooLoader";
import EmptyPostsState from "../../../components/EmptyPostsState";
import EmptyEventsState from "../../../components/EmptyEventsState";
import { useToast } from "../../../context/ToastContext";
import ActionModal from "../../../components/modals/ActionModal";
import OpenPlanCard from "../../../components/plans/OpenPlanCard";
import RequestBottomSheet from "../../plans/RequestBottomSheet";
import InstagramRow from "../../../components/InstagramRow";
import EditorialPostCard from "../../../components/EditorialPostCard";
import OpportunityFeedCard from "../../../components/OpportunityFeedCard";
import CommunityVoiceBox, {
  VoicePostCard,
} from "../../../components/CommunityVoiceBox";
import EmptyCommunityState from "../../../components/EmptyCommunityState";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Map legacy constants to new theme for backward compatibility during refactor
const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;
const PRIMARY_COLOR = COLORS.primary;

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

const ProfileBioHeader = React.memo(({ profile, setShowCollegeHub }) => {
  console.log("[Profile] ProfileBioHeader rendered");
  const visiblePronouns = Array.isArray(profile.pronouns)
    ? profile.pronouns.filter((p) => p !== "Prefer not to say")
    : [];
  const hasBio = !!profile.bio;
  const hasPronouns = visiblePronouns.length > 0;

  return (
    <>
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

      <View
        style={[
          styles.nameAndPronounsContainer,
          !hasBio && !hasPronouns && { marginBottom: 30 },
        ]}
      >
        <Text style={styles.profileName}>{profile.nickname || profile.name}</Text>
        {hasPronouns ? (
          <View style={styles.pronounsRowCentered}>
            <View style={[styles.chip, styles.pronounChipSmall]}>
              <Text style={styles.chipText}>
                {visiblePronouns
                  .map((p) => String(p).replace(/^[{\"]+|[}\"]+$/g, ""))
                  .join(" / ")}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
      {profile.bio ? renderBio(profile.bio) : null}

      {/* College & Socials Row */}
      {profile.instagram_username ||
      (profile.college_info && profile.show_college !== false) ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginTop: 10,
            marginBottom: 8,
          }}
        >
          {profile.college_info && profile.show_college !== false && (
            <CollegeChip
              collegeInfo={profile.college_info}
              onPress={() => setShowCollegeHub(true)}
            />
          )}
          {profile.instagram_username && (
            <InstagramRow username={profile.instagram_username} />
          )}
        </View>
      ) : null}

      {/* Spotify Top Artists Card */}
      {profile.spotify_connected && Array.isArray(profile.spotify_top_artists) && profile.spotify_top_artists.length > 0 && (
        <View style={styles.spotifyCard}>
          <View style={styles.spotifyHeader}>
            <Music size={16} color="#1DB954" strokeWidth={2.5} style={{ marginRight: 6 }} />
            <Text style={styles.spotifyTitle}>Spotify Top Artists</Text>
          </View>
          <View style={styles.spotifyArtistsContainer}>
            {profile.spotify_top_artists.map((artist, idx) => (
              <View key={idx} style={styles.spotifyArtistBadge}>
                <Text style={styles.spotifyArtistText}>{artist}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  );
});

const ProfileInterestsSection = React.memo(
  ({ interests, showAllInterests, setShowAllInterests }) => {
    if (!Array.isArray(interests) || interests.length === 0) return null;
    return (
      <View style={styles.metaChipsSection}>
        <View style={[styles.chipGridRow, { marginTop: 6 }]}>
          {(showAllInterests ? interests : interests.slice(0, 6)).map(
            (i, idx) => (
              <ThemeChip
                key={`interest-${idx}`}
                label={String(i)}
                index={idx}
                style={styles.chipGridItem}
              />
            ),
          )}
          {interests.length > 6 && !showAllInterests ? (
            <TouchableOpacity
              onPress={() => setShowAllInterests(true)}
              style={[styles.chip, styles.chipBlue]}
            >
              <Text style={[styles.chipText, styles.chipTextBlue]}>
                See all
              </Text>
            </TouchableOpacity>
          ) : null}
          {interests.length > 6 && showAllInterests ? (
            <TouchableOpacity
              onPress={() => setShowAllInterests(false)}
              style={[
                styles.chip,
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
    );
  },
);

const MemberPostGridCell = React.memo(
  ({ item, index, itemSize, onPress, onLongPress }) => {
    const scale = useSharedValue(1);

    const animatedScaleStyle = useAnimatedStyle(() => {
      return {
        transform: [{ scale: scale.value }],
      };
    });

    if (!item) {
      return (
        <View
          style={[
            styles.placeholderPost,
            {
              width: itemSize,
              height: itemSize * 1.35,
            },
          ]}
        >
          <LucideImage size={30} color={COLORS.textSecondary} />
        </View>
      );
    }

    const firstImageUrl = Array.isArray(item.image_urls)
      ? item.image_urls
          .flat()
          .find((u) => typeof u === "string" && u.startsWith("http"))
      : undefined;

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
    }

    return (
      <Pressable
        style={[
          styles.postGridItem,
          {
            width: itemSize,
            height: itemSize * 1.35,
            marginBottom: 0,
            marginRight: 0,
          },
        ]}
        onPressIn={() => {
          scale.value = withSpring(0.95, { damping: 10, stiffness: 150 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 10, stiffness: 150 });
        }}
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress(item)}
        delayLongPress={400}
      >
        <Reanimated.View
          style={[
            {
              width: "100%",
              height: "100%",
              overflow: "hidden",
              borderRadius: 8,
            },
            animatedScaleStyle,
          ]}
        >
          <ExpoImage
            source={{
              uri: mediaUrl || "https://via.placeholder.com/150",
            }}
            style={styles.postImage}
            cachePolicy="memory-disk"
            contentFit="cover"
            onError={(e) => {
              console.log("[ProfileGrid] Image load error:", {
                postId: item.id,
                mediaUrl,
                error: e.nativeEvent?.error || "Unknown error",
              });
            }}
            onLoad={() => {
              console.log("[ProfileGrid] Image loaded successfully:", item.id);
            }}
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
              <View
                style={{
                  transform: [{ rotate: "27deg" }],
                  overflow: "visible",
                }}
              >
                <Pin
                  size={10}
                  color="#10B981"
                  strokeWidth={2.5}
                  fill="#10B981"
                />
              </View>
            </View>
          )}
        </Reanimated.View>
      </Pressable>
    );
  },
);

const normalizePosts = (postsArray) => {
  if (!Array.isArray(postsArray)) return [];
  return postsArray.map((post) => {
    if (!post) return post;
    const firstImageUrl = Array.isArray(post.image_urls)
      ? post.image_urls.flat().find((u) => typeof u === "string" && u.startsWith("http"))
      : undefined;

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

    return {
      ...post,
      isLiked: !!post.is_liked,
      resolvedVideoThumbnail: mediaUrl,
      isVideo,
    };
  });
};

export default function MemberProfileScreen({ navigation }) {
  const route = useRoute();
  const { showToast } = useToast();
  const { memberProfile, memberPosts, setMemberProfile, setMemberPosts } = useProfileCache();
  const [profile, setProfileState] = useState(memberProfile);
  const [posts, setPostsState] = useState(memberPosts || []);
  const [loading, setLoading] = useState(!memberProfile);
  const [renderedPostsLimit, setRenderedPostsLimit] = useState(12);
  const [renderedEventsLimit, setRenderedEventsLimit] = useState(3);
  const [renderedCommunityLimit, setRenderedCommunityLimit] = useState(2);

  const setProfile = useCallback((updater) => {
    if (typeof updater === "function") {
      setProfileState((prev) => {
        const next = updater(prev);
        Promise.resolve().then(() => {
          setMemberProfile(next);
        });
        return next;
      });
    } else {
      setProfileState(updater);
      setMemberProfile(updater);
    }
  }, [setMemberProfile]);

  const setPosts = useCallback((updater) => {
    if (typeof updater === "function") {
      setPostsState((prev) => {
        const next = updater(prev);
        Promise.resolve().then(() => {
          setMemberPosts(next);
        });
        return next;
      });
    } else {
      setPostsState(updater);
      setMemberPosts(updater);
    }
  }, [setMemberPosts]);

  useEffect(() => {
    if (memberProfile) {
      setProfileState((prev) => (prev === memberProfile ? prev : memberProfile));
    }
  }, [memberProfile]);

  useEffect(() => {
    if (memberPosts) {
      setPostsState((prev) => (prev === memberPosts ? prev : memberPosts));
    }
  }, [memberPosts]);

  const [error, setError] = useState(null);
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  // Settings is now a Screen — no modal state needed
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

  useFocusEffect(
    useCallback(() => {
      console.log("[MemberProfileScreen] useFocusEffect run:", {
        showAccountSwitcher,
        showAddAccountModal,
        hasParent: !!navigation.getParent(),
      });
      if (showAccountSwitcher || showAddAccountModal) {
        console.log("[MemberProfileScreen] Hiding tab bar");
        navigation.getParent()?.setOptions({
          tabBarStyle: { display: "none" },
        });
      } else {
        console.log("[MemberProfileScreen] Showing/restoring tab bar");
        navigation.getParent()?.setOptions({
          tabBarStyle: undefined,
        });
      }
    }, [showAccountSwitcher, showAddAccountModal, navigation]),
  );
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showCollegeHub, setShowCollegeHub] = useState(false);
  const [logoutModalData, setLogoutModalData] = useState({
    hasMultiple: false,
    currentAccount: null,
  });
  const [commentsModalState, setCommentsModalState] = useState({
    visible: false,
    postId: null,
    postType: "post",
  });
  const [activeEmail, setActiveEmail] = useState("");
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [postForPinToggle, setPostForPinToggle] = useState(null);
  const [oldestPinnedPost, setOldestPinnedPost] = useState(null);

  // Cursor-based pagination state for posts
  const [postCursor, setPostCursor] = useState(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);

  // Events tab state
  const [activeProfileTab, setActiveProfileTab] = useState("posts");
  const [renderedProfileTab, setRenderedProfileTab] = useState("posts");


  const [profileEvents, setProfileEvents] = useState([]);
  const [profilePlans, setProfilePlans] = useState({
    hosted: [],
    attending: [],
  });
  const [planRequestSheet, setPlanRequestSheet] = useState(null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const eventsFetchedRef = useRef(false);

  // Community Posts tab state (Creator Mode)
  const [voicePosts, setVoicePosts] = useState([]);
  const [loadingVoicePosts, setLoadingVoicePosts] = useState(false);
  const communityPostsFetchedRef = useRef(false);

  const scrollViewRef = useRef(null);
  const scrollToPostIdRef = useRef(route?.params?.postId);
  const tabContentYRef = useRef(0);

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
      tabUnderlineX.value = withTiming(tabOffsets[activeProfileTab], {
        duration: 200,
      });
      tabUnderlineScale.value = withTiming(tabWidths[activeProfileTab], {
        duration: 200,
      });
    }
  }, [activeProfileTab]);

  const handleTabLayout = (tab, event) => {
    const { x, width } = event.nativeEvent.layout;
    if (width <= 0 || !Number.isFinite(x) || !Number.isFinite(width)) {
      return;
    }

    if (tabOffsets[tab] === x && tabWidths[tab] === width) return;

    tabOffsets[tab] = x;
    tabWidths[tab] = width;

    if (tab === activeProfileTab) {
      tabUnderlineX.value = x;
      tabUnderlineScale.value = width;
    }
  };

  // Real-time counts polling (5-second interval)
  // Pauses when modals are open to avoid distracting updates
  const isAnyModalOpen =
    postModalVisible ||
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
    initialCounts: profile ? {
      follower_count: profile.follower_count || 0,
      following_count: profile.following_count || 0,
      post_count: posts ? posts.length : 0,
      circle_count: profile.circle_count || 0,
      creator_follower_count: profile.creator_follower_count || 0,
    } : null,
  });


  const MAX_PINS = 3;

  const handlePinToggle = useCallback(
    (post, isDirect = false) => {
      HapticsService.triggerImpactLight();
      if (isDirect) {
        handlePinToggleConfirm(post);
        return;
      }
      if (post.is_pinned) {
        setOldestPinnedPost(null);
        setPostForPinToggle(post);
        setPinModalVisible(true);
        return;
      }
      const currentlyPinned = posts.filter((p) => p.is_pinned);
      if (currentlyPinned.length >= MAX_PINS) {
        const oldest = [...currentlyPinned].sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at),
        )[0];
        setOldestPinnedPost(oldest);
      } else {
        setOldestPinnedPost(null);
      }
      setPostForPinToggle(post);
      setPinModalVisible(true);
    },
    [posts],
  );

  const handlePinToggleConfirm = async (post) => {
    try {
      const token = await getAuthToken();
      if (!token) return;
      if (post.is_pinned) {
        await unpinPost(post.id, token);
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, is_pinned: false } : p)),
        );
        if (selectedPost?.id === post.id) {
          setSelectedPost((prev) =>
            prev ? { ...prev, is_pinned: false } : null,
          );
        }
      } else {
        const currentlyPinned = posts.filter((p) => p.is_pinned);
        if (currentlyPinned.length >= MAX_PINS) {
          const oldest = [...currentlyPinned].sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at),
          )[0];
          if (oldest) await unpinPost(oldest.id, token);
          await pinPost(post.id, token);
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === post.id) return { ...p, is_pinned: true };
              if (oldest && p.id === oldest.id)
                return { ...p, is_pinned: false };
              return p;
            }),
          );
        } else {
          await pinPost(post.id, token);
          setPosts((prev) =>
            prev.map((p) => (p.id === post.id ? { ...p, is_pinned: true } : p)),
          );
        }
        if (selectedPost?.id === post.id) {
          setSelectedPost((prev) =>
            prev ? { ...prev, is_pinned: true } : null,
          );
        }
      }
      setOldestPinnedPost(null);
    } catch (e) {
      showToast("Failed to update pin", "error");
    }
  };

  // Handle actions triggered from SettingsScreen via EventBus
  useEffect(() => {
    const handleSettingsAction = ({ action } = {}) => {
      if (action === "logout") {
        handleLogout();
      } else if (action === "add_account") {
        setShowAddAccountModal(true);
      } else if (action === "switch_account") {
        setShowAccountSwitcher(true);
      } else if (action === "my_activity") {
        let rootNav = navigation;
        try {
          if (navigation.getParent) {
            const p1 = navigation.getParent();
            if (p1 && p1.getParent) {
              const p2 = p1.getParent();
              if (p2) rootNav = p2;
            }
          }
        } catch (_) {}
        rootNav.navigate("MyDataScreen");
      }
    };
    const unsub = EventBus.on("settings:action", handleSettingsAction);
    return () => {
      if (unsub) unsub();
    };
  }, [navigation, handleLogout]);

  // Keep profile.instagram_username in sync when user links/unlinks from LinkedAccountsScreen
  useEffect(() => {
    const unsub = EventBus.on("instagram:updated", ({ username }) => {
      setProfile((prev) =>
        prev ? { ...prev, instagram_username: username || null } : prev,
      );
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Keep profile in sync when Creator Mode is toggled from SettingsScreen
  useEffect(() => {
    const unsub = EventBus.on(
      "profile:updated",
      ({ profile: updatedProfile }) => {
        if (!updatedProfile) return;
        setProfile((prev) =>
          prev ? { ...prev, ...updatedProfile } : updatedProfile,
        );
      },
    );
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Instantly update circle count when a circle request is accepted
  useEffect(() => {
    const unsub = EventBus.on("circle-request-responded", ({ action }) => {
      if (action !== "accepted") return;
      // Bump the polled circles count immediately without waiting for next poll tick
      initializeCounts({
        follower_count: polledCounts.followers,
        following_count: polledCounts.following,
        post_count: polledCounts.posts,
        circle_count: (polledCounts.circles || 0) + 1,
        creator_follower_count: polledCounts.creatorFollowers || 0,
      });
    });
    return () => { if (unsub) unsub(); };
  }, [polledCounts, initializeCounts]);

  // I followed a creator → my following count goes up
  useEffect(() => {
    const unsub = EventBus.on("creator:followed", () => {
      initializeCounts({
        follower_count: polledCounts.followers,
        following_count: (polledCounts.following || 0) + 1,
        post_count: polledCounts.posts,
        circle_count: polledCounts.circles || 0,
        creator_follower_count: polledCounts.creatorFollowers || 0,
      });
    });
    return () => { if (unsub) unsub(); };
  }, [polledCounts, initializeCounts]);

  // I unfollowed a creator → my following count goes down
  useEffect(() => {
    const unsub = EventBus.on("creator:unfollowed", () => {
      initializeCounts({
        follower_count: polledCounts.followers,
        following_count: Math.max(0, (polledCounts.following || 0) - 1),
        post_count: polledCounts.posts,
        circle_count: polledCounts.circles || 0,
        creator_follower_count: polledCounts.creatorFollowers || 0,
      });
    });
    return () => { if (unsub) unsub(); };
  }, [polledCounts, initializeCounts]);

  // I left a creator's circle → my circle count goes down
  // (follow row restored so following_count stays the same — it was excluded while in circle)
  useEffect(() => {
    const unsub = EventBus.on("circle:left", ({ alsoUnfollow } = {}) => {
      initializeCounts({
        follower_count: polledCounts.followers,
        following_count: polledCounts.following || 0,
        post_count: polledCounts.posts,
        circle_count: Math.max(0, (polledCounts.circles || 0) - 1),
        creator_follower_count: polledCounts.creatorFollowers || 0,
      });
    });
    return () => { if (unsub) unsub(); };
  }, [polledCounts, initializeCounts]);

  // As creator: I removed a follower → my creator_follower_count goes down
  useEffect(() => {
    const unsub = EventBus.on("creator:follower-removed", ({ creatorId } = {}) => {
      if (String(creatorId) !== String(profile?.id)) return;
      initializeCounts({
        follower_count: polledCounts.followers,
        following_count: polledCounts.following || 0,
        post_count: polledCounts.posts,
        circle_count: polledCounts.circles || 0,
        creator_follower_count: Math.max(0, (polledCounts.creatorFollowers || 0) - 1),
      });
    });
    return () => { if (unsub) unsub(); };
  }, [polledCounts, initializeCounts, profile?.id]);

  // As creator: I removed someone from my circle → circle_count--
  // If alsoUnfollow=false → follow is restored → creator_follower_count++
  // If alsoUnfollow=true → follow is also deleted → creator_follower_count--
  useEffect(() => {
    const unsub = EventBus.on("circle:member-removed", ({ creatorId, alsoUnfollow } = {}) => {
      if (String(creatorId) !== String(profile?.id)) return;
      initializeCounts({
        follower_count: polledCounts.followers,
        following_count: polledCounts.following || 0,
        post_count: polledCounts.posts,
        circle_count: Math.max(0, (polledCounts.circles || 0) - 1),
        creator_follower_count: alsoUnfollow
          // Follow also deleted — decrement
          ? Math.max(0, (polledCounts.creatorFollowers || 0) - 1)
          // Follow restored — increment (DB trigger restores the creator_follows row)
          : (polledCounts.creatorFollowers || 0) + 1,
      });
    });
    return () => { if (unsub) unsub(); };
  }, [polledCounts, initializeCounts, profile?.id]);

  // CircleListScreen removed someone from MY circle (no creatorId filter — always own circle)
  useEffect(() => {
    const unsub = EventBus.on("my:circle-member-removed", ({ alsoUnfollow } = {}) => {
      initializeCounts({
        follower_count: polledCounts.followers,
        following_count: polledCounts.following || 0,
        post_count: polledCounts.posts,
        circle_count: Math.max(0, (polledCounts.circles || 0) - 1),
        creator_follower_count: alsoUnfollow
          ? Math.max(0, (polledCounts.creatorFollowers || 0) - 1)
          : (polledCounts.creatorFollowers || 0),
      });
    });
    return () => { if (unsub) unsub(); };
  }, [polledCounts, initializeCounts]);

  // Real-time sync: view, share, save counts from EventBus
  useEffect(() => {
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
          return {
            ...prevSelected,
            public_view_count: (prevSelected.public_view_count || 0) + 1,
          };
        }
        return prevSelected;
      });
    };

    const handlePostShareUpdate = (payload) => {
      if (!payload?.postId) return;
      setPosts((prev) =>
        prev.map((post) =>
          post.id === payload.postId
            ? {
                ...post,
                share_count: (post.share_count || 0) + (payload.increment || 1),
              }
            : post,
        ),
      );
      setSelectedPost((prevSelected) => {
        if (prevSelected && prevSelected.id === payload.postId) {
          return {
            ...prevSelected,
            share_count:
              (prevSelected.share_count || 0) + (payload.increment || 1),
          };
        }
        return prevSelected;
      });
    };

    const handlePostSaveUpdate = (payload) => {
      if (!payload?.postId) return;
      setPosts((prev) =>
        prev.map((post) =>
          post.id === payload.postId
            ? {
                ...post,
                is_saved: payload.isSaved,
                save_count: payload.saveCount,
              }
            : post,
        ),
      );
      setSelectedPost((prevSelected) => {
        if (prevSelected && prevSelected.id === payload.postId) {
          return {
            ...prevSelected,
            is_saved: payload.isSaved,
            save_count: payload.saveCount,
          };
        }
        return prevSelected;
      });
    };

    const unsubscribeView = EventBus.on(
      "post-view-updated",
      handlePostViewUpdate,
    );
    const unsubscribeShare = EventBus.on(
      "post-share-updated",
      handlePostShareUpdate,
    );
    const unsubscribeSave = EventBus.on(
      "post-save-updated",
      handlePostSaveUpdate,
    );

    return () => {
      if (unsubscribeView) unsubscribeView();
      if (unsubscribeShare) unsubscribeShare();
      if (unsubscribeSave) unsubscribeSave();
    };
  }, []);

  // Buffer for avoiding parent re-renders during like/unlike inside PostModal
  const pendingPostUpdateRef = useRef(null);
  const loadProfileRef = useRef(null);

  const loadProfile = async (isRefresh = false) => {
    console.log("[Profile] loadProfile: start", isRefresh ? "(refresh)" : "");
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (!memberProfile) {
        setLoading(true);
        setPosts([]); // clear posts to prevent stale data
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
      // Use /profile/counts which returns circle_count + creator_follower_count + following in ONE call
      const [countsResponse, postsResponse, eventsResponse] = await Promise.all(
        [
          apiGet(`/profile/counts/${userId}/${userType}`, 15000, token),
          apiGet(`/posts/user/${userId}/${userType}?limit=20`, 15000, token),
          apiGet("/events/my-events", 15000, token).catch(() => ({
            events: [],
            total_events: 0,
          })),
        ],
      );
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
      const circleCount = parseInt(countsResponse?.circle_count || 0, 10);
      const creatorFollowerCount = parseInt(countsResponse?.creator_follower_count || 0, 10);
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
        education: fullProfile.education || "",
        occupation: fullProfile.occupation || null,
        occupation_details: fullProfile.occupation_details || null,
        occupation_category: fullProfile.occupation_category || null,
        portfolio_link: fullProfile.portfolio_link || "",
        // College fields — required by EditProfileScreen
        campus_id: fullProfile.campus_id || null,
        show_college: fullProfile.show_college !== false,
        college_info: fullProfile.college_info || null,
        // Social profiles
        instagram_username: fullProfile.instagram_username || null,
        spotify_connected: fullProfile.spotify_connected === true,
        spotify_top_artists: Array.isArray(fullProfile.spotify_top_artists)
          ? fullProfile.spotify_top_artists
          : [],
        circle_count: circleCount,
        following_count: followingCount,
        follower_count: followerCount,
        events_attended_count:
          eventsResponse?.total_events ?? eventsResponse?.events?.length ?? 0,
        // Creator Mode
        is_creator_mode_enabled: fullProfile.is_creator_mode_enabled === true,
        creator_mode_enabled_at: fullProfile.creator_mode_enabled_at || null,
        creator_follower_count: creatorFollowerCount,
      };
      setProfile(mappedProfile);

      // DEBUG: Log first post's like status from API
      if (userPosts.length > 0) {
        console.log(
          "[Profile] First post is_liked from API:",
          userPosts[0].id,
          userPosts[0].is_liked,
        );
      }

      setPosts(normalizePosts(userPosts));
      // Update pagination state from initial load
      setPostCursor(postsResponse?.next_cursor || null);
      setHasMorePosts(postsResponse?.has_more === true);
      // Initialize counts polling — seeds polledCounts before first render so no flicker
      initializeCounts({
        follower_count: followerCount,
        following_count: followingCount,
        post_count: userPosts.length,
        circle_count: circleCount,
        creator_follower_count: creatorFollowerCount,
      });
      // Pre-populate events — but do NOT set eventsFetchedRef here.
      // Plans are fetched by loadProfileEvents() which runs on first Events tab tap.
      // Setting the ref here would skip the plan fetch.
      if (
        Array.isArray(eventsResponse?.events) &&
        eventsResponse.events.length > 0
      ) {
        setProfileEvents(eventsResponse.events);
      }
      console.log("[Profile] loadProfile: setProfile & setPosts");

      // Fetch community voice posts in background to warm cache (if creator mode is enabled)
      if (fullProfile?.is_creator_mode_enabled === true) {
        try {
          const res = await apiGet(
            `/community-voice-posts?target_id=${userId}&target_type=member`,
            15000,
            token,
          );
          setVoicePosts(res?.posts || []);
          communityPostsFetchedRef.current = true;
        } catch (voiceErr) {
          console.log("[Profile] Failed to load voice posts in background:", voiceErr);
        }
      }
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

  // Lazy load events/plans when user first taps the Events tab (own profile)
  const loadProfileEvents = useCallback(async () => {
    if (loadingEvents) return;
    try {
      setLoadingEvents(true);
      const token = await getAuthToken();
      const [eventsRes, hostedRes, attendingRes] = await Promise.all([
        apiGet("/events/my-events", 15000, token).catch(() => ({ events: [] })),
        getHostedPlans(token).catch(() => ({ plans: [] })),
        getAttendingPlans(token).catch(() => ({ plans: [] })),
      ]);
      setProfileEvents(eventsRes?.events || []);
      setProfilePlans({
        hosted: (hostedRes?.plans || []).map((p) => ({ ...p, role: "host" })),
        attending: (attendingRes?.plans || []).map((p) => ({
          ...p,
          role: "attendee",
        })),
      });
    } catch (err) {
      console.error("[MemberProfile] loadProfileEvents error:", err);
    } finally {
      setLoadingEvents(false);
    }
  }, [loadingEvents]);

  const loadCommunityVoicePosts = useCallback(async () => {
    if (!profile?.id) return;
    try {
      setLoadingVoicePosts(true);
      const token = await getAuthToken();
      const res = await apiGet(
        `/community-voice-posts?target_id=${profile.id}&target_type=member`,
        15000,
        token,
      );
      setVoicePosts(res?.posts || []);
    } catch (e) {
      console.warn("[MemberProfile] loadVoicePosts error:", e);
    } finally {
      setLoadingVoicePosts(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (route?.params?.postId) {
      scrollToPostIdRef.current = route.params.postId;
    }
    if (route?.params?.initialTab === "community") {
      setRenderedPostsLimit(12);
      setRenderedEventsLimit(3);
      setRenderedCommunityLimit(2);
      setRenderedProfileTab(null);
      setActiveProfileTab("community");
      InteractionManager.runAfterInteractions(() => {
        setRenderedProfileTab("community");
      });
      if (!communityPostsFetchedRef.current) {
        communityPostsFetchedRef.current = true;
        loadCommunityVoicePosts();
      }
      navigation.setParams({ initialTab: undefined, postId: undefined });
    }
  }, [
    route?.params?.initialTab,
    route?.params?.postId,
    loadCommunityVoicePosts,
    navigation,
  ]);

  // Handle pull-to-refresh
  const onRefresh = useCallback(() => {
    console.log("[Profile] onRefresh: user pulled to refresh");
    loadProfile(true);
    if (activeProfileTab === "events") {
      eventsFetchedRef.current = false;
      loadProfileEvents();
    } else if (activeProfileTab === "community") {
      communityPostsFetchedRef.current = false;
      loadCommunityVoicePosts();
    }
  }, [activeProfileTab, loadProfileEvents, loadCommunityVoicePosts]);

  // Store loadProfile in ref so it can be accessed in navigation listener
  loadProfileRef.current = loadProfile;

  useEffect(() => {
    // Always load profile once on mount
    console.log("[Profile] useEffect: initial mount loadProfile call");
    const task = InteractionManager.runAfterInteractions(() => {
      loadProfile();
    });
    const off = EventBus.on("follow-updated", (payload) => {
      // Optimistically adjust following_count for current user when they follow/unfollow someone
      setProfile((prev) => {
        if (!prev) return prev;
        const delta = payload?.isFollowing ? 1 : -1;
        const next = Math.max(0, (prev.following_count || 0) + delta);
        return { ...prev, following_count: next };
      });
    });

    const offPostCreated = EventBus.on("post-created", () => {
      console.log(
        "[Profile] EventBus: post-created event received, reloading profile",
      );
      loadProfile(true);
    });

    return () => {
      console.log("[Profile] useEffect cleanup (unsubscribing)");
      task.cancel();
      off();
      if (offPostCreated) offPostCreated();
    };
  }, []);

  // Navigation listener to detect when returning from EditProfile with changes
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      // Check route params for refresh flag from EditProfile
      const params = route.params;
      if (params?.refreshProfile === true) {
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
    HapticsService.triggerEditProfile();
    // Navigate to EditProfile (same stack - ProfileStackNavigator)
    navigation.navigate("EditProfile", { profile });
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

      const mergedAccount = currentAccount
        ? {
            ...profile,
            ...currentAccount,
            username: currentAccount.username || profile?.username || "",
            name: currentAccount.name || profile?.name || "",
            profilePicture:
              currentAccount.profilePicture ||
              profile?.profile_photo_url ||
              null,
          }
        : profile;

      setLogoutModalData({
        hasMultiple: loggedInAccounts.length > 1,
        currentAccount: mergedAccount,
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

  const openPostModal = useCallback((post) => {
    setSelectedPost(post);
    setPostModalVisible(true);
  }, []);

  const closePostModal = useCallback(() => {
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
  }, []);

  // Memoized callback to open comments modal - uses single state update to prevent unnecessary re-renders
  const openCommentsModal = useCallback((postId, postType = "post") => {
    if (postId) {
      // Single state update instead of two separate updates
      setCommentsModalState({ visible: true, postId, postType });
    }
  }, []);

  // Memoized callback to close comments modal
  const closeCommentsModal = useCallback(() => {
    setCommentsModalState({ visible: false, postId: null, postType: "post" });
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
        const uniqueNew = normalizePosts(
          newPosts.filter((p) => !existingIds.has(p.id))
        );
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
  const gap = 2;
  const itemSize = (screenWidth - gap * 2) / 3;

  const renderGridItem = useCallback(
    ({ item, index }) => {
      return (
        <MemberPostGridCell
          item={item}
          index={index}
          itemSize={itemSize}
          onPress={openPostModal}
          onLongPress={handlePinToggle}
        />
      );
    },
    [itemSize, openPostModal, handlePinToggle],
  );

  // --- Full Post Modal Component ---

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
            <AlertCircle size={64} color={COLORS.error || "#FF4B2B"} />
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

  console.log("[Profile] ProfileScreen rendered");
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        {(() => {
          console.log("[Profile] ProfileHeader rendered");
          return null;
        })()}
        <View style={styles.header}>
          <GHPressable
            style={styles.usernameContainer}
            onPress={() => {
              HapticsService.triggerUsernameSwitcherPress();
              setShowAccountSwitcher(true);
            }}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Text style={styles.username}>@{profile.username}</Text>
            <ChevronDown size={26} color="#3B82F6" style={{ marginLeft: -2 }} />
          </GHPressable>
          <View style={styles.headerRight}>
            <GHPressable
              style={styles.settingsButton}
              onPress={() => {
                HapticsService.triggerSavePress();
                navigation.navigate("SavedPostsScreen");
              }}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Bookmark size={26} color={COLORS.editorial.textSecondary} />
            </GHPressable>
            <GHPressable
              style={styles.settingsButton}
              onPress={() => {
                HapticsService.triggerSettingsPress();
                navigation.navigate("Settings", { profile });
              }}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Settings size={26} color={COLORS.editorial.textSecondary} />
            </GHPressable>
          </View>
        </View>

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
            const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 300;
            if (isNearBottom) {
              if (activeProfileTab === "posts") {
                if (renderedPostsLimit < posts.length) {
                  setRenderedPostsLimit((prev) => prev + 12);
                } else if (!loading && !loadingMorePosts && hasMorePosts) {
                  loadMorePosts();
                }
              } else if (activeProfileTab === "events") {
                const totalEvents = profileEvents.length + profilePlans.hosted.length + profilePlans.attending.length;
                if (renderedEventsLimit < totalEvents) {
                  setRenderedEventsLimit((prev) => prev + 5);
                }
              } else if (activeProfileTab === "community") {
                const interactivePostsCount = posts.filter((p) =>
                  ["poll", "prompt", "qna", "challenge", "opportunity"].includes(p.post_type || p.type)
                ).length;
                const totalCommunity = interactivePostsCount + voicePosts.length;
                if (renderedCommunityLimit < totalCommunity) {
                  setRenderedCommunityLimit((prev) => prev + 5);
                }
              }
            }
          }}
        >
          <View style={styles.profileSection}>
            <ProfileBioHeader
              profile={profile}
              setShowCollegeHub={setShowCollegeHub}
            />

            {/* Stats */}
            {(() => {
              console.log("[Profile] ProfileStats rendered");
              return null;
            })()}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{posts.length}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <TouchableOpacity
                style={styles.statItem}
                onPress={() => {
                  HapticsService.triggerStatsTap();
                  setRenderedPostsLimit(12);
                  setRenderedEventsLimit(3);
                  setRenderedCommunityLimit(2);
                  setRenderedProfileTab(null);
                  setActiveProfileTab("events");
                  InteractionManager.runAfterInteractions(() => {
                    setRenderedProfileTab("events");
                  });
                  if (!eventsFetchedRef.current) {
                    eventsFetchedRef.current = true;
                    loadProfileEvents();
                  }
                }}
              >
                <Text style={styles.statNumber}>
                  {profile.events_attended_count ?? 0}
                </Text>
                <Text style={styles.statLabel}>Events</Text>
              </TouchableOpacity>
              {profile.is_creator_mode_enabled ? (
                <GHPressable
                  style={styles.statItem}
                  onPress={() => {
                    HapticsService.triggerStatsTap();
                    const circlesVal = polledCounts.circles;
                    const crFollowersVal = polledCounts.creatorFollowers;
                    navigation.navigate("CreatorFollowers", {
                      creatorId: profile.id,
                      isOwnProfile: true,
                      initialFollowersCount: crFollowersVal + (polledCounts.followers || 0),
                      initialCircleCount: circlesVal,
                    });
                  }}
                >
                  <Text style={styles.statNumber}>
                    {polledCounts.circles +
                     polledCounts.creatorFollowers +
                     (polledCounts.followers || 0)}
                  </Text>
                  <Text style={styles.statLabel}>Followers</Text>
                </GHPressable>
              ) : (
                <GHPressable
                  style={[styles.statItem, { position: "relative" }]}
                  onPress={() => {
                    HapticsService.triggerStatsTap();
                    navigation.navigate("CircleList");
                  }}
                >
                  <Text style={styles.statNumber}>
                    {polledCounts.circles}
                  </Text>
                  <Text style={styles.statLabel}>Circle</Text>
                </GHPressable>
              )}
              <GHPressable
                style={styles.statItem}
                onPress={() => {
                  HapticsService.triggerStatsTap();
                  navigation.navigate("FollowingList", {
                    memberId: profile.id,
                    title: "Following",
                  });
                }}
              >
                <Text style={styles.statNumber}>
                  {polledCounts.following}
                </Text>
                <Text style={styles.statLabel}>Following</Text>
              </GHPressable>
            </View>

            {/* Interests */}
            <ProfileInterestsSection
              interests={profile.interests}
              showAllInterests={showAllInterests}
              setShowAllInterests={setShowAllInterests}
            />

            {/* Action Buttons */}
            {(() => {
              console.log("[Profile] ProfileActionButtons rendered");
              return null;
            })()}
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
                    HapticsService.triggerCreatePost();
                    navigation.navigate("CreatePost");
                  }}
                  style={{
                    flex: 1,
                    borderRadius: 16,
                    overflow: "hidden",
                  }}
                  gradientStyle={{ borderRadius: 16, paddingHorizontal: 20 }}
                  colors={["#448AFF", "#2962FF"]}
                  textStyle={{ fontFamily: FONTS.semiBold, color: "#FFFFFF" }}
                />
              </View>
            ) : (
              <GradientButton
                title="Follow"
                onPress={handleFollow}
                style={{ marginTop: 10, width: "100%", borderRadius: 16 }}
                gradientStyle={{ borderRadius: 16, paddingHorizontal: 20 }}
                textStyle={{ fontFamily: FONTS.semiBold }}
              />
            )}

            {/* Creator Dashboard strip — visible when Creator Mode is ON */}
            {isOwnProfile && profile.is_creator_mode_enabled && (
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("MyDataScreen", { initialTab: "creator" })
                }
                activeOpacity={0.85}
                style={{
                  marginTop: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: "#F5F0FF",
                  borderRadius: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderWidth: 1,
                  borderColor: "rgba(124,58,237,0.15)",
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: "#7C3AED18",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ChartNoAxesColumn size={18} color="#7C3AED" strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: FONTS.semiBold,
                      fontSize: 14,
                      color: "#7C3AED",
                    }}
                  >
                    Creator Dashboard
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONTS.regular,
                      fontSize: 12,
                      color: "#8B5CF6",
                      marginTop: 1,
                    }}
                  >
                    Audience insights, follow quality & reach
                  </Text>
                </View>
                <ChevronDown
                  size={16}
                  color="#7C3AED"
                  strokeWidth={2}
                  style={{ transform: [{ rotate: "-90deg" }] }}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Posts / Events / Community Posts Tab Bar */}
          {(() => {
            console.log("[Profile] ProfileTabs rendered");
            return null;
          })()}
          <View style={profileTabStyles.tabBar}>
            {[
              "posts",
              ...(profile.is_creator_mode_enabled ? ["community"] : []),
              "events",
            ].map((tab) => (
              <TouchableOpacity
                key={tab}
                style={profileTabStyles.tab}
                onLayout={(e) => handleTabLayout(tab, e)}
                onPress={() => {
                  HapticsService.triggerImpactLight();
                  setRenderedPostsLimit(12);
                  setRenderedEventsLimit(3);
                  setRenderedCommunityLimit(2);
                  setRenderedProfileTab(null);
                  setActiveProfileTab(tab);
                  InteractionManager.runAfterInteractions(() => {
                    setRenderedProfileTab(tab);
                  });
                  if (tab === "events" && !eventsFetchedRef.current) {
                    eventsFetchedRef.current = true;
                    InteractionManager.runAfterInteractions(() => {
                      loadProfileEvents();
                    });
                  }
                  if (
                    tab === "community" &&
                    !communityPostsFetchedRef.current
                  ) {
                    communityPostsFetchedRef.current = true;
                    InteractionManager.runAfterInteractions(() => {
                      loadCommunityVoicePosts();
                    });
                  }
                }}
              >
                <Text
                  style={[
                    profileTabStyles.tabText,
                    activeProfileTab === tab && profileTabStyles.tabTextActive,
                  ]}
                >
                  {tab === "posts"
                    ? "Posts"
                    : tab === "events"
                      ? "Events"
                      : "Community"}
                </Text>
              </TouchableOpacity>
            ))}
            <Reanimated.View
              style={[
                profileTabStyles.activeTabIndicator,
                animatedUnderlineStyle,
              ]}
            />
          </View>

          {renderedProfileTab === null && (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <SnooLoader size="small" color={PRIMARY_COLOR} />
            </View>
          )}

          {/* Posts Tab Content */}
          {renderedProfileTab === "posts" && (
            <View style={{ display: "flex" }}>
              {(() => {
                const displayPosts = posts.filter((p) => {
                  if (!profile?.is_creator_mode_enabled) return true;
                  const postType = p.post_type || p.type;
                  const isInteractive = [
                    "poll",
                    "prompt",
                    "qna",
                    "challenge",
                    "opportunity",
                  ].includes(postType);
                  return !isInteractive;
                });
                const visiblePosts = displayPosts.slice(0, renderedPostsLimit);
                const numRows = Math.ceil(visiblePosts.length / 3);
                const gridHeight =
                  numRows > 0
                    ? numRows * (itemSize * 1.35) + (numRows - 1) * gap
                    : 0;
                return visiblePosts.length > 0 ? (
                  <>
                    <View style={{ height: gridHeight, marginTop: 10 }}>
                      <FlatList
                        data={visiblePosts}
                        keyExtractor={(item) => String(item.id)}
                        numColumns={3}
                        columnWrapperStyle={{
                          justifyContent: "flex-start",
                          marginBottom: gap,
                          gap: gap,
                        }}
                        scrollEnabled={false}
                        renderItem={renderGridItem}
                        initialNumToRender={12}
                        maxToRenderPerBatch={6}
                        windowSize={5}
                        removeClippedSubviews={Platform.OS === "android"}
                        updateCellsBatchingPeriod={50}
                        getItemLayout={(data, index) => ({
                          length: itemSize * 1.35,
                          offset: (itemSize * 1.35 + gap) * Math.floor(index / 3),
                          index,
                        })}
                      />
                    </View>
                    {renderedPostsLimit < displayPosts.length && (
                      <View style={{ paddingVertical: 20, alignItems: "center" }}>
                        <SnooLoader size="small" color={PRIMARY_COLOR} />
                      </View>
                    )}
                  </>
                ) : (
                  <EmptyPostsState isOwnProfile={isOwnProfile} />
                );
              })()}
            </View>
          )}

          {loadingMorePosts && renderedProfileTab === "posts" && (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <SnooLoader size="small" color={COLORS.primary} />
            </View>
          )}

          {profile.is_creator_mode_enabled &&
            renderedProfileTab === "community" && (
              <View
                style={{ display: "flex", paddingTop: 4, paddingBottom: 8 }}
                onLayout={(e) => {
                  tabContentYRef.current = e.nativeEvent.layout.y;
                }}
              >
                {/* Voice Box at the top — anyone can post */}
                <CommunityVoiceBox
                  targetId={profile.id}
                  targetType="member"
                  currentUser={profile}
                  onPostCreated={(newPost) => {
                    setVoicePosts((prev) => [newPost, ...prev]);
                  }}
                />

                {/* Creator's own interactive posts */}
                {(() => {
                  const sortedInteractive = posts
                    .filter((p) =>
                      [
                        "poll",
                        "prompt",
                        "qna",
                        "challenge",
                        "opportunity",
                      ].includes(p.post_type || p.type),
                    )
                    .sort((a, b) => {
                      if (a.is_pinned && !b.is_pinned) return -1;
                      if (!a.is_pinned && b.is_pinned) return 1;
                      return new Date(b.created_at) - new Date(a.created_at);
                    })
                    .map((p) => ({ ...p, itemType: "interactive" }));

                  const mappedVoicePosts = voicePosts.map((vp) => ({ ...vp, itemType: "voice" }));
                  const allCommunityItems = [...sortedInteractive, ...mappedVoicePosts];
                  const visibleCommunityItems = allCommunityItems.slice(0, renderedCommunityLimit);

                  return (
                    <>
                      {visibleCommunityItems.map((item) => {
                        if (item.itemType === "interactive") {
                          const postType = item.post_type || item.type;
                          if (postType === "opportunity") {
                            return (
                              <View
                                key={item.id}
                                onLayout={(e) => {
                                  if (
                                    String(item.id) ===
                                    String(scrollToPostIdRef.current)
                                  ) {
                                    scrollToPostIdRef.current = null;
                                    const itemY = e.nativeEvent.layout.y;
                                    const targetY = tabContentYRef.current + itemY;
                                    setTimeout(() => {
                                      scrollViewRef.current?.scrollTo({
                                        y: Math.max(0, targetY - 60),
                                        animated: true,
                                      });
                                    }, 100);
                                  }
                                }}
                                style={{ marginHorizontal: 16, marginBottom: 12 }}
                              >
                                <OpportunityFeedCard
                                  opportunity={item}
                                  showManagementControls={isOwnProfile}
                                  onDelete={(oppId) =>
                                    setPosts((prev) =>
                                      prev.filter((p) => p.id !== oppId),
                                    )
                                  }
                                  onPress={(opp) =>
                                    navigation.navigate("OpportunityView", {
                                      opportunityId: opp.id,
                                      opportunity: opp,
                                    })
                                  }
                                  onLike={(postId, isLiked, count) =>
                                    setPosts((prev) =>
                                      prev.map((p) =>
                                        p.id === postId
                                          ? {
                                              ...p,
                                              is_liked: isLiked,
                                              like_count: count,
                                            }
                                          : p,
                                      ),
                                    )
                                  }
                                  onComment={(postId) =>
                                    openCommentsModal(postId, "opportunity")
                                  }
                                  onSave={(postId, isSaved) =>
                                    setPosts((prev) =>
                                      prev.map((p) =>
                                        p.id === postId
                                          ? { ...p, is_saved: isSaved }
                                          : p,
                                      ),
                                    )
                                  }
                                  onShare={() => {}}
                                />
                              </View>
                            );
                          }
                          return (
                            <View
                              key={item.id}
                              onLayout={(e) => {
                                if (
                                  String(item.id) ===
                                  String(scrollToPostIdRef.current)
                                ) {
                                  scrollToPostIdRef.current = null;
                                  const itemY = e.nativeEvent.layout.y;
                                  const targetY = tabContentYRef.current + itemY;
                                  setTimeout(() => {
                                    scrollViewRef.current?.scrollTo({
                                      y: Math.max(0, targetY - 60),
                                      animated: true,
                                    });
                                  }, 100);
                                }
                              }}
                              style={{ marginBottom: 4 }}
                            >
                              <EditorialPostCard
                                post={item}
                                onLike={(postId, isLiked, count) =>
                                  setPosts((prev) =>
                                    prev.map((p) =>
                                      p.id === postId
                                        ? {
                                            ...p,
                                            is_liked: isLiked,
                                            like_count: count,
                                          }
                                        : p,
                                    ),
                                  )
                                }
                                onComment={(postId) => openCommentsModal(postId)}
                                onShare={() => {}}
                                onFollow={() => {}}
                                showFollowButton={false}
                                currentUserId={profile?.id}
                                currentUserType="member"
                                onUserPress={() => {}}
                                showManagementControls={isOwnProfile}
                                onDelete={async (postId) => {
                                  try {
                                    const token = await getAuthToken();
                                    await apiDelete(
                                      `/posts/${postId}`,
                                      null,
                                      15000,
                                      token,
                                    );
                                    setPosts((prev) =>
                                      prev.filter((p) => p.id !== postId),
                                    );
                                    EventBus.emit("post-deleted", { postId });
                                  } catch (e) {
                                    Alert.alert("Error", "Failed to delete post");
                                  }
                                }}
                                onPostUpdate={(updatedPost) =>
                                  setPosts((prev) =>
                                    prev.map((p) =>
                                      p.id === updatedPost.id ? updatedPost : p,
                                    ),
                                  )
                                }
                              />
                            </View>
                          );
                        } else {
                          return (
                            <View
                              key={item.id}
                              onLayout={(e) => {
                                if (
                                  String(item.id) === String(scrollToPostIdRef.current)
                                ) {
                                  scrollToPostIdRef.current = null;
                                  const itemY = e.nativeEvent.layout.y;
                                  const targetY = tabContentYRef.current + itemY;
                                  setTimeout(() => {
                                    scrollViewRef.current?.scrollTo({
                                      y: Math.max(0, targetY - 60),
                                      animated: true,
                                    });
                                  }, 100);
                                }
                              }}
                            >
                              <VoicePostCard
                                key={item.id}
                                post={item}
                                onComment={(postId) => openCommentsModal(postId)}
                              />
                            </View>
                          );
                        }
                      })}
                      {loadingVoicePosts && voicePosts.length === 0 && (
                        <View style={{ paddingVertical: 20, alignItems: "center" }}>
                          <SnooLoader size="small" color={COLORS.primary} />
                        </View>
                      )}
                      {renderedCommunityLimit < allCommunityItems.length && (
                        <View style={{ paddingVertical: 20, alignItems: "center" }}>
                          <SnooLoader size="small" color={PRIMARY_COLOR} />
                        </View>
                      )}
                    </>
                  );
                })()}

                {posts.filter((p) =>
                  [
                    "poll",
                    "prompt",
                    "qna",
                    "challenge",
                    "opportunity",
                  ].includes(p.post_type || p.type),
                ).length === 0 &&
                  voicePosts.length === 0 &&
                  !loadingVoicePosts && (
                    <EmptyCommunityState
                      isOwnProfile={isOwnProfile}
                      onCreatePost={() => navigation.navigate("CreatePost")}
                    />
                  )}
              </View>
            )}

          {/* Events Tab Content */}
          {renderedProfileTab === "events" && (
            <View style={profileTabStyles.eventsContainer}>
              {loadingEvents ? (
                <View style={profileTabStyles.loadingWrap}>
                  <SnooLoader size="large" color={PRIMARY_COLOR} />
                </View>
              ) : (
                <>
                  {(() => {
                    const allEventsAndPlans = [
                      ...profileEvents.map((ev) => ({ ...ev, itemType: "event" })),
                      ...[...profilePlans.hosted, ...profilePlans.attending].map((plan) => ({ ...plan, itemType: "plan" }))
                    ];
                    const visibleEvents = allEventsAndPlans.slice(0, renderedEventsLimit);

                    return (
                      <>
                        {visibleEvents.map((item) => {
                          if (item.itemType === "event") {
                            return (
                              <EventCard
                                key={`ev-${item.id}`}
                                event={item}
                                onPress={(eventData) =>
                                  navigation.navigate("EventDetails", {
                                    eventId: eventData.id,
                                    eventData,
                                  })
                                }
                                onComment={(id) => openCommentsModal(id, "event")}
                              />
                            );
                          } else {
                            return (
                              <View
                                key={`plan-${item.id}-${item.role}`}
                                style={{ paddingHorizontal: 16 }}
                              >
                                <OpenPlanCard
                                  plan={item}
                                  currentUserId={profile?.id}
                                  onPress={(id) =>
                                    navigation.navigate("PlanDetail", {
                                      planId: id,
                                    })
                                  }
                                  onRequestPress={(id) =>
                                    setPlanRequestSheet({
                                      visible: true,
                                      planId: id,
                                    })
                                  }
                                />
                              </View>
                            );
                          }
                        })}
                        {renderedEventsLimit < allEventsAndPlans.length && (
                          <View style={{ paddingVertical: 20, alignItems: "center" }}>
                            <SnooLoader size="small" color={PRIMARY_COLOR} />
                          </View>
                        )}
                      </>
                    );
                  })()}

                  {/* Empty state */}
                  {profileEvents.length === 0 &&
                    profilePlans.hosted.length === 0 &&
                    profilePlans.attending.length === 0 && (
                      <EmptyEventsState
                        isOwnProfile={isOwnProfile}
                        title="No events yet"
                        subtitle="Events and plans you host or attend will show here."
                      />
                    )}
                </>
              )}
            </View>
          )}

          {planRequestSheet && (
            <RequestBottomSheet
              isVisible={!!planRequestSheet}
              planId={planRequestSheet.planId}
              planTitle={planRequestSheet.planTitle}
              onClose={() => setPlanRequestSheet(null)}
              onRequested={() => {
                setProfilePlans((prev) => ({
                  ...prev,
                  attending: prev.attending.map((p) =>
                    p.id === planRequestSheet.planId
                      ? { ...p, my_request_status: "pending" }
                      : p,
                  ),
                }));
                setPlanRequestSheet(null);
              }}
            />
          )}
        </ScrollView>
        {/* --- Full Post Modal Viewer --- */}
        <ProfilePostFeed
          visible={postModalVisible}
          posts={posts.filter((p) => {
            if (!profile?.is_creator_mode_enabled) return true;
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
          currentUserId={profile?.id}
          currentUserType="member"
          navigation={navigation}
          onLikeUpdate={(postId, isLiked, count) => {
            // Optimistically update local state
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
            // Placeholder for share
            Alert.alert("Share", "Sharing not implemented yet");
          }}
          onSave={(postId, isSaved) => {
            // Placeholder for save
          }}
          onFollow={() => {
            // In member profile, you typically can't follow from your own profile, but keeping signature valid
          }}
          onUserPress={(userId, userType) => {
            // Handle navigation if needed
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
          onPinToggle={handlePinToggle}
          showManagementControls={true}
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

              showToast("Success", "Post deleted successfully");
            } catch (error) {
              console.error("Error deleting post:", error);
              Alert.alert("Error", "Failed to delete post");
            }
          }}
        />

        <ActionModal
          visible={pinModalVisible}
          title={
            postForPinToggle?.is_pinned
              ? "Unpin Post"
              : oldestPinnedPost
                ? "Pin Limit Reached"
                : "Pin Post"
          }
          message={
            postForPinToggle?.is_pinned
              ? "Remove this post from your pinned posts?"
              : oldestPinnedPost
                ? `You already have ${MAX_PINS} pinned posts. Pinning this will replace your oldest pin.`
                : "Pin this post to the top of your Posts tab?"
          }
          actions={[
            {
              text: postForPinToggle?.is_pinned
                ? "Unpin"
                : oldestPinnedPost
                  ? "Replace Oldest Pin"
                  : "Pin to Top",
              onPress: async () => {
                setPinModalVisible(false);
                if (postForPinToggle)
                  await handlePinToggleConfirm(postForPinToggle);
              },
              style: oldestPinnedPost ? "warning" : "success",
            },
            {
              text: "Cancel",
              onPress: () => {
                setPinModalVisible(false);
                setOldestPinnedPost(null);
              },
              style: "cancel",
            },
          ]}
          onClose={() => {
            setPinModalVisible(false);
            setOldestPinnedPost(null);
          }}
        />

        {/* Comments Modal - Render after PostModal to ensure proper z-index */}
        <CommentsModal
          visible={commentsModalState.visible && !postModalVisible}
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
          onClose={() => {
            setCommentsModalState({
              visible: false,
              postId: null,
              postType: "post",
            });
          }}
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
                // Update selectedPost so PostModal's comment count updates immediately
                if (
                  selectedPost &&
                  selectedPost.id === commentsModalState.postId
                ) {
                  setSelectedPost((prev) =>
                    prev ? { ...prev, comment_count: newCount } : prev,
                  );
                }
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
                rootNavigator = parent.getParent
                  ? parent.getParent()
                  : parent;
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

        {/* Settings is now a Screen — navigated via navigation.navigate('Settings') */}

        {showLogoutModal && (
          <LogoutModal
            visible={showLogoutModal}
            onClose={() => setShowLogoutModal(false)}
            onLogoutCurrent={() => performLogout(false)}
            onLogoutAll={() => performLogout(true)}
            currentAccount={logoutModalData.currentAccount}
            hasMultipleAccounts={logoutModalData.hasMultiple}
          />
        )}

        {/* Old Delete Account Modal removed */}

        {/* College Hub Sheet */}
        <CollegeHubSheet
          visible={showCollegeHub}
          collegeId={profile?.college_info?.college_id}
          onClose={() => setShowCollegeHub(false)}
          currentUserId={profile?.id}
          onMemberPress={(memberId) => {
            setShowCollegeHub(false);
            navigation.navigate("MemberPublicProfile", { memberId });
          }}
          onCommunityPress={(communityId) => {
            setShowCollegeHub(false);
            navigation.navigate("CommunityPublicProfile", { communityId });
          }}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ─── Profile tab bar & events feed styles ───────────────────────────────────
const profileTabStyles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    marginTop: 20,
    marginHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
    backgroundColor: COLORS.background,
    position: "relative",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  activeTabIndicator: {
    position: "absolute",
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
    alignSelf: "stretch",
    marginHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 16,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: "center",
  },
  sectionHeader: {
    fontFamily: FONTS.bold || FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginTop: 16,
    marginBottom: 10,
    letterSpacing: 0.1,
  },
  // Event row
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface || "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
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
    backgroundColor: "#EEF2FF",
  },
  eventThumbPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  eventRowInfo: {
    flex: 1,
    gap: 3,
  },
  eventRowTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  eventRowMeta: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  eventRowSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  // Plan row
  planRow: {
    backgroundColor: COLORS.surface || "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
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
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  planLeft: { flex: 1, gap: 4 },
  planPillRow: { flexDirection: "row", gap: 6, marginBottom: 2 },
  planPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  planPillText: { fontFamily: FONTS.medium, fontSize: 11 },
  planTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  planMeta: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  // Empty
  emptyWrap: {
    paddingVertical: 48,
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  emptySubText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    paddingHorizontal: 20,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  spotifyCard: {
    backgroundColor: "#181818",
    borderRadius: 16,
    padding: 16,
    width: "100%",
    marginTop: 15,
    borderWidth: 1,
    borderColor: "#282828",
  },
  spotifyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  spotifyTitle: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
  },
  spotifyArtistsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  spotifyArtistBadge: {
    backgroundColor: "#282828",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#3E3E3E",
  },
  spotifyArtistText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: "#FFFFFF",
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
    padding: 12,
    marginLeft: -12,
  },
  username: {
    fontFamily: FONTS.primary,
    fontSize: 18,
    color: "#3B82F6",
  },
  settingsButton: {
    padding: 12, // Increased physical clickable area
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: -10, // Offset some of the new padding to keep icons aligned with header edge
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
    marginBottom: 15,
  },
  profileImage: {
    width: 125,
    height: 125,
    borderRadius: 60,
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
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: PRIMARY_COLOR,
    marginBottom: 20,
    lineHeight: 22,
  },
  bioLeft: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: "#1f2937",
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
    borderRadius: 999, // Pill shape
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: "#F2F2F7", // Default gray for non-theme chips (like See All)
  },
  chipGridItem: {
    marginRight: 8,
    marginBottom: 8,
  },
  chipFilled: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  chipText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: "#374151",
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
  bioContainer: {
    width: "100%",
    marginBottom: 20,
  },
  bioText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
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
