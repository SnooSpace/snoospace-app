import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { mockData } from "../../../data/mockData";
import CreateEventModal from "../../../components/modals/CreateEventModal";
import EditEventModal from "../../../components/modals/EditEventModal";
import ActionModal from "../../../components/modals/ActionModal";
import { COLORS, SHADOWS } from "../../../constants/theme";

const PRIMARY_COLOR = "#007AFF";
const TEXT_COLOR = "#1D1D1F";
const LIGHT_TEXT_COLOR = "#8E8E93";

export default function CommunityDashboardScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeTab, setActiveTab] = useState("upcoming"); // 'upcoming' or 'previous'
  const [metrics, setMetrics] = useState({
    totalMembers: 1250,
    eventsHosted: 15,
    collaborations: 3,
  });
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [previousEvents, setPreviousEvents] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    title: "",
    message: "",
    actions: [],
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      // Fetch real events from API
      const { getCommunityEvents } = await import("../../../api/events");
      const eventsData = await getCommunityEvents();

      if (eventsData?.events) {
        // Separate upcoming and past events
        const upcoming = eventsData.events.filter((event) => !event.is_past);
        const past = eventsData.events.filter((event) => event.is_past);

        setUpcomingEvents(upcoming);
        setPreviousEvents(past);

        // Update metrics
        setMetrics((prev) => ({
          ...prev,
          eventsHosted: eventsData.events.length,
        }));
      }
    } catch (error) {
      console.error("Error loading dashboard:", error);
      // Fallback to empty arrays on error
      setUpcomingEvents([]);
      setPreviousEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = () => {
    setShowCreateEventModal(true);
  };

  const handleEventCreated = (event) => {
    console.log("Event created:", event);
    // Refresh dashboard metrics and events list
    loadDashboard();
  };

  const handleCreatePost = () => {
    // Navigate to post creation screen with role param
    navigation.navigate("CommunityCreatePost", { role: "community" });
  };

  const handleViewEvent = (event) => {
    navigation.navigate("EventDetails", {
      eventId: event.id,
      eventData: event,
    });
  };

  const handleViewAllEvents = () => {
    // Map 'previous' to 'past' for CommunityEventsListScreen
    const tabToPass = activeTab === "previous" ? "past" : activeTab;
    navigation.navigate("CommunityEventsList", { initialTab: tabToPass });
  };

  const handleEditEvent = (event) => {
    console.log("[CommunityDashboard] Edit event clicked:", {
      id: event.id,
      title: event.title,
      has_highlights: !!event.highlights,
      highlights_count: event.highlights?.length || 0,
      has_featured: !!event.featured_accounts,
      featured_count: event.featured_accounts?.length || 0,
      has_things: !!event.things_to_know,
      things_count: event.things_to_know?.length || 0,
      has_gallery: !!event.gallery,
      gallery_count: event.gallery?.length || 0,
      all_keys: Object.keys(event),
    });
    setSelectedEvent(event);
    setShowEditEventModal(true);
  };

  const handleEventUpdated = (updatedEvent) => {
    // Refresh dashboard to show updated event
    loadDashboard();
  };

  const handleEventLongPress = (event) => {
    const canDelete =
      event.is_past || event.is_cancelled || event.current_attendees === 0;
    const canCancel = !event.is_past && !event.is_cancelled;

    const actions = [];

    // View Attendees option (always available)
    actions.push({
      text: `View Attendees (${event.current_attendees || 0})`,
      onPress: () => {
        setModalConfig((prev) => ({ ...prev, visible: false }));
        setTimeout(() => {
          navigation.navigate("EventAttendees", { event });
        }, 300);
      },
      style: "default",
    });

    // Scan Tickets option (only for upcoming non-cancelled events)
    if (!event.is_past && !event.is_cancelled) {
      actions.push({
        text: "Scan Tickets",
        onPress: () => {
          setModalConfig((prev) => ({ ...prev, visible: false }));
          setTimeout(() => {
            navigation.navigate("QRScanner", { event });
          }, 300);
        },
        style: "default",
        icon: "qr-code-outline",
      });
    }

    // Can cancel upcoming events that aren't already cancelled
    if (canCancel) {
      actions.push({
        text: "Cancel Event",
        onPress: () => {
          setModalConfig((prev) => ({ ...prev, visible: false }));
          setTimeout(() => confirmCancelEvent(event), 300);
        },
        style: "destructive",
      });
    }

    // Delete option
    actions.push({
      text: canDelete ? "Delete Event" : "Delete (after event ends)",
      onPress: () => {
        setModalConfig((prev) => ({ ...prev, visible: false }));
        setTimeout(() => {
          canDelete ? confirmDeleteEvent(event) : showDeleteRestriction(event);
        }, 300);
      },
      style: canDelete ? "destructive" : "default",
    });

    // Cancel button (dismiss modal)
    actions.push({
      text: "Cancel",
      style: "cancel",
      onPress: () => setModalConfig((prev) => ({ ...prev, visible: false })),
    });

    setModalConfig({
      visible: true,
      title: event.title,
      message: "Choose an action",
      actions: actions,
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
      message: `This event has ${event.current_attendees} registered attendees. You can only delete it after the event date has passed.`,
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
      const { cancelEvent } = await import("../../../api/events");
      const result = await cancelEvent(event.id);

      // Update local state to mark as cancelled
      const updateEvents = (events) =>
        events.map((e) =>
          e.id === event.id ? { ...e, is_cancelled: true } : e
        );
      setUpcomingEvents(updateEvents);
      setPreviousEvents(updateEvents);

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
      const { deleteEvent } = await import("../../../api/events");
      await deleteEvent(event.id);

      // Remove from local state
      setUpcomingEvents((prev) => prev.filter((e) => e.id !== event.id));
      setPreviousEvents((prev) => prev.filter((e) => e.id !== event.id));

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

  const renderEventCard = ({ item }) => (
    <View
      style={[styles.eventCard, item.is_cancelled && styles.cancelledEventCard]}
    >
      <TouchableOpacity
        onPress={() => handleViewEvent(item)}
        onLongPress={() => handleEventLongPress(item)}
        delayLongPress={400}
        disabled={actionLoading === item.id}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri:
                item.banner_url ||
                "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200",
            }}
            style={[
              styles.eventImage,
              (actionLoading === item.id || item.is_cancelled) && {
                opacity: 0.5,
              },
            ]}
          />
          {item.is_cancelled && (
            <View style={styles.cancelledBadge}>
              <Text style={styles.cancelledBadgeText}>CANCELLED</Text>
            </View>
          )}
          {actionLoading === item.id && (
            <View style={styles.cardLoadingOverlay}>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          )}
        </View>
      </TouchableOpacity>
      <View style={styles.eventInfo}>
        <Text
          style={[styles.eventTitle, item.is_cancelled && styles.cancelledText]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text style={styles.eventDate}>
          {new Date(item.event_date).toLocaleDateString()}
        </Text>
        <View style={styles.eventStatsRow}>
          <View style={styles.eventStats}>
            <Ionicons name="people" size={12} color={LIGHT_TEXT_COLOR} />
            <Text style={styles.eventAttendees}>
              {item.current_attendees || 0} attendees
            </Text>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => handleEditEvent(item)}
          >
            <Ionicons name="pencil" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 50 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionButtonContainer}
              onPress={handleCreateEvent}
            >
              <LinearGradient
                colors={["#FFFFFF", "#F0F8FF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardGradient}
              >
                <LinearGradient
                  colors={["#00C6FF", "#007AFF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionIconContainer}
                >
                  <Ionicons name="calendar" size={32} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.actionButtonText}>Create Event</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButtonContainer}
              onPress={handleCreatePost}
            >
              <LinearGradient
                colors={["#FFFFFF", "#F0F8FF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardGradient}
              >
                <LinearGradient
                  colors={["#00C6FF", "#007AFF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.actionIconContainer}
                >
                  <Ionicons name="add" size={32} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.actionButtonText}>Create Post</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Community Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Community Metrics</Text>
          <View style={styles.metricsContainer}>
            <View style={styles.metricCardContainer}>
              <LinearGradient
                colors={["#FFFFFF", "#F0F8FF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardGradient}
              >
                <Ionicons name="people" size={32} color={PRIMARY_COLOR} />
                <Text style={styles.metricNumber}>{metrics.totalMembers}</Text>
                <Text style={styles.metricLabel}>Total Members</Text>
              </LinearGradient>
            </View>

            <View style={styles.metricCardContainer}>
              <LinearGradient
                colors={["#FFFFFF", "#F0F8FF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardGradient}
              >
                <Ionicons name="calendar" size={32} color={PRIMARY_COLOR} />
                <Text style={styles.metricNumber}>{metrics.eventsHosted}</Text>
                <Text style={styles.metricLabel}>Events Hosted</Text>
              </LinearGradient>
            </View>

            <View style={styles.metricCardContainer}>
              <LinearGradient
                colors={["#FFFFFF", "#F0F8FF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardGradient}
              >
                <Ionicons name="handshake" size={32} color={PRIMARY_COLOR} />
                <Text style={styles.metricNumber}>
                  {metrics.collaborations}
                </Text>
                <Text style={styles.metricLabel}>Collaborations</Text>
              </LinearGradient>
            </View>
          </View>
        </View>

        {/* Events Section with Tabs */}
        <View style={styles.section}>
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
                Upcoming Events
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
              onPress={() => setActiveTab("previous")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "previous" && styles.activeTabText,
                ]}
              >
                Previous Events
              </Text>
              {activeTab === "previous" && (
                <LinearGradient
                  colors={["#00C6FF", "#007AFF"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.activeTabIndicator}
                />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.eventsHeader}>
            <Text style={styles.longPressHint}>
              *Long press event cards to view tickets sold, cancel events or
              delete events options
            </Text>
            <TouchableOpacity onPress={handleViewAllEvents}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={activeTab === "upcoming" ? upcomingEvents : previousEvents}
            renderItem={renderEventCard}
            keyExtractor={(item) => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.eventsList}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="calendar-outline"
                  size={40}
                  color={LIGHT_TEXT_COLOR}
                />
                <Text style={styles.emptyText}>
                  {activeTab === "upcoming"
                    ? "No upcoming events"
                    : "No previous events"}
                </Text>
              </View>
            )}
          />
        </View>
      </ScrollView>

      <CreateEventModal
        visible={showCreateEventModal}
        onClose={() => setShowCreateEventModal(false)}
        onEventCreated={handleEventCreated}
      />

      <EditEventModal
        visible={showEditEventModal}
        onClose={() => {
          setShowEditEventModal(false);
          setSelectedEvent(null);
        }}
        onEventUpdated={handleEventUpdated}
        eventData={selectedEvent}
      />

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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    marginTop: 10,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: TEXT_COLOR,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: TEXT_COLOR,
    marginBottom: 15,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 15,
  },
  actionButtonContainer: {
    flex: 1,
    borderRadius: 16,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    backgroundColor: "#fff", // needed for shadow on iOS sometimes
  },
  cardGradient: {
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 122, 255, 0.1)",
    width: "100%",
  },
  actionIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  metricsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 15,
  },
  metricCardContainer: {
    flex: 1,
    borderRadius: 16,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    backgroundColor: "#fff",
  },
  metricNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: PRIMARY_COLOR,
    marginTop: 10,
    marginBottom: 5,
  },
  metricLabel: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    textAlign: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    marginBottom: 15,
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
    fontSize: 16,
    fontWeight: "500",
    color: LIGHT_TEXT_COLOR,
  },
  activeTabText: {
    color: PRIMARY_COLOR,
    fontWeight: "bold",
  },
  eventsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: PRIMARY_COLOR,
  },
  eventsList: {
    paddingRight: 20,
  },
  eventCard: {
    width: 240, // Increased width for better presence
    marginRight: 15,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0, 122, 255, 0.1)", // Subtle blue border
    shadowColor: "#007AFF", // Blue tinted shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: "hidden",
  },
  eventImage: {
    width: "100%",
    height: 150, // Increased height
    backgroundColor: "#F8F5FF",
  },
  eventInfo: {
    padding: 12,
  },
  eventTitle: {
    fontSize: 15, // Slightly larger title
    fontWeight: "bold",
    color: TEXT_COLOR,
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 8,
  },
  eventStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  eventStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  editButton: {
    padding: 8,
    borderRadius: 20, // Circular
    backgroundColor: "#1D1D1F", // Solid Black
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  eventAttendees: {
    fontSize: 11,
    color: LIGHT_TEXT_COLOR,
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginTop: 10,
  },
  longPressHint: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    fontStyle: "italic",
  },
  cardLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageContainer: {
    position: "relative",
  },
  cancelledEventCard: {
    opacity: 0.8,
  },
  cancelledBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  cancelledBadgeText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
    letterSpacing: 2,
    textTransform: "uppercase",
    backgroundColor: "#FF3B30",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    overflow: "hidden",
  },
  cancelledText: {
    textDecorationLine: "line-through",
    color: "#999999",
  },
});
