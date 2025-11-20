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

const COLORS = {
  primary: "#5E17EB",
  textDark: "#282C35",
  textLight: "#808080",
  background: "#FFFFFF",
  white: "#fff",
  error: "#FF4444",
  success: "#00C851",
  border: "#E5E5E5",
};

const FollowButton = ({ 
  userId, 
  userType, 
  isFollowing = false, 
  onFollowChange,
  style,
  textStyle,
  isLoading: externalLoading = false
}) => {
  // Fully controlled component - no internal state, just use props
  const handleFollowToggle = async () => {
    if (externalLoading) return;
    
    try {
      // Just call the callback - let parent handle API calls and state management
      if (onFollowChange) {
        await onFollowChange(userId, userType, !isFollowing);
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
    }
  };

  const combinedLoading = externalLoading;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isFollowing ? styles.followingButton : styles.followButton,
        style,
        combinedLoading && styles.loadingButton,
      ]}
      onPress={handleFollowToggle}
      disabled={combinedLoading}
    >
      <Text
        style={[
          styles.buttonText,
          isFollowing ? styles.followingText : styles.followText,
          textStyle,
        ]}
      >
        {combinedLoading ? "..." : isFollowing ? "Following" : "Follow"}
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
  loadingButton: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  followText: {
    color: COLORS.white,
  },
  followingText: {
    color: COLORS.textDark,
  },
});

export default FollowButton;
