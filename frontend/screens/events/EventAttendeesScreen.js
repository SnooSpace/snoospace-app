/**
 * EventAttendeesScreen - Display registered attendees for an event
 * Shows: Name, Gender (colored), Age, Username, Ticket details
 * For community owners to view who registered for their events
 */
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getEventRegistrations } from "../../api/events";
import { getGradientForName, getInitials } from "../../utils/AvatarGenerator";
import SnooLoader from "../../components/ui/SnooLoader";

const BACKGROUND_COLOR = "#F9FAFB";
const CARD_BACKGROUND = "#FFFFFF";
const TEXT_COLOR = "#1F2937";
const MUTED_TEXT = "#6B7280";
const BORDER_COLOR = "#E5E7EB";
const PRIMARY_COLOR = "#6A0DAD";

// Gender colors
const MALE_COLOR = "#007AFF"; // Blue
const FEMALE_COLOR = "#FF2D92"; // Pink
const OTHER_COLOR = "#6B7280"; // Gray for Non-binary

/**
 * Get gender abbreviation
 */
const getGenderAbbrev = (gender) => {
  switch (gender) {
    case "Male":
      return "M";
    case "Female":
      return "F";
    case "Non-binary":
      return "NB";
    default:
      return "";
  }
};

/**
 * Get gender color
 */
const getGenderColor = (gender) => {
  switch (gender) {
    case "Male":
      return MALE_COLOR;
    case "Female":
      return FEMALE_COLOR;
    default:
      return OTHER_COLOR;
  }
};

/**
 * Format relative time
 */
const formatRelativeTime = (dateString) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

/**
 * Individual attendee card component
 */
const AttendeeListItem = ({ attendee, onPress }) => {
  const gradientColors = getGradientForName(attendee.name);
  const initials = getInitials(attendee.name);
  const genderColor = getGenderColor(attendee.gender);
  const genderAbbrev = getGenderAbbrev(attendee.gender);

  return (
    <TouchableOpacity
      style={styles.attendeeCard}
      onPress={() => onPress?.(attendee)}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      {attendee.profile_photo_url ? (
        <Image
          source={{ uri: attendee.profile_photo_url }}
          style={styles.avatar}
        />
      ) : (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </LinearGradient>
      )}

      {/* Info Section */}
      <View style={styles.infoSection}>
        {/* Name Row with Gender and Age */}
        <View style={styles.nameRow}>
          <Text style={styles.attendeeName} numberOfLines={1}>
            {attendee.name}
          </Text>
          {genderAbbrev && (
            <Text style={[styles.genderBadge, { color: genderColor }]}>
              ({genderAbbrev})
            </Text>
          )}
          {attendee.age && (
            <Text style={styles.ageBadge}>{attendee.age}yrs</Text>
          )}
        </View>

        {/* Username */}
        {attendee.username && (
          <Text style={styles.username}>@{attendee.username}</Text>
        )}

        {/* Tickets */}
        {attendee.tickets && attendee.tickets.length > 0 && (
          <View style={styles.ticketsContainer}>
            {attendee.tickets.map((ticket, index) => (
              <View key={index} style={styles.ticketBadge}>
                <Ionicons
                  name="ticket-outline"
                  size={12}
                  color={PRIMARY_COLOR}
                />
                <Text style={styles.ticketText}>
                  {ticket.ticketName} × {ticket.quantity}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Registration time */}
        {attendee.registered_at && (
          <Text style={styles.registeredTime}>
            Registered {formatRelativeTime(attendee.registered_at)}
          </Text>
        )}
      </View>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={20} color={MUTED_TEXT} />
    </TouchableOpacity>
  );
};

export default function EventAttendeesScreen({ route, navigation }) {
  const { event } = route.params || {};
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadAttendees = useCallback(async () => {
    if (!event?.id) {
      setError("No event specified");
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await getEventRegistrations(event.id);
      if (response?.attendees) {
        setAttendees(response.attendees);
      } else if (response?.error) {
        setError(response.error);
      }
    } catch (err) {
      console.error("Error loading attendees:", err);
      setError(err.message || "Failed to load attendees");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [event?.id]);

  useEffect(() => {
    loadAttendees();
  }, [loadAttendees]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadAttendees();
  }, [loadAttendees]);

  const handleAttendeePress = (attendee) => {
    // Navigate to member profile
    navigation.navigate("MemberPublicProfile", { memberId: attendee.id });
  };

  const renderAttendee = ({ item }) => (
    <AttendeeListItem attendee={item} onPress={handleAttendeePress} />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={60} color={MUTED_TEXT} />
      <Text style={styles.emptyTitle}>No Attendees Yet</Text>
      <Text style={styles.emptyText}>
        No one has registered for this event yet.
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerStats}>
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>{attendees.length}</Text>
        <Text style={styles.statLabel}>Total Registered</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>
          {attendees.reduce((sum, a) => {
            const tickets = a.tickets || [];
            return (
              sum + tickets.reduce((t, ticket) => t + (ticket.quantity || 0), 0)
            );
          }, 0)}
        </Text>
        <Text style={styles.statLabel}>Tickets Sold</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Attendees
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <SnooLoader size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Loading attendees...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Attendees
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={60} color="#FF3B30" />
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAttendees}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Attendees
          </Text>
          {event?.title && (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {event.title}
            </Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      <FlatList
        data={attendees}
        renderItem={renderAttendee}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={attendees.length > 0 ? renderHeader : null}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={PRIMARY_COLOR}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: CARD_BACKGROUND,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  headerSubtitle: {
    fontSize: 12,
    color: MUTED_TEXT,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 14,
    color: MUTED_TEXT,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: MUTED_TEXT,
    textAlign: "center",
    marginTop: 8,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  headerStats: {
    flexDirection: "row",
    backgroundColor: CARD_BACKGROUND,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: PRIMARY_COLOR,
  },
  statLabel: {
    fontSize: 12,
    color: MUTED_TEXT,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: BORDER_COLOR,
    marginVertical: 4,
  },
  attendeeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BACKGROUND,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  infoSection: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  attendeeName: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  genderBadge: {
    fontSize: 14,
    fontWeight: "600",
  },
  ageBadge: {
    fontSize: 14,
    color: MUTED_TEXT,
  },
  username: {
    fontSize: 13,
    color: MUTED_TEXT,
    marginTop: 2,
  },
  ticketsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  ticketBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  ticketText: {
    fontSize: 11,
    color: PRIMARY_COLOR,
    fontWeight: "500",
  },
  registeredTime: {
    fontSize: 11,
    color: MUTED_TEXT,
    marginTop: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: MUTED_TEXT,
    textAlign: "center",
    marginTop: 8,
  },
});
