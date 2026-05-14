/**
 * RetentionTab
 *
 * Shows:
 *  • Audience retention curve (victory-native v41 CartesianChart + Area)
 *  • Key retention stats grid
 *  • AI insight card
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { CartesianChart, Area, Line } from 'victory-native';
import { COLORS, FONTS, BORDER_RADIUS } from '../../constants/theme';
import InsightCard from './InsightCard';
import StatGrid from './StatGrid';

const W = Dimensions.get('window').width - 32 - 28;

const padTime = (sec) =>
  `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;

export default function RetentionTab({ data }) {
  const curve = data.retention_curve || [];

  // v41 CartesianChart expects an array of objects with named keys
  const chartData = curve.map((p) => ({ pct: p.pct, retention: p.retention }));

  const stats = [
    {
      label: 'Avg watch',
      value: padTime(data.avg_watch_seconds),
      sub: 'Duration watched',
    },
    {
      label: 'Hook rate (3s)',
      value: `${Math.round(data.hook_rate * 100)}%`,
      sub: 'Passed 3-second mark',
      subColor: data.hook_rate >= 0.7 ? COLORS.success : COLORS.textSecondary,
    },
    {
      label: 'Major drop',
      value: `-${data.midpoint_drop_pct}%`,
      sub: `at ${padTime(data.major_drop_at_seconds)}`,
    },
    {
      label: 'Most replayed',
      value: padTime(data.rewatched_moment_seconds),
      sub: 'Re-watch spike',
    },
  ];

  return (
    <View>
      <InsightCard
        title="Audience retention curve"
        subtitle="Viewer drop-off across the full video"
      >
        {chartData.length > 1 ? (
          <CartesianChart
            data={chartData}
            xKey="pct"
            yKeys={['retention']}
            width={W}
            height={160}
            domainPadding={{ left: 8, right: 8, top: 8 }}
            axisOptions={{
              font: null,
              labelColor: COLORS.textSecondary,
              lineColor: COLORS.border,
              tickCount: 4,
            }}
          >
            {({ points, chartBounds }) => (
              <>
                <Area
                  points={points.retention}
                  y0={chartBounds.bottom}
                  color={COLORS.primary}
                  opacity={0.15}
                  curveType="monotoneX"
                />
                <Line
                  points={points.retention}
                  color={COLORS.primary}
                  strokeWidth={2}
                  curveType="monotoneX"
                />
              </>
            )}
          </CartesianChart>
        ) : (
          <Text style={styles.noData}>Not enough data yet</Text>
        )}
      </InsightCard>

      <StatGrid stats={stats} />

      <InsightCard title="AI insight">
        <Text style={styles.aiText}>
          Major drop at{' '}
          <Text style={styles.aiHighlight}>{padTime(data.major_drop_at_seconds)}</Text>
          {' '}— likely a scene cut or pacing change. Your 3-second hook is performing in the
          top 12% of Reels this week. Consider adding a text hook just before that drop to
          retain midpoint viewers.
        </Text>
      </InsightCard>
    </View>
  );
}

const styles = StyleSheet.create({
  noData: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 24,
  },
  aiText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  aiHighlight: {
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
  },
});
