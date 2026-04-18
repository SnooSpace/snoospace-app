import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { mockData } from '../../../data/mockData';
import SnooLoader from "../../../components/ui/SnooLoader";

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function VenueBrowseScreen({ navigation }) {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCapacity, setSelectedCapacity] = useState('All');

  const categories = ['All', 'Technology', 'Entrepreneurship', 'Design', 'Finance', 'Education'];
  const capacities = ['All', '50+', '100+', '200+', '500+'];

  useEffect(() => {
    loadCommunities();
  }, [selectedCategory, selectedCapacity]);

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
      
      // Filter by capacity needs (mock logic)
      if (selectedCapacity !== 'All') {
        const capacityValue = parseInt(selectedCapacity.replace('+', ''));
        filteredCommunities = filteredCommunities.filter(community => 
          community.follower_count >= capacityValue
        );
      }
      
      setCommunities(filteredCommunities);
    } catch (error) {
      console.error('Error loading communities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCommunityPress = (community) => {
    // Navigate to community profile or send venue inquiry
    console.log('View community:', community.id);
  };

  const handleSendInquiry = (community) => {
    // Navigate to inquiry form
    console.log('Send venue inquiry to:', community.id);
  };

  const renderCommunity = ({ item }) => (
    <View style={styles.communityCard}>
      <View style={styles.communityHeader}>
        <View style={styles.communityInfo}>
          <Text style={styles.communityName}>{item.name}</Text>
          <Text style={styles.communityCategory}>{item.category}</Text>
          <View style={styles.communityLocation}>
            <Ionicons name="location-outline" size={14} color={LIGHT_TEXT_COLOR} />
            <Text style={styles.locationText}>{item.location}</Text>
          </View>
        </View>
        <View style={styles.communityStats}>
          <Text style={styles.followerCount}>{item.follower_count} followers</Text>
          <Text style={styles.postCount}>{item.post_count} posts</Text>
        </View>
      </View>

      <Text style={styles.communityBio} numberOfLines={2}>
        {item.bio}
      </Text>

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

      <View style={styles.communityActions}>
        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => handleCommunityPress(item)}
        >
          <Ionicons name="eye-outline" size={16} color={PRIMARY_COLOR} />
          <Text style={styles.viewButtonText}>View Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.inquiryButton}
          onPress={() => handleSendInquiry(item)}
        >
          <Ionicons name="mail-outline" size={16} color="#FFFFFF" />
          <Text style={styles.inquiryButtonText}>Send Inquiry</Text>
        </TouchableOpacity>
      </View>
    </View>
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
        Try adjusting your filters to find more communities looking for venues
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Find Communities</Text>
        <Text style={styles.headerSubtitle}>
          Discover communities looking for venues to host their events
        </Text>
      </View>

      {/* Category Filters */}
      <View style={styles.filtersContainer}>
        <Text style={styles.filterTitle}>Category</Text>
        {renderFilter(categories, selectedCategory, setSelectedCategory)}
      </View>

      {/* Capacity Filters */}
      <View style={styles.filtersContainer}>
        <Text style={styles.filterTitle}>Community Size</Text>
        {renderFilter(capacities, selectedCapacity, setSelectedCapacity)}
      </View>

      {/* Communities List */}
      <View style={styles.communitiesContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <SnooLoader size="large" color={PRIMARY_COLOR} />
            <Text style={[styles.loadingText, { fontFamily: 'Manrope-Medium' }]}>Loading communities...</Text>
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
  
    fontFamily: "Manrope-Regular",
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
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
  communityStats: {
    alignItems: 'flex-end',
  },
  followerCount: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 2,
  },
  postCount: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
  },
  communityBio: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    lineHeight: 20,
    marginBottom: 15,
  },
  sponsorTypesContainer: {
    marginBottom: 15,
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
  communityActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  viewButtonText: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    marginLeft: 5,
    fontWeight: '500',
  },
  inquiryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  inquiryButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 5,
    fontWeight: '500',
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
