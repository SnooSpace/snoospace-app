import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SHADOWS } from "../../../constants/theme";
import { getCommunityPublicEvents } from "../../../api/events";

const PRIMARY_COLOR = COLORS.primary;
const TEXT_COLOR = COLORS.textPrimary;
const LIGHT_TEXT_COLOR = COLORS.textSecondary;

export default function CommunityPublicEventsListScreen({ navigation, route }) {
  const { communityId, initialTab = "upcoming" } = route.params;
  const [activeTab, setActiveTab] = useState(initialTab);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tabCounts, setTabCounts] = useState({ upcoming: 0, past: 0 });

  // Fetch counts for both tabs on initial mount
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [upcomingData, pastData] = await Promise.all([
          getCommunityPublicEvents(communityId, {
            limit: 1,
            offset: 0,
            type: "upcoming",
          }),
          getCommunityPublicEvents(communityId, {
            limit: 1,
            offset: 0,
            type: "past",
          }),
        ]);
        // The API returns events array; we need total count
        // For now, load all to get accurate count (or add count endpoint later)
        const [upcomingFull, pastFull] = await Promise.all([
          getCommunityPublicEvents(communityId, {
            limit: 100,
            offset: 0,
            type: "upcoming",
          }),
          getCommunityPublicEvents(communityId, {
            limit: 100,
            offset: 0,
            type: "past",
          }),
        ]);
        setTabCounts({
          upcoming: upcomingFull?.events?.length || 0,
          past: pastFull?.events?.length || 0,
        });
      } catch (error) {
        console.error("Error loading tab counts:", error);
      }
    };
    loadCounts();
  }, [communityId]);

  useEffect(() => {
    loadEvents(true);
  }, [activeTab]);

  const loadEvents = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setOffset(0);
        setHasMore(true);
      } else {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
      }

      const currentOffset = reset ? 0 : offset;
      const data = await getCommunityPublicEvents(communityId, {
        limit: 20,
        offset: currentOffset,
        type: activeTab,
      });

      const newEvents = data?.events || [];
      if (reset) {
        setEvents(newEvents);
      } else {
        setEvents((prev) => [...prev, ...newEvents]);
      }

      setHasMore(newEvents.length >= 20);
      setOffset(currentOffset + newEvents.length);
    } catch (error) {
      console.error("Error loading community events:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadEvents(true);
  };

  const handleEventPress = (event) => {
    navigation.navigate("EventDetails", {
      eventId: event.id,
      eventData: event,
    });
  };

  const renderEventItem = ({ item }) => {
    const minPrice =
      item.ticket_types && item.ticket_types.length > 0
        ? Math.min(
            ...item.ticket_types.map((t) => parseFloat(t.base_price || 0))
          )
        : 0;
    const priceDisplay = minPrice > 0 ? `₹${minPrice} onwards` : "Free";

    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => handleEventPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.eventImageContainer}>
          <Image
            source={{
              uri:
                item.banner_url ||
                "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200",
            }}
            style={styles.eventImage}
          />
          {item.is_cancelled && (
            <View style={styles.cancelledOverlay}>
              <Text style={styles.cancelledText}>CANCELLED</Text>
            </View>
          )}
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText}>
              {new Date(item.event_date).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
              })}
            </Text>
          </View>
        </View>

        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.eventMeta}>
            <Ionicons
              name="location-outline"
              size={14}
              color={LIGHT_TEXT_COLOR}
            />
            <Text style={styles.eventMetaText} numberOfLines={1}>
              {item.event_type === "virtual"
                ? "Virtual Event"
                : item.location_name || "In-person"}
            </Text>
          </View>
          <View style={styles.eventFooter}>
            <Text style={styles.priceText}>{priceDisplay}</Text>
            {activeTab === "upcoming" && (
              <TouchableOpacity style={styles.bookButton}>
                <Text style={styles.bookButtonText}>Book</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Community Events</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab("upcoming")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "upcoming" && styles.activeTabText,
            ]}
          >
            Scheduled ({tabCounts.upcoming})
          </Text>
          {activeTab === "upcoming" && (
            <LinearGradient
              colors={["#00C6FF", "#007AFF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.activeTabIndicator}
            />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab("past")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "past" && styles.activeTabText,
            ]}
          >
            Hosted ({tabCounts.past})
          </Text>
          {activeTab === "past" && (
            <LinearGradient
              colors={["#00C6FF", "#007AFF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.activeTabIndicator}
            />
          )}
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      ) : (
        <FlatList
          data={events}
          renderItem={renderEventItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PRIMARY_COLOR}
            />
          }
          onEndReached={() => loadEvents(false)}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore && (
              <ActivityIndicator size="small" color={PRIMARY_COLOR} />
            )
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={64} color="#E5E5EA" />
              <Text style={styles.emptyText}>No {activeTab} events found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_COLOR,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    position: "relative",
  },
  activeTabIndicator: {
    position: "absolute",
    bottom: 0,
    height: 3,
    width: "80%",
    borderRadius: 3,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: LIGHT_TEXT_COLOR,
  },
  activeTabText: {
    color: PRIMARY_COLOR,
  },
  listContent: {
    padding: 16,
    gap: 16,
  },
  eventCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    ...SHADOWS.sm,
  },
  eventImageContainer: {
    width: 110,
    height: 110,
    position: "relative",
  },
  eventImage: {
    width: "100%",
    height: "100%",
  },
  cancelledOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 100, 100, 0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  cancelledText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 12,
    transform: [{ rotate: "-15deg" }],
  },
  dateBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dateBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: TEXT_COLOR,
  },
  eventInfo: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_COLOR,
    lineHeight: 22,
    marginBottom: 4,
  },
  eventMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  eventMetaText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
  },
  eventFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "auto",
  },
  priceText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#34C759",
  },
  bookButton: {
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  bookButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: PRIMARY_COLOR,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    fontWeight: "500",
  },
});
