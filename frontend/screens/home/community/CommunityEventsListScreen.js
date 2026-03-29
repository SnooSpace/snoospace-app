import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Image, RefreshControl, Alert, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, MapPin, CalendarDays, MoreHorizontal, Ticket, Edit2, FileText, Trash2, PauseCircle } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SHADOWS } from "../../../constants/theme";
import {
  getCommunityEvents,
  deleteEvent,
  cancelEvent,
} from "../../../api/events";
import ActionModal from "../../../components/modals/ActionModal";
import EditEventModal from "../../../components/modals/EditEventModal";
import SnooLoader from "../../../components/ui/SnooLoader";

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
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    title: "",
    message: "",
    actions: [],
  });

  // Tab underline animation
  const tabUnderlineX = useRef(new Animated.Value(0)).current;
  const tabUnderlineScale = useRef(new Animated.Value(0)).current;
  const tabWidths = useRef({}).current;
  const tabOffsets = useRef({}).current;

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
    const attendeeCount = parseInt(event.current_attendees || 0, 10);

    // Edit — only for upcoming (non-past) events
    if (!event.is_past) {
      options.push({
        text: "Edit Event",
        icon: <Edit2 size={24} strokeWidth={2} />,
        onPress: () => {
          setModalConfig((prev) => ({ ...prev, visible: false }));
          setTimeout(() => {
            setSelectedEvent(event);
            setShowEditEventModal(true);
          }, 300);
        },
        style: "primary",
      });
    }

    // View Details — always available
    options.push({
      text: "View Details",
      icon: <FileText size={24} strokeWidth={2} />,
      onPress: () => {
        setModalConfig((prev) => ({ ...prev, visible: false }));
        setTimeout(() => {
          navigation.navigate("EventAttendees", { event });
        }, 300);
      },
      style: "secondary",
    });

    // --- Delete / Cancel logic ---
    if (event.is_past) {
      // Past events: always allow delete
      options.push({
        text: "Delete Event",
        icon: <Trash2 size={24} strokeWidth={2} />,
        onPress: () => {
          setModalConfig((prev) => ({ ...prev, visible: false }));
          setTimeout(() => {
            setModalConfig({
              visible: true,
              title: "Delete Event",
              message: `Are you sure you want to permanently delete "${event.title}"? This cannot be undone.`,
              actions: [
                {
                  text: "Yes, Delete",
                  style: "destructive",
                  onPress: async () => {
                    setModalConfig((prev) => ({ ...prev, visible: false }));
                    try {
                      setActionLoading(event.id);
                      await deleteEvent(event.id);
                      loadEvents();
                    } catch (err) {
                      Alert.alert(
                        "Error",
                        "Failed to delete event. Please try again.",
                      );
                    } finally {
                      setActionLoading(null);
                    }
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
          }, 300);
        },
        style: "destructive",
      });
    } else if (!event.is_cancelled) {
      // Upcoming, non-cancelled events
      if (attendeeCount === 0) {
        // No attendees: allow both cancel and delete
        options.push({
          text: "Cancel Event",
          icon: <PauseCircle size={24} strokeWidth={2} />,
          onPress: () => {
            setModalConfig((prev) => ({ ...prev, visible: false }));
            setTimeout(() => {
              setModalConfig({
                visible: true,
                title: "Cancel Event",
                message: `Are you sure you want to cancel "${event.title}"? All registered attendees will be notified.`,
                actions: [
                  {
                    text: "Yes, Cancel Event",
                    style: "warning",
                    onPress: async () => {
                      setModalConfig((prev) => ({ ...prev, visible: false }));
                      try {
                        setActionLoading(event.id);
                        await cancelEvent(event.id);
                        loadEvents();
                      } catch (err) {
                        Alert.alert(
                          "Error",
                          "Failed to cancel event. Please try again.",
                        );
                      } finally {
                        setActionLoading(null);
                      }
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
            }, 300);
          },
          style: "warning",
        });

        options.push({
          text: "Delete Event",
          icon: <Trash2 size={24} strokeWidth={2} />,
          onPress: () => {
            setModalConfig((prev) => ({ ...prev, visible: false }));
            setTimeout(() => {
              setModalConfig({
                visible: true,
                title: "Delete Event",
                message: `Are you sure you want to permanently delete "${event.title}"? This cannot be undone.`,
                actions: [
                  {
                    text: "Yes, Delete",
                    style: "destructive",
                    onPress: async () => {
                      setModalConfig((prev) => ({ ...prev, visible: false }));
                      try {
                        setActionLoading(event.id);
                        await deleteEvent(event.id);
                        loadEvents();
                      } catch (err) {
                        Alert.alert(
                          "Error",
                          "Failed to delete event. Please try again.",
                        );
                      } finally {
                        setActionLoading(null);
                      }
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
            }, 300);
          },
          style: "destructive",
        });
      } else {
        // Has attendees: cancel only — cannot delete
        options.push({
          text: "Cancel Event",
          icon: <PauseCircle size={24} strokeWidth={2} />,
          onPress: () => {
            setModalConfig((prev) => ({ ...prev, visible: false }));
            setTimeout(() => {
              setModalConfig({
                visible: true,
                title: "Cancel Event",
                message: `"${event.title}" has ${attendeeCount} registered attendee${attendeeCount !== 1 ? "s" : ""}. Cancelling will notify all of them. Do you want to proceed?`,
                actions: [
                  {
                    text: "Yes, Cancel Event",
                    style: "warning",
                    onPress: async () => {
                      setModalConfig((prev) => ({ ...prev, visible: false }));
                      try {
                        setActionLoading(event.id);
                        await cancelEvent(event.id);
                        loadEvents();
                      } catch (err) {
                        Alert.alert(
                          "Error",
                          "Failed to cancel event. Please try again.",
                        );
                      } finally {
                        setActionLoading(null);
                      }
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
            }, 300);
          },
          style: "warning",
        });
      }
    } else {
      // Event is cancelled — only allow delete
      options.push({
        text: "Delete Event",
        icon: <Trash2 size={24} strokeWidth={2} />,
        onPress: () => {
          setModalConfig((prev) => ({ ...prev, visible: false }));
          setTimeout(() => {
            setModalConfig({
              visible: true,
              title: "Delete Event",
              message: `Are you sure you want to permanently delete "${event.title}"? This cannot be undone.`,
              actions: [
                {
                  text: "Yes, Delete",
                  style: "destructive",
                  onPress: async () => {
                    setModalConfig((prev) => ({ ...prev, visible: false }));
                    try {
                      setActionLoading(event.id);
                      await deleteEvent(event.id);
                      loadEvents();
                    } catch (err) {
                      Alert.alert(
                        "Error",
                        "Failed to delete event. Please try again.",
                      );
                    } finally {
                      setActionLoading(null);
                    }
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
          }, 300);
        },
        style: "destructive",
      });
    }

    setModalConfig({
      visible: true,
      title: event.title,
      message: "Choose an action",
      actions: options,
    });
  };

  // Helper for Date Formatting
  const formatEventDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    let dateLabel = date
      .toLocaleDateString(undefined, { month: "short", day: "numeric" })
      .toUpperCase();
    let isSpecial = false;

    if (isToday) {
      dateLabel = "TODAY";
      isSpecial = true;
    } else if (isTomorrow) {
      dateLabel = "TOMORROW";
      isSpecial = true;
    }

    const timeLabel = date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });

    return { dateLabel, timeLabel, isSpecial };
  };

  const renderEventItem = ({ item }) => {
    const { dateLabel, timeLabel, isSpecial } = formatEventDate(
      item.event_date,
    );

    // Compute real sold / capacity from ticket_types returned by the API
    const tickets = item.ticket_types || [];
    const ticketsSold =
      tickets.length > 0
        ? tickets.reduce((sum, t) => sum + (t.sold_count || 0), 0)
        : parseInt(item.current_attendees || 0, 10);
    const rawCapacity = tickets.reduce(
      (sum, t) => (t.total_quantity != null ? sum + t.total_quantity : sum),
      0,
    );
    // rawCapacity is 0 if all tickets are unlimited — fall back to max_attendees
    const ticketCapacity =
      rawCapacity > 0
        ? rawCapacity
        : parseInt(item.max_attendees || 0, 10) || null;

    return (
      <TouchableOpacity
        style={[styles.ticketCard, item.is_cancelled && styles.cancelledEventCard]}
        onPress={() => handleEventPress(item)}
        onLongPress={() => handleEventLongPress(item)}
        activeOpacity={0.8}
        disabled={actionLoading === item.id}
      >
        {actionLoading === item.id && (
          <View style={styles.loadingOverlay}>
            <SnooLoader size="small" color="#FFFFFF" />
          </View>
        )}
        <View style={{ position: "relative" }}>
          <Image
            source={{
              uri:
                item.banner_url ||
                "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200",
            }}
            style={styles.ticketImage}
          />
          {item.is_cancelled && (
            <View style={styles.cancelledBadge}>
              <Text style={styles.cancelledBadgeText}>CANCELLED</Text>
            </View>
          )}
        </View>

        <View style={styles.ticketContent}>
          <View style={styles.ticketTextSection}>
            <View style={styles.ticketHeaderRow}>
              <View
                style={[
                  styles.ticketDatePill,
                  isSpecial && styles.ticketDatePillSpecial,
                ]}
              >
                <Text
                  style={[
                    styles.ticketDateText,
                    isSpecial && styles.ticketDateTextSpecial,
                  ]}
                >
                  {dateLabel}
                </Text>
              </View>
              <Text style={styles.ticketTimeText}>{timeLabel}</Text>
            </View>

            <Text style={styles.ticketTitle} numberOfLines={2}>
              {item.title}
            </Text>

            <View style={styles.ticketFooterRow}>
              <Ticket
                size={14}
                color="#6B7280"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.ticketMetricText}>
                {ticketCapacity != null
                  ? `${ticketsSold}/${ticketCapacity} sold`
                  : `${ticketsSold} sold`}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.ticketMenuButton}
            onPress={() => handleEventLongPress(item)}
          >
            <MoreHorizontal size={22} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color={TEXT_COLOR} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Events</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {["upcoming", "past"].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={styles.tabItem}
            onPress={() => setActiveTab(tab)}
            onLayout={(e) => handleTabLayout(tab, e)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
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

      {/* Content */}
      <View style={styles.contentContainer}>
        {loading ? (
          <View style={styles.centerContainer}>
            <SnooLoader size="large" color={PRIMARY_COLOR} />
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
                <CalendarDays size={64} color="#E5E5EA" strokeWidth={1.5} />
                <Text style={styles.emptyText}>No {activeTab} events found</Text>
              </View>
            }
          />
        )}
      </View>
      <ActionModal
        visible={modalConfig.visible}
        title={modalConfig.title}
        message={modalConfig.message}
        actions={modalConfig.actions}
        onClose={() => setModalConfig((prev) => ({ ...prev, visible: false }))}
      />
      <EditEventModal
        visible={showEditEventModal}
        onClose={() => {
          setShowEditEventModal(false);
          setSelectedEvent(null);
        }}
        onEventUpdated={loadEvents}
        eventData={selectedEvent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF", // White background to extend behind status bar
  },
  contentContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB", // Light gray background for inner content
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
    fontSize: 20,
    fontFamily: "BasicCommercial-Black",
    color: TEXT_COLOR,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
    backgroundColor: "#FFFFFF",
    position: "relative",
  },
  tabItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  tabText: {
    fontSize: 15,
    fontFamily: "Manrope-Medium",
    color: LIGHT_TEXT_COLOR,
  },
  tabTextActive: {
    color: PRIMARY_COLOR,
    fontFamily: "Manrope-SemiBold",
  },
  activeTabIndicator: {
    position: "absolute",
    bottom: 0,
    height: 2,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100, // Account for bottom tab bar
    gap: 16,
  },
  ticketCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    alignItems: "center",
    height: 128,
  },
  ticketImage: {
    width: 88,
    height: 88,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
  },
  ticketContent: {
    flex: 1,
    marginLeft: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ticketTextSection: {
    flex: 1,
    height: "100%",
    justifyContent: "space-between",
    marginRight: 8,
  },
  ticketHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ticketDatePill: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ticketDatePillSpecial: {
    backgroundColor: "#EDE7F6",
  },
  ticketDateText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 10,
    color: "#6B7280",
  },
  ticketDateTextSpecial: {
    color: PRIMARY_COLOR,
  },
  ticketTimeText: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: "#9CA3AF",
  },
  ticketTitle: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 16,
    color: TEXT_COLOR,
    lineHeight: 20,
  },
  ticketFooterRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ticketMetricText: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: "#6B7280",
  },
  ticketMenuButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F8FA",
    borderRadius: 12,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    fontFamily: "Manrope-Medium",
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
    borderRadius: 16,
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
