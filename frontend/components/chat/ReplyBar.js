/**
 * ReplyBar.js
 *
 * Renders the reply preview strip directly above the chat composer.
 * Animated on the UI thread via Reanimated.
 */
import React, { useRef, useCallback, useEffect } from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { Image as ImageIcon, Video, X } from "lucide-react-native";

const CHAT_CANVAS_BG = "#F7F9FC";
const INCOMING_BORDER = "#E6ECF5";
const LIGHT_TEXT = "#8FA1B8";

const ReplyBar = ({ reply, onClose, heightShared }) => {
  const fallbackHeight = useSharedValue(0);
  const height = heightShared || fallbackHeight;
  const translateY = useSharedValue(20);
  const opacity = useSharedValue(0);
  const activeReplyRef = useRef(reply);

  if (reply) {
    activeReplyRef.current = reply;
  }

  const handleClose = useCallback(() => {
    height.value = withTiming(
      0,
      { duration: 180, easing: Easing.bezier(0.25, 0.1, 0.25, 1) },
      (finished) => {
        if (finished && onClose) {
          runOnJS(onClose)();
        }
      },
    );
    translateY.value = withTiming(20, {
      duration: 180,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
    opacity.value = withTiming(0, { duration: 140 });
  }, [height, translateY, opacity, onClose]);

  useEffect(() => {
    if (reply) {
      height.value = withTiming(52, {
        duration: 200,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
      translateY.value = withTiming(0, {
        duration: 200,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
      opacity.value = withTiming(1, { duration: 180 });
    } else {
      height.value = withTiming(0, {
        duration: 180,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
      translateY.value = withTiming(20, {
        duration: 180,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
      opacity.value = withTiming(0, { duration: 140 });
    }
  }, [reply, height, translateY, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    height: height.value,
    opacity: opacity.value,
    overflow: "hidden",
  }));

  const innerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const activeReply = activeReplyRef.current;
  const isPostShare = activeReply?.isPostShare;
  const isMedia =
    activeReply?.messageType === "image" ||
    activeReply?.messageType === "video" ||
    activeReply?.messageType === "multi_media";

  let preview = "";
  if (activeReply) {
    if (activeReply.isDeleted) {
      preview = "This message was unsent";
    } else if (isPostShare) {
      const authorLine = activeReply.postAuthorUsername
        ? `@${activeReply.postAuthorUsername}`
        : "Shared post";
      const captionLine = activeReply.postCaption
        ? ` ∙ ${activeReply.postCaption.slice(0, 40)}${activeReply.postCaption.length > 40 ? "…" : ""}`
        : "";
      preview = authorLine + captionLine;
    } else {
      preview = activeReply.messageText || "";
      if (!preview && isMedia) {
        preview =
          activeReply.messageType === "video"
            ? "Video"
            : activeReply.messageType === "multi_media"
              ? "Media"
              : "Photo";
      }
      preview = preview.slice(0, 60) + (preview.length > 60 ? "…" : "");
    }
  }

  return (
    <Animated.View style={animStyle}>
      <Animated.View style={[replyBarStyles.container, innerAnimStyle]}>
        <View
          style={[
            replyBarStyles.postIcon,
            !(isPostShare || isMedia) && { display: "none" },
          ]}
        >
          {activeReply?.messageType === "video" ? (
            <Video size={14} color="#3565F2" strokeWidth={2} />
          ) : (
            <ImageIcon size={14} color="#3565F2" strokeWidth={2} />
          )}
        </View>
        <View style={replyBarStyles.body}>
          <Text style={replyBarStyles.name}>
            Replying to {activeReply?.senderName || "Message"}
          </Text>
          <Text style={replyBarStyles.preview} numberOfLines={1}>
            {preview}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleClose}
          style={replyBarStyles.close}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X size={16} color={LIGHT_TEXT} strokeWidth={2.5} />
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

const replyBarStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CHAT_CANVAS_BG,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: INCOMING_BORDER,
    overflow: "hidden",
  },
  postIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(53,101,242,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  body: { flex: 1 },
  name: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 12,
    color: LIGHT_TEXT,
    marginBottom: 2,
  },
  preview: { fontFamily: "Manrope-Regular", fontSize: 12, color: LIGHT_TEXT },
  close: {
    padding: 4,
  },
});

export default React.memo(ReplyBar);
