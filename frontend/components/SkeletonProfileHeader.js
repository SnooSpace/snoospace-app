import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { COLORS } from '../constants/theme';

const { width } = Dimensions.get('window');

const AnimatedLG = Animated.createAnimatedComponent(LinearGradient);

const Shimmer = ({ width: w, height: h, style, borderRadius = 4, progress }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const translateX = -w + progress.value * (w * 2);
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <View style={[styles.shimmerContainer, { width: w, height: h, borderRadius }, style]}>
      <View style={[styles.background, { width: w, height: h, borderRadius }]} />
      <AnimatedLG
        colors={['transparent', 'rgba(255, 255, 255, 0.6)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          StyleSheet.absoluteFill,
          animatedStyle,
        ]}
      />
    </View>
  );
};

const SkeletonProfileHeader = ({ type = 'member' }) => {
  const isCommunity = type === 'community';
  const shimmerProgress = useSharedValue(0);

  useEffect(() => {
    shimmerProgress.value = withRepeat(
      withTiming(1, {
        duration: 1500,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  if (isCommunity) {
    return (
      <View style={styles.container}>
        {/* Banner */}
        <Shimmer width={width} height={150} borderRadius={0} style={styles.banner} progress={shimmerProgress} />
        
        {/* Content Wrapper */}
        <View style={styles.communityContent}>
          {/* Avatar Area - Overlapping Banner */}
          <View style={styles.communityAvatarContainer}>
            <Shimmer width={100} height={100} borderRadius={50} style={styles.avatarBorder} progress={shimmerProgress} />
          </View>

          {/* Name & Username */}
          <View style={styles.centerContent}>
            <Shimmer width={220} height={24} style={styles.nameLine} progress={shimmerProgress} />
            <Shimmer width={120} height={16} style={styles.usernameLine} progress={shimmerProgress} />
            
            {/* Categories Chips */}
            <View style={styles.categoriesRowPlaceholder}>
              <Shimmer width={80} height={24} borderRadius={12} progress={shimmerProgress} />
              <Shimmer width={70} height={24} borderRadius={12} progress={shimmerProgress} />
            </View>

            {/* Bio (Left-aligned text blocks in layout container) */}
            <View style={styles.bioContainer}>
              <Shimmer width={width - 40} height={14} style={styles.bioLine} progress={shimmerProgress} />
              <Shimmer width={width - 80} height={14} style={styles.bioLine} progress={shimmerProgress} />
            </View>
          </View>

          {/* Stats Row - 4 Columns (Events, Followers, Following, Posts) */}
          <View style={styles.statsRow}>
            {Array.from({ length: 4 }).map((_, i) => (
              <View key={`stat-comm-${i}`} style={styles.statItemPlaceholder}>
                <Shimmer width={40} height={22} borderRadius={4} style={{ marginBottom: 4 }} progress={shimmerProgress} />
                <Shimmer width={55} height={12} borderRadius={3} progress={shimmerProgress} />
              </View>
            ))}
          </View>

          {/* Action Buttons - 2 Side-by-Side ("Edit Profile" and "Create Post") */}
          <View style={styles.buttonRow}>
            <Shimmer width={(width - 50) / 2} height={45} borderRadius={16} progress={shimmerProgress} />
            <Shimmer width={(width - 50) / 2} height={45} borderRadius={16} progress={shimmerProgress} />
          </View>

          {/* Meet the Hosts Section Placeholder (Rows of host list) */}
          <View style={styles.sectionPlaceholder}>
             <Shimmer width={150} height={20} style={styles.sectionTitle} progress={shimmerProgress} />
             {/* Host Row 1 */}
             <View style={styles.hostRowPlaceholder}>
               <Shimmer width={44} height={44} borderRadius={22} progress={shimmerProgress} />
               <View style={styles.hostInfoPlaceholder}>
                 <Shimmer width={120} height={14} style={{ marginBottom: 6 }} progress={shimmerProgress} />
                 <Shimmer width={180} height={10} progress={shimmerProgress} />
               </View>
             </View>
             {/* Host Row 2 */}
             <View style={styles.hostRowPlaceholder}>
               <Shimmer width={44} height={44} borderRadius={22} progress={shimmerProgress} />
               <View style={styles.hostInfoPlaceholder}>
                 <Shimmer width={100} height={14} style={{ marginBottom: 6 }} progress={shimmerProgress} />
                 <Shimmer width={150} height={10} progress={shimmerProgress} />
               </View>
             </View>
          </View>

          {/* Tab Bar - 3 Tabs ("Posts", "Community", "Events") */}
          <View style={styles.tabBarPlaceholder}>
            {['Posts', 'Community', 'Events'].map((tab, idx) => (
              <View key={tab} style={styles.tabItemMock}>
                <Shimmer width={60} height={16} borderRadius={4} progress={shimmerProgress} />
                {idx === 0 && <View style={styles.activeIndicatorMock} />}
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // Member Layout
  return (
    <View style={styles.container}>
      {/* Mock Header (Left Username, Right settings icons) to prevent layout shift */}
      <View style={styles.mockHeader}>
        <Shimmer width={100} height={20} borderRadius={4} progress={shimmerProgress} />
        <View style={styles.mockHeaderRight}>
          <Shimmer width={32} height={32} borderRadius={16} progress={shimmerProgress} />
          <Shimmer width={32} height={32} borderRadius={16} progress={shimmerProgress} />
        </View>
      </View>

      {/* Profile Image - Centered (Matching size 125) */}
      <View style={styles.centerContent}>
        <Shimmer width={125} height={125} borderRadius={62.5} style={styles.avatar} progress={shimmerProgress} />
      </View>

      {/* Name & Info */}
      <View style={styles.centerContent}>
        <Shimmer width={180} height={24} style={styles.nameLine} progress={shimmerProgress} />
        <Shimmer width={100} height={16} style={styles.usernameLine} progress={shimmerProgress} />
        
        {/* Pronouns Chip Row */}
        <View style={styles.chipRow}>
           <Shimmer width={80} height={24} borderRadius={12} progress={shimmerProgress} />
        </View>

        {/* Bio (Left-aligned text blocks in layout container) */}
        <View style={styles.bioContainer}>
           <Shimmer width={width - 40} height={14} style={styles.bioLine} progress={shimmerProgress} />
           <Shimmer width={width - 90} height={14} style={styles.bioLine} progress={shimmerProgress} />
        </View>
      </View>

      {/* Stats Row - 4 Columns (Posts, Events, Followers, Following) */}
      <View style={styles.statsRow}>
        {Array.from({ length: 4 }).map((_, i) => (
          <View key={`stat-mem-${i}`} style={styles.statItemPlaceholder}>
            <Shimmer width={40} height={22} borderRadius={4} style={{ marginBottom: 4 }} progress={shimmerProgress} />
            <Shimmer width={55} height={12} borderRadius={3} progress={shimmerProgress} />
          </View>
        ))}
      </View>

      {/* Interests Placeholder tags */}
      <View style={styles.interestsRowPlaceholder}>
        <Shimmer width={70} height={26} borderRadius={13} progress={shimmerProgress} />
        <Shimmer width={80} height={26} borderRadius={13} progress={shimmerProgress} />
        <Shimmer width={65} height={26} borderRadius={13} progress={shimmerProgress} />
        <Shimmer width={75} height={26} borderRadius={13} progress={shimmerProgress} />
      </View>

      {/* Action Buttons - 2 Side-by-Side ("Edit Profile" and "Create Post") */}
      <View style={styles.buttonRow}>
         <Shimmer width={(width - 50) / 2} height={45} borderRadius={16} progress={shimmerProgress} />
         <Shimmer width={(width - 50) / 2} height={45} borderRadius={16} progress={shimmerProgress} />
      </View>

      {/* Tab Bar - 2 Tabs ("Posts", "Events") */}
      <View style={[styles.tabBarPlaceholder, { marginTop: 24 }]}>
        {['Posts', 'Events'].map((tab, idx) => (
          <View key={tab} style={styles.tabItemMock}>
            <Shimmer width={50} height={16} borderRadius={4} progress={shimmerProgress} />
            {idx === 0 && <View style={styles.activeIndicatorMock} />}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background || '#f9f9f9',
    flex: 1,
  },
  shimmerContainer: {
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  background: {
    backgroundColor: '#F3F4F6',
  },
  mockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
    height: 60,
  },
  mockHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  centerContent: {
    alignItems: 'center',
    marginVertical: 6,
    width: '100%',
  },
  avatar: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  nameLine: {
    marginBottom: 6,
  },
  usernameLine: {
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  bioContainer: {
    alignSelf: 'stretch',
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 12,
  },
  bioLine: {
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 16,
  },
  statItemPlaceholder: {
    flex: 1,
    alignItems: 'center',
  },
  interestsRowPlaceholder: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 10,
  },
  tabBarPlaceholder: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    height: 48,
    position: 'relative',
  },
  tabItemMock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    height: '100%',
  },
  activeIndicatorMock: {
    position: 'absolute',
    bottom: 0,
    left: '25%',
    right: '25%',
    height: 2,
    backgroundColor: '#9CA3AF',
    borderRadius: 1,
  },

  // Community Styles
  banner: {
    width: '100%',
  },
  communityContent: {
    alignItems: 'stretch',
    marginTop: -50, // Pull avatar up
  },
  communityAvatarContainer: {
    alignSelf: 'center',
    padding: 4,
    backgroundColor: COLORS.background || '#f9f9f9',
    borderRadius: 54,
    marginBottom: 10,
  },
  avatarBorder: {
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  categoriesRowPlaceholder: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 10,
  },
  sectionPlaceholder: {
    marginTop: 20,
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 4,
  },
  hostRowPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  hostInfoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
  }
});

export default SkeletonProfileHeader;
