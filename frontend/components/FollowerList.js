import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { ArrowLeft } from "lucide-react-native";
import { COLORS, FONTS } from "../constants/theme";
import PropTypes from "prop-types";
import EventBus from "../utils/EventBus";
import SkeletonUserCard from "./SkeletonUserCard";

const PAGE_SIZE = 30;
const DEFAULT_PRIMARY = COLORS.primary;

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
  removeOnUnfollow = false, // New prop to remove items from list when unfollowed
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
    async ({ reset = false, refresh = false } = {}) => {
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
    [fetchPage, hasMore, loadingMore, offset, refreshing],
  );

  useEffect(() => {
    load({ reset: true });
  }, []);

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
    ({ item }) => (
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => onItemPress && onItemPress(item, myId?.id)}
        >
          <Image
            source={{ uri: item.avatarUrl || placeholderImage }}
            style={styles.avatar}
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
        </TouchableOpacity>
        {/* Hide follow button if this item is the current user (comparing both ID and type) */}
        {!(
          myId &&
          String(myId.id) === String(item.id) &&
          (myId.type || "member").toLowerCase() ===
            (item.type || "member").toLowerCase()
        ) &&
          onToggleFollow && (
            <TouchableOpacity
              style={[
                styles.followBtn,
                item.isFollowing
                  ? styles.followingBtn(primaryColor)
                  : styles.followBtnPrimary(primaryColor),
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
                    ? styles.followingText(primaryColor)
                    : styles.followTextPrimary,
                ]}
              >
                {item.isFollowing ? "Following" : "Follow"}
              </Text>
            </TouchableOpacity>
          )}
      </View>
    ),
    [
      handleToggleFollow,
      myId,
      onItemPress,
      onToggleFollow,
      placeholderImage,
      primaryColor,
    ],
  );

  const listEmptyComponent = useMemo(() => {
    if (loading) return null;
    if (!emptyMessage) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }, [emptyMessage, loading]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => navigation?.goBack?.()}
          style={styles.backBtn}
        >
          <ArrowLeft size={24} color="#1D1D1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerSpacer} />
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
          onEndReachedThreshold={0.6}
          onEndReached={() => load({ reset: false })}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load({ reset: true, refresh: true })}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                style={styles.footerLoader}
                color={primaryColor}
              />
            ) : null
          }
          ListEmptyComponent={listEmptyComponent}
        />
      )}
    </View>
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
    fontSize: 16,
    fontFamily: "BasicCommercial-Black", // Updated font
    color: "#1D1D1F",
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  followBtnPrimary: (primaryColor) => ({
    backgroundColor: primaryColor,
    borderColor: primaryColor,
  }),
  followingBtn: (primaryColor) => {
    // Dynamic tinted background for following state
    const bg = hexToRgba(primaryColor, 0.12);
    const border = hexToRgba(primaryColor, 0.2);
    return {
      backgroundColor: bg,
      borderColor: border,
    };
  },
  followText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: FONTS.semiBold,
  },
  followTextPrimary: {
    color: "#FFFFFF",
    fontFamily: FONTS.semiBold,
  },
  followingText: (primaryColor) => ({
    color: primaryColor,
    fontFamily: FONTS.medium,
  }),
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
  primaryColor: PropTypes.string,
  placeholderImage: PropTypes.string,
};
