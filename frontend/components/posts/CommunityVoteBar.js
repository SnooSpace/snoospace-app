import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ArrowUp, ArrowDown } from "lucide-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { COLORS, FONTS } from "../../constants/theme";
import HapticsService from "../../services/HapticsService";
import { voteCommunityPost } from "../../api/posts";
import EventBus from "../../utils/EventBus";

const UPVOTE_COLOR = "#FF4500"; // Vibrant community orange
const DOWNVOTE_COLOR = "#7193FF"; // Community periwinkle blue
const NEUTRAL_COLOR = "#8E8E93";

export default function CommunityVoteBar({
  postId,
  initialVoteScore = 0,
  initialUserVote = 0,
  onVoteChange,
  style,
}) {
  const [userVote, setUserVote] = useState(initialUserVote || 0);
  const [voteScore, setVoteScore] = useState(initialVoteScore || 0);
  const isVotingRef = useRef(false);

  // Reanimated scale bounces
  const upScale = useSharedValue(1);
  const downScale = useSharedValue(1);
  const scoreScale = useSharedValue(1);

  const upAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: upScale.value }],
  }));

  const downAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: downScale.value }],
  }));

  const scoreAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
  }));

  useEffect(() => {
    setUserVote(initialUserVote || 0);
    setVoteScore(initialVoteScore || 0);
  }, [initialUserVote, initialVoteScore]);

  // Sync via EventBus across different screens or card instances
  useEffect(() => {
    const handleVoteSync = (payload) => {
      if (payload?.postId === postId) {
        if (typeof payload.voteScore === "number") setVoteScore(payload.voteScore);
        if (typeof payload.userVote === "number") setUserVote(payload.userVote);
      }
    };

    const unsub = EventBus.on("community-vote-updated", handleVoteSync);
    return () => {
      if (unsub) unsub();
    };
  }, [postId]);

  const handleVote = useCallback(
    async (targetType) => {
      if (!postId || isVotingRef.current) return;
      isVotingRef.current = true;

      // Determine new vote state
      // If clicking already active vote -> revert to 0 (neutral)
      const nextVote = userVote === targetType ? 0 : targetType;

      // Optimistic score update
      // delta = nextVote - userVote
      const scoreDelta = nextVote - userVote;
      const nextScore = voteScore + scoreDelta;

      setUserVote(nextVote);
      setVoteScore(nextScore);

      // Trigger animations and haptics
      if (nextVote === 1) {
        HapticsService.triggerLike();
        upScale.value = withSequence(
          withSpring(1.3, { damping: 10, stiffness: 200 }),
          withSpring(1)
        );
      } else if (nextVote === -1) {
        HapticsService.triggerImpactLight();
        downScale.value = withSequence(
          withSpring(1.3, { damping: 10, stiffness: 200 }),
          withSpring(1)
        );
      } else {
        HapticsService.triggerImpactLight();
      }

      scoreScale.value = withSequence(
        withTiming(1.15, { duration: 120 }),
        withSpring(1, { damping: 12, stiffness: 180 })
      );

      // Inform parent if callback provided
      if (onVoteChange) {
        onVoteChange(postId, nextVote, nextScore);
      }

      // Emit EventBus for global sync
      EventBus.emit("community-vote-updated", {
        postId,
        userVote: nextVote,
        voteScore: nextScore,
      });

      try {
        const res = await voteCommunityPost(postId, nextVote);
        if (res && res.success) {
          if (typeof res.voteScore === "number") setVoteScore(res.voteScore);
          if (typeof res.userVote === "number") setUserVote(res.userVote);
        }
      } catch (err) {
        console.warn("[CommunityVoteBar] Vote request failed, reverting:", err.message);
        // Rollback on network failure
        setUserVote(userVote);
        setVoteScore(voteScore);
      } finally {
        isVotingRef.current = false;
      }
    },
    [postId, userVote, voteScore, onVoteChange, upScale, downScale, scoreScale]
  );

  const isUpvoted = userVote === 1;
  const isDownvoted = userVote === -1;

  const scoreColor = isUpvoted
    ? UPVOTE_COLOR
    : isDownvoted
    ? DOWNVOTE_COLOR
    : "#1D1D1F";

  return (
    <View style={[styles.container, style]}>
      <View style={styles.pill}>
        {/* Upvote Button */}
        <TouchableOpacity
          style={[styles.voteButton, isUpvoted && styles.voteButtonActiveUp]}
          onPress={() => handleVote(1)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
        >
          <Animated.View style={upAnimStyle}>
            <ArrowUp
              size={17}
              color={isUpvoted ? UPVOTE_COLOR : NEUTRAL_COLOR}
              strokeWidth={isUpvoted ? 2.6 : 2}
            />
          </Animated.View>
        </TouchableOpacity>

        {/* Score Counter */}
        <Animated.View style={[styles.scoreWrapper, scoreAnimStyle]}>
          <Text style={[styles.scoreText, { color: scoreColor }]}>
            {voteScore}
          </Text>
        </Animated.View>

        {/* Downvote Button */}
        <TouchableOpacity
          style={[styles.voteButton, isDownvoted && styles.voteButtonActiveDown]}
          onPress={() => handleVote(-1)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        >
          <Animated.View style={downAnimStyle}>
            <ArrowDown
              size={17}
              color={isDownvoted ? DOWNVOTE_COLOR : NEUTRAL_COLOR}
              strokeWidth={isDownvoted ? 2.6 : 2}
            />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 20,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  voteButton: {
    width: 32,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
  },
  voteButtonActiveUp: {
    backgroundColor: "rgba(255, 69, 0, 0.12)",
  },
  voteButtonActiveDown: {
    backgroundColor: "rgba(113, 147, 255, 0.14)",
  },
  scoreWrapper: {
    minWidth: 26,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  scoreText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    letterSpacing: 0.2,
  },
});
