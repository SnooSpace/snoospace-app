import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const AnimatedLG = Animated.createAnimatedComponent(LinearGradient);

const Shimmer = ({ width: w, height: h, style }) => {
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
    <View style={[styles.shimmerContainer, { width: w, height: h }, style]}>
      <View style={[styles.background, { width: w, height: h }]} />
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

const SkeletonCard = () => {
  return (
    <View style={styles.cardContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Shimmer width={40} height={40} style={styles.avatar} />
        <View style={styles.headerText}>
          <Shimmer width={120} height={14} style={styles.title} />
          <Shimmer width={80} height={12} style={styles.subtitle} />
        </View>
      </View>

      {/* Content Image */}
      <Shimmer width={width - 40} height={300} style={styles.image} />

      {/* Footer/Actions */}
      <View style={styles.footer}>
        <Shimmer width={100} height={20} style={styles.actionNav} />
      </View>
      
      {/* Caption lines */}
      <View style={styles.captionContainer}>
         <Shimmer width={width - 60} height={14} style={styles.captionLine} />
         <Shimmer width={width - 100} height={14} style={styles.captionLine} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
    width: width,
    paddingBottom: 15,
  },
  shimmerContainer: {
    backgroundColor: '#E1E9EE',
    overflow: 'hidden',
  },
  background: {
    backgroundColor: '#F0F2F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerText: {
    marginLeft: 12,
    gap: 6,
  },
  avatar: {
    borderRadius: 20,
  },
  title: {
    borderRadius: 4,
  },
  subtitle: {
    borderRadius: 4,
  },
  image: {
    alignSelf: 'center',
    borderRadius: 12, // Maintain the style from PostCard
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  actionNav: {
    borderRadius: 4,
  },
  captionContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  captionLine: {
    borderRadius: 4,
  }
});

export default SkeletonCard;
