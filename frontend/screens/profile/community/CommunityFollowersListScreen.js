import React, { useCallback } from 'react';
import { getCommunityFollowers } from '../../../api/communities';
import { followMember, unfollowMember, getFollowStatusForMember } from '../../../api/members';
import { getAuthToken } from '../../../api/auth';
import { apiGet } from '../../../api/client';
import FollowerList from '../../../components/FollowerList';
import { ensureFollowStatus } from '../../../utils/followerListUtils';

const PRIMARY_COLOR = '#5f27cd';

export default function CommunityFollowersListScreen({ route, navigation }) {
  const communityId = route?.params?.communityId;
  const title = route?.params?.title || 'Followers';

  const fetchFollowersPage = useCallback(
    async ({ offset, limit }) => {
      const data = await getCommunityFollowers(communityId, { limit, offset });
      const raw = data?.results || data?.followers || data?.items || data || [];
      const baseList = raw.map((entry) => ({
        id: entry.follower_id || entry.id,
        name: entry.follower_name || entry.full_name || entry.name,
        username: entry.follower_username || entry.username,
        avatarUrl: entry.follower_photo_url || entry.profile_photo_url,
        isFollowing:
          typeof entry.is_following === 'boolean'
            ? entry.is_following
            : entry.you_follow_them,
      }));
      const normalized = await ensureFollowStatus(baseList, async (targetId) => {
        const status = await getFollowStatusForMember(targetId);
        return !!status?.isFollowing;
      });
      return {
        items: normalized,
        hasMore: normalized.length >= (limit || 30),
      };
    },
    [communityId]
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
    (item) => {
      navigation.navigate('MemberPublicProfile', { memberId: item.id });
    },
    [navigation]
  );

  return (
    <FollowerList
      title={title}
      navigation={navigation}
      fetchPage={fetchFollowersPage}
      resolveMyId={resolveMyId}
      onToggleFollow={handleToggleFollow}
      onItemPress={handleItemPress}
      emptyMessage={`No ${title.toLowerCase()} yet`}
      primaryColor={PRIMARY_COLOR}
      placeholderImage="https://via.placeholder.com/50"
    />
  );
}