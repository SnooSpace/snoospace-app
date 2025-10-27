import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import FollowButton from "./FollowButton";

const COLORS = {
  primary: "#5E17EB",
  textDark: "#282C35",
  textLight: "#808080",
  background: "#FFFFFF",
  white: "#fff",
  border: "#E5E5E5",
};

const UserCard = ({ 
  user, 
  userType, 
  onPress,
  showFollowButton = true,
  isFollowing = false,
  onFollowChange,
  style 
}) => {
  const handlePress = () => {
    if (onPress) {
      onPress(user.id, userType);
    }
  };

  const getUserDisplayName = () => {
    switch (userType) {
      case 'member':
        return user.name;
      case 'community':
        return user.name;
      case 'sponsor':
        return user.brand_name;
      case 'venue':
        return user.name;
      default:
        return user.name || user.brand_name;
    }
  };

  const getUserPhoto = () => {
    switch (userType) {
      case 'member':
        return user.profile_photo_url;
      case 'community':
        return user.logo_url;
      case 'sponsor':
        return user.logo_url;
      case 'venue':
        return null; // Venues don't have photos yet
      default:
        return user.profile_photo_url || user.logo_url;
    }
  };

  const getUserSubtitle = () => {
    switch (userType) {
      case 'member':
        return user.bio || `${user.city} • ${user.interests?.length || 0} interests`;
      case 'community':
        return user.bio || `${user.location} • ${user.category}`;
      case 'sponsor':
        return user.bio || `${user.category} • ${user.interests?.length || 0} interests`;
      case 'venue':
        return `${user.city} • Capacity: ${user.capacity_max}`;
      default:
        return user.bio || user.city;
    }
  };

  return (
    <TouchableOpacity style={[styles.container, style]} onPress={handlePress}>
      <View style={styles.content}>
        <Image
          source={
            getUserPhoto()
              ? { uri: getUserPhoto() }
              : { uri: 'https://via.placeholder.com/50x50/6A0DAD/FFFFFF?text=' + (getUserDisplayName() ? getUserDisplayName().charAt(0).toUpperCase() : 'U') }
          }
          style={styles.profileImage}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{getUserDisplayName()}</Text>
          <Text style={styles.userSubtitle}>{getUserSubtitle()}</Text>
          {user.username && (
            <Text style={styles.username}>@{user.username}</Text>
          )}
        </View>
      </View>
      
      {showFollowButton && (
        <FollowButton
          userId={user.id}
          userType={userType}
          isFollowing={isFollowing}
          onFollowChange={onFollowChange}
          style={styles.followButton}
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 2,
  },
  userSubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 2,
  },
  username: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "500",
  },
  followButton: {
    marginLeft: 10,
  },
});

export default UserCard;
