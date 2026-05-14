/**
 * AudienceTab
 *
 * Shows:
 *  • Audience Quality Index (AQI) score cards
 *  • Age breakdown (MetricBar-based, no chart library needed)
 *  • Top locations
 *  • Viewer intent classification
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, BORDER_RADIUS } from '../../constants/theme';
import InsightCard from './InsightCard';
import MetricBar from './MetricBar';

export default function AudienceTab({ data }) {
  const age = data.age_breakdown || {};
  const ageEntries = Object.entries(age);
  const ageMax = Math.max(...ageEntries.map(([, v]) => Number(v)), 1);

  const locs = data.top_locations || [];

  const intent = data.intent_classification || {};
  const intentEntries = Object.entries(intent);
  const intentMax = Math.max(...intentEntries.map(([, v]) => Number(v)), 1);

  const intentLabels = {
    event_discoverers: 'Event discoverers',
    passive_scrollers: 'Passive scrollers',
    profile_visitors: 'Profile visitors',
    dm_follow_up: 'DM follow-up',
  };
  const intentColors = {
    event_discoverers: '#1D9E75',
    passive_scrollers: '#888780',
    profile_visitors: '#7F77DD',
    dm_follow_up: '#BA7517',
  };

  return (
    <View>
      {/* AQI Score */}
      <InsightCard
        title="Audience Quality Index"
        subtitle="Genuine vs passive engagement of viewers"
      >
        <View style={styles.aqiRow}>
          <View style={styles.aqiCell}>
            <Text style={styles.aqiNum}>{data.aqi_score}</Text>
            <Text style={styles.aqiLabel}>AQI Score</Text>
          </View>
          <View style={styles.aqiCell}>
            <Text style={styles.aqiNum}>{data.high_intent_pct}%</Text>
            <Text style={styles.aqiLabel}>High-intent viewers</Text>
          </View>
          <View style={styles.aqiCell}>
            <Text style={[styles.aqiNum, { color: COLORS.textSecondary }]}>
              {data.ghost_viewer_pct}%
            </Text>
            <Text style={styles.aqiLabel}>Ghost viewers</Text>
          </View>
        </View>
      </InsightCard>

      {/* Age breakdown */}
      {ageEntries.length > 0 && (
        <InsightCard title="Age breakdown">
          {ageEntries.map(([label, value], i) => (
            <MetricBar
              key={label}
              label={label}
              value={Number(value)}
              max={ageMax}
              displayValue={`${value}%`}
              color={i === 1 ? COLORS.primary : '#B5D4F4'}
            />
          ))}
        </InsightCard>
      )}

      {/* Top locations */}
      <InsightCard title="Top locations">
        {locs.length > 0 ? (
          locs.map((loc, i) => (
            <MetricBar
              key={i}
              label={loc.city}
              value={loc.pct}
              max={100}
              displayValue={`${loc.pct}%`}
              color={loc.city === 'Others' ? '#888780' : COLORS.primary}
            />
          ))
        ) : (
          <Text style={styles.noData}>No location data yet</Text>
        )}
      </InsightCard>

      {/* Viewer intent */}
      <InsightCard title="Viewer intent classification">
        {intentEntries.length > 0 ? (
          intentEntries.map(([key, val]) => (
            <MetricBar
              key={key}
              label={intentLabels[key] || key}
              value={Number(val)}
              max={intentMax}
              displayValue={`${val}%`}
              color={intentColors[key] || '#888780'}
            />
          ))
        ) : (
          <Text style={styles.noData}>No intent data yet</Text>
        )}
      </InsightCard>
    </View>
  );
}

const styles = StyleSheet.create({
  aqiRow: { flexDirection: 'row', gap: 8 },
  aqiCell: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
    borderRadius: BORDER_RADIUS.s,
    padding: 10,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  aqiNum: {
    fontSize: 20,
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  aqiLabel: {
    fontSize: 10,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  noData: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
