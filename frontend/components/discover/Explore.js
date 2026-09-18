import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import * as LucideIcons from "lucide-react-native";
import {
  ChevronRight,
  X,
  Briefcase,
  Calendar,
  Sparkles,
  Bookmark,
  Video,
  Flame
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { getCategoryColor } from "../../constants/categoryColors";
import { COLORS, SHADOWS, FONTS } from "../../constants/theme";
import { getOptimizedImageUrl } from "../../utils/imageUtils";
import { toggleEventInterest } from "../../api/events";
import { getEventsByCategory } from "../../api/categories";
import EventBus from "../../utils/EventBus";
import HapticsService from "../../services/HapticsService";
import CompactEventCard from "../cards/CompactEventCard";
import EdgeSwipeScrollView from "../ui/EdgeSwipeScrollView";
import SnooLoader from "../ui/SnooLoader";

const LIVE_GRADIENT_COLORS = ["#FF1E56", "#FF5E3A"];

const FALLBACK_MAIN_CATEGORIES = [
  { id: "music", name: "Music", slug: "music", iconName: "music", subcategories: ["Live Concerts", "DJ Nights", "Open Mic Nights", "EDM & Electronic"] },
  { id: "food-dining", name: "Food & Dining", slug: "food-dining", iconName: "utensils-crossed", subcategories: ["Food Festivals", "Coffee Meetups", "Cooking Classes"] },
  { id: "sports-fitness", name: "Sports & Fitness", slug: "sports-fitness", iconName: "heart-pulse", subcategories: ["Run Clubs", "Cycling Groups", "Yoga & Meditation"] },
  { id: "tech-startup", name: "Tech & Startup", slug: "tech-startup", iconName: "code", subcategories: ["Hackathons", "Startup Meetups", "Developer Conferences"] },
  { id: "gaming-esports", name: "Gaming & Esports", slug: "gaming-esports", iconName: "gamepad-2", subcategories: ["LAN Parties", "Esports Tournaments", "Board Game Nights"] },
  { id: "outdoors-adventure", name: "Outdoors & Adventure", slug: "outdoors-adventure", iconName: "tent", subcategories: ["Hiking", "Camping", "Road Trips"] },
  { id: "arts-culture", name: "Arts & Culture", slug: "arts-culture", iconName: "palette", subcategories: ["Exhibitions", "Poetry", "Theatre"] },
  { id: "education-workshops", name: "Education & Workshops", slug: "education-workshops", iconName: "graduation-cap", subcategories: ["Skill-building", "Book Clubs"] },
  { id: "nightlife-parties", name: "Nightlife & Parties", slug: "nightlife-parties", iconName: "martini", subcategories: ["Club Nights", "House Parties", "Rooftop Parties"] },
  { id: "wellness-mindfulness", name: "Wellness & Mindfulness", slug: "wellness-mindfulness", iconName: "heart-handshake", subcategories: ["Meditation", "Sound Healing", "Mental Health Support", "Spa & Self-care"] },
  { id: "networking-professional", name: "Networking & Career", slug: "networking-professional", iconName: "briefcase", subcategories: ["Networking Mixers", "Career Fairs", "Conferences"] },
  { id: "comedy-entertainment", name: "Comedy & Entertainment", slug: "comedy-entertainment", iconName: "laugh", subcategories: ["Stand-up Open Mics", "Improv Nights"] },
  { id: "family-kids", name: "Family & Kids", slug: "family-kids", iconName: "baby", subcategories: ["Kids' Workshops", "Family Picnics"] },
  { id: "seasonal-holiday", name: "Seasonal & Holiday", slug: "seasonal-holiday", iconName: "sparkles", subcategories: ["Festivals", "Holiday Parties"] },
];

// Convert kebab-case backend icon name to PascalCase Lucide icon component
const getLucideIcon = (iconName) => {
  if (!iconName) return LucideIcons.Compass || LucideIcons.Tags;
  const pascalName = iconName
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return LucideIcons[pascalName] || LucideIcons.Compass || LucideIcons.Tags;
};

// Comprehensive Open Plans quick-nav activities pool
const ALL_OPEN_PLAN_ACTIVITIES = [
  { key: "sports", label: "Sports", emoji: "⚽", bg: "#FFF3E0", text: "#E65100" },
  { key: "food", label: "Food", emoji: "🍔", bg: "#FFF8E1", text: "#F57F17" },
  { key: "hangout", label: "Hangout", emoji: "🌿", bg: "#E8F5E9", text: "#1B5E20" },
  { key: "games", label: "Games", emoji: "🎮", bg: "#E1F5FE", text: "#01579B" },
  { key: "live_music", label: "Live Music", emoji: "🎵", bg: "#FCE4EC", text: "#C62828" },
  { key: "hiking", label: "Hiking", emoji: "🥾", bg: "#E8F5E9", text: "#2E7D32" },
  { key: "cafe", label: "Cafe", emoji: "☕", bg: "#EFEBE9", text: "#4E342E" },
  { key: "house_party", label: "House Party", emoji: "🏠", bg: "#FBE9E7", text: "#D84315" },
  { key: "movies", label: "Movies", emoji: "🍿", bg: "#F3E5F5", text: "#6A1B9A" },
  { key: "bowling", label: "Bowling", emoji: "🎳", bg: "#EDE7F6", text: "#512DA8" },
  { key: "gokarting", label: "Go-karting", emoji: "🏎️", bg: "#FFF3E0", text: "#D84315" },
  { key: "swimming", label: "Swimming", emoji: "🏊", bg: "#E0F7FA", text: "#00838F" },
  { key: "bar", label: "Bar", emoji: "🍻", bg: "#E8EAF6", text: "#303F9F" },
  { key: "club", label: "Club", emoji: "🪩", bg: "#EDE7F6", text: "#5E35B1" },
  { key: "pilates", label: "Pilates", emoji: "🤸‍♀️", bg: "#FCE4EC", text: "#C2185B" },
];

const getRandomActivities = (count = 8) => {
  const shuffled = [...ALL_OPEN_PLAN_ACTIVITIES].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_WIDTH = SCREEN_WIDTH - 32;
const RAIL_CARD_WIDTH = 168;
const RAIL_CARD_GAP = 14;
const OPEN_PLAN_GRID_GAP = 8;
const OPEN_PLAN_TILE_WIDTH = Math.floor((SCREEN_WIDTH - 32 - (3 * OPEN_PLAN_GRID_GAP)) / 4);
const BENTO_LARGE_WIDTH = (SCREEN_WIDTH - 40) * 0.52;

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
      <LinearGradient
        colors={LIVE_GRADIENT_COLORS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.statusBadgeContainer}
      >
        <View style={styles.statusLiveDot} />
        <Text style={styles.statusLiveText}>LIVE</Text>
      </LinearGradient>
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

function Explore({
  feedData = {},
  loading = false,
  refreshing = false,
  onRefresh,
  onEventPress,
  onDismissOpportunities,
  navigation
}) {
  const {
    categories = [],
    whatsHot = [],
    liveNow = [],
    hero = null,
    weekend = [],
    categoryRails = [],
    somethingDifferent = [],
    curatedLists = [],
    creatorOpportunities = null,
    recommendedEvents = []
  } = feedData;

  const activeCategories = categories || [];
  const activeWhatsHot = whatsHot || [];
  const activeLiveNow = liveNow || [];
  const activeHero = hero;
  const activeWeekend = weekend || [];
  const activeCategoryRails = categoryRails || [];
  const activeSomethingDifferent = somethingDifferent || [];
  const activeCuratedLists = curatedLists || [];
  const activeCreatorOpportunities = creatorOpportunities;
  const activeRecommendedEvents = recommendedEvents || [];

  // Active rail filter pill state
  const [activeFilter, setActiveFilter] = useState("all");

  // Selected top-level category filter state
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState("all");
  const [categoryEvents, setCategoryEvents] = useState([]);
  const [categoryEventsLoading, setCategoryEventsLoading] = useState(false);

  // Local interest / bookmark state map keyed by eventId
  const [interestMap, setInterestMap] = useState({});

  // 8 random Open Plan activities (stable during interaction, re-randomized on pull-to-refresh)
  const [randomActivities, setRandomActivities] = useState(() => getRandomActivities(8));

  const fetchCategoryEvents = useCallback(async () => {
    if (!selectedCategory) {
      setCategoryEvents([]);
      setCategoryEventsLoading(false);
      return;
    }

    setCategoryEventsLoading(true);
    try {
      const identifier = selectedCategory.slug || selectedCategory.id;
      const res = await getEventsByCategory(identifier);
      if (res?.events) {
        setCategoryEvents(res.events);
        const map = {};
        res.events.forEach((evt) => {
          const id = evt.id || evt.eventId;
          if (id) {
            map[id] = Boolean(evt.is_interested || evt.isInterested);
            map[String(id)] = Boolean(evt.is_interested || evt.isInterested);
          }
        });
        setInterestMap((prev) => ({ ...map, ...prev }));
      }
    } catch (err) {
      console.error("[Explore] Failed to load category events:", err);
    } finally {
      setCategoryEventsLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (refreshing) {
      setRandomActivities(getRandomActivities(8));
      if (selectedCategory) {
        fetchCategoryEvents();
      }
    }
  }, [refreshing, selectedCategory, fetchCategoryEvents]);

  useEffect(() => {
    const unsubCreated = EventBus.on("event:created", () => {
      if (selectedCategory) {
        fetchCategoryEvents();
      }
    });
    const unsubCreatedAlt = EventBus.on("event-created", () => {
      if (selectedCategory) {
        fetchCategoryEvents();
      }
    });
    return () => {
      if (unsubCreated) unsubCreated();
      if (unsubCreatedAlt) unsubCreatedAlt();
    };
  }, [selectedCategory, fetchCategoryEvents]);

  useEffect(() => {
    const map = {};
    if (activeHero?.eventId) map[activeHero.eventId] = Boolean(activeHero.isInterested);
    activeLiveNow.forEach((e) => { if (e?.eventId) map[e.eventId] = Boolean(e.isInterested); });
    activeWeekend.forEach((e) => { if (e?.eventId) map[e.eventId] = Boolean(e.isInterested); });
    activeWhatsHot.forEach((e) => { if (e?.eventId) map[e.eventId] = Boolean(e.isInterested); });
    activeCategoryRails.forEach((r) => {
      (r.events || []).forEach((e) => { if (e?.eventId) map[e.eventId] = Boolean(e.isInterested); });
    });
    activeSomethingDifferent.forEach((e) => { if (e?.eventId) map[e.eventId] = Boolean(e.isInterested); });
    setInterestMap((prev) => ({ ...map, ...prev }));
  }, [activeHero, activeLiveNow, activeWeekend, activeWhatsHot, activeCategoryRails, activeSomethingDifferent]);

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

  // Fetch events when a top-level category is selected
  useEffect(() => {
    setSelectedSubcategory("all");
    fetchCategoryEvents();
  }, [selectedCategory, fetchCategoryEvents]);

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

  // 0. Category Quick-Nav (District reference style: horizontal scrolling icon tiles)
  const renderCategoryQuickNav = () => {
    const displayCategories =
      activeCategories.length > 0 ? activeCategories : FALLBACK_MAIN_CATEGORIES;

    return (
      <View style={styles.quickNavSection}>
        <EdgeSwipeScrollView
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickNavScrollPadding}
        >
          {/* All category pill */}
          <TouchableOpacity
            style={styles.categoryTile}
            activeOpacity={0.75}
            onPress={() => {
              HapticsService.triggerImpactLight();
              setSelectedCategory(null);
            }}
          >
            <View
              style={[
                styles.categoryTileIconContainer,
                selectedCategory === null && styles.categoryTileIconContainerActive,
              ]}
            >
              <LucideIcons.LayoutGrid
                size={20}
                color={selectedCategory === null ? "#2962FF" : "#2C2C2A"}
                strokeWidth={1.8}
              />
            </View>
            <Text
              style={[
                styles.categoryTileText,
                selectedCategory === null && styles.categoryTileTextActive,
              ]}
              numberOfLines={1}
            >
              All
            </Text>
          </TouchableOpacity>

          {displayCategories.map((cat) => {
            const IconComp = getLucideIcon(cat.iconName || cat.icon_name);
            const isSelected = selectedCategory?.slug === cat.slug;
            return (
              <TouchableOpacity
                key={cat.id || cat.slug}
                style={styles.categoryTile}
                activeOpacity={0.75}
                onPress={() => {
                  HapticsService.triggerImpactLight();
                  if (isSelected) {
                    setSelectedCategory(null);
                  } else {
                    setSelectedCategory(cat);
                  }
                }}
              >
                <View
                  style={[
                    styles.categoryTileIconContainer,
                    isSelected && styles.categoryTileIconContainerActive,
                  ]}
                >
                  <IconComp
                    size={20}
                    color={isSelected ? "#2962FF" : "#2C2C2A"}
                    strokeWidth={1.8}
                  />
                </View>
                <Text
                  style={[
                    styles.categoryTileText,
                    isSelected && styles.categoryTileTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </EdgeSwipeScrollView>
      </View>
    );
  };

  // Filter category events based on active subcategory pill
  const filteredCategoryEvents = useMemo(() => {
    if (!categoryEvents || categoryEvents.length === 0) return [];
    if (selectedSubcategory === "all") return categoryEvents;

    const subLower = selectedSubcategory.toLowerCase();
    const keywords = [subLower];
    if (subLower.includes("lan")) keywords.push("lan");
    if (subLower.includes("tournament")) keywords.push("tournament");
    if (subLower.includes("esport")) keywords.push("esport");
    if (subLower.includes("board game")) keywords.push("board game");
    if (subLower.includes("gaming")) keywords.push("game", "gaming");
    if (subLower.includes("rpg")) keywords.push("rpg");
    if (subLower.includes("vr") || subLower.includes("ar")) keywords.push("vr", "ar");
    if (subLower.includes("hackathon")) keywords.push("hackathon");
    if (subLower.includes("run")) keywords.push("run", "running");
    if (subLower.includes("cycling")) keywords.push("cycling", "cycle");
    if (subLower.includes("yoga")) keywords.push("yoga");
    if (subLower.includes("concert")) keywords.push("concert");
    if (subLower.includes("open mic")) keywords.push("open mic");
    if (subLower.includes("party")) keywords.push("party");

    return categoryEvents.filter((item) => {
      // 1. Linked discover_categories
      if (Array.isArray(item.subcategories)) {
        if (item.subcategories.some((s) => {
          const sLower = s?.toLowerCase() || "";
          return sLower === subLower || keywords.some((k) => sLower.includes(k));
        })) {
          return true;
        }
      }

      // 2. Direct event sub_category field
      if (item.sub_category) {
        const itemSub = item.sub_category.toLowerCase();
        if (itemSub === subLower || keywords.some((k) => itemSub.includes(k))) {
          return true;
        }
      }

      // 3. Event categories array
      if (Array.isArray(item.categories)) {
        if (item.categories.some((c) => {
          const cLower = c?.toLowerCase() || "";
          return cLower === subLower || keywords.some((k) => cLower.includes(k));
        })) {
          return true;
        }
      }

      // 4. Content / Title / Description keyword match
      const titleLower = (item.title || "").toLowerCase();
      const descLower = (item.description || "").toLowerCase();
      return keywords.some((k) => titleLower.includes(k) || descLower.includes(k));
    });
  }, [categoryEvents, selectedSubcategory]);

  // Filtered Category View (shown when a top-level category is selected)
  const renderFilteredCategoryView = () => {
    if (!selectedCategory) return null;

    const subcats = selectedCategory.subcategories || [];

    return (
      <View style={styles.filteredSectionContainer}>
        {/* Category Header Row */}
        <View style={styles.filteredHeaderRow}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.filteredCategoryTitle}>
              {selectedCategory.name}
            </Text>
            <Text style={styles.filteredCategorySubtitle}>
              {selectedSubcategory === "all"
                ? `Events across all ${selectedCategory.name.toLowerCase()} subcategories`
                : `Showing ${selectedSubcategory} events (${filteredCategoryEvents.length})`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.categoryCloseButton}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => {
              HapticsService.triggerImpactLight();
              setSelectedCategory(null);
              setSelectedSubcategory("all");
            }}
          >
            <X size={16} color="#52525B" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        {/* Subcategories tags filter pills */}
        {subcats.length > 0 && (
          <EdgeSwipeScrollView
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subcatPillsContainer}
            style={{ marginBottom: 16 }}
          >
            {/* "All" Pill */}
            <TouchableOpacity
              style={[
                styles.subcatPill,
                selectedSubcategory === "all" && styles.subcatPillActive,
              ]}
              activeOpacity={0.7}
              onPress={() => {
                HapticsService.triggerImpactLight();
                setSelectedSubcategory("all");
              }}
            >
              <Text
                style={[
                  styles.subcatPillText,
                  selectedSubcategory === "all" && styles.subcatPillTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>

            {subcats.map((sub, idx) => {
              const isActive = selectedSubcategory === sub;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.subcatPill,
                    isActive && styles.subcatPillActive,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    HapticsService.triggerImpactLight();
                    setSelectedSubcategory(isActive ? "all" : sub);
                  }}
                >
                  <Text
                    style={[
                      styles.subcatPillText,
                      isActive && styles.subcatPillTextActive,
                    ]}
                  >
                    {sub}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </EdgeSwipeScrollView>
        )}

        {/* Events Grid or Loader */}
        {categoryEventsLoading ? (
          <View style={styles.categoryLoaderContainer}>
            <SnooLoader />
          </View>
        ) : categoryEvents.length === 0 ? (
          <View style={styles.emptyCategoryContainer}>
            <Calendar size={36} color="#B0B0B5" strokeWidth={1.5} />
            <Text style={styles.emptyCategoryTitle}>No upcoming events found</Text>
            <Text style={styles.emptyCategorySubtitle}>
              There are no live or upcoming events in {selectedCategory.name} right now.
            </Text>
            <TouchableOpacity
              style={styles.emptyClearButton}
              onPress={() => {
                HapticsService.triggerImpactLight();
                setSelectedCategory(null);
                setSelectedSubcategory("all");
              }}
            >
              <Text style={styles.emptyClearButtonText}>Explore other categories</Text>
            </TouchableOpacity>
          </View>
        ) : filteredCategoryEvents.length === 0 ? (
          <View style={styles.emptyCategoryContainer}>
            <Calendar size={36} color="#B0B0B5" strokeWidth={1.5} />
            <Text style={styles.emptyCategoryTitle}>
              No upcoming {selectedSubcategory} events
            </Text>
            <Text style={styles.emptyCategorySubtitle}>
              There are no events matching {selectedSubcategory} right now.
            </Text>
            <TouchableOpacity
              style={styles.emptyClearButton}
              onPress={() => {
                HapticsService.triggerImpactLight();
                setSelectedSubcategory("all");
              }}
            >
              <Text style={styles.emptyClearButtonText}>
                View all {selectedCategory.name} events
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.filteredEventsGrid}>
            {filteredCategoryEvents.map((item) => {
              const id = item.id || item.eventId;
              const isInterested = Boolean(interestMap[id] ?? item.isInterested);
              return (
                <View key={id} style={styles.gridEventCardWrapper}>
                  <CompactEventCard
                    event={{
                      ...item,
                      id,
                      category: item.category || selectedCategory.name,
                    }}
                    width={(SCREEN_WIDTH - 44) / 2}
                    showBookmark={true}
                    isInterested={isInterested}
                    onToggleInterest={handleToggleInterest}
                    onPress={() => handleEventPress(id, item)}
                  />
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  // 1. Live now accent ring styling
  const renderLiveNow = () => {
    if (activeLiveNow.length === 0) return null;
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.liveHeader}>
          <View style={styles.liveIndicatorWrapper}>
            <LinearGradient
              colors={LIVE_GRADIENT_COLORS}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.liveIndicatorDot}
            />
          </View>
          <Text style={styles.sectionTitleWithoutMargin}>Live now</Text>
        </View>
        <EdgeSwipeScrollView
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
              <View style={styles.liveAvatarWrapper}>
                <LinearGradient
                  colors={LIVE_GRADIENT_COLORS}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.liveRingGradient}
                >
                  <View style={styles.liveRingWhiteGap}>
                    {item.coverUrl ? (
                      <Image
                        source={{ uri: getOptimizedImageUrl(item.coverUrl, { width: 120 }) }}
                        style={styles.liveThumbnail}
                      />
                    ) : (
                      <View style={[styles.liveThumbnail, styles.liveThumbnailFallback]}>
                        <Video size={18} color="#FF1E56" />
                      </View>
                    )}
                  </View>
                </LinearGradient>
              </View>
              <Text style={styles.liveBubbleLabel} numberOfLines={2} ellipsizeMode="tail">
                {item.title}
              </Text>
            </TouchableOpacity>
          ))}
        </EdgeSwipeScrollView>
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
          <EdgeSwipeScrollView
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
          </EdgeSwipeScrollView>
        </View>
      );
    }

    // Bento Grid Layout (1 Large, 2 Stacked Small)
    const largeEvent = activeWeekend[0];
    const smallEvent1 = activeWeekend[1];
    const smallEvent2 = activeWeekend[2];

    const largeColors = getCategoryColor(largeEvent.category_slug, largeEvent.eventId);
    const largeInterested = Boolean(interestMap[largeEvent.eventId] ?? largeEvent.isInterested);

    const small1Colors = getCategoryColor(smallEvent1.category_slug, smallEvent1.eventId);
    const small2Colors = getCategoryColor(smallEvent2.category_slug, smallEvent2.eventId);

    const formatWeekendDay = (iso) => {
      if (!iso) return "";
      try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return "";
        const day = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
        const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        return `${day} • ${time}`;
      } catch (e) {
        return "";
      }
    };

    return (
      <View style={styles.sectionContainer}>
        <View style={styles.railHeader}>
          <Text style={styles.sectionTitle}>This weekend</Text>
          <TouchableOpacity
            style={styles.seeAllButton}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => handleSeeAll("weekend", "This Weekend")}
          >
            <Text style={styles.seeAllText}>See all</Text>
            <ChevronRight size={14} color="#71717A" strokeWidth={2.2} style={styles.seeAllChevron} />
          </TouchableOpacity>
        </View>
        <View style={styles.bentoRow}>
          {/* Large Left Card (~52%) with Full-Bleed Image & Text Overlay */}
          <TouchableOpacity
            style={styles.bentoLargeCard}
            activeOpacity={0.88}
            onPress={() => handleEventPress(largeEvent.eventId, largeEvent)}
          >
            {largeEvent.coverUrl ? (
              <Image
                source={{ uri: getOptimizedImageUrl(largeEvent.coverUrl, { width: 340 }) }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: largeColors.bg || "#1A1826" }]} />
            )}
            <LinearGradient
              colors={["rgba(0,0,0,0.25)", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.92)"]}
              locations={[0, 0.35, 1]}
              style={StyleSheet.absoluteFill}
            />
            {largeEvent.category ? (
              <View style={[styles.cardCategoryBadge, { backgroundColor: largeColors.bg || "#FFFFFF" }]}>
                <Text style={[styles.cardCategoryBadgeText, { color: largeColors.text || "#1E5844" }]} numberOfLines={1}>
                  {largeEvent.category}
                </Text>
              </View>
            ) : null}
            <BookmarkButton
              eventId={largeEvent.eventId}
              isInterested={largeInterested}
              onToggle={handleToggleInterest}
            />

            <View style={styles.bentoLargeBottomContent}>
              <Text style={styles.bentoOverlayDayText}>
                {formatWeekendDay(largeEvent.startDatetime) || "THIS WEEKEND"}
              </Text>
              <Text style={styles.bentoLargeOverlayTitle} numberOfLines={2}>
                {largeEvent.title}
              </Text>
              <View style={styles.bentoOverlayMetaRow}>
                <Text style={styles.bentoOverlayMetaText}>
                  {largeEvent.attendeeCount > 0 ? `${largeEvent.attendeeCount} going` : ""}
                </Text>
                <StatusBadge
                  isLiveNow={largeEvent.isLiveNow}
                  spotsLeft={largeEvent.spotsLeft}
                  isFree={largeEvent.isFree}
                  eventType={largeEvent.eventType || largeEvent.event_type}
                />
              </View>
            </View>
          </TouchableOpacity>

          {/* Stacked Right Column (~48%) with Full-Bleed Image & Text Overlay */}
          <View style={styles.bentoRightColumn}>
            {/* Small Card 1 */}
            <TouchableOpacity
              style={styles.bentoSmallCard}
              activeOpacity={0.88}
              onPress={() => handleEventPress(smallEvent1.eventId, smallEvent1)}
            >
              {smallEvent1.coverUrl ? (
                <Image
                  source={{ uri: getOptimizedImageUrl(smallEvent1.coverUrl, { width: 280 }) }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: small1Colors.bg || "#1A1826" }]} />
              )}
              <LinearGradient
                colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.92)"]}
                locations={[0, 0.35, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.bentoSmallOverlay}>
                <View style={styles.bentoSmallTopRow}>
                  <Text style={[styles.bentoSmallOverlayDay, { color: small1Colors.bg || "#93C5FD" }]} numberOfLines={1}>
                    {formatWeekendDay(smallEvent1.startDatetime) || "SATURDAY"}
                  </Text>
                  {smallEvent1.category ? (
                    <View style={styles.bentoSmallCatBadge}>
                      <Text style={styles.bentoSmallCatText} numberOfLines={1}>
                        {smallEvent1.category}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View>
                  <Text style={styles.bentoSmallOverlayTitle} numberOfLines={2}>
                    {smallEvent1.title}
                  </Text>
                  <Text style={styles.bentoSmallOverlayMeta}>
                    {smallEvent1.attendeeCount > 0 ? `${smallEvent1.attendeeCount} going` : ""}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Small Card 2 */}
            <TouchableOpacity
              style={styles.bentoSmallCard}
              activeOpacity={0.88}
              onPress={() => handleEventPress(smallEvent2.eventId, smallEvent2)}
            >
              {smallEvent2.coverUrl ? (
                <Image
                  source={{ uri: getOptimizedImageUrl(smallEvent2.coverUrl, { width: 280 }) }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: small2Colors.bg || "#1A1826" }]} />
              )}
              <LinearGradient
                colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.92)"]}
                locations={[0, 0.35, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.bentoSmallOverlay}>
                <View style={styles.bentoSmallTopRow}>
                  <Text style={[styles.bentoSmallOverlayDay, { color: small2Colors.bg || "#FCA5A5" }]} numberOfLines={1}>
                    {formatWeekendDay(smallEvent2.startDatetime) || "SUNDAY"}
                  </Text>
                  {smallEvent2.category ? (
                    <View style={styles.bentoSmallCatBadge}>
                      <Text style={styles.bentoSmallCatText} numberOfLines={1}>
                        {smallEvent2.category}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View>
                  <Text style={styles.bentoSmallOverlayTitle} numberOfLines={2}>
                    {smallEvent2.title}
                  </Text>
                  <Text style={styles.bentoSmallOverlayMeta}>
                    {smallEvent2.attendeeCount > 0 ? `${smallEvent2.attendeeCount} going` : ""}
                  </Text>
                </View>
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
        <EdgeSwipeScrollView
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
        </EdgeSwipeScrollView>
      </View>
    );
  };

  // 3a-2. Recommended Events (Prioritized by community following and trending interest)
  const renderRecommendedEvents = () => {
    if (!activeRecommendedEvents || activeRecommendedEvents.length === 0) return null;

    return (
      <View style={styles.sectionContainer}>
        <View style={styles.railHeader}>
          <View style={styles.titleWithIconRow}>
            <Sparkles size={19} color="#2962FF" strokeWidth={2.2} />
            <Text style={styles.sectionTitleWithoutMargin}>Recommended Events</Text>
          </View>
          <TouchableOpacity
            style={styles.seeAllButton}
            onPress={() => {
              if (navigation) {
                navigation.navigate("Search", {
                  screen: "SearchMain",
                  params: { filter: "events", autoFocus: false },
                });
              }
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.seeAllText}>See all</Text>
            <ChevronRight size={16} color="#5F5E5A" strokeWidth={2.2} style={styles.seeAllChevron} />
          </TouchableOpacity>
        </View>

        <EdgeSwipeScrollView
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScrollPadding}
        >
          {activeRecommendedEvents.map((event) => {
            const eventId = event.id || event.eventId;
            const isInterested = Boolean(interestMap[eventId] ?? event.isInterested);
            return (
              <View key={eventId} style={styles.railCardWrapper}>
                <CompactEventCard
                  event={{
                    ...event,
                    id: eventId,
                    is_featured: event.isFeatured || event.is_featured,
                  }}
                  width={RAIL_CARD_WIDTH}
                  showBookmark={true}
                  isInterested={isInterested}
                  onToggleInterest={handleToggleInterest}
                  onPress={() => handleEventPress(eventId, event)}
                />
              </View>
            );
          })}
        </EdgeSwipeScrollView>
      </View>
    );
  };

  // 3b. What's Hot on SnooSpace (Featured/Boosted + 48h Velocity Score)
  const renderWhatsHot = () => {
    if (!activeWhatsHot || activeWhatsHot.length === 0) return null;

    const filteredEvents = filterEvents(activeWhatsHot, activeFilter);
    if (filteredEvents.length === 0) return null;

    return (
      <View style={styles.sectionContainer}>
        <View style={styles.railHeader}>
          <View style={styles.titleWithIconRow}>
            <Flame size={19} color="#D85A30" strokeWidth={2.2} />
            <Text style={styles.sectionTitleWithoutMargin}>What&apos;s Hot on SnooSpace</Text>
          </View>
        </View>

        <EdgeSwipeScrollView
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalScrollPadding}
        >
          {filteredEvents.map((event) => {
            const isInterested = Boolean(interestMap[event.eventId] ?? event.isInterested);
            return (
              <View key={event.eventId} style={styles.railCardWrapper}>
                <CompactEventCard
                  event={{
                    ...event,
                    id: event.eventId,
                    is_featured: event.isFeatured
                  }}
                  width={RAIL_CARD_WIDTH}
                  showBookmark={true}
                  isInterested={isInterested}
                  onToggleInterest={handleToggleInterest}
                  onPress={() => handleEventPress(event.eventId, event)}
                />
              </View>
            );
          })}
        </EdgeSwipeScrollView>
      </View>
    );
  };

  // 4b. Open Plans Activity-Type Quick-Nav (2 rows x 4 cards non-scrollable grid)
  const renderOpenPlansQuickNav = () => {
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.railHeader}>
          <Text style={styles.sectionTitle}>Open Plans by Activity</Text>
          <TouchableOpacity
            style={styles.seeAllButton}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => {
              HapticsService.triggerImpactLight();
              if (navigation) {
                navigation.navigate("PlansDiscoverFeed");
              }
            }}
          >
            <Text style={styles.seeAllText}>See all</Text>
            <ChevronRight size={14} color="#71717A" strokeWidth={2.2} style={styles.seeAllChevron} />
          </TouchableOpacity>
        </View>

        <View style={styles.openPlansGridContainer}>
          {randomActivities.map((activity) => (
            <TouchableOpacity
              key={activity.key}
              style={[
                styles.openPlanGridTile,
                { backgroundColor: activity.bg }
              ]}
              activeOpacity={0.75}
              onPress={() => {
                HapticsService.triggerImpactLight();
                if (navigation) {
                  navigation.navigate("PlansDiscoverFeed", {
                    activityType: activity.key === "all" ? undefined : activity.key
                  });
                }
              }}
            >
              <Text style={styles.planActivityEmoji}>{activity.emoji}</Text>
              <Text
                style={[styles.planActivityLabel, { color: activity.text }]}
                numberOfLines={1}
              >
                {activity.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // 5. Category Rails Section (with Client-side Filter Pills)
  const renderCategoryRails = () => {
    return (
      <View>
        {/* Filter Pills Row above Category Rails */}
        <View style={styles.filterPillsContainer}>
          <EdgeSwipeScrollView
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
          </EdgeSwipeScrollView>
        </View>

        {activeCategoryRails.map((rail) => {
          const filteredEvents = filterEvents(rail.events, activeFilter);
          if (filteredEvents.length === 0) return null;

          return (
            <View key={rail.categorySlug} style={styles.sectionContainer}>
              <View style={styles.railHeader}>
                <Text style={styles.sectionTitle}>{rail.category}</Text>
                <TouchableOpacity
                  style={styles.seeAllButton}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => handleSeeAll(rail.categorySlug, rail.category)}
                >
                  <Text style={styles.seeAllText}>See all</Text>
                  <ChevronRight size={14} color="#71717A" strokeWidth={2.2} style={styles.seeAllChevron} />
                </TouchableOpacity>
              </View>
              <EdgeSwipeScrollView
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
                      width={RAIL_CARD_WIDTH}
                      style={{ marginRight: RAIL_CARD_GAP }}
                      showBookmark={true}
                      isInterested={isInterested}
                      onToggleInterest={handleToggleInterest}
                      onPress={() => handleEventPress(event.eventId, event)}
                    />
                  );
                })}
              </EdgeSwipeScrollView>
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
        <EdgeSwipeScrollView
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
                width={RAIL_CARD_WIDTH}
                style={{ marginRight: RAIL_CARD_GAP }}
                showBookmark={true}
                isInterested={isInterested}
                onToggleInterest={handleToggleInterest}
                onPress={() => handleEventPress(event.eventId, event)}
              />
            );
          })}
        </EdgeSwipeScrollView>
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
      {renderCategoryQuickNav()}
      {selectedCategory ? (
        renderFilteredCategoryView()
      ) : (
        <>
          {renderLiveNow()}
          {renderHero()}
          {renderWeekend()}
          {renderRecommendedEvents()}
          {renderWhatsHot()}
          {renderCuratedLists()}
          {renderOpenPlansQuickNav()}
          {renderCategoryRails()}
          {renderSomethingDifferent()}
          {renderOpportunitiesBanner()}
        </>
      )}
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
  titleWithIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 16,
    marginBottom: 12
  },
  sectionTitleWithoutMargin: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 18,
    color: "#2C2C2A"
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 4,
    paddingLeft: 6,
    marginBottom: 12,
  },
  seeAllText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13.5,
    color: "#5F5E5A"
  },
  seeAllChevron: {
    marginTop: 1.5,
  },
  railHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: 16
  },
  railCardWrapper: {
    marginRight: RAIL_CARD_GAP,
  },
  horizontalScrollPadding: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 4,
    paddingBottom: 14
  },

  // Quick Nav Categories
  quickNavSection: {
    marginBottom: 20,
    marginTop: -4
  },
  quickNavScrollPadding: {
    paddingLeft: 16,
    paddingRight: 8,
    paddingTop: 4,
    paddingBottom: 8
  },
  categoryTile: {
    width: 68,
    alignItems: "center",
    marginRight: 10
  },
  categoryTileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    ...SHADOWS.sm
  },
  categoryTileText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: "#475569",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 14
  },
  categoryTileIconContainerActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#2563EB",
    borderWidth: 1.5,
  },
  categoryTileTextActive: {
    fontFamily: FONTS.semiBold,
    color: "#2563EB",
  },

  // Filtered Category Screen Section
  filteredSectionContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    marginBottom: 24,
  },
  filteredHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  filteredCategoryTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 20,
    color: "#2C2C2A",
  },
  filteredCategorySubtitle: {
    fontFamily: FONTS.regular, // Manrope-Regular
    fontSize: 13,
    color: "#71717A",
    marginTop: 2,
  },
  categoryCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F4F4F5",
    justifyContent: "center",
    alignItems: "center",
  },
  clearFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F4F4F5",
    gap: 4,
  },
  clearFilterButtonText: {
    fontFamily: FONTS.semiBold, // Manrope-SemiBold
    fontSize: 12,
    color: "#5F5E5A",
  },
  subcatPillsContainer: {
    paddingRight: 16,
    gap: 8,
  },
  subcatPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "#F4F4F5",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
  },
  subcatPillActive: {
    backgroundColor: "#1E293B",
    borderColor: "#1E293B",
  },
  subcatPillText: {
    fontFamily: FONTS.medium, // Manrope-Medium
    fontSize: 12,
    color: "#52525B",
  },
  subcatPillTextActive: {
    fontFamily: FONTS.semiBold, // Manrope-SemiBold
    color: "#FFFFFF",
  },
  categoryLoaderContainer: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCategoryContainer: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyCategoryTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 17,
    color: "#2C2C2A",
    marginTop: 12,
    marginBottom: 6,
    textAlign: "center",
  },
  emptyCategorySubtitle: {
    fontFamily: FONTS.regular, // Manrope-Regular
    fontSize: 13,
    color: "#71717A",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyClearButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#2C2C2A",
  },
  emptyClearButtonText: {
    fontFamily: FONTS.semiBold, // Manrope-SemiBold
    fontSize: 13,
    color: "#FFFFFF",
  },
  filteredEventsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridEventCardWrapper: {
    marginBottom: 14,
  },

  // Open Plans Activity 2x4 Grid
  openPlansGridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    justifyContent: "space-between",
    rowGap: 10,
  },
  openPlanGridTile: {
    width: OPEN_PLAN_TILE_WIDTH,
    height: 72,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
    paddingHorizontal: 4,
    ...SHADOWS.sm,
  },
  planActivityEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  planActivityLabel: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 11,
    textAlign: "center",
  },

  // Filter Pills
  filterPillsContainer: {
    marginBottom: 16,
    paddingVertical: 6
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
    backgroundColor: "rgba(255, 30, 86, 0.95)"
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
    marginBottom: 12,
  },
  liveIndicatorWrapper: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(255, 30, 86, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  liveIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveBubbleContainer: {
    alignItems: "center",
    marginRight: 14,
    width: 76,
  },
  liveAvatarWrapper: {
    position: "relative",
    marginBottom: 6,
  },
  liveRingGradient: {
    width: 58,
    height: 58,
    borderRadius: 29,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  liveRingWhiteGap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  liveThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F3F4F6",
  },
  liveThumbnailFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1F2",
  },
  liveBubbleLabel: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 11.5,
    lineHeight: 14.5,
    color: "#1A1A1A",
    textAlign: "center",
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

  // Bento Weekend styling (Full-Bleed Image Poster Style)
  bentoRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    height: 180,
  },
  bentoLargeCard: {
    flex: 0.52,
    backgroundColor: "#1A1826",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    ...SHADOWS.md,
    overflow: "hidden",
    position: "relative",
    marginRight: 8,
    justifyContent: "flex-end",
  },
  bentoLargeBottomContent: {
    padding: 10,
    justifyContent: "flex-end",
  },
  bentoOverlayDayText: {
    fontFamily: "Manrope-Bold",
    fontSize: 10,
    color: "#FDE047",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  bentoLargeOverlayTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 14,
    color: "#FFFFFF",
    lineHeight: 18,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  bentoOverlayMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bentoOverlayMetaText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.9)",
  },
  bentoRightColumn: {
    flex: 0.48,
    justifyContent: "space-between",
  },
  bentoSmallCard: {
    height: 86,
    backgroundColor: "#1A1826",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    ...SHADOWS.md,
    overflow: "hidden",
    position: "relative",
  },
  bentoSmallOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 8,
    justifyContent: "space-between",
  },
  bentoSmallTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bentoSmallOverlayDay: {
    fontFamily: "Manrope-Bold",
    fontSize: 9.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  bentoSmallCatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    maxWidth: "50%",
  },
  bentoSmallCatText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 8.5,
    color: "rgba(255, 255, 255, 0.95)",
  },
  bentoSmallOverlayTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 12,
    color: "#FFFFFF",
    lineHeight: 15.5,
    letterSpacing: -0.1,
    marginBottom: 2,
  },
  bentoSmallOverlayMeta: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.85)",
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
    marginRight: RAIL_CARD_GAP
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
    marginRight: RAIL_CARD_GAP,
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

export default React.memo(Explore);
