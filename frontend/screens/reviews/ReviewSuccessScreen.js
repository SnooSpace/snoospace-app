import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { CheckCircle } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';

const { width } = Dimensions.get('window');

/**
 * ReviewSuccessScreen
 *
 * Two variants:
 *   type='event'     → event review success copy
 *   type='open_plan' → open plan review success copy
 *
 * Route params: { type: 'event' | 'open_plan' }
 * Auto-navigates back after 2 seconds or on tap.
 */
export default function ReviewSuccessScreen({ route, navigation }) {
  const type = route?.params?.type || 'event';

  const scale    = useSharedValue(0.6);
  const opacity  = useSharedValue(0);
  const slideY   = useSharedValue(40);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    scale.value   = withSpring(1, { damping: 13, stiffness: 180 });
    opacity.value = withTiming(1, { duration: 300 });
    slideY.value  = withSpring(0, { damping: 13 });

    // Auto-dismiss after 2 seconds
    const timer = setTimeout(() => {
      navigation.goBack();
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const animatedCard = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: slideY.value }],
    opacity: opacity.value,
  }));

  const content = type === 'open_plan'
    ? {
        emoji: '✨',
        headline: 'Thanks!',
        body: "Your responses help us introduce you to people you'll actually enjoy meeting.",
      }
    : {
        emoji: '🎉',
        headline: 'Thanks!',
        body: 'Your feedback helps organizers build better events.',
      };

  return (
    <View style={styles.overlay}>
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />

      <Animated.View style={[styles.card, animatedCard]}>
        {/* Icon */}
        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <CheckCircle size={36} color="#22C55E" strokeWidth={2} />
          </View>
        </View>

        {/* Emoji */}
        <Text style={styles.emoji}>{content.emoji}</Text>

        {/* Headline */}
        <Text style={styles.headline}>{content.headline}</Text>

        {/* Body */}
        <Text style={styles.body}>{content.body}</Text>

        {/* Tap to dismiss */}
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: width * 0.84,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingVertical: 36,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  iconWrap: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 36,
    marginBottom: 12,
  },
  headline: {
    fontFamily: FONTS.black,
    fontSize: 26,
    color: COLORS.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  body: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  doneButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 50,
    backgroundColor: COLORS.screenBackground,
  },
  doneText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});
