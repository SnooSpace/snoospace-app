import React, { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
import { useNotifications } from '../context/NotificationsContext';
import { apiGet, apiPost } from '../api/client';
import { getAuthToken, getAuthEmail } from '../api/auth';
import { getUnreadCount as getMessageUnreadCount } from '../api/messages';
import PostCard from './PostCard';
import CommentsModal from './CommentsModal';
import EventBus from '../utils/EventBus';
import LikeStateManager from '../utils/LikeStateManager';

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function HomeFeedScreen({ navigation, role = 'member' }) {
  // Determine header title based on role
  const getHeaderTitle = () => {
    switch (role) {
      case 'community': return 'SnooSpace';
      case 'sponsor': return 'SnooSpace';
      case 'venue': return 'SnooSpace';
      case 'member':
      default: return 'SnooSpace';
    }
  };
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const { unread } = useNotifications();
  const [greetingName, setGreetingName] = useState(null);
  const [messageUnread, setMessageUnread] = useState(0);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    // Always load feed once on mount
    loadFeed();
    loadGreetingName();
    loadMessageUnreadCount();
    const off = EventBus.on('follow-updated', () => {
      loadFeed();
    });
    const offMessages = EventBus.on('messages-read', () => {
      loadMessageUnreadCount();
    });
    const offPostCreated = EventBus.on('post-created', () => {
      loadFeed();
    });
    return () => { 
      off(); 
      offMessages();
      offPostCreated();
    };
  }, []);

  useEffect(() => {
    const handlePostLikeUpdate = (payload) => {
      if (!payload?.postId) return;
      
      // Cache the like state to persist across screens
      LikeStateManager.setLikeState(payload.postId, payload.isLiked);
      
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
                comment_count:
                  typeof payload.commentCount === 'number'
                    ? payload.commentCount
                    : post.comment_count,
              }
            : post
        )
      );
    };

    const handlePostCommentUpdate = (payload) => {
      if (!payload?.postId) return;
      setPosts((prev) =>
        prev.map((post) =>
          post.id === payload.postId
            ? {
                ...post,
                comment_count:
                  typeof payload.commentCount === 'number'
                    ? payload.commentCount
                    : post.comment_count,
              }
            : post
        )
      );
    };

    const unsubscribeLike = EventBus.on('post-like-updated', handlePostLikeUpdate);
    const unsubscribeComment = EventBus.on('post-comment-updated', handlePostCommentUpdate);

    return () => {
      if (unsubscribeLike) unsubscribeLike();
      if (unsubscribeComment) unsubscribeComment();
    };
  }, []);

  // Refresh message count when screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      loadMessageUnreadCount();
    }, [])
  );

  // Refresh notifications when screen gains focus
  const { loadInitial: loadNotifications } = useNotifications();
  useFocusEffect(
    React.useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const loadMessageUnreadCount = async () => {
    try {
      const response = await getMessageUnreadCount();
      setMessageUnread(response.unreadCount || 0);
    } catch (error) {
      console.error('Error loading message unread count:', error);
    }
  };

  const loadFeed = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const token = await getAuthToken();
      if (!token) throw new Error("Authentication token not found."); // Added check for token
      
      const response = await apiGet('/posts/feed', 15000, token);
      // Parse tagged_entities if they come as JSON strings
      const posts = (response.posts || []).map(post => {
        const mappedPost = {
          ...post,
          // Explicitly preserve author_id and author_type
          author_id: post.author_id,
          author_type: post.author_type,
          tagged_entities: (() => {
            if (!post.tagged_entities) return null;
            if (Array.isArray(post.tagged_entities)) return post.tagged_entities;
            try {
              return JSON.parse(post.tagged_entities);
            } catch {
              return null;
            }
          })()
        };
        // Debug log for community posts
        if (post.author_type === 'community') {
          console.log('[HomeFeedScreen] Community post loaded:', {
            postId: post.id,
            author_id: post.author_id,
            author_type: post.author_type,
            author_name: post.author_name
          });
        }
        return mappedPost;
      });
      
      console.log('[HomeFeedScreen] About to merge like states, posts count:', posts.length);
      // Apply cached like states from LikeStateManager
      const mergedPosts = LikeStateManager.mergeLikeStates(posts);
      console.log('[HomeFeedScreen] After merge, checking post 24:', mergedPosts.find(p => p.id === '24' || p.id === 24));
      setPosts(mergedPosts);
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
      setCurrentUserId(prof.id); // Store current user ID for profile navigation
    } catch (e) {
      setGreetingName('Member');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  };

  const handleLikeUpdate = (postId, isLiked) => {
    setPosts(prevPosts =>
      prevPosts.map(p =>
        p.id === postId
          ? {
              ...p,
              is_liked: isLiked,
              isLiked,
              like_count: Math.max(0, (p.like_count || 0) + (isLiked ? 1 : -1)),
            }
          : p
      )
    );
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

  const renderPost = ({ item }) => {
    // Debug: Log post data for community posts
    if (item?.author_type === 'community') {
      console.log('[HomeFeedScreen] Rendering community post:', {
        postId: item.id,
        author_id: item.author_id,
        author_type: item.author_type,
        author_name: item.author_name,
        currentUserId
      });
    }
    
    return (
      <PostCard 
        post={item}
        onLike={handleLikeUpdate}
        onComment={handleCommentPress}
        onUserPress={(userId, userType) => {
          // Fallback: Use post item's author_type if userType is missing
          const actualUserType = userType || item?.author_type;
          const actualUserId = userId || item?.author_id;
          
          console.log('[HomeFeedScreen] onUserPress called:', { 
            userId, 
            userType, 
            actualUserId,
            actualUserType,
            currentUserId,
            postId: item?.id,
            postAuthorId: item?.author_id,
            postAuthorType: item?.author_type,
            fullItem: item
          });
          
          // Check for community first to ensure it's handled correctly
          if (actualUserType === 'community') {
            console.log('[HomeFeedScreen] Navigating to community profile:', actualUserId);
            // Try direct navigation through HomeStackNavigator first (simpler and more direct)
            try {
              navigation.navigate('CommunityPublicProfile', {
                communityId: actualUserId,
                viewerRole: 'member'
              });
            } catch (error) {
              // Fallback: Navigate through Profile tab if direct navigation fails
              console.log('[HomeFeedScreen] Direct navigation failed, trying Profile tab route');
              const root = navigation.getParent()?.getParent();
              if (root) {
                root.navigate('MemberHome', {
                  screen: 'Profile',
                  params: {
                    screen: 'CommunityPublicProfile',
                    params: { communityId: actualUserId, viewerRole: 'member' }
                  }
                });
              }
            }
            return; // Important: return early to prevent fallthrough
          }
        
        // Only handle member if explicitly member type
        if (actualUserType === 'member') {
          // Check if it's the current user's own profile
          const isOwnProfile = currentUserId && actualUserId === currentUserId;
          console.log('[HomeFeedScreen] Member navigation:', { actualUserId, isOwnProfile, currentUserId });
          const root = navigation.getParent()?.getParent();
          if (root) {
            if (isOwnProfile) {
              root.navigate('MemberHome', {
                screen: 'Profile',
                params: {
                  screen: 'MemberProfile'
                }
              });
            } else {
              root.navigate('MemberHome', {
                screen: 'Profile',
                params: {
                  screen: 'MemberPublicProfile',
                  params: { memberId: actualUserId }
                }
              });
            }
          }
          return;
        }
        
        // If userType is undefined/null, log warning and don't navigate
        // This prevents incorrect navigation when author_type is missing
        if (!actualUserType) {
          console.warn('[HomeFeedScreen] userType is undefined/null for userId:', actualUserId, 'Post data:', item);
          Alert.alert('Navigation Error', 'Unable to determine profile type. Please try again.');
          return;
        }
        
        if (actualUserType === 'sponsor') {
          // Navigate to sponsor profile - for now show alert, can be implemented later
          Alert.alert('Sponsor Profile', 'Sponsor profile navigation will be implemented soon');
        } else if (actualUserType === 'venue') {
          // Navigate to venue profile - for now show alert, can be implemented later
          Alert.alert('Venue Profile', 'Venue profile navigation will be implemented soon');
        }
      }}
    />
  );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>{getHeaderTitle()}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={() => {
            // Navigate to Notifications (same stack - HomeStackNavigator)
            navigation.navigate("Notifications");
          }}>
            <Ionicons name="notifications-outline" size={24} color={TEXT_COLOR} />
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 9 ? '9+' : String(unread)}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => {
              navigation.navigate("ConversationsList");
            }}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={24} color={TEXT_COLOR} />
            {messageUnread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{messageUnread > 9 ? '9+' : String(messageUnread)}</Text>
              </View>
            )}
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
        <Text style={styles.greetingText}>Hi {greetingName || 'User'}!</Text>
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
