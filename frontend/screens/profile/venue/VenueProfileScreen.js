import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';
import { clearAuthSession, getAuthToken } from '../../../api/auth';
import { deleteAccount as apiDeleteAccount } from '../../../api/account';
import { apiGet, apiPost } from '../../../api/client';
import PostCard from '../../../components/PostCard';
import { mockData } from '../../../data/mockData';
import { launchImageLibraryAsync, requestMediaLibraryPermissionsAsync, MediaTypeOptions } from 'expo-image-picker';
import { uploadImage } from '../../../api/cloudinary';

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function VenueProfileScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const email = await AsyncStorage.getItem('auth_email');
      let role = 'venue';
      let fullProfile = null;
      try {
        const profRes = await apiPost('/auth/get-user-profile', email ? { email } : {}, 15000, token);
        role = profRes?.role || 'venue';
        fullProfile = profRes?.profile || null;
      } catch (_) {}

      if (!fullProfile || role !== 'venue') {
        const venueProfile = mockData.venues[0];
        const venuePosts = mockData.posts.filter(post => post.author_type === 'venue' && post.author_id === venueProfile.id);
        setProfile(venueProfile);
        setPosts(venuePosts);
        return;
      }

      const userId = fullProfile.id;
      const userType = 'venue';

      let followerCount = 0;
      let followingCount = 0;
      try {
        const counts = await apiGet(`/follow/counts/${userId}/${userType}`, 15000, token);
        followerCount = counts?.followers || 0;
        followingCount = counts?.following || 0;
      } catch (_) {}

      let userPosts = [];
      try {
        const postsRes = await apiGet(`/posts/user/${userId}/${userType}`, 15000, token);
        userPosts = Array.isArray(postsRes?.posts) ? postsRes.posts : [];
      } catch (_) {}

      const mapped = {
        id: userId,
        name: fullProfile.name || '',
        username: fullProfile.username || '',
        city: fullProfile.city || '',
        address: fullProfile.address || '',
        capacity_min: fullProfile.capacity_min || 0,
        capacity_max: fullProfile.capacity_max || 0,
        price_per_head: fullProfile.price_per_head || 0,
        hourly_price: fullProfile.hourly_price || 0,
        daily_price: fullProfile.daily_price || 0,
        conditions: fullProfile.conditions || '',
        contact_name: fullProfile.contact_name || '',
        contact_email: fullProfile.contact_email || '',
        contact_phone: fullProfile.contact_phone || '',
        follower_count: followerCount,
        following_count: followingCount,
        post_count: userPosts.length,
      };

      setProfile(mapped);
      setPosts(userPosts);
    } finally {
      setLoading(false);
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
              
              // Try to get parent navigator (go up from VenueProfileScreen -> VenueBottomTabNavigator)
              if (navigation.getParent) {
                const parent = navigation.getParent();
                if (parent) {
                  // Go up one more level (from VenueBottomTabNavigator to AppNavigator)
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

  const renderPost = ({ item }) => (
    <PostCard
      post={item}
      onLike={() => {}}
      onComment={() => {}}
      onFollow={() => {}}
    />
  );

  const renderSettingsModal = () => (
    <Modal
      visible={showSettingsModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowSettingsModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Settings</Text>
            <TouchableOpacity
              onPress={() => setShowSettingsModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={TEXT_COLOR} />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.settingsItem} onPress={async () => {
            try {
              const perm = await requestMediaLibraryPermissionsAsync();
              if (!perm.granted) { Alert.alert('Permission Required', 'Allow photo access to change logo'); return; }
              const picker = await launchImageLibraryAsync({ mediaTypes: MediaTypeOptions.Images, allowsEditing: true, aspect: [1,1], quality: 0.85 });
              if (picker.canceled || !picker.assets || !picker.assets[0]) return;
              const uri = picker.assets[0].uri;
              const secureUrl = await uploadImage(uri);
              const token = await getAuthToken();
              await apiPost('/venues/profile/logo', { logo_url: secureUrl }, 15000, token);
              setProfile(prev => ({ ...prev, logo_url: secureUrl }));
              Alert.alert('Updated', 'Logo updated');
            } catch (e) {
              Alert.alert('Update failed', e?.message || 'Could not update logo');
            }
          }}>
            <Ionicons name="image-outline" size={24} color={TEXT_COLOR} />
            <Text style={styles.settingsText}>Change Logo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingsItem} onPress={() => setShowDeleteModal(true)}>
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
            <Text style={[styles.settingsText, { color: '#FF3B30' }]}>Delete Account</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingsItem} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
            <Text style={[styles.settingsText, { color: '#FF3B30' }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (loading || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Profile</Text>
            <TouchableOpacity
              onPress={() => setShowSettingsModal(true)}
              style={styles.settingsButton}
            >
              <Ionicons name="settings-outline" size={24} color={TEXT_COLOR} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.profileHeader}>
            <View style={styles.venueImageContainer}>
              <Ionicons name="business" size={40} color={PRIMARY_COLOR} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.venueName}>{profile.name}</Text>
              <Text style={styles.username}>@{profile.username}</Text>
              <View style={styles.locationContainer}>
                <Ionicons name="location-outline" size={16} color={LIGHT_TEXT_COLOR} />
                <Text style={styles.location}>{profile.city}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.address}>{profile.address}</Text>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profile.follower_count}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profile.following_count}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profile.post_count}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
          </View>

          {/* Capacity & Pricing */}
          <View style={styles.capacityContainer}>
            <Text style={styles.sectionTitle}>Venue Details</Text>
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Ionicons name="people" size={20} color={PRIMARY_COLOR} />
                <Text style={styles.detailLabel}>Capacity</Text>
                <Text style={styles.detailValue}>
                  {profile.capacity_min} - {profile.capacity_max} people
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="cash" size={20} color={PRIMARY_COLOR} />
                <Text style={styles.detailLabel}>Per Head</Text>
                <Text style={styles.detailValue}>₹{profile.price_per_head}</Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="time" size={20} color={PRIMARY_COLOR} />
                <Text style={styles.detailLabel}>Hourly</Text>
                <Text style={styles.detailValue}>₹{profile.hourly_price}</Text>
              </View>
              <View style={styles.detailItem}>
                <Ionicons name="calendar" size={20} color={PRIMARY_COLOR} />
                <Text style={styles.detailLabel}>Daily</Text>
                <Text style={styles.detailValue}>₹{profile.daily_price}</Text>
              </View>
            </View>
          </View>

          {/* Conditions */}
          {profile.conditions && (
            <View style={styles.conditionsContainer}>
              <Text style={styles.sectionTitle}>Terms & Conditions</Text>
              <Text style={styles.conditionsText}>{profile.conditions}</Text>
            </View>
          )}

          {/* Contact Info */}
          <View style={styles.contactContainer}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <View style={styles.contactItem}>
              <Ionicons name="person" size={16} color={LIGHT_TEXT_COLOR} />
              <Text style={styles.contactText}>{profile.contact_name}</Text>
            </View>
            <View style={styles.contactItem}>
              <Ionicons name="mail" size={16} color={LIGHT_TEXT_COLOR} />
              <Text style={styles.contactText}>{profile.contact_email}</Text>
            </View>
            <View style={styles.contactItem}>
              <Ionicons name="call" size={16} color={LIGHT_TEXT_COLOR} />
              <Text style={styles.contactText}>{profile.contact_phone}</Text>
            </View>
          </View>
        </View>

        {/* Posts */}
        <View style={styles.postsSection}>
          <Text style={styles.sectionTitle}>Venue Posts</Text>
          <FlatList
            data={posts}
            renderItem={renderPost}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: LIGHT_TEXT_COLOR }}>No posts</Text>
              </View>
            }
          />
        </View>
      </ScrollView>

      {renderSettingsModal()}

      {/* Delete Account Confirm Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delete Account</Text>
              <TouchableOpacity onPress={() => setShowDeleteModal(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={TEXT_COLOR} />
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
              <Text style={{ color: LIGHT_TEXT_COLOR, marginBottom: 12 }}>This is permanent and cannot be undone. Type "delete" to confirm.</Text>
              <TextInput
                value={deleteInput}
                onChangeText={setDeleteInput}
                placeholder="Type delete"
                autoCapitalize="none"
                style={{ borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 }}
              />
              <TouchableOpacity
                disabled={deleting || (deleteInput.trim().toLowerCase() !== 'delete')}
                onPress={async () => {
                  if (deleteInput.trim().toLowerCase() !== 'delete') return;
                  setDeleting(true);
                  try {
                    const { switchedToAccount, navigateToLanding } = await apiDeleteAccount();
                    setShowDeleteModal(false);
                    
                    if (navigateToLanding || !switchedToAccount) {
                      navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
                    } else {
                      const routeMap = {
                        member: 'MemberHome',
                        community: 'CommunityHome',
                        sponsor: 'SponsorHome',
                        venue: 'VenueHome',
                      };
                      const routeName = routeMap[switchedToAccount.type] || 'Landing';
                      navigation.reset({ index: 0, routes: [{ name: routeName }] });
                    }
                  } catch (e) {
                    Alert.alert('Delete failed', e?.message || 'Could not delete account');
                  } finally {
                    setDeleting(false);
                  }
                }}
                style={{ backgroundColor: (deleteInput.trim().toLowerCase() === 'delete' ? '#FF3B30' : '#FFAAA3'), paddingVertical: 12, borderRadius: 10, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>{deleting ? 'Deleting...' : 'Delete Account'}</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  settingsButton: {
    padding: 5,
  },
  profileSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  venueImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F8F5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  venueName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 5,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  location: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginLeft: 5,
  },
  address: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 20,
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E5EA',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  statLabel: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  capacityContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 15,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailItem: {
    width: '48%',
    backgroundColor: '#F8F5FF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  conditionsContainer: {
    marginBottom: 20,
  },
  conditionsText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    lineHeight: 20,
  },
  contactContainer: {
    marginBottom: 20,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginLeft: 10,
  },
  postsSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  settingsText: {
    fontSize: 16,
    marginLeft: 15,
  },
});
