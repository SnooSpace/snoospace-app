import React, { useCallback } from 'react';
import { getMemberFollowing, followMember, unfollowMember } from '../../../api/members';
import { getAuthToken } from '../../../api/auth';
import { apiGet } from '../../../api/client';
import FollowerList from '../../../components/FollowerList';

const PRIMARY_COLOR = '#6A0DAD';

export default function FollowingListScreen({ route, navigation }) {
  const memberId = route?.params?.memberId;
  const title = route?.params?.title || 'Following';

  const fetchFollowingPage = useCallback(
    async ({ offset, limit }) => {
      const data = await getMemberFollowing(memberId, { limit, offset });
      const raw = data?.results || data?.following || data?.items || data || [];
      const normalized = raw.map((entry) => ({
        id: entry.following_id || entry.id,
        name: entry.following_name || entry.full_name || entry.name,
        username: entry.following_username || entry.username,
        avatarUrl: entry.following_photo_url || entry.profile_photo_url,
        isFollowing: true,
      }));
      return {
        items: normalized,
        hasMore: normalized.length >= (limit || 30),
      };
    },
    [memberId]
  );

  const resolveMyId = useCallback(async () => {
    const token = await getAuthToken();
    const me = await apiGet('/me', 8000, token);
    return me?.member?.id || null;
  }, []);

  const handleToggleFollow = useCallback(async (id, isFollowing) => {
    if (isFollowing) {
      await unfollowMember(id);
    } else {
      await followMember(id);
    }
  }, []);

  const handleItemPress = useCallback(
    (item, myId) => {
      if (item.id === myId) {
        const root = navigation.getParent()?.getParent();
        if (root) {
          root.navigate('MemberHome', { tab: 'Profile' });
        }
        return;
      }
      navigation.navigate('MemberPublicProfile', { memberId: item.id });
    },
    [navigation]
  );

  return (
    <FollowerList
      title={title}
      navigation={navigation}
      fetchPage={fetchFollowingPage}
      resolveMyId={resolveMyId}
      onToggleFollow={handleToggleFollow}
      onItemPress={handleItemPress}
      emptyMessage="You're not following anyone yet"
      primaryColor={PRIMARY_COLOR}
    />
  );
}
