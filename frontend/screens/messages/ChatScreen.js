import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  StyleSheet,
  View,
  Platform,
  Alert,
  Text,
  TextInput,
  Modal,
  ScrollView,
  Pressable,
  Keyboard,
  ActivityIndicator,
  FlatList,
  InteractionManager,
  Animated as RNAnimated,
} from "react-native";

import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import { GestureHandlerRootView, TouchableOpacity } from "react-native-gesture-handler";

import SwipeableMessageRow from "../../components/SwipeableMessageRow";
import useChatPagination from "../../hooks/useChatPagination";
import {
  useKeyboardHandler,
  KeyboardStickyView,
  KeyboardAvoidingView,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  ArrowLeft,
  Send,
  X,
  Reply,
  TriangleAlert,
  Trash2,
  PartyPopper,
  MoreVertical,
  Flag,
  CircleCheck,
  Bell,
  BellOff,
  Image as ImageIcon,
  LockKeyhole,
  ImagePlus,
  Megaphone,
  Video,
  UserX,
  User,
  ShieldOff,
} from "lucide-react-native";
import CustomImagePicker from "../../components/CustomImagePicker";
import CustomAlertModal from "../../components/ui/CustomAlertModal";
import MediaViewerTimeline from "../../components/MediaViewerTimeline";
import VideoSendPreviewModal from "../../components/VideoSendPreviewModal";
import { getVideoThumbnailAsync } from "expo-video-thumbnails";

import { BlurView } from "expo-blur";
import {
  getMessages,
  sendMessage,
  unsendMessage,
  getConversations,
  resolveConversation,
  hideConversation,
  reportConversation,
  muteConversation,
  unmuteConversation,
  getGroupParticipants,
} from "../../api/messages";
import { blockUser, unblockUser } from "../../api/plans";
import { getActiveAccount } from "../../api/auth";
import { uploadChatMedia } from "../../api/upload";
import ChatMediaMessage from "../../components/ChatMediaMessage";
import { getPublicMemberProfile } from "../../api/members";
import { getPublicCommunity } from "../../api/communities";
import { confirmGiftRSVP } from "../../api/events";
import EventBus from "../../utils/EventBus";
import { COLORS } from "../../constants/theme";
import KeyboardAwareToolbar from "../../components/KeyboardAwareToolbar";
import TicketMessageCard from "../../components/TicketMessageCard";
import SharedPostCard from "../../components/SharedPostCard";
import SharedOpportunityCard from "../../components/SharedOpportunityCard";
import SharedEventCard from "../../components/SharedEventCard";
import SnooLoader from "../../components/ui/SnooLoader";
import ProfilePostFeed from "../../components/ProfilePostFeed";
import EmptyChatState from "../../components/EmptyChatState";
import useRealtimeSubscription from "../../hooks/useRealtimeSubscription";
import { getSocket } from "../../services/socketService";

// ΓöÇΓöÇ Palette ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const PRIMARY_COLOR = "#3565F2";
const ACCENT = PRIMARY_COLOR;
const SEND_BUTTON_PRESSED = "#2E56D6";
const CHAT_CANVAS_BG = "#F7F9FC";
const OUTGOING_MESSAGE_BG = "#E6F0FF";
const INCOMING_MESSAGE_BG = "#FFFFFF";
const INCOMING_BORDER = "#E6ECF5";
const MESSAGE_TEXT_COLOR = "#1F3A5F";
const LIGHT_TEXT = COLORS.textSecondary;
const REPLY_SWIPE_MAX = 72;
const REPLY_HAPTIC_THRESHOLD = 64;

// ── GroupAvatar ─────────────────────────────────────────────────────────────
// Shows a profile photo if available, otherwise a colour-coded initials circle.
// Eliminates the dependency on placeholder.com which is unreliable on device.
const AVATAR_PALETTE = [
  "#3565F2",
  "#E53935",
  "#00897B",
  "#8E24AA",
  "#F4511E",
  "#1E88E5",
  "#3949AB",
  "#039BE5",
];
const avatarColorFor = (name = "") => {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};
const GroupAvatar = ({ photoUrl, name, size = 30 }) => {
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const bg = avatarColorFor(name);
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          marginRight: 8,
        }}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        marginRight: 8,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: "Manrope-SemiBold",
          fontSize: size * 0.38,
          color: "#FFFFFF",
        }}
      >
        {initials}
      </Text>
    </View>
  );
};

// ΓöÇΓöÇ Helpers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// ── Helpers ────────────────────────────────────────────────────────────────
const formatTime = (dateString) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
};

const formatSeparatorLabel = (dateString) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  const now = new Date();
  const diff = now - d;
  const oneDay = 86400000;
  if (diff < oneDay && now.getDate() === d.getDate()) return "Today";
  if (diff < 2 * oneDay) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
};

/**
 * buildMessageList: converts a raw messages array (oldest → newest) into a
 * mixed list ordered newest → oldest, ready for an inverted FlashList.
 *
 * Date separators are injected AFTER the oldest message of each day in
 * this reversed order, so they render ABOVE that day's message group
 * exactly as expected in a chat UI.
 *
 * Input:  [oldest, …, newest]  (chronological, as stored in useChatPagination)
 * Output: [newest, …, oldest, separator, …]  (for inverted FlashList)
 */
const buildMessageList = (messages) => {
  if (!messages || messages.length === 0) return [];

  // Work in ascending order to detect day boundaries, then emit newest-first.
  // We iterate in reverse (newest → oldest) and inject a separator whenever
  // the day changes compared to the next-older message.
  const result = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const older = messages[i - 1]; // undefined when i === 0 (oldest message)

    // Pre-parse and cache dates to avoid creating Date objects inside the render path
    if (msg && !msg._time) {
      const d = new Date(msg.createdAt);
      msg._time = d.getTime();
      msg._dateString = d.toDateString();
    }
    if (older && !older._time) {
      const d = new Date(older.createdAt);
      older._time = d.getTime();
      older._dateString = d.toDateString();
    }

    result.push({ type: "message", data: msg });

    // Inject a separator after (below in the inverted list) this message if:
    // • it is the oldest message overall, OR
    // • the next-older message belongs to a different calendar day.
    const isOldestOfDay =
      !older ||
      msg._dateString !== older._dateString;

    if (isOldestOfDay) {
      result.push({
        type: "separator",
        id: `sep-${msg.id}`,
        label: formatSeparatorLabel(msg.createdAt),
      });
    }
  }
  return result;
};

// ── keyExtractor ────────────────────────────────────────────────────────────
const keyExtractor = (item) =>
  item.type === "message" ? String(item.data.id) : item.id;

// ── TimestampSeparator ──────────────────────────────────────────────────────
const TimestampSeparator = React.memo(({ label }) => (
  <View style={sepStyles.row}>
    <Text style={sepStyles.label}>{label}</Text>
  </View>
));
const sepStyles = StyleSheet.create({
  row: { alignItems: "center", marginVertical: 12 },
  label: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: LIGHT_TEXT,
    opacity: 0.7,
  },
});

// ── ReplyBar (above input) ──────────────────────────────────────────────────
const ReplyBar = ({ reply, onClose }) => {
  const translateY = useSharedValue(30);
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (reply) {
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 160 });
    }
  }, [reply]);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));
  if (!reply) return null;

  const isPostShare = reply.isPostShare;
  const isMedia =
    reply.messageType === "image" ||
    reply.messageType === "video" ||
    reply.messageType === "multi_media";

  let preview;
  if (reply.isDeleted) {
    preview = "This message was unsent";
  } else if (isPostShare) {
    const authorLine = reply.postAuthorUsername
      ? `@${reply.postAuthorUsername}`
      : "Shared post";
    const captionLine = reply.postCaption
      ? ` ∙ ${reply.postCaption.slice(0, 40)}${reply.postCaption.length > 40 ? "…" : ""}`
      : "";
    preview = authorLine + captionLine;
  } else {
    preview = reply.messageText || "";
    if (!preview && isMedia) {
      preview =
        reply.messageType === "video"
          ? "Video"
          : reply.messageType === "multi_media"
            ? "Media"
            : "Photo";
    }
    preview = preview.slice(0, 60) + (preview.length > 60 ? "…" : "");
  }

  return (
    <Animated.View style={[replyBarStyles.container, animStyle]}>
      {(isPostShare || isMedia) && (
        <View style={replyBarStyles.postIcon}>
          {reply.messageType === "video" ? (
            <Video size={14} color="#3565F2" strokeWidth={2} />
          ) : (
            <ImageIcon size={14} color="#3565F2" strokeWidth={2} />
          )}
        </View>
      )}
      <View style={replyBarStyles.body}>
        <Text style={replyBarStyles.name}>
          Replying to {reply.senderName || "Message"}
        </Text>
        <Text style={replyBarStyles.preview} numberOfLines={1}>
          {preview}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onClose}
        style={replyBarStyles.close}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <X size={16} color={LIGHT_TEXT} strokeWidth={2.5} />
      </TouchableOpacity>
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
});

// ── ReplyQuote ─────────────────────────────────────────────────────────────
const ReplyQuote = ({ replyPreview, isMyMessage, onPress }) => {
  const isPostShare =
    replyPreview.isPostShare ||
    (!replyPreview.isDeleted && replyPreview.messageText === "Shared a post");

  return (
    <View style={quoteStyles.wrapper}>
      <Text
        style={[
          quoteStyles.replyLabel,
          isMyMessage ? quoteStyles.myReplyLabel : quoteStyles.otherReplyLabel,
        ]}
      >
        {isMyMessage ? "You replied" : "Replied to you"}
      </Text>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[
          quoteStyles.container,
          isMyMessage ? quoteStyles.myContainer : quoteStyles.otherContainer,
        ]}
      >
        <View
          style={[
            quoteStyles.verticalBar,
            isMyMessage
              ? quoteStyles.myVerticalBar
              : quoteStyles.otherVerticalBar,
          ]}
        />
        <View style={quoteStyles.content}>
          {replyPreview.isDeleted ? (
            <Text
              style={[quoteStyles.text, quoteStyles.deletedText]}
              numberOfLines={1}
            >
              This message was unsent
            </Text>
          ) : isPostShare ? (
            <>
              <View style={quoteStyles.postShareRow}>
                <ImageIcon
                  size={12}
                  color="#3565F2"
                  strokeWidth={2}
                  style={{ marginRight: 4 }}
                />
                <Text style={quoteStyles.postShareLabel}>Shared a post</Text>
              </View>
              {(replyPreview.postAuthorUsername ||
                replyPreview.postCaption) && (
                <Text
                  style={[
                    quoteStyles.text,
                    isMyMessage ? quoteStyles.myText : quoteStyles.otherText,
                    { opacity: 0.75 },
                  ]}
                  numberOfLines={1}
                >
                  {replyPreview.postAuthorUsername
                    ? `@${replyPreview.postAuthorUsername}`
                    : ""}
                  {replyPreview.postAuthorUsername && replyPreview.postCaption
                    ? " ∙ "
                    : ""}
                  {replyPreview.postCaption
                    ? replyPreview.postCaption.slice(0, 50)
                    : ""}
                </Text>
              )}
            </>
          ) : (
            <View style={quoteStyles.postShareRow}>
              {(replyPreview.messageType === "image" ||
                replyPreview.messageType === "video" ||
                replyPreview.messageType === "multi_media") &&
                (replyPreview.messageType === "video" ? (
                  <Video
                    size={12}
                    color={MESSAGE_TEXT_COLOR}
                    strokeWidth={2}
                    style={{ marginRight: 4 }}
                  />
                ) : (
                  <ImageIcon
                    size={12}
                    color={MESSAGE_TEXT_COLOR}
                    strokeWidth={2}
                    style={{ marginRight: 4 }}
                  />
                ))}
              <Text
                style={[
                  quoteStyles.text,
                  isMyMessage ? quoteStyles.myText : quoteStyles.otherText,
                ]}
                numberOfLines={2}
              >
                {replyPreview.messageText ||
                  (replyPreview.messageType === "video"
                    ? "Video"
                    : replyPreview.messageType === "image"
                      ? "Photo"
                      : "Media")}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
};
const quoteStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 2,
    maxWidth: "100%",
  },
  replyLabel: {
    fontFamily: "Manrope-Medium",
    fontSize: 11,
    color: "#8FA1B8",
    marginBottom: 4,
  },
  myReplyLabel: {
    alignSelf: "flex-end",
    marginRight: 4,
  },
  otherReplyLabel: {
    alignSelf: "flex-start",
    marginLeft: 4,
  },
  container: {
    flexDirection: "row",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    maxWidth: "100%",
  },
  myContainer: {
    backgroundColor: "rgba(230, 240, 255, 0.6)",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  otherContainer: {
    backgroundColor: "rgba(247, 249, 252, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(229, 229, 234, 0.5)",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  verticalBar: {
    width: 3,
    borderRadius: 1.5,
    marginRight: 8,
  },
  myVerticalBar: {
    backgroundColor: "#A0C4FF",
  },
  otherVerticalBar: {
    backgroundColor: "#C8D3E0",
  },
  content: {
    flexShrink: 1,
    justifyContent: "center",
  },
  text: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  myText: {
    color: "rgba(31, 58, 95, 0.8)",
  },
  otherText: {
    color: "rgba(31, 58, 95, 0.8)",
  },
  deletedText: {
    color: "#A0A0A0",
    fontStyle: "italic",
    fontFamily: "Manrope-Regular",
  },
  postShareRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  postShareLabel: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 12,
    color: "#3565F2",
  },
});

// MessageOptionsModal remains custom but gets a facelift
const MessageOptionsModal = ({
  visible,
  isMyMessage,
  onReply,
  onUnsend,
  onCancel,
}) => {
  if (!visible) return null;
  return (
    <View style={optionsStyles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
      <View style={optionsStyles.menu}>
        <TouchableOpacity style={optionsStyles.option} onPress={onReply}>
          <View
            style={[
              optionsStyles.iconBox,
              { backgroundColor: "rgba(53, 101, 242, 0.15)" },
            ]}
          >
            <Reply size={20} color="#3565F2" strokeWidth={2.5} />
          </View>
          <Text style={optionsStyles.optionText}>Reply</Text>
        </TouchableOpacity>

        {isMyMessage && <View style={optionsStyles.divider} />}

        {isMyMessage && (
          <TouchableOpacity style={optionsStyles.option} onPress={onUnsend}>
            <View
              style={[
                optionsStyles.iconBox,
                { backgroundColor: "rgba(229, 57, 53, 0.15)" },
              ]}
            >
              <Trash2 size={20} color="#E53935" strokeWidth={2.5} />
            </View>
            <Text style={[optionsStyles.optionText, { color: "#E53935" }]}>
              Unsend
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
const optionsStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  menu: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    width: 240,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 16,
    color: "#1F3A5F",
    marginLeft: 16,
  },
  divider: { height: 1, backgroundColor: "#F3F4F6", marginHorizontal: 12 },
});

// ReportModal is removed in favor of CustomAlertModal logic in the main component

// ── REPORT_REASONS ────────────────────────────────────────────────────────
const REPORT_REASONS = [
  { key: "harassment", label: "Harassment or bullying" },
  { key: "spam", label: "Spam or unwanted content" },
  { key: "hate_speech", label: "Hate speech or discrimination" },
  { key: "threats", label: "Threats or violence" },
  { key: "inappropriate_content", label: "Inappropriate content" },
  { key: "other", label: "Other" },
];

// ── ChatActionsSheet ──────────────────────────────────────────────────────
const ChatActionsSheet = ({
  visible,
  onClose,
  onDeleteChat,
  onReport,
  onMute,
  isMuted,
  onBlock,
  onUnblock,
  youHaveBlocked,
  isGroup,
}) => {
  const slideVal = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      slideVal.value = 0;
      slideVal.value = withSpring(1, {
        damping: 15,
        stiffness: 120,
        mass: 0.8,
      });
    }
  }, [visible]);

  const animatedSheetStyle = useAnimatedStyle(() => {
    const translateY = (1 - slideVal.value) * 300;
    return {
      transform: [{ translateY }],
    };
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={actionSheetStyles.overlay} onPress={onClose}>
        <Animated.View
          style={[actionSheetStyles.sheet, animatedSheetStyle]}
        >
          <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%' }}>
            <View style={actionSheetStyles.handle} />

        {/* Mute / Unmute */}
        <TouchableOpacity
          style={actionSheetStyles.row}
          onPress={onMute}
          activeOpacity={0.7}
        >
          <View
            style={[
              actionSheetStyles.iconBox,
              {
                backgroundColor: isMuted
                  ? "rgba(52,199,89,0.1)"
                  : "rgba(255,159,10,0.1)",
              },
            ]}
          >
            {isMuted ? (
              <Bell size={20} color="#34C759" strokeWidth={2.5} />
            ) : (
              <BellOff size={20} color="#FF9F0A" strokeWidth={2.5} />
            )}
          </View>
          <View style={actionSheetStyles.rowText}>
            <Text style={actionSheetStyles.rowLabel}>
              {isMuted ? "Unmute Chat" : "Mute Chat"}
            </Text>
            <Text style={actionSheetStyles.rowSub}>
              {isMuted
                ? "Turn notifications back on"
                : "Silence notifications for this chat"}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={actionSheetStyles.divider} />

        <TouchableOpacity
          style={actionSheetStyles.row}
          onPress={onDeleteChat}
          activeOpacity={0.7}
        >
          <View
            style={[
              actionSheetStyles.iconBox,
              { backgroundColor: "rgba(229, 57, 53, 0.1)" },
            ]}
          >
            <Trash2 size={20} color="#E53935" strokeWidth={2.5} />
          </View>
          <View style={actionSheetStyles.rowText}>
            <Text style={actionSheetStyles.rowLabel}>Delete Chat</Text>
            <Text style={actionSheetStyles.rowSub}>
              Removes this chat from your inbox only
            </Text>
          </View>
        </TouchableOpacity>

        <View style={actionSheetStyles.divider} />

        <TouchableOpacity
          style={actionSheetStyles.row}
          onPress={onReport}
          activeOpacity={0.7}
        >
          <View
            style={[
              actionSheetStyles.iconBox,
              { backgroundColor: "rgba(255, 152, 0, 0.1)" },
            ]}
          >
            <Flag size={20} color="#FF9800" strokeWidth={2.5} />
          </View>
          <View style={actionSheetStyles.rowText}>
            <Text style={actionSheetStyles.rowLabel}>Report Chat</Text>
            <Text style={actionSheetStyles.rowSub}>
              Report abusive or harmful content
            </Text>
          </View>
        </TouchableOpacity>

        {/* Block User — only for 1:1 DMs */}
        {!isGroup && (
          <>
            <View style={actionSheetStyles.divider} />
            <TouchableOpacity
              style={actionSheetStyles.row}
              onPress={youHaveBlocked ? onUnblock : onBlock}
              activeOpacity={0.7}
            >
              <View
                style={[
                  actionSheetStyles.iconBox,
                  {
                    backgroundColor: youHaveBlocked
                      ? "rgba(53, 101, 242, 0.08)"
                      : "rgba(229, 57, 53, 0.08)",
                  },
                ]}
              >
                {youHaveBlocked ? (
                  <ShieldOff size={20} color="#3565F2" strokeWidth={2.5} />
                ) : (
                  <UserX size={20} color="#E53935" strokeWidth={2.5} />
                )}
              </View>
              <View style={actionSheetStyles.rowText}>
                <Text
                  style={[
                    actionSheetStyles.rowLabel,
                    youHaveBlocked && { color: "#3565F2" },
                    !youHaveBlocked && { color: "#E53935" },
                  ]}
                >
                  {youHaveBlocked ? "Unblock User" : "Block User"}
                </Text>
                <Text style={actionSheetStyles.rowSub}>
                  {youHaveBlocked
                    ? "Remove block and restore access"
                    : "They won't be able to message or find you"}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};
const actionSheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginBottom: 20,
  },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: "Manrope-SemiBold", fontSize: 16, color: "#1F3A5F" },
  rowSub: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: "#8FA1B8",
    marginTop: 2,
  },
  divider: { height: 1, backgroundColor: "#F3F4F6" },
});

// ── ReportReasonSheet ─────────────────────────────────────────────────────
const ReportReasonSheet = ({ visible, onClose, onSelect }) => {
  const [otherMode, setOtherMode] = React.useState(false);
  const [otherText, setOtherText] = React.useState("");
  const otherInputRef = React.useRef(null);

  const slideVal = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      setOtherMode(false);
      setOtherText("");
      slideVal.value = 0;
      slideVal.value = withSpring(1, {
        damping: 15,
        stiffness: 120,
        mass: 0.8,
      });
    }
  }, [visible]);

  React.useEffect(() => {
    if (otherMode) {
      slideVal.value = 0;
      slideVal.value = withSpring(1, {
        damping: 15,
        stiffness: 120,
        mass: 0.8,
      });
    }
  }, [otherMode]);

  const animatedSheetStyle = useAnimatedStyle(() => {
    const translateY = (1 - slideVal.value) * 300;
    return {
      transform: [{ translateY }],
    };
  });

  if (otherMode) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={onClose}
      >
        <KeyboardStickyView
          offset={{ closed: 0, opened: 0 }}
          style={{ flex: 1 }}
        >
          <Pressable style={actionSheetStyles.overlay} onPress={onClose}>
            <Animated.View
              style={[actionSheetStyles.sheet, animatedSheetStyle, { paddingBottom: 24 }]}
            >
              <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%' }}>
                <View style={actionSheetStyles.handle} />

              <TouchableOpacity
                onPress={() => {
                  setOtherMode(false);
                  setOtherText("");
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 16,
                }}
                activeOpacity={0.7}
              >
                <ArrowLeft size={18} color="#8FA1B8" strokeWidth={2} />
                <Text
                  style={{
                    fontFamily: "Manrope-Medium",
                    fontSize: 13,
                    color: "#8FA1B8",
                    marginLeft: 6,
                  }}
                >
                  Back
                </Text>
              </TouchableOpacity>

              <Text
                style={{
                  fontFamily: "BasicCommercial-Bold",
                  fontSize: 18,
                  color: "#1F3A5F",
                  marginBottom: 6,
                }}
              >
                Tell us more
              </Text>
              <Text
                style={{
                  fontFamily: "Manrope-Regular",
                  fontSize: 13,
                  color: "#8FA1B8",
                  marginBottom: 16,
                }}
              >
                Please describe what happened so we can review it properly.
              </Text>

              <View
                style={{
                  borderWidth: 1,
                  borderColor: "#E5E5EA",
                  borderRadius: 14,
                  backgroundColor: "#F8F9FB",
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  marginBottom: 4,
                  minHeight: 90,
                }}
              >
                <TextInput
                  ref={otherInputRef}
                  value={otherText}
                  onChangeText={setOtherText}
                  placeholder="Describe the issue…"
                  placeholderTextColor="#B0BEC5"
                  multiline
                  maxLength={500}
                  autoFocus
                  style={{
                    fontFamily: "Manrope-Regular",
                    fontSize: 14.5,
                    color: "#1F3A5F",
                    textAlignVertical: "top",
                    minHeight: 70,
                  }}
                />
              </View>
              <Text
                style={{
                  fontFamily: "Manrope-Regular",
                  fontSize: 11,
                  color: "#B0BEC5",
                  alignSelf: "flex-end",
                  marginBottom: 14,
                }}
              >
                {otherText.length} / 500
              </Text>

              <TouchableOpacity
                onPress={() => {
                  const trimmed = otherText.trim();
                  if (!trimmed) return;
                  onSelect({ key: "other", label: "Other", details: trimmed });
                }}
                activeOpacity={otherText.trim().length > 0 ? 0.7 : 1}
                style={{
                  backgroundColor:
                    otherText.trim().length > 0 ? "#1F3A5F" : "#E0E0E0",
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Manrope-SemiBold",
                    fontSize: 15,
                    color: "#FFFFFF",
                  }}
                >
                  Submit Report
                </Text>
              </TouchableOpacity>
              </Pressable>
            </Animated.View>
          </Pressable>
        </KeyboardStickyView>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={actionSheetStyles.overlay} onPress={onClose}>
        <Animated.View
          style={[actionSheetStyles.sheet, animatedSheetStyle]}
        >
          <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%' }}>
            <View style={actionSheetStyles.handle} />
          <Text
            style={{
              fontFamily: "BasicCommercial-Bold",
              fontSize: 18,
              color: "#1F3A5F",
              marginBottom: 16,
            }}
          >
            Why are you reporting?
          </Text>
          {REPORT_REASONS.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={[actionSheetStyles.row, { paddingVertical: 12 }]}
              onPress={() => {
                if (r.key === "other") {
                  setOtherMode(true);
                } else {
                  onSelect(r);
                }
              }}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontFamily: "Manrope-Regular",
                  fontSize: 15,
                  color: "#1F3A5F",
                  flex: 1,
                }}
              >
                {r.label}
              </Text>
              {r.key === "other" && (
                <ArrowLeft
                  size={16}
                  color="#B0BEC5"
                  strokeWidth={2}
                  style={{ transform: [{ rotate: "180deg" }] }}
                />
              )}
            </TouchableOpacity>
          ))}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

// SwipeableMessage extracted to components/SwipeableMessageRow.js
const SwipeableMessage = SwipeableMessageRow;

// ── MessageRow ──────────────────────────────────────────────────────────────
const MessageRow = React.memo(
  ({
    item,
    index,
    isMyMessage,
    showAvatar,
    showSenderName,
    isGroup,
    currentUser,
    recipient,
    recipientId,
    isBlockedByOther,
    rsvpLoading,
    highlightedIdSV,
    onReply,
    onLongPress,
    onRSVP,
    onOpenViewer,
    onPressPostShare,
    onPressUser,
    onPressOpportunity,
    onPressEvent,
    onPressReplyQuote,
    navigation,
  }) => {
    const msg = item.data;
    if (msg.messageType === "system") {
      return (
        <View style={styles.systemRow}>
          <Text style={styles.systemText}>{msg.messageText}</Text>
        </View>
      );
    }

    // Pre-compute avatar element once.
    // Show a Lucide User icon when: the user is blocked, or no photo URL is available.
    const showUserIcon =
      !isGroup && (!recipient?.profilePhotoUrl || isBlockedByOther);
    const avatarEl =
      !isMyMessage &&
      (showAvatar ? (
        isGroup ? (
          <GroupAvatar photoUrl={msg.senderPhotoUrl} name={msg.senderName} />
        ) : showUserIcon ? (
          <View style={styles.messageAvatarFallback}>
            <User size={16} color="#8FA1B8" strokeWidth={1.5} />
          </View>
        ) : (
          <Image
            source={{ uri: recipient.profilePhotoUrl }}
            style={styles.messageAvatar}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        )
      ) : (
        <View style={{ width: 30, marginRight: 8 }} />
      ));

    if (msg.isDeleted) {
      return (
        <View
          style={[
            styles.messageContainer,
            isMyMessage
              ? styles.myMessageContainer
              : styles.otherMessageContainer,
          ]}
        >
          {avatarEl}
          <View>
            {showSenderName && (
              <Text style={styles.groupSenderName}>
                {msg.senderName || "Unknown"}
              </Text>
            )}
            <View
              style={[
                styles.messageBubble,
                isMyMessage
                  ? styles.myMessageBubble
                  : styles.otherMessageBubble,
                styles.deletedBubble,
              ]}
            >
              <Text style={styles.deletedText}>This message was unsent</Text>
            </View>
          </View>
        </View>
      );
    }

    if (msg.messageType === "ticket" && msg.metadata) {
      return (
        <View
          style={[
            styles.messageContainer,
            isMyMessage
              ? styles.myMessageContainer
              : styles.otherMessageContainer,
          ]}
        >
          {avatarEl}
          <View>
            {showSenderName && (
              <Text style={styles.groupSenderName}>
                {msg.senderName || "Unknown"}
              </Text>
            )}
            <TicketMessageCard
              metadata={msg.metadata}
              isFromMe={isMyMessage}
              senderName={recipient?.name}
              loading={rsvpLoading}
              onViewEvent={() => {
                const n = navigation.getParent()?.getParent() || navigation;
                n.navigate("EventDetails", { eventId: msg.metadata.eventId });
              }}
              onConfirmGoing={() => onRSVP(msg, "going")}
              onDecline={() => onRSVP(msg, "not_going")}
            />
          </View>
        </View>
      );
    }

    // ——— Image / Video / MultiMedia messages ————————————————————————————————————————
    if (
      msg.messageType === "image" ||
      msg.messageType === "video" ||
      msg.messageType === "multi_media"
    ) {
      return (
        <View
          style={[
            styles.messageContainer,
            isMyMessage
              ? styles.myMessageContainer
              : styles.otherMessageContainer,
          ]}
        >
          {avatarEl}
          <SwipeableMessage
            messageId={msg.id}
            highlightedIdSV={highlightedIdSV}
            isMyMessage={isMyMessage}
            onReply={() => onReply(msg, isMyMessage)}
            onLongPress={() => onLongPress(msg)}
          >
            <View collapsable={false}>
              {showSenderName && (
                <Text style={styles.groupSenderName}>
                  {msg.senderName || "Unknown"}
                </Text>
              )}
              {msg.replyToMessageId && msg.replyPreview ? (
                <ReplyQuote
                  replyPreview={msg.replyPreview}
                  isMyMessage={isMyMessage}
                  onPress={() => onPressReplyQuote(msg.replyToMessageId)}
                />
              ) : null}
              <ChatMediaMessage
                message={msg}
                isMyMessage={isMyMessage}
                uploadProgress={null}
                onOpenViewer={onOpenViewer}
              />
              <Text
                style={[
                  styles.messageTime,
                  isMyMessage ? styles.myMessageTime : styles.otherMessageTime,
                  {
                    marginRight: isMyMessage ? 4 : 0,
                    marginLeft: isMyMessage ? 0 : 4,
                    marginTop: 2,
                  },
                ]}
              >
                {formatTime(msg.createdAt)}
              </Text>
            </View>
          </SwipeableMessage>
        </View>
      );
    }

    if (msg.messageType === "post_share" && msg.metadata) {
      return (
        <View
          style={[
            styles.messageContainer,
            isMyMessage
              ? styles.myMessageContainer
              : styles.otherMessageContainer,
          ]}
        >
          {avatarEl}
          <SwipeableMessage
            messageId={msg.id}
            highlightedIdSV={highlightedIdSV}
            isMyMessage={isMyMessage}
            onReply={() => onReply(msg, isMyMessage)}
            onLongPress={() => onLongPress(msg)}
          >
            <View collapsable={false}>
              {showSenderName && (
                <Text style={styles.groupSenderName}>
                  {msg.senderName || "Unknown"}
                </Text>
              )}
              {msg.replyToMessageId && msg.replyPreview ? (
                <ReplyQuote
                  replyPreview={msg.replyPreview}
                  isMyMessage={isMyMessage}
                  onPress={() => onPressReplyQuote(msg.replyToMessageId)}
                />
              ) : null}
              <SharedPostCard
                metadata={msg.metadata}
                onPress={onPressPostShare}
                onUserPress={onPressUser}
              />
            </View>
          </SwipeableMessage>
        </View>
      );
    }

    if (msg.messageType === "opportunity_share" && msg.metadata) {
      return (
        <View
          style={[
            styles.messageContainer,
            isMyMessage
              ? styles.myMessageContainer
              : styles.otherMessageContainer,
          ]}
        >
          {avatarEl}
          <SwipeableMessage
            messageId={msg.id}
            highlightedIdSV={highlightedIdSV}
            isMyMessage={isMyMessage}
            onReply={() => onReply(msg, isMyMessage)}
            onLongPress={() => onLongPress(msg)}
          >
            <View collapsable={false}>
              {showSenderName && (
                <Text style={styles.groupSenderName}>
                  {msg.senderName || "Unknown"}
                </Text>
              )}
              {msg.replyToMessageId && msg.replyPreview ? (
                <ReplyQuote
                  replyPreview={msg.replyPreview}
                  isMyMessage={isMyMessage}
                  onPress={() => onPressReplyQuote(msg.replyToMessageId)}
                />
              ) : null}
              <SharedOpportunityCard
                metadata={msg.metadata}
                onPress={onPressOpportunity}
              />
            </View>
          </SwipeableMessage>
        </View>
      );
    }

    if (msg.messageType === "event_share" && msg.metadata) {
      return (
        <View
          style={[
            styles.messageContainer,
            isMyMessage
              ? styles.myMessageContainer
              : styles.otherMessageContainer,
          ]}
        >
          {avatarEl}
          <SwipeableMessage
            messageId={msg.id}
            highlightedIdSV={highlightedIdSV}
            isMyMessage={isMyMessage}
            onReply={() => onReply(msg, isMyMessage)}
            onLongPress={() => onLongPress(msg)}
          >
            <View collapsable={false}>
              {showSenderName && (
                <Text style={styles.groupSenderName}>
                  {msg.senderName || "Unknown"}
                </Text>
              )}
              {msg.replyToMessageId && msg.replyPreview ? (
                <ReplyQuote
                  replyPreview={msg.replyPreview}
                  isMyMessage={isMyMessage}
                  onPress={() => onPressReplyQuote(msg.replyToMessageId)}
                />
              ) : null}
              <SharedEventCard metadata={msg.metadata} onPress={onPressEvent} />
            </View>
          </SwipeableMessage>
        </View>
      );
    }

    const bubbleContent = (
      <View
        collapsable={false}
        style={{
          alignItems: isMyMessage ? "flex-end" : "flex-start",
          maxWidth: "100%",
        }}
      >
        {msg.replyToMessageId && msg.replyPreview ? (
          <ReplyQuote
            replyPreview={msg.replyPreview}
            isMyMessage={isMyMessage}
            onPress={() => onPressReplyQuote(msg.replyToMessageId)}
          />
        ) : null}
        <View
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
            msg.replyPreview &&
              (isMyMessage
                ? styles.myMessageBubbleReplied
                : styles.otherMessageBubbleReplied),
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.otherMessageText,
            ]}
          >
            {msg.messageText}
          </Text>
          <Text
            style={[
              styles.messageTime,
              isMyMessage ? styles.myMessageTime : styles.otherMessageTime,
            ]}
          >
            {formatTime(msg.createdAt)}
          </Text>
        </View>
      </View>
    );

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage
            ? styles.myMessageContainer
            : styles.otherMessageContainer,
        ]}
      >
        {avatarEl}
        <View style={{ flex: 1 }}>
          {showSenderName && (
            <Text style={styles.groupSenderName}>
              {msg.senderName || "Unknown"}
            </Text>
          )}
          <SwipeableMessage
            messageId={msg.id}
            highlightedIdSV={highlightedIdSV}
            isMyMessage={isMyMessage}
            onReply={() => onReply(msg, isMyMessage)}
            onLongPress={() => onLongPress(msg)}
          >
            {bubbleContent}
          </SwipeableMessage>
        </View>
      </View>
    );
  },
);

// ── Main Component ──────────────────────────────────────────────────────────
export default function ChatScreen({ route, navigation }) {
  const {
    conversationId,
    recipientId,
    recipientType = "member",
    isGroup = false,
    groupName,
    isMuted: initialIsMuted = false,
    mutedUntil: initialMutedUntil = null,
    // Passed from ConversationsListScreen for instant render — no async needed
    myGroupRole: initialMyGroupRole = null,
    messagingRestricted: initialMessagingRestricted = false,
    recipientName,
    recipientUsername,
    recipientAvatar,
    tappedAt,
  } = route.params || {};

  const t0Ref = useRef(global.performance ? global.performance.now() : Date.now());
  const firstRenderRef = useRef(true);

  const {
    messages,
    hasMore,
    loadingOlder,
    loadInitial,
    loadOlderMessages,
    addNewMessage,
    addNewMessages,
    updateMessageById,
    newestAtRef,
  } = useChatPagination();

  const [messageText, setMessageText] = useState("");
  const [recipient, setRecipient] = useState(() => {
    if (recipientId && recipientName) {
      return {
        id: recipientId,
        name: recipientName,
        username: recipientUsername || "",
        profilePhotoUrl: recipientAvatar || null,
        type: recipientType || "member"
      };
    }
    return null;
  });
  const [loading, setLoading] = useState(!recipientName && !isGroup);
  const [messagesLoading, setMessagesLoading] = useState(true);
  console.log(`[PERF] ChatScreen rendering... messagesLoading: ${messagesLoading}, loading: ${loading}`);
  const [sending, setSending] = useState(false);
  const [currentConversationId, setCurrentConversationId] =
    useState(conversationId);
  const [currentRecipientType, setCurrentRecipientType] =
    useState(recipientType);
  const [currentRecipientId, setCurrentRecipientId] = useState(recipientId);
  const [currentUser, setCurrentUser] = useState(null);
  const [rsvpLoading, setRsvpLoading] = useState({});
  // \u2500\u2500 PERF: ref mirror so renderItem can read RSVP state without being in its deps.
  //    rsvpLoading in renderItem's closure was causing full re-creation on every
  //    RSVP state change, invalidating all visible rows.
  const rsvpLoadingRef = useRef({});
  const [sharedPostModalVisible, setSharedPostModalVisible] = useState(false);
  const [selectedSharedPost, setSelectedSharedPost] = useState(null);
  const [sharedPosts, setSharedPosts] = useState({});
  const [selectedReply, setSelectedReply] = useState(null); // { id, messageText, senderName, isDeleted }
  const [optionsTarget, setOptionsTarget] = useState(null); // message object to show options for
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: "",
    message: "",
    primaryAction: null,
    secondaryAction: null,
    icon: null,
    iconColor: "#FF3B30",
  });
  const [chatActionsVisible, setChatActionsVisible] = useState(false);
  const [reportSheetVisible, setReportSheetVisible] = useState(false);
  const [isMuted, setIsMuted] = useState(initialIsMuted);
  const [mutedUntil, setMutedUntil] = useState(initialMutedUntil);
  // isBlockedByOther: true when the OTHER user (the one we are chatting with) has blocked US
  // In that case we anonymize their identity in the header
  const [isBlockedByOther, setIsBlockedByOther] = useState(false);
  const [youHaveBlocked, setYouHaveBlocked] = useState(false);
  const [unblocking, setUnblocking] = useState(false);

  // Group restriction + media state
  const [messagingRestricted, setMessagingRestricted] = useState(
    initialMessagingRestricted,
  );
  const [myGroupRole, setMyGroupRole] = useState(initialMyGroupRole);
  const [mediaAttachments, setMediaAttachments] = useState([]); // [{ uri, type, duration, thumbnailUri, muteAudio }]
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [videoPreviewing, setVideoPreviewing] = useState(null); // { uri, duration } when preview modal is open
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [inputHeight, setInputHeight] = useState(100);

  const [typingUsers, setTypingUsers] = useState({}); // { [userId]: userName }
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const handleTextChange = useCallback((text) => {
    setMessageText(text);

    const socket = getSocket();
    if (!socket || !currentConversationId || !currentUser) return;

    if (!isTypingRef.current && text.length > 0) {
      isTypingRef.current = true;
      socket.emit("typing_start", {
        chatId: currentConversationId,
        userId: currentUser.id,
        userName: currentUser.name || "Someone",
      });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        socket.emit("typing_stop", {
          chatId: currentConversationId,
          userId: currentUser.id,
        });
      }
    }, 2000);
  }, [currentConversationId, currentUser]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const renderTypingIndicator = () => {
    const typingList = Object.values(typingUsers).filter(Boolean);
    if (typingList.length === 0) return null;

    let text;
    if (typingList.length === 1) {
      text = `${typingList[0]} is typing...`;
    } else if (typingList.length === 2) {
      text = `${typingList[0]} and ${typingList[1]} are typing...`;
    } else {
      text = "Several people are typing...";
    }

    return (
      <View style={typingStyles.container}>
        <Text style={typingStyles.text}>{text}</Text>
      </View>
    );
  };

  // highlight state lives in Reanimated (see highlightedIdSV below renderItem)

  const showAlert = (config) => setAlertConfig({ ...config, visible: true });
  const hideAlert = () => setAlertConfig((p) => ({ ...p, visible: false }));

  const flashListRef = useRef(null);
  const scrollOffsetRef = useRef(0);
  const inputRef = useRef(null);
  const subscriptionRef = useRef(null);
  const supabaseRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const groupParticipantsRef = useRef([]);
  const visibleItemIdsRef = useRef(new Set());
  const viewabilityConfigRef = useRef({ itemVisiblePercentThreshold: 50 });
  const onViewableItemsChangedRef = useRef(({ viewableItems }) => {
    const ids = new Set(
      viewableItems
        .filter((v) => v.item?.type === "message")
        .map((v) => v.item?.data?.id),
    );
    visibleItemIdsRef.current = ids;
  });
  const insets = useSafeAreaInsets();

  // Reanimated keyboard tracking
  const keyboardHeight = useSharedValue(0);
  useKeyboardHandler({
    onStart: (e) => {
      "worklet";
      keyboardHeight.value = e.height;
    },
    onMove: (e) => {
      "worklet";
      keyboardHeight.value = e.height;
    },
    onEnd: (e) => {
      "worklet";
      keyboardHeight.value = e.height;
    },
  });
  const containerAnimatedStyle = useAnimatedStyle(() => {
    const style = {
      marginBottom: inputHeight,
    };

    if (Platform.OS === "android") {
      style.transform = [{ translateY: -keyboardHeight.value }];
    }

    return style;
  });

  // Fetch current user for avatar metadata
  useEffect(() => {
    getActiveAccount().then((acc) => {
      if (acc) {
        setCurrentUser({
          id: acc.id,
          type: acc.type || "member",
          name: acc.name,
          username: acc.username,
          avatarUri: acc.profilePicture || acc.profile_picture || null,
        });
      }
    });
  }, []);

  // ── flatListData: memoised mixed separator + message list ──────────────────
  // buildMessageList now outputs newest→oldest directly (no .reverse() needed).
  const flatListData = useMemo(() => buildMessageList(messages), [messages]);

  // ΓöÇΓöÇ mediaTimeline: flattened array of all media in the chat ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const mediaTimeline = useMemo(() => {
    const timeline = [];
    messages.forEach((msg) => {
      if (msg.isDeleted) return;
      const isMyMessage = isGroup
        ? String(msg.senderId) === String(currentUser?.id) &&
          (msg.senderType || "member") === (currentUser?.type || "member")
        : msg.senderId !== (recipient?.id || recipientId);
      const senderName = isMyMessage
        ? "You"
        : msg.senderName || recipient?.name;
      const avatarUri = isMyMessage
        ? currentUser?.avatarUri || "https://via.placeholder.com/30"
        : isGroup
          ? msg.senderPhotoUrl || "https://via.placeholder.com/30"
          : recipient?.profilePhotoUrl || "https://via.placeholder.com/30";
      const commonData = {
        messageId: msg.id,
        createdAt: msg.createdAt,
        isMyMessage,
        senderName,
        avatarUri,
      };

      if (msg.messageType === "image" || msg.messageType === "video") {
        if (!msg.metadata?.url) return;
        timeline.push({
          id: msg.id,
          uri: msg.metadata.url,
          type: msg.messageType,
          duration: msg.metadata.duration,
          muteAudio: msg.metadata.mute_audio ?? false,
          width: msg.metadata.width || null,
          height: msg.metadata.height || null,
          indexInMessage: 0,
          ...commonData,
        });
      } else if (
        msg.messageType === "multi_media" &&
        Array.isArray(msg.metadata)
      ) {
        msg.metadata.forEach((item, index) => {
          if (!item.url) return;
          timeline.push({
            id: `${msg.id}_${index}`,
            uri: item.url,
            type: item.resource_type === "video" ? "video" : "image",
            duration: item.duration,
            muteAudio: item.mute_audio ?? false,
            width: item.width || null,
            height: item.height || null,
            indexInMessage: index,
            ...commonData,
          });
        });
      }
    });
    // Ensure chronological order
    return timeline.sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    );
  }, [messages, currentUser]);

  // Map message id ΓåÆ index in flatListData for scroll-to-reply
  const messageIndexMap = useMemo(() => {
    const map = {};
    flatListData.forEach((item, idx) => {
      if (item.type === "message") map[item.data.id] = idx;
    });
    return map;
  }, [flatListData]);

  // ΓöÇΓöÇ scrollToMessage ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const scrollToMessage = useCallback(
    (targetId) => {
      const idx = messageIndexMap[targetId];
      if (idx == null) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      flashListRef.current?.scrollToIndex({
        index: idx,
        animated: true,
        viewPosition: 0.5,
      });
      highlightedIdSV.value = String(targetId);
      setTimeout(() => {
        highlightedIdSV.value = "";
      }, 1600);
    },
    [messageIndexMap, highlightedIdSV],
  );

  const handleReply = useCallback(
    (msg, isMyMessage) => {
      setSelectedReply({
        id: msg.id,
        messageText:
          msg.messageType === "multi_media"
            ? "Media"
            : msg.messageType === "image"
              ? "Photo"
              : msg.messageType === "video"
                ? "Video"
                : msg.messageText,
        messageType: msg.messageType,
        senderName: isMyMessage ? "You" : msg.senderName || recipient?.name,
        isDeleted: msg.isDeleted,
        isPostShare: msg.messageType === "post_share",
        postAuthorUsername:
          msg.metadata?.authorUsername || msg.metadata?.author_username,
        postCaption: msg.metadata?.caption,
      });
    },
    [recipient?.name],
  );

  const handleLongPress = useCallback((msg) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOptionsTarget(msg);
  }, []);

  const handleRSVP = useCallback(
    async (msg, response) => {
      const giftId = msg.metadata?.giftId;
      if (!giftId) {
        showAlert({
          title: "Error",
          message: "Unable to process RSVP",
          primaryAction: { text: "OK", onPress: hideAlert },
          icon: TriangleAlert,
        });
        return;
      }
      const nextLoadingState = { ...rsvpLoadingRef.current, [msg.id]: true };
      rsvpLoadingRef.current = nextLoadingState;
      setRsvpLoading(nextLoadingState);
      try {
        const result = await confirmGiftRSVP(giftId, response);
        if (result.success) {
          updateMessageById(msg.id, {
            metadata: { ...msg.metadata, status: result.status },
          });
          showAlert({
            title: response === "going" ? "You're In! 🎁" : "Maybe Next Time",
            message: result.message,
            primaryAction: { text: "Sweet!", onPress: hideAlert },
            icon: PartyPopper,
            iconColor: COLORS.primary,
          });
        }
      } catch (err) {
        showAlert({
          title: "Error",
          message: err?.message || "Failed to confirm RSVP",
          primaryAction: { text: "OK", onPress: hideAlert },
          icon: TriangleAlert,
        });
      } finally {
        const doneState = { ...rsvpLoadingRef.current, [msg.id]: false };
        rsvpLoadingRef.current = doneState;
        setRsvpLoading(doneState);
      }
    },
    [updateMessageById],
  );

  const handleOpenViewer = useCallback(
    (mediaId) => {
      const idx = mediaTimeline.findIndex((m) => m.id === mediaId);
      if (idx !== -1) {
        setViewerIndex(idx);
        setViewerVisible(true);
      }
    },
    [mediaTimeline],
  );

  const handlePressPostShare = useCallback(
    (postId, postData) => {
      if (postData?.post_type === "community_voice" && postData?.type_data) {
        const { target_id, target_type } = postData.type_data;
        if (target_id && target_type) {
          const nav = navigation.getParent()?.getParent() || navigation;
          if (target_type === "community") {
            nav.navigate("CommunityPublicProfile", {
              communityId: target_id,
              viewerRole: "member",
              initialTab: "community",
              postId: postId || postData?.id || postData?.postId,
            });
          } else if (target_type === "member") {
            nav.navigate("MemberPublicProfile", {
              memberId: target_id,
              initialTab: "community",
              postId: postId || postData?.id || postData?.postId,
            });
          }
          return;
        }
      }

      setSharedPosts((prev) => ({ ...prev, [postId]: postData }));
      setSelectedSharedPost(postData);
      setSharedPostModalVisible(true);
    },
    [navigation],
  );

  const handlePressUser = useCallback(
    (userId, userType) => {
      const nav = navigation.getParent()?.getParent() || navigation;
      if (userType === "community") {
        nav.navigate("CommunityPublicProfile", {
          communityId: userId,
          viewerRole: "member",
        });
      } else {
        nav.navigate("MemberPublicProfile", { memberId: userId });
      }
    },
    [navigation],
  );

  const handlePressOpportunity = useCallback(
    (opportunityId, metadata) => {
      const nav = navigation.getParent()?.getParent() || navigation;
      nav.navigate("OpportunityView", {
        opportunityId,
        opportunity: { id: opportunityId, ...metadata },
      });
    },
    [navigation],
  );

  const handlePressEvent = useCallback(
    (eventId) => {
      const nav = navigation.getParent()?.getParent() || navigation;
      nav.navigate("EventDetails", { eventId });
    },
    [navigation],
  );

  // ΓöÇΓöÇ loadMessages ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  // loadMessages replaced by useChatPagination.loadInitial()

  // ΓöÇΓöÇ initializeConversation ────────────────────────────────────────────────────────
  useEffect(() => {
    const tStartInit = global.performance ? global.performance.now() : Date.now();
    if (tappedAt) {
      console.log(`[PERF] Tap to ChatScreen useEffect init: ${(tStartInit - tappedAt).toFixed(2)}ms`);
    }
    const init = async () => {
      setMessagesLoading(true);
      try {
        if (conversationId) {
          setCurrentConversationId(conversationId);
          const tStartLoad = global.performance ? global.performance.now() : Date.now();
          await loadInitial(conversationId);
          const tEndLoad = global.performance ? global.performance.now() : Date.now();
          console.log(`[PERF] loadInitial (conversationId exists) took: ${(tEndLoad - tStartLoad).toFixed(2)}ms`);
          EventBus.emit("messages-read");
          // For group chats: fetch restriction flag + current user role
          if (isGroup) {
            try {
              const gpRes = await getGroupParticipants(conversationId);
              setMessagingRestricted(gpRes.messagingRestricted || false);
              // find current user's role by matching token user — we get it from auth via getConversations
              // We store it after we also load current user identity below
              if (gpRes._myRole) setMyGroupRole(gpRes._myRole); // populated below
            } catch {
              /* non-fatal */
            }
          }
        } else if (recipientId) {
          // 1. Resolve conversation with recipient using lightweight endpoint
          const tResolveStart = global.performance ? global.performance.now() : Date.now();
          const resolvedRes = await resolveConversation(recipientId, recipientType);
          const tResolveEnd = global.performance ? global.performance.now() : Date.now();
          console.log(`[PERF] resolveConversation took: ${(tResolveEnd - tResolveStart).toFixed(2)}ms`);

          const resolvedConvId = resolvedRes?.conversationId || null;

          // 2. Fetch the recipient details if not pre-seeded
          let recipientPromise = Promise.resolve(null);
          if (!recipient) {
            if ((recipientType || "member") === "community") {
              recipientPromise = getPublicCommunity(recipientId).then((p) => ({
                id: p.id,
                name: p.name,
                username: p.username,
                profilePhotoUrl: p.logo_url,
                type: "community"
              }));
            } else {
              recipientPromise = getPublicMemberProfile(recipientId).then((p) => ({
                id: p.id,
                name: p.full_name || p.name,
                username: p.username,
                profilePhotoUrl: p.profile_photo_url,
                you_have_blocked: !!p?.you_have_blocked,
                type: "member"
              }));
            }
          }

          // Fetch profile/block status concurrently with loading the initial messages if conversation exists
          const promises = [recipientPromise];
          let loadInitialIndex = -1;
          if (resolvedConvId) {
            loadInitialIndex = promises.length;
            promises.push(loadInitial(resolvedConvId));
          }

          const tPromisesStart = global.performance ? global.performance.now() : Date.now();
          const results = await Promise.all(promises);
          const tPromisesEnd = global.performance ? global.performance.now() : Date.now();
          if (loadInitialIndex !== -1) {
            console.log(`[PERF] loadInitial + recipientPromise concurrent took: ${(tPromisesEnd - tPromisesStart).toFixed(2)}ms`);
          } else {
            console.log(`[PERF] recipientPromise took: ${(tPromisesEnd - tPromisesStart).toFixed(2)}ms`);
          }

          const recipientResult = results[0];

          if (recipientResult) {
            setRecipient(recipientResult);
            if (recipientResult.type === "member") {
              setYouHaveBlocked(!!recipientResult.you_have_blocked);
            }
          }

          if (resolvedConvId) {
            setCurrentConversationId(resolvedConvId);
            EventBus.emit("messages-read");
          } else {
            setCurrentConversationId(null);
          }
          setCurrentRecipientId(recipientId);
          setCurrentRecipientType(recipientType || "member");
        }
      } catch (err) {
        console.error("Error initializing conversation:", err);
        showAlert({
          title: "Error",
          message: err?.message || "Failed to load conversation.",
          primaryAction: {
            text: "OK",
            onPress: () => {
              hideAlert();
              navigation.goBack();
            },
          },
          icon: TriangleAlert,
        });
      } finally {
        setLoading(false);
        setMessagesLoading(false);
        const tEndAll = global.performance ? global.performance.now() : Date.now();
        console.log(`[PERF] Total ChatScreen initialization took: ${(tEndAll - tStartInit).toFixed(2)}ms`);
      }
    };
    init();
  }, [conversationId, recipientId, recipientType]);

  useEffect(() => {
    if (firstRenderRef.current && !messagesLoading) {
      firstRenderRef.current = false;
      const tEnd = global.performance ? global.performance.now() : Date.now();
      console.log(`[PERF] FlatList rendered with messages: ${(tEnd - t0Ref.current).toFixed(2)}ms since ChatScreen mount`);
    }
  });

  // ——— load recipient from conversationId ———————————————————————————————————————————
  useEffect(() => {
    if (!conversationId || recipient) return;
    (async () => {
      try {
        const res = await getConversations();
        const conv = res.conversations?.find((c) => c.id === conversationId);
        if (conv?.otherParticipant) {
          setRecipient(conv.otherParticipant);
          const rId = conv.otherParticipant.id;
          const rType = conv.otherParticipant.type || "member";
          if (rId) setCurrentRecipientId(rId);
          if (rType) setCurrentRecipientType(rType);
          // Track if this user has blocked us — so we can anonymize their header
          if (conv.otherParticipant.isBlockedByOther) setIsBlockedByOther(true);

          if (rId && rType === "member") {
            const p = await getPublicMemberProfile(rId);
            setYouHaveBlocked(!!p?.you_have_blocked);
          }
        }
      } catch (err) {
        console.error("Error loading recipient:", err);
      }
    })();
  }, [conversationId, recipient]);

  // ——— Background-refresh group restriction + role (stale-while-revalidate) ———————————
  // Initial values already seeded from route.params (zero-latency, set at render time).
  // This effect silently validates them against the server in case the admin
  // toggled restriction between when the conversations list loaded and now.
  useEffect(() => {
    if (!isGroup || !currentConversationId) return;
    (async () => {
      try {
        const gpRes = await getGroupParticipants(currentConversationId);
        setMessagingRestricted(gpRes.messagingRestricted || false);
        if (gpRes._myRole) setMyGroupRole(gpRes._myRole);
        if (gpRes.participants)
          groupParticipantsRef.current = gpRes.participants;
      } catch {
        /* non-fatal — initial values from params still correct */
      }
    })();
  }, [isGroup, currentConversationId]);

  // ——— Supabase Realtime Subscription ————————————————————————————————————————————————
  useRealtimeSubscription({
    table: 'messages',
    event: '*',
    filter: currentConversationId ? `conversation_id=eq.${currentConversationId}` : null,
    onData: (payload) => {
      if (payload.eventType === "INSERT") {
        const m = payload.new;
        // Don't duplicate self-sent messages (already inserted locally)
        if (currentUser?.id && String(m.sender_id) === String(currentUser.id)) {
          return;
        }
        console.log("[ChatScreen] Realtime new message received:", m.id);
        addNewMessage({
          id: m.id,
          senderId: m.sender_id,
          senderType: m.sender_type,
          messageText: m.message_text,
          messageType: m.message_type,
          metadata: m.metadata,
          isDeleted: m.is_deleted,
          deletedByType: m.deleted_by_type,
          replyToMessageId: m.reply_to_message_id,
          isRead: m.is_read,
          createdAt: m.created_at,
        });
      } else if (payload.eventType === "UPDATE") {
        console.log("[ChatScreen] Realtime message update received:", payload.new.id);
        updateMessageById(payload.new.id, {
          isDeleted: payload.new.is_deleted,
          deletedByType: payload.new.deleted_by_type,
          messageText: payload.new.is_deleted ? null : payload.new.message_text,
        });
      }
    }
  });

  // ——— Socket.io Room Joins & Leaves —————————————————————————————————──────────────
  useEffect(() => {
    if (!currentConversationId) return;

    const socket = getSocket();
    if (socket) {
      console.log(`[ChatScreen] Joining socket chat room: chat_${currentConversationId}`);
      socket.emit("join_chat", currentConversationId);
    }

    return () => {
      if (socket) {
        console.log(`[ChatScreen] Leaving socket chat room: chat_${currentConversationId}`);
        socket.emit("leave_chat", currentConversationId);
      }
    };
  }, [currentConversationId]);

  // ——— Socket.io Typing Listeners —————————————————————————————————─────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleUserTyping = ({ userId, userName }) => {
      console.log("[ChatScreen] User is typing:", userId, userName);
      setTypingUsers(prev => ({ ...prev, [userId]: userName }));
    };

    const handleUserStoppedTyping = ({ userId }) => {
      console.log("[ChatScreen] User stopped typing:", userId);
      setTypingUsers(prev => {
        const copy = { ...prev };
        delete copy[userId];
        return copy;
      });
    };

    socket.on("user_typing", handleUserTyping);
    socket.on("user_stopped_typing", handleUserStoppedTyping);

    return () => {
      socket.off("user_typing", handleUserTyping);
      socket.off("user_stopped_typing", handleUserStoppedTyping);
    };
  }, []);

  const handleSend = async () => {
    const hasText = messageText.trim().length > 0;
    const hasMedia = mediaAttachments.length > 0;
    if ((!hasText && !hasMedia) || sending || uploadingMedia) return;

    const text = messageText.trim();
    const replyId = selectedReply?.id || null;
    const replyPreviewObj = selectedReply ? { ...selectedReply } : null;
    const attachmentsSnap = [...mediaAttachments];

    setMessageText("");
    setSelectedReply(null);
    setMediaAttachments([]);
    setSending(true);

    try {
      const finalRecipientId =
        currentRecipientId || recipientId || recipient?.id;
      const finalRecipientType =
        currentRecipientType || recipientType || recipient?.type || "member";
      if (!finalRecipientId && !currentConversationId)
        throw new Error("Recipient information is missing.");

      if (attachmentsSnap.length === 0) {
        // ——— Text-only message ——————————————————————————————————————————————————————
        const response = await sendMessage({
          conversationId: currentConversationId || undefined,
          recipientId: currentConversationId ? undefined : finalRecipientId,
          recipientType: finalRecipientType,
          messageText: text,
          messageType: "text",
          reply_to_message_id: replyId,
          metadata: null,
        });
        const msg = { ...response.message, replyPreview: replyPreviewObj };
        if (!currentConversationId)
          setCurrentConversationId(msg.conversationId);
        addNewMessage(msg);
        EventBus.emit("conversation-updated", {
          conversationId: msg.conversationId,
          lastMessage: msg.messageText,
          lastMessageAt: msg.createdAt,
          otherParticipant: recipient
            ? { ...recipient, type: finalRecipientType }
            : { id: finalRecipientId, type: finalRecipientType },
        });
      } else {
        // ——— Multi-media: upload all in parallel, send sequentially ——————————————————
        setUploadingMedia(true);
        setUploadProgress(0);

        const totalItems = attachmentsSnap.length;
        const progressArr = new Array(totalItems).fill(0);

        const uploadedItems = await Promise.all(
          attachmentsSnap.map((attachment, idx) =>
            uploadChatMedia(attachment.uri, attachment.type, {
              onProgress: (p) => {
                progressArr[idx] = p;
                const avg = progressArr.reduce((a, b) => a + b, 0) / totalItems;
                setUploadProgress(avg);
              },
            }).then((u) => ({ uploaded: u, type: attachment.type })),
          ),
        );

        setUploadingMedia(false);

        // Send media as a SINGLE message (if single, use its type. if multiple, use multi_media)
        let resolvedConvId = currentConversationId;
        const isMulti = uploadedItems.length > 1;
        const messageType = isMulti ? "multi_media" : uploadedItems[0].type;

        const metadata = isMulti
          ? uploadedItems.map(({ uploaded }, idx) => ({
              url: uploaded.url,
              public_id: uploaded.public_id,
              resource_type: uploaded.resource_type,
              duration: uploaded.duration,
              thumbnail_url: uploaded.thumbnail_url,
              width: uploaded.width,
              height: uploaded.height,
              mute_audio: attachmentsSnap[idx]?.muteAudio ?? false,
            }))
          : {
              url: uploadedItems[0].uploaded.url,
              public_id: uploadedItems[0].uploaded.public_id,
              resource_type: uploadedItems[0].uploaded.resource_type,
              duration: uploadedItems[0].uploaded.duration,
              thumbnail_url: uploadedItems[0].uploaded.thumbnail_url,
              width: uploadedItems[0].uploaded.width,
              height: uploadedItems[0].uploaded.height,
              mute_audio: attachmentsSnap[0]?.muteAudio ?? false,
            };

        const response = await sendMessage({
          conversationId: resolvedConvId || undefined,
          recipientId: resolvedConvId ? undefined : finalRecipientId,
          recipientType: finalRecipientType,
          messageText: text,
          messageType: messageType,
          reply_to_message_id: replyId,
          metadata,
        });

        const msg = { ...response.message, replyPreview: replyPreviewObj };
        if (!resolvedConvId) resolvedConvId = msg.conversationId;
        if (!currentConversationId && resolvedConvId)
          setCurrentConversationId(resolvedConvId);
        addNewMessage(msg);

        const previewLabel = isMulti
          ? `${uploadedItems.length} ≡ƒô╖ Media`
          : messageType === "image"
            ? "≡ƒô╖ Photo"
            : "≡ƒÄÑ Video";

        EventBus.emit("conversation-updated", {
          conversationId: resolvedConvId,
          lastMessage: previewLabel,
          lastMessageAt: msg.createdAt,
          otherParticipant: recipient
            ? { ...recipient, type: finalRecipientType }
            : { id: finalRecipientId, type: finalRecipientType },
        });
      }

      EventBus.emit("new-message");
      setTimeout(() => {
        flashListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    } catch (err) {
      console.error("Error sending message:", err);
      setMessageText(text);
      setUploadingMedia(false);
      if (err?.status === 403 && err?.data?.error === "you_have_blocked") {
        showAlert({
          title: "You've blocked this user",
          message: "Unblock them first to send messages.",
          primaryAction: {
            text: "Unblock",
            onPress: () => {
              hideAlert();
              handleUnblockUser();
            },
          },
          secondaryAction: { text: "Cancel", onPress: hideAlert },
          icon: UserX,
        });
      } else {
        showAlert({
          title: "Error",
          message: err?.message || "Failed to send message.",
          primaryAction: { text: "OK", onPress: hideAlert },
          icon: TriangleAlert,
        });
      }
    } finally {
      setSending(false);
      setUploadProgress(0);
    }
  };

  // ——— handleCustomPickerDone ————————————————————————————————————————————————————
  // Called by CustomImagePicker when the user taps Done.
  // Assets already filtered by picker (too-long videos are greyed out/unselectable).
  const handleCustomPickerDone = useCallback(
    async (assets) => {
      setMediaPickerOpen(false);
      if (!assets?.length) return;

      // Filter out over-size items (safety net)
      const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
      const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

      const valid = assets.filter((a) => {
        const isVideo = a.mediaType === "video";
        const max = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
        return !(a.fileSize && a.fileSize > max);
      });

      if (valid.length < assets.length) {
        showAlert({
          title: "Some files skipped",
          message:
            "One or more files exceeded the size limit and were removed.",
          primaryAction: { text: "OK", onPress: hideAlert },
          icon: TriangleAlert,
        });
      }

      if (!valid.length) return;

      // If exactly one video is selected, show the send-preview modal first
      if (valid.length === 1 && valid[0].mediaType === "video") {
        setVideoPreviewing({
          uri: valid[0].uri,
          duration: valid[0].duration ?? null,
        });
        return;
      }

      // Otherwise (images only, or mixed batch) build attachments immediately.
      // Generate local thumbnails for any videos in the batch.
      const attachments = await Promise.all(
        valid.map(async (a) => {
          let thumbnailUri = null;
          if (a.mediaType === "video") {
            try {
              const thumb = await getVideoThumbnailAsync(a.uri, { time: 0 });
              thumbnailUri = thumb.uri;
            } catch (_) {}
          }
          return {
            uri: a.uri,
            type: a.mediaType === "video" ? "video" : "image",
            duration: a.duration ?? null,
            thumbnailUri: thumbnailUri,
            muteAudio: false,
          };
        }),
      );

      setMediaAttachments(attachments);
    },
    [showAlert, hideAlert],
  );

  // Called by VideoSendPreviewModal when the user confirms send
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
      setMediaAttachments([
        {
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

  // ——— handleUnsend ————————————————————————————————————————————————————————————————
  const handleUnsend = async (id) => {
    // Optimistic: mark deleted immediately on the UI thread
    updateMessageById(id, {
      isDeleted: true,
      deletedByType: "sender",
      messageText: null,
    });
    try {
      await unsendMessage(id);
    } catch (err) {
      console.error("Unsend error:", err);
      showAlert({
        title: "Error",
        message: "Could not unsend message.",
        primaryAction: { text: "OK", onPress: hideAlert },
        icon: TriangleAlert,
      });
      // Revert on failure
      updateMessageById(id, {
        isDeleted: false,
        deletedByType: null,
        messageText: undefined,
      });
    }
  };

  // ——— handleDeleteChat ————————————————————————————————————————————————————————————
  const handleDeleteChat = () => {
    setChatActionsVisible(false);
    setTimeout(() => {
      showAlert({
        title: "Delete Chat",
        message:
          "This chat will be removed from your inbox. The other person won't be notified.",
        icon: Trash2,
        iconColor: "#E53935",
        secondaryAction: { text: "Cancel", onPress: hideAlert },
        primaryAction: {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            hideAlert();
            try {
              await hideConversation(currentConversationId);
              EventBus.emit("conversation-deleted", {
                conversationId: currentConversationId,
              });
              navigation.goBack();
            } catch (err) {
              showAlert({
                title: "Error",
                message: err?.message || "Failed to delete chat.",
                primaryAction: { text: "OK", onPress: hideAlert },
                icon: TriangleAlert,
              });
            }
          },
        },
      });
    }, 300);
  };

  // ——— handleMuteChat ——————————————————————————————————————————————————————————————
  const handleMuteChat = () => {
    setChatActionsVisible(false);
    if (isMuted) {
      // Unmute immediately
      setTimeout(async () => {
        try {
          await unmuteConversation(currentConversationId);
          setIsMuted(false);
          setMutedUntil(null);
          showAlert({
            title: "Unmuted",
            message: "You'll now receive notifications for this conversation.",
            icon: Bell,
            iconColor: "#34C759",
            primaryAction: { text: "OK", onPress: hideAlert },
          });
        } catch {
          showAlert({
            title: "Error",
            message: "Failed to unmute. Please try again.",
            primaryAction: { text: "OK", onPress: hideAlert },
            icon: TriangleAlert,
          });
        }
      }, 300);
    } else {
      // Show duration picker
      const MUTE_DURATIONS = [
        { label: "For 1 hour", ms: 60 * 60 * 1000 },
        { label: "For 8 hours", ms: 8 * 60 * 60 * 1000 },
        { label: "For 24 hours", ms: 24 * 60 * 60 * 1000 },
        { label: "Until I change it", ms: null },
      ];
      setTimeout(() => {
        showAlert({
          title: "Mute Notifications",
          message: "How long would you like to mute this conversation?",
          icon: BellOff,
          iconColor: "#FF9F0A",
          secondaryAction: { text: "Cancel", onPress: hideAlert },
          durationOptions: MUTE_DURATIONS,
          onDurationSelect: async (dur) => {
            hideAlert();
            const until = dur.ms
              ? new Date(Date.now() + dur.ms).toISOString()
              : null;
            try {
              await muteConversation(currentConversationId, until);
              setIsMuted(true);
              setMutedUntil(until);
            } catch {
              showAlert({
                title: "Error",
                message: "Failed to mute. Please try again.",
                primaryAction: { text: "OK", onPress: hideAlert },
                icon: TriangleAlert,
              });
            }
          },
        });
      }, 300);
    }
  };

  // ——— handleStartReport ————————————————————————————————————————————————————————————
  const handleStartReport = () => {
    setChatActionsVisible(false);
    setTimeout(() => setReportSheetVisible(true), 300);
  };

  // ——— handleBlockUser ———————————————————————————————————————————————————————————————
  const handleBlockUser = () => {
    setChatActionsVisible(false);
    setTimeout(() => {
      const recipientName = recipient?.name || "this user";
      showAlert({
        title: `Block ${recipientName}?`,
        message:
          "They won't be able to message you or find your profile. You can unblock them anytime from Settings → Blocked Users.",
        icon: UserX,
        iconColor: "#E53935",
        secondaryAction: { text: "Cancel", onPress: hideAlert },
        primaryAction: {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            hideAlert();
            try {
              const token = await (
                await import("../../api/auth")
              ).getAuthToken();
              await blockUser(
                currentRecipientId || recipientId || recipient?.id,
                token,
              );
              showAlert({
                title: "Blocked",
                message: `${recipientName} has been blocked.`,
                icon: CircleCheck,
                iconColor: "#34C759",
                primaryAction: {
                  text: "OK",
                  onPress: () => {
                    hideAlert();
                    navigation.goBack();
                  },
                },
              });
            } catch (err) {
              showAlert({
                title: "Error",
                message:
                  err?.message || "Failed to block user. Please try again.",
                primaryAction: { text: "OK", onPress: hideAlert },
                icon: TriangleAlert,
              });
            }
          },
        },
      });
    }, 300);
  };

  // ——— handleUnblockUser —————————————————————————————————————————————————————————————
  const handleUnblockUser = useCallback(async () => {
    const finalRecipientId = currentRecipientId || recipientId || recipient?.id;
    if (!finalRecipientId) return;
    try {
      setUnblocking(true);
      const token = await (await import("../../api/auth")).getAuthToken();
      await unblockUser(finalRecipientId, token);
      setYouHaveBlocked(false);
      // Re-fetch messages so B's messages that were hidden during the block now appear for A
      if (currentConversationId) {
        await loadInitial(currentConversationId);
      }
    } catch (err) {
      showAlert({
        title: "Error",
        message: err?.message || "Failed to unblock user. Please try again.",
        primaryAction: { text: "OK", onPress: hideAlert },
        icon: TriangleAlert,
        iconColor: "#E53935",
      });
    } finally {
      setUnblocking(false);
    }
  }, [
    currentRecipientId,
    recipientId,
    recipient?.id,
    currentConversationId,
    loadInitial,
    showAlert,
    hideAlert,
  ]);

  const handleReportReason = async (reason) => {
    setReportSheetVisible(false);

    if (!currentConversationId) {
      setTimeout(() => {
        showAlert({
          title: "Cannot Report",
          message:
            "This conversation hasn't started yet. Send a message first.",
          primaryAction: { text: "OK", onPress: hideAlert },
          icon: TriangleAlert,
        });
      }, 300);
      return;
    }

    try {
      await reportConversation(
        currentConversationId,
        reason.key,
        reason.details || reason.label,
      );
      setTimeout(() => {
        showAlert({
          title: "Report Submitted",
          message:
            "Thanks for letting us know. Our team will review this conversation.",
          icon: CircleCheck,
          iconColor: "#34C759",
          primaryAction: { text: "OK", onPress: hideAlert },
        });
      }, 300);
    } catch (err) {
      const alreadyReported =
        err?.message?.toLowerCase().includes("unique") ||
        err?.message?.toLowerCase().includes("already") ||
        err?.status === 409;
      setTimeout(() => {
        showAlert({
          title: alreadyReported ? "Already Reported" : "Error",
          message: alreadyReported
            ? "You've already reported this conversation. Our team is reviewing it."
            : err?.message || "Failed to submit report. Please try again.",
          primaryAction: { text: "OK", onPress: hideAlert },
          icon: alreadyReported ? CircleCheck : TriangleAlert,
          iconColor: alreadyReported ? "#FF9800" : undefined,
        });
      }, 300);
    }
  };

  // ——— shouldShowAvatar —————————————————————————————————————————————————————————————
  const shouldShowAvatar = useCallback((message, nextMessage, isMine) => {
    // My messages never show an avatar
    if (isMine) return false;
    if (!nextMessage) return true;
    if (nextMessage.senderId !== message.senderId) return true;

    // Use pre-cached timestamps to avoid new Date overhead
    const timeA = message._time || (message._time = new Date(message.createdAt).getTime());
    const timeB = nextMessage._time || (nextMessage._time = new Date(nextMessage.createdAt).getTime());
    const diff = Math.abs(timeB - timeA);
    return diff > 60000;
  }, []);

  // highlightedIdSV lives on the UI thread — writing to it triggers
  // animations in SwipeableMessage without any React re-renders.
  const highlightedIdSV = useSharedValue("");

  // ——— renderItem ———————————————————————————————————————————————————————————————————
  const renderItem = useCallback(
    ({ item, index }) => {
      if (item.type === "separator") {
        return <TimestampSeparator label={item.label} />;
      }

      const msg = item.data;

      // System messages don't need a wrapper with gestures.
      if (msg.messageType === "system") {
        return (
          <View style={styles.systemRow}>
            <Text style={styles.systemText}>{msg.messageText}</Text>
          </View>
        );
      }

      const isMyMessage = isGroup
        ? String(msg.senderId) === String(currentUser?.id) &&
          (msg.senderType || "member") === (currentUser?.type || "member")
        : msg.senderId !== (recipient?.id || recipientId);

      const nextItem = flatListData[index + 1];
      const nextMsg = nextItem?.type === "message" ? nextItem.data : null;
      const showAvatar = shouldShowAvatar(msg, nextMsg, isMyMessage);
      const showSenderName =
        isGroup &&
        !isMyMessage &&
        (!nextMsg || nextMsg.senderId !== msg.senderId);

      return (
        <MessageRow
          item={item}
          index={index}
          isMyMessage={isMyMessage}
          showAvatar={showAvatar}
          showSenderName={showSenderName}
          isGroup={isGroup}
          currentUser={currentUser}
          recipient={recipient}
          recipientId={recipientId}
          isBlockedByOther={isBlockedByOther}
          rsvpLoading={rsvpLoadingRef.current[msg.id]}
          highlightedIdSV={highlightedIdSV}
          onReply={handleReply}
          onLongPress={handleLongPress}
          onRSVP={handleRSVP}
          onOpenViewer={handleOpenViewer}
          onPressPostShare={handlePressPostShare}
          onPressUser={handlePressUser}
          onPressOpportunity={handlePressOpportunity}
          onPressEvent={handlePressEvent}
          onPressReplyQuote={scrollToMessage}
          navigation={navigation}
        />
      );
    },
    [
      isGroup,
      currentUser,
      recipient,
      recipientId,
      isBlockedByOther,
      // ── PERF: flatListData and rsvpLoading removed from deps.
      //    flatListData rebuilds on every poll cycle; having it here caused renderItem
      //    to be recreated every 3 seconds, forcing all visible rows to re-evaluate.
      //    rsvpLoading is now read from rsvpLoadingRef.current (zero re-render cost).
      shouldShowAvatar,
      highlightedIdSV,
      handleReply,
      handleLongPress,
      handleRSVP,
      handleOpenViewer,
      handlePressPostShare,
      handlePressUser,
      handlePressOpportunity,
      handlePressEvent,
      scrollToMessage,
      navigation,
    ],
  );

  // ——— Loading screen —————————————————————————————————————————————————————————————
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={{ height: insets.top, backgroundColor: "#FFFFFF" }} />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <ArrowLeft size={22} color="#333333" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.headerName}>Loading...</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <SnooLoader size="large" color={PRIMARY_COLOR} />
        </View>
      </View>
    );
  }

  // ΓöÇΓöÇ Main render ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={{ backgroundColor: "#FFFFFF", zIndex: 10 }}>
          <View style={{ height: insets.top }} />
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <ArrowLeft size={22} color="#333333" strokeWidth={2.5} />
            </TouchableOpacity>
            {isGroup ? (
              <>
                <TouchableOpacity
                  style={[
                    styles.headerInfo,
                    {
                      flex: 1,
                      flexDirection: "column",
                      alignItems: "flex-start",
                    },
                  ]}
                  onPress={() =>
                    navigation.navigate("GroupInfo", {
                      conversationId: currentConversationId,
                      groupName,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <Text style={styles.headerName} numberOfLines={1}>
                    {groupName || "Group"}
                  </Text>
                  <Text style={styles.headerUsername}>Tap to view info</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ padding: 8 }}
                  onPress={() => setChatActionsVisible(true)}
                >
                  <MoreVertical size={22} color="#8FA1B8" strokeWidth={2} />
                </TouchableOpacity>
              </>
            ) : (
              <>
                {recipient && (
                  <TouchableOpacity
                    style={styles.headerInfo}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (isBlockedByOther) return; // don't navigate to profile of user who blocked you
                      const nav =
                        navigation.getParent()?.getParent() || navigation;
                      if (currentRecipientType === "community") {
                        nav.navigate("CommunityPublicProfile", {
                          communityId: currentRecipientId || recipientId,
                          viewerRole: "member",
                        });
                      } else {
                        nav.navigate("MemberPublicProfile", {
                          memberId: currentRecipientId || recipientId,
                        });
                      }
                    }}
                  >
                    {isBlockedByOther ? (
                      <View
                        style={[
                          styles.headerAvatar,
                          {
                            backgroundColor: "#EFEFF4",
                            alignItems: "center",
                            justifyContent: "center",
                          },
                        ]}
                      >
                        <UserX size={18} color="#8E8E93" strokeWidth={1.5} />
                      </View>
                    ) : (
                      <Image
                        source={{ uri: recipient.profilePhotoUrl }}
                        style={styles.headerAvatar}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    )}
                    <View>
                      <Text style={styles.headerName} numberOfLines={1}>
                        {isBlockedByOther
                          ? "Snoospace User"
                          : recipient.name || "User"}
                      </Text>
                      {!isBlockedByOther && (
                        <Text style={styles.headerUsername} numberOfLines={1}>
                          @{recipient.username || "user"}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  style={{ padding: 8 }}
                  onPress={() => setChatActionsVisible(true)}
                >
                  <MoreVertical size={22} color="#8FA1B8" strokeWidth={2} />
                </TouchableOpacity>
              </>
            )}
          </View>
          {youHaveBlocked && (
            <View style={blockBannerStyles.banner}>
              <View style={blockBannerStyles.left}>
                <ShieldOff
                  size={18}
                  color="#E11D48"
                  strokeWidth={2}
                  style={{ marginRight: 8 }}
                />
                <Text style={blockBannerStyles.text}>
                  You've blocked this user
                </Text>
              </View>
              <TouchableOpacity
                style={blockBannerStyles.btn}
                onPress={handleUnblockUser}
                disabled={unblocking}
                activeOpacity={0.75}
              >
                <Text style={blockBannerStyles.btnText}>
                  {unblocking ? "Unblocking…" : "Unblock"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <Animated.View style={[{ flex: 1 }, containerAnimatedStyle]}>
            <FlatList
              ref={flashListRef}
              data={flatListData}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              inverted
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.listContent,
                { paddingTop: 12 + insets.bottom },
              ]}
              maintainVisibleContentPosition={{
                minIndexForVisible: 1,
                autoscrollToTopThreshold: 10,
              }}
              initialNumToRender={25}
              maxToRenderPerBatch={20}
              windowSize={15}
              removeClippedSubviews={Platform.OS === 'android'}
              updateCellsBatchingPeriod={20}
              scrollEventThrottle={16}
              onEndReached={() => {
                if (hasMore && !loadingOlder) {
                  loadOlderMessages(currentConversationId);
                }
              }}
              onEndReachedThreshold={0.3}
              ListFooterComponent={
                loadingOlder ? (
                  <View style={styles.loadingOlderContainer}>
                    <ActivityIndicator size="small" color={PRIMARY_COLOR} />
                  </View>
                ) : null
              }
              ListEmptyComponent={
                messagesLoading ? (
                  <View style={{ flex: 1, justifyContent: "center", alignItems: "center", minHeight: 200, transform: Platform.select({ android: [{ scaleY: -1 }, { scaleX: -1 }], default: [{ scaleY: -1 }] }) }}>
                    <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                  </View>
                ) : (
                  <View style={{ transform: Platform.select({ android: [{ scaleY: -1 }, { scaleX: -1 }], default: [{ scaleY: -1 }] }), width: "100%" }}>
                    <EmptyChatState />
                  </View>
                )
              }
              viewabilityConfig={viewabilityConfigRef.current}
              onViewableItemsChanged={onViewableItemsChangedRef.current}
            />

          </Animated.View>
        </KeyboardAvoidingView>

        <KeyboardAwareToolbar>
          <View
            style={{ flexDirection: "column" }}
            onLayout={(e) => {
              const { height } = e.nativeEvent.layout;
              if (height > 0) {
                setInputHeight(height);
              }
            }}
          >
            <ReplyBar
              reply={selectedReply}
              onClose={() => setSelectedReply(null)}
            />

            {renderTypingIndicator()}

            {/* ΓöÇΓöÇ Locked bar: shown to non-admins when messaging is restricted ΓöÇΓöÇ */}
            {isGroup && messagingRestricted && myGroupRole !== "admin" ? (
              <View style={styles.lockedBar}>
                <View style={styles.lockedBarIcon}>
                  <LockKeyhole size={16} color={ACCENT} strokeWidth={2} />
                </View>
                <Text style={styles.lockedBarText}>
                  Only admins can send messages
                </Text>
                <View style={styles.lockedBarBadge}>
                  <Megaphone
                    size={12}
                    color="#8FA1B8"
                    strokeWidth={2}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.lockedBarBadgeText}>Announcement</Text>
                </View>
              </View>
            ) : (
              <>
                {/* ΓöÇΓöÇ Media preview strip ΓöÇΓöÇ */}
                {mediaAttachments.length > 0 && (
                  <View style={styles.mediaPreviewStrip}>
                    {/* Scrollable thumbnail row */}
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.mediaPreviewScroll}
                      contentContainerStyle={styles.mediaPreviewScrollContent}
                    >
                      {mediaAttachments.map((att, idx) => (
                        <View key={idx} style={styles.mediaThumbContainer}>
                          <Image
                            source={{ uri: att.thumbnailUri || att.uri }}
                            style={styles.mediaPreviewThumb}
                            contentFit="cover"
                            cachePolicy="memory"
                          />
                          {att.type === "video" && (
                            <View style={styles.mediaPreviewVideoIcon}>
                              <Text style={{ fontSize: 9 }}>≡ƒÄÑ</Text>
                            </View>
                          )}
                          {/* Per-item remove button */}
                          <TouchableOpacity
                            style={styles.mediaThumbRemove}
                            onPress={() =>
                              setMediaAttachments((prev) =>
                                prev.filter((_, i) => i !== idx),
                              )
                            }
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <X size={12} color="#FFFFFF" strokeWidth={3} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>

                    {/* Caption input + close-all */}
                    <View style={styles.mediaCaptionRow}>
                      <TextInput
                        style={styles.mediaCaption}
                        placeholder={`Add a caption`}
                        placeholderTextColor="#B0BEC5"
                        value={messageText}
                        onChangeText={handleTextChange}
                        multiline
                        maxLength={500}
                      />
                      <TouchableOpacity
                        onPress={() => {
                          setMediaAttachments([]);
                          setMessageText("");
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <X size={18} color="#8FA1B8" strokeWidth={2.5} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* ΓöÇΓöÇ Regular input row ΓöÇΓöÇ */}
                <View style={styles.inputContent}>
                  {/* Attachment button ΓÇö opens CustomImagePicker directly */}
                  <TouchableOpacity
                    style={styles.attachBtn}
                    onPress={() => setMediaPickerOpen(true)}
                  >
                    <ImagePlus size={22} color={ACCENT} strokeWidth={2} />
                  </TouchableOpacity>

                  {!mediaAttachments.length && (
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
                      />
                    </View>
                  )}
                  {mediaAttachments.length > 0 && <View style={{ flex: 1 }} />}

                  <Pressable
                    style={({ pressed }) => [
                      styles.sendButton,
                      ((!messageText.trim() && !mediaAttachments.length) ||
                        sending ||
                        uploadingMedia) &&
                        styles.sendButtonDisabled,
                      pressed &&
                        (messageText.trim() || mediaAttachments.length) &&
                        !sending && { backgroundColor: SEND_BUTTON_PRESSED },
                    ]}
                    onPress={handleSend}
                    disabled={
                      (!messageText.trim() && !mediaAttachments.length) ||
                      sending ||
                      uploadingMedia
                    }
                  >
                    {sending || uploadingMedia ? (
                      <SnooLoader size="small" color="#FFFFFF" />
                    ) : (
                      <Send size={20} color="#FFFFFF" strokeWidth={2.6} />
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </KeyboardAwareToolbar>

        {!!optionsTarget && (
          <MessageOptionsModal
            visible={!!optionsTarget}
            isMyMessage={
              isGroup
                ? String(optionsTarget?.senderId) === String(currentUser?.id) &&
                  (optionsTarget?.senderType || "member") ===
                    (currentUser?.type || "member")
                : optionsTarget?.senderId !== (recipient?.id || recipientId)
            }
            onReply={() => {
              const isOwnMsg = isGroup
                ? String(optionsTarget?.senderId) === String(currentUser?.id) &&
                  (optionsTarget?.senderType || "member") ===
                    (currentUser?.type || "member")
                : optionsTarget?.senderId !== (recipient?.id || recipientId);
              setSelectedReply({
                id: optionsTarget.id,
                messageText: optionsTarget.messageText,
                senderName: isOwnMsg
                  ? "You"
                  : optionsTarget.senderName || recipient?.name,
                isDeleted: optionsTarget.isDeleted,
              });
              setOptionsTarget(null);
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
            onUnsend={() => {
              handleUnsend(optionsTarget.id);
              setOptionsTarget(null);
            }}
            onCancel={() => setOptionsTarget(null)}
          />
        )}

        {chatActionsVisible && (
          <ChatActionsSheet
            visible={chatActionsVisible}
            onClose={() => setChatActionsVisible(false)}
            onDeleteChat={handleDeleteChat}
            onReport={handleStartReport}
            onMute={handleMuteChat}
            isMuted={isMuted}
            onBlock={handleBlockUser}
            onUnblock={() => {
              setChatActionsVisible(false);
              handleUnblockUser();
            }}
            youHaveBlocked={youHaveBlocked}
            isGroup={isGroup}
          />
        )}

        {reportSheetVisible && (
          <ReportReasonSheet
            visible={reportSheetVisible}
            onClose={() => setReportSheetVisible(false)}
            onSelect={handleReportReason}
          />
        )}

        {sharedPostModalVisible && selectedSharedPost && (
          <ProfilePostFeed
            visible={sharedPostModalVisible}
            posts={[selectedSharedPost]}
            initialPostId={selectedSharedPost.id}
            onClose={() => {
              setSharedPostModalVisible(false);
              setSelectedSharedPost(null);
            }}
            currentUserId={currentUser?.id}
            currentUserType={currentUser?.type || "member"}
            onLikeUpdate={(postId, isLiked) =>
              setSelectedSharedPost((prev) => ({
                ...prev,
                is_liked: isLiked,
                isLiked,
                like_count: Math.max(
                  0,
                  (prev.like_count || 0) + (isLiked ? 1 : -1),
                ),
              }))
            }
            onComment={(postId, newCount) =>
              setSelectedSharedPost((prev) => ({
                ...prev,
                comment_count: newCount,
              }))
            }
            navigation={navigation}
          />
        )}

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

        {!!videoPreviewing && (
          <VideoSendPreviewModal
            visible={!!videoPreviewing}
            videoUri={videoPreviewing?.uri}
            duration={videoPreviewing?.duration}
            onClose={() => setVideoPreviewing(null)}
            onSend={handleVideoSendConfirm}
          />
        )}

        {viewerVisible && (
          <MediaViewerTimeline
            timeline={mediaTimeline}
            initialIndex={viewerIndex}
            visible={viewerVisible}
            onClose={() => setViewerVisible(false)}
            onReply={(mediaItem) => {
              setViewerVisible(false);
              setSelectedReply({
                id: mediaItem.messageId,
                messageText: mediaItem.type === "video" ? "Video" : "Photo",
                messageType: mediaItem.type === "video" ? "video" : "image",
                senderName: mediaItem.senderName,
                isDeleted: false,
              });
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
          />
        )}

        {alertConfig.visible && (
          <CustomAlertModal onClose={hideAlert} {...alertConfig} />
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CHAT_CANVAS_BG },
  keyboardView: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  headerAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8 },
  headerInfo: { flexDirection: "row", alignItems: "center" },
  headerName: {
    fontFamily: "BasicCommercial-Black",
    fontSize: 16,
    color: "#1F3A5F",
  },
  headerUsername: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: LIGHT_TEXT,
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },
  messagesList: { paddingHorizontal: 16, paddingTop: 130, paddingBottom: 10 },
  messageContainer: {
    flexDirection: "row",
    marginBottom: 8,
    alignItems: "flex-end",
  },
  myMessageContainer: { justifyContent: "flex-end" },
  otherMessageContainer: { justifyContent: "flex-start" },
  messageAvatar: { width: 30, height: 30, borderRadius: 15, marginRight: 8 },
  messageAvatarFallback: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
    backgroundColor: "#EFEFF4",
    alignItems: "center",
    justifyContent: "center",
  },
  messageBubble: {
    maxWidth: "100%",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 18,
  },
  myMessageBubble: {
    backgroundColor: OUTGOING_MESSAGE_BG,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: INCOMING_MESSAGE_BG,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: INCOMING_BORDER,
  },
  myMessageBubbleReplied: { borderTopRightRadius: 4 },
  otherMessageBubbleReplied: { borderTopLeftRadius: 4 },
  deletedBubble: { opacity: 0.55 },
  deletedText: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    color: LIGHT_TEXT,
    fontStyle: "italic",
  },
  messageText: { fontFamily: "Manrope-Regular", fontSize: 15, lineHeight: 21 },
  myMessageText: { color: MESSAGE_TEXT_COLOR },
  otherMessageText: { color: MESSAGE_TEXT_COLOR },
  messageTime: {
    fontFamily: "Manrope-Medium",
    fontSize: 10,
    alignSelf: "flex-end",
    opacity: 0.65,
    marginTop: 2,
  },
  myMessageTime: { color: MESSAGE_TEXT_COLOR },
  otherMessageTime: { color: MESSAGE_TEXT_COLOR },
  systemRow: { alignItems: "center", marginVertical: 6, paddingHorizontal: 16 },
  systemText: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: LIGHT_TEXT,
    fontStyle: "italic",
    opacity: 0.7,
    textAlign: "center",
  },
  groupSenderName: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 11,
    color: PRIMARY_COLOR,
    marginBottom: 2,
    marginLeft: 4,
  },
  inputContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
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

  // ΓöÇΓöÇ Locked announcement bar ΓöÇΓöÇ
  lockedBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: CHAT_CANVAS_BG,
    borderTopWidth: 1,
    borderTopColor: INCOMING_BORDER,
  },
  lockedBarIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(53,101,242,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  lockedBarText: {
    flex: 1,
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: LIGHT_TEXT,
  },
  lockedBarBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(143,161,184,0.12)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lockedBarBadgeText: {
    fontFamily: "Manrope-Medium",
    fontSize: 10,
    color: "#8FA1B8",
  },

  // ΓöÇΓöÇ Media preview strip ΓöÇΓöÇ
  mediaPreviewStrip: {
    borderTopWidth: 1,
    borderTopColor: INCOMING_BORDER,
    backgroundColor: CHAT_CANVAS_BG,
    paddingTop: 10,
    paddingBottom: 6,
  },
  mediaPreviewScroll: {
    flexGrow: 0,
  },
  mediaPreviewScrollContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  mediaThumbContainer: {
    position: "relative",
    marginRight: 2,
  },
  mediaPreviewThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: "#E0E0E0",
  },
  mediaPreviewVideoIcon: {
    position: "absolute",
    left: 24,
    top: 24,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaThumbRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaCaptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  mediaCaption: {
    flex: 1,
    marginRight: 10,
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    color: "#1F3A5F",
    maxHeight: 80,
  },

  // ── Attachment button ──
  attachBtn: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
});

const blockBannerStyles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF1F2",
    borderBottomWidth: 1,
    borderBottomColor: "#FFE4E6",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  text: {
    fontFamily: "Manrope-Medium",
    fontSize: 13,
    color: "#BE123C",
    flexShrink: 1,
  },
  btn: {
    backgroundColor: "#E11D48",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginLeft: 12,
  },
  btnText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
  },
});

const typingStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: "transparent",
  },
  text: {
    fontFamily: "Manrope-Medium",
    fontSize: 12,
    color: "#8FA1B8",
    fontStyle: "italic",
  },
});
