import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../constants/theme";

const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;
const PRIMARY_COLOR = COLORS.primary;
const OFF_WHITE = "#F8F8F8";

export default function NetworkingProfileScreen({ route, navigation }) {
  const { attendee, event } = route.params || {};
  const [isSaved, setIsSaved] = useState(false);

  if (!attendee) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Profile not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const photos = attendee.photos || [];
  const heroPhoto =
    photos[0]?.photo_url || "https://via.placeholder.com/600x800";

  // Build context line based on available data
  const getContextLine = () => {
    if (event) {
      return `Attending ${event.title}`;
    }
    if (attendee.college) {
      return `Student at ${attendee.college}`;
    }
    if (attendee.community) {
      return `Member of ${attendee.community}`;
    }
    return "Exploring the community";
  };

  const handleStartConversation = () => {
    // Navigate to a conversation starter or message screen
    navigation.navigate("Chat", {
      recipientId: attendee.id,
      recipientName: attendee.name,
      recipientPhoto: heroPhoto,
    });
  };

  const handleSaveProfile = () => {
    setIsSaved(!isSaved);
    // TODO: API call to save/unsave profile
  };

  const handleInviteToConnect = () => {
    Alert.alert("Invite Sent", `Connection invite sent to ${attendee.name}`, [
      { text: "OK" },
    ]);
    // TODO: API call to send connection invite
  };

  const handleReport = () => {
    Alert.alert(
      "Report Profile",
      "Are you sure you want to report this profile?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Report", style: "destructive" },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.moreButton} onPress={handleReport}>
          <Ionicons name="ellipsis-horizontal" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Info Section - LEFT ALIGNED */}
        <View style={styles.profileInfoSection}>
          <Text style={styles.nameText}>
            {attendee.name}
            {attendee.age ? `, ${attendee.age}` : ""}
          </Text>
          <Text style={styles.pronounsText}>
            {attendee.pronouns || "they/them"}
          </Text>
          <Text style={styles.contextLine}>{getContextLine()}</Text>
        </View>

        {/* Intent/Goal Badges */}
        {attendee.intent_badges && attendee.intent_badges.length > 0 && (
          <View style={styles.intentSection}>
            {attendee.intent_badges.slice(0, 3).map((badge, index) => (
              <View key={index} style={styles.intentBadge}>
                <Text style={styles.intentBadgeText}>{badge}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Fallback intent badges if none provided */}
        {(!attendee.intent_badges || attendee.intent_badges.length === 0) && (
          <View style={styles.intentSection}>
            <View style={styles.intentBadge}>
              <Text style={styles.intentBadgeText}>
                Looking to meet new people
              </Text>
            </View>
          </View>
        )}

        {/* Hero Photo */}
        <View style={styles.heroPhotoContainer}>
          <Image
            source={{ uri: heroPhoto }}
            style={styles.heroPhoto}
            resizeMode="cover"
          />
        </View>

        {/* Interests Section */}
        {attendee.interests && attendee.interests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>interests</Text>
            <View style={styles.interestsList}>
              {attendee.interests.map((interest, index) => (
                <View key={index} style={styles.interestPill}>
                  <Text style={styles.interestText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Conversation Prompts */}
        <View style={styles.promptCard}>
          <Text style={styles.promptQuestion}>
            {attendee.prompt_question ||
              "Something I'm currently curious about..."}
          </Text>
          <Text style={styles.promptAnswer}>
            {attendee.prompt_answer ||
              attendee.bio ||
              "I'd love to learn more about building products that actually help people."}
          </Text>
        </View>

        {/* Additional Photos */}
        {photos.slice(1).map((photo, index) => (
          <View key={index} style={styles.additionalPhotoContainer}>
            <Image
              source={{ uri: photo.photo_url }}
              style={styles.heroPhoto}
              resizeMode="cover"
            />
          </View>
        ))}

        {/* Bottom spacing for action buttons */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Fixed Action Buttons at Bottom */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleSaveProfile}
        >
          <Ionicons
            name={isSaved ? "bookmark" : "bookmark-outline"}
            size={20}
            color={TEXT_COLOR}
          />
          <Text style={styles.secondaryButtonText}>Save</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleStartConversation}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Start a conversation</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleInviteToConnect}
        >
          <Ionicons name="person-add-outline" size={20} color={TEXT_COLOR} />
          <Text style={styles.secondaryButtonText}>Connect</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
  },
  backButton: {
    padding: SPACING.s,
  },
  moreButton: {
    padding: SPACING.s,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.xl,
  },
  profileInfoSection: {
    marginBottom: SPACING.m,
    alignItems: "flex-start", // LEFT ALIGNED
  },
  nameText: {
    fontSize: 28,
    fontWeight: "bold",
    color: TEXT_COLOR,
  },
  pronounsText: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    marginTop: 4,
  },
  contextLine: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: "500",
    marginTop: SPACING.s,
  },
  intentSection: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.s,
    marginBottom: SPACING.l,
  },
  intentBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: BORDER_RADIUS.pill,
  },
  intentBadgeText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#2E7D32",
  },
  heroPhotoContainer: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: BORDER_RADIUS.xl,
    overflow: "hidden",
    marginBottom: SPACING.l,
  },
  heroPhoto: {
    width: "100%",
    height: "100%",
  },
  section: {
    marginBottom: SPACING.l,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: SPACING.m,
  },
  interestsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.s,
  },
  interestPill: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: BORDER_RADIUS.pill,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
  },
  interestText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "500",
  },
  promptCard: {
    backgroundColor: OFF_WHITE,
    padding: SPACING.l,
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.l,
  },
  promptQuestion: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    marginBottom: SPACING.s,
    fontStyle: "italic",
  },
  promptAnswer: {
    fontSize: 16,
    color: TEXT_COLOR,
    lineHeight: 24,
  },
  additionalPhotoContainer: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: BORDER_RADIUS.xl,
    overflow: "hidden",
    marginBottom: SPACING.l,
  },
  actionContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.m,
    paddingTop: SPACING.m,
    paddingBottom: 34, // Safe area bottom
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.s,
  },
  primaryButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.m,
    borderRadius: BORDER_RADIUS.m,
    gap: SPACING.s,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  secondaryButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.m,
    gap: 4,
  },
  secondaryButtonText: {
    color: TEXT_COLOR,
    fontSize: 12,
    fontWeight: "500",
  },
});
