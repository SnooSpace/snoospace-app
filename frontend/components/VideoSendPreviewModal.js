import React, { useState, useEffect } from "react";
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  Dimensions, StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import { Volume2, VolumeX, X, Send } from "lucide-react-native";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

/**
 * VideoSendPreviewModal
 *
 * Shows a full-screen preview of a local video before it is sent in chat.
 * The user can toggle audio on/off. The chosen preference is returned via onSend.
 *
 * Props:
 *   visible      - boolean
 *   videoUri     - local file URI of the video
 *   duration     - duration in seconds (optional)
 *   onClose      - () => void  – called when user cancels
 *   onSend       - ({ muteAudio: boolean }) => void – called when user taps Send
 */
export default function VideoSendPreviewModal({ visible, videoUri, duration, onClose, onSend }) {
  const insets = useSafeAreaInsets();
  const [muteAudio, setMuteAudio] = useState(false);

  const player = useVideoPlayer(videoUri || null, (p) => {
    p.loop = true;
    p.muted = muteAudio;
  });

  // Sync mute state into the player whenever it changes
  useEffect(() => {
    if (player) player.muted = muteAudio;
  }, [muteAudio, player]);

  // Play when visible, pause when hidden
  useEffect(() => {
    if (!player) return;
    if (visible) {
      player.play();
    } else {
      player.pause();
      setMuteAudio(false); // reset to default for next open
    }
  }, [visible, player]);

  const formatDur = (sec) => {
    if (!sec) return null;
    const s = Math.round(sec);
    return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `0:${String(s).padStart(2, "0")}`;
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent={false} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.container}>

        {/* ── Video ── */}
        <VideoView
          player={player}
          style={styles.video}
          allowsFullscreen={false}
          allowsPictureInPicture={false}
          nativeControls={false}
          contentFit="contain"
        />

        {/* ── Top bar ── */}
        <View style={[styles.topBar, { top: insets.top + 10 }]}>
          <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
            <X size={22} color="#FFF" strokeWidth={2.5} />
          </TouchableOpacity>

          <Text style={styles.titleText}>Preview</Text>

          {/* Audio toggle */}
          <TouchableOpacity
            style={[styles.iconBtn, muteAudio && styles.iconBtnActive]}
            onPress={() => setMuteAudio(v => !v)}
          >
            {muteAudio
              ? <VolumeX size={22} color="#FFF" strokeWidth={2.5} />
              : <Volume2 size={22} color="#FFF" strokeWidth={2.5} />
            }
          </TouchableOpacity>
        </View>

        {/* ── Duration badge ── */}
        {duration != null && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDur(duration)}</Text>
          </View>
        )}

        {/* ── Bottom action bar ── */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          {/* Audio label hint */}
          <View style={styles.audioHint}>
            {muteAudio
              ? <VolumeX size={16} color="rgba(255,255,255,0.7)" strokeWidth={2} />
              : <Volume2 size={16} color="rgba(255,255,255,0.7)" strokeWidth={2} />
            }
            <Text style={styles.audioHintText}>
              {muteAudio ? "Will send without audio" : "Will send with audio"}
            </Text>
          </View>

          {/* Send button */}
          <TouchableOpacity
            style={styles.sendBtn}
            activeOpacity={0.85}
            onPress={() => onSend({ muteAudio })}
          >
            <Text style={styles.sendBtnText}>Send</Text>
            <Send size={18} color="#FFF" strokeWidth={2.5} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
  },
  video: {
    width: SCREEN_W,
    height: SCREEN_H,
  },

  // ── Top bar
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 10,
  },
  titleText: {
    color: "#FFF",
    fontFamily: "Manrope-SemiBold",
    fontSize: 16,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnActive: {
    backgroundColor: "rgba(255,80,80,0.55)",
  },

  // ── Duration
  durationBadge: {
    position: "absolute",
    bottom: 130,
    left: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  durationText: {
    color: "#FFF",
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
  },

  // ── Bottom bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 16,
    paddingHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  audioHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  audioHintText: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: "Manrope-Regular",
    fontSize: 13,
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3565F2",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 28,
    gap: 6,
  },
  sendBtnText: {
    color: "#FFF",
    fontFamily: "Manrope-SemiBold",
    fontSize: 16,
  },
});
