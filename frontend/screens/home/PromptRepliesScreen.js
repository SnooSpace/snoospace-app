/**
 * PromptRepliesScreen
 * View and create replies to a prompt submission (YouTube-style threaded comments)
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, RefreshControl, TextInput } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { apiGet, apiPost, apiPatch } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { getActiveAccount } from "../../utils/accountManager";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../constants/theme";
import SnooLoader from "../../components/ui/SnooLoader";

const PromptRepliesScreen = ({ route, navigation }) => {
  const { submission, post } = route.params;

  const [replies, setReplies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [isPostAuthor, setIsPostAuthor] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // { id, author_name } for replying to a reply
  const [collapsedThreads, setCollapsedThreads] = useState({}); // { replyId: true } for collapsed threads

  const inputRef = useRef(null);

  // ========== CONNECTOR LAYOUT CONSTANTS ==========
  // Each reply renders its own connectors locally - no global spine
  const INDENT_SIZE = 24; // Width per nesting level
  const CONNECTOR_WIDTH = 24; // Width of connector column
  const ELBOW_RADIUS = 8; // Curve radius for L-shaped elbow
  const REPLY_AVATAR_SIZE = 28; // Avatar height in reply cards
  const REPLY_PADDING = SPACING.m; // Padding inside reply card
  const CONNECTOR_COLOR = "rgba(0,0,0,0.12)"; // Subtle connector color

  // Build hierarchical reply structure from flat list
  // Returns ordered array where children appear directly after parent
  const buildHierarchicalReplies = useCallback((flatReplies) => {
    if (!flatReplies || flatReplies.length === 0) return [];

    // Separate top-level replies from nested ones
    const topLevel = [];
    const childrenMap = {}; // parentId -> [children]

    flatReplies.forEach((reply) => {
      if (!reply.parent_reply_id) {
        topLevel.push(reply);
      } else {
        if (!childrenMap[reply.parent_reply_id]) {
          childrenMap[reply.parent_reply_id] = [];
        }
        childrenMap[reply.parent_reply_id].push(reply);
      }
    });

    // Sort top-level by created_at
    topLevel.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Sort children within each group
    Object.keys(childrenMap).forEach((parentId) => {
      childrenMap[parentId].sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );
    });

    // Recursively build ordered list with depth
    const result = [];
    const addWithChildren = (reply, depth) => {
      result.push({ ...reply, depth });
      const children = childrenMap[reply.id] || [];
      children.forEach((child) => addWithChildren(child, depth + 1));
    };

    topLevel.forEach((reply) => addWithChildren(reply, 0));
    return result;
  }, []);

  // Memoize the hierarchical structure
  const hierarchicalReplies = useMemo(
    () => buildHierarchicalReplies(replies),
    [replies, buildHierarchicalReplies]
  );

  // Toggle thread collapse - default is collapsed (undefined/true), false = expanded
  const toggleCollapse = (replyId) => {
    setCollapsedThreads((prev) => ({
      ...prev,
      [replyId]: prev[replyId] === false ? true : false, // Toggle between collapsed (true/undefined) and expanded (false)
    }));
  };

  // Filter replies based on collapsed state
  const visibleReplies = useMemo(() => {
    const result = [];
    let skipUntilDepth = null;

    for (const reply of hierarchicalReplies) {
      // If we're skipping collapsed children
      if (skipUntilDepth !== null) {
        if (reply.depth > skipUntilDepth) {
          continue; // Skip this reply (it's a child of collapsed thread)
        } else {
          skipUntilDepth = null; // Back to normal level
        }
      }

      result.push(reply);

      // Check if this reply has children and is collapsed (default is collapsed, only false = expanded)
      if (collapsedThreads[reply.id] !== false) {
        skipUntilDepth = reply.depth;
      }
    }

    return result;
  }, [hierarchicalReplies, collapsedThreads]);

  // Count hidden children for a collapsed reply
  const getHiddenChildCount = useCallback(
    (replyId) => {
      let count = 0;
      let foundParent = false;
      let parentDepth = 0;

      for (const reply of hierarchicalReplies) {
        if (reply.id === replyId) {
          foundParent = true;
          parentDepth = reply.depth;
          continue;
        }
        if (foundParent) {
          if (reply.depth > parentDepth) {
            count++;
          } else {
            break;
          }
        }
      }
      return count;
    },
    [hierarchicalReplies]
  );

  // Check if a reply has more siblings after it at the same depth
  const hasMoreSiblings = useCallback(
    (replyId, replyDepth) => {
      let foundCurrent = false;
      for (const reply of visibleReplies) {
        if (reply.id === replyId) {
          foundCurrent = true;
          continue;
        }
        if (foundCurrent) {
          if (reply.depth === replyDepth) {
            return true; // Found a sibling at same level
          }
          if (reply.depth < replyDepth) {
            return false; // Went back up, no more siblings
          }
          // reply.depth > replyDepth means it's a child, keep looking
        }
      }
      return false;
    },
    [visibleReplies]
  );

  // Check if a reply is the FIRST sibling at its depth (no previous sibling at same depth)
  const isFirstSibling = useCallback(
    (replyId, replyDepth) => {
      for (const reply of visibleReplies) {
        if (reply.id === replyId) {
          return true; // Reached current without finding sibling first
        }
        if (reply.depth === replyDepth) {
          return false; // Found a previous sibling
        }
        if (reply.depth < replyDepth) {
          // Went to a shallower depth, reset - next sibling search starts fresh
          continue;
        }
      }
      return true;
    },
    [visibleReplies]
  );

  // Check if there are more siblings at a specific ancestor depth AFTER this reply
  // Used to render pass-through vertical lines for ancestor levels where siblings continue
  const hasAncestorSiblingAfter = useCallback(
    (replyId, ancestorDepth) => {
      let foundCurrent = false;
      for (const reply of visibleReplies) {
        if (reply.id === replyId) {
          foundCurrent = true;
          continue;
        }
        if (foundCurrent) {
          // If we find a reply at the ancestor depth, there ARE more siblings there
          if (reply.depth === ancestorDepth) {
            return true;
          }
          // If we go shallower than ancestor depth, we've exited that subtree
          if (reply.depth < ancestorDepth) {
            return false;
          }
          // reply.depth > ancestorDepth: still in descendant area, keep looking
        }
      }
      return false;
    },
    [visibleReplies]
  );

  // Check if current user is the post author
  useEffect(() => {
    const checkIsAuthor = async () => {
      const account = await getActiveAccount();
      if (account) {
        setCurrentUser(account);
        setIsPostAuthor(
          account.id === post.author_id && account.type === post.author_type
        );
      }
    };
    checkIsAuthor();
  }, [post]);

  const fetchReplies = useCallback(async () => {
    try {
      const token = await getAuthToken();
      const response = await apiGet(
        `/submissions/${submission.id}/replies`,
        15000,
        token
      );
      setReplies(response.replies || []);
    } catch (error) {
      console.error("Error fetching replies:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [submission.id]);

  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchReplies();
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || isSending) return;

    setIsSending(true);
    try {
      const token = await getAuthToken();
      const body = { content: replyText.trim() };

      // If replying to a specific reply, include parent_reply_id
      if (replyingTo) {
        body.parent_reply_id = replyingTo.id;
      }

      const response = await apiPost(
        `/submissions/${submission.id}/replies`,
        body,
        15000,
        token
      );

      if (response.success && response.reply) {
        setReplies((prev) => [...prev, response.reply]);
        setReplyText("");
        setReplyingTo(null);
      }
    } catch (error) {
      console.error("Error sending reply:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleHideReply = async (replyId, currentlyHidden) => {
    try {
      const token = await getAuthToken();
      await apiPatch(`/replies/${replyId}/hide`, {}, 15000, token);
      setReplies((prev) =>
        prev.map((r) =>
          r.id === replyId ? { ...r, is_hidden: !currentlyHidden } : r
        )
      );
    } catch (error) {
      console.error("Error hiding reply:", error);
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const postTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - postTime) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000)
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
  };

  const handleUserPress = (userId, userType) => {
    if (userType === "member") {
      navigation.navigate("MemberPublicProfile", { userId });
    } else if (userType === "community") {
      navigation.navigate("CommunityPublicProfile", { communityId: userId });
    }
  };

  // Render the parent submission at the top (no connector from here - replies own their connectors)
  const renderParentSubmission = () => {
    return (
      <View style={styles.parentSubmission}>
        <TouchableOpacity
          style={styles.submissionHeader}
          onPress={() =>
            handleUserPress(submission.author_id, submission.author_type)
          }
        >
          <Image
            source={
              submission.author_photo_url
                ? { uri: submission.author_photo_url }
                : { uri: "https://via.placeholder.com/40" }
            }
            style={styles.authorImage}
          />
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>
              {submission.author_name || "User"}
            </Text>
            <Text style={styles.timestamp}>
              {formatTimeAgo(submission.created_at)}
            </Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.submissionContent}>{submission.content}</Text>
      </View>
    );
  };

  // ========== RENDER REPLY WITH LOCAL CONNECTORS ==========
  // Each reply renders its own connectors - no global spine
  // Renders: 1) Curved elbow into itself, 2) Vertical continuation if hasNextSibling
  const renderReply = ({ item, index }) => {
    // Get depth from hierarchical data (default to 0)
    const depth = item.depth || 0;
    const hasChildren = (item.reply_count || 0) > 0;
    const isCollapsed = collapsedThreads[item.id] !== false; // Default is collapsed (undefined = collapsed)
    const hiddenCount = isCollapsed ? getHiddenChildCount(item.id) : 0;

    // Calculate if this reply has a next sibling at the same depth level
    // This determines if we render a vertical continuation line
    const hasNextSibling = hasMoreSiblings(item.id, depth);

    // Check if this reply has a previous sibling (is NOT the first at its depth)
    // If true, we need to extend the elbow upward to connect to previous sibling's continuation
    const hasPrevSibling = !isFirstSibling(item.id, depth);

    // Layout calculations based on depth
    // leftMargin = space for all parent connector columns + own connector column
    const leftMargin = CONNECTOR_WIDTH + depth * INDENT_SIZE;

    // Y-offset for the elbow to connect to avatar center
    // Avatar center = card padding + half avatar size
    const avatarCenterY = REPLY_PADDING + REPLY_AVATAR_SIZE / 2;

    // ========== CONNECTOR RENDERING FUNCTION ==========
    // Renders the curved elbow + optional vertical continuation + ancestor pass-through lines
    const renderConnector = () => {
      // Position connector column to the left of the reply card
      // The connector column width is CONNECTOR_WIDTH (24px)
      const connectorLeft = -CONNECTOR_WIDTH;

      // If there's a previous sibling, extend vertical segment upward to bridge gap
      // Using SPACING.xl to ensure full coverage of the margin gap between rows
      const verticalTop = hasPrevSibling ? -SPACING.xl : 0;
      const verticalHeight =
        avatarCenterY - ELBOW_RADIUS + (hasPrevSibling ? SPACING.xl : 0);

      // ========== PASS-THROUGH LINES FOR ANCESTOR DEPTHS ==========
      // For nested replies (depth > 0), render vertical pass-through lines
      // at each ancestor depth level where siblings continue after this reply
      const ancestorPassThroughLines = [];
      for (let ancestorDepth = 0; ancestorDepth < depth; ancestorDepth++) {
        if (hasAncestorSiblingAfter(item.id, ancestorDepth)) {
          // Calculate position for this ancestor depth's connector
          // The connector column already starts at -CONNECTOR_WIDTH from the card
          // Ancestor lines are further left by (depth - ancestorDepth) * INDENT_SIZE
          const ancestorLeft = -(depth - ancestorDepth) * INDENT_SIZE;

          ancestorPassThroughLines.push(
            <View
              key={`ancestor-${ancestorDepth}`}
              style={{
                position: "absolute",
                left: ancestorLeft,
                top: -SPACING.xl, // Extend upward to connect from previous
                bottom: -SPACING.s, // Extend downward to connect to next
                width: 1,
                backgroundColor: CONNECTOR_COLOR,
              }}
            />
          );
        }
      }

      return (
        <View
          style={[
            styles.connectorColumn,
            {
              left: connectorLeft,
              width: CONNECTOR_WIDTH + depth * INDENT_SIZE, // Expand to cover ancestor lines
            },
          ]}
        >
          {/* ===== ANCESTOR PASS-THROUGH LINES ===== */}
          {/* Vertical lines at ancestor depth positions where siblings continue */}
          {ancestorPassThroughLines}

          {/* ===== CURVED ELBOW CONNECTOR ===== */}
          {/* L-shaped with rounded corner: vertical segment → curve → horizontal to avatar */}

          {/* Vertical segment from top of row (or above if prev sibling) down to curve start */}
          {/* Extends upward with negative top if there's a previous sibling to bridge gap */}
          <View
            style={{
              position: "absolute",
              left: 0,
              top: verticalTop,
              width: 1,
              height: Math.max(0, verticalHeight),
              backgroundColor: CONNECTOR_COLOR,
            }}
          />

          {/* The curved corner (bottom-left quarter circle arc) */}
          {/* Uses border styling to create the arc */}
          <View
            style={{
              position: "absolute",
              left: 0,
              top: avatarCenterY - ELBOW_RADIUS,
              width: ELBOW_RADIUS * 2,
              height: ELBOW_RADIUS * 2,
              borderLeftWidth: 1,
              borderBottomWidth: 1,
              borderColor: CONNECTOR_COLOR,
              borderBottomLeftRadius: ELBOW_RADIUS,
            }}
          />

          {/* Horizontal segment from curve end to avatar center */}
          {/* Starts where curve ends, extends to edge of connector column */}
          <View
            style={{
              position: "absolute",
              left: ELBOW_RADIUS * 2 - 1,
              top: avatarCenterY + ELBOW_RADIUS - 1,
              width: CONNECTOR_WIDTH - ELBOW_RADIUS * 2,
              height: 1,
              backgroundColor: CONNECTOR_COLOR,
            }}
          />

          {/* ===== VERTICAL CONTINUATION (only if hasNextSibling) ===== */}
          {/* Extends from elbow curve downward to connect to next sibling's elbow */}
          {/* Uses negative bottom to extend past container and bridge the marginBottom gap */}
          {hasNextSibling && !isCollapsed && (
            <View
              style={{
                position: "absolute",
                left: 0,
                top: avatarCenterY + ELBOW_RADIUS,
                bottom: -SPACING.s, // Extend past container to bridge margin gap
                width: 1,
                backgroundColor: CONNECTOR_COLOR,
              }}
            />
          )}
        </View>
      );
    };

    // If hidden, show placeholder message with connector
    if (item.is_hidden) {
      return (
        <View style={[styles.replyItemContainer, { marginLeft: leftMargin }]}>
          {/* Render connector for hidden replies too */}
          {renderConnector()}
          <View style={styles.hiddenReplyContent}>
            <Ionicons
              name="eye-off-outline"
              size={16}
              color={COLORS.textSecondary}
            />
            <Text style={styles.hiddenText}>
              This response has been hidden by the community
            </Text>
          </View>
          {/* Post author can unhide */}
          {isPostAuthor && (
            <TouchableOpacity
              style={styles.unhideButton}
              onPress={() => handleHideReply(item.id, true)}
            >
              <Text style={styles.unhideText}>Unhide</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <View style={[styles.replyItemContainer, { marginLeft: leftMargin }]}>
        {/* Render connector: curved elbow + vertical continuation if needed */}
        {renderConnector()}
        <View style={styles.replyContent}>
          <View style={styles.replyHeaderRow}>
            <TouchableOpacity
              style={styles.replyHeader}
              onPress={() => handleUserPress(item.author_id, item.author_type)}
            >
              <Image
                source={
                  item.author_photo_url
                    ? { uri: item.author_photo_url }
                    : { uri: "https://via.placeholder.com/32" }
                }
                style={styles.replyAuthorImage}
              />
              <View style={styles.replyAuthorInfo}>
                <Text style={styles.replyAuthorName}>
                  {item.author_name || "User"}
                </Text>
                <Text style={styles.replyTimestamp}>
                  {formatTimeAgo(item.created_at)}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Post author can hide replies */}
            {isPostAuthor && (
              <TouchableOpacity
                style={styles.hideButton}
                onPress={() => handleHideReply(item.id, false)}
              >
                <Ionicons
                  name="eye-off-outline"
                  size={18}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.replyText}>{item.content}</Text>

          {/* Actions row: Reply + Show/Hide children */}
          <View style={styles.replyActionsRow}>
            {/* Reply button */}
            <TouchableOpacity
              style={styles.replyToButton}
              onPress={() => {
                setReplyingTo({ id: item.id, author_name: item.author_name });
                inputRef.current?.focus();
              }}
            >
              <Ionicons
                name="return-down-forward"
                size={14}
                color={COLORS.textSecondary}
              />
              <Text style={styles.replyToButtonText}>Reply</Text>
            </TouchableOpacity>

            {/* Show/Hide children button */}
            {hasChildren && (
              <TouchableOpacity
                style={styles.showMoreButton}
                onPress={() => toggleCollapse(item.id)}
              >
                <Ionicons
                  name={isCollapsed ? "chevron-down" : "chevron-up"}
                  size={14}
                  color={COLORS.primary}
                />
                <Text style={styles.showMoreText}>
                  {isCollapsed
                    ? `Show ${hiddenCount} ${
                        hiddenCount === 1 ? "reply" : "replies"
                      }`
                    : "Hide replies"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Replies</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.contentArea}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <SnooLoader size="large" color={COLORS.primary} />
          </View>
        ) : (
          <View style={styles.repliesThreadContainer}>
            {/* No global vertical line - each reply renders its own connectors locally */}
            <FlatList
              data={visibleReplies}
              renderItem={renderReply}
              keyExtractor={(item) => item.id.toString()}
              ListHeaderComponent={renderParentSubmission}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: 80 + insets.bottom },
              ]}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handleRefresh}
                  tintColor={COLORS.primary}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    No replies yet. Be the first!
                  </Text>
                </View>
              }
            />
          </View>
        )}
      </View>

      {/* Keyboard-aware Reply Input */}
      <KeyboardStickyView
        offset={{
          closed: -insets.bottom,
          opened: 0,
        }}
        style={styles.stickyInputContainer}
      >
        {/* Show who we're replying to */}
        {replyingTo && (
          <View style={styles.replyingToBar}>
            <Text style={styles.replyingToText}>
              Replying to{" "}
              <Text style={styles.replyingToName}>
                {replyingTo.author_name}
              </Text>
            </Text>
            <TouchableOpacity
              onPress={() => setReplyingTo(null)}
              style={styles.cancelReplyButton}
            >
              <Ionicons name="close" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputContent}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={
              replyingTo
                ? `Reply to ${replyingTo.author_name}...`
                : "Add a reply..."
            }
            placeholderTextColor={COLORS.textSecondary}
            value={replyText}
            onChangeText={setReplyText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!replyText.trim() || isSending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendReply}
            disabled={!replyText.trim() || isSending}
          >
            {isSending ? (
              <SnooLoader size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardStickyView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
    marginRight: SPACING.s,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textPrimary,
    flex: 1,
  },
  headerSpacer: {
    width: 32,
  },
  keyboardView: {
    flex: 1,
  },
  contentArea: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: SPACING.m,
    flexGrow: 1,
  },
  // Parent submission styles
  parentSubmission: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.l,
    padding: SPACING.m,
    marginBottom: SPACING.s, // Reduced spacing to tighten parent-reply connection
    ...SHADOWS.sm,
  },
  submissionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.s,
  },
  authorImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: SPACING.s,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  submissionContent: {
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  // Reply styles
  // Thread container - no global vertical line
  repliesThreadContainer: {
    flex: 1,
  },
  // Reply row container - relative for local connector positioning
  // overflow: visible allows vertical continuation to extend past container
  replyItemContainer: {
    position: "relative",
    flexDirection: "row",
    alignItems: "flex-start",
    overflow: "visible",
  },
  // Connector column - positioned to left of reply card
  // Each reply owns its connector column for curved elbow + vertical continuation
  connectorColumn: {
    position: "absolute",
    top: 0,
    bottom: 0,
    // left and width are set dynamically based on depth
  },
  replyContent: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    marginBottom: SPACING.s,
    ...SHADOWS.sm,
  },
  replyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  replyHeader: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginBottom: SPACING.xs,
  },
  replyAuthorImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: SPACING.xs,
  },
  replyAuthorInfo: {
    flex: 1,
  },
  replyAuthorName: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  replyTimestamp: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  replyText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  hideButton: {
    padding: SPACING.xs,
  },
  // Hidden reply
  hiddenReplyContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    gap: SPACING.xs,
  },
  hiddenText: {
    fontSize: 13,
    fontStyle: "italic",
    color: COLORS.textSecondary,
    flex: 1,
  },
  unhideButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  unhideText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "500",
  },
  // Empty state
  emptyState: {
    paddingVertical: SPACING.xl,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  // Keyboard-aware input container
  stickyInputContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
  },
  replyingToBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.screenBackground,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  replyingToText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  replyingToName: {
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  cancelReplyButton: {
    padding: SPACING.xs,
  },
  inputContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.s,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.l,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    fontSize: 15,
    color: COLORS.textPrimary,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  nestedReplyCard: {
    marginLeft: SPACING.xl,
  },
  replyActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.xs,
    gap: SPACING.m,
  },
  replyToButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  replyToButtonText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  showMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  showMoreText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "500",
  },
});

export default PromptRepliesScreen;
