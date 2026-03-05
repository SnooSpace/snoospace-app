import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Linking,
  Share,
  Modal,
} from "react-native";
import { StatusBar, setStatusBarStyle } from "expo-status-bar";
import {
  ArrowLeft,
  Share as ShareIcon,
  Bookmark,
  MapPin,
  Clock,
  Calendar,
  Ticket,
  Star,
  Info,
  Users,
  Lock,
  MoveRight,
  XCircle,
  AlertCircle,
  ImagePlus,
  BadgeCheck,
  AlertTriangle,
  CreditCard,
  Smile,
  Gift,
  GraduationCap,
  Heart,
  Languages,
  Globe,
  Accessibility,
  Hand,
  Utensils,
  Wine,
  Coffee,
  Beer,
  Leaf,
  Car,
  Bus,
  Home,
  Sun,
  Umbrella,
  Droplets,
  Wifi,
  Smartphone,
  Shirt,
  ArrowRightLeft,
  CameraOff,
  Dog,
  Ban,
  IdCard,
  ShieldCheck,
  BriefcaseMedical,
  Shield,
  Tag,
  Hourglass,
  Zap,
  CheckCircle,
  RockingChair,
  Trophy,
  Music,
  Sparkles,
  Ribbon,
  Megaphone,
  DoorOpen,
  ChevronRight,
} from "lucide-react-native";

// Icon map for Things to Know + Highlights items (keyed by icon_name string stored in DB)
const THINGS_ICON_MAP = {
  Users,
  AlertTriangle,
  CreditCard,
  Smile,
  Gift,
  GraduationCap,
  Heart,
  Languages,
  Globe,
  Accessibility,
  Hand,
  Utensils,
  Wine,
  Coffee,
  Beer,
  Leaf,
  Car,
  Bus,
  Home,
  Sun,
  Umbrella,
  Droplets,
  Wifi,
  Smartphone,
  Shirt,
  XCircle,
  Clock,
  ArrowRightLeft,
  CameraOff,
  Dog,
  Ban,
  IdCard,
  ShieldCheck,
  BriefcaseMedical,
  Shield,
  Tag,
  Hourglass,
  Zap,
  Ticket,
  CheckCircle,
  AlertCircle,
  MapPin,
  Calendar,
  Info,
  RockingChair,
  // Highlight icons
  Star,
  Trophy,
  Music,
  Sparkles,
  Ribbon,
  Megaphone,
};
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

const AnimatedArrowLeft = Animated.createAnimatedComponent(ArrowLeft);
const AnimatedShareIcon = Animated.createAnimatedComponent(ShareIcon);
const AnimatedBookmark = Animated.createAnimatedComponent(Bookmark);

import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getEventDetails,
  toggleEventInterest,
  requestEventInvite,
  confirmAttendance,
} from "../../api/events";
import { getGradientForName, getInitials } from "../../utils/AvatarGenerator";
import { COLORS } from "../../constants/theme";
import { useLocationName } from "../../utils/locationNameCache";
import { getActiveAccount } from "../../api/auth";
import HapticsService from "../../services/HapticsService";
import EventBus from "../../utils/EventBus";
import { Alert, ToastAndroid, Platform } from "react-native";
import AttendanceConfirmationModal from "../../components/AttendanceConfirmationModal";
import SnooLoader from "../../components/ui/SnooLoader";
import DynamicStatusBar from "../../components/DynamicStatusBar";
import {
  getEventState,
  shouldShowViewAttendees,
  shouldAskAttendance,
  getViewAttendeesState,
  getRegistrationProgress,
  getProgressBarColor,
  EVENT_STATES,
} from "../../utils/eventStateUtils";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BANNER_HEIGHT = SCREEN_HEIGHT * 0.45;

// White Theme Colors
const PRIMARY_COLOR = COLORS.primary;
const TEXT_COLOR = "#1F2937";
const MUTED_TEXT = "#6B7280";
const BACKGROUND_COLOR = "#F9FAFB";
const CARD_BACKGROUND = "#FFFFFF";
const BORDER_COLOR = "#E5E7EB";
const DATE_COLOR = "#16A34A"; // Green for dates

const EventDetailsScreen = ({ route, navigation }) => {
  const { eventId, eventData: initialData } = route.params || {};
  const insets = useSafeAreaInsets();

  // Use initialData for quick display, but always load full details from API
  const [event, setEvent] = useState(initialData || null);
  const [loading, setLoading] = useState(true); // Always show loading initially
  const [error, setError] = useState(null);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showCreatorToast, setShowCreatorToast] = useState(false);
  const [isInterested, setIsInterested] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isInvited, setIsInvited] = useState(false);

  const [locationHidden, setLocationHidden] = useState(false);
  const [requestingInvite, setRequestingInvite] = useState(false);
  const [inviteRequestStatus, setInviteRequestStatus] = useState(null); // null, 'pending', 'approved', 'rejected'
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [isMapLinkPressed, setIsMapLinkPressed] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  // Event state and attendance
  const [serverTime, setServerTime] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  // Registration progress for View Attendees
  const [registrationCount, setRegistrationCount] = useState(0);
  const [totalPublicCapacity, setTotalPublicCapacity] = useState(null);
  const [totalCapacity, setTotalCapacity] = useState(null);
  const [isMostlyInviteOnly, setIsMostlyInviteOnly] = useState(false);
  // Custom toast for locked View Attendees
  const [lockedToastVisible, setLockedToastVisible] = useState(false);
  const lockedToastOpacity = useRef(new Animated.Value(0)).current;
  const lockedToastTranslateY = useRef(new Animated.Value(20)).current;

  const scrollY = useRef(new Animated.Value(0)).current;
  const categoriesAnim = useRef(new Animated.Value(0)).current;

  // Scroll listener for Status Bar style
  const isScrolledRef = useRef(false);

  useEffect(() => {
    // Scroll listener removed as we want StatusBar to be dark always
  }, []);

  const headerIconColor = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: ["#FFFFFF", TEXT_COLOR],
    extrapolate: "clamp",
  });

  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [20, 50],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Always load full event details from API
    const id = eventId || initialData?.id;
    if (id) {
      loadEventDetails(id);
    } else {
      setLoading(false);
      setError("No event ID provided");
    }
    // Load current user
    getActiveAccount().then(setCurrentUser).catch(console.error);

    // Trigger categories entry animation
    Animated.spring(categoriesAnim, {
      toValue: 1,
      tension: 40,
      friction: 7,
      useNativeDriver: true,
      delay: 500,
    }).start();
  }, [eventId, initialData?.id]);

  const loadEventDetails = async (id) => {
    try {
      setLoading(true);
      const response = await getEventDetails(id);
      if (response?.event) {
        setEvent(response.event);
        setIsInterested(response.event.is_interested || false);
        setIsRegistered(response.event.is_registered || false);
        setIsInvited(response.event.is_invited || false);
        setLocationHidden(response.event.location_hidden || false);
        setInviteRequestStatus(response.event.invite_request_status || null);
        // Set server time and attendance data
        if (response.server_time) {
          setServerTime(response.server_time);
        }
        if (response.attendance_status) {
          setAttendanceStatus(response.attendance_status);
        }
        // Set registration progress data
        setRegistrationCount(response.registration_count || 0);
        setTotalPublicCapacity(response.total_public_capacity);
        setTotalCapacity(response.total_capacity);
        setIsMostlyInviteOnly(response.is_mostly_invite_only || false);

        // Check if we should ask for attendance confirmation
        const shouldAsk = shouldAskAttendance(
          response.event,
          response.server_time || new Date().toISOString(),
          response.event.is_registered || false,
          response.attendance_status,
        );
        if (shouldAsk) {
          setShowAttendanceModal(true);
        }
      } else {
        // If API fails but we have initialData, use it
        if (!initialData) {
          setError("Failed to load event details");
        }
      }
    } catch (err) {
      console.error("Error loading event details:", err);
      // If API fails and no initialData, show error
      if (!initialData) {
        setError("Failed to load event details");
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (startDate, endDate) => {
    if (!startDate) return "";

    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;

    const dayOptions = { weekday: "short", day: "numeric", month: "short" };
    const timeOptions = { hour: "numeric", minute: "2-digit", hour12: true };

    const startDay = start.toLocaleDateString("en-IN", dayOptions);
    const startTime = start.toLocaleTimeString("en-IN", timeOptions);

    // Don't show end time if it's the same as start time or not provided
    if (!end || start.getTime() === end.getTime()) {
      return `${startDay}, ${startTime}`;
    }

    // Different days
    if (end.toDateString() !== start.toDateString()) {
      const endDay = end.toLocaleDateString("en-IN", dayOptions);
      const endTime = end.toLocaleTimeString("en-IN", timeOptions);
      return `${startDay}, ${startTime} - ${endDay}, ${endTime}`;
    }

    // Same day, different time
    const endTime = end.toLocaleTimeString("en-IN", timeOptions);
    return `${startDay}, ${startTime} - ${endTime}`;
  };

  const formatGatesTime = (gatesTime) => {
    if (!gatesTime) return null;
    const time = new Date(gatesTime);
    return time.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Get location name from Google Maps URL (handles shortened URLs)
  const decodedLocationName = useLocationName(event?.location_url, {
    fallback: event?.venue_name || "View Location",
  });

  // Prioritize custom location_name if provided
  const displayLocationName = event?.location_name || decodedLocationName;

  const handleShare = async () => {
    if (!event) return;
    try {
      await Share.share({
        message: `Check out ${event.title} on SnooSpace! ${event.location_url || ""}`,
      });
    } catch (error) {
      console.error(error.message);
    }
  };

  const handleOpenLocation = () => {
    if (event?.location_url) {
      Linking.openURL(event.location_url);
    }
  };

  const handleViewCommunity = () => {
    if (event?.community_id) {
      navigation.navigate("CommunityPublicProfile", {
        communityId: event.community_id,
      });
    }
  };

  // Check if current user is allowed to book (only members)
  const isRestrictedRole = currentUser?.type !== "member";
  const isEventCreator =
    currentUser?.type === "community" &&
    parseInt(currentUser?.id) === parseInt(event?.creator_id);

  // Show toast message for restricted roles (communities)
  const showRoleRestrictionMessage = () => {
    setShowCreatorToast(true);
    toastOpacity.setValue(0);
    toastTranslateY.setValue(0);

    Animated.parallel([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(toastTranslateY, {
        toValue: -20,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Fade out after 4 seconds
    setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => setShowCreatorToast(false));
    }, 4000);
  };

  const handleRegister = () => {
    // If already registered, go directly to ticket view
    if (isRegistered) {
      console.log(
        "[EventDetails] Navigating to TicketView for event:",
        event?.id,
      );

      // Navigate directly to TicketView at the same stack level as EventDetails
      // This maintains proper back navigation to EventDetailsScreen
      navigation.navigate("TicketView", { eventId: event?.id });
      return;
    }
    // Only members can book tickets
    if (isRestrictedRole) {
      showRoleRestrictionMessage();
      return;
    }
    // Navigate to ticket selection if there are ticket types
    if (event?.ticket_types?.length > 0) {
      navigation.navigate("TicketSelection", { event });
    } else {
      // Free event registration
      console.log("Register for free event:", event?.id);
    }
  };

  // Handle request invite for invite-only events
  const handleRequestInvite = async () => {
    if (requestingInvite || !event?.id) return;

    try {
      setRequestingInvite(true);
      HapticsService.triggerImpactMedium();

      const response = await requestEventInvite(event.id);

      if (response?.success) {
        setInviteRequestStatus("pending"); // Update status to show "Requested"
        Alert.alert(
          "Request Sent! 📨",
          "Your invitation request has been sent to the organizer. You'll be notified when they respond.",
          [{ text: "OK" }],
        );
      } else {
        Alert.alert("Error", response?.error || "Failed to send request");
      }
    } catch (error) {
      console.error("Error requesting invite:", error);
      Alert.alert(
        "Error",
        error?.message || "Failed to send invitation request",
      );
    } finally {
      setRequestingInvite(false);
    }
  };

  // Check if this is an invite-only event where user needs to request access
  // This includes both event-level invite_only AND when all tickets are invite-only visibility
  const isInviteOnlyNotInvited =
    (event?.access_type === "invite_only" || event?.all_tickets_invite_only) &&
    !isInvited &&
    !isRegistered;

  // Handle bookmark/interest toggle
  const handleBookmark = async () => {
    if (bookmarkLoading || !event?.id) return;

    try {
      setBookmarkLoading(true);
      HapticsService.triggerImpactLight();

      // Optimistic update
      const newState = !isInterested;
      setIsInterested(newState);

      const response = await toggleEventInterest(event.id);

      if (response?.success) {
        setIsInterested(response.is_interested);
        // Notify other components (like YourEventsScreen) about the change
        EventBus.emit("event-interest-updated", {
          eventId: event.id,
          isInterested: response.is_interested,
        });
      } else {
        // Revert on failure
        setIsInterested(!newState);
      }
    } catch (error) {
      console.error("Error toggling bookmark:", error);
      // Revert on error
      setIsInterested(!isInterested);
    } finally {
      setBookmarkLoading(false);
    }
  };

  // Navigate to featured account's profile based on account type
  const handleFeaturedAccountPress = (account) => {
    if (!account.linked_account_id || !account.linked_account_type) return;

    switch (account.linked_account_type) {
      case "member":
        navigation.navigate("MemberPublicProfile", {
          memberId: account.linked_account_id,
        });
        break;
      case "community":
        navigation.navigate("CommunityPublicProfile", {
          communityId: account.linked_account_id,
        });
        break;
      case "sponsor":
        // Sponsor profiles not yet implemented
        console.log("Sponsor profile navigation not implemented");
        break;
    }
  };

  // Navigate to community head's linked member profile
  const handleCommunityHeadPress = (head) => {
    if (head.member_id) {
      navigation.navigate("MemberPublicProfile", { memberId: head.member_id });
    }
  };

  // Handle attendance confirmation from modal
  const handleConfirmAttendance = async (attended) => {
    if (!event?.id) return;

    try {
      setAttendanceLoading(true);
      HapticsService.triggerImpactMedium();

      const response = await confirmAttendance(event.id, attended);

      if (response?.success) {
        setAttendanceStatus(response.attendance_status);
        setShowAttendanceModal(false);
      }
    } catch (error) {
      console.error("Error confirming attendance:", error);
      Alert.alert("Error", "Failed to confirm attendance. Please try again.");
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Navigate to Matching Screen for View Attendees
  const handleViewAttendees = () => {
    // Matching is a tab in MemberHome's BottomTabNavigator
    // Navigate to MemberHome, then to the Matching tab with eventId
    navigation.navigate("MemberHome", {
      screen: "Matching",
      params: { eventId: event?.id },
    });
  };

  // Trigger custom animated toast for locked View Attendees
  const triggerLockedToast = () => {
    if (lockedToastVisible) return; // Prevent multiple toasts

    setLockedToastVisible(true);
    HapticsService.triggerImpactLight();

    // Reset animation values
    lockedToastOpacity.setValue(0);
    lockedToastTranslateY.setValue(20);

    // Fade up animation
    Animated.parallel([
      Animated.timing(lockedToastOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(lockedToastTranslateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-hide after 4 seconds
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(lockedToastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(lockedToastTranslateY, {
          toValue: 20,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setLockedToastVisible(false);
      });
    }, 4000);
  };

  // Get event state for conditional rendering
  const eventState = getEventState(event, serverTime);

  // Get View Attendees state (always visible for members, but may be locked)
  const viewAttendeesState = getViewAttendeesState(
    event,
    serverTime,
    currentUser?.type,
  );

  // Get registration progress for the progress bar
  const registrationProgress = getRegistrationProgress(
    registrationCount,
    totalPublicCapacity,
    totalCapacity,
    isMostlyInviteOnly,
  );

  // Get progress bar color based on percentage
  const progressBarColor = getProgressBarColor(registrationProgress.percentage);
  // Handle multiple possible banner field names from API
  const banners =
    event?.banner_carousel?.length > 0
      ? event.banner_carousel
      : event?.banners?.length > 0
        ? event.banners
        : event?.banner_url
          ? [{ image_url: event.banner_url, url: event.banner_url }]
          : [];

  const categories = event?.categories
    ? Array.isArray(event.categories)
      ? event.categories
      : [event.categories]
    : [];

  return (
    <>
      <DynamicStatusBar style="dark-content" />
      {loading ? (
        <View style={[styles.container, styles.centered]}>
          <SnooLoader size="large" color={PRIMARY_COLOR} />
        </View>
      ) : error || !event ? (
        <View style={[styles.container, styles.centered]}>
          <AlertCircle size={48} color={MUTED_TEXT} />
          <Text style={[styles.errorText, { fontFamily: "Manrope-Medium" }]}>
            {error || "Event not found"}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.container}>
          {/* 🌟 Final Fixed Header System (Pinned Header with Scrim) */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: insets.top + (Platform.OS === "ios" ? 44 : 56),
              zIndex: 1001,
              pointerEvents: "box-none",
            }}
          >
            {/* Header Background (Fades in) */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: "rgba(255, 255, 255, 0.98)",
                  opacity: headerBgOpacity,
                  elevation: scrollY.interpolate({
                    inputRange: [0, 50],
                    outputRange: [0, 4],
                    extrapolate: "clamp",
                  }),
                },
              ]}
            />

            {/* Centered Title Layer (Absolute for perfect centering) */}
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  paddingTop: insets.top,
                  justifyContent: "center",
                  alignItems: "center",
                },
              ]}
              pointerEvents="none"
            >
              <Animated.Text
                style={[styles.headerTitle, { opacity: headerTitleOpacity }]}
                numberOfLines={1}
              >
                {event?.title}
              </Animated.Text>
            </View>

            {/* Buttons Layer (Floating on top of scrim) */}
            <View
              style={[
                styles.floatingHeader,
                {
                  paddingTop: insets.top,
                  height: "100%",
                },
              ]}
            >
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => navigation.goBack()}
              >
                <ArrowLeft size={24} color="#1D1D1F" strokeWidth={2} />
              </TouchableOpacity>

              <View style={styles.headerRight}>
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={handleShare}
                >
                  <ShareIcon size={22} color="#1D1D1F" strokeWidth={2} />
                </TouchableOpacity>
                {currentUser?.type === "member" && (
                  <TouchableOpacity
                    style={styles.headerButton}
                    onPress={handleBookmark}
                    disabled={bookmarkLoading}
                  >
                    <Bookmark
                      size={22}
                      color="#1D1D1F"
                      strokeWidth={2}
                      fill={isInterested ? "#1D1D1F" : "transparent"}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          <Animated.ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            bounces={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true },
            )}
            scrollEventThrottle={16}
          >
            {/* Banner Section */}
            <View style={styles.bannerContainer}>
              {banners.length > 0 ? (
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => {
                    const index = Math.round(
                      e.nativeEvent.contentOffset.x / SCREEN_WIDTH,
                    );
                    setCurrentBannerIndex(index);
                  }}
                >
                  {banners.map((banner, index) => (
                    <View key={index}>
                      <Image
                        source={{ uri: banner.image_url || banner.url }}
                        style={styles.bannerImage}
                        resizeMode="cover"
                      />
                      <LinearGradient
                        colors={["rgba(0,0,0,0.5)", "transparent"]}
                        locations={[0, 0.3]}
                        style={StyleSheet.absoluteFillObject}
                      />
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View>
                  <LinearGradient
                    colors={getGradientForName(event.title)}
                    style={styles.bannerImage}
                  />
                  <LinearGradient
                    colors={[
                      "rgba(0,0,0,0.6)",
                      "transparent",
                      "rgba(0,0,0,0.8)",
                    ]}
                    locations={[0, 0.4, 1]}
                    style={StyleSheet.absoluteFillObject}
                  />
                </View>
              )}

              {/* Banner Dots */}
              {banners.length > 1 && (
                <View style={styles.dotsContainer}>
                  {banners.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.dot,
                        currentBannerIndex === index && styles.activeDot,
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>

            {/* 2️⃣ Sticky Action Section (Hero Information + Action) */}
            <View
              style={[
                styles.stickyActionContainer,
                { paddingTop: 24, paddingBottom: 24, marginTop: -24 },
              ]}
            >
              <Text
                style={{
                  fontFamily: "BasicCommercial-Bold",
                  fontSize: 28,
                  color: TEXT_COLOR,
                  marginBottom: 16,
                  lineHeight: 32,
                }}
                numberOfLines={3}
              >
                {event.title}
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Calendar size={16} color={MUTED_TEXT} strokeWidth={2} />
                <Text
                  style={{
                    fontFamily: "Manrope-Medium",
                    fontSize: 15,
                    color: MUTED_TEXT,
                    marginLeft: 8,
                  }}
                >
                  {formatDateTime(
                    event.start_datetime || event.event_date,
                    event.end_datetime,
                  )}
                </Text>
              </View>

              {/* Gates Open Row */}
              {!!formatGatesTime(event.gates_open_time) && (
                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                  onPress={() => setShowScheduleModal(true)}
                  activeOpacity={0.7}
                >
                  <DoorOpen size={16} color={MUTED_TEXT} strokeWidth={2} />
                  <Text
                    style={{
                      fontFamily: "Manrope-Medium",
                      fontSize: 15,
                      color: MUTED_TEXT,
                      marginLeft: 8,
                      flex: 1,
                    }}
                  >
                    Gates open at {formatGatesTime(event.gates_open_time)}
                  </Text>
                  <ChevronRight size={16} color={MUTED_TEXT} strokeWidth={2} />
                </TouchableOpacity>
              )}

              <View style={{ marginBottom: 0 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 10, // Increased from 6
                  }}
                >
                  <MapPin size={16} color={MUTED_TEXT} strokeWidth={2} />
                  <Text
                    style={{
                      fontFamily: "Manrope-Medium",
                      fontSize: 15,
                      color: MUTED_TEXT,
                      marginLeft: 8,
                    }}
                    numberOfLines={1}
                  >
                    {displayLocationName}
                  </Text>
                </View>

                {event?.location_url ? (
                  <TouchableOpacity
                    onPress={handleOpenLocation}
                    onPressIn={() => setIsMapLinkPressed(true)}
                    onPressOut={() => setIsMapLinkPressed(false)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginLeft: 24,
                      marginBottom: 16,
                    }}
                    activeOpacity={1}
                  >
                    <Text
                      style={{
                        fontFamily: "Manrope-SemiBold",
                        fontSize: 13,
                        lineHeight: 18, // Added lineHeight
                        color: isMapLinkPressed ? "#1A42CC" : PRIMARY_COLOR,
                        marginRight: 6,
                      }}
                    >
                      View location on map
                    </Text>
                    <MoveRight
                      size={15} // Increased slightly
                      color={isMapLinkPressed ? "#1A42CC" : PRIMARY_COLOR}
                      strokeWidth={2.5}
                      style={{
                        transform: [{ translateY: 0.5 }], // Optical center fix
                      }}
                    />
                  </TouchableOpacity>
                ) : (
                  <View style={{ marginBottom: 16 }} />
                )}
              </View>

              {/* Status Chips and Category Row (Moved below location) */}
              <View style={{ marginBottom: 20 }}>
                {/* Status Messages (Ended/Cancelled) */}
                {eventState === EVENT_STATES.COMPLETED && !isRegistered && (
                  <View
                    style={[
                      styles.statusChip,
                      { backgroundColor: "#F3F4F6", marginBottom: 12 },
                    ]}
                  >
                    <Text style={styles.statusText}>Event Ended</Text>
                  </View>
                )}
                {eventState === EVENT_STATES.CANCELLED && (
                  <View
                    style={[
                      styles.statusChip,
                      { backgroundColor: "#FEF2F2", marginBottom: 12 },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: "#DC2626" }]}>
                      Cancelled
                    </Text>
                  </View>
                )}

                {/* Horizontal Scrollable Categories */}
                {categories.length > 0 && (
                  <Animated.View
                    style={{
                      opacity: categoriesAnim,
                      transform: [
                        {
                          translateX: categoriesAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [20, 0],
                          }),
                        },
                      ],
                    }}
                  >
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={[
                        styles.categoriesScrollContent,
                        categories.length <= 2 && {
                          flex: 1,
                          justifyContent: "center",
                        },
                      ]}
                      style={styles.categoriesScroll}
                    >
                      {categories.map((category, index) => (
                        <View key={index} style={styles.categoryChip}>
                          <Text style={styles.categoryText}>{category}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  </Animated.View>
                )}
              </View>

              {eventState === EVENT_STATES.COMPLETED && !isRegistered ? (
                <View
                  style={{
                    backgroundColor: "#F9FAFB",
                    padding: 16,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: "#F3F4F6",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Manrope-Medium",
                      fontSize: 14,
                      color: MUTED_TEXT,
                      textAlign: "center",
                    }}
                  >
                    This event is no longer accepting registrations.
                  </Text>
                </View>
              ) : eventState === EVENT_STATES.CANCELLED ? (
                <View
                  style={{
                    backgroundColor: "#FEF2F2",
                    padding: 16,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: "#FEE2E2",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Manrope-Medium",
                      fontSize: 14,
                      color: "#DC2626",
                      textAlign: "center",
                    }}
                  >
                    This event has been cancelled.
                  </Text>
                </View>
              ) : (
                <View style={styles.stickyActionContent}>
                  <View style={styles.stickyPriceContainer}>
                    <Text style={styles.stickyPriceLabel}>Starting from</Text>
                    <Text style={styles.stickyPriceValue}>
                      {(() => {
                        const hasTicketTypes = event.ticket_types?.length > 0;
                        const lowestPrice =
                          event.min_price !== null &&
                          event.min_price !== undefined
                            ? event.min_price
                            : hasTicketTypes
                              ? Math.min(
                                  ...event.ticket_types.map(
                                    (t) => parseFloat(t.base_price) || 0,
                                  ),
                                )
                              : event.ticket_price
                                ? parseFloat(event.ticket_price)
                                : 0;
                        return lowestPrice === 0
                          ? "Free"
                          : "₹" + lowestPrice.toLocaleString("en-IN");
                      })()}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.stickyRegisterButton,
                      isRestrictedRole &&
                        !isInviteOnlyNotInvited &&
                        styles.stickyRegisterButtonDisabled,
                      isRegistered && styles.stickyRegisterButtonRegistered,
                    ]}
                    onPress={
                      isInviteOnlyNotInvited && !inviteRequestStatus
                        ? handleRequestInvite
                        : handleRegister
                    }
                    activeOpacity={0.8}
                    disabled={
                      requestingInvite || (!!inviteRequestStatus && !isInvited)
                    }
                  >
                    {requestingInvite ? (
                      <SnooLoader color="#FFFFFF" size="small" />
                    ) : (
                      <Text
                        style={[
                          styles.stickyRegisterText,
                          isRegistered && { color: "#FFFFFF" },
                        ]}
                      >
                        {isRegistered
                          ? "View Ticket"
                          : inviteRequestStatus === "pending" && !isInvited
                            ? "Requested"
                            : isInviteOnlyNotInvited
                              ? "Request Invite"
                              : event.ticket_types?.length > 0 ||
                                  event.ticket_price
                                ? "Register Now"
                                : "Register"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Content Section */}
            <View style={styles.contentContainer}>
              {/* About Section */}
              {event.description && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>About Event</Text>
                  <Text
                    style={styles.description}
                    numberOfLines={descriptionExpanded ? undefined : 4}
                  >
                    {event.description}
                  </Text>
                  {event.description.length > 200 && (
                    <TouchableOpacity
                      onPress={() =>
                        setDescriptionExpanded(!descriptionExpanded)
                      }
                    >
                      <Text style={styles.readMore}>
                        {descriptionExpanded ? "Show less" : "Read more"} ›
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Highlights Section */}
              {event.highlights?.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Event Highlights</Text>
                  {event.highlights.map((highlight, index) => {
                    const HighlightIcon =
                      THINGS_ICON_MAP[highlight.icon_name] || Star;
                    return (
                      <View key={index} style={styles.highlightItem}>
                        <HighlightIcon
                          size={20}
                          color={MUTED_TEXT}
                          strokeWidth={2}
                        />
                        <View style={styles.highlightContent}>
                          <Text style={styles.highlightTitle}>
                            {highlight.title}
                          </Text>
                          {highlight.description && (
                            <Text style={styles.highlightDesc}>
                              {highlight.description}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Things to Know Section */}
              {event.things_to_know?.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Things to Know</Text>
                  {event.things_to_know.slice(0, 3).map((item, index) => {
                    const ThingIcon = THINGS_ICON_MAP[item.icon_name] || Info;
                    return (
                      <View key={index} style={styles.thingRow}>
                        <ThingIcon
                          size={20}
                          color={MUTED_TEXT}
                          strokeWidth={2}
                        />
                        <Text style={styles.thingText}>{item.label}</Text>
                      </View>
                    );
                  })}
                  {event.things_to_know.length > 3 && (
                    <TouchableOpacity>
                      <Text style={styles.seeAll}>See all ›</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Featured Accounts Section */}
              {event.featured_accounts?.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Featured Performers</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {event.featured_accounts.map((account, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.featuredCard,
                          account.linked_account_id &&
                            styles.featuredCardClickable,
                        ]}
                        onPress={() => handleFeaturedAccountPress(account)}
                        disabled={!account.linked_account_id}
                        activeOpacity={account.linked_account_id ? 0.7 : 1}
                      >
                        {account.profile_photo_url || account.account_photo ? (
                          <Image
                            source={{
                              uri:
                                account.profile_photo_url ||
                                account.account_photo,
                            }}
                            style={styles.featuredPhoto}
                          />
                        ) : (
                          <LinearGradient
                            colors={getGradientForName(
                              account.display_name ||
                                account.account_name ||
                                "A",
                            )}
                            style={styles.featuredPhoto}
                          >
                            <Text style={styles.featuredInitials}>
                              {getInitials(
                                account.display_name ||
                                  account.account_name ||
                                  "A",
                              )}
                            </Text>
                          </LinearGradient>
                        )}
                        <Text style={styles.featuredName} numberOfLines={1}>
                          {account.display_name || account.account_name}
                        </Text>
                        <View style={styles.roleBadge}>
                          <Text style={styles.featuredRole}>
                            {account.role || "Performer"}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Organised By Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Organised By</Text>
                <TouchableOpacity
                  style={styles.hostCardPremium}
                  onPress={handleViewCommunity}
                  activeOpacity={0.8}
                >
                  <View style={styles.hostCardInner}>
                    {event.community_logo ? (
                      <Image
                        source={{ uri: event.community_logo }}
                        style={styles.hostAvatarPremium}
                      />
                    ) : (
                      <LinearGradient
                        colors={getGradientForName(event.community_name || "C")}
                        style={styles.hostAvatarPremium}
                      >
                        <Text style={styles.hostInitials}>
                          {getInitials(event.community_name || "C")}
                        </Text>
                      </LinearGradient>
                    )}
                    <View style={styles.hostInfoPremium}>
                      <Text style={styles.hostNamePremium} numberOfLines={1}>
                        {event.community_name || "Community"}
                      </Text>
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <Text style={styles.hostStatsPremium}>
                          {event.community_events_count || "0"} Events •{" "}
                        </Text>
                        <BadgeCheck size={14} color={COLORS.primary} />
                        <Text
                          style={[styles.hostStatsPremium, { marginLeft: 4 }]}
                        >
                          Verified
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.hostCtaRow}>
                    <Text style={styles.hostCtaText}>View Profile</Text>
                    <MoveRight
                      size={16}
                      color={PRIMARY_COLOR}
                      strokeWidth={2.5}
                    />
                  </View>
                </TouchableOpacity>

                {/* Community Heads */}
                {event.community_heads?.length > 0 && (
                  <View style={styles.headsContainer}>
                    <Text style={styles.headsTitle}>
                      {event.community_heads?.length > 1
                        ? "Meet the Hosts"
                        : "Meet the Host"}
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      {event.community_heads.map((head, index) => (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.headCard,
                            head.member_id && styles.headCardClickable,
                          ]}
                          onPress={() => handleCommunityHeadPress(head)}
                          disabled={!head.member_id}
                          activeOpacity={head.member_id ? 0.7 : 1}
                        >
                          {head.profile_pic_url || head.profile_photo_url ? (
                            <Image
                              source={{
                                uri:
                                  head.profile_pic_url ||
                                  head.profile_photo_url,
                              }}
                              style={styles.headPhoto}
                            />
                          ) : (
                            <LinearGradient
                              colors={getGradientForName(head.name || "H")}
                              style={styles.headPhoto}
                            >
                              <Text style={styles.headInitials}>
                                {getInitials(head.name || "H")}
                              </Text>
                            </LinearGradient>
                          )}
                          <Text style={styles.headName} numberOfLines={1}>
                            {head.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Enhanced View Attendees Section - always visible for members */}
              {viewAttendeesState.visible && (
                <View style={styles.viewAttendeesSection}>
                  {/* View Attendees Button */}
                  <TouchableOpacity
                    style={[
                      styles.viewAttendeesButton,
                      viewAttendeesState.locked &&
                        styles.viewAttendeesButtonLocked,
                    ]}
                    onPress={
                      viewAttendeesState.locked
                        ? triggerLockedToast
                        : handleViewAttendees
                    }
                    activeOpacity={0.7}
                  >
                    <View style={styles.viewAttendeesContent}>
                      {viewAttendeesState.locked ? (
                        <Lock size={20} color={MUTED_TEXT} strokeWidth={2} />
                      ) : (
                        <Users
                          size={20}
                          color={COLORS.primary}
                          strokeWidth={2}
                        />
                      )}
                      <Text
                        style={[
                          styles.viewAttendeesText,
                          viewAttendeesState.locked && { color: MUTED_TEXT },
                        ]}
                      >
                        View Attendees
                      </Text>
                    </View>
                    <MoveRight size={20} color={MUTED_TEXT} strokeWidth={2.5} />
                  </TouchableOpacity>

                  {/* Registration Progress */}
                  <View style={styles.registrationProgress}>
                    {/* Badges */}
                    {registrationProgress.soldOut ? (
                      <View
                        style={[
                          styles.progressBadge,
                          { backgroundColor: "#FEE2E2" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.progressBadgeText,
                            { color: "#DC2626" },
                          ]}
                        >
                          Sold Out
                        </Text>
                      </View>
                    ) : registrationProgress.almostFull ? (
                      <View
                        style={[
                          styles.progressBadge,
                          { backgroundColor: "#FEF3C7" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.progressBadgeText,
                            { color: "#D97706" },
                          ]}
                        >
                          Almost Full
                        </Text>
                      </View>
                    ) : null}

                    {/* Progress Text */}
                    <Text style={styles.progressText}>
                      {registrationProgress.registered === 0
                        ? "Be the first to join! 🎉"
                        : registrationProgress.unlimited
                          ? `${registrationProgress.registered} registered`
                          : `${registrationProgress.registered} of ${registrationProgress.capacity} registered`}
                    </Text>

                    {/* Progress Bar - only show if not unlimited */}
                    {!registrationProgress.unlimited && (
                      <View style={styles.progressBarContainer}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${registrationProgress.percentage}%`,
                              backgroundColor: progressBarColor,
                            },
                          ]}
                        />
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Gallery Section */}
              {event.gallery?.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Gallery</Text>
                  <View style={styles.galleryGridContainer}>
                    {event.gallery.slice(0, 4).map((image, index) => {
                      const isLast = index === 3 && event.gallery.length > 4;
                      return (
                        <TouchableOpacity
                          key={index}
                          style={styles.galleryGridItem}
                          activeOpacity={0.8}
                          onPress={() =>
                            navigation.navigate("EventGallery", {
                              images: event.gallery,
                              eventTitle: event.title,
                              initialIndex: index,
                            })
                          }
                        >
                          <Image
                            source={{ uri: image.image_url || image.url }}
                            style={styles.galleryGridImage}
                            resizeMode="cover"
                          />
                          {isLast && (
                            <View style={styles.galleryOverlay}>
                              <Text style={styles.galleryOverlayText}>
                                +{event.gallery.length - 3} Photos
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* See all button */}
                  {event.gallery.length > 4 && (
                    <TouchableOpacity
                      style={styles.seeAllGalleryBtn}
                      activeOpacity={0.8}
                      onPress={() =>
                        navigation.navigate("EventGallery", {
                          images: event.gallery,
                          eventTitle: event.title,
                          initialIndex: 0,
                        })
                      }
                    >
                      <Text style={styles.seeAllGalleryText}>
                        See all {event.gallery.length} photos
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Spacer for bottom bar */}
              <View style={{ height: 100 }} />
            </View>
          </Animated.ScrollView>

          {/* Schedule and Timeline Modal */}
          <Modal
            visible={showScheduleModal}
            transparent
            animationType="slide"
            statusBarTranslucent
            onRequestClose={() => setShowScheduleModal(false)}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.4)",
                justifyContent: "flex-end",
              }}
              activeOpacity={1}
              onPress={() => setShowScheduleModal(false)}
            >
              <TouchableOpacity activeOpacity={1}>
                <View
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    paddingTop: 20,
                    paddingHorizontal: 24,
                    paddingBottom: 48,
                  }}
                >
                  {/* Handle bar */}
                  <View
                    style={{
                      width: 36,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: "#E5E7EB",
                      alignSelf: "center",
                      marginBottom: 20,
                    }}
                  />

                  {/* Header row */}
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 24,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "BasicCommercial-Bold",
                        fontSize: 20,
                        color: TEXT_COLOR,
                        letterSpacing: -0.3,
                      }}
                    >
                      Schedule and timeline
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowScheduleModal(false)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <XCircle size={22} color={MUTED_TEXT} strokeWidth={2} />
                    </TouchableOpacity>
                  </View>

                  {/* Date header */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 20,
                    }}
                  >
                    <Calendar size={16} color={MUTED_TEXT} strokeWidth={2} />
                    <Text
                      style={{
                        fontFamily: "Manrope-Medium",
                        fontSize: 14,
                        color: MUTED_TEXT,
                        marginLeft: 8,
                      }}
                    >
                      {event.start_datetime || event.event_date
                        ? new Date(
                            event.start_datetime || event.event_date,
                          ).toLocaleDateString("en-IN", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : ""}
                    </Text>
                  </View>

                  {/* Timeline items */}
                  {[
                    event.gates_open_time
                      ? { label: "Gates open", time: event.gates_open_time }
                      : null,
                    event.start_datetime || event.event_date
                      ? {
                          label: "Event starts",
                          time: event.start_datetime || event.event_date,
                        }
                      : null,
                    {
                      label: "Event ends",
                      // Treat end_datetime as absent if it equals start_datetime
                      // (backend stores start == end when no end time is set)
                      time:
                        event.end_datetime &&
                        event.end_datetime !== event.start_datetime &&
                        event.end_datetime !== event.event_date
                          ? event.end_datetime
                          : null,
                    },
                  ]
                    .filter(Boolean)
                    .map((item, index, arr) => (
                      <View
                        key={index}
                        style={{ flexDirection: "row", alignItems: "stretch" }}
                      >
                        {/* Left connector column */}
                        <View
                          style={{
                            width: 24,
                            alignItems: "center",
                            marginRight: 14,
                          }}
                        >
                          {/* Circle node */}
                          <View
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 10,
                              borderWidth: 2,
                              borderColor: "#D1D5DB",
                              backgroundColor: "#FFFFFF",
                              marginTop: 14,
                            }}
                          />
                          {/* Connector line (hide on last item) */}
                          {index < arr.length - 1 && (
                            <View
                              style={{
                                flex: 1,
                                width: 2,
                                backgroundColor: "#E5E7EB",
                                marginTop: 2,
                                marginBottom: 0,
                              }}
                            />
                          )}
                        </View>

                        {/* Row content */}
                        <View
                          style={{
                            flex: 1,
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            paddingTop: 11,
                            paddingBottom: index < arr.length - 1 ? 18 : 0,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "Manrope-Regular",
                              fontSize: 15,
                              color: TEXT_COLOR,
                            }}
                          >
                            {item.label}
                          </Text>
                          <Text
                            style={{
                              fontFamily: "Manrope-Medium",
                              fontSize: 15,
                              color: MUTED_TEXT,
                            }}
                          >
                            {item.time
                              ? new Date(item.time).toLocaleTimeString(
                                  "en-IN",
                                  {
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                  },
                                )
                              : "Not specified"}
                          </Text>
                        </View>
                      </View>
                    ))}
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          {/* Attendance Confirmation Modal */}
          <AttendanceConfirmationModal
            visible={showAttendanceModal}
            eventTitle={event.title}
            onConfirmAttendance={handleConfirmAttendance}
            loading={attendanceLoading}
          />

          {/* Locked View Attendees Toast */}
          {lockedToastVisible && (
            <Animated.View
              style={[
                styles.lockedToast,
                {
                  opacity: lockedToastOpacity,
                  transform: [{ translateY: lockedToastTranslateY }],
                },
              ]}
            >
              <Lock size={18} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.lockedToastText}>
                Come back within 24 hours of the event to view attendees and
                connect with them
              </Text>
            </Animated.View>
          )}
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  roleBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },

  hostCardPremium: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  hostCardInner: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  hostAvatarPremium: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  hostInfoPremium: {
    flex: 1,
  },
  hostNamePremium: {
    fontSize: 16,
    fontFamily: "BasicCommercialBold",
    color: TEXT_COLOR,
    marginBottom: 4,
  },
  hostStatsPremium: {
    fontSize: 13,
    fontFamily: "Manrope-Medium",
    color: MUTED_TEXT,
  },
  hostCtaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  hostCtaText: {
    color: PRIMARY_COLOR,
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    marginRight: 4,
  },
  galleryGridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  galleryGridItem: {
    width: "48%",
    aspectRatio: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  galleryGridImage: {
    width: "100%",
    height: "100%",
  },
  galleryOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  galleryOverlayText: {
    color: "#FFFFFF",
    fontFamily: "BasicCommercialBold",
    fontSize: 16,
  },
  seeAllGalleryBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(41, 98, 255, 0.15)",
  },
  seeAllGalleryText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: "#2962FF",
  },

  eventEndedContainer: {
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  eventEndedTitle: {
    fontFamily: "BasicCommercialBold",
    fontSize: 16,
    color: TEXT_COLOR,
    marginBottom: 6,
  },
  eventEndedText: {
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: MUTED_TEXT,
    textAlign: "center",
  },

  bannerImageContainer: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
  },
  titleBlock: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  bannerCategoryPill: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  bannerCategoryText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Manrope-SemiBold",
  },
  bannerTitle: {
    fontSize: 26,
    fontFamily: "BasicCommercialBlack",
    marginBottom: 8,
  },
  bannerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  bannerMetaText: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: "#FFFFFF",
    marginLeft: 6,
  },
  stickyActionContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    zIndex: 20,
  },
  stickyActionContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stickyPriceContainer: {
    flexDirection: "column",
  },
  stickyPriceLabel: {
    fontSize: 12,
    fontFamily: "Manrope-Medium",
    color: MUTED_TEXT,
  },
  stickyPriceValue: {
    fontSize: 20,
    fontFamily: "BasicCommercialBold",
    color: TEXT_COLOR,
    marginTop: 2,
  },
  stickyPriceValueCancelled: {
    fontSize: 18,
    fontFamily: "BasicCommercialBold",
    color: "#DC2626",
    marginTop: 2,
  },
  stickyRegisterButton: {
    backgroundColor: PRIMARY_COLOR,
    height: 48,
    borderRadius: 16,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
    marginLeft: 20,
  },
  stickyRegisterButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  stickyRegisterButtonRegistered: {
    backgroundColor: "#10B981",
  },
  stickyRegisterText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
  },
  categoriesScroll: {
    marginLeft: -4, // Counteract chip margin for first item alignment
  },
  categoriesScrollContent: {
    paddingRight: 20,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    marginHorizontal: 4,
  },
  categoryText: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: "#1E3A8A",
  },
  statusChip: {
    alignSelf: "flex-start",
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 24,
  },
  statusText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
    color: MUTED_TEXT,
  },

  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: MUTED_TEXT,
    fontSize: 16,
    marginTop: 12,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 20,
  },
  retryButtonText: {
    color: TEXT_COLOR,
    fontWeight: "600",
  },
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Manrope-SemiBold",
    color: TEXT_COLOR,
    textAlign: "center",
    paddingHorizontal: 80, // Prevent text from hitting buttons
  },
  headerRight: {
    flexDirection: "row",
  },
  scrollView: {
    flex: 1,
  },
  bannerContainer: {
    height: BANNER_HEIGHT,
    position: "relative",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: "hidden",
  },
  bannerImage: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
  },
  bannerGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: BANNER_HEIGHT * 0.5,
  },
  dotsContainer: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    flexDirection: "row",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.5)",
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: "#FFFFFF",
    width: 24,
  },
  contentContainer: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Manrope-SemiBold",
    color: TEXT_COLOR,
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    fontFamily: "Manrope-Regular",
    lineHeight: 22,
    color: MUTED_TEXT,
  },
  readMore: {
    color: PRIMARY_COLOR,
    fontWeight: "600",
    marginTop: 8,
  },
  highlightItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  highlightContent: {
    flex: 1,
    marginLeft: 12,
  },
  highlightTitle: {
    fontSize: 16,
    fontFamily: "Manrope-Regular",
    color: MUTED_TEXT,
    lineHeight: 20,
  },
  highlightDesc: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: TEXT_COLOR,
    marginTop: 4,
    lineHeight: 18,
  },
  thingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  thingText: {
    fontSize: 16,
    fontFamily: "Manrope-Regular",
    color: MUTED_TEXT,
    marginLeft: 12,
    flex: 1,
  },
  seeAll: {
    color: PRIMARY_COLOR,
    fontWeight: "600",
    marginTop: 12,
  },
  featuredCard: {
    width: 100,
    alignItems: "center",
    marginRight: 16,
  },
  featuredPhoto: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  featuredInitials: {
    fontSize: 24,
    fontWeight: "bold",
    color: TEXT_COLOR,
  },
  featuredName: {
    fontSize: 13,
    fontFamily: "Manrope-SemiBold",
    color: TEXT_COLOR,
    textAlign: "center",
  },
  featuredRole: {
    fontSize: 11,
    fontFamily: "Manrope-Regular",
    color: MUTED_TEXT,
    textTransform: "capitalize",
    marginTop: 2,
  },
  hostCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: CARD_BACKGROUND,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  hostLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  hostAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  hostInitials: {
    fontSize: 18,
    fontWeight: "bold",
    color: TEXT_COLOR,
  },
  hostName: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
    flex: 1,
  },
  hostInfo: {
    flex: 1,
  },
  hostStats: {
    flexDirection: "row",
  },
  headsContainer: {
    marginTop: 16,
  },
  headsTitle: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: TEXT_COLOR,
    marginBottom: 12,
  },
  headCard: {
    alignItems: "center",
    marginRight: 16,
    width: 70,
  },
  headPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  headInitials: {
    fontSize: 16,
    fontWeight: "bold",
    color: TEXT_COLOR,
  },
  headName: {
    fontSize: 12,
    fontFamily: "Manrope-SemiBold",
    color: TEXT_COLOR,
    textAlign: "center",
  },
  headRole: {
    fontSize: 10,
    color: MUTED_TEXT,
    marginTop: 2,
  },
  galleryImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginRight: 12,
  },
  statItem: {
    alignItems: "center",
    marginLeft: 16,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: TEXT_COLOR,
  },
  statLabel: {
    fontSize: 11,
    color: MUTED_TEXT,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: CARD_BACKGROUND,
    paddingHorizontal: 20,
    paddingTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 20,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  priceText: {
    fontSize: 20,
    fontWeight: "bold",
    color: TEXT_COLOR,
  },
  priceSubtext: {
    fontSize: 12,
    color: MUTED_TEXT,
    marginLeft: 4,
  },
  registerButtonWrapper: {
    borderRadius: 30,
    overflow: "hidden",
  },
  registerButtonDisabled: {
    opacity: 0.7,
  },
  registerButtonGradient: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
  },
  registerButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // Ticket Section Styles
  earlyBirdBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 184, 0, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  earlyBirdText: {
    color: "#FFB800",
    fontSize: 14,
    fontWeight: "600",
  },
  ticketCard: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  ticketCardDisabled: {
    opacity: 0.5,
  },
  ticketMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  ticketInfo: {
    flex: 1,
    marginRight: 16,
  },
  ticketNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  ticketName: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  ticketDesc: {
    fontSize: 13,
    color: MUTED_TEXT,
    marginTop: 4,
  },
  ticketPriceContainer: {
    alignItems: "flex-end",
  },
  ticketPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: PRIMARY_COLOR,
  },
  ticketPriceDisabled: {
    color: MUTED_TEXT,
    textDecorationLine: "line-through",
  },
  lowStockBadge: {
    backgroundColor: "rgba(255, 149, 0, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  lowStockText: {
    color: "#FF9500",
    fontSize: 11,
    fontWeight: "600",
  },
  soldOutBadge: {
    backgroundColor: "rgba(255, 59, 48, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  soldOutText: {
    color: "#FF3B30",
    fontSize: 11,
    fontWeight: "600",
  },
  promoHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  promoHintText: {
    color: "#34C759",
    fontSize: 13,
    fontWeight: "500",
  },
  creatorToast: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.9)",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    zIndex: 200,
    elevation: 20,
  },
  creatorToastText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  viewAttendeesButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: CARD_BACKGROUND,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  viewAttendeesContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  viewAttendeesText: {
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
    color: TEXT_COLOR,
  },
  cancelledBarContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
  },
  cancelledText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#DC2626",
  },
  // Enhanced View Attendees Section
  viewAttendeesSection: {
    marginHorizontal: 20,
    marginTop: 16,
  },
  viewAttendeesButtonLocked: {
    opacity: 0.6,
    borderStyle: "dashed",
  },
  registrationProgress: {
    marginTop: 12,
    paddingHorizontal: 4,
  },
  progressBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  progressBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  progressText: {
    fontSize: 14,
    color: MUTED_TEXT,
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  // Custom animated locked toast
  lockedToast: {
    position: "absolute",
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    zIndex: 300,
    elevation: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  lockedToastText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
});

export default EventDetailsScreen;
