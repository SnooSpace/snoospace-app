import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Dimensions, Alert, InteractionManager, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarChart3, User, Calendar, Users, Clock, MapPin, Sparkles, ChevronRight, CalendarX, UserCheck } from "lucide-react-native";
import Svg, { Circle, Path, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { apiGet } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import SnooLoader from "../../components/ui/SnooLoader";
import GradientSafeArea from "../../components/ui/GradientSafeArea";
import OpenPlansSection from "../plans/OpenPlansSection";
import CompactEventCard from "../../components/cards/CompactEventCard";
import EventBus from "../../utils/EventBus";
import EdgeSwipeScrollView from "../../components/ui/EdgeSwipeScrollView";
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
  const [suggestedCommunities, setSuggestedCommunities] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [profileComplete, setProfileComplete] = useState(true);
  const [userPhoto, setUserPhoto] = useState(null);
  const [collegeInfo, setCollegeInfo] = useState(null);
  const hasLoadedRef = useRef(false);



  const loadData = useCallback(async () => {
    try {
      if (!hasLoadedRef.current) {
        setLoading(true);
      }
      const token = await getAuthToken();

      if (token) {
        const [eventsResponse, suggestionsResponse, recommendationsResponse] =
          await Promise.all([
            apiGet("/events/my-events", 15000, token).catch(() => ({
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
        setCollegeInfo(profile.college_info || null);
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

  const handlePastEventsPress = useCallback(() => {
    navigation.navigate("YourEvents", {
      screen: "YourEventsList",
      params: { tab: "Past", initialTab: "Past" },
    });
  }, [navigation]);

  const handleBrowseTribesPress = useCallback(() => {
    navigation.navigate("Search", {
      screen: "SearchMain",
      params: { filter: "communities", autoFocus: true },
    });
  }, [navigation]);

  const handleInsightsPress = useCallback(() => {
    navigation.navigate("ActivityInsights");
  }, [navigation]);

  const handleEditProfilePress = useCallback(() => {
    navigation.navigate("EditDiscoverProfile");
  }, [navigation]);

  const slicedEvents = useMemo(() => events.slice(0, 5), [events]);

  const renderReconnectSection = () => {
    const hasEvents = slicedEvents.length > 0;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Catch the Ones You Missed</Text>
          {hasEvents && (
            <TouchableOpacity
              style={styles.browseAllButton}
              onPress={handlePastEventsPress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.browseAllText}>See all</Text>
              <ChevronRight size={18} color={COLORS.primary} strokeWidth={2.2} />
            </TouchableOpacity>
          )}
        </View>
        {hasEvents ? (
          <EdgeSwipeScrollView
            showsHorizontalScrollIndicator={false}
            snapToInterval={175 + SPACING.m}
            decelerationRate="fast"
            snapToAlignment="start"
            contentContainerStyle={styles.horizontalList}
          >
            {slicedEvents.map((event) => (
              <View key={event.id} style={{ width: 175 }}>
                <CompactEventCard
                  event={event}
                  onPress={handleEventPress}
                  isPast={true}
                />
              </View>
            ))}
          </EdgeSwipeScrollView>
        ) : (
          <DiscoverEmptySectionCard
            icon={CalendarX}
            iconColor="#4F46E5"
            iconBg="#EEF2FF"
            iconBorder="#E0E7FF"
            title="No Past Events Yet"
            subtitle="Events you attend will appear here so you can easily reconnect with people you met."
            actionLabel="Browse Events"
            onAction={() =>
              navigation.navigate("Search", {
                screen: "SearchMain",
                params: { filter: "events", autoFocus: true },
              })
            }
          />
        )}
      </View>
    );
  };

  const renderTribeSection = () => {
    const hasTribes = suggestedCommunities.length > 0;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Find Your Tribe</Text>
            <Text style={styles.sectionSubtitle}>
              Matched to your Vibes & campus
            </Text>
          </View>
          <TouchableOpacity
            style={styles.browseAllButton}
            onPress={handleBrowseTribesPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.browseAllText}>See all</Text>
            <ChevronRight size={18} color={COLORS.primary} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
        {hasTribes ? (
          <EdgeSwipeScrollView
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {suggestedCommunities.map((community, index) => (
              <TribeCard
                key={community.id}
                community={community}
                index={index}
                onPress={handleCommunityPress}
              />
            ))}
          </EdgeSwipeScrollView>
        ) : (
          <DiscoverEmptySectionCard
            icon={Users}
            iconColor="#EA580C"
            iconBg="#FFF7ED"
            iconBorder="#FFEDD5"
            title="No Tribes Matched Yet"
            subtitle="Pick your vibes and interests in your profile to discover campus communities."
            actionLabel="Explore Communities"
            onAction={handleBrowseTribesPress}
          />
        )}
      </View>
    );
  };

  const renderPeopleSection = () => {
    const hasPeople = people.length > 0;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitleContainer}>People You Should Meet</Text>
        {hasPeople ? (
          <EdgeSwipeScrollView
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {people.map((person) => (
              <DiscoverScreenPersonCard
                key={person.id}
                person={person}
                onPress={() => navigation.navigate("MemberPublicProfile", { memberId: person.id })}
              />
            ))}
          </EdgeSwipeScrollView>
        ) : profileComplete ? (
          <DiscoverEmptySectionCard
            icon={UserCheck}
            iconColor="#2962FF"
            iconBg="#EFF6FF"
            iconBorder="#DBEAFE"
            title="No Matching Profiles Right Now"
            subtitle="Your Discover profile is all set. We're actively scanning for people with aligned interests, shared tribes, and mutual connections."
            actionLabel="Explore Communities"
            onAction={handleBrowseTribesPress}
          />
        ) : (
          <DiscoverEmptySectionCard
            icon={UserCheck}
            iconColor="#2962FF"
            iconBg="#EFF6FF"
            iconBorder="#DBEAFE"
            title="Unlock People Recommendations"
            subtitle="Add at least 3 photos, 1 spark, and 1 icebreaker to your Discover profile to unlock tailored recommendations."
            actionLabel="Complete Profile"
            onAction={handleEditProfilePress}
          />
        )}
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
      {/* Premium Gradient Overlay for Status Bar Contrast */}
      <GradientSafeArea variant="primary" />
      <SafeAreaView style={{ backgroundColor: "transparent" }} edges={EDGES}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Discover</Text>
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



const getGradientConfig = (index) => {
  const gradients = [
    {
      colors: ["#09091F", "#1A1A4A"],
      themeColor: "#2962FF",
      lineColor: "rgba(66, 98, 255, 0.15)",
      avatarColors: ["#448AFF", "#7B1FA2", "#00BFA5"],
      joinTextColor: "#2962FF",
      statusBg: "#2962FF",
      statusText: "#FFFFFF",
    },
    {
      colors: ["#010908", "#072421"],
      themeColor: "#00BFA5",
      lineColor: "rgba(0, 191, 165, 0.15)",
      avatarColors: ["#00BFA5", "#FBC02D", "#EC407A"],
      joinTextColor: "#057A6C",
      statusBg: "rgba(0, 191, 165, 0.2)",
      statusText: "#00E5FF",
    },
    {
      colors: ["#0A0402", "#281207"],
      themeColor: "#FF6D00",
      lineColor: "rgba(255, 109, 0, 0.15)",
      avatarColors: ["#FFD700", "#FF6D00", "#E53935"],
      joinTextColor: "#C62828",
      statusBg: "rgba(255, 109, 0, 0.2)",
      statusText: "#FFAB40",
    },
  ];
  return gradients[index % gradients.length];
};

const TribeCard = React.memo(({ community, onPress, index }) => {
  const gradient = getGradientConfig(index);
  const displayCategory = community.category || "Tribe";
  
  const hasEvents = community.upcoming_event_count && community.upcoming_event_count > 0;
  const statusTextStr = hasEvents 
    ? `${community.upcoming_event_count} event${community.upcoming_event_count > 1 ? 's' : ''}`
    : "ACTIVE";
  
  const statusBgColor = hasEvents ? gradient.statusBg : gradient.statusBg;
  const statusTextColor = hasEvents ? gradient.statusText : "#FFFFFF";

  return (
    <TouchableOpacity
      style={styles.tribeCard}
      onPress={() => onPress(community.id)}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={gradient.colors}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0.0 }}
        end={{ x: 0.5, y: 1.0 }}
      />

      <View
        style={[
          styles.geometricBox,
          {
            borderColor: gradient.lineColor,
            top: -15,
            right: -15,
            width: 100,
            height: 100,
            transform: [{ rotate: "12deg" }],
          },
        ]}
      />
      <View
        style={[
          styles.geometricBox,
          {
            borderColor: gradient.lineColor,
            bottom: -20,
            left: -20,
            width: 110,
            height: 110,
            transform: [{ rotate: "-8deg" }],
          },
        ]}
      />

      <View style={styles.cardTopRow}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText} numberOfLines={1}>
            {displayCategory}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusBgColor }]}>
          <Text style={[styles.statusText, { color: statusTextColor }]} numberOfLines={1}>
            {statusTextStr}
          </Text>
        </View>
      </View>

      <View>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {community.name}
        </Text>
        <View style={styles.cardBottomRow}>
          <View style={styles.memberContainer}>
            <View style={styles.avatarPile}>
              {gradient.avatarColors.map((color, i) => (
                <View
                  key={i}
                  style={[
                    styles.avatarDot,
                    {
                      backgroundColor: color,
                      marginLeft: i > 0 ? -6 : 0,
                      zIndex: 3 - i,
                    },
                  ]}
                />
              ))}
            </View>
            <Text style={styles.memberCountText}>
              +{community.follower_count || 12}
            </Text>
          </View>

          <View style={styles.joinButtonPill}>
            <Text style={[styles.joinButtonPillText, { color: gradient.joinTextColor }]}>
              Join
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

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
    case 'shared_artist':     return label; // backend formats: "You both like {Artist Name}"
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

const DiscoverEmptySectionCard = React.memo(({
  icon: IconComponent,
  iconColor = "#2962FF",
  iconBg = "#EFF6FF",
  iconBorder = "#DBEAFE",
  title,
  subtitle,
  actionLabel,
  onAction,
}) => {
  return (
    <View style={styles.emptyCardContainer}>
      {/* Subtle Custom Illustrated SVG Geometry Backdrop */}
      <View style={styles.emptyCardSvgWrapper} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 320 120" preserveAspectRatio="none">
          <Defs>
            <SvgLinearGradient id={`emptyGrad1_${title.replace(/\s+/g, '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={iconColor} stopOpacity="0.08" />
              <Stop offset="100%" stopColor={iconColor} stopOpacity="0.01" />
            </SvgLinearGradient>
            <SvgLinearGradient id={`emptyGrad2_${title.replace(/\s+/g, '')}`} x1="100%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={iconColor} stopOpacity="0.06" />
              <Stop offset="100%" stopColor={iconColor} stopOpacity="0.0" />
            </SvgLinearGradient>
          </Defs>
          <Circle cx="290" cy="15" r="55" fill={`url(#emptyGrad1_${title.replace(/\s+/g, '')})`} />
          <Circle cx="30" cy="105" r="45" fill={`url(#emptyGrad2_${title.replace(/\s+/g, '')})`} />
          <Path
            d="M -15,55 Q 75,10 160,50 T 335,25"
            fill="none"
            stroke={iconColor}
            strokeWidth="1"
            strokeOpacity="0.08"
            strokeDasharray="4 4"
          />
        </Svg>
      </View>

      {/* Card Content */}
      <View style={styles.emptyCardContent}>
        <View style={[styles.emptyIconCircle, { backgroundColor: iconBg, borderColor: iconBorder }]}>
          <IconComponent size={22} color={iconColor} strokeWidth={2} />
        </View>

        <Text style={styles.emptyCardTitle}>{title}</Text>
        <Text style={styles.emptyCardSubtitle}>{subtitle}</Text>

        {actionLabel && onAction && (
          <TouchableOpacity
            style={[styles.emptyCardActionBtn, { backgroundColor: iconColor }]}
            onPress={onAction}
            activeOpacity={0.82}
          >
            <Text style={styles.emptyCardActionText}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
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
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: "transparent",
  },
  headerTitle: {
    fontFamily: FONTS.black,
    fontSize: 34,
    color: COLORS.textPrimary,
    letterSpacing: -1,
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
    fontSize: 18,
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  sectionTitle: {
    fontFamily: FONTS.primary, // Strict BasicCommercialBold
    fontSize: 18,
    color: COLORS.textPrimary,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  seeAllText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.primary,
  },
  horizontalList: {
    paddingHorizontal: SPACING.l,
    paddingTop: 4,
    paddingBottom: 14,
    gap: SPACING.m,
  },

  // Reconnect Section
  tribeCard: {
    width: 165,
    height: 205,
    backgroundColor: "#000000",
    borderRadius: 20,
    overflow: "hidden",
    marginVertical: 6,
    position: "relative",
    padding: 14,
    justifyContent: "space-between",
    ...SHADOWS.md,
  },
  geometricBox: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 6,
    opacity: 0.8,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  categoryBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: "50%",
  },
  categoryText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: "#FFFFFF",
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
  },
  cardTitle: {
    fontFamily: FONTS.primary,
    fontSize: 18,
    color: "#FFFFFF",
    lineHeight: 22,
    marginBottom: 10,
    zIndex: 10,
  },
  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  memberContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarPile: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#000000",
  },
  memberCountText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#FFFFFF",
    marginLeft: 6,
  },
  joinButtonPill: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  joinButtonPillText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  browseAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 4,
    paddingLeft: 8,
  },
  browseAllText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.primary,
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

  // Empty State Styles
  emptyCardContainer: {
    marginHorizontal: SPACING.l,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    overflow: "hidden",
    position: "relative",
    ...SHADOWS.sm,
  },
  emptyCardSvgWrapper: {
    ...StyleSheet.absoluteFillObject,
  },
  emptyCardContent: {
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emptyCardTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 4,
  },
  emptyCardSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  emptyCardActionBtn: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  emptyCardActionText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: "#FFFFFF",
  },

  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 16,
    marginVertical: 4,
  },
});
