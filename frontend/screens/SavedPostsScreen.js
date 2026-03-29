import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Image as LucideImage,
  Play,
  Bookmark,
  ArrowLeft,
} from "lucide-react-native";
import { getSavedPosts } from "../api/client";
import { getAuthToken } from "../api/auth";
import ProfilePostFeed from "../components/ProfilePostFeed";
import SnooLoader from "../components/ui/SnooLoader";

const COLORS = {
  background: "#FFFFFF",
  text: "#000000",
  textSecondary: "#8E8E93",
  border: "#E5E5EA",
};

const SavedPostsScreen = ({ navigation }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  // Post modal state
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);

  useEffect(() => {
    loadSavedPosts();
  }, []);

  const loadSavedPosts = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setOffset(0);
      } else {
        setLoading(true);
      }

      const currentOffset = isRefresh ? 0 : offset;
      const token = await getAuthToken();
      const response = await getSavedPosts(currentOffset, 20, token);

      if (isRefresh) {
        setPosts(response.posts || []);
      } else {
        setPosts((prev) => [...prev, ...(response.posts || [])]);
      }

      setHasMore(response.hasMore || false);
      setOffset(currentOffset + (response.posts?.length || 0));
    } catch (error) {
      console.error("Failed to load saved posts:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadSavedPosts(true);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadSavedPosts();
    }
  };

  const openPostModal = (post) => {
    setSelectedPost(post);
    setPostModalVisible(true);
  };

  const closePostModal = () => {
    setPostModalVisible(false);
    setSelectedPost(null);
  };

  const handleUnsave = (postId) => {
    // Remove from list when unsaved
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const renderPost = ({ item }) => {
    // Get first image from post
    const getFirstImage = () => {
      if (!item.image_urls) return null;
      const urls = Array.isArray(item.image_urls) ? item.image_urls.flat() : [];
      const imageUrl = urls.find((url) => {
        if (typeof url === "string") return url.startsWith("http");
        if (url?.url) return url.url.startsWith("http");
        return false;
      });
      return typeof imageUrl === "string" ? imageUrl : imageUrl?.url;
    };

    const imageUrl = getFirstImage();
    const isVideo = item.image_urls?.some(
    (url) =>
        (typeof url === "string" ? url : url?.url)?.includes(".mp4") ||
        (typeof url === "object" && url?.type === "video"),
    );

    return (
      <TouchableOpacity
        style={styles.postItem}
        onPress={() => openPostModal(item)}
        activeOpacity={0.9}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.postImage} />
        ) : (
          <View style={[styles.postImage, styles.placeholderImage]}>
            <LucideImage size={40} color={COLORS.textSecondary} />
          </View>
        )}
        {isVideo && (
          <View style={styles.videoIndicator}>
            <Play size={24} color="#FFF" fill="#FFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Bookmark size={80} color={COLORS.textSecondary} strokeWidth={1.5} />
        <Text style={styles.emptyTitle}>No saved posts yet</Text>
        <Text style={styles.emptySubtitle}>
          Posts you save will appear here
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loading || posts.length === 0) return null;
    return (
      <View style={styles.footerLoader}>
        <SnooLoader size="small" color={COLORS.text} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={COLORS.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Posts</Text>
        <View style={styles.backButton} />
      </View>

      {/* Posts Grid */}
      {loading && posts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <SnooLoader size="large" color={COLORS.text} />
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id.toString()}
          numColumns={3}
          contentContainerStyle={styles.gridContainer}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.text}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
        />
      )}

      {/* Post Modal */}
      {selectedPost && (
        <ProfilePostFeed
          visible={postModalVisible}
          posts={posts}
          initialPostId={selectedPost.id}
          onClose={closePostModal}
          currentUserId={selectedPost.author_id}
          currentUserType={selectedPost.author_type}
          onSave={handleUnsave}
          navigation={navigation}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "BasicCommercial-Black",
    color: COLORS.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  gridContainer: {
    paddingHorizontal: 1,
    paddingTop: 1,
  },
  postItem: {
    width: "33.33%",
    aspectRatio: 1, // Grid usually looks better square or 4/5
    padding: 1,
  },
  postImage: {
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.border,
  },
  placeholderImage: {
    justifyContent: "center",
    alignItems: "center",
  },
  videoIndicator: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 150,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "BasicCommercial-Bold",
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
});

export default SavedPostsScreen;
