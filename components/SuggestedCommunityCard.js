import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { followCommunity } from '../api/communities';
import { getGradientForName, getInitials } from '../utils/AvatarGenerator';
import { COLORS } from '../constants/theme';

/**
 * SuggestedCommunityCard - Card for "Based on your Interests" section
 * Shows community avatar, name, category, followers, and Join button
 */
export default function SuggestedCommunityCard({ 
  community, 
  onJoin, 
  onPress 
}) {
  const [isJoined, setIsJoined] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (isJoined || loading) return;
    
    setLoading(true);
    try {
      await followCommunity(community.id);
      setIsJoined(true);
      onJoin?.(community);
    } catch (error) {
      console.error('Error joining community:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFollowerCount = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const hasLogo = community.logo_url && /^https?:\/\//.test(community.logo_url);

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={() => onPress?.(community)}
      activeOpacity={0.9}
    >
      {/* Avatar */}
      {hasLogo ? (
        <Image source={{ uri: community.logo_url }} style={styles.avatar} />
      ) : (
        <LinearGradient
          colors={getGradientForName(community.name)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{getInitials(community.name)}</Text>
        </LinearGradient>
      )}

      {/* Name */}
      <Text style={styles.name} numberOfLines={1}>{community.name}</Text>

      {/* Category */}
      <View style={styles.categoryPill}>
        <Text style={styles.categoryText} numberOfLines={1}>
          {community.category || 'Community'}
        </Text>
      </View>

      {/* Followers */}
      <Text style={styles.followers}>
        {formatFollowerCount(community.follower_count || 0)} followers
      </Text>

      {/* Join Button */}
      <TouchableOpacity
        style={[styles.joinButton, isJoined && styles.joinedButton]}
        onPress={handleJoin}
        disabled={isJoined || loading}
      >
        <Text style={[styles.joinButtonText, isJoined && styles.joinedButtonText]}>
          {loading ? '...' : isJoined ? 'Joined' : 'Join'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginRight: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1D1D1F',
    textAlign: 'center',
    marginBottom: 4,
  },
  categoryPill: {
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.primary,
  },
  followers: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 10,
  },
  joinButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
  },
  joinedButton: {
    backgroundColor: '#F0F0F0',
  },
  joinButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  joinedButtonText: {
    color: '#8E8E93',
  },
});
