import React, { useState, useEffect } from "react";
import { StyleSheet, View, Text, TouchableOpacity, FlatList, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiGet } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../constants/theme";
import SnooLoader from "../../components/ui/SnooLoader";

const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;
const PRIMARY_COLOR = COLORS.primary;

export default function DiscoverPeopleScreen({ route, navigation }) {
  const { event } = route.params || {};
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    loadAttendees();
  }, []);

  const loadAttendees = async () => {
    if (!event?.id) return;

    try {
      setLoading(true);
      setErrorMsg("");
      const token = await getAuthToken();

      if (token) {
        const response = await apiGet(
          `/events/${event.id}/attendees`,
          15000,
          token
        );
        setAttendees(response.attendees || []);
      }
    } catch (error) {
      console.error("Error loading attendees:", error);
      setErrorMsg(error?.message || "Failed to load people");
    } finally {
      setLoading(false);
    }
  };

  const handlePersonPress = (attendee) => {
    navigation.navigate("NetworkingProfile", { attendee, event });
  };

  const renderPerson = ({ item: attendee }) => {
    const photo =
      attendee.photos?.[0]?.photo_url || "https://via.placeholder.com/150";

    return (
      <TouchableOpacity
        style={styles.personCard}
        onPress={() => handlePersonPress(attendee)}
        activeOpacity={0.7}
      >
        <Image source={{ uri: photo }} style={styles.personPhoto} />
        <View style={styles.personInfo}>
          <Text style={styles.personName} numberOfLines={1}>
            {attendee.name}
            {attendee.age ? `, ${attendee.age}` : ""}
          </Text>
          <Text style={styles.personPronouns} numberOfLines={1}>
            {attendee.pronouns && attendee.pronouns !== "Prefer not to say"
              ? attendee.pronouns
              : "they/them"}
          </Text>
          {attendee.intent_badges?.[0] && (
            <View style={styles.intentBadgeSmall}>
              <Text style={styles.intentBadgeSmallText} numberOfLines={1}>
                {attendee.intent_badges[0]}
              </Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={LIGHT_TEXT_COLOR} />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <SnooLoader size="large" color={PRIMARY_COLOR} />
          <Text style={[styles.loadingText, { fontFamily: 'Manrope-Medium' }]}>Loading people...</Text>
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
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {event?.title || "Discover People"}
          </Text>
          <Text style={styles.headerSubtitle}>
            {attendees.length} {attendees.length === 1 ? "person" : "people"}
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Error Banner */}
      {errorMsg ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity onPress={loadAttendees}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* People List */}
      {attendees.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={60} color={LIGHT_TEXT_COLOR} />
          <Text style={styles.emptyTitle}>No people yet</Text>
          <Text style={styles.emptyText}>
            Be the first to connect with others at this event
          </Text>
        </View>
      ) : (
        <FlatList
          data={attendees}
          renderItem={renderPerson}
          keyExtractor={(item) => item.id?.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: SPACING.m,
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
  
    fontFamily: "Manrope-Regular",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    backgroundColor: COLORS.surface,
  },
  backButton: {
    padding: SPACING.s,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  headerSubtitle: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },
  listContent: {
    padding: SPACING.m,
  },
  personCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    padding: SPACING.m,
    borderRadius: BORDER_RADIUS.m,
    marginBottom: SPACING.s,
    ...SHADOWS.sm,
  },
  personPhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: SPACING.m,
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  personPronouns: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  intentBadgeSmall: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: SPACING.s,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.s,
    alignSelf: "flex-start",
    marginTop: SPACING.xs,
  },
  intentBadgeSmallText: {
    fontSize: 11,
    color: "#2E7D32",
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginTop: SPACING.m,
  },
  emptyText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    textAlign: "center",
    marginTop: SPACING.s,
  },
  errorBanner: {
    marginHorizontal: SPACING.m,
    marginTop: SPACING.s,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    backgroundColor: "#FFF2F0",
    borderRadius: BORDER_RADIUS.m,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  errorText: {
    color: "#D93025",
    flex: 1,
    marginRight: SPACING.s,
  },
  retryText: {
    color: PRIMARY_COLOR,
    fontWeight: "600",
  },
});
