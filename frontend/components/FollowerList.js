import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, TextInput } from "react-native";
import { Image } from "expo-image"; // ── PERF: memory-disk cache eliminates re-fetches on list scroll
import { Pressable as GHPressable, GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { ArrowLeft, Search, X } from "lucide-react-native";
import { COLORS, FONTS } from "../constants/theme";
import PropTypes from "prop-types";
import EventBus from "../utils/EventBus";
import SkeletonUserCard from "./SkeletonUserCard";
import SnooLoader from "./ui/SnooLoader";

const PAGE_SIZE = 30;
const DEFAULT_PRIMARY = COLORS.primary;
const CIRCLE_COLOR = "#448AFF"; // Distinct shade of blue for circle-related chips (Add, In Circle, Requested)

// Helper to create rgba from hex
const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Shared followers/following list component used by both member and community flows.
 */
export default function FollowerList({
  title,
  navigation,
  fetchPage,
  resolveMyId,
  onToggleFollow,
  onItemPress,
  emptyMessage,
  removeOnUnfollow = false,
  viewerType = null,        // e.g. 'community' — used to suppress Follow for member items
  onCircleRequest = null,   // Called when viewer (member) wants to Add a member to circle
  primaryColor = DEFAULT_PRIMARY,
  placeholderImage = "https://via.placeholder.com/64",
}) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [myId, setMyId] = useState(null);
  const [search, setSearch] = useState("");
  // Per-item circle request loading map (for Add button spinner)
  const [circleRequestLoading, setCircleRequestLoading] = useState({});
  const searchTimer = useRef(null);

  useEffect(() => {
    let isMounted = true;
    if (!resolveMyId) {
      return () => {
        isMounted = false;
      };
    }
    (async () => {
      try {
        const result = await resolveMyId();
        if (isMounted && result) {
          // Support both formats: simple ID or { id, type } object
          if (typeof result === "object" && result.id) {
            setMyId(result);
          } else {
            setMyId({ id: result, type: "member" });
          }
        }
      } catch (error) {
        console.warn("[FollowerList] resolveMyId failed", error);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [resolveMyId]);

  const load = useCallback(
    async ({ reset = false, refresh = false, searchQuery = search } = {}) => {
      if (!fetchPage) return;
      if (refresh && refreshing) return;
      if (!reset && loadingMore) return;
      if (!reset && !hasMore) return;

      const nextOffset = reset ? 0 : offset;

      if (refresh) {
        setRefreshing(true);
      } else if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const result = await fetchPage({
          offset: nextOffset,
          limit: PAGE_SIZE,
          search: searchQuery,
        });
        const newItems = Array.isArray(result?.items) ? result.items : [];
        setItems((prev) => {
          const combined = reset ? newItems : [...prev, ...newItems];
          // Duplicate filtering
          const seen = new Set();
          return combined.filter((item) => {
            const id = String(item.id);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
        });
        const received = newItems.length;
        const hasNext =
          typeof result?.hasMore === "boolean"
            ? result.hasMore
            : received >= PAGE_SIZE;
        setHasMore(hasNext);
        setOffset(nextOffset + received);
      } catch (error) {
        console.error("[FollowerList] fetchPage failed", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [fetchPage, hasMore, loadingMore, offset, refreshing, search],
  );

  useEffect(() => {
    load({ reset: true });
  }, []);

  const handleSearchChange = (text) => {
    setSearch(text);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      load({ reset: true, searchQuery: text });
    }, 350);
  };

  // Listen for follow updates from EventBus
  useEffect(() => {
    const handleFollowUpdate = (data) => {
      // Update the isFollowing state for the affected user in the list
      if (data?.id) {
        setItems((prev) => {
          const targetId = String(data.id);

          if (removeOnUnfollow && !data.isFollowing) {
            // Remove item from list if unfollowed
            return prev.filter((item) => String(item.id) !== targetId);
          }

          return prev.map((item) =>
            String(item.id) === targetId
              ? { ...item, isFollowing: data.isFollowing }
              : item,
          );
        });
      }
    };

    EventBus.on("follow-updated", handleFollowUpdate);
    return () => {
      EventBus.off("follow-updated", handleFollowUpdate);
    };
  }, [removeOnUnfollow]);

  // Refresh list when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      load({ reset: true, refresh: true });
    }, []),
  );

  const handleToggleFollow = useCallback(
    async (id, isFollowing, entityType = "member") => {
      if (!onToggleFollow) return;

      // Optimistic update
      setItems((prev) => {
        if (removeOnUnfollow && isFollowing) {
          return prev.filter((item) => String(item.id) !== String(id));
        }
        return prev.map((item) =>
          String(item.id) === String(id)
            ? { ...item, isFollowing: !isFollowing }
            : item,
        );
      });

      try {
        await onToggleFollow(id, isFollowing, entityType);
      } catch (error) {
        console.warn("[FollowerList] onToggleFollow failed", error);
        // On error, let the scroll/focus refresh handle it or re-fetch
        load({ reset: true });
      }
    },
    [onToggleFollow, removeOnUnfollow, load],
  );

  const renderItem = useCallback(
    ({ item }) => {
      const itemType = item.type || 'member';
      // A viewer (member or community) can follow communities, sponsors, venues, or creators.
      // They can only follow regular members if they are already following them (legacy/compatibility).
      const isTargetCreator = !!(item.isCreator || item.is_creator || item.is_creator_mode_enabled);
      const canFollow =
        onToggleFollow &&
        (itemType !== 'member' || isTargetCreator || item.isFollowing);

      // Member viewer can Add a member-type non-circle item to their circle
      const canAdd =
        onCircleRequest &&
        viewerType === 'member' &&
        itemType === 'member' &&
        !item.isCreator &&
        !item.is_creator &&
        !item.is_creator_mode_enabled;

      // Items already in the viewer's circle show an 'In Circle' badge instead of Follow
      const inCircle = !!item.inCircle;

      const isSelf =
        myId &&
        String(myId.id) === String(item.id) &&
        (myId.type || "member").toLowerCase() ===
          (item.type || "member").toLowerCase();

      const isCircleLoading = !!circleRequestLoading[item.id];
      const isRequested = !!item.circleRequested;

      return (
        <View style={styles.row}>
          <GHPressable
            style={styles.userInfo}
            onPress={() => onItemPress && onItemPress(item, myId?.id)}
          >
            <Image
              source={{ uri: item.avatarUrl || placeholderImage }}
              style={styles.avatar}
              cachePolicy="memory-disk"
              contentFit="cover"
            />
            <View style={styles.meta}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name || "Member"}
              </Text>
              {!!item.username && (
                <Text style={styles.username} numberOfLines={1}>
                  @{item.username}
                </Text>
              )}
            </View>
          </GHPressable>

          {/* In Circle badge — member is already in viewer's circle */}
          {inCircle && (
            <View style={[styles.followBtn, styles.inCircleBtn]}>
              <Text style={[styles.followText, { color: CIRCLE_COLOR }]}>In Circle</Text>
            </View>
          )}

          {/* Add / Requested button — member viewer adding a member to circle */}
          {!isSelf && !inCircle && canAdd && (
            <GHPressable
              style={[
                styles.followBtn,
                isRequested
                  ? { backgroundColor: hexToRgba(CIRCLE_COLOR, 0.1), borderColor: hexToRgba(CIRCLE_COLOR, 0.2) }
                  : { backgroundColor: CIRCLE_COLOR, borderColor: CIRCLE_COLOR },
              ]}
              onPress={async () => {
                if (isRequested || isCircleLoading) return;
                setCircleRequestLoading((prev) => ({ ...prev, [item.id]: true }));
                try {
                  await onCircleRequest(item.id);
                  // Mark item as requested in local list state
                  setItems((prev) =>
                    prev.map((i) =>
                      String(i.id) === String(item.id) ? { ...i, circleRequested: true } : i,
                    )
                  );
                } catch (_) {}
                setCircleRequestLoading((prev) => ({ ...prev, [item.id]: false }));
              }}
              disabled={isRequested || isCircleLoading}
            >
              <Text style={[styles.followText, isRequested ? { color: CIRCLE_COLOR } : { color: '#fff' }]}>
                {isCircleLoading ? '…' : isRequested ? 'Requested' : 'Add'}
              </Text>
            </GHPressable>
          )}

          {/* Follow / Following chip — hidden for self, circle members, and community→member or member→member */}
          {!isSelf && !inCircle && canFollow && (
            <GHPressable
              style={[
                styles.followBtn,
                item.isFollowing
                  ? {
                      backgroundColor: hexToRgba(primaryColor, 0.12),
                      borderColor: hexToRgba(primaryColor, 0.2),
                    }
                  : {
                      backgroundColor: primaryColor,
                      borderColor: primaryColor,
                    },
              ]}
              onPress={() =>
                handleToggleFollow(
                  item.id,
                  !!item.isFollowing,
                  item.type || "member",
                )
              }
            >
              <Text
                style={[
                  styles.followText,
                  item.isFollowing
                    ? { color: primaryColor }
                    : { color: "#FFFFFF" },
                ]}
              >
                {item.isFollowing ? "Following" : "Follow"}
              </Text>
            </GHPressable>
          )}
        </View>
      );
    },
    [
      handleToggleFollow,
      myId,
      onItemPress,
      onToggleFollow,
      onCircleRequest,
      placeholderImage,
      primaryColor,
      viewerType,
      circleRequestLoading,
    ],
  );

  // Memoized extraData — forces FlatList item re-renders when async state resolves.
  // Must be declared here (top level) to satisfy React's Rules of Hooks.
  const flatListExtraData = useMemo(
    () => ({ viewerType, onCircleRequest, myId, circleRequestLoading, primaryColor }),
    [viewerType, onCircleRequest, myId, circleRequestLoading, primaryColor],
  );

  const listEmptyComponent = useMemo(() => {
    if (loading) return null;
    if (search) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No results found for "{search}"</Text>
        </View>
      );
    }
    if (!emptyMessage) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }, [emptyMessage, loading, search]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <GHPressable
            onPress={() => navigation?.goBack?.()}
            style={styles.backBtn}
          >
            <ArrowLeft size={24} color="#1D1D1F" />
          </GHPressable>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={16} color="#8E8E93" strokeWidth={2} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor="#8E8E93"
              value={search}
              onChangeText={handleSearchChange}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => handleSearchChange("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={16} color="#8E8E93" strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>
        </View>

      {loading && items.length === 0 ? (
        <View style={styles.loadingContainer}>
          {Array.from({ length: 10 }).map((_, index) => (
            <SkeletonUserCard key={index} />
          ))}
        </View>
      ) : (
      <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          extraData={flatListExtraData}
          onEndReachedThreshold={0.6}
          onEndReached={() => load({ reset: false, searchQuery: search })}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load({ reset: true, refresh: true, searchQuery: search })}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <SnooLoader
                style={styles.footerLoader}
                color={primaryColor}
              />
            ) : null
          }
          ListEmptyComponent={listEmptyComponent}
        />
      )}
      </View>
    </GestureHandlerRootView>
  );
}

FollowerList.propTypes = {
  title: PropTypes.string.isRequired,
  navigation: PropTypes.shape({
    goBack: PropTypes.func,
    getParent: PropTypes.func,
  }),
  fetchPage: PropTypes.func.isRequired,
  resolveMyId: PropTypes.func,
  onToggleFollow: PropTypes.func,
  onItemPress: PropTypes.func,
  emptyMessage: PropTypes.string,
  viewerType: PropTypes.string,
  primaryColor: PropTypes.string,
  placeholderImage: PropTypes.string,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 8,
    // borderBottomWidth: 1, // Removed to "remove" header visual
    // borderBottomColor: "#E5E5EA",
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontFamily: "BasicCommercial-Bold", // Updated to Bold
    color: "#1D1D1F",
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 40,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F2F2F7",
  },
  meta: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    color: "#1D1D1F",
    fontFamily: "BasicCommercial-Bold", // Updated font
  },
  username: {
    fontSize: 14,
    color: "#8E8E93",
    marginTop: 2,
    fontFamily: "Manrope-Medium", // Updated font
  },
  followBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  inCircleBtn: {
    backgroundColor: hexToRgba(CIRCLE_COLOR, 0.08),
    borderColor: hexToRgba(CIRCLE_COLOR, 0.2),
  },
  followText: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: FONTS.medium,
  },
  loadingContainer: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyText: {
    color: "#8E8E93",
    fontSize: 16,
    textAlign: "center",
  },
  footerLoader: {
    marginVertical: 16,
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Manrope-Regular",
    fontSize: 15,
    color: "#1C1C1E",
    padding: 0,
  },
});

FollowerList.propTypes = {
  title: PropTypes.string.isRequired,
  navigation: PropTypes.shape({
    goBack: PropTypes.func,
    getParent: PropTypes.func,
  }),
  fetchPage: PropTypes.func.isRequired,
  resolveMyId: PropTypes.func,
  onToggleFollow: PropTypes.func,
  onItemPress: PropTypes.func,
  emptyMessage: PropTypes.string,
  viewerType: PropTypes.string,
  primaryColor: PropTypes.string,
  placeholderImage: PropTypes.string,
};
