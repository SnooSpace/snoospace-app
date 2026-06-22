import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { ChartNoAxesCombined, Heart, MessageCircle, Send } from 'lucide-react-native';
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
    {/* Like */}
    <Pressable onPress={onLike} style={styles.item} hitSlop={8}>
      <Heart
        size={20}
        color={isLiked ? '#E53E3E' : '#6B7280'}
        fill={isLiked ? '#E53E3E' : 'transparent'}
        strokeWidth={2}
      />
      <Text style={[styles.count, isLiked && styles.likedCount]}>
        {formatCount(likeCount)}
      </Text>
    </Pressable>

    {/* Comment */}
    <Pressable onPress={onComment} style={styles.item} hitSlop={8}>
      <MessageCircle size={20} color="#6B7280" strokeWidth={2} />
      <Text style={styles.count}>{formatCount(commentCount)}</Text>
    </Pressable>

    {/* View */}
    <View style={styles.item}>
      <ChartNoAxesCombined size={20} color="#6B7280" strokeWidth={2} />
      <Text style={styles.count}>{formatCount(viewCount)}</Text>
    </View>

    {/* Share */}
    <Pressable onPress={onShare} style={styles.item} hitSlop={8}>
      <Send size={20} color="#6B7280" strokeWidth={2} />
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 40,
  },
  count: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#9CA3AF',
    marginLeft: 6,
  },
  likedCount: {
    color: '#E53E3E',
  },
});

export default PlanEngagementRow;
