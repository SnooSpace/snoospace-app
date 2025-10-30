import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PostCard from '../../../components/PostCard';
import { mockData } from '../../../data/mockData';
import { apiGet } from '../../../api/client';
import { getAuthToken } from '../../../api/auth';

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function VenueHomeFeedScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const token = await getAuthToken();
      const response = await apiGet('/posts/feed', 15000, token);
      setPosts(response.posts || []);
      // Use mock data for bookings until API is ready
      setBookings(mockData.venueBookings);
    } catch (error) {
      console.error('Error loading feed:', error);
      setErrorMsg(error?.message || 'Failed to load feed');
      // Fallback to mock data if API fails
      setPosts(mockData.posts);
      setBookings(mockData.venueBookings);
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

  const handleBookingPress = (booking) => {
    // Navigate to booking details
    console.log('View booking details:', booking.id);
  };

  const renderPost = ({ item }) => (
    <PostCard
      post={item}
      onLike={handleLike}
      onComment={handleComment}
      onFollow={handleFollow}
    />
  );

  const renderBooking = ({ item }) => (
    <TouchableOpacity
      style={styles.bookingCard}
      onPress={() => handleBookingPress(item)}
    >
      <View style={styles.bookingHeader}>
        <View style={styles.bookingInfo}>
          <Text style={styles.eventTitle}>{item.event_title}</Text>
          <Text style={styles.communityName}>{item.community_name}</Text>
        </View>
        <View style={[
          styles.statusBadge,
          item.status === 'confirmed' ? styles.confirmedBadge : 
          item.status === 'pending' ? styles.pendingBadge : styles.completedBadge
        ]}>
          <Text style={[
            styles.statusText,
            item.status === 'confirmed' ? styles.confirmedText : 
            item.status === 'pending' ? styles.pendingText : styles.completedText
          ]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>
      
      <View style={styles.bookingDetails}>
        <View style={styles.bookingDetailItem}>
          <Ionicons name="calendar-outline" size={16} color={LIGHT_TEXT_COLOR} />
          <Text style={styles.bookingDetailText}>
            {new Date(item.booking_date).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.bookingDetailItem}>
          <Ionicons name="time-outline" size={16} color={LIGHT_TEXT_COLOR} />
          <Text style={styles.bookingDetailText}>
            {item.duration_hours} hours
          </Text>
        </View>
        <View style={styles.bookingDetailItem}>
          <Ionicons name="cash-outline" size={16} color={PRIMARY_COLOR} />
          <Text style={[styles.bookingDetailText, { color: PRIMARY_COLOR }]}>
            ₹{item.total_cost.toLocaleString()}
          </Text>
        </View>
      </View>

      {item.special_requirements && (
        <Text style={styles.requirementsText} numberOfLines={2}>
          Requirements: {item.special_requirements}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Venue Dashboard</Text>
      <Text style={styles.headerSubtitle}>
        Manage your bookings and stay connected with the community
      </Text>
      
      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{bookings.length}</Text>
          <Text style={styles.statLabel}>Total Bookings</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {bookings.filter(b => b.status === 'confirmed').length}
          </Text>
          <Text style={styles.statLabel}>Confirmed</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {bookings.filter(b => b.status === 'pending').length}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="calendar-outline" size={60} color={LIGHT_TEXT_COLOR} />
      <Text style={styles.emptyTitle}>No Bookings Yet</Text>
      <Text style={styles.emptyText}>
        Browse communities to find booking opportunities
      </Text>
      <TouchableOpacity 
        style={styles.exploreButton}
        onPress={() => navigation.navigate('Browse')}
      >
        <Text style={styles.exploreButtonText}>Browse Communities</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {errorMsg ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity onPress={() => { setErrorMsg(''); loadFeed(); }}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <ScrollView style={styles.scrollView} refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }>
        {renderHeader()}
        
        {/* Bookings Section */}
        {bookings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Bookings</Text>
            <FlatList
              data={bookings.slice(0, 3)}
              renderItem={renderBooking}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bookingsList}
            />
          </View>
        )}

        {/* Posts Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Community Feed</Text>
          <FlatList
            data={posts}
            renderItem={renderPost}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
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
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F8F5FF',
    borderRadius: 12,
    paddingVertical: 15,
    marginBottom: 10,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
  },
  statLabel: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginHorizontal: 20,
    marginBottom: 15,
  },
  bookingsList: {
    paddingHorizontal: 20,
  },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginRight: 15,
    width: 280,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  bookingInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 2,
  },
  communityName: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingBadge: {
    backgroundColor: '#FFF3CD',
  },
  confirmedBadge: {
    backgroundColor: '#D4EDDA',
  },
  completedBadge: {
    backgroundColor: '#D1ECF1',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pendingText: {
    color: '#856404',
  },
  confirmedText: {
    color: '#155724',
  },
  completedText: {
    color: '#0C5460',
  },
  bookingDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  bookingDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookingDetailText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginLeft: 4,
  },
  requirementsText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    fontStyle: 'italic',
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
  errorBanner: {
    marginHorizontal: 20,
    marginTop: 10,
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
});
