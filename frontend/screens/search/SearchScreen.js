import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { apiGet } from '../../api/client';

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';
const BORDER_COLOR = '#E5E5EA';

export default function SearchScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [searchResults, setSearchResults] = useState({
    posts: [],
    members: [],
    communities: [],
    sponsors: [],
    venues: [],
  });
  const [loading, setLoading] = useState(false);

  const tabs = ['All', 'Members', 'Communities', 'Sponsors', 'Venues', 'Posts'];

  useEffect(() => {
    if (searchQuery.length > 2) {
      performSearch();
    } else {
      setSearchResults({
        posts: [],
        members: [],
        communities: [],
        sponsors: [],
        venues: [],
      });
    }
  }, [searchQuery]);

  const performSearch = async () => {
    try {
      setLoading(true);
      const response = await apiGet(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(response);
    } catch (error) {
      console.error('Error searching:', error);
      // Mock search results for now
      setSearchResults({
        members: [
          { id: 1, name: "John Doe", username: "john_doe", location: "New York, NY", image_url: "https://via.placeholder.com/50" },
          { id: 2, name: "Jane Smith", username: "jane_smith", location: "Los Angeles, CA", image_url: "https://via.placeholder.com/50" }
        ],
        communities: [
          { id: 1, name: "Tech Enthusiasts", username: "tech_enthusiasts", location: "San Francisco, CA", image_url: "https://via.placeholder.com/50" }
        ],
        sponsors: [],
        venues: [],
        posts: []
      });
    } finally {
      setLoading(false);
    }
  };

  const renderSearchResult = ({ item, type }) => {
    const getResultIcon = () => {
      switch (type) {
        case 'member':
          return <Ionicons name="person" size={20} color={PRIMARY_COLOR} />;
        case 'community':
          return <Ionicons name="people" size={20} color={PRIMARY_COLOR} />;
        case 'sponsor':
          return <Ionicons name="business" size={20} color={PRIMARY_COLOR} />;
        case 'venue':
          return <Ionicons name="location" size={20} color={PRIMARY_COLOR} />;
        case 'post':
          return <Ionicons name="image" size={20} color={PRIMARY_COLOR} />;
        default:
          return <Ionicons name="search" size={20} color={PRIMARY_COLOR} />;
      }
    };

    return (
      <TouchableOpacity style={styles.searchResultItem}>
        <View style={styles.searchResultContent}>
          <View style={styles.searchResultIcon}>
            {getResultIcon()}
          </View>
          <View style={styles.searchResultText}>
            <Text style={styles.searchResultTitle}>{item.name || item.title}</Text>
            <Text style={styles.searchResultSubtitle}>
              {item.location || item.username || item.bio}
            </Text>
          </View>
          {item.image_url && (
            <Image source={{ uri: item.image_url }} style={styles.searchResultImage} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSponsoredContent = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Sponsored</Text>
      <TouchableOpacity style={styles.sponsoredItem}>
        <View style={styles.sponsoredContent}>
          <View style={styles.sponsoredText}>
            <Text style={styles.sponsoredLabel}>Sponsored</Text>
            <Text style={styles.sponsoredTitle}>Tech Conference 2024</Text>
            <Text style={styles.sponsoredLocation}>San Francisco, CA</Text>
          </View>
          <View style={styles.sponsoredImage}>
            <View style={styles.placeholderImage}>
              <Ionicons name="business" size={30} color={LIGHT_TEXT_COLOR} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderPopularContent = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Popular</Text>
      
      <TouchableOpacity style={styles.popularItem}>
        <View style={styles.popularContent}>
          <View style={styles.popularText}>
            <Text style={styles.popularTitle}>Music Festival</Text>
            <Text style={styles.popularLocation}>Los Angeles, CA</Text>
          </View>
          <View style={styles.popularImage}>
            <View style={styles.placeholderImage}>
              <Ionicons name="musical-notes" size={30} color={LIGHT_TEXT_COLOR} />
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.popularItem}>
        <View style={styles.popularContent}>
          <View style={styles.popularText}>
            <Text style={styles.popularTitle}>Art Exhibition</Text>
            <Text style={styles.popularLocation}>New York, NY</Text>
          </View>
          <View style={styles.popularImage}>
            <View style={styles.placeholderImage}>
              <Ionicons name="color-palette" size={30} color={LIGHT_TEXT_COLOR} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderTabContent = () => {
    if (searchQuery.length <= 2) {
      return (
        <ScrollView style={styles.content}>
          {renderSponsoredContent()}
          {renderPopularContent()}
        </ScrollView>
      );
    }

    const getCurrentResults = () => {
      switch (activeTab) {
        case 'Members':
          return searchResults.members;
        case 'Communities':
          return searchResults.communities;
        case 'Sponsors':
          return searchResults.sponsors;
        case 'Venues':
          return searchResults.venues;
        case 'Posts':
          return searchResults.posts;
        default:
          return [
            ...searchResults.members,
            ...searchResults.communities,
            ...searchResults.sponsors,
            ...searchResults.venues,
            ...searchResults.posts,
          ];
      }
    };

    const currentResults = getCurrentResults();

    return (
      <FlatList
        data={currentResults}
        keyExtractor={(item, index) => `${item.id || index}`}
        renderItem={({ item }) => renderSearchResult({ 
          item, 
          type: activeTab.toLowerCase().slice(0, -1) 
        })}
        style={styles.resultsList}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={LIGHT_TEXT_COLOR} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for Events or People"
            placeholderTextColor={LIGHT_TEXT_COLOR}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        </View>
        <TouchableOpacity style={styles.filtersButton}>
          <Text style={styles.filtersText}>Filters</Text>
          <Ionicons name="chevron-down" size={16} color={LIGHT_TEXT_COLOR} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {tabs.map((tab) => (
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
        ))}
      </ScrollView>

      {/* Content */}
      {renderTabContent()}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  headerRight: {
    width: 34,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: TEXT_COLOR,
  },
  filtersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 5,
  },
  filtersText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
 
  tabsContent: {
    paddingHorizontal: 20,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: PRIMARY_COLOR
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: LIGHT_TEXT_COLOR,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 50,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 15,
  },
  sponsoredItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  sponsoredContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sponsoredText: {
    flex: 1,
  },
  sponsoredLabel: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontWeight: '500',
    marginBottom: 5,
  },
  sponsoredTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 3,
  },
  sponsoredLocation: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  sponsoredImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popularItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  popularContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  popularText: {
    flex: 1,
  },
  popularTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_COLOR,
    marginBottom: 3,
  },
  popularLocation: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  popularImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsList: {
    flex: 1,
  },
  searchResultItem: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  searchResultContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchResultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  searchResultText: {
    flex: 1,
  },
  searchResultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 3,
  },
  searchResultSubtitle: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  searchResultImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
});
