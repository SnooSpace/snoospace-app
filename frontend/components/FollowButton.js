import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { apiPost, apiDelete } from "../api/client";
import { getAuthToken } from "../api/auth";
import { trackFollow } from "../utils/followTracker";
import HapticsService from "../services/HapticsService";

const COLORS = {
  primary: "#3B82F6", // Editorial accent blue
  textDark: "#1A1A1A",
  textLight: "#6B7280",
  background: "#FFFFFF",
  white: "#fff",
  error: "#FF4444",
  success: "#00C851",
  border: "#E5E7EB",
};

const FollowButton = ({
  userId,
  userType,
  isFollowing = false,
  isInCircle = false,
  isCircleRequested = false,
  isAdd = false,
  onFollowChange,
  style,
  textStyle,
  isLoading: externalLoading = false,
  currentFollowerId,
  navigationContext,
}) => {
  // Fully controlled component - no internal state, just use props
  const handleFollowToggle = async () => {
    if (externalLoading) return;

    try {
      HapticsService.triggerFollow();
      // Just call the callback - let parent handle API calls and state management
      if (onFollowChange) {
        await onFollowChange(userId, userType, !isFollowing);
      }

      // Track follow intent (non-blocking, fire-and-forget)
      if (!isFollowing && !isInCircle && !isCircleRequested && !isAdd && currentFollowerId) {
        trackFollow(currentFollowerId, userId, navigationContext);
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
    }
  };

  const combinedLoading = externalLoading;

  const getButtonText = () => {
    if (combinedLoading) return "...";
    if (isInCircle) return "In Circle";
    if (isCircleRequested) return "Requested";
    if (isAdd) return "Add";
    return isFollowing ? "Following" : "Follow";
  };

  const getButtonStyle = () => {
    if (isInCircle) return styles.inCircleButton;
    if (isCircleRequested) return styles.requestedButton;
    if (isAdd) return styles.addButton;
    return isFollowing ? styles.followingButton : styles.followButton;
  };

  const getTextStyle = () => {
    if (isInCircle) return styles.inCircleText;
    if (isCircleRequested) return styles.requestedText;
    if (isAdd) return styles.addText;
    return isFollowing ? styles.followingText : styles.followText;
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getButtonStyle(),
        style,
        combinedLoading && styles.loadingButton,
      ]}
      onPress={handleFollowToggle}
      disabled={combinedLoading}
    >
      <Text
        style={[
          styles.buttonText,
          getTextStyle(),
          textStyle,
        ]}
      >
        {getButtonText()}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
  },
  followButton: {
    backgroundColor: COLORS.primary,
  },
  followingButton: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inCircleButton: {
    backgroundColor: "rgba(68, 138, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(68, 138, 255, 0.2)",
  },
  requestedButton: {
    backgroundColor: "rgba(68, 138, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(68, 138, 255, 0.2)",
  },
  addButton: {
    backgroundColor: "#448AFF",
  },
  loadingButton: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
  },
  followText: {
    color: COLORS.white,
  },
  followingText: {
    color: COLORS.textDark,
  },
  inCircleText: {
    color: "#448AFF",
  },
  requestedText: {
    color: "#448AFF",
  },
  addText: {
    color: COLORS.white,
  },
});

export default FollowButton;
