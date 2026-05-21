/**
 * ChallengeVideoRecorderScreen
 *
 * Full-screen camera recorder for challenge video submissions.
 * Uses expo-camera's recordAsync({ maxDuration: 60 }) which enforces
 * a hard 60-second cutoff on both iOS and Android — unlike
 * expo-image-picker's videoMaxDuration which is Android-advisory only.
 *
 * Features:
 *  - Circular SVG countdown ring (fills as time elapses)
 *  - MM:SS elapsed timer
 *  - Front / back camera flip
 *  - Auto-stops and returns the URI when 60 s elapses
 *  - User can stop early by tapping the stop button
 */

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import Svg, { Circle } from "react-native-svg";
import { RotateCcw, Square, X } from "lucide-react-native";
import HapticsService from "../../services/HapticsService";

const MAX_DURATION = 60; // seconds — hard limit
const { width: SCREEN_WIDTH } = Dimensions.get("window");

// SVG ring geometry
const RING_SIZE = 88;
const STROKE_WIDTH = 5;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function CountdownRing({ elapsed }) {
  const progress = Math.min(elapsed / MAX_DURATION, 1);
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  // Colour shifts: green → amber → red
  let ringColor = "#34C759";
  if (progress > 0.85) ringColor = "#FF3B30";
  else if (progress > 0.65) ringColor = "#FF9F0A";

  return (
    <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ring}>
      {/* Track */}
      <Circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RADIUS}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={STROKE_WIDTH}
        fill="none"
      />
      {/* Progress */}
      <Circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RADIUS}
        stroke={ringColor}
        strokeWidth={STROKE_WIDTH}
        fill="none"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
      />
    </Svg>
  );
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ChallengeVideoRecorderScreen({ navigation, route }) {
  const { onVideoRecorded } = route.params || {};

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const [facing, setFacing] = useState("back");
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const cameraRef = useRef(null);
  const timerRef = useRef(null);
  // Guard against calling stopRecording twice (auto-stop vs user tap racing)
  const stoppingRef = useRef(false);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
    };
  }, []);

  // ── Auto-stop when elapsed hits MAX_DURATION ────────────────────────────────
  useEffect(() => {
    if (elapsed >= MAX_DURATION && isRecording) {
      stopRecording();
    }
  }, [elapsed, isRecording]);

  // ── Start recording ─────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!cameraRef.current || isRecording) return;

    stoppingRef.current = false;
    setElapsed(0);
    setIsRecording(true);
    HapticsService.triggerImpactMedium?.();

    // Ticker — increments elapsed every second
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    try {
      // recordAsync resolves when stopRecording() is called OR maxDuration elapses.
      // maxDuration is the authoritative hard cutoff at the native layer.
      const video = await cameraRef.current.recordAsync({
        maxDuration: MAX_DURATION,
        quality: "1080p",
      });

      // video.uri is available here regardless of whether we stopped manually
      // or the native layer cut us off automatically.
      if (video?.uri) {
        handleVideoReady(video.uri);
      }
    } catch (err) {
      console.error("[ChallengeVideoRecorder] recordAsync error:", err);
    }
  }, [isRecording]);

  // ── Stop recording ──────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;

    clearInterval(timerRef.current);
    setIsRecording(false);
    HapticsService.triggerImpactLight?.();

    cameraRef.current?.stopRecording();
    // recordAsync promise (in startRecording) will now resolve with the URI.
  }, []);

  // ── Hand the URI back to ChallengeSubmitScreen ─────────────────────────────
  const handleVideoReady = useCallback(
    (uri) => {
      if (onVideoRecorded) {
        onVideoRecorded(uri);
      }
      navigation.goBack();
    },
    [onVideoRecorded, navigation]
  );

  // ── Permissions ─────────────────────────────────────────────────────────────
  if (!cameraPermission || !micPermission) {
    return <View style={styles.container} />;
  }

  if (!cameraPermission.granted || !micPermission.granted) {
    return (
      <SafeAreaView style={styles.permContainer} edges={["top", "bottom"]}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <Text style={styles.permTitle}>Camera & Microphone Access</Text>
        <Text style={styles.permBody}>
          We need access to your camera and microphone to record your challenge
          video.
        </Text>
        <TouchableOpacity
          style={styles.permBtn}
          onPress={async () => {
            if (!cameraPermission.granted) await requestCameraPermission();
            if (!micPermission.granted) await requestMicPermission();
          }}
        >
          <Text style={styles.permBtnText}>Grant Access</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.permCancel}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.permCancelText}>Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const remaining = MAX_DURATION - elapsed;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* ── Camera feed ─────────────────────────────────────────────────────── */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode="video"
      />

      {/* ── Overlay UI ──────────────────────────────────────────────────────── */}
      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        {/* Top bar */}
        <View style={styles.topBar}>
          {/* Close — only visible when not recording */}
          {!isRecording ? (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.goBack()}
            >
              <X size={22} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconBtnPlaceholder} />
          )}

          {/* Live badge */}
          {isRecording && (
            <View style={styles.recBadge}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>REC</Text>
            </View>
          )}

          {/* Remaining time pill */}
          <View style={[styles.timePill, remaining <= 10 && styles.timePillUrgent]}>
            <Text style={[styles.timeText, remaining <= 10 && styles.timeTextUrgent]}>
              {remaining}s left
            </Text>
          </View>
        </View>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Bottom controls */}
        <View style={styles.bottomBar}>
          {/* Elapsed display */}
          <View style={styles.elapsedBox}>
            <Text style={styles.elapsedText}>{formatTime(elapsed)}</Text>
          </View>

          {/* Ring + record / stop button */}
          <View style={styles.captureWrapper}>
            {isRecording && <CountdownRing elapsed={elapsed} />}

            <TouchableOpacity
              style={[styles.captureBtn, isRecording && styles.captureBtnActive]}
              onPress={isRecording ? stopRecording : startRecording}
              activeOpacity={0.8}
            >
              {isRecording ? (
                <Square size={28} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
              ) : (
                <View style={styles.recordDot} />
              )}
            </TouchableOpacity>
          </View>

          {/* Flip camera — disabled while recording */}
          <TouchableOpacity
            style={[styles.iconBtn, isRecording && styles.iconBtnDisabled]}
            disabled={isRecording}
            onPress={() =>
              setFacing((f) => (f === "back" ? "front" : "back"))
            }
          >
            <RotateCcw size={24} color={isRecording ? "rgba(255,255,255,0.3)" : "#FFFFFF"} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Hint label when idle */}
        {!isRecording && (
          <Text style={styles.hint}>Tap to start · Max 60 seconds</Text>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  // ── Overlay ──────────────────────────────────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },

  // ── Top bar ──────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 12 : 4,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnPlaceholder: {
    width: 40,
    height: 40,
  },
  iconBtnDisabled: {
    opacity: 0.4,
  },
  recBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF3B30",
  },
  recText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: 1.2,
  },
  timePill: {
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  timePillUrgent: {
    backgroundColor: "rgba(255,59,48,0.8)",
  },
  timeText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  timeTextUrgent: {
    color: "#FFFFFF",
  },

  // ── Bottom bar ───────────────────────────────────────────────────────────
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === "android" ? 20 : 8,
  },
  elapsedBox: {
    width: 60,
    alignItems: "flex-start",
  },
  elapsedText: {
    fontFamily: "Manrope-Medium",
    fontSize: 16,
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.5,
  },

  // ── Capture button / ring ────────────────────────────────────────────────
  captureWrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
  },
  captureBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.5)",
    // Shadow
    shadowColor: "#FF3B30",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  captureBtnActive: {
    backgroundColor: "#1C1C1E",
    borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#000",
    shadowOpacity: 0.3,
  },
  recordDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FF3B30",
  },

  // ── Hint ─────────────────────────────────────────────────────────────────
  hint: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    paddingBottom: 10,
  },

  // ── Permissions ──────────────────────────────────────────────────────────
  permContainer: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  permTitle: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 22,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
  },
  permBody: {
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  permBtn: {
    backgroundColor: "#2962FF",
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 28,
    marginBottom: 16,
  },
  permBtnText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  permCancel: {
    padding: 12,
  },
  permCancelText: {
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.45)",
  },
});
