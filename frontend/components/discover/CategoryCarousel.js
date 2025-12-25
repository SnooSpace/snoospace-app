import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DiscoverEventCard from "./DiscoverEventCard";
import { COLORS, BORDER_RADIUS } from "../../constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.75;
const CARD_GAP = 12;

/**
 * CategoryCarousel - Horizontal scrolling carousel of events for a category
 *
 * Layout:
 * - Category header with title and "See All" button
 * - Horizontal scroll of DiscoverEventCard components
 */
export default function CategoryCarousel({
  category,
  events = [],
  onEventPress,
  onSeeAllPress,
  onBookmark,
  bookmarkedEvents = {},
}) {
  const { name, icon_name, slug } = category;

  if (!events || events.length === 0) {
    return null; // Don't render empty categories
  }

  return (
    <View style={styles.container}>
      {/* Category Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {icon_name && (
            <Ionicons
              name={icon_name}
              size={20}
              color={COLORS.textPrimary}
              style={styles.icon}
            />
          )}
          <Text style={styles.categoryTitle}>{name.toUpperCase()}</Text>
        </View>

        <TouchableOpacity
          style={styles.seeAllButton}
          onPress={() => onSeeAllPress?.(category)}
        >
          <Text style={styles.seeAllText}>See All</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Horizontal Scroll of Event Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="start"
      >
        {events.map((event, index) => (
          <View
            key={event.id}
            style={[
              styles.cardWrapper,
              index === events.length - 1 && styles.lastCard,
            ]}
          >
            <DiscoverEventCard
              event={event}
              onPress={onEventPress}
              onBookmark={onBookmark}
              isBookmarked={bookmarkedEvents[event.id]}
              width={CARD_WIDTH}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    marginRight: 8,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  scrollContent: {
    paddingLeft: 16,
  },
  cardWrapper: {
    marginRight: CARD_GAP,
  },
  lastCard: {
    marginRight: 16,
  },
});
