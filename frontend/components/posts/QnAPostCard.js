/**
 * QnAPostCard
 * Displays a Q&A post with question submission, upvoting, and top answer preview
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { apiPost, apiGet } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  FONTS,
} from "../../constants/theme";

const QnAPostCard = ({ post, onUserPress, currentUserId, currentUserType }) => {
  const navigation = useNavigation();
  const typeData = post.type_data || {};
  const [userQuestionCount, setUserQuestionCount] = useState(
    post.user_question_count || 0,
  );
  const [questionCount, setQuestionCount] = useState(
    typeData.question_count || 0,
  );
  const [answeredCount, setAnsweredCount] = useState(
    typeData.answered_count || 0,
  );
  const [showAskModal, setShowAskModal] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState(
    post.preview_question || null,
  );

  const isExpired = post.expires_at && new Date(post.expires_at) < new Date();

  // Format time ago utility
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return "";
    const now = new Date();
    const postTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - postTime) / 1000);

    if (diffInSeconds < 60) return "JUST NOW";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}M AGO`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}H AGO`;
    if (diffInSeconds < 2592000)
      return `${Math.floor(diffInSeconds / 86400)}D AGO`;
    return `${Math.floor(diffInSeconds / 2592000)}MO AGO`;
  };

  // Sync state with props
  useEffect(() => {
    setUserQuestionCount(post.user_question_count || 0);
    setQuestionCount(typeData.question_count || 0);
    setAnsweredCount(typeData.answered_count || 0);
    setPreviewQuestion(post.preview_question || null);
  }, [
    post.id,
    post.user_question_count,
    typeData.question_count,
    typeData.answered_count,
    post.preview_question,
  ]);

  const handleUserPress = () => {
    if (onUserPress) {
      onUserPress(post.author_id, post.author_type);
    }
  };

  const handleAddAnswer = () => {
    navigation.navigate("QnAQuestions", { post, autoFocus: true });
  };

  // Get participant data from backend
  const participants = typeData.participants || [];
  const participantCount = typeData.participant_count || participants.length;

  const renderTopAnswer = () => {
    // If we have a preview question (top answer), display it
    if (!previewQuestion) return null;

    return (
      <View style={styles.topAnswerContainer}>
        {/* Blue vertical line */}
        <View style={styles.verticalLine} />

        <View style={styles.topAnswerContent}>
          {/* Top Answer Header */}
          <View style={styles.topAnswerHeader}>
            <View style={styles.topAnswerBadge}>
              <Text style={styles.topAnswerBadgeText}>TOP ANSWER</Text>
            </View>

            <View style={styles.topAnswerMeta}>
              <Text style={styles.topAnswerUsername} numberOfLines={1}>
                @
                {previewQuestion.author_username ||
                  previewQuestion.author_name
                    ?.toLowerCase()
                    .replace(/\s+/g, "") ||
                  "anonymous"}
              </Text>
            </View>

            <View style={styles.upvoteContainer}>
              <Ionicons name="arrow-up" size={14} color={COLORS.primary} />
              <Text style={styles.upvoteCount}>
                {previewQuestion.upvote_count || 0}
              </Text>
            </View>
          </View>

          {/* Answer Content */}
          <Text style={styles.answerText} numberOfLines={4}>
            "{previewQuestion.content}"
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Row: Q&A Badge + Avatar Stack + Question Icon */}
      <View style={styles.headerRow}>
        <View style={styles.qnaBadge}>
          <Text style={styles.qnaBadgeText}>Q&A</Text>
        </View>

        <View style={styles.rightHeaderContent}>
          <View style={styles.avatarStack}>
            {participants.slice(0, 2).map((participant, index) => (
              <Image
                key={index}
                source={{
                  uri:
                    participant.photo_url || "https://via.placeholder.com/24",
                }}
                style={[
                  styles.stackAvatar,
                  { marginLeft: index > 0 ? -8 : 0, zIndex: 3 - index },
                ]}
              />
            ))}
            {participantCount > 2 && (
              <View style={[styles.countBadge, { marginLeft: -8, zIndex: 1 }]}>
                <Text style={styles.countText}>+{participantCount - 2}</Text>
              </View>
            )}
          </View>

          <View style={styles.questionIconContainer}>
            <Ionicons name="help-circle" size={28} color="#334456" />
          </View>
        </View>
      </View>

      {/* Author Row */}
      <TouchableOpacity
        style={styles.authorRow}
        onPress={handleUserPress}
        activeOpacity={0.7}
      >
        <Image
          source={{
            uri: post.author_photo_url || "https://via.placeholder.com/24",
          }}
          style={styles.authorAvatar}
        />
        <Text style={styles.authorUsername}>
          @
          {post.author_username ||
            post.author_name?.toLowerCase().replace(/\s+/g, "") ||
            "user"}
        </Text>
        <Text style={styles.separator}>•</Text>
        <Text style={styles.timestamp}>{formatTimeAgo(post.created_at)}</Text>
      </TouchableOpacity>

      {/* Question Text */}
      <Text style={styles.questionText} numberOfLines={4}>
        {typeData.title}
      </Text>

      {/* Top Answer Preview Section */}
      {renderTopAnswer()}

      {/* View All CTA */}
      <TouchableOpacity
        style={styles.viewAllCTA}
        onPress={() => navigation.navigate("QnAQuestions", { post })}
      >
        <LinearGradient
          colors={["#448AFF", "#2962FF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.viewAllGradient}
        >
          <Text style={styles.viewAllText}>
            {questionCount === 1
              ? "View 1 answer"
              : `View all ${questionCount} answers`}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={18}
            color="#FFFFFF"
            style={{ marginLeft: 6 }}
          />
        </LinearGradient>
      </TouchableOpacity>

      {/* Footer Row */}
      <View style={styles.footerRow}>
        <Text style={styles.votesText}>
          {typeData.vote_count || 0} votes total
        </Text>

        <TouchableOpacity style={styles.addAnswerCTA} onPress={handleAddAnswer}>
          <Text style={styles.addAnswerText}>Add your answer </Text>
          <MaterialCommunityIcons
            name="pencil-outline"
            size={16}
            color="#5e8d9b"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    marginBottom: SPACING.m,
    marginHorizontal: SPACING.m,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.l, // 24px
  },

  // Header Row
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  qnaBadge: {
    backgroundColor: "#60A5FA", // Blue background
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  qnaBadgeText: {
    color: "#FFFFFF", // White text
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // Right side of header (avatar stack + icon)
  rightHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  // Avatar Stack
  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  stackAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  countBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#3B82F6", // Brand blue
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  countText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },

  // Question Icon
  questionIconContainer: {
    width: 44,
    height: 44,
    backgroundColor: "#cbf3f2",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  // Author Row
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  authorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  authorUsername: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5e8d9b", // Muted teal
  },
  separator: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5e8d9b",
    marginHorizontal: 4,
  },
  timestamp: {
    fontSize: 11,
    fontWeight: "600",
    color: "#5e8d9b",
    textTransform: "uppercase",
  },

  // Question Text
  questionText: {
    fontSize: 20,
    fontFamily: FONTS.primary || "System", // BasicCommercial-Bold
    color: "#1D1D1F",
    lineHeight: 28,
    marginBottom: 16,
    letterSpacing: -0.3,
  },

  // Top Answer Section
  topAnswerContainer: {
    flexDirection: "row",
    marginBottom: 16,
  },
  verticalLine: {
    width: 4,
    backgroundColor: "#3B82F6", // Blue line
    borderRadius: 2,
    marginRight: 12,
  },
  topAnswerContent: {
    flex: 1,
    backgroundColor: "#F5F7FA", // Light gray
    borderRadius: 12,
    padding: 16,
  },
  topAnswerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    justifyContent: "space-between",
  },
  topAnswerBadge: {
    backgroundColor: "#E8F4FD", // Light blue background
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginRight: 8,
  },
  topAnswerBadgeText: {
    color: "#3B82F6", // Blue text
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  topAnswerMeta: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  topAnswerAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  topAnswerUsername: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5e8d9b",
    flex: 1,
  },
  upvoteContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  upvoteCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
  },
  answerText: {
    fontSize: 14,
    color: "#5e8d9b",
    lineHeight: 22,
    marginTop: 8,
  },

  // View All CTA
  viewAllCTA: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  viewAllGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: SPACING.m,
  },
  viewAllText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  // Footer Row
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
  },
  votesText: {
    fontSize: 13,
    color: "#5e8d9b",
    fontWeight: "400",
  },
  addAnswerCTA: {
    flexDirection: "row",
    alignItems: "center",
  },
  addAnswerText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#5e8d9b", // Muted teal
  },
});

export default QnAPostCard;
