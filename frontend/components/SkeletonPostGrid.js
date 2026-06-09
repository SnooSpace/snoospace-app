import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { COLORS } from '../constants/theme';

const { width } = Dimensions.get('window');

// Match real profile post cell size: full width, 2px gap, 3 columns, 1:1.35 vertical aspect ratio
const GAP = 2;
const COLUMNS = 3;
const ITEM_SIZE = (width - GAP * (COLUMNS - 1)) / COLUMNS;
const ITEM_HEIGHT = ITEM_SIZE * 1.35;

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
        colors={['transparent', 'rgba(255, 255, 255, 0.5)', 'transparent']}
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
  // Use explicit row arrays to prevent React Native flexWrap floating point rounding bugs
  const rows = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
  ];
  
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
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map((itemIndex) => (
            <View key={`item-${itemIndex}`} style={styles.item}>
              <Shimmer 
                width={ITEM_SIZE} 
                height={ITEM_HEIGHT} 
                borderRadius={0} 
                progress={shimmerProgress} 
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    backgroundColor: COLORS.background || '#f9f9f9',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: GAP,
    marginBottom: GAP,
  },
  shimmerContainer: {
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  background: {
    backgroundColor: '#F3F4F6',
  },
  item: {
    width: ITEM_SIZE,
    height: ITEM_HEIGHT,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  }
});

export default SkeletonPostGrid;
