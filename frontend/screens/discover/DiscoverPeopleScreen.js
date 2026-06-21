import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Text, TouchableOpacity, Platform } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Users, ChevronRight, Lock } from "lucide-react-native";
import { Image } from "expo-image";
import { apiGet } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, FONTS } from "../../constants/theme";
import SnooLoader from "../../components/ui/SnooLoader";

const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;
const PRIMARY_COLOR = COLORS.primary;

const EDGES = ["top"];

export default function DiscoverPeopleScreen({ route, navigation }) {
  const { event } = route.params || {};
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [profileComplete, setProfileComplete] = useState(true);

  const loadAttendees = useCallback(async () => {
    if (!event?.id) return;

    try {
      setLoading(true);
      setErrorMsg("");
      const token = await getAuthToken();

      if (token) {
        const profileRes = await apiGet("/members/profile", 15000, token);
        const profile = profileRes.profile || profileRes;
        const ownPhotos = Array.isArray(profile.discover_photos) ? profile.discover_photos : [];
        const ownBadges = Array.isArray(profile.intent_badges) ? profile.intent_badges : [];
        const ownOpeners = Array.isArray(profile.openers) ? profile.openers : [];
        const isComplete = ownPhotos.length >= 3 && ownBadges.length >= 1 && ownOpeners.length >= 1;
        setProfileComplete(isComplete);

        if (isComplete) {
          const response = await apiGet(
            `/events/${event.id}/attendees`,
            15000,
            token
          );
          setAttendees(response.attendees || []);
        }
      }
    } catch (error) {
      console.error("Error loading attendees:", error);
      setErrorMsg(error?.message || "Failed to load people");
    } finally {
      setLoading(false);
    }
  }, [event?.id]);

  useEffect(() => {
    loadAttendees();
  }, [loadAttendees]);

  const handlePersonPress = useCallback((attendee) => {
    navigation.navigate("NetworkingProfile", { attendee, event });
  }, [navigation, event]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const renderPerson = useCallback(({ item: attendee }) => {
    return (
      <PersonCard
        attendee={attendee}
        onPress={handlePersonPress}
        lightTextColor={LIGHT_TEXT_COLOR}
      />
    );
  }, [handlePersonPress]);

  const keyExtractor = useCallback((item) => item.id?.toString(), []);

  const getItemLayout = useCallback((data, index) => ({
    length: 96,
    offset: 96 * index,
    index,
  }), []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <SnooLoader size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Loading people...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profileComplete) {
    return (
      <SafeAreaView style={styles.container} edges={EDGES}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
          >
            <ArrowLeft size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {event?.title || "Discover People"}
            </Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.emptyContainer}>
          <View style={styles.lockBadge}>
            <Lock size={32} color="#FFFFFF" strokeWidth={2} />
          </View>
          <Text style={styles.emptyTitle}>Access Locked</Text>
          <Text style={styles.emptyText}>
            Complete your Discover Profile to view other attendees. Please ensure you have added at least 3 photos, 1 Spark, and 1 Icebreaker.
          </Text>
          <TouchableOpacity
            style={styles.gateButton}
            onPress={() => navigation.navigate("EditDiscoverProfile")}
            activeOpacity={0.8}
          >
            <Text style={styles.gateButtonText}>Complete Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={EDGES}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
        >
          <ArrowLeft size={24} color={TEXT_COLOR} />
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
          <Users size={60} color={LIGHT_TEXT_COLOR} />
          <Text style={styles.emptyTitle}>No people yet</Text>
          <Text style={styles.emptyText}>
            Be the first to connect with others at this event
          </Text>
        </View>
      ) : (
        <FlashList
          data={attendees}
          renderItem={renderPerson}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          estimatedItemSize={96}
        />
      )}
    </SafeAreaView>
  );
}

const PersonCard = React.memo(({ attendee, onPress, lightTextColor }) => {
  const photo = attendee.photos?.[0]?.photo_url || "https://via.placeholder.com/150";

  return (
    <TouchableOpacity
      style={styles.personCard}
      onPress={() => onPress(attendee)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: photo }} style={styles.personPhoto} cachePolicy="memory-disk" />
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
      <ChevronRight size={20} color={lightTextColor} />
    </TouchableOpacity>
  );
});

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
    fontFamily: FONTS.medium,
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
    fontSize: 20,
    fontFamily: FONTS.black,
    color: TEXT_COLOR,
  },
  headerSubtitle: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    fontFamily: FONTS.medium,
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
    fontFamily: FONTS.semiBold,
    color: TEXT_COLOR,
  },
  personPronouns: {
    fontSize: 13,
    fontFamily: FONTS.regular,
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
    fontFamily: FONTS.regular,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: FONTS.primary,
    color: TEXT_COLOR,
    marginTop: SPACING.m,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
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
    fontFamily: FONTS.semiBold,
  },
  gateButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.m,
    marginTop: 20,
  },
  gateButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: FONTS.semiBold,
  },
  lockBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#2962FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#2962FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
});
