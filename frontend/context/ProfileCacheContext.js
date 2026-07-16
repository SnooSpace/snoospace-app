import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getActiveAccount, getAuthToken } from "../api/auth";
import { apiGet, apiPost } from "../api/client";
import { getCommunityProfile } from "../api/communities";
import { useAuthState } from "../contexts/AuthStateContext";

const ProfileCacheContext = createContext(null);

export function ProfileCacheProvider({ children }) {
  const [memberProfile, setMemberProfile] = useState(null);
  const [memberPosts, setMemberPosts] = useState([]);
  const [communityProfile, setCommunityProfile] = useState(null);
  const [communityPosts, setCommunityPosts] = useState([]);
  const [loading, setLoading] = useState(false);

  const { activeAccountEmail } = useAuthState();

  const preloadProfile = useCallback(async () => {
    try {
      const activeAccount = await getActiveAccount();
      const token = await getAuthToken();
      if (!activeAccount || !token || !activeAccount.email) {
        console.log("[ProfileCache] No active account or token found for preload");
        return;
      }

      setLoading(true);
      const email = activeAccount.email;
      const type = activeAccount.type || "member";

      console.log(`[ProfileCache] Pre-fetching profile for ${email} (type: ${type})`);

      if (type === "member") {
        const userProfileResponse = await apiPost(
          "/auth/get-user-profile",
          { email },
          15000,
          token
        );
        const fullProfile = userProfileResponse?.profile;
        const userRole = userProfileResponse?.role;

        if (fullProfile && userRole === "member") {
          const userId = fullProfile.id;
          const userType = "member";

          const [countsResponse, postsResponse, eventsResponse] = await Promise.all([
            apiGet(`/profile/counts/${userId}/${userType}`, 15000, token).catch(() => ({})),
            apiGet(`/posts/user/${userId}/${userType}?limit=20`, 15000, token).catch(() => ({})),
            apiGet("/events/my-events", 15000, token).catch(() => ({ events: [], total_events: 0 }))
          ]);

          const followerCount =
            typeof countsResponse?.followers_count === "number"
              ? countsResponse.followers_count
              : parseInt(countsResponse?.followers_count || 0, 10);
          const followingCount =
            typeof countsResponse?.following_count === "number"
              ? countsResponse.following_count
              : parseInt(countsResponse?.following_count || 0, 10);
          const circleCount = parseInt(countsResponse?.circle_count || 0, 10);
          const creatorFollowerCount = parseInt(countsResponse?.creator_follower_count || 0, 10);

          const userPosts = Array.isArray(postsResponse?.posts) ? postsResponse.posts : [];

          const mappedProfile = {
            id: userId,
            name: fullProfile.name || "",
            username: fullProfile.username || "",
            email: fullProfile.email || "",
            phone: fullProfile.phone || "",
            bio: fullProfile.bio || "",
            profile_photo_url: fullProfile.profile_photo_url || "",
            interests: Array.isArray(fullProfile.interests)
              ? fullProfile.interests
              : fullProfile.interests
                ? JSON.parse(fullProfile.interests)
                : [],
            pronouns: Array.isArray(fullProfile.pronouns)
              ? fullProfile.pronouns
              : fullProfile.pronouns
                ? [fullProfile.pronouns]
                : null,
            location:
              typeof fullProfile.location === "string"
                ? JSON.parse(fullProfile.location)
                : fullProfile.location || null,
            city: fullProfile.city || "",
            education: fullProfile.education || "",
            occupation: fullProfile.occupation || null,
            occupation_details: fullProfile.occupation_details || null,
            occupation_category: fullProfile.occupation_category || null,
            portfolio_link: fullProfile.portfolio_link || "",
            campus_id: fullProfile.campus_id || null,
            show_college: fullProfile.show_college !== false,
            college_info: fullProfile.college_info || null,
            instagram_username: fullProfile.instagram_username || null,
            circle_count: circleCount,
            following_count: followingCount,
            follower_count: followerCount,
            post_count: countsResponse?.post_count || 0,
            events_attended_count:
              eventsResponse?.total_events ?? eventsResponse?.events?.length ?? 0,
            is_creator_mode_enabled: fullProfile.is_creator_mode_enabled === true,
            creator_mode_enabled_at: fullProfile.creator_mode_enabled_at || null,
            creator_follower_count: creatorFollowerCount,
          };

          setMemberProfile(mappedProfile);
          setMemberPosts(userPosts);
          console.log("[ProfileCache] Member profile preloaded in background");
        }
      } else if (type === "community") {
        let fullProfile = null;
        try {
          const profileRes = await getCommunityProfile();
          fullProfile = profileRes?.profile || null;
        } catch (e) {
          const profRes = await apiPost(
            "/auth/get-user-profile",
            { email },
            15000,
            token
          ).catch(() => null);
          fullProfile = profRes?.profile || null;
        }

        if (fullProfile) {
          const userId = fullProfile.id;
          const userType = "community";

          let followerCount = 0;
          let followingCount = 0;
          let circleCount = 0;
          try {
            const counts = await apiGet(`/profile/counts/${userId}/${userType}`, 15000, token);
            const followersRaw = counts?.followers_count ?? counts?.followers;
            const followingRaw = counts?.following_count ?? counts?.following;
            followerCount = typeof followersRaw === "number" ? followersRaw : parseInt(followersRaw || "0", 10) || 0;
            followingCount = typeof followingRaw === "number" ? followingRaw : parseInt(followingRaw || "0", 10) || 0;
            circleCount = parseInt(counts?.circle_count || 0, 10);
          } catch {}

          let userPosts = [];
          try {
            const postsRes = await apiGet(`/posts/user/${userId}/${userType}`, 15000, token);
            userPosts = Array.isArray(postsRes?.posts) ? postsRes.posts : [];
          } catch {}

          try {
            const oppsRes = await apiGet("/opportunities", 15000, token);
            const rawOpps = Array.isArray(oppsRes?.opportunities) ? oppsRes.opportunities : [];
            const normalizedOpps = rawOpps
              .filter((o) => o.status === "active" || o.status === "draft")
              .map((o) => ({
                ...o,
                post_type: "opportunity",
                creator_id: o.creator_id || userId,
                creator_type: o.creator_type || userType,
                creator_name: o.creator_name || fullProfile?.name || "Community",
                creator_photo: o.creator_photo || fullProfile?.logo_url || fullProfile?.profile_photo_url || null,
                creator_username: o.creator_username || fullProfile?.username || "",
                is_liked: o.is_liked === true,
                is_saved: o.is_saved === true,
                like_count: o.like_count || 0,
                comment_count: o.comment_count || 0,
                view_count: o.view_count || 0,
                is_pinned: o.is_pinned || false,
              }));
            userPosts = [...userPosts, ...normalizedOpps];
          } catch {}

          const normalizedCategories = (() => {
            if (Array.isArray(fullProfile?.categories)) return fullProfile.categories;
            if (fullProfile?.categories && typeof fullProfile.categories === "string") {
              try {
                const parsed = JSON.parse(fullProfile.categories);
                if (Array.isArray(parsed)) return parsed;
              } catch {}
            }
            return fullProfile?.category ? [fullProfile.category] : [];
          })();

          const primaryPhone = fullProfile?.phone ?? fullProfile?.primary_phone ?? "";
          const secondaryPhone = fullProfile?.secondary_phone ?? "";

          const mappedProfile = {
            id: userId,
            name: fullProfile?.name || "Community",
            username: fullProfile?.username || "",
            bio: fullProfile?.bio || "",
            email: fullProfile?.email || "",
            phone: String(primaryPhone || ""),
            secondary_phone: String(secondaryPhone || ""),
            categories: normalizedCategories,
            location: fullProfile?.location || "",
            logo_url: fullProfile?.logo_url || "",
            banner_url: fullProfile?.banner_url || null,
            sponsor_types: fullProfile?.sponsor_types || [],
            heads: fullProfile?.heads || [],
            show_heads: fullProfile?.show_heads !== false,
            follower_count: followerCount,
            following_count: followingCount,
            circle_count: circleCount,
            post_count: userPosts.length,
            events_scheduled_count: fullProfile?.events_scheduled_count || 0,
            events_hosted_count: fullProfile?.events_hosted_count || 0,
            college_info: fullProfile?.college_info || null,
          };
          mappedProfile.category = mappedProfile.categories[0] || "";

          setCommunityProfile(mappedProfile);
          setCommunityPosts(userPosts);
          console.log("[ProfileCache] Community profile preloaded in background");
        }
      }
    } catch (err) {
      console.error("[ProfileCache] Error pre-loading profile:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Pre-load on mount / active account change
  useEffect(() => {
    // Clear caches immediately upon account switch so we don't display stale/wrong data
    setMemberProfile(null);
    setMemberPosts([]);
    setCommunityProfile(null);
    setCommunityPosts([]);

    preloadProfile();
  }, [preloadProfile, activeAccountEmail]);

  const value = {
    memberProfile,
    memberPosts,
    setMemberProfile,
    setMemberPosts,
    communityProfile,
    communityPosts,
    setCommunityProfile,
    setCommunityPosts,
    loading,
    refreshProfile: preloadProfile,
  };

  return (
    <ProfileCacheContext.Provider value={value}>
      {children}
    </ProfileCacheContext.Provider>
  );
}

export function useProfileCache() {
  const context = useContext(ProfileCacheContext);
  if (!context) {
    return {
      memberProfile: null,
      memberPosts: [],
      setMemberProfile: () => {},
      setMemberPosts: () => {},
      communityProfile: null,
      communityPosts: [],
      setCommunityProfile: () => {},
      setCommunityPosts: () => {},
      loading: false,
      refreshProfile: () => Promise.resolve(),
    };
  }
  return context;
}
