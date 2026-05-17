/**
 * AccountSwitchOverlay
 * Renders at the App root level so it appears INSTANTLY over any screen
 * when a double-tap account switch is initiated.
 *
 * Flow:
 *  account-switch-start → full-screen skeleton covers screen immediately (no delay)
 *  account-switch-done  → toast springs in, skeleton fades out after short hold
 */
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import EventBus from "../../utils/EventBus";

const { width } = Dimensions.get("window");

// ── Shimmer block ─────────────────────────────────────────────────────────────
const AnimatedLG = Animated.createAnimatedComponent(LinearGradient);

const Shimmer = ({ w, h, style }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-w, w],
  });

  return (
    <View style={[{ width: w, height: h, backgroundColor: "#EFEFEF", overflow: "hidden", borderRadius: 8 }, style]}>
      <AnimatedLG
        colors={["transparent", "rgba(255,255,255,0.65)", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}
      />
    </View>
  );
};

// ── Single skeleton post card ─────────────────────────────────────────────────
const SkeletonPost = () => (
  <View style={sk.card}>
    {/* Header row */}
    <View style={sk.header}>
      <Shimmer w={40} h={40} style={{ borderRadius: 20 }} />
      <View style={sk.headerText}>
        <Shimmer w={130} h={13} style={{ marginBottom: 6 }} />
        <Shimmer w={80} h={11} />
      </View>
    </View>
    {/* Image block */}
    <Shimmer w={width} h={260} style={{ borderRadius: 0 }} />
    {/* Actions row */}
    <View style={sk.footer}>
      <Shimmer w={110} h={18} />
    </View>
    {/* Caption lines */}
    <View style={sk.caption}>
      <Shimmer w={width - 40} h={13} style={{ marginBottom: 8 }} />
      <Shimmer w={width - 80} h={13} />
    </View>
  </View>
);

const sk = StyleSheet.create({
  card: { backgroundColor: "#FFF", marginBottom: 16, paddingBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  headerText: { flex: 1 },
  footer: { paddingHorizontal: 16, paddingVertical: 10 },
  caption: { paddingHorizontal: 16 },
});

// ── Main overlay component ────────────────────────────────────────────────────
const AccountSwitchOverlay = () => {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [toastData, setToastData] = useState(null);

  // Overlay opacity (skeleton background)
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  // Toast slide + fade
  const toastY = useRef(new Animated.Value(-70)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const offStart = EventBus.on("account-switch-start", () => {
      setToastData(null);
      setVisible(true);
      // Show skeleton INSTANTLY — no animation delay
      overlayOpacity.setValue(1);
    });

    const offDone = EventBus.on("account-switch-done", (data) => {
      // 1. Spring in the toast first
      setToastData(data);
      toastY.setValue(-70);
      toastOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.spring(toastY, {
          toValue: 0,
          tension: 90,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();

      // 2. After a short hold, fade the skeleton out (reveals the new home screen)
      setTimeout(() => {
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }).start(() => setVisible(false));
      }, 600);

      // 3. Auto-dismiss toast after 3s
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(toastOpacity, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(toastY, {
            toValue: -40,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start(() => setToastData(null));
      }, 3500);
    });

    return () => {
      offStart();
      offDone();
    };
  }, []);

  if (!visible && !toastData) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* ── Skeleton overlay ── */}
      {visible && (
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { opacity: overlayOpacity, backgroundColor: "#FFFFFF" }]}
        >
          <View style={{ paddingTop: insets.top + 56 }}>
            <SkeletonPost />
            <SkeletonPost />
          </View>
        </Animated.View>
      )}

      {/* ── Toast ── */}
      {toastData && (
        <Animated.View
          style={[
            styles.toast,
            {
              top: insets.top + 12,
              opacity: toastOpacity,
              transform: [{ translateY: toastY }],
            },
          ]}
        >
          {toastData.photoUrl ? (
            <Image source={{ uri: toastData.photoUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback} />
          )}
          <Text style={styles.label} numberOfLines={1}>
            Switched to{" "}
            <Text style={styles.username}>
              {toastData.username ? `@${toastData.username}` : toastData.name}
            </Text>
          </Text>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    // Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 10,
    // Hairline border
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.08)",
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EFEFEF",
  },
  label: {
    flex: 1,
    fontFamily: "Manrope-Medium",
    fontSize: 14,
    color: "#333333",
    letterSpacing: -0.1,
  },
  username: {
    fontFamily: "Manrope-SemiBold",
    color: "#111111",
  },
});

export default AccountSwitchOverlay;
