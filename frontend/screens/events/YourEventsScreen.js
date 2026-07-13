import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Image, Animated, Pressable, Platform, InteractionManager, Share, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Calendar, Heart, Bookmark } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { apiGet } from "../../api/client";
import { getAuthToken, getActiveAccount } from "../../api/auth";
import { getInterestedEvents, toggleEventInterest, confirmAttendance } from "../../api/events";
import AttendanceConfirmationModal from "../../components/AttendanceConfirmationModal";
import { getHostedPlans, getAttendingPlans, getInterestedPlans, togglePlanInterest, likePlan, unlikePlan } from "../../api/plans";
import HapticsService from "../../services/HapticsService";
import EventBus from "../../utils/EventBus";
import PromoteSheet from "../../components/posts/PromoteSheet";
import {
  COLORS,
  FONTS,
  SPACING,
  SHADOWS,
  BORDER_RADIUS,
} from "../../constants/theme";
import { getGradientForName } from "../../utils/AvatarGenerator";
import { useLocationName } from "../../utils/locationNameCache";
import SnooLoader from "../../components/ui/SnooLoader";
import EventCard from "../../components/EventCard";
import CommentsModal from "../../components/CommentsModal";
import OpenPlanCard from "../../components/plans/OpenPlanCard";
import ShareModal from "../../components/ShareModal";

const PRIMARY_COLOR = COLORS.primary;
const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;
const BORDER_COLOR = COLORS.border;

// Separate component for event card to use hooks for location resolution
const EventListCard = ({
  item,
  onPress,
  isPast,
  onComment,
  onAttendancePress,
}) => {
  return (
    <EventCard
      event={item}
      onPress={onPress}
      onComment={onComment}
      compact={false}
      onAttendancePress={onAttendancePress}
      style={{ marginHorizontal: 0, marginBottom: 20 }}
    />
  );
};

const HOSTED_ACTIVITY_COLORS = {
  sports: { bg: '#EEF2FF', text: '#3B5BDB' },
  study:  { bg: '#E8F5E9', text: '#2E7D32' },
  food:   { bg: '#FFF8E1', text: '#B45309' },
  gaming: { bg: '#FCE4EC', text: '#C2185B' },
  other:  { bg: '#F5F5F5', text: '#555555' },
};

const ACTIVITY_EMOJIS = {
  sports:       '🏀',
  food:         '🍜',
  cafe:         '☕',
  bar:          '🍸',
  movies:       '🎬',
  live_music:   '🎵',
  games:        '🎮',
  gaming:       '🎮',
  gym:          '💪',
  yoga:         '🧘',
  walk:         '🚶',
  rides:        '🏍',
  hangout:      '🌳',
  creative:     '🎨',
  study:        '📚',
  pet_friendly: '🐾',
  house_party:  '🏡',
  club:         '🪩',
  hiking:       '🥾',
  shopping:     '🛍️',
  other:        '＋',
};

const HOSTED_STATUS_COLORS = {
  active:    { bg: '#E8F5E9', text: '#2E7D32' },
  closed:    { bg: '#F5F5F5', text: '#555555' },
  cancelled: { bg: '#FFEBEE', text: '#C62828' },
};





// Card styles
const cardStyles = StyleSheet.create({
  eventCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    marginBottom: 24,
    overflow: "hidden",
    ...SHADOWS.md,
    shadowColor: "#000",
    shadowOpacity: 0.06,
  },
  bannerContainer: {
    width: "100%",
    height: 200,
    position: "relative",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
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
  },
  dateBadgeMonth: {
    fontSize: 10,
    fontFamily: FONTS.semiBold,
    color: PRIMARY_COLOR,
    marginBottom: 2,
  },
  dateBadgeDay: {
    fontSize: 16,
    fontFamily: FONTS.black,
    color: TEXT_COLOR,
  },
  statusPill: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(41, 98, 255, 0.9)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 10,
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  cancelledOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  pastOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.08)", // Very subtle darkening instead of opacity
  },
  cancelledText: {
    fontSize: 14,
    fontFamily: FONTS.black,
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  contentContainer: {
    padding: 16,
  },
  eventTitle: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: TEXT_COLOR,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  metaText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: LIGHT_TEXT_COLOR,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
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
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  attendeeCount: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: "#36454F",
    marginLeft: 6,
  },
  priceContainer: {
    alignItems: "flex-end",
  },
  priceText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: "#36454F",
  },
  freeText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: "#5fab56", // Calm success tone
  },
  // Past Event Refinements (Crisp but archival)
  eventTitlePast: {
    color: "#36454F", // Darker grey for legibility
  },
  metaTextPast: {
    color: "#9CA3AF",
  },
  priceTextPast: {
    color: "#36454F",
  },
  freeTextPast: {
    color: "#5fab56",
  },
});

export default function YourEventsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState("Hosted");
  const [events, setEvents] = useState([]);
  const [interestedEvents, setInterestedEvents] = useState([]);
  const [hostedPlans, setHostedPlans] = useState([]);
  const [attendingPlans, setAttendingPlans] = useState([]);
  const [interestedPlans, setInterestedPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [sharingPlan, setSharingPlan] = useState(null);
  const [selectedVerifyEvent, setSelectedVerifyEvent] = useState(null);
  const [attendanceModalVisible, setAttendanceModalVisible] = useState(false);
  const [attendanceConfirmLoading, setAttendanceConfirmLoading] = useState(false);

  // Promote plan state
  const [showPromoteSheet, setShowPromoteSheet] = useState(false);
  const [promotingPlan, setPromotingPlan] = useState(null);

  useEffect(() => {
    getActiveAccount()
      .then((account) => {
        if (account?.id) {
          setCurrentUserId(account.id);
        }
      })
      .catch((err) => console.error("Error loading account in YourEventsScreen:", err));
  }, []);

  // Subscribe to global event-status-updated updates to keep our local events list in sync
  useEffect(() => {
    const unsubscribe = EventBus.on("event-status-updated", ({ eventId, status, confirmedAt }) => {
      setEvents((prevEvents) =>
        prevEvents.map((evt) =>
          parseInt(evt.id) === parseInt(eventId)
            ? { ...evt, attendance_status: status, attendance_confirmed_at: confirmedAt }
            : evt
        )
      );
      setInterestedEvents((prevEvents) =>
        prevEvents.map((evt) =>
          parseInt(evt.id) === parseInt(eventId)
            ? { ...evt, attendance_status: status, attendance_confirmed_at: confirmedAt }
            : evt
        )
      );
    });
    return unsubscribe;
  }, []);

  // Screen-level comments modal state and callbacks
  const [commentsModalState, setCommentsModalState] = useState({
    visible: false,
    postId: null,
    postType: "post",
  });

  const openCommentsModal = useCallback((postId, postType = "post") => {
    if (postId) {
      setCommentsModalState({ visible: true, postId, postType });
    }
  }, []);

  const closeCommentsModal = useCallback(() => {
    setCommentsModalState({ visible: false, postId: null, postType: "post" });
  }, []);

  const handleOpenAttendanceModal = useCallback((event) => {
    setSelectedVerifyEvent(event);
    setAttendanceModalVisible(true);
  }, []);

  const handleConfirmAttendance = useCallback(async (attended) => {
    if (!selectedVerifyEvent) return;
    try {
      setAttendanceConfirmLoading(true);
      const response = await confirmAttendance(selectedVerifyEvent.id, attended);
      if (response?.success) {
        const newStatus = attended ? "attended" : "did_not_attend";
        
        // Update local events state
        setEvents((prevEvents) =>
          prevEvents.map((evt) =>
            evt.id === selectedVerifyEvent.id
              ? { ...evt, attendance_status: newStatus, attendance_confirmed_at: new Date().toISOString() }
              : evt
          )
        );
        
        // Update local interestedEvents state
        setInterestedEvents((prevEvents) =>
          prevEvents.map((evt) =>
            evt.id === selectedVerifyEvent.id
              ? { ...evt, attendance_status: newStatus, attendance_confirmed_at: new Date().toISOString() }
              : evt
          )
        );
        
        setAttendanceModalVisible(false);
        setSelectedVerifyEvent(null);
        HapticsService.triggerImpactLight();
      } else {
        Alert.alert("Error", response?.error || "Failed to update attendance");
      }
    } catch (error) {
      console.error("Error confirming attendance:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setAttendanceConfirmLoading(false);
    }
  }, [selectedVerifyEvent]);

  // Tab underline animation
  const tabUnderlineX = React.useRef(new Animated.Value(0)).current;
  const tabUnderlineScale = React.useRef(new Animated.Value(0)).current;

  const tabWidths = React.useRef({}).current;
  const tabOffsets = React.useRef({}).current;

  useEffect(() => {
    // Underline sliding animation
    if (tabOffsets[activeTab] !== undefined) {
      Animated.parallel([
        Animated.spring(tabUnderlineX, {
          toValue: tabOffsets[activeTab],
          useNativeDriver: false,
          tension: 50,
          friction: 8,
        }),
        Animated.spring(tabUnderlineScale, {
          toValue: tabWidths[activeTab],
          useNativeDriver: false,
          tension: 50,
          friction: 8,
        }),
      ]).start();
    }
  }, [activeTab]);

  const handleTabLayout = (tab, event) => {
    const { x, width } = event.nativeEvent.layout;
    tabOffsets[tab] = x;
    tabWidths[tab] = width;

    // Set initial position for active tab underline
    if (tab === activeTab) {
      tabUnderlineX.setValue(x);
      tabUnderlineScale.setValue(width);
    }
  };

  const loadEvents = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const token = await getAuthToken();
      const [response, hostedData, attendingData, interestedPlansData] = await Promise.all([
        apiGet("/events/my-events", 15000, token),
        getHostedPlans(token).catch(() => ({ plans: [] })),
        getAttendingPlans(token).catch(() => ({ plans: [] })),
        getInterestedPlans(token).catch(() => ({ plans: [] })),
      ]);
      const allEvents = response?.events || [];
      setEvents(allEvents);
      setHostedPlans((hostedData.plans || []).filter(p => !p.parent_plan_id));
      setAttendingPlans(attendingData.plans || []);
      setInterestedPlans(interestedPlansData.plans || []);
    } catch (error) {
      console.error("Error loading events:", error);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  const loadInterestedEvents = useCallback(async () => {
    try {
      const response = await getInterestedEvents();
      if (response?.events) {
        setInterestedEvents(response.events);
      }
    } catch (error) {
      console.error("Error loading interested events:", error);
    }
  }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      loadEvents();
      loadInterestedEvents();
    });

    // Listen for interest updates from EventDetailsScreen
    const unsubscribe = EventBus.on("event-interest-updated", (payload) => {
      if (payload?.isInterested === false) {
        // Remove from interested list
        setInterestedEvents((prev) =>
          prev.filter((e) => e.id !== payload.eventId),
        );
      } else {
        // Refresh the list to get updated data
        loadInterestedEvents();
      }
    });

    return () => {
      task.cancel();
      if (unsubscribe) unsubscribe();
    };
  }, [loadEvents, loadInterestedEvents]);

  const getFilteredEvents = () => {
    const now = new Date();
    const interestedIds = new Set(interestedEvents.map((e) => e.id));
    const interestedPlanIds = new Set(interestedPlans.map((p) => p.id));

    const mappedEvents = events.map((e) => ({
      ...e,
      _type: 'event',
      is_interested: interestedIds.has(e.id),
    }));

    switch (activeTab) {
      case "Going": {
        const goingEvents = mappedEvents.filter((e) => {
          const eventDate = new Date(e.start_datetime || e.event_date);
          return (
            (e.registration_status === "registered" && eventDate >= now) ||
            (e.registration_status === "attended" && eventDate >= now)
          );
        });
        const goingPlans = attendingPlans
          .filter(p => new Date(p.scheduled_at) >= now)
          .map(p => ({ ...p, _type: 'plan', is_interested: interestedPlanIds.has(p.id) }));
        return [
          ...goingEvents,
          ...goingPlans,
        ].sort((a, b) => {
          const da = new Date(a.scheduled_at || a.start_datetime || a.event_date);
          const db = new Date(b.scheduled_at || b.start_datetime || b.event_date);
          return da - db;
        });
      }
      case "Hosted":
        return hostedPlans;
      case "Interested": {
        const intEvents = interestedEvents
          .filter((e) => !e.is_past)
          .map((e) => ({ ...e, _type: 'event', is_interested: true }));
        const intPlans = interestedPlans
          .map(p => ({ ...p, _type: 'plan', is_interested: true }));
        return [...intPlans, ...intEvents];
      }
      case "Past": {
        const pastEvents = mappedEvents.filter((e) => {
          const eventDate = new Date(e.start_datetime || e.event_date);
          return (
            e.is_past ||
            (eventDate < now && e.registration_status === "attended")
          );
        });
        const pastPlans = attendingPlans
          .filter(p => new Date(p.scheduled_at) < now)
          .map(p => ({ ...p, _type: 'plan', is_interested: interestedPlanIds.has(p.id) }));
        return [
          ...pastEvents,
          ...pastPlans,
        ].sort((a, b) => {
          const da = new Date(a.scheduled_at || a.start_datetime || a.event_date);
          const db = new Date(b.scheduled_at || b.start_datetime || b.event_date);
          return db - da;
        });
      }
      default:
        return [];
    }
  };

  // Format date for display: "30 Dec"
  const formatDateBadge = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${day} ${months[date.getMonth()]}`;
  };

  // Get lowest ticket price for display
  const getLowestPrice = (item) => {
    // First check ticket_types
    if (item.ticket_types && item.ticket_types.length > 0) {
      const prices = item.ticket_types
        .map((t) => parseFloat(t.base_price) || 0)
        .filter((p) => p > 0);
      if (prices.length > 0) {
        return Math.min(...prices);
      }
    }
    // Fallback to min_price on the event itself
    if (item.min_price && parseFloat(item.min_price) > 0) {
      return parseFloat(item.min_price);
    }
    // Fallback to base_price on the event itself
    if (item.base_price && parseFloat(item.base_price) > 0) {
      return parseFloat(item.base_price);
    }
    return null;
  };

  // Format time: "7:00 PM"
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleEventPress = (item) => {
    // Tapping the card always opens EventDetails screen
    navigation.navigate("EventDetails", {
      eventId: item.id,
      eventData: item,
      isRegistered: activeTab === "Going" || activeTab === "Past" || item.registration_status === "registered" || item.registration_status === "attended" || item.registration_status === "confirmed",
    });
  };

  const handleRemoveInterest = async (item) => {
    try {
      HapticsService.triggerImpactLight();

      // Optimistically remove from UI
      setInterestedEvents((prev) => prev.filter((e) => e.id !== item.id));

      const response = await toggleEventInterest(item.id);

      if (!response?.success) {
        // Revert if API failed - refresh the list
        loadInterestedEvents();
      } else {
        // Notify other components
        EventBus.emit("event-interest-updated", {
          eventId: item.id,
          isInterested: false,
        });
      }
    } catch (error) {
      console.error("Error removing interest:", error);
      // Revert on error
      loadInterestedEvents();
    }
  };

  const handleTogglePlanInterest = useCallback(async (plan) => {
    HapticsService.triggerImpactLight();
    const isCurrentlyInterested = interestedPlans.some(p => p.id === plan.id);
    // Optimistic update
    if (isCurrentlyInterested) {
      setInterestedPlans(prev => prev.filter(p => p.id !== plan.id));
    } else {
      setInterestedPlans(prev => [{ ...plan }, ...prev]);
    }
    try {
      const token = await getAuthToken();
      await togglePlanInterest(plan.id, token);
    } catch (e) {
      // Revert on error
      if (isCurrentlyInterested) {
        setInterestedPlans(prev => [{ ...plan }, ...prev]);
      } else {
        setInterestedPlans(prev => prev.filter(p => p.id !== plan.id));
      }
    }
  }, [interestedPlans]);

  const handlePlanLike = useCallback(async (planId, liked) => {
    try {
      const token = await getAuthToken();
      if (liked) {
        await likePlan(planId, token);
      } else {
        await unlikePlan(planId, token);
      }
      const updateState = (prev) =>
        prev.map((p) =>
          p.id === planId
            ? {
                ...p,
                is_liked: liked,
                like_count: Math.max(0, (p.like_count || 0) + (liked ? 1 : -1)),
              }
            : p
        );
      setHostedPlans(updateState);
      setInterestedPlans(updateState);
      setAttendingPlans(updateState);
    } catch (error) {
      console.error("Error toggling like on plan:", error);
    }
  }, []);

  const renderEvent = useCallback(({ item }) => {
    if (activeTab === "Hosted") {
      return (
        <OpenPlanCard
          plan={item}
          currentUserId={currentUserId}
          compact={true}
          onPress={() => navigation.navigate("HostRequests", { planId: item.id, planTitle: item.title })}
          onLike={handlePlanLike}
          onShare={(plan) => {
            setSharingPlan(plan);
            setShareModalVisible(true);
          }}
          onComment={(planId) => openCommentsModal(planId, "plan")}
          onPromote={(plan) => {
            setPromotingPlan(plan);
            setShowPromoteSheet(true);
          }}
          navigation={navigation}
        />
      );
    }
    if (item._type === 'plan') {
      const isPlanInterested = interestedPlans.some(p => p.id === item.id);
      return (
        <OpenPlanCard
          plan={item}
          currentUserId={currentUserId}
          compact={true}
          isInterested={item.is_interested || isPlanInterested}
          onPress={(planId) => navigation.navigate('PlanDetail', { planId })}
          onLike={handlePlanLike}
          onShare={(plan) => {
            setSharingPlan(plan);
            setShareModalVisible(true);
          }}
          onInterest={async () => {
            await handleTogglePlanInterest(item);
          }}
          onComment={(planId) => openCommentsModal(planId, "plan")}
          navigation={navigation}
        />
      );
    }
    return (
      <EventListCard
        item={item}
        onPress={handleEventPress}
        onRemoveInterest={handleRemoveInterest}
        getLowestPrice={getLowestPrice}
        formatDateBadge={formatDateBadge}
        formatTime={formatTime}
        showRemoveButton={activeTab === "Interested"}
        isPast={activeTab === "Past"}
        onComment={(id) => openCommentsModal(id, "event")}
        onAttendancePress={handleOpenAttendanceModal}
      />
    );
  }, [handleEventPress, handleRemoveInterest, handleTogglePlanInterest, interestedPlans, activeTab, navigation, openCommentsModal, currentUserId, handlePlanLike, handleOpenAttendanceModal]);

  const filteredEvents = getFilteredEvents();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadEvents(true), loadInterestedEvents()]);
    setRefreshing(false);
  };

  return (
    <View style={styles.outerContainer}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <View style={styles.headerIcon} />
          <Text style={styles.headerTitle}>Your Events</Text>
          <View style={styles.headerIcon} />
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {["Hosted", "Going", "Interested", "Past"].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={styles.tab}
              onPress={() => {
                HapticsService.triggerImpactLight();
                setActiveTab(tab);
              }}
              onLayout={(e) => handleTabLayout(tab, e)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.activeTabText,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
          {/* Sliding indicator */}
          <Animated.View
            style={[
              styles.activeTabIndicator,
              {
                transform: [{ translateX: tabUnderlineX }],
                width: tabUnderlineScale,
              },
            ]}
          />
        </View>
      </SafeAreaView>

      {/* Events List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <SnooLoader size="large" color={PRIMARY_COLOR} />
        </View>
      ) : (
        <View
          style={{
            flex: 1,
          }}
        >
          <FlatList
            data={filteredEvents}
            keyExtractor={(item) => `${item._type || 'event'}-${item.id}`}
            renderItem={renderEvent}
            initialNumToRender={8}
            maxToRenderPerBatch={5}
            windowSize={5}
            removeClippedSubviews={Platform.OS === "android"}
            updateCellsBatchingPeriod={50}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={PRIMARY_COLOR}
                colors={[PRIMARY_COLOR]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                {activeTab === "Interested" ? (
                  <View style={styles.emptyContent}>
                    <View style={styles.emptyIconCircle}>
                      <Heart
                        size={32}
                        color={PRIMARY_COLOR}
                      />
                    </View>
                    <Text style={styles.emptyTitle}>No saved events or plans</Text>
                    <Text style={styles.emptyDescription}>
                      Save events and Open Plans you're interested in — they'll appear here.
                    </Text>
                    <TouchableOpacity
                      style={styles.emptyCTA}
                      onPress={() => navigation.navigate("DiscoverEvents")}
                    >
                      <Text style={styles.emptyCTAText}>Explore events</Text>
                    </TouchableOpacity>
                  </View>
                ) : activeTab === "Past" ? (
                  <View style={styles.emptyContent}>
                    <View style={styles.emptyIconCircle}>
                      <Calendar
                        size={32}
                        color={LIGHT_TEXT_COLOR}
                      />
                    </View>
                    <Text style={styles.emptyTitle}>
                      Your history starts here
                    </Text>
                    <Text style={styles.emptyDescription}>
                      Events you attend will show up here as memories.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.emptyContent}>
                    <Text style={styles.emptyDescription}>
                      You're not going to any events yet
                    </Text>
                  </View>
                )}
              </View>
            }
            contentContainerStyle={
              filteredEvents.length === 0
                ? { flexGrow: 1 }
                : { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 }
            }
          />
        </View>
      )}
      <CommentsModal
        visible={commentsModalState.visible}
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
            : commentsModalState.postType === "plan"
            ? null
            : "/comments"
        }
        onClose={closeCommentsModal}
        onCommentCountChange={(newCount) => {
          if (commentsModalState.postId) {
            if (commentsModalState.postType === "plan") {
              setHostedPlans((prev) =>
                prev.map((p) =>
                  p.id === commentsModalState.postId
                    ? { ...p, comment_count: newCount }
                    : p,
                ),
              );
              setInterestedPlans((prev) =>
                prev.map((p) =>
                  p.id === commentsModalState.postId
                    ? { ...p, comment_count: newCount }
                    : p,
                ),
              );
              setAttendingPlans((prev) =>
                prev.map((p) =>
                  p.id === commentsModalState.postId
                    ? { ...p, comment_count: newCount }
                    : p,
                ),
              );
            } else {
              setEvents((prev) =>
                prev.map((e) =>
                  e.id === commentsModalState.postId
                    ? { ...e, comment_count: newCount }
                    : e,
                ),
              );
              setInterestedEvents((prev) =>
                prev.map((e) =>
                  e.id === commentsModalState.postId
                    ? { ...e, comment_count: newCount }
                    : e,
                ),
              );
            }
          }
        }}
        navigation={navigation}
      />
      <ShareModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        post={sharingPlan}
      />

      <AttendanceConfirmationModal
        visible={attendanceModalVisible}
        eventTitle={selectedVerifyEvent?.title}
        onConfirmAttendance={handleConfirmAttendance}
        loading={attendanceConfirmLoading}
        onClose={() => {
          setAttendanceModalVisible(false);
          setSelectedVerifyEvent(null);
        }}
      />

      {/* Promote Plan Sheet — owner only, Poll + Q&A restricted */}
      <PromoteSheet
        visible={showPromoteSheet}
        onClose={() => {
          setShowPromoteSheet(false);
          setPromotingPlan(null);
        }}
        onSuccess={() => {
          setShowPromoteSheet(false);
          setPromotingPlan(null);
        }}
        sourceType="plan"
        sourceData={promotingPlan}
        allowedEngagementTypes={['poll', 'qna']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  safeArea: {
    backgroundColor: COLORS.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerIcon: {
    width: 48,
    height: 48,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: TEXT_COLOR,
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 8,
    position: "relative",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabText: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: LIGHT_TEXT_COLOR,
  },
  activeTabText: {
    color: PRIMARY_COLOR,
  },
  activeTabIndicator: {
    position: "absolute",
    bottom: 0,
    height: 2,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    backgroundColor: "transparent",
  },
  emptyContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 40,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: TEXT_COLOR,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: LIGHT_TEXT_COLOR,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyCTA: {
    marginTop: 24,
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyCTAText: {
    color: "#FFFFFF",
    fontFamily: FONTS.semiBold,
    fontSize: 15,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    textAlign: "center",
  },
});
