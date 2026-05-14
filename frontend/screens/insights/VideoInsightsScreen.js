/**
 * VideoInsightsScreen
 *
 * Main screen showing video analytics for the creator.
 * Accessible via: navigation.navigate('VideoInsights', { videoId, videoMeta })
 *
 * videoMeta shape: { title, thumbnail_url, created_at, duration_seconds }
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, TrendingUp } from 'lucide-react-native';
import { useVideoInsights } from '../../hooks/useVideoInsights';
import { COLORS, FONTS, BORDER_RADIUS } from '../../constants/theme';
import OverviewTab from '../../components/insights/OverviewTab';
import RetentionTab from '../../components/insights/RetentionTab';
import AudienceTab from '../../components/insights/AudienceTab';
import ReachTab from '../../components/insights/ReachTab';

const TABS = ['Overview', 'Retention', 'Audience', 'Reach'];

const formatDuration = (sec) => {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export default function VideoInsightsScreen({ route, navigation }) {
  const { videoId, videoMeta, token } = route.params;
  const [activeTab, setActiveTab] = useState(0);
  const { data, loading, error, refetch } = useVideoInsights(videoId, token);

  const renderTab = () => {
    if (!data) return null;
    switch (activeTab) {
      case 0: return <OverviewTab data={data} />;
      case 1: return <RetentionTab data={data} />;
      case 2: return <AudienceTab data={data} />;
      case 3: return <ReachTab data={data} />;
      default: return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={22} color={COLORS.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Video insights</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Video card */}
        <View style={styles.videoCard}>
          <View style={styles.thumbnail}>
            {videoMeta?.thumbnail_url ? (
              <Image
                source={{ uri: videoMeta.thumbnail_url }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.thumbnailPlaceholder} />
            )}
          </View>
          <View style={styles.videoMeta}>
            <Text style={styles.videoTitle} numberOfLines={2}>
              {videoMeta?.title || 'Your video'}
            </Text>
            <Text style={styles.videoSub}>
              {formatDate(videoMeta?.created_at)}
              {videoMeta?.created_at ? ' · ' : ''}
              {formatDuration(videoMeta?.duration_seconds)} · Reel
            </Text>
            {data?.ror_score >= 75 && (
              <View style={styles.trendingBadge}>
                <TrendingUp size={10} color={COLORS.primary} strokeWidth={2.5} />
                <Text style={styles.trendingText}>Top 8% this week</Text>
              </View>
            )}
          </View>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {TABS.map((tab, i) => (
            <TouchableOpacity
              key={tab}
              style={styles.tabItem}
              onPress={() => setActiveTab(i)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>
                {tab}
              </Text>
              {activeTab === i && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.stateText}>Crunching your numbers…</Text>
          </View>
        ) : error ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateText}>Failed to load insights</Text>
            <TouchableOpacity onPress={refetch} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          renderTab()
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,      // Manrope SemiBold — functional UI
    color: COLORS.textPrimary,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  videoCard: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.m,
    padding: 12,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.s,
    backgroundColor: COLORS.screenBackground,
    overflow: 'hidden',
  },
  thumbnailPlaceholder: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
  },
  videoMeta: { flex: 1 },
  videoTitle: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,      // Manrope SemiBold — card labels
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  videoSub: {
    fontSize: 12,
    fontFamily: FONTS.regular,       // Manrope Regular — helper text
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: `${COLORS.primary}18`,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  trendingText: {
    fontSize: 11,
    fontFamily: FONTS.medium,        // Manrope Medium — metadata
    color: COLORS.primary,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.s,
    overflow: 'hidden',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  tabText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,      // Manrope SemiBold — functional UI (tabs)
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.primary,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    width: '60%',
    backgroundColor: COLORS.primary,
    borderRadius: 1,
  },
  stateContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  stateText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: FONTS.regular,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.s,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  retryText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontFamily: FONTS.semiBold,
  },
});
