/**
 * OverviewTab
 *
 * Shows:
 *  • Key stats grid: Views, Watch Time, Completion, Re-watch rate
 *  • Engagement breakdown (animated bars)
 *  • Return on Resonance™ score
 *  • Follow conversion
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, BORDER_RADIUS } from '../../constants/theme';
import StatGrid from './StatGrid';
import MetricBar from './MetricBar';
import InsightCard from './InsightCard';

const fmtTime = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

export default function OverviewTab({ data }) {
  const stats = [
    {
      label: 'Views',
      value:
        data.total_views >= 1000
          ? `${(data.total_views / 1000).toFixed(1)}K`
          : data.total_views,
      sub: 'Total sessions',
      subColor: COLORS.success,
    },
    {
      label: 'Watch time',
      value: fmtTime(data.total_watch_seconds),
      sub: `Avg ${fmtTime(data.avg_watch_seconds)}`,
    },
    {
      label: 'Completion',
      value: `${Math.round(data.completion_rate * 100)}%`,
      sub: 'Watched to end',
      subColor: data.completion_rate >= 0.5 ? COLORS.success : COLORS.textSecondary,
    },
    {
      label: 'Re-watch',
      value: `${data.rewatch_rate}×`,
      sub: 'Avg loops / viewer',
    },
  ];

  const maxEngage = Math.max(
    data.likes_count,
    data.saves_count,
    data.shares_count,
    data.comments_count,
    data.dm_sends_count,
    1
  );

  const rorTier =
    data.ror_score >= 80 ? 'Top 8%' : data.ror_score >= 60 ? 'Top 25%' : 'Top 50%';

  return (
    <View>
      <StatGrid stats={stats} />

      <InsightCard title="Engagement breakdown">
        <MetricBar label="Likes" value={data.likes_count} max={maxEngage} color="#E24B4A" />
        <MetricBar label="Comments" value={data.comments_count} max={maxEngage} color={COLORS.primary} />
        <MetricBar label="Saves" value={data.saves_count} max={maxEngage} color="#7F77DD" />
        <MetricBar label="Shares" value={data.shares_count} max={maxEngage} color="#1D9E75" />
        <MetricBar label="DM sends" value={data.dm_sends_count} max={maxEngage} color="#BA7517" />
      </InsightCard>

      {/* Return on Resonance */}
      <InsightCard
        title="Return on Resonance™"
        subtitle="Weighted: completion 40%, saves 25%, shares 20%, DMs 15%"
      >
        <View style={styles.rorRow}>
          <View style={styles.rorCircle}>
            <Text style={styles.rorNumber}>{data.ror_score}</Text>
            <Text style={styles.rorDenom}>/100</Text>
          </View>
          <View style={styles.rorRight}>
            <View style={styles.rorTrack}>
              <View style={[styles.rorFill, { width: `${data.ror_score}%` }]} />
            </View>
            <Text style={styles.rorCaption}>{rorTier} of your posts this week</Text>
          </View>
        </View>
      </InsightCard>

      {/* Follow conversion */}
      <InsightCard title="Follow conversion">
        <View style={styles.convRow}>
          <View>
            <Text style={styles.convLabel}>New followers from video</Text>
            <Text style={styles.convValue}>{data.new_followers}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.convLabel}>Conversion rate</Text>
            <Text style={styles.convValue}>{Number(data.follow_conversion_rate).toFixed(2)}%</Text>
          </View>
        </View>
        <View style={styles.convTrack}>
          <View
            style={[
              styles.convFill,
              { width: `${Math.min(data.follow_conversion_rate * 50, 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.convCaption}>
          Your avg is 0.4% · Top creators hit ~1.2%
        </Text>
      </InsightCard>
    </View>
  );
}

const styles = StyleSheet.create({
  rorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 4,
  },
  rorCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rorNumber: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
  },
  rorDenom: {
    fontSize: 9,
    color: COLORS.textSecondary,
    fontFamily: FONTS.regular,
  },
  rorRight: {
    flex: 1,
    gap: 6,
  },
  rorTrack: {
    height: 8,
    backgroundColor: COLORS.screenBackground,
    borderRadius: 4,
    overflow: 'hidden',
  },
  rorFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  rorCaption: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: FONTS.regular,
  },
  convRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  convLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: FONTS.regular,
    marginBottom: 2,
  },
  convValue: {
    fontSize: 20,
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
  },
  convTrack: {
    height: 6,
    backgroundColor: COLORS.screenBackground,
    borderRadius: 3,
    marginBottom: 6,
    overflow: 'hidden',
  },
  convFill: {
    height: '100%',
    backgroundColor: '#1D9E75',
    borderRadius: 3,
  },
  convCaption: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: FONTS.regular,
  },
});
