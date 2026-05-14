/**
 * ReachTab
 *
 * Shows:
 *  • Reach stats grid
 *  • Traffic sources (animated MetricBars)
 *  • Peak viewing hours (native bar chart, no library)
 *  • Best time to post recommendation
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Clock } from 'lucide-react-native';
import { COLORS, FONTS, BORDER_RADIUS } from '../../constants/theme';
import InsightCard from './InsightCard';
import MetricBar from './MetricBar';
import StatGrid from './StatGrid';

const W = Dimensions.get('window').width - 32 - 28;

const DISPLAY_HOURS = [6, 9, 12, 15, 18, 21, 0];
const hourLabel = (h) => {
  if (h === 0) return '12a';
  if (h < 12) return `${h}a`;
  if (h === 12) return '12p';
  return `${h - 12}p`;
};

const trafficLabels = {
  for_you: 'For You / Discover',
  community: 'Community pages',
  direct_share: 'Direct shares',
  profile: 'Profile visits',
  hashtag: 'Hashtags',
  search: 'Search',
};

const trafficColors = ['#2962FF', '#1D9E75', '#7F77DD', '#888780', '#BA7517', '#E24B4A'];

export default function ReachTab({ data }) {
  const hourly = data.hourly_views || [];

  const barData = DISPLAY_HOURS.map((h) => {
    const entry = hourly.find((e) => e.hour === h);
    return { label: hourLabel(h), views: entry?.views || 0, isPeak: h === data.peak_hour };
  });

  const barMax = Math.max(...barData.map((b) => b.views), 1);

  const traffic = data.traffic_sources || {};
  const trafficEntries = Object.entries(traffic);
  const trafficMax = Math.max(...trafficEntries.map(([, v]) => v), 1);

  const stats = [
    {
      label: 'Total reach',
      value:
        data.reach_total >= 1000
          ? `${(data.reach_total / 1000).toFixed(1)}K`
          : data.reach_total,
      sub: 'Unique accounts',
    },
    {
      label: 'Non-followers',
      value: `${data.reach_non_followers_pct}%`,
      sub: 'Discovery traffic',
      subColor: COLORS.success,
    },
    {
      label: 'Boost views',
      value:
        data.community_boost_views >= 1000
          ? `${(data.community_boost_views / 1000).toFixed(1)}K`
          : data.community_boost_views,
      sub: 'From communities',
    },
    {
      label: 'Total shares',
      value: data.shares_count,
      sub: 'DMs + reposts',
    },
  ];

  return (
    <View>
      <StatGrid stats={stats} />

      {/* Traffic sources */}
      {trafficEntries.length > 0 && (
        <InsightCard title="Traffic sources">
          {trafficEntries.map(([key, val], i) => (
            <MetricBar
              key={key}
              label={trafficLabels[key] || key}
              value={val}
              max={trafficMax}
              displayValue={`${val}%`}
              color={trafficColors[i % trafficColors.length]}
            />
          ))}
        </InsightCard>
      )}

      {/* Peak hours — native bar chart */}
      <InsightCard
        title="Peak viewing hours"
        subtitle={`Most views at ${hourLabel(data.peak_hour)}`}
      >
        <View style={styles.barsRow}>
          {barData.map((b) => (
            <View key={b.label} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${Math.round((b.views / barMax) * 100)}%`,
                      backgroundColor: b.isPeak ? COLORS.primary : '#B5D4F4',
                    },
                  ]}
                />
              </View>
              <Text style={[styles.barLabel, b.isPeak && styles.barLabelPeak]}>
                {b.label}
              </Text>
            </View>
          ))}
        </View>
      </InsightCard>

      {/* Best time to post */}
      <InsightCard title="Best time to post">
        {data.best_time_to_post ? (
          <View style={styles.timeRow}>
            <View style={styles.timeIcon}>
              <Clock size={18} color={COLORS.primary} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.timeValue}>{data.best_time_to_post}</Text>
              <Text style={styles.timeSub}>
                Based on when your audience is most active. +34% expected reach if posted then.
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.timeSub}>Not enough data yet to recommend a posting time.</Text>
        )}
      </InsightCard>
    </View>
  );
}

const styles = StyleSheet.create({
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 110,
    gap: 6,
    paddingTop: 8,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
  },
  barTrack: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.screenBackground,
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 9,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  barLabelPeak: {
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  timeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${COLORS.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeValue: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  timeSub: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});
