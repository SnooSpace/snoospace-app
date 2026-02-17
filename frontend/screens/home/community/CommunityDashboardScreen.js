import React, { useState, useEffect, useRef } from "react";
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
  Animated,
  Dimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  Ticket,
  MoreHorizontal,
  TrendingUp,
  UserPlus,
  Scan,
  Plus,
  CircleCheck,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Svg, {
  Path,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from "react-native-svg";

import CreateEventModal from "../../../components/modals/CreateEventModal";
import EditEventModal from "../../../components/modals/EditEventModal";
import ActionModal from "../../../components/modals/ActionModal";

import { COLORS, SHADOWS, FONTS } from "../../../constants/theme";

// --- Design Tokens (Founder Dashboard) ---
const DASHBOARD_TOKENS = {
  sectionSpacing: 32,
  cardRadius: 24,
  background: "#F9F9F9", // Slightly warmer/cleaner background
  surface: "#FFFFFF",
  dominantShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  minimalShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
};

const SCREEN_WIDTH = Dimensions.get("window").width;

// --- Micro-interaction Components ---
const ScalableCard = ({ children, onPress, onLongPress, style }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      delayLongPress={400}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

// Revenue Sparkline (Refined)
const RevenueSparkline = () => {
  return (
    <View
      style={{ height: 60, width: "100%", marginTop: 24, overflow: "visible" }}
    >
      <Svg height="100%" width="100%" viewBox="0 0 300 60">
        <Defs>
          <SvgLinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#2962FF" stopOpacity="0.1" />
            <Stop offset="1" stopColor="#2962FF" stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>
        <Path
          d="M0 50 C 40 50, 60 20, 90 25 C 120 30, 150 40, 180 20 C 210 0, 240 10, 270 5 C 290 2, 300 0, 300 0 L 300 60 L 0 60 Z"
          fill="url(#grad)"
        />
        <Path
          d="M0 50 C 40 50, 60 20, 90 25 C 120 30, 150 40, 180 20 C 210 0, 240 10, 270 5 C 290 2, 300 0, 300 0"
          fill="none"
          stroke="#2962FF"
          strokeWidth="3"
        />
      </Svg>
    </View>
  );
};

// --- Main Component ---
export default function CommunityDashboardScreen({ navigation }) {
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    visible: false,
    title: "",
    message: "",
    actions: [],
  });

  // Data
  const [metrics, setMetrics] = useState({
    totalMembers: 1250,
    eventsHosted: 15,
    collaborations: 3,
    newMembers: 42,
    engagementRate: "8.4%",
  });
  const [revenue, setRevenue] = useState({
    total: "48,200",
    thisMonth: "12,300",
    avgPerEvent: "154",
    ticketsSold: 312,
    eventsCount: 4,
  });

  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [previousEvents, setPreviousEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeTab, setActiveTab] = useState("upcoming");

  // Scroll Animation
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      // Simulate API call or fetch real data
      const { getCommunityEvents } = await import("../../../api/events");
      const eventsData = await getCommunityEvents();

      if (eventsData?.events) {
        setUpcomingEvents(eventsData.events.filter((e) => !e.is_past));
        setPreviousEvents(eventsData.events.filter((e) => e.is_past));
        setMetrics((prev) => ({
          ...prev,
          eventsHosted: eventsData.events.length,
        }));
      }
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers ---
  const handleCreateEvent = () => setShowCreateEventModal(true);
  const handleInviteMembers = () =>
    Alert.alert("Invite Members", "Feature coming soon!");

  const handleScanTickets = () => {
    if (upcomingEvents.length === 0) {
      Alert.alert(
        "No Events",
        "Create an event first before scanning tickets.",
      );
      return;
    }
    navigation.navigate("QRScanner", { event: upcomingEvents[0] });
  };

  // Simplified Event Actions
  const handleEventPress = (event) => {
    navigation.navigate("EventDetails", {
      eventId: event.id,
      eventData: event,
    });
  };

  const handleEventCreated = () => loadDashboard();
  const handleEventUpdated = () => loadDashboard();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

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

  // Render Item for Ticket Style Event List
  const renderEventItem = ({ item }) => {
    const { dateLabel, timeLabel, isSpecial } = formatEventDate(
      item.event_date,
    );

    // Mock Sales Data if not present
    const ticketsSold = item.current_attendees || 0;
    const ticketCapacity = item.capacity || 50;

    return (
      <TouchableOpacity
        style={styles.ticketCard}
        onPress={() => handleEventPress(item)}
        activeOpacity={0.8}
      >
        <Image
          source={{
            uri:
              item.banner_url ||
              "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200",
          }}
          style={styles.ticketImage}
        />
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
                color={COLORS.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.ticketMetricText}>
                {ticketsSold}/{ticketCapacity} sold
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.ticketMenuButton}
            onPress={() => handleEventLongPress(item)}
          >
            <MoreHorizontal size={22} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={16}
      >
        {/* 1️⃣ Founder Header (Flat) */}
        <View style={styles.headerSection}>
          <View style={styles.headerProfileRow}>
            <Image
              source={{
                uri: "https://images.unsplash.com/photo-1522075469751-3a3694c60e9e?w=200",
              }}
              style={styles.headerAvatar}
            />
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerName}>SnooSpace Community</Text>
              <Text style={styles.headerMeta}>
                {metrics.totalMembers.toLocaleString()} members ·{" "}
                {metrics.eventsHosted} events · {metrics.collaborations} collabs
              </Text>
            </View>
          </View>
        </View>

        {/* 2️⃣ Revenue Focus Card (Dominant) */}
        <View style={styles.section}>
          <View style={styles.revenueCard}>
            <Text style={styles.revenueLabelLarge}>Total Revenue</Text>
            <View style={styles.revenueMainRow}>
              <Text style={styles.revenueValueLarge}>₹{revenue.total}</Text>
              <View style={styles.growthChipsRow}>
                <View style={styles.growthChip}>
                  <TrendingUp size={12} color="#2E7D32" />
                  <Text style={styles.growthChipText}>+8.4%</Text>
                </View>
                <View
                  style={[styles.growthChip, { backgroundColor: "#E3F2FD" }]}
                >
                  <Text style={[styles.growthChipText, { color: "#1976D2" }]}>
                    +42 members
                  </Text>
                </View>
              </View>
            </View>

            <RevenueSparkline />

            <View style={styles.revenueFooter}>
              <Text style={styles.revenueFooterText}>
                <Text style={{ fontFamily: FONTS.semiBold }}>
                  {revenue.ticketsSold}
                </Text>{" "}
                tickets ·{" "}
                <Text style={{ fontFamily: FONTS.semiBold }}>
                  ₹{revenue.avgPerEvent}
                </Text>{" "}
                avg ·{" "}
                <Text style={{ fontFamily: FONTS.semiBold }}>
                  {revenue.eventsCount}
                </Text>{" "}
                events
              </Text>
            </View>
          </View>
        </View>

        {/* 3️⃣ Utility Row (Minimal) */}
        <View style={styles.section}>
          <View style={styles.utilityRow}>
            <TouchableOpacity
              style={styles.utilityButton}
              onPress={handleInviteMembers}
            >
              <UserPlus size={18} color={COLORS.primary} />
              <Text style={styles.utilityButtonText}>Invite Members</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.utilityButton}
              onPress={handleScanTickets}
            >
              <Scan size={18} color={COLORS.textPrimary} />
              <Text
                style={[
                  styles.utilityButtonText,
                  { color: COLORS.textPrimary },
                ]}
              >
                Scan Entry
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4️⃣ Events Section (Compact List) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Events</Text>
            <View style={styles.headerActions}>
              <View style={styles.tabPillContainer}>
                <TouchableOpacity
                  onPress={() => setActiveTab("upcoming")}
                  style={[
                    styles.tabPill,
                    activeTab === "upcoming" && styles.activeTabPill,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabPillText,
                      activeTab === "upcoming" && styles.activeTabPillText,
                    ]}
                  >
                    Upcoming
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setActiveTab("previous")}
                  style={[
                    styles.tabPill,
                    activeTab === "previous" && styles.activeTabPill,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabPillText,
                      activeTab === "previous" && styles.activeTabPillText,
                    ]}
                  >
                    Past
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("CommunityEventsList", {
                    initialTab: activeTab === "previous" ? "past" : "upcoming",
                  })
                }
              >
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.compactListContainer}>
            {activeTab === "upcoming" && upcomingEvents.length === 0 && (
              <View style={styles.emptyStateCompact}>
                <Text style={styles.emptyStateText}>No upcoming events</Text>
              </View>
            )}
            {activeTab === "previous" && previousEvents.length === 0 && (
              <View style={styles.emptyStateCompact}>
                <Text style={styles.emptyStateText}>No past events</Text>
              </View>
            )}

            {(activeTab === "upcoming" ? upcomingEvents : previousEvents)
              .slice(0, 5)
              .map((item) => (
                <React.Fragment key={item.id}>
                  {renderEventItem({ item })}
                  <View style={styles.itemSeparator} />
                </React.Fragment>
              ))}
          </View>

          <TouchableOpacity
            style={styles.createEventButton}
            onPress={handleCreateEvent}
          >
            <Plus size={20} color="#FFF" />
            <Text style={styles.createEventButtonText}>Create Event</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Padding for Tab Bar */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modals */}
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
    backgroundColor: DASHBOARD_TOKENS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: DASHBOARD_TOKENS.sectionSpacing,
  },

  // Header (Flat)
  headerSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  headerProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E1E1E1",
  },
  headerTextContainer: {
    flex: 1,
  },
  headerName: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 20,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  headerMeta: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  // Revenue Card (Dominant)
  revenueCard: {
    backgroundColor: DASHBOARD_TOKENS.surface,
    borderRadius: DASHBOARD_TOKENS.cardRadius,
    padding: 24,
    ...DASHBOARD_TOKENS.dominantShadow,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.02)",
  },
  revenueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  revenueLabelLarge: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  revenueValueLarge: {
    fontFamily: FONTS.primary, // Bold
    fontSize: 32,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  revenueMainRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 12,
  },
  growthChipsRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  growthChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  growthChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    color: "#2E7D32",
  },
  revenueFooter: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#F5F5F5",
    paddingTop: 16,
  },
  revenueFooterText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textMuted,
    letterSpacing: 0.1,
  },

  // Utility Row
  utilityRow: {
    flexDirection: "row",
    gap: 12,
  },
  utilityButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: DASHBOARD_TOKENS.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#F0F0F0",
    // Removed minimal shadow per request
  },
  utilityButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.primary,
  },

  // Events Section (Compact)
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: FONTS.primary,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  tabPillContainer: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6", // Light gray container
    borderRadius: 20,
    padding: 4,
    alignItems: "center",
  },
  tabPill: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  activeTabPill: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabPillText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  activeTabPillText: {
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
  },
  viewAllText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.primary,
  },
  compactListContainer: {
    backgroundColor: "transparent",
    gap: 10,
  },
  ticketCard: {
    flexDirection: "row",
    backgroundColor: DASHBOARD_TOKENS.surface,
    borderRadius: 28, // Increased radius
    padding: 20, // Generous padding
    borderWidth: 1,
    borderColor: "#F0F0F0",
    alignItems: "center",
    height: 128, // Increased height
  },
  ticketImage: {
    width: 88,
    height: 88,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
  },
  ticketContent: {
    flex: 1,
    marginLeft: 20, // More breathing room
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
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  ticketDateTextSpecial: {
    color: COLORS.primary,
  },
  ticketTimeText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  ticketTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 16,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  ticketFooterRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ticketMetricText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  ticketMenuButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F8FA",
    borderRadius: 12,
  },
  itemSeparator: {
    height: 0, // No separator for card style
  },
  emptyStateCompact: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: {
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  createEventButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary, // Or black if going very founder-minimal
    marginHorizontal: 0,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  createEventButtonText: {
    fontFamily: FONTS.semiBold,
    color: "#FFFFFF",
    fontSize: 14,
  },
});
