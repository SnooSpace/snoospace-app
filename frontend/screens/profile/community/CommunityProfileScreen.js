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
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Animated,
  Linking,
  Pressable,
} from "react-native";
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { Image as ExpoImage } from "expo-image";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { BlurView } from "expo-blur";

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
  Clock,
  Video,
  MapPin,
  AlertCircle,
  MoreHorizontal,
  EyeOff,
  Eye,
  Pin,
  PinOff,
  Mail,
  Phone,
  User,
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
import EventCard from "../../../components/EventCard";
import { deleteAccount as apiDeleteAccount } from "../../../api/account";
import { getActiveAccount } from "../../../api/auth";
import {
  hasDraft,
  loadDraft as loadDraftUtil,
  deleteDraft as deleteDraftUtil,
  formatLastSaved,
} from "../../../utils/draftStorage";
import { apiGet, apiPost, apiDelete, pinPost, unpinPost, pinOpportunity, unpinOpportunity } from "../../../api/client";
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
import OpportunityFeedCard from "../../../components/OpportunityFeedCard";
import VideoPlayer from "../../../components/VideoPlayer";
import CommentsModal from "../../../components/CommentsModal";
// SettingsModal deprecated — replaced by SettingsScreen
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
import SnooLoader from "../../../components/ui/SnooLoader";
import GradientSafeArea from "../../../components/GradientSafeArea";
import CollegeChip from "../../../components/CollegeChip";
import CollegeHubSheet from "../../../components/modals/CollegeHubSheet";
import EmptyPostsState from "../../../components/EmptyPostsState";
import EmptyCommunityState from "../../../components/EmptyCommunityState";
import EmptyEventsState from "../../../components/EmptyEventsState";
import CreateEventModal from "../../../components/modals/CreateEventModal";
import ActionModal from "../../../components/modals/ActionModal";
import { useToast } from "../../../context/ToastContext";

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

const CommunityProfileHeaderBioSection = React.memo(({
  profile,
  insets,
  bannerUploading,
  onBannerAction,
  onShowAccountSwitcher,
  onShowCollegeHub,
  onShowSettings,
  onShowBookmark,
}) => {
  return (
    <>
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
            onPress={onBannerAction}
          >
            {bannerUploading ? (
              <SnooLoader size="small" color="#fff" />
            ) : (
              <Camera size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      )}

      <View
        style={[
          styles.summarySection,
          !profile.banner_url && { paddingTop: insets.top + 60 },
          { position: "relative" }
        ]}
      >
        {/* Render Settings and Bookmark/Saved icons below the banner on the right side */}
        {profile.banner_url && (
          <View style={styles.settingsIconsRowAbsolute}>
            <TouchableOpacity
              style={styles.settingsIconInline}
              onPress={onShowBookmark}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Bookmark size={22} color="#475569" strokeWidth={2.2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsIconInline}
              onPress={onShowSettings}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Settings size={22} color="#475569" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        )}
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
            onPress={onShowAccountSwitcher}
          >
            <View style={{ width: 26 }} />
            <Text style={styles.usernameText}>
              {profile.username ? `@${profile.username}` : ""}
            </Text>
            <ChevronDown
              size={26}
              color="#3B82F6"
              style={{ marginLeft: 2 }}
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

          {/* College Chip — shown for college-affiliated communities */}
          {profile.college_info && (
            <View style={{ marginTop: 8 }}>
              <CollegeChip
                collegeInfo={profile.college_info}
                onPress={onShowCollegeHub}
              />
            </View>
          )}

          {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        </View>
      </View>
    </>
  );
});

const CommunityProfileHostsAndSponsors = React.memo(({
  profile,
  onHeadPress,
  onShowHeadsMenu,
  navigation,
}) => {
  return (
    <View style={styles.summarySection}>
      {profile.show_heads !== false && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {profile.heads && profile.heads.length > 1
                ? "Meet the Hosts"
                : "Meet the Host"}
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <TouchableOpacity onPress={() => {
                HapticsService.triggerImpactLight();
                navigation.navigate("CommunityHosts", {
                  initialHeads: profile?.heads || [],
                  maxHeads: 5,
                });
              }}>
                <Pencil size={20} color={PRIMARY_COLOR} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onShowHeadsMenu}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MoreHorizontal size={20} color={LIGHT_TEXT_COLOR} />
              </TouchableOpacity>
            </View>
          </View>
          {profile.heads && profile.heads.length > 0 ? (
            <View style={{ paddingVertical: 4 }}>
              {profile.heads.map((head, index) => {
                const isClickable = !!head.member_id || !!head.email || !!head.phone;
                return (
                  <TouchableOpacity
                    key={head.id || index}
                    onPress={() => onHeadPress(head)}
                    disabled={!isClickable}
                    style={[
                      styles.headRow,
                      !isClickable && { opacity: 0.85 },
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
                      {(head.email || head.phone) ? (
                        <Text style={styles.headSub} numberOfLines={1}>
                          {[head.email, head.phone].filter(Boolean).join("  •  ")}
                        </Text>
                      ) : null}
                    </View>
                    {isClickable && (
                      <ChevronRight size={20} color={LIGHT_TEXT_COLOR} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>No hosts added yet</Text>
          )}
        </View>
      )}

      {profile.show_heads === false && (
        <View style={[styles.sectionCard, { borderColor: "rgba(0,0,0,0.05)" }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {profile.heads && profile.heads.length > 1
                ? "Meet the Hosts"
                : "Meet the Host"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <TouchableOpacity onPress={() => {
                HapticsService.triggerImpactLight();
                navigation.navigate("CommunityHosts", {
                  initialHeads: profile?.heads || [],
                  maxHeads: 5,
                });
              }}>
                <Pencil size={20} color={PRIMARY_COLOR} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onShowHeadsMenu}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MoreHorizontal size={20} color={LIGHT_TEXT_COLOR} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: "rgba(245, 158, 11, 0.08)",
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}>
            <EyeOff size={15} color="#B45309" strokeWidth={2} />
            <Text style={{
              fontFamily: FONTS.regular,
              fontSize: 13,
              color: "#B45309",
              flex: 1,
            }}>
              This section is hidden from your public profile
            </Text>
          </View>
        </View>
      )}

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
                index={index}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
});

const CommunityPostGridCell = React.memo(({ item, itemSize, onPress, onLongPress }) => {
  const scale = useSharedValue(1);

  const animatedScaleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const gap = 2;
  let firstImageUrl = null;
  if (item?.image_urls) {
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
        marginRight: 0,
      }}
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
      <Reanimated.View style={[{ width: "100%", height: "100%", overflow: "hidden", borderRadius: 3 }, animatedScaleStyle]}>
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

        {mediaUrl ? (
          <>
            <ExpoImage
              source={{ uri: mediaUrl }}
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: "#E5E5EA",
              }}
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
          <View
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#E5E5EA",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <LucideImage size={30} color={COLORS.textSecondary || "#8E8E93"} />
          </View>
        )}
      </Reanimated.View>
    </Pressable>
  );
});

export default function CommunityProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadCompleted, setInitialLoadCompleted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Settings is now a Screen — no modal state needed
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
  const [showHeadsMenu, setShowHeadsMenu] = useState(false);
  const [showCollegeHub, setShowCollegeHub] = useState(false);
  const pendingPostUpdateRef = useRef(null);
  const hasInitialLoadRef = useRef(false);
  const initialLoadCompletedRef = useRef(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserType, setCurrentUserType] = useState(null);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [selectedHeadForContact, setSelectedHeadForContact] = useState(null);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [postForPinToggle, setPostForPinToggle] = useState(null);
  const [oldestPinnedPost, setOldestPinnedPost] = useState(null); // Set when at 3-pin limit

  // Event Creation
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [draftLastSaved, setDraftLastSaved] = useState(null);
  const [resumeDraft, setResumeDraft] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    title: "",
    message: "",
    actions: [],
  });

  // Tab underline animation (Reanimated)
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

  // Real-time counts polling (5-second interval)
  // Pauses when modals are open to avoid distracting updates
  const isAnyModalOpen =
    postModalVisible ||
    showAccountSwitcher ||
    showAddAccountModal ||
    showLogoutModal ||
    showDeleteModal ||
    showHeadsMenu ||
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

  // Handle actions triggered from SettingsScreen via EventBus
  useEffect(() => {
    const handleSettingsAction = ({ action } = {}) => {
      if (action === 'logout') {
        handleLogout();
      } else if (action === 'add_account') {
        setShowAddAccountModal(true);
      } else if (action === 'switch_account') {
        setShowAccountSwitcher(true);
      } else if (action === 'my_activity') {
        navigation.navigate('MyDataScreen');
      }
    };
    const unsub = EventBus.on('settings:action', handleSettingsAction);
    return () => { if (unsub) unsub(); };
  }, [navigation]);

  // Keep profile.instagram_username in sync when user links/unlinks from LinkedAccountsScreen
  useEffect(() => {
    const unsub = EventBus.on('instagram:updated', ({ username }) => {
      setProfile((prev) => prev ? { ...prev, instagram_username: username || null } : prev);
    });
    return () => { if (unsub) unsub(); };
  }, []);

  const handleShowAccountSwitcher = useCallback(() => {
    setShowAccountSwitcher(true);
  }, []);

  const handleShowCollegeHub = useCallback(() => {
    setShowCollegeHub(true);
  }, []);

  const handleShowHeadsMenu = useCallback(() => {
    setShowHeadsMenu(true);
  }, []);

  const MAX_PINS = 3;

  // Community-tab post types (Poll, Prompt, QnA, Challenge, Opportunity)
  const COMMUNITY_TAB_TYPES = ["poll", "prompt", "qna", "challenge", "opportunity"];
  const isCommunityTabPost = (p) =>
    COMMUNITY_TAB_TYPES.includes(p.post_type || p.type);

  const handlePinToggle = useCallback((post, isDirect = false) => {
    HapticsService.triggerImpactLight();

    if (isDirect) {
      handlePinToggleConfirm(post);
      return;
    }

    // If unpinning, no limit check needed
    if (post.is_pinned) {
      setOldestPinnedPost(null);
      setPostForPinToggle(post);
      setPinModalVisible(true);
      return;
    }

    // Count pinned posts only within the SAME tab as this post
    const isCommunity = isCommunityTabPost(post);
    const currentlyPinned = posts.filter(
      (p) => p.is_pinned && isCommunityTabPost(p) === isCommunity,
    );

    if (currentlyPinned.length >= MAX_PINS) {
      // Find the oldest pinned post (by created_at) within the same tab
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

      const isOpportunity = post.post_type === "opportunity";

      if (post.is_pinned) {
        // Unpinning
        if (isOpportunity) {
          await unpinOpportunity(post.id, token);
        } else {
          await unpinPost(post.id, token);
        }
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id ? { ...p, is_pinned: false } : p,
          ),
        );
        if (selectedPost?.id === post.id) {
          setSelectedPost((prev) => prev ? { ...prev, is_pinned: false } : null);
        }
      } else {
        // Pinning — count only same-tab pins
        const isCommunity = isCommunityTabPost(post);
        const currentlyPinned = posts.filter(
          (p) => p.is_pinned && isCommunityTabPost(p) === isCommunity,
        );

        if (currentlyPinned.length >= MAX_PINS) {
          const oldest = [...currentlyPinned].sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at),
          )[0];
          if (oldest) {
            // Unpin the oldest first
            if (oldest.post_type === "opportunity") {
              await unpinOpportunity(oldest.id, token);
            } else {
              await unpinPost(oldest.id, token);
            }
          }
          // Pin the new one, reflect both changes in state
          if (isOpportunity) {
            await pinOpportunity(post.id, token);
          } else {
            await pinPost(post.id, token);
          }
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === post.id) return { ...p, is_pinned: true };
              if (oldest && p.id === oldest.id) return { ...p, is_pinned: false };
              return p;
            }),
          );
        } else {
          // Under the limit — just pin
          if (isOpportunity) {
            await pinOpportunity(post.id, token);
          } else {
            await pinPost(post.id, token);
          }
          setPosts((prev) =>
            prev.map((p) =>
              p.id === post.id ? { ...p, is_pinned: true } : p,
            ),
          );
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


  useEffect(() => {
    // Underline sliding animation
    if (tabOffsets[activeTab] !== undefined) {
      tabUnderlineX.value = withTiming(tabOffsets[activeTab], { duration: 200 });
      tabUnderlineScale.value = withTiming(tabWidths[activeTab], { duration: 200 });
    }
  }, [activeTab]);

  const handleTabLayout = (tab, event) => {
    const { x, width } = event.nativeEvent.layout;
    tabOffsets[tab] = x;
    tabWidths[tab] = width;

    // Set initial position for active tab underline
    if (tab === activeTab) {
      tabUnderlineX.value = x;
      tabUnderlineScale.value = width;
    }
  };

  const handleCreateEvent = async () => {
    try {
      const account = await getActiveAccount();
      if (!account?.id) {
        setResumeDraft(false);
        setShowCreateEventModal(true);
        return;
      }
      const exists = await hasDraft(account.id);
      if (exists) {
        const draft = await loadDraftUtil(account.id);
        setDraftLastSaved(draft.lastSaved);
        setShowDraftPrompt(true);
      } else {
        setResumeDraft(false);
        setShowCreateEventModal(true);
      }
    } catch (e) {
      console.error("Draft check error:", e);
      setResumeDraft(false);
      setShowCreateEventModal(true);
    }
  };

  const handleEventCreated = () => {
    // Reload events
    loadProfile();
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

    const handlePostViewUpdate = (payload) => {
      if (!payload?.postId) return;
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === payload.postId
            ? { ...post, public_view_count: (post.public_view_count || 0) + 1 }
            : post,
        ),
      );
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
    };

    const unsubscribeView = EventBus.on("post-view-updated", handlePostViewUpdate);
    const unsubscribeShare = EventBus.on("post-share-updated", handlePostShareUpdate);
    const unsubscribeSave = EventBus.on("post-save-updated", handlePostSaveUpdate);

    return () => {
      if (unsubscribeLike) unsubscribeLike();
      if (unsubscribeComment) unsubscribeComment();
      if (unsubscribeView) unsubscribeView();
      if (unsubscribeShare) unsubscribeShare();
      if (unsubscribeSave) unsubscribeSave();
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
        console.log('[CommunityProfile] RAW fullProfile college fields:', {
          community_type: fullProfile?.community_type,
          college_id: fullProfile?.college_id,
          campus_id: fullProfile?.campus_id,
          college_info: fullProfile?.college_info,
        });
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

      // Fetch community's own opportunities (separate table, not in posts)
      // and merge them into the combined posts list with post_type: "opportunity"
      try {
        const oppsRes = await apiGet("/opportunities", 15000, token);
        const rawOpps = Array.isArray(oppsRes?.opportunities)
          ? oppsRes.opportunities
          : [];
        const normalizedOpps = rawOpps
          .filter((o) => o.status === "active" || o.status === "draft")
          .map((o) => ({
            ...o,
            post_type: "opportunity",
            // Map opportunity fields to post-compatible shape where needed
            creator_id: o.creator_id || userId,
            creator_type: o.creator_type || userType,
            // Inject creator profile info (GET /opportunities doesn't return these)
            creator_name: o.creator_name || fullProfile?.name || fullProfile?.full_name || "Community",
            creator_photo: o.creator_photo || fullProfile?.logo_url || fullProfile?.profile_photo_url || null,
            creator_username: o.creator_username || fullProfile?.username || "",
            // Use API-returned is_liked/is_saved — do NOT hardcode false
            is_liked: o.is_liked === true,
            is_saved: o.is_saved === true,
            like_count: o.like_count || 0,
            comment_count: o.comment_count || 0,
            view_count: o.view_count || 0,
            is_pinned: o.is_pinned || false,
          }));
        userPosts = [...userPosts, ...normalizedOpps];
        console.log(
          `[CommunityProfile] Merged ${normalizedOpps.length} opportunities into posts. Total: ${userPosts.length}`,
        );
      } catch (oppErr) {
        console.log("[CommunityProfile] Failed to load opportunities:", oppErr);
      }

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
        show_heads: fullProfile?.show_heads !== false, // default true
        follower_count: followerCount,
        following_count: followingCount,
        post_count: userPosts.length,
        events_scheduled_count: fullProfile?.events_scheduled_count || 0,
        events_hosted_count: fullProfile?.events_hosted_count || 0,
        college_info: fullProfile?.college_info || null,
      };
      console.log('[CommunityProfile] mappedProfile.college_info:', mappedProfile.college_info);

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


  const handleHeadPress = useCallback((head) => {
    if (!head) return;
    const hasProfile = !!head.member_id;
    const hasEmail = !!head.email;
    const hasPhone = !!head.phone;

    if (!hasProfile && !hasEmail && !hasPhone) return;

    HapticsService.triggerImpactLight();

    const navigateToProfile = (memberId) => {
      navigation.navigate("MemberPublicProfile", {
        memberId: memberId,
      });
    };

    // If ONLY profile is available and no other details, directly navigate
    if (hasProfile && !hasEmail && !hasPhone) {
      navigateToProfile(head.member_id);
      return;
    }

    setSelectedHeadForContact(head);
    setContactModalVisible(true);
  }, [navigation]);

  const postsCount =
    polledCounts.posts || (profile?.posts_count ?? profile?.post_count ?? 0);
  const followersCount =
    polledCounts.followers ||
    (profile?.followers_count ?? profile?.follower_count ?? 0);
  const followingCount =
    polledCounts.following ||
    (profile?.following_count ?? profile?.following ?? 0);

  const openPostModal = useCallback((post) => {
    // Normalize is_liked field - only use is_liked, ignore isLiked completely
    const normalizedIsLiked = post.is_liked === true;
    const normalizedPost = {
      ...post,
      is_liked: normalizedIsLiked,
      isLiked: normalizedIsLiked,
    };
    setSelectedPost(normalizedPost);
    setPostModalVisible(true);
  }, []);

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

  const renderGridItem = useCallback(({ item }) => {
    const itemSize = (screenWidth - 2 * 2) / 3;
    return (
      <CommunityPostGridCell
        item={item}
        itemSize={itemSize}
        onPress={openPostModal}
        onLongPress={handlePinToggle}
      />
    );
  }, [openPostModal, handlePinToggle]);

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
  return (
    <View style={styles.container}>
      <DynamicStatusBar style="light-content" />

      {/* Add gradient overlay only when no banner */}
      {!profile.banner_url && <GradientSafeArea variant="primary" />}

      {/* Custom Fixed Header (Status Bar Scrim Only) */}
      {/* Custom Fixed Header */}
      <View style={[styles.headerContainer, { height: insets.top + 50 }]}>
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

        {/* Header Content containing Settings and Saved Icons (Only when no banner) */}
        {!profile.banner_url && (
          <View style={[styles.headerContent, { marginTop: insets.top }]}>
            <View style={{ flex: 1 }} />
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => navigation.navigate("SavedPostsScreen")}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Bookmark size={24} color="#0F172A" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => {
                  HapticsService.triggerImpactLight();
                  navigation.navigate('Settings', { profile, hapticsEnabled });
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Settings size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>
          </View>
        )}
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
        <CommunityProfileHeaderBioSection
          profile={profile}
          insets={insets}
          bannerUploading={bannerUploading}
          onBannerAction={handleBannerAction}
          onShowAccountSwitcher={handleShowAccountSwitcher}
          onShowCollegeHub={handleShowCollegeHub}
          onShowSettings={() => {
            HapticsService.triggerImpactLight();
            navigation.navigate('Settings', { profile, hapticsEnabled });
          }}
          onShowBookmark={() => navigation.navigate("SavedPostsScreen")}
        />

        <View style={styles.summarySection}>
          {/* Stats Row */}
          <View style={[styles.statsRow, { justifyContent: "space-evenly" }]}>
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
              <Text style={styles.statNumber}>{followersCount}</Text>
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
              <Text style={styles.statNumber}>{followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </TouchableOpacity>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{postsCount}</Text>
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
        </View>

        <CommunityProfileHostsAndSponsors
          profile={profile}
          onHeadPress={handleHeadPress}
          onShowHeadsMenu={handleShowHeadsMenu}
          navigation={navigation}
        />

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
          <Reanimated.View
            style={[
              styles.activeTabIndicator,
              animatedUnderlineStyle,
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

              const gap = 2;
              const itemSize = (screenWidth - gap * 2) / 3;
              const numRows = Math.ceil(mediaPosts.length / 3);
              const gridHeight = numRows > 0 ? numRows * (itemSize * 1.35) + (numRows - 1) * gap : 0;

              return mediaPosts.length > 0 ? (
                <View style={[styles.postsGrid, { height: gridHeight }]}>
                  <FlatList
                    data={mediaPosts}
                    keyExtractor={(item) => String(item.id)}
                    numColumns={3}
                    scrollEnabled={false}
                    columnWrapperStyle={{
                      justifyContent: "flex-start",
                      marginBottom: gap,
                      gap: gap,
                    }}
                    renderItem={renderGridItem}
                    initialNumToRender={12}
                    maxToRenderPerBatch={6}
                    windowSize={5}
                    removeClippedSubviews={Platform.OS === 'android'}
                    updateCellsBatchingPeriod={50}
                    getItemLayout={(data, index) => ({
                      length: itemSize * 1.35,
                      offset: (itemSize * 1.35 + gap) * Math.floor(index / 3),
                      index,
                    })}
                  />
                </View>
              ) : (
                <EmptyPostsState
                  isOwnProfile={true}
                  onCreatePost={() => {
                    navigation.navigate("CommunityCreatePost", {
                      role: "community",
                    });
                  }}
                />
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

              // Sort: pinned first, then by created_at
              const sortedPosts = [...interactivePosts].sort((a, b) => {
                if (a.is_pinned && !b.is_pinned) return -1;
                if (!a.is_pinned && b.is_pinned) return 1;
                return new Date(b.created_at) - new Date(a.created_at);
              });

              return sortedPosts.length > 0 ? (
                <View style={styles.communityPostsList}>
                  {sortedPosts.map((post) => {
                    const postType = post.post_type || post.type;
                    const isOpportunity = postType === "opportunity";
                    return (
                      <View key={post.id} style={styles.communityPostItem}>
                        {isOpportunity ? (
                          <OpportunityFeedCard
                            opportunity={post}
                            showManagementControls={true}
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
                            onPinToggle={() => handlePinToggle(post)}
                            onDelete={(opportunityId) => {
                              setPosts((prev) => prev.filter((p) => p.id !== opportunityId));
                            }}
                            onUserPress={(userId, userType) => {
                              if (userType === "community") {
                                navigation.navigate("CommunityPublicProfile", {
                                  communityId: userId,
                                  viewerRole: "community",
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
                            currentUserType={currentUserType}
                            onUserPress={(userId, userType) => {}}
                            onDelete={async (postId) => {
                              try {
                                const token = await getAuthToken();
                                if (!token) return;
                                await apiDelete(`/posts/${postId}`, null, 15000, token);
                                setPosts((prevPosts) => prevPosts.filter((p) => p.id !== postId));
                                EventBus.emit("post-deleted", { postId });
                              } catch (error) {
                                console.error("Error deleting post:", error);
                                Alert.alert("Error", "Failed to delete post");
                              }
                            }}
                            onPinToggle={handlePinToggle}
                            showManagementControls={true}
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
              ) : (
                <EmptyCommunityState
                  isOwnProfile={true}
                  onCreatePost={() => {
                    navigation.navigate("CommunityCreatePost", {
                      role: "community",
                    });
                  }}
                />
              );
            })()}

          {/* Events Tab */}
          {activeTab === "events" &&
            (() => {
              if (communityEvents.length === 0) {
                return (
                  <EmptyEventsState
                    isOwnProfile={true}
                    onCreateEvent={handleCreateEvent}
                  />
                );
              }

              return (
                <View style={{ paddingTop: 16 }}>
                  {communityEvents.map((item) => (
                    <EventCard
                      key={item.id}
                      event={item}
                      onPress={(eventData) =>
                        navigation.navigate("EventDetails", {
                          eventId: eventData.id,
                          eventData: eventData,
                        })
                      }
                    />
                  ))}
                </View>
              );
            })()}
        </View>
      </Animated.ScrollView>

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

      {/* Meet the Host — Hide/Show action modal */}
      {showHeadsMenu && (
        <Modal
          visible={showHeadsMenu}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setShowHeadsMenu(false)}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.4)",
              justifyContent: "flex-end",
            }}
            activeOpacity={1}
            onPress={() => setShowHeadsMenu(false)}
          >
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingTop: 12,
                paddingBottom: 36,
                paddingHorizontal: 20,
              }}
            >
              {/* Handle bar */}
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: "#E5E7EB",
                  alignSelf: "center",
                  marginBottom: 20,
                }}
              />
              <Text
                style={{
                  fontFamily: FONTS.primary,
                  fontSize: 16,
                  color: TEXT_COLOR,
                  marginBottom: 16,
                }}
              >
                Meet the Host
              </Text>

              {/* Hide / Show option */}
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  paddingVertical: 14,
                  borderRadius: 16,
                }}
                onPress={async () => {
                  setShowHeadsMenu(false);
                  const newVal = profile.show_heads === false ? true : false;
                  // Optimistic local update
                  setProfile((prev) =>
                    prev ? { ...prev, show_heads: newVal } : prev,
                  );
                  try {
                    await updateCommunityProfile({ show_heads: newVal });
                  } catch (e) {
                    // Revert on error
                    setProfile((prev) =>
                      prev ? { ...prev, show_heads: !newVal } : prev,
                    );
                    Alert.alert("Error", "Could not update visibility.");
                  }
                }}
              >
                {profile.show_heads === false ? (
                  <Eye size={20} color={PRIMARY_COLOR} strokeWidth={2} />
                ) : (
                  <EyeOff size={20} color="#B45309" strokeWidth={2} />
                )}
                <Text
                  style={{
                    fontFamily: FONTS.medium,
                    fontSize: 15,
                    color: profile.show_heads === false ? PRIMARY_COLOR : "#B45309",
                  }}
                >
                  {profile.show_heads === false
                    ? "Show on public profile"
                    : "Hide from public profile"}
                </Text>
              </TouchableOpacity>

              {/* Cancel */}
              <TouchableOpacity
                style={{
                  paddingVertical: 14,
                  alignItems: "center",
                  marginTop: 4,
                }}
                onPress={() => setShowHeadsMenu(false)}
              >
                <Text
                  style={{
                    fontFamily: FONTS.medium,
                    fontSize: 15,
                    color: LIGHT_TEXT_COLOR,
                  }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {selectedPost && (
        <ProfilePostFeed
          visible={postModalVisible}
          onPinToggle={handlePinToggleConfirm}
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

              showToast("Success", "Post deleted successfully");
            } catch (error) {
              console.error("Error deleting post:", error);
              Alert.alert("Error", "Failed to delete post");
            }
          }}
        />
      )}

      {commentsModalState.visible && (
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
      )}

      {showAccountSwitcher && (
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
      )}

      {showAddAccountModal && (
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
      )}

      {showBannerActionSheet && (
        <ActionSheet
          visible={showBannerActionSheet}
          onClose={() => setShowBannerActionSheet(false)}
          title="Banner"
          message="Update your community banner"
          actions={[
            {
              text: "Change banner",
              icon: "Image",
              onPress: () => {
                setShowBannerActionSheet(false);
                pickBannerImage();
              },
            },
            ...(profile?.banner_url
              ? [
                  {
                    text: "Remove banner",
                    icon: "Trash2",
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
      )}

      {/* College Hub Bottom Sheet */}
      {showCollegeHub && (
        <CollegeHubSheet
          visible={showCollegeHub}
          collegeId={profile?.college_info?.college_id}
          onClose={() => setShowCollegeHub(false)}
          onCommunityPress={(communityId) => {
            setShowCollegeHub(false);
            navigation.navigate("CommunityPublicProfile", { communityId });
          }}
        />
      )}

      {showCreateEventModal && (
        <CreateEventModal
          visible={showCreateEventModal}
          onClose={() => {
            setShowCreateEventModal(false);
            setResumeDraft(false);
          }}
          onEventCreated={handleEventCreated}
          resumeDraft={resumeDraft}
        />
      )}

      {showDraftPrompt && (
        <ActionModal
          visible={showDraftPrompt}
          title="Resume Draft?"
          message={`You have an unsaved event draft from ${formatLastSaved(draftLastSaved)}. Would you like to resume where you left off?`}
          actions={[
            {
              text: "Resume Draft",
              onPress: () => {
                setShowDraftPrompt(false);
                setResumeDraft(true);
                setShowCreateEventModal(true);
              },
              style: "primary",
            },
            {
              text: "Start Fresh",
              onPress: async () => {
                setShowDraftPrompt(false);
                const account = await getActiveAccount();
                if (account?.id) await deleteDraftUtil(account.id);
                setResumeDraft(false);
                setShowCreateEventModal(true);
              },
              style: "secondary",
            },
          ]}
          onClose={() => setShowDraftPrompt(false)}
        />
      )}

      {pinModalVisible && (
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
              : "Pin this post to the top of your Community tab?"
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
                if (postForPinToggle) {
                  await handlePinToggleConfirm(postForPinToggle);
                }
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
      )}

      {/* Premium Contact Info Modal */}
      {contactModalVisible && (
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
      )}
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    position: "relative",
  },

  summarySection: {
    paddingHorizontal: 20,
    paddingTop: 0, // Avatar overlap handles spacing
  },
  settingsIconsRowAbsolute: {
    position: "absolute",
    right: 20,
    top: 14,
    flexDirection: "row",
    gap: 12,
    zIndex: 10,
  },
  settingsIconInline: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
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
  editProfileButton: {
    alignSelf: "center",
    marginBottom: 20,
    width: "60%", // Give it some width
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
    fontFamily: FONTS.primary,
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
});
