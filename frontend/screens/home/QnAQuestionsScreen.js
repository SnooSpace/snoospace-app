import { useFocusEffect } from "@react-navigation/native";
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, RefreshControl, TextInput, KeyboardAvoidingView, Platform, Alert, Dimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { ArrowLeft, MessageSquare, TrendingUp, Clock, Send, ArrowUp, User, Pin, CheckCircle, Lock, ChevronDown, ChevronUp, Star, MoreVertical } from "lucide-react-native";
import { apiGet, apiPost, apiDelete } from "../../api/client";
import { getAuthToken, getActiveAccount } from "../../api/auth";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../constants/theme";
import SnooLoader from "../../components/ui/SnooLoader";

const QnAQuestionsScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { post } = route.params;
  const typeData = post.type_data || {};

  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState("all"); // all, answered, unanswered
  const [sort, setSort] = useState("top"); // top, recent
  const [expandedQuestionId, setExpandedQuestionId] = useState(null);

  // Current user state
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserType, setCurrentUserType] = useState(null);

  // Question input state
  const [questionText, setQuestionText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Question limit state
  const [userQuestionCount, setUserQuestionCount] = useState(0);
  const [maxQuestionsPerUser, setMaxQuestionsPerUser] = useState(1);

  // Reply state
  const [replyingToQuestionId, setReplyingToQuestionId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const fetchQuestions = useCallback(
    async (showLoading = true) => {
      if (showLoading) setIsLoading(true);
      try {
        const token = await getAuthToken();
        const response = await apiGet(
          `/posts/${post.id}/questions?filter=${filter}&sort=${sort}`,
          15000,
          token,
        );

        if (response.success) {
          setQuestions(response.questions || []);
          if (response.user_question_count !== undefined) {
            setUserQuestionCount(response.user_question_count);
          }
          if (response.max_questions_per_user !== undefined) {
            setMaxQuestionsPerUser(response.max_questions_per_user);
          }
        }
      } catch (error) {
        console.error("Error fetching questions:", error);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [post.id, filter, sort],
  );

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Fetch current user info
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const account = await getActiveAccount();
        console.log("[QnA Questions] Current account:", account);
        if (account) {
          setCurrentUserId(account.id);
          setCurrentUserType(account.type);
          console.log("[QnA Questions] Set current user:", {
            userId: account.id,
            userType: account.type,
            postAuthorId: post.author_id,
            postAuthorType: post.author_type,
            isOwner:
              post.author_id === account.id &&
              post.author_type === account.type,
          });
        }
      } catch (error) {
        console.error("Error fetching current user:", error);
      }
    };
    fetchCurrentUser();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchQuestions(false);
  };

  const handleSubmitQuestion = async () => {
    if (!questionText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const token = await getAuthToken();
      const response = await apiPost(
        `/posts/${post.id}/questions`,
        {
          content: questionText.trim(),
          is_anonymous: false,
        },
        15000,
        token,
      );

      if (response.success) {
        setQuestionText("");
        setUserQuestionCount((prev) => prev + 1); // optimistic increment
        fetchQuestions(false);
      }
    } catch (error) {
      console.error("Error submitting question:", error);
      Alert.alert("Error", error?.message || "Failed to submit question");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpvote = async (questionId, hasUpvoted) => {
    try {
      const token = await getAuthToken();

      // Optimistic update
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? {
                ...q,
                upvote_count: hasUpvoted
                  ? q.upvote_count - 1
                  : q.upvote_count + 1,
                has_upvoted: !hasUpvoted,
              }
            : q,
        ),
      );

      if (hasUpvoted) {
        await apiDelete(`/questions/${questionId}/upvote`, {}, 10000, token);
      } else {
        await apiPost(`/questions/${questionId}/upvote`, {}, 10000, token);
      }
    } catch (error) {
      console.error("Error toggling upvote:", error);
      // Revert on error
      fetchQuestions(false);
    }
  };

  const handleReply = (questionId) => {
    setReplyingToQuestionId(questionId);
    setReplyText("");
  };

  const handleCancelReply = () => {
    setReplyingToQuestionId(null);
    setReplyText("");
  };

  const handleSubmitReply = async (questionId) => {
    if (!replyText.trim() || isSubmittingReply) return;

    setIsSubmittingReply(true);
    try {
      const token = await getAuthToken();
      const response = await apiPost(
        `/questions/${questionId}/answer`,
        {
          content: replyText.trim(),
        },
        15000,
        token,
      );

      if (response.success) {
        setReplyText("");
        setReplyingToQuestionId(null);
        fetchQuestions(false);
        Alert.alert("Reply posted!", "Your reply has been posted.");
      }
    } catch (error) {
      console.error("Error submitting reply:", error);
      Alert.alert("Error", error?.message || "Failed to submit reply");
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    return `${Math.floor(diffInSeconds / 86400)}d`;
  };

  const renderQuestion = ({ item }) => {
    const isExpanded = expandedQuestionId === item.id;
    const hasAnswers = item.answers && item.answers.length > 0;

    return (
      <View style={styles.questionCard}>
        {/* Upvote Section */}
        <View style={styles.upvoteSection}>
          <TouchableOpacity
            style={[
              styles.upvoteButton,
              item.has_upvoted && styles.upvoteButtonActive,
            ]}
            onPress={() => handleUpvote(item.id, item.has_upvoted)}
          >
            <View style={[styles.iconContainer, item.has_upvoted && styles.iconContainerActive]}>
              <ArrowUp
                size={18}
                color={item.has_upvoted ? "#3B82F6" : "#8E8E93"}
                strokeWidth={item.has_upvoted ? 2.5 : 2}
              />
            </View>
          </TouchableOpacity>
          <Text
            style={[
              styles.upvoteCount,
              item.has_upvoted && styles.upvoteCountActive,
            ]}
          >
            {item.upvote_count || 0}
          </Text>
        </View>

        {/* Question Content */}
        <View style={styles.questionContent}>
          {/* Header */}
          <View style={styles.questionHeader}>
            {item.author_photo_url ? (
              <Image
                source={{ uri: item.author_photo_url }}
                style={styles.authorAvatar}
              />
            ) : item.is_anonymous ? (
              <View style={styles.anonymousAvatar}>
                <User
                  size={12}
                  color={COLORS.textSecondary}
                />
              </View>
            ) : null}
            <Text style={styles.authorName}>
              {item.author_name || "Anonymous"}
            </Text>
            <Text style={styles.questionTime}>
              • {formatTimeAgo(item.created_at)}
            </Text>
            {item.is_pinned && (
              <View style={styles.pinnedBadge}>
                <Pin size={10} color="#FF9500" />
              </View>
            )}
          </View>

          {/* Question Text */}
          <Text style={styles.questionText}>{item.content}</Text>

          {/* Status Badges */}
          <View style={styles.badgesRow}>
            {item.is_answered && (
              <View style={styles.answeredBadge}>
                <CheckCircle size={14} color="#34C759" />
                <Text style={styles.answeredBadgeText}>Answered</Text>
              </View>
            )}
            {item.is_locked && (
              <View style={styles.lockedBadge}>
                <Lock
                  size={12}
                  color={COLORS.textSecondary}
                />
              </View>
            )}
          </View>

          {/* Reply Button (only for post owner) */}
          {(() => {
            const isOwner =
              currentUserId &&
              currentUserType &&
              String(post.author_id) === String(currentUserId) &&
              post.author_type === currentUserType;

            console.log("[QnA Questions] Reply button check:", {
              questionId: item.id,
              currentUserId,
              currentUserType,
              postAuthorId: post.author_id,
              postAuthorType: post.author_type,
              postAuthorIdStr: String(post.author_id),
              currentUserIdStr: String(currentUserId),
              idsMatch: String(post.author_id) === String(currentUserId),
              typesMatch: post.author_type === currentUserType,
              isOwner,
              replyingTo: replyingToQuestionId,
              shouldShow: isOwner && replyingToQuestionId !== item.id,
            });

            return isOwner && replyingToQuestionId !== item.id ? (
              <TouchableOpacity
                style={styles.replyButton}
                onPress={() => handleReply(item.id)}
              >
                <MessageSquare size={14} color="#3B82F6" />
                <Text style={styles.replyButtonText}>Reply</Text>
              </TouchableOpacity>
            ) : null;
          })()}

          {/* Reply Input (when replying) */}
          {replyingToQuestionId === item.id && (
            <View style={styles.replyInputContainer}>
              <TextInput
                style={styles.replyInput}
                placeholder="Write your reply..."
                placeholderTextColor={COLORS.textSecondary}
                value={replyText}
                onChangeText={setReplyText}
                multiline
                maxLength={1000}
                autoFocus
              />
              <View style={styles.replyActions}>
                <TouchableOpacity
                  style={styles.cancelReplyButton}
                  onPress={handleCancelReply}
                >
                  <Text style={styles.cancelReplyText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.sendReplyButton,
                    (!replyText.trim() || isSubmittingReply) &&
                      styles.sendReplyButtonDisabled,
                  ]}
                  onPress={() => handleSubmitReply(item.id)}
                  disabled={!replyText.trim() || isSubmittingReply}
                >
                  {isSubmittingReply ? (
                    <SnooLoader size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.sendReplyText, { fontFamily: 'Manrope-Medium' }]}>Send</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Expand/Collapse for Answers */}
          {hasAnswers && (
            <TouchableOpacity
              style={styles.expandButton}
              onPress={() => setExpandedQuestionId(isExpanded ? null : item.id)}
            >
              <Text style={styles.expandButtonText}>
                {isExpanded
                  ? "Hide answer"
                  : `View ${item.answers.length} answer${
                      item.answers.length > 1 ? "s" : ""
                    }`}
              </Text>
              <View style={styles.expandIconContainer}>
                {isExpanded ? (
                  <ChevronUp size={16} color="#3B82F6" />
                ) : (
                  <ChevronDown size={16} color="#3B82F6" />
                )}
              </View>
            </TouchableOpacity>
          )}

          {/* Answers (when expanded) */}
          {isExpanded && hasAnswers && (
            <View style={styles.answersContainer}>
              {item.answers.map((answer) => (
                <View key={answer.id} style={styles.answerCard}>
                  <View style={styles.answerHeader}>
                    {answer.author_photo_url && (
                      <Image
                        source={{ uri: answer.author_photo_url }}
                        style={styles.answerAuthorAvatar}
                      />
                    )}
                    <Text style={styles.answerAuthorName}>
                      {answer.author_name || "Host"}
                    </Text>
                    {answer.is_best_answer && (
                      <View style={styles.bestAnswerBadge}>
                        <Star size={10} color="#F59E0B" fill="#F59E0B" />
                        <Text style={styles.bestAnswerText}>Best</Text>
                      </View>
                    )}
                    <Text style={styles.answerTime}>
                      • {formatTimeAgo(answer.created_at)}
                    </Text>
                  </View>
                  <Text style={styles.answerText}>{answer.content}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Post Info */}
      <View style={styles.postInfo}>
        <View style={styles.questionIconContainer}>
          <MessageSquare size={28} color="#85999A" strokeWidth={1.5} />
          <Text style={styles.questionIconText}>?</Text>
        </View>
        <View style={styles.postInfoText}>
          <Text style={styles.postTitle}>{typeData.title}</Text>
          <Text style={styles.postAuthor}>
            by <Text style={styles.postAuthorName}>{post.author_name}</Text>
          </Text>
        </View>
      </View>

      {/* Question limit banner */}
      {!isOwner && (
        <View style={styles.limitBanner}>
          <MessageSquare size={14} color={limitReached ? "#EF4444" : "#6B7280"} />
          <Text style={[
            styles.limitBannerText,
            limitReached && styles.limitBannerTextReached,
          ]}>
            {limitReached
              ? `You've used all ${maxQuestionsPerUser} question${maxQuestionsPerUser > 1 ? "s" : ""}`
              : `${userQuestionCount} / ${maxQuestionsPerUser} question${maxQuestionsPerUser > 1 ? "s" : ""} used`}
          </Text>
          <View style={[
            styles.limitDots,
            limitReached && styles.limitDotsFull,
          ]}>
            {Array.from({ length: maxQuestionsPerUser }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.limitDot,
                  i < userQuestionCount && styles.limitDotFilled,
                ]}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.divider} />

      {/* Filter Pills */}
      <View style={styles.filterRow}>
        {[
          { key: "all", label: "All" },
          { key: "unanswered", label: "Unanswered" },
          { key: "answered", label: "Answered" },
        ].map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.filterPill,
              filter === item.key && styles.filterPillActive,
            ]}
            onPress={() => setFilter(item.key)}
          >
            <Text
              style={[
                styles.filterPillText,
                filter === item.key && styles.filterPillTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <View style={styles.dividerSubtle} />

      {/* Sort Toggle */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <TouchableOpacity
          style={[styles.sortOption, sort === "top" && styles.sortOptionActive]}
          onPress={() => setSort("top")}
        >
          <TrendingUp
            size={16}
            color={sort === "top" ? "#3B82F6" : "#8E8E93"}
          />
          <Text
            style={[styles.sortText, sort === "top" && styles.sortTextActive]}
          >
            Top
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.sortOption,
            sort === "recent" && styles.sortOptionActive,
          ]}
          onPress={() => setSort("recent")}
        >
          <Clock
            size={16}
            color={sort === "recent" ? "#3B82F6" : "#8E8E93"}
          />
          <Text
            style={[
              styles.sortText,
              sort === "recent" && styles.sortTextActive,
            ]}
          >
            Recent
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const limitReached = userQuestionCount >= maxQuestionsPerUser;
  // Only show input for non-owners (community owners answer, they don't ask)
  const isOwner =
    String(post.author_id) === String(currentUserId) &&
    post.author_type === currentUserType;

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        {/* Double chat bubble illusion */}
        <MessageSquare size={64} color="#9CA3AF" strokeWidth={1.5} style={styles.emptyIconBack} />
        <View style={styles.emptyIconFront}>
          <MessageSquare size={64} color="#6B7280" strokeWidth={1.5} />
        </View>
        <View style={styles.emptyBadgeContainer}>
          <Text style={styles.emptyBadgeText}>?</Text>
        </View>
      </View>
      <Text style={styles.emptyTitle}>No questions yet</Text>
      <Text style={styles.emptySubtitle}>
        Be the first to ask! Your question{"\n"}will appear here once submitted.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color="#1D1D1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {typeData.title || "Questions"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <SnooLoader size="large" color="#5856D6" />
          </View>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={questions}
            renderItem={renderQuestion}
            keyExtractor={(item) => `question-${item.id}`}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor="#5856D6"
              />
            }
          />
        )}
      </View>

      {/* Floating Question Input Bar */}
      <KeyboardStickyView
        offset={{ closed: 0, opened: 0 }}
        style={styles.floatingInputWrapper}
      >
        {isOwner ? null : limitReached ? (
          // Limit reached — locked state
          <View style={styles.inputLockedContainer}>
            <Lock size={16} color="#9CA3AF" />
            <Text style={styles.inputLockedText}>
              You've reached the question limit
            </Text>
          </View>
        ) : (
          // Normal input
          <View style={styles.inputContainerFloating}>
            <TextInput
              style={styles.questionInputFloating}
              placeholder="Ask a question..."
              placeholderTextColor="#9CA3AF"
              value={questionText}
              onChangeText={setQuestionText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendButtonFloating,
                (!questionText.trim() || isSubmitting) &&
                  styles.sendButtonDisabledFloating,
              ]}
              onPress={handleSubmitQuestion}
              disabled={!questionText.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <SnooLoader size="small" color="#FFFFFF" />
              ) : (
                <Send size={18} color="#FFFFFF" style={styles.sendIcon} />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardStickyView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.m,
    paddingVertical: 12,
    backgroundColor: "#F9FAFB",
  },
  backButton: {
    padding: SPACING.xs,
  },
  moreButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontFamily: "BasicCommercial-Bold",
    color: "#1D1D1F",
  },
  headerRight: {
    minWidth: 40,
    alignItems: "flex-end",
  },
  questionCountBadge: {
    fontSize: 13,
    fontFamily: "Manrope-Medium",
    color: "#3B82F6",
    backgroundColor: "#EAF1FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingBottom: SPACING.xl,
    backgroundColor: "#F9FAFB", // light gray list background
  },
  // Header Section
  headerContainer: {
    backgroundColor: "#F9FAFB",
    paddingTop: SPACING.m,
  },
  postInfo: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.m,
    marginBottom: SPACING.l,
  },
  questionIconContainer: {
    width: 64,
    height: 64,
    backgroundColor: "#0F292E",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  questionIconText: {
    position: "absolute",
    fontSize: 16,
    fontFamily: "BasicCommercial-Bold",
    color: "#85999A",
    marginTop: 2,
  },
  postInfoText: {
    marginLeft: SPACING.m,
    flex: 1,
  },
  postTitle: {
    fontSize: 22,
    fontFamily: "BasicCommercial-Bold",
    color: "#1D1D1F",
    lineHeight: 28,
  },
  postAuthor: {
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    color: "#8E8E93",
    marginTop: 4,
  },
  postAuthorName: {
    color: "#059669",
    fontFamily: "Manrope-Medium",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginHorizontal: SPACING.m,
    marginBottom: SPACING.m,
  },
  dividerSubtle: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginHorizontal: SPACING.m,
    marginBottom: SPACING.s,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: SPACING.m,
    marginBottom: SPACING.m,
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginRight: SPACING.s,
  },
  filterPillActive: {
    backgroundColor: "#000000",
    borderColor: "#000000",
  },
  filterPillText: {
    fontSize: 13,
    fontFamily: "Manrope-SemiBold",
    color: "#1D1D1F",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.m,
    marginTop: SPACING.xs,
  },
  sortLabel: {
    fontSize: 14,
    fontFamily: "Manrope-Regular",
    color: "#8E8E93",
    marginRight: SPACING.m,
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: SPACING.l,
    paddingVertical: 4,
  },
  sortOptionActive: {},
  sortText: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: "#8E8E93",
    marginLeft: 6,
  },
  sortTextActive: {
    color: "#1D1D1F",
    fontFamily: "Manrope-SemiBold",
  },
  // Question limit banner
  limitBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.m,
    paddingVertical: 10,
    gap: 8,
  },
  limitBannerText: {
    fontSize: 13,
    fontFamily: "Manrope-Medium",
    color: "#6B7280",
    flex: 1,
  },
  limitBannerTextReached: {
    color: "#EF4444",
  },
  limitDots: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  limitDotsFull: {},
  limitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E5E7EB",
  },
  limitDotFilled: {
    backgroundColor: "#059669",
  },
  // Question Card
  questionCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    marginHorizontal: SPACING.m,
    marginTop: SPACING.m,
    borderRadius: 16,
    padding: SPACING.l,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  upvoteSection: {
    alignItems: "center",
    marginRight: SPACING.m,
    width: 44,
  },
  upvoteButton: {
    marginBottom: 4,
  },
  upvoteButtonActive: {},
  upvoteCount: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#8E8E93",
  },
  upvoteCountActive: {
    color: "#3B82F6",
  },
  questionContent: {
    flex: 1,
  },
  questionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  authorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  authorName: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: "#1D1D1F",
  },
  questionTime: {
    fontSize: 13,
    fontFamily: "Manrope-Regular",
    color: "#8E8E93",
    marginLeft: 4,
  },
  pinnedBadge: {
    marginLeft: SPACING.xs,
    backgroundColor: "#FFFBEB",
    borderRadius: 8,
    padding: 4,
  },
  questionText: {
    fontSize: 16,
    fontFamily: "Manrope-Regular",
    color: "#1D1D1F",
    lineHeight: 24,
    marginBottom: 12,
  },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  answeredBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: SPACING.xs,
  },
  answeredBadgeText: {
    fontSize: 12,
    fontFamily: "Manrope-SemiBold",
    color: "#059669",
    marginLeft: 4,
  },
  lockedBadge: {
    padding: 4,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
  },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingVertical: 4,
  },
  expandButtonText: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#3B82F6",
    marginRight: 6,
  },
  expandIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#EAF1FF",
    alignItems: "center",
    justifyContent: "center",
  },
  // Reply Button
  replyButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingVertical: 6,
  },
  replyButtonText: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#3B82F6",
    marginLeft: 6,
  },
  // Reply Input
  replyInputContainer: {
    marginTop: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: SPACING.m,
  },
  replyInput: {
    fontSize: 15,
    fontFamily: "Manrope-Regular",
    color: "#1D1D1F",
    minHeight: 60,
    maxHeight: 120,
    textAlignVertical: "top",
  },
  replyActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: SPACING.m,
    gap: SPACING.s,
  },
  cancelReplyButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  cancelReplyText: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#5B6B7C",
  },
  sendReplyButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#3B82F6",
    minWidth: 80,
    alignItems: "center",
  },
  sendReplyButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
  sendReplyText: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#FFFFFF",
  },
  // Answers
  answersContainer: {
    marginTop: SPACING.m,
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  answerCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: SPACING.m,
    marginBottom: SPACING.s,
  },
  answerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  answerAuthorAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 6,
  },
  answerAuthorName: {
    fontSize: 13,
    fontFamily: "Manrope-Medium",
    color: "#1D1D1F",
  },
  bestAnswerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  bestAnswerText: {
    fontSize: 11,
    fontFamily: "Manrope-Bold",
    color: "#D97706",
    marginLeft: 4,
  },
  answerTime: {
    fontSize: 12,
    fontFamily: "Manrope-Regular",
    color: "#8E8E93",
    marginLeft: 4,
  },
  answerText: {
    fontSize: 15,
    fontFamily: "Manrope-Regular",
    color: "#1D1D1F",
    lineHeight: 22,
  },
  // Empty State
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    marginTop: SPACING.xl,
  },
  emptyIconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.m,
  },
  emptyIconBack: {
    position: "absolute",
    marginLeft: -20,
    marginTop: -20,
  },
  emptyIconFront: {
    backgroundColor: "#F3F4F6", // clip illusion
    padding: 2,
    borderRadius: 12,
  },
  emptyBadgeContainer: {
    position: "absolute",
    bottom: 25,
    right: 30,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyBadgeText: {
    color: "#059669",
    fontSize: 20,
    fontFamily: "BasicCommercial-Bold",
    marginTop: 2,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: "BasicCommercial-Bold",
    color: "#1D1D1F",
    marginTop: SPACING.m,
  },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: "Manrope-Regular",
    color: "#5B6B7C",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 22,
  },
  // Keyboard container
  keyboardContainer: {
    flex: 1,
  },
  // Anonymous avatar
  anonymousAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  // Floating Input Bar
  floatingInputWrapper: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
  },
  inputLockedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 30,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  inputLockedText: {
    fontSize: 14,
    fontFamily: "Manrope-Medium",
    color: "#9CA3AF",
  },
  inputContainerFloating: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    paddingLeft: 20,
    paddingRight: 8,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  questionInputFloating: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Manrope-Regular",
    color: "#1D1D1F",
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButtonFloating: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  sendButtonDisabledFloating: {
    backgroundColor: "#E5E7EB",
  },
  sendIcon: {
    marginLeft: -2,
  }
});

export default QnAQuestionsScreen;
