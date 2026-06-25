import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  getMemberFollowing,
  followMember,
  unfollowMember,
  getCircleMembers,
  sendCircleRequest,
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

  // Viewer info — used to suppress Follow button when community views member following entries
  const [viewerType, setViewerType] = useState(null);

  // Circle ID set — pre-seeded when viewer is a member so we can mark 'In Circle' items
  const circleIdSetRef = useRef(new Set());
  // Promise that resolves once circle IDs are loaded (or immediately if not needed)
  const circleReadyRef = useRef(Promise.resolve());

  useEffect(() => {
    let resolve;
    const readyPromise = new Promise((res) => { resolve = res; });
    circleReadyRef.current = readyPromise;

    (async () => {
      try {
        const { getActiveAccount } = await import("../../api/auth");
        const acc = await getActiveAccount();
        if (acc?.type) {
          setViewerType(acc.type);
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
      resolve();
    })();
  }, []);

  const fetchFollowingPage = useCallback(
    async ({ offset, limit, search }) => {
      const fetchFn = API_MAP[userType];
      if (!fetchFn) {
        console.error(`No API function for userType: ${userType}`);
        return { items: [], hasMore: false };
      }

      // Run items fetch and circle-ready gate concurrently
      const [data] = await Promise.all([
        fetchFn(userId, { limit, offset, search }),
        circleReadyRef.current,
      ]);
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

      // Filter out duplicates AND items that are not followed, then mark inCircle
      const seen = new Set();
      const unique = normalized
        .filter((item) => {
          if (!item.isFollowing) return false;
          const id = String(item.id);
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .map((item) => ({
          ...item,
          inCircle: item.type === 'member' && circleIdSetRef.current.has(String(item.id)),
        }));

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

  const handleCircleRequest = useCallback(async (memberId) => {
    const res = await sendCircleRequest(memberId);
    if (res?.auto_accepted) {
      circleIdSetRef.current = new Set([...circleIdSetRef.current, String(memberId)]);
    }
  }, []);

  const handleItemPress = useCallback(
    (item) => {
      const entityType = (item.type || "member").toLowerCase();
      // Always navigate to public profile — it handles own-profile correctly.
      if (entityType === "community") {
        navigation.push("CommunityPublicProfile", { communityId: item.id });
      } else {
        navigation.push("MemberPublicProfile", { memberId: item.id });
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
      viewerType={viewerType}
      onCircleRequest={viewerType === 'member' ? handleCircleRequest : null}
      emptyMessage="You're not following anyone yet"
      removeOnUnfollow={true}
      primaryColor={primaryColor}
    />
  );
}
