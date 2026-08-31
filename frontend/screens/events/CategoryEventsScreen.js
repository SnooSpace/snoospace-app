import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Calendar,
  LayoutGrid,
  LayoutList,
} from "lucide-react-native";
import { COLORS, FONTS, SHADOWS } from "../../constants/theme";
import { getEventsByCategory } from "../../api/categories";
import { toggleEventInterest } from "../../api/events";
import EventBus from "../../utils/EventBus";
import HapticsService from "../../services/HapticsService";
import SnooLoader from "../../components/ui/SnooLoader";
import CompactEventCard from "../../components/cards/CompactEventCard";
import EventCard from "../../components/cards/EventCard";

const TEXT_COLOR = "#1C1C1E";
const LIGHT_TEXT_COLOR = "#8E8E93";

export default function CategoryEventsScreen({ navigation, route }) {
  const { categoryId, categorySlug, categoryName } = route.params || {};
  const identifier = categoryId || categorySlug;

  const [events, setEvents] = useState([]);
  const [resolvedCategoryName, setResolvedCategoryName] = useState(categoryName || "");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [isGrid, setIsGrid] = useState(true);
  const [interestMap, setInterestMap] = useState({});

  const loadEvents = useCallback(
    async (isRefresh = false) => {
      if (!identifier) {
        setLoading(false);
        return;
      }
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const response = await getEventsByCategory(identifier);
        if (response?.events) {
          setEvents(response.events);
          const map = {};
          response.events.forEach((evt) => {
            if (evt?.id) {
              map[evt.id] = Boolean(evt.is_interested || evt.isInterested);
              map[String(evt.id)] = Boolean(evt.is_interested || evt.isInterested);
            }
          });
          setInterestMap((prev) => ({ ...map, ...prev }));
        }
        if (response?.category?.name) {
          setResolvedCategoryName(response.category.name);
        }
      } catch (err) {
        console.error("[CategoryEvents] Error loading:", err);
        setError("Failed to load events");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [identifier]
  );

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Synchronize interest changes with EventBus
  useEffect(() => {
    const unsub = EventBus.on("event-interest-updated", ({ eventId, isInterested }) => {
      if (eventId) {
        const idKey = String(eventId);
        setInterestMap((prev) => ({
          ...prev,
          [eventId]: Boolean(isInterested),
          [idKey]: Boolean(isInterested),
        }));
      }
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  const handleRefresh = () => loadEvents(true);

  const handleEventPress = (event) => {
    navigation.navigate("EventDetails", {
      eventId: event.id,
      eventData: event,
    });
  };

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
      [idKey]: newState,
    }));

    try {
      const response = await toggleEventInterest(eventId);
      if (response?.success) {
        const confirmedState = Boolean(response.is_interested);
        setInterestMap((prev) => ({
          ...prev,
          [eventId]: confirmedState,
          [idKey]: confirmedState,
        }));
        EventBus.emit("event-interest-updated", {
          eventId,
          isInterested: confirmedState,
        });
      } else {
        // Revert on failure
        setInterestMap((prev) => ({
          ...prev,
          [eventId]: currentState,
          [idKey]: currentState,
        }));
      }
    } catch (err) {
      console.error("[CategoryEvents] toggleEventInterest error:", err);
      setInterestMap((prev) => ({
        ...prev,
        [eventId]: currentState,
        [idKey]: currentState,
      }));
    }
  };

  const headerTitle = resolvedCategoryName || categoryName || "Events";

  const renderEventItem = ({ item }) => {
    const isInterested = Boolean(
      interestMap[item.id] ??
      interestMap[String(item.id)] ??
      item.is_interested ??
      item.isInterested
    );

    if (isGrid) {
      return (
        <View style={styles.gridItem}>
          <CompactEventCard
            event={item}
            onPress={() => handleEventPress(item)}
            showBookmark={true}
            isInterested={isInterested}
            onToggleInterest={handleToggleInterest}
          />
        </View>
      );
    }

    return (
      <EventCard
        event={item}
        onPress={() => handleEventPress(item)}
        compact={false}
        style={{ marginHorizontal: 0, marginBottom: 20 }}
      />
    );
  };

  if (loading && events.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ArrowLeft size={22} color={TEXT_COLOR} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <SnooLoader size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ArrowLeft size={22} color={TEXT_COLOR} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {headerTitle}
        </Text>
        <TouchableOpacity
          style={styles.layoutToggleBtn}
          onPress={() => {
            HapticsService.triggerImpactLight();
            setIsGrid((prev) => !prev);
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {isGrid ? (
            <LayoutList size={20} color={TEXT_COLOR} strokeWidth={2} />
          ) : (
            <LayoutGrid size={20} color={TEXT_COLOR} strokeWidth={2} />
          )}
        </TouchableOpacity>
      </View>

      {/* Events List */}
      <FlatList
        key={isGrid ? "category-grid-2col" : "category-list-1col"}
        data={events}
        renderItem={renderEventItem}
        keyExtractor={(item) => item.id.toString()}
        numColumns={isGrid ? 2 : 1}
        columnWrapperStyle={isGrid ? styles.gridRow : undefined}
        contentContainerStyle={[
          styles.listContent,
          isGrid && styles.gridListContent,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Calendar
              size={56}
              color={LIGHT_TEXT_COLOR}
              strokeWidth={1.5}
            />
            <Text style={styles.emptyTitle}>No Events</Text>
            <Text style={styles.emptySubtitle}>
              No upcoming events in this category right now
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    fontFamily: FONTS.primary || "BasicCommercial-Bold",
    fontSize: 18,
    color: TEXT_COLOR,
    textAlign: "center",
    flex: 1,
    marginHorizontal: 8,
  },
  layoutToggleBtn: {
    padding: 6,
    borderRadius: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  gridListContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  gridRow: {
    justifyContent: "space-between",
    marginBottom: 16,
  },
  gridItem: {
    flex: 0.485,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily: FONTS.primary || "BasicCommercial-Bold",
    fontSize: 20,
    color: TEXT_COLOR,
    marginTop: 16,
  },
  emptySubtitle: {
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    textAlign: "center",
    marginTop: 8,
  },
});
