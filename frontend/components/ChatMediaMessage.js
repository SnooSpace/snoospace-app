import React, { useState, useCallback } from "react";
import {
  View, Text, Image, TouchableOpacity, Modal, Pressable,
  StyleSheet, Dimensions, Platform, ActivityIndicator,
} from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
  useAnimatedGestureHandler, runOnJS, interpolate, Extrapolate,
} from "react-native-reanimated";
import {
  PinchGestureHandler, PanGestureHandler, GestureHandlerRootView,
  State,
} from "react-native-gesture-handler";
import { VideoView, useVideoPlayer } from "expo-video";
import { Play, X, Film, Image as ImageIcon } from "lucide-react-native";

// ── Constants ─────────────────────────────────────────────────────────────────
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const BUBBLE_MAX_W = Math.min(SCREEN_W * 0.68, 260);
const BUBBLE_H     = 200;
const OUTGOING_BG  = "#E6F0FF";
const INCOMING_BG  = "#FFFFFF";
const INCOMING_BD  = "#E6ECF5";
const ACCENT       = "#3565F2";
const DELETED_COLOR = "#A0A0A0";

// ── FullScreenImageViewer ─────────────────────────────────────────────────────
// Instagram-style: pinch-to-zoom, double-tap to zoom, swipe-down to dismiss.
// Built entirely with react-native-reanimated + gesture-handler (no extra deps).
function FullScreenImageViewer({ uri, visible, onClose }) {
  const scale      = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX     = useSharedValue(0);
  const savedY     = useSharedValue(0);
  const bgOpacity  = useSharedValue(1);
  const lastTap    = useSharedValue(0);

  const reset = useCallback(() => {
    scale.value      = withSpring(1,  { damping: 20, stiffness: 300 });
    translateX.value = withSpring(0,  { damping: 20, stiffness: 300 });
    translateY.value = withSpring(0,  { damping: 20, stiffness: 300 });
    savedScale.value = 1;
    savedX.value     = 0;
    savedY.value     = 0;
    bgOpacity.value  = withTiming(1);
  }, []);

  // Pinch-to-zoom handler
  const pinchHandler = useAnimatedGestureHandler({
    onStart: () => {
      savedScale.value = scale.value;
    },
    onActive: (e) => {
      scale.value = Math.max(0.5, Math.min(savedScale.value * e.scale, 5));
    },
    onEnd: () => {
      if (scale.value < 1) {
        scale.value      = withSpring(1, { damping: 20, stiffness: 300 });
        translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
        savedScale.value = 1;
      } else {
        savedScale.value = scale.value;
      }
    },
  });

  // Pan handler: allows moving zoomed image + swipe-down-to-dismiss at 1x
  const panHandler = useAnimatedGestureHandler({
    onStart: () => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    },
    onActive: (e) => {
      if (scale.value <= 1) {
        // Swipe-down-to-dismiss
        const dy = Math.max(0, e.translationY);
        translateY.value = dy;
        bgOpacity.value = interpolate(dy, [0, 300], [1, 0], Extrapolate.CLAMP);
      } else {
        translateX.value = savedX.value + e.translationX;
        translateY.value = savedY.value + e.translationY;
      }
    },
    onEnd: (e) => {
      if (scale.value <= 1) {
        if (translateY.value > 120 || Math.abs(e.velocityY) > 800) {
          bgOpacity.value  = withTiming(0, { duration: 200 });
          translateY.value = withTiming(SCREEN_H, { duration: 250 }, () => {
            runOnJS(onClose)();
            runOnJS(reset)();
          });
        } else {
          translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
          bgOpacity.value  = withTiming(1);
        }
      } else {
        // Clamp pan within image bounds
        const maxX = (SCREEN_W  * (scale.value - 1)) / 2;
        const maxY = (SCREEN_H  * (scale.value - 1)) / 2;
        translateX.value = withSpring(
          Math.max(-maxX, Math.min(maxX, translateX.value)),
          { damping: 20, stiffness: 300 },
        );
        translateY.value = withSpring(
          Math.max(-maxY, Math.min(maxY, translateY.value)),
          { damping: 20, stiffness: 300 },
        );
      }
    },
  });

  const imageAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale:      scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const bgAnimStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(0,0,0,${bgOpacity.value})`,
  }));

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, bgAnimStyle]}>
          {/* Close button */}
          <TouchableOpacity
            style={viewerStyles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={24} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>

          {/* Pinch + Pan composed */}
          <PanGestureHandler onGestureEvent={panHandler}>
            <Animated.View style={StyleSheet.absoluteFill}>
              <PinchGestureHandler onGestureEvent={pinchHandler}>
                <Animated.View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
                  <Animated.Image
                    source={{ uri }}
                    style={[{ width: SCREEN_W, height: SCREEN_H }, imageAnimStyle]}
                    resizeMode="contain"
                  />
                </Animated.View>
              </PinchGestureHandler>
            </Animated.View>
          </PanGestureHandler>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ── FullScreenVideoViewer ─────────────────────────────────────────────────────
// Clean fullscreen video player using the modern expo-video.
function FullScreenVideoViewer({ uri, visible, onClose }) {
  const player = useVideoPlayer(uri, player => {
    player.loop = false;
    player.play();
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={viewerStyles.videoContainer}>
        <TouchableOpacity style={viewerStyles.closeBtn} onPress={onClose}>
          <X size={24} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>
        <VideoView
          player={player}
          style={{ width: SCREEN_W, height: SCREEN_H }}
          allowsFullscreen
          allowsPictureInPicture
          nativeControls
        />
      </View>
    </Modal>
  );
}

// ── UploadProgressOverlay ─────────────────────────────────────────────────────
// Circular arc-style upload progress on top of the thumbnail.
function UploadProgressOverlay({ progress = 0 }) {
  const pct = Math.round(progress * 100);
  return (
    <View style={overlayStyles.container}>
      <View style={overlayStyles.pill}>
        <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
        <Text style={overlayStyles.text}>{pct}%</Text>
      </View>
    </View>
  );
}

// ── ChatMediaMessage ──────────────────────────────────────────────────────────
/**
 * Renders an image or video message bubble inside the chat.
 *
 * Props:
 *   message        – full message object ({ messageType, metadata, messageText, isDeleted, ... })
 *   isMyMessage    – boolean, controls alignment
 *   uploadProgress – 0–1 for in-progress sends, null otherwise
 */
export default function ChatMediaMessage({ message, isMyMessage, uploadProgress = null }) {
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [videoViewerVisible, setVideoViewerVisible] = useState(false);
  const [thumbError,         setThumbError]         = useState(false);

  const { messageType, metadata, messageText, isDeleted } = message;
  const isUploading = uploadProgress !== null && uploadProgress < 1;

  // ── Deleted state ──────────────────────────────────────────────────────────
  if (isDeleted) {
    return (
      <View style={[
        bubbleStyles.wrapper,
        isMyMessage ? bubbleStyles.wrapperRight : bubbleStyles.wrapperLeft,
      ]}>
        <View style={[
          bubbleStyles.deletedBubble,
          isMyMessage ? bubbleStyles.myDeletedBubble : bubbleStyles.otherDeletedBubble,
        ]}>
          {messageType === "video"
            ? <Film size={13} color={DELETED_COLOR} strokeWidth={2} style={{ marginRight: 5 }} />
            : <ImageIcon size={13} color={DELETED_COLOR} strokeWidth={2} style={{ marginRight: 5 }} />
          }
          <Text style={bubbleStyles.deletedText}>
            {messageType === "video" ? "Video was removed" : "Photo was removed"}
          </Text>
        </View>
      </View>
    );
  }

  const mediaUrl      = metadata?.url || null;
  const thumbnailUrl  = metadata?.thumbnail_url || mediaUrl;
  const duration      = metadata?.duration ? Math.round(metadata.duration) : null;

  // ── Image bubble ───────────────────────────────────────────────────────────
  if (messageType === "image") {
    return (
      <>
        <View style={[
          bubbleStyles.wrapper,
          isMyMessage ? bubbleStyles.wrapperRight : bubbleStyles.wrapperLeft,
        ]}>
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => { if (mediaUrl && !isUploading) setImageViewerVisible(true); }}
            style={[
              bubbleStyles.mediaBubble,
              isMyMessage ? bubbleStyles.myBubble : bubbleStyles.otherBubble,
            ]}
          >
            {thumbError || !mediaUrl ? (
              <View style={bubbleStyles.errorThumb}>
                <ImageIcon size={28} color="#B0BEC5" strokeWidth={1.5} />
              </View>
            ) : (
              <Image
                source={{ uri: mediaUrl }}
                style={bubbleStyles.thumb}
                resizeMode="cover"
                onError={() => setThumbError(true)}
              />
            )}
            {isUploading && <UploadProgressOverlay progress={uploadProgress} />}
          </TouchableOpacity>

          {/* Optional caption */}
          {!!messageText && (
            <View style={[
              bubbleStyles.captionBubble,
              isMyMessage ? bubbleStyles.myCaptionBubble : bubbleStyles.otherCaptionBubble,
            ]}>
              <Text style={[
                bubbleStyles.captionText,
                isMyMessage ? bubbleStyles.myCaptionText : bubbleStyles.otherCaptionText,
              ]}>
                {messageText}
              </Text>
            </View>
          )}
        </View>

        <FullScreenImageViewer
          uri={mediaUrl}
          visible={imageViewerVisible}
          onClose={() => setImageViewerVisible(false)}
        />
      </>
    );
  }

  // ── Video bubble ───────────────────────────────────────────────────────────
  if (messageType === "video") {
    return (
      <>
        <View style={[
          bubbleStyles.wrapper,
          isMyMessage ? bubbleStyles.wrapperRight : bubbleStyles.wrapperLeft,
        ]}>
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => { if (mediaUrl && !isUploading) setVideoViewerVisible(true); }}
            style={[
              bubbleStyles.mediaBubble,
              isMyMessage ? bubbleStyles.myBubble : bubbleStyles.otherBubble,
            ]}
          >
            {/* Thumbnail — use Cloudinary thumbnail_url or fallback */}
            {thumbnailUrl && !thumbError ? (
              <Image
                source={{ uri: thumbnailUrl }}
                style={bubbleStyles.thumb}
                resizeMode="cover"
                onError={() => setThumbError(true)}
              />
            ) : (
              <View style={[bubbleStyles.thumb, bubbleStyles.videoPlaceholder]}>
                <Film size={32} color="rgba(255,255,255,0.6)" strokeWidth={1.5} />
              </View>
            )}

            {/* Play button overlay */}
            {!isUploading && (
              <View style={bubbleStyles.playOverlay}>
                <View style={bubbleStyles.playCircle}>
                  <Play size={20} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
                </View>
              </View>
            )}

            {/* Duration badge */}
            {duration !== null && !isUploading && (
              <View style={bubbleStyles.durationBadge}>
                <Text style={bubbleStyles.durationText}>
                  {duration >= 60
                    ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`
                    : `0:${String(duration).padStart(2, "0")}`}
                </Text>
              </View>
            )}

            {isUploading && <UploadProgressOverlay progress={uploadProgress} />}
          </TouchableOpacity>

          {/* Optional caption */}
          {!!messageText && (
            <View style={[
              bubbleStyles.captionBubble,
              isMyMessage ? bubbleStyles.myCaptionBubble : bubbleStyles.otherCaptionBubble,
            ]}>
              <Text style={[
                bubbleStyles.captionText,
                isMyMessage ? bubbleStyles.myCaptionText : bubbleStyles.otherCaptionText,
              ]}>
                {messageText}
              </Text>
            </View>
          )}
        </View>

        <FullScreenVideoViewer
          uri={mediaUrl}
          visible={videoViewerVisible}
          onClose={() => setVideoViewerVisible(false)}
        />
      </>
    );
  }

  return null;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const viewerStyles = StyleSheet.create({
  closeBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 24,
    right: 16,
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  videoContainer: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
});

const overlayStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  text: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
  },
});

const bubbleStyles = StyleSheet.create({
  wrapper:       { marginBottom: 2 },
  wrapperRight:  { alignItems: "flex-end" },
  wrapperLeft:   { alignItems: "flex-start" },

  mediaBubble: {
    width:        BUBBLE_MAX_W,
    height:       BUBBLE_H,
    borderRadius: 18,
    overflow:     "hidden",
  },
  myBubble: {
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    borderBottomLeftRadius:  4,
    borderWidth:  1,
    borderColor:  INCOMING_BD,
  },

  thumb: {
    width:  "100%",
    height: "100%",
  },

  videoPlaceholder: {
    backgroundColor: "#1a1a2e",
    alignItems:      "center",
    justifyContent:  "center",
  },

  // Play button
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems:      "center",
    justifyContent:  "center",
  },
  playCircle: {
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems:      "center",
    justifyContent:  "center",
    // nudge play icon to look centered
    paddingLeft:     3,
  },

  // Duration badge (Instagram-style, bottom-right)
  durationBadge: {
    position:        "absolute",
    bottom:          8,
    right:           8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius:    6,
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  durationText: {
    fontFamily: "Manrope-SemiBold",
    fontSize:   11,
    color:      "#FFFFFF",
  },

  // Error state
  errorThumb: {
    width:           "100%",
    height:          "100%",
    backgroundColor: "#F0F4F8",
    alignItems:      "center",
    justifyContent:  "center",
  },

  // Caption
  captionBubble: {
    maxWidth:      BUBBLE_MAX_W,
    borderRadius:  16,
    paddingHorizontal: 12,
    paddingVertical:    8,
    marginTop:     2,
  },
  myCaptionBubble: {
    backgroundColor:        OUTGOING_BG,
    borderTopRightRadius:   4,
  },
  otherCaptionBubble: {
    backgroundColor:       INCOMING_BG,
    borderTopLeftRadius:   4,
    borderWidth:           1,
    borderColor:           INCOMING_BD,
  },
  captionText: {
    fontFamily: "Manrope-Regular",
    fontSize:   14,
    lineHeight: 20,
  },
  myCaptionText:    { color: "#1F3A5F" },
  otherCaptionText: { color: "#1F3A5F" },

  // Deleted state
  deletedBubble: {
    flexDirection:     "row",
    alignItems:        "center",
    borderRadius:      16,
    paddingHorizontal: 12,
    paddingVertical:    8,
    borderWidth:       1,
  },
  myDeletedBubble: {
    backgroundColor:        OUTGOING_BG,
    borderColor:            "rgba(53,101,242,0.12)",
    borderBottomRightRadius: 4,
  },
  otherDeletedBubble: {
    backgroundColor:       INCOMING_BG,
    borderColor:           INCOMING_BD,
    borderBottomLeftRadius: 4,
  },
  deletedText: {
    fontFamily: "Manrope-Regular",
    fontSize:   13,
    color:      DELETED_COLOR,
    fontStyle:  "italic",
  },
});
