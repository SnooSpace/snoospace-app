import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SHADOWS } from "../../constants/theme";
import { getEventsByCategory } from "../../api/categories";
import { getGradientForName, getInitials } from "../../utils/AvatarGenerator";

const TEXT_COLOR = "#1C1C1E";
const LIGHT_TEXT_COLOR = "#8E8E93";

export default function CategoryEventsScreen({ navigation, route }) {
  const { categoryId, categoryName } = route.params || {};
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadEvents = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const response = await getEventsByCategory(categoryId);
        if (response?.events) {
          setEvents(response.events);
        }
      } catch (err) {
        console.error("[CategoryEvents] Error loading:", err);
        setError("Failed to load events");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [categoryId]
  );

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleRefresh = () => loadEvents(true);

  const handleEventPress = (event) => {
    navigation.navigate("EventDetails", {
      eventId: event.id,
      eventData: event,
    });
  };

  const renderEventItem = ({ item }) => {
    const hasValidLogo =
      item.community_logo && /^https?:\/\//.test(item.community_logo);

    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => handleEventPress(item)}
        activeOpacity={0.7}
      >
        {/* Banner Image */}
        <View style={styles.imageContainer}>
          {item.banner_url ? (
            <Image
              source={{ uri: item.banner_url }}
              style={styles.eventImage}
            />
          ) : (
            <LinearGradient
              colors={COLORS.primaryGradient}
              style={[styles.eventImage, styles.placeholderImage]}
            >
              <Ionicons
                name="calendar"
                size={32}
                color="rgba(255,255,255,0.7)"
              />
            </LinearGradient>
          )}
          {/* Date Badge */}
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText}>{item.formatted_date}</Text>
          </View>
        </View>

        {/* Event Info */}
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {item.title}
          </Text>

          {/* Community Row */}
          <View style={styles.communityRow}>
            {hasValidLogo ? (
              <Image
                source={{ uri: item.community_logo }}
                style={styles.communityAvatar}
              />
            ) : (
              <LinearGradient
                colors={getGradientForName(item.community_name || "C")}
                style={[styles.communityAvatar, styles.avatarGradient]}
              >
                <Text style={styles.avatarInitials}>
                  {getInitials(item.community_name || "C")}
                </Text>
              </LinearGradient>
            )}
            <Text style={styles.communityName} numberOfLines={1}>
              {item.community_name}
            </Text>
          </View>

          {/* Meta Row */}
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={14} color={LIGHT_TEXT_COLOR} />
            <Text style={styles.metaText}>{item.formatted_time}</Text>
            {item.attendee_count > 0 && (
              <>
                <Ionicons
                  name="people-outline"
                  size={14}
                  color={LIGHT_TEXT_COLOR}
                  style={{ marginLeft: 12 }}
                />
                <Text style={styles.metaText}>{item.attendee_count}</Text>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
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
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{categoryName || "Events"}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{categoryName || "Events"}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Events List */}
      <FlatList
        data={events}
        renderItem={renderEventItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
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
            <Ionicons
              name="calendar-outline"
              size={64}
              color={LIGHT_TEXT_COLOR}
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
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_COLOR,
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
  eventCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 16,
    ...SHADOWS.md,
    overflow: "hidden",
  },
  imageContainer: {
    position: "relative",
  },
  eventImage: {
    width: "100%",
    height: 180,
  },
  placeholderImage: {
    justifyContent: "center",
    alignItems: "center",
  },
  dateBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dateBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  eventInfo: {
    padding: 16,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT_COLOR,
    marginBottom: 8,
  },
  communityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  communityAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  avatarGradient: {
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  communityName: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    flex: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    marginLeft: 4,
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
    color: TEXT_COLOR,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    textAlign: "center",
    marginTop: 8,
  },
});
