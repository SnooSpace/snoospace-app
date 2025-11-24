import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../../context/NotificationsContext';
import { followMember, unfollowMember } from '../../api/members';

export default function NotificationsScreen({ navigation }) {
  const { items, unread, loading, loadMore, markAllRead } = useNotifications();

  useEffect(() => {
    const t = setTimeout(() => { markAllRead(); }, 500);
    return () => clearTimeout(t);
  }, [markAllRead]);

  const navigateToProfile = (actorId, actorType) => {
    if (actorType === 'member') {
      navigation.navigate('MemberPublicProfile', { memberId: actorId });
    } else if (actorType === 'community') {
      navigation.navigate('CommunityPublicProfile', { communityId: actorId });
    } else if (actorType === 'sponsor') {
      // Navigate to sponsor profile if you have one
      navigation.navigate('SponsorProfile', { sponsorId: actorId });
    } else if (actorType === 'venue') {
      // Navigate to venue profile if you have one
      navigation.navigate('VenueProfile', { venueId: actorId });
    }
  };

  const renderItem = ({ item }) => {
    const payload = item.payload || {};
    
    if (item.type === 'follow') {
      return (
        <TouchableOpacity style={styles.row} onPress={() => navigateToProfile(item.actor_id, item.actor_type)}>
          <Image source={ payload.actorAvatar ? { uri: payload.actorAvatar } : require('../../assets/icon.png') } style={styles.avatar} />
          <View style={styles.rowBody}>
            <Text style={styles.title}><Text style={styles.bold}>{payload.actorName || 'Someone'}</Text> started following you</Text>
            <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
          </View>
        </TouchableOpacity>
      );
    }
    
    if (item.type === 'like') {
      return (
        <TouchableOpacity style={styles.row} onPress={() => navigateToProfile(item.actor_id, item.actor_type)}>
          <Image source={ payload.actorAvatar ? { uri: payload.actorAvatar } : require('../../assets/icon.png') } style={styles.avatar} />
          <View style={styles.rowBody}>
            <Text style={styles.title}><Text style={styles.bold}>{payload.actorName || 'Someone'}</Text> liked your post</Text>
            <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
          </View>
          <Ionicons name="heart" size={20} color="#FF3B30" style={styles.icon} />
        </TouchableOpacity>
      );
    }
    
    if (item.type === 'comment') {
      const commentPreview = payload.commentText || 'commented on your post';
      return (
        <TouchableOpacity style={styles.row} onPress={() => navigateToProfile(item.actor_id, item.actor_type)}>
          <Image source={ payload.actorAvatar ? { uri: payload.actorAvatar } : require('../../assets/icon.png') } style={styles.avatar} />
          <View style={styles.rowBody}>
            <Text style={styles.title}>
              <Text style={styles.bold}>{payload.actorName || 'Someone'}</Text> commented: {commentPreview}
            </Text>
            <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
          </View>
          <Ionicons name="chatbubble" size={18} color="#007AFF" style={styles.icon} />
        </TouchableOpacity>
      );
    }
    
    if (item.type === 'tag') {
      return (
        <TouchableOpacity style={styles.row} onPress={() => navigateToProfile(item.actor_id, item.actor_type)}>
          <Image source={ payload.actorAvatar ? { uri: payload.actorAvatar } : require('../../assets/icon.png') } style={styles.avatar} />
          <View style={styles.rowBody}>
            <Text style={styles.title}><Text style={styles.bold}>{payload.actorName || 'Someone'}</Text> tagged you in a {payload.commentId ? 'comment' : 'post'}</Text>
            <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
          </View>
          <Ionicons name="at" size={18} color="#34C759" style={styles.icon} />
        </TouchableOpacity>
      );
    }
    
    return null;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1D1D1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(it) => String(it.id)}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No notifications</Text> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#1D1D1F',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  rowBody: { flex: 1 },
  title: { color: '#1D1D1F' },
  bold: { fontWeight: '600' },
  time: { color: '#8E8E93', fontSize: 12, marginTop: 4 },
  icon: { marginLeft: 8 },
  empty: { textAlign: 'center', marginTop: 40, color: '#8E8E93' },
});


