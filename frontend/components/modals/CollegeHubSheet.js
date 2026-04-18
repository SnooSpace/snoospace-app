import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  Image,
  Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import {
  X,
  GraduationCap,
  Users,
  Building2,
  MapPin,
  BadgeCheck,
  Clock,
  ChevronRight,
  UserPlus,
  UserCheck,
} from "lucide-react-native";
import { getAuthToken } from "../../api/auth";
import { apiGet } from "../../api/client";
import { COLORS, FONTS } from "../../constants/theme";
import {
  getGradientForName,
  getInitials,
} from "../../utils/AvatarGenerator";
import SnooLoader from "../ui/SnooLoader";
import CollegeEntityListSheet from "./CollegeEntityListSheet";
import { followCommunity, unfollowCommunity } from "../../api/communities";
import HapticsService from "../../services/HapticsService";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

/**
 * CollegeHubSheet — Bottom sheet showing college details and affiliated communities.
 *
 * Props:
 * - visible: boolean
 * - collegeId: string (UUID)
 * - onClose: () => void
 * - onCommunityPress: (communityId) => void
 */
export default function CollegeHubSheet({
  visible,
  collegeId,
  onClose,
  onCommunityPress,
  onMemberPress,
  currentUserId,
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  // Entity list sub-sheet state
  const [entityListMode, setEntityListMode] = useState(null); // 'members' | 'communities' | null
  // Per-community follow state (optimistic)
  const [followState, setFollowState] = useState({});
  const [followLoading, setFollowLoading] = useState({});

  const fetchHubData = useCallback(async () => {
    if (!collegeId) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const result = await apiGet(
        `/colleges/${collegeId}/hub`,
        15000,
        token
      );
      setData(result);
    } catch (err) {
      console.error("[CollegeHubSheet] Failed to load:", err);
      setError("Failed to load college info");
    } finally {
      setLoading(false);
    }
  }, [collegeId]);

  useEffect(() => {
    if (visible && collegeId) {
      fetchHubData();
    } else if (!visible) {
      setFollowState({});
      setFollowLoading({});
    }
  }, [visible, collegeId, fetchHubData]);

  // When hub data loads, seed follow state from community list
  useEffect(() => {
    if (data?.communities) {
      const map = {};
      data.communities.forEach((c) => { map[c.id] = c.is_following ?? false; });
      setFollowState((prev) => ({ ...prev, ...map }));
    }
  }, [data]);

  const handleCommunityFollow = useCallback(async (community) => {
    const id = community.id;
    const cur = followState[id] ?? false;
    const next = !cur;
    setFollowState((prev) => ({ ...prev, [id]: next }));
    setFollowLoading((prev) => ({ ...prev, [id]: true }));
    HapticsService.triggerImpactLight();
    try {
      if (next) await followCommunity(id);
      else await unfollowCommunity(id);
    } catch {
      setFollowState((prev) => ({ ...prev, [id]: cur }));
    } finally {
      setFollowLoading((prev) => ({ ...prev, [id]: false }));
    }
  }, [followState]);

  if (!visible) return null;

  const college = data?.college;
  const communities = data?.communities || [];
  const isPending = college?.status === "pending";

  const renderCommunityItem = ({ item }) => {
    const initials = getInitials(item.name);
    const gradient = getGradientForName(item.name);
    const isFollowing = followState[item.id] ?? false;

    return (
      <TouchableOpacity
        style={styles.communityItem}
        activeOpacity={0.7}
        onPress={() => {
          if (onCommunityPress) {
            onCommunityPress(item.id);
          }
        }}
      >
        {/* Avatar */}
        {item.logo_url ? (
          <Image source={{ uri: item.logo_url }} style={styles.communityAvatar} />
        ) : (
          <View
            style={[
              styles.communityAvatar,
              { backgroundColor: gradient[0] },
            ]}
          >
            <Text style={styles.communityInitials}>{initials}</Text>
          </View>
        )}

        {/* Info */}
        <View style={styles.communityInfo}>
          <Text style={styles.communityName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.communityMeta} numberOfLines={1}>
            {item.college_subtype
              ? item.college_subtype
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase())
              : item.category || "Community"}
            {item.campus_name ? ` · ${item.campus_name}` : ""}
          </Text>
        </View>

        {/* Follower count */}
        <View style={styles.followerBadge}>
          <Users size={11} color="#6B7280" strokeWidth={2} />
          <Text style={styles.followerCount}>{item.follower_count || 0}</Text>
        </View>

        {/* Follow button */}
        <TouchableOpacity
          style={[styles.followBtn, isFollowing && styles.followBtnActive]}
          onPress={(e) => { e.stopPropagation?.(); handleCommunityFollow(item); }}
          disabled={!!followLoading[item.id]}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          {isFollowing ? (
            <UserCheck size={12} color="#2962FF" strokeWidth={2} />
          ) : (
            <UserPlus size={12} color="#FFF" strokeWidth={2} />
          )}
          <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
            {isFollowing ? "Following" : "Follow"}
          </Text>
        </TouchableOpacity>

        <ChevronRight size={14} color="#D1D5DB" strokeWidth={2} style={{ marginLeft: 4 }} />
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View style={styles.headerContent}>
      {/* College Logo/Icon */}
      <View style={styles.collegeLogoWrap}>
        {college?.logo_url ? (
          <Image
            source={{ uri: college.logo_url }}
            style={styles.collegeLogo}
          />
        ) : (
          <View style={[styles.collegeLogo, styles.collegeLogoFallback]}>
            <GraduationCap size={28} color="#2962FF" strokeWidth={1.5} />
          </View>
        )}
      </View>

      {/* Name + Status */}
      <Text style={styles.collegeName}>
        {college?.name || "College"}
      </Text>

      {college?.abbreviation && (
        <Text style={styles.collegeAbbr}>
          {college.abbreviation}
        </Text>
      )}

      {/* Verification badge */}
      <View
        style={[
          styles.statusBadge,
          isPending ? styles.statusPending : styles.statusApproved,
        ]}
      >
        {isPending ? (
          <>
            <Clock size={12} color="#D97706" strokeWidth={2.5} />
            <Text style={styles.statusTextPending}>Pending Verification</Text>
          </>
        ) : (
          <>
            <BadgeCheck size={12} color="#16A34A" strokeWidth={2.5} />
            <Text style={styles.statusTextApproved}>Verified College</Text>
          </>
        )}
      </View>

      {/* Campus info */}
      {college?.campuses && college.campuses.length > 0 && (
        <View style={styles.campusRow}>
          <MapPin size={13} color="#6B7280" strokeWidth={2} />
          <Text style={styles.campusText}>
            {college.campuses
              .map((c) => `${c.campus_name}${c.city ? `, ${c.city}` : ""}`)
              .join(" · ")}
          </Text>
        </View>
      )}

      {/* Stats Row */}
      <View style={styles.statsRow}>
      <TouchableOpacity
        style={[styles.statItem, { cursor: 'pointer' }]}
        activeOpacity={0.7}
        onPress={() => setEntityListMode('communities')}
      >
        <Building2 size={16} color="#2962FF" strokeWidth={1.8} />
        <Text style={styles.statNumber}>{college?.community_count || 0}</Text>
        <Text style={styles.statLabel}>Communities</Text>
      </TouchableOpacity>
      <View style={styles.statDivider} />
      <TouchableOpacity
        style={styles.statItem}
        activeOpacity={0.7}
        onPress={() => setEntityListMode('members')}
      >
        <Users size={16} color="#2962FF" strokeWidth={1.8} />
        <Text style={styles.statNumber}>{college?.member_count || 0}</Text>
        <Text style={styles.statLabel}>Members</Text>
      </TouchableOpacity>
      </View>

      {/* Communities section header */}
      {communities.length > 0 && (
        <Text style={styles.sectionTitle}>Affiliated Communities</Text>
      )}
    </View>
  );

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
          <BlurView
            intensity={20}
            style={StyleSheet.absoluteFill}
            tint="dark"
          />

          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.sheetContainer}>
              {/* Handle bar */}
              <View style={styles.handleBar} />

              {/* Close button */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#9CA3AF" />
              </TouchableOpacity>

              {loading ? (
                <View style={styles.loadingWrap}>
                  <SnooLoader size="medium" />
                  <Text style={styles.loadingText}>Loading college info...</Text>
                </View>
              ) : error ? (
                <View style={styles.errorWrap}>
                  <Text style={styles.errorText}>{error}</Text>
                  <TouchableOpacity onPress={fetchHubData} style={styles.retryButton}>
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={communities}
                  renderItem={renderCommunityItem}
                  keyExtractor={(item) => String(item.id)}
                  ListHeaderComponent={ListHeader}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                      <Building2 size={32} color="#D1D5DB" strokeWidth={1.5} />
                      <Text style={styles.emptyText}>
                        No affiliated communities yet
                      </Text>
                    </View>
                  }
                />
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>

      {/* Entity list sub-sheet */}
      <CollegeEntityListSheet
        visible={!!entityListMode}
        onClose={() => setEntityListMode(null)}
        mode={entityListMode || 'members'}
        collegeId={collegeId}
        collegeName={data?.college?.name || ''}
        currentUserId={currentUserId}
        onMemberPress={(memberId) => {
          setEntityListMode(null);
          onClose();
          onMemberPress?.(memberId);
        }}
        onCommunityPress={(communityId) => {
          setEntityListMode(null);
          onClose();
          onCommunityPress?.(communityId);
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: screenHeight * 0.75,
    minHeight: screenHeight * 0.4,
    paddingBottom: 34,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  headerContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    alignItems: "center",
  },
  collegeLogoWrap: {
    marginBottom: 12,
  },
  collegeLogo: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  collegeLogoFallback: {
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  collegeName: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 20,
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 2,
  },
  collegeAbbr: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 5,
    marginBottom: 12,
  },
  statusPending: {
    backgroundColor: "#FEF3C7",
  },
  statusApproved: {
    backgroundColor: "#DCFCE7",
  },
  statusTextPending: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 12,
    color: "#D97706",
  },
  statusTextApproved: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 12,
    color: "#16A34A",
  },
  campusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 16,
  },
  campusText: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    color: "#6B7280",
    flexShrink: 1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: "100%",
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statNumber: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 18,
    color: "#0F172A",
  },
  statLabel: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: "#6B7280",
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 12,
  },
  sectionTitle: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: "#374151",
    alignSelf: "flex-start",
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  listContent: {
    paddingBottom: 16,
  },
  communityItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  communityAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  communityInitials: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  communityInfo: {
    flex: 1,
    marginRight: 8,
  },
  communityName: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: "#0F172A",
    lineHeight: 18,
  },
  communityMeta: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 16,
    marginTop: 1,
  },
  followerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginRight: 6,
  },
  followerCount: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: "#6B7280",
  },
  loadingWrap: {
    paddingVertical: 60,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: "#9CA3AF",
  },
  errorWrap: {
    paddingVertical: 60,
    alignItems: "center",
    gap: 12,
  },
  errorText: {
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: "#EF4444",
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
  },
  retryText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 14,
    color: "#374151",
  },
  emptyWrap: {
    paddingVertical: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: "#9CA3AF",
  },
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#2962FF",
    borderRadius: 16,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginRight: 4,
  },
  followBtnActive: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  followBtnText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 11,
    color: "#FFFFFF",
  },
  followBtnTextActive: {
    color: "#2962FF",
  },
});

