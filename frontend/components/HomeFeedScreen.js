import React, { useState, useEffect, useRef, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  Alert,
  FlatList,
  Platform,
  Easing,
  Animated as RNAnimated,
  ActivityIndicator,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { MessageSquare, Bell } from "lucide-react-native";
import { useNotifications } from "../context/NotificationsContext";
import { apiGet, apiPost, apiDelete } from "../api/client";
import { getAuthToken, getAuthEmail } from "../api/auth";
import { getUnreadCount as getMessageUnreadCount } from "../api/messages";
import {
  discoverEvents,
  getPendingAttendanceEvent,
  confirmAttendance,
} from "../api/events";
import { getFollowedOpportunities } from "../api/opportunities";
import EditorialPostCard from "./EditorialPostCard";
import EventCard from "./EventCard";
import OpportunityFeedCard from "./OpportunityFeedCard";
import CommentsModal from "./CommentsModal";
import AttendanceConfirmationModal from "./AttendanceConfirmationModal";
import EventBus from "../utils/EventBus";
import LikeStateManager from "../utils/LikeStateManager";
import { useMessagePolling } from "../hooks/useMessagePolling";
import { useFeedPolling } from "../hooks/useFeedPolling";
import SkeletonCard from "./SkeletonCard";
import HomeGreetingHeader from "./HomeGreetingHeader";
import HapticsService from "../services/HapticsService";
import { SvgXml } from "react-native-svg";
import GradientSafeArea from "./GradientSafeArea";
import DynamicStatusBar from "./DynamicStatusBar";
import PremiumHeader, { getPremiumHeaderTotalHeight } from "./PremiumHeader";

import { COLORS } from "../constants/theme";

// SnooSpace Logo SVG (full wordmark)
const SnooSpaceLogoSvg = `<svg width="893" height="217" viewBox="0 0 893 217" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M444.53 169.38C435.35 169.38 427.247 167.737 420.22 164.45C413.193 161.163 407.697 156.46 403.73 150.34C399.763 144.22 397.78 136.853 397.78 128.24V123.48H419.88V128.24C419.88 135.38 422.09 140.763 426.51 144.39C430.93 147.903 436.937 149.66 444.53 149.66C452.237 149.66 457.96 148.13 461.7 145.07C465.553 142.01 467.48 138.1 467.48 133.34C467.48 130.053 466.517 127.39 464.59 125.35C462.777 123.31 460.057 121.667 456.43 120.42C452.917 119.06 448.61 117.813 443.51 116.68L439.6 115.83C431.44 114.017 424.413 111.75 418.52 109.03C412.74 106.197 408.263 102.513 405.09 97.98C402.03 93.4467 400.5 87.5533 400.5 80.3C400.5 73.0467 402.2 66.87 405.6 61.77C409.113 56.5567 413.987 52.59 420.22 49.87C426.567 47.0367 433.99 45.62 442.49 45.62C450.99 45.62 458.527 47.0933 465.1 50.04C471.787 52.8733 477 57.18 480.74 62.96C484.593 68.6267 486.52 75.7667 486.52 84.38V89.48H464.42V84.38C464.42 79.8467 463.513 76.22 461.7 73.5C460 70.6667 457.507 68.6267 454.22 67.38C450.933 66.02 447.023 65.34 442.49 65.34C435.69 65.34 430.647 66.6433 427.36 69.25C424.187 71.7433 422.6 75.2 422.6 79.62C422.6 82.5667 423.337 85.06 424.81 87.1C426.397 89.14 428.72 90.84 431.78 92.2C434.84 93.56 438.75 94.75 443.51 95.77L447.42 96.62C455.92 98.4333 463.287 100.757 469.52 103.59C475.867 106.423 480.797 110.163 484.31 114.81C487.823 119.457 489.58 125.407 489.58 132.66C489.58 139.913 487.71 146.317 483.97 151.87C480.343 157.31 475.13 161.617 468.33 164.79C461.643 167.85 453.71 169.38 444.53 169.38ZM501.896 201V82.68H522.976V92.88H526.036C527.962 89.5933 530.966 86.7033 535.046 84.21C539.126 81.6033 544.962 80.3 552.556 80.3C559.356 80.3 565.646 82 571.426 85.4C577.206 88.6867 581.852 93.56 585.366 100.02C588.879 106.48 590.636 114.3 590.636 123.48V126.2C590.636 135.38 588.879 143.2 585.366 149.66C581.852 156.12 577.206 161.05 571.426 164.45C565.646 167.737 559.356 169.38 552.556 169.38C547.456 169.38 543.149 168.757 539.636 167.51C536.236 166.377 533.459 164.903 531.306 163.09C529.266 161.163 527.622 159.237 526.376 157.31H523.316V201H501.896ZM546.096 150.68C552.782 150.68 558.279 148.583 562.586 144.39C567.006 140.083 569.216 133.85 569.216 125.69V123.99C569.216 115.83 567.006 109.653 562.586 105.46C558.166 101.153 552.669 99 546.096 99C539.522 99 534.026 101.153 529.606 105.46C525.186 109.653 522.976 115.83 522.976 123.99V125.69C522.976 133.85 525.186 140.083 529.606 144.39C534.026 148.583 539.522 150.68 546.096 150.68ZM631.384 169.38C625.377 169.38 619.994 168.36 615.234 166.32C610.474 164.167 606.677 161.107 603.844 157.14C601.124 153.06 599.764 148.13 599.764 142.35C599.764 136.57 601.124 131.753 603.844 127.9C606.677 123.933 610.531 120.987 615.404 119.06C620.391 117.02 626.057 116 632.404 116H655.524V111.24C655.524 107.273 654.277 104.043 651.784 101.55C649.291 98.9433 645.324 97.64 639.884 97.64C634.557 97.64 630.591 98.8867 627.984 101.38C625.377 103.76 623.677 106.877 622.884 110.73L603.164 104.1C604.524 99.7933 606.677 95.8833 609.624 92.37C612.684 88.7433 616.707 85.8533 621.694 83.7C626.794 81.4333 632.971 80.3 640.224 80.3C651.331 80.3 660.114 83.0767 666.574 88.63C673.034 94.1833 676.264 102.23 676.264 112.77V144.22C676.264 147.62 677.851 149.32 681.024 149.32H687.824V167H673.544C669.351 167 665.894 165.98 663.174 163.94C660.454 161.9 659.094 159.18 659.094 155.78V155.61H655.864C655.411 156.97 654.391 158.783 652.804 161.05C651.217 163.203 648.724 165.13 645.324 166.83C641.924 168.53 637.277 169.38 631.384 169.38ZM635.124 152.04C641.131 152.04 646.004 150.397 649.744 147.11C653.597 143.71 655.524 139.233 655.524 133.68V131.98H633.934C629.967 131.98 626.851 132.83 624.584 134.53C622.317 136.23 621.184 138.61 621.184 141.67C621.184 144.73 622.374 147.223 624.754 149.15C627.134 151.077 630.591 152.04 635.124 152.04ZM736.335 169.38C728.175 169.38 720.752 167.68 714.065 164.28C707.492 160.88 702.278 155.95 698.425 149.49C694.572 143.03 692.645 135.21 692.645 126.03V123.65C692.645 114.47 694.572 106.65 698.425 100.19C702.278 93.73 707.492 88.8 714.065 85.4C720.752 82 728.175 80.3 736.335 80.3C744.382 80.3 751.295 81.7167 757.075 84.55C762.855 87.3833 767.502 91.2933 771.015 96.28C774.642 101.153 777.022 106.707 778.155 112.94L757.415 117.36C756.962 113.96 755.942 110.9 754.355 108.18C752.768 105.46 750.502 103.307 747.555 101.72C744.722 100.133 741.152 99.34 736.845 99.34C732.538 99.34 728.628 100.303 725.115 102.23C721.715 104.043 718.995 106.82 716.955 110.56C715.028 114.187 714.065 118.663 714.065 123.99V125.69C714.065 131.017 715.028 135.55 716.955 139.29C718.995 142.917 721.715 145.693 725.115 147.62C728.628 149.433 732.538 150.34 736.845 150.34C743.305 150.34 748.178 148.697 751.465 145.41C754.865 142.01 757.018 137.59 757.925 132.15L778.665 137.08C777.192 143.087 774.642 148.583 771.015 153.57C767.502 158.443 762.855 162.297 757.075 165.13C751.295 167.963 744.382 169.38 736.335 169.38ZM829.654 169.38C821.268 169.38 813.844 167.623 807.384 164.11C801.038 160.483 796.051 155.44 792.424 148.98C788.911 142.407 787.154 134.7 787.154 125.86V123.82C787.154 114.98 788.911 107.33 792.424 100.87C795.938 94.2967 800.868 89.2533 807.214 85.74C813.561 82.1133 820.928 80.3 829.314 80.3C837.588 80.3 844.784 82.17 850.904 85.91C857.024 89.5367 861.784 94.6367 865.184 101.21C868.584 107.67 870.284 115.207 870.284 123.82V131.13H808.914C809.141 136.91 811.294 141.613 815.374 145.24C819.454 148.867 824.441 150.68 830.334 150.68C836.341 150.68 840.761 149.377 843.594 146.77C846.428 144.163 848.581 141.273 850.054 138.1L867.564 147.28C865.978 150.227 863.654 153.457 860.594 156.97C857.648 160.37 853.681 163.317 848.694 165.81C843.708 168.19 837.361 169.38 829.654 169.38ZM809.084 115.15H848.524C848.071 110.277 846.088 106.367 842.574 103.42C839.174 100.473 834.698 99 829.144 99C823.364 99 818.774 100.473 815.374 103.42C811.974 106.367 809.878 110.277 809.084 115.15Z" fill="#1F3A5F"/>
<path d="M52.53 169.38C43.35 169.38 35.2467 167.737 28.22 164.45C21.1933 161.163 15.6967 156.46 11.73 150.34C7.76333 144.22 5.78 136.853 5.78 128.24V123.48H27.88V128.24C27.88 135.38 30.09 140.763 34.51 144.39C38.93 147.903 44.9367 149.66 52.53 149.66C60.2367 149.66 65.96 148.13 69.7 145.07C73.5533 142.01 75.48 138.1 75.48 133.34C75.48 130.053 74.5167 127.39 72.59 125.35C70.7767 123.31 68.0567 121.667 64.43 120.42C60.9167 119.06 56.61 117.813 51.51 116.68L47.6 115.83C39.44 114.017 32.4133 111.75 26.52 109.03C20.74 106.197 16.2633 102.513 13.09 97.98C10.03 93.4467 8.5 87.5533 8.5 80.3C8.5 73.0467 10.2 66.87 13.6 61.77C17.1133 56.5567 21.9867 52.59 28.22 49.87C34.5667 47.0367 41.99 45.62 50.49 45.62C58.99 45.62 66.5267 47.0933 73.1 50.04C79.7867 52.8733 85 57.18 88.74 62.96C92.5933 68.6267 94.52 75.7667 94.52 84.38V89.48H72.42V84.38C72.42 79.8467 71.5133 76.22 69.7 73.5C68 70.6667 65.5067 68.6267 62.22 67.38C58.9333 66.02 55.0233 65.34 50.49 65.34C43.69 65.34 38.6467 66.6433 35.36 69.25C32.1867 71.7433 30.6 75.2 30.6 79.62C30.6 82.5667 31.3367 85.06 32.81 87.1C34.3967 89.14 36.72 90.84 39.78 92.2C42.84 93.56 46.75 94.75 51.51 95.77L55.42 96.62C63.92 98.4333 71.2867 100.757 77.52 103.59C83.8667 106.423 88.7967 110.163 92.31 114.81C95.8233 119.457 97.58 125.407 97.58 132.66C97.58 139.913 95.71 146.317 91.97 151.87C88.3433 157.31 83.13 161.617 76.33 164.79C69.6433 167.85 61.71 169.38 52.53 169.38ZM109.896 167V82.68H130.976V93.73H134.036C135.396 90.7833 137.946 88.0067 141.686 85.4C145.426 82.68 151.092 81.32 158.686 81.32C165.259 81.32 170.982 82.85 175.856 85.91C180.842 88.8567 184.696 92.9933 187.416 98.32C190.136 103.533 191.496 109.653 191.496 116.68V167H170.076V118.38C170.076 112.033 168.489 107.273 165.316 104.1C162.256 100.927 157.836 99.34 152.056 99.34C145.482 99.34 140.382 101.55 136.756 105.97C133.129 110.277 131.316 116.34 131.316 124.16V167H109.896Z" fill="#1F3A5F"/>
<path d="M258.667 4.5C295.181 4.50019 324.833 35.9995 324.833 74.9219C324.833 113.844 295.181 145.344 258.667 145.344C222.153 145.344 192.5 113.844 192.5 74.9219C192.5 35.9993 222.153 4.5 258.667 4.5Z" fill="#3565F2" stroke="#3D79F2"/>
<ellipse cx="325.333" cy="133.078" rx="66.6667" ry="70.922" fill="#CEF2F2"/>
<mask id="path-5-inside-1_13_10" fill="white">
<path d="M324.257 62.167C324.963 66.3048 325.334 70.5674 325.334 74.9219C325.334 113.709 296.065 145.222 259.742 145.833C259.036 141.695 258.667 137.433 258.667 133.078C258.667 94.2916 287.934 62.779 324.257 62.167Z"/>
</mask>
<path d="M324.257 62.167C324.963 66.3048 325.334 70.5674 325.334 74.9219C325.334 113.709 296.065 145.222 259.742 145.833C259.036 141.695 258.667 137.433 258.667 133.078C258.667 94.2916 287.934 62.779 324.257 62.167Z" fill="#6BB3F2"/>
<path d="M324.257 62.167L326.228 61.8305L325.939 60.1384L324.223 60.1673L324.257 62.167ZM325.334 74.9219H327.334V74.9219L325.334 74.9219ZM259.742 145.833L257.77 146.17L258.059 147.862L259.775 147.833L259.742 145.833ZM258.667 133.078H256.667V133.078L258.667 133.078ZM324.257 62.167L322.285 62.5036C322.973 66.5311 323.334 70.6811 323.334 74.9219L325.334 74.9219L327.334 74.9219C327.334 70.4537 326.953 66.0785 326.228 61.8305L324.257 62.167ZM325.334 74.9219H323.334C323.334 112.731 294.83 143.243 259.708 143.833L259.742 145.833L259.775 147.833C297.3 147.202 327.334 114.687 327.334 74.9219H325.334ZM259.742 145.833L261.713 145.497C261.026 141.47 260.667 137.32 260.667 133.078L258.667 133.078L256.667 133.078C256.667 137.546 257.045 141.921 257.77 146.17L259.742 145.833ZM258.667 133.078H260.667C260.667 95.2695 289.169 64.7584 324.29 64.1668L324.257 62.167L324.223 60.1673C286.699 60.7995 256.667 93.3137 256.667 133.078H258.667Z" fill="#3D79F2" mask="url(#path-5-inside-1_13_10)"/>
</svg>`;

// SnooSpace Icon SVG (logo mark only) - Icon_Light.svg
const SnooSpaceIconSvg = `<svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M66.667 0.5C103.181 0.500189 132.833 31.9995 132.833 70.9219C132.833 109.844 103.181 141.344 66.667 141.344C30.1528 141.344 0.5 109.844 0.5 70.9219C0.500058 31.9993 30.1529 0.5 66.667 0.5Z" fill="#3565F2" stroke="#3D79F2"/>
<ellipse cx="133.333" cy="129.078" rx="66.6667" ry="70.922" fill="#CEF2F2"/>
<path d="M132.257 58.1671C132.963 62.3048 133.334 66.5674 133.334 70.9219C133.334 109.709 104.065 141.222 67.7419 141.833C67.0355 137.695 66.6667 133.433 66.6667 129.078C66.6667 90.2916 95.9342 58.779 132.257 58.1671Z" fill="#6BB3F2"/>
</svg>`;

// Map legacy constants to new theme
const PRIMARY_COLOR = COLORS.primary;
const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;

// Header height for animations
const HEADER_HEIGHT = 50;

/**
 * Animated Header Icon Component
 * - Subtly animates on mount (fade + slide up)
 * - Micro-interaction on press (scale)
 * - Muted gray by default
 * - Minimalist dot for unread state
 */
const HeaderIcon = ({ IconComponent, onPress, showDot }) => {
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;
  const slideAnim = useRef(new RNAnimated.Value(5)).current;
  const scaleAnim = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    // Entrance animation
    RNAnimated.parallel([
      RNAnimated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      RNAnimated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, []);

  const handlePress = () => {
    HapticsService.triggerImpactLight();
    // Micro-scale interaction
    RNAnimated.sequence([
      RNAnimated.timing(scaleAnim, {
        toValue: 0.98,
        duration: 100,
        useNativeDriver: true,
      }),
      RNAnimated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    onPress && onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={styles.iconButton}
    >
      <RNAnimated.View
        style={[
          styles.iconContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        <IconComponent
          size={22}
          color="rgba(53, 101, 242, 0.75)"
          strokeWidth={2.2}
        />
        {showDot && <View style={styles.indicatorDot} />}
      </RNAnimated.View>
    </TouchableOpacity>
  );
};

export default function HomeFeedScreen({ navigation, role = "member" }) {
  const insets = useSafeAreaInsets();

  // Calculate total header height including status bar
  const totalHeaderHeight = getPremiumHeaderTotalHeight(insets);

  // Determine header title based on role
  const getHeaderTitle = () => {
    switch (role) {
      case "community":
        return "SnooSpace";
      case "sponsor":
        return "SnooSpace";
      case "venue":
        return "SnooSpace";
      case "member":
      default:
        return "SnooSpace";
    }
  };

  // Determine navigation stack based on current role
  const getNavigationStack = () => {
    switch (role) {
      case "community":
        return "CommunityHome";
      case "sponsor":
        return "SponsorHome";
      case "venue":
        return "VenueHome";
      case "member":
      default:
        return "MemberHome";
    }
  };
  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [feedItems, setFeedItems] = useState([]); // Combined posts + events + opportunities
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const { unread } = useNotifications();
  const [greetingName, setGreetingName] = useState(null);
  const [messageUnread, setMessageUnread] = useState(0);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserType, setCurrentUserType] = useState(null);

  // Auto-play state
  const [visiblePostId, setVisiblePostId] = useState(null);

  // Cursor-based pagination state
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Attendance confirmation state
  const [pendingAttendanceEvent, setPendingAttendanceEvent] = useState(null);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  // Refs for scroll handling
  const flatListRef = useRef(null);

  // Reanimated shared value for premium scroll-reactive header
  const scrollY = useSharedValue(0);

  // Scroll handler using Reanimated for performant tracking
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      // Clamp to 0 to prevent negative values during pull-to-refresh
      scrollY.value = Math.max(0, event.contentOffset.y);
    },
  });

  // Auto-poll for message count updates (Instagram-like)
  useMessagePolling(
    (count) => {
      setMessageUnread(count);
    },
    {
      baseInterval: 3000,
      enabled: true,
    },
  );

  // Auto-poll for new posts
  const { isPolling: isFeedPolling, initializeTimestamp } = useFeedPolling({
    baseInterval: 30000,
    enabled: !loading,
    onNewPostsLoaded: (newPosts) => {
      console.log("[HomeFeed] Auto-loading new posts from polling");
      const mergedPosts = LikeStateManager.mergeLikeStates(
        newPosts.map((post) => ({
          ...post,
          tagged_entities: (() => {
            if (!post.tagged_entities) return null;
            if (Array.isArray(post.tagged_entities))
              return post.tagged_entities;
            try {
              return JSON.parse(post.tagged_entities);
            } catch {
              return null;
            }
          })(),
        })),
      );
      setPosts(mergedPosts);
      HapticsService.triggerImpactLight();
    },
  });

  // Load events for discovery
  const loadEvents = async () => {
    try {
      const response = await discoverEvents({ limit: 5 });
      if (response?.events) {
        setEvents(response.events);
      }
    } catch (error) {
      console.warn("[HomeFeed] Error loading events:", error.message);
    }
  };

  // Load opportunities from followed communities
  const loadOpportunities = async () => {
    try {
      const response = await getFollowedOpportunities(3);
      if (response?.success && response?.opportunities) {
        setOpportunities(response.opportunities);
      }
    } catch (error) {
      console.warn("[HomeFeed] Error loading opportunities:", error.message);
    }
  };

  // Merge posts, events, and opportunities
  useEffect(() => {
    if (
      posts.length === 0 &&
      events.length === 0 &&
      opportunities.length === 0
    ) {
      setFeedItems([]);
      return;
    }

    const merged = [];
    let eventIndex = 0;
    const FIRST_EVENT_AT = 2;
    const SUBSEQUENT_INTERVAL = 5;

    if (posts.length > 0) {
      posts.forEach((post, index) => {
        merged.push({ ...post, itemType: "post" });

        const postNumber = index + 1;
        const shouldInsertEvent =
          (postNumber === FIRST_EVENT_AT && eventIndex === 0) ||
          (eventIndex > 0 &&
            postNumber > FIRST_EVENT_AT &&
            (postNumber - FIRST_EVENT_AT) % SUBSEQUENT_INTERVAL === 0);

        if (shouldInsertEvent && eventIndex < events.length) {
          merged.push({ ...events[eventIndex], itemType: "event" });
          eventIndex++;
        }
      });

      while (eventIndex < events.length) {
        merged.push({ ...events[eventIndex], itemType: "event" });
        eventIndex++;
      }
    } else {
      events.forEach((event) => {
        merged.push({ ...event, itemType: "event" });
      });
    }

    // Add opportunities after the first few items if available
    if (opportunities.length > 0 && merged.length > 3) {
      merged.splice(
        3,
        0,
        ...opportunities.map((opp) => ({ ...opp, itemType: "opportunity" })),
      );
    } else {
      opportunities.forEach((opp) => {
        merged.push({ ...opp, itemType: "opportunity" });
      });
    }

    setFeedItems(merged);
  }, [posts, events, opportunities]);

  useEffect(() => {
    loadFeed();
    loadEvents();
    loadOpportunities();
    loadGreetingName();
    loadMessageUnreadCount();
    const off = EventBus.on("follow-updated", () => {
      loadFeed();
    });
    const offMessages = EventBus.on("messages-read", () => {
      loadMessageUnreadCount();
    });
    const offNewMessage = EventBus.on("new-message", () => {
      loadMessageUnreadCount();
    });
    const offPostCreated = EventBus.on("post-created", () => {
      loadFeed();
    });
    const offPinUpdated = EventBus.on("prompt-pin-updated", () => {
      loadFeed();
    });
    return () => {
      off();
      offMessages();
      offNewMessage();
      offPostCreated();
      offPinUpdated();
    };
  }, []);

  useEffect(() => {
    const handlePostLikeUpdate = (payload) => {
      if (!payload?.postId) return;
      LikeStateManager.setLikeState(payload.postId, payload.isLiked);

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
    };

    const handlePostCommentUpdate = (payload) => {
      if (!payload?.postId) return;
      setPosts((prev) =>
        prev.map((post) =>
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

  useFocusEffect(
    React.useCallback(() => {
      loadMessageUnreadCount();
    }, []),
  );

  const { loadInitial: loadNotifications } = useNotifications();
  useFocusEffect(
    React.useCallback(() => {
      loadNotifications();
    }, [loadNotifications]),
  );

  // Check for pending attendance confirmation on focus
  useFocusEffect(
    React.useCallback(() => {
      checkPendingAttendance();
    }, []),
  );

  const checkPendingAttendance = async () => {
    try {
      // Skip for non-member accounts - this endpoint is member-only
      if (role !== "member") {
        return;
      }
      const response = await getPendingAttendanceEvent();
      if (response?.event) {
        setPendingAttendanceEvent(response.event);
        setShowAttendanceModal(true);
      }
    } catch (error) {
      console.warn("[HomeFeed] Error checking pending attendance:", error);
    }
  };

  const loadMessageUnreadCount = async () => {
    try {
      const response = await getMessageUnreadCount();
      setMessageUnread(response.unreadCount || 0);
    } catch (error) {
      console.error("Error loading message unread count:", error);
    }
  };

  const handleConfirmAttendance = async (attended) => {
    if (!pendingAttendanceEvent?.id) return;
    try {
      setAttendanceLoading(true);
      HapticsService.triggerImpactMedium();
      await confirmAttendance(pendingAttendanceEvent.id, attended);
      setShowAttendanceModal(false);
      setPendingAttendanceEvent(null);
    } catch (error) {
      console.error("Error confirming attendance:", error);
      Alert.alert("Error", "Failed to confirm attendance. Please try again.");
    } finally {
      setAttendanceLoading(false);
    }
  };

  const loadFeed = async (reset = true) => {
    // Prevent duplicate calls while loading
    if (loadingMore) return;
    if (!hasMore && !reset) return;

    try {
      if (reset) {
        setLoading(true);
        setCursor(null);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }
      setErrorMsg("");
      const token = await getAuthToken();
      if (!token) throw new Error("Authentication token not found.");

      // Build URL with cursor param for pagination
      const cursorToUse = reset ? null : cursor;
      const url = cursorToUse
        ? `/posts/feed?cursor=${encodeURIComponent(cursorToUse)}&limit=20`
        : "/posts/feed?limit=20";

      const response = await apiGet(url, 15000, token);
      const newPosts = (response.posts || []).map((post) => {
        const mappedPost = {
          ...post,
          author_id: post.author_id,
          author_type: post.author_type,
          tagged_entities: (() => {
            if (!post.tagged_entities) return null;
            if (Array.isArray(post.tagged_entities))
              return post.tagged_entities;
            try {
              return JSON.parse(post.tagged_entities);
            } catch {
              return null;
            }
          })(),
        };
        return mappedPost;
      });

      const mergedPosts = LikeStateManager.mergeLikeStates(newPosts);

      // Append or replace based on reset flag
      setPosts((prevPosts) => {
        if (reset) return mergedPosts;
        // Deduplicate by ID when appending
        const existingIds = new Set(prevPosts.map((p) => p.id));
        const uniqueNew = mergedPosts.filter((p) => !existingIds.has(p.id));
        return [...prevPosts, ...uniqueNew];
      });

      // Update pagination state from API response
      setCursor(response.next_cursor || null);
      setHasMore(response.has_more === true);

      if (reset && mergedPosts.length > 0 && mergedPosts[0]?.created_at) {
        initializeTimestamp(mergedPosts[0].created_at);
      }
    } catch (error) {
      console.error("Error loading feed:", error);
      setErrorMsg(error?.message || "Failed to load posts");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadGreetingName = async () => {
    try {
      const token = await getAuthToken();
      const { getActiveAccount } = await import("../api/auth");
      const activeAccount = await getActiveAccount();

      if (!token || !activeAccount?.email) return;

      const email = activeAccount.email;
      const res = await apiPost(
        "/auth/get-user-profile",
        { email },
        12000,
        token,
      );
      const prof = res?.profile || {};
      const name = prof.full_name || prof.name || prof.username || "Member";
      setGreetingName(name);
      setCurrentUserId(prof.id);
      const userType = res?.role || role; // API returns role at top level, not prof.type
      console.log("[HomeFeed] Setting currentUserType:", {
        apiRole: res?.role,
        role,
        finalType: userType,
        profId: prof.id,
      });
      setCurrentUserType(userType);
    } catch (e) {
      console.error("[HomeFeed] Error loading greeting name:", e);
      setGreetingName("Member");
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadFeed(),
      loadEvents(),
      loadOpportunities(),
      loadMessageUnreadCount(),
    ]);
    setRefreshing(false);
  };

  const handleLikeUpdate = (postId, isLiked) => {
    setPosts((prevPosts) =>
      prevPosts.map((p) =>
        p.id === postId
          ? {
              ...p,
              is_liked: isLiked,
              isLiked,
              like_count: Math.max(0, (p.like_count || 0) + (isLiked ? 1 : -1)),
            }
          : p,
      ),
    );
  };

  const handleCommentPress = (postId) => {
    setSelectedPostId(postId);
    setCommentsModalVisible(true);
  };

  const handleCommentCountChange = (postId) => {
    return (prevCount) => {
      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p.id === postId ? { ...p, comment_count: prevCount } : p,
        ),
      );
    };
  };

  const handleEventPress = (event) => {
    navigation.navigate("EventDetails", {
      eventId: event.id,
      eventData: event,
    });
  };

  const handleInterestedPress = (event) => {
    // EventCard already handles the API toggle and UI state
    // No additional feedback needed here
  };

  const handleFollow = async (userId, userType, shouldFollow) => {
    try {
      const token = await getAuthToken();
      if (shouldFollow) {
        await apiPost(
          "/follow",
          { followingId: userId, followingType: userType },
          15000,
          token,
        );
      } else {
        await apiDelete(
          "/follow",
          { followingId: userId, followingType: userType },
          15000,
          token,
        );
      }
      // Update local state for all posts by this author
      setPosts((prev) =>
        prev.map((post) =>
          post.author_id === userId && post.author_type === userType
            ? { ...post, is_following: shouldFollow }
            : post,
        ),
      );
    } catch (error) {
      console.error("Error following entity:", error);
      Alert.alert("Error", "Failed to update follow status");
    }
  };

  // Note: handleScroll is now replaced by scrollHandler using Reanimated

  const handleLogoPress = useCallback(() => {
    HapticsService.triggerImpactLight();
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setTimeout(() => {
      onRefresh();
    }, 300);
  }, [onRefresh]);

  const renderFeedItem = ({ item }) => {
    if (item.itemType === "event") {
      return (
        <EventCard
          event={item}
          onPress={handleEventPress}
          onInterestedPress={handleInterestedPress}
        />
      );
    }

    if (item.itemType === "opportunity") {
      return (
        <OpportunityFeedCard
          opportunity={item}
          onPress={(opp) => {
            navigation.navigate("OpportunityView", {
              opportunityId: opp.id,
            });
          }}
        />
      );
    }

    return (
      <EditorialPostCard
        post={item}
        onLike={handleLikeUpdate}
        onComment={handleCommentPress}
        onFollow={handleFollow}
        showFollowButton={true}
        currentUserId={currentUserId}
        currentUserType={currentUserType}
        isVideoPlaying={item.id === visiblePostId}
        onUserPress={(userId, userType) => {
          const actualUserType = userType || item?.author_type;
          const actualUserId = userId || item?.author_id;

          if (actualUserType === "community") {
            const isOwnCommunity =
              currentUserId && String(actualUserId) === String(currentUserId);

            if (isOwnCommunity && role === "community") {
              const root = navigation.getParent()?.getParent();
              if (root) {
                root.navigate(getNavigationStack(), {
                  screen: "Profile",
                  params: {
                    screen: "CommunityProfile",
                  },
                });
              }
            } else if (role === "member") {
              navigation.navigate("CommunityPublicProfile", {
                communityId: actualUserId,
                viewerRole: "member",
              });
            } else {
              Alert.alert(
                "Community Profile",
                `Viewing community: ${actualUserId}`,
              );
            }
            return;
          }

          if (actualUserType === "member") {
            const isOwnProfile =
              currentUserId && actualUserId === currentUserId;

            if (role === "member" || role === "community") {
              if (!isOwnProfile) {
                navigation.navigate("MemberPublicProfile", {
                  memberId: actualUserId,
                });
              } else {
                const root = navigation.getParent()?.getParent();
                if (root) {
                  root.navigate(getNavigationStack(), {
                    screen: "Profile",
                    params: {
                      screen: "MemberProfile",
                    },
                  });
                }
              }
            } else {
              Alert.alert(
                "Member Profile",
                `Viewing member profile: ${actualUserId}`,
              );
            }
            return;
          }
        }}
      />
    );
  };

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    waitForInteraction: false,
    minimumViewTime: 0,
  }).current;

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems && viewableItems.length > 0) {
      const visibleItem = viewableItems[0];
      if (visibleItem && visibleItem.item && visibleItem.item.id) {
        setVisiblePostId(visibleItem.item.id);
      }
    }
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      {/* Dynamic Status Bar */}
      <DynamicStatusBar style="light-content" />

      {/* Premium Gradient Overlay for Status Bar Contrast */}
      <GradientSafeArea variant="primary" />

      {/* Premium Scroll-Reactive Header */}
      <PremiumHeader scrollY={scrollY}>
        <TouchableOpacity onPress={handleLogoPress} activeOpacity={0.7}>
          <SvgXml xml={SnooSpaceIconSvg} width={50} height={40} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <HeaderIcon
            IconComponent={Bell}
            showDot={unread > 0}
            onPress={() => {
              navigation.navigate("Notifications");
            }}
          />
          <HeaderIcon
            IconComponent={MessageSquare}
            showDot={messageUnread > 0}
            onPress={() => {
              navigation.navigate("ConversationsList");
            }}
          />
        </View>
      </PremiumHeader>

      {errorMsg ? (
        <View style={[styles.errorBanner, { marginTop: totalHeaderHeight }]}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity
            onPress={() => {
              setErrorMsg("");
              loadFeed();
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Feed */}
      <Animated.FlatList
        ref={flatListRef}
        data={loading && feedItems.length === 0 ? [1, 2, 3] : feedItems}
        renderItem={
          loading && feedItems.length === 0
            ? () => <SkeletonCard />
            : renderFeedItem
        }
        keyExtractor={(item) =>
          loading && feedItems.length === 0
            ? `skeleton-${item}`
            : `${item.itemType || "post"}-${item.id}`
        }
        style={styles.feed}
        contentContainerStyle={[
          styles.feedContent,
          { paddingTop: totalHeaderHeight },
        ]}
        // Progress view offset pushes the spinner down so it doesn't hide behind the header
        progressViewOffset={totalHeaderHeight}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            // tintColor for iOS spinner color
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        ListHeaderComponent={<HomeGreetingHeader name={greetingName} />}
        ListEmptyComponent={() =>
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No posts yet</Text>
              <Text style={styles.emptySubtext}>
                Follow some users to see their posts here
              </Text>
              {errorMsg ? (
                <TouchableOpacity onPress={loadFeed} style={styles.retryButton}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null
        }
        onEndReached={() => {
          if (!loading && !loadingMore && hasMore) {
            loadFeed(false);
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : null
        }
      />

      {/* Comments Modal */}
      <CommentsModal
        visible={commentsModalVisible}
        postId={selectedPostId}
        onClose={() => {
          setCommentsModalVisible(false);
          setSelectedPostId(null);
        }}
        onCommentCountChange={
          selectedPostId ? handleCommentCountChange(selectedPostId) : undefined
        }
        navigation={navigation}
      />

      {/* Attendance Confirmation Modal */}
      <AttendanceConfirmationModal
        visible={showAttendanceModal}
        eventTitle={pendingAttendanceEvent?.title}
        onConfirmAttendance={handleConfirmAttendance}
        loading={attendanceLoading}
      />
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
    // Removed explicit height here as it is set via style prop based on insets
    // shadow removed to be flat like Instagram
    zIndex: 100,
    backgroundColor: COLORS.background, // Ensure background prevents see-through
  },
  // New style for the dynamic border
  headerBorder: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#E0E0E0", // Light gray separator
  },
  appTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: TEXT_COLOR,
    // Instagram uses a specific font, but we keep your bold styling
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: "row",
    gap: 16, // Increased gap to move bell icon slightly to the left
    alignItems: "center",
  },
  iconButton: {
    // Removed specific padding as container handles it
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(245, 247, 255, 0.85)", // Blue-tinted neutral at ~85% opacity
    justifyContent: "center",
    alignItems: "center",
    // Flat design: removed shadow and border
  },
  indicatorDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F4C430", // Muted Yellow
    borderWidth: 1.5,
    borderColor: COLORS.background, // Creates a gap effect against the container
  },
  // Greeting styles moved to HomeGreetingHeader component
  feed: {
    flex: 1,
  },
  feedContent: {
    paddingBottom: 60,
  },
  postContainer: {
    backgroundColor: "#FFFFFF",
    marginBottom: 20,
    paddingBottom: 15,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  authorInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  authorDetails: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  authorUsername: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  moreButton: {
    padding: 5,
  },
  postContent: {
    paddingHorizontal: 20,
  },
  postImage: {
    width: "100%",
    height: 300,
    borderRadius: 12,
    marginBottom: 12,
  },
  postCaption: {
    fontSize: 16,
    color: TEXT_COLOR,
    lineHeight: 22,
  },
  postActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 20,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bookmarkButton: {
    marginLeft: "auto",
  },
  actionText: {
    fontSize: 14,
    fontWeight: "500",
    color: TEXT_COLOR,
  },
  commentsPreview: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  commentsText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  postTime: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 50,
  },
  loadingText: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    textAlign: "center",
  },
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFF2F0",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  errorText: {
    color: "#D93025",
    flex: 1,
    marginRight: 10,
  },
  retryText: {
    color: PRIMARY_COLOR,
    fontWeight: "600",
  },
  retryButton: {
    marginTop: 12,
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
