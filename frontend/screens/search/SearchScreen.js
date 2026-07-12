import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { View, TextInput, FlatList, Text, TouchableOpacity, StyleSheet, Keyboard, ScrollView, InteractionManager, Animated, Alert } from "react-native";
import { Image } from "expo-image"; // ── PERF: memory-disk cache for search avatars
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Search,
  ArrowLeft,
  CircleX,
  X,
  Calendar,
  Clock,
  Users,
  Ticket,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { searchMembers, globalSearch } from "../../api/search";
import { searchEvents } from "../../api/events";
import { getDiscoverFeed, getSuggestedCommunities } from "../../api/discover";
import { searchCommunities } from "../../api/communities";
import {
  followMember,
  unfollowMember,
  sendCircleRequest,
  cancelCircleRequest,
  removeFromCircle,
  sendCommunityCircleInvite,
  cancelCommunityCircleInvite,
  removeMemberFromCommunityCircle,
  respondToCommunityCircleInvite,
  followCreator,
  unfollowCreator,
} from "../../api/members";
import { followCommunity, unfollowCommunity } from "../../api/communities";
import { getExploreFeed, dismissOpportunitiesBanner, unifiedSearch } from "../../api/explore";

import EventBus from "../../utils/EventBus";
import { getActiveAccount } from "../../api/auth";
import { getGradientForName, getInitials } from "../../utils/AvatarGenerator";
import { COLORS, BORDER_RADIUS, FONTS } from "../../constants/theme";
import { Explore } from "../../components/discover";
import SuggestedCommunityCard from "../../components/SuggestedCommunityCard";
import SnooLoader from "../../components/ui/SnooLoader";
import CollegeChip from "../../components/CollegeChip";

// Helper to create rgba from hex
const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const CIRCLE_COLOR = "#448AFF";
const DEBOUNCE_MS = 300;

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [following, setFollowing] = useState({}); // id -> boolean
  const [inCircle, setInCircle] = useState({}); // id -> boolean
  const [circleRequested, setCircleRequested] = useState({}); // id -> boolean
  const [circleRequestIdMap, setCircleRequestIdMap] = useState({}); // id -> string (request_id or invite_id)
  const [pending, setPending] = useState({}); // id -> boolean
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const inFlightRef = useRef(null);
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const [recents, setRecents] = useState([]);
  const [userId, setUserId] = useState(null);
  const [userType, setUserType] = useState(null);
  const [activeFilter, setActiveFilter] = useState("events"); // 'events', 'people', 'communities', 'creators'
  const [eventResults, setEventResults] = useState([]); // Separate state for event results
  const [eventSubFilter, setEventSubFilter] = useState("all"); // 'all', 'upcoming', 'live', 'past'

  // Explore feed state
  const [exploreFeedData, setExploreFeedData] = useState({});
  const [exploreFeedLoading, setExploreFeedLoading] = useState(true);
  const [exploreFeedRefreshing, setExploreFeedRefreshing] = useState(false);

  // Rotating placeholder state
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const placeholderOpacity = useRef(new Animated.Value(1)).current;
  const placeholders = ["events", "people", "communities", "creators"];

  const canSearch = query.trim().length >= 2;
  const showDiscoverGrid = !focused && !canSearch;

  const getRecentsKey = () => {
    return userId ? `recent_searches_${userId}` : "recent_searches";
  };

  const loadRecents = useCallback(async () => {
    if (!userId) return;
    try {
      const key = getRecentsKey();
      const raw = await AsyncStorage.getItem(key);
      if (!raw) {
        setRecents([]);
        return;
      }
      const arr = JSON.parse(raw);
      setRecents(Array.isArray(arr) ? arr : []);
    } catch {
      setRecents([]);
    }
  }, [userId]);

  const saveRecents = useCallback(
    async (items) => {
      if (!userId) return;
      try {
        const key = getRecentsKey();
        await AsyncStorage.setItem(key, JSON.stringify(items));
      } catch {}
    },
    [userId],
  );

  // Load explore feed
  const loadExploreFeed = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setExploreFeedRefreshing(true);
      } else {
        setExploreFeedLoading(true);
      }
      const res = await getExploreFeed();
      if (res?.success) {
        setExploreFeedData(res);
      }
    } catch (err) {
      console.error("Error loading explore feed:", err);
    } finally {
      setExploreFeedLoading(false);
      setExploreFeedRefreshing(false);
    }
  }, []);

  // Dismiss creator opportunities banner
  const handleDismissOpportunities = async () => {
    try {
      setExploreFeedData(prev => ({
        ...prev,
        creatorOpportunities: null
      }));
      await dismissOpportunitiesBanner();
    } catch (err) {
      console.error("Error dismissing opportunities banner:", err);
    }
  };

  // Rotating placeholder animation
  useEffect(() => {
    if (focused || query.length > 0) return;

    const interval = setInterval(() => {
      Animated.timing(placeholderOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
        Animated.timing(placeholderOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      });
    }, 1800);

    return () => clearInterval(interval);
  }, [focused, query]);

  const doSearch = useCallback(
    async (reset = false) => {
      if (!canSearch) {
        setResults([]);
        setEventResults([]);
        setOffset(0);
        setHasMore(false);
        setLoading(false);
        setError("");
        return;
      }
      const nextOffset = reset ? 0 : offset;
      setLoading(true);
      setError("");

      try {
        const response = await unifiedSearch(
          query.trim(),
          activeFilter,
          20,
          nextOffset,
          activeFilter === "events" ? eventSubFilter : "all"
        );

        if (response?.success) {
          const list = response.results || [];
          if (activeFilter === "events") {
            const newList = reset ? list : [...eventResults, ...list];
            setEventResults(newList);
            setResults([]);
          } else {
            const newList = reset ? list : [...results, ...list];
            setResults(newList);
            setEventResults([]);

            // Populate relationship maps for accounts
            const nextFollowing = {};
            const nextInCircle = {};
            const nextCircleRequested = {};
            const nextCircleRequestId = {};
            list.forEach((item) => {
              nextFollowing[item.id] = !!item.is_following;
              nextInCircle[item.id] = !!item.in_circle;
              nextCircleRequested[item.id] = !!item.circle_requested;
              nextCircleRequestId[item.id] = item.circle_request_id || null;
            });

            if (reset) {
              setFollowing(nextFollowing);
              setInCircle(nextInCircle);
              setCircleRequested(nextCircleRequested);
              setCircleRequestIdMap(nextCircleRequestId);
            } else {
              setFollowing((prev) => ({ ...prev, ...nextFollowing }));
              setInCircle((prev) => ({ ...prev, ...nextInCircle }));
              setCircleRequested((prev) => ({ ...prev, ...nextCircleRequested }));
              setCircleRequestIdMap((prev) => ({ ...prev, ...nextCircleRequestId }));
            }
          }
          setOffset(nextOffset + list.length);
          setHasMore(!!response.hasMore);
        } else {
          setError("Failed to fetch search results");
        }
      } catch (err) {
        console.error("Search error:", err);
        setError("Failed to search");
      } finally {
        setLoading(false);
      }
    },
    [query, offset, results, eventResults, canSearch, activeFilter, eventSubFilter],
  );

  useEffect(() => {
    const h = setTimeout(() => doSearch(true), DEBOUNCE_MS);
    return () => clearTimeout(h);
  }, [query, activeFilter, eventSubFilter]); // Trigger search when filter changes

  // Load user ID from active account - refresh on focus to handle account switches
  const loadUserId = useCallback(async () => {
    try {
      const activeAccount = await getActiveAccount();
      if (activeAccount?.id) {
        const newAccountId = `${activeAccount.type}_${activeAccount.id}`;
        // Only update if userId changed (account switch)
        setUserId((prevUserId) => {
          if (prevUserId !== newAccountId) {
            // Clear recents when switching accounts to prevent showing old account's data
            setRecents([]);
            return newAccountId;
          }
          return prevUserId;
        });
        setUserType(activeAccount.type || "member");
      }
    } catch (error) {
      console.error("Error loading user ID:", error);
    }
  }, []);

  // loadBlockedIds removed — the blocker sees real names for users they've blocked.
  // The blocked user (B) cannot see the blocker (A) in search results at all
  // because the backend already filters blocked/blocker relationships from search.

  // Refresh userId on screen focus to handle account switches
  useFocusEffect(
    useCallback(() => {
      loadUserId();
    }, [loadUserId]),
  );

  // Load explore feed on mount
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      loadExploreFeed(true);
    });
    return () => task.cancel();
  }, []);

  useEffect(() => {
    const unsubscribeBlur = navigation.addListener("blur", () => {
      Keyboard.dismiss();
    });
    const unsubscribeRemove = navigation.addListener("beforeRemove", () => {
      Keyboard.dismiss();
    });
    return () => {
      unsubscribeBlur();
      unsubscribeRemove();
      Keyboard.dismiss();
    };
  }, [navigation]);

  useEffect(() => {
    if (userId) {
      loadRecents();
    }
  }, [userId, loadRecents]);

  // Hide bottom tab bar dynamically when search bar is focused
  useEffect(() => {
    const parent = navigation.getParent();
    const grandparent = parent ? parent.getParent() : null;
    
    if (focused) {
      EventBus.emit("disable-tab-swipe");
    } else {
      EventBus.emit("enable-tab-swipe");
    }
    
    if (parent) {
      if (focused) {
        parent.setOptions({
          tabBarStyle: { display: "none" },
        });
      } else {
        parent.setOptions({
          tabBarStyle: undefined,
        });
      }
    }
    
    if (grandparent) {
      if (focused) {
        grandparent.setOptions({
          tabBarStyle: { display: "none" },
        });
      } else {
        grandparent.setOptions({
          tabBarStyle: undefined,
        });
      }
    }
    
    return () => {
      EventBus.emit("enable-tab-swipe");
      if (parent) {
        parent.setOptions({
          tabBarStyle: undefined,
        });
      }
      if (grandparent) {
        grandparent.setOptions({
          tabBarStyle: undefined,
        });
      }
    };
  }, [focused, navigation]);

  // Listen for follow/circle updates from other screens (profile pages)
  useEffect(() => {
    const handleFollowUpdate = (data) => {
      const entityId = data?.id || data?.memberId || data?.communityId || data?.sponsorId || data?.venueId || data?.creatorId;
      if (!entityId) return;

      if (typeof data?.isFollowing === "boolean") {
        setFollowing((prev) => ({ ...prev, [entityId]: data.isFollowing }));
      }
      if (typeof data?.inCircle === "boolean") {
        setInCircle((prev) => ({ ...prev, [entityId]: data.inCircle }));
      }
      if (typeof data?.circleRequested === "boolean") {
        setCircleRequested((prev) => ({ ...prev, [entityId]: data.circleRequested }));
      }
    };

    const handleCircleRemoved = (data) => {
      const memberId = data?.memberId || data?.creatorId;
      if (memberId) {
        setInCircle((prev) => ({ ...prev, [memberId]: false }));
        if (data?.alsoUnfollow) {
          setFollowing((prev) => ({ ...prev, [memberId]: false }));
        }
      }
    };

    const unsubscribeFollow = EventBus.on("follow-updated", handleFollowUpdate);
    const unsubscribeCircleLeft = EventBus.on("circle:left", handleCircleRemoved);
    const unsubscribeCircleRemoved = EventBus.on("my:circle-member-removed", handleCircleRemoved);

    return () => {
      if (unsubscribeFollow) unsubscribeFollow();
      if (unsubscribeCircleLeft) unsubscribeCircleLeft();
      if (unsubscribeCircleRemoved) unsubscribeCircleRemoved();
    };
  }, []);

  const onEndReached = useCallback(() => {
    if (loading || !hasMore) return;
    doSearch(false);
  }, [loading, hasMore, doSearch]);

  const toggleFollow = async (item) => {
    const entityId = item.id;
    const entityType = item.type || "member";
    const isCreator = !!(item.is_creator_mode_enabled || item.isCreator);

    if (pending[entityId]) return;

    // A. Regular Member
    if (entityType === "member" && !isCreator) {
      if (userType === "member") {
        // Member-to-Member circle flow
        const isInCircle = !!inCircle[entityId];
        const isRequested = !!circleRequested[entityId];
        const requestId = circleRequestIdMap[entityId];

        if (isInCircle) {
          Alert.alert(
            "Remove from Circle?",
            `Are you sure you want to remove ${item.full_name || item.name || "this user"} from your circle?`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Remove",
                style: "destructive",
                onPress: async () => {
                  setPending((prev) => ({ ...prev, [entityId]: true }));
                  try {
                    await removeFromCircle(entityId);
                    setInCircle((prev) => ({ ...prev, [entityId]: false }));
                    EventBus.emit("follow-updated", { id: entityId, isFollowing: false });
                  } catch (e) {
                    console.error("Failed to remove from circle:", e);
                  } finally {
                    setPending((prev) => ({ ...prev, [entityId]: false }));
                  }
                },
              },
            ]
          );
        } else if (isRequested) {
          Alert.alert(
            "Cancel Request?",
            "Withdraw your circle request?",
            [
              { text: "Keep", style: "cancel" },
              {
                text: "Cancel Request",
                style: "destructive",
                onPress: async () => {
                  setPending((prev) => ({ ...prev, [entityId]: true }));
                  try {
                    if (requestId) {
                      await cancelCircleRequest(requestId);
                    }
                    setCircleRequested((prev) => ({ ...prev, [entityId]: false }));
                    setCircleRequestIdMap((prev) => ({ ...prev, [entityId]: null }));
                  } catch (e) {
                    console.error("Failed to cancel circle request:", e);
                  } finally {
                    setPending((prev) => ({ ...prev, [entityId]: false }));
                  }
                },
              },
            ]
          );
        } else {
          // Send Request
          setPending((prev) => ({ ...prev, [entityId]: true }));
          try {
            const res = await sendCircleRequest(entityId);
            if (res?.auto_accepted) {
              setInCircle((prev) => ({ ...prev, [entityId]: true }));
              EventBus.emit("follow-updated", { id: entityId, isFollowing: true });
            } else {
              setCircleRequested((prev) => ({ ...prev, [entityId]: true }));
              if (res?.request_id) {
                setCircleRequestIdMap((prev) => ({ ...prev, [entityId]: res.request_id }));
              }
            }
          } catch (e) {
            console.error("Failed to send circle request:", e);
          } finally {
            setPending((prev) => ({ ...prev, [entityId]: false }));
          }
        }
      } else if (userType === "community") {
        // Community-to-Member circle flow
        const isInCircle = !!inCircle[entityId];
        const isRequested = !!circleRequested[entityId];
        const inviteId = circleRequestIdMap[entityId];

        if (isInCircle) {
          Alert.alert(
            "Remove from Circle?",
            `${item.full_name || item.name || "This person"} will be removed from your circle.`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Remove",
                style: "destructive",
                onPress: async () => {
                  setPending((prev) => ({ ...prev, [entityId]: true }));
                  try {
                    await removeMemberFromCommunityCircle(entityId);
                    setInCircle((prev) => ({ ...prev, [entityId]: false }));
                  } catch (e) {
                    console.error("Failed to remove member from community circle:", e);
                  } finally {
                    setPending((prev) => ({ ...prev, [entityId]: false }));
                  }
                },
              },
            ]
          );
        } else if (isRequested) {
          Alert.alert(
            "Cancel Invite?",
            "Withdraw your circle invite to this member?",
            [
              { text: "Keep", style: "cancel" },
              {
                text: "Cancel Invite",
                style: "destructive",
                onPress: async () => {
                  setPending((prev) => ({ ...prev, [entityId]: true }));
                  try {
                    if (inviteId) {
                      await cancelCommunityCircleInvite(inviteId);
                    }
                    setCircleRequested((prev) => ({ ...prev, [entityId]: false }));
                    setCircleRequestIdMap((prev) => ({ ...prev, [entityId]: null }));
                  } catch (e) {
                    console.error("Failed to cancel community circle invite:", e);
                  } finally {
                    setPending((prev) => ({ ...prev, [entityId]: false }));
                  }
                },
              },
            ]
          );
        } else {
          // Send Invite
          setPending((prev) => ({ ...prev, [entityId]: true }));
          try {
            const res = await sendCommunityCircleInvite(entityId);
            setCircleRequested((prev) => ({ ...prev, [entityId]: true }));
            if (res?.invite_id) {
              setCircleRequestIdMap((prev) => ({ ...prev, [entityId]: res.invite_id }));
            }
          } catch (e) {
            console.error("Failed to send community circle invite:", e);
          } finally {
            setPending((prev) => ({ ...prev, [entityId]: false }));
          }
        }
      }
    }
    // B. Creator Mode Member
    else if (entityType === "member" && isCreator) {
      const isInCircle = !!inCircle[entityId];
      const isFollowing = !!following[entityId];

      if (isInCircle) {
        Alert.alert(
          "Remove from Circle?",
          `Are you sure you want to remove ${item.full_name || item.name || "this creator"} from your circle?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Remove",
              style: "destructive",
              onPress: async () => {
                setPending((prev) => ({ ...prev, [entityId]: true }));
                try {
                  await removeFromCircle(entityId, false); // keep follow, remove from circle
                  setInCircle((prev) => ({ ...prev, [entityId]: false }));
                  setFollowing((prev) => ({ ...prev, [entityId]: true })); // Follow is restored
                  EventBus.emit("follow-updated", { id: entityId, isFollowing: true });
                } catch (e) {
                  console.error("Failed to remove creator from circle:", e);
                } finally {
                  setPending((prev) => ({ ...prev, [entityId]: false }));
                }
              },
            },
          ]
        );
      } else {
        // Follow / Unfollow Creator
        if (isFollowing) {
          Alert.alert(
            "Unfollow?",
            `Stop following ${item.full_name || item.name || "this creator"}?`,
            [
              { text: "Keep Following", style: "cancel" },
              {
                text: "Unfollow",
                style: "destructive",
                onPress: async () => {
                  setPending((prev) => ({ ...prev, [entityId]: true }));
                  try {
                    await unfollowCreator(entityId);
                    setFollowing((prev) => ({ ...prev, [entityId]: false }));
                    EventBus.emit("follow-updated", { id: entityId, isFollowing: false });
                  } catch (e) {
                    console.error("Failed to unfollow creator:", e);
                  } finally {
                    setPending((prev) => ({ ...prev, [entityId]: false }));
                  }
                },
              },
            ]
          );
        } else {
          setPending((prev) => ({ ...prev, [entityId]: true }));
          try {
            await followCreator(entityId);
            setFollowing((prev) => ({ ...prev, [entityId]: true }));
            EventBus.emit("follow-updated", { id: entityId, isFollowing: true });
          } catch (e) {
            console.error("Failed to follow creator:", e);
          } finally {
            setPending((prev) => ({ ...prev, [entityId]: false }));
          }
        }
      }
    }
    // C. Other Entity Types (community, sponsor, venue)
    else {
      if (entityType === "community" && userType === "member") {
        const isInCircle = !!inCircle[entityId];
        const isRequested = !!circleRequested[entityId];
        const inviteId = circleRequestIdMap[entityId];
        const isFollowing = !!following[entityId];

        if (isInCircle) {
          Alert.alert(
            "Remove from Circle?",
            `Are you sure you want to remove ${item.full_name || item.name || "this community"} from your circle?`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Remove",
                style: "destructive",
                onPress: async () => {
                  setPending((prev) => ({ ...prev, [entityId]: true }));
                  try {
                    await removeMemberFromCommunityCircle(entityId);
                    setInCircle((prev) => ({ ...prev, [entityId]: false }));
                    setFollowing((prev) => ({ ...prev, [entityId]: true })); // Follow is restored on removal
                    EventBus.emit("follow-updated", { communityId: entityId, isFollowing: true });
                  } catch (e) {
                    console.error("Failed to remove community from circle:", e);
                  } finally {
                    setPending((prev) => ({ ...prev, [entityId]: false }));
                  }
                },
              },
            ]
          );
        } else if (isRequested) {
          Alert.alert(
            "Circle Invite",
            `${item.full_name || item.name || "This community"} invited you to connect.`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Decline",
                style: "destructive",
                onPress: async () => {
                  setPending((prev) => ({ ...prev, [entityId]: true }));
                  try {
                    if (inviteId) {
                      await respondToCommunityCircleInvite(inviteId, 'declined');
                    }
                    setCircleRequested((prev) => ({ ...prev, [entityId]: false }));
                    setCircleRequestIdMap((prev) => ({ ...prev, [entityId]: null }));
                  } catch (e) {
                    console.error("Failed to decline community invite:", e);
                  } finally {
                    setPending((prev) => ({ ...prev, [entityId]: false }));
                  }
                },
              },
              {
                text: "Accept",
                onPress: async () => {
                  setPending((prev) => ({ ...prev, [entityId]: true }));
                  try {
                    if (inviteId) {
                      await respondToCommunityCircleInvite(inviteId, 'accepted');
                    }
                    setCircleRequested((prev) => ({ ...prev, [entityId]: false }));
                    setInCircle((prev) => ({ ...prev, [entityId]: true }));
                  } catch (e) {
                    console.error("Failed to accept community invite:", e);
                  } finally {
                    setPending((prev) => ({ ...prev, [entityId]: false }));
                  }
                },
              },
            ]
          );
        } else {
          // Standard Follow / Unfollow Community
          if (isFollowing) {
            Alert.alert(
              "Unfollow?",
              `Are you sure you want to unfollow ${item.full_name || item.name || "this community"}?`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Unfollow",
                  style: "destructive",
                  onPress: async () => {
                    setPending((prev) => ({ ...prev, [entityId]: true }));
                    try {
                      await unfollowCommunity(entityId);
                      setFollowing((prev) => ({ ...prev, [entityId]: false }));
                      EventBus.emit("follow-updated", { communityId: entityId, isFollowing: false });
                    } catch (e) {
                      console.error("Failed to unfollow community:", e);
                    } finally {
                      setPending((prev) => ({ ...prev, [entityId]: false }));
                    }
                  },
                },
              ]
            );
          } else {
            setPending((prev) => ({ ...prev, [entityId]: true }));
            try {
              await followCommunity(entityId);
              setFollowing((prev) => ({ ...prev, [entityId]: true }));
              EventBus.emit("follow-updated", { communityId: entityId, isFollowing: true });
            } catch (e) {
              console.error("Failed to follow community:", e);
            } finally {
              setPending((prev) => ({ ...prev, [entityId]: false }));
            }
          }
        }
      } else {
        // Sponsor, Venue, or Community-to-Community follows
        const isFollowing = !!following[entityId];

        if (isFollowing) {
          Alert.alert(
            "Unfollow?",
            `Are you sure you want to unfollow ${item.full_name || item.name || "this account"}?`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Unfollow",
                style: "destructive",
                onPress: async () => {
                  setPending((prev) => ({ ...prev, [entityId]: true }));
                  try {
                    if (entityType === "community") {
                      await unfollowCommunity(entityId);
                    } else {
                      await unfollowMember(entityId);
                    }
                    setFollowing((prev) => ({ ...prev, [entityId]: false }));
                    EventBus.emit("follow-updated", {
                      memberId: entityType !== "community" ? entityId : undefined,
                      communityId: entityType === "community" ? entityId : undefined,
                      isFollowing: false,
                    });
                  } catch (e) {
                    console.error("Failed to unfollow entity:", e);
                  } finally {
                    setPending((prev) => ({ ...prev, [entityId]: false }));
                  }
                },
              },
            ]
          );
        } else {
          setPending((prev) => ({ ...prev, [entityId]: true }));
          try {
            if (entityType === "community") {
              await followCommunity(entityId);
            } else {
              await followMember(entityId);
            }
            setFollowing((prev) => ({ ...prev, [entityId]: true }));
            EventBus.emit("follow-updated", {
              memberId: entityType !== "community" ? entityId : undefined,
              communityId: entityType === "community" ? entityId : undefined,
              isFollowing: true,
            });
          } catch (e) {
            console.error("Failed to follow entity:", e);
          } finally {
            setPending((prev) => ({ ...prev, [entityId]: false }));
          }
        }
      }
    }
  };

  const onPressProfile = async (item, fromRecent = false) => {
    const entityType = item.type || "member";
    Keyboard.dismiss();

    // Navigate to appropriate profile
    if (entityType === "community") {
      navigation.navigate("CommunityPublicProfile", {
        communityId: item.id,
        viewerRole: "member",
      });
    } else if (entityType === "sponsor") {
      navigation.navigate("SponsorProfile", {
        sponsorId: item.id,
      });
    } else if (entityType === "venue") {
      navigation.navigate("VenueProfile", {
        venueId: item.id,
      });
    } else {
      navigation.navigate("MemberPublicProfile", {
        memberId: item.id,
      });
    }

    // update recents (dedup by id, newest first, max 10)
    const next = [
      {
        id: item.id,
        type: entityType,
        username: item.username,
        full_name: item.full_name || item.name,
        profile_photo_url: item.profile_photo_url || item.logo_url,
      },
      ...recents.filter((r) => r.id !== item.id || r.type !== entityType),
    ].slice(0, 10);
    setRecents(next);
    saveRecents(next);
  };

  const normalizeDisplayName = (name, entityType) => {
    const fallback = entityType === "community" ? "Community" : "Member";
    if (!name) return fallback;
    return String(name).split(/\r?\n/)[0];
  };

  const formatEventDate = (dateString) => {
    if (!dateString) return { dateLabel: "EVT", timeLabel: "", isSpecial: false };
    const date = new Date(dateString);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === now.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    let dateLabel = date
      .toLocaleDateString(undefined, { month: "short", day: "numeric" })
      .toUpperCase();
    let isSpecial = false;

    if (isToday) {
      dateLabel = "TODAY";
      isSpecial = true;
    } else if (isTomorrow) {
      dateLabel = "TOMORROW";
      isSpecial = true;
    }

    const timeLabel = date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });

    return { dateLabel, timeLabel, isSpecial };
  };

  const getEventStatusTag = (startDateStr, endDateStr) => {
    if (!startDateStr) return { label: "Upcoming", color: "#3B82F6", bg: "#EFF6FF" };
    const now = new Date();
    const start = new Date(startDateStr);
    const end = endDateStr 
      ? new Date(endDateStr) 
      : new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2h fallback

    if (now > end) {
      return { label: "Past", color: "#8E8E93", bg: "#F2F2F7" };
    } else if (now >= start && now <= end) {
      return { label: "Live", color: "#10B981", bg: "#ECFDF5" };
    } else {
      return { label: "Upcoming", color: "#3B82F6", bg: "#EFF6FF" };
    }
  };

  // Render event item for search results (dashboard ticket card style)
  const renderEventItem = ({ item }) => {
    const { dateLabel, timeLabel, isSpecial } = formatEventDate(
      item.event_date,
    );

    // Compute real sold / capacity from ticket_types returned by the API
    const tickets = item.ticket_types || [];
    const ticketsSold =
      tickets.length > 0
        ? tickets.reduce((sum, t) => sum + (t.sold_count || 0), 0)
        : parseInt(item.attendee_count || 0, 10);
    const rawCapacity = tickets.reduce(
      (sum, t) => (t.total_quantity != null ? sum + t.total_quantity : sum),
      0,
    );
    // rawCapacity is 0 if all tickets are unlimited — fall back to max_attendees
    const ticketCapacity =
      rawCapacity > 0
        ? rawCapacity
        : parseInt(item.max_attendees || 0, 10) || null;

    const statusTag = getEventStatusTag(item.event_date, item.end_datetime);

    return (
      <TouchableOpacity
        style={styles.ticketCard}
        onPress={() => {
          Keyboard.dismiss();
          navigation.navigate("EventDetails", {
            eventId: item.id,
            eventData: item,
          });
        }}
        activeOpacity={0.8}
      >
        <Image
          source={{
            uri:
              item.banner_url ||
              "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=200",
          }}
          style={styles.ticketImage}
        />
        <View style={styles.ticketContent}>
          <View style={styles.ticketTextSection}>
            <View style={styles.ticketHeaderRow}>
              <View
                style={[
                  styles.ticketDatePill,
                  isSpecial && styles.ticketDatePillSpecial,
                ]}
              >
                <Text
                  style={[
                    styles.ticketDateText,
                    isSpecial && styles.ticketDateTextSpecial,
                  ]}
                >
                  {dateLabel}
                </Text>
              </View>
              <Text style={styles.ticketTimeText}>{timeLabel}</Text>
              
              <View style={[styles.statusTag, { backgroundColor: statusTag.bg }]}>
                <Text style={[styles.statusTagText, { color: statusTag.color }]}>
                  {statusTag.label}
                </Text>
              </View>
            </View>

            <Text style={styles.ticketTitle} numberOfLines={2}>
              {item.title || item.name}
            </Text>

            <View style={styles.ticketFooterRow}>
              <Ticket
                size={14}
                color={COLORS.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.ticketMetricText}>
                {ticketCapacity != null
                  ? `${ticketsSold}/${ticketCapacity} sold`
                  : `${ticketsSold} sold`}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }) => {
    const entityType = item.type || "member";
    const displayName = normalizeDisplayName(
      item.full_name || item.name,
      entityType,
    );
    const photoUrl = item.profile_photo_url || item.logo_url;
    const hasValidPhoto = photoUrl && /^https?:\/\//.test(photoUrl);

    const isCreator = !!(item.is_creator_mode_enabled || item.isCreator);
    const isSelf = userId === `${entityType}_${item.id}`;

    const renderActionButton = () => {
      if (isSelf) return null;

      let btnText = "Follow";
      let btnStyle = [styles.followBtn, styles.followBtnPrimary];
      let txtStyle = [styles.followText, styles.followTextPrimary];

      // A. Regular Member
      if (entityType === "member" && !isCreator) {
        const isInCircle = !!inCircle[item.id];
        const isRequested = !!circleRequested[item.id];

        if (isInCircle) {
          btnText = "In Circle";
          btnStyle = [styles.followBtn, styles.inCircleBtn];
          txtStyle = [styles.followText, styles.inCircleText];
        } else if (isRequested) {
          btnText = userType === "community" ? "Invited" : "Requested";
          btnStyle = [styles.followBtn, styles.requestedBtn];
          txtStyle = [styles.followText, styles.requestedText];
        } else {
          btnText = "Add";
          btnStyle = [styles.followBtn, styles.addBtn];
          txtStyle = [styles.followText, styles.addText];
        }
      }
      // B. Creator Mode Member
      else if (entityType === "member" && isCreator) {
        const isInCircle = !!inCircle[item.id];
        const isFollowing = !!following[item.id];

        if (isInCircle) {
          btnText = "In Circle";
          btnStyle = [styles.followBtn, styles.inCircleBtn];
          txtStyle = [styles.followText, styles.inCircleText];
        } else if (isFollowing) {
          btnText = "Following";
          btnStyle = [styles.followBtn, styles.followingBtn];
          txtStyle = [styles.followText, styles.followingText];
        } else {
          btnText = "Follow";
          btnStyle = [styles.followBtn, styles.followBtnPrimary];
          txtStyle = [styles.followText, styles.followTextPrimary];
        }
      }
      // C. Other Entity Types (community, sponsor, venue)
      else {
        const isInCircle = !!inCircle[item.id];
        const isRequested = !!circleRequested[item.id];
        const isFollowing = !!following[item.id];

        if (entityType === "community" && userType === "member") {
          if (isInCircle) {
            btnText = "In Circle";
            btnStyle = [styles.followBtn, styles.inCircleBtn];
            txtStyle = [styles.followText, styles.inCircleText];
          } else if (isRequested) {
            btnText = "Invited";
            btnStyle = [styles.followBtn, styles.requestedBtn];
            txtStyle = [styles.followText, styles.requestedText];
          } else if (isFollowing) {
            btnText = "Following";
            btnStyle = [styles.followBtn, styles.followingBtn];
            txtStyle = [styles.followText, styles.followingText];
          } else {
            btnText = "Follow";
            btnStyle = [styles.followBtn, styles.followBtnPrimary];
            txtStyle = [styles.followText, styles.followTextPrimary];
          }
        } else {
          if (isFollowing) {
            btnText = "Following";
            btnStyle = [styles.followBtn, styles.followingBtn];
            txtStyle = [styles.followText, styles.followingText];
          } else {
            btnText = "Follow";
            btnStyle = [styles.followBtn, styles.followBtnPrimary];
            txtStyle = [styles.followText, styles.followTextPrimary];
          }
        }
      }

      return (
        <TouchableOpacity
          disabled={!!pending[item.id]}
          style={[
            btnStyle,
            pending[item.id] ? { opacity: 0.6 } : null,
          ]}
          onPress={() => toggleFollow(item)}
        >
          <Text style={txtStyle}>
            {btnText}
          </Text>
        </TouchableOpacity>
      );
    };

    return (
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.profileRowInner} // Use new style for increased gap
          onPress={() => onPressProfile(item, false)}
        >
          {hasValidPhoto ? (
            <Image source={{ uri: photoUrl }} style={styles.avatar} cachePolicy="memory-disk" contentFit="cover" />
          ) : entityType === "community" ? (
            <LinearGradient
              colors={getGradientForName(
                item.name || item.full_name || "Community",
              )}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.avatar,
                { justifyContent: "center", alignItems: "center" },
              ]}
            >
              <Text style={{ fontSize: 20, fontWeight: "bold", color: "#fff" }}>
                {getInitials(item.name || item.full_name || "C")}
              </Text>
            </LinearGradient>
          ) : (
            <Image
              source={{ uri: "https://via.placeholder.com/64" }}
              style={styles.avatar}
              cachePolicy="memory-disk"
              contentFit="cover"
            />
          )}
          <View style={styles.meta}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text style={styles.name} numberOfLines={1}>
                {displayName}
              </Text>
              {activeFilter === "all" && (
                <View
                  style={[
                    styles.typeBadge,
                    entityType === "community"
                      ? styles.typeBadgeCommunity
                      : entityType === "sponsor"
                        ? styles.typeBadgeSponsor
                        : entityType === "venue"
                          ? styles.typeBadgeVenue
                          : styles.typeBadgeMember,
                  ]}
                >
                  <Text style={styles.typeBadgeText}>
                    {entityType === "community"
                      ? "C"
                      : entityType === "sponsor"
                        ? "S"
                        : entityType === "venue"
                          ? "V"
                          : "M"}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.username} numberOfLines={1}>
              @{item.username}
              {entityType === "community" &&
                item.category &&
                ` • ${item.category}`}
            </Text>
            {/* College Chip for affiliated communities */}
            {entityType === "community" && item.college_info && (
              <View style={{ marginTop: 4 }}>
                <CollegeChip
                  collegeInfo={item.college_info}
                  compact
                  onPress={() => onPressProfile(item, false)}
                />
              </View>
            )}
          </View>
        </TouchableOpacity>
        {renderActionButton()}
      </View>
    );
  };

  const renderRecentItem = ({ item }) => {
    const entityType = item.type || "member";
    const displayName = normalizeDisplayName(item.full_name || item.name, entityType);
    const photoUrl = item.profile_photo_url || item.logo_url;
    const hasValidPhoto = photoUrl && /^https?:\/\//.test(photoUrl);

    return (
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.profileRowInner}
          onPress={() => onPressProfile(item, true)}
          activeOpacity={0.7}
        >
          {hasValidPhoto ? (
            <Image source={{ uri: photoUrl }} style={styles.avatar} cachePolicy="memory-disk" contentFit="cover" />
          ) : entityType === "community" ? (
            <LinearGradient
              colors={getGradientForName(item.name || item.full_name || "Community")}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.avatar, { justifyContent: "center", alignItems: "center" }]}
            >
              <Text style={{ fontSize: 20, fontWeight: "bold", color: "#fff" }}>
                {getInitials(item.name || item.full_name || "C")}
              </Text>
            </LinearGradient>
          ) : (
            <View style={[styles.avatar, { backgroundColor: "#EFEFF4", alignItems: "center", justifyContent: "center" }]}>
              <Search size={20} color="#8E8E93" strokeWidth={1.5} />
            </View>
          )}
          <View style={styles.meta}>
            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.username} numberOfLines={1}>@{item.username}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            const next = recents.filter((r) => r.id !== item.id || r.type !== entityType);
            setRecents(next);
            saveRecents(next);
          }}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          style={[styles.followBtn, styles.followingBtn]}
        >
          <X size={16} color="#1D1D1F" />
        </TouchableOpacity>
      </View>
    );
  };

  // Handle discover feed event card press
  const handleDiscoverItemPress = (event) => {
    // Navigate to EventDetails screen
    if (event.id) {
      Keyboard.dismiss();
      navigation.navigate("EventDetails", {
        eventId: event.id,
        eventData: event,
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with Explore Title - Only visible when not searching */}
      {!focused && (
        <View style={styles.headerContainer}>
          <Text style={[styles.headerTitle, { fontFamily: "Manrope-Medium", color: COLORS.textPrimary, fontWeight: "normal" }]}>
            Explore
          </Text>
        </View>
      )}

      {/* Search Input Box */}
      <View
        style={[
          styles.searchContainer,
          focused && styles.searchContainerFocused,
          focused && { paddingTop: 60 } // Align when header is hidden
        ]}
      >
        {focused && (
          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              setQuery("");
              setFocused(false);
              inputRef.current?.blur();
            }}
            style={styles.backButton}
          >
            <ArrowLeft size={24} color="#2C2C2A" />
          </TouchableOpacity>
        )}
        <View style={[styles.searchBox, focused && { flex: 1 }]}>
          <Search size={20} color="#8E8E93" />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder=""
            placeholderTextColor="#8E8E93"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onFocus={() => setFocused(true)}
          />
          {(!focused && query.length === 0) && (
            <View style={styles.placeholderOverlay} pointerEvents="none">
              <Text style={styles.placeholderText}>Search </Text>
              <Animated.Text
                style={[
                  styles.placeholderText,
                  { opacity: placeholderOpacity }
                ]}
              >
                {placeholders[placeholderIndex]}
              </Animated.Text>
            </View>
          )}
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery("")}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <CircleX size={20} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs - Only show when search is focused */}
      {focused && (
        <View style={{ flexGrow: 0 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
            style={{ flexGrow: 0 }} // Added to prevent expansion
          >
            {["events", "people", "communities", "creators"].map(
              (filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.filterTab,
                    activeFilter === filter && styles.filterTabActive,
                  ]}
                  onPress={() => {
                    setActiveFilter(filter);
                    setResults([]);
                    setEventResults([]);
                    setOffset(0);
                  }}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      activeFilter === filter && styles.filterTabTextActive,
                    ]}
                  >
                    {filter === "events"
                      ? "Events"
                      : filter === "people"
                        ? "People"
                        : filter === "communities"
                          ? "Communities"
                          : "Creators"}
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </ScrollView>

          {/* Event Sub-filters - Only show when activeFilter is 'events' */}
          {activeFilter === "events" && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.subFilterContent}
              style={{ flexGrow: 0, marginTop: 10, marginBottom: 4 }}
            >
              {["all", "upcoming", "live", "past"].map((subFilter) => (
                <TouchableOpacity
                  key={subFilter}
                  style={[
                    styles.subFilterTab,
                    eventSubFilter === subFilter && styles.subFilterTabActive,
                  ]}
                  onPress={() => {
                    setEventSubFilter(subFilter);
                    setEventResults([]);
                    setOffset(0);
                  }}
                >
                  <Text
                    style={[
                      styles.subFilterTabText,
                      eventSubFilter === subFilter && styles.subFilterTabTextActive,
                    ]}
                  >
                    {subFilter === "all"
                      ? "All"
                      : subFilter === "upcoming"
                      ? "Upcoming"
                      : subFilter === "live"
                      ? "Live"
                      : "Past"}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {focused && query.trim().length === 0 ? (
        <View style={styles.contentContainer}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center", // Align text and button nicely
              paddingHorizontal: 16,
              paddingTop: 0,
              marginTop: 12,
              marginBottom: 8,
            }}
          >
            <Text style={{ fontWeight: "600", color: "#2C2C2A", fontSize: 18, fontFamily: "BasicCommercial-Bold" }}>
              Recent
            </Text>
            {recents.length > 0 && (
              <TouchableOpacity
                onPress={async () => {
                  setRecents([]);
                  await saveRecents([]);
                }}
              >
                <Text style={{ color: COLORS.primary, fontWeight: "600", fontFamily: "Manrope-SemiBold" }}>
                  Clear all
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={recents}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderRecentItem}
            ListEmptyComponent={
              <View style={styles.helper}>
                <Text style={styles.helperText}>No recent searches</Text>
              </View>
            }
          />
        </View>
      ) : null}

      {!!error && (
        <View style={[styles.helper, styles.contentContainer]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {canSearch && (
        <View style={styles.contentContainer}>
          <FlatList
            data={activeFilter === "events" ? eventResults : results}
            keyExtractor={(item) => String(item.id)}
            renderItem={activeFilter === "events" ? renderEventItem : renderItem}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.6}
            ListEmptyComponent={
              canSearch && !loading ? (
                <View style={styles.helper}>
                  <Text style={styles.helperText}>
                    {activeFilter === "events"
                      ? "No events found"
                      : "No results found"}
                  </Text>
                </View>
              ) : null
            }
            contentContainerStyle={
              (activeFilter === "events" ? eventResults : results).length === 0
                ? { flexGrow: 1 }
                : null
            }
          />
        </View>
      )}

      {/* Explore Feed */}
      {showDiscoverGrid && (
        <Explore
          feedData={exploreFeedData}
          loading={exploreFeedLoading}
          refreshing={exploreFeedRefreshing}
          onRefresh={() => loadExploreFeed(true)}
          onEventPress={handleDiscoverItemPress}
          onDismissOpportunities={handleDismissOpportunities}
          navigation={navigation}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBackground },
  contentContainer: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    color: COLORS.textPrimary,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchContainerFocused: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "#D3D1C7",
    height: 50,
    gap: 12,
    position: "relative"
  },
  placeholderOverlay: {
    position: "absolute",
    left: 48,
    flexDirection: "row",
    alignItems: "center"
  },
  placeholderText: {
    fontSize: 16,
    color: "#8E8E93",
    fontFamily: "Manrope-Medium"
  },
  input: { flex: 1, fontSize: 16, color: "#2C2C2A" },
  helper: { alignItems: "center", paddingVertical: 24 },
  helperText: { color: "#8E8E93" },
  errorText: { color: "#FF3B30" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12, // Default gap for items in the row
  },
  // NEW STYLE: Increased spacing between image and text block
  profileRowInner: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 16, // Increased gap from 12 (default) to 16
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F2F2F7",
  },
  meta: { flex: 1 },
  name: {
    fontSize: 16,
    color: "#1D1D1F",
    fontFamily: "BasicCommercial-Bold",
  },
  username: {
    fontSize: 14,
    color: "#8E8E93",
    marginTop: 2,
    fontFamily: "Manrope-Medium",
  },
  bio: { fontSize: 12, color: "#8E8E93", marginTop: 2 },
  followBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  followBtnPrimary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  followingBtn: {
    backgroundColor: hexToRgba(COLORS.primary, 0.12),
    borderColor: hexToRgba(COLORS.primary, 0.2),
  },
  inCircleBtn: {
    backgroundColor: hexToRgba(CIRCLE_COLOR, 0.08),
    borderColor: hexToRgba(CIRCLE_COLOR, 0.2),
  },
  requestedBtn: {
    backgroundColor: hexToRgba(CIRCLE_COLOR, 0.1),
    borderColor: hexToRgba(CIRCLE_COLOR, 0.2),
  },
  addBtn: {
    backgroundColor: CIRCLE_COLOR,
    borderColor: CIRCLE_COLOR,
  },
  followText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
  },
  followTextPrimary: { color: "#FFFFFF" },
  followingText: { color: COLORS.primary },
  inCircleText: { color: CIRCLE_COLOR },
  requestedText: { color: CIRCLE_COLOR },
  addText: { color: "#FFFFFF" },
  // Filter tabs
  filterContent: {
    paddingHorizontal: 20,
    // Reduced padding significantly to close gap
    paddingTop: 0,
    paddingBottom: 0,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: "#8E8E93",
  },
  filterTabTextActive: {
    color: "#FFFFFF",
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeMember: {
    backgroundColor: "#E3F2FD",
  },
  typeBadgeCommunity: {
    backgroundColor: "#F3E5F5",
  },
  typeBadgeSponsor: {
    backgroundColor: "#FFF3E0",
  },
  typeBadgeVenue: {
    backgroundColor: "#E8F5E9",
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1D1D1F",
  },
  ticketCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    alignItems: "center",
    height: 120,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  ticketImage: {
    width: 88,
    height: 88,
    borderRadius: 16,
    backgroundColor: "#F0F0F0",
  },
  ticketContent: {
    flex: 1,
    marginLeft: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  ticketTextSection: {
    flex: 1,
    height: "100%",
    justifyContent: "space-between",
  },
  ticketHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ticketDatePill: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ticketDatePillSpecial: {
    backgroundColor: "#EDE7F6",
  },
  ticketDateText: {
    fontFamily: FONTS.semiBold,
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  ticketDateTextSpecial: {
    color: COLORS.primary,
  },
  ticketTimeText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  ticketTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 18,
    marginVertical: 4,
  },
  ticketFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  ticketMetricText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  subFilterContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  subFilterTab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    justifyContent: "center",
    alignItems: "center",
  },
  subFilterTabActive: {
    backgroundColor: "#F2F2F7",
    borderColor: "#D1D1D6",
  },
  subFilterTabText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: "#636366",
  },
  subFilterTabTextActive: {
    fontFamily: FONTS.semiBold,
    color: COLORS.primary,
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: "auto",
  },
  statusTagText: {
    fontFamily: FONTS.semiBold,
    fontSize: 9,
    textTransform: "uppercase",
  },
  // Suggestions section styles
  suggestionsSection: {
    marginBottom: 16,
    paddingTop: 8,
  },
  suggestionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontFamily: "BasicCommercial-Bold",
    color: "#1D1D1F",
  },
  seeAllLink: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.primary,
  },
  suggestionsScroll: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
});
