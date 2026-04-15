import React, { useCallback } from "react";
import {
  getMemberFollowing,
  followMember,
  unfollowMember,
} from "../../api/members";
import {
  getCommunityFollowing,
  followCommunity,
  unfollowCommunity,
} from "../../api/communities";
import FollowerList from "../../components/FollowerList";
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
  member: getMemberFollowing,
  community: getCommunityFollowing,
};

const FOLLOW_API_MAP = {
  member: { follow: followMember, unfollow: unfollowMember },
  community: { follow: followCommunity, unfollow: unfollowCommunity },
};

export default function UniversalFollowingScreen({ route, navigation }) {
  const userId =
    route?.params?.userId ||
    route?.params?.memberId ||
    route?.params?.communityId;
  const userType = route?.params?.userType || "member";
  const title = route?.params?.title || "Following";

  const fetchFollowingPage = useCallback(
    async ({ offset, limit }) => {
      const fetchFn = API_MAP[userType];
      if (!fetchFn) {
        console.error(`No API function for userType: ${userType}`);
        return { items: [], hasMore: false };
      }

      const data = await fetchFn(userId, { limit, offset });
      const raw = data?.results || data?.following || data?.items || data || [];
      console.log("[UniversalFollowing] Raw data count:", raw.length);

      const normalized = raw.map((entry) => {
        // Robust check for is_following/you_follow_them handling booleans, numbers (0/1), etc.
        let isFollowing = true;

        // Check standard flag
        if (entry.is_following !== undefined && entry.is_following !== null) {
          isFollowing = !!entry.is_following;
        }
        // Check member-specific flag if standard flag is missing/ambiguous
        else if (
          entry.you_follow_them !== undefined &&
          entry.you_follow_them !== null
        ) {
          isFollowing = !!entry.you_follow_them;
        }

        return {
          id: entry.following_id || entry.id,
          name: entry.following_name || entry.full_name || entry.name,
          username: entry.following_username || entry.username,
          avatarUrl: entry.following_photo_url || entry.profile_photo_url,
          type: entry.following_type || "member",
          isFollowing,
        };
      });

      // Filter out duplicates AND items that are not followed
      const seen = new Set();
      const unique = normalized.filter((item) => {
        // If the API returns someone we don't follow, filter them out
        if (!item.isFollowing) return false;

        const id = String(item.id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      console.log(`[UniversalFollowing] Final list count: ${unique.length}`);
      return {
        items: unique,
        hasMore: normalized.length >= (limit || 30),
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
        // Emit event to trigger list refresh (remove from following list)
        EventBus.emit("follow-updated", { id, isFollowing: false });
      } else {
        await apis.follow(id);
        // Emit event to update follow status
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
      fetchPage={fetchFollowingPage}
      resolveMyId={resolveMyId}
      onToggleFollow={handleToggleFollow}
      onItemPress={handleItemPress}
      emptyMessage="You're not following anyone yet"
      removeOnUnfollow={true} // For following list, remove items when unfollowed
      primaryColor={primaryColor}
    />
  );
}
