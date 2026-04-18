import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const AnimatedLG = Animated.createAnimatedComponent(LinearGradient);

const Shimmer = ({ width: w, height: h, style, borderRadius = 4 }) => {
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
        colors={['transparent', 'rgba(255,255,255,0.5)', 'transparent']}
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

const SkeletonUserCard = () => {
  return (
    <View style={styles.container}>
      {/* Avatar */}
      <Shimmer width={48} height={48} borderRadius={24} style={styles.avatar} />
      
      {/* Text Info */}
      <View style={styles.info}>
        <Shimmer width={120} height={16} style={styles.nameLine} />
        <Shimmer width={80} height={14} style={styles.usernameLine} />
      </View>

      {/* Action Button */}
      <Shimmer width={80} height={32} borderRadius={8} style={styles.button} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  shimmerContainer: {
    backgroundColor: '#E1E9EE',
    overflow: 'hidden',
  },
  background: {
    backgroundColor: '#F0F2F5',
  },
  avatar: {
    // Already styled via props
  },
  info: {
    flex: 1,
    marginLeft: 12,
    gap: 6,
  },
  nameLine: {
    borderRadius: 4,
  },
  usernameLine: {
    borderRadius: 4,
  },
  button: {
    // Already styled via props
  },
});

export default SkeletonUserCard;
