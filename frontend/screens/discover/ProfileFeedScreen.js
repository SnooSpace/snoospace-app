import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiGet } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../constants/theme";

const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;
const PRIMARY_COLOR = COLORS.primary;

export default function ProfileFeedScreen({ route, navigation }) {
  const { event } = route.params || {};
  const [attendees, setAttendees] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [skippedIds, setSkippedIds] = useState(new Set());

  useEffect(() => {
    if (event) {
      loadAttendees();
    }
  }, [event]);

  const loadAttendees = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      if (token) {
        const response = await apiGet(
          `/events/${event.id}/attendees`,
          15000,
          token
        );
        setAttendees(response.attendees || []);
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error("Error loading attendees:", error);
      setAttendees([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = (attendee) => {
    Alert.alert(
      "Connection Request",
      `Send connection request to ${attendee.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Connect",
          onPress: () => {
            Alert.alert(
              "Request Sent",
              `Connection request sent to ${attendee.name}`
            );
            goToNextProfile();
          },
        },
      ]
    );
  };

  const handleStartConversation = (attendee) => {
    navigation.navigate("Chat", {
      recipientId: attendee.id,
      recipientName: attendee.name,
      recipientPhoto: attendee.photos?.[0]?.photo_url,
    });
  };

  const handleSkip = (attendee) => {
    setSkippedIds((prev) => new Set([...prev, attendee.id]));
    goToNextProfile();
  };

  const goToNextProfile = () => {
    if (currentIndex < attendees.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      Alert.alert("All Done", "You've seen everyone at this event!", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    }
  };

  const handleFilterPress = () => {
    Alert.alert(
      "Discovery Filters",
      "Filter by goals, interests, or view skipped profiles",
      [
        { text: "Cancel", style: "cancel" },
        { text: "View Skipped", onPress: () => {} },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Loading people...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentAttendee = attendees[currentIndex];

  if (!currentAttendee) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{event?.title}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyStateContainer}>
          <Ionicons name="people-outline" size={60} color={LIGHT_TEXT_COLOR} />
          <Text style={styles.emptyTitle}>No one here yet</Text>
          <Text style={styles.emptyText}>
            Be the first to connect at this event
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const photos = currentAttendee.photos || [];
  const heroPhoto =
    photos[0]?.photo_url || "https://via.placeholder.com/400x500";
  const goalBadges = currentAttendee.intent_badges || ["Open to networking"];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.feedHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
        <View style={styles.feedHeaderCenter}>
          <Text style={styles.feedHeaderTitle}>{event?.title}</Text>
          <Text style={styles.feedHeaderSubtitle}>
            {currentIndex + 1} of {attendees.length}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={handleFilterPress}
        >
          <Ionicons name="options-outline" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
      </View>

      {/* Profile Card */}
      <ScrollView
        style={styles.profileScroll}
        contentContainerStyle={styles.profileScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Goal Badges - PRIMARY (most prominent) */}
        <View style={styles.goalBadgesSection}>
          {goalBadges.slice(0, 3).map((badge, index) => (
            <View key={index} style={styles.goalBadge}>
              <Text style={styles.goalBadgeText}>{badge}</Text>
            </View>
          ))}
        </View>

        {/* Name */}
        <Text style={styles.profileName}>{currentAttendee.name}</Text>

        {/* College/Organization */}
        <Text style={styles.profileCollege}>
          {currentAttendee.college || event?.title}
        </Text>

        {/* Photo */}
        <View style={styles.profilePhotoContainer}>
          <Image
            source={{ uri: heroPhoto }}
            style={styles.profilePhoto}
            resizeMode="cover"
          />
        </View>

        {/* Interests */}
        {currentAttendee.interests && currentAttendee.interests.length > 0 && (
          <View style={styles.interestsSection}>
            <Text style={styles.sectionLabel}>Shared interests</Text>
            <View style={styles.interestsList}>
              {currentAttendee.interests.slice(0, 5).map((interest, index) => (
                <View key={index} style={styles.interestPill}>
                  <Text style={styles.interestText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Age/Pronouns - SECONDARY (muted) */}
        {(currentAttendee.age || currentAttendee.pronouns) && (
          <Text style={styles.secondaryInfo}>
            {currentAttendee.age ? `${currentAttendee.age}` : ""}
            {currentAttendee.age && currentAttendee.pronouns ? " · " : ""}
            {currentAttendee.pronouns || ""}
          </Text>
        )}

        {/* Bottom padding */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => handleSkip(currentAttendee)}
        >
          <Ionicons name="close" size={24} color={LIGHT_TEXT_COLOR} />
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.connectButton}
          onPress={() => handleConnect(currentAttendee)}
        >
          <Ionicons name="person-add" size={20} color="#FFFFFF" />
          <Text style={styles.connectButtonText}>Connect</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.messageButton}
          onPress={() => handleStartConversation(currentAttendee)}
        >
          <Ionicons name="chatbubble-outline" size={20} color={PRIMARY_COLOR} />
          <Text style={styles.messageButtonText}>Message</Text>
        </TouchableOpacity>
      </View>
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    backgroundColor: COLORS.surface,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  feedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    backgroundColor: COLORS.surface,
  },
  backButton: {
    padding: SPACING.s,
  },
  feedHeaderCenter: {
    alignItems: "center",
  },
  feedHeaderTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
  },
  feedHeaderSubtitle: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  filterButton: {
    padding: SPACING.s,
  },
  profileScroll: {
    flex: 1,
  },
  profileScrollContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
  },
  goalBadgesSection: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.s,
    marginBottom: SPACING.m,
  },
  goalBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.pill,
  },
  goalBadgeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2E7D32",
  },
  profileName: {
    fontSize: 28,
    fontWeight: "bold",
    color: TEXT_COLOR,
    marginBottom: 4,
  },
  profileCollege: {
    fontSize: 15,
    color: LIGHT_TEXT_COLOR,
    marginBottom: SPACING.m,
  },
  profilePhotoContainer: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: BORDER_RADIUS.xl,
    overflow: "hidden",
    marginBottom: SPACING.l,
  },
  profilePhoto: {
    width: "100%",
    height: "100%",
  },
  interestsSection: {
    marginBottom: SPACING.m,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: LIGHT_TEXT_COLOR,
    marginBottom: SPACING.s,
  },
  interestsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.s,
  },
  interestPill: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: SPACING.m,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.pill,
  },
  interestText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "500",
  },
  secondaryInfo: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    marginTop: SPACING.s,
  },
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.m,
    paddingTop: SPACING.m,
    paddingBottom: 34,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.s,
  },
  skipButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.m,
  },
  skipButtonText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 4,
  },
  connectButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: SPACING.m,
    borderRadius: BORDER_RADIUS.m,
    gap: 6,
  },
  connectButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  messageButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.m,
  },
  messageButtonText: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    marginTop: 4,
    fontWeight: "500",
  },
  emptyStateContainer: {
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
    marginTop: SPACING.s,
    textAlign: "center",
  },
});
