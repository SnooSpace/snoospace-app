import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Share,
  Animated,
} from "react-native";
import { GradientHeart } from "./ui/GradientHeart";
import { ScrollView } from "react-native-gesture-handler";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Users,
  Bookmark,
  Star,
  CheckCircle2,
  Check,
  MoveRight,
  QrCode,
  Heart,
  MessageCircle,
  ChartNoAxesCombined,
  Send,
} from "lucide-react-native";
import { COLORS, BORDER_RADIUS, SHADOWS, FONTS } from "../constants/theme";
import { getGradientForName, getInitials } from "../utils/AvatarGenerator";
import { useLocationName } from "../utils/locationNameCache";
import { toggleEventInterest, toggleEventLike, recordEventView, trackEventShare } from "../api/events";
import { formatPrice } from "../utils/pricingUtils";
import HapticsService from "../services/HapticsService";
import EventBus from "../utils/EventBus";
import { getActiveAccount } from "../api/auth";
import CommentsModal from "./CommentsModal";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 40; // 20px padding on each side

/**
 * Parses a display date string into distinct Month and Day values
 * @param {string} dateStr - e.g. "Sun, May 31" or "May 31"
 * @returns {Object} { month: string, day: string }
 */
const parseDisplayDate = (dateStr) => {
  if (!dateStr) return { month: "EVT", day: "•" };
  const cleanStr = dateStr.replace(/,/g, "").trim();
  const parts = cleanStr.split(/\s+/);

  let month = "EVT";
  let day = "•";

  const monthNames = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec"
  ];

  for (let part of parts) {
    const lower = part.toLowerCase();
    if (monthNames.some((m) => lower.startsWith(m))) {
      month = part.substring(0, 3).toUpperCase();
    } else if (/^\d+$/.test(part)) {
      day = part;
    }
  }

  // Fallback check for day with suffixes (e.g., 31st)
  if (day === "•") {
    for (let part of parts) {
      const match = part.match(/^(\d+)(st|nd|rd|th)?$/i);
      if (match) {
        day = match[1];
        break;
      }
    }
  }

  return { month, day };
};

/**
 * EventCard - Display event in feed (interspersed with posts)
 *
 * @param {Object} event - Event data from API
 * @param {Function} onPress - Callback when card is pressed
 * @param {Function} onInterestedPress - Callback when interested button is pressed
 * @param {string} style - Additional styles
 */
export default function EventCard({
  event,
  onPress,
  onInterestedPress,
  onShare,
  onComment,
  style,
  hideEngagement = false,
  hideRsvp = false,
  hideQr = false,
  hidePriceDetails = false,
  showStatusLabel = false,
  onAttendeesPress,
  compact = false,
}) {
  const [isInterested, setIsInterested] = useState(
    Boolean(event?.is_interested),
  );
  const [userRole, setUserRole] = useState(null);
  const [interestLoading, setInterestLoading] = useState(false);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(CARD_WIDTH);
  const navigation = useNavigation();

  // Engagement state
  const [isLiked, setIsLiked] = useState(Boolean(event?.is_liked));
  const [likeCount, setLikeCount] = useState(event?.like_count ?? 0);
  const [isLiking, setIsLiking] = useState(false);
  const [commentCount, setCommentCount] = useState(event?.comment_count ?? 0);
  const [viewCount, setViewCount] = useState(event?.view_count ?? 0);
  const [shareCount, setShareCount] = useState(event?.share_count ?? 0);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const viewTrackedRef = useRef(false);

  // Ref to track if we're the source of an EventBus event (prevent self-listening)
  const isEmittingRef = useRef(false);

  const lastTapRef = useRef(0);
  const timerRef = useRef(null);
  const cardRef = useRef(null);

  const heartScale = useRef(new Animated.Value(0)).current;
  const [heartPos, setHeartPos] = useState({ x: 0, y: 0 });
  const [heartRot, setHeartRot] = useState(0);
  const [showHeart, setShowHeart] = useState(false);

  const triggerHeartAnimation = (x, y) => {
    setHeartPos({ x, y });
    setHeartRot(Math.random() * 30 - 15);
    setShowHeart(true);
    heartScale.setValue(0);
    
    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 1.2,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(heartScale, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(heartScale, {
        toValue: 1.05,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(heartScale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.delay(800),
      Animated.timing(heartScale, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowHeart(false);
    });
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCardPress = (event) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const { pageX, pageY } = event.nativeEvent;
      cardRef.current?.measure((x, y, width, height, cardPageX, cardPageY) => {
        const relativeX = pageX - cardPageX;
        const relativeY = pageY - cardPageY;
        triggerHeartAnimation(relativeX, relativeY);
      });
      if (!isLiked) {
        handleLikePress();
      } else {
        HapticsService.triggerImpactLight();
      }
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        onPress?.(event);
      }, 250);
    }
    lastTapRef.current = now;
  };

  // Sync engagement state when parent passes updated event prop (e.g. after a feed refresh)
  useEffect(() => {
    if (event?.is_liked !== undefined) setIsLiked(Boolean(event.is_liked));
  }, [event?.is_liked]);

  useEffect(() => {
    if (event?.like_count !== undefined) setLikeCount(event.like_count);
  }, [event?.like_count]);

  useEffect(() => {
    if (event?.comment_count !== undefined) setCommentCount(event.comment_count);
  }, [event?.comment_count]);

  useEffect(() => {
    if (event?.share_count !== undefined) setShareCount(event.share_count);
  }, [event?.share_count]);

  // Fetch current user role
  useEffect(() => {
    getActiveAccount()
      .then((account) => {
        if (account?.type) {
          setUserRole(account.type);
        }
      })
      .catch((err) =>
        console.error("[EventCard] Error fetching account:", err),
      );
  }, []);

  // Reset view tracking flag if the event changes (e.g., same card slot reused after refresh)
  // Also sync view_count from prop when the event ID changes (new card load), but NOT on every
  // prop change — to avoid clobbering mid-session server-tracked view increments.
  useEffect(() => {
    console.log(`[EventCard] Reset viewTrackedRef for event ${event?.id}, current view_count from prop: ${event?.view_count}`);
    viewTrackedRef.current = false;
    if (event?.view_count !== undefined) setViewCount(event.view_count);
  }, [event?.id]);

  // View tracking: record a view after the card has been visible for 2.5s
  useEffect(() => {
    console.log(`[EventCard] Tracking effect fired for event ${event?.id}, tracked=${viewTrackedRef.current}`);
    if (!event?.id || viewTrackedRef.current) return;
    const timer = setTimeout(async () => {
      if (viewTrackedRef.current) return;
      viewTrackedRef.current = true;
      console.log(`[EventCard] Calling recordEventView for event ${event.id}`);
      try {
        const res = await recordEventView(event.id);
        console.log(`[EventCard] recordEventView response for event ${event.id}:`, JSON.stringify(res));
        if (res?.view_count !== undefined) {
          setViewCount(res.view_count);
        } else if (res?.is_new) {
          setViewCount((c) => c + 1);
        }
      } catch (err) {
        console.error(`[EventCard] recordEventView failed for event ${event.id}:`, err?.message);
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [event?.id]);

  // Listen for interest updates from other components (e.g., EventDetailsScreen)
  useEffect(() => {
    if (!event?.id) return;

    const unsubscribe = EventBus.on("event-interest-updated", (payload) => {
      // Skip if we emitted this event ourselves
      if (isEmittingRef.current) return;

      if (payload?.eventId === event.id) {
        setIsInterested(Boolean(payload.isInterested));
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [event?.id]);

  // Also update if the event prop changes (e.g., on screen focus refresh)
  useEffect(() => {
    if (event?.is_interested !== undefined) {
      setIsInterested(Boolean(event.is_interested));
    }
  }, [event?.is_interested]);

  // Listen for like updates from other EventCard instances showing the same event
  useEffect(() => {
    if (!event?.id) return;
    const unsubscribe = EventBus.on('event-like-updated', (payload) => {
      if (isEmittingRef.current) return;
      if (payload?.eventId === event.id) {
        setIsLiked(Boolean(payload.isLiked));
        if (payload.likeCount !== undefined) setLikeCount(payload.likeCount);
      }
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, [event?.id]);

  // Check if user is registered for this event
  const isRegistered = Boolean(
    event?.is_registered ||
    event?.registration_status === "registered" ||
    event?.registration_status === "attended" ||
    event?.registration_status === "confirmed"
  );

  if (!event) return null;

  const {
    id,
    title,
    description,
    banner_url,
    banner_carousel,
    formatted_date,
    formatted_time,
    event_date,
    community_name,
    community_username,
    community_logo,
    community_id,
    location_url,
    event_type,
    attendee_count,
    is_following_community,
    access_type,
    invite_public_visibility,
    is_invited,
  } = event;

  // Check if location should be hidden (invite-only event with public visibility, user NOT invited/registered)
  const shouldHideLocation =
    access_type === "invite_only" &&
    invite_public_visibility === true &&
    !is_invited &&
    !isRegistered;

  // Get banners array - prioritize carousel, then banner_url
  const banners = banner_carousel?.length > 0
    ? banner_carousel
    : event?.banners?.length > 0
      ? event.banners
      : banner_url
        ? [{ image_url: banner_url }]
        : [];

  // Format date if not pre-formatted
  const displayDate =
    formatted_date ||
    (event_date &&
      new Date(event_date).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }));

  const displayTime =
    formatted_time ||
    (event_date &&
      new Date(event_date).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }));

  // Get location name from Google Maps URL (handles shortened URLs), or hide if invite-only
  const rawLocationName = useLocationName(location_url, {
    fallback: event_type === "virtual" ? "Virtual Event" : "Location TBD",
  });

  // Use custom location_name if provided, but hide for invite-only events
  const locationName = shouldHideLocation
    ? null
    : event.location_name || rawLocationName;

  const hasValidPhoto = community_logo && /^https?:\/\//.test(community_logo);

  // Handle interested button press
  const handleInterestedPress = async () => {
    if (interestLoading) return;

    try {
      setInterestLoading(true);
      HapticsService.triggerImpactLight();

      // Optimistic update
      const newState = !isInterested;
      setIsInterested(newState);

      const response = await toggleEventInterest(id);

      if (response?.success) {
        const newInterestState = Boolean(response.is_interested);
        setIsInterested(newInterestState);

        // Mark that we're emitting to prevent self-listening
        isEmittingRef.current = true;
        EventBus.emit("event-interest-updated", {
          eventId: id,
          isInterested: newInterestState,
        });
        // Reset flag after a tick to allow future external events
        setTimeout(() => {
          isEmittingRef.current = false;
        }, 0);
      } else {
        // Revert on failure
        setIsInterested(!newState);
      }
    } catch (error) {
      console.error("Error toggling interest:", error);
      // Revert on error
      setIsInterested(isInterested);
    } finally {
      setInterestLoading(false);
    }

    // Also call parent callback if provided
    onInterestedPress?.(event);
  };

  // Engagement handlers
  const handleLikePress = async () => {
    if (isLiking) return;
    HapticsService.triggerLike();
    const nextLiked = !isLiked;
    const nextCount = Math.max(0, likeCount + (nextLiked ? 1 : -1));
    setIsLiked(nextLiked);
    setLikeCount(nextCount);
    setIsLiking(true);
    try {
      const resp = await toggleEventLike(id, isLiked);
      if (resp?.success) {
        setIsLiked(resp.is_liked);
        setLikeCount(resp.like_count ?? nextCount);
        // Emit so other EventCard instances of the same event stay in sync
        isEmittingRef.current = true;
        EventBus.emit('event-like-updated', { eventId: id, isLiked: resp.is_liked, likeCount: resp.like_count ?? nextCount });
        setTimeout(() => { isEmittingRef.current = false; }, 0);
      } else {
        setIsLiked(!nextLiked);
        setLikeCount(likeCount);
      }
    } catch (e) {
      setIsLiked(!nextLiked);
      setLikeCount(likeCount);
    } finally {
      setIsLiking(false);
    }
  };

  const handleSharePress = async () => {
    HapticsService.triggerShare();
    if (onShare) {
      // Use the app's custom ShareModal (same as other cards)
      onShare(id);
    } else {
      // Fallback: native share sheet
      try {
        await Share.share({ message: 'Check out ' + title + ' on SnooSpace!', title });
      } catch (_) {}
    }
    // Always track the share server-side
    setShareCount((c) => c + 1);
    trackEventShare(id);
  };

  const handleCommentPress = () => {
    HapticsService.triggerComment();
    if (onComment) {
      onComment(id);
    } else {
      setCommentsVisible(true);
    }
  };

  const handleQrPress = () => {
    HapticsService.triggerImpactLight();
    navigation.navigate("TicketView", { eventId: id });
  };

  const handleAttendeesPress = () => {
    if (onAttendeesPress) {
      onAttendeesPress();
    } else {
      navigation.navigate("EventDetails", {
        eventId: id,
        eventData: event,
        scrollToAttendees: true,
      });
    }
  };

  const getLowestPrice = () => {
    if (!event) return 0;

    // 1. Try to parse ticket_types array (could be a stringified JSON array)
    let parsedTickets = [];
    if (event.ticket_types) {
      if (typeof event.ticket_types === "string") {
        try {
          parsedTickets = JSON.parse(event.ticket_types);
        } catch (err) {
          parsedTickets = [];
        }
      } else if (Array.isArray(event.ticket_types)) {
        parsedTickets = event.ticket_types;
      }
    }

    if (parsedTickets && parsedTickets.length > 0) {
      const prices = parsedTickets
        .map((t) => parseFloat(t.base_price) || 0)
        .filter((p) => p > 0);
      if (prices.length > 0) return Math.min(...prices);
    }

    // 2. Fallback to ticket_price (calculated by backend discover feed queries)
    if (event.ticket_price && parseFloat(event.ticket_price) > 0) {
      return parseFloat(event.ticket_price);
    }

    // 3. Fallback to min_price
    if (event.min_price && parseFloat(event.min_price) > 0) {
      return parseFloat(event.min_price);
    }

    // 4. Fallback to base_price
    if (event.base_price && parseFloat(event.base_price) > 0) {
      return parseFloat(event.base_price);
    }

    return 0;
  };

  const lowestPrice = getLowestPrice();
  const isFree = lowestPrice <= 0;
  const displayPrice = isFree ? "Free" : `₹${lowestPrice.toLocaleString("en-IN")} onwards`;

  const { month, day } = parseDisplayDate(displayDate);
  const eventDateObj = event_date ? new Date(event_date) : null;
  const isPast = eventDateObj ? eventDateObj.getTime() < Date.now() : false;

  return (
    <View style={[styles.container, compact && styles.containerCompact, style]}>
      {/* Event Label */}
      <View style={[styles.eventLabel, compact && styles.eventLabelCompact]}>
        <Calendar size={compact ? 11 : 13} color={COLORS.primary} strokeWidth={2} />
        <Text style={[styles.eventLabelText, compact && styles.eventLabelTextCompact]}>Event</Text>
      </View>

      {/* Main Card */}
      <TouchableOpacity ref={cardRef} style={styles.card} activeOpacity={1} onPress={handleCardPress}>
        {/* Banner Image */}
        <View 
          style={[styles.imageContainer, compact && styles.imageContainerCompact]}
          onLayout={(e) => {
            setContainerWidth(e.nativeEvent.layout.width);
          }}
        >
          {banners.length > 0 ? (
            banners.length > 1 ? (
              <View style={StyleSheet.absoluteFill}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => {
                    const index = Math.round(
                      e.nativeEvent.contentOffset.x / (containerWidth || CARD_WIDTH),
                    );
                    setCurrentBannerIndex(index);
                  }}
                  nestedScrollEnabled={true}
                  disallowInterruption={true}
                  style={StyleSheet.absoluteFill}
                  contentContainerStyle={{ minWidth: "100%" }}
                >
                  {banners.map((banner, index) => (
                    <Image
                      key={index}
                      source={{ uri: banner.image_url || banner.url }}
                      style={{ width: containerWidth || CARD_WIDTH, height: "100%" }}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
                {/* Banner Indicator Dots */}
                <View style={styles.bannerDotsContainer}>
                  {banners.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.bannerDot,
                        currentBannerIndex === index && styles.bannerDotActive,
                      ]}
                    />
                  ))}
                </View>
              </View>
            ) : (
              <Image
                source={{ uri: banners[0].image_url || banners[0].url }}
                style={styles.bannerImage}
                resizeMode="cover"
              />
            )
          ) : (
            <LinearGradient
              colors={COLORS.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.placeholderBanner}
            >
              <Calendar size={compact ? 24 : 40} color="rgba(255,255,255,0.7)" strokeWidth={1.8} />
            </LinearGradient>
          )}

          {/* Date Badge */}
          <View style={[styles.dateBadge, compact && styles.dateBadgeCompact]}>
            <Text style={[styles.dateBadgeHeader, compact && styles.dateBadgeHeaderCompact]}>{month}</Text>
            <Text style={[styles.dateBadgeNumber, compact && styles.dateBadgeNumberCompact]}>{day}</Text>
          </View>

          {/* Status Badge overlay inside image container */}
          {showStatusLabel && (
            <View style={[
              styles.statusBadge, 
              compact && styles.statusBadgeCompact,
              isPast ? styles.pastBadge : styles.upcomingBadge
            ]}>
              <Text style={[styles.statusBadgeNumber, compact && styles.statusBadgeNumberCompact]}>
                {isPast ? "PAST" : "UPCOMING"}
              </Text>
            </View>
          )}

          {/* Gradient Overlay */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.4)"]}
            style={styles.imageOverlay}
          />
        </View>

        {/* Content */}
        <View style={[styles.content, compact && styles.contentCompact]}>
          {/* Organizer/Community Row + QR Ticket shortcut */}
          <View style={[styles.communityQrRow, compact && styles.communityQrRowCompact]}>
            <TouchableOpacity
              style={styles.communityRow}
              onPress={() => {
                if (community_id) {
                  navigation.navigate("CommunityPublicProfile", { communityId: community_id });
                }
              }}
            >
              {hasValidPhoto ? (
                <Image
                  source={{ uri: community_logo }}
                  style={[styles.communityAvatar, compact && styles.communityAvatarCompact]}
                />
              ) : (
                <LinearGradient
                  colors={getGradientForName(community_name || "Community")}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.communityAvatar, styles.communityAvatarGradient, compact && styles.communityAvatarCompact]}
                >
                  <Text style={[styles.communityInitials, compact && styles.communityInitialsCompact]}>
                    {getInitials(community_name || "C")}
                  </Text>
                </LinearGradient>
              )}
              <Text style={[styles.communityName, compact && styles.communityNameCompact]} numberOfLines={1}>
                {community_name}
              </Text>
              {is_following_community && (
                <View style={styles.followingBadge}>
                  <Text style={styles.followingText}>Following</Text>
                </View>
              )}
            </TouchableOpacity>

            {isRegistered && !hideQr && (
              <TouchableOpacity
                onPress={handleQrPress}
                style={styles.qrButton}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <QrCode size={20} color={COLORS.primary} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>

          {/* Clickable Content Area */}
          <View>
            {/* Title */}
            <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={2}>
              {title}
            </Text>

            {/* Metadata Grid */}
            {compact ? (
              <View style={styles.metaGridCompact}>
                <View style={styles.metaItemCompact}>
                  <Clock size={13} color={COLORS.textSecondary} strokeWidth={2} />
                  <Text style={styles.metaTextCompact} numberOfLines={1}>
                    {displayDate} • {displayTime}{locationName ? ` • ${locationName}` : ""}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.metaGrid}>
                {/* Combined Date & Time Row */}
                <View style={styles.metaItem}>
                  <Clock size={14} color={COLORS.textSecondary} strokeWidth={2} />
                  <Text style={styles.metaText}>{displayDate} • {displayTime}</Text>
                </View>

                {locationName && (
                  <View style={styles.metaItem}>
                    {event_type === "virtual" ? (
                      <Video size={14} color={COLORS.textSecondary} strokeWidth={2} />
                    ) : (
                      <MapPin size={14} color={COLORS.textSecondary} strokeWidth={2} />
                    )}
                    <Text style={styles.metaText} numberOfLines={1}>
                      {locationName}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Price & Explicit View Details CTA Row */}
          {!hidePriceDetails && (
            <View style={styles.priceDetailsRow}>
              <View style={styles.priceContainer}>
                <Text style={[styles.priceText, isFree && styles.freePriceText]}>
                  {displayPrice}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onPress?.(event)}
                style={styles.viewDetailsRow}
              >
                <Text style={styles.viewDetailsText}>View details</Text>
                <MoveRight size={14} color={COLORS.primary} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          )}

          {/* Bottom Row: Attendees Stack + RSVP CTA Button */}
          <View style={[styles.bottomRow, compact && styles.bottomRowCompact]}>
            {/* Attendee Stack */}
            <TouchableOpacity 
              style={styles.attendeesContainer}
              onPress={handleAttendeesPress}
              activeOpacity={0.7}
            >
              {attendee_count > 0 ? (
                (() => {
                  const hasAvatars = Array.isArray(event.attendee_avatars) && event.attendee_avatars.length > 0;
                  const shownCount = hasAvatars ? Math.min(event.attendee_avatars.length, 3) : Math.min(attendee_count, 3);
                  const remainingCount = attendee_count - shownCount;
                  return (
                    <>
                      <View style={[styles.avatarStack, compact && styles.avatarStackCompact]}>
                        {hasAvatars ? (
                          event.attendee_avatars.slice(0, 3).map((avatarData, index) => {
                            const hasPhoto = avatarData?.profile_photo_url && /^https?:\/\//.test(avatarData.profile_photo_url);
                            const zIndex = 3 - index;
                            const marginLeft = index > 0 ? (compact ? -6 : -8) : 0;
                            if (hasPhoto) {
                              return (
                                <Image
                                  key={`attendee-avatar-${index}`}
                                  source={{ uri: avatarData.profile_photo_url }}
                                  style={[styles.avatar, compact && styles.avatarCompact, { marginLeft, zIndex }]}
                                />
                              );
                            } else {
                              const initials = getInitials(avatarData?.name || "U");
                              const gradientColors = getGradientForName(avatarData?.name || "U");
                              return (
                                <LinearGradient
                                  key={`attendee-avatar-${index}`}
                                  colors={gradientColors}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 1 }}
                                  style={[styles.avatar, styles.avatarGradient, compact && styles.avatarCompact, { marginLeft, zIndex }]}
                                >
                                  <Text style={styles.avatarInitials}>{initials}</Text>
                                </LinearGradient>
                              );
                            }
                          })
                        ) : (
                          // Fallback placeholders when no actual attendee profiles are loaded
                          <>
                            {attendee_count >= 1 && (
                              <View style={[styles.avatar, compact && styles.avatarCompact, { backgroundColor: "#E5E7EB", zIndex: 3 }]} />
                            )}
                            {attendee_count >= 2 && (
                              <View style={[styles.avatar, compact && styles.avatarCompact, { backgroundColor: "#D1D5DB", marginLeft: compact ? -6 : -8, zIndex: 2 }]} />
                            )}
                            {attendee_count >= 3 && (
                              <View style={[styles.avatar, compact && styles.avatarCompact, { backgroundColor: "#9CA3AF", marginLeft: compact ? -6 : -8, zIndex: 1 }]} />
                            )}
                          </>
                        )}
                      </View>
                      {remainingCount > 0 && (
                        <Text style={styles.attendeeCount}>
                          {`+${remainingCount}`}
                        </Text>
                      )}
                    </>
                  );
                })()
              ) : (
                <View style={{ height: compact ? 20 : 24 }} />
              )}
            </TouchableOpacity>

            {/* Action CTA Button */}
            {userRole !== "community" && !hideRsvp && (
              <>
                {isRegistered ? (
                  <View style={[styles.interestedButton, styles.goingButton]}>
                    <CheckCircle2 size={14} color="#16A34A" strokeWidth={2.2} />
                    <Text style={styles.goingText}>Going</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    key={`interest-btn-${isInterested}`}
                    style={[
                      styles.interestedButton,
                      isInterested === true && styles.interestedButtonActive,
                    ]}
                    onPress={handleInterestedPress}
                    disabled={interestLoading}
                  >
                    {isInterested === true ? (
                      <View style={styles.interestedActiveContent}>
                        <Check size={14} color="#16A34A" strokeWidth={2.2} />
                        <Text style={styles.interestedActiveText}>Marked as Interested</Text>
                      </View>
                    ) : (
                      <LinearGradient
                        colors={COLORS.primaryGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.interestedGradient}
                      >
                        <Star size={14} color="#FFFFFF" strokeWidth={2.2} />
                        <Text style={styles.interestedText}>Interest?</Text>
                      </LinearGradient>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* Engagement Row */}
          {!hideEngagement && (
            <View style={styles.engagementRow}>
              <TouchableOpacity style={styles.engagementBtn} onPress={handleLikePress} disabled={isLiking}>
                <Heart size={22} color={isLiked ? COLORS.error : '#5e8d9b'} fill={isLiked ? COLORS.error : 'transparent'} strokeWidth={2} />
                <Text style={[styles.engagementCount, isLiked && { color: COLORS.error }]}>{likeCount}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.engagementBtn} onPress={handleCommentPress}>
                <MessageCircle size={22} color="#5e8d9b" strokeWidth={2} />
                <Text style={styles.engagementCount}>{commentCount}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.engagementBtn}
                activeOpacity={1}
                onPress={() => HapticsService.triggerView()}
              >
                <ChartNoAxesCombined size={22} color="#5e8d9b" strokeWidth={2} />
                <Text style={styles.engagementCount}>{viewCount}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.engagementBtn} onPress={handleSharePress}>
                <Send size={22} color="#5e8d9b" strokeWidth={2} />
                <Text style={styles.engagementCount}>{shareCount}</Text>
              </TouchableOpacity>
            </View>
          )}

          {showHeart && (
            <Animated.View
              style={{
                position: 'absolute',
                top: heartPos.y - 75,
                left: heartPos.x - 75,
                transform: [
                  { scale: heartScale },
                  { rotate: `${heartRot}deg` }
                ],
                opacity: heartScale.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
                zIndex: 9999,
              }}
              pointerEvents="none"
            >
              <GradientHeart />
            </Animated.View>
          )}
          <CommentsModal
            visible={commentsVisible}
            postId={id}
            baseRoute="/events"
            replyBaseRoute="/event-comments"
            onCommentCountChange={(n) => setCommentCount(n)}
            onClose={() => setCommentsVisible(false)}
            navigation={navigation}
          />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginVertical: 12,
  },
  eventLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  statusBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 54,
    height: 38,
    ...SHADOWS.sm,
  },
  pastBadge: {
    backgroundColor: "rgba(229, 62, 62, 0.85)",
  },
  upcomingBadge: {
    backgroundColor: "rgba(22, 163, 74, 0.85)",
  },
  statusBadgeNumber: {
    fontSize: 13,
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    color: "#FFFFFF",
  },
  eventLabelText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
    ...SHADOWS.sm,
  },
  imageContainer: {
    height: 200,
    position: "relative",
    width: "100%",
    overflow: "hidden",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  placeholderBanner: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  dateBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: "center",
    minWidth: 44,
    ...SHADOWS.sm,
  },
  dateBadgeHeader: {
    fontSize: 10,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  dateBadgeNumber: {
    fontSize: 16,
    fontFamily: FONTS.primary,
    color: COLORS.textPrimary,
  },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  bannerDotsContainer: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    zIndex: 10,
  },
  bannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  bannerDotActive: {
    backgroundColor: "#FFFFFF",
    width: 12,
  },
  content: {
    padding: 16,
  },
  communityQrRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  communityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  qrButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  communityAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  communityAvatarGradient: {
    justifyContent: "center",
    alignItems: "center",
  },
  communityInitials: {
    fontSize: 9,
    fontFamily: FONTS.medium,
    color: "#FFFFFF",
  },
  communityName: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: "#5e8d9b",
  },
  followingBadge: {
    backgroundColor: "rgba(41, 98, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(41, 98, 255, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 6,
  },
  followingText: {
    fontSize: 10,
    fontFamily: FONTS.medium,
    color: COLORS.primary,
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 18,
    fontFamily: FONTS.primary,
    color: COLORS.textPrimary,
    lineHeight: 24,
    marginBottom: 10,
  },
  metaGrid: {
    gap: 6,
    marginBottom: 14,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    flex: 1,
  },
  priceDetailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingVertical: 2,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  priceText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
  },
  freePriceText: {
    color: "#2E7D32",
  },
  viewDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  viewDetailsText: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  attendeesContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  avatarGradient: {
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    fontSize: 10,
    fontFamily: FONTS.medium,
    color: "#FFFFFF",
  },
  attendeeCount: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: "#36454F",
    marginLeft: 6,
  },
  interestedButton: {
    borderRadius: 20,
    overflow: "hidden",
    minWidth: 110,
    minHeight: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  interestedButtonActive: {
    borderWidth: 1,
    borderColor: "rgba(22, 163, 74, 0.18)",
    backgroundColor: "rgba(22, 163, 74, 0.08)",
  },
  interestedActiveContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  interestedActiveText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: "#16A34A",
  },
  interestedGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  interestedText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
  },
  goingButton: {
    backgroundColor: "#E8F5E9",
    borderWidth: 1,
    borderColor: "rgba(52, 199, 89, 0.2)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  goingText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: "#16A34A",
  },
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  engagementBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  engagementCount: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: '#5e8d9b',
  },
  containerCompact: {
    marginVertical: 6,
  },
  eventLabelCompact: {
    marginBottom: 4,
  },
  eventLabelTextCompact: {
    fontSize: 10,
  },
  imageContainerCompact: {
    height: 90,
  },
  dateBadgeCompact: {
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    minWidth: 36,
    borderRadius: 8,
  },
  dateBadgeHeaderCompact: {
    fontSize: 8,
    marginBottom: 1,
  },
  dateBadgeNumberCompact: {
    fontSize: 12,
  },
  statusBadgeCompact: {
    top: 8,
    right: 8,
    height: 26,
    minWidth: 46,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  statusBadgeNumberCompact: {
    fontSize: 10,
  },
  contentCompact: {
    padding: 12,
  },
  communityQrRowCompact: {
    marginBottom: 4,
  },
  communityAvatarCompact: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  communityInitialsCompact: {
    fontSize: 7,
  },
  communityNameCompact: {
    fontSize: 11,
  },
  titleCompact: {
    fontSize: 15,
    lineHeight: 18,
    marginBottom: 6,
  },
  metaGridCompact: {
    marginBottom: 8,
  },
  metaItemCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaTextCompact: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    flex: 1,
  },
  bottomRowCompact: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  avatarStackCompact: {
    // Add any adjustments for compact avatar stack if needed
  },
  avatarCompact: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
});
