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

import { COLORS as globalColors } from "../constants/theme";

const COLORS = {
  primary: globalColors.primary, // Brand Blue (#2962FF)
  textDark: globalColors.editorial.textPrimary, // #1a2d4a
  textLight: globalColors.editorial.textSecondary, // #6B7280
  background: "#FFFFFF",
  white: "#fff",
  error: globalColors.error, // #E53E3E
  success: globalColors.success, // #34C759
  border: globalColors.border, // #E5E5EA
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
    backgroundColor: "rgba(41, 98, 255, 0.08)", // transparent Brand Blue
    borderWidth: 1,
    borderColor: "rgba(41, 98, 255, 0.2)",
  },
  requestedButton: {
    backgroundColor: "rgba(41, 98, 255, 0.1)", // transparent Brand Blue
    borderWidth: 1,
    borderColor: "rgba(41, 98, 255, 0.2)",
  },
  addButton: {
    backgroundColor: COLORS.primary,
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
    color: COLORS.primary,
  },
  requestedText: {
    color: COLORS.primary,
  },
  addText: {
    color: COLORS.white,
  },
});

export default FollowButton;
