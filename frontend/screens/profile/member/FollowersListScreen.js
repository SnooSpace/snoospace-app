import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getMemberFollowers, followMember, unfollowMember, getFollowStatusForMember } from '../../../api/members';
import { getAuthToken } from '../../../api/auth';
import { apiGet } from '../../../api/client';

export default function FollowersListScreen({ route, navigation }) {
  const memberId = route?.params?.memberId;
  const title = route?.params?.title || 'Followers';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [myId, setMyId] = useState(null);

  const load = useCallback(async (reset = false) => {
    if (loadingMore) return;
    if (!hasMore && !reset) return;
    try {
      if (reset) {
        setOffset(0);
        setHasMore(true);
        setItems([]);
      }
      const data = await getMemberFollowers(memberId, { limit: 30, offset: reset ? 0 : offset });
      const raw = (data?.results || data?.followers || data?.items || data || []);
      // Normalize to { id, full_name, username, profile_photo_url, is_following }
      let list = raw.map((r) => ({
        id: r.follower_id || r.id,
        full_name: r.follower_name || r.full_name || r.name,
        username: r.follower_username || r.username,
        profile_photo_url: r.follower_photo_url || r.profile_photo_url,
        // Some APIs might include whether current user follows them back
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
      setLoading(false);
      setLoadingMore(false);
    }
  }, [memberId, offset, hasMore, loadingMore]);

  useEffect(() => { load(true); }, [memberId]);

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
        style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
        onPress={() => {
          if (item.id === myId) {
            // Navigate to Profile tab via root navigator
            const root = navigation.getParent()?.getParent();
            if (root) {
              root.navigate('MemberHome', { tab: 'Profile' });
            }
          } else {
            // Navigate directly (same stack - ProfileStackNavigator)
            navigation.navigate("MemberPublicProfile", {
              memberId: item.id,
            });
          }
        }}
      >
        <Image source={{ uri: item.profile_photo_url || 'https://via.placeholder.com/64' }} style={styles.avatar} />
        <View style={styles.meta}>
          <Text style={styles.name} numberOfLines={1}>{item.full_name || 'Member'}</Text>
          <Text style={styles.username} numberOfLines={1}>@{item.username}</Text>
        </View>
      </TouchableOpacity>
      {item.id !== myId && (
        <TouchableOpacity style={[styles.followBtn, item.is_following ? styles.followingBtn : styles.followBtnPrimary]} onPress={() => toggleFollow(item.id, !!item.is_following)}>
          <Text style={[styles.followText, item.is_following ? styles.followingText : styles.followTextPrimary]}>
            {item.is_following ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1D1D1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#6A0DAD" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          onEndReachedThreshold={0.6}
          onEndReached={() => load(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 8 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#1D1D1F' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F2F2F7' },
  meta: { flex: 1 },
  name: { fontSize: 16, color: '#1D1D1F', fontWeight: '600' },
  username: { fontSize: 14, color: '#8E8E93', marginTop: 2 },
  followBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E5E5EA' },
  followBtnPrimary: { backgroundColor: '#6A0DAD', borderColor: '#6A0DAD' },
  followingBtn: { backgroundColor: '#FFFFFF', borderColor: '#E5E5EA' },
  followText: { fontSize: 12, fontWeight: '600' },
  followTextPrimary: { color: '#FFFFFF' },
  followingText: { color: '#1D1D1F' },
});


