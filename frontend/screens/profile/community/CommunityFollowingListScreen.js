import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getCommunityFollowing } from '../../../api/communities';
import { followMember, unfollowMember, getFollowStatusForMember } from '../../../api/members';
import { getAuthToken } from '../../../api/auth';
import { apiGet } from '../../../api/client';

export default function CommunityFollowingListScreen({ route, navigation }) {
  const communityId = route?.params?.communityId;
  const title = route?.params?.title || 'Following';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [myId, setMyId] = useState(null);

  const load = useCallback(async (reset = false, isRefresh = false) => {
    if (isRefresh && refreshing) return;
    if (loadingMore && !isRefresh) return;
    if (!hasMore && !reset) return;
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (reset) {
        setLoadingMore(true);
      }
      if (reset) {
        setOffset(0);
        setHasMore(true);
      }
      const data = await getCommunityFollowing(communityId, { limit: 30, offset: reset ? 0 : offset });
      const raw = (data?.results || data?.following || data?.items || data || []);
      // Normalize to { id, full_name, username, profile_photo_url, is_following }
      let list = raw.map((r) => ({
        id: r.following_id || r.id,
        full_name: r.following_name || r.full_name || r.name,
        username: r.following_username || r.username,
        profile_photo_url: r.following_photo_url || r.profile_photo_url,
        is_following: r.is_following ?? r.you_follow_them,
      }));
      // If the API didn't provide follow status, fetch it for visible items
      const hasStatusProvided = raw.some(r => (r && (r.is_following !== undefined || r.you_follow_them !== undefined)));
      if (!hasStatusProvided) {
        const statuses = await Promise.all(
          list.map(async (u) => {
            try {
              const s = await getFollowStatusForMember(u.id);
              return { id: u.id, is_following: !!s?.isFollowing };
            } catch {
              return { id: u.id, is_following: false };
            }
          })
        );
        const byId = new Map(statuses.map(s => [s.id, s.is_following]));
        list = list.map(u => ({ ...u, is_following: byId.get(u.id) }));
      }
      setItems(prev => (reset ? list : [...prev, ...list]));
      const received = list.length;
      setOffset((reset ? 0 : offset) + received);
      setHasMore(received >= 30);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [communityId, offset, hasMore, loadingMore, refreshing]);

  useEffect(() => { 
    load(true, false); 
  }, [communityId]);

  useEffect(() => {
    (async () => {
      try {
        const token = await getAuthToken();
        const me = await apiGet('/me', 8000, token);
        const id = me?.member?.id;
        if (id) setMyId(id);
      } catch {}
    })();
  }, []);

  const toggleFollow = async (id, isFollowing) => {
    // optimistic
    setItems(prev => prev.map(u => u.id === id ? { ...u, is_following: !isFollowing } : u));
    try {
      if (isFollowing) await unfollowMember(id); else await followMember(id);
    } catch {
      setItems(prev => prev.map(u => u.id === id ? { ...u, is_following: isFollowing } : u));
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.userInfo}
        onPress={() => {
          navigation.navigate('MemberPublicProfile', { memberId: item.id });
        }}
      >
        <Image
          source={{ uri: item.profile_photo_url || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
        />
        <View style={styles.textContainer}>
          <Text style={styles.name}>{item.full_name || 'Member'}</Text>
          {item.username && <Text style={styles.username}>@{item.username}</Text>}
        </View>
      </TouchableOpacity>
      {item.id !== myId && (
        <TouchableOpacity
          style={[
            styles.followButton,
            item.is_following ? styles.followingButton : styles.followButtonPrimary
          ]}
          onPress={() => toggleFollow(item.id, item.is_following)}
        >
          <Text style={[
            styles.followButtonText,
            item.is_following ? styles.followingButtonText : styles.followButtonTextPrimary
          ]}>
            {item.is_following ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1D1D1F" />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        onEndReached={() => load(false, false)}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true, true)} />
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No {title.toLowerCase()} yet</Text>
            </View>
          )
        }
      />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1D1D1F',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E5E5EA',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: '#8E8E93',
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  followButtonPrimary: {
    backgroundColor: '#5f27cd',
  },
  followingButton: {
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  followButtonTextPrimary: {
    color: '#FFFFFF',
  },
  followingButtonText: {
    color: '#1D1D1F',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
  },
});

