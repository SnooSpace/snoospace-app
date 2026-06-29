/**
 * components/location/PlaceResultItem.js
 *
 * Single row in the VenueSearchSheet results list.
 *
 * Shows:
 *  - MapPin icon (left)
 *  - Place name (primary text)
 *  - Short address (secondary text)
 *  - Category pill (right, optional)
 *
 * Typography: follows SnooSpace global rules
 *   - Name: Manrope SemiBold 15px
 *   - Address: Manrope Regular 13px
 *   - Category: Manrope Medium 11px
 *
 * Icons: Lucide only
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { COLORS, FONTS, SHADOWS } from '../../constants/theme';

/**
 * @param {{
 *   item: import('../../services/location/LocationService').UnifiedPlaceResult,
 *   onPress: (item: UnifiedPlaceResult) => void,
 * }} props
 */
const PlaceResultItem = ({ item, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      {/* Left: Location icon in tinted container */}
      <View style={styles.iconContainer}>
        <MapPin size={18} color={COLORS.primary} strokeWidth={2} />
      </View>

      {/* Centre: name + address */}
      <View style={styles.textContainer}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        {!!item.shortAddress && (
          <Text style={styles.address} numberOfLines={1}>
            {item.shortAddress}
          </Text>
        )}
      </View>

      {/* Right: category chip */}
      {!!item.category && (
        <View style={styles.categoryChip}>
          <Text style={styles.categoryText} numberOfLines={1}>
            {item.category.replace(/_/g, ' ')}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default React.memo(PlaceResultItem);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },

  // 40px circle with soft blue tint
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },

  textContainer: {
    flex: 1,
    gap: 2,
  },

  name: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },

  address: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  // Small pill on the right
  categoryChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    flexShrink: 0,
    maxWidth: 90,
  },

  categoryText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
  },
});
