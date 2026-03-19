import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Animated,
  TouchableOpacity,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { X } from "lucide-react-native";
import { FONTS } from "../../constants/theme";
import LogoDark from "../../components/SnooSpaceLogoDark";

const { width, height } = Dimensions.get("window");

// ─── Farewell lines — fade in one by one, like a quiet eulogy ────────────────
const FAREWELL_LINES = [
  "Your events. Gone.",
  "Your people. Gone.",
  "Your memories. Gone.",
];

// ─── Fading dot particles — slow drift downward like dust ────────────────────
function buildDust(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 20 + Math.random() * (width - 40),
    y: 80 + Math.random() * (height * 0.5),
    size: 2 + Math.random() * 3,
    opacity: new Animated.Value(0),
    translateY: new Animated.Value(0),
    duration: 4000 + Math.random() * 3000,
    delay: 800 + Math.random() * 3000,
  }));
}

const DeleteConfirmationScreen = ({ navigation, route }) => {
  const { nextRoute = "Landing" } = route?.params || {};

  // Background
  const bgOpacity = useRef(new Animated.Value(0)).current;

  // SnooSpace logo / wordmark fade out
  const logoOpacity = useRef(new Animated.Value(1)).current;
  const logoScale   = useRef(new Animated.Value(1)).current;

  // Farewell lines
  const [visibleLines, setVisibleLines] = useState([]);
  const lineOpacities = useRef(
    FAREWELL_LINES.map(() => new Animated.Value(0))
  ).current;
  const lineTranslateY = useRef(
    FAREWELL_LINES.map(() => new Animated.Value(8))
  ).current;

  // Final goodbye text
  const goodbyeOpacity   = useRef(new Animated.Value(0)).current;
  const goodbyeTranslateY = useRef(new Animated.Value(12)).current;

  // Horizontal divider line
  const dividerWidth = useRef(new Animated.Value(0)).current;

  // Dust particles
  const [dust] = useState(() => buildDust(18));

  // ── Sequence orchestration ────────────────────────────────────────────────
  useEffect(() => {
    // 1. Fade background in quickly
    Animated.timing(bgOpacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // 2. Logo slowly fades and shrinks away — like it's disappearing
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 0.85,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]).start();
    }, 1500);

    // 3. Divider line draws across
    setTimeout(() => {
      Animated.timing(dividerWidth, {
        toValue: width * 0.5,
        duration: 800,
        useNativeDriver: false, // width can't use native driver
      }).start();
    }, 2800);

    // 4. Farewell lines stagger in — one every 700ms
    FAREWELL_LINES.forEach((_, i) => {
      setTimeout(() => {
        setVisibleLines((prev) => [...prev, i]);
        Animated.parallel([
          Animated.timing(lineOpacities[i], {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(lineTranslateY[i], {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start();
      }, 3400 + i * 700);
    });

    // 5. Final goodbye after lines are done
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(goodbyeOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(goodbyeTranslateY, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();
    }, 3400 + FAREWELL_LINES.length * 700 + 500);

    // 6. Dust particles drift
    dust.forEach((d) => {
      const loop = () => {
        d.translateY.setValue(0);
        d.opacity.setValue(0);
        Animated.sequence([
          Animated.delay(d.delay),
          Animated.parallel([
            Animated.timing(d.translateY, {
              toValue: 40 + Math.random() * 40,
              duration: d.duration,
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(d.opacity, {
                toValue: 0.25,
                duration: d.duration * 0.3,
                useNativeDriver: true,
              }),
              Animated.timing(d.opacity, {
                toValue: 0,
                duration: d.duration * 0.7,
                useNativeDriver: true,
              }),
            ]),
          ]),
        ]).start(() => loop());
      };
      loop();
    });

    // 7. Auto-navigate to target nextRoute after farewell settles
    const navTimer = setTimeout(() => {
      navigation?.dispatch?.({
        type: "RESET",
        payload: { index: 0, routes: [{ name: nextRoute }] },
      });
    }, 3400 + FAREWELL_LINES.length * 700 + 3500);

    return () => clearTimeout(navTimer);
  }, [nextRoute, dust, navigation]); // Added dependencies

  const handleSkip = () => {
    navigation?.dispatch?.({
      type: "RESET",
      payload: { index: 0, routes: [{ name: nextRoute }] },
    });
  };

  return (
    <Animated.View style={[styles.container, { opacity: bgOpacity }]}>
      <StatusBar barStyle="light-content" />

      {/* Deep muted background */}
      <LinearGradient
        colors={["#1A1A24", "#12121A", "#0E0E16"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Dust particles */}
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        {dust.map((d) => (
          <Animated.View
            key={d.id}
            style={{
              position: "absolute",
              left: d.x,
              top: d.y,
              width: d.size,
              height: d.size,
              borderRadius: d.size / 2,
              backgroundColor: "#6B7280",
              opacity: d.opacity,
              transform: [{ translateY: d.translateY }],
            }}
          />
        ))}
      </View>

      <SafeAreaView style={styles.safeArea}>
        {/* ── Skip Button ── */}
        <TouchableOpacity
          onPress={handleSkip}
          style={styles.closeButton}
          activeOpacity={0.6}
        >
          <View style={styles.iconContainer}>
            <X size={20} color="rgba(255,255,255,0.6)" strokeWidth={2} />
          </View>
        </TouchableOpacity>

        <View style={styles.inner}>

          {/* ── Logo fading away ── */}
          <Animated.View
            style={[
              styles.logoBlock,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <LogoDark width={160} height={32} style={styles.logoSvg} />
            <Text style={styles.logoSub}>Where your people find you</Text>
          </Animated.View>

          {/* ── Divider line ── */}
          <Animated.View style={[styles.divider, { width: dividerWidth }]} />

          {/* ── Farewell lines ── */}
          <View style={styles.farewellBlock}>
            {FAREWELL_LINES.map((line, i) => (
              <Animated.Text
                key={i}
                style={[
                  styles.farewellLine,
                  {
                    opacity: lineOpacities[i],
                    transform: [{ translateY: lineTranslateY[i] }],
                  },
                ]}
              >
                {line}
              </Animated.Text>
            ))}
          </View>

          {/* ── Final goodbye ── */}
          <Animated.View
            style={[
              styles.goodbyeBlock,
              {
                opacity: goodbyeOpacity,
                transform: [{ translateY: goodbyeTranslateY }],
              },
            ]}
          >
            <Text style={styles.goodbyeText}>
              We'll miss you.{"\n"}Take care out there.
            </Text>
            <Text style={styles.goodbyeSub}>
              — The SnooSpace team
            </Text>
          </Animated.View>

        </View>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#12121A",
  },
  safeArea: { flex: 1 },
  inner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 36,
  },

  // ── Logo ──
  logoBlock: { alignItems: "center", gap: 12 },
  logoSvg: {
    opacity: 1,
  },
  logoSub: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 0.3,
  },

  // ── Divider ──
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignSelf: "center",
  },

  // ── Farewell lines ──
  farewellBlock: {
    alignItems: "center",
    gap: 12,
  },
  farewellLine: {
    fontSize: 22,
    fontFamily: FONTS.black,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    letterSpacing: -0.4,
  },

  // ── Goodbye ──
  goodbyeBlock: {
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  goodbyeText: {
    fontSize: 18,
    fontFamily: FONTS.regular,
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
    lineHeight: 28,
  },
  goodbyeSub: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: "rgba(255,255,255,0.18)",
    textAlign: "center",
    letterSpacing: 0.3,
  },

  // ── Skip Button ──
  closeButton: {
    position: "absolute",
    top: Platform.OS === "android" ? StatusBar.currentHeight + 16 : 16,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default DeleteConfirmationScreen;
