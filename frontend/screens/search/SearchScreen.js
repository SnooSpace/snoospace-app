import React, { useState, useEffect, useCallback } from 'react';
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
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import UserCard from '../../components/UserCard';
import { globalSearch } from '../../api/search';
import { followMember, unfollowMember } from '../../api/members';
import { followCommunity, unfollowCommunity } from '../../api/communities';
import { getAuthToken, getAuthEmail} from '../../api/auth';
import { apiPost } from '../../api/client';
import EventBus from '../../utils/EventBus';

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

export default function SearchScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('All');
  const [following, setFollowing] = useState({});
  const [pending, setPending] = useState({});
  const [recents, setRecents] = useState([]);
  const [userId, setUserId] = useState(null);
  const [focused, setFocused] = useState(false);

  const tabs = ['All', 'Members', 'Communities', 'Sponsors', 'Venues'];
  const DEBOUNCE_MS = 300;

  const getRecentsKey = () => {
    return userId ?  `recent_searches_${userId}` : "recent_searches";
  };

  const loadRecents = useCallback(async () => {
    if (!userId) return;
    try {
      const key = getRecentsKey();
      const raw = await AsyncStorage.getItem(key);
      if (!raw) {
        setRecents([]);
        return;
      }
      const arr = JSON.parse(raw);
      setRecents(Array.isArray(arr) ? arr : []);
    } catch {
      setRecents([]);
    }
  }, [userId]);

  const saveRecents = useCallback(async (items) => {
    if (!userId) return;
    try {
      const key = getRecentsKey();
      await AsyncStorage.setItem(key, JSON.stringify(items));
    } catch {}
  }, [userId]);

  useEffect(() => {
    const loadUserId = async () => {
      try {
        const token = await getAuthToken();
        const email = await getAuthEmail();
        if (token && email) {
          const profileResponse = await apiPost('/auth/get-user-profile', { email }, 10000, token);
          if (profileResponse?.profile?.id) {
            setUserId(profileResponse.profile.id);
          }
        }
      } catch (error) {
        console.error('Error loading user ID:', error);
      }
    };
    loadUserId();
  }, []);

  useEffect(() => {
    if (userId) {
      loadRecents();
    }
  }, [userId, loadRecents]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        performSearch();
      } else {
        setSearchResults([]);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, activeTab, performSearch]);

  const performSearch = useCallback(async () => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    
    try {
      const globalData = await globalSearch(searchQuery.trim(), { limit: 50, offset: 0 });
      const allResults = globalData.results || [];
      
      let filteredResults = allResults;
      if (activeTab === 'Members') {
        filteredResults = allResults.filter(r => r.type === 'member');
      } else if (activeTab === 'Communities') {
        filteredResults = allResults.filter(r => r.type === 'community');
      } else if (activeTab === 'Sponsors') {
        filteredResults = allResults.filter(r => r.type === 'sponsor');
      } else if (activeTab === 'Venues') {
        filteredResults = allResults.filter(r => r.type === 'venue');
      }
      
      setSearchResults(filteredResults);
      
      setFollowing((prev) => {
        const copy = { ...prev };
        filteredResults.forEach((r) => {
          if (r && r.id) {
            const isFollowing = r.is_following === true || r.isFollowing === true;
            copy[r.id] = isFollowing;
          }
        });
        return copy;
      });
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeTab]);

  const handleFollow = async (entityId, entityType, newFollowingState = null) => {
    if (pending[entityId]) return;
    
    const currentFollowing = !!following[entityId];
    const targetState = newFollowingState !== null ? newFollowingState : !currentFollowing;
    
    setFollowing((prev) => ({ ...prev, [entityId]: targetState }));
    setPending((prev) => ({ ...prev, [entityId]: true }));
    
    try {
      let currentUserId = null;
      let currentUserType = 'community';
      try {
        const token = await getAuthToken();
        const email = await getAuthEmail();
        if (token && email) {
          const profileResponse = await apiPost('/auth/get-user-profile', { email }, 10000, token);
          if (profileResponse?.profile?.id) {
            currentUserId = profileResponse.profile.id;
            currentUserType = profileResponse.role || 'community';
          }
        }
      } catch (e) {
        console.error('Error getting current user:', e);
      }
      
      if (entityType === 'member') {
        if (targetState) {
          await followMember(entityId);
        } else {
          await unfollowMember(entityId);
        }
        EventBus.emit("follow-updated", { 
          memberId: entityId, 
          isFollowing: targetState,
          followerId: currentUserId,
          followerType: currentUserType
        });
      } else if (entityType === 'community') {
        if (targetState) {
          await followCommunity(entityId);
        } else {
          await unfollowCommunity(entityId);
        }
        EventBus.emit("follow-updated", { 
          communityId: entityId, 
          isFollowing: targetState,
          followerId: currentUserId,
          followerType: currentUserType
        });
      }
    } catch (e) {
      const errorMsg = e?.message || String(e || '');
      if (errorMsg.includes('Already following') || errorMsg.includes('Not following')) {
        if (errorMsg.includes('Already following') && !targetState) {
          setFollowing((prev) => ({ ...prev, [entityId]: true }));
        } else if (errorMsg.includes('Not following') && targetState) {
          setFollowing((prev) => ({ ...prev, [entityId]: false }));
        }
      } else {
        setFollowing((prev) => ({ ...prev, [entityId]: currentFollowing }));
        console.error('Error following/unfollowing:', e);
      }
    } finally {
      setPending((prev) => ({ ...prev, [entityId]: false }));
    }
  };

  const handleBackButton = () => {
    Keyboard.dismiss();
    setFocused(false);
    setSearchQuery('');
  };

  const renderEntity = ({ item }) => {
    if (!item) return null;
    const entityType = item.type || 'member';
    
    return (
      <UserCard
        user={item}
        userType={entityType}
        showSubtitle={false}
        onPress={(userId, userType) => {
          const next = [
            {
              id: item.id,
              type: entityType,
              username: item.username,
              full_name: item.full_name || item.name,
              profile_photo_url: item.profile_photo_url || item.logo_url,
            },
            ...recents.filter((r) => r.id !== item.id || r.type !== entityType),
          ].slice(0, 10);
          setRecents(next);
          saveRecents(next);
          
          if (userType === 'community') {
            navigation.navigate("CommunityPublicProfile", {
              communityId: userId,
              viewerRole: 'member',
            });
          } else if (userType === 'member') {
            navigation.navigate("MemberPublicProfile", {
              memberId: userId,
            });
          } else if (userType === 'sponsor') {
            Alert.alert('Sponsor Profile', 'Sponsor profile navigation will be implemented soon');
          } else if (userType === 'venue') {
            Alert.alert('Venue Profile', 'Venue profile navigation will be implemented soon');
          }
        }}
        showFollowButton={entityType === 'member' || entityType === 'community'}
        isFollowing={!!following[item.id]}
        isLoading={!!pending[item.id]}
        onFollowChange={(userId, userType, newFollowingState) => {
          handleFollow(userId, userType, newFollowingState);
        }}
      />
    );
  };

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

  const renderRecentItem = ({ item }) => {
    const entityType = item.type || 'member';
    const displayName = item.full_name || item.name || 'User';
    const photoUrl = item.profile_photo_url || item.logo_url || "https://via.placeholder.com/50";
    
    return (
      <TouchableOpacity
        style={styles.recentItemContainer}
        onPress={() => {
          if (entityType === 'community') {
            navigation.navigate("CommunityPublicProfile", {
              communityId: item.id,
              viewerRole: 'member',
            });
          } else if (entityType === 'member') {
            navigation.navigate("MemberPublicProfile", {
              memberId: item.id,
            });
          }
        }}
      >
        <Image source={{ uri: photoUrl }} style={styles.recentAvatar} />
        <View style={styles.recentInfo}>
          <Text style={styles.recentName}>{displayName}</Text>
          <Text style={styles.recentUsername}>@{item.username}</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            const next = recents.filter((r) => r.id !== item.id || r.type !== entityType);
            setRecents(next);
            saveRecents(next);
          }}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
        >
          <Ionicons name="close-circle" size={20} color={LIGHT_TEXT_COLOR} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
      </View>

      <View style={styles.searchContainer}>
        {focused && (
          <TouchableOpacity 
            onPress={handleBackButton} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
        )}
        <View style={[styles.searchBar, focused && styles.searchBarFocused]}>
          <Ionicons name="search" size={20} color={LIGHT_TEXT_COLOR} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search members, communities, sponsors, venues..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholderTextColor={LIGHT_TEXT_COLOR}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={LIGHT_TEXT_COLOR} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {tabs.map(renderTab)}
        </ScrollView>
      </View>

      {focused && !searchQuery && recents.length > 0 && (
        <View style={styles.recentsSection}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentHeaderText}>Recent</Text>
            <TouchableOpacity onPress={() => {
              setRecents([]);
              saveRecents([]);
            }}>
              <Text style={styles.clearAllText}>Clear all</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={recents}
            renderItem={renderRecentItem}
            keyExtractor={(item) => `${item.type}-${item.id}`}
          />
        </View>
      )}

      {searchQuery && (
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
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  searchBarFocused: {
    backgroundColor: '#ECECEC',
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
  recentsSection: {
    flex: 1,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  recentHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  clearAllText: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  recentItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  recentAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  recentInfo: {
    flex: 1,
  },
  recentName: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 2,
  },
  recentUsername: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
});