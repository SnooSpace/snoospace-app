import React, { useCallback } from "react";
import {
  getMemberFollowers,
  followMember,
  unfollowMember,
  getFollowStatusForMember,
} from "../../api/members";
import {
  getCommunityFollowers,
  followCommunity,
  unfollowCommunity,
  getFollowStatusForCommunity,
} from "../../api/communities";
import FollowerList from "../../components/FollowerList";
import { ensureFollowStatus } from "../../utils/followerListUtils";
import EventBus from "../../utils/EventBus";

// Color mapping by user type
const COLORS = {
  member: "#6A0DAD",
  community: "#5f27cd",
  sponsor: "#5f27cd",
  venue: "#5f27cd",
};

// API function mapping
const API_MAP = {
  member: getMemberFollowers,
  community: getCommunityFollowers,
};

const FOLLOW_API_MAP = {
  member: { follow: followMember, unfollow: unfollowMember },
  community: { follow: followCommunity, unfollow: unfollowCommunity },
};

const STATUS_API_MAP = {
  member: getFollowStatusForMember,
  community: getFollowStatusForCommunity,
};

export default function UniversalFollowersScreen({ route, navigation }) {
  const userId =
    route?.params?.userId ||
    route?.params?.memberId ||
    route?.params?.communityId;
  const userType = route?.params?.userType || "member";
  const title = route?.params?.title || "Followers";

  const fetchFollowersPage = useCallback(
    async ({ offset, limit }) => {
      const fetchFn = API_MAP[userType];
      if (!fetchFn) {
        console.error(`No API function for userType: ${userType}`);
        return { items: [], hasMore: false };
      }

      const data = await fetchFn(userId, { limit, offset });
      const raw = data?.results || data?.followers || data?.items || data || [];
      const baseList = raw.map((entry) => ({
        id: entry.follower_id || entry.id,
        name: entry.follower_name || entry.full_name || entry.name,
        username: entry.follower_username || entry.username,
        avatarUrl: entry.follower_photo_url || entry.profile_photo_url,
        type: entry.follower_type || "member",
        isFollowing:
          typeof entry.is_following === "boolean"
            ? entry.is_following
            : entry.you_follow_them,
      }));

      // Check follow status based on entity type
      const normalizedList = await ensureFollowStatus(
        baseList,
        async (targetId, item) => {
          const entityType = item?.type || "member";
          const statusFn = STATUS_API_MAP[entityType];
          if (!statusFn) return false;
          const status = await statusFn(targetId);
          return !!status?.isFollowing;
        },
      );

      // Filter out duplicates based on ID
      const seen = new Set();
      const unique = normalizedList.filter((item) => {
        const id = String(item.id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      return {
        items: unique,
        hasMore: normalizedList.length >= (limit || 30),
      };
    },
    [userId, userType],
  );

  const resolveMyId = useCallback(async () => {
    const { getActiveAccount } = await import("../../api/auth");
    const activeAccount = await getActiveAccount();
    if (activeAccount) {
      return {
        id: activeAccount.id,
        type: activeAccount.type || "member",
      };
    }
    return null;
  }, []);

  const handleToggleFollow = useCallback(
    async (id, isFollowing, entityType = "member") => {
      const apis = FOLLOW_API_MAP[entityType];
      if (!apis) {
        console.error(`No follow API for entityType: ${entityType}`);
        return;
      }

      if (isFollowing) {
        await apis.unfollow(id);
        // Emit event to update follow status in the list
        EventBus.emit("follow-updated", { id, isFollowing: false });
      } else {
        await apis.follow(id);
        // Emit event to update follow status in the list
        EventBus.emit("follow-updated", { id, isFollowing: true });
      }
    },
    [],
  );

  const handleItemPress = useCallback(
    (item, myId) => {
      const entityType = (item.type || "member").toLowerCase();

      // Check if it's the current user's own profile
      const currentId =
        typeof myId === "object" ? String(myId?.id) : String(myId);
      const currentType =
        (typeof myId === "object" ? myId?.type : "member")?.toLowerCase() ||
        "member";
      const itemId = String(item.id);

      if (itemId === currentId && entityType === currentType) {
        const root = navigation.getParent()?.getParent();
        if (entityType === "community") {
          if (root) {
            root.navigate("Profile");
          }
        } else {
          if (root) {
            root.navigate("MemberHome", { screen: "Profile" });
          }
        }
        return;
      }

      // Navigate based on entity type
      if (entityType === "community") {
        navigation.navigate("CommunityPublicProfile", { communityId: item.id });
      } else {
        navigation.navigate("MemberPublicProfile", { memberId: item.id });
      }
    },
    [navigation],
  );

  const primaryColor = COLORS[userType] || COLORS.member;

  return (
    <FollowerList
      title={title}
      navigation={navigation}
      fetchPage={fetchFollowersPage}
      resolveMyId={resolveMyId}
      onToggleFollow={handleToggleFollow}
      onItemPress={handleItemPress}
      emptyMessage="If someone follows you, you'll be able to see them here"
      primaryColor={primaryColor}
    />
  );
}
