import React from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 2;
const COLUMN_COUNT = 3;
const ITEM_SIZE = (SCREEN_WIDTH - GRID_GAP * (COLUMN_COUNT + 1)) / COLUMN_COUNT;
// All items same size for proper grid layout

/**
 * DiscoverGrid - Instagram-style 3-column grid for explore content
 */
export default function DiscoverGrid({
  items = [],
  loading = false,
  onItemPress,
  onEndReached,
  refreshing = false,
  onRefresh,
  ListHeaderComponent,
}) {
  // Render grid item - all items same size for proper grid layout
  const renderItem = ({ item, index }) => {
    const isEvent = item.item_type === 'event';
    // All items same size now
    const itemWidth = ITEM_SIZE;
    const itemHeight = ITEM_SIZE;

    return (
      <TouchableOpacity
        style={[
          styles.gridItem,
          {
            width: itemWidth,
            height: itemHeight,
            marginLeft: index % 3 === 0 ? GRID_GAP : GRID_GAP / 2,
            marginRight: index % 3 === 2 ? GRID_GAP : GRID_GAP / 2,
            marginTop: GRID_GAP,
          },
        ]}
        onPress={() => onItemPress?.(item)}
        activeOpacity={0.85}
      >
        {/* Thumbnail Image */}
        {item.thumbnail_url ? (
          <Image
            source={{ uri: item.thumbnail_url }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={COLORS.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.placeholderThumbnail}
          >
            <Ionicons
              name={isEvent ? 'calendar-outline' : 'image-outline'}
              size={isEvent ? 32 : 24}
              color="rgba(255,255,255,0.6)"
            />
          </LinearGradient>
        )}

        {/* Post Multi-Image Indicator */}
        {!isEvent && item.image_urls?.length > 1 && (
          <View style={styles.multiImageBadge}>
            <Ionicons name="copy" size={14} color="#FFFFFF" />
          </View>
        )}

        {/* Event Overlay */}
        {isEvent && (
          <View style={styles.eventOverlay}>
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)']}
              style={styles.eventGradient}
            >
              <View style={styles.eventBadge}>
                <Ionicons name="calendar" size={10} color="#FFFFFF" />
                <Text style={styles.eventBadgeText}>EVENT</Text>
              </View>
              <Text style={styles.eventTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.eventDate}>{item.formatted_date}</Text>
            </LinearGradient>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Loading state
  if (loading && items.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Discovering content...</Text>
      </View>
    );
  }

  // Empty state
  if (!loading && items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="compass-outline" size={64} color={COLORS.textSecondary} />
        <Text style={styles.emptyTitle}>Nothing to discover yet</Text>
        <Text style={styles.emptySubtitle}>Check back later for new content</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      keyExtractor={(item) => `${item.item_type}-${item.id}`}
      numColumns={3}
      contentContainerStyle={styles.gridContainer}
      showsVerticalScrollIndicator={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={
        loading && items.length > 0 ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    paddingTop: 12, // Spacing from filters
    paddingBottom: 100, // Extra padding for tab bar
  },
  gridItem: {
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholderThumbnail: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  multiImageBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    padding: 4,
  },
  eventOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  eventGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 8,
  },
  eventBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  eventBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  eventTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  eventDate: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
  },
  engagementBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  engagementText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
