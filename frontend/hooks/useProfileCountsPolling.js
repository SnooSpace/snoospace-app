import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { apiGet } from '../api/client';
import { getAuthToken } from '../api/auth';
import EventBus from '../utils/EventBus';

/**
 * Hook for profile counts (followers, following, posts, circles).
 * Dynamically keeps counts in sync using EventBus (no polling needed).
 * Performs a single check when the app returns from background.
 */
export function useProfileCountsPolling(options = {}) {
  const {
    userId,
    userType = 'member',
    enabled = true,
    paused = false, // For pausing foreground fetch when modal is open
    initialCounts, // Option to seed counts before first API poll finishes
  } = options;
  
  const appStateRef = useRef(AppState.currentState);

  const initialValues = initialCounts ? {
    followers: initialCounts.follower_count || initialCounts.followers || 0,
    following: initialCounts.following_count || initialCounts.following || 0,
    posts: initialCounts.post_count || initialCounts.posts || 0,
    circles: initialCounts.circle_count || initialCounts.circles || 0,
    creatorFollowers: initialCounts.creator_follower_count || initialCounts.creatorFollowers || 0,
  } : { followers: 0, following: 0, posts: 0, circles: 0, creatorFollowers: 0 };

  const countsRef = useRef(initialValues);
  const [counts, setCounts] = useState(initialValues);
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch counts from API
  const fetchCounts = useCallback(async () => {
    if (!userId || !userType) {
      return null;
    }

    if (appStateRef.current !== 'active') {
      return null;
    }

    if (paused) {
      return null;
    }

    setIsPolling(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setIsPolling(false);
        return null;
      }

      const countsResponse = await apiGet(
        `/profile/counts/${userId}/${userType}`,
        10000,
        token
      );

      const newCounts = {
        followers: typeof countsResponse?.followers_count === 'number'
          ? countsResponse.followers_count
          : parseInt(countsResponse?.followers_count || 0, 10),
        following: typeof countsResponse?.following_count === 'number'
          ? countsResponse.following_count
          : parseInt(countsResponse?.following_count || 0, 10),
        posts: typeof countsResponse?.post_count === 'number'
          ? countsResponse.post_count
          : parseInt(countsResponse?.post_count || 0, 10),
        circles: typeof countsResponse?.circle_count === 'number'
          ? countsResponse.circle_count
          : parseInt(countsResponse?.circle_count || 0, 10),
        creatorFollowers: typeof countsResponse?.creator_follower_count === 'number'
          ? countsResponse.creator_follower_count
          : parseInt(countsResponse?.creator_follower_count || 0, 10),
      };

      const prev = countsRef.current;
      const hasChanged =
        newCounts.followers !== prev.followers ||
        newCounts.following !== prev.following ||
        newCounts.posts !== prev.posts ||
        newCounts.circles !== prev.circles ||
        newCounts.creatorFollowers !== prev.creatorFollowers;

      if (hasChanged) {
        console.log('[Counts] Fetch updated counts:', newCounts);
        countsRef.current = newCounts;
        setCounts(newCounts);
        setLastUpdated(new Date());
      }

      setIsPolling(false);
      return newCounts;
    } catch (error) {
      console.error('[Counts] Error fetching counts:', error);
      setIsPolling(false);
      return null;
    }
  }, [userId, userType, paused]);

  // Initialize counts
  const initializeCounts = useCallback((initialCounts) => {
    if (initialCounts) {
      const init = {
        followers: initialCounts.follower_count || initialCounts.followers || 0,
        following: initialCounts.following_count || initialCounts.following || 0,
        posts: initialCounts.post_count || initialCounts.posts || 0,
        circles: initialCounts.circle_count || initialCounts.circles || 0,
        creatorFollowers: initialCounts.creator_follower_count || initialCounts.creatorFollowers || 0,
      };
      countsRef.current = init;
      setCounts(init);
    }
  }, []);

  // EventBus subscription for instant local count synchronization (NO polling)
  useEffect(() => {
    if (!userId) return;
    const isMe = String(userId);

    const onFollowUpdated = (payload) => {
      // payload: { id, communityId, isFollowing }
      const targetId = String(payload?.id || payload?.communityId || '');
      if (!targetId) return;

      if (targetId === isMe) {
        // Someone followed/unfollowed us via the plain follows table
        // (communities, sponsors, venues → us, or old-style follows).
        // This always touches members.follower_count, not creator_follower_count.
        // Creator follows fire 'creator:followed'/'creator:unfollowed' separately.
        setCounts((prev) => {
          const nextVal = Math.max(0, prev.followers + (payload.isFollowing ? 1 : -1));
          const updated = { ...prev, followers: nextVal };
          countsRef.current = updated;
          return updated;
        });
      } else {
        // We followed/unfollowed someone else — adjusts our own following count
        setCounts((prev) => {
          const nextVal = Math.max(0, prev.following + (payload.isFollowing ? 1 : -1));
          const updated = { ...prev, following: nextVal };
          countsRef.current = updated;
          return updated;
        });
      }
    };

    const onCreatorFollowed = (payload) => {
      if (String(payload?.creatorId) === isMe) {
        setCounts((prev) => {
          const updated = { ...prev, creatorFollowers: prev.creatorFollowers + 1 };
          countsRef.current = updated;
          return updated;
        });
      } else {
        setCounts((prev) => {
          const updated = { ...prev, following: prev.following + 1 };
          countsRef.current = updated;
          return updated;
        });
      }
    };

    const onCreatorUnfollowed = (payload) => {
      if (String(payload?.creatorId) === isMe) {
        setCounts((prev) => {
          const updated = { ...prev, creatorFollowers: Math.max(0, prev.creatorFollowers - 1) };
          countsRef.current = updated;
          return updated;
        });
      } else {
        setCounts((prev) => {
          const updated = { ...prev, following: Math.max(0, prev.following - 1) };
          countsRef.current = updated;
          return updated;
        });
      }
    };

    const onCreatorFollowerRemoved = (payload) => {
      if (String(payload?.creatorId) === isMe) {
        setCounts((prev) => {
          const updated = { ...prev, creatorFollowers: Math.max(0, prev.creatorFollowers - 1) };
          countsRef.current = updated;
          return updated;
        });
      }
    };

    const onCircleMemberRemoved = (payload) => {
      const involvesMe = String(payload?.creatorId) === isMe || String(payload?.memberId) === isMe || String(payload?.communityId) === isMe;
      if (!involvesMe) return;

      setCounts((prev) => {
        const nextCircles = Math.max(0, prev.circles - 1);
        let nextFollowing = prev.following;
        let nextCreatorFollowers = prev.creatorFollowers;
        let nextFollowers = prev.followers;
        if (payload?.alsoUnfollow) {
          if (String(payload?.creatorId) === isMe || String(payload?.communityId) === isMe) {
            nextCreatorFollowers = Math.max(0, prev.creatorFollowers - 1);
            nextFollowers = Math.max(0, prev.followers - 1);
          } else {
            nextFollowing = Math.max(0, prev.following - 1);
          }
        }
        const updated = {
          ...prev,
          circles: nextCircles,
          following: nextFollowing,
          creatorFollowers: nextCreatorFollowers,
          followers: nextFollowers,
        };
        countsRef.current = updated;
        return updated;
      });
    };

    const onMyCircleMemberRemoved = (payload) => {
      // payload: { memberId, communityId, alsoUnfollow }
      const targetId = String(payload?.memberId || payload?.communityId || '');
      if (!targetId) return;

      if (targetId === isMe) {
        setCounts((prev) => {
          const nextCircles = Math.max(0, prev.circles - 1);
          let nextCreatorFollowers = prev.creatorFollowers;
          let nextFollowers = prev.followers;
          if (payload?.alsoUnfollow) {
            nextCreatorFollowers = Math.max(0, prev.creatorFollowers - 1);
            nextFollowers = Math.max(0, prev.followers - 1);
          }
          const updated = {
            ...prev,
            circles: nextCircles,
            creatorFollowers: nextCreatorFollowers,
            followers: nextFollowers,
          };
          countsRef.current = updated;
          return updated;
        });
      } else {
        setCounts((prev) => {
          const nextCircles = Math.max(0, prev.circles - 1);
          let nextFollowing = prev.following;
          if (payload?.alsoUnfollow) {
            nextFollowing = Math.max(0, prev.following - 1);
          }
          const updated = {
            ...prev,
            circles: nextCircles,
            following: nextFollowing,
          };
          countsRef.current = updated;
          return updated;
        });
      }
    };

    const onCircleLeft = (payload) => {
      if (String(payload?.creatorId) === isMe) {
        setCounts((prev) => {
          const nextCircles = Math.max(0, prev.circles - 1);
          let nextCreatorFollowers = prev.creatorFollowers;
          let nextFollowers = prev.followers;
          if (payload?.alsoUnfollow) {
            nextCreatorFollowers = Math.max(0, prev.creatorFollowers - 1);
            nextFollowers = Math.max(0, prev.followers - 1);
          }
          const updated = {
            ...prev,
            circles: nextCircles,
            creatorFollowers: nextCreatorFollowers,
            followers: nextFollowers,
          };
          countsRef.current = updated;
          return updated;
        });
      } else {
        setCounts((prev) => {
          const nextCircles = Math.max(0, prev.circles - 1);
          let nextFollowing = prev.following;
          if (payload?.alsoUnfollow) {
            nextFollowing = Math.max(0, prev.following - 1);
          }
          const updated = {
            ...prev,
            circles: nextCircles,
            following: nextFollowing,
          };
          countsRef.current = updated;
          return updated;
        });
      }
    };

    const onCircleRequestResponded = (payload) => {
      if (payload?.action === 'accepted') {
        const involvesMe = String(payload?.memberId) === isMe || String(payload?.creatorId) === isMe || String(payload?.communityId) === isMe;
        if (involvesMe) {
          setCounts((prev) => {
            const updated = { ...prev, circles: prev.circles + 1 };
            countsRef.current = updated;
            return updated;
          });
        }
      }
    };

    const onPostDeleted = () => {
      setCounts((prev) => {
        const updated = { ...prev, posts: Math.max(0, prev.posts - 1) };
        countsRef.current = updated;
        return updated;
      });
    };

    const sub1 = EventBus.on("follow-updated", onFollowUpdated);
    const sub2 = EventBus.on("creator:followed", onCreatorFollowed);
    const sub3 = EventBus.on("creator:unfollowed", onCreatorUnfollowed);
    const sub4 = EventBus.on("creator:follower-removed", onCreatorFollowerRemoved);
    const sub5 = EventBus.on("circle:member-removed", onCircleMemberRemoved);
    const sub6 = EventBus.on("my:circle-member-removed", onMyCircleMemberRemoved);
    const sub7 = EventBus.on("circle:left", onCircleLeft);
    const sub8 = EventBus.on("circle-request-responded", onCircleRequestResponded);
    const sub9 = EventBus.on("post-deleted", onPostDeleted);

    return () => {
      sub1();
      sub2();
      sub3();
      sub4();
      sub5();
      sub6();
      sub7();
      sub8();
      sub9();
    };
  }, [userId, userType]);

  // Foreground recovery sync effect
  useEffect(() => {
    if (!enabled || !userId) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (!paused) {
          fetchCounts();
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, userId, userType, fetchCounts, paused]);

  const forceRefresh = useCallback(async () => {
    return await fetchCounts();
  }, [fetchCounts]);

  return {
    counts,
    isPolling,
    lastUpdated,
    forceRefresh,
    initializeCounts,
  };
}
