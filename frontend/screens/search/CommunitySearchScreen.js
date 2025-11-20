import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  TextInput,
  FlatList,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import {
  searchCommunities,
  followCommunity,
  unfollowCommunity,
} from "../../api/communities";
import { searchMembers, globalSearch } from "../../api/search";
import { followMember, unfollowMember } from "../../api/members";
import EventBus from "../../utils/EventBus";
import { getAuthToken, getAuthEmail } from "../../api/auth";
import { apiPost } from "../../api/client";

const DEBOUNCE_MS = 300;

export default function CommunitySearchScreen({ navigation }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [following, setFollowing] = useState({}); // id -> boolean
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

  const canSearch = query.trim().length >= 2;

  const getRecentsKey = () => {
    return userId
      ? `recent_community_searches_${userId}`
      : "recent_community_searches";
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
    [userId]
  );

  const doSearch = useCallback(
    async (reset = false) => {
      if (!canSearch) {
        setResults([]);
        setOffset(0);
        setHasMore(false);
        setLoading(false);
        setError("");
        return;
      }
      const nextOffset = reset ? 0 : offset;
      setLoading(true);
      setError("");

      // Use global search endpoint that searches all entity types
      try {
        const globalData = await globalSearch(query.trim(), {
          limit: 20,
          offset: nextOffset,
        });

        // Global search returns results with type already set
        const combinedResults = globalData.results || [];

        const newResults = reset
          ? combinedResults
          : [...results, ...combinedResults];
        setResults(newResults);

        // initialize following map from payload
        setFollowing((prev) => {
          const copy = { ...prev };
          combinedResults.forEach((r) => {
            if (typeof r.is_following === "boolean")
              copy[r.id] = r.is_following;
          });
          return copy;
        });

        const totalResults = combinedResults.length;
        setOffset(nextOffset + totalResults);
        setHasMore(!!globalData.hasMore);
        setLoading(false);
      } catch (err) {
        console.error("Global search error:", err);
        setError("Failed to search");
        setLoading(false);
      }
    },
    [query, offset, results, canSearch]
  );

  useEffect(() => {
    const h = setTimeout(() => doSearch(true), DEBOUNCE_MS);
    return () => clearTimeout(h);
  }, [query, doSearch]);

  useEffect(() => {
    // Load user ID on mount
    const loadUserId = async () => {
      try {
        const token = await getAuthToken();
        const email = await getAuthEmail();
        if (token && email) {
          const profileResponse = await apiPost(
            "/auth/get-user-profile",
            { email },
            10000,
            token
          );
          if (profileResponse?.profile?.id) {
            setUserId(profileResponse.profile.id);
          }
        }
      } catch (error) {
        console.error("Error loading user ID:", error);
      }
    };
    loadUserId();
  }, []);

  useEffect(() => {
    if (userId) {
      loadRecents();
    }
  }, [userId, loadRecents]);

  const onEndReached = useCallback(() => {
    if (loading || !hasMore) return;
    doSearch(false);
  }, [loading, hasMore, doSearch]);

  const toggleFollow = async (entityId, entityType = "community") => {
    if (pending[entityId]) return;
    const isFollowing = !!following[entityId];
    setFollowing((prev) => ({ ...prev, [entityId]: !isFollowing }));
    setPending((prev) => ({ ...prev, [entityId]: true }));
    try {
      // Use userId from state if available
      const currentUserId = userId;
      const currentUserType = "community";

      if (entityType === "member") {
        if (isFollowing) {
          await unfollowMember(entityId);
        } else {
          await followMember(entityId);
        }
        EventBus.emit("follow-updated", {
          memberId: entityId,
          isFollowing: !isFollowing,
          followerId: currentUserId,
          followerType: currentUserType,
        });
      } else {
        if (isFollowing) {
          await unfollowCommunity(entityId);
        } else {
          await followCommunity(entityId);
        }
        EventBus.emit("follow-updated", {
          communityId: entityId,
          isFollowing: !isFollowing,
          followerId: currentUserId,
          followerType: currentUserType,
        });
      }
    } catch (e) {
      // rollback on error
      setFollowing((prev) => ({ ...prev, [entityId]: isFollowing }));
    } finally {
      setPending((prev) => ({ ...prev, [entityId]: false }));
    }
  };

  const onPressProfile = async (item, fromRecent = false) => {
    const entityType = item.type || "community";

    // Navigate to appropriate profile within Community navigation stack
    if (entityType === "community") {
      navigation.navigate("CommunityPublicProfile", {
        communityId: item.id,
      });
    } else if (entityType === "member") {
      // Navigate to member profile within Community's Profile stack
      navigation.navigate("Profile", {
        screen: "MemberPublicProfile",
        params: { memberId: item.id },
      });
    } else if (entityType === "sponsor") {
      // Sponsor profile navigation will be implemented later
      Alert.alert(
        "Sponsor Profile",
        "Sponsor profile navigation will be implemented soon"
      );
    } else if (entityType === "venue") {
      // Venue profile navigation will be implemented later
      Alert.alert(
        "Venue Profile",
        "Venue profile navigation will be implemented soon"
      );
    }

    // update recents (dedup by id, newest first, max 10)
    const next = [
      {
        id: item.id,
        type: entityType,
        username: item.username,
        name: item.name || item.full_name,
        full_name: item.full_name || item.name,
        logo_url: item.logo_url,
        profile_photo_url: item.profile_photo_url,
      },
      ...recents.filter((r) => r.id !== item.id || r.type !== entityType),
    ].slice(0, 10);
    setRecents(next);
    saveRecents(next);
  };

  const renderItem = ({ item }) => {
    const entityType = item.type || "community";
    const displayName =
      item.full_name ||
      item.name ||
      (entityType === "community"
        ? "Community"
        : entityType === "member"
        ? "Member"
        : entityType === "sponsor"
        ? "Sponsor"
        : entityType === "venue"
        ? "Venue"
        : "User");
    const photoUrl =
      item.profile_photo_url ||
      item.logo_url ||
      "https://via.placeholder.com/64";

    // Build subtitle text
    let subtitle = "";
    if (item.username) {
      subtitle = `@${item.username}`;
    }
    if (entityType === "community" && item.category) {
      subtitle += ` • ${item.category}`;
    } else if (entityType === "sponsor" && item.category) {
      subtitle += ` • ${item.category}`;
    } else if (entityType === "venue" && item.city) {
      subtitle += ` • ${item.city}`;
    }

    return (
      <View style={styles.row}>
        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
          onPress={() => onPressProfile(item, false)}
        >
          <Image source={{ uri: photoUrl }} style={styles.avatar} />
          <View style={styles.meta}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            {subtitle && (
              <Text style={styles.username} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        {(entityType === "member" || entityType === "community") && (
          <TouchableOpacity
            disabled={!!pending[item.id]}
            style={[
              styles.followBtn,
              following[item.id]
                ? styles.followingBtn
                : styles.followBtnPrimary,
              pending[item.id] ? { opacity: 0.6 } : null,
            ]}
            onPress={() => toggleFollow(item.id, entityType)}
          >
            <Text
              style={[
                styles.followText,
                following[item.id]
                  ? styles.followingText
                  : styles.followTextPrimary,
              ]}
            >
              {following[item.id] ? "Following" : "Follow"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderRecentItem = ({ item }) => {
    const entityType = item.type || "community";
    const displayName =
      item.full_name ||
      item.name ||
      (entityType === "community"
        ? "Community"
        : entityType === "member"
        ? "Member"
        : entityType === "sponsor"
        ? "Sponsor"
        : entityType === "venue"
        ? "Venue"
        : "User");
    const photoUrl =
      item.profile_photo_url ||
      item.logo_url ||
      "https://via.placeholder.com/64";

    return (
      <View style={styles.row}>
        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
          onPress={() => {
            onPressProfile(item, true);
          }}
          activeOpacity={0.7}
        >
          <Image source={{ uri: photoUrl }} style={styles.avatar} />
          <View style={styles.meta}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            {item.username && (
              <Text style={styles.username} numberOfLines={1}>
                @{item.username}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            const next = recents.filter(
              (r) => r.id !== item.id || r.type !== entityType
            );
            setRecents(next);
            saveRecents(next);
          }}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          style={[styles.followBtn, styles.followingBtn]}
        >
          <Ionicons name="close" size={16} color="#1D1D1F" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Back Button and Search Bar - Combined */}
      <View style={styles.headerContainer}>
        {focused && (
          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              setQuery("");
              setFocused(false);
              setResults([]);
              setError("");
              inputRef.current?.blur();
            }}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#1D1D1F" />
          </TouchableOpacity>
        )}

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#8E8E93" />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Search communities by name or username"
            placeholderTextColor="#8E8E93"
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              if (!query.trim()) setFocused(false);
            }}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setQuery("");
                setResults([]);
                setError("");
                inputRef.current?.blur();
              }}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Ionicons name="close-circle" size={20} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && results.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6A0DAD" />
        </View>
      ) : query.trim().length < 2 && recents.length > 0 ? (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Recent Searches</Text>
          <FlatList
            data={recents}
            renderItem={renderRecentItem}
            keyExtractor={(item) => `recent-${item.id}`}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No recent searches</Text>
            }
          />
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => `result-${item.id}`}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading && results.length > 0 ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#6A0DAD" />
              </View>
            ) : null
          }
        />
      ) : query.trim().length >= 2 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No communities found</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  backButton: {
    marginRight: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1D1D1F",
    padding: 0,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: "#FFEBEE",
  },
  errorText: {
    color: "#C62828",
    fontSize: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1D1D1F",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#E5E5EA",
    marginRight: 12,
  },
  meta: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1D1D1F",
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: "#8E8E93",
  },
  category: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 2,
  },
  followBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
  },
  followBtnPrimary: {
    backgroundColor: "#6A0DAD",
  },
  followingBtn: {
    backgroundColor: "#F2F2F7",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  followText: {
    fontSize: 14,
    fontWeight: "600",
  },
  followTextPrimary: {
    color: "#FFFFFF",
  },
  followingText: {
    color: "#1D1D1F",
  },
  emptyText: {
    fontSize: 16,
    color: "#8E8E93",
    textAlign: "center",
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
  },
});
