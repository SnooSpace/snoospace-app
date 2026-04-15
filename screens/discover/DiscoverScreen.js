import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Image, Dimensions, ImageBackground } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BarChart3, User } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { apiGet } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import SnooLoader from "../../components/ui/SnooLoader";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  FONTS,
} from "../../constants/theme";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width * 0.75;
const PEOPLE_CARD_WIDTH = width * 0.4;
const COMMUNITY_CARD_WIDTH = width * 0.35;

export default function DiscoverScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [exploreEvents, setExploreEvents] = useState([]);
  const [suggestedCommunities, setSuggestedCommunities] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profileComplete, setProfileComplete] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadData();
      checkProfileCompletion();
    }, []),
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();

      if (token) {
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

        setPeople([
          {
            id: 1,
            name: "Sarah Jenkins",
            role: "Product Lead",
            interests: ["SaaS", "Product"],
            image: "https://i.pravatar.cc/150?u=sarah",
          },
          {
            id: 2,
            name: "David Chen",
            role: "Investor",
            interests: ["AI", "Tech"],
            image: "https://i.pravatar.cc/150?u=david",
          },
          {
            id: 3,
            name: "Maya Ross",
            role: "Marketing Head",
            interests: ["Growth", "Brand"],
            image: "https://i.pravatar.cc/150?u=maya",
          },
        ]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
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
        setProfileComplete(
          profile.intent_badges && profile.intent_badges.length > 0,
        );
      }
    } catch (error) {
      console.error("Error checking profile:", error);
    }
  };

  const handleEventPress = (event) =>
    navigation.navigate("ProfileFeed", { event });

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const renderReconnectSection = () => {
    if (events.length === 0) return null;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Reconnect with Peers</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Search")}>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        >
          {events.slice(0, 5).map((event) => (
            <TouchableOpacity
              key={event.id}
              style={styles.reconnectCard}
              activeOpacity={0.9}
              onPress={() => handleEventPress(event)}
            >
              <View style={styles.reconnectImageContainer}>
                <ImageBackground
                  source={{
                    uri:
                      event.cover_image ||
                      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80",
                  }}
                  style={{ flex: 1 }}
                >
                  <LinearGradient
                    colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.45)"]}
                    start={{ x: 0.5, y: 0.0 }}
                    end={{ x: 0.5, y: 1.0 }}
                    style={styles.imageGradient}
                  />
                  <View style={styles.pastBadge}>
                    <Text style={styles.pastBadgeText}>Past Event</Text>
                  </View>
                </ImageBackground>
              </View>
              <View style={styles.reconnectContent}>
                <Text style={styles.reconnectTitle} numberOfLines={2}>
                  {event.title}
                </Text>

                <View style={styles.reconnectMeta}>
                  <Ionicons name="calendar-outline" size={14} color="#64748B" />
                  <Text style={styles.metaText}>
                    {formatDate(event.event_date)}
                  </Text>

                  <View style={styles.attendeeRow}>
                    <Ionicons name="people-outline" size={14} color="#64748B" />
                    <Text style={styles.metaText}>
                      {event.attendee_count || 0} attended
                    </Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.revisitButton}>
                  <Ionicons name="time-outline" size={16} color="#2962FF" />
                  <Text style={styles.revisitButtonText}>Revisit</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
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
        >
          {suggestedCommunities.map((community) => (
            <TouchableOpacity
              key={community.id}
              style={styles.tribeCard}
              onPress={() =>
                navigation.navigate("CommunityPublicProfile", {
                  communityId: community.id,
                })
              }
              activeOpacity={0.97}
            >
              <View style={styles.tribeVisualContainer}>
                <ImageBackground
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
                </ImageBackground>
              </View>

              <View style={styles.tribeContent}>
                <Text style={styles.tribeName} numberOfLines={1}>
                  {community.name}
                </Text>
                <Text style={styles.tribeMembers}>
                  {community.follower_count || 0} members
                </Text>
                <TouchableOpacity style={styles.joinButton}>
                  <Text style={styles.joinButtonText}>Join</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderPeopleSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitleContainer}>People You Should Meet</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
      >
        {people.map((person) => (
          <TouchableOpacity
            key={person.id}
            style={styles.personCard}
            activeOpacity={0.9}
          >
            <Image source={{ uri: person.image }} style={styles.personImage} />
            <Text style={styles.personName} numberOfLines={1}>
              {person.name}
            </Text>
            <Text style={styles.personRole} numberOfLines={1}>
              {person.role}
            </Text>
            <View style={styles.interestsContainer}>
              {person.interests.map((interest, index) => (
                <View key={index} style={styles.interestTag}>
                  <Text style={styles.interestText}>#{interest}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderEventsSection = () => {
    if (exploreEvents.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitleContainer}>Recommended Events</Text>
        {exploreEvents.slice(0, 5).map((event) => (
          <TouchableOpacity
            key={event.id}
            style={styles.recommendedCard}
            onPress={() => handleEventPress(event)}
            activeOpacity={0.9}
          >
            <ImageBackground
              source={{
                uri:
                  event.cover_image ||
                  "https://images.unsplash.com/photo-1551818255-e6e10975bc17?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80",
              }}
              style={styles.recommendedImage}
            >
              <LinearGradient // added usage of Gradient on cards
                colors={["transparent", "rgba(0,0,0,0.6)"]}
                style={styles.imageGradient}
              />
              <View style={styles.priceBadge}>
                <Text style={styles.priceText}>Free</Text>
              </View>
            </ImageBackground>

            <View style={styles.recommendedContent}>
              <Text style={styles.recommendedTitle}>{event.title}</Text>
              <Text style={styles.recommendedHost}>
                Hosted by {event.organizer || "Community"}
              </Text>

              <View style={styles.recommendedMetaRow}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={COLORS.textSecondary}
                />
                <Text style={styles.recommendedMetaText}>
                  {formatDate(event.event_date)}
                </Text>
              </View>
              <View style={styles.recommendedMetaRow}>
                <Ionicons
                  name="location-outline"
                  size={14}
                  color={COLORS.textSecondary}
                />
                <Text style={styles.recommendedMetaText} numberOfLines={1}>
                  {event.venue_name || event.location}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.viewEventButton}
                onPress={() => handleEventPress(event)}
              >
                <Text style={styles.viewEventText}>View Event</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
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
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { fontFamily: 'Manrope-Medium' }]}>Discover</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate("ActivityInsights")}
            hitSlop={{ top: 20, bottom: 20, left: 10, right: 10 }}
          >
            <BarChart3 size={26} color={COLORS.editorial.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate("EditDiscoverProfile")}
            hitSlop={{ top: 20, bottom: 20, left: 10, right: 20 }}
          >
            <View style={styles.avatarContainer}>
              <User size={22} color={COLORS.editorial.textSecondary} />
              {!profileComplete && <View style={styles.profileBadge} />}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderReconnectSection()}
        {renderTribeSection()}
        {renderPeopleSection()}
        {renderEventsSection()}
        <View style={{ height: 40 }} />
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
  reconnectCard: {
    width: 312,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    ...SHADOWS.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
    overflow: "hidden",
    marginBottom: 4, // Space for shadow
  },
  reconnectImageContainer: {
    height: 140,
    backgroundColor: "#eee",
  },
  imageGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "100%",
  },
  pastBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    height: 24,
    borderRadius: 999,
    justifyContent: "center",
  },
  pastBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: "#FFFFFF",
  },
  reconnectContent: {
    padding: 16,
  },
  reconnectTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    lineHeight: 22,
    color: "#0F172A",
    marginBottom: 8, // Spacing between title and meta
  },
  reconnectMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  metaText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: "#64748B",
    marginLeft: 6,
  },
  attendeeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12, // Space between date and attendees
  },
  revisitButton: {
    width: "100%",
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    marginTop: 12,
    flexDirection: "row",
    gap: 6,
  },
  revisitButtonText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#2962FF",
  },

  // Tribe Section
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

  // People Section
  personCard: {
    width: PEOPLE_CARD_WIDTH,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.m,
    alignItems: "center",
    ...SHADOWS.sm,
    marginVertical: 4, // Space for shadow
  },
  personImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: SPACING.s,
    backgroundColor: COLORS.textMuted,
  },
  personName: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 2,
  },
  personRole: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  interestsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  interestTag: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  interestText: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: COLORS.textSecondary,
  },

  // Recommended Events Section
  recommendedCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    marginHorizontal: SPACING.l,
    marginBottom: SPACING.l,
    ...SHADOWS.md,
    overflow: "hidden",
  },
  recommendedImage: {
    height: 180, // Taller image
    width: "100%",
    justifyContent: "space-between",
    padding: SPACING.s,
  },
  priceBadge: {
    alignSelf: "flex-end",
    backgroundColor: "#FFF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  priceText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  recommendedContent: {
    padding: SPACING.m,
  },
  recommendedTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 18,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  recommendedHost: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.m,
  },
  recommendedMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  recommendedMetaText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  viewEventButton: {
    marginTop: SPACING.m,
    backgroundColor: "#F5F7FA",
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.l,
    alignItems: "center",
  },
  viewEventText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
});
