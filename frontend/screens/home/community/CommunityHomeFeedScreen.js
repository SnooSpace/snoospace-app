import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PostCard from '../../../components/PostCard';
import { mockData } from '../../../data/mockData';
import { apiGet } from '../../../api/client';
import { getAuthToken } from '../../../api/auth';
import { useNotifications } from '../../../context/NotificationsContext';

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function CommunityHomeFeedScreen({ navigation, route }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { unread } = useNotifications();

  useEffect(() => {
    loadFeed();
  }, []);

  // Listen for refresh triggers from create post screen
  useEffect(() => {
    if (route?.params?.refresh) {
      console.log('Refreshing feed due to new post');
      loadFeed();
    }
  }, [route?.params?.refresh]);

  const loadFeed = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      console.log('Loading feed with token:', token ? 'present' : 'missing');
      const response = await apiGet('/posts/feed', 15000, token);
      console.log('Feed response:', response);
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
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  };

  const handleLike = async (postId) => {
    try {
      // In real app, this would be API call
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { ...post, like_count: post.like_count + 1 }
            : post
        )
      );
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleComment = (postId) => {
    // Navigate to comments screen
    console.log('Navigate to comments for post:', postId);
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
          // Navigate to MemberHome first, then to MemberStack -> MemberPublicProfile
          const root = navigation.getParent()?.getParent();
          if (root) {
            root.navigate('MemberHome', {
              screen: 'MemberStack',
              params: {
                screen: 'MemberPublicProfile',
                params: { memberId: userId }
              }
            });
          }
        }
      }}
    />
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.headerTitle}>Community Feed</Text>
        <TouchableOpacity style={styles.headerButton} onPress={() => {
          // Navigate to MemberHome first, then to MemberStack -> Notifications
          const root = navigation.getParent()?.getParent();
          if (root) {
            root.navigate('MemberHome', {
              screen: 'MemberStack',
              params: { screen: 'Notifications' }
            });
          }
        }}>
          <Ionicons name="notifications-outline" size={24} color={TEXT_COLOR} />
          {unread > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : String(unread)}</Text></View>
          )}
        </TouchableOpacity>
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
