import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ImageBackground,
  Dimensions
} from "react-native";
import {
  ChevronRight,
  X,
  Briefcase,
  Calendar,
  Sparkles,
  Bookmark,
  Video
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { getCategoryColor } from "../../constants/categoryColors";
import { COLORS, SHADOWS, FONTS } from "../../constants/theme";
import { getOptimizedImageUrl } from "../../utils/imageUtils";
import { toggleEventInterest } from "../../api/events";
import EventBus from "../../utils/EventBus";
import HapticsService from "../../services/HapticsService";
import CompactEventCard from "../cards/CompactEventCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_WIDTH = SCREEN_WIDTH - 32;
const RAIL_CARD_WIDTH = 160;
const BENTO_LARGE_WIDTH = (SCREEN_WIDTH - 40) * 0.58;

const FILTER_OPTIONS = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "weekend", label: "This Weekend" },
  { id: "free", label: "Free" },
  { id: "virtual", label: "Virtual" }
];

/**
 * AvatarStack Component
 * Renders overlapping avatars with attending count
 */
const AvatarStack = ({ avatars, count, dateStr, textColor = "#888780" }) => {
  if (!avatars || avatars.length === 0) return null;
  return (
    <View style={styles.avatarStackContainer}>
      <View style={styles.avatarsRow}>
        {avatars.map((av, idx) => (
          <Image
            key={idx}
            source={{ uri: getOptimizedImageUrl(av.profile_photo_url, { width: 24 }) || "https://via.placeholder.com/24" }}
            style={[styles.avatarImage, { marginLeft: idx > 0 ? -8 : 0 }]}
          />
        ))}
      </View>
      <Text style={[styles.avatarCountText, { color: textColor, fontFamily: "Manrope-Medium" }]}>
        {count > 0 ? `${count} going` : "Be the first to attend"}
        {dateStr ? ` • ${dateStr}` : ""}
      </Text>
    </View>
  );
};

/**
 * BookmarkButton Component
 */
const BookmarkButton = ({ eventId, isInterested, onToggle, style }) => {
  return (
    <TouchableOpacity
      style={[
        styles.bookmarkButton,
        isInterested && styles.bookmarkButtonActive,
        style
      ]}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      onPress={(e) => {
        e?.stopPropagation?.();
        onToggle(eventId);
      }}
    >
      <Bookmark
        size={14}
        color={isInterested ? "#2962FF" : "#2C2C2A"}
        fill={isInterested ? "#2962FF" : "transparent"}
        strokeWidth={2}
      />
    </TouchableOpacity>
  );
};

/**
 * StatusBadge Component
 * Priority: Live > Spots Left (<= 5) > Virtual > Free
 */
const StatusBadge = ({ isLiveNow, spotsLeft, isFree, eventType }) => {
  const isVirtual = eventType === "virtual" || eventType === "hybrid";

  if (isLiveNow) {
    return (
      <View style={[styles.statusBadgeContainer, styles.statusLive]}>
        <View style={styles.statusLiveDot} />
        <Text style={styles.statusLiveText}>LIVE</Text>
      </View>
    );
  }
  if (spotsLeft !== null && spotsLeft !== undefined && spotsLeft <= 5 && spotsLeft > 0) {
    return (
      <View style={[styles.statusBadgeContainer, styles.statusSpots]}>
        <Text style={styles.statusSpotsText}>{spotsLeft} spots left</Text>
      </View>
    );
  }
  if (isVirtual) {
    return (
      <View style={[styles.statusBadgeContainer, styles.statusVirtual]}>
        <Video size={10} color="#FFFFFF" strokeWidth={2.2} style={{ marginRight: 3 }} />
        <Text style={styles.statusVirtualText}>{eventType === "hybrid" ? "Hybrid" : "Virtual"}</Text>
      </View>
    );
  }
  if (isFree) {
    return (
      <View style={[styles.statusBadgeContainer, styles.statusFree]}>
        <Text style={styles.statusFreeText}>Free</Text>
      </View>
    );
  }
  return null;
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
    curatedLists = [],
    creatorOpportunities = null
  } = feedData;

  const activeLiveNow = liveNow || [];
  const activeHero = hero;
  const activeWeekend = weekend || [];
  const activeCategoryRails = categoryRails || [];
  const activeSomethingDifferent = somethingDifferent || [];
  const activeCuratedLists = curatedLists || [];
  const activeCreatorOpportunities = creatorOpportunities;

  // Active rail filter pill state
  const [activeFilter, setActiveFilter] = useState("all");

  // Local interest / bookmark state map keyed by eventId
  const [interestMap, setInterestMap] = useState({});

  useEffect(() => {
    const map = {};
    if (activeHero?.eventId) map[activeHero.eventId] = Boolean(activeHero.isInterested);
    activeLiveNow.forEach((e) => { if (e?.eventId) map[e.eventId] = Boolean(e.isInterested); });
    activeWeekend.forEach((e) => { if (e?.eventId) map[e.eventId] = Boolean(e.isInterested); });
    activeCategoryRails.forEach((r) => {
      (r.events || []).forEach((e) => { if (e?.eventId) map[e.eventId] = Boolean(e.isInterested); });
    });
    activeSomethingDifferent.forEach((e) => { if (e?.eventId) map[e.eventId] = Boolean(e.isInterested); });
    setInterestMap((prev) => ({ ...map, ...prev }));
  }, [activeHero, activeLiveNow, activeWeekend, activeCategoryRails, activeSomethingDifferent]);

  // Synchronize interest changes with EventBus
  useEffect(() => {
    const unsub = EventBus.on("event-interest-updated", ({ eventId, isInterested }) => {
      if (eventId) {
        const idKey = String(eventId);
        setInterestMap((prev) => ({
          ...prev,
          [eventId]: Boolean(isInterested),
          [idKey]: Boolean(isInterested)
        }));
      }
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  const handleToggleInterest = async (eventId) => {
    if (!eventId) return;
    const idKey = String(eventId);
    const currentState = Boolean(interestMap[idKey] ?? interestMap[eventId]);
    const newState = !currentState;

    HapticsService.triggerImpactLight();

    // Optimistic update
    setInterestMap((prev) => ({
      ...prev,
      [eventId]: newState,
      [idKey]: newState
    }));

    try {
      const response = await toggleEventInterest(eventId);
      if (response?.success) {
        const confirmedState = Boolean(response.is_interested);
        setInterestMap((prev) => ({
          ...prev,
          [eventId]: confirmedState,
          [idKey]: confirmedState
        }));
        EventBus.emit("event-interest-updated", {
          eventId,
          isInterested: confirmedState
        });
      } else {
        // Revert on failure
        setInterestMap((prev) => ({
          ...prev,
          [eventId]: currentState,
          [idKey]: currentState
        }));
      }
    } catch (err) {
      console.error("[Explore] toggleEventInterest error:", err);
      // Revert on error
      setInterestMap((prev) => ({
        ...prev,
        [eventId]: currentState,
        [idKey]: currentState
      }));
    }
  };

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

  // Client-side filtering logic for rail events
  const filterEvents = (events, filter) => {
    if (!events || !Array.isArray(events)) return [];
    if (filter === "all") return events;

    const now = new Date();
    const todayStr = now.toDateString();

    return events.filter((ev) => {
      const evDate = ev.startDatetime ? new Date(ev.startDatetime) : null;

      if (filter === "today") {
        return evDate && evDate.toDateString() === todayStr;
      }
      if (filter === "weekend") {
        if (!evDate) return false;
        const day = evDate.getDay();
        const diff = (evDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return (day === 5 || day === 6 || day === 0) && diff >= 0 && diff <= 7;
      }
      if (filter === "free") {
        return ev.isFree === true;
      }
      if (filter === "virtual") {
        const type = String(ev.eventType || "").toLowerCase();
        return type === "virtual" || type === "hybrid";
      }
      return true;
    });
  };

  // 1. Live now accent ring styling
  const renderLiveNow = () => {
    if (activeLiveNow.length === 0) return null;
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.liveHeader}>
          <View style={styles.liveIndicator} />
          <Text style={styles.sectionTitle}>Live now</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScrollPadding}
        >
          {activeLiveNow.map((item) => (
            <TouchableOpacity
              key={item.eventId}
              style={styles.liveBubbleContainer}
              activeOpacity={0.8}
              onPress={() => handleEventPress(item.eventId, item)}
            >
              <View style={styles.liveRingOuter}>
                {item.coverUrl ? (
                  <Image
                    source={{ uri: getOptimizedImageUrl(item.coverUrl, { width: 48 }) }}
                    style={styles.liveThumbnail}
                  />
                ) : (
                  <View style={[styles.liveThumbnail, { backgroundColor: item.title === "Open mic" ? "#E28E72" : item.title === "Run club" ? "#EE9C7D" : "#F5C7B5", justifyContent: "center", alignItems: "center" }]}>
                    {item.title === "Open mic" && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#000000" }} />}
                  </View>
                )}
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

  // 2. Hero Card Section
  const renderHero = () => {
    if (!activeHero) return null;
    const colors = getCategoryColor(activeHero.category_slug, activeHero.eventId);
    const dateStr = activeHero.startTimeString || (activeHero.startTime
      ? new Date(activeHero.startTime).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit"
        })
      : "");
    const isInterested = Boolean(interestMap[activeHero.eventId] ?? activeHero.isInterested);

    return (
      <View style={styles.sectionContainer}>
        <TouchableOpacity
          style={styles.heroCard}
          activeOpacity={0.9}
          onPress={() => handleEventPress(activeHero.eventId, activeHero)}
        >
          {activeHero.coverUrl ? (
            <ImageBackground
              source={{ uri: getOptimizedImageUrl(activeHero.coverUrl, { width: HERO_WIDTH }) }}
              style={styles.heroBackground}
              imageStyle={styles.heroBackgroundImage}
            >
              {/* Scrim gradient layer */}
              <View style={styles.scrimOverlay} />

              <BookmarkButton
                eventId={activeHero.eventId}
                isInterested={isInterested}
                onToggle={handleToggleInterest}
                style={{ top: 12, right: 12 }}
              />

              <View style={styles.heroContentContainer}>
                <View style={styles.heroTopRow}>
                  <View style={[styles.categoryBadge, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.categoryBadgeText, { color: colors.text }]}>
                      {activeHero.category}
                    </Text>
                  </View>
                  {dateStr ? <Text style={styles.heroDateText}>{dateStr}</Text> : null}
                </View>

                <View style={styles.heroBottomRow}>
                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {activeHero.title}
                  </Text>
                  <AvatarStack
                    avatars={activeHero.attendeeAvatars || []}
                    count={activeHero.attendeeCount || 0}
                    dateStr={dateStr}
                    textColor="#FFFFFF"
                  />
                </View>
              </View>
            </ImageBackground>
          ) : (
            <View style={[styles.heroBackground, { backgroundColor: "#C9C6F6", padding: 16, justifyContent: "space-between" }]}>
              <BookmarkButton
                eventId={activeHero.eventId}
                isInterested={isInterested}
                onToggle={handleToggleInterest}
                style={{ top: 12, right: 12 }}
              />

              <View style={styles.heroTopRow}>
                <View style={[styles.categoryBadge, { backgroundColor: "#FFFFFF" }]}>
                  <Text style={[styles.categoryBadgeText, { color: "#2B1E78" }]}>
                    {activeHero.category}
                  </Text>
                </View>
              </View>

              <View style={styles.heroBottomRow}>
                <Text style={[styles.heroTitle, { color: "#2B1E78", marginBottom: 4 }]} numberOfLines={2}>
                  {activeHero.title}
                </Text>
                <AvatarStack
                  avatars={activeHero.attendeeAvatars || []}
                  count={activeHero.attendeeCount || 0}
                  dateStr={dateStr}
                  textColor="#2B1E78"
                />
              </View>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // 3. Bento Weekend Rows Section
  const renderWeekend = () => {
    if (activeWeekend.length === 0) return null;

    // Fallback to normal horizontal rail if fewer than 3 events
    if (activeWeekend.length < 3) {
      return (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>This weekend</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScrollPadding}
          >
            {activeWeekend.map((item) => {
              const colors = getCategoryColor(item.category_slug, item.eventId);
              const isInterested = Boolean(interestMap[item.eventId] ?? item.isInterested);
              return (
                <TouchableOpacity
                  key={item.eventId}
                  style={styles.railCard}
                  activeOpacity={0.8}
                  onPress={() => handleEventPress(item.eventId, item)}
                >
                  <View style={styles.railCardImageContainer}>
                    {item.coverUrl ? (
                      <Image
                        source={{ uri: getOptimizedImageUrl(item.coverUrl, { width: RAIL_CARD_WIDTH }) }}
                        style={styles.railCardImage}
                      />
                    ) : (
                      <View style={[styles.railCardImage, { backgroundColor: colors.bg || "#A7E2CE", justifyContent: "center", alignItems: "center" }]}>
                        <Calendar size={24} color={colors.text || "#1E5844"} strokeWidth={1.8} />
                      </View>
                    )}
                    {item.category ? (
                      <View style={[styles.cardCategoryBadge, { backgroundColor: colors.bg }]}>
                        <Text style={[styles.cardCategoryBadgeText, { color: colors.text }]} numberOfLines={1}>
                          {item.category}
                        </Text>
                      </View>
                    ) : null}
                    <BookmarkButton
                      eventId={item.eventId}
                      isInterested={isInterested}
                      onToggle={handleToggleInterest}
                    />
                    <StatusBadge
                      isLiveNow={item.isLiveNow}
                      spotsLeft={item.spotsLeft}
                      isFree={item.isFree}
                      eventType={item.eventType || item.event_type}
                    />
                  </View>
                  <View style={styles.cardPadding}>
                    <Text style={styles.railCardTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.railCardMetadata}>
                      {item.attendeeCount > 0 ? `${item.attendeeCount} going` : ""}
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
    const largeEvent = activeWeekend[0];
    const smallEvent1 = activeWeekend[1];
    const smallEvent2 = activeWeekend[2];

    const largeColors = getCategoryColor(largeEvent.category_slug, largeEvent.eventId);
    const largeInterested = Boolean(interestMap[largeEvent.eventId] ?? largeEvent.isInterested);

    return (
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>This weekend</Text>
        <View style={styles.bentoRow}>
          {/* Large Left Card (~58%) */}
          <TouchableOpacity
            style={styles.bentoLargeCard}
            activeOpacity={0.8}
            onPress={() => handleEventPress(largeEvent.eventId, largeEvent)}
          >
            <View style={styles.bentoLargeImageContainer}>
              {largeEvent.coverUrl ? (
                <Image
                  source={{ uri: getOptimizedImageUrl(largeEvent.coverUrl, { width: BENTO_LARGE_WIDTH }) }}
                  style={styles.bentoLargeImage}
                />
              ) : (
                <View style={[styles.bentoLargeImage, { backgroundColor: largeColors.bg || "#A7E2CE" }]} />
              )}
              {largeEvent.category ? (
                <View style={[styles.cardCategoryBadge, { backgroundColor: largeColors.bg || "#FFFFFF" }]}>
                  <Text style={[styles.cardCategoryBadgeText, { color: largeColors.text || "#1E5844" }]}>
                    {largeEvent.category}
                  </Text>
                </View>
              ) : null}
              <BookmarkButton
                eventId={largeEvent.eventId}
                isInterested={largeInterested}
                onToggle={handleToggleInterest}
              />
              <StatusBadge
                isLiveNow={largeEvent.isLiveNow}
                spotsLeft={largeEvent.spotsLeft}
                isFree={largeEvent.isFree}
                eventType={largeEvent.eventType || largeEvent.event_type}
              />
            </View>
            <View style={styles.bentoContent}>
              <Text style={styles.bentoLargeTitle} numberOfLines={2}>
                {largeEvent.title}
              </Text>
              <Text style={styles.railCardMetadata}>
                {largeEvent.attendeeCount > 0 ? `${largeEvent.attendeeCount} going` : ""}
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
                <Text style={styles.bentoSmallTitle} numberOfLines={2}>
                  {smallEvent1.title}
                </Text>
                {smallEvent1.attendeeCount > 0 && (
                  <Text style={styles.bentoSmallMetadata}>
                    {smallEvent1.attendeeCount} going
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            {/* Small Card 2 */}
            <TouchableOpacity
              style={styles.bentoSmallCard}
              activeOpacity={0.8}
              onPress={() => handleEventPress(smallEvent2.eventId, smallEvent2)}
            >
              <View style={styles.bentoSmallContent}>
                <Text style={styles.bentoSmallTitle} numberOfLines={2}>
                  {smallEvent2.title}
                </Text>
                {smallEvent2.attendeeCount > 0 && (
                  <Text style={styles.bentoSmallMetadata}>
                    {smallEvent2.attendeeCount} going
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // 4. Curated Lists Section (Part B)
  const renderCuratedLists = () => {
    if (!activeCuratedLists || activeCuratedLists.length === 0) return null;

    return (
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Curated collections</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScrollPadding}
        >
          {activeCuratedLists.map((list) => {
            const eventsCount = Array.isArray(list.events) ? list.events.length : 0;
            return (
              <TouchableOpacity
                key={list.id}
                style={styles.curatedCard}
                activeOpacity={0.9}
                onPress={() => {
                  if (navigation) {
                    navigation.navigate("CuratedListDetails", {
                      listId: list.id,
                      list
                    });
                  }
                }}
              >
                {list.coverUrl ? (
                  <ImageBackground
                    source={{ uri: getOptimizedImageUrl(list.coverUrl, { width: 280 }) }}
                    style={styles.curatedCardBackground}
                    imageStyle={styles.curatedCardImage}
                  >
                    <LinearGradient
                      colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.75)"]}
                      style={styles.curatedScrim}
                    >
                      <View style={styles.curatedTopRow}>
                        <View style={styles.curatedBadge}>
                          <Sparkles size={11} color="#FFFFFF" strokeWidth={2.2} />
                          <Text style={styles.curatedBadgeText}>
                            {eventsCount > 0 ? `${eventsCount} events` : "Collection"}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.curatedBottom}>
                        <Text style={styles.curatedTitle} numberOfLines={2}>
                          {list.title}
                        </Text>
                        {list.subtitle ? (
                          <Text style={styles.curatedSubtitle} numberOfLines={2}>
                            {list.subtitle}
                          </Text>
                        ) : null}
                      </View>
                    </LinearGradient>
                  </ImageBackground>
                ) : (
                  <View style={[styles.curatedCardBackground, { backgroundColor: "#1A1A2E", padding: 16, justifyContent: "space-between" }]}>
                    <View style={styles.curatedBadge}>
                      <Sparkles size={11} color="#FFFFFF" strokeWidth={2.2} />
                      <Text style={styles.curatedBadgeText}>
                        {eventsCount > 0 ? `${eventsCount} events` : "Collection"}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.curatedTitle} numberOfLines={2}>
                        {list.title}
                      </Text>
                      {list.subtitle ? (
                        <Text style={styles.curatedSubtitle} numberOfLines={2}>
                          {list.subtitle}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // 5. Category Rails Section (with Client-side Filter Pills)
  const renderCategoryRails = () => {
    return (
      <View>
        {/* Filter Pills Row above Category Rails */}
        <View style={styles.filterPillsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScrollPadding}
          >
            {FILTER_OPTIONS.map((opt) => {
              const isActive = activeFilter === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.filterPill,
                    isActive && styles.filterPillActive
                  ]}
                  activeOpacity={0.7}
                  onPress={() => setActiveFilter(opt.id)}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      isActive && styles.filterPillTextActive
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {activeCategoryRails.map((rail) => {
          const filteredEvents = filterEvents(rail.events, activeFilter);
          if (filteredEvents.length === 0) return null;

          return (
            <View key={rail.categorySlug} style={styles.sectionContainer}>
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
                {filteredEvents.map((event) => {
                  const isInterested = Boolean(interestMap[event.eventId] ?? event.isInterested);
                  return (
                    <CompactEventCard
                      key={event.eventId}
                      event={{
                        ...event,
                        id: event.eventId,
                        category: rail.category,
                      }}
                      width={168}
                      style={{ marginRight: 12 }}
                      showBookmark={true}
                      isInterested={isInterested}
                      onToggleInterest={handleToggleInterest}
                      onPress={() => handleEventPress(event.eventId, event)}
                    />
                  );
                })}
              </ScrollView>
            </View>
          );
        })}
      </View>
    );
  };

  // 6. Serendipity Rail (Something Different)
  const renderSomethingDifferent = () => {
    if (activeSomethingDifferent.length === 0) return null;

    return (
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Something different</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScrollPadding}
        >
          {activeSomethingDifferent.map((event) => {
            const isInterested = Boolean(interestMap[event.eventId] ?? event.isInterested);
            return (
              <CompactEventCard
                key={event.eventId}
                event={{
                  ...event,
                  id: event.eventId,
                  category: event.categoryName,
                }}
                width={168}
                style={{ marginRight: 12 }}
                showBookmark={true}
                isInterested={isInterested}
                onToggleInterest={handleToggleInterest}
                onPress={() => handleEventPress(event.eventId, event)}
              />
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // 7. Creator opportunities banner
  const renderOpportunitiesBanner = () => {
    if (!activeCreatorOpportunities) return null;
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
              {activeCreatorOpportunities.count} new brand deals match your profile
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
      {renderLiveNow()}
      {renderHero()}
      {renderWeekend()}
      {renderCuratedLists()}
      {renderCategoryRails()}
      {renderSomethingDifferent()}
      {renderOpportunitiesBanner()}
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
    fontFamily: FONTS.primary, // BasicCommercial-Bold
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

  // Filter Pills
  filterPillsContainer: {
    marginBottom: 16
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    ...SHADOWS.sm
  },
  filterPillActive: {
    backgroundColor: "#2C2C2A",
    borderColor: "#2C2C2A"
  },
  filterPillText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
    color: "#5F5E5A"
  },
  filterPillTextActive: {
    color: "#FFFFFF"
  },

  // Bookmark Button
  bookmarkButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    ...SHADOWS.sm
  },

  // Status Badges
  statusBadgeContainer: {
    position: "absolute",
    bottom: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    zIndex: 5
  },
  statusLive: {
    backgroundColor: "rgba(216, 90, 48, 0.95)"
  },
  statusLiveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#FFFFFF",
    marginRight: 4
  },
  statusLiveText: {
    fontFamily: "Manrope-Bold",
    fontSize: 9,
    color: "#FFFFFF",
    letterSpacing: 0.5
  },
  statusSpots: {
    backgroundColor: "rgba(217, 119, 6, 0.95)"
  },
  statusSpotsText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 9,
    color: "#FFFFFF"
  },
  statusFree: {
    backgroundColor: "rgba(22, 163, 74, 0.95)"
  },
  statusFreeText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 9,
    color: "#FFFFFF"
  },
  statusVirtual: {
    backgroundColor: "rgba(37, 99, 235, 0.95)"
  },
  statusVirtualText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 9,
    color: "#FFFFFF"
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
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
    ...SHADOWS.sm,
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
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
    ...SHADOWS.md
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
    borderRadius: 10,
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
    fontFamily: FONTS.primary, // BasicCommercial-Bold
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
    height: 140
  },
  bentoLargeCard: {
    flex: 0.58,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
    ...SHADOWS.sm,
    overflow: "hidden",
    marginRight: 8
  },
  bentoLargeImageContainer: {
    height: 70,
    width: "100%",
    position: "relative",
    backgroundColor: "#F3F4F6"
  },
  bentoLargeImage: {
    height: "100%",
    width: "100%",
    resizeMode: "cover"
  },
  bentoContent: {
    flex: 1,
    padding: 8,
    justifyContent: "space-between"
  },
  bentoLargeTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 13,
    color: "#2C2C2A",
    lineHeight: 17
  },
  bentoRightColumn: {
    flex: 0.42,
    justifyContent: "space-between"
  },
  bentoSmallCard: {
    height: 66,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
    ...SHADOWS.sm,
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
    color: "#2C2C2A",
    lineHeight: 16
  },
  bentoSmallMetadata: {
    fontFamily: "Manrope-Medium",
    fontSize: 10,
    color: "#888780"
  },

  // Curated Editorial Card styling (Part B)
  curatedCard: {
    width: 280,
    height: 160,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
    ...SHADOWS.md,
    overflow: "hidden",
    marginRight: 12
  },
  curatedCardBackground: {
    flex: 1,
    width: "100%",
    height: "100%"
  },
  curatedCardImage: {
    resizeMode: "cover"
  },
  curatedScrim: {
    flex: 1,
    justifyContent: "space-between",
    padding: 14
  },
  curatedTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  curatedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4
  },
  curatedBadgeText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 10,
    color: "#FFFFFF",
    letterSpacing: 0.2
  },
  curatedBottom: {
    justifyContent: "flex-end"
  },
  curatedTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 15,
    color: "#FFFFFF",
    lineHeight: 19,
    marginBottom: 2
  },
  curatedSubtitle: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.85)",
    lineHeight: 16
  },

  // Category and Serendipity rails
  railCard: {
    width: 160,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
    ...SHADOWS.sm,
    overflow: "hidden",
    marginRight: 12,
    marginBottom: 4
  },
  railCardImageContainer: {
    width: "100%",
    height: 100,
    position: "relative",
    backgroundColor: "#F3F4F6"
  },
  railCardImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover"
  },
  cardCategoryBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
    maxWidth: "60%",
    zIndex: 5
  },
  cardCategoryBadgeText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 10
  },
  cardPadding: {
    padding: 10,
    flex: 1,
    justifyContent: "space-between",
    minHeight: 64
  },
  railCardTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 13,
    color: "#2C2C2A",
    lineHeight: 17,
    marginBottom: 4
  },
  railCardMetadata: {
    fontFamily: "Manrope-Medium",
    fontSize: 11,
    color: "#888780"
  }
});
