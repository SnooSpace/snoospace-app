import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { apiGet, apiPost, apiDelete } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../constants/theme";

const QnAQuestionsScreen = ({ route, navigation }) => {
  const { post } = route.params;
  const typeData = post.type_data || {};

  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState("all"); // all, answered, unanswered
  const [sort, setSort] = useState("top"); // top, recent
  const [expandedQuestionId, setExpandedQuestionId] = useState(null);

  // Question input state
  const [questionText, setQuestionText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchQuestions = useCallback(
    async (showLoading = true) => {
      if (showLoading) setIsLoading(true);
      try {
        const token = await getAuthToken();
        const response = await apiGet(
          `/posts/${post.id}/questions?filter=${filter}&sort=${sort}`,
          15000,
          token
        );

        if (response.success) {
          setQuestions(response.questions || []);
        }
      } catch (error) {
        console.error("Error fetching questions:", error);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [post.id, filter, sort]
  );

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

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
          is_anonymous: isAnonymous && typeData.allow_anonymous,
        },
        15000,
        token
      );

      if (response.success) {
        setQuestionText("");
        setIsAnonymous(false);
        fetchQuestions(false);
        Alert.alert("Question submitted!", "Your question has been posted.");
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
            : q
        )
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
            <Ionicons
              name={item.has_upvoted ? "arrow-up" : "arrow-up-outline"}
              size={20}
              color={item.has_upvoted ? "#5856D6" : COLORS.textSecondary}
            />
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
                <Ionicons
                  name="person"
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
                <Ionicons name="pin" size={10} color="#FF9500" />
              </View>
            )}
          </View>

          {/* Question Text */}
          <Text style={styles.questionText}>{item.content}</Text>

          {/* Status Badges */}
          <View style={styles.badgesRow}>
            {item.is_answered && (
              <View style={styles.answeredBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                <Text style={styles.answeredBadgeText}>Answered</Text>
              </View>
            )}
            {item.is_locked && (
              <View style={styles.lockedBadge}>
                <Ionicons
                  name="lock-closed"
                  size={12}
                  color={COLORS.textSecondary}
                />
              </View>
            )}
          </View>

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
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={16}
                color={COLORS.primary}
              />
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
                        <Ionicons name="star" size={10} color="#FFD700" />
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
        <MaterialCommunityIcons
          name="frequently-asked-questions"
          size={24}
          color="#5856D6"
        />
        <View style={styles.postInfoText}>
          <Text style={styles.postTitle}>{typeData.title}</Text>
          <Text style={styles.postAuthor}>by {post.author_name}</Text>
        </View>
      </View>

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

      {/* Sort Toggle */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <TouchableOpacity
          style={[styles.sortOption, sort === "top" && styles.sortOptionActive]}
          onPress={() => setSort("top")}
        >
          <Ionicons
            name="trending-up"
            size={14}
            color={sort === "top" ? "#5856D6" : COLORS.textSecondary}
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
          <Ionicons
            name="time-outline"
            size={14}
            color={sort === "recent" ? "#5856D6" : COLORS.textSecondary}
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

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons
        name="comment-question-outline"
        size={48}
        color={COLORS.textSecondary}
      />
      <Text style={styles.emptyTitle}>No questions yet</Text>
      <Text style={styles.emptySubtitle}>Be the first to ask!</Text>
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
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Questions</Text>
        <View style={styles.headerRight}>
          <Text style={styles.questionCountBadge}>{questions.length}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#5856D6" />
          </View>
        ) : (
          <FlatList
            data={questions}
            renderItem={renderQuestion}
            keyExtractor={(item) => `question-${item.id}`}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor="#5856D6"
              />
            }
          />
        )}

        {/* Question Input Bar */}
        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.questionInput}
              placeholder="Ask a question..."
              placeholderTextColor={COLORS.textSecondary}
              value={questionText}
              onChangeText={setQuestionText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!questionText.trim() || isSubmitting) &&
                  styles.sendButtonDisabled,
              ]}
              onPress={handleSubmitQuestion}
              disabled={!questionText.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  headerRight: {
    minWidth: 40,
    alignItems: "flex-end",
  },
  questionCountBadge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#5856D6",
    backgroundColor: "#5856D615",
    paddingHorizontal: SPACING.s,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.s,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingBottom: SPACING.xl,
  },
  // Header Section
  headerContainer: {
    backgroundColor: COLORS.surface,
    padding: SPACING.m,
    marginBottom: SPACING.s,
    ...SHADOWS.sm,
  },
  postInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.m,
  },
  postInfoText: {
    marginLeft: SPACING.s,
    flex: 1,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  postAuthor: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  filterRow: {
    flexDirection: "row",
    marginBottom: SPACING.s,
  },
  filterPill: {
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.l,
    backgroundColor: COLORS.screenBackground,
    marginRight: SPACING.s,
  },
  filterPillActive: {
    backgroundColor: "#5856D6",
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sortLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginRight: SPACING.s,
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: SPACING.m,
    paddingVertical: 4,
  },
  sortOptionActive: {},
  sortText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  sortTextActive: {
    color: "#5856D6",
    fontWeight: "600",
  },
  // Question Card
  questionCard: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.m,
    marginTop: SPACING.s,
    borderRadius: BORDER_RADIUS.l,
    padding: SPACING.m,
    ...SHADOWS.sm,
  },
  upvoteSection: {
    alignItems: "center",
    marginRight: SPACING.m,
    width: 40,
  },
  upvoteButton: {
    padding: SPACING.xs,
  },
  upvoteButtonActive: {},
  upvoteCount: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  upvoteCountActive: {
    color: "#5856D6",
  },
  questionContent: {
    flex: 1,
  },
  questionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  authorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  authorName: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textPrimary,
  },
  questionTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  pinnedBadge: {
    marginLeft: SPACING.xs,
    backgroundColor: "#FF950020",
    borderRadius: 8,
    padding: 3,
  },
  questionText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 22,
    marginBottom: SPACING.xs,
  },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  answeredBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.s,
    marginRight: SPACING.xs,
  },
  answeredBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#34C759",
    marginLeft: 3,
  },
  lockedBadge: {
    padding: 3,
  },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.xs,
  },
  expandButtonText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "500",
    marginRight: 4,
  },
  // Answers
  answersContainer: {
    marginTop: SPACING.m,
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  answerCard: {
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    marginBottom: SPACING.s,
  },
  answerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  answerAuthorAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 6,
  },
  answerAuthorName: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  bestAnswerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF8E1",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.s,
    marginLeft: SPACING.xs,
  },
  bestAnswerText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#F9A825",
    marginLeft: 2,
  },
  answerTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  answerText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  // Empty State
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    marginTop: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginTop: SPACING.m,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
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
    backgroundColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  // Input Bar
  inputContainer: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.m,
    paddingTop: SPACING.s,
    paddingBottom: SPACING.m,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  questionInput: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.l,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    fontSize: 15,
    color: COLORS.textPrimary,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#5856D6",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: SPACING.s,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.border,
  },
});

export default QnAQuestionsScreen;
