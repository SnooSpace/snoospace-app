import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  getMemberFollowers,
  followMember,
  unfollowMember,
  getFollowStatusForMember,
  getCircleMembers,
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
  member: "#2962FF", // Updated to Blue
  community: "#2962FF",
  sponsor: "#5f27cd",
  venue: "#5f27cd",
  // member: "#6A0DAD", // Old Purple
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

  // Viewer info — used to suppress Follow button when community views member followers
  const [viewerType, setViewerType] = useState(null);

  // Circle ID set — pre-seeded when viewer is a member so we can mark 'In Circle' items
  const circleIdSetRef = useRef(new Set());

  useEffect(() => {
    (async () => {
      try {
        const { getActiveAccount } = await import("../../api/auth");
        const acc = await getActiveAccount();
        if (acc?.type) {
          setViewerType(acc.type);
          // Pre-load circle IDs so the follower list can show 'In Circle' instead of 'Follow'
          if (acc.type === 'member') {
            try {
              const circleRes = await getCircleMembers({ page: 1, limit: 200 });
              const members = circleRes?.members || circleRes?.circle || [];
              const ids = new Set(members.map((m) => String(m.id || m.member_id)));
              circleIdSetRef.current = ids;
            } catch (_) {}
          }
        }
      } catch (_) {}
    })();
  }, []);

  const fetchFollowersPage = useCallback(
    async ({ offset, limit, search }) => {
      const fetchFn = API_MAP[userType];
      if (!fetchFn) {
        console.error(`No API function for userType: ${userType}`);
        return { items: [], hasMore: false };
      }

      const data = await fetchFn(userId, { limit, offset, search });
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

      // Filter out duplicates and mark items already in viewer's circle
      const seen = new Set();
      const unique = normalizedList
        .filter((item) => {
          const id = String(item.id);
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .map((item) => ({
          ...item,
          // Mark members already in the viewer's circle to show 'In Circle' badge
          inCircle: item.type === 'member' && circleIdSetRef.current.has(String(item.id)),
        }));

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
    (item) => {
      const entityType = (item.type || "member").toLowerCase();
      // Always navigate to the public profile screen — it handles own-profile correctly
      // via circleStatus='self'. Avoid getParent().getParent() which breaks from deep contexts.
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
      viewerType={viewerType}
      emptyMessage="If someone follows you, you'll be able to see them here"
      primaryColor={primaryColor}
    />
  );
}
