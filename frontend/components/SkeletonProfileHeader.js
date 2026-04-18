import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

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

const SkeletonProfileHeader = ({ type = 'member' }) => {
  const isCommunity = type === 'community';

  if (isCommunity) {
    return (
      <View style={styles.container}>
        {/* Banner */}
        <Shimmer width={width} height={150} borderRadius={0} style={styles.banner} />
        
        {/* Content Wrapper */}
        <View style={styles.communityContent}>
          {/* Avatar Area - Overlapping Banner */}
          <View style={styles.communityAvatarContainer}>
            <Shimmer width={100} height={100} borderRadius={50} style={styles.avatarBorder} />
          </View>

          {/* Name & Bio */}
          <View style={styles.centerContent}>
            <Shimmer width={200} height={24} style={styles.nameLine} />
            <Shimmer width={150} height={16} style={styles.categoryLine} />
            <View style={styles.bioBlock}>
              <Shimmer width={width - 40} height={14} style={styles.textLine} />
              <Shimmer width={width - 80} height={14} style={styles.textLine} />
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <Shimmer width={60} height={40} />
            <Shimmer width={60} height={40} />
            <Shimmer width={60} height={40} />
          </View>

          {/* Edit Button */}
          <Shimmer width={width - 40} height={45} borderRadius={8} style={styles.button} />

          {/* Heads Section Placeholder */}
          <View style={styles.sectionPlaceholder}>
             <Shimmer width={150} height={20} style={styles.sectionTitle} />
             <Shimmer width={width - 40} height={60} borderRadius={12} />
          </View>
        </View>
      </View>
    );
  }

  // Member Layout
  return (
    <View style={styles.container}>
      {/* Header Space */}
      <View style={{ height: 20 }} />

      {/* Profile Image - Centered */}
      <View style={styles.centerContent}>
        <Shimmer width={120} height={120} borderRadius={60} style={styles.avatar} />
      </View>

      {/* Name & Info */}
      <View style={styles.centerContent}>
        <Shimmer width={180} height={24} style={styles.nameLine} />
        <Shimmer width={100} height={16} style={styles.usernameLine} />
        
        {/* Chips Row */}
        <View style={styles.chipRow}>
           <Shimmer width={80} height={24} borderRadius={12} />
           <Shimmer width={60} height={24} borderRadius={12} />
        </View>

        {/* Bio */}
        <View style={styles.bioBlock}>
           <Shimmer width={width - 60} height={14} style={styles.textLine} />
           <Shimmer width={width - 100} height={14} style={styles.textLine} />
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <Shimmer width={80} height={50} />
        <Shimmer width={80} height={50} />
      </View>

      {/* Action Buttons */}
      <View style={styles.centerContent}>
         <Shimmer width={width - 40} height={45} borderRadius={8} style={styles.button} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  shimmerContainer: {
    backgroundColor: '#E1E9EE',
    overflow: 'hidden',
  },
  background: {
    backgroundColor: '#F0F2F5',
  },
  
  // Member Styles
  centerContent: {
    alignItems: 'center',
    marginVertical: 8,
    width: '100%',
  },
  avatar: {
    marginBottom: 12,
  },
  nameLine: {
    marginBottom: 8,
  },
  usernameLine: {
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  bioBlock: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  textLine: {
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  button: {
    marginTop: 10,
  },

  // Community Styles
  banner: {
    width: '100%',
  },
  communityContent: {
    alignItems: 'center',
    marginTop: -50, // Pull avatar up
  },
  communityAvatarContainer: {
    padding: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 54,
    marginBottom: 10,
  },
  avatarBorder: {
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  categoryLine: {
    marginVertical: 4,
  },
  sectionPlaceholder: {
    marginTop: 20,
    width: '100%',
    paddingHorizontal: 20,
    gap: 10,
  },
  sectionTitle: {
    marginBottom: 6,
  }
});

export default SkeletonProfileHeader;
