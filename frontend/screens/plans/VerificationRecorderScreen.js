/**
 * VerificationRecorderScreen
 *
 * In-app camera recorder for face verification with liveness prompts.
 * Uses expo-camera's CameraView with recordAsync({ maxDuration: 12, quality: '1080p' }).
 * 
 * Features:
 *  - Front-camera default with mirror={false} (preserves natural face orientation for face matching)
 *  - Randomized liveness action and 4-digit code generated once on mount
 *  - Persistent prompt overlay above camera feed
 *  - Circular SVG countdown ring with color shift (green → amber → red)
 *  - Hard 12-second native cutoff
 *  - Calls route.params.onVideoRecorded(uri) on completion and navigates back
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
import { Square, X } from "lucide-react-native";
import HapticsService from "../../services/HapticsService";

const MAX_DURATION = 12; // seconds — hard limit for liveness verification
const { width: SCREEN_WIDTH } = Dimensions.get("window");

// SVG ring geometry
const RING_SIZE = 88;
const STROKE_WIDTH = 5;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const LIVENESS_ACTIONS = [
  "Turn your head slowly to the left",
  "Turn your head slowly to the right",
  "Nod your head twice",
  "Blink slowly three times",
];

function CountdownRing({ elapsed }) {
  const progress = Math.min(elapsed / MAX_DURATION, 1);
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  // Colour shifts: green → amber → red
  let ringColor = "#34C759";
  if (progress > 0.85) ringColor = "#FF3B30";
  else if (progress > 0.6) ringColor = "#FF9F0A";

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

export default function VerificationRecorderScreen({ navigation, route }) {
  const { onVideoRecorded, scope } = route.params || {};

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Generate liveness prompt once per screen mount (stable across re-renders)
  const [livenessAction] = useState(() => {
    const idx = Math.floor(Math.random() * LIVENESS_ACTIONS.length);
    return LIVENESS_ACTIONS[idx];
  });

  const [livenessCode] = useState(() => {
    return String(Math.floor(1000 + Math.random() * 9000));
  });

  const cameraRef = useRef(null);
  const timerRef = useRef(null);
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

  // ── Hand the URI back to VerificationSubmitScreen ───────────────────────────
  const handleVideoReady = useCallback(
    (uri) => {
      if (onVideoRecorded) {
        onVideoRecorded(uri, scope);
      }
      navigation.goBack();
    },
    [onVideoRecorded, scope, navigation]
  );

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
      const video = await cameraRef.current.recordAsync({
        maxDuration: MAX_DURATION,
        quality: "1080p",
      });

      if (video?.uri) {
        handleVideoReady(video.uri);
      }
    } catch (err) {
      console.error("[VerificationRecorder] recordAsync error:", err);
    }
  }, [isRecording, handleVideoReady]);

  // ── Stop recording ──────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;

    clearInterval(timerRef.current);
    setIsRecording(false);
    HapticsService.triggerImpactLight?.();

    cameraRef.current?.stopRecording();
  }, []);

  // ── Permissions Gate ────────────────────────────────────────────────────────
  if (!cameraPermission || !micPermission) {
    return <View style={styles.container} />;
  }

  if (!cameraPermission.granted || !micPermission.granted) {
    return (
      <SafeAreaView style={styles.permContainer} edges={["top", "bottom"]}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <Text style={styles.permTitle}>Camera & Microphone Access</Text>
        <Text style={styles.permBody}>
          We need access to your camera and microphone to record your verification
          video and confirm liveness.
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

      {/* ── Camera feed (front-facing selfie, unmirrored) ────────────────── */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
        mirror={false}
        mode="video"
      />

      {/* ── Overlay UI ──────────────────────────────────────────────────── */}
      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        {/* Top bar */}
        <View style={styles.topBar}>
          {!isRecording ? (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.goBack()}
              hitSlop={10}
            >
              <X size={22} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconBtnPlaceholder} />
          )}

          {isRecording ? (
            <View style={styles.recBadge}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>REC</Text>
            </View>
          ) : (
            <View style={styles.standbyBadge}>
              <Text style={styles.standbyText}>VERIFY</Text>
            </View>
          )}

          <View style={[styles.timePill, remaining <= 4 && styles.timePillUrgent]}>
            <Text style={[styles.timeText, remaining <= 4 && styles.timeTextUrgent]}>
              {remaining}s left
            </Text>
          </View>
        </View>

        {/* ── Liveness Prompt Card (Persistent Overlay) ─────────────────── */}
        <View style={styles.promptContainer}>
          <View style={styles.promptCard}>
            <Text style={styles.promptInstruction}>
              Say the code below out loud, then:
            </Text>
            <Text style={styles.promptAction}>{livenessAction}</Text>
            <View style={styles.codeContainer}>
              <Text style={styles.codeText}>{livenessCode}</Text>
            </View>
          </View>
        </View>

        {/* ── Pre-recording Guidance (idle only) ─────────────────────────── */}
        {!isRecording && (
          <View style={styles.guidancePillContainer}>
            <View style={styles.guidancePill}>
              <Text style={styles.guidancePillText}>
                Remove sunglasses and hats, and make sure your face is well-lit before you start.
              </Text>
            </View>
          </View>
        )}

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* ── Bottom Controls ───────────────────────────────────────────── */}
        <View style={styles.bottomBar}>
          {/* Elapsed counter */}
          <View style={styles.elapsedBox}>
            <Text style={styles.elapsedText}>{formatTime(elapsed)}</Text>
          </View>

          {/* Capture / Stop Button with SVG Countdown Ring */}
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

          {/* Spacer to balance bottom row since front camera is fixed */}
          <View style={styles.elapsedBox} />
        </View>

        {/* Hint label when idle */}
        {!isRecording && (
          <Text style={styles.hint}>Tap to start · 12-second verification</Text>
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

  // ── Top Bar ──────────────────────────────────────────────────────────────
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
  standbyBadge: {
    backgroundColor: "rgba(41, 98, 255, 0.45)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  standbyText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 12,
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  timePill: {
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  timePillUrgent: {
    backgroundColor: "rgba(255,59,48,0.85)",
  },
  timeText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  timeTextUrgent: {
    color: "#FFFFFF",
  },

  // ── Liveness Prompt Overlay ──────────────────────────────────────────────
  promptContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    alignItems: "center",
  },
  promptCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "rgba(18, 24, 38, 0.85)",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  promptInstruction: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.75)",
    textAlign: "center",
    marginBottom: 4,
  },
  promptAction: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 15,
    color: "#FFD600",
    textAlign: "center",
    marginBottom: 10,
  },
  codeContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 22,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  codeText: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 28,
    color: "#FFFFFF",
    letterSpacing: 6,
  },

  // ── Bottom Controls ──────────────────────────────────────────────────────
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

  // ── Capture Button / Ring ────────────────────────────────────────────────
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

  // ── Pre-recording Guidance Pill ──────────────────────────────────────────
  guidancePillContainer: {
    paddingHorizontal: 24,
    paddingTop: 10,
    alignItems: "center",
  },
  guidancePill: {
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    maxWidth: 340,
  },
  guidancePillText: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    lineHeight: 17,
  },

  // ── Permissions Gate ─────────────────────────────────────────────────────
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
