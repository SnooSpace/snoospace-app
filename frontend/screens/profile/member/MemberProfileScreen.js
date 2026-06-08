import React, { useState, useEffect, useCallback, useRef } from "react";
import { StyleSheet, View, Text, TouchableOpacity, Image, ScrollView, Alert, Dimensions, Modal, FlatList, KeyboardAvoidingView, Platform, TextInput, RefreshControl, Pressable } from "react-native";
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CommonActions,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import { Settings, Bookmark, ChevronDown, Play, AlertCircle, Image as LucideImage, Pin, Ticket, MapPin, Users, CalendarDays } from "lucide-react-native";
import { getHostedPlans, getAttendingPlans } from "../../../api/plans";
import {
  clearAuthSession,
  getAuthToken,
  logoutCurrentAccount,
  clearAllAccounts,
  getAllAccounts,
  getActiveAccount,
} from "../../../api/auth";
import { apiGet, apiPost, apiDelete, pinPost, unpinPost } from "../../../api/client";
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
// import { useAuthState } from "../../../contexts/AuthStateContext"; // Unused
import UnexpectedLogoutBanner from "../../../components/UnexpectedLogoutBanner";
import SnooLoader from "../../../components/ui/SnooLoader";
import EmptyPostsState from "../../../components/EmptyPostsState";
import { useToast } from "../../../context/ToastContext";
import ActionModal from "../../../components/modals/ActionModal";

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
        <Text style={styles.profileName}>{profile.name}</Text>
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

      {/* College chip — only shown when member has linked a college and show_college is on */}
      {profile.college_info && profile.show_college !== false ? (
        <View style={{ marginTop: 10, marginBottom: 16, alignItems: 'center' }}>
          <CollegeChip
            collegeInfo={profile.college_info}
            onPress={() => setShowCollegeHub(true)}
          />
        </View>
      ) : null}
    </>
  );
});

const ProfileInterestsSection = React.memo(({ interests, showAllInterests, setShowAllInterests }) => {
  if (!Array.isArray(interests) || interests.length === 0) return null;
  return (
    <View style={styles.metaChipsSection}>
      <View style={[styles.chipGridRow, { marginTop: 6 }]}>
        {(showAllInterests
          ? interests
          : interests.slice(0, 6)
        ).map((i, idx) => (
          <ThemeChip
            key={`interest-${idx}`}
            label={String(i)}
            index={idx}
            style={styles.chipGridItem}
          />
        ))}
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
});

const MemberPostGridCell = React.memo(({ item, index, itemSize, onPress, onLongPress }) => {
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
      <Reanimated.View style={[{ width: "100%", height: "100%", overflow: "hidden", borderRadius: 8 }, animatedScaleStyle]}>
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
            console.log(
              "[ProfileGrid] Image loaded successfully:",
              item.id,
            );
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
            <View style={{ transform: [{ rotate: "27deg" }], overflow: "visible" }}>
              <Pin size={10} color="#10B981" strokeWidth={2.5} fill="#10B981" />
            </View>
          </View>
        )}
      </Reanimated.View>
    </Pressable>
  );
});

export default function MemberProfileScreen({ navigation }) {
  const route = useRoute();
  console.log(
    "[Profile] MemberProfileScreen component function START (mount or render)",
  );
  const { showToast } = useToast();
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
  const [showCollegeHub, setShowCollegeHub] = useState(false);
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
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [postForPinToggle, setPostForPinToggle] = useState(null);
  const [oldestPinnedPost, setOldestPinnedPost] = useState(null);

  // Cursor-based pagination state for posts
  const [postCursor, setPostCursor] = useState(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);

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

  const MAX_PINS = 3;

  const handlePinToggle = useCallback((post, isDirect = false) => {
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
  }, [posts]);

  const handlePinToggleConfirm = async (post) => {
    try {
      const token = await getAuthToken();
      if (!token) return;
      if (post.is_pinned) {
        await unpinPost(post.id, token);
        setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, is_pinned: false } : p));
        if (selectedPost?.id === post.id) {
          setSelectedPost((prev) => prev ? { ...prev, is_pinned: false } : null);
        }
      } else {
        const currentlyPinned = posts.filter((p) => p.is_pinned);
        if (currentlyPinned.length >= MAX_PINS) {
          const oldest = [...currentlyPinned].sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at),
          )[0];
          if (oldest) await unpinPost(oldest.id, token);
          await pinPost(post.id, token);
          setPosts((prev) => prev.map((p) => {
            if (p.id === post.id) return { ...p, is_pinned: true };
            if (oldest && p.id === oldest.id) return { ...p, is_pinned: false };
            return p;
          }));
        } else {
          await pinPost(post.id, token);
          setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, is_pinned: true } : p));
        }
        if (selectedPost?.id === post.id) {
          setSelectedPost((prev) => prev ? { ...prev, is_pinned: true } : null);
        }
      }
      setOldestPinnedPost(null);
    } catch (e) {
      showToast("Failed to update pin", "error");
    }
  };

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
      } else {
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
      const [countsResponse, postsResponse, eventsResponse] = await Promise.all([
        apiGet(`/follow/counts/${userId}/${userType}`, 15000, token),
        apiGet(`/posts/user/${userId}/${userType}?limit=20`, 15000, token),
        apiGet('/events/my-events', 15000, token).catch(() => ({ events: [], total_events: 0 })),
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
        education: fullProfile.education || "",
        occupation: fullProfile.occupation || null,
        occupation_details: fullProfile.occupation_details || null,
        occupation_category: fullProfile.occupation_category || null,
        portfolio_link: fullProfile.portfolio_link || "",
        // College fields — required by EditProfileScreen
        campus_id: fullProfile.campus_id || null,
        show_college: fullProfile.show_college !== false,
        college_info: fullProfile.college_info || null,
        follower_count: followerCount,
        following_count: followingCount,
        events_attended_count: eventsResponse?.total_events ?? (eventsResponse?.events?.length ?? 0),
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
      // Pre-populate events — but do NOT set eventsFetchedRef here.
      // Plans are fetched by loadProfileEvents() which runs on first Events tab tap.
      // Setting the ref here would skip the plan fetch.
      if (Array.isArray(eventsResponse?.events) && eventsResponse.events.length > 0) {
        setProfileEvents(eventsResponse.events);
      }
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

  // Lazy load events/plans when user first taps the Events tab (own profile)
  const loadProfileEvents = useCallback(async () => {
    if (loadingEvents) return;
    try {
      setLoadingEvents(true);
      const token = await getAuthToken();
      const [eventsRes, hostedRes, attendingRes] = await Promise.all([
        apiGet('/events/my-events', 15000, token).catch(() => ({ events: [] })),
        getHostedPlans(token).catch(() => ({ plans: [] })),
        getAttendingPlans(token).catch(() => ({ plans: [] })),
      ]);
      setProfileEvents(eventsRes?.events || []);
      setProfilePlans({
        hosted: (hostedRes?.plans || []).map((p) => ({ ...p, role: 'host' })),
        attending: (attendingRes?.plans || []).map((p) => ({ ...p, role: 'attendee' })),
      });
    } catch (err) {
      console.error('[MemberProfile] loadProfileEvents error:', err);
    } finally {
      setLoadingEvents(false);
    }
  }, [loadingEvents]);

  // Handle pull-to-refresh
  const onRefresh = useCallback(() => {
    console.log("[Profile] onRefresh: user pulled to refresh");
    loadProfile(true);
    if (activeProfileTab === 'events') {
      eventsFetchedRef.current = false;
      loadProfileEvents();
    }
  }, [activeProfileTab, loadProfileEvents]);

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
    useCallback(() => {
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
    const gap = 2;
  const itemSize = (screenWidth - gap * 2) / 3;

  const renderGridItem = useCallback(({ item, index }) => {
    return (
      <MemberPostGridCell
        item={item}
        index={index}
        itemSize={itemSize}
        onPress={openPostModal}
        onLongPress={handlePinToggle}
      />
    );
  }, [itemSize, openPostModal, handlePinToggle]);

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
            <AlertCircle
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
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Text style={styles.username}>@{profile.username}</Text>
          <ChevronDown size={26} color="#3B82F6" style={{ marginLeft: -2 }} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate("SavedPostsScreen")}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Bookmark size={26} color={COLORS.editorial.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setShowSettingsModal(true)}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Settings size={26} color={COLORS.editorial.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        key={activeProfileTab === 'posts' ? 'posts-3col' : 'events-1col'}
        data={activeProfileTab === 'posts' ? posts : []}
        keyExtractor={(item) => String(item.id)}
        renderItem={activeProfileTab === 'posts' ? renderGridItem : null}
        numColumns={activeProfileTab === 'posts' ? 3 : 1}
        columnWrapperStyle={
          activeProfileTab === 'posts'
            ? { justifyContent: "flex-start", marginBottom: gap, gap: gap }
            : undefined
        }
        contentContainerStyle={{
          paddingBottom: 120,
          flexGrow: 1,
        }}
        initialNumToRender={12}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        updateCellsBatchingPeriod={50}
        getItemLayout={activeProfileTab === 'posts' ? (data, index) => ({
          length: itemSize * 1.35,
          offset: (itemSize * 1.35 + gap) * Math.floor(index / 3),
          index,
        }) : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PRIMARY_COLOR}
            colors={[PRIMARY_COLOR]}
          />
        }
        onEndReached={() => {
          if (activeProfileTab === 'posts' && !loading && !loadingMorePosts && hasMorePosts) {
            loadMorePosts();
          }
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={styles.profileSection}>
            <ProfileBioHeader
              profile={profile}
              setShowCollegeHub={setShowCollegeHub}
            />

            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{posts.length}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <TouchableOpacity
                style={styles.statItem}
                onPress={() => {
                  setActiveProfileTab('events');
                  if (!eventsFetchedRef.current) {
                    eventsFetchedRef.current = true;
                    loadProfileEvents();
                  }
                }}
              >
                <Text style={styles.statNumber}>{profile.events_attended_count ?? 0}</Text>
                <Text style={styles.statLabel}>Events</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.statItem}
                onPress={() => {
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
            <ProfileInterestsSection
              interests={profile.interests}
              showAllInterests={showAllInterests}
              setShowAllInterests={setShowAllInterests}
            />

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

            {/* Posts / Events Tab Bar */}
            <View style={profileTabStyles.tabBar}>
              {['posts', 'events'].map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={profileTabStyles.tab}
                  onLayout={(e) => handleTabLayout(tab, e)}
                  onPress={() => {
                    HapticsService.triggerImpactLight();
                    setActiveProfileTab(tab);
                    if (tab === 'events' && !eventsFetchedRef.current) {
                      eventsFetchedRef.current = true;
                      loadProfileEvents();
                    }
                  }}
                >
                  <Text style={[
                    profileTabStyles.tabText,
                    activeProfileTab === tab && profileTabStyles.tabTextActive,
                  ]}>
                    {tab === 'posts' ? 'Posts' : 'Events'}
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

            {/* Events Tab Content */}
            {activeProfileTab === 'events' && (
              <View style={profileTabStyles.eventsContainer}>
                {loadingEvents ? (
                  <View style={profileTabStyles.loadingWrap}>
                    <SnooLoader size="large" color={PRIMARY_COLOR} />
                  </View>
                ) : (
                  <>
                    {/* Attended Events */}
                    {profileEvents.length > 0 && (
                      <>
                        <Text style={profileTabStyles.sectionHeader}>Events Attended</Text>
                        {profileEvents.map((ev) => {
                          const d = ev.start_datetime ? new Date(ev.start_datetime) : null;
                          const dateStr = d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
                          return (
                            <TouchableOpacity
                              key={`ev-${ev.id}`}
                              style={profileTabStyles.eventRow}
                              onPress={() => navigation.navigate('EventDetails', { eventId: ev.id, eventData: ev })}
                              activeOpacity={0.82}
                            >
                              {ev.banner_url ? (
                                <Image source={{ uri: ev.banner_url }} style={profileTabStyles.eventThumb} />
                              ) : (
                                <View style={[profileTabStyles.eventThumb, profileTabStyles.eventThumbPlaceholder]}>
                                  <Ticket size={20} color={COLORS.primary} strokeWidth={2} />
                                </View>
                              )}
                              <View style={profileTabStyles.eventRowInfo}>
                                <Text style={profileTabStyles.eventRowTitle} numberOfLines={1}>{ev.title}</Text>
                                {dateStr ? <Text style={profileTabStyles.eventRowMeta}>{dateStr}</Text> : null}
                                {ev.community_name ? (
                                  <Text style={profileTabStyles.eventRowSub} numberOfLines={1}>{ev.community_name}</Text>
                                ) : null}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </>
                    )}

                    {/* Open Plans */}
                    {(profilePlans.hosted.length > 0 || profilePlans.attending.length > 0) && (
                      <>
                        <Text style={profileTabStyles.sectionHeader}>Open Plans</Text>
                        {[...profilePlans.hosted, ...profilePlans.attending].map((plan) => {
                          const d = plan.scheduled_at ? new Date(plan.scheduled_at) : null;
                          const dateStr = d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
                          const actColors = { sports: '#EEF2FF', study: '#E8F5E9', food: '#FFF8E1', gaming: '#FCE4EC', other: '#F5F5F5' };
                          const actTextColors = { sports: '#3B5BDB', study: '#2E7D32', food: '#B45309', gaming: '#C2185B', other: '#555555' };
                          const actKey = actColors[plan.activity_type] ? plan.activity_type : 'other';
                          const actLabel = plan.activity_type === 'other' ? (plan.custom_activity_label || 'Other') : plan.activity_type.charAt(0).toUpperCase() + plan.activity_type.slice(1);
                          const isHost = plan.role === 'host';
                          return (
                            <TouchableOpacity
                              key={`plan-${plan.id}-${plan.role}`}
                              style={profileTabStyles.planRow}
                              onPress={() => isHost
                                ? navigation.navigate('HostRequests', { planId: plan.id, planTitle: plan.title })
                                : navigation.navigate('PlanDetail', { planId: plan.id })
                              }
                              activeOpacity={0.82}
                            >
                              {/* Icon avatar */}
                              <View style={[profileTabStyles.planIconWrap, { backgroundColor: actColors[actKey] }]}>
                                <CalendarDays size={18} color={actTextColors[actKey]} strokeWidth={2} />
                              </View>
                              <View style={profileTabStyles.planLeft}>
                                <View style={profileTabStyles.planPillRow}>
                                  <View style={[profileTabStyles.planPill, { backgroundColor: isHost ? '#EEF2FF' : '#E8F5E9' }]}>
                                    <Text style={[profileTabStyles.planPillText, { color: isHost ? '#3B5BDB' : '#2E7D32' }]}>{isHost ? 'Hosting' : 'Attending'}</Text>
                                  </View>
                                  <View style={[profileTabStyles.planPill, { backgroundColor: actColors[actKey] + '99' }]}>
                                    <Text style={[profileTabStyles.planPillText, { color: actTextColors[actKey] }]}>{actLabel}</Text>
                                  </View>
                                </View>
                                <Text style={profileTabStyles.planTitle} numberOfLines={1}>{plan.title}</Text>
                                <Text style={profileTabStyles.planMeta}>
                                  {dateStr}{plan.location_public ? ` · ${plan.location_public}` : ''}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </>
                    )}

                    {/* Empty state */}
                    {profileEvents.length === 0 && profilePlans.hosted.length === 0 && profilePlans.attending.length === 0 && (
                      <View style={profileTabStyles.emptyWrap}>
                        <Ticket size={36} color={COLORS.textSecondary} strokeWidth={1.5} />
                        <Text style={profileTabStyles.emptyText}>No events yet</Text>
                        <Text style={profileTabStyles.emptySubText}>Events and plans you attend will show here.</Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          activeProfileTab === 'posts' ? <EmptyPostsState isOwnProfile={isOwnProfile} /> : null
        }
        ListFooterComponent={
          loadingMorePosts && activeProfileTab === 'posts' ? (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <SnooLoader size="small" color={COLORS.primary} />
            </View>
          ) : null
        }
      />
      {/* --- Full Post Modal Viewer --- */}
      <ProfilePostFeed
        visible={postModalVisible}
        posts={posts}
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
              if (postForPinToggle) await handlePinToggleConfirm(postForPinToggle);
            },
            style: oldestPinnedPost ? "warning" : "success",
          },
          {
            text: "Cancel",
            onPress: () => { setPinModalVisible(false); setOldestPinnedPost(null); },
            style: "cancel",
          },
        ]}
        onClose={() => { setPinModalVisible(false); setOldestPinnedPost(null); }}
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

      {showAccountSwitcher && (
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
      )}

      {showAddAccountModal && (
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
      )}

      <SettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onNotificationsPress={handleEditProfile}
        onPrivacyPress={() => {
          setShowSettingsModal(false);
          // Navigate to MyDataScreen via root navigator (AppNavigator level)
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
        }}
        onHelpPress={() =>
          Alert.alert("Help", "Help & Support will be implemented soon!")
        }
        onAddAccountPress={() => setShowAddAccountModal(true)}
        onLogoutPress={handleLogout}
        onDeleteAccountPress={() => navigation.navigate("DeleteAccount")}
        hapticsEnabled={hapticsEnabled}
        onToggleHaptics={handleToggleHaptics}
        textColor={TEXT_COLOR}
        lightTextColor={LIGHT_TEXT_COLOR}
      />

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
          navigation.navigate('MemberPublicProfile', { memberId });
        }}
        onCommunityPress={(communityId) => {
          setShowCollegeHub(false);
          navigation.navigate("CommunityPublicProfile", { communityId });
        }}
      />
    </SafeAreaView>
  );
}

// ─── Profile tab bar & events feed styles ───────────────────────────────────
const profileTabStyles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    marginTop: 20,
    marginHorizontal: -20, // extend to screen edge (cancel profileSection padding)
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
    paddingHorizontal: 16,
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
  // Event row
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
  // Empty
  emptyWrap: {
    paddingVertical: 48,
    alignItems: 'center',
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
