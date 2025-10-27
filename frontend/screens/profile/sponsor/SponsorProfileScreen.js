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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';
import { clearAuthSession } from '../../../api/auth';
import PostCard from '../../../components/PostCard';
import { mockData } from '../../../data/mockData';

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function SponsorProfileScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      // In real app, this would be API call
      const sponsorProfile = mockData.sponsors[0]; // First sponsor as current user
      const sponsorPosts = mockData.posts.filter(post => 
        post.author_type === 'sponsor' && post.author_id === sponsorProfile.id
      );
      
      setProfile(sponsorProfile);
      setPosts(sponsorPosts);
    } catch (error) {
      console.error('Error loading profile:', error);
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
              
              // Try to get parent navigator (go up from SponsorProfileScreen -> SponsorBottomTabNavigator)
              if (navigation.getParent) {
                const parent = navigation.getParent();
                if (parent) {
                  // Go up one more level (from SponsorBottomTabNavigator to AppNavigator)
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
            <Image source={{ uri: profile.logo_url }} style={styles.logo} />
            <View style={styles.profileInfo}>
              <Text style={styles.brandName}>{profile.brand_name}</Text>
              <Text style={styles.username}>@{profile.username}</Text>
              <Text style={styles.category}>{profile.category}</Text>
              <View style={styles.locationContainer}>
                <Ionicons name="location-outline" size={16} color={LIGHT_TEXT_COLOR} />
                <Text style={styles.cities}>{profile.cities.join(', ')}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.bio}>{profile.bio}</Text>

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

          {/* Requirements */}
          <View style={styles.requirementsContainer}>
            <Text style={styles.sectionTitle}>Sponsorship Requirements</Text>
            <Text style={styles.requirementsText}>{profile.requirements}</Text>
          </View>

          {/* Interests */}
          <View style={styles.interestsContainer}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.interestsList}>
              {profile.interests.map((interest, index) => (
                <View key={index} style={styles.interestTag}>
                  <Text style={styles.interestText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Cities */}
          <View style={styles.citiesContainer}>
            <Text style={styles.sectionTitle}>Cities of Operation</Text>
            <View style={styles.citiesList}>
              {profile.cities.map((city, index) => (
                <View key={index} style={styles.cityTag}>
                  <Text style={styles.cityText}>{city}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Posts */}
        <View style={styles.postsSection}>
          <Text style={styles.sectionTitle}>Brand Posts</Text>
          <FlatList
            data={posts}
            renderItem={renderPost}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </ScrollView>

      {renderSettingsModal()}
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
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 15,
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  brandName: {
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
  category: {
    fontSize: 16,
    color: PRIMARY_COLOR,
    fontWeight: '600',
    marginBottom: 5,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cities: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginLeft: 5,
  },
  bio: {
    fontSize: 16,
    color: TEXT_COLOR,
    lineHeight: 22,
    marginBottom: 20,
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
  requirementsContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 10,
  },
  requirementsText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    lineHeight: 20,
  },
  interestsContainer: {
    marginBottom: 20,
  },
  interestsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  interestText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  citiesContainer: {
    marginBottom: 20,
  },
  citiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cityTag: {
    backgroundColor: '#F8F5FF',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
  },
  cityText: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontWeight: '500',
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
