import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { apiPost, apiDelete } from "../api/client";

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
  isFollowing: initialIsFollowing = false, 
  onFollowChange,
  style,
  textStyle 
}) => {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);

  const handleFollowToggle = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      if (isFollowing) {
        await apiDelete("/follow", {
          followingId: userId,
          followingType: userType,
        });
        setIsFollowing(false);
        if (onFollowChange) onFollowChange(userId, userType, false);
      } else {
        await apiPost("/follow", {
          followingId: userId,
          followingType: userType,
        });
        setIsFollowing(true);
        if (onFollowChange) onFollowChange(userId, userType, true);
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      Alert.alert("Error", "Failed to update follow status");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isFollowing ? styles.followingButton : styles.followButton,
        style,
        isLoading && styles.loadingButton,
      ]}
      onPress={handleFollowToggle}
      disabled={isLoading}
    >
      <Text
        style={[
          styles.buttonText,
          isFollowing ? styles.followingText : styles.followText,
          textStyle,
        ]}
      >
        {isLoading ? "..." : isFollowing ? "Following" : "Follow"}
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
