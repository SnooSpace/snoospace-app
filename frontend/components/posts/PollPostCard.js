/**
 * PollPostCard
 * Displays a poll post with voting functionality
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { apiPost, apiDelete } from "../../api/client";
import { getAuthToken } from "../../api/auth";
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from "../../constants/theme";

const PollPostCard = ({
  post,
  onUserPress,
  currentUserId,
  currentUserType,
}) => {
  const typeData = post.type_data || {};
  const [hasVoted, setHasVoted] = useState(post.has_voted || false);
  const [votedIndexes, setVotedIndexes] = useState(post.voted_indexes || []);
  const [options, setOptions] = useState(typeData.options || []);
  const [totalVotes, setTotalVotes] = useState(typeData.total_votes || 0);
  const [isVoting, setIsVoting] = useState(false);
  const [votingIndex, setVotingIndex] = useState(null);

  // Sync state with props whenever they change (important for FlatList recycling)
  useEffect(() => {
    setHasVoted(post.has_voted || false);
    setVotedIndexes(post.voted_indexes || []);
    setOptions(typeData.options || []);
    setTotalVotes(typeData.total_votes || 0);
  }, [
    post.id,
    post.has_voted,
    post.voted_indexes,
    typeData.options,
    typeData.total_votes,
  ]);

  const isExpired = post.expires_at && new Date(post.expires_at) < new Date();

  const handleVote = async (optionIndex) => {
    // Only block if poll is expired or currently voting
    if (isVoting || isExpired) return;

    setIsVoting(true);
    setVotingIndex(optionIndex);
    try {
      const token = await getAuthToken();

      // If clicking the already-selected option, remove the vote
      if (votedIndexes.includes(optionIndex)) {
        const response = await apiDelete(
          `/posts/${post.id}/vote`,
          {}, // empty body
          15000,
          token,
        );

        if (response.success) {
          setHasVoted(false);
          setVotedIndexes([]);
          // Use updated options and total_votes from response
          if (response.options) {
            setOptions(response.options);
          }
          if (response.total_votes !== undefined) {
            setTotalVotes(response.total_votes);
          }
        }
      } else {
        // Vote for a new option (or change vote)
        const response = await apiPost(
          `/posts/${post.id}/vote`,
          { option_index: optionIndex },
          15000,
          token,
        );

        if (response.success) {
          setHasVoted(true);
          setVotedIndexes([optionIndex]);
          setOptions(response.options);
          setTotalVotes(response.total_votes);
        }
      }
    } catch (error) {
      console.error("Error voting:", error);
    } finally {
      setIsVoting(false);
      setVotingIndex(null);
    }
  };

  const handleUserPress = () => {
    if (onUserPress) {
      onUserPress(post.author_id, post.author_type);
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const postTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - postTime) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d`;
    return `${Math.floor(diffInSeconds / 2592000)}mo`;
  };

  const formatExpiryTime = (expiresAt) => {
    if (!expiresAt) return null;
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry - now;

    if (diff <= 0) return "Ended";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d left`;
    if (hours > 0) return `${hours}h left`;
    return "Ending soon";
  };

  const renderOption = (option, index) => {
    const isSelected = votedIndexes.includes(option.index);
    const percentage =
      totalVotes > 0 ? Math.round((option.vote_count / totalVotes) * 100) : 0;

    // Determine if we should show results view (with bars and percentages)
    const shouldShowResults =
      hasVoted || isExpired || typeData.show_results_before_vote === true;

    // Fallback text if text is somehow missing
    const optionText = option.text || `Option ${index + 1}`;

    // Debug logging
    console.log(
      `[PollPostCard] Rendering option ${index}: "${optionText}", shouldShowResults: ${shouldShowResults}, hasVoted: ${hasVoted}`,
    );

    if (shouldShowResults) {
      // Results view - show bar and percentage
      return (
        <TouchableOpacity
          key={`poll-opt-${option.index}-${index}`}
          style={[
            styles.optionResult,
            isSelected && styles.optionResultSelected,
          ]}
          onPress={() => handleVote(option.index)}
          disabled={isExpired || isVoting}
          activeOpacity={0.7}
        >
          {/* Background progress bar - now using simple View with width percentage */}
          <View
            style={[
              styles.resultBarInline,
              isSelected && styles.resultBarInlineSelected,
              { width: `${percentage}%` },
            ]}
          />

          {/* Content overlay */}
          <View style={styles.optionContentOverlay}>
            <View style={styles.optionTextRow}>
              {isSelected && (
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={COLORS.primary}
                  style={styles.checkIcon}
                />
              )}
              <Text
                style={[
                  styles.optionText,
                  isSelected && styles.optionTextSelected,
                ]}
                numberOfLines={2}
              >
                {optionText}
              </Text>
            </View>
            <Text style={styles.percentageText}>{percentage}%</Text>
          </View>

          {isVoting && votingIndex === option.index && (
            <ActivityIndicator
              size="small"
              color={COLORS.primary}
              style={styles.votingIndicator}
            />
          )}
        </TouchableOpacity>
      );
    }

    // Voting view (before any vote)
    return (
      <TouchableOpacity
        key={`poll-opt-${option.index}-${index}`}
        style={[styles.optionButton, isVoting && styles.optionButtonDisabled]}
        onPress={() => handleVote(option.index)}
        disabled={isVoting || isExpired}
        activeOpacity={0.7}
      >
        <Text style={styles.optionButtonText} numberOfLines={2}>
          {optionText}
        </Text>
        {isVoting && votingIndex === option.index && (
          <ActivityIndicator size="small" color={COLORS.primary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.typeIndicator}>
          <MaterialCommunityIcons name="poll" size={14} color="#7B1FA2" />
          <Text style={styles.typeLabel}>POLL</Text>
        </View>
        <TouchableOpacity style={styles.userInfo} onPress={handleUserPress}>
          <Image
            source={
              post.author_photo_url
                ? { uri: post.author_photo_url }
                : { uri: "https://via.placeholder.com/40" }
            }
            style={styles.profileImage}
          />
          <View style={styles.userDetails}>
            <Text style={styles.authorName}>{post.author_name}</Text>
            <Text style={styles.timestamp}>
              {formatTimeAgo(post.created_at)}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Question */}
      <Text style={styles.question}>{typeData.question}</Text>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {options.map((opt, idx) => renderOption(opt, idx))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.voteCount}>
          {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
        </Text>
        {post.expires_at && (
          <Text style={[styles.expiryText, isExpired && styles.expiredText]}>
            • {formatExpiryTime(post.expires_at)}
          </Text>
        )}
      </View>

      {/* Expired Overlay */}
      {isExpired && !hasVoted && (
        <View style={styles.expiredOverlay}>
          <Text style={styles.expiredOverlayText}>Poll ended</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.m,
    marginHorizontal: SPACING.m,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.m,
    overflow: "hidden",
  },
  header: {
    marginBottom: SPACING.m,
  },
  typeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.s,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7B1FA2",
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: SPACING.s,
  },
  userDetails: {},
  authorName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  timestamp: {
    fontSize: 12,
    fontWeight: "600",
    color: "#5e8d9b",
  },
  question: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
    lineHeight: 22,
  },
  optionsContainer: {
    gap: SPACING.s,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionButtonDisabled: {
    opacity: 0.6,
  },
  optionButtonText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: "500",
  },
  optionResult: {
    position: "relative",
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.m,
    minHeight: 48,
    // No overflow hidden - this was causing issues
  },
  optionResultSelected: {
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  // The progress bar that sits behind the content
  resultBarInline: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#E3F2FD",
    borderRadius: BORDER_RADIUS.m,
    zIndex: 0,
  },
  resultBarInlineSelected: {
    backgroundColor: "#BBDEFB",
  },
  // Content that sits on top of the bar
  optionContentOverlay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SPACING.m,
    zIndex: 1,
    position: "relative",
  },
  optionTextRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  checkIcon: {
    marginRight: 6,
  },
  optionText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: "500",
  },
  optionTextSelected: {
    fontWeight: "600",
    color: COLORS.primary,
  },
  percentageText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.m,
  },
  voteCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  expiryText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  expiredText: {
    color: COLORS.error,
  },
  expiredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BORDER_RADIUS.xl,
  },
  expiredOverlayText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  votingIndicator: {
    position: "absolute",
    right: SPACING.m,
    top: "50%",
    marginTop: -10,
  },
});

export default PollPostCard;
