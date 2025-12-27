import React, { useCallback } from "react";
import {
  getMemberFollowing,
  followMember,
  unfollowMember,
} from "../../../api/members";
import { getAuthToken } from "../../../api/auth";
import { apiGet } from "../../../api/client";
import FollowerList from "../../../components/FollowerList";

const PRIMARY_COLOR = "#6A0DAD";

export default function FollowingListScreen({ route, navigation }) {
  const memberId = route?.params?.memberId;
  const title = route?.params?.title || "Following";

  const fetchFollowingPage = useCallback(
    async ({ offset, limit }) => {
      const data = await getMemberFollowing(memberId, { limit, offset });
      const raw = data?.results || data?.following || data?.items || data || [];
      const normalized = raw.map((entry) => ({
        id: entry.following_id || entry.id,
        name: entry.following_name || entry.full_name || entry.name,
        username: entry.following_username || entry.username,
        avatarUrl: entry.following_photo_url || entry.profile_photo_url,
        type: entry.following_type || "member", // Add type field
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
    const { getActiveAccount } = await import("../../../api/auth");
    const activeAccount = await getActiveAccount();
    if (activeAccount) {
      return {
        id: activeAccount.id,
        type: activeAccount.type || "member",
      };
    }
    return null;
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
      const entityType = (item.type || "member").toLowerCase();

      // Check if it's the current user's own profile (works for both members and communities)
      // Use String() and toLowerCase() to ensure reliable comparison regardless of type
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
