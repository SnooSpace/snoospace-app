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
import AnimatedProgressBar from "./AnimatedProgressBar";

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

    const shouldShowResults =
      hasVoted || isExpired || typeData.show_results_before_vote === true;

    const optionText = option.text || `Option ${index + 1}`;

    if (!shouldShowResults) {
      // Pre-vote state
      return (
        <TouchableOpacity
          key={option.index}
          style={styles.optionButton}
          onPress={() => handleVote(option.index)}
          disabled={isVoting || isExpired}
          activeOpacity={0.8}
        >
          <Text style={styles.optionButtonText}>{optionText}</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={option.index}
        style={styles.optionResult}
        onPress={() => handleVote(option.index)}
        disabled={isVoting || isExpired}
        activeOpacity={0.85}
      >
        {/* Animated Progress fill */}
        <AnimatedProgressBar percentage={percentage} isSelected={isSelected} />

        {/* Content */}
        <View style={styles.optionContent}>
          <View style={styles.optionTextRow}>
            <Text
              style={[
                styles.optionText,
                isSelected && styles.optionTextSelected,
              ]}
              numberOfLines={2}
            >
              {optionText}
            </Text>

            {isSelected && (
              <MaterialCommunityIcons
                name="check-bold"
                size={16}
                color="#ffffff"
              />
            )}
          </View>

          <Text
            style={[
              styles.percentageText,
              percentage === 100 && styles.percentageTextFull,
            ]}
          >
            {percentage}%
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with Type Indicator & Chat Icon */}
      <View style={styles.headerRow}>
        <View style={styles.pollBadge}>
          <Text style={styles.pollBadgeText}>POLL</Text>
        </View>
        <View style={styles.pollIconContainer}>
          <Ionicons name="stats-chart" size={24} color="#3b65e4" />
        </View>
      </View>

      {/* Author Info */}
      <TouchableOpacity style={styles.authorRow} onPress={handleUserPress}>
        <Image
          source={
            post.author_photo_url
              ? { uri: post.author_photo_url }
              : { uri: "https://via.placeholder.com/40" }
          }
          style={styles.profileImage}
        />
        <Text style={styles.authorName}>
          @{post.author_username || post.author_name}
        </Text>
        <Text style={styles.separator}>•</Text>
        <Text style={styles.timestamp}>{formatTimeAgo(post.created_at)}</Text>
      </TouchableOpacity>

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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.m,
  },
  pollIconContainer: {
    width: 44,
    height: 44,
    backgroundColor: "rgba(59, 101, 228, 0.08)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pollBadge: {
    backgroundColor: "#daecf8",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pollBadgeText: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 10,
    color: "#3b65e4",
    letterSpacing: 0.5,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.m,
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  authorName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#314151",
  },
  separator: {
    fontSize: 13,
    fontWeight: "400",
    color: "#9CA3AF",
    marginHorizontal: 4,
  },
  timestamp: {
    fontSize: 13,
    fontWeight: "400",
    color: "#9CA3AF",
  },
  question: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 24,
    color: "#1D1D1F",
    marginBottom: SPACING.m,
    lineHeight: 30,
  },
  optionsContainer: {
    gap: SPACING.s,
  },
  optionButton: {
    backgroundColor: "#f9fafc",
    borderRadius: 14,
    padding: 14,
  },
  optionButtonDisabled: {
    opacity: 0.6,
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1D1D1F",
  },
  optionResult: {
    backgroundColor: "#f9fafc",
    borderRadius: 14,
    overflow: "hidden",
    minHeight: 52,
    position: "relative",
  },
  optionResultSelected: {
    backgroundColor: "#3665f3", // Solid blue for selected
    borderWidth: 0,
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },

  optionContent: {
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  // The progress bar that sits behind the content
  resultBarInline: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#E5E7EB",
    zIndex: 0,
  },
  resultBarInlineSelected: {
    backgroundColor: "#3665f3", // Same as container for selected (full fill illusion)
    opacity: 0, // Hide progress bar for selected item since it's full solid color
  },
  // Content that sits on top of the bar
  optionContentOverlay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    zIndex: 1,
    position: "relative",
  },
  optionTextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  checkIcon: {
    marginRight: 8,
    fontSize: 16,
    color: "#FFFFFF", // White checkmark
  },
  optionText: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 14,
    color: "#314151",
  },

  optionTextSelected: {
    color: "#ffffff",
    fontWeight: "600",
  },

  percentageText: {
    fontSize: 14,
    fontFamily: "BasicCommercial-Bold",
    color: "#AFC8EA",
  },

  percentageTextFull: {
    color: "#ffffff",
  },

  percentageTextSelected: {
    color: "#ffffff",
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
