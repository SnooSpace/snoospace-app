import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Eye, Heart, MessageCircle, Share2 } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';

function formatCount(n) {
  const num = n ?? 0;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(num);
}

const PlanEngagementRow = ({
  viewCount,
  likeCount,
  commentCount,
  isLiked,
  onLike,
  onComment,
  onShare,
}) => (
  <View style={styles.row}>
    <View style={styles.left}>
      <View style={styles.item}>
        <Eye size={16} color={COLORS.textMuted} strokeWidth={1.8} />
        <Text style={styles.count}>{formatCount(viewCount)}</Text>
      </View>

      <Pressable onPress={onLike} style={styles.item} hitSlop={8}>
        <Heart
          size={16}
          color={isLiked ? '#E53E3E' : COLORS.textMuted}
          fill={isLiked ? '#E53E3E' : 'none'}
          strokeWidth={1.8}
        />
        <Text style={styles.count}>{formatCount(likeCount)}</Text>
      </Pressable>

      <Pressable onPress={onComment} style={styles.item} hitSlop={8}>
        <MessageCircle size={16} color={COLORS.textMuted} strokeWidth={1.8} />
        <Text style={styles.count}>{formatCount(commentCount)}</Text>
      </Pressable>
    </View>

    <Pressable onPress={onShare} style={styles.shareBtn} hitSlop={8}>
      <Share2 size={16} color={COLORS.textSecondary} strokeWidth={1.8} />
      <Text style={styles.shareText}>Share</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  count: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  shareText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});

export default PlanEngagementRow;
