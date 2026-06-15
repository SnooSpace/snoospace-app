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
      style={styles.iconCircle}
      onPress={handlePress}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessible
      accessibilityLabel={`View Instagram profile @${username}`}
      accessibilityRole="link"
    >
      <Instagram size={18} color="#EC4899" strokeWidth={1.8} />
    </TouchableOpacity>
  );
});

export default InstagramRow;

const styles = StyleSheet.create({
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(244, 114, 182, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244, 114, 182, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
