import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  Image,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import {
  ArrowLeft,
  Users,
  Building2,
  MapPin,
  UserCheck,
  UserPlus,
  ChevronRight,
} from "lucide-react-native";
import { FONTS } from "../../constants/theme";
import { getCollegeMembers, getCollegeCommunities } from "../../api/colleges";
import { followMember, unfollowMember } from "../../api/members";
import { followCommunity, unfollowCommunity } from "../../api/communities";
import HapticsService from "../../services/HapticsService";

const { height: screenHeight } = Dimensions.get("window");
const LIMIT = 30;

/**
 * CollegeEntityListSheet — Sub-sheet for members or communities of a college.
 *
 * Props:
 * - visible: boolean
 * - onClose: () => void
 * - mode: 'members' | 'communities'
 * - collegeId: string (UUID)
 * - collegeName: string
 * - onMemberPress: (memberId) => void
 * - onCommunityPress: (communityId) => void
 * - currentUserId: string — to hide follow button on own profile
 */
export default function CollegeEntityListSheet({
  visible,
  onClose,
  mode = "members",
  collegeId,
  collegeName,
  onMemberPress,
  onCommunityPress,
  currentUserId,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const offsetRef = useRef(0);
  // Map of id -> is_following (optimistic follow state)
  const [followState, setFollowState] = useState({});
  // Map of id -> loading (in-flight follow toggle)
  const [followLoading, setFollowLoading] = useState({});

  const isMemberMode = mode === "members";

  const fetchPage = useCallback(
    async (reset = false) => {
      if (!collegeId) return;
      if (reset) {
        offsetRef.current = 0;
        setItems([]);
        setHasMore(true);
        setError(null);
      }
      if (!reset && !hasMore) return;
      const isFirst = reset || offsetRef.current === 0;
      if (isFirst) setLoading(true);
      else setLoadingMore(true);
      try {
        let data;
        if (isMemberMode) {
          data = await getCollegeMembers(collegeId, {
            limit: LIMIT,
            offset: offsetRef.current,
          });
        } else {
          data = await getCollegeCommunities(collegeId, {
            limit: LIMIT,
            offset: offsetRef.current,
          });
        }
        const fetched = isMemberMode ? data.members || [] : data.communities || [];
        setItems((prev) => (reset ? fetched : [...prev, ...fetched]));
        // Seed follow state map
        const newFollowMap = {};
        fetched.forEach((item) => {
          newFollowMap[item.id] = item.is_following;
        });
        setFollowState((prev) => ({ ...prev, ...newFollowMap }));
        offsetRef.current += fetched.length;
        setHasMore(data.has_more === true);
      } catch (e) {
        setError("Failed to load. Tap to retry.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [collegeId, mode, hasMore, isMemberMode]
  );

  useEffect(() => {
    if (visible && collegeId) {
      fetchPage(true);
    } else if (!visible) {
      setItems([]);
      setFollowState({});
      setError(null);
    }
  }, [visible, collegeId, mode]);

  const handleFollow = useCallback(
    async (item) => {
      const id = item.id;
      const currentlyFollowing = followState[id] ?? item.is_following;
      const next = !currentlyFollowing;

      // Optimistic update
      setFollowState((prev) => ({ ...prev, [id]: next }));
      setFollowLoading((prev) => ({ ...prev, [id]: true }));
      HapticsService.triggerImpactLight();

      try {
        if (isMemberMode) {
          if (next) await followMember(id);
          else await unfollowMember(id);
        } else {
          if (next) await followCommunity(id);
          else await unfollowCommunity(id);
        }
      } catch {
        // Revert on error
        setFollowState((prev) => ({ ...prev, [id]: currentlyFollowing }));
      } finally {
        setFollowLoading((prev) => ({ ...prev, [id]: false }));
      }
    },
    [followState, isMemberMode]
  );

  const renderMember = ({ item }) => {
    const isFollowing = followState[item.id] ?? item.is_following;
    const isSelf = String(item.id) === String(currentUserId);
    const degree = item.occupation_details?.edu_degree || null;

    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => {
          onClose();
          onMemberPress?.(item.id);
        }}
      >
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {item.profile_photo_url ? (
            <Image source={{ uri: item.profile_photo_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>
                {(item.name || "?")[0].toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.metaRow}>
            {item.campus_name ? (
              <View style={styles.metaChip}>
                <MapPin size={10} color="#9CA3AF" strokeWidth={2} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {item.campus_name}
                </Text>
              </View>
            ) : null}
            {degree ? (
              <Text style={styles.metaText} numberOfLines={1}>
                {degree.length > 22 ? degree.slice(0, 22) + "…" : degree}
              </Text>
            ) : item.occupation ? (
              <Text style={styles.metaText} numberOfLines={1}>
                {item.occupation}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Follow button */}
        {!isSelf && (
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followBtnActive]}
            onPress={() => handleFollow(item)}
            disabled={!!followLoading[item.id]}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            {isFollowing ? (
              <UserCheck size={14} color="#2962FF" strokeWidth={2} />
            ) : (
              <UserPlus size={14} color="#FFFFFF" strokeWidth={2} />
            )}
            <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderCommunity = ({ item }) => {
    const isFollowing = followState[item.id] ?? item.is_following;
    const subtypeLabel = item.college_subtype
      ? item.college_subtype
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
      : item.category || "Community";

    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => {
          onClose();
          onCommunityPress?.(item.id);
        }}
      >
        {/* Logo */}
        <View style={styles.communityLogoWrap}>
          {item.logo_url ? (
            <Image source={{ uri: item.logo_url }} style={styles.communityLogo} />
          ) : (
            <View style={[styles.communityLogo, styles.communityLogoFallback]}>
              <Building2 size={16} color="#2962FF" strokeWidth={1.8} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{subtypeLabel}</Text>
            {item.campus_name ? (
              <Text style={styles.metaText}>· {item.campus_name}</Text>
            ) : null}
          </View>
          <View style={styles.metaRow}>
            <Users size={10} color="#9CA3AF" strokeWidth={2} />
            <Text style={styles.metaText}>
              {(item.follower_count || 0).toLocaleString()} followers
            </Text>
          </View>
        </View>

        {/* Follow button */}
        <TouchableOpacity
          style={[styles.followBtn, isFollowing && styles.followBtnActive]}
          onPress={() => handleFollow(item)}
          disabled={!!followLoading[item.id]}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          {isFollowing ? (
            <UserCheck size={14} color="#2962FF" strokeWidth={2} />
          ) : (
            <UserPlus size={14} color="#FFFFFF" strokeWidth={2} />
          )}
          <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
            {isFollowing ? "Following" : "Follow"}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />

          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.sheet}>
              {/* Handle */}
              <View style={styles.handle} />

              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.backBtn}
                >
                  <ArrowLeft size={20} color="#374151" strokeWidth={2} />
                </TouchableOpacity>
                <View style={styles.headerTitles}>
                  <Text style={styles.headerTitle}>
                    {isMemberMode ? "Members" : "Communities"}
                  </Text>
                  {collegeName ? (
                    <Text style={styles.headerSubtitle} numberOfLines={1}>
                      {collegeName}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.divider} />

              {/* Content */}
              {loading ? (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color="#2962FF" />
                </View>
              ) : error ? (
                <TouchableOpacity
                  style={styles.centered}
                  onPress={() => fetchPage(true)}
                >
                  <Text style={styles.errorText}>{error}</Text>
                </TouchableOpacity>
              ) : (
                <FlatList
                  data={items}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={isMemberMode ? renderMember : renderCommunity}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                  onEndReachedThreshold={0.4}
                  onEndReached={() => {
                    if (!loadingMore && hasMore) fetchPage(false);
                  }}
                  ListFooterComponent={
                    loadingMore ? (
                      <ActivityIndicator
                        size="small"
                        color="#2962FF"
                        style={{ marginVertical: 12 }}
                      />
                    ) : null
                  }
                  ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                      {isMemberMode ? (
                        <Users size={32} color="#E5E7EB" strokeWidth={1.5} />
                      ) : (
                        <Building2 size={32} color="#E5E7EB" strokeWidth={1.5} />
                      )}
                      <Text style={styles.emptyText}>
                        {isMemberMode
                          ? "No members found"
                          : "No communities found"}
                      </Text>
                    </View>
                  }
                />
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: screenHeight * 0.75,
    paddingBottom: 34,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 17,
    color: "#0F172A",
  },
  headerSubtitle: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginHorizontal: 16,
  },
  // Rows
  listContent: {
    paddingTop: 4,
    paddingBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F9FAFB",
  },
  // Member avatar
  avatarWrap: {
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  avatarInitial: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 16,
    color: "#2962FF",
  },
  // Community logo
  communityLogoWrap: {
    marginRight: 12,
  },
  communityLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    resizeMode: "cover",
  },
  communityLogoFallback: {
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  // Info
  info: {
    flex: 1,
    marginRight: 10,
  },
  itemName: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: "#0F172A",
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
    flexWrap: "wrap",
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: "#9CA3AF",
  },
  // Follow button
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#2962FF",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 82,
    justifyContent: "center",
  },
  followBtnActive: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  followBtnText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  followBtnTextActive: {
    color: "#2962FF",
  },
  // States
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: "#EF4444",
  },
  emptyWrap: {
    alignItems: "center",
    paddingTop: 48,
    gap: 10,
  },
  emptyText: {
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: "#9CA3AF",
  },
});
