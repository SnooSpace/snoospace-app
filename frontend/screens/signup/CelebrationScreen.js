import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Animated,
} from "react-native";
import LottieView from "lottie-react-native";
import ReAnimated, { FadeInUp, FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, BORDER_RADIUS } from "../../constants/theme";
import { triggerCelebrationHaptics } from "../../hooks/useCelebrationHaptics";

const { width } = Dimensions.get("window");

// ─── Gradient sets — softly cycles through warm light tones ──────────────────
const GRADIENT_SETS = [
  ["#F0D6F5", "#D6E8FA", "#FAD6E8"],
  ["#D6F0F5", "#F5EAD6", "#E8D6F0"],
  ["#EAD6F5", "#F5D6EA", "#D6F0EA"],
  ["#D6EAF5", "#F0D6F5", "#F5EAD6"],
];

// ─── Particle colors ──────────────────────────────────────────────────────────
const PARTICLE_COLORS = [
  "#FF4D6D",
  "#FFD166",
  "#06D6A0",
  "#C77DFF",
  "#118AB2",
  "#FF9F1C",
];

function buildParticles(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 10 + Math.random() * (width - 20),
    startBottom: 60 + Math.random() * 80,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
    size: 4 + Math.random() * 5,
    translateY: new Animated.Value(0),
    opacity: new Animated.Value(0),
    duration: 3500 + Math.random() * 2500,
    delay: 1200 + Math.random() * 2500,
  }));
}

// ─── Component ────────────────────────────────────────────────────────────────
const CelebrationScreen = ({ navigation, route }) => {
  const { role } = route.params || { role: "People" };

  // Gradient cycling
  const [gradientIndex, setGradientIndex] = useState(0);
  const gradientOpacity = useRef(new Animated.Value(1)).current;

  // CTA breathing
  const ctaScale = useRef(new Animated.Value(1)).current;
  const ctaBreathingStarted = useRef(false);

  // Emoji bounce
  const emojiScale = useRef(new Animated.Value(0)).current;

  // Title shimmer
  const shimmerX = useRef(new Animated.Value(-width)).current;

  // Particles
  const [particles] = useState(() => buildParticles(16));

  // ── Haptics on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    triggerCelebrationHaptics();

    // Emoji pop-in with overshoot spring
    Animated.spring(emojiScale, {
      toValue: 1,
      tension: 60,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, []);

  // ── Gradient cycle ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const cycle = () => {
      if (cancelled) return;
      Animated.sequence([
        Animated.delay(2500),
        Animated.timing(gradientOpacity, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(gradientOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && !cancelled) {
          setGradientIndex((prev) => (prev + 1) % GRADIENT_SETS.length);
          cycle();
        }
      });
    };

    cycle();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Floating particles ────────────────────────────────────────────────────
  useEffect(() => {
    particles.forEach((p) => {
      const loop = () => {
        p.translateY.setValue(0);
        p.opacity.setValue(0);

        Animated.sequence([
          Animated.delay(p.delay),
          Animated.parallel([
            Animated.timing(p.translateY, {
              toValue: -(120 + Math.random() * 80),
              duration: p.duration,
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(p.opacity, {
                toValue: 0.75,
                duration: p.duration * 0.2,
                useNativeDriver: true,
              }),
              Animated.timing(p.opacity, {
                toValue: 0.75,
                duration: p.duration * 0.55,
                useNativeDriver: true,
              }),
              Animated.timing(p.opacity, {
                toValue: 0,
                duration: p.duration * 0.25,
                useNativeDriver: true,
              }),
            ]),
          ]),
        ]).start(() => loop());
      };

      loop();
    });
  }, []);

  // ── Title shimmer — slow sweep every ~4.5s ───────────────────────────────
  useEffect(() => {
    const startShimmer = () => {
      shimmerX.setValue(-width);
      Animated.loop(
        Animated.sequence([
          Animated.delay(2000),
          Animated.timing(shimmerX, {
            toValue: width * 1.5,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.delay(3500),
        ])
      ).start();
    };
    // Start after headline has entered
    const t = setTimeout(startShimmer, 1200);
    return () => clearTimeout(t);
  }, []);

  // ── CTA breathing — starts after entrance animation completes ─────────────
  const startCtaBreathing = () => {
    if (ctaBreathingStarted.current) return;
    ctaBreathingStarted.current = true;

    Animated.loop(
      Animated.sequence([
        Animated.timing(ctaScale, {
          toValue: 1.045,
          duration: 950,
          useNativeDriver: true,
        }),
        Animated.timing(ctaScale, {
          toValue: 1,
          duration: 950,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const handleFinish = () => {
    const targetHome = role === "People" ? "MemberHome" : "CommunityHome";
    navigation.reset({
      index: 0,
      routes: [{ name: targetHome }],
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* 1. Animated gradient background */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { opacity: gradientOpacity }]}
      >
        <LinearGradient
          colors={GRADIENT_SETS[gradientIndex]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      {/* 2. Floating particles — behind Lottie */}
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        {particles.map((p) => (
          <Animated.View
            key={p.id}
            style={{
              position: "absolute",
              bottom: p.startBottom,
              left: p.x,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: p.color,
              opacity: p.opacity,
              transform: [{ translateY: p.translateY }],
            }}
          />
        ))}
      </View>

      {/* 3. Full screen Lottie confetti */}
      <LottieView
        source={require("../../assets/animations/Confetti - Full Screen.json")}
        autoPlay
        loop={false}
        style={styles.lottie}
        resizeMode="cover"
      />

      {/* 4. Content */}
      <SafeAreaView style={styles.content}>
        <View style={styles.innerContent}>

          {/* Headline block */}
          <ReAnimated.View
            entering={FadeInUp.delay(300).duration(800).springify()}
            style={styles.headerContainer}
          >
            {/* Radial glow behind emoji */}
            <View style={styles.emojiGlowWrapper}>
              <View style={styles.emojiGlow} />
              <Animated.Text
                style={[styles.emoji, { transform: [{ scale: emojiScale }] }]}
              >
                🎉
              </Animated.Text>
            </View>
            {/* Title with shimmer sweep */}
            <View style={styles.titleWrapper}>
              <Text style={styles.title}>Your space is ready</Text>
              {/* Shimmer overlay — translates across clipped title area */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.shimmerOverlay,
                  { transform: [{ translateX: shimmerX }] },
                ]}
              >
                <LinearGradient
                  colors={[
                    "transparent",
                    "rgba(255,255,255,0.55)",
                    "transparent",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.shimmerGradient}
                />
              </Animated.View>
            </View>
            <Text style={styles.subtitle}>
              The best events, the right people — they're all waiting.
            </Text>
          </ReAnimated.View>

          {/* CTA with breathing pulse */}
          <ReAnimated.View
            entering={FadeInDown.delay(1000).duration(800).springify()}
            style={styles.buttonContainer}
            onLayout={() => {
              setTimeout(startCtaBreathing, 1400);
            }}
          >
            <Animated.View style={{ transform: [{ scale: ctaScale }] }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleFinish}
                style={styles.nextButtonContainer}
              >
                <LinearGradient
                  colors={COLORS.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.nextButton}
                >
                  <Text style={styles.nextButtonText}>Take me in →</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </ReAnimated.View>

        </View>
      </SafeAreaView>
      {/* 5. Edge vignette — cinematic framing */}
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        {/* Top */}
        <LinearGradient
          colors={["rgba(0,0,0,0.09)", "transparent"]}
          style={styles.vignetteTop}
        />
        {/* Bottom */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.09)"]}
          style={styles.vignetteBottom}
        />
        {/* Left */}
        <LinearGradient
          colors={["rgba(0,0,0,0.06)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.vignetteLeft}
        />
        {/* Right */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.06)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.vignetteRight}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background || "#FFFFFF",
  },
  lottie: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    pointerEvents: "none",
  },
  content: {
    flex: 1,
    zIndex: 2,
  },
  innerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 100,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  emojiGlowWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emojiGlow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(199, 125, 255, 0.18)",
    shadowColor: "#C77DFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 0,
  },
  title: {
    fontSize: 34,
    fontFamily: "BasicCommercial-Black",
    color: COLORS.textPrimary,
    textAlign: "center",
    marginBottom: 16,
    letterSpacing: -1,
  },
  titleWrapper: {
    overflow: "hidden",
    marginBottom: 16,
  },
  shimmerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  shimmerGradient: {
    width: width * 0.5,
    height: "100%",
  },
  // ── Vignette edges ──
  vignetteTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  vignetteBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  vignetteLeft: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 60,
  },
  vignetteRight: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: 60,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 28,
    paddingHorizontal: 10,
  },
  buttonContainer: {
    width: "100%",
    position: "absolute",
    bottom: 50,
  },
  nextButtonContainer: {
    borderRadius: BORDER_RADIUS.pill,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  nextButton: {
    height: 64,
    borderRadius: BORDER_RADIUS.pill,
    justifyContent: "center",
    alignItems: "center",
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Manrope-SemiBold",
  },
});

export default CelebrationScreen;