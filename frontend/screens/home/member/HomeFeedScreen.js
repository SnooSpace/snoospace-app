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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiGet } from '../../../api/client';
import { getAuthToken } from '../../../api/auth';

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function HomeFeedScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    try {
      setLoading(true);
      setErrorMsg("");
      const token = await getAuthToken();
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  };

  const handleLike = async (postId) => {
    try {
      // Optimistic update
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { ...post, like_count: post.like_count + 1, isLiked: true }
            : post
        )
      );
      
      // API call
      const token = await getAuthToken();
      await apiGet(`/posts/${postId}/like`, 15000, token);
    } catch (error) {
      console.error('Error liking post:', error);
      // Revert optimistic update
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { ...post, like_count: post.like_count - 1, isLiked: false }
            : post
        )
      );
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

  const renderPost = (post) => (
    <View key={post.id} style={styles.postContainer}>
      {/* Post Header */}
      <View style={styles.postHeader}>
        <View style={styles.authorInfo}>
          <Image 
            source={{ uri: post.author_photo_url || 'https://via.placeholder.com/40' }} 
            style={styles.authorAvatar}
          />
          <View style={styles.authorDetails}>
            <Text style={styles.authorName}>{post.author_name}</Text>
            <Text style={styles.authorUsername}>@{post.author_username}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-horizontal" size={20} color={LIGHT_TEXT_COLOR} />
        </TouchableOpacity>
      </View>

      {/* Post Content */}
      <View style={styles.postContent}>
        {post.image_urls && post.image_urls.length > 0 && (
          <Image 
            source={{ uri: post.image_urls[0] }} 
            style={styles.postImage}
            resizeMode="cover"
          />
        )}
        
        {post.caption && (
          <Text style={styles.postCaption}>{post.caption}</Text>
        )}
      </View>

      {/* Post Actions */}
      <View style={styles.postActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleLike(post.id)}
        >
          <Ionicons 
            name={post.isLiked ? "heart" : "heart-outline"} 
            size={24} 
            color={post.isLiked ? "#FF3B30" : TEXT_COLOR} 
          />
          <Text style={styles.actionText}>{formatCount(post.like_count)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={24} color={TEXT_COLOR} />
          <Text style={styles.actionText}>{formatCount(post.comment_count)}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="paper-plane-outline" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.bookmarkButton]}>
          <Ionicons name="bookmark-outline" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
      </View>

      {/* Comments Preview */}
      {post.comment_count > 0 && (
        <TouchableOpacity style={styles.commentsPreview}>
          <Text style={styles.commentsText}>
            View all {post.comment_count} comments
          </Text>
        </TouchableOpacity>
      )}

      <Text style={styles.postTime}>{formatTimeAgo(post.created_at)}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appTitle}>SnooSpace</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="notifications-outline" size={24} color={TEXT_COLOR} />
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
        <Text style={styles.greetingText}>Hi Member!</Text>
        <Text style={styles.greetingSubtext}>Discover what's happening</Text>
      </View>

      {/* Feed */}
      <ScrollView
        style={styles.feed}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading posts...</Text>
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubtext}>Follow some users to see their posts here</Text>
            {errorMsg ? (
              <TouchableOpacity onPress={loadFeed} style={styles.retryButton}> 
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          posts.map(renderPost)
        )}
      </ScrollView>
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
