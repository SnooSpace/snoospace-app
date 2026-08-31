import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getMaxPreloadDistance, getMaxPreloadDistanceSync } from "../../utils/preloadConfig";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { loadFeedSnapshot, saveFeedSnapshot, clearFeedSnapshot } from "../../services/feedCache";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  Easing,
  Image,
  Animated as RNAnimated,
  InteractionManager,
  Dimensions,
} from "react-native";
import { FlashList } from "@shopify/flash-list"; // Using FlashList for smooth cell recycling
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeIn,
  FadeOut,
  runOnJS,
} from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { MessageCircle, Bell, BadgeCheck } from "lucide-react-native";
import { useNotifications } from "../../context/NotificationsContext";
import { useVideoContext, VideoProvider } from "../../context/VideoContext";
import { apiGet, apiPost, apiDelete } from "../../api/client";
import { getAuthToken, getAuthEmail } from "../../api/auth";
import { getUnreadCount as getMessageUnreadCount } from "../../api/messages";
import {
  discoverEvents,
  getPendingAttendanceEvent,
  confirmAttendance,
} from "../../api/events";
import {
  getFollowedOpportunities,
  getOpportunities,
  getDiscoveryOpportunities,
} from "../../api/opportunities";
import EditorialPostCard from "../../components/cards/EditorialPostCard";
import EventCard from "../../components/cards/EventCard";
import OpportunityFeedCard from "../../components/cards/OpportunityFeedCard";
import CommentsModal from "../../components/modals/CommentsModal";
import ShareModal from "../../components/modals/ShareModal";
import AttendanceConfirmationModal from "../../components/modals/AttendanceConfirmationModal";
import DeletePostModal from "../../components/modals/DeletePostModal";
import EventBus from "../../utils/EventBus";
import LikeStateManager from "../../utils/LikeStateManager";
import useRealtimeSubscription from "../../hooks/useRealtimeSubscription";
import { getSocket } from "../../services/socketService";
import { useFeedPolling } from "../../hooks/useFeedPolling";
import { useScrollState } from "../../hooks/useScrollState";
import SkeletonCard from "../../components/skeletons/SkeletonCard";
import HomeGreetingHeader from "../../components/navigation/HomeGreetingHeader";
import HapticsService from "../../services/HapticsService";
import { SvgXml } from "react-native-svg";
import GradientSafeArea from "../../components/ui/GradientSafeArea";
import DynamicStatusBar from "../../components/navigation/DynamicStatusBar";
import PremiumHeader, { getPremiumHeaderTotalHeight } from "../../components/navigation/PremiumHeader";
import { viewQueueService } from "../../services/ViewQueueService";

import { COLORS } from "../../constants/theme";
import EmptyFeedState from "../../components/skeletons/EmptyFeedState";
import SnooLoader from "../../components/ui/SnooLoader";
import { LinearGradient } from "expo-linear-gradient";
import { Image as ExpoImage } from "expo-image";
import { getOptimizedImageUrl } from "../../utils/imageUtils";
import { windowedShuffle } from "../../utils/feedShuffle";

export const homeFeedKeyExtractor = (item) => {
  if (!item) return "unknown";
  return `${item.itemType || "post"}-${item.id ?? "none"}`;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList);


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

// ── 4A Batched progressive reveal ────────────────────────────────────────────
// Timing constants. SKELETON_MIN_MS = minimum time the skeleton is shown before
// any real cards appear. BATCH_MIN_MS = how long scroll is blocked between
// batches (giving images time to prefetch). Tune these if the rhythm feels
// too slow (reduce) or if cards still appear half-built (increase).
const SKELETON_MIN_MS = 1000; // minimum skeleton display on cold-start
const BATCH_MIN_MS    = 1800; // inter-batch scroll-block window


// Render-cost heuristics per item type (arbitrary units).
// budget 6 ≈ 1s (skeleton window), budget 10 ≈ 1.8s (inter-batch window).
// Higher = more JS + more images = needs more time before reveal is safe.
const getItemRenderCost = (item) => {
  if (item.itemType === 'event')       return 2;
  if (item.itemType === 'opportunity') return 2;
  switch (item.post_type) {
    case 'challenge': return 3;
    case 'poll':      return 2;
    case 'qna':       return 2;
    case 'prompt':    return 2;
    default: {
      // Media posts with images are heavier; text-only is nearly free
      const urls = Array.isArray(item.image_urls) ? item.image_urls.flat() : [];
      return urls.length > 0 ? 3 : 1;
    }
  }
};

// How many items starting at `startIndex` fit within the cost `budget`
const computeBatchSize = (items, startIndex = 0, budget = 12) => {
  if (!items || !Array.isArray(items) || items.length === 0) return 0;
  let remaining = budget;
  let count = 0;
  for (let i = startIndex; i < items.length && remaining > 0; i++) {
    const cost = getItemRenderCost(items[i]);
    if (remaining >= cost) { remaining -= cost; count++; }
    else break;
  }
  return Math.max(1, count);
};

// ── 2.2b: Split-cache prefetch ───────────────────────────────────────────────
//
// RN's Image.prefetch and expo-image's Image.prefetch write to SEPARATE caches.
// Routing rules (must match the render-site component exactly):
//
//  expo-image cache:
//    • editorial/media  → author_photo_url   (width 100, matches ExpoImage in EditorialPostCard)
//    • poll/prompt/qna  → author_photo_url   (width 100, covers promoAvatar 36px + profileImage 32px)
//    • challenge        → author_photo_url   (width 60, matches ExpoImage in ChallengePostCard)
//
//  RN Image cache:
//    • event            → author_photo_url   (width 60, community logo via RN Image in EventCard)
//    • opportunity      → author_photo_url   (width 60, creator avatar via RN Image in OpportunityFeedCard)
//    • image_urls[]     → any editorial post (width SCREEN_WIDTH*2, RN Image in EditorialPostCard)
//    • video_thumbnail  → any post           (width SCREEN_WIDTH*2, RN Image in VideoPlayer)
//
// allSettled: one slow/failed URL never blocks the rest.
const EDITORIAL_IMG_WIDTH = SCREEN_WIDTH; // logical dp — PixelRatio applied inside getOptimizedImageUrl

const prefetchBatchImages = (items) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return Promise.resolve([]);
  }
  const rnUrls   = []; // → Image.prefetch() from 'react-native'
  const expoUrls = []; // → ExpoImage.prefetch() from 'expo-image'

  for (const item of items) {
    if (!item) continue;
    const postType = item.post_type || item.type || "media"; // 'event' | 'opportunity' | post_type

    // ── author avatar ──────────────────────────────────────────────────────────
    if (item.author_photo_url || item.creator_photo || item.community_logo) {
      const avatarUrl = item.author_photo_url || item.creator_photo || item.community_logo;
      if (postType === "event" || postType === "opportunity") {
        // EventCard and OpportunityFeedCard both use RN <Image>
        const url = getOptimizedImageUrl(avatarUrl, { width: 24 });
        if (url) rnUrls.push(url);
      } else if (postType === "challenge") {
        // ChallengePostCard uses expo-image, authorAvatar style = 24px logical
        const url = getOptimizedImageUrl(avatarUrl, { width: 24 });
        if (url) expoUrls.push(url);
      } else {
        // editorial/media/poll/prompt/qna — all use expo-image
        // editorial avatar = 44px logical (EDITORIAL_SPACING.profileImageSize)
        // poll/prompt/qna promoAvatar = 36px, profileImage = 32px
        // 44 is the correct width for editorial; for poll/prompt/qna we'd
        // ideally split by isPromo, but 36 is close enough for non-editorial
        const isEditorial = postType === "media" || !postType;
        const url = getOptimizedImageUrl(avatarUrl, { width: isEditorial ? 44 : 36 });
        if (url) expoUrls.push(url);
      }
    }

    // ── post media images (editorial only) ────────────────────────────────────
    // EditorialPostCard uses plain RN <Image> for image_urls
    const imgs = Array.isArray(item.image_urls) ? item.image_urls.flat() : [];
    for (const u of imgs) {
      if (u) rnUrls.push(getOptimizedImageUrl(u, { width: EDITORIAL_IMG_WIDTH }));
    }

    // ── video thumbnail ───────────────────────────────────────────────────────
    // VideoPlayer uses plain RN <Image> for thumbnail overlay
    if (item.video_thumbnail) {
      rnUrls.push(getOptimizedImageUrl(item.video_thumbnail, { width: EDITORIAL_IMG_WIDTH }));
    }
  }

  return Promise.allSettled([
    ...rnUrls.map((u)   => Image.prefetch(u)),
    ...expoUrls.map((u) => ExpoImage.prefetch(u)),
  ]);
};

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
    if (IconComponent === Bell) {
      HapticsService.triggerNotificationPress();
    } else if (IconComponent === MessageCircle) {
      HapticsService.triggerChatPress();
    } else {
      HapticsService.triggerImpactLight();
    }
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

/**
 * Animated Caught-Up Footer Component
 * - 360-degree rotation animation with smooth spring deceleration
 * - Subtle pop & scale-in with soft tinted circular container
 * - Staggered text entrance (fade + slide up)
 * - Lucide BadgeCheck icon
 * - Hierarchy: BasicCommercial-Bold title + Manrope-Regular descriptive text
 */
const CaughtUpFooter = ({ subtitle }) => {
  const rotateAnim = useRef(new RNAnimated.Value(0)).current;
  const scaleAnim = useRef(new RNAnimated.Value(0.3)).current;
  const opacityAnim = useRef(new RNAnimated.Value(0)).current;
  const textFadeAnim = useRef(new RNAnimated.Value(0)).current;
  const textSlideAnim = useRef(new RNAnimated.Value(10)).current;

  useEffect(() => {
    HapticsService.triggerImpactLight();

    RNAnimated.parallel([
      // Container / Icon Fade In
      RNAnimated.timing(opacityAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      // Spring Scale Up
      RNAnimated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
      // 360 Rotation with smooth deceleration settling
      RNAnimated.timing(rotateAnim, {
        toValue: 1,
        duration: 850,
        useNativeDriver: true,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      }),
      // Staggered Text Entrance (Fade + Slide)
      RNAnimated.sequence([
        RNAnimated.delay(200),
        RNAnimated.parallel([
          RNAnimated.timing(textFadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
            easing: Easing.out(Easing.quad),
          }),
          RNAnimated.spring(textSlideAnim, {
            toValue: 0,
            friction: 7,
            tension: 40,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.caughtUpContainer}>
      <RNAnimated.View
        style={[
          styles.caughtUpIconCircle,
          {
            opacity: opacityAnim,
            transform: [
              { scale: scaleAnim },
              { rotate: spin },
            ],
          },
        ]}
      >
        <BadgeCheck size={26} color={COLORS.primary} strokeWidth={2.2} />
      </RNAnimated.View>

      <RNAnimated.View
        style={{
          alignItems: "center",
          opacity: textFadeAnim,
          transform: [{ translateY: textSlideAnim }],
        }}
      >
        <Text style={styles.caughtUpTitle}>You're all caught up</Text>
        <Text style={styles.caughtUpSubtitle}>
          {subtitle || "Follow communities to keep your feed growing"}
        </Text>
      </RNAnimated.View>
    </View>
  );
};

export default function HomeFeedScreen({ navigation, role = "member" }) {
  // console.log(`[DIAG-REFOCUS-RENDER] HomeFeedScreen component body executing at t=${Date.now()}`);

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
  const getNavigationStack = useCallback(() => {
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
  }, [role]);
  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [discoveryPosts, setDiscoveryPosts] = useState([]);
  const [discoveryOpportunities, setDiscoveryOpportunities] = useState([]);
  // Guaranteed targeted promo delivery: plan-linked promo posts where viewer is in the
  // audience of at least one specifically-targeted community (OPVC rows exist).
  // Broad/everyone promo posts continue through normal getFeed/getDiscoveryPosts paths.
  const [targetedPromoPosts, setTargetedPromoPosts] = useState([]);
  const [zeroFollowFeedItems, setZeroFollowFeedItems] = useState([]);
  const zfInitializedRef = useRef(false);
  const zfProcessedDiscoveryCountRef = useRef(0);
  const zfAuthorCountRef = useRef({});

  // Rollover feed items: tail content appended when followed content is exhausted
  const [rolloverFeedItems, setRolloverFeedItems] = useState([]);
  const rolloverInitializedRef = useRef(false);
  const rolloverProcessedDiscoveryCountRef = useRef(0);
  const rolloverAuthorCountRef = useRef({});
  const followedInjectedIdsRef = useRef(new Set());
  const rolloverBaseAuthorCountsRef = useRef({});

  const [discoveryHasMore, setDiscoveryHasMore] = useState(true);
  const isLoadingDiscoveryRef = useRef(false);
  const discoveryOffsetRef = useRef(0);

  const postsRef = useRef(posts);
  const opportunitiesRef = useRef(opportunities);
  const eventsRef = useRef(events);
  const discoveryPostsRef = useRef(discoveryPosts);
  const discoveryOpportunitiesRef = useRef(discoveryOpportunities);

  useEffect(() => { postsRef.current = posts; }, [posts]);
  useEffect(() => { opportunitiesRef.current = opportunities; }, [opportunities]);
  useEffect(() => { eventsRef.current = events; }, [events]);
  useEffect(() => { discoveryPostsRef.current = discoveryPosts; }, [discoveryPosts]);
  useEffect(() => { discoveryOpportunitiesRef.current = discoveryOpportunities; }, [discoveryOpportunities]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // 4A: how many items from feedItems are currently exposed to FlashList.
  // Grows in cost-budget steps after each inter-batch prefetch window.
  const [revealedCount, setRevealedCount] = useState(0);
  // showSkeleton: true until the first batch is ready (images prefetched).
  // While true, visibleFeedItems returns SKELETON_ITEMS regardless of feedItems.
  const [showSkeleton, setShowSkeleton] = useState(true);
  // isScrollBlocked: true during inter-batch prefetch windows.
  // Disables FlashList scroll + shows an overlay so the user waits for
  // fully-loaded cards rather than seeing half-built content.
  const [isScrollBlocked, setIsScrollBlocked] = useState(false);
  // Tracks when the skeleton started so we respect SKELETON_MIN_MS.
  const skeletonStartTimeRef = useRef(Date.now());
  // Stores the freshly-fetched posts from loadFeed so triggerSkeletonReveal
  // can compute batch size before React re-renders feedItems.
  const freshPostsRef = useRef([]);
  // Prevents concurrent batch-reveal calls from stacking.
  const isRevealingRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [selectedPostType, setSelectedPostType] = useState("post");
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [selectedSharePost, setSelectedSharePost] = useState(null);
  const { unread } = useNotifications();
  const [greetingName, setGreetingName] = useState(null);
  const [messageUnread, setMessageUnread] = useState(0);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserType, setCurrentUserType] = useState(null);

  // ── Hoisted auth token: fetched ONCE at screen level, passed as prop to every
  //    card. Eliminates N concurrent AsyncStorage reads on cold start / refocus.
  const authTokenRef = useRef(null);
  useEffect(() => {
    getAuthToken().then((t) => {
      authTokenRef.current = t;
      // Warm the ViewQueueService token cache so recordUnseenImpression never
      // hits AsyncStorage during a scroll event.
      viewQueueService.setCachedToken(t);
    });
  }, []);

  // Auto-play state (for video: requires 60% viewport coverage)
  // ── PERF: Using refs instead of state so that viewability changes during
  //    scroll do NOT invalidate renderFeedItem or trigger re-renders.
  //    We keep one piece of state (visiblePostId) purely for EditorialPostCard
  //    equality checks; it is updated via a deferred InteractionManager call
  //    AFTER the scroll event settles.
  const [visiblePostId, setVisiblePostId] = useState(null);
  const visiblePostIdRef = useRef(null);   // always up-to-date, no re-render
  const visibleIndexRef = useRef(-1);      // replaces visibleIndex state
  const lastVisiblePostIdRef = useRef(null); // Track last visible post to restore on focus

  // Memory-aware preload distance (initialized async on mount)
  const [maxPreloadDistance, setMaxPreloadDistance] = useState(1); // safe default
  const maxPreloadDistanceRef = useRef(1); // ref mirror for use in renderFeedItem
  useEffect(() => {
    getMaxPreloadDistance().then((d) => {
      setMaxPreloadDistance(d);
      maxPreloadDistanceRef.current = d;
    });
  }, []);

  // Screen focus detection for pausing videos on navigation
  const isFocused = useIsFocused();
  // ── PERF: ref mirror so renderFeedItem doesn't need isFocused in its deps
  const isFocusedRef = useRef(isFocused);
  useEffect(() => { isFocusedRef.current = isFocused; }, [isFocused]);

  // ── 1.1 Freeze verification diagnostic ──────────────────────────────────────
  // These logs let us confirm HomeFeedScreen effects stop firing while
  // ConversationsList / Chat is on top. Remove in prompt 1.7 after verification.
  useEffect(() => {
    console.log(`[HomeFeed][FREEZE-DIAG] top-level useEffect mounted at ${Date.now()}`);
    return () => {
      console.log(`[HomeFeed][FREEZE-DIAG] top-level useEffect cleanup at ${Date.now()}`);
    };
  }, []);

  // Pause videos when screen loses focus. Defer the state update via
  // InteractionManager so FlashList re-render doesn't block the transition animation.
  useEffect(() => {
    if (!isFocused) {
      // Screen lost focus - save current visible post and pause all videos
      if (visiblePostIdRef.current) {
        lastVisiblePostIdRef.current = visiblePostIdRef.current;
        visiblePostIdRef.current = null;
        const task = InteractionManager.runAfterInteractions(() => {
          setVisiblePostId(null);
        });
        return () => task.cancel();
      }
    } else {
      // Screen regained focus via tab switch — restore playback after transition settles
      if (lastVisiblePostIdRef.current && !visiblePostIdRef.current) {
        const toRestore = lastVisiblePostIdRef.current;
        lastVisiblePostIdRef.current = null;
        visiblePostIdRef.current = toRestore;
        const task = InteractionManager.runAfterInteractions(() => {
          setVisiblePostId(toRestore);
        });
        return () => task.cancel();
      }
    }
  }, [isFocused]);

  // ── 1.2 transitionEnd video resume ───────────────────────────────────────────
  // We drive video playback restoration off transitionEnd (fires AFTER the native
  // animation completes) rather than off the focus event (fires at the START of
  // the animation). This is the direct fix for ConversationsList→HomeFeed lag.
  useEffect(() => {
    const unsubTransitionEnd = navigation.addListener("transitionEnd", (e) => {
      // e.data.closing is true when this screen is being pushed off the stack.
      // We only care about the return case (closing === false = this screen is
      // becoming the top of the stack again).
      if (e?.data?.closing) return;

      if (lastVisiblePostIdRef.current && !visiblePostIdRef.current) {
        console.log(
          `[HomeFeed][1.2] transitionEnd → restoring video: ${lastVisiblePostIdRef.current} at ${Date.now()}`,
        );
        // transitionEnd already guarantees the animation is done — no
        // InteractionManager wrapper needed (that was the cause of the lag).
        visiblePostIdRef.current = lastVisiblePostIdRef.current;
        setVisiblePostId(lastVisiblePostIdRef.current);
        lastVisiblePostIdRef.current = null;
      }
    });
    return () => unsubTransitionEnd();
  }, [navigation]);

  // Compound cursor-based pagination state (Step 2: effective_sort_time + id)
  const [cursorTime, setCursorTime] = useState(null);
  const [cursorId, setCursorId] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);



  // Delete modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [postToDelete, setPostToDelete] = useState(null);

  // Delete toast state
  const toastOpacity = useRef(new RNAnimated.Value(0)).current;
  const toastTranslateY = useRef(new RNAnimated.Value(0)).current;
  const [toastVisible, setToastVisible] = useState(false);

  const showDeleteToast = () => {
    toastOpacity.setValue(0);
    toastTranslateY.setValue(0);
    setToastVisible(true);
    RNAnimated.parallel([
      RNAnimated.timing(toastOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => {
        RNAnimated.parallel([
          RNAnimated.timing(toastOpacity, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
          RNAnimated.timing(toastTranslateY, {
            toValue: -28,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start(() => setToastVisible(false));
      }, 1200);
    });
  };

  // ── Account Switch Tutorial ───────────────────────────────────────────────
  const [tutorialStep, setTutorialStep] = useState(0); // 0 = hidden, 1-3 = step
  const tutorialOpacity = useSharedValue(0);
  const tutorialContentOpacity = useSharedValue(0);

  const animatedTutorialOverlay = useAnimatedStyle(() => ({
    opacity: tutorialOpacity.value,
  }));
  const animatedTutorialContent = useAnimatedStyle(() => ({
    opacity: tutorialContentOpacity.value,
  }));

  const showTutorialStep = (step) => {
    setTutorialStep(step);
    tutorialContentOpacity.value = 0;
    tutorialContentOpacity.value = withTiming(1, { duration: 350 });
  };

  const advanceTutorial = () => {
    HapticsService.triggerImpactLight();
    if (tutorialStep < 3) {
      showTutorialStep(tutorialStep + 1);
    } else {
      dismissTutorial();
    }
  };

  const dismissTutorial = () => {
    tutorialOpacity.value = withTiming(0, { duration: 400 });
    tutorialContentOpacity.value = withTiming(0, { duration: 300 });
    setTimeout(() => setTutorialStep(0), 450);
  };

  // Refs for scroll handling
  const flatListRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const feedItemsRef = useRef([]);

  // Scroll-to-top via onContentSizeChange — fires from the NATIVE layer after
  // RecyclerView finishes its layout pass. This is the correct moment to set
  // the scroll position: earlier hooks (useEffect, listRefCallback commit phase)
  // fire before the native layout, so RecyclerView can override them.
  // isInitialLoadRef gates it to a single fire per mount; subsequent calls
  // from image-load content expansions are ignored.
  const onListContentSizeChange = useCallback((w, h) => {
    if (__DEV__) {
      console.log(`[DIAG-CONTENT-SIZE] w=${w} h=${h} items=${feedItemsRef.current?.length ?? 0}`);
    }
    if (isInitialLoadRef.current && flatListRef.current) {
      isInitialLoadRef.current = false;
      flatListRef.current.scrollToOffset({ offset: 0, animated: false });
    }
  }, []);

  // Ref callback: store the ref for programmatic scroll operations (e.g. logo tap to top)
  const listRefCallback = useCallback((ref) => {
    flatListRef.current = ref;
  }, []);

  // Reanimated shared value for premium scroll-reactive header
  const scrollY = useSharedValue(0);

  // ── [DIAG-DRIFT] Scroll drift tracking ────────────────────────────────────
  const isDraggingRef = useRef(false);
  const isMomentumRef = useRef(false);

  const logScrollDrift = useCallback((y) => {
    if (!__DEV__) return;
    const isDragging = isDraggingRef.current;
    const isMomentum = isMomentumRef.current;
    const isAutonomous = !isDragging && !isMomentum;
    console.log(`[DIAG-DRIFT] offset=${y.toFixed(1)} isDragging=${isDragging} isMomentum=${isMomentum} AUTONOMOUS=${isAutonomous}`);
  }, []);

  // Scroll handler using Reanimated for performant tracking
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      // Clamp to 0 to prevent negative values during pull-to-refresh
      scrollY.value = Math.max(0, event.contentOffset.y);
      if (__DEV__) {
        runOnJS(logScrollDrift)(event.contentOffset.y);
      }
    },
    onBeginDrag: () => {
      'worklet';
    },
  });

  // ── Scroll state tracking — lets network callbacks know whether to defer setState
  const scrollState = useScrollState();
  const { isScrollingRef } = scrollState;

  const onScrollBeginDrag = useCallback((e) => {
    isDraggingRef.current = true;
    isMomentumRef.current = false;
    scrollState.onScrollBeginDrag?.(e);
  }, [scrollState]);

  const onScrollEndDrag = useCallback((e) => {
    isDraggingRef.current = false;
    isMomentumRef.current = true;
    scrollState.onScrollEndDrag?.(e);
  }, [scrollState]);

  const onMomentumScrollEnd = useCallback((e) => {
    isDraggingRef.current = false;
    isMomentumRef.current = false;
    scrollState.onMomentumScrollEnd?.(e);
  }, [scrollState]);

  // Debounce ref and handler for reloading unread message counts
  const messageDebounceTimeoutRef = useRef(null);
  const debouncedLoadMessageUnreadCount = useCallback(() => {
    if (messageDebounceTimeoutRef.current) {
      clearTimeout(messageDebounceTimeoutRef.current);
    }
    messageDebounceTimeoutRef.current = setTimeout(() => {
      loadMessageUnreadCount();
    }, 500);
  }, []);

  // Cleanup message debounce timer on unmount
  useEffect(() => {
    return () => {
      if (messageDebounceTimeoutRef.current) {
        clearTimeout(messageDebounceTimeoutRef.current);
      }
    };
  }, []);

  // Subscribe to socket 'new_message' events to update the inbox unread badge.
  // Replaces the Supabase Realtime subscription on the messages table, which
  // was unreliable due to the RLS policy using complex JOINs that Supabase
  // Realtime cannot evaluate reliably for change-data-capture filtering.
  useEffect(() => {
    const handleNewMessage = () => {
      console.log('[HomeFeedScreen] new_message socket event → refreshing unread count');
      debouncedLoadMessageUnreadCount();
    };

    const socket = getSocket();
    if (socket) {
      socket.on('new_message', handleNewMessage);
    }

    // Re-subscribe if socket reconnects
    const reconnectSub = EventBus.on('socket:reconnected', () => {
      const s = getSocket();
      if (s) s.on('new_message', handleNewMessage);
    });

    return () => {
      const s = getSocket();
      if (s) s.off('new_message', handleNewMessage);
      reconnectSub?.();
    };
  }, [debouncedLoadMessageUnreadCount]);

  // Auto-poll for new posts
  const { isPolling: isFeedPolling, initializeTimestamp } = useFeedPolling({
    baseInterval: 30000,
    enabled: !loading,
    onNewPostsLoaded: async (newPosts) => {
      console.log("[HomeFeed] Auto-loading new posts from polling");
      const mergedPosts = await LikeStateManager.mergeLikeStates(
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
      // \u2500\u2500 PERF: Defer the state update until the user finishes scrolling.
      // If isScrollingRef is false (user idle), InteractionManager resolves immediately.
      // If scrolling, it queues until touch events settle \u2014 preventing render bursts mid-scroll.
      InteractionManager.runAfterInteractions(() => {
        setPosts(mergedPosts);
        HapticsService.triggerImpactLight();
      });
    },
  });

  // Load events for discovery.
  // Limit raised to 30: larger pool needed for the zero-follow cold-start feed path
  // which has no followed posts to serve as a positional spine.
  const loadEvents = async () => {
    try {
      const response = await discoverEvents({ limit: 30 });
      if (response?.events) {
        setEvents(response.events);
      }
    } catch (error) {
      console.warn("[HomeFeed] Error loading events:", error.message);
    }
  };

  // Load opportunities based on role
  const loadOpportunities = async () => {
    try {
      let response;
      if (role === "community") {
        // For communities, load THEIR OWN active opportunities
        // And inject their profile info since it might be missing in "my opportunities" endpoint
        const { getActiveAccount } = await import("../../api/auth");
        const token = await getAuthToken();
        const account = await getActiveAccount();

        let profile = null;
        if (token && account?.email) {
          try {
            const profileRes = await apiPost(
              "/auth/get-user-profile",
              { email: account.email },
              10000,
              token,
            );
            profile = profileRes?.profile;
          } catch (e) {
            console.warn(
              "Failed to fetch profile for opportunity injection",
              e,
            );
          }
        }

        response = await getOpportunities("active");

        // Inject creator info
        if (
          response &&
          (response.opportunities || response.data || Array.isArray(response))
        ) {
          const rawOpps = response.opportunities || response.data || response;
          if (Array.isArray(rawOpps) && profile) {
            const injectedOpps = rawOpps.map((op) => ({
              ...op,
              creator_name:
                op.creator_name ||
                profile.name ||
                profile.full_name ||
                profile.username,
              creator_photo:
                op.creator_photo ||
                profile.logo_url ||
                profile.profile_picture ||
                profile.photo_url,
              creator_id: op.creator_id || profile.id,
            }));
            response = { opportunities: injectedOpps };
          }
        }
      } else {
        // For members, load followed opportunities
        response = await getFollowedOpportunities(3);
      }

      const opps = response?.opportunities || response?.data || [];
      if (Array.isArray(opps)) {
        setOpportunities(opps);
      }
    } catch (error) {
      console.warn("[HomeFeed] Error loading opportunities:", error.message);
    }
  };

  // Load discovery posts: scored non-followed editorial posts for feed injection.
  // Request limit=30 (backend default was 10, now parameterized up to 30).
  // Non-fatal — an error silently returns an empty pool (same pattern as loadEvents).
  const loadDiscoveryPosts = async (offset = 0) => {
    if (isLoadingDiscoveryRef.current) return;
    isLoadingDiscoveryRef.current = true;
    try {
      if (__DEV__) {
        console.log(`[LDP-ENTRY] offset=${offset}`);
      }
      const token = await getAuthToken();
      const response = await apiGet(`/posts/discovery?limit=30&offset=${offset}`, 10000, token);
      const rawPosts = response?.posts || [];
      const rawHasMore = response?.hasMore;
      const computedHasMore = rawHasMore !== undefined ? Boolean(rawHasMore) : rawPosts.length === 30;

      if (__DEV__) {
        console.log(`[LDP-RESPONSE] postsCount=${rawPosts.length} rawHasMore=${rawHasMore} hasMore=${computedHasMore}`);
      }

      if (offset === 0) {
        setDiscoveryPosts(rawPosts);
        discoveryOffsetRef.current = rawPosts.length;
      } else {
        setDiscoveryPosts((prev) => [...prev, ...rawPosts]);
        discoveryOffsetRef.current += rawPosts.length;
      }
      setDiscoveryHasMore(computedHasMore);
      if (__DEV__) {
        console.log(`[LDP-STATE] offset=${discoveryOffsetRef.current} hasMore=${computedHasMore}`);
      }
    } catch (error) {
      console.warn('[HomeFeed] Error loading discovery posts:', error?.message);
    } finally {
      isLoadingDiscoveryRef.current = false;
    }
  };

  const loadMoreDiscovery = async () => {
    if (isLoadingDiscoveryRef.current || !discoveryHasMore) return;
    await loadDiscoveryPosts(discoveryOffsetRef.current);
  };

  // Load discovery opportunities: scored non-followed community opps for feed injection.
  // Request limit=30 (backend ceiling raised from 20→30 to match zero-follow pool needs).
  // Non-fatal — an error silently returns an empty pool (same pattern as loadDiscoveryPosts).
  const loadDiscoveryOpportunities = async () => {
    try {
      const response = await getDiscoveryOpportunities(30);
      if (response?.opportunities && Array.isArray(response.opportunities)) {
        setDiscoveryOpportunities(response.opportunities);
      }
    } catch (error) {
      console.warn('[HomeFeed] Error loading discovery opportunities:', error?.message);
    }
  };

  const loadTargetedPromo = async () => {
    try {
      const token = await getAuthToken();
      const response = await apiGet('/posts/promo-targeted', 8000, token);
      if (response?.posts && Array.isArray(response.posts)) {
        setTargetedPromoPosts(response.posts);
      }
    } catch (error) {
      console.warn('[HomeFeed] Error loading targeted promo posts:', error?.message);
    }
  };

  // Merge posts, events, and opportunities into a single flat list.
  // We use useMemo to compute feedItems synchronously in the render phase,
  // reducing the number of renders from two down to exactly one on updates.
  // Single skeleton card — fills exactly one viewport so the user can't
  // scroll further, and there's no content below to accidentally reveal.
  const SKELETON_ITEMS = useMemo(
    () => [{ id: "skeleton-0", itemType: "skeleton" }],
    [],
  );

  const feedItems = useMemo(() => {
    // ── Guard: no content at all ────────────────────────────────────────────────
    // Include ALL candidate pools in the empty-check so zero-follow users whose
    // followed posts array is empty but who have discovery candidates don't get
    // an empty feed. ListEmptyComponent handles loading/empty-state display.
    const hasAnyContent =
      posts.length > 0 ||
      events.length > 0 ||
      opportunities.length > 0 ||
      discoveryPosts.length > 0 ||
      discoveryOpportunities.length > 0 ||
      targetedPromoPosts.length > 0;
    if (!hasAnyContent) return [];

    const merged = [];
    let eventIndex = 0;
    let opportunityIndex = 0;
    let discoveryIndex = 0;
    let promoIndex = 0;
    const FIRST_EVENT_AT = 2;
    const SUBSEQUENT_INTERVAL = 5;
    const OPPORTUNITY_INTERVAL = 3;

    // ── Window size matches getFeed page limit (limit=20 — confirmed in loadFeed URL) ──
    // Used to re-arm quantity caps per scroll window so long sessions still get
    // discovery/backlog content after the initial cap is exhausted.
    const WINDOW_SIZE = 20;

    // ── Backlog pacing: at most BACKLOG_CAP per author per WINDOW. ─────────────
    // Quantity cap is per-window (resets every WINDOW_SIZE posts).
    // Author diversity (backlogAuthorCount) is session-wide — does NOT reset per
    // window — to prevent the same author reappearing in every window.
    const BACKLOG_CAP = 2;
    const backlogAuthorCount = {};    // session-wide: author → total shown this session
    const backlogWindowCount = {};    // per-window: author → shown in current window

    // ── Discovery posts: 3 per window, 1 per 5 posts, per-type author diversity ──
    // DISCOVERY_CAP applies per window (re-arms at each WINDOW_SIZE boundary).
    // discoveryAuthorCount is session-wide — prevents same author+type across all windows.
    const DISCOVERY_CAP = 3;
    const DISCOVERY_INTERVAL = 5;
    let discoveryShownThisWindow = 0;    // resets at each window boundary
    let lastDiscoveryWindow = 0;          // tracks which window we're currently in
    const discoveryAuthorCount = {};      // session-wide per-type author diversity

    // ── Discovery Opportunities: 3 per window, same windowing semantics as Discovery Posts ──
    const DISCOVERY_OPP_INTERVAL = 5;
    const DISCOVERY_OPP_CAP = 3;
    let discoveryOppShownThisWindow = 0;  // resets at each window boundary
    let lastDiscoveryOppWindow = 0;       // tracks which window we're currently in
    let discoveryOppIndex = 0;
    const discoveryOppAuthorCount = {};   // session-wide author diversity

    if (posts.length > 0) {
      posts.forEach((post, index) => {
        const postNumber = index + 1;

        // ── Window index: 0-based, advances every WINDOW_SIZE followed posts ──
        const currentWindow = Math.floor((postNumber - 1) / WINDOW_SIZE);

        // ── Backlog: quantity cap is per-window, diversity is session-wide ─────
        // If we've entered a new window, reset the per-window author counter.
        if (post.is_backlog_post) {
          const authorKey = `${post.author_type}-${post.author_id}`;
          // Derive per-window key so each window gets a fresh quota per author.
          const windowKey = `${authorKey}__w${currentWindow}`;
          const seenThisWindow = backlogWindowCount[windowKey] || 0;
          if (seenThisWindow >= BACKLOG_CAP) return;
          // Also guard: if this author already appeared this session (any window),
          // still allow up to BACKLOG_CAP in the new window (diversity is author-level,
          // not window-level) — backlogAuthorCount is informational only here, not a gate.
          backlogWindowCount[windowKey] = seenThisWindow + 1;
          backlogAuthorCount[authorKey] = (backlogAuthorCount[authorKey] || 0) + 1;
        }

        merged.push({ ...post, itemType: 'post' });

        // ── Targeted promo: position 2 for first, spaced ~8 posts apart for subsequent ────
        const shouldInsertPromo =
          (postNumber === 2 && promoIndex === 0) ||
          (promoIndex > 0 && postNumber === 2 + promoIndex * 8);

        if (shouldInsertPromo && promoIndex < targetedPromoPosts.length) {
          merged.push({
            ...targetedPromoPosts[promoIndex],
            itemType: 'post',
            is_targeted_promo: true,
          });
          promoIndex++;
        }

        // Insert Event
        const shouldInsertEvent =
          (postNumber === FIRST_EVENT_AT && eventIndex === 0) ||
          (eventIndex > 0 &&
            postNumber > FIRST_EVENT_AT &&
            (postNumber - FIRST_EVENT_AT) % SUBSEQUENT_INTERVAL === 0);

        if (shouldInsertEvent && eventIndex < events.length) {
          merged.push({ ...events[eventIndex], itemType: 'event' });
          eventIndex++;
        }

        // Insert Opportunity (Distributed every 3rd post)
        if (
          postNumber % OPPORTUNITY_INTERVAL === 0 &&
          opportunityIndex < opportunities.length
        ) {
          merged.push({
            ...opportunities[opportunityIndex],
            itemType: 'opportunity',
          });
          opportunityIndex++;
        }

        // ── Discovery posts: per-window quota, per-type author diversity ──────────
        // Re-arms every WINDOW_SIZE posts so long sessions keep getting fresh content.
        // discoveryAuthorCount is session-wide: prevents same author+type in any window.
        if (postNumber % DISCOVERY_INTERVAL === 0) {
          // Re-arm: if we've entered a new window, reset the per-window shown counter.
          if (currentWindow > lastDiscoveryWindow) {
            discoveryShownThisWindow = 0;
            lastDiscoveryWindow = currentWindow;
          }
          if (discoveryShownThisWindow < DISCOVERY_CAP) {
            // Scan past candidates from an already-shown author+type (session-wide per-type diversity)
            while (
              discoveryIndex < discoveryPosts.length &&
              (discoveryAuthorCount[
                `${discoveryPosts[discoveryIndex].author_type}-${discoveryPosts[discoveryIndex].author_id}-${discoveryPosts[discoveryIndex].post_type}`
              ] || 0) >= 1
            ) {
              discoveryIndex++;
            }
            // Inject next valid candidate (first author+type not yet shown this session)
            if (discoveryIndex < discoveryPosts.length) {
              const dp = discoveryPosts[discoveryIndex];
              const dpAuthorKey = `${dp.author_type}-${dp.author_id}-${dp.post_type}`;
              merged.push({
                ...dp,
                itemType: 'post',
                is_discovery_post: true,
              });
              discoveryAuthorCount[dpAuthorKey] = (discoveryAuthorCount[dpAuthorKey] || 0) + 1;
              discoveryIndex++;
              discoveryShownThisWindow++;
            }
          }
        }

        // ── Discovery Opportunities: per-window quota, session-wide author diversity ──
        // Same windowing semantics as Discovery Posts above.
        if (postNumber % DISCOVERY_OPP_INTERVAL === 0) {
          // Re-arm: reset per-window counter when crossing a window boundary.
          if (currentWindow > lastDiscoveryOppWindow) {
            discoveryOppShownThisWindow = 0;
            lastDiscoveryOppWindow = currentWindow;
          }
          if (discoveryOppShownThisWindow < DISCOVERY_OPP_CAP) {
            while (
              discoveryOppIndex < discoveryOpportunities.length &&
              (discoveryOppAuthorCount[
                `${discoveryOpportunities[discoveryOppIndex].creator_type}-${discoveryOpportunities[discoveryOppIndex].creator_id}-opportunity`
              ] || 0) >= 1
            ) {
              discoveryOppIndex++;
            }
            if (discoveryOppIndex < discoveryOpportunities.length) {
              const dopp = discoveryOpportunities[discoveryOppIndex];
              const doppAuthorKey = `${dopp.creator_type}-${dopp.creator_id}-opportunity`;
              merged.push({
                ...dopp,
                itemType: 'opportunity',
                is_discovery_opportunity: true,
              });
              discoveryOppAuthorCount[doppAuthorKey] = (discoveryOppAuthorCount[doppAuthorKey] || 0) + 1;
              discoveryOppIndex++;
              discoveryOppShownThisWindow++;
            }
          }
        }
      });

      // Append remaining targeted promos before other trailing items
      while (promoIndex < targetedPromoPosts.length) {
        merged.push({
          ...targetedPromoPosts[promoIndex],
          itemType: 'post',
          is_targeted_promo: true,
        });
        promoIndex++;
      }

      // Append remaining events
      while (eventIndex < events.length) {
        merged.push({ ...events[eventIndex], itemType: 'event' });
        eventIndex++;
      }

      // Append remaining opportunities
      while (opportunityIndex < opportunities.length) {
        merged.push({
          ...opportunities[opportunityIndex],
          itemType: 'opportunity',
        });
        opportunityIndex++;
      }

      // Collect IDs and author counts from followed phase (keyed per content-type)
      const followedIds = new Set();
      const baseAuthorCounts = {};
      merged.forEach((item) => {
        if (item && item.id != null) {
          followedIds.add(`${item.itemType}-${item.id}`);
        }
        if (item?.is_discovery_post && item.author_id != null) {
          const aKey = `${item.author_type}-${item.author_id}-${item.post_type}`;
          baseAuthorCounts[aKey] = (baseAuthorCounts[aKey] || 0) + 1;
        }
        if (item?.is_discovery_opportunity && item.creator_id != null) {
          const aKey = `${item.creator_type}-${item.creator_id}-opportunity`;
          baseAuthorCounts[aKey] = (baseAuthorCounts[aKey] || 0) + 1;
        }
      });
      followedInjectedIdsRef.current = followedIds;
      rolloverBaseAuthorCountsRef.current = baseAuthorCounts;

      return [...merged, ...rolloverFeedItems];
    } else {
      // ── Zero-follow feed path ──────────────────────────────────────────────
      // Handled and incrementally built by the Zero-follow Append Builder effect below.
      return zeroFollowFeedItems;
    }
  }, [posts, events, opportunities, discoveryPosts, discoveryOpportunities, targetedPromoPosts, zeroFollowFeedItems, rolloverFeedItems]);

  useEffect(() => {
    feedItemsRef.current = feedItems;
  }, [feedItems]);

  // ── Zero-follow Append Builder ───────────────────────────────────────────
  // When user follows 0 accounts (posts.length === 0):
  // 1. Initial build: normal full build + constraint walk + windowedShuffle on non-promo
  //    pool + promo pinned at position 2 (index 1). Sets zfInitializedRef.current = true.
  // 2. Append path: when discoveryPosts grows (pagination), normalize and constraint-
  //    filter only the new slice against session-wide zfAuthorCountRef, then append
  //    via setZeroFollowFeedItems(prev => [...prev, ...newClean]) without touching or
  //    reordering existing items.
  useEffect(() => {
    if (posts.length > 0) {
      if (zfInitializedRef.current) {
        zfInitializedRef.current = false;
        zfProcessedDiscoveryCountRef.current = 0;
        zfAuthorCountRef.current = {};
        setZeroFollowFeedItems([]);
      }
      return;
    }

    const hasAnyCandidates =
      discoveryPosts.length > 0 ||
      events.length > 0 ||
      discoveryOpportunities.length > 0 ||
      targetedPromoPosts.length > 0;

    if (!hasAnyCandidates) {
      if (zfInitializedRef.current) {
        zfInitializedRef.current = false;
        zfProcessedDiscoveryCountRef.current = 0;
        zfAuthorCountRef.current = {};
        setZeroFollowFeedItems([]);
      }
      return;
    }

    const ZF_AUTHOR_CAP = 1;

    const minMaxNorm = (items, scoreField) => {
      if (!items || items.length === 0) return [];
      const scores = items.map((i) => parseFloat(i[scoreField]) || 0);
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      const range = max - min || 1;
      return items.map((item, idx) => ({
        ...item,
        _normalizedScore: (scores[idx] - min) / range,
      }));
    };

    const applyDiversity = (items, authorKeyFn) => {
      const out = [];
      for (const item of items) {
        const key = authorKeyFn(item);
        const count = zfAuthorCountRef.current[key] || 0;
        if (count < ZF_AUTHOR_CAP) {
          zfAuthorCountRef.current[key] = count + 1;
          out.push(item);
        }
      }
      return out;
    };

    if (!zfInitializedRef.current) {
      // ── Full Build Path ──────────────────────────────────────────────────
      zfAuthorCountRef.current = {};

      const normPosts = minMaxNorm(
        discoveryPosts.map((p) => ({ ...p, itemType: "post", is_discovery_post: true })),
        "discovery_score"
      );
      const normEvents = minMaxNorm(
        events.map((e) => ({ ...e, itemType: "event" })),
        "score"
      );
      const normDiscoveryOpps = minMaxNorm(
        discoveryOpportunities.map((o) => ({
          ...o,
          itemType: "opportunity",
          is_discovery_opportunity: true,
        })),
        "discovery_score"
      );

      const filteredPosts = applyDiversity(
        normPosts,
        (p) => `${p.author_type}-${p.author_id}-${p.post_type}`
      );
      const filteredEvents = applyDiversity(
        normEvents,
        (e) => `community-${e.community_id}-event`
      );
      const filteredDiscoveryOpps = applyDiversity(
        normDiscoveryOpps,
        (o) => `${o.creator_type}-${o.creator_id}-opportunity`
      );

      const pool = [
        ...filteredPosts,
        ...filteredEvents,
        ...filteredDiscoveryOpps,
      ].sort((a, b) => b._normalizedScore - a._normalizedScore);

      const constrained = [];
      const remaining = [...pool];
      while (remaining.length > 0) {
        const n = constrained.length;
        const next = remaining[0];
        const isSameType =
          n >= 2 &&
          constrained[n - 1].itemType === next.itemType &&
          constrained[n - 2].itemType === next.itemType;

        if (!isSameType) {
          constrained.push(remaining.shift());
        } else {
          const swapIdx = remaining.findIndex((r) => r.itemType !== next.itemType);
          if (swapIdx === -1) {
            constrained.push(remaining.shift());
          } else {
            constrained.push(...remaining.splice(swapIdx, 1));
          }
        }
      }

      // windowedShuffle only on non-promo pool
      const shuffled = constrained.length > 1 ? windowedShuffle(constrained) : constrained;

      // Insert targeted promos: first at index 1, subsequent spaced ~8 items apart AFTER shuffle
      let finalZeroFollow = [...shuffled];
      if (targetedPromoPosts && targetedPromoPosts.length > 0) {
        targetedPromoPosts.forEach((promoPost, pIdx) => {
          const promoItem = {
            ...promoPost,
            itemType: "post",
            is_targeted_promo: true,
          };
          const insertIdx = Math.min(finalZeroFollow.length, 1 + pIdx * 8);
          finalZeroFollow = [
            ...finalZeroFollow.slice(0, insertIdx),
            promoItem,
            ...finalZeroFollow.slice(insertIdx),
          ];
        });
      }

      const cleanItems = finalZeroFollow.map(({ _normalizedScore, ...clean }) => clean);
      zfProcessedDiscoveryCountRef.current = discoveryPosts.length;
      zfInitializedRef.current = true;
      if (__DEV__) {
        console.log(`[ZF-BUILD] Full build: ${cleanItems.length} items (discoveryPosts=${discoveryPosts.length}, events=${events.length}, opps=${discoveryOpportunities.length})`);
      }
      setZeroFollowFeedItems(cleanItems);
    } else if (discoveryPosts.length > zfProcessedDiscoveryCountRef.current) {
      // ── Append Path ──────────────────────────────────────────────────────
      const newRawSlice = discoveryPosts.slice(zfProcessedDiscoveryCountRef.current);
      zfProcessedDiscoveryCountRef.current = discoveryPosts.length;

      const normNewPosts = minMaxNorm(
        newRawSlice.map((p) => ({ ...p, itemType: "post", is_discovery_post: true })),
        "discovery_score"
      );
      const filteredNewPosts = applyDiversity(
        normNewPosts,
        (p) => `${p.author_type}-${p.author_id}-${p.post_type}`
      );

      const sortedNew = filteredNewPosts.sort((a, b) => b._normalizedScore - a._normalizedScore);
      const newClean = sortedNew.map(({ _normalizedScore, ...clean }) => clean);

      if (newClean.length > 0) {
        if (__DEV__) {
          console.log(`[ZF-APPEND] Appending ${newClean.length} items (new discoveryPosts=${discoveryPosts.length})`);
        }
        setZeroFollowFeedItems((prev) => [...prev, ...newClean]);
      }
    }
  }, [posts.length, discoveryPosts, events, discoveryOpportunities, targetedPromoPosts]);

  // ── Rollover Append Builder (Small / Exhausted Following Accounts) ────────
  // When user follows >0 accounts (posts.length > 0):
  // 1. Initial build: build tail from remaining discovery candidates not yet
  //    injected during the followed-post merge loop.
  //    Filters out IDs in followedInjectedIdsRef, applies diversity extending
  //    rolloverBaseAuthorCountsRef (cap=1 per author+type), constraint-walk,
  //    windowedShuffle on non-promo pool. (NO promo re-pinning).
  // 2. Append path: when discoveryPosts grows (pagination), normalize and
  //    constraint-filter only the new slice against session-wide rolloverAuthorCountRef,
  //    then append via setRolloverFeedItems(prev => [...prev, ...newClean])
  //    without touching or reordering existing items.
  useEffect(() => {
    if (posts.length === 0) {
      if (rolloverInitializedRef.current) {
        rolloverInitializedRef.current = false;
        rolloverProcessedDiscoveryCountRef.current = 0;
        rolloverAuthorCountRef.current = {};
        setRolloverFeedItems([]);
      }
      return;
    }

    const minMaxNorm = (items, scoreField) => {
      if (!items || items.length === 0) return [];
      const scores = items.map((i) => parseFloat(i[scoreField]) || 0);
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      const range = max - min || 1;
      return items.map((item, idx) => ({
        ...item,
        _normalizedScore: (scores[idx] - min) / range,
      }));
    };

    const applyDiversity = (items, authorKeyFn) => {
      const out = [];
      for (const item of items) {
        const key = authorKeyFn(item);
        const count = rolloverAuthorCountRef.current[key] || 0;
        if (count < 1) {
          rolloverAuthorCountRef.current[key] = count + 1;
          out.push(item);
        }
      }
      return out;
    };

    if (!rolloverInitializedRef.current) {
      // ── Full Build Path for Rollover Tail ─────────────────────────────────
      rolloverAuthorCountRef.current = { ...(rolloverBaseAuthorCountsRef.current || {}) };

      // Filter out items already injected during followed phase
      const unusedPosts = discoveryPosts.filter(
        (p) => !followedInjectedIdsRef.current.has(`post-${p.id}`)
      );
      const unusedOpps = discoveryOpportunities.filter(
        (o) => !followedInjectedIdsRef.current.has(`opportunity-${o.id}`)
      );

      const normPosts = minMaxNorm(
        unusedPosts.map((p) => ({ ...p, itemType: "post", is_discovery_post: true })),
        "discovery_score"
      );
      const normOpps = minMaxNorm(
        unusedOpps.map((o) => ({ ...o, itemType: "opportunity", is_discovery_opportunity: true })),
        "discovery_score"
      );

      const filteredPosts = applyDiversity(
        normPosts,
        (p) => `${p.author_type}-${p.author_id}-${p.post_type}`
      );
      const filteredOpps = applyDiversity(
        normOpps,
        (o) => `${o.creator_type}-${o.creator_id}-opportunity`
      );

      const pool = [
        ...filteredPosts,
        ...filteredOpps,
      ].sort((a, b) => b._normalizedScore - a._normalizedScore);

      const constrained = [];
      const remaining = [...pool];
      while (remaining.length > 0) {
        const n = constrained.length;
        const next = remaining[0];
        const isSameType =
          n >= 2 &&
          constrained[n - 1].itemType === next.itemType &&
          constrained[n - 2].itemType === next.itemType;

        if (!isSameType) {
          constrained.push(remaining.shift());
        } else {
          const swapIdx = remaining.findIndex((r) => r.itemType !== next.itemType);
          if (swapIdx === -1) {
            constrained.push(remaining.shift());
          } else {
            constrained.push(...remaining.splice(swapIdx, 1));
          }
        }
      }

      const shuffled = constrained.length > 1 ? windowedShuffle(constrained) : constrained;
      const cleanItems = shuffled.map(({ _normalizedScore, ...clean }) => clean);

      rolloverProcessedDiscoveryCountRef.current = discoveryPosts.length;
      rolloverInitializedRef.current = true;
      if (__DEV__) {
        console.log(`[ROLLOVER-BUILD] Full build: ${cleanItems.length} tail items (discoveryPosts=${discoveryPosts.length}, opps=${discoveryOpportunities.length})`);
      }
      setRolloverFeedItems(cleanItems);
    } else if (discoveryPosts.length > rolloverProcessedDiscoveryCountRef.current) {
      // ── Append Path for Rollover Tail (Pagination) ───────────────────────
      const newRawSlice = discoveryPosts.slice(rolloverProcessedDiscoveryCountRef.current);
      rolloverProcessedDiscoveryCountRef.current = discoveryPosts.length;

      const unusedSlice = newRawSlice.filter(
        (p) => !followedInjectedIdsRef.current.has(`post-${p.id}`)
      );

      const normNewPosts = minMaxNorm(
        unusedSlice.map((p) => ({ ...p, itemType: "post", is_discovery_post: true })),
        "discovery_score"
      );
      const filteredNewPosts = applyDiversity(
        normNewPosts,
        (p) => `${p.author_type}-${p.author_id}-${p.post_type}`
      );

      const sortedNew = filteredNewPosts.sort((a, b) => b._normalizedScore - a._normalizedScore);
      const newClean = sortedNew.map(({ _normalizedScore, ...clean }) => clean);

      if (newClean.length > 0) {
        if (__DEV__) {
          console.log(`[ROLLOVER-APPEND] Appending ${newClean.length} tail items (new discoveryPosts=${discoveryPosts.length})`);
        }
        setRolloverFeedItems((prev) => [...prev, ...newClean]);
      }
    }
  }, [posts.length, discoveryPosts, discoveryOpportunities]);

  // Trickle pacing stamp: when feedItems updates and includes discovery posts/opportunities,
  // record each one as 'served' so the backend can track first_discovered_at.
  // This is load-gated (fires on feed load) rather than viewport-gated, which
  // is correct: the daily cap is per-introduction session, not per-scroll.
  useEffect(() => {
    feedItems.forEach(item => {
      if (item.is_discovery_post && item.id) {
        viewQueueService.recordDiscoveryServe(item.id);
      }
      if (item.is_discovery_opportunity && item.id) {
        viewQueueService.recordDiscoveryOppServe(item.id);
      }
    });
  }, [feedItems]);

  // 4A: The slice that actually gets handed to AnimatedFlashList.
  // By keeping this as a separate derived value we avoid mutating feedItems
  // (which is still used for the full-length checks in onEndReached) and we
  // keep feedItemIndexMapRef based on the real ordering so shouldPreloadItem
  // calculations remain correct even for items not yet revealed.
  const visibleFeedItems = useMemo(() => {
    // While the skeleton is showing, hand FlashList skeleton items so
    // ListEmptyComponent is never needed (and cache-hydrated real posts
    // never accidentally bypass the skeleton window).
    if (showSkeleton) return SKELETON_ITEMS;
    return feedItems.slice(0, revealedCount);
  }, [feedItems, revealedCount, showSkeleton]);

  useEffect(() => {
    // ── 1.4 Progressive hydration ───────────────────────────────────────────────
    // On mount, read the cached snapshot FIRST so FlashList has real content at
    // frame 0 instead of skeletons. The real network call still runs in the
    // background and replaces state when it resolves.
    const hydrateFromCache = async () => {
      try {
        const snapshot = await loadFeedSnapshot();
        if (snapshot && Array.isArray(snapshot.posts) && snapshot.posts.length > 0) {
          const eventsCount = Array.isArray(snapshot.events) ? snapshot.events.length : 0;
          const oppsCount = Array.isArray(snapshot.opportunities) ? snapshot.opportunities.length : 0;
          console.log(`[HomeFeed][1.4] Hydrating from cache: ${snapshot.posts.length} posts, ${eventsCount} events, ${oppsCount} opps`);
          // Populate state but DO NOT set loading=false or showSkeleton=false.
          // The skeleton window must still complete (SKELETON_MIN_MS + prefetch)
          // before real cards are revealed, even for cached content.
          console.log('[PHANTOM-SCROLL] Cache hydration → setPosts/setEvents/setOpportunities (may trigger onContentSizeChange)');
          setPosts(snapshot.posts);
          setEvents(Array.isArray(snapshot.events) ? snapshot.events : []);
          setOpportunities(Array.isArray(snapshot.opportunities) ? snapshot.opportunities : []);
        }
      } catch (e) {
        console.warn('[HomeFeed][1.4] Cache hydration failed:', e);
      }
    };

    const loadInitialData = async () => {
      skeletonStartTimeRef.current = Date.now();
      setShowSkeleton(true);
      setRevealedCount(0);
      setLoading(true);
      let revealDispatched = false;
      try {
        // Hydrate from cache (populates state without ending skeleton window)
        await hydrateFromCache();

        const results = await Promise.allSettled([
          loadFeed(true, true), // reset=true, skipSetLoading=true
          loadEvents(),
          loadOpportunities(),
          loadDiscoveryPosts(0),
          loadDiscoveryOpportunities(),
          loadTargetedPromo(),
          loadGreetingName(),
          loadMessageUnreadCount(),
        ]);
        const taskNames = [
          'loadFeed',
          'loadEvents',
          'loadOpportunities',
          'loadDiscoveryPosts',
          'loadDiscoveryOpportunities',
          'loadTargetedPromo',
          'loadGreetingName',
          'loadMessageUnreadCount',
        ];
        results.forEach((res, i) => {
          if (res.status === 'rejected') {
            console.warn(`[HomeFeed] Task ${taskNames[i]} failed in loadInitialData:`, res.reason);
          }
        });

        saveFeedSnapshot(postsRef.current || [], eventsRef.current || [], opportunitiesRef.current || []);

        // ── 4A Skeleton → first-batch reveal ──────────────────────────────
        // freshPostsRef was populated inside loadFeed for the reset path.
        // Compute how many posts fit in a 1-second render budget, prefetch
        // their images, enforce minimum skeleton display time, then reveal.
        const rawPosts = freshPostsRef.current || [];
        const candidateItems = rawPosts.length > 0
          ? rawPosts.map((p) => ({ ...p, itemType: 'post' }))
          : (feedItems || []);
        const batchSize = Math.max(1, computeBatchSize(candidateItems, 0, 12));
        const firstBatch = candidateItems.slice(0, batchSize);

        const prefetchPromise = prefetchBatchImages(firstBatch);
        const elapsed = Date.now() - skeletonStartTimeRef.current;
        const skeletonRemaining = Math.max(0, SKELETON_MIN_MS - elapsed);

        // Wait: at least skeletonRemaining ms AND prefetch (hard-capped at
        // skeletonRemaining + 1500ms so a slow image never blocks forever).
        await Promise.race([
          Promise.all([
            new Promise((r) => setTimeout(r, skeletonRemaining)),
            prefetchPromise,
          ]),
          new Promise((r) => setTimeout(r, skeletonRemaining + 1500)),
        ]);

        revealDispatched = true;
        console.log('[PHANTOM-SCROLL] Initial load: setRevealedCount(' + batchSize + ') + setShowSkeleton(false)');
        setRevealedCount(batchSize);
        setShowSkeleton(false);
        setLoading(false);
      } catch (error) {
        console.error('[HomeFeed] Error loading initial data:', error);
      } finally {
        if (!revealDispatched) {
          // Error path: still hide skeleton so user sees the error/empty state
          setShowSkeleton(false);
          setLoading(false);
        }
        // Start predictive prewarming once the app is idle
        const runOnIdle = (callback) => {
          if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(callback, { timeout: 2000 });
          } else {
            setTimeout(callback, 500);
          }
        };
        runOnIdle(() => {
          try {
            const { AppWarmupService } = require("../../services/appWarmupService");
            AppWarmupService.start();
          } catch (e) {
            console.warn("[HomeFeed] AppWarmupService startup failed:", e);
          }
        });
      }
    };
    loadInitialData();

    // Check for account switch tutorial flag
    const checkTutorialFlag = async () => {
      try {
        const flag = await AsyncStorage.getItem("@show_account_switch_tutorial");
        if (flag === "true") {
          await AsyncStorage.removeItem("@show_account_switch_tutorial");
          setTimeout(() => {
            tutorialOpacity.value = withTiming(1, { duration: 500 });
            showTutorialStep(1);
          }, 2000);
        }
      } catch (e) {
        console.warn("[HomeFeed] Tutorial flag check failed:", e);
      }
    };
    checkTutorialFlag();

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

    // When the active account changes, this component may be reused by React
    // Navigation (same route name = no unmount/remount), so the mount effect
    // above won't re-fire. Force a full reload so the greeting name, feed, and
    // identity state all reflect the newly active account.
    const offAccountSwitch = EventBus.on("account-switch-done", async () => {
      // 4A: account data is fully replaced → restart the skeleton + reveal window
      skeletonStartTimeRef.current = Date.now();
      setShowSkeleton(true);
      setRevealedCount(0);
      // Clear stale identity immediately so the UI doesn't flash old data
      setGreetingName(null);
      setCurrentUserId(null);
      setCurrentUserType(null);
      // Invalidate the hoisted auth token ref so mounted cards don't inherit
      // the previous account's token. api/auth.js already clears its own
      // cachedToken on accountSwitched; we mirror that here so the ref is null
      // rather than stale. Cards' action handlers have a || await getAuthToken()
      // fallback that will re-warm the ref on first use after the switch.
      authTokenRef.current = null;
      // Clear the ViewQueueService token cache so it re-fetches for the new account.
      viewQueueService.setCachedToken(null);
      getAuthToken().then((t) => {
        authTokenRef.current = t;
        viewQueueService.setCachedToken(t);
      });
      // ── 1.4 Clear cached snapshot to prevent cross-account leakage ──────────
      // The cached feed belongs to the previous account. Clear it now so the
      // next cold start does not show another account's content at frame 0.
      clearFeedSnapshot();
      zfInitializedRef.current = false;
      zfProcessedDiscoveryCountRef.current = 0;
      zfAuthorCountRef.current = {};
      setZeroFollowFeedItems([]);
      setDiscoveryHasMore(true);
      discoveryOffsetRef.current = 0;
      // Reload all data for the new account
      setLoading(true);
      try {
        const results = await Promise.allSettled([
          loadGreetingName(),
          loadFeed(true, true),
          loadEvents(),
          loadOpportunities(),
          loadDiscoveryPosts(0),
          loadDiscoveryOpportunities(),
          loadTargetedPromo(),
          loadMessageUnreadCount(),
        ]);
        const taskNames = [
          'loadGreetingName',
          'loadFeed',
          'loadEvents',
          'loadOpportunities',
          'loadDiscoveryPosts',
          'loadDiscoveryOpportunities',
          'loadTargetedPromo',
          'loadMessageUnreadCount',
        ];
        results.forEach((res, i) => {
          if (res.status === 'rejected') {
            console.warn(`[HomeFeed] Task ${taskNames[i]} failed in account-switch reload:`, res.reason);
          }
        });
        // Persist fresh snapshot for the newly active account
        saveFeedSnapshot(postsRef.current, eventsRef.current, opportunitiesRef.current);

        // Skeleton reveal for account switch (same logic as initial load)
        const rawPosts = freshPostsRef.current || [];
        const candidateItems = rawPosts.length > 0
          ? rawPosts.map((p) => ({ ...p, itemType: 'post' }))
          : (feedItems || []);
        const batchSize = Math.max(1, computeBatchSize(candidateItems, 0, 12));
        const firstBatch = candidateItems.slice(0, batchSize);
        const elapsed = Date.now() - skeletonStartTimeRef.current;
        await Promise.race([
          Promise.all([
            new Promise((r) => setTimeout(r, Math.max(0, SKELETON_MIN_MS - elapsed))),
            prefetchBatchImages(firstBatch),
          ]),
          new Promise((r) => setTimeout(r, Math.max(0, SKELETON_MIN_MS - elapsed) + 1500)),
        ]);
        setRevealedCount(batchSize);
        setShowSkeleton(false);
        setLoading(false);
      } catch (e) {
        console.warn('[HomeFeed] Error reloading after account switch:', e);
        setShowSkeleton(false);
        setLoading(false);
      }
    });

    return () => {
      off();
      offMessages();
      offNewMessage();
      offPostCreated();
      offPinUpdated();
      offAccountSwitch?.();
    };
  }, []);

  useEffect(() => {
    const handlePostLikeUpdate = async (payload) => {
      if (!payload?.postId) return;
      await LikeStateManager.setLikeState(payload.postId, payload.isLiked);

      // Update like state and count in-place for both like and unlike actions.
      // Retirement (hiding a liked post from the feed) is handled server-side by
      // the getFeed SQL exclusion — it takes effect on the next feed refresh, not
      // immediately. Removing posts optimistically on like was causing posts to
      // disappear as soon as the user tapped the like button.
      const likeUpdater = (prev) => {
        let changed = false;
        const updated = prev.map((post) => {
          if (post.id === payload.postId) {
            const nextLikes = typeof payload.likeCount === "number" ? payload.likeCount : post.like_count;
            const nextComments = typeof payload.commentCount === "number" ? payload.commentCount : post.comment_count;
            if (post.is_liked === payload.isLiked && post.like_count === nextLikes && post.comment_count === nextComments) {
              return post;
            }
            changed = true;
            return {
              ...post,
              is_liked: payload.isLiked,
              isLiked: payload.isLiked,
              like_count: nextLikes,
              comment_count: nextComments,
            };
          }
          return post;
        });
        return changed ? updated : prev;
      };

      setPosts(likeUpdater);
      setOpportunities(likeUpdater);
    };

    const handlePostCommentUpdate = (payload) => {
      if (!payload?.postId) return;
      const commentUpdater = (prev) =>
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
        );
      setPosts(commentUpdater);
      setOpportunities(commentUpdater);
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
      const updater = (prev) =>
        prev.map((post) =>
          post.id === payload.postId
            ? {
                ...post,
                public_view_count:
                  payload.viewCount !== undefined
                    ? Math.max(post.public_view_count || 0, payload.viewCount)
                    : (post.public_view_count || 0) + 1,
              }
            : post,
        );
      setPosts(updater);
      setOpportunities(updater);
    };

    const handleEventViewUpdate = (payload) => {
      if (!payload?.eventId) return;
      setEvents((prev) =>
        prev.map((event) =>
          event.id === payload.eventId
            ? {
                ...event,
                view_count:
                  payload.viewCount !== undefined
                    ? Math.max(event.view_count || 0, payload.viewCount)
                    : (event.view_count || 0) + 1,
              }
            : event,
        ),
      );
    };

    const handleOppViewUpdate = (payload) => {
      if (!payload?.opportunityId) return;
      setOpportunities((prev) =>
        prev.map((opp) =>
          opp.id === payload.opportunityId
            ? {
                ...opp,
                view_count:
                  payload.viewCount !== undefined
                    ? Math.max(opp.view_count || 0, payload.viewCount)
                    : (opp.view_count || 0) + 1,
              }
            : opp,
        ),
      );
    };

    const handlePlanViewUpdate = (payload) => {
      if (!payload?.planId) return;
      setPlans((prev) =>
        prev.map((plan) =>
          plan.id === payload.planId
            ? {
                ...plan,
                view_count:
                  payload.viewCount !== undefined
                    ? Math.max(plan.view_count || 0, payload.viewCount)
                    : (plan.view_count || 0) + 1,
              }
            : plan,
        ),
      );
    };

    const handlePostShareUpdate = (payload) => {
      if (!payload?.postId) return;
      const updater = (prev) =>
        prev.map((post) =>
          post.id === payload.postId
            ? { ...post, share_count: (post.share_count || 0) + (payload.increment || 1) }
            : post,
        );
      setPosts(updater);
      setOpportunities(updater);
    };

    const handlePostSaveUpdate = (payload) => {
      if (!payload?.postId) return;
      const updater = (prev) =>
        prev.map((post) =>
          post.id === payload.postId
            ? { ...post, is_saved: payload.isSaved, save_count: payload.saveCount }
            : post,
        );
      setPosts(updater);
      setOpportunities(updater);
    };

    const handlePostFollowUpdated = (payload) => {
      if (!payload?.authorId) return;
      const updater = (prev) =>
        prev.map((post) =>
          post.author_id === payload.authorId
            ? { ...post, ...payload }
            : post,
        );
      setPosts(updater);
      setOpportunities(updater);
    };

    const handleGenericPostUpdated = (payload) => {
      if (!payload?.id) return;
      handlePostUpdate(payload);
    };

    const unsubscribeView = EventBus.on("post-view-updated", handlePostViewUpdate);
    const unsubscribeEventView = EventBus.on("event-view-updated", handleEventViewUpdate);
    const unsubscribeOppView = EventBus.on("opportunity-view-updated", handleOppViewUpdate);
    const unsubscribePlanView = EventBus.on("plan-view-updated", handlePlanViewUpdate);
    const unsubscribeShare = EventBus.on("post-share-updated", handlePostShareUpdate);
    const unsubscribeSave = EventBus.on("post-save-updated", handlePostSaveUpdate);
    const unsubscribeFollow = EventBus.on("post-follow-updated", handlePostFollowUpdated);
    const unsubscribePollVote = EventBus.on("poll-vote-updated", handleGenericPostUpdated);
    const unsubscribeChallengeJoin = EventBus.on("challenge-join-updated", handleGenericPostUpdated);
    const unsubscribePromptSubmission = EventBus.on("prompt-submission-updated", handleGenericPostUpdated);

    return () => {
      if (unsubscribeLike) unsubscribeLike();
      if (unsubscribeComment) unsubscribeComment();
      if (unsubscribeView) unsubscribeView();
      if (unsubscribeEventView) unsubscribeEventView();
      if (unsubscribeOppView) unsubscribeOppView();
      if (unsubscribePlanView) unsubscribePlanView();
      if (unsubscribeShare) unsubscribeShare();
      if (unsubscribeSave) unsubscribeSave();
      if (unsubscribeFollow) unsubscribeFollow();
      if (unsubscribePollVote) unsubscribePollVote();
      if (unsubscribeChallengeJoin) unsubscribeChallengeJoin();
      if (unsubscribePromptSubmission) unsubscribePromptSubmission();
    };
  }, []);

  /* useEffect(() => {
    const unsubStart = navigation.addListener("transitionStart", (e) => {
      console.log(`[PERF-NAV] HomeFeedScreen transitionStart (closing: ${e?.data?.closing}) at t=${performance.now().toFixed(2)}ms`);
    });
    const unsubEnd = navigation.addListener("transitionEnd", (e) => {
      console.log(`[PERF-NAV] HomeFeedScreen transitionEnd (closing: ${e?.data?.closing}) at t=${performance.now().toFixed(2)}ms`);
    });
    const unsubFocus = navigation.addListener("focus", () => {
      console.log(`[PERF-NAV] HomeFeedScreen FOCUS at t=${performance.now().toFixed(2)}ms`);
    });
    const unsubBlur = navigation.addListener("blur", () => {
      console.log(`[PERF-NAV] HomeFeedScreen BLUR at t=${performance.now().toFixed(2)}ms`);
    });
    return () => {
      unsubStart();
      unsubEnd();
      unsubFocus();
      unsubBlur();
    };
  }, [navigation]); */

  useFocusEffect(
    React.useCallback(() => {
      let timer;
      if (typeof requestIdleCallback === "function") {
        timer = requestIdleCallback(() => {
          loadMessageUnreadCount();
        }, { timeout: 1500 });
      } else {
        timer = setTimeout(() => {
          loadMessageUnreadCount();
        }, 150);
      }
      return () => {
        if (typeof cancelIdleCallback === "function") cancelIdleCallback(timer);
        else clearTimeout(timer);
      };
    }, []),
  );

  const { loadInitial: loadNotifications } = useNotifications();
  useFocusEffect(
    React.useCallback(() => {
      let timer;
      if (typeof requestIdleCallback === "function") {
        timer = requestIdleCallback(() => {
          loadNotifications({ background: true });
        }, { timeout: 2000 });
      } else {
        timer = setTimeout(() => {
          loadNotifications({ background: true });
        }, 200);
      }
      return () => {
        if (typeof cancelIdleCallback === "function") cancelIdleCallback(timer);
        else clearTimeout(timer);
      };
    }, [loadNotifications]),
  );





  const loadMessageUnreadCount = async () => {
    try {
      const response = await getMessageUnreadCount();
      setMessageUnread(response.unreadCount || 0);
    } catch (error) {
      console.error("Error loading message unread count:", error);
    }
  };



  const loadFeed = async (reset = true, skipSetLoading = false) => {
    // Prevent duplicate calls while loading
    if (loadingMore) return;
    if (!hasMore && !reset) return;

    try {
      if (reset) {
        if (!skipSetLoading) setLoading(true);
        setCursorTime(null);
        setCursorId(null);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }
      setErrorMsg("");
      const token = await getAuthToken();
      if (!token) throw new Error("Authentication token not found.");

      // Build URL with compound cursor params (cursor_time + cursor_id) for pagination.
      // Cursor values are opaque tokens received from the server — never reconstructed here.
      const ctToUse = reset ? null : cursorTime;
      const ciToUse = reset ? null : cursorId;
      const hasCursor = !!(ctToUse && ciToUse);
      const url = hasCursor
        ? `/posts/feed?cursor_time=${encodeURIComponent(ctToUse)}&cursor_id=${encodeURIComponent(ciToUse)}&limit=20`
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

      const mergedPosts = await LikeStateManager.mergeLikeStates(newPosts);

      // Append or replace based on reset flag
      // 4A: capture freshly-loaded posts in a ref so triggerSkeletonReveal
      // can read them synchronously (before React re-renders feedItems).
      //
      // Fresh-load only: apply windowed shuffle to vary top-of-feed display order.
      // Pagination (reset=false) posts are left in exact server order.
      let postsToStore = mergedPosts;
      if (reset && mergedPosts.length > 1) {
        postsToStore = windowedShuffle(mergedPosts);
      }

      if (reset) freshPostsRef.current = postsToStore;
      setPosts((prevPosts) => {
        if (reset) return postsToStore;
        const existingIds = new Set(prevPosts.map((p) => p.id));
        const uniqueNew = mergedPosts.filter((p) => !existingIds.has(p.id));
        return [...prevPosts, ...uniqueNew];
      });

      // Update compound cursor from API response (opaque tokens — treat as-is)
      setCursorTime(response.next_cursor_time || null);
      setCursorId(response.next_cursor_id ?? null);
      setHasMore(response.has_more === true);

      if (reset && mergedPosts.length > 0 && mergedPosts[0]?.created_at) {
        initializeTimestamp(mergedPosts[0].created_at);
      }
    } catch (error) {
      console.error("Error loading feed:", error);
      setErrorMsg(error?.message || "Failed to load posts");
    } finally {
      if (!skipSetLoading) setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadGreetingName = async () => {
    try {
      const { getActiveAccount, getUserProfile } = await import("../../api/auth");
      const activeAccount = await getActiveAccount();

      if (activeAccount) {
        if (activeAccount.name || activeAccount.username) {
          setGreetingName(activeAccount.name || activeAccount.username);
        }
        if (activeAccount.id) setCurrentUserId(activeAccount.id);
        if (activeAccount.type) setCurrentUserType(activeAccount.type);
      }

      if (!activeAccount?.email) return;

      const email = activeAccount.email;
      const res = await getUserProfile(email);
      const prof = res?.profile || {};
      const name = prof.full_name || prof.name || prof.username || activeAccount.name || activeAccount.username || "Member";

      setGreetingName(name);
      if (prof.id) setCurrentUserId(prof.id);
      const userType = res?.role || activeAccount.type || role;
      setCurrentUserType(userType);
    } catch (e) {
      console.error("[HomeFeed] Error loading greeting name:", e);
    }
  };

  const onRefresh = async () => {
    // Pull-to-refresh: RefreshControl's native spinner is already visible, so
    // we skip the skeleton window and reveal the first batch immediately after
    // data arrives. Scroll-block batching still applies for subsequent scrolls.
    setRevealedCount(0);
    setShowSkeleton(false); // RefreshControl provides the loading UI
    setRefreshing(true);
    zfInitializedRef.current = false;
    zfProcessedDiscoveryCountRef.current = 0;
    zfAuthorCountRef.current = {};
    setZeroFollowFeedItems([]);
    rolloverInitializedRef.current = false;
    rolloverProcessedDiscoveryCountRef.current = 0;
    rolloverAuthorCountRef.current = {};
    setRolloverFeedItems([]);
    setDiscoveryHasMore(true);
    discoveryOffsetRef.current = 0;
    const results = await Promise.allSettled([
      loadFeed(),
      loadEvents(),
      loadOpportunities(),
      loadDiscoveryPosts(0),
      loadDiscoveryOpportunities(),
      loadTargetedPromo(),
      loadMessageUnreadCount(),
    ]);
    const taskNames = [
      'loadFeed',
      'loadEvents',
      'loadOpportunities',
      'loadDiscoveryPosts',
      'loadDiscoveryOpportunities',
      'loadTargetedPromo',
      'loadMessageUnreadCount',
    ];
    results.forEach((res, i) => {
      if (res.status === 'rejected') {
        console.warn(`[HomeFeed] Task ${taskNames[i]} failed in onRefresh:`, res.reason);
      }
    });
    // Reveal first batch based on cost budget (no min-skeleton wait needed)
    const rawPosts = freshPostsRef.current || [];
    const candidateItems = rawPosts.length > 0
      ? rawPosts.map((p) => ({ ...p, itemType: 'post' }))
      : (feedItems || []);
    const batchSize = Math.max(1, computeBatchSize(candidateItems, 0, 12));
    setRevealedCount(batchSize);
    setRefreshing(false);
    // Snap scroll position back to the very top after the shuffled data is laid out.
    // FlashList's native anchor logic tries to keep the previously-first item visible
    // when the array order changes — the double-rAF fires after that native pass
    // completes so our imperative scrollToOffset(0) is the final word on position.
    console.log('[PHANTOM-SCROLL] onRefresh: scheduling double-rAF scrollToOffset(0)');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        console.log('[PHANTOM-SCROLL] onRefresh: double-rAF firing scrollToOffset(0) now');
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
    });
  };

  // Intentionally a no-op.
  //
  // Previously this wrote the optimistic like/unlike state back into the parent
  // posts array immediately (via InteractionManager). That caused a race:
  //
  //   1. Tap A fires → optimistic write: posts[i].is_liked = true
  //   2. Tap B fires rapidly → optimistic write: posts[i].is_liked = false
  //   3. Tap A's request returns 400 "already liked" → card reverts local
  //      isLiked back to false — but the parent array already has is_liked=false
  //      from Tap B. No conflict visible at the card level.
  //   4. Any subsequent parent re-render (scroll, focus, EventBus) causes
  //      useRecyclingState to re-initialise from posts[i].is_liked — which is
  //      now stale relative to the card's own corrected local state.
  //   Result: heart icon snaps back to the wrong state on recycle.
  //
  // Fix: parent posts array is now updated ONLY by the EventBus
  // "post-like-updated" handler (handlePostLikeUpdate below), which fires only
  // after the server confirms the action. Cards manage their own optimistic
  // state exclusively via useRecyclingState local state + isLikingRef guard.
  const handleLikeUpdate = useCallback((_postId, _isLiked) => {
    // no-op — parent sync is handled exclusively by the EventBus
    // "post-like-updated" handler on server confirmation.
  }, []);

  const handlePostUpdate = useCallback((updatedItem) => {
    // Determine if it's a post or opportunity based on some property or just try both
    // But better to be explicit or generic.
    // The EventBus might send an opportunity, EditorialPostCard might send a post.

    setPosts((prevPosts) =>
      prevPosts.map((p) =>
        p.id === updatedItem.id ? { ...p, ...updatedItem } : p,
      ),
    );

    setOpportunities((prevOpps) =>
      prevOpps.map((o) =>
        o.id === updatedItem.id ? { ...o, ...updatedItem } : o,
      ),
    );
  }, []);

  const handleCommentPress = useCallback((postId, postType = "post") => {
    setSelectedPostId(postId);
    setSelectedPostType(postType);
    setCommentsModalVisible(true);
  }, []);

  const handleSharePress = useCallback((postId) => {
    const fromPosts = postsRef.current.find((p) => p.id === postId);
    const fromOpps = !fromPosts && opportunitiesRef.current.find((o) => o.id === postId);
    const fromEvents = !fromPosts && !fromOpps && eventsRef.current.find((e) => e.id === postId);

    const post = fromPosts || fromOpps || (fromEvents ? { ...fromEvents, itemType: "event" } : null);
    if (post) {
      setSelectedSharePost(post);
      setShareModalVisible(true);
    }
  }, []);

  const handleCommentCountChange = (postId, postType) => {
    return (prevCount) => {
      if (postType === "post") {
        setPosts((prevPosts) =>
          prevPosts.map((p) =>
            p.id === postId ? { ...p, comment_count: prevCount } : p,
          ),
        );
      } else if (postType === "opportunity") {
        setOpportunities((prevOpps) =>
          prevOpps.map((o) =>
            o.id === postId ? { ...o, comment_count: prevCount } : o,
          ),
        );
      } else if (postType === "event") {
        setEvents((prevEvents) =>
          prevEvents.map((e) =>
            e.id === postId ? { ...e, comment_count: prevCount } : e,
          ),
        );
      }
    };
  };

  const handleEventPress = useCallback((event) => {
    navigation.navigate("EventDetails", {
      eventId: event.id,
      eventData: event,
    });
  }, [navigation]);

  const handleInterestedPress = useCallback((event) => {
    // EventCard already handles the API toggle and UI state
    // No additional feedback needed here
  }, []);

  const handleEventComment = useCallback((id) => {
    handleCommentPress(id, "event");
  }, [handleCommentPress]);

  const handleOpportunityComment = useCallback((id) => {
    handleCommentPress(id, "opportunity");
  }, [handleCommentPress]);

  const handleOpportunityPress = useCallback((opp) => {
    navigation.navigate("OpportunityView", {
      opportunityId: opp.id,
    });
  }, [navigation]);

  const handleOpportunitySave = useCallback((id, saved) => {
    setOpportunities((prev) =>
      prev.map((o) => (o.id === id ? { ...o, is_saved: saved } : o)),
    );
  }, []);

  const handleOpportunityDelete = useCallback((opportunityId) => {
    setOpportunities((prev) => prev.filter((o) => o.id !== opportunityId));
  }, []);

  const handleUserPress = useCallback((userId, userType) => {
    if (!userId) return;
    const actualUserType = userType || "member";

    if (actualUserType === "community") {
      const isOwnCommunity =
        currentUserId && String(userId) === String(currentUserId);

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
          communityId: userId,
          viewerRole: "member",
        });
      } else {
        Alert.alert(
          "Community Profile",
          `Viewing community: ${userId}`,
        );
      }
      return;
    }

    if (actualUserType === "member") {
      const isOwnProfile =
        currentUserId && String(userId) === String(currentUserId);

      if (role === "member" || role === "community") {
        if (!isOwnProfile) {
          navigation.navigate("MemberPublicProfile", {
            memberId: userId,
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
          `Viewing member profile: ${userId}`,
        );
      }
      return;
    }
  }, [currentUserId, role, navigation, getNavigationStack]);

  const handleFollow = useCallback(async (userId, userType, shouldFollow) => {
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
  }, []);

  const handleRequestDelete = useCallback((postId) => {
    setPostToDelete(postId);
    setDeleteModalVisible(true);
  }, []);

  const handleConfirmDelete = async () => {
    if (!postToDelete) return;
    const postId = postToDelete;

    // Close modal immediately so UI feels responsive
    setDeleteModalVisible(false);
    setPostToDelete(null);

    // Optimistically remove from UI and show toast
    setPosts((prev) => prev.filter((post) => post.id !== postId));
    EventBus.emit("postDeleted", postId);
    showDeleteToast();

    try {
      const token = await getAuthToken();
      if (token) {
        await apiDelete(`/posts/${postId}`, null, 15000, token);
      }
    } catch (error) {
      console.error("Error deleting post:", error);
      Alert.alert("Error", "Failed to delete post");
    }
  };

  // Use a ref so the EventBus listener always has the latest handler
  // without needing to re-register on every render.
  const handleDeleteRef = useRef(null);
  const handleDelete = useCallback((postId) => {
    setPosts((prev) => prev.filter((post) => post.id !== postId));
  }, []);
  handleDeleteRef.current = handleDelete;

  // Listen for global events (deletions, updates from other screens)
  useEffect(() => {
    const stableHandler = (postId) => handleDeleteRef.current?.(postId);
    EventBus.on("postDeleted", stableHandler);
    EventBus.on("opportunityUpdated", handlePostUpdate);

    return () => {
      EventBus.off("postDeleted", stableHandler);
      EventBus.off("opportunityUpdated", handlePostUpdate);
    };
  }, []);

  // Note: handleScroll is now replaced by scrollHandler using Reanimated

  const handleLogoPress = useCallback(() => {
    HapticsService.triggerImpactLight();
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setTimeout(() => {
      onRefresh();
    }, 300);
  }, [onRefresh]);

  // ── [DIAG-HEIGHT] & [CELL-HEIGHT] Diagnostic Measurement ────────────────
  const measuredHeightsByTypeRef = useRef({});
  const ESTIMATED_HEIGHTS = {
    event: 579,
    opportunity: 496,
    skeleton: 700,
    post_media: 682,
    post_poll: 560,
    post_prompt: 470,
    post_qna: 470,
    post_challenge: 445,
    post_opportunity: 200,
    post_community_voice: 682,
    post_community_voice_text: 200,
  };

  const handleCellLayout = useCallback((item, e) => {
    if (!__DEV__) return;
    const measuredHeight = e.nativeEvent.layout.height;
    const hasMedia = item.image_urls && (Array.isArray(item.image_urls) ? item.image_urls.length > 0 : Boolean(item.image_urls));
    const itemType = item.itemType === "event"
      ? "event"
      : item.itemType === "opportunity"
        ? "opportunity"
        : item.itemType === "skeleton"
          ? "skeleton"
          : item.post_type === "community_voice"
            ? (hasMedia ? "post_community_voice" : "post_community_voice_text")
            : `post_${item.post_type || "media"}`;

    // [DIAG-HEIGHT]: first real measured height per item type
    if (!measuredHeightsByTypeRef.current[itemType]) {
      measuredHeightsByTypeRef.current[itemType] = measuredHeight;
      console.log(`[DIAG-HEIGHT] type=${itemType} firstMeasuredHeight=${measuredHeight.toFixed(1)} id=${item.id}`);
    }

    // [CELL-HEIGHT]: per-cell onLayout, logging whenever delta exceeds ~10-15px
    const est = ESTIMATED_HEIGHTS[itemType] || 682;
    const delta = Math.abs(measuredHeight - est);
    if (delta > 15) {
      console.log(`[CELL-HEIGHT] id=${item.id} type=${itemType} measured=${measuredHeight.toFixed(1)} est=${est} delta=${delta.toFixed(1)}`);
    }
  }, []);

  const renderFeedItem = useCallback(({ item }) => {
    let content;
    // 4A: skeleton items in visibleFeedItems while showSkeleton=true
    if (item.itemType === 'skeleton') {
      content = <SkeletonCard />;
    } else if (item.itemType === "event") {
      content = (
        <EventCard
          event={item}
          onPress={handleEventPress}
          onInterestedPress={handleInterestedPress}
          onShare={handleSharePress}
          onComment={handleEventComment}
          currentUserId={currentUserId}
          currentUserType={currentUserType}
          authToken={authTokenRef.current}
        />
      );
    } else if (item.itemType === "opportunity") {
      content = (
        <OpportunityFeedCard
          opportunity={item}
          onPress={handleOpportunityPress}
          onLike={handleLikeUpdate}
          onComment={handleOpportunityComment}
          onShare={handleSharePress}
          onSave={handleOpportunitySave}
          onDelete={handleOpportunityDelete}
          onUserPress={handleUserPress}
          onPostUpdate={handlePostUpdate}
          currentUserId={currentUserId}
          currentUserType={currentUserType}
          authToken={authTokenRef.current}
        />
      );
    } else {
      content = (
        <EditorialPostCard
          post={item}
          onLike={handleLikeUpdate}
          onComment={handleCommentPress}
          onShare={handleSharePress}
          onFollow={handleFollow}
          onDelete={handleDelete}
          onRequestDelete={handleRequestDelete}
          onPostUpdate={handlePostUpdate}
          showFollowButton={true}
          currentUserId={currentUserId}
          currentUserType={currentUserType}
          authToken={authTokenRef.current}
          isVideoPlaying={item.id === visiblePostId}
          shouldPreload={shouldPreloadItem(feedItemIndexMapRef.current.get(item.id) ?? -1)}
          isInViewport={isFocusedRef.current}
          isScreenFocused={isFocusedRef.current}
          navigation={navigation}
          onUserPress={handleUserPress}
        />
      );
    }

    return (
      <View onLayout={(e) => handleCellLayout(item, e)}>
        {content}
      </View>
    );
  }, [
    navigation,
    currentUserId,
    currentUserType,
    visiblePostId,
    shouldPreloadItem,
    role,
    getNavigationStack,
    handleEventPress,
    handleInterestedPress,
    handleLikeUpdate,
    handleSharePress,
    handlePostUpdate,
    handleCommentPress,
    handleFollow,
    handleDelete,
    handleRequestDelete,
    handleEventComment,
    handleOpportunityComment,
    handleOpportunityPress,
    handleOpportunitySave,
    handleOpportunityDelete,
    handleUserPress,
    handleCellLayout,
  ]);

  const viewabilityConfig = useRef({
    // Using viewAreaCoveragePercentThreshold ensures the video must cover
    // 60% of the viewport area before being considered viewable
    // This prevents tall videos from playing when mostly off-screen
    viewAreaCoveragePercentThreshold: 60,
    waitForInteraction: false,
    minimumViewTime: 100, // Small delay to prevent flickering during fast scrolls
  }).current;

  // Tracks which feed items are currently in the viewport. When an item
  // leaves visibility before its dwell timer qualifies, we route to the correct unseen impression handler.
  const currentlyVisibleMapRef = useRef(new Map());

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (!viewableItems || !Array.isArray(viewableItems)) return;

    const incomingMap = new Map();
    viewableItems.forEach((v) => {
      if (v && v.isViewable && v.item?.id != null) {
        const idStr = String(v.item.id);
        const itemType = v.item.itemType || (v.item.post_type ? "post" : "post");
        incomingMap.set(idStr, { id: v.item.id, itemType });
      }
    });

    // Items that were visible before but are no longer — they left the viewport.
    currentlyVisibleMapRef.current.forEach(({ id, itemType }, idStr) => {
      if (!incomingMap.has(idStr)) {
        if (itemType === "event") {
          viewQueueService.recordEventUnseen(id);
        } else if (itemType === "opportunity") {
          viewQueueService.recordOpportunityUnseen(id);
        } else {
          viewQueueService.recordUnseenImpression(id);
        }
      }
    });

    currentlyVisibleMapRef.current = incomingMap;

    if (viewableItems && viewableItems.length > 0) {
      // Find all video posts that are viewable (passing the 60% coverage threshold)
      const videoItems = viewableItems.filter(
        (item) =>
          item.item?.itemType === "post" &&
          item.item?.media_types?.[0] === "video" &&
          item.isViewable, // This now means 60% of viewport is covered
      );

      if (videoItems.length > 0) {
        const targetVideo = videoItems[0];
        const newPostId = targetVideo.item.id;
        const newIndex = targetVideo.index;

        console.log("[HomeFeed] Video viewable (60% coverage):", {
          postId: newPostId,
          index: newIndex,
          totalViewableVideos: videoItems.length,
        });

        // ── PERF: Update refs immediately (zero re-render cost during scroll).
        // Then schedule ONE deferred state update after the interaction settles.
        // This means setVisiblePostId fires ONCE per scroll stop, not per frame.
        visiblePostIdRef.current = newPostId;
        visibleIndexRef.current = newIndex;
        InteractionManager.runAfterInteractions(() => {
          setVisiblePostId(newPostId);
        });
      } else {
        // No videos meet the 60% threshold
        const firstViewable = viewableItems.find((item) => item.isViewable);
        if (firstViewable && firstViewable.item && firstViewable.item.id) {
          visiblePostIdRef.current = firstViewable.item.id;
          visibleIndexRef.current = firstViewable.index;
          InteractionManager.runAfterInteractions(() => {
            setVisiblePostId(firstViewable.item.id);
          });
        } else {
          visiblePostIdRef.current = null;
          visibleIndexRef.current = -1;
          InteractionManager.runAfterInteractions(() => {
            setVisiblePostId(null);
          });
        }
      }
    } else {
      // Nothing visible - pause all videos
      visiblePostIdRef.current = null;
      visibleIndexRef.current = -1;
      InteractionManager.runAfterInteractions(() => {
        setVisiblePostId(null);
      });
    }
  }, []);

  // ── PERF: feedItemIndexMap — O(1) id→index lookup to replace feedItems.indexOf(item)
  //    in renderFeedItem. Rebuilds only when feedItems changes, never during scroll.
  const feedItemIndexMapRef = useRef(new Map());
  useMemo(() => {
    const map = new Map();
    if (Array.isArray(feedItems)) {
      feedItems.forEach((item, i) => {
        if (item && item.id != null) {
          map.set(item.id, i);
        }
      });
    }
    feedItemIndexMapRef.current = map;
  }, [feedItems]);

  // ── Key Extractor & [DIAG-KEY-COLLISION] Verification Diagnostic ────────
  const keyExtractor = useCallback((item) => homeFeedKeyExtractor(item), []);

  useEffect(() => {
    if (!__DEV__ || !Array.isArray(feedItems) || feedItems.length === 0) return;
    const seenKeys = new Map();
    for (let i = 0; i < feedItems.length; i++) {
      const item = feedItems[i];
      if (!item) continue;
      const key = keyExtractor(item);
      if (seenKeys.has(key)) {
        const firstIdx = seenKeys.get(key);
        const firstItem = feedItems[firstIdx];
        console.warn(
          `[DIAG-KEY-COLLISION] Duplicate key detected: "${key}"! ` +
          `First item at index ${firstIdx} (id=${firstItem?.id}, itemType=${firstItem?.itemType}), ` +
          `Colliding item at index ${i} (id=${item?.id}, itemType=${item?.itemType})`
        );
      } else {
        seenKeys.set(key, i);
      }
    }
  }, [feedItems, keyExtractor]);

  // Compute preload status for a feed item based on its index distance from the visible video
  // ── PERF: reads from refs so this callback never needs to be in renderFeedItem's deps.
  const shouldPreloadItem = useCallback((itemIndex) => {
    const idx = visibleIndexRef.current;
    const dist = maxPreloadDistanceRef.current;
    if (idx < 0 || dist === 0) return false;
    const distance = Math.abs(itemIndex - idx);
    return distance > 0 && distance <= dist;
  }, []);

  const renderListEmptyComponent = useCallback(() => {
    if (loading) {
      return (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      );
    }
    return <EmptyFeedState />;
  }, [loading]);

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      {/* Android Focus Anchor: Prevents OS focus manager from stealing focus and scrolling the feed on modal dismiss */}
      <View
        focusable={true}
        accessible={false}
        importantForAccessibility="no"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1,
          height: 1,
          opacity: 0.01,
        }}
      />

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
            IconComponent={MessageCircle}
            showDot={messageUnread > 0}
            onPress={() => {
              const { AppWarmupService } = require("../../services/appWarmupService");
              AppWarmupService.recordChatOpen();
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

      {/* <React.Profiler
        id="HomeFeedFlashList"
        onRender={(id, phase, actualDuration) => {
          console.log(`[DIAG-REFOCUS-RENDER] HomeFeedFlashList phase=${phase} duration=${actualDuration.toFixed(2)}ms at t=${Date.now()}`);
        }}
      > */}
      <AnimatedFlashList
        ref={listRefCallback}
        nestedScrollEnabled={true}
        // 4A: skeleton items while showSkeleton=true; prefix slice of feedItems otherwise.
        data={visibleFeedItems}
        renderItem={renderFeedItem}
        keyExtractor={keyExtractor}
        style={styles.feed}
        contentContainerStyle={[
          styles.feedContent,
          { paddingTop: totalHeaderHeight },
        ]}
        // ── getItemType — 8 distinct recycling pools: post_media, post_poll,
        // post_prompt, post_qna, post_challenge, event, opportunity, skeleton.
        // Previously all 5 post sub-types shared a single "post" pool, causing
        // FlashList to recycle an 800px ChallengePostCard into a 300px text-post
        // slot (and vice-versa), triggering layout thrash and stale state leakage.
        // Phase 3.1 fix: one pool per distinct component tree.
        getItemType={(item) => {
          if (item.itemType === "event") return "event";
          if (item.itemType === "opportunity") return "opportunity";
          if (item.itemType === "skeleton") return "skeleton";
          if (item.itemType === "post") {
            return `post_${item.post_type || "media"}`;
          }
          return "post_media";
        }}
        // estimatedItemSize is the fallback default (most common type: post_media).
        estimatedItemSize={682}
        removeClippedSubviews={false}
        // Per-type size hints based on real device [CELL-HEIGHT] measurements:
        // event: 579, post_media: 682, post_poll: 560, post_prompt: 470,
        // post_challenge: 445, opportunity: 496, skeleton: 700, post_opportunity: 200.
        // ⚠️ post_qna is NOT YET MEASURED — using post_prompt's 470 as placeholder.
        overrideItemLayout={(layout, item) => {
          if (item.itemType === "event") { layout.size = 579; return; }
          if (item.itemType === "opportunity") { layout.size = 496; return; }
          if (item.itemType === "skeleton") { layout.size = 700; return; }
          switch (item.post_type) {
            case "opportunity": layout.size = 200; break;
            case "community_voice": {
              const hasMedia = item.image_urls && (Array.isArray(item.image_urls) ? item.image_urls.length > 0 : Boolean(item.image_urls));
              layout.size = hasMedia ? 682 : 200;
              break;
            }
            case "poll":        layout.size = 560; break;
            case "prompt":      layout.size = 470; break;
            case "qna":         layout.size = 470; break; // [DIAG-HEIGHT] UNMEASURED placeholder (matches prompt: 470)
            case "challenge":   layout.size = 445; break;
            default:            layout.size = 682; // media / text
          }
        }}
        drawDistance={800}
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
        // ── Scroll state handlers: update isScrollingRef so InteractionManager
        //    callbacks can defer expensive state updates until the user pauses.
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onContentSizeChange={onListContentSizeChange}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        ListHeaderComponent={<HomeGreetingHeader name={greetingName} />}
        ListEmptyComponent={renderListEmptyComponent}
        onEndReached={() => {
          // If the feed is empty, skip pagination & batch calculations
          if (!feedItems || feedItems.length === 0) return;

          // Guards: skip if skeleton still showing, if already blocked/loading,
          // or if a reveal is already in-flight (isRevealingRef prevents stacking).
          if (showSkeleton || isScrollBlocked || isRevealingRef.current) return;
          if (loading || loadingMore) return;

          if (revealedCount < feedItems.length) {
            // ── 4A inter-batch reveal path ──────────────────────────────────
            // Locally-fetched data exists beyond the slice window.
            // Block scroll + prefetch images for the next batch, then reveal.
            isRevealingRef.current = true;
            setIsScrollBlocked(true);

            const budget = 12; // ≈ 2s batch window
            const nextSize = computeBatchSize(feedItems, revealedCount, budget);
            const nextBatch = feedItems.slice(revealedCount, revealedCount + nextSize);

            Promise.race([
              Promise.all([
                new Promise((r) => setTimeout(r, BATCH_MIN_MS)),
                prefetchBatchImages(nextBatch),
              ]),
              new Promise((r) => setTimeout(r, BATCH_MIN_MS + 1500)),
            ]).then(() => {
              setRevealedCount((prev) => prev + nextSize);
              setIsScrollBlocked(false);
              isRevealingRef.current = false;
            });
          } else if (posts.length > 0 && hasMore) {
            // ── Real network pagination path (followed users) ───────────────
            // All local data revealed — fetch the next server page.
            // When it arrives, feedItems grows and the inter-batch path above
            // kicks in first, so page 2+ is also revealed in gated batches.
            loadFeed(false);
          } else if (discoveryHasMore && !isLoadingDiscoveryRef.current) {
            // ── Discovery network pagination path (zero-follow OR exhausted followed users) ──
            loadMoreDiscovery();
          }
        }}
        onEndReachedThreshold={1.0}
        ListFooterComponent={
          // Show spinner during both real network pagination (loadingMore)
          // AND local inter-batch prefetch windows (isScrollBlocked) so the
          // user always sees a spinner at the natural scroll-end rather than
          // a blank gap that feels like a freeze.
          loadingMore || isScrollBlocked ? (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <SnooLoader size="small" color={COLORS.primary} />
            </View>
          ) : (
            // ── End-state message ───────────────────────────────────────────
            // Shown when user has scrolled through all available feed items and discovery is fully exhausted
            ((!discoveryHasMore || (!hasMore && !discoveryHasMore)) && feedItems.length > 0 && revealedCount >= feedItems.length) ? (
              <CaughtUpFooter
                subtitle={
                  posts.length === 0
                    ? "Follow communities to keep your feed growing"
                    : "Follow more communities to keep your feed growing"
                }
              />
            ) : null
          )
        }
      />
      {/* </React.Profiler> */}


      {/* Comments Modal */}
      <CommentsModal
        visible={commentsModalVisible}
        postId={selectedPostId}
        baseRoute={selectedPostType === "opportunity" ? "/opportunities" : selectedPostType === "event" ? "/events" : "/posts"}
        replyBaseRoute={selectedPostType === "opportunity" ? "/opportunity-comments" : selectedPostType === "event" ? "/event-comments" : "/comments"}
        onClose={() => {
          setCommentsModalVisible(false);
          setSelectedPostId(null);
          setSelectedPostType("post");
        }}
        onCommentCountChange={
          selectedPostId ? handleCommentCountChange(selectedPostId, selectedPostType) : undefined
        }
        navigation={navigation}
      />

      {/* Share Modal */}
      <ShareModal
        visible={shareModalVisible}
        post={selectedSharePost}
        onClose={() => {
          setShareModalVisible(false);
          setSelectedSharePost(null);
        }}
      />



      {/* Delete Post Modal */}
      {deleteModalVisible && (
        <DeletePostModal
          visible={deleteModalVisible}
          onCancel={() => {
            setDeleteModalVisible(false);
            setPostToDelete(null);
          }}
          onDelete={handleConfirmDelete}
        />
      )}

      {/* ── Account Switch Tutorial Overlay ──────────────────────────────── */}
      {tutorialStep > 0 && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            styles.tutorialOverlay,
            animatedTutorialOverlay,
          ]}
          pointerEvents="box-none"
        >
          {/* Skip button */}
          <TouchableOpacity
            style={styles.tutorialSkip}
            onPress={dismissTutorial}
            activeOpacity={0.7}
          >
            <Text style={styles.tutorialSkipText}>Skip</Text>
          </TouchableOpacity>

          {/* Step indicator dots */}
          <View style={styles.tutorialDots}>
            {[1, 2, 3].map((s) => (
              <View
                key={s}
                style={[
                  styles.tutorialDot,
                  s === tutorialStep && styles.tutorialDotActive,
                ]}
              />
            ))}
          </View>

          {/* Step card */}
          <Animated.View style={[styles.tutorialCard, animatedTutorialContent]}>
            {tutorialStep === 1 && (
              <>
                <View style={styles.tutorialIconContainer}>
                  <Text style={styles.tutorialEmoji}>🔄</Text>
                </View>
                <Text style={styles.tutorialTitle}>You have two profiles!</Text>
                <Text style={styles.tutorialBody}>
                  You are now logged in as your member account. You can switch
                  between your community and member profiles at any time.
                </Text>
              </>
            )}
            {tutorialStep === 2 && (
              <>
                <View style={styles.tutorialIconContainer}>
                  <Text style={styles.tutorialEmoji}>👤</Text>
                </View>
                <Text style={styles.tutorialTitle}>Tap your profile icon</Text>
                <Text style={styles.tutorialBody}>
                  Head to your Profile tab and tap your avatar at the top to
                  open the account switcher.
                </Text>
              </>
            )}
            {tutorialStep === 3 && (
              <>
                <View style={styles.tutorialIconContainer}>
                  <Text style={styles.tutorialEmoji}>✨</Text>
                </View>
                <Text style={styles.tutorialTitle}>Switch anytime</Text>
                <Text style={styles.tutorialBody}>
                  The account switcher lets you jump between your community
                  dashboard and your member feed instantly.
                </Text>
              </>
            )}

            <TouchableOpacity
              style={styles.tutorialNextButton}
              onPress={advanceTutorial}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={COLORS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.tutorialNextGradient}
              >
                <Text style={styles.tutorialNextText}>
                  {tutorialStep < 3 ? "Next →" : "Got it!"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}

      {/* Delete Post Toast */}
      {toastVisible && (
        <RNAnimated.View
          style={[
            styles.deleteToast,
            {
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslateY }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.deleteToastText}>Post deleted</Text>
        </RNAnimated.View>
      )}
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
    backgroundColor: COLORS.primary, // Brand Blue
    borderWidth: 1.5,
    borderColor: COLORS.background, // Creates a gap effect against the container
  },
  // Greeting styles moved to HomeGreetingHeader component
  feed: {
    flex: 1,
  },
  feedContent: {
    paddingBottom: 40,
  },

  // ── Tutorial Overlay Styles ─────────────────────────────────────
  tutorialOverlay: {
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    zIndex: 9999,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 60,
    paddingHorizontal: 20,
  },
  tutorialSkip: {
    position: "absolute",
    top: 60,
    right: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  tutorialSkipText: {
    color: "rgba(255,255,255,0.8)",
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
  },
  tutorialDots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
  },
  tutorialDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  tutorialDotActive: {
    backgroundColor: "#FFFFFF",
    width: 22,
  },
  tutorialCard: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 20,
  },
  tutorialIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(53, 101, 242, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  tutorialEmoji: {
    fontSize: 34,
  },
  tutorialTitle: {
    fontSize: 20,
    fontFamily: "BasicCommercial-Bold",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  tutorialBody: {
    fontSize: 15,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  tutorialNextButton: {
    width: "100%",
    borderRadius: 50,
    overflow: "hidden",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  tutorialNextGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tutorialNextText: {
    color: "#FFFFFF",
    fontFamily: "Manrope-SemiBold",
    fontSize: 16,
    letterSpacing: 0.2,
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
  deleteToast: {
    position: "absolute",
    alignSelf: "center",
    top: "50%",
    backgroundColor: "rgba(31, 31, 31, 0.88)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 100,
    zIndex: 10000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  deleteToastText: {
    color: "#FFFFFF",
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    letterSpacing: 0.1,
  },
  // 4A scroll-block overlay — visible between batches while images prefetch
  scrollBlockOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: "rgba(255,255,255,0.96)",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
    zIndex: 500,
  },
  scrollBlockText: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
  },
  caughtUpContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  caughtUpIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(41, 98, 255, 0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  caughtUpTitle: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 16,
    color: COLORS.textPrimary || "#1a2d4a",
    marginBottom: 4,
    textAlign: "center",
  },
  caughtUpSubtitle: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    color: COLORS.textSecondary || "#8E8E93",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280,
  },
});
