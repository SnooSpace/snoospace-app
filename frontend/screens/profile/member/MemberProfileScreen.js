import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Dimensions,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';
import { clearAuthSession, getAuthToken } from '../../../api/auth';
import { apiGet, apiPost, apiDelete } from '../../../api/client';
import { launchImageLibraryAsync, requestMediaLibraryPermissionsAsync, MediaTypeOptions } from 'expo-image-picker';
import { uploadImage } from '../../../api/cloudinary';
import PostCard from '../../../components/PostCard'; // Assuming PostCard exists for a full post view

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function MemberProfileScreen({ navigation }) {
  console.log('[Profile] MemberProfileScreen component function START (mount or render)');
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [postModalVisible, setPostModalVisible] = useState(false);

  useEffect(() => {
    // Always load profile once on mount
    console.log('[Profile] useEffect: initial mount loadProfile call');
    loadProfile();
  }, []);

  useEffect(() => {
    // Also refresh when we actually get focus
    console.log('[Profile] useEffect: subscribing to navigation focus.');
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('[Profile] Screen focused, calling loadProfile');
      loadProfile();
    });
    return () => {
      console.log('[Profile] useEffect cleanup (unsubscribing)');
      unsubscribe();
    };
  }, [navigation]);

  const loadProfile = async () => {
    console.log('[Profile] loadProfile: start');
    try {
      setLoading(true);
      setError(null);
      const token = await getAuthToken();
      console.log(`[Profile] Token: ${token}`);
      if (!token) throw new Error("No auth token found");
      const email = await AsyncStorage.getItem('auth_email');
      if (!email) throw new Error("No user email in AsyncStorage");
      const userProfileResponse = await apiPost('/auth/get-user-profile', { email }, 15000, token);
      console.log('[Profile] userProfileResponse:', userProfileResponse);
      const fullProfile = userProfileResponse?.profile;
      const userRole = userProfileResponse?.role;
      if (!fullProfile || userRole !== 'member') {
        console.log('[Profile] No fullProfile or not member:', fullProfile, userRole);
        throw new Error("Failed to fetch member profile or incorrect role.");
      }
      const userId = fullProfile.id;
      const userType = 'member';
      const [countsResponse, postsResponse] = await Promise.all([
        apiGet(`/follow/counts/${userId}/${userType}`, 15000, token),
        apiGet(`/posts/user/${userId}/${userType}`, 15000, token)
      ]);
      console.log('[Profile] countsResponse:', countsResponse);
      console.log('[Profile] postsResponse:', postsResponse);
      const followerCount = countsResponse?.followers || 0;
      const followingCount = countsResponse?.following || 0;
      const userPosts = Array.isArray(postsResponse?.posts) ? postsResponse.posts : [];
      const mappedProfile = {
        id: userId,
        name: fullProfile.name || '',
        username: fullProfile.username || '',
        bio: fullProfile.bio || '',
        profile_photo_url: fullProfile.profile_photo_url || '',
        interests: Array.isArray(fullProfile.interests) 
          ? fullProfile.interests 
          : (fullProfile.interests ? JSON.parse(fullProfile.interests) : []),
        follower_count: followerCount,
        following_count: followingCount,
      };
      setProfile(mappedProfile);
      setPosts(userPosts.map(post => ({
        ...post,
        isLiked: !!post.is_liked,
      })));
      console.log('[Profile] loadProfile: setProfile & setPosts');
    } catch (err) {
      console.log('[Profile] loadProfile: error caught:', err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
      console.log('[Profile] loadProfile: finally, loading set to false');
    }
  };

  const handleEditProfile = () => {
    Alert.alert('Edit Profile', 'This feature will be implemented soon!');
  };

  const handleChangePhoto = async () => {
    try {
      const permissionResult = await requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Permission to access photos is required.');
        return;
      }
      const picker = await launchImageLibraryAsync({ mediaTypes: MediaTypeOptions.Images, allowsEditing: true, aspect: [1,1], quality: 0.85 });
      if (picker.canceled || !picker.assets || !picker.assets[0]) return;
      const uri = picker.assets[0].uri;
      const secureUrl = await uploadImage(uri);
      const token = await getAuthToken();
      await apiPost('/members/profile/photo', { profile_photo_url: secureUrl }, 15000, token);
      setProfile(prev => ({ ...prev, profile_photo_url: secureUrl }));
      Alert.alert('Updated', 'Profile photo updated');
    } catch (e) {
      Alert.alert('Update failed', e?.message || 'Could not update photo');
    }
  };

  const handleFollow = async () => {
    try {
      // Toggle follow status
      Alert.alert('Follow', 'Follow functionality will be implemented soon!');
    } catch (error) {
      console.error('Error following:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              // Close settings modal first
              setShowSettingsModal(false);
              
              // Clear all authentication data
              await clearAuthSession();
              await AsyncStorage.multiRemove(['accessToken', 'userData', 'auth_token', 'auth_email', 'pending_otp']);
              
              // Get the root navigator by going up the navigation hierarchy
              let rootNavigator = navigation;
              
              // Try to get parent navigator (go up from MemberProfileScreen to MemberBottomTabNavigator)
              if (navigation.getParent) {
                const parent = navigation.getParent();
                if (parent) {
                  // Go up one more level (from MemberBottomTabNavigator to AppNavigator)
                  rootNavigator = parent.getParent ? parent.getParent() : parent;
                }
              }
              
              // Reset navigation stack to Landing using root navigator
              rootNavigator.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Landing' }],
                })
              );
            } catch (error) {
              console.error('Error during logout:', error);
              Alert.alert('Error', 'Failed to logout properly');
            }
          },
        },
      ]
    );
  };

  const openPostModal = (post) => {
    setSelectedPost(post);
    setPostModalVisible(true);
  };
  const closePostModal = () => {
    setPostModalVisible(false);
    setSelectedPost(null);
  };

  // Add utility for updating posts global state (so modal & grid stay in sync)
  function updatePostsGlobalState(postId, isLiked, likes) {
    setPosts(prevPosts =>
      prevPosts.map(p =>
        p.id === postId ? { ...p, isLiked, like_count: likes } : p
      )
    );
  }

  const renderPostGrid = () => {
    const postGrid = [];
    // Display actual posts or placeholders up to 6
    for (let i = 0; i < Math.max(posts.length, 0); i++) {
      const post = posts[i];
      postGrid.push(
        <TouchableOpacity key={i} style={styles.postGridItem} onPress={() => post && openPostModal(post)}>
          {post ? (
            (() => {
              const firstImageUrl = Array.isArray(post.image_urls)
                ? post.image_urls.flat().find(u => typeof u === 'string' && u.startsWith('http'))
                : undefined;
              return (
                <Image
                  source={{ uri: firstImageUrl || 'https://via.placeholder.com/150' }}
                  style={styles.postImage}
                />
              );
            })()
          ) : (
            <View style={styles.placeholderPost}>
              <Ionicons name="image-outline" size={30} color={LIGHT_TEXT_COLOR} />
            </View>
          )}
        </TouchableOpacity>
      );
    }
    // If no posts, show placeholders
    if (posts.length === 0) {
      for (let i = 0; i < 6; i++) {
        postGrid.push(
          <View key={`placeholder-${i}`} style={styles.postGridItem}>
            <View style={styles.placeholderPost}>
              <Ionicons name="image-outline" size={30} color={LIGHT_TEXT_COLOR} />
            </View>
          </View>
        );
      }
    }
    return postGrid;
  };

  // --- Full Post Modal Component ---
  const PostModal = ({ visible, post, onClose }) => {
    const [likes, setLikes] = useState(post?.like_count || 0);
    const [isLiked, setIsLiked] = useState(post?.isLiked || false);
    const [comments, setComments] = useState([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentInput, setCommentInput] = useState('');
    const [commentPosting, setCommentPosting] = useState(false);
    const [error, setError] = useState(null);
    const [commentCount, setCommentCount] = useState(post?.comment_count || 0);

    // When modal is (re)opened, always sync like state from post prop
    useEffect(() => {
      setLikes(post?.like_count || 0);
      setIsLiked(!!post?.isLiked); // always sync from prop
    }, [post?.id, visible]);

    // Fetch comments on modal open and post change
    useEffect(() => {
      if (!visible || !post?.id) return;
      setCommentsLoading(true);
      setError(null);
      getAuthToken().then(token => {
        return apiGet(`/posts/${post.id}/comments`, 10000, token);
      }).then(data => {
        setComments(Array.isArray(data?.comments) ? data.comments : []);
        setCommentCount(data?.comments?.length ?? 0);
      }).catch(e => setError(e.message)).finally(() => setCommentsLoading(false));
    }, [visible, post?.id]);

    // Like/unlike logic
    const handleLikeToggle = async () => {
      try {
        const token = await getAuthToken();
        if (isLiked) {
          await apiDelete(`/posts/${post.id}/like`, null, 15000, token);
          setLikes(likes - 1); setIsLiked(false);
          updatePostsGlobalState(post.id, false, likes - 1);
        } else {
          await apiPost(`/posts/${post.id}/like`, {}, 15000, token);
          setLikes(likes + 1); setIsLiked(true);
          updatePostsGlobalState(post.id, true, likes + 1);
        }
      } catch (e) {
        Alert.alert('Error', e.message || 'Error updating like');
      }
    };

    // Post new comment
    const handleCommentPost = async () => {
      if (!commentInput.trim()) return;
      setCommentPosting(true);
      try {
        const token = await getAuthToken();
        const result = await apiPost(`/posts/${post.id}/comments`, { commentText: commentInput.trim() }, 15000, token);
        setCommentInput('');
        if (result?.comment) {
          setComments(prev => [...prev, result.comment]);
          setCommentCount(c => c + 1);
        }
      } catch (e) {
        Alert.alert('Error', e.message || 'Failed to post comment');
      } finally {
        setCommentPosting(false);
      }
    };

    if (!post) return null;
    const images = Array.isArray(post.image_urls)
      ? post.image_urls.flat().filter(u => typeof u === 'string' && u.startsWith('http'))
      : [];
    return (
      <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
        <View style={[styles.modalOverlayFull, { backgroundColor: 'rgba(255,255,255,0.94)' }]}> {/* white background */}
          <KeyboardAvoidingView
            style={styles.postModalKeyboardContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={[styles.postModalContainer, { backgroundColor: '#fff' }]}> {/* white background */}
              <TouchableOpacity style={styles.closeModalButton} onPress={onClose}>
                <Ionicons name="close" size={30} color="#000" />
              </TouchableOpacity>
              {/* Images Carousel */}
              <FlatList
                data={images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(_, idx) => idx.toString()}
                renderItem={({ item }) => (
                  <View style={styles.postModalImageFrame}>
                    <Image
                      source={{ uri: item }}
                      style={styles.postModalImage}
                      resizeMode="contain"
                    />
                  </View>
                )}
                style={styles.modalImageCarousel}
              />
              {/* Post Info */}
              <View style={styles.postModalInfoArea}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Image
                    source={{ uri: post.author_photo_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(post.author_name || 'User') }}
                    style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10 }}
                  />
                  <View>
                    <Text style={{ fontWeight: 'bold', color: '#222', fontSize: 16 }}>{post.author_name}</Text>
                    <Text style={{ color: '#888', fontSize: 13 }}>@{post.author_username}</Text>
                  </View>
                </View>
                {post.caption && (
                  <Text style={{ color: '#111', marginBottom: 6, fontSize: 15 }}>{post.caption}</Text>
                )}
              </View>
              {/* Like & Comment Section */}
              <View style={styles.postModalActionsRow}>
                <TouchableOpacity onPress={handleLikeToggle} style={styles.modalActionButton}>
                  <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={26} color={isLiked ? '#FF3B30' : '#222'} />
                  <Text style={{ color: '#222', marginLeft: 4 }}>{likes}</Text>
                </TouchableOpacity>
                <Ionicons name="chatbubble-outline" size={24} color="#222" style={{ marginLeft: 16, marginRight: 2 }} />
                <Text style={{ color: '#222' }}>{commentCount}</Text>
              </View>
              {/* Comments List + Input below */}
              <View style={[styles.commentsContainer, { backgroundColor: '#f8f8f8' }]}> {/* light background for comments */}
                {commentsLoading ? (
                  <ActivityIndicator size="small" color="#444" />
                ) : error ? (
                  <Text style={{ color: 'red' }}>{error}</Text>
                ) : comments.length === 0 ? (
                  <Text style={{ color: '#aaa' }}>No comments yet</Text>
                ) : (
                  <FlatList
                    data={comments}
                    keyExtractor={item => item.id?.toString()}
                    renderItem={({ item }) => (
                      <View style={styles.commentRow}>
                        <Image
                          source={{ uri: item.commenter_photo_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(item.commenter_name || 'User') }}
                          style={styles.commentAvatar}
                        />
                        <View>
                          <Text style={styles.commentName}>{item.commenter_name}</Text>
                          <Text style={styles.commentText}>{item.comment_text}</Text>
                        </View>
                      </View>
                    )}
                    style={styles.commentList}
                  />
                )}
                {/* Comment input always at the bottom */}
                <View style={styles.commentInputRow}>
                  <TextInput
                    value={commentInput}
                    onChangeText={setCommentInput}
                    placeholder="Add a comment..."
                    placeholderTextColor="#888"
                    style={[styles.commentInput, { color: '#000', backgroundColor: '#fff' }]}
                    editable={!commentPosting}
                  />
                  <TouchableOpacity onPress={handleCommentPost} disabled={commentPosting || !commentInput.trim()} style={styles.sendCommentButton}>
                    <Ionicons name="send" size={22} color={commentPosting || !commentInput.trim() ? '#bbb' : '#6A0DAD'} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  };

  if (loading) {
    console.log('[Profile] rendering: loading spinner');
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    console.log('[Profile] rendering: error banner', error);
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          {error === "No auth token found" ? (
            <TouchableOpacity
              onPress={async () => {
                await clearAuthSession();
                await AsyncStorage.multiRemove(['accessToken', 'userData', 'auth_token', 'auth_email', 'pending_otp']);
                navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
              }}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Login</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={loadProfile} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    console.log('[Profile] rendering: no profile');
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load profile</Text>
        </View>
      </SafeAreaView>
    );
  }

  console.log('[Profile] rendering: main profile UI');
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.username}>@{profile.username}</Text>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => setShowSettingsModal(true)}
        >
          <Ionicons name="settings-outline" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            <Image 
              source={{ 
                uri: profile.profile_photo_url && /^https?:\/\//.test(profile.profile_photo_url)
                  ? profile.profile_photo_url
                  : `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'Member')}&background=6A0DAD&color=FFFFFF&size=120&bold=true`
              }} 
              style={styles.profileImage}
            />
          </View>
          
          <Text style={styles.profileName}>{profile.name}</Text>
          <Text style={styles.profileTagline}>Event Enthusiast</Text>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{posts.length}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profile.follower_count}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profile.following_count}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>

          {/* Bio */}
          {profile.bio ? (
            <View style={styles.bioContainer}>
              <Text style={styles.bioText}>
                {profile.bio}
              </Text>
            </View>
          ) : null}

          {/* Action Button */}
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleChangePhoto}
          >
            <Text style={styles.actionButtonText}>Change Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, { marginTop: 10 }]}
            onPress={isOwnProfile ? handleEditProfile : handleFollow}
          >
            <Text style={styles.actionButtonText}>
              {isOwnProfile ? 'Edit Profile' : 'Follow'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Posts Grid */}
        <View style={styles.postsSection}>
          <View style={styles.postsGrid}>
            {renderPostGrid()}
          </View>
        </View>
      </ScrollView>
      {/* --- Full Post Modal Viewer --- */}
      <PostModal visible={postModalVisible} post={selectedPost} onClose={closePostModal} />
      {/* Settings Modal */}
      <Modal
        visible={showSettingsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowSettingsModal(false)}
              >
                <Ionicons name="close" size={24} color={TEXT_COLOR} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TouchableOpacity 
                style={styles.settingsOption}
                onPress={() => {
                  setShowSettingsModal(false);
                  handleEditProfile();
                }}
              >
                <Ionicons name="person-outline" size={24} color={TEXT_COLOR} />
                <Text style={styles.settingsOptionText}>Edit Profile</Text>
                <Ionicons name="chevron-forward" size={20} color={LIGHT_TEXT_COLOR} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.settingsOption}
                onPress={() => {
                  setShowSettingsModal(false);
                  Alert.alert('Notifications', 'Notification settings will be implemented soon!');
                }}
              >
                <Ionicons name="notifications-outline" size={24} color={TEXT_COLOR} />
                <Text style={styles.settingsOptionText}>Notifications</Text>
                <Ionicons name="chevron-forward" size={20} color={LIGHT_TEXT_COLOR} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.settingsOption}
                onPress={() => {
                  setShowSettingsModal(false);
                  Alert.alert('Privacy', 'Privacy settings will be implemented soon!');
                }}
              >
                <Ionicons name="shield-outline" size={24} color={TEXT_COLOR} />
                <Text style={styles.settingsOptionText}>Privacy</Text>
                <Ionicons name="chevron-forward" size={20} color={LIGHT_TEXT_COLOR} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.settingsOption}
                onPress={() => {
                  setShowSettingsModal(false);
                  Alert.alert('Help', 'Help & Support will be implemented soon!');
                }}
              >
                <Ionicons name="help-circle-outline" size={24} color={TEXT_COLOR} />
                <Text style={styles.settingsOptionText}>Help & Support</Text>
                <Ionicons name="chevron-forward" size={20} color={LIGHT_TEXT_COLOR} />
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity 
                style={[styles.settingsOption, styles.logoutOption]}
                onPress={handleLogout}
              >
                <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
                <Text style={[styles.settingsOptionText, styles.logoutText]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  username: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  settingsButton: {
    padding: 5,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  profileImageContainer: {
    marginBottom: 20,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 5,
  },
  profileTagline: {
    fontSize: 16,
    color: PRIMARY_COLOR,
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: '500',
  },
  bioContainer: {
    width: '100%',
    marginBottom: 20,
  },
  bioText: {
    fontSize: 16,
    color: TEXT_COLOR,
    textAlign: 'center',
    lineHeight: 22,
  },
  actionButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 30,
    paddingVertical: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  postsSection: {
    paddingHorizontal: 20,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  postGridItem: {
    width: (screenWidth - 60) / 3,
    height: (screenWidth - 60) / 3,
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  placeholderPost: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: LIGHT_TEXT_COLOR,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  closeButton: {
    padding: 5,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    gap: 15,
  },
  settingsOptionText: {
    flex: 1,
    fontSize: 16,
    color: TEXT_COLOR,
  },
  logoutOption: {
    marginTop: 10,
  },
  logoutText: {
    color: '#FF3B30',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 10,
  },
  // Full Post Modal Styles
  modalOverlayFull: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postModalKeyboardContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  postModalContainer: {
    width: screenWidth,
    height: screenHeight * 0.9,
    backgroundColor: '#000',
    borderRadius: 20,
    overflow: 'hidden',
    alignSelf: 'center',
    marginTop: screenHeight * 0.05,
    marginBottom: screenHeight * 0.03,
  },
  postModalInfoArea: {
    width: '100%',
    paddingHorizontal: 27,
    paddingTop: 8,
    paddingBottom: 3,
    backgroundColor: 'transparent',
  },
  modalImageCarousel: {
    flex: 1,
  },
  postModalImageFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingTop: 22,
    paddingBottom: 10,
    width: screenWidth,
    minHeight: screenHeight * 0.36,
    maxHeight: screenHeight * 0.46,
  },
  postModalImage: {
    maxWidth: screenWidth * 0.85,
    maxHeight: screenHeight * 0.38,
    width: undefined,
    height: undefined,
    aspectRatio: 1,
  },
  postModalInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    zIndex: 5,
  },
  postModalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingTop: 16,
    paddingBottom: 8,
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  commentsContainer: {
    flexGrow: 1,
    minHeight: 170,
    maxHeight: 220,
    backgroundColor: 'rgba(30,30,30,0.92)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderTopColor: '#222',
    borderTopWidth: 1,
    justifyContent: 'flex-end',
  },
  commentList: {
    maxHeight: 120,
    marginBottom: 9,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#242424',
    color: '#fff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    marginRight: 9,
  },
  sendCommentButton: {
    padding: 7,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  commentAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 7,
  },
  commentName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  commentText: {
    color: '#ccc',
    fontSize: 13,
    marginTop: 1,
  },
});
