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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { apiGet } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { getInterestedEvents } from "../../api/events";
import { openMapsNavigation } from "../../utils/openMapsNavigation";
import EventBus from "../../utils/EventBus";
import { COLORS } from "../../constants/theme";
import { getGradientForName } from "../../utils/AvatarGenerator";

const PRIMARY_COLOR = "#007AFF"; // Vibrant Blue
const TEXT_COLOR = "#1D1D1F";
const LIGHT_TEXT_COLOR = "#8E8E93";
const PRICE_COLOR = "#16A34A"; // Green for price

// Helper function to extract place name from Google Maps URL
const getLocationNameFromUrl = (url) => {
  try {
    // Google Maps URLs have format: /place/Location+Name/data=...
    const match = url.match(/\/place\/([^\/]+)/);
    if (match) {
      return decodeURIComponent(match[1].replace(/\+/g, " "));
    }
    return "View Location";
  } catch {
    return "View Location";
  }
};

export default function YourEventsScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState("Going");
  const [events, setEvents] = useState([]);
  const [interestedEvents, setInterestedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
          prev.filter((e) => e.id !== payload.eventId)
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
          const eventDate = new Date(e.event_date);
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
          const eventDate = new Date(e.event_date);
          return (
            e.is_past ||
            (eventDate < now && e.registration_status === "attended")
          );
        });
      default:
        return [];
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
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
    return `${
      months[date.getMonth()]
    } ${date.getDate()}, ${date.getFullYear()}`;
  };

  // Format date for badge: "30 Dec"
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
    // Fallback to base_price on the event itself
    if (item.base_price && parseFloat(item.base_price) > 0) {
      return parseFloat(item.base_price);
    }
    // Check min_price field
    if (item.min_price && parseFloat(item.min_price) > 0) {
      return parseFloat(item.min_price);
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

  // Get location name from URL
  const getLocationDisplay = (item) => {
    if (item.event_type === "virtual") {
      return "Virtual Event";
    }
    if (item.location_url) {
      return getLocationNameFromUrl(item.location_url);
    }
    return "Location TBD";
  };

  const handleEventPress = (item) => {
    navigation.navigate("EventDetails", {
      eventId: item.id,
      eventData: item,
    });
  };

  const renderEvent = ({ item }) => {
    const displayImage =
      item.banner_carousel?.[0]?.image_url || item.banner_url;
    const lowestPrice = getLowestPrice(item);
    const isCancelled = item.is_cancelled;
    const locationDisplay = getLocationDisplay(item);

    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => handleEventPress(item)}
        activeOpacity={0.9}
      >
        {/* Left - Banner Image */}
        <View style={styles.eventImageContainer}>
          {displayImage ? (
            <Image
              source={{ uri: displayImage }}
              style={styles.eventImage}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={getGradientForName(item.title || "Event")}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.eventImage}
            />
          )}

          {/* Cancelled Overlay */}
          {isCancelled && (
            <View style={styles.cancelledOverlay}>
              <Text style={styles.cancelledText}>CANCELLED</Text>
            </View>
          )}
        </View>

        {/* Right - Event Info */}
        <View style={styles.eventInfo}>
          {/* Title */}
          <Text style={styles.eventTitle} numberOfLines={2}>
            {item.title}
          </Text>

          {/* Date & Time Row */}
          <View style={styles.dateTimeRow}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={LIGHT_TEXT_COLOR}
            />
            <Text style={styles.dateTimeText}>
              {formatDateBadge(item.event_date)} • {formatTime(item.event_date)}
            </Text>
          </View>

          {/* Location Row */}
          <View style={styles.eventMeta}>
            <Ionicons
              name={
                item.event_type === "virtual"
                  ? "videocam-outline"
                  : "location-outline"
              }
              size={14}
              color={LIGHT_TEXT_COLOR}
            />
            <Text style={styles.eventMetaText} numberOfLines={1}>
              {locationDisplay}
            </Text>
          </View>

          {/* Bottom Row: Attendees + Price */}
          <View style={styles.eventBottomRow}>
            <Text style={styles.attendeeText}>
              {item.attendee_count || 0} attendees
            </Text>

            {lowestPrice ? (
              <Text style={styles.priceText}>₹{lowestPrice} onwards</Text>
            ) : (
              <Text style={styles.freeText}>Free</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const filteredEvents = getFilteredEvents();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadEvents(true), loadInterestedEvents()]);
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Events</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {["Going", "Interested", "Past"].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={styles.tab}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.activeTabText,
              ]}
            >
              {tab}
            </Text>
            {activeTab === tab && (
              <LinearGradient
                colors={["#00C6FF", "#007AFF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.activeTabIndicator}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Events List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      ) : (
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
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>
                {activeTab === "Going" && "You're not going to any events"}
                {activeTab === "Interested" &&
                  "You haven't bookmarked any events yet"}
                {activeTab === "Past" && "You haven't attended any past events"}
              </Text>
            </View>
          }
          contentContainerStyle={
            filteredEvents.length === 0
              ? { flexGrow: 1 }
              : { paddingVertical: 12, paddingHorizontal: 16 }
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: TEXT_COLOR,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    position: "relative",
  },
  activeTabIndicator: {
    position: "absolute",
    bottom: 0,
    height: 3,
    width: "80%",
    borderRadius: 3,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "500",
    color: LIGHT_TEXT_COLOR,
  },
  activeTabText: {
    color: PRIMARY_COLOR,
    fontWeight: "600",
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
  // New Card Styles
  eventCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  eventImageContainer: {
    width: 130,
    height: 120,
    position: "relative",
  },
  eventImage: {
    width: "100%",
    height: "100%",
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  cancelledOverlay: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "#EF4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cancelledText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  eventInfo: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: 4,
    lineHeight: 20,
  },
  dateTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  dateTimeText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
  },
  eventMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
    flex: 1,
  },
  eventMetaText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    flex: 1,
  },
  eventBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  attendeeText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
  },
  priceText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#16A34A",
  },
  freeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#16A34A",
  },
});
