import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const GAP = 2; // Mimic tight grid or adjust as needed
const COLUMNS = 3;
const ITEM_SIZE = (width - ((COLUMNS - 1) * GAP)) / COLUMNS;

const AnimatedLG = Animated.createAnimatedComponent(LinearGradient);

const Shimmer = ({ width: w, height: h, style, borderRadius = 0 }) => {
  const animatedValue = new Animated.Value(0);

  useEffect(() => {
    Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-w, w],
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
          {
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
};

const SkeletonPostGrid = () => {
  // Generate 12 placeholders
  const data = new Array(12).fill(null);

  return (
    <View style={styles.container}>
      {/* Grid Header / Tab Placeholder (optional, keeping simple for now) */}
      <View style={styles.gridTabs}>
         <Shimmer width={24} height={24} style={{ marginRight: 8 }} />
      </View>

      <View style={styles.grid}>
        {data.map((_, index) => (
          <View 
            key={index} 
            style={[
              styles.item,
              { 
                width: ITEM_SIZE, 
                height: ITEM_SIZE,
                marginRight: (index + 1) % COLUMNS === 0 ? 0 : GAP,
                marginBottom: GAP
              }
            ]}
          >
            <Shimmer width={ITEM_SIZE} height={ITEM_SIZE} />
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
  },
  shimmerContainer: {
    backgroundColor: '#E1E9EE',
    overflow: 'hidden',
  },
  background: {
    backgroundColor: '#F0F2F5',
  },
  gridTabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    marginBottom: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  item: {
    backgroundColor: '#E1E9EE',
  }
});

export default SkeletonPostGrid;
