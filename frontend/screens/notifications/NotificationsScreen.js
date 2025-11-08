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

  const renderItem = ({ item }) => {
    if (item.type === 'follow') {
      const payload = item.payload || {};
      return (
        <TouchableOpacity style={styles.row} onPress={() => {
          // Navigate to Profile tab's stack, then to MemberPublicProfile
          const root = navigation.getParent()?.getParent();
          if (root) {
            root.navigate('Profile', {
              screen: 'MemberPublicProfile',
              params: { memberId: item.actor_id }
            });
          }
        }}>
          <Image source={ payload.actorAvatar ? { uri: payload.actorAvatar } : require('../../assets/icon.png') } style={styles.avatar} />
          <View style={styles.rowBody}>
            <Text style={styles.title}><Text style={styles.bold}>{payload.actorName || 'Someone'}</Text> started following you</Text>
            <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
          </View>
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
  empty: { textAlign: 'center', marginTop: 40, color: '#8E8E93' },
});


