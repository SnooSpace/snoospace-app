import React from 'react';
import { View, Text, TouchableOpacity, Alert, Linking, StyleSheet } from 'react-native';
import { Instagram } from 'lucide-react-native';
import HapticsService from '../services/HapticsService';
import { buildInstagramUrl } from '../utils/instagramUtils';
import { FONTS, COLORS } from '../constants/theme';

/**
 * InstagramRow
 *
 * Renders a tappable Instagram profile row.
 * Returns null (renders nothing) if username is falsy — safe to always mount.
 *
 * @param {string|null} username  Clean Instagram username (no @ prefix, no URL)
 */
const InstagramRow = React.memo(function InstagramRow({ username }) {
  if (!username) return null;

  const handlePress = async () => {
    HapticsService.triggerImpactLight();
    const url = buildInstagramUrl(username);
    if (!url) return;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          'Open Instagram',
          `Visit instagram.com/${username} to view this profile.`,
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      Alert.alert(
        'Could not open Instagram',
        `Visit https://www.instagram.com/${username}`,
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={handlePress}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessible
      accessibilityLabel={`View Instagram profile @${username}`}
      accessibilityRole="link"
    >
      {/* Pink icon circle */}
      <View style={styles.iconCircle}>
        <Instagram size={20} color="#EC4899" strokeWidth={1.8} />
      </View>

      {/* Username */}
      <Text style={styles.handle} numberOfLines={1}>
        @{username}
      </Text>

      {/* Trust badge */}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Instagram Linked</Text>
      </View>
    </TouchableOpacity>
  );
});

export default InstagramRow;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    marginBottom: 6,
    alignSelf: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(244, 114, 182, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  badge: {
    backgroundColor: 'rgba(236, 72, 153, 0.10)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: '#EC4899',
    letterSpacing: 0.1,
  },
});
