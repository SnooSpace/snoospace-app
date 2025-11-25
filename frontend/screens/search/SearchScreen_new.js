import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  FlatList,
import { getAuthToken, getAuthEmail } from '../../api/auth';
import { apiPost } from '../../api/client';
import EventBus from '../../utils/EventBus';

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';
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
      
      // Filter by active tab
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
      
      // Initialize following map from payload - use is_following from API response
      setFollowing((prev) => {
        const copy = { ...prev };
        filteredResults.forEach((r) => {
          if (r && r.id) {
            // Use is_following from API, explicitly check for true
            // Handle both is_following and isFollowing for compatibility
            const isFollowing = r.is_following === true || r.isFollowing === true;
            copy[r.id] = isFollowing;
            // Debug log to help diagnose issues
            if (r.type === 'member' || r.type === 'community') {
              console.log(`[Search] Initialized follow state for ${r.type} ${r.id}: ${isFollowing} (from API: ${r.is_following})`);
            }
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
    
    // Use newFollowingState if provided, otherwise toggle based on current state
    const currentFollowing = !!following[entityId];
    const targetState = newFollowingState !== null ? newFollowingState : !currentFollowing;
    
    console.log(`[Follow] ${entityType} ${entityId}: current=${currentFollowing}, target=${targetState}, newState=${newFollowingState}`);
    
    // Optimistically update state
    setFollowing((prev) => ({ ...prev, [entityId]: targetState }));
    setPending((prev) => ({ ...prev, [entityId]: true }));
    
    try {
      // Get current user info for EventBus
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
      // Check for "already following" or "not following" errors - these are expected in race conditions
      const errorMsg = e?.message || String(e || '');
      if (errorMsg.includes('Already following') || errorMsg.includes('Not following')) {
        // If we get "Already following" but we thought we weren't, update state to true
        // If we get "Not following" but we thought we were, update state to false
        if (errorMsg.includes('Already following') && !targetState) {
          setFollowing((prev) => ({ ...prev, [entityId]: true }));
        } else if (errorMsg.includes('Not following') && targetState) {
          setFollowing((prev) => ({ ...prev, [entityId]: false }));
        }
        // Otherwise, state is already correct, just log
        console.log('Follow/unfollow race condition handled:', errorMsg);
      } else {
        // Rollback on unexpected error
        setFollowing((prev) => ({ ...prev, [entityId]: currentFollowing }));
        console.error('Error following/unfollowing:', e);
      }
    } finally {
      setPending((prev) => ({ ...prev, [entityId]: false }));
    }
  };

  const renderEntity = ({ item }) => {
    if (!item) return null;
    const entityType = item.type || 'member';
    
    return (
      <UserCard
        user={item}
        userType={entityType}
        onPress={(userId, userType) => {
          // Handle navigation based on userType
          if (userType === 'community') {
            navigation.navigate('Profile', {
              screen: 'CommunityPublicProfile',
              params: { communityId: userId }
            });
          } else if (userType === 'member') {
            navigation.navigate('Profile', {
              screen: 'MemberPublicProfile',
              params: { memberId: userId }
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