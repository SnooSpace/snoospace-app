import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SHADOWS } from "../../../constants/theme";
import {
  getCommunityEvents,
  deleteEvent,
  cancelEvent,
} from "../../../api/events";
import ActionModal from "../../../components/modals/ActionModal";

const PRIMARY_COLOR = "#007AFF";
const TEXT_COLOR = "#1D1D1F";
const LIGHT_TEXT_COLOR = "#8E8E93";

export default function CommunityEventsListScreen({ navigation, route }) {
  const initialTab = route.params?.initialTab || "upcoming";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [pastEvents, setPastEvents] = useState([]);
  const [actionLoading, setActionLoading] = useState(null); // eventId of event being acted on
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    title: "",
    message: "",
    actions: [],
  });

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      if (!refreshing) setLoading(true);
      const data = await getCommunityEvents();
      if (data?.events) {
        const upcoming = data.events.filter((e) => !e.is_past);
        const past = data.events.filter((e) => e.is_past);
        setUpcomingEvents(upcoming);
        setPastEvents(past);
      }
    } catch (error) {
      console.error("Error loading events:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  const handleEventPress = (event) => {
    navigation.navigate("EventDetails", {
      eventId: event.id,
      eventData: event,
    });
  };

  const handleEventLongPress = (event) => {
    const options = [];

    // Can cancel upcoming events that aren't already cancelled
    if (!event.is_past && !event.is_cancelled) {
      options.push({
        text: "Cancel Event",
        onPress: () => {
          setModalConfig((prev) => ({ ...prev, visible: false }));
          setTimeout(() => confirmCancelEvent(event), 300);
        },
        style: "destructive",
      });
    }

    // Can delete past events, or upcoming events without attendees, or cancelled events
    const canDelete =
      event.is_past ||
      event.is_cancelled ||
      parseInt(event.current_attendees || 0, 10) === 0;
    options.push({
      text: canDelete ? "Delete Event" : "Delete (after event ends)",
      onPress: () => {
        setModalConfig((prev) => ({ ...prev, visible: false }));
        setTimeout(() => {
          canDelete ? confirmDeleteEvent(event) : showDeleteRestriction(event);
        }, 300);
      },
      style: canDelete ? "destructive" : "default",
    });

    options.push({
      text: "Cancel",
      style: "cancel",
      onPress: () => setModalConfig((prev) => ({ ...prev, visible: false })),
    });

    setModalConfig({
      visible: true,
      title: event.title,
      message: "Choose an action",
      actions: options,
    });
  };

  const confirmCancelEvent = (event) => {
    setModalConfig({
      visible: true,
      title: "Cancel Event",
      message: `Are you sure you want to cancel "${event.title}"? All registered attendees will be notified.`,
      actions: [
        {
          text: "Yes, Cancel Event",
          style: "destructive",
          onPress: () => {
            setModalConfig((prev) => ({ ...prev, visible: false }));
            handleCancelEvent(event);
          },
        },
        {
          text: "No",
          style: "cancel",
          onPress: () =>
            setModalConfig((prev) => ({ ...prev, visible: false })),
        },
      ],
    });
  };

  const confirmDeleteEvent = (event) => {
    setModalConfig({
      visible: true,
      title: "Delete Event",
      message: `Are you sure you want to permanently delete "${event.title}"? This cannot be undone.`,
      actions: [
        {
          text: "Yes, Delete",
          style: "destructive",
          onPress: () => {
            setModalConfig((prev) => ({ ...prev, visible: false }));
            handleDeleteEvent(event);
          },
        },
        {
          text: "No",
          style: "cancel",
          onPress: () =>
            setModalConfig((prev) => ({ ...prev, visible: false })),
        },
      ],
    });
  };

  const showDeleteRestriction = (event) => {
    setModalConfig({
      visible: true,
      title: "Cannot Delete Yet",
      message: `This event has ${event.current_attendees} registered attendees. You can only delete it after the event date has passed, or cancel it first.`,
      actions: [
        {
          text: "OK",
          style: "cancel",
          onPress: () =>
            setModalConfig((prev) => ({ ...prev, visible: false })),
        },
      ],
    });
  };

  const handleCancelEvent = async (event) => {
    try {
      setActionLoading(event.id);
      const result = await cancelEvent(event.id);

      // Update local state
      const updateEvents = (events) =>
        events.map((e) =>
          e.id === event.id ? { ...e, is_cancelled: true } : e
        );
      setUpcomingEvents(updateEvents);
      setPastEvents(updateEvents);

      setTimeout(() => {
        setModalConfig({
          visible: true,
          title: "Event Cancelled",
          message: `"${event.title}" has been cancelled. ${
            result.notified_attendees || 0
          } attendees have been notified.`,
          actions: [
            {
              text: "OK",
              style: "cancel",
              onPress: () =>
                setModalConfig((prev) => ({ ...prev, visible: false })),
            },
          ],
        });
      }, 100);
    } catch (error) {
      console.error("Error cancelling event:", error);
      setTimeout(() => {
        setModalConfig({
          visible: true,
          title: "Error",
          message: error.message || "Failed to cancel event",
          actions: [
            {
              text: "OK",
              style: "cancel",
              onPress: () =>
                setModalConfig((prev) => ({ ...prev, visible: false })),
            },
          ],
        });
      }, 100);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteEvent = async (event) => {
    try {
      setActionLoading(event.id);
      await deleteEvent(event.id);

      // Remove from local state
      setUpcomingEvents((prev) => prev.filter((e) => e.id !== event.id));
      setPastEvents((prev) => prev.filter((e) => e.id !== event.id));

      setTimeout(() => {
        setModalConfig({
          visible: true,
          title: "Event Deleted",
          message: `"${event.title}" has been permanently deleted.`,
          actions: [
            {
              text: "OK",
              style: "cancel",
              onPress: () =>
                setModalConfig((prev) => ({ ...prev, visible: false })),
            },
          ],
        });
      }, 100);
    } catch (error) {
      console.error("Error deleting event:", error);
      setTimeout(() => {
        setModalConfig({
          visible: true,
          title: "Error",
          message: error.message || "Failed to delete event",
          actions: [
            {
              text: "OK",
              style: "cancel",
              onPress: () =>
                setModalConfig((prev) => ({ ...prev, visible: false })),
            },
          ],
        });
      }, 100);
    } finally {
      setActionLoading(null);
    }
  };

  const renderEventItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.eventCard, item.is_cancelled && styles.cancelledEventCard]}
      onPress={() => handleEventPress(item)}
      onLongPress={() => handleEventLongPress(item)}
      activeOpacity={0.7}
      disabled={actionLoading === item.id}
    >
      {actionLoading === item.id && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      )}
      <View style={styles.eventImageContainer}>
        <Image
          source={{
            uri:
              item.banner_url ||
              "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200",
          }}
          style={styles.eventImage}
        />
        <View style={styles.dateBadge}>
          <Text style={styles.dateBadgeText}>
            {new Date(item.event_date).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
            })}
          </Text>
        </View>
        {item.is_cancelled && (
          <View style={styles.cancelledBadge}>
            <Text style={styles.cancelledBadgeText}>CANCELLED</Text>
          </View>
        )}
      </View>

      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.eventMeta}>
          <Ionicons
            name="location-outline"
            size={14}
            color={LIGHT_TEXT_COLOR}
          />
          <Text style={styles.eventMetaText} numberOfLines={1}>
            {item.event_type === "virtual" ? "Virtual Event" : "In-person"}
          </Text>
        </View>
        <View style={styles.eventFooter}>
          <Text style={styles.attendeesText}>
            {item.current_attendees || 0} attendees
          </Text>
          <Text style={styles.priceText}>
            {(() => {
              if (!item.ticket_types?.length) return "Free";
              const prices = item.ticket_types
                .map((t) => parseFloat(t.base_price || t.price || 0))
                .filter((p) => !isNaN(p));
              if (prices.length === 0) return "Free";
              const minPrice = Math.min(...prices);
              return minPrice > 0 ? `₹${minPrice} onwards` : "Free";
            })()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Events</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab("upcoming")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "upcoming" && styles.activeTabText,
            ]}
          >
            Upcoming
          </Text>
          {activeTab === "upcoming" && (
            <LinearGradient
              colors={["#00C6FF", "#007AFF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.activeTabIndicator}
            />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab("past")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "past" && styles.activeTabText,
            ]}
          >
            Past
          </Text>
          {activeTab === "past" && (
            <LinearGradient
              colors={["#00C6FF", "#007AFF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.activeTabIndicator}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      ) : (
        <FlatList
          data={activeTab === "upcoming" ? upcomingEvents : pastEvents}
          renderItem={renderEventItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PRIMARY_COLOR}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={64} color="#E5E5EA" />
              <Text style={styles.emptyText}>No {activeTab} events found</Text>
            </View>
          }
        />
      )}
      <ActionModal
        visible={modalConfig.visible}
        title={modalConfig.title}
        message={modalConfig.message}
        actions={modalConfig.actions}
        onClose={() => setModalConfig((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB", // Light gray background
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_COLOR,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingHorizontal: 16,
    // Removed border bottom line per user request
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
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
    fontWeight: "600",
    color: LIGHT_TEXT_COLOR,
  },
  activeTabText: {
    color: PRIMARY_COLOR,
  },
  listContent: {
    padding: 16,
    gap: 16,
  },
  eventCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    ...SHADOWS.sm, // Using theme shadow
  },
  eventImageContainer: {
    width: 110,
    height: 110,
    position: "relative",
  },
  eventImage: {
    width: "100%",
    height: "100%",
  },
  dateBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dateBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: TEXT_COLOR,
  },
  eventInfo: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_COLOR,
    lineHeight: 22,
    marginBottom: 4,
  },
  eventMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  eventMetaText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
  },
  eventFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "auto",
  },
  attendeesText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    fontWeight: "500",
  },
  priceText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#34C759", // Green shade for price
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    fontWeight: "500",
  },
  cancelledEventCard: {
    opacity: 0.7,
    borderColor: "#FF3B30",
  },
  cancelledBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 59, 48, 0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  cancelledBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    borderRadius: 16,
  },
});
