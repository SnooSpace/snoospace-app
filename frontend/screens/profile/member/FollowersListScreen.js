import React, { useCallback } from 'react';
import { getMemberFollowers, followMember, unfollowMember, getFollowStatusForMember } from '../../../api/members';
import { followCommunity, unfollowCommunity, getFollowStatusForCommunity } from '../../../api/communities';
import { getAuthToken } from '../../../api/auth';
import { apiGet } from '../../../api/client';
import FollowerList from '../../../components/FollowerList';
import { ensureFollowStatus } from '../../../utils/followerListUtils';

const PRIMARY_COLOR = '#6A0DAD';

export default function FollowersListScreen({ route, navigation }) {
  const memberId = route?.params?.memberId;
  const title = route?.params?.title || 'Followers';

  const fetchFollowersPage = useCallback(
    async ({ offset, limit }) => {
      const data = await getMemberFollowers(memberId, { limit, offset });
      const raw = data?.results || data?.followers || data?.items || data || [];
      const baseList = raw.map((entry) => ({
        id: entry.follower_id || entry.id,
        name: entry.follower_name || entry.full_name || entry.name,
        username: entry.follower_username || entry.username,
        avatarUrl: entry.follower_photo_url || entry.profile_photo_url,
        type: entry.follower_type || 'member', // Extract follower type
        isFollowing:
          typeof entry.is_following === 'boolean'
            ? entry.is_following
            : entry.you_follow_them,
      }));
      // Check follow status based on entity type
      const normalized = await ensureFollowStatus(baseList, async (targetId, item) => {
        const entityType = item?.type || 'member';
        if (entityType === 'community') {
          const status = await getFollowStatusForCommunity(targetId);
          return !!status?.isFollowing;
        }
        const status = await getFollowStatusForMember(targetId);
        return !!status?.isFollowing;
      });
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

  // Handle follow/unfollow based on entity type
  const handleToggleFollow = useCallback(async (id, isFollowing, entityType = 'member') => {
    if (entityType === 'community') {
      if (isFollowing) {
        await unfollowCommunity(id);
      } else {
        await followCommunity(id);
      }
    } else {
      if (isFollowing) {
        await unfollowMember(id);
      } else {
        await followMember(id);
      }
    }
  }, []);

  const handleItemPress = useCallback(
    (item, myId) => {
      const entityType = item.type || 'member';
      
      // Check if it's the current user's own profile (only for members)
      if (entityType === 'member' && item.id === myId) {
        const root = navigation.getParent()?.getParent();
        if (root) {
          root.navigate('MemberHome', { tab: 'Profile' });
        }
        return;
      }
      
      // Navigate based on entity type
      if (entityType === 'community') {
        navigation.navigate('CommunityPublicProfile', { communityId: item.id });
      } else {
        navigation.navigate('MemberPublicProfile', { memberId: item.id });
      }
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
      emptyMessage="If someone follows you, you'll be able to see them here"
      primaryColor={PRIMARY_COLOR}
    />
  );
}
