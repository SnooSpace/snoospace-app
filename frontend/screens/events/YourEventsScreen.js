import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Image, Animated, Pressable, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Calendar, Heart, Bookmark } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { apiGet } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { getInterestedEvents, toggleEventInterest } from "../../api/events";
import { getHostedPlans, getAttendingPlans, getInterestedPlans, togglePlanInterest } from "../../api/plans";
import HapticsService from "../../services/HapticsService";
import EventBus from "../../utils/EventBus";
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
}) => {
  return (
    <EventCard
      event={item}
      onPress={onPress}
      onComment={onComment}
      style={{ marginBottom: 20 }}
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
  other:        '＋',
};

const HOSTED_STATUS_COLORS = {
  active:    { bg: '#E8F5E9', text: '#2E7D32' },
  closed:    { bg: '#F5F5F5', text: '#555555' },
  cancelled: { bg: '#FFEBEE', text: '#C62828' },
};

const HostedPlanRow = ({ item, onPress }) => {
  const actKey = HOSTED_ACTIVITY_COLORS[item.activity_type] ? item.activity_type : 'other';
  const actStyle = HOSTED_ACTIVITY_COLORS[actKey];
  const actLabel = item.activity_type === 'other'
    ? (item.custom_activity_label || 'Other')
    : item.activity_type.charAt(0).toUpperCase() + item.activity_type.slice(1);
  const stStyle = HOSTED_STATUS_COLORS[item.status] || HOSTED_STATUS_COLORS.active;
  const statusLabel = item.status.charAt(0).toUpperCase() + item.status.slice(1);
  const d = new Date(item.scheduled_at);
  const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

  const emoji = ACTIVITY_EMOJIS[item.activity_type] || ACTIVITY_EMOJIS.other;

  return (
    <TouchableOpacity style={hostedStyles.row} onPress={onPress} activeOpacity={0.85}>
      <View style={hostedStyles.rowLeft}>
        <View style={hostedStyles.pillRow}>
          <View style={[hostedStyles.pill, { backgroundColor: actStyle.bg }]}>
            <Text style={[hostedStyles.pillText, { color: actStyle.text }]}>{`${emoji} ${actLabel}`}</Text>
          </View>
          <View style={[hostedStyles.pill, { backgroundColor: stStyle.bg }]}>
            <Text style={[hostedStyles.pillText, { color: stStyle.text }]}>{statusLabel}</Text>
          </View>
        </View>
        <Text style={hostedStyles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={hostedStyles.meta}>{dateStr}{item.location_public ? ` · ${item.location_public}` : ''}</Text>
      </View>
      <View style={hostedStyles.rowRight}>
        <Text style={hostedStyles.accepted}>{item.accepted_count ?? 0}/{item.max_accepted} accepted</Text>
        {(item.pending_count ?? 0) > 0 && (
          <Text style={hostedStyles.pending}>{item.pending_count} pending</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const hostedStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 14,
    marginBottom: 10, ...SHADOWS.md, shadowOpacity: 0.04,
  },
  rowLeft: { flex: 1, gap: 4 },
  rowRight: { alignItems: 'flex-end', gap: 4, marginLeft: 8 },
  pillRow: { flexDirection: 'row', gap: 6, marginBottom: 2 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontFamily: FONTS.medium, fontSize: 11 },
  title: { fontFamily: FONTS.semiBold, fontSize: 15, color: COLORS.textPrimary },
  meta: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary },
  accepted: { fontFamily: FONTS.semiBold, fontSize: 13, color: COLORS.primary },
  pending: { fontFamily: FONTS.medium, fontSize: 12, color: '#E65100' },
});

// ─── AttendingPlanCard ────────────────────────────────────────────────────────
const FULL_ACTIVITY_COLORS = {
  sports:       { bg: '#FFF3E0', text: '#E65100' },
  movies:       { bg: '#F3E5F5', text: '#6A1B9A' },
  bar:          { bg: '#E8EAF6', text: '#303F9F' },
  food:         { bg: '#FFF8E1', text: '#F57F17' },
  cafe:         { bg: '#EFEBE9', text: '#4E342E' },
  yoga:         { bg: '#E8F5E9', text: '#2E7D32' },
  gym:          { bg: '#FCE4EC', text: '#880E4F' },
  walk:         { bg: '#E0F2F1', text: '#00695C' },
  rides:        { bg: '#E3F2FD', text: '#1565C0' },
  live_music:   { bg: '#FCE4EC', text: '#C62828' },
  study:        { bg: '#EDE7F6', text: '#4527A0' },
  creative:     { bg: '#FFF9C4', text: '#F57F17' },
  games:        { bg: '#E1F5FE', text: '#01579B' },
  gaming:       { bg: '#E1F5FE', text: '#01579B' },
  pet_friendly: { bg: '#F1F8E9', text: '#33691E' },
  hangout:      { bg: '#E8F5E9', text: '#1B5E20' },
  other:        { bg: '#F5F5F5', text: '#424242' },
};

const AttendingPlanCard = ({ item, onPress, onToggleInterest, isInterested }) => {
  const actKey = FULL_ACTIVITY_COLORS[item.activity_type] ? item.activity_type : 'other';
  const actStyle = FULL_ACTIVITY_COLORS[actKey];
  const emoji = ACTIVITY_EMOJIS[item.activity_type] || ACTIVITY_EMOJIS.other;
  const actLabel = item.activity_type === 'other'
    ? (item.custom_activity_label || 'Other')
    : item.activity_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const d = new Date(item.scheduled_at);
  const isPast = d < new Date();
  const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

  const hostName = item.host_profile?.name || item.host_name || 'Host';

  const getCostLabel = () => {
    if (item.cost_type === 'free') return 'Free';
    if (item.cost_type === 'self_pay') return 'Self-pay';
    if (item.cost_type === 'split') return item.cost_amount_paise ? `~₹${Math.round(item.cost_amount_paise / 100)} split` : 'Split';
    if (item.cost_type === 'entry_fee') return item.cost_amount_paise ? `₹${Math.round(item.cost_amount_paise / 100)}` : 'Entry fee';
    return null;
  };
  const costLabel = getCostLabel();

  return (
    <TouchableOpacity style={planCardStyles.card} onPress={() => onPress(item)} activeOpacity={0.88}>
      <View style={planCardStyles.cardTop}>
        <View style={planCardStyles.pillRow}>
          <View style={[planCardStyles.pill, { backgroundColor: actStyle.bg }]}>
            <Text style={[planCardStyles.pillText, { color: actStyle.text }]}>{`${emoji} ${actLabel}`}</Text>
          </View>
          {isPast && (
            <View style={[planCardStyles.pill, { backgroundColor: '#F5F5F5' }]}>
              <Text style={[planCardStyles.pillText, { color: '#616161' }]}>Past</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => onToggleInterest(item)} hitSlop={10} style={planCardStyles.bookmarkBtn}>
          <Bookmark
            size={18}
            color={isInterested ? COLORS.primary : COLORS.textMuted}
            fill={isInterested ? COLORS.primary : 'transparent'}
            strokeWidth={2}
          />
        </TouchableOpacity>
      </View>
      <Text style={planCardStyles.title} numberOfLines={2}>{item.title}</Text>
      <Text style={planCardStyles.meta}>{dateStr}{item.location_public ? ` · ${item.location_public}` : ''}</Text>
      <View style={planCardStyles.footer}>
        <Text style={planCardStyles.host}>Hosted by <Text style={planCardStyles.hostName}>{hostName}</Text></Text>
        {costLabel ? <Text style={planCardStyles.cost}>{costLabel}</Text> : null}
      </View>
    </TouchableOpacity>
  );
};

const planCardStyles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 14,
    marginBottom: 12, ...SHADOWS.md, shadowOpacity: 0.05,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  pillRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontFamily: FONTS.medium, fontSize: 11 },
  bookmarkBtn: { padding: 4, marginLeft: 8 },
  title: { fontFamily: FONTS.semiBold, fontSize: 15, color: COLORS.textPrimary, marginBottom: 4 },
  meta: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  host: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textMuted, flex: 1 },
  hostName: { fontFamily: FONTS.medium, color: COLORS.textSecondary },
  cost: { fontFamily: FONTS.semiBold, fontSize: 13, color: COLORS.textPrimary },
});

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

  // Tab underline animation
  const tabUnderlineX = React.useRef(new Animated.Value(0)).current;
  const tabUnderlineScale = React.useRef(new Animated.Value(0)).current;

  // List transition animation
  const listOpacity = React.useRef(new Animated.Value(0)).current;
  const listTranslateY = React.useRef(new Animated.Value(10)).current;

  const tabWidths = React.useRef({}).current;
  const tabOffsets = React.useRef({}).current;

  useEffect(() => {
    // Initial reveal of list
    if (!loading) {
      Animated.parallel([
        Animated.timing(listOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(listTranslateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading]);

  useEffect(() => {
    // Trigger transition animation on tab change
    listOpacity.setValue(0);
    listTranslateY.setValue(10);
    Animated.parallel([
      Animated.timing(listOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(listTranslateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

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
      setHostedPlans(hostedData.plans || []);
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
    loadEvents();
    loadInterestedEvents();

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

  const renderEvent = useCallback(({ item }) => {
    if (activeTab === "Hosted") {
      return <HostedPlanRow item={item} onPress={() => navigation.navigate("HostRequests", { planId: item.id, planTitle: item.title })} />;
    }
    if (item._type === 'plan') {
      const isPlanInterested = interestedPlans.some(p => p.id === item.id);
      return (
        <AttendingPlanCard
          item={item}
          isInterested={item.is_interested || isPlanInterested}
          onPress={(plan) => navigation.navigate('PlanDetail', { planId: plan.id })}
          onToggleInterest={handleTogglePlanInterest}
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
      />
    );
  }, [handleEventPress, handleRemoveInterest, handleTogglePlanInterest, interestedPlans, activeTab, navigation, openCommentsModal]);

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
        <Animated.View
          style={{
            flex: 1,
            opacity: listOpacity,
            transform: [{ translateY: listTranslateY }],
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
        </Animated.View>
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
        }}
        navigation={navigation}
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
