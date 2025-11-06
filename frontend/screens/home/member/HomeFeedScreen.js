import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  FlatList, // Added FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../../../context/NotificationsContext';
import { apiGet, apiPost } from '../../../api/client'; // Modified imports
import { getAuthToken, getAuthEmail } from '../../../api/auth';
import PostCard from '../../../components/PostCard'; // Use the robust PostCard component
import CommentsModal from '../../../components/CommentsModal'; // Comments modal
import EventBus from '../../../utils/EventBus';

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function HomeFeedScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const { unread } = useNotifications();
  const [greetingName, setGreetingName] = useState(null);

  useEffect(() => {
    // Always load feed once on mount
    loadFeed();
    loadGreetingName();
  }, []);

  useEffect(() => {
    // Also refresh feed when Home tab is focused
    const unsubscribe = navigation.addListener('focus', () => {
      loadFeed();
    });
    const off = EventBus.on('follow-updated', () => {
      loadFeed();
    });
    return () => { unsubscribe(); off(); };
  }, [navigation]);

  const loadFeed = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const token = await getAuthToken();
      if (!token) throw new Error("Authentication token not found."); // Added check for token
      
      const response = await apiGet('/posts/feed', 15000, token);
      setPosts(response.posts || []);
    } catch (error) {
      console.error('Error loading feed:', error);
      setErrorMsg(error?.message || 'Failed to load posts');
      // For now, show mock data if API fails
      setPosts([
        {
          id: 1,
          author_name: "Tech Enthusiasts",
          author_username: "tech_enthusiasts",
          author_photo_url: "https://via.placeholder.com/40",
          caption: "Alex The new gear is insane! Who's going to the Tech Summit?",
          image_urls: ["https://via.placeholder.com/400x300"],
          like_count: 2100,
          comment_count: 312,
          created_at: new Date().toISOString(),
          isLiked: false
        },
        {
          id: 2,
          author_name: "Outdoor Explorers",
          author_username: "outdoor_explorers",
          author_photo_url: "https://via.placeholder.com/40",
          caption: "Sarah Who's ready for an adventure? Yosemite is calling!",
          image_urls: ["https://via.placeholder.com/400x300"],
          like_count: 1800,
          comment_count: 250,
          created_at: new Date(Date.now() - 3600000).toISOString(),
          isLiked: false
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadGreetingName = async () => {
    try {
      const token = await getAuthToken();
      const email = await getAuthEmail();
      if (!token || !email) return;
      const res = await apiPost('/auth/get-user-profile', { email }, 12000, token);
      const prof = res?.profile || {};
      const name = prof.full_name || prof.name || prof.username || 'Member';
      setGreetingName(name);
    } catch (e) {
      setGreetingName('Member');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  };

  const handleLike = async (postId, isLiked) => { // Modified handleLike
    try {
      const token = await getAuthToken();
      if (isLiked) {
        await apiPost(`/posts/${postId}/like`, {}, 15000, token);
      } else {
        await apiPost(`/posts/${postId}/unlike`, {}, 15000, token);
      }
    } catch (error) {
      console.error('Error updating like status:', error);
      // Note: A robust implementation would revert the optimistic UI update on failure.
      // For now, we'll keep it simple and just log the error.
    }
  };

  const formatCount = (count) => {
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'k';
    }
    return count.toString();
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const postTime = new Date(timestamp);
    const diffInHours = Math.floor((now - postTime) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'now';
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d`;
    return `${Math.floor(diffInHours / 168)}w`;
  };

  const handleCommentPress = (postId) => {
    setSelectedPostId(postId);
    setCommentsModalVisible(true);
  };

  const handleCommentCountChange = (postId) => {
    return (prevCount) => {
      // Update the comment count in the posts array
      setPosts(prevPosts =>
        prevPosts.map(p =>
          p.id === postId
            ? { ...p, comment_count: prevCount }
            : p
        )
      );
    };
  };

  const renderPost = ({ item }) => ( // Modified renderPost
    <PostCard 
      post={item}
      onLike={(postId, isLiked) => {
        // Optimistic UI update (preserve both snake_case and camelCase for consistency)
        setPosts(prevPosts =>
          prevPosts.map(p =>
            p.id === postId
              ? { ...p, is_liked: isLiked, isLiked, like_count: p.like_count + (isLiked ? 1 : -1) }
              : p
          )
        );
        // API call
        handleLike(postId, isLiked);
      }}
      onComment={handleCommentPress}
      onUserPress={(userId, userType) => {
        if (userType === 'member' || !userType) {
          navigation.navigate('MemberPublicProfile', { memberId: userId });
        }
      }}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>SnooSpace</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={24} color={TEXT_COLOR} />
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 9 ? '9+' : String(unread)}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="menu" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
        </View>
      </View>

      {errorMsg ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity onPress={() => { setErrorMsg(""); loadFeed(); }}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.greeting}>
        <Text style={styles.greetingText}>Hi {greetingName || 'Member'}!</Text>
        <Text style={styles.greetingSubtext}>Discover what's happening</Text>
      </View>

      {/* Feed */}
      <FlatList // Replaced ScrollView with FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id.toString()}
        style={styles.feed}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => ( // Added ListEmptyComponent
          loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading posts...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No posts yet</Text>
              <Text style={styles.emptySubtext}>Follow some users to see their posts here</Text>
              {errorMsg ? (
                <TouchableOpacity onPress={loadFeed} style={styles.retryButton}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )
        )}
      />
      
      {/* Comments Modal */}
      <CommentsModal
        visible={commentsModalVisible}
        postId={selectedPostId}
        onClose={() => {
          setCommentsModalVisible(false);
          setSelectedPostId(null);
        }}
        onCommentCountChange={selectedPostId ? handleCommentCountChange(selectedPostId) : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 15,
  },
  headerButton: {
    padding: 5,
  },
  badge: {
    position: 'absolute',
    right: 0,
    top: -2,
    backgroundColor: '#D93025',
    borderRadius: 8,
    minWidth: 16,
    paddingHorizontal: 4,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  greeting: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  greetingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 5,
  },
  greetingSubtext: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  feed: {
    flex: 1,
  },
  postContainer: {
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
    paddingBottom: 15,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  authorDetails: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  authorUsername: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  moreButton: {
    padding: 5,
  },
  postContent: {
    paddingHorizontal: 20,
  },
  postImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 12,
  },
  postCaption: {
    fontSize: 16,
    color: TEXT_COLOR,
    lineHeight: 22,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bookmarkButton: {
    marginLeft: 'auto',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_COLOR,
  },
  commentsPreview: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  commentsText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  postTime: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    textAlign: 'center',
  },
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFF2F0',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#D93025',
    flex: 1,
    marginRight: 10,
  },
  retryText: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: 12,
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
