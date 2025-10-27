import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
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

export default function CommunitySearchScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('All');

  const tabs = ['All', 'Members', 'Communities', 'Sponsors', 'Venues'];

  useEffect(() => {
    if (searchQuery.length > 0) {
      performSearch();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, activeTab]);

  const performSearch = async () => {
    setLoading(true);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    let results = [];
    
    if (activeTab === 'All' || activeTab === 'Members') {
      const memberResults = mockData.members
        .filter(member => 
          member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          member.username.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .map(member => ({ ...member, type: 'member' }));
      results = [...results, ...memberResults];
    }
    
    if (activeTab === 'All' || activeTab === 'Communities') {
      const communityResults = mockData.communities
        .filter(community => 
          community.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          community.username.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .map(community => ({ ...community, type: 'community' }));
      results = [...results, ...communityResults];
    }
    
    if (activeTab === 'All' || activeTab === 'Sponsors') {
      const sponsorResults = mockData.sponsors
        .filter(sponsor => 
          sponsor.brand_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          sponsor.username.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .map(sponsor => ({ ...sponsor, type: 'sponsor' }));
      results = [...results, ...sponsorResults];
    }
    
    if (activeTab === 'All' || activeTab === 'Venues') {
      const venueResults = mockData.venues
        .filter(venue => 
          venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          venue.username.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .map(venue => ({ ...venue, type: 'venue' }));
      results = [...results, ...venueResults];
    }
    
    setSearchResults(results);
    setLoading(false);
  };

  const handleFollow = async (entityId, entityType) => {
    try {
      // In real app, this would be API call
      console.log('Follow entity:', entityId, entityType);
    } catch (error) {
      console.error('Error following entity:', error);
    }
  };

  const renderEntity = ({ item }) => (
    <UserCard
      entity={item}
      onFollow={handleFollow}
    />
  );

  const renderTab = (tab) => (
    <TouchableOpacity
      key={tab}
      style={[
        styles.tab,
        activeTab === tab && styles.activeTab
      ]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[
        styles.tabText,
        activeTab === tab && styles.activeTabText
      ]}>
        {tab}
      </Text>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search-outline" size={60} color={LIGHT_TEXT_COLOR} />
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'No Results Found' : 'Search for Communities'}
      </Text>
      <Text style={styles.emptyText}>
        {searchQuery 
          ? `No ${activeTab.toLowerCase()} found for "${searchQuery}"`
          : 'Find members, communities, sponsors, and venues to follow'
        }
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={LIGHT_TEXT_COLOR} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search members, communities, sponsors, venues..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={LIGHT_TEXT_COLOR}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={LIGHT_TEXT_COLOR} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {tabs.map(renderTab)}
        </ScrollView>
      </View>

      {/* Results */}
      <View style={styles.resultsContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY_COLOR} />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        ) : (
          <FlatList
            data={searchResults}
            renderItem={renderEntity}
            keyExtractor={(item) => `${item.type}-${item.id}`}
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
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: TEXT_COLOR,
    marginLeft: 10,
  },
  tabsContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
  },
  activeTab: {
    backgroundColor: PRIMARY_COLOR,
  },
  tabText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  resultsContainer: {
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
