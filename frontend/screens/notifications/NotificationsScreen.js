import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
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
        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('MemberPublicProfile', { memberId: item.actor_id })}>
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
    <View style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(it) => String(it.id)}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No notifications</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  rowBody: { flex: 1 },
  title: { color: '#1D1D1F' },
  bold: { fontWeight: '600' },
  time: { color: '#8E8E93', fontSize: 12, marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 40, color: '#8E8E93' },
});


