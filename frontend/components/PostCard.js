import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { apiPost, apiDelete } from "../api/client";
import { getAuthToken } from "../api/auth";
import EventBus from "../utils/EventBus";
import MentionTextRenderer from "./MentionTextRenderer";

// Import type-specific card components
import PollPostCard from "./posts/PollPostCard";
import PromptPostCard from "./posts/PromptPostCard";
import QnAPostCard from "./posts/QnAPostCard";
import ChallengePostCard from "./posts/ChallengePostCard";
import EditorialPostCard from "./EditorialPostCard";

const PostCard = ({
  post,
  onUserPress,
  onLike,
  onComment,
  onPostUpdate,
  currentUserId,
  currentUserType,
  isVideoPlaying = false,
}) => {
  const postType = post.post_type || "media";

  if (postType === "poll") {
    return (
      <PollPostCard
        post={post}
        onUserPress={onUserPress}
        onPostUpdate={onPostUpdate}
        currentUserId={currentUserId}
        currentUserType={currentUserType}
      />
    );
  }

  if (postType === "prompt") {
    return (
      <PromptPostCard
        post={post}
        onUserPress={onUserPress}
        onPostUpdate={onPostUpdate}
        currentUserId={currentUserId}
        currentUserType={currentUserType}
      />
    );
  }

  if (postType === "qna") {
    return (
      <QnAPostCard
        post={post}
        onUserPress={onUserPress}
        onPostUpdate={onPostUpdate}
        currentUserId={currentUserId}
        currentUserType={currentUserType}
      />
    );
  }

  if (postType === "challenge") {
    return (
      <ChallengePostCard
        post={post}
        onUserPress={onUserPress}
        onPostUpdate={onPostUpdate}
        currentUserId={currentUserId}
        currentUserType={currentUserType}
      />
    );
  }

  // Default: Media/text post with the new editorial design
  return (
    <EditorialPostCard
      post={post}
      onUserPress={onUserPress}
      onLike={onLike}
      onComment={onComment}
      onPostUpdate={onPostUpdate}
      currentUserId={currentUserId}
      currentUserType={currentUserType}
      isVideoPlaying={isVideoPlaying}
      showFollowButton={true}
    />
  );
};

export default PostCard;
