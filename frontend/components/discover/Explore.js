import React from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ImageBackground
} from "react-native";
import { ChevronRight, X, Briefcase, Calendar, Sparkles } from "lucide-react-native";
import { getCategoryColor } from "../../constants/categoryColors";
import { COLORS } from "../../constants/theme";

/**
 * AvatarStack Component
 * Renders overlapping avatars with attending count
 */
const AvatarStack = ({ avatars, count }) => {
  if (!avatars || avatars.length === 0) return null;
  return (
    <View style={styles.avatarStackContainer}>
      <View style={styles.avatarsRow}>
        {avatars.map((av, idx) => (
          <Image
            key={idx}
            source={{ uri: av.profile_photo_url || "https://via.placeholder.com/24" }}
            style={[styles.avatarImage, { marginLeft: idx > 0 ? -8 : 0 }]}
          />
        ))}
      </View>
      <Text style={styles.avatarCountText}>
        {count > 0 ? `+${count} attending` : "Be the first to attend"}
      </Text>
    </View>
  );
};

export default function Explore({
  feedData = {},
  loading = false,
  refreshing = false,
  onRefresh,
  onEventPress,
  onDismissOpportunities,
  navigation
}) {
  const {
    liveNow = [],
    hero = null,
    weekend = [],
    categoryRails = [],
    somethingDifferent = [],
    creatorOpportunities = null
  } = feedData;

  const handleEventPress = (eventId, eventData) => {
    if (onEventPress) {
      onEventPress({ id: eventId, ...eventData });
    } else if (navigation) {
      navigation.navigate("EventDetails", {
        eventId,
        eventData
      });
    }
  };

  const handleSeeAll = (slug, categoryName) => {
    if (navigation) {
      navigation.navigate("CategoryEvents", {
        categorySlug: slug,
        categoryName
      });
    }
  };

  // Live now accent ring styling
  const renderLiveNow = () => {
    if (liveNow.length === 0) return null;
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.liveHeader}>
          <View style={styles.liveIndicator} />
          <Text style={styles.sectionTitle}>Live Now</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScrollPadding}
        >
          {liveNow.map((item) => (
            <TouchableOpacity
              key={item.eventId}
              style={styles.liveBubbleContainer}
              activeOpacity={0.8}
              onPress={() => handleEventPress(item.eventId, item)}
            >
              <View style={styles.liveRingOuter}>
                <Image
                  source={{ uri: item.coverUrl || "https://via.placeholder.com/48" }}
                  style={styles.liveThumbnail}
                />
              </View>
              <Text style={styles.liveBubbleLabel} numberOfLines={1}>
                {item.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Hero Card Section
  const renderHero = () => {
    if (!hero) return null;
    const colors = getCategoryColor(hero.category_slug, hero.eventId);
    const dateStr = hero.startTime
      ? new Date(hero.startTime).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit"
        })
      : "";

    return (
      <View style={styles.sectionContainer}>
        <TouchableOpacity
          style={styles.heroCard}
          activeOpacity={0.9}
          onPress={() => handleEventPress(hero.eventId, hero)}
        >
          <ImageBackground
            source={{ uri: hero.coverUrl || "https://via.placeholder.com/350x150" }}
            style={styles.heroBackground}
            imageStyle={styles.heroBackgroundImage}
          >
            {/* Scrim gradient layer */}
            <View style={styles.scrimOverlay} />

            <View style={styles.heroContentContainer}>
              <View style={styles.heroTopRow}>
                <View style={[styles.categoryBadge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.categoryBadgeText, { color: colors.text }]}>
                    {hero.category}
                  </Text>
                </View>
                {dateStr ? <Text style={styles.heroDateText}>{dateStr}</Text> : null}
              </View>

              <View style={styles.heroBottomRow}>
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {hero.title}
                </Text>
                <AvatarStack
                  avatars={hero.attendeeAvatars || []}
                  count={hero.attendeeCount || 0}
                />
              </View>
            </View>
          </ImageBackground>
        </TouchableOpacity>
      </View>
    );
  };

  // Bento Weekend Rows Section
  const renderWeekend = () => {
    if (weekend.length === 0) return null;

    // Fallback to normal horizontal rail if fewer than 3 events
    if (weekend.length < 3) {
      return (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>This Weekend</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScrollPadding}
          >
            {weekend.map((item) => {
              const colors = getCategoryColor(item.category_slug, item.eventId);
              return (
                <TouchableOpacity
                  key={item.eventId}
                  style={styles.weekendRailCard}
                  activeOpacity={0.8}
                  onPress={() => handleEventPress(item.eventId, item)}
                >
                  <Image
                    source={{ uri: item.coverUrl || "https://via.placeholder.com/140x80" }}
                    style={styles.weekendRailImage}
                  />
                  <View style={styles.cardPadding}>
                    <View style={[styles.miniCategoryBadge, { backgroundColor: colors.bg }]}>
                      <Text style={[styles.miniCategoryBadgeText, { color: colors.text }]}>
                        {item.category}
                      </Text>
                    </View>
                    <Text style={styles.weekendRailTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      );
    }

    // Bento Grid Layout (1 Large, 2 Stacked Small)
    const largeEvent = weekend[0];
    const smallEvent1 = weekend[1];
    const smallEvent2 = weekend[2];

    const largeColors = getCategoryColor(largeEvent.category_slug, largeEvent.eventId);
    const small1Colors = getCategoryColor(smallEvent1.category_slug, smallEvent1.eventId);
    const small2Colors = getCategoryColor(smallEvent2.category_slug, smallEvent2.eventId);

    return (
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>This Weekend</Text>
        <View style={styles.bentoRow}>
          {/* Large Left Card (~58%) */}
          <TouchableOpacity
            style={styles.bentoLargeCard}
            activeOpacity={0.8}
            onPress={() => handleEventPress(largeEvent.eventId, largeEvent)}
          >
            <Image
              source={{ uri: largeEvent.coverUrl || "https://via.placeholder.com/200x130" }}
              style={styles.bentoLargeImage}
            />
            <View style={styles.bentoContent}>
              <View style={[styles.miniCategoryBadge, { backgroundColor: largeColors.bg }]}>
                <Text style={[styles.miniCategoryBadgeText, { color: largeColors.text }]}>
                  {largeEvent.category}
                </Text>
              </View>
              <Text style={styles.bentoLargeTitle} numberOfLines={2}>
                {largeEvent.title}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Stacked Right Column (~42%) */}
          <View style={styles.bentoRightColumn}>
            {/* Small Card 1 */}
            <TouchableOpacity
              style={styles.bentoSmallCard}
              activeOpacity={0.8}
              onPress={() => handleEventPress(smallEvent1.eventId, smallEvent1)}
            >
              <View style={styles.bentoSmallContent}>
                <View style={[styles.miniCategoryBadge, { backgroundColor: small1Colors.bg }]}>
                  <Text style={[styles.miniCategoryBadgeText, { color: small1Colors.text }]}>
                    {smallEvent1.category}
                  </Text>
                </View>
                <Text style={styles.bentoSmallTitle} numberOfLines={1}>
                  {smallEvent1.title}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Small Card 2 */}
            <TouchableOpacity
              style={styles.bentoSmallCard}
              activeOpacity={0.8}
              onPress={() => handleEventPress(smallEvent2.eventId, smallEvent2)}
            >
              <View style={styles.bentoSmallContent}>
                <View style={[styles.miniCategoryBadge, { backgroundColor: small2Colors.bg }]}>
                  <Text style={[styles.miniCategoryBadgeText, { color: small2Colors.text }]}>
                    {smallEvent2.category}
                  </Text>
                </View>
                <Text style={styles.bentoSmallTitle} numberOfLines={1}>
                  {smallEvent2.title}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // Category Rails Section
  const renderCategoryRails = () => {
    return categoryRails.map((rail, index) => {
      if (rail.events.length === 0) return null;
      return (
        <View key={index} style={styles.sectionContainer}>
          <View style={styles.railHeader}>
            <Text style={styles.sectionTitle}>{rail.category}</Text>
            <TouchableOpacity
              onPress={() => handleSeeAll(rail.categorySlug, rail.category)}
            >
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScrollPadding}
          >
            {rail.events.map((event) => {
              return (
                <TouchableOpacity
                  key={event.eventId}
                  style={styles.railCard}
                  activeOpacity={0.8}
                  onPress={() => handleEventPress(event.eventId, event)}
                >
                  <Image
                    source={{ uri: event.coverUrl || "https://via.placeholder.com/140x80" }}
                    style={styles.railCardImage}
                  />
                  <View style={styles.cardPadding}>
                    <View style={[styles.miniCategoryBadge, { backgroundColor: rail.categoryColor.bg }]}>
                      <Text style={[styles.miniCategoryBadgeText, { color: rail.categoryColor.text }]}>
                        {rail.category}
                      </Text>
                    </View>
                    <Text style={styles.railCardTitle} numberOfLines={2}>
                      {event.title}
                    </Text>
                    <Text style={styles.railCardMetadata}>
                      {event.attendeeCount > 0 ? `${event.attendeeCount} attending` : ""}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      );
    });
  };

  // Serendipity Rail (Something Different)
  const renderSomethingDifferent = () => {
    if (somethingDifferent.length === 0) return null;
    const colors = getCategoryColor("serendipity", 999);

    return (
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Something different</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScrollPadding}
        >
          {somethingDifferent.map((event) => (
            <TouchableOpacity
              key={event.eventId}
              style={styles.railCard}
              activeOpacity={0.8}
              onPress={() => handleEventPress(event.eventId, event)}
            >
              <Image
                source={{ uri: event.coverUrl || "https://via.placeholder.com/140x80" }}
                style={styles.railCardImage}
              />
              <View style={styles.cardPadding}>
                <View style={[styles.miniCategoryBadge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.miniCategoryBadgeText, { color: colors.text }]}>
                    Serendipity
                  </Text>
                </View>
                <Text style={styles.railCardTitle} numberOfLines={2}>
                  {event.title}
                </Text>
                <Text style={styles.railCardMetadata}>
                  {event.attendeeCount > 0 ? `${event.attendeeCount} attending` : ""}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Creator opportunities banner
  const renderOpportunitiesBanner = () => {
    if (!creatorOpportunities) return null;
    return (
      <View style={styles.bannerMargin}>
        <View style={styles.opportunitiesBanner}>
          <View style={styles.bannerLeftIconContainer}>
            <Briefcase size={20} color="#042C53" />
          </View>
          <TouchableOpacity
            style={styles.bannerTextContainer}
            activeOpacity={0.7}
            onPress={() => {
              if (navigation) {
                navigation.navigate("Opportunities");
              }
            }}
          >
            <Text style={styles.bannerTitleText}>
              {creatorOpportunities.count} new brand deals match your profile
            </Text>
            <ChevronRight size={18} color="#5F5E5A" style={styles.chevronMargin} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bannerCloseButton}
            onPress={onDismissOpportunities}
          >
            <X size={18} color="#5F5E5A" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#2C2C2A"
        />
      }
    >
      {renderOpportunitiesBanner()}
      {renderLiveNow()}
      {renderHero()}
      {renderWeekend()}
      {renderCategoryRails()}
      {renderSomethingDifferent()}
      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.screenBackground
  },
  contentContainer: {
    paddingVertical: 16
  },
  bottomSpacing: {
    height: 80
  },
  sectionContainer: {
    marginBottom: 24
  },
  sectionTitle: {
    fontFamily: "BasicCommercialBold",
    fontSize: 18,
    color: "#2C2C2A",
    marginLeft: 16,
    marginBottom: 12
  },
  seeAllText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: "#5F5E5A"
  },
  railHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: 16
  },
  horizontalScrollPadding: {
    paddingLeft: 16,
    paddingRight: 8
  },

  // Opportunities Banner
  bannerMargin: {
    marginHorizontal: 16,
    marginBottom: 20
  },
  opportunitiesBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "#D3D1C7",
    padding: 12
  },
  bannerLeftIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#B5D4F4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12
  },
  bannerTextContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 10
  },
  bannerTitleText: {
    flex: 1,
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: "#2C2C2A"
  },
  chevronMargin: {
    marginLeft: 4
  },
  bannerCloseButton: {
    padding: 4
  },

  // Live Now styling
  liveHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 16,
    marginBottom: 12
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D85A30",
    marginRight: 8
  },
  liveBubbleContainer: {
    alignItems: "center",
    marginRight: 16,
    width: 64
  },
  liveRingOuter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: "#D85A30",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0997B"
  },
  liveThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF"
  },
  liveBubbleLabel: {
    fontFamily: "Manrope-Medium",
    fontSize: 11,
    color: "#5F5E5A",
    marginTop: 4,
    textAlign: "center"
  },

  // Hero Card styling
  heroCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: "hidden",
    height: 150,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.5,
    borderColor: "#D3D1C7"
  },
  heroBackground: {
    flex: 1,
    width: "100%",
    height: "100%"
  },
  heroBackgroundImage: {
    resizeMode: "cover"
  },
  scrimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.35)"
  },
  heroContentContainer: {
    flex: 1,
    justifyContent: "space-between",
    padding: 16
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  heroBottomRow: {
    justifyContent: "flex-end"
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start"
  },
  categoryBadgeText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 12
  },
  heroDateText: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: "#FFFFFF"
  },
  heroTitle: {
    fontFamily: "BasicCommercialBold",
    fontSize: 18,
    color: "#FFFFFF",
    marginBottom: 8
  },

  // Avatar Stack styling
  avatarStackContainer: {
    flexDirection: "row",
    alignItems: "center"
  },
  avatarsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 6
  },
  avatarImage: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#FFFFFF"
  },
  avatarCountText: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: "#FFFFFF"
  },

  // Bento Weekend styling
  bentoRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    height: 130
  },
  bentoLargeCard: {
    flex: 0.58,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "#D3D1C7",
    overflow: "hidden",
    marginRight: 8
  },
  bentoLargeImage: {
    height: "50%",
    width: "100%",
    resizeMode: "cover"
  },
  bentoContent: {
    flex: 0.5,
    padding: 8,
    justifyContent: "space-between"
  },
  bentoLargeTitle: {
    fontFamily: "BasicCommercialBold",
    fontSize: 13,
    color: "#2C2C2A"
  },
  bentoRightColumn: {
    flex: 0.42,
    justifyContent: "space-between"
  },
  bentoSmallCard: {
    height: 61,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "#D3D1C7",
    padding: 8,
    justifyContent: "center"
  },
  bentoSmallContent: {
    justifyContent: "space-between",
    flex: 1
  },
  bentoSmallTitle: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 12,
    color: "#2C2C2A"
  },
  miniCategoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 4
  },
  miniCategoryBadgeText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 9
  },

  // Category and Serendipity rails
  railCard: {
    width: 140,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "#D3D1C7",
    overflow: "hidden",
    marginRight: 12
  },
  railCardImage: {
    width: "100%",
    height: 80,
    resizeMode: "cover"
  },
  cardPadding: {
    padding: 8,
    flex: 1,
    justifyContent: "space-between"
  },
  railCardTitle: {
    fontFamily: "BasicCommercialBold",
    fontSize: 12,
    color: "#2C2C2A",
    marginVertical: 4
  },
  railCardMetadata: {
    fontFamily: "Manrope-Medium",
    fontSize: 11,
    color: "#888780"
  },

  // Weekend Rail styling (fallback for fewer than 3 events)
  weekendRailCard: {
    width: 140,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "#D3D1C7",
    overflow: "hidden",
    marginRight: 12
  },
  weekendRailImage: {
    width: "100%",
    height: 80,
    resizeMode: "cover"
  },
  weekendRailTitle: {
    fontFamily: "BasicCommercialBold",
    fontSize: 12,
    color: "#2C2C2A",
    marginTop: 4
  }
});
