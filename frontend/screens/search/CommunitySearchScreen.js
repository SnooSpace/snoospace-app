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
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { searchCommunities, followCommunity, unfollowCommunity } from "../../api/communities";
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
    return userId ? `recent_community_searches_${userId}` : "recent_community_searches";
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

  const saveRecents = useCallback(async (items) => {
    if (!userId) return;
    try {
      const key = getRecentsKey();
      await AsyncStorage.setItem(key, JSON.stringify(items));
    } catch {}
  }, [userId]);

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
      const p = searchCommunities(query.trim(), { limit: 20, offset: nextOffset });
      inFlightRef.current = p;
      try {
        const data = await p;
        if (inFlightRef.current !== p) return; // stale
        const newResults = reset ? data.results : [...results, ...data.results];
        setResults(newResults);
        // initialize following map from payload
        setFollowing((prev) => {
          const copy = { ...prev };
          (data.results || []).forEach((r) => {
            if (typeof r.is_following === "boolean")
              copy[r.id] = r.is_following;
          });
          return copy;
        });
        setOffset(data.nextOffset || nextOffset + (data.results?.length || 0));
        setHasMore(!!data.hasMore);
      } catch (e) {
        if (inFlightRef.current !== p) return;
        setError(e?.message || "Failed to search");
      } finally {
        if (inFlightRef.current === p) setLoading(false);
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
          const profileResponse = await apiPost('/auth/get-user-profile', { email }, 10000, token);
          if (profileResponse?.profile?.id) {
            setUserId(profileResponse.profile.id);
          }
        }
      } catch (error) {
        console.error('Error loading user ID:', error);
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

  const toggleFollow = async (communityId) => {
    if (pending[communityId]) return;
    const isFollowing = !!following[communityId];
    setFollowing((prev) => ({ ...prev, [communityId]: !isFollowing }));
    setPending((prev) => ({ ...prev, [communityId]: true }));
    try {
      if (isFollowing) {
        await unfollowCommunity(communityId);
      } else {
        await followCommunity(communityId);
      }
      EventBus.emit("follow-updated", { communityId, isFollowing: !isFollowing });
    } catch (e) {
      // rollback on error
      setFollowing((prev) => ({ ...prev, [communityId]: isFollowing }));
    } finally {
      setPending((prev) => ({ ...prev, [communityId]: false }));
    }
  };

  const onPressProfile = async (item, fromRecent = false) => {
    // Navigate to profile
    navigation.navigate("CommunityPublicProfile", {
      communityId: item.id,
    });

    // update recents (dedup by id, newest first, max 10)
    const next = [
      {
        id: item.id,
        username: item.username,
        name: item.name,
        logo_url: item.logo_url,
      },
      ...recents.filter((r) => r.id !== item.id),
    ].slice(0, 10);
    setRecents(next);
    saveRecents(next);
  };

  const renderItem = ({ item }) => (
    <View style={styles.row}>
      <TouchableOpacity
        style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
        onPress={() => onPressProfile(item, false)}
      >
        <Image
          source={{
            uri: item.logo_url || "https://via.placeholder.com/64",
          }}
          style={styles.avatar}
        />
        <View style={styles.meta}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name || "Community"}
          </Text>
          {item.username && (
            <Text style={styles.username} numberOfLines={1}>
              @{item.username}
            </Text>
          )}
          {item.category && (
            <Text style={styles.category} numberOfLines={1}>
              {item.category}
            </Text>
          )}
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        disabled={!!pending[item.id]}
        style={[
          styles.followBtn,
          following[item.id] ? styles.followingBtn : styles.followBtnPrimary,
          pending[item.id] ? { opacity: 0.6 } : null,
        ]}
        onPress={() => toggleFollow(item.id)}
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
    </View>
  );

  const renderRecentItem = ({ item }) => (
    <View style={styles.row}>
      <TouchableOpacity
        style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
        onPress={() => {
          onPressProfile(item, true);
        }}
        activeOpacity={0.7}
      >
        <Image
          source={{
            uri: item.logo_url || "https://via.placeholder.com/64",
          }}
          style={styles.avatar}
        />
        <View style={styles.meta}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name || "Community"}
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
          const next = recents.filter((r) => r.id !== item.id);
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

