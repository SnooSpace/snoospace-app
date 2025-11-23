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
import { searchMembers } from "../../api/search";
import { searchCommunities } from "../../api/communities";
import { followMember, unfollowMember } from "../../api/members";
import { followCommunity, unfollowCommunity } from "../../api/communities";
import EventBus from "../../utils/EventBus";
import { getAuthToken, getAuthEmail } from "../../api/auth";
import { apiPost } from "../../api/client";

const DEBOUNCE_MS = 300;

export default function SearchScreen({ navigation }) {
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
  const [userType, setUserType] = useState(null);

  const canSearch = query.trim().length >= 2;

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
      
      // Search both members and communities in parallel
      const [membersData, communitiesData] = await Promise.all([
        searchMembers(query.trim(), { limit: 20, offset: nextOffset }).catch(() => ({ results: [], hasMore: false })),
        searchCommunities(query.trim(), { limit: 20, offset: nextOffset }).catch(() => ({ results: [], hasMore: false })),
      ]);
      
      // Combine results
      const combinedResults = [
        ...(membersData.results || []).map(r => ({ ...r, type: 'member' })),
        ...(communitiesData.results || []).map(r => ({ ...r, type: 'community', full_name: r.name })),
      ];
      
      const newResults = reset ? combinedResults : [...results, ...combinedResults];
      setResults(newResults);
      
      // initialize following map from payload
      setFollowing((prev) => {
        const copy = { ...prev };
        [...(membersData.results || []), ...(communitiesData.results || [])].forEach((r) => {
          if (typeof r.is_following === "boolean")
            copy[r.id] = r.is_following;
        });
        return copy;
      });
      
      const totalResults = combinedResults.length;
      setOffset(nextOffset + totalResults);
      setHasMore(!!membersData.hasMore || !!communitiesData.hasMore);
      setLoading(false);
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
            setUserType(profileResponse.role || 'member');
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

  const toggleFollow = async (entityId, entityType = 'member') => {
    if (pending[entityId]) return;
    const isFollowing = !!following[entityId];
    setFollowing((prev) => ({ ...prev, [entityId]: !isFollowing }));
    setPending((prev) => ({ ...prev, [entityId]: true }));
    try {
      if (entityType === 'member') {
        if (isFollowing) {
          await unfollowMember(entityId);
        } else {
          await followMember(entityId);
        }
        EventBus.emit("follow-updated", { 
          memberId: entityId, 
          isFollowing: !isFollowing,
          followerId: userId || null,
          followerType: userType || null,
        });
      } else if (entityType === 'community') {
        if (isFollowing) {
          await unfollowCommunity(entityId);
        } else {
          await followCommunity(entityId);
        }
        EventBus.emit("follow-updated", { 
          communityId: entityId, 
          isFollowing: !isFollowing,
          followerId: userId || null,
          followerType: userType || null,
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
    const entityType = item.type || 'member';
    
    // Navigate to appropriate profile
    if (entityType === 'community') {
      navigation.navigate("CommunityPublicProfile", {
        communityId: item.id,
        viewerRole: 'member',
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

  const renderItem = ({ item }) => {
    const entityType = item.type || 'member';
    const displayName = item.full_name || item.name || (entityType === 'community' ? 'Community' : 'Member');
    const photoUrl = item.profile_photo_url || item.logo_url || "https://via.placeholder.com/64";
    
    return (
      <View style={styles.row}>
        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
          onPress={() => onPressProfile(item, false)}
        >
          <Image
            source={{ uri: photoUrl }}
            style={styles.avatar}
          />
          <View style={styles.meta}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.username} numberOfLines={1}>
              @{item.username}
              {entityType === 'community' && item.category && ` • ${item.category}`}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={!!pending[item.id]}
          style={[
            styles.followBtn,
            following[item.id] ? styles.followingBtn : styles.followBtnPrimary,
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
      </View>
    );
  };

  const renderRecentItem = ({ item }) => {
    const entityType = item.type || 'member';
    const displayName = item.full_name || item.name || (entityType === 'community' ? 'Community' : 'Member');
    const photoUrl = item.profile_photo_url || item.logo_url || "https://via.placeholder.com/64";
    
    return (
      <View style={styles.row}>
        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
          onPress={() => {
            onPressProfile(item, true);
          }}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: photoUrl }}
            style={styles.avatar}
          />
          <View style={styles.meta}>
            <Text style={styles.name} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.username} numberOfLines={1}>
              @{item.username}
            </Text>
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
            placeholder="Search members and communities..."
            placeholderTextColor="#8E8E93"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onFocus={() => setFocused(true)}
          />
        </View>
      </View>

      {/* Overlay layer when search is active */}
      {focused && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => {
            Keyboard.dismiss();
            setFocused(false);
            inputRef.current?.blur();
          }}
        />
      )}

      {focused && query.trim().length === 0 ? (
        <View style={styles.contentContainer}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingTop: 8,
            }}
          >
            <Text style={{ fontWeight: "600", color: "#1D1D1F" }}>Recent</Text>
            {recents.length > 0 && (
              <TouchableOpacity
                onPress={async () => {
                  setRecents([]);
                  await saveRecents([]);
                }}
              >
                <Text style={{ color: "#6A0DAD", fontWeight: "600" }}>
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
            data={results}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.6}
            ListEmptyComponent={
              canSearch && !loading ? (
                <View style={styles.helper}>
                  <Text style={styles.helperText}>No members found</Text>
                </View>
              ) : null
            }
            contentContainerStyle={results.length === 0 ? { flexGrow: 1 } : null}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 1,
  },
  contentContainer: {
    flex: 1,
    zIndex: 2,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
    gap: 12,
    zIndex: 3,
  },
  backButton: {
    padding: 4,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 22,
    height: 44,
    gap: 8,
  },
  input: { flex: 1, fontSize: 16, color: "#1D1D1F" },
  helper: { alignItems: "center", paddingVertical: 24 },
  helperText: { color: "#8E8E93" },
  errorText: { color: "#FF3B30" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F2F2F7",
  },
  meta: { flex: 1 },
  name: { fontSize: 16, color: "#1D1D1F", fontWeight: "600" },
  username: { fontSize: 14, color: "#8E8E93", marginTop: 2 },
  bio: { fontSize: 12, color: "#8E8E93", marginTop: 2 },
  followBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  followBtnPrimary: { backgroundColor: "#6A0DAD", borderColor: "#6A0DAD" },
  followingBtn: { backgroundColor: "#FFFFFF", borderColor: "#E5E5EA" },
  followText: { fontSize: 12, fontWeight: "600" },
  followTextPrimary: { color: "#FFFFFF" },
  followingText: { color: "#1D1D1F" },
});