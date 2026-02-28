import React, { useMemo } from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS } from '../constants/theme';
import SnooLoader from "./ui/SnooLoader";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 2;
const COLUMN_COUNT = 3;
const SMALL_ITEM = (SCREEN_WIDTH - GRID_GAP * 4) / 3; // 1-column item
const LARGE_ITEM_WIDTH = SMALL_ITEM * 2 + GRID_GAP; // 2-column item
const POST_HEIGHT = SMALL_ITEM; // Square posts
const EVENT_HEIGHT = SMALL_ITEM * 1.3; // Events are 1.3x taller

/**
 * DiscoverGrid - Custom grid with Row A/B pattern
 * Row A: Event (2 cols) + Post (1 col)
 * Row B: Post + Post + Post (3 posts)
 * Row A': Post (1 col) + Event (2 cols) - inverted
 * Repeats: A → B → A' → B
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
  // Organize items into row pattern
  const rows = useMemo(() => {
    const events = items.filter(i => i.item_type === 'event');
    const posts = items.filter(i => i.item_type === 'post');
    
    const result = [];
    let eventIndex = 0;
    let postIndex = 0;
    let rowPattern = 0; // 0: A, 1: B, 2: A', 3: B
    
    while (postIndex < posts.length || eventIndex < events.length) {
      const patternType = rowPattern % 4;
      
      if (patternType === 0) {
        // Row A: Event (2 cols) + Post (1 col)
        if (eventIndex < events.length && postIndex < posts.length) {
          result.push({
            type: 'eventLeft',
            event: events[eventIndex],
            post: posts[postIndex],
          });
          eventIndex++;
          postIndex++;
        } else if (postIndex + 2 < posts.length) {
          // No events, fall back to 3 posts
          result.push({
            type: 'posts3',
            posts: [posts[postIndex], posts[postIndex + 1], posts[postIndex + 2]],
          });
          postIndex += 3;
        } else {
          // Fill remaining posts
          const remaining = posts.slice(postIndex);
          if (remaining.length > 0) {
            result.push({ type: 'posts3', posts: remaining });
          }
          break;
        }
      } else if (patternType === 1 || patternType === 3) {
        // Row B: 3 posts
        if (postIndex + 2 < posts.length) {
          result.push({
            type: 'posts3',
            posts: [posts[postIndex], posts[postIndex + 1], posts[postIndex + 2]],
          });
          postIndex += 3;
        } else {
          const remaining = posts.slice(postIndex);
          if (remaining.length > 0) {
            result.push({ type: 'posts3', posts: remaining });
          }
          break;
        }
      } else if (patternType === 2) {
        // Row A': Post (1 col) + Event (2 cols) - inverted
        if (eventIndex < events.length && postIndex < posts.length) {
          result.push({
            type: 'eventRight',
            post: posts[postIndex],
            event: events[eventIndex],
          });
          eventIndex++;
          postIndex++;
        } else if (postIndex + 2 < posts.length) {
          result.push({
            type: 'posts3',
            posts: [posts[postIndex], posts[postIndex + 1], posts[postIndex + 2]],
          });
          postIndex += 3;
        } else {
          const remaining = posts.slice(postIndex);
          if (remaining.length > 0) {
            result.push({ type: 'posts3', posts: remaining });
          }
          break;
        }
      }
      
      rowPattern++;
    }
    
    return result;
  }, [items]);

  // Render a single post item
  const renderPostItem = (post, width = SMALL_ITEM, height = POST_HEIGHT) => {
    if (!post) return <View style={{ width, height }} />;
    
    return (
      <TouchableOpacity
        key={`post-${post.id}`}
        style={[styles.gridItem, { width, height }]}
        onPress={() => onItemPress?.(post)}
        activeOpacity={0.85}
      >
        {post.thumbnail_url ? (
          <Image
            source={{ uri: post.thumbnail_url }}
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
            <Ionicons name="image-outline" size={24} color="rgba(255,255,255,0.6)" />
          </LinearGradient>
        )}
        {post.image_urls?.length > 1 && (
          <View style={styles.multiImageBadge}>
            <Ionicons name="copy" size={14} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Render an event item
  const renderEventItem = (event, width = LARGE_ITEM_WIDTH, height = EVENT_HEIGHT) => {
    if (!event) return <View style={{ width, height }} />;
    
    return (
      <TouchableOpacity
        key={`event-${event.id}`}
        style={[styles.gridItem, { width, height }]}
        onPress={() => onItemPress?.(event)}
        activeOpacity={0.85}
      >
        {event.thumbnail_url ? (
          <Image
            source={{ uri: event.thumbnail_url }}
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
            <Ionicons name="calendar-outline" size={32} color="rgba(255,255,255,0.6)" />
          </LinearGradient>
        )}
        <View style={styles.eventOverlay}>
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.85)']}
            style={styles.eventGradient}
          >
            <View style={styles.eventBadge}>
              <Ionicons name="calendar" size={10} color="#FFFFFF" />
              <Text style={styles.eventBadgeText}>EVENT</Text>
            </View>
            <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
            <Text style={styles.eventDate}>{event.formatted_date}</Text>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    );
  };

  // Render a row based on type
  const renderRow = (row, index) => {
    if (row.type === 'eventLeft') {
      // Event on left, post on right (post fills height to match event)
      return (
        <View key={`row-${index}`} style={styles.row}>
          {renderEventItem(row.event)}
          <View style={{ width: GRID_GAP }} />
          {renderPostItem(row.post, SMALL_ITEM, EVENT_HEIGHT)}
        </View>
      );
    } else if (row.type === 'eventRight') {
      // Post on left, event on right
      return (
        <View key={`row-${index}`} style={styles.row}>
          {renderPostItem(row.post, SMALL_ITEM, EVENT_HEIGHT)}
          <View style={{ width: GRID_GAP }} />
          {renderEventItem(row.event)}
        </View>
      );
    } else if (row.type === 'posts3') {
      // 3 posts in a row
      return (
        <View key={`row-${index}`} style={styles.row}>
          {row.posts.map((post, i) => (
            <React.Fragment key={post?.id || `empty-${i}`}>
              {renderPostItem(post)}
              {i < 2 && <View style={{ width: GRID_GAP }} />}
            </React.Fragment>
          ))}
        </View>
      );
    }
    return null;
  };

  // Loading state
  if (loading && items.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <SnooLoader size="large" color={COLORS.primary} />
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

  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 200;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      onEndReached?.();
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.gridContainer}
      showsVerticalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={400}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {ListHeaderComponent}
      {rows.map((row, index) => renderRow(row, index))}
      {loading && items.length > 0 && (
        <View style={styles.footerLoader}>
          <SnooLoader size="small" color={COLORS.primary} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gridContainer: {
    paddingHorizontal: GRID_GAP,
    paddingBottom: 100,
  },
  row: {
    flexDirection: 'row',
    marginTop: GRID_GAP,
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
    height: '50%',
  },
  eventGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 10,
  },
  eventBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 6,
  },
  eventBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  eventDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
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
