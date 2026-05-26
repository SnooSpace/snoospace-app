import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const GAP = 10; // Match real profile grid gap
const COLUMNS = 3;
const ITEM_SIZE = (width - 40 - GAP * 2) / 3; // Match real profile calculation

const AnimatedLG = Animated.createAnimatedComponent(LinearGradient);

const Shimmer = ({ width: w, height: h, style, borderRadius = 0, progress }) => {
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
        colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
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

const SkeletonPostGrid = () => {
  // Show 9 cards (3 rows x 3 columns)
  const data = new Array(9).fill(null);
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

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {data.map((_, index) => {
          const isLastInRow = (index + 1) % COLUMNS === 0;
          return (
            <View 
              key={index} 
              style={[
                styles.item,
                { 
                  width: ITEM_SIZE, 
                  height: ITEM_SIZE,
                  marginRight: isLastInRow ? 0 : GAP,
                  marginBottom: GAP
                }
              ]}
            >
              <Shimmer width={ITEM_SIZE} height={ITEM_SIZE} borderRadius={8} progress={shimmerProgress} />
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
  },
  shimmerContainer: {
    backgroundColor: '#E1E9EE',
    overflow: 'hidden',
  },
  background: {
    backgroundColor: '#F0F2F5',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  item: {
    backgroundColor: '#E1E9EE',
    borderRadius: 8,
    overflow: 'hidden',
  }
});

export default SkeletonPostGrid;
