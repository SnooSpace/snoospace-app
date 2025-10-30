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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';
import { clearAuthSession, getAuthToken } from '../../../api/auth';
import { apiGet, apiPost } from '../../../api/client';
import { launchImageLibraryAsync, requestMediaLibraryPermissionsAsync, MediaTypeOptions } from 'expo-image-picker';
import { uploadImage } from '../../../api/cloudinary';
import PostCard from '../../../components/PostCard'; // Assuming PostCard exists for a full post view

const { width: screenWidth } = Dimensions.get('window');
const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function MemberProfileScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    // Add a listener for when the screen is focused
    const unsubscribe = navigation.addListener('focus', () => {
      loadProfile();
    });

    // Return the function to unsubscribe from the event so it gets removed on unmount
    return unsubscribe;
  }, [navigation]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = await getAuthToken();
      if (!token) throw new Error("No auth token found");

      const userProfileResponse = await apiPost('/auth/get-user-profile', {}, 15000, token);
      const fullProfile = userProfileResponse?.profile;
      const userRole = userProfileResponse?.role;

      if (!fullProfile || userRole !== 'member') {
        throw new Error("Failed to fetch member profile or incorrect role.");
      }

      const userId = fullProfile.id;
      const userType = 'member';

      // Fetch counts and posts in parallel for performance
      const [countsResponse, postsResponse] = await Promise.all([
        apiGet(`/follow/counts/${userId}/${userType}`, 15000, token),
        apiGet(`/posts/user/${userId}/${userType}`, 15000, token)
      ]);

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
      setPosts(userPosts);
    } catch (err) {
      console.error("Failed to load profile:", err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
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

  const renderPostGrid = () => {
    const postGrid = [];
    // Display actual posts or placeholders up to 6
    for (let i = 0; i < Math.max(posts.length, 0); i++) {
      const post = posts[i];
      postGrid.push(
        <TouchableOpacity key={i} style={styles.postGridItem}>
          {post ? (
            <Image 
              source={{ uri: post.image_urls?.[0] || 'https://via.placeholder.com/150' }} 
              style={styles.postImage}
            />
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadProfile} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load profile</Text>
        </View>
      </SafeAreaView>
    );
  }

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
});
