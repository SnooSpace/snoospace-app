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
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, BORDER_RADIUS, FONTS } from "../../constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteAccount as apiDeleteAccount } from "../../api/account";
import { CommonActions } from "@react-navigation/native";

const { width, height } = Dimensions.get("window");

// ─── Phases ───────────────────────────────────────────────────────────────────
// "sad"       — default, sad face + guilt copy
// "relieved"  — face transformed, wholesome welcome-back screen

// ─── Guilt-trip messages ──────────────────────────────────────────────────────
const GUILT_LINES = [
  "We helped you find new events and people 🎟️",
  "Your people are still out there... 👥",
  "We thought we matched your vibe perfectly 💔",
  "Who's going to help you find your crowd now? 😞",
];

// ─── Wholesome messages after staying ────────────────────────────────────────
const RELIEF_LINES = [
  "We knew you couldn't leave ✨",
  "Your people missed you already 🥹",
  "The best is yet to come 🌟",
];

// ─── Sparkle positions around face ───────────────────────────────────────────
const SPARKLE_OFFSETS = [
  { dx: -70, dy: -50 },
  { dx: 70,  dy: -50 },
  { dx: -85, dy: 10  },
  { dx: 85,  dy: 10  },
  { dx: -50, dy: 65  },
  { dx: 50,  dy: 65  },
  { dx: 0,   dy: -80 },
];

function buildTears(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: width * 0.35 + (i % 2 === 0 ? -18 : 18),
    translateY: new Animated.Value(0),
    opacity: new Animated.Value(0),
    scale: new Animated.Value(0.5 + Math.random() * 0.5),
    delay: 600 + i * 420,
    duration: 900 + Math.random() * 400,
  }));
}

function buildSparkles() {
  return SPARKLE_OFFSETS.map((offset, i) => ({
    id: i,
    dx: offset.dx,
    dy: offset.dy,
    scale: new Animated.Value(0),
    opacity: new Animated.Value(0),
    rotate: new Animated.Value(0),
  }));
}

// ─── Component ────────────────────────────────────────────────────────────────
const DeleteAccountScreen = ({ navigation }) => {
  const [phase, setPhase] = useState("sad");
  const [guiltIndex, setGuiltIndex] = useState(0);
  const [reliefIndex, setReliefIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Face animations
  const faceScale     = useRef(new Animated.Value(0)).current;
  const faceWobble    = useRef(new Animated.Value(0)).current;
  const mouthDroop    = useRef(new Animated.Value(0)).current;
  const eyeSquint     = useRef(new Animated.Value(1)).current;
  const mouthRotation = useRef(new Animated.Value(0)).current; // 0=sad, 1=happy
  const faceJump      = useRef(new Animated.Value(0)).current;
  const faceBgOpacity = useRef(new Animated.Value(0)).current;
  
  // Background animation
  const bgTransitionY = useRef(new Animated.Value(height)).current;

  // Tears & sparkles
  const [tears]    = useState(() => buildTears(6));
  const [sparkles] = useState(() => buildSparkles());
  const tearsActive = useRef(true);

  // Loop refs so we can stop them on transform
  const wobbleLoopRef = useRef(null);
  const squintLoopRef = useRef(null);
  const droopLoopRef  = useRef(null);
  const guiltActive   = useRef(true);

  // Content
  const guiltOpacity      = useRef(new Animated.Value(0)).current;
  const reliefOpacity     = useRef(new Animated.Value(0)).current;
  const sadContentOpacity = useRef(new Animated.Value(0)).current;
  const sadContentY       = useRef(new Animated.Value(40)).current;
  const happyContentOpacity = useRef(new Animated.Value(0)).current;
  const happyContentY       = useRef(new Animated.Value(30)).current;
  const stayScale     = useRef(new Animated.Value(1)).current;
  const deleteOpacity = useRef(new Animated.Value(0)).current;

  // ── Face entrance ─────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.spring(faceScale, {
      toValue: 1,
      tension: 55,
      friction: 5,
      useNativeDriver: true,
    }).start(() => {
      // Wobble
      wobbleLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(faceWobble, { toValue: -6, duration: 90, useNativeDriver: true }),
          Animated.timing(faceWobble, { toValue: 6,  duration: 90, useNativeDriver: true }),
          Animated.timing(faceWobble, { toValue: -4, duration: 90, useNativeDriver: true }),
          Animated.timing(faceWobble, { toValue: 0,  duration: 90, useNativeDriver: true }),
          Animated.delay(2400),
        ])
      );
      wobbleLoopRef.current.start();

      // Eye squint
      squintLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(eyeSquint, { toValue: 0.55, duration: 600, useNativeDriver: true }),
          Animated.timing(eyeSquint, { toValue: 1,    duration: 600, useNativeDriver: true }),
          Animated.delay(1800),
        ])
      );
      squintLoopRef.current.start();

      // Mouth droop
      droopLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(mouthDroop, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(mouthDroop, { toValue: 0, duration: 800, useNativeDriver: true }),
          Animated.delay(1200),
        ])
      );
      droopLoopRef.current.start();
    });
  }, []);

  // ── Tears loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    tears.forEach((t) => {
      const loop = () => {
        if (!tearsActive.current) return;
        t.translateY.setValue(0);
        t.opacity.setValue(0);
        Animated.sequence([
          Animated.delay(t.delay),
          Animated.parallel([
            Animated.timing(t.translateY, {
              toValue: 60,
              duration: t.duration,
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(t.opacity, { toValue: 0.9, duration: 150, useNativeDriver: true }),
              Animated.timing(t.opacity, { toValue: 0, duration: t.duration - 150, useNativeDriver: true }),
            ]),
          ]),
        ]).start(() => loop());
      };
      loop();
    });
  }, []);

  // ── Sad content entrance ──────────────────────────────────────────────────
  useEffect(() => {
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(sadContentY, { toValue: 0, tension: 70, friction: 8, useNativeDriver: true }),
        Animated.timing(sadContentOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]).start();
      setTimeout(() => {
        Animated.timing(deleteOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      }, 400);
    }, 500);
  }, []);

  // ── Guilt line cycling ────────────────────────────────────────────────────
  useEffect(() => {
    let timeoutId;

    const cycle = () => {
      if (!guiltActive.current) return;
      Animated.sequence([
        Animated.timing(guiltOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.delay(2200),
        Animated.timing(guiltOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => {
        if (!guiltActive.current) return;
        setGuiltIndex((i) => (i + 1) % GUILT_LINES.length);
        cycle();
      });
    };
    timeoutId = setTimeout(cycle, 800);

    return () => {
      guiltActive.current = false;
      clearTimeout(timeoutId);
    };
  }, []);

  // ── Relief line cycling ───────────────────────────────────────────────────
  const startReliefCycle = () => {
    const cycle = () => {
      Animated.sequence([
        Animated.timing(reliefOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.delay(2200),
        Animated.timing(reliefOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) {
          setReliefIndex((i) => (i + 1) % RELIEF_LINES.length);
          cycle();
        }
      });
    };
    cycle();
  };

  // ── TRANSFORMATION ────────────────────────────────────────────────────────
  const handleStay = () => {
    // Stop all sad loops
    guiltActive.current = false;
    tearsActive.current = false;
    wobbleLoopRef.current?.stop();
    squintLoopRef.current?.stop();
    droopLoopRef.current?.stop();

    // Fade out tears & guilt
    tears.forEach((t) => {
      Animated.timing(t.opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    });
    Animated.timing(guiltOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();

    // Snap back to neutral
    Animated.timing(faceWobble, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    Animated.timing(eyeSquint,  { toValue: 1, duration: 200, useNativeDriver: true }).start();
    Animated.timing(mouthDroop, { toValue: 0, duration: 200, useNativeDriver: true }).start();

    // Flip mouth sad → happy
    Animated.spring(mouthRotation, {
      toValue: 1,
      tension: 80,
      friction: 6,
      useNativeDriver: true,
    }).start();

    // Face jump
    Animated.sequence([
      Animated.delay(200),
      Animated.spring(faceJump, { toValue: -22, tension: 100, friction: 4, useNativeDriver: true }),
      Animated.spring(faceJump, { toValue: 0, tension: 80, friction: 6, useNativeDriver: true }),
    ]).start();

    // Warm glow overlay
    Animated.timing(faceBgOpacity, { toValue: 1, duration: 400, delay: 150, useNativeDriver: true }).start();

    // Sparkles burst
    sparkles.forEach((s, i) => {
      Animated.sequence([
        Animated.delay(200 + i * 50),
        Animated.parallel([
          Animated.spring(s.scale, { toValue: 1, tension: 100, friction: 5, useNativeDriver: true }),
          Animated.timing(s.opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(s.rotate, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(s.scale, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(s.opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ]).start();
    });

    // Swap content
    setTimeout(() => {
      Animated.timing(sadContentOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      
      // Animate background sweeping up from bottom
      Animated.spring(bgTransitionY, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }).start();

      setTimeout(() => {
        setPhase("relieved");
        startReliefCycle();
        Animated.parallel([
          Animated.spring(happyContentY, { toValue: 0, tension: 70, friction: 8, useNativeDriver: true }),
          Animated.timing(happyContentOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]).start();
      }, 300);
    }, 800);
  };

  const handleGoHome = () => {
    navigation?.goBack();
  };

  // ── Delete ──
  const handleDelete = () => {
    setShowConfirmModal(true);
  };

  const confirmDelete = async () => {
    setShowConfirmModal(false);
    setDeleting(true);
    try {
      const { switchedToAccount, navigateToLanding } = await apiDeleteAccount();
      await AsyncStorage.multiRemove([
        "accessToken",
        "userData",
        "auth_token",
        "auth_email",
        "pending_otp",
      ]);

      let rootNavigator = navigation;
      if (navigation.getParent) {
        const parent = navigation.getParent();
        if (parent) rootNavigator = parent.getParent ? parent.getParent() : parent;
      }

      if (navigateToLanding || !switchedToAccount) {
        rootNavigator.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "DeleteConfirmation", params: { nextRoute: "Landing" } }],
          })
        );
      } else {
        const routeMap = {
          member: "MemberHome",
          community: "CommunityHome",
          sponsor: "SponsorHome",
          venue: "VenueHome",
        };
        const nextRouteName = routeMap[switchedToAccount.type] || "Landing";
        rootNavigator.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: "DeleteConfirmation", params: { nextRoute: nextRouteName } }],
          })
        );
      }
    } catch (e) {
      // We can use a simple modal or alert for error for now
      setTimeout(() => {
        Alert.alert("Delete failed", e?.message || "Could not delete account");
      }, 500);
    } finally {
      if (navigation.isFocused()) setDeleting(false);
    }
  };

  // ── Button press animations ───────────────────────────────────────────────
  const onStayPressIn  = () => Animated.spring(stayScale, { toValue: 0.95, useNativeDriver: true }).start();
  const onStayPressOut = () => Animated.spring(stayScale, { toValue: 1, tension: 80, friction: 4, useNativeDriver: true }).start();

  // ── Interpolations ────────────────────────────────────────────────────────
  const wobbleInterp = faceWobble.interpolate({
    inputRange: [-6, 6],
    outputRange: ["-6deg", "6deg"],
    extrapolate: "clamp",
  });

  // Mouth: sad=0deg (normal arch), happy=180deg (flipped arch)
  const mouthRotInterp = mouthRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle={phase === "relieved" ? "dark-content" : "light-content"} />

      {/* Dynamic Background */}
      <View style={StyleSheet.absoluteFillObject}>
        {/* === SAD (DARK) BACKGROUND === */}
        <View style={StyleSheet.absoluteFillObject}>
          <LinearGradient
            colors={["#0B0F19", "#1A1525", "#0F172A"]} // Deep dark moody background
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <LinearGradient colors={["#4C1D95", "#1E1B4B"]} style={{ position: "absolute", top: -width * 0.3, left: -width * 0.3, width: width * 0.9, height: width * 0.9, borderRadius: width * 0.45, opacity: 0.6, transform: [{ rotate: "25deg" }] }} />
            <LinearGradient colors={["#7F1D1D", "#450A0A"]} style={{ position: "absolute", bottom: -width * 0.2, right: -width * 0.3, width: width * 1.1, height: width * 1.1, borderRadius: width * 0.55, opacity: 0.5, transform: [{ rotate: "-15deg" }] }} />
            <LinearGradient colors={["#1E3A8A", "#0F172A"]} style={{ position: "absolute", top: height * 0.25, right: -width * 0.4, width: width * 0.8, height: width * 0.8, borderRadius: width * 0.4, opacity: 0.4, transform: [{ rotate: "45deg" }] }} />
          </View>
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(10, 15, 25, 0.75)" }]} pointerEvents="none" />
        </View>

        {/* === RELIEVED (LIGHT) BACKGROUND (ANIMATED FROM BOTTOM) === */}
        <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ translateY: bgTransitionY }] }]} pointerEvents="none">
          <LinearGradient
            colors={["#FFF5E6", "#FFE6E6", "#FFF0F5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <LinearGradient colors={["#FFD6A5", "#FF9F6A"]} style={{ position: "absolute", top: -width * 0.3, left: -width * 0.3, width: width * 0.9, height: width * 0.9, borderRadius: width * 0.45, opacity: 0.45, transform: [{ rotate: "25deg" }] }} />
            <LinearGradient colors={["#FFC8DD", "#FF6B8A"]} style={{ position: "absolute", bottom: -width * 0.2, right: -width * 0.3, width: width * 1.1, height: width * 1.1, borderRadius: width * 0.55, opacity: 0.35, transform: [{ rotate: "-15deg" }] }} />
            <LinearGradient colors={["#FFADAD", "#FFA07A"]} style={{ position: "absolute", top: height * 0.25, right: -width * 0.4, width: width * 0.8, height: width * 0.8, borderRadius: width * 0.4, opacity: 0.3, transform: [{ rotate: "45deg" }] }} />
          </View>
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(255, 255, 255, 0.45)" }]} pointerEvents="none" />
        </Animated.View>
      </View>

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.inner}>

          {/* ── Face ── */}
          <Animated.View
            style={[
              styles.faceWrapper,
              {
                transform: [
                  { scale: faceScale },
                  { rotate: wobbleInterp },
                  { translateY: faceJump },
                ],
              },
            ]}
          >
            <View style={styles.faceContainer}>
              {/* Sparkles */}
              {sparkles.map((s) => (
                <Animated.View
                  key={s.id}
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: 60 + s.dx - 8,
                    top: 60 + s.dy - 8,
                    width: 16,
                    height: 16,
                    opacity: s.opacity,
                    transform: [
                      { scale: s.scale },
                      { rotate: s.rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }) },
                    ],
                  }}
                >
                  <Text style={{ fontSize: 16 }}>✨</Text>
                </Animated.View>
              ))}

              {/* Face circle */}
              <LinearGradient
                colors={["#FFF1A0", "#FFCA28", "#E68A00"]}
                locations={[0.1, 0.6, 1]}
                start={{ x: 0.2, y: 0.1 }}
                end={{ x: 0.8, y: 0.9 }}
                style={styles.face}
              >
                {/* 3D Specular Highlight */}
                <View
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 22,
                    width: 32,
                    height: 14,
                    borderRadius: 10,
                    backgroundColor: "rgba(255, 255, 255, 0.55)",
                    transform: [{ rotate: "-35deg" }],
                  }}
                />

                {/* Warm glow overlay on happy */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    {
                      borderRadius: 60,
                      backgroundColor: "rgba(255, 200, 100, 0.25)",
                      opacity: faceBgOpacity,
                    },
                  ]}
                />

                {/* Eyes */}
                <View style={styles.eyeRow}>
                  <Animated.View style={[styles.eye, { transform: [{ scaleY: eyeSquint }] }]}>
                    {tears.slice(0, 3).map((t) => (
                      <Animated.View
                        key={t.id}
                        style={[styles.tear, {
                          opacity: t.opacity,
                          transform: [{ translateY: t.translateY }, { scale: t.scale }],
                        }]}
                      />
                    ))}
                  </Animated.View>
                  <Animated.View style={[styles.eye, { transform: [{ scaleY: eyeSquint }] }]}>
                    {tears.slice(3).map((t) => (
                      <Animated.View
                        key={t.id}
                        style={[styles.tear, {
                          opacity: t.opacity,
                          transform: [{ translateY: t.translateY }, { scale: t.scale }],
                        }]}
                      />
                    ))}
                  </Animated.View>
                </View>

                {/* Mouth — rotates from sad to happy */}
                <Animated.View
                  style={[
                    styles.mouth,
                    { transform: [{ rotate: mouthRotInterp }] },
                  ]}
                />
              </LinearGradient>
            </View>

            {/* Rotating text under face */}
            <View style={{ height: 48, justifyContent: "center", alignItems: "center" }}>
              {phase !== "relieved" ? (
                <Animated.Text style={[styles.guiltLine, { opacity: guiltOpacity, position: "absolute", color: "#E5E7EB" }]}>
                  {GUILT_LINES[guiltIndex]}
                </Animated.Text>
              ) : (
                <Animated.Text style={[styles.reliefLine, { opacity: reliefOpacity, position: "absolute" }]}>
                  {RELIEF_LINES[reliefIndex]}
                </Animated.Text>
              )}
            </View>
          </Animated.View>

          {/* ── SAD content ── */}
          {phase === "sad" && (
            <Animated.View
              style={[styles.copyBlock, {
                opacity: sadContentOpacity,
                transform: [{ translateY: sadContentY }],
              }]}
            >
              <Text style={[styles.headline, { color: "#FFFFFF" }]}>You're really leaving? 🫤</Text>
              <Text style={[styles.subtext, { color: "#9CA3AF" }]}>
                Deleting your account means losing your matches, events, and
                everything you've built on SnooSpace. Forever is a long time.
              </Text>
            </Animated.View>
          )}

          {/* ── HAPPY content ── */}
          {phase === "relieved" && (
            <Animated.View
              style={[styles.copyBlock, {
                opacity: happyContentOpacity,
                transform: [{ translateY: happyContentY }],
              }]}
            >
              <Text style={styles.headline}>We missed you already 🥹</Text>
              <Text style={styles.subtext}>
                Your space is still here. Your people are still waiting.
                Welcome back — we're so glad you stayed.
              </Text>
            </Animated.View>
          )}

          {/* ── SAD buttons ── */}
          {phase === "sad" && (
            <Animated.View style={[styles.buttons, {
              opacity: sadContentOpacity,
              transform: [{ translateY: sadContentY }],
            }]}>
              <Animated.View style={{ transform: [{ scale: stayScale }] }}>
                <TouchableOpacity
                  activeOpacity={1}
                  onPressIn={onStayPressIn}
                  onPressOut={onStayPressOut}
                  onPress={handleStay}
                  style={styles.stayButtonWrapper}
                  disabled={deleting}
                >
                  <LinearGradient
                    colors={["#448AFF", "#2962FF"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.stayButton}
                  >
                    <Text style={styles.stayButtonText}>Wait, I'll stay! 🤗</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={{ opacity: deleteOpacity }}>
                <TouchableOpacity
                  onPress={handleDelete}
                  activeOpacity={0.6}
                  style={styles.deleteButton}
                  disabled={deleting}
                >
                  <Text style={[styles.deleteButtonText, { color: "#FCA5A5" }]}>
                    {deleting ? "Deleting..." : "Yes, delete my account"}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          )}

          {/* ── HAPPY button ── */}
          {phase === "relieved" && (
            <Animated.View style={[styles.buttons, { opacity: happyContentOpacity }]}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleGoHome}
                style={[styles.stayButtonWrapper, { shadowColor: "#FF9F6A" }]}
              >
                <LinearGradient
                  colors={["#FF9F6A", "#FF6B8A"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.stayButton}
                >
                  <Text style={styles.stayButtonText}>Take me home 🏠</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}

        </View>
      </SafeAreaView>

      {/* ── Confirmation Modal ── */}
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
        statusBarTranslucent={true}
      >
        <TouchableWithoutFeedback onPress={() => setShowConfirmModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Wait! Are you absolutely sure?</Text>
                </View>
                <View style={styles.modalBody}>
                  <Text style={styles.modalSubtext}>
                    To confirm you want to lose everything forever, tap Delete below.
                  </Text>
                </View>
                <View style={styles.modalFooter}>
                  <TouchableOpacity 
                    style={styles.modalCancelButton} 
                    onPress={() => setShowConfirmModal(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.modalDeleteButton} 
                    onPress={confirmDelete}
                  >
                    <Text style={styles.modalDeleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EEF2FF" },
  safeArea: { flex: 1 },
  inner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 32,
  },

  // ── Face ──
  faceWrapper: { alignItems: "center", gap: 16 },
  faceContainer: { width: 120, height: 120 },
  face: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#D48B00",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
    gap: 12,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.45)", // adds an ambient rim light effect
  },
  eyeRow: { flexDirection: "row", gap: 22, marginTop: 12 },
  eye: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#333",
    alignItems: "center",
    overflow: "visible",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  tear: {
    position: "absolute",
    top: 14,
    width: 7,
    height: 10,
    borderRadius: 4,
    backgroundColor: "#7EC8E3",
  },
  mouth: {
    width: 36,
    height: 18,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderWidth: 3,
    borderColor: "#333",
    borderBottomWidth: 0,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 1.5,
    elevation: 2,
  },
  guiltLine: {
    fontSize: 16,
    color: "#4B5563",
    fontFamily: FONTS.medium,
    textAlign: "center",
    maxWidth: 260,
  },
  reliefLine: {
    fontSize: 16,
    color: "#F97316",
    fontFamily: FONTS.semiBold,
    textAlign: "center",
    maxWidth: 260,
  },

  // ── Copy ──
  copyBlock: { alignItems: "center", gap: 12 },
  headline: {
    fontSize: 28,
    fontFamily: FONTS.black,
    color: "#1A1A2E",
    textAlign: "center",
    letterSpacing: -0.8,
  },
  subtext: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 8,
  },

  // ── Buttons ──
  buttons: { width: "100%", gap: 14, alignItems: "center" },
  stayButtonWrapper: {
    width: width - 56,
    borderRadius: 16,
    shadowColor: "#448AFF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  stayButton: {
    height: 62,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  stayButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: FONTS.semiBold,
  },
  deleteButton: { paddingVertical: 10, paddingHorizontal: 16 },
  deleteButtonText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: "#D1534A",
    textDecorationLine: "underline",
    opacity: 0.8,
  },

  // ── Modal Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    width: "100%",
    maxWidth: 340,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  modalHeader: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 19,
    fontFamily: FONTS.bold, // BasicCommercialBold
    color: "#1A1A2E",
    textAlign: "center",
    lineHeight: 26,
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  modalSubtext: {
    fontSize: 15,
    fontFamily: FONTS.regular, // Manrope Regular
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
  },
  modalFooter: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#F3F4F6",
  },
  modalCancelText: {
    fontSize: 16,
    fontFamily: FONTS.medium, // Manrope Medium
    color: "#4B5563",
  },
  modalDeleteButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
  },
  modalDeleteText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold, // Manrope SemiBold
    color: "#FF3B30",
  },
});

export default DeleteAccountScreen;