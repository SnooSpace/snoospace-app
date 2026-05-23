import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
  Animated,
  Dimensions,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { getAuthToken, getActiveAccount } from "../api/auth";
import {
  COLORS,
  FONTS,
  BORDER_RADIUS,
  SPACING,
  EDITORIAL_TYPOGRAPHY,
  EDITORIAL_SPACING,
} from "../constants/theme";
import {
  Heart,
  MessageCircle,
  ChartNoAxesCombined,
  Send,
  Bookmark,
  MoreHorizontal,
  Briefcase,
  Globe,
  Coins,
  ArrowRight,
  Clock,
  Pin,
  Pencil,
  Trash2,
} from "lucide-react-native";
import { apiPost, apiDelete } from "../api/client";
import { closeOpportunity } from "../api/opportunities";
import CountdownTimer from "./CountdownTimer";


// ── Auto-scrolling Marquee Chips Component ─────────────────────────────────
const MarqueeChips = ({ chips, chipType, styles }) => {
  const scrollViewRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [contentWidth, setContentWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const animationRef = useRef(null);

  useEffect(() => {
    const listenerId = scrollX.addListener(({ value }) => {
      scrollViewRef.current?.scrollTo({ x: value, animated: false });
    });
    return () => {
      scrollX.removeListener(listenerId);
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (animationRef.current) {
      animationRef.current.stop();
    }
    scrollX.setValue(0);

    const maxScroll = contentWidth - containerWidth;
    if (maxScroll > 0) {
      const duration = maxScroll * 50; // 50ms per pixel
      animationRef.current = Animated.loop(
        Animated.sequence([
          Animated.delay(1200),
          Animated.timing(scrollX, {
            toValue: maxScroll,
            duration: duration,
            useNativeDriver: false,
          }),
          Animated.delay(1500),
          Animated.timing(scrollX, {
            toValue: 0,
            duration: duration,
            useNativeDriver: false,
          }),
        ])
      );
      animationRef.current.start();
    }
  }, [contentWidth, containerWidth, chips]);

  return (
    <ScrollView
      ref={scrollViewRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEnabled={false}
      style={styles.chipsRow}
      contentContainerStyle={styles.chipsContent}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      onContentSizeChange={(w) => setContentWidth(w)}
    >
      {chips.map((item, index) => (
        <View
          key={`${chipType}-${index}`}
          style={chipType === "role" ? styles.roleChip : styles.skillChip}
        >
          <Text
            style={chipType === "role" ? styles.roleChipText : styles.skillChipText}
          >
            {item}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
};

const OpportunityFeedCard = ({
  opportunity,
  onPress,
  onLike,
  onComment,
  onShare,
  onSave,
  onDelete,                  // (opportunityId) => void — called after successful delete
  onUserPress,               // (userId, userType) => void — navigate to profile
  onPinToggle,               // Optional: shown only for owner view
  onPostUpdate,              // Optional: called when post is updated
  showManagementControls = false, // When true, shows pin + 3-dot menu for owners (Profile screens only)
}) => {
  const navigation = useNavigation();
  const [currentUserId, setCurrentUserId] = useState(null);

  // ── 3-dot menu state ────────────────────────────────────────────────────────
  const [menuVisible, setMenuVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const menuAnim = useRef(new Animated.Value(0)).current;

  const openMenu = () => {
    setMenuVisible(true);
    Animated.spring(menuAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(menuAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setMenuVisible(false));
  };

  const menuTranslateY = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [200, 0],
  });

  // ── Current user detection ─────────────────────────────────────────────────
  React.useEffect(() => {
    const fetchUser = async () => {
      const account = await getActiveAccount();
      if (account?.id) {
        setCurrentUserId(account.id);
      }
    };
    fetchUser();
  }, [opportunity.creator_id]);

  const isCreator = currentUserId && opportunity.creator_id == currentUserId;

  // ── Time formatting ────────────────────────────────────────────────────────
  const formatTimeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // ── Work mode / type / compensation helpers ────────────────────────────────
  const getWorkModeText = () => {
    if (opportunity.work_mode === "hybrid") return "Hybrid";
    if (opportunity.work_mode === "remote") return "Remote";
    if (opportunity.work_mode === "on_site") return "On-site";
    return opportunity.work_mode || "Remote";
  };

  const getWorkTypeText = () => {
    const type = opportunity.work_type === "one_time" ? "One-time" : "Ongoing";
    return opportunity.availability ? `${type} (${opportunity.availability})` : type;
  };

  const getCompensationText = () => {
    if (opportunity.payment_nature === "exposure") return "Exposure";
    if (opportunity.payment_nature === "revenue_share") return "Rev Share";
    if (opportunity.payment_nature === "trial") {
      const trialPrefix =
        opportunity.trial_type === "free_trial" ? "Free Trial" : "Paid Trial";
      return opportunity.budget_range
        ? `${trialPrefix} (${opportunity.budget_range})`
        : trialPrefix;
    }
    if (opportunity.payment_nature === "paid") {
      const payType = opportunity.payment_type
        ? ` (${
            opportunity.payment_type === "per_deliverable"
              ? "Task"
              : opportunity.payment_type === "monthly"
              ? "Mo"
              : "Fixed"
          })`
        : "";
      return opportunity.budget_range
        ? `${opportunity.budget_range}${payType}`
        : `Paid${payType}`;
    }
    return opportunity.budget_range || opportunity.payment_nature || "Negotiable";
  };

  // ── Chip helpers — separated roles vs skills ───────────────────────────────
  const getRoleChips = () => {
    const roles = opportunity.opportunity_types || opportunity.roles || [];
    return Array.isArray(roles) ? roles.slice(0, 3) : [];
  };

  const getSkillChips = () => {
    const tools = [];
    if (opportunity.skill_groups && Array.isArray(opportunity.skill_groups)) {
      opportunity.skill_groups.forEach((group) => {
        // tools can come back as a JS array, a stringified JSON array, or null
        let groupTools = group.tools;
        if (!groupTools) return;
        if (typeof groupTools === "string") {
          try { groupTools = JSON.parse(groupTools); } catch { groupTools = [groupTools]; }
        }
        if (Array.isArray(groupTools)) {
          groupTools.forEach((tool) => {
            if (tool && !tools.includes(tool)) tools.push(tool);
          });
        }
      });
    }
    return tools.slice(0, 8);
  };

  const roleChips = getRoleChips();
  const skillChips = getSkillChips();

  // ── Engagement state ───────────────────────────────────────────────────────
  const initialIsLiked = opportunity.is_liked === true;
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(opportunity.like_count || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [isSaved, setIsSaved] = useState(opportunity.is_saved || false);

  // ── View Tracking (opportunity-specific endpoint) ─────────────────────────
  const [viewCount, setViewCount] = useState(
    opportunity.view_count || opportunity.public_view_count || 0,
  );
  const dwellTimerRef = useRef(null);
  const hasTrackedView = useRef(false);

  useEffect(() => {
    hasTrackedView.current = false;
    const DWELL_THRESHOLD = 2500;
    dwellTimerRef.current = setTimeout(async () => {
      if (hasTrackedView.current) return;
      hasTrackedView.current = true;
      try {
        const token = await getAuthToken();
        const res = await apiPost(
          `/opportunities/${opportunity.id}/view`,
          {},
          10000,
          token,
        );
        if (res?.is_new) {
          setViewCount((prev) => prev + 1);
        }
      } catch (_e) {
        // non-fatal
      }
    }, DWELL_THRESHOLD);
    return () => {
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    };
  }, [opportunity.id]);

  // ── Like handler (opportunity-specific endpoint) ──────────────────────────
  const handleLike = async () => {
    if (isLiking) return;

    const prevLiked = isLiked;
    const prevLikeCount = likeCount;
    const nextLiked = !prevLiked;
    const delta = nextLiked ? 1 : -1;
    const nextLikes = Math.max(0, prevLikeCount + delta);

    setIsLiked(nextLiked);
    setLikeCount(nextLikes);
    if (onLike) onLike(opportunity.id, nextLiked, nextLikes);

    setIsLiking(true);
    try {
      const token = await getAuthToken();
      if (nextLiked) {
        await apiPost(`/opportunities/${opportunity.id}/like`, {}, 15000, token);
      } else {
        await apiDelete(`/opportunities/${opportunity.id}/like`, null, 15000, token);
      }
    } catch (error) {
      console.error("Error liking opportunity:", error);
      setIsLiked(prevLiked);
      setLikeCount(prevLikeCount);
      if (onLike) onLike(opportunity.id, prevLiked, prevLikeCount);
    } finally {
      setIsLiking(false);
    }
  };

  // ── Save handler (opportunity-specific endpoint) ──────────────────────────
  const handleSave = async () => {
    const newSaveState = !isSaved;
    setIsSaved(newSaveState);
    try {
      const token = await getAuthToken();
      if (newSaveState) {
        await apiPost(`/opportunities/${opportunity.id}/save`, {}, 15000, token);
      } else {
        await apiDelete(`/opportunities/${opportunity.id}/save`, null, 15000, token);
      }
    } catch (error) {
      console.error("Failed to save/unsave opportunity:", error);
      setIsSaved(!newSaveState);
    }
  };

  // ── Delete handler ─────────────────────────────────────────────────────────
  const handleDelete = async () => {
    closeMenu();
    setIsDeleting(true);
    try {
      await closeOpportunity(opportunity.id, "delete");
      EventBus.emit("opportunityDeleted", opportunity.id);
      if (onDelete) onDelete(opportunity.id);
    } catch (error) {
      console.error("Error deleting opportunity:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Author press handler ───────────────────────────────────────────────────
  const handleAuthorPress = () => {
    if (onUserPress) {
      onUserPress(opportunity.creator_id, opportunity.creator_type || "community");
      return;
    }
    // Fallback: try navigation directly
    const creatorType = opportunity.creator_type || "community";
    if (creatorType === "community") {
      navigation.navigate("CommunityPublicProfile", {
        communityId: opportunity.creator_id,
        viewerRole: "member",
      });
    } else {
      navigation.navigate("MemberPublicProfile", {
        memberId: opportunity.creator_id,
      });
    }
  };


  const handleComment = () => {
    if (onComment) onComment(opportunity.id);
  };

  const handleShare = () => {
    if (onShare) onShare(opportunity.id);
  };

  // ── Count formatter ────────────────────────────────────────────────────────
  const formatCount = (count) => {
    if (!count || count === 0) return "0";
    if (count < 1000) return count.toString();
    if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
    if (count < 1000000) return `${Math.floor(count / 1000)}k`;
    return `${(count / 1000000).toFixed(1)}m`;
  };

  const isClosed =
    opportunity.closed_at ||
    (opportunity.expires_at && new Date(opportunity.expires_at) < new Date());

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={() => onPress?.(opportunity)}>
      <LinearGradient
        colors={["#C8E9EA", "#E8F7F8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* ── Header Row: Badge & Icons ──────────────────────────────────── */}
        <View style={styles.headerRow}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>OPPORTUNITY</Text>
          </View>

          <View style={styles.rightHeaderContent}>
            {/* Pin button — only shown in profile screens with management enabled */}
            {showManagementControls && onPinToggle && (
              <TouchableOpacity
                style={[
                  styles.pinButton,
                  opportunity.is_pinned && styles.pinButtonActive,
                ]}
                onPress={() => onPinToggle(opportunity, true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View style={styles.pinIconWrapper}>
                  <Pin
                    size={18}
                    color={opportunity.is_pinned ? "#10B981" : "#5B6B7C"}
                    fill={opportunity.is_pinned ? "#10B981" : "none"}
                    strokeWidth={2}
                  />
                </View>
              </TouchableOpacity>
            )}

            {/* 3-dot menu — shown only to creator when management controls are enabled (profile screens) */}
            {showManagementControls && isCreator && (
              <TouchableOpacity
                style={styles.menuButton}
                onPress={(e) => {
                  const { pageX, pageY } = e.nativeEvent;
                  const screenWidth = Dimensions.get("window").width;
                  setMenuPosition({
                    x: screenWidth - pageX - 10,
                    y: pageY + 12,
                  });
                  openMenu();
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MoreHorizontal size={20} color="#5B6B7C" strokeWidth={2} />
              </TouchableOpacity>
            )}

            <View style={styles.iconContainer}>
              <Briefcase size={20} color="#2962FF" strokeWidth={2} />
            </View>
          </View>
        </View>

        {/* ── Author Row (tappable → profile) ───────────────────────────── */}
        <TouchableOpacity
          style={styles.authorRow}
          onPress={handleAuthorPress}
          activeOpacity={0.7}
        >
          <Image
            source={
              opportunity.creator_photo
                ? { uri: opportunity.creator_photo }
                : {
                    uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      opportunity.creator_name || "U",
                    )}&background=E5E7EB&color=6B7280&size=88`,
                  }
            }
            style={styles.authorAvatar}
          />
          <Text style={styles.authorUsername} numberOfLines={1}>
            {opportunity.creator_name || "Anonymous"}
          </Text>
          <Text style={styles.separator}>•</Text>
          <Text style={styles.timestamp}>
            {formatTimeAgo(opportunity.created_at)}
          </Text>
        </TouchableOpacity>

        {/* ── Title ─────────────────────────────────────────────────────── */}
        <Text style={styles.title} numberOfLines={2}>
          {opportunity.title}
        </Text>

        {/* ── Role Chips (auto scroll, no heading) ─────────────────── */}
        {roleChips.length > 0 && (
          <MarqueeChips chips={roleChips} chipType="role" styles={styles} />
        )}

        {/* ── Skill Chips (auto scroll, no heading) ─────────────────── */}
        {skillChips.length > 0 && (
          <MarqueeChips chips={skillChips} chipType="skill" styles={styles} />
        )}

        {/* ── Details Row ───────────────────────────────────────────────── */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Globe size={15} color="#5e8d9b" strokeWidth={2} />
            <Text style={styles.detailText}>{getWorkModeText()}</Text>
          </View>

          <Text style={styles.detailSeparator}>•</Text>

          <View style={styles.detailItem}>
            <Clock size={15} color="#5e8d9b" strokeWidth={2} />
            <Text style={styles.detailText}>{getWorkTypeText()}</Text>
          </View>

          <Text style={styles.detailSeparator}>•</Text>

          <View style={styles.detailItem}>
            <Coins size={15} color="#5e8d9b" strokeWidth={2} />
            <Text style={styles.detailText}>{getCompensationText()}</Text>
          </View>
        </View>

        {/* ── Footer Row ────────────────────────────────────────────────── */}
        <View style={styles.footerRow}>
          {/* Applicants + Timer/Ended */}
          <View style={styles.footerLeft}>
            <View style={styles.applicantStack}>
              {opportunity.applicants && opportunity.applicants.length > 0 ? (
                <>
                  {opportunity.applicants.slice(0, 3).map((applicant, index) => (
                    <Image
                      key={index}
                      source={{ uri: applicant.photo_url }}
                      style={[
                        styles.applicantAvatar,
                        { marginLeft: index > 0 ? -10 : 0 },
                      ]}
                    />
                  ))}
                  {opportunity.applicant_count > 3 && (
                    <Text style={styles.applicantCount}>
                      +{opportunity.applicant_count - 3}
                    </Text>
                  )}
                </>
              ) : opportunity.applicant_count > 0 ? (
                <Text style={styles.applicantCountText}>
                  {opportunity.applicant_count} applicants
                </Text>
              ) : (
                <Text style={styles.applicantCountText}>Be the first</Text>
              )}
            </View>

            {(opportunity.expires_at || opportunity.closed_at) && (
              <>
                <Text style={styles.footerSeparator}>•</Text>
                {isClosed ? (
                  <View style={styles.endedBadge}>
                    <Text style={styles.endedBadgeText}>Ended</Text>
                  </View>
                ) : (
                  <View style={styles.activeBadge}>
                    <CountdownTimer
                      expiresAt={opportunity.expires_at}
                      style={styles.activeBadgeText}
                    />
                  </View>
                )}
              </>
            )}
          </View>

          {/* Apply Button */}
          <TouchableOpacity
            style={[styles.applyButton, isClosed && styles.applyButtonDisabled]}
            onPress={() => {
              if (!isClosed) onPress?.(opportunity);
            }}
            disabled={isClosed}
          >
            <LinearGradient
              colors={isClosed ? ["#9CA3AF", "#6B7280"] : ["#448AFF", "#2962FF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.applyButtonGradient}
            >
              <Text style={styles.applyButtonText}>
                {isClosed ? "Closed" : "View Details"}
              </Text>
              {!isClosed && (
                <ArrowRight
                  size={18}
                  color="#FFFFFF"
                  style={{ marginLeft: 6 }}
                  strokeWidth={2.5}
                />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Engagement Row ────────────────────────────────────────────── */}
        <View style={styles.engagementRow}>
          {/* Like */}
          <TouchableOpacity
            style={styles.engagementButton}
            onPress={handleLike}
            disabled={isLiking}
          >
            <Heart
              size={20}
              color={isLiked ? COLORS.error : "#5e8d9b"}
              fill={isLiked ? COLORS.error : "transparent"}
              strokeWidth={2}
            />
            <Text style={[styles.engagementCount, isLiked && styles.likedCount]}>
              {formatCount(likeCount)}
            </Text>
          </TouchableOpacity>

          {/* Comment */}
          <TouchableOpacity style={styles.engagementButton} onPress={handleComment}>
            <MessageCircle size={20} color="#5e8d9b" strokeWidth={2} />
            <Text style={styles.engagementCount}>
              {formatCount(opportunity.comment_count || 0)}
            </Text>
          </TouchableOpacity>

          {/* Views */}
          <TouchableOpacity style={styles.engagementButton} activeOpacity={1} onPress={() => {}}>
            <ChartNoAxesCombined size={20} color="#5e8d9b" strokeWidth={2} />
            <Text style={styles.engagementCount}>{formatCount(viewCount)}</Text>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity style={styles.engagementButton} onPress={handleShare}>
            <Send size={20} color="#5e8d9b" strokeWidth={2} />
            <Text style={styles.engagementCount}>
              {formatCount(opportunity.share_count || 0)}
            </Text>
          </TouchableOpacity>

          {/* Bookmark */}
          <TouchableOpacity style={styles.engagementButton} onPress={handleSave}>
            <Bookmark
              size={20}
              color={isSaved ? "#5e8d9b" : "#5e8d9b"}
              fill={isSaved ? "#5e8d9b" : "transparent"}
              strokeWidth={2}
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ── 3-dot Menu Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="none"
        onRequestClose={closeMenu}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeMenu}>
          <Animated.View
            style={[
              styles.menuContainerModal,
              {
                top: menuPosition.y,
                right: menuPosition.x,
                opacity: menuAnim,
              },
            ]}
          >
            {/* Edit */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                closeMenu();
                navigation.navigate("CreateOpportunityScreen", {
                  opportunityToEdit: opportunity,
                });
              }}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconWrap}>
                <Pencil size={15} color="#2962FF" strokeWidth={2} />
              </View>
              <View style={styles.menuItemTextContainer}>
                <Text style={styles.menuItemTitle}>Edit Opportunity</Text>
                <Text style={styles.menuItemSub}>Update details or requirements</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {/* Delete */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleDelete}
              activeOpacity={0.7}
              disabled={isDeleting}
            >
              <View style={[styles.menuIconWrap, styles.menuIconDestructive]}>
                <Trash2 size={15} color="#EF4444" strokeWidth={2} />
              </View>
              <View style={styles.menuItemTextContainer}>
                <Text style={[styles.menuItemTitle, styles.menuItemDestructive]}>
                  {isDeleting ? "Deleting…" : "Delete Opportunity"}
                </Text>
                <Text style={styles.menuItemSub}>This action cannot be undone</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.xl,
    padding: 20,
    marginHorizontal: SPACING.m,
    marginBottom: SPACING.m,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  typeBadge: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  typeBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.semiBold,
    color: "#4A5568",
    letterSpacing: 0.5,
  },
  iconContainer: {
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
  },
  rightHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pinButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
  },
  pinButtonActive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  pinIconWrapper: {
    transform: [{ rotate: "27deg" }],
    overflow: "visible",
  },

  // ── Author ────────────────────────────────────────────────────────────────
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  authorUsername: {
    fontSize: 15,
    color: "#1D1D1F",
    fontFamily: FONTS.semiBold,
    maxWidth: 160,
  },
  separator: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5e8d9b",
    marginHorizontal: 4,
  },
  timestamp: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: "#5e8d9b",
  },

  // ── Title ─────────────────────────────────────────────────────────────────
  title: {
    fontFamily: FONTS.primary,
    fontSize: 24,
    color: "#1D1D1F",
    marginTop: 12,
    marginBottom: 12,
    lineHeight: 30,
  },

  // ── Chips ─────────────────────────────────────────────────────────────────
  chipsRow: {
    marginBottom: 8,
    maxHeight: 34,
  },
  chipsContent: {
    paddingRight: 8,
    gap: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  // Role chip — solid blue tinted, slightly bolder
  roleChip: {
    backgroundColor: "rgba(41, 98, 255, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(41, 98, 255, 0.22)",
  },
  roleChipText: {
    fontSize: 12,
    color: "#2962FF",
    fontFamily: FONTS.semiBold,
    letterSpacing: 0.1,
  },
  // Skill chip — lighter, outlined style
  skillChip: {
    backgroundColor: "rgba(255,255,255,0.55)",
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(94, 141, 155, 0.35)",
  },
  skillChipText: {
    fontSize: 12,
    color: "#3D6B7A",
    fontFamily: FONTS.medium,
  },

  // ── Details ───────────────────────────────────────────────────────────────
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 20,
    marginTop: 4,
    gap: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: "#1D1D1F",
    fontFamily: FONTS.medium,
  },
  detailSeparator: {
    fontSize: 13,
    color: "#5e8d9b",
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerSeparator: {
    color: COLORS.textTertiary,
    marginHorizontal: 8,
    fontSize: EDITORIAL_TYPOGRAPHY.timestamp.fontSize,
  },
  applicantStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  applicantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  applicantCount: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: "#3B82F6",
    marginLeft: 6,
  },
  applicantCountText: {
    fontSize: 13,
    color: "#5e8d9b",
    fontFamily: FONTS.medium,
  },
  activeBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: COLORS.textSecondary,
  },
  endedBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  endedBadgeText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: "#DC2626",
  },
  applyButton: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#2962FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  applyButtonDisabled: {
    shadowColor: "#6B7280",
    opacity: 0.7,
  },
  applyButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  applyButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: FONTS.semiBold,
  },

  engagementRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.07)",
  },
  engagementButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
    minHeight: 36,
    minWidth: 40,
    justifyContent: "center",
  },
  engagementCount: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: "#5e8d9b",
  },
  likedCount: {
    color: COLORS.error,
  },

  // ── 3-dot Menu Popover ──────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: "transparent",
  },
  menuContainerModal: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 10,
    width: 270,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 12,
  },
  menuItemTextContainer: {
    flex: 1,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(41, 98, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconDestructive: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  menuItemTitle: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: "#1D1D1F",
  },
  menuItemDestructive: {
    color: "#EF4444",
  },
  menuItemSub: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: "#6B7280",
    marginTop: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 4,
  },
});

export default OpportunityFeedCard;
