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
  showSubtitle = true,
  isFollowing = false,
  onFollowChange,
  style,
  isLoading = false,
}) => {
  // Add null check for user
  if (!user) {
    return null;
  }

  const handlePress = () => {
    if (onPress && user?.id) {
      onPress(user.id, userType);
    }
  };

  const getUserDisplayName = () => {
    if (!user) return 'Unknown User';
    switch (userType) {
      case 'member':
        return user.name || user.full_name || 'Member';
      case 'community':
        return user.name || 'Community';
      case 'sponsor':
        return user.brand_name || user.name || 'Sponsor';
      case 'venue':
        return user.name || 'Venue';
      default:
        return user.name || user.brand_name || user.full_name || 'User';
    }
  };

  const getUserPhoto = () => {
    if (!user) return null;
    switch (userType) {
      case 'member':
        return user.profile_photo_url || null;
      case 'community':
        return user.logo_url || null;
      case 'sponsor':
        return user.logo_url || null;
      case 'venue':
        return user.logo_url || null;
      default:
        return user.profile_photo_url || user.logo_url || null;
    }
  };

  const getUserSubtitle = () => {
    if (!user) return '';
    switch (userType) {
      case 'member':
        return user.bio || (user.city ? `${user.city} • ${user.interests?.length || 0} interests` : '');
      case 'community':
        return user.bio || (user.location ? `${user.location} • ${user.category || ''}` : '');
      case 'sponsor':
        return user.bio || (user.category ? `${user.category} • ${user.interests?.length || 0} interests` : '');
      case 'venue':
        return user.city ? `${user.city} • Capacity: ${user.capacity_max || 'N/A'}` : '';
      default:
        return user.bio || user.city || '';
    }
  };

  const photoUrl = getUserPhoto();
  const displayName = getUserDisplayName();
  const subtitle = getUserSubtitle();

  return (
    <TouchableOpacity style={[styles.container, style]} onPress={handlePress}>
      <View style={styles.content}>
        <Image
          source={
            photoUrl
              ? { uri: photoUrl }
              : { uri: 'https://via.placeholder.com/50x50/6A0DAD/FFFFFF?text=' + (displayName ? displayName.charAt(0).toUpperCase() : 'U') }
          }
          style={styles.profileImage}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{displayName}</Text>
          {showSubtitle && subtitle ? (
            <Text style={styles.userSubtitle}>{subtitle}</Text>
          ) : null}
          {user?.username && (
            <Text style={styles.username}>@{user.username}</Text>
          )}
        </View>
      </View>
      
      {showFollowButton && user?.id && (
        <FollowButton
          userId={user.id}
          userType={userType}
          isFollowing={isFollowing}
          onFollowChange={onFollowChange}
          isLoading={isLoading}
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
