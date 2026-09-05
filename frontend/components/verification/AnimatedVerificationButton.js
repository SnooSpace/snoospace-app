import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  cancelAnimation,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import {
  ShieldCheck,
  Lock,
  ScanFace,
  Clock,
  RotateCcw,
  Check,
} from 'lucide-react-native';
import { COLORS, FONTS, SHADOWS } from '../../constants/theme';
import HapticsService from '../../services/HapticsService';

// ─── Liveness Status Steps ───────────────────────────────────────────────────
const LIVENESS_STEPS = [
  {
    icon: Lock,
    label: 'Securing live video...',
  },
  {
    icon: ScanFace,
    label: 'Analyzing facial liveness...',
  },
  {
    icon: ShieldCheck,
    label: 'Submitting verification...',
  },
];

const BUTTON_HEIGHT = 52;
const CUBE_SIZE = 52;

export default function AnimatedVerificationButton({
  onPress,
  disabled = false,
  title = 'Submit for review',
  status = 'idle', // 'idle' | 'submitting' | 'success' | 'review' | 'failed'
  accentColor = COLORS.primary,
  onAnimationComplete,
  style,
}) {
  const [measuredWidth, setMeasuredWidth] = useState(320);
  const [hasMeasured, setHasMeasured] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);

  // ─── Shared Animated Values ─────────────────────────────────────────────────
  const buttonWidth = useSharedValue(320);
  const buttonRadius = useSharedValue(16);
  const spinRotation = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const buttonScale = useSharedValue(1);
  const contentOpacity = useSharedValue(1);
  const statusContainerOpacity = useSharedValue(0);
  const ring1Scale = useSharedValue(1);
  const ring1Opacity = useSharedValue(0);
  const ring2Scale = useSharedValue(1);
  const ring2Opacity = useSharedValue(0);

  const phaseTimerRef = useRef(null);
  const completionTimerRef = useRef(null);

  // ─── Container onLayout ─────────────────────────────────────────────────────
  const onLayoutContainer = useCallback((e) => {
    const width = e.nativeEvent.layout.width;
    if (width > 60 && !hasMeasured) {
      setMeasuredWidth(width);
      setHasMeasured(true);
      if (status === 'idle') {
        buttonWidth.value = width;
      }
    }
  }, [hasMeasured, status, buttonWidth]);

  // ─── React to Status Changes ────────────────────────────────────────────────
  useEffect(() => {
    // Clear any existing timers
    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    if (completionTimerRef.current) clearTimeout(completionTimerRef.current);

    if (status === 'idle') {
      cancelAnimation(spinRotation);
      cancelAnimation(ring1Scale);
      cancelAnimation(ring1Opacity);
      cancelAnimation(ring2Scale);
      cancelAnimation(ring2Opacity);
      spinRotation.value = withTiming(0, { duration: 250 });
      shakeX.value = 0;
      buttonScale.value = withSpring(1);
      buttonRadius.value = withTiming(16, { duration: 300 });
      buttonWidth.value = withSpring(measuredWidth, { damping: 15, stiffness: 120 });
      contentOpacity.value = withTiming(1, { duration: 250 });
      statusContainerOpacity.value = withTiming(0, { duration: 200 });
      ring1Opacity.value = 0;
      ring2Opacity.value = 0;
      setPhaseIndex(0);
    } else if (status === 'submitting') {
      // 1. Shrink width to cube
      contentOpacity.value = withTiming(0, { duration: 150 });
      buttonRadius.value = withTiming(14, { duration: 300 });
      buttonWidth.value = withSpring(CUBE_SIZE, { damping: 14, stiffness: 140 });

      // 2. Start continuous 360-degree rotation (starting from 45deg tilt)
      spinRotation.value = 45;
      spinRotation.value = withRepeat(
        withTiming(405, { duration: 1000, easing: Easing.linear }),
        -1,
        false
      );

      // 3. Ambient radar ripples expanding from the cube
      ring1Scale.value = 1;
      ring1Opacity.value = 0.45;
      ring1Scale.value = withRepeat(
        withTiming(2.1, { duration: 1500, easing: Easing.out(Easing.quad) }),
        -1,
        false
      );
      ring1Opacity.value = withRepeat(
        withTiming(0, { duration: 1500, easing: Easing.out(Easing.quad) }),
        -1,
        false
      );

      ring2Scale.value = 1;
      ring2Opacity.value = 0.45;
      setTimeout(() => {
        ring2Scale.value = withRepeat(
          withTiming(2.1, { duration: 1500, easing: Easing.out(Easing.quad) }),
          -1,
          false
        );
        ring2Opacity.value = withRepeat(
          withTiming(0, { duration: 1500, easing: Easing.out(Easing.quad) }),
          -1,
          false
        );
      }, 750);

      // 4. Fade in status text ticker below
      statusContainerOpacity.value = withTiming(1, { duration: 400 });

      // 5. Cycle through security status texts
      setPhaseIndex(0);
      phaseTimerRef.current = setInterval(() => {
        setPhaseIndex((prev) => (prev + 1) % LIVENESS_STEPS.length);
      }, 1800);
    } else if (status === 'success') {
      // Verification completed & approved!
      cancelAnimation(spinRotation);
      cancelAnimation(ring1Scale);
      cancelAnimation(ring1Opacity);
      cancelAnimation(ring2Scale);
      cancelAnimation(ring2Opacity);
      ring1Opacity.value = withTiming(0, { duration: 200 });
      ring2Opacity.value = withTiming(0, { duration: 200 });

      // Reset spin and scale up into a smooth circular badge
      spinRotation.value = withTiming(0, { duration: 250 });
      buttonWidth.value = withSpring(56, { damping: 12, stiffness: 130 });
      buttonRadius.value = withTiming(28, { duration: 250 });
      statusContainerOpacity.value = withTiming(1, { duration: 300 });

      HapticsService.triggerNotificationSuccess?.();

      completionTimerRef.current = setTimeout(() => {
        onAnimationComplete?.();
      }, 1600);
    } else if (status === 'review') {
      // Under review / pending (standard SnooSpace backend response)
      cancelAnimation(spinRotation);
      cancelAnimation(ring1Scale);
      cancelAnimation(ring1Opacity);
      cancelAnimation(ring2Scale);
      cancelAnimation(ring2Opacity);
      ring1Opacity.value = withTiming(0, { duration: 200 });
      ring2Opacity.value = withTiming(0, { duration: 200 });

      spinRotation.value = withTiming(0, { duration: 250 });
      buttonWidth.value = withSpring(56, { damping: 12, stiffness: 130 });
      buttonRadius.value = withTiming(28, { duration: 250 });
      statusContainerOpacity.value = withTiming(1, { duration: 300 });

      HapticsService.triggerImpactMedium?.();

      completionTimerRef.current = setTimeout(() => {
        onAnimationComplete?.();
      }, 1600);
    } else if (status === 'failed') {
      // Failure / Error state: shake + retry
      cancelAnimation(spinRotation);
      cancelAnimation(ring1Scale);
      cancelAnimation(ring1Opacity);
      cancelAnimation(ring2Scale);
      cancelAnimation(ring2Opacity);
      ring1Opacity.value = 0;
      ring2Opacity.value = 0;

      spinRotation.value = withTiming(0, { duration: 150 });
      buttonRadius.value = withTiming(16, { duration: 250 });
      buttonWidth.value = withSpring(measuredWidth, { damping: 14, stiffness: 120 });
      contentOpacity.value = withTiming(1, { duration: 200 });
      statusContainerOpacity.value = withTiming(0, { duration: 150 });

      // Shake animation
      shakeX.value = withSequence(
        withTiming(-10, { duration: 55 }),
        withTiming(10, { duration: 55 }),
        withTiming(-7, { duration: 55 }),
        withTiming(7, { duration: 55 }),
        withTiming(0, { duration: 55 })
      );

      HapticsService.triggerNotificationError?.();
    }

    return () => {
      if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
      if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    };
  }, [status, measuredWidth]);

  // ─── Button Press Handler ───────────────────────────────────────────────────
  const handlePress = () => {
    if (disabled || status === 'submitting') return;
    HapticsService.triggerImpactLight?.();
    buttonScale.value = withSequence(
      withTiming(0.96, { duration: 90 }),
      withSpring(1, { damping: 10, stiffness: 200 })
    );
    onPress?.();
  };

  // ─── Animated Styles ────────────────────────────────────────────────────────
  const animatedButtonStyle = useAnimatedStyle(() => {
    return {
      width: buttonWidth.value,
      height: BUTTON_HEIGHT,
      borderRadius: buttonRadius.value,
      transform: [
        { translateX: shakeX.value },
        { scale: buttonScale.value },
      ],
    };
  });

  const animatedSpinStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${spinRotation.value}deg` }],
    };
  });

  const animatedCounterSpinStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${-spinRotation.value}deg` }],
    };
  });

  const animatedContentStyle = useAnimatedStyle(() => {
    return {
      opacity: contentOpacity.value,
    };
  });

  const animatedStatusStyle = useAnimatedStyle(() => {
    return {
      opacity: statusContainerOpacity.value,
    };
  });

  const animatedRing1Style = useAnimatedStyle(() => {
    return {
      transform: [{ scale: ring1Scale.value }],
      opacity: ring1Opacity.value,
    };
  });

  const animatedRing2Style = useAnimatedStyle(() => {
    return {
      transform: [{ scale: ring2Scale.value }],
      opacity: ring2Opacity.value,
    };
  });

  // Current Phase
  const currentStep = LIVENESS_STEPS[phaseIndex];
  const StepIcon = currentStep?.icon || ShieldCheck;

  // Background style based on status
  const getButtonBgStyle = () => {
    if (status === 'success') {
      return { backgroundColor: '#E8F5E9', borderWidth: 2, borderColor: '#34C759' };
    }
    if (status === 'review') {
      return { backgroundColor: '#FFF8E1', borderWidth: 2, borderColor: '#B45309' };
    }
    if (status === 'failed') {
      return { backgroundColor: '#FFEBEE', borderWidth: 1.5, borderColor: '#EF5350' };
    }
    if (disabled && status === 'idle') {
      return { backgroundColor: accentColor, opacity: 0.5 };
    }
    return { backgroundColor: accentColor };
  };

  return (
    <View style={[styles.rootWrapper, style]} onLayout={onLayoutContainer}>
      <View style={styles.centerAnchor}>
        {/* Radar concentric rings (visible only during submitting) */}
        {status === 'submitting' && (
          <>
            <Animated.View
              style={[
                styles.radarRing,
                { borderColor: accentColor },
                animatedRing1Style,
              ]}
              pointerEvents="none"
            />
            <Animated.View
              style={[
                styles.radarRing,
                { borderColor: accentColor },
                animatedRing2Style,
              ]}
              pointerEvents="none"
            />
          </>
        )}

        {/* The Morphing Button / Cube */}
        <Animated.View style={[styles.buttonBase, getButtonBgStyle(), animatedButtonStyle]}>
          <TouchableOpacity
            style={styles.touchArea}
            onPress={handlePress}
            activeOpacity={0.88}
            disabled={disabled || status === 'submitting' || status === 'success' || status === 'review'}
          >
            {/* IDLE STATE CONTENT */}
            {status === 'idle' && (
              <Animated.View style={[styles.idleContent, animatedContentStyle]}>
                <ShieldCheck size={20} color="#FFFFFF" strokeWidth={2} style={styles.idleIcon} />
                <Text style={styles.idleText}>{title}</Text>
              </Animated.View>
            )}

            {/* SUBMITTING CUBE SPIN STATE */}
            {status === 'submitting' && (
              <Animated.View style={[styles.cubeWrapper, animatedSpinStyle]}>
                <View style={[styles.cubeInner, { backgroundColor: accentColor }]}>
                  {/* Keep inner biometric icon upright with counter-rotation */}
                  <Animated.View style={animatedCounterSpinStyle}>
                    <Lock size={20} color="#FFFFFF" strokeWidth={2} />
                  </Animated.View>
                </View>
              </Animated.View>
            )}

            {/* SUCCESS STATE */}
            {status === 'success' && (
              <View style={styles.resultBadge}>
                <LottieView
                  source={require('../../assets/animations/success.json')}
                  autoPlay
                  loop={false}
                  style={styles.lottieCheck}
                />
              </View>
            )}

            {/* UNDER REVIEW STATE */}
            {status === 'review' && (
              <View style={styles.resultBadge}>
                <Clock size={24} color="#B45309" strokeWidth={2.2} />
              </View>
            )}

            {/* FAILED STATE */}
            {status === 'failed' && (
              <Animated.View style={[styles.failedContent, animatedContentStyle]}>
                <RotateCcw size={18} color="#C62828" strokeWidth={2.2} style={styles.idleIcon} />
                <Text style={styles.failedText}>Submission failed — Tap to retry</Text>
              </Animated.View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* SUBMITTING STATUS TICKER BELOW THE CUBE */}
      {status === 'submitting' && (
        <Animated.View style={[styles.statusBox, animatedStatusStyle]}>
          <View style={styles.stepBadgeRow}>
            <StepIcon size={16} color={accentColor} strokeWidth={2} />
            <Text style={[styles.stepLabelText, { color: COLORS.textPrimary }]}>
              {currentStep?.label}
            </Text>
          </View>
          <Text style={styles.stepHelperText}>
            Securing encrypted identity upload • Please keep SnooSpace open
          </Text>
        </Animated.View>
      )}

      {/* RESOLUTION STATUS LABELS */}
      {status === 'success' && (
        <Animated.View style={[styles.statusBox, animatedStatusStyle]}>
          <Text style={[styles.resolutionTitle, { color: '#2E7D32' }]}>Identity Verified!</Text>
          <Text style={styles.stepHelperText}>
            Your verified badge is now active on your profile
          </Text>
        </Animated.View>
      )}

      {status === 'review' && (
        <Animated.View style={[styles.statusBox, animatedStatusStyle]}>
          <Text style={[styles.resolutionTitle, { color: '#B45309' }]}>Submitted for Review</Text>
          <Text style={styles.stepHelperText}>
            Our team will review your verification within 48 hours
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rootWrapper: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 12,
  },
  centerAnchor: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: BUTTON_HEIGHT,
  },
  buttonBase: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  touchArea: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Idle state
  idleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  idleIcon: {
    marginRight: 8,
  },
  idleText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },

  // Cube Spin
  cubeWrapper: {
    width: CUBE_SIZE,
    height: CUBE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cubeInner: {
    width: CUBE_SIZE,
    height: CUBE_SIZE,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },

  // Radar Rings
  radarRing: {
    position: 'absolute',
    width: CUBE_SIZE,
    height: CUBE_SIZE,
    borderRadius: 14,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },

  // Result Badges
  resultBadge: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottieCheck: {
    width: 44,
    height: 44,
  },

  // Failed state
  failedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  failedText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#C62828',
  },

  // Status Box below
  statusBox: {
    marginTop: 18,
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  stepBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  stepLabelText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
  },
  stepHelperText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  resolutionTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    textAlign: 'center',
  },
});
