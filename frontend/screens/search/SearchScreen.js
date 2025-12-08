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
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';
import { searchMembers, globalSearch } from "../../api/search";
import { searchCommunities } from "../../api/communities";
import { followMember, unfollowMember } from "../../api/members";
import { followCommunity, unfollowCommunity } from "../../api/communities";
import EventBus from "../../utils/EventBus";
import { getAuthToken, getAuthEmail } from "../../api/auth";
import { apiPost } from "../../api/client";
import { getGradientForName, getInitials } from '../../utils/AvatarGenerator';

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
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'member', 'community', 'sponsor', 'venue'

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
      
      // Use global search for all entity types
      try {
        const globalData = await globalSearch(query.trim(), {
          limit: 20,
          offset: nextOffset,
        });

        // Filter results based on active filter
        let filteredResults = globalData.results || [];
        if (activeFilter !== 'all') {
          filteredResults = filteredResults.filter(r => r.type === activeFilter);
        }
        
        const newResults = reset ? filteredResults : [...results, ...filteredResults];
        setResults(newResults);
        
        // initialize following map from payload
        setFollowing((prev) => {
          const copy = { ...prev };
          filteredResults.forEach((r) => {
            if (typeof r.is_following === "boolean")
              copy[r.id] = r.is_following;
          });
          return copy;
        });
        
        const totalResults = filteredResults.length;
        setOffset(nextOffset + totalResults);
        setHasMore(!!globalData.hasMore);
        setLoading(false);
      } catch (err) {
        console.error("Search error:", err);
        setError("Failed to search");
        setLoading(false);
       }
    },
    [query, offset, results, canSearch, activeFilter]
  );

  useEffect(() => {
    const h = setTimeout(() => doSearch(true), DEBOUNCE_MS);
    return () => clearTimeout(h);
  }, [query, activeFilter]); // Trigger search when filter changes

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
    } else if (entityType === 'sponsor') {
      navigation.navigate("SponsorProfile", {
        sponsorId: item.id,
      });
    } else if (entityType === 'venue') {
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
    const fallback = entityType === 'community' ? 'Community' : 'Member';
    if (!name) return fallback;
    return String(name).split(/\r?\n/)[0];
  };

  const renderItem = ({ item }) => {
    const entityType = item.type || 'member';
    const displayName = normalizeDisplayName(item.full_name || item.name, entityType);
    const photoUrl = item.profile_photo_url || item.logo_url;
    const hasValidPhoto = photoUrl && /^https?:\/\//.test(photoUrl);
    
    return (
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.profileRowInner} // Use new style for increased gap
          onPress={() => onPressProfile(item, false)}
        >
          {hasValidPhoto ? (
            <Image
              source={{ uri: photoUrl }}
              style={styles.avatar}
            />
          ) : entityType === 'community' ? (
            <LinearGradient
              colors={getGradientForName(item.name || item.full_name || 'Community')}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.avatar, { justifyContent: 'center', alignItems: 'center' }]}
            >
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#fff' }}>
                {getInitials(item.name || item.full_name || 'C')}
              </Text>
            </LinearGradient>
          ) : (
            <Image
              source={{ uri: "https://via.placeholder.com/64" }}
              style={styles.avatar}
            />
          )}
          <View style={styles.meta}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.name} numberOfLines={1}>
                {displayName}
              </Text>
              {activeFilter === 'all' && (
                <View style={[styles.typeBadge, entityType === 'community' ? styles.typeBadgeCommunity : entityType === 'sponsor' ? styles.typeBadgeSponsor : entityType === 'venue' ? styles.typeBadgeVenue : styles.typeBadgeMember]}>
                  <Text style={styles.typeBadgeText}>
                    {entityType === 'community' ? 'C' : entityType === 'sponsor' ? 'S' : entityType === 'venue' ? 'V' : 'M'}
                  </Text>
                </View>
              )}
            </View>
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
    const displayName = normalizeDisplayName(item.full_name || item.name, entityType);
    const photoUrl = item.profile_photo_url || item.logo_url;
    const hasValidPhoto = photoUrl && /^https?:\/\//.test(photoUrl);
    
    return (
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.profileRowInner} // Use new style for increased gap
          onPress={() => {
            onPressProfile(item, true);
          }}
          activeOpacity={0.7}
        >
          {hasValidPhoto ? (
            <Image
              source={{ uri: photoUrl }}
              style={styles.avatar}
            />
          ) : entityType === 'community' ? (
            <LinearGradient
              colors={getGradientForName(item.name || item.full_name || 'Community')}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.avatar, { justifyContent: 'center', alignItems: 'center' }]}
            >
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#fff' }}>
                {getInitials(item.name || item.full_name || 'C')}
              </Text>
            </LinearGradient>
          ) : (
            <Image
              source={{ uri: "https://via.placeholder.com/64" }}
              style={styles.avatar}
            />
          )}
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
      {/* Header with Search Title - Always Visible */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Search</Text>
      </View>

      {/* Search Input Box */}
      <View style={[styles.searchContainer, focused && styles.searchContainerFocused]}>
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
            <Ionicons name="arrow-back" size={24} color="#1D1D1F" />
          </TouchableOpacity>
        )}
        <View style={[styles.searchBox, focused && { flex: 1 }]}>
          <Ionicons name="search" size={20} color="#8E8E93" />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Search members, communities, sponsors, venues..."
            placeholderTextColor="#8E8E93"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onFocus={() => setFocused(true)}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery("")}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Ionicons name="close-circle" size={20} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContent}
        style={{ flexGrow: 0 }} // Added to prevent expansion
      >
        {['all', 'member', 'community', 'sponsor', 'venue'].map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterTab,
              activeFilter === filter && styles.filterTabActive,
            ]}
            onPress={() => {
              setActiveFilter(filter);
              setResults([]);
              setOffset(0);
            }}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === filter && styles.filterTabTextActive,
              ]}
            >
              {filter === 'all' ? 'All' : filter === 'member' ? 'Members' : filter === 'community' ? 'Communities' : filter === 'sponsor' ? 'Sponsors' : 'Venues'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>


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
            <Text style={{ fontWeight: "600", color: "#1D1D1F", fontSize: 18 }}>Recent</Text>
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
    fontWeight: '700',
    color: '#1D1D1F',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchContainerFocused: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    height: 50,
    gap: 12,
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
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#6A0DAD',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeMember: {
    backgroundColor: '#E3F2FD',
  },
  typeBadgeCommunity: {
    backgroundColor: '#F3E5F5',
  },
  typeBadgeSponsor: {
    backgroundColor: '#FFF3E0',
  },
  typeBadgeVenue: {
    backgroundColor: '#E8F5E9',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D1D1F',
  },
});