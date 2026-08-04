/**
 * ChatComposer.js (Pure UI Component - Phase 1A & 1B Architecture)
 *
 * Responsibilities:
 *   ✅ Ephemeral UI State: messageText, local mediaAttachments, mediaPickerOpen, videoPreviewing
 *   ✅ Imperative Ref: exposes .focus(), .blur(), .clear() via forwardRef
 *   ✅ React.memo Wrapped: bails out when parent ChatScreen re-renders
 *
 * Excluded (Owned by ChatScreen as Conversation Coordinator):
 *   ❌ Socket emits (notifies via onTyping callback)
 *   ❌ API network calls (notifies via onSend callback)
 *   ❌ Conversation state (selectedReply, blocked, permissions passed as props)
 */
import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  useImperativeHandle,
  forwardRef,
} from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { ImagePlus, Send, X, AlertCircle } from "lucide-react-native";
import { getVideoThumbnailAsync } from "expo-video-thumbnails";

import CustomImagePicker from "./CustomImagePicker";
import VideoSendPreviewModal from "./VideoSendPreviewModal";
import SnooLoader from "./ui/SnooLoader";
import ReplyBar from "./ReplyBar";

const PRIMARY_COLOR = "#3565F2";
const ACCENT = PRIMARY_COLOR;
const SEND_BUTTON_PRESSED = "#2E56D6";
const LIGHT_TEXT = "#8FA1B8";
const TYPING_STOP_DELAY = 2000;

const ChatComposerInner = (
  {
    selectedReply,
    onCloseReply,
    replyBarHeightShared,
    onSend,
    onTyping,
    onFocusChange,
    onShowAlert,
    sending = false,
    uploadingMedia = false,
    disabled = false,
  },
  ref,
) => {
  const [messageText, setMessageText] = useState("");
  const [mediaAttachments, setMediaAttachments] = useState([]);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [videoPreviewing, setVideoPreviewing] = useState(null);

  const [toastVisible, setToastVisible] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef(null);

  const triggerLimitToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastVisible(true);
    toastOpacity.setValue(0);
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();

    toastTimerRef.current = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setToastVisible(false);
        }
      });
    }, 2000);
  }, [toastOpacity]);

  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // Unmount safety guard for async tasks (e.g. video thumbnail generation)
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Keep a stable ref for onTyping to safely call inside unmount effect
  const onTypingRef = useRef(onTyping);
  useEffect(() => {
    onTypingRef.current = onTyping;
  }, [onTyping]);

  // Imperative ref interface for parent
  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
    blur: () => {
      inputRef.current?.blur();
    },
    clear: (options = {}) => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current) {
        isTypingRef.current = false;
        onTypingRef.current?.(false);
      }
      setMessageText("");
      setMediaAttachments([]);
      if (options.blur) {
        inputRef.current?.blur();
      }
    },
  }));

  // Local text change handler -> notifies parent via onTyping callback
  const handleTextChange = useCallback(
    (text) => {
      if (text.length >= 1000) {
        triggerLimitToast();
      }
      setMessageText(text);

      if (onTyping) {
        const trimmedLength = text.trim().length;
        if (!isTypingRef.current && trimmedLength > 0) {
          isTypingRef.current = true;
          onTyping(true);
        }

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
          if (isTypingRef.current) {
            isTypingRef.current = false;
            onTyping(false);
          }
        }, TYPING_STOP_DELAY);
      }
    },
    [onTyping, triggerLimitToast],
  );

  // Unmount cleanup: cancel timer and guarantee server receives typing_stop
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current) {
        isTypingRef.current = false;
        onTypingRef.current?.(false);
      }
    };
  }, []);

  // Image picker completion handler
  const handleCustomPickerDone = useCallback(
    async (assets) => {
      setMediaPickerOpen(false);
      if (!assets?.length) return;

      const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
      const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

      const valid = assets.filter((a) => {
        const isVideo = a.mediaType === "video";
        const max = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
        return !(a.fileSize && a.fileSize > max);
      });

      if (valid.length < assets.length && onShowAlert) {
        onShowAlert({
          title: "Some files skipped",
          message: "One or more files exceeded the size limit and were removed.",
        });
      }

      if (!valid.length) return;

      if (valid.length === 1 && valid[0].mediaType === "video") {
        if (!mountedRef.current) return;
        setVideoPreviewing({
          uri: valid[0].uri,
          duration: valid[0].duration ?? null,
        });
        return;
      }

      const attachments = await Promise.all(
        valid.map(async (a, index) => {
          let thumbnailUri = null;
          if (a.mediaType === "video") {
            try {
              const thumb = await getVideoThumbnailAsync(a.uri, { time: 0 });
              thumbnailUri = thumb.uri;
            } catch (_) {}
          }
          return {
            id: `att_${a.uri}_${a.mediaType}_${Date.now()}_${index}`,
            uri: a.uri,
            type: a.mediaType === "video" ? "video" : "image",
            duration: a.duration ?? null,
            thumbnailUri: thumbnailUri,
            muteAudio: false,
          };
        }),
      );

      // Async unmount guard
      if (!mountedRef.current) return;
      setMediaAttachments(attachments);
    },
    [onShowAlert],
  );

  // Video preview confirm
  const handleVideoSendConfirm = useCallback(
    async ({ muteAudio }) => {
      if (!videoPreviewing) return;
      let thumbnailUri = null;
      try {
        const thumb = await getVideoThumbnailAsync(videoPreviewing.uri, {
          time: 0,
        });
        thumbnailUri = thumb.uri;
      } catch (_) {}

      // Async unmount guard
      if (!mountedRef.current) return;
      setMediaAttachments([
        {
          id: `att_${videoPreviewing.uri}_video_${Date.now()}`,
          uri: videoPreviewing.uri,
          type: "video",
          duration: videoPreviewing.duration,
          thumbnailUri: thumbnailUri,
          muteAudio: muteAudio,
        },
      ]);
      setVideoPreviewing(null);
    },
    [videoPreviewing],
  );

  // Send action -> delegates payload to onSend callback
  const handlePressSend = useCallback(() => {
    const trimmedText = messageText.trim();
    const hasText = trimmedText.length > 0;
    const hasMedia = mediaAttachments.length > 0;
    if ((!hasText && !hasMedia) || sending || uploadingMedia || disabled) return;

    if (onSend) {
      onSend({
        text: trimmedText,
        attachments: [...mediaAttachments],
      });
    }
  }, [messageText, mediaAttachments, sending, uploadingMedia, disabled, onSend]);

  const trimmedText = messageText.trim();
  const canSend = useMemo(
    () =>
      (trimmedText.length > 0 || mediaAttachments.length > 0) &&
      !sending &&
      !uploadingMedia &&
      !disabled,
    [trimmedText, mediaAttachments.length, sending, uploadingMedia, disabled],
  );

  return (
    <View style={styles.container}>
      <ReplyBar
        reply={selectedReply}
        onClose={onCloseReply}
        heightShared={replyBarHeightShared}
      />

      {/* Media preview strip */}
      {mediaAttachments.length > 0 && (
        <View style={styles.mediaPreviewStrip}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.mediaPreviewScroll}
            contentContainerStyle={styles.mediaPreviewScrollContent}
          >
            {mediaAttachments.map((att) => (
              <View key={att.id || att.uri} style={styles.mediaThumbContainer}>
                <Image
                  source={{ uri: att.thumbnailUri || att.uri }}
                  style={styles.mediaPreviewThumb}
                  contentFit="cover"
                  cachePolicy="memory"
                  recyclingKey={att.uri}
                />
                {att.type === "video" && (
                  <View style={styles.mediaPreviewVideoIcon}>
                    <Text style={{ fontSize: 9 }}>🎥</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.mediaThumbRemove}
                  onPress={() =>
                    setMediaAttachments((prev) =>
                      prev.filter((item) => item.id !== att.id),
                    )
                  }
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <X size={12} color="#FFFFFF" strokeWidth={3} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Input row */}
      <View style={styles.inputContent}>
        <TouchableOpacity
          style={styles.attachBtn}
          onPress={() => setMediaPickerOpen(true)}
          disabled={disabled}
        >
          <ImagePlus size={22} color={ACCENT} strokeWidth={2} />
        </TouchableOpacity>

        <View style={styles.inputWrapper}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor="#8FA1B8"
            selectionColor="#8FA1B8"
            cursorColor="#8FA1B8"
            underlineColorAndroid="transparent"
            value={messageText}
            onChangeText={handleTextChange}
            multiline
            maxLength={1000}
            onFocus={() => onFocusChange && onFocusChange(true)}
            onBlur={() => onFocusChange && onFocusChange(false)}
            editable={!disabled}
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.sendButton,
            !canSend && styles.sendButtonDisabled,
            pressed && canSend && { backgroundColor: SEND_BUTTON_PRESSED },
          ]}
          onPress={handlePressSend}
          disabled={!canSend}
        >
          {sending || uploadingMedia ? (
            <SnooLoader size="small" color="#FFFFFF" />
          ) : (
            <Send size={20} color="#FFFFFF" strokeWidth={2.6} />
          )}
        </Pressable>
      </View>

      {/* Image picker modal */}
      {mediaPickerOpen && (
        <CustomImagePicker
          visible={mediaPickerOpen}
          onClose={() => setMediaPickerOpen(false)}
          onDone={handleCustomPickerDone}
          selectionLimit={10}
          allowVideos
          videoMaxDuration={120}
        />
      )}

      {/* Video preview modal */}
      {!!videoPreviewing && (
        <VideoSendPreviewModal
          visible={!!videoPreviewing}
          videoUri={videoPreviewing?.uri}
          duration={videoPreviewing?.duration}
          onClose={() => setVideoPreviewing(null)}
          onSend={handleVideoSendConfirm}
        />
      )}

      {/* Red toast centered in chat view when message limit (1,000 chars) is reached */}
      {toastVisible && (
        <View style={styles.toastOverlay} pointerEvents="none">
          <Animated.View style={[styles.toastBox, { opacity: toastOpacity }]}>
            <AlertCircle size={16} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
            <Text style={styles.toastText}>Message limit reached (1,000 chars)</Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "column",
    backgroundColor: "#F7F9FC",
  },
  toastOverlay: {
    position: "absolute",
    bottom: 220,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  toastBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E53935",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    maxWidth: 280,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  toastText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
    textAlign: "center",
  },
  inputContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  attachBtn: {
    padding: 8,
    marginRight: 4,
  },
  inputWrapper: {
    flex: 1,
    marginRight: 8,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E5EA",
    minHeight: 44,
    justifyContent: "center",
  },
  input: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 100,
    minHeight: 44,
    fontFamily: "Manrope-Regular",
    fontSize: 14.5,
    color: "#1F3A5F",
    backgroundColor: "transparent",
    textAlignVertical: "center",
    borderWidth: 0,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY_COLOR,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: LIGHT_TEXT,
    shadowOpacity: 0,
    elevation: 0,
  },
  mediaPreviewStrip: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: "#E6ECF5",
    backgroundColor: "#F7F9FC",
  },
  mediaPreviewScroll: {
    maxHeight: 70,
  },
  mediaPreviewScrollContent: {
    alignItems: "center",
    gap: 8,
  },
  mediaThumbContainer: {
    width: 60,
    height: 60,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  mediaPreviewThumb: {
    width: "100%",
    height: "100%",
  },
  mediaPreviewVideoIcon: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8,
    padding: 2,
  },
  mediaThumbRemove: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default React.memo(forwardRef(ChatComposerInner));
