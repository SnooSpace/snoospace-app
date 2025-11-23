import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import PostCard from '../../../components/PostCard';
import { mockData } from '../../../data/mockData';
import { apiGet } from '../../../api/client';
import { getAuthToken } from '../../../api/auth';
import { useNotifications } from '../../../context/NotificationsContext';
import { getUnreadCount as getMessageUnreadCount } from '../../../api/messages';
import EventBus from '../../../utils/EventBus';
import CommentsModal from '../../../components/CommentsModal';

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function CommunityHomeFeedScreen({ navigation, route }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messageUnread, setMessageUnread] = useState(0);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const { unread, loadInitial: refreshNotifications } = useNotifications();

  const loadFeed = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const response = await apiGet('/posts/feed', 15000, token);
      const apiPosts = Array.isArray(response.posts) ? response.posts : [];
      // Ensure image_urls is an array (backend sends array; guard for strings)
      const normalized = apiPosts.map(p => ({
        ...p,
        image_urls: Array.isArray(p.image_urls)
          ? p.image_urls
          : (typeof p.image_urls === 'string' ? (() => { try { return JSON.parse(p.image_urls); } catch { return []; } })() : []),
      }));
      setPosts(normalized);
    } catch (error) {
      console.error('Error loading feed:', error);
      console.log('Falling back to mock data');
      // Fallback to mock data if API fails, adapt fields to UI shape
      const adapted = (mockData.posts || []).map(p => ({
        ...p,
        author_photo_url: p.author_photo_url || p.author_photo || undefined,
      }));
      setPosts(adapted);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
    loadMessageUnreadCount();
  }, [loadFeed]);

  useEffect(() => {
    const unsubscribe = EventBus.on('post-like-updated', (payload) => {
      if (!payload?.postId) return;
      setPosts((prev) =>
        prev.map((post) =>
          post.id === payload.postId
            ? {
                ...post,
                is_liked: payload.isLiked,
                isLiked: payload.isLiked,
                like_count:
                  typeof payload.likeCount === 'number'
                    ? payload.likeCount
                    : post.like_count,
              }
            : post
        )
      );
    });
    return () => unsubscribe && unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = EventBus.on('post-created', () => {
      loadFeed();
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loadFeed]);

  useFocusEffect(
    useCallback(() => {
      loadMessageUnreadCount();
      refreshNotifications?.();
    }, [refreshNotifications])
  );

  // Listen for refresh triggers from create post screen
  useEffect(() => {
    if (route?.params?.refresh) {
      console.log('Refreshing feed due to new post');
      loadFeed();
    }
  }, [route?.params?.refresh]);

  const loadMessageUnreadCount = useCallback(async () => {
    try {
      const response = await getMessageUnreadCount();
      setMessageUnread(response?.unreadCount || 0);
    } catch (error) {
      console.error('Error loading message unread count:', error);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  };

  const handleLike = (postId, nextLiked) => {
    setPosts(prevPosts =>
      prevPosts.map(post =>
        post.id === postId
          ? {
              ...post,
              is_liked: nextLiked,
              isLiked: nextLiked,
              like_count: Math.max(0, (post.like_count || 0) + (nextLiked ? 1 : -1)),
            }
          : post
      )
    );
  };

  const handleComment = (postId) => {
    setSelectedPostId(postId);
    setCommentsModalVisible(true);
  };

  const handleFollow = async (entityId, entityType) => {
    try {
      // In real app, this would be API call
      console.log('Follow entity:', entityId, entityType);
    } catch (error) {
      console.error('Error following entity:', error);
    }
  };

  const renderPost = ({ item }) => (
    <PostCard
      post={item}
      onLike={handleLike}
      onComment={handleComment}
      onFollow={handleFollow}
      onUserPress={(userId, userType) => {
        if (userType === 'member' || !userType) {
          // Navigate to member profile within Community's Home stack
          navigation.navigate('MemberPublicProfile', { memberId: userId });
        } else if (userType === 'community') {
          navigation.navigate('Profile', {
            screen: 'CommunityPublicProfile',
            params: { communityId: userId }
          });
        } else if (userType === 'sponsor') {
          Alert.alert('Sponsor Profile', 'Sponsor profile navigation will be implemented soon');
        } else if (userType === 'venue') {
          Alert.alert('Venue Profile', 'Venue profile navigation will be implemented soon');
        }
      }}
    />
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.headerTitle}>Community Feed</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={24} color={TEXT_COLOR} />
            {unread > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : String(unread)}</Text></View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('ConversationsList')}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={24} color={TEXT_COLOR} />
            {messageUnread > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{messageUnread > 9 ? '9+' : String(messageUnread)}</Text></View>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.headerSubtitle}>
        Stay updated with posts from communities and members you follow
      </Text>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={60} color={LIGHT_TEXT_COLOR} />
      <Text style={styles.emptyTitle}>No Posts Yet</Text>
      <Text style={styles.emptyText}>
        Follow some communities and members to see their posts here
      </Text>
      <TouchableOpacity 
        style={styles.exploreButton}
        onPress={() => navigation.navigate('Search')}
      >
        <Text style={styles.exploreButtonText}>Explore Communities</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Loading feed...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[PRIMARY_COLOR]}
            tintColor={PRIMARY_COLOR}
          />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      <CommentsModal
        visible={commentsModalVisible}
        postId={selectedPostId}
        onClose={() => {
          setCommentsModalVisible(false);
          setSelectedPostId(null);
        }}
        onCommentCountChange={(newCount) => {
          if (selectedPostId) {
            setPosts(prevPosts =>
              prevPosts.map(p =>
                p.id === selectedPostId
                  ? { ...p, comment_count: newCount }
                  : p
              )
            );
          }
        }}
        navigation={navigation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    marginTop: 10,
  },
  listContainer: {
    flexGrow: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: { padding: 4 },
  badge: { position: 'absolute', right: -2, top: -4, backgroundColor: '#D93025', borderRadius: 8, minWidth: 16, height: 16, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  headerSubtitle: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  exploreButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingHorizontal: 30,
    paddingVertical: 15,
  },
  exploreButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
