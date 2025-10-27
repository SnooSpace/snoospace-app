import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import UserCard from '../../../components/UserCard';
import { mockData } from '../../../data/mockData';

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function SponsorBrowseScreen({ navigation }) {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');

  const categories = ['All', 'Technology', 'Entrepreneurship', 'Design', 'Finance', 'Education'];
  const locations = ['All', 'Mumbai', 'Bangalore', 'Delhi', 'Chennai', 'Hyderabad'];

  useEffect(() => {
    loadCommunities();
  }, [selectedCategory, selectedLocation]);

  const loadCommunities = async () => {
    try {
      setLoading(true);
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Filter communities based on selected filters
      let filteredCommunities = mockData.communities;
      
      if (selectedCategory !== 'All') {
        filteredCommunities = filteredCommunities.filter(community => 
          community.category === selectedCategory
        );
      }
      
      if (selectedLocation !== 'All') {
        filteredCommunities = filteredCommunities.filter(community => 
          community.location.includes(selectedLocation)
        );
      }
      
      setCommunities(filteredCommunities);
    } catch (error) {
      console.error('Error loading communities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (entityId, entityType) => {
    try {
      // In real app, this would be API call
      console.log('Follow entity:', entityId, entityType);
    } catch (error) {
      console.error('Error following entity:', error);
    }
  };

  const handleCommunityPress = (community) => {
    // Navigate to community profile or create sponsorship offer
    console.log('View community:', community.id);
  };

  const renderCommunity = ({ item }) => (
    <TouchableOpacity
      style={styles.communityCard}
      onPress={() => handleCommunityPress(item)}
    >
      <View style={styles.communityHeader}>
        <Image source={{ uri: item.logo_url }} style={styles.communityLogo} />
        <View style={styles.communityInfo}>
          <Text style={styles.communityName}>{item.name}</Text>
          <Text style={styles.communityCategory}>{item.category}</Text>
          <View style={styles.communityLocation}>
            <Ionicons name="location-outline" size={14} color={LIGHT_TEXT_COLOR} />
            <Text style={styles.locationText}>{item.location}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.followButton}
          onPress={() => handleFollow(item.id, 'community')}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <Text style={styles.communityBio} numberOfLines={2}>
        {item.bio}
      </Text>

      <View style={styles.communityStats}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{item.follower_count}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{item.post_count}</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{item.sponsor_types.length}</Text>
          <Text style={styles.statLabel}>Sponsor Types</Text>
        </View>
      </View>

      <View style={styles.sponsorTypesContainer}>
        <Text style={styles.sponsorTypesTitle}>Looking for:</Text>
        <View style={styles.sponsorTypesList}>
          {item.sponsor_types.slice(0, 3).map((type, index) => (
            <View key={index} style={styles.sponsorTypeTag}>
              <Text style={styles.sponsorTypeText}>{type}</Text>
            </View>
          ))}
          {item.sponsor_types.length > 3 && (
            <Text style={styles.moreTypesText}>+{item.sponsor_types.length - 3} more</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderFilter = (items, selectedValue, onSelect, style) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {items.map((item) => (
        <TouchableOpacity
          key={item}
          style={[
            styles.filterTab,
            selectedValue === item && styles.activeFilterTab,
            style
          ]}
          onPress={() => onSelect(item)}
        >
          <Text style={[
            styles.filterText,
            selectedValue === item && styles.activeFilterText
          ]}>
            {item}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search-outline" size={60} color={LIGHT_TEXT_COLOR} />
      <Text style={styles.emptyTitle}>No Communities Found</Text>
      <Text style={styles.emptyText}>
        Try adjusting your filters to find more communities
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Browse Communities</Text>
        <Text style={styles.headerSubtitle}>
          Find communities to sponsor and partner with
        </Text>
      </View>

      {/* Category Filters */}
      <View style={styles.filtersContainer}>
        <Text style={styles.filterTitle}>Category</Text>
        {renderFilter(categories, selectedCategory, setSelectedCategory)}
      </View>

      {/* Location Filters */}
      <View style={styles.filtersContainer}>
        <Text style={styles.filterTitle}>Location</Text>
        {renderFilter(locations, selectedLocation, setSelectedLocation)}
      </View>

      {/* Communities List */}
      <View style={styles.communitiesContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
            <Text style={styles.loadingText}>Loading communities...</Text>
          </View>
        ) : (
          <FlatList
            data={communities}
            renderItem={renderCommunity}
            keyExtractor={(item) => item.id.toString()}
            ListEmptyComponent={renderEmpty}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
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
  },
  filtersContainer: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 10,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
  },
  activeFilterTab: {
    backgroundColor: PRIMARY_COLOR,
  },
  filterText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  communitiesContainer: {
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
  listContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  communityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  communityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  communityLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  communityInfo: {
    flex: 1,
  },
  communityName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 4,
  },
  communityCategory: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: '600',
    marginBottom: 4,
  },
  communityLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginLeft: 4,
  },
  followButton: {
    backgroundColor: PRIMARY_COLOR,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  communityBio: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    lineHeight: 20,
    marginBottom: 15,
  },
  communityStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E5EA',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  statLabel: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  sponsorTypesContainer: {
    marginTop: 5,
  },
  sponsorTypesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 8,
  },
  sponsorTypesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  sponsorTypeTag: {
    backgroundColor: '#F8F5FF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
  },
  sponsorTypeText: {
    fontSize: 10,
    color: PRIMARY_COLOR,
    fontWeight: '500',
  },
  moreTypesText: {
    fontSize: 10,
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
    lineHeight: 22,
  },
});
