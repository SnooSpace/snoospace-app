import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CategoryCarousel from "./CategoryCarousel";
import { getDiscoverFeedV2 } from "../../api/categories";
import { COLORS } from "../../constants/theme";

/**
 * DiscoverFeedV2 - Main discover feed component with category carousels
 *
 * Replaces the old DiscoverGrid with a category-based layout:
 * - Each category is a horizontal carousel of events
 * - Categories are ordered by admin preference
 * - Empty categories are hidden
 */
export default function DiscoverFeedV2({
  navigation,
  onEventPress,
  ListHeaderComponent,
}) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [bookmarkedEvents, setBookmarkedEvents] = useState({});

  // Load discover feed
  const loadFeed = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await getDiscoverFeedV2();

      if (response?.categories) {
        setCategories(response.categories);
      }
    } catch (err) {
      console.error("[DiscoverFeedV2] Error loading feed:", err);
      setError("Failed to load discover feed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    loadFeed(true);
  }, [loadFeed]);

  // Handle event press
  const handleEventPress = useCallback(
    (event) => {
      if (onEventPress) {
        onEventPress(event);
      } else if (navigation) {
        navigation.navigate("EventDetails", {
          eventId: event.id,
          eventData: event,
        });
      }
    },
    [navigation, onEventPress]
  );

  // Handle see all press
  const handleSeeAllPress = useCallback(
    (category) => {
      if (navigation) {
        navigation.navigate("CategoryEvents", {
          categoryId: category.id,
          categoryName: category.name,
        });
      }
    },
    [navigation]
  );

  // Handle bookmark
  const handleBookmark = useCallback((event) => {
    setBookmarkedEvents((prev) => ({
      ...prev,
      [event.id]: !prev[event.id],
    }));
    // TODO: Persist bookmark to backend
  }, []);

  // Loading state
  if (loading && categories.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading events...</Text>
      </View>
    );
  }

  // Error state
  if (error && categories.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
        <Text style={styles.errorTitle}>Oops!</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  // Empty state
  if (!loading && categories.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="calendar-outline"
          size={64}
          color={COLORS.textSecondary}
        />
        <Text style={styles.emptyTitle}>No Events Yet</Text>
        <Text style={styles.emptySubtitle}>
          Check back later for upcoming events in your area
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* Optional Header Component */}
      {ListHeaderComponent}

      {/* Category Carousels */}
      {categories.map((category) => (
        <CategoryCarousel
          key={category.id}
          category={category}
          events={category.events}
          onEventPress={handleEventPress}
          onSeeAllPress={handleSeeAllPress}
          onBookmark={handleBookmark}
          bookmarkedEvents={bookmarkedEvents}
        />
      ))}

      {/* Bottom padding */}
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    paddingTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginTop: 12,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 8,
  },
  bottomPadding: {
    height: 100,
  },
});
