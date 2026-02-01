import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
  Animated,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { apiGet } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { getInterestedEvents, toggleEventInterest } from "../../api/events";
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

const PRIMARY_COLOR = COLORS.primary;
const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;
const BORDER_COLOR = COLORS.border;

// Separate component for event card to use hooks for location resolution
const EventListCard = ({
  item,
  onPress,
  onRemoveInterest,
  getLowestPrice,
  formatDateBadge,
  formatTime,
  showRemoveButton,
  isPast,
}) => {
  const [isRemoving, setIsRemoving] = useState(false);
  const scale = React.useRef(new Animated.Value(1)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(10)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.98,
      speed: 50,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      speed: 50,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };
  const displayImage =
    item.banner_carousel?.[0]?.image_url || item.banner_url || item.image_url;
  const lowestPrice = getLowestPrice(item);
  const isCancelled = item.is_cancelled;
  const isGoing = item.registration_status === "registered";

  const locationName = useLocationName(
    item.event_type !== "virtual" ? item.location_url : null,
    {
      fallback: item.location_name || item.venue_name || "In-person",
    },
  );

  const locationDisplay =
    item.event_type === "virtual" ? "Virtual Event" : locationName;

  // Split date for the badge
  const dateObj = new Date(item.event_date || item.start_datetime);
  const monthNames = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  const month = monthNames[dateObj.getMonth()];
  const day = dateObj.getDate();

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => onPress(item)}
        style={cardStyles.eventCard}
      >
        <View style={cardStyles.bannerContainer}>
          {displayImage ? (
            <Image
              source={{ uri: displayImage }}
              style={cardStyles.bannerImage}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={getGradientForName(item.title || "Event")}
              style={cardStyles.bannerImage}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          )}

          {/* Subtle Dark Overlay for Past Events to denote "archival" without fogginess */}
          {isPast && <View style={cardStyles.pastOverlay} />}

          <View style={cardStyles.dateBadge}>
            <Text style={cardStyles.dateBadgeMonth}>{month}</Text>
            <Text style={cardStyles.dateBadgeDay}>{day}</Text>
          </View>

          {isGoing && !isPast && (
            <View style={cardStyles.statusPill}>
              <Text style={cardStyles.statusPillText}>GOING</Text>
            </View>
          )}

          {isCancelled && (
            <View style={cardStyles.cancelledOverlay}>
              <Text style={cardStyles.cancelledText}>CANCELLED</Text>
            </View>
          )}
        </View>

        <View style={cardStyles.contentContainer}>
          <Text
            style={[cardStyles.eventTitle, isPast && cardStyles.eventTitlePast]}
            numberOfLines={1}
          >
            {item.title}
          </Text>

          <View style={cardStyles.metaRow}>
            <Ionicons
              name="time-outline"
              size={14}
              color={isPast ? "#9CA3AF" : LIGHT_TEXT_COLOR}
            />
            <Text
              style={[cardStyles.metaText, isPast && cardStyles.metaTextPast]}
            >
              {formatDateBadge(item.event_date)} • {formatTime(item.event_date)}
            </Text>
          </View>

          <View style={cardStyles.metaRow}>
            <Ionicons
              name={
                item.event_type === "virtual"
                  ? "videocam-outline"
                  : "location-outline"
              }
              size={14}
              color={isPast ? "#9CA3AF" : LIGHT_TEXT_COLOR}
            />
            <Text
              style={[cardStyles.metaText, isPast && cardStyles.metaTextPast]}
              numberOfLines={1}
            >
              {locationDisplay}
            </Text>
          </View>

          <View style={cardStyles.footer}>
            <View style={cardStyles.attendeesContainer}>
              <View
                style={[cardStyles.avatarStack, isPast && { opacity: 0.6 }]}
              >
                <View
                  style={[
                    cardStyles.avatar,
                    { backgroundColor: "#E5E7EB", zIndex: 3 },
                  ]}
                />
                <View
                  style={[
                    cardStyles.avatar,
                    { backgroundColor: "#D1D5DB", marginLeft: -8, zIndex: 2 },
                  ]}
                />
                <View
                  style={[
                    cardStyles.avatar,
                    { backgroundColor: "#9CA3AF", marginLeft: -8, zIndex: 1 },
                  ]}
                />
              </View>
              <Text
                style={[
                  cardStyles.attendeeCount,
                  isPast && { color: "#9CA3AF" },
                ]}
              >
                +12
              </Text>
            </View>

            <View style={cardStyles.priceContainer}>
              {lowestPrice ? (
                <Text
                  style={[
                    cardStyles.priceText,
                    isPast && cardStyles.priceTextPast,
                  ]}
                >
                  ₹{lowestPrice}
                </Text>
              ) : (
                <Text
                  style={[
                    cardStyles.freeText,
                    isPast && cardStyles.freeTextPast,
                  ]}
                >
                  Free
                </Text>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
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
  const [activeTab, setActiveTab] = useState("Going");
  const [events, setEvents] = useState([]);
  const [interestedEvents, setInterestedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      const response = await apiGet("/events/my-events", 15000, token);
      const allEvents = response?.events || [];
      setEvents(allEvents);
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
    switch (activeTab) {
      case "Going":
        return events.filter((e) => {
          const eventDate = new Date(e.start_datetime || e.event_date);
          return (
            (e.registration_status === "registered" && eventDate >= now) ||
            (e.registration_status === "attended" && eventDate >= now)
          );
        });
      case "Interested":
        // Return bookmarked events that aren't past
        return interestedEvents.filter((e) => !e.is_past);
      case "Past":
        return events.filter((e) => {
          const eventDate = new Date(e.start_datetime || e.event_date);
          return (
            e.is_past ||
            (eventDate < now && e.registration_status === "attended")
          );
        });
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
    // For Going tab events (registered), go directly to ticket view
    if (activeTab === "Going" && item.registration_status === "registered") {
      navigation.navigate("TicketView", { eventId: item.id });
    } else {
      // For Interested/Past, go to event details
      navigation.navigate("EventDetails", {
        eventId: item.id,
        eventData: item,
        isRegistered: activeTab === "Going" || activeTab === "Past",
      });
    }
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

  const renderEvent = ({ item }) => (
    <EventListCard
      item={item}
      onPress={handleEventPress}
      onRemoveInterest={handleRemoveInterest}
      getLowestPrice={getLowestPrice}
      formatDateBadge={formatDateBadge}
      formatTime={formatTime}
      showRemoveButton={activeTab === "Interested"}
      isPast={activeTab === "Past"}
    />
  );

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
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerIcon}
          >
            <Ionicons name="chevron-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Events</Text>
          <View style={styles.headerIcon} />
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {["Going", "Interested", "Past"].map((tab) => (
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
                  activeTab === tab && { fontWeight: "700" },
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
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
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
            keyExtractor={(item) => String(item.id)}
            renderItem={renderEvent}
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
                      <Ionicons
                        name="heart-outline"
                        size={32}
                        color={PRIMARY_COLOR}
                      />
                    </View>
                    <Text style={styles.emptyTitle}>No saved events</Text>
                    <Text style={styles.emptyDescription}>
                      Keep track of events you're interested in by saving them.
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
                      <Ionicons
                        name="calendar-outline"
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
    width: 40,
    alignItems: "flex-start",
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
    fontFamily: FONTS.medium,
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
