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

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function SponsorHomeFeedScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    try {
      setLoading(true);
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Use mock data - in real app, this would be API call
      setPosts(mockData.posts);
      setOpportunities(mockData.sponsorshipOffers);
    } catch (error) {
      console.error('Error loading feed:', error);
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

  const handleOpportunityPress = (opportunity) => {
    // Navigate to opportunity details or create offer
    console.log('View opportunity:', opportunity.id);
  };

  const renderPost = ({ item }) => (
    <PostCard
      post={item}
      onLike={handleLike}
      onComment={handleComment}
      onFollow={handleFollow}
    />
  );

  const renderOpportunity = ({ item }) => (
    <TouchableOpacity
      style={styles.opportunityCard}
      onPress={() => handleOpportunityPress(item)}
    >
      <View style={styles.opportunityHeader}>
        <View style={styles.opportunityInfo}>
          <Text style={styles.opportunityTitle}>{item.event_title}</Text>
          <Text style={styles.opportunityCommunity}>{item.community_name}</Text>
        </View>
        <View style={[
          styles.statusBadge,
          item.status === 'accepted' ? styles.acceptedBadge : 
          item.status === 'pending' ? styles.pendingBadge : styles.declinedBadge
        ]}>
          <Text style={[
            styles.statusText,
            item.status === 'accepted' ? styles.acceptedText : 
            item.status === 'pending' ? styles.pendingText : styles.declinedText
          ]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>
      
      <Text style={styles.opportunityDescription}>{item.message}</Text>
      
      <View style={styles.opportunityDetails}>
        <View style={styles.opportunityDetailItem}>
          <Ionicons name="calendar-outline" size={16} color={LIGHT_TEXT_COLOR} />
          <Text style={styles.opportunityDetailText}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.opportunityDetailItem}>
          <Ionicons name="cash-outline" size={16} color={PRIMARY_COLOR} />
          <Text style={[styles.opportunityDetailText, { color: PRIMARY_COLOR }]}>
            ₹{item.amount.toLocaleString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Sponsor Dashboard</Text>
      <Text style={styles.headerSubtitle}>
        Discover opportunities and stay connected with the community
      </Text>
      
      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{opportunities.length}</Text>
          <Text style={styles.statLabel}>Active Offers</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {opportunities.filter(o => o.status === 'accepted').length}
          </Text>
          <Text style={styles.statLabel}>Accepted</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {opportunities.filter(o => o.status === 'pending').length}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="briefcase-outline" size={60} color={LIGHT_TEXT_COLOR} />
      <Text style={styles.emptyTitle}>No Opportunities Yet</Text>
      <Text style={styles.emptyText}>
        Browse communities to find sponsorship opportunities
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
      <ScrollView style={styles.scrollView}>
        {renderHeader()}
        
        {/* Opportunities Section */}
        {opportunities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Sponsorship Offers</Text>
            <FlatList
              data={opportunities}
              renderItem={renderOpportunity}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.opportunitiesList}
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
  opportunitiesList: {
    paddingHorizontal: 20,
  },
  opportunityCard: {
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
  opportunityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  opportunityInfo: {
    flex: 1,
  },
  opportunityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 2,
  },
  opportunityCommunity: {
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
  acceptedBadge: {
    backgroundColor: '#D4EDDA',
  },
  declinedBadge: {
    backgroundColor: '#F8D7DA',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pendingText: {
    color: '#856404',
  },
  acceptedText: {
    color: '#155724',
  },
  declinedText: {
    color: '#721C24',
  },
  opportunityDescription: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    lineHeight: 20,
    marginBottom: 15,
  },
  opportunityDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  opportunityDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  opportunityDetailText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginLeft: 5,
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
