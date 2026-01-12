import React, { useState, useEffect, useCallback } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { apiGet } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../constants/theme";

const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;
const PRIMARY_COLOR = COLORS.primary;

export default function DiscoverScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [exploreEvents, setExploreEvents] = useState([]);
  const [suggestedCommunities, setSuggestedCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exploreTab, setExploreTab] = useState("nearby");
  const [errorMsg, setErrorMsg] = useState("");
  const [profileComplete, setProfileComplete] = useState(true);

  // Animation for incomplete profile button
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (!profileComplete) {
      // Gentle pulse animation
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.05, {
            duration: 800,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      pulseScale.value = 1;
      pulseOpacity.value = 1;
    }
  }, [profileComplete]);

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  useFocusEffect(
    useCallback(() => {
      loadData();
      checkProfileCompletion();
    }, [])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const token = await getAuthToken();

      if (token) {
        // Load all data in parallel
        const [eventsResponse, exploreResponse, suggestionsResponse] =
          await Promise.all([
            apiGet("/events/my-events", 15000, token).catch(() => ({
              events: [],
            })),
            apiGet("/events/discover", 15000, token).catch(() => ({
              events: [],
            })),
            apiGet("/discover/suggestions", 15000, token).catch(() => ({
              suggestions: [],
            })),
          ]);

        setEvents(eventsResponse.events || []);
        setExploreEvents(exploreResponse.events || []);
        setSuggestedCommunities(suggestionsResponse.suggestions || []);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setErrorMsg(error?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const checkProfileCompletion = async () => {
    try {
      const token = await getAuthToken();
      if (token) {
        const response = await apiGet("/members/profile", 15000, token);
        const profile = response.profile || response;
        // Profile is complete if they have at least 1 goal badge
        const hasGoalBadges =
          profile.intent_badges && profile.intent_badges.length > 0;
        setProfileComplete(hasGoalBadges);
      }
    } catch (error) {
      console.error("Error checking profile:", error);
    }
  };

  const handleEventPress = (event) => {
    navigation.navigate("ProfileFeed", { event });
  };

  const handleMyProfilePress = () => {
    navigation.navigate("EditDiscoverProfile");
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const renderEventCard = (event, isExplore = false) => (
    <TouchableOpacity
      key={event.id}
      style={styles.eventCard}
      onPress={() => handleEventPress(event)}
      activeOpacity={0.7}
    >
      <View style={styles.eventCardContent}>
        <View style={styles.eventHeader}>
          <Text style={styles.eventTitle} numberOfLines={1}>
            {event.title}
          </Text>
          {!isExplore && (
            <View
              style={[
                styles.statusBadge,
                event.is_past ? styles.pastBadge : styles.upcomingBadge,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  event.is_past ? styles.pastText : styles.upcomingText,
                ]}
              >
                {event.is_past ? "Past" : "Upcoming"}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.eventDetails}>
          <Ionicons
            name="calendar-outline"
            size={14}
            color={LIGHT_TEXT_COLOR}
          />
          <Text style={styles.eventDetailText}>
            {formatDate(event.event_date)}
          </Text>
          {event.location && (
            <>
              <Text style={styles.eventDetailSeparator}>•</Text>
              <Ionicons
                name="location-outline"
                size={14}
                color={LIGHT_TEXT_COLOR}
              />
              <Text style={styles.eventDetailText} numberOfLines={1}>
                {event.venue_name || event.location}
              </Text>
            </>
          )}
        </View>
        <View style={styles.eventFooter}>
          <View style={styles.attendeeInfo}>
            <Ionicons name="people-outline" size={14} color={PRIMARY_COLOR} />
            <Text style={styles.attendeeText}>
              {event.attendee_count || 0} people
            </Text>
          </View>
          <Text style={styles.discoverHint}>Tap to discover →</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const exploreTabs = [
    { key: "nearby", label: "Nearby" },
    { key: "upcoming", label: "Upcoming" },
    { key: "popular", label: "Popular" },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Discover</Text>
          <Text style={styles.headerSubtitle}>People at your events</Text>
        </View>

        {/* My Profile Button */}
        <Animated.View style={[!profileComplete && animatedButtonStyle]}>
          <TouchableOpacity
            style={[
              styles.myProfileButton,
              !profileComplete && styles.myProfileButtonIncomplete,
            ]}
            onPress={handleMyProfilePress}
          >
            <Ionicons
              name="person-circle-outline"
              size={20}
              color={profileComplete ? TEXT_COLOR : PRIMARY_COLOR}
            />
            <Text
              style={[
                styles.myProfileText,
                !profileComplete && styles.myProfileTextIncomplete,
              ]}
            >
              My Profile
            </Text>
            {!profileComplete && <View style={styles.incompleteDot} />}
          </TouchableOpacity>
        </Animated.View>

        {/* Activity Button */}
        <TouchableOpacity
          style={styles.activityButton}
          onPress={() => navigation.navigate("ActivityInsights")}
        >
          <Ionicons name="pulse-outline" size={22} color={TEXT_COLOR} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Incomplete Profile Banner */}
        {!profileComplete && (
          <TouchableOpacity
            style={styles.incompleteBanner}
            onPress={handleMyProfilePress}
          >
            <Ionicons name="alert-circle" size={20} color="#E65100" />
            <Text style={styles.incompleteBannerText}>
              Complete your profile to appear in discovery
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#E65100" />
          </TouchableOpacity>
        )}

        {errorMsg ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity onPress={loadEvents}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>YOUR EVENTS</Text>
          {events.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons
                name="calendar-outline"
                size={40}
                color={LIGHT_TEXT_COLOR}
              />
              <Text style={styles.emptyTitle}>No events yet</Text>
              <Text style={styles.emptyText}>
                Register for events to discover people
              </Text>
              <TouchableOpacity
                style={styles.exploreCta}
                onPress={() => navigation.navigate("Search")}
              >
                <Text style={styles.exploreCtaText}>Find events</Text>
              </TouchableOpacity>
            </View>
          ) : (
            events.slice(0, 5).map((event) => renderEventCard(event))
          )}
        </View>

        {/* Based on your Interests - Community Recommendations */}
        {suggestedCommunities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BASED ON YOUR INTERESTS</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.communitiesScrollContent}
            >
              {suggestedCommunities.map((community) => (
                <TouchableOpacity
                  key={community.id}
                  style={styles.communityCard}
                  onPress={() =>
                    navigation.navigate("CommunityPublicProfile", {
                      communityId: community.id,
                    })
                  }
                  activeOpacity={0.7}
                >
                  {community.logo_url ? (
                    <Image
                      source={{ uri: community.logo_url }}
                      style={styles.communityLogo}
                    />
                  ) : (
                    <View
                      style={[
                        styles.communityLogo,
                        styles.communityLogoPlaceholder,
                      ]}
                    >
                      <Ionicons name="people" size={24} color={PRIMARY_COLOR} />
                    </View>
                  )}
                  <Text style={styles.communityName} numberOfLines={2}>
                    {community.name}
                  </Text>
                  {community.category && (
                    <Text style={styles.communityCategory} numberOfLines={1}>
                      {community.category}
                    </Text>
                  )}
                  <View style={styles.communityFollowers}>
                    <Ionicons
                      name="people-outline"
                      size={12}
                      color={LIGHT_TEXT_COLOR}
                    />
                    <Text style={styles.communityFollowerCount}>
                      {community.follower_count || 0}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EXPLORE MORE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabContainer}
            contentContainerStyle={styles.tabContent}
          >
            {exploreTabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabChip,
                  exploreTab === tab.key && styles.tabChipActive,
                ]}
                onPress={() => setExploreTab(tab.key)}
              >
                <Text
                  style={[
                    styles.tabChipText,
                    exploreTab === tab.key && styles.tabChipTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {exploreEvents.length === 0 ? (
            <View style={styles.emptyExplore}>
              <Text style={styles.emptyExploreText}>
                More events coming soon
              </Text>
            </View>
          ) : (
            exploreEvents
              .slice(0, 5)
              .map((event) => renderEventCard(event, true))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
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
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    backgroundColor: COLORS.surface,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: TEXT_COLOR,
  },
  headerSubtitle: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginTop: 4,
  },
  myProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.m,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  myProfileButtonIncomplete: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: "#F8F5FF",
  },
  myProfileText: {
    fontSize: 14,
    fontWeight: "500",
    color: TEXT_COLOR,
  },
  myProfileTextIncomplete: {
    color: PRIMARY_COLOR,
  },
  incompleteDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E65100",
  },
  activityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  incompleteBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: SPACING.l,
    marginBottom: SPACING.m,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    backgroundColor: "#FFF3E0",
    borderRadius: BORDER_RADIUS.m,
    gap: 8,
  },
  incompleteBannerText: {
    flex: 1,
    fontSize: 14,
    color: "#E65100",
    fontWeight: "500",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: SPACING.m,
  },
  section: {
    marginBottom: SPACING.l,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: LIGHT_TEXT_COLOR,
    letterSpacing: 1,
    paddingHorizontal: SPACING.l,
    marginBottom: SPACING.m,
  },
  eventCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.l,
    marginBottom: SPACING.m,
    borderRadius: BORDER_RADIUS.l,
    ...SHADOWS.sm,
  },
  eventCardContent: {
    padding: SPACING.m,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.s,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT_COLOR,
    flex: 1,
    marginRight: SPACING.s,
  },
  statusBadge: {
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.s,
  },
  upcomingBadge: {
    backgroundColor: "#E8F5E9",
  },
  pastBadge: {
    backgroundColor: "#F5F5F5",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  upcomingText: {
    color: "#2E7D32",
  },
  pastText: {
    color: LIGHT_TEXT_COLOR,
  },
  eventDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.m,
  },
  eventDetailText: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    marginLeft: 4,
    marginRight: SPACING.s,
  },
  eventDetailSeparator: {
    color: LIGHT_TEXT_COLOR,
    marginHorizontal: 4,
  },
  eventFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  attendeeInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  attendeeText: {
    fontSize: 13,
    color: PRIMARY_COLOR,
    fontWeight: "500",
    marginLeft: 4,
  },
  discoverHint: {
    fontSize: 13,
    color: PRIMARY_COLOR,
    fontWeight: "500",
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.l,
    borderRadius: BORDER_RADIUS.l,
    padding: SPACING.xl,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
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
  exploreCta: {
    marginTop: SPACING.m,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: BORDER_RADIUS.m,
  },
  exploreCtaText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  tabContainer: {
    marginBottom: SPACING.m,
  },
  tabContent: {
    paddingHorizontal: SPACING.l,
  },
  tabChip: {
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.s,
  },
  tabChipActive: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  tabChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: TEXT_COLOR,
  },
  tabChipTextActive: {
    color: "#FFFFFF",
  },
  emptyExplore: {
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.xl,
    alignItems: "center",
  },
  emptyExploreText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  errorBanner: {
    marginHorizontal: SPACING.l,
    marginBottom: SPACING.m,
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
  // Community suggestion styles
  communitiesScrollContent: {
    paddingHorizontal: SPACING.l,
    gap: SPACING.m,
  },
  communityCard: {
    width: 120,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.l,
    padding: SPACING.m,
    alignItems: "center",
    ...SHADOWS.sm,
  },
  communityLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: SPACING.s,
  },
  communityLogoPlaceholder: {
    backgroundColor: "#F0EAFF",
    justifyContent: "center",
    alignItems: "center",
  },
  communityName: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_COLOR,
    textAlign: "center",
    marginBottom: 4,
  },
  communityCategory: {
    fontSize: 11,
    color: LIGHT_TEXT_COLOR,
    textAlign: "center",
    marginBottom: 4,
  },
  communityFollowers: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  communityFollowerCount: {
    fontSize: 11,
    color: LIGHT_TEXT_COLOR,
  },
});
