import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Dimensions, Alert, InteractionManager, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarChart3, User, Calendar, Users, Clock, MapPin } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { apiGet } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import SnooLoader from "../../components/ui/SnooLoader";
import OpenPlansSection from "../plans/OpenPlansSection";
import EventCard from "../../components/EventCard";
import EventBus from "../../utils/EventBus";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  FONTS,
} from "../../constants/theme";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width * 0.75;
const COMMUNITY_CARD_WIDTH = width * 0.35;

const EDGES = ["top"];
const AVATAR_HITSLOP = { top: 20, bottom: 20, left: 10, right: 20 };
const INSIGHTS_HITSLOP = { top: 20, bottom: 20, left: 10, right: 10 };

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function DiscoverScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [exploreEvents, setExploreEvents] = useState([]);
  const [suggestedCommunities, setSuggestedCommunities] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [profileComplete, setProfileComplete] = useState(true);
  const [userPhoto, setUserPhoto] = useState(null);
  const hasLoadedRef = useRef(false);



  const loadData = useCallback(async () => {
    try {
      if (!hasLoadedRef.current) {
        setLoading(true);
      }
      const token = await getAuthToken();

      if (token) {
        const [eventsResponse, exploreResponse, suggestionsResponse, recommendationsResponse] =
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
            apiGet("/api/recommendations", 15000, token).catch(() => ({
              recommendations: [],
            })),
          ]);

        setEvents(eventsResponse.events || []);
        setExploreEvents(exploreResponse.events || []);
        setSuggestedCommunities(suggestionsResponse.suggestions || []);

        const recs = recommendationsResponse.recommendations || [];
        setPeople(
          recs.map(rec => ({
            id: rec.candidate_id,
            name: rec.profile?.name || null,
            occupation: rec.profile?.occupation || null,
            image: rec.profile?.profile_photo_url || null,
            top_reasons: Array.isArray(rec.top_reasons) ? rec.top_reasons : [],
          }))
        );
        hasLoadedRef.current = true;
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshKey(k => k + 1);
    try {
      await Promise.all([loadData(), checkProfileCompletion()]);
    } catch (error) {
      console.error("Error refreshing discover:", error);
    } finally {
      setRefreshing(false);
    }
  }, [loadData, checkProfileCompletion]);

  const checkProfileCompletion = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (token) {
        const response = await apiGet("/members/profile", 15000, token);
        const profile = response.profile || response;
        // Minimum requirements: 3 discover photos, 1+ Spark, 1+ opener
        const photos = Array.isArray(profile.discover_photos) ? profile.discover_photos : [];
        if (photos.length > 0) {
          setUserPhoto(photos[0]);
        } else {
          setUserPhoto(null);
        }
        const sparks = Array.isArray(profile.sparks) ? profile.sparks : [];
        const openers = Array.isArray(profile.openers) ? profile.openers : [];
        setProfileComplete(
          photos.length >= 3 && sparks.length >= 1 && openers.length >= 1
        );
      }
    } catch (error) {
      console.error("Error checking profile:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        loadData();
        checkProfileCompletion();
      });
      return () => task.cancel();
    }, [loadData, checkProfileCompletion]),
  );

  const handleEventPress = useCallback((event) => {
    navigation.navigate("ProfileFeed", { event });
  }, [navigation]);

  const handleCommunityPress = useCallback((communityId) => {
    navigation.navigate("CommunityPublicProfile", { communityId });
  }, [navigation]);

  const handleSearchPress = useCallback(() => {
    navigation.navigate("Search");
  }, [navigation]);

  const handleInsightsPress = useCallback(() => {
    navigation.navigate("ActivityInsights");
  }, [navigation]);

  const handleEditProfilePress = useCallback(() => {
    navigation.navigate("EditDiscoverProfile");
  }, [navigation]);

  const slicedEvents = useMemo(() => events.slice(0, 5), [events]);
  const slicedExploreEvents = useMemo(() => exploreEvents.slice(0, 5), [exploreEvents]);

  const renderReconnectSection = () => {
    if (slicedEvents.length === 0) return null;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Catch the Ones You Missed</Text>
          <TouchableOpacity onPress={handleSearchPress}>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          onScrollBeginDrag={() => EventBus.emit("disable-tab-swipe")}
          onScrollEndDrag={() => EventBus.emit("enable-tab-swipe")}
          onMomentumScrollEnd={() => EventBus.emit("enable-tab-swipe")}
        >
          {slicedEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onPress={handleEventPress}
              onAttendeesPress={() => handleEventPress(event)}
              hideEngagement={true}
              hideRsvp={true}
              hideQr={true}
              hidePriceDetails={true}
              showStatusLabel={true}
              compact={true}
              style={{ width: 312, marginHorizontal: 0, marginVertical: 4 }}
            />
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderTribeSection = () => {
    if (suggestedCommunities.length === 0) return null;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Find Your Tribe</Text>
            <Text style={styles.sectionSubtitle}>
              Communities based on your profile
            </Text>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          onScrollBeginDrag={() => EventBus.emit("disable-tab-swipe")}
          onScrollEndDrag={() => EventBus.emit("enable-tab-swipe")}
          onMomentumScrollEnd={() => EventBus.emit("enable-tab-swipe")}
        >
          {suggestedCommunities.map((community) => (
            <TribeCard
              key={community.id}
              community={community}
              onPress={handleCommunityPress}
            />
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderPeopleSection = () => {
    if (people.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitleContainer}>People You Should Meet</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
          onScrollBeginDrag={() => EventBus.emit("disable-tab-swipe")}
          onScrollEndDrag={() => EventBus.emit("enable-tab-swipe")}
          onMomentumScrollEnd={() => EventBus.emit("enable-tab-swipe")}
        >
          {people.map((person) => (
            <DiscoverScreenPersonCard
              key={person.id}
              person={person}
              onPress={() => navigation.navigate("MemberPublicProfile", { memberId: person.id })}
            />
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderEventsSection = () => {
    if (slicedExploreEvents.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitleContainer}>Recommended Events</Text>
        {slicedExploreEvents.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onPress={handleEventPress}
            onAttendeesPress={() => handleEventPress(event)}
            hideEngagement={true}
            hideRsvp={true}
            hideQr={true}
            hidePriceDetails={true}
            showStatusLabel={true}
            compact={true}
            style={{ marginHorizontal: 16, marginVertical: 8 }}
          />
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <SnooLoader size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ backgroundColor: COLORS.screenBackground }} edges={EDGES}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { fontFamily: 'Manrope-Medium' }]}>Discover</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleInsightsPress}
              hitSlop={INSIGHTS_HITSLOP}
            >
              <BarChart3 size={26} color={COLORS.editorial.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleEditProfilePress}
              hitSlop={AVATAR_HITSLOP}
              style={{ position: "relative" }}
            >
              <View style={styles.avatarContainer}>
                {userPhoto ? (
                  <Image
                    source={{ uri: userPhoto }}
                    style={styles.avatarImage}
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <User size={22} color={COLORS.editorial.textSecondary} />
                )}
              </View>
              {!profileComplete && <View style={styles.profileBadge} />}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {renderReconnectSection()}
        <View style={styles.sectionDivider} />
        <OpenPlansSection navigation={navigation} refreshKey={refreshKey} />
        <View style={styles.sectionDivider} />
        {renderTribeSection()}
        {renderPeopleSection()}
        {renderEventsSection()}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const ExpoImageBackground = ({ source, style, children }) => (
  <View style={style}>
    <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
    {children}
  </View>
);



const TribeCard = React.memo(({ community, onPress }) => (
  <TouchableOpacity
    style={styles.tribeCard}
    onPress={() => onPress(community.id)}
    activeOpacity={0.97}
  >
    <View style={styles.tribeVisualContainer}>
      <ExpoImageBackground
        source={{
          uri:
            community.logo_url ||
            "https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
        }}
        style={styles.tribeVisual}
      >
        <LinearGradient
          colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.35)"]}
          start={{ x: 0.5, y: 0.0 }}
          end={{ x: 0.5, y: 1.0 }}
          style={styles.tribeVisualGradient}
        />
      </ExpoImageBackground>
    </View>

    <View style={styles.tribeContent}>
      <Text style={styles.tribeName} numberOfLines={1}>
        {community.name}
      </Text>
      <Text style={styles.tribeMembers}>
        {community.follower_count || 0} members
      </Text>
      <TouchableOpacity style={styles.joinButton} onPress={() => onPress(community.id)}>
        <Text style={styles.joinButtonText}>Join</Text>
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
));

/** Maps a top_reasons entry to a human-readable sentence. */
function formatReason(reason) {
  if (!reason) return null;
  const { type, label } = reason;
  switch (type) {
    case 'shared_event':      return `You both went to ${label}`;
    case 'shared_community':  return `You're both in ${label}`;
    case 'shared_spark':      return label; // backend already formats: spark label OR "Compatible professional goals"
    case 'shared_interest':   return `You both like ${label}`;
    case 'same_college':      return `Both from ${label}`;
    case 'mutual_circles':    return label; // backend formats: "{N} mutual connection(s)"
    default:                  return label || null;
  }
}

const DiscoverScreenPersonCard = React.memo(({ person, onPress }) => {
  // Pick the first valid reason; fall back to a neutral tag
  const reasonText = (person.top_reasons || [])
    .map(formatReason)
    .find(Boolean) || 'Active this week';

  const displayName = person.name || person.occupation || '';

  return (
    <TouchableOpacity
      style={styles.personCard}
      activeOpacity={0.82}
      onPress={onPress}
    >
      {/* Avatar */}
      {person.image ? (
        <Image
          source={{ uri: person.image }}
          style={styles.personCardImage}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[styles.personCardImage, styles.personCardImageFallback]}>
          <User size={26} color="#94A3B8" strokeWidth={1.8} />
        </View>
      )}

      {/* Text block */}
      <View style={styles.personCardContent}>
        {!!displayName && (
          <Text style={styles.personCardName} numberOfLines={1}>{displayName}</Text>
        )}
        {/* Reason tag */}
        <View style={styles.personCardReasonTag}>
          <Text style={styles.personCardReasonText} numberOfLines={2}>{reasonText}</Text>
        </View>
      </View>
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
    backgroundColor: COLORS.screenBackground,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    backgroundColor: COLORS.screenBackground,
  },
  headerTitle: {
    fontFamily: FONTS.primary, // Strict BasicCommercialBold
    fontSize: 28,
    color: COLORS.textPrimary,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.m, // 16px gap
  },
  iconButton: {
    padding: 4,
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  profileBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.error,
    borderWidth: 1.5,
    borderColor: COLORS.surface,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xl,
  },
  section: {
    marginBottom: 32, // Increased spacing for visual rhythm
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end", // Align baseline
    paddingHorizontal: SPACING.l,
    marginBottom: SPACING.m,
  },
  sectionTitleContainer: {
    paddingHorizontal: SPACING.l,
    marginBottom: SPACING.m,
    fontFamily: FONTS.primary,
    fontSize: 20,
    color: COLORS.textPrimary,
  },
  sectionTitle: {
    fontFamily: FONTS.primary, // Strict BasicCommercialBold
    fontSize: 20,
    color: COLORS.textPrimary,
    lineHeight: 24,
  },
  sectionSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  seeAllText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.primary,
  },
  horizontalList: {
    paddingHorizontal: SPACING.l,
    gap: SPACING.m,
  },

  // Reconnect Section
  tribeCard: {
    width: 156,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    ...SHADOWS.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
    overflow: "hidden",
    marginVertical: 4, // Space for shadow
  },
  tribeVisualContainer: {
    height: 88,
    margin: 12,
    borderRadius: 14,
    backgroundColor: "#EFF6FF", // Fallback color
    overflow: "hidden",
  },
  tribeVisual: {
    width: "100%",
    height: "100%",
  },
  tribeVisualGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "100%",
  },
  tribeContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  tribeName: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    lineHeight: 20,
    color: "#0F172A",
    marginBottom: 6,
  },
  tribeMembers: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#64748B",
    marginBottom: 0,
  },
  joinButton: {
    width: "100%",
    height: 34,
    backgroundColor: "#2962FF",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  joinButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: "#FFFFFF",
  },

  // People You Should Meet — card
  personCard: {
    width: 148,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    overflow: "hidden",
    marginVertical: 4,
  },
  personCardImage: {
    width: "100%",
    height: 148,
    backgroundColor: "#F1F5F9",
  },
  personCardImageFallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  personCardContent: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 6,
  },
  personCardName: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: "#0F172A",
    lineHeight: 18,
  },
  personCardReasonTag: {
    alignSelf: "flex-start",
    backgroundColor: "#F0F4FF",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  personCardReasonText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: "#2962FF",
    lineHeight: 15,
  },

  // Recommended Events Section
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 16,
    marginVertical: 4,
  },
});
