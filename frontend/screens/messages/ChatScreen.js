import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  Profiler,
} from "react";

import { msgContentTimings } from "../../components/SwipeableMessageRow";

const onRenderProfiler = (id, phase, actualDuration) => {
  console.log(
    `[PERF-RENDER] ${id} - Phase: ${phase}, Duration: ${actualDuration.toFixed(2)}ms`,
  );
};
const onRenderMsgProfiler = (id, phase, actualDuration) => {
  const match = id.match(/ROW-type=(.*) id=(.*)/);
  if (match) {
    const type = match[1];
    const msgId = match[2];
    const contentMs = msgContentTimings.get(String(msgId));
    if (contentMs !== undefined) {
      const wrapperMs = Math.max(0, actualDuration - contentMs);
      console.log(
        `[PERF-WRAP] type=${type} id=${msgId} phase:${phase} totalMs:${actualDuration.toFixed(2)} contentOnlyMs:${contentMs.toFixed(2)} wrapperSetupMs:${wrapperMs.toFixed(2)}`,
      );
      msgContentTimings.delete(String(msgId));
    } else {
      console.log(
        `[PERF-WRAP] type=${type} id=${msgId} phase:${phase} totalMs:${actualDuration.toFixed(2)} contentOnlyMs:${actualDuration.toFixed(2)} wrapperSetupMs:0.00 (skips wrapper)`,
      );
    }
  }
};
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
  Dimensions,
  InteractionManager,
  Animated as RNAnimated,
  Easing as RNEasing,
} from "react-native";

// How many messages to load on first open.
// Fills ~1.5 screens based on device height. 80px is a conservative average
// (text bubbles ~60px, card rows 240px but uncommon enough not to skew this).
// Clamped between 15 and 30 so we never fetch too few (leaves blank screen)
// or too many (hurts cold-open latency).
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const INITIAL_MESSAGES_LIMIT = Math.min(30, Math.max(15, Math.ceil(SCREEN_HEIGHT / 80 * 1.5)));

import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  interpolate,
  Extrapolate,
  runOnJS,
} from "react-native-reanimated";
import {
  GestureHandlerRootView,
  TouchableOpacity,
} from "react-native-gesture-handler";

import SwipeableMessageRow from "../../components/SwipeableMessageRow";
import SwipeableModal from "../../components/modals/SwipeableModal";
import useChatPagination from "../../hooks/useChatPagination";
import { FlashList } from "@shopify/flash-list";
import { StatusBar } from "expo-status-bar";
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
  markMessageRead,
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
import { NotificationConsumptionService } from "../../services/NotificationConsumptionService";
import { COLORS } from "../../constants/theme";
import KeyboardAwareToolbar from "../../components/KeyboardAwareToolbar";
import ChatComposer from "../../components/ChatComposer";
import TicketMessageCard from "../../components/TicketMessageCard";
import SharedPostCard, { isPostUnavailable } from "../../components/SharedPostCard";
import SharedOpportunityCard, { isOpportunityUnavailable } from "../../components/SharedOpportunityCard";
import SharedEventCard, { isEventUnavailable } from "../../components/SharedEventCard";
import SharedPlanCard, { isPlanUnavailable } from "../../components/SharedPlanCard";
import SnooLoader from "../../components/ui/SnooLoader";
import ProfilePostFeed from "../../components/ProfilePostFeed";
import CommentsModal from "../../components/CommentsModal";
import EmptyChatState from "../../components/EmptyChatState";
import useRealtimeSubscription from "../../hooks/useRealtimeSubscription";
import { getSocket } from "../../services/socketService";
import { getPostById } from "../../api/posts";
import {
  getCachedConversation,
  setCachedConversation,
  appendMessageToCache,
  clearConversationCache,
} from "../../services/conversationCache";
import { isCardUnavailableSync } from "../../utils/cardAvailabilityCache";

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
        recyclingKey={photoUrl}
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
 * mixed list for FlashList using maintainVisibleContentPosition.
 *
 * Data is in normal chronological order (oldest first). FlashList v2's
 * autoscrollToBottomThreshold keeps the view pinned to the bottom natively
 * when new messages are appended, without any reactive scrollToEnd logic.
 *
 * Date separators are injected BEFORE the first message of a new day so they
 * appear ABOVE that day's messages in normal top-to-bottom rendering order.
 *
 * Input:  [oldest, …, newest]  (chronological, as stored in useChatPagination)
 * Output: [separator?, oldest, …, separator?, newest]
 *
 * ── PERF: wrapper object cache ──────────────────────────────────────────────
 * Cache wrapper objects by message id so unchanged messages return the same
 * object reference → MessageRow's React.memo bails out with zero render cost.
 */
const _msgWrapperCache = new Map(); // module-level: lives as long as the module

const buildMessageList = (messages) => {
  if (!messages || messages.length === 0) return [];
  if (_msgWrapperCache.size > 1000) _msgWrapperCache.clear();

  const result = [];
  for (let i = 0; i < messages.length; i++) {
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

    const isFirstOfDay = !older || msg._dateString !== older._dateString;
    const isDifferentSenderOrTime =
      isFirstOfDay ||
      !older ||
      older.senderId !== msg.senderId ||
      Math.abs((msg._time || 0) - (older._time || 0)) > 60000;

    msg._showAvatar = isDifferentSenderOrTime;
    msg._showSenderName = !older || older.senderId !== msg.senderId;

    // Inject separator BEFORE the first message of each new day
    if (isFirstOfDay) {
      result.push({
        type: "separator",
        id: `sep-${msg.id}`,
        label: formatSeparatorLabel(msg.createdAt),
      });
    }

    // Return cached wrapper if the msg reference hasn't changed.
    let wrapper = _msgWrapperCache.get(msg.id);
    if (!wrapper || wrapper.data !== msg) {
      wrapper = { type: "message", data: msg };
      _msgWrapperCache.set(msg.id, wrapper);
    }
    result.push(wrapper);
  }
  return result;
};

// ── keyExtractor ────────────────────────────────────────────────────────────
const keyExtractor = (item) =>
  item.type === "message" ? String(item.data.id) : item.id;

const isCardUnavailable = (messageType, metadata) => {
  if (!metadata) return false;
  if (isCardUnavailableSync(messageType, metadata)) return true;

  const cardId =
    metadata.postId ||
    metadata.opportunityId ||
    metadata.eventId ||
    metadata.planId ||
    metadata.id ||
    metadata.opportunity_id ||
    metadata.event_id ||
    metadata.plan_id;
  if (!cardId) return false;

  if (messageType === "post_share") return isPostUnavailable(cardId);
  if (messageType === "opportunity_share") return isOpportunityUnavailable(cardId);
  if (messageType === "event_share") return isEventUnavailable(cardId);
  if (messageType === "plan_share") return isPlanUnavailable(cardId);
  return false;
};

// ── overrideItemLayout ───────────────────────────────────────────────────────
// Provides height estimates so startRenderingFromBottom computes a reasonable
// initial scroll offset. Do NOT add a JS-side height cache here — custom caches
// conflict with FlashList's cell-recycling pool causing stale sizes on repeated
// opens (collapsed render window, only last item visible, no scroll).
const overrideItemLayout = (layout, item) => {
  if (!item) return;
  if (item.type === "separator") {
    layout.size = 36;
    return;
  }
  const msg = item.data;
  if (!msg) return;
  if (msg.messageType === "system") {
    layout.size = 32;
    return;
  }
  if (msg.isDeleted) {
    layout.size = 40;
    return;
  }

  const isImageOrVideo =
    msg.messageType === "image" ||
    msg.messageType === "video" ||
    msg.messageType === "multi_media";

  const isCard =
    msg.messageType === "post_share" ||
    msg.messageType === "opportunity_share" ||
    msg.messageType === "event_share" ||
    msg.messageType === "plan_share" ||
    msg.messageType === "ticket";

  if (isImageOrVideo) {
    // BUBBLE_H (200) + marginBottom: 2 = 202dp actual measured height.
    // The isCard branch below stays at 240 (confirmed correct in card-height audit).
    layout.size = 202;
    return;
  }

  if (isCard) {
    if (isCardUnavailable(msg.messageType, msg.metadata)) {
      layout.size = 44;
      return;
    }
    layout.size = 240;
    return;
  }

  let size = 44;
  if (msg._showSenderName) size += 18;
  if (msg.replyToMessageId || msg.replyToId || msg.replyPreview) size += 46;
  const len = msg.messageText ? msg.messageText.length : 0;
  if (len > 115) size += 40 + Math.ceil((len - 115) / 38) * 20;
  else if (len > 75) size += 40;
  else if (len > 35) size += 20;
  layout.size = size;
};

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
  return (
    <SwipeableModal
      visible={visible}
      onClose={onClose}
      sheetStyle={actionSheetStyles.sheet}
    >
      {/* Handle bar */}
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
    </SwipeableModal>
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
              style={[
                actionSheetStyles.sheet,
                animatedSheetStyle,
                { paddingBottom: 24 },
              ]}
            >
              <Pressable
                onPress={(e) => e.stopPropagation()}
                style={{ width: "100%" }}
              >
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
                    onSelect({
                      key: "other",
                      label: "Other",
                      details: trimmed,
                    });
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
        <Animated.View style={[actionSheetStyles.sheet, animatedSheetStyle]}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ width: "100%" }}
          >
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
    // index intentionally omitted — it changes for every row when a new
    // message is prepended (shifts all indices by +1), defeating React.memo
    // for all visible rows. index is never used inside this component's body;
    // showAvatar and showSenderName are pre-computed in renderItem and passed
    // as explicit stable props.
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
    onPressPlan,
    onPressReplyQuote,
    // navigation intentionally received as a REF (navigationRef) not a plain
    // prop. React Navigation can provide a new navigation object reference on
    // every context update (e.g. when NotificationsContext fires), and having
    // it as a live prop would rebuild renderItem + all 5 navigation handlers
    // on each such update, causing a full re-render cascade across all rows.
    // Reading from navigationRef.current at call time avoids this entirely.
    navigationRef,
  }) => {
    const msg = item.data;
    if (msg.messageType === "system") {
      return (
        <View style={styles.systemRow}>
          <Text style={styles.systemText}>{msg.messageText}</Text>
        </View>
      );
    }

    // ── PERF: Stable callbacks for SwipeableMessage ────────────────────────
    // Wrapped in useCallback keyed on primitive msg.id + isMyMessage boolean
    // — both stable for a given message instance.  onReply/onLongPress are
    // ChatScreen-level useCallback handlers, so their references are stable
    // too.  Combined with SwipeableMessageRow's custom React.memo comparator
    // (which excludes these props from equality), this ensures the wrapper
    // bails out on every ChatScreen re-render for rows that didn't change.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const handleRowReply = useCallback(
      () => onReply(msg, isMyMessage),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [msg.id, isMyMessage, onReply],
    );
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const handleRowLongPress = useCallback(
      () => onLongPress(msg),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [msg.id, onLongPress],
    );

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
            recyclingKey={String(msg.senderId || recipientId)}
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
                const nav = navigationRef.current;
                const n = nav?.getParent()?.getParent() || nav;
                n?.navigate("EventDetails", { eventId: msg.metadata.eventId });
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
            onReply={handleRowReply}
            onLongPress={handleRowLongPress}
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
            onReply={handleRowReply}
            onLongPress={handleRowLongPress}
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
            onReply={handleRowReply}
            onLongPress={handleRowLongPress}
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
            onReply={handleRowReply}
            onLongPress={handleRowLongPress}
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

    if (msg.messageType === "plan_share" && msg.metadata) {
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
            onReply={handleRowReply}
            onLongPress={handleRowLongPress}
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
              <SharedPlanCard metadata={msg.metadata} onPress={onPressPlan} />
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
            onReply={handleRowReply}
            onLongPress={handleRowLongPress}
          >
            {bubbleContent}
          </SwipeableMessage>
        </View>
      </View>
    );
  },
  // ── Custom comparator ─────────────────────────────────────────────────────
  // Belt-and-suspenders on top of the wrapper object cache in buildMessageList.
  // Compares item by msg.id + isDeleted so a deleted/edited message still
  // propagates, while an unchanged message (even if the wrapper object is
  // accidentally new) short-circuits React reconciliation.
  // Explicitly excludes: index (meaningless — see above), rsvpLoading (read
  // from ref at render time, not reactive state).
  (prev, next) => {
    const diffs = [];
    if (prev.item?.data?.id !== next.item?.data?.id) diffs.push("item.data.id");
    if (prev.item?.data?.isDeleted !== next.item?.data?.isDeleted)
      diffs.push("item.data.isDeleted");
    if (prev.isMyMessage !== next.isMyMessage) diffs.push("isMyMessage");
    if (prev.showAvatar !== next.showAvatar) diffs.push("showAvatar");
    if (prev.showSenderName !== next.showSenderName)
      diffs.push("showSenderName");
    if (prev.isGroup !== next.isGroup) diffs.push("isGroup");
    if (prev.currentUser?.id !== next.currentUser?.id)
      diffs.push("currentUser.id");
    if (prev.currentUser?.avatarUri !== next.currentUser?.avatarUri)
      diffs.push("currentUser.avatarUri");
    if (prev.recipient?.id !== next.recipient?.id) diffs.push("recipient.id");
    if (prev.recipient?.profilePhotoUrl !== next.recipient?.profilePhotoUrl)
      diffs.push("recipient.profilePhotoUrl");
    if (prev.recipient?.name !== next.recipient?.name)
      diffs.push("recipient.name");
    if (prev.recipientId !== next.recipientId) diffs.push("recipientId");
    if (prev.isBlockedByOther !== next.isBlockedByOther)
      diffs.push("isBlockedByOther");
    if (prev.highlightedIdSV !== next.highlightedIdSV)
      diffs.push("highlightedIdSV");
    if (prev.onReply !== next.onReply) diffs.push("onReply");
    if (prev.onLongPress !== next.onLongPress) diffs.push("onLongPress");
    if (prev.onRSVP !== next.onRSVP) diffs.push("onRSVP");
    if (prev.onOpenViewer !== next.onOpenViewer) diffs.push("onOpenViewer");
    if (prev.onPressPostShare !== next.onPressPostShare)
      diffs.push("onPressPostShare");
    if (prev.onPressUser !== next.onPressUser) diffs.push("onPressUser");
    if (prev.onPressOpportunity !== next.onPressOpportunity)
      diffs.push("onPressOpportunity");
    if (prev.onPressEvent !== next.onPressEvent) diffs.push("onPressEvent");
    if (prev.onPressPlan !== next.onPressPlan) diffs.push("onPressPlan");
    if (prev.onPressReplyQuote !== next.onPressReplyQuote)
      diffs.push("onPressReplyQuote");

    if (diffs.length > 0) {
      console.log(
        `[PERF-DIFF] MessageRow id=${next.item?.data?.id} changed props:`,
        diffs,
      );
      return false;
    }
    return true;
  },
);

// ── Typing Dots Animation Component ─────────────────────────────────────────
const TypingDots = () => {
  const dot1 = useRef(new RNAnimated.Value(0)).current;
  const dot2 = useRef(new RNAnimated.Value(0)).current;
  const dot3 = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot, delay) => {
      return RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.delay(delay),
          RNAnimated.timing(dot, {
            toValue: -4,
            duration: 350,
            easing: RNEasing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
          }),
          RNAnimated.timing(dot, {
            toValue: 0,
            duration: 350,
            easing: RNEasing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
          }),
          RNAnimated.delay(300),
        ]),
      );
    };

    const anim1 = animateDot(dot1, 0);
    const anim2 = animateDot(dot2, 150);
    const anim3 = animateDot(dot3, 300);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={typingStyles.dotsContainer}>
      <RNAnimated.View
        style={[typingStyles.dot, { transform: [{ translateY: dot1 }] }]}
      />
      <RNAnimated.View
        style={[typingStyles.dot, { transform: [{ translateY: dot2 }] }]}
      />
      <RNAnimated.View
        style={[typingStyles.dot, { transform: [{ translateY: dot3 }] }]}
      />
    </View>
  );
};

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

  const t0Ref = useRef(
    global.performance ? global.performance.now() : Date.now(),
  );
  const firstRenderRef = useRef(true);

  // ── Sync cache seed ──────────────────────────────────────────────────────
  // Read from the in-memory cache SYNCHRONOUSLY before first render so
  // useChatPagination starts with real messages — FlatList renders on frame 0
  // without waiting for any useEffect or InteractionManager to fire.
  // Cache stores messages oldest-first, matching the array order contract.
  const initialCacheEntry = conversationId ? getCachedConversation(conversationId) : null;
  const initialMessagesRef = useRef(initialCacheEntry?.messages || []);
  const initialHasMoreRef = useRef(
    initialCacheEntry?.hasMore !== undefined ? initialCacheEntry.hasMore : true,
  );
  if (initialMessagesRef.current.length > 0) {
    const c = initialMessagesRef.current;
    console.log(
      "[CHECK-3] cache seed order (oldest-first) — first:",
      c[0]?.createdAt,
      "last:",
      c[c.length - 1]?.createdAt,
      "count:",
      c.length,
    );
  }

  const {
    messages,
    hasMore,
    loadingOlder,
    loadInitial,
    loadOlderMessages,
    addNewMessage,
    addNewMessages,
    updateMessageById,
    bootstrapPaginationState,
    newestAtRef,
    isLoadingRef,
    resetMessages,
  } = useChatPagination(initialMessagesRef.current, initialHasMoreRef.current);

  const [isChatInputFocused, setIsChatInputFocused] = useState(false);
  const isChatInputFocusedShared = useSharedValue(false);
  useEffect(() => {
    isChatInputFocusedShared.value = isChatInputFocused;
  }, [isChatInputFocused]);

  useEffect(() => {
    const unsubStart = navigation.addListener("transitionStart", (e) => {
      console.log(
        `[PERF-NAV] ChatScreen transitionStart at: ${performance.now().toFixed(2)}ms, closing: ${e?.data?.closing}`,
      );
    });
    const unsubEnd = navigation.addListener("transitionEnd", (e) => {
      console.log(
        `[PERF-NAV] ChatScreen transitionEnd at: ${performance.now().toFixed(2)}ms, closing: ${e?.data?.closing}`,
      );
      // Safety-net: once navigation animation completes, correct any residual
      // scroll drift (e.g. warm open with cached data).
      // autoscrollToBottomThreshold handles ongoing pinning; this is a one-shot
      // correction for the transition frame.
      // Guarded against active pagination so in-flight loadOlderMessages isn't yanked to bottom.
      if (!e?.data?.closing && !isLoadingRef.current) {
        requestAnimationFrame(() => {
          flashListRef.current?.scrollToEnd({ animated: false });
        });
      }
    });
    return () => {
      unsubStart();
      unsubEnd();
    };
  }, [navigation]);

  useEffect(() => {
    const unsubscribeBlur = navigation.addListener("blur", () => {
      Keyboard.dismiss();
    });
    const unsubscribeRemove = navigation.addListener("beforeRemove", () => {
      Keyboard.dismiss();
    });
    return () => {
      unsubscribeBlur();
      unsubscribeRemove();
      const start = performance.now();
      Keyboard.dismiss();
      console.log(
        `[PERF-CLEANUP] ChatScreen Keyboard.dismiss() took: ${(performance.now() - start).toFixed(2)}ms`,
      );
    };
  }, [navigation]);

  useEffect(() => {
    return () => {
      console.log(
        `[PERF-NAV] ChatScreen unmounted at: ${performance.now().toFixed(2)}ms`,
      );
    };
  }, []);
  const [recipient, setRecipient] = useState(() => {
    if (recipientId && recipientName) {
      return {
        id: recipientId,
        name: recipientName,
        username: recipientUsername || "",
        profilePhotoUrl: recipientAvatar || null,
        type: recipientType || "member",
      };
    }
    return null;
  });
  const [loading, setLoading] = useState(!recipientName && !isGroup);
  // Start messagesLoading=false when we have a warm cache hit — the FlatList
  // hydrates synchronously from cache in the useState initializer below, so
  // we should never show a spinner on a warm second-open.
  const [messagesLoading, setMessagesLoading] = useState(() => {
    if (conversationId) {
      const cached = getCachedConversation(conversationId);
      return !cached || cached.messages.length === 0; // false on cache hit
    }
    return !recipientName; // new chat opened from search
  });
  const [groupStatus, setGroupStatus] = useState("ACTIVE");
  const _renderNow = global.performance ? global.performance.now() : Date.now();
  const _tapToRenderMs = tappedAt ? (_renderNow - tappedAt).toFixed(1) : "n/a";
  console.log(
    `[PERF] ChatScreen render — messagesLoading:${messagesLoading} loading:${loading} msgs:${messages.length} tapToRender:${_tapToRenderMs}ms`,
  );
  const [sending, setSending] = useState(false);
  const [currentConversationId, setCurrentConversationId] =
    useState(conversationId);
  const [currentRecipientType, setCurrentRecipientType] =
    useState(recipientType);
  const [currentRecipientId, setCurrentRecipientId] = useState(recipientId);
  // ── PERF: navigationRef mirrors navigation for stable access without deps.
  // Passing navigation as a prop/dep rebuilds renderItem + 5 handlers on every
  // React Navigation context update (e.g. NotificationsContext changes cause the
  // navigator to provide a new navigation object). Reading .current at call time
  // inside MessageRow's ticket branch avoids the rebuild entirely.
  const navigationRef = useRef(navigation);
  useEffect(() => {
    navigationRef.current = navigation;
  }, [navigation]);

  const [currentUser, setCurrentUser] = useState(null);
  const [rsvpLoading, setRsvpLoading] = useState({});
  // \u2500\u2500 PERF: ref mirror so renderItem can read RSVP state without being in its deps.
  //    rsvpLoading in renderItem's closure was causing full re-creation on every
  //    RSVP state change, invalidating all visible rows.
  const rsvpLoadingRef = useRef({});
  const [sharedPostModalVisible, setSharedPostModalVisible] = useState(false);
  const [selectedSharedPost, setSelectedSharedPost] = useState(null);
  const [commentsModalState, setCommentsModalState] = useState({
    visible: false,
    postId: null,
    postType: "post",
  });
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [inputHeight, setInputHeight] = useState(100);

  const [typingUsers, setTypingUsers] = useState({}); // { [userId]: userName }
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // ── PERF-MSG Type Breakdown Logger ──────────────────────────────────────────
  const loggedBreakdownRef = useRef(null);
  useEffect(() => {
    if (currentConversationId && messages && messages.length > 0) {
      if (loggedBreakdownRef.current === currentConversationId) return;
      loggedBreakdownRef.current = currentConversationId;

      const recent20 = messages.slice(-20);
      const breakdown = {
        text: 0,
        image: 0,
        video: 0,
        multi_media: 0,
        post_share: 0,
        opportunity_share: 0,
        event_share: 0,
        plan_share: 0,
        ticket: 0,
        system: 0,
        deleted: 0,
      };
      recent20.forEach((msg) => {
        const type = msg.isDeleted ? "deleted" : msg.messageType || "text";
        breakdown[type] = (breakdown[type] || 0) + 1;
      });
      console.log("[PERF-MSG] type breakdown", breakdown);
    }
  }, [currentConversationId, messages]);

  const handleTypingToggle = useCallback(
    (isTyping) => {
      const socket = getSocket();
      if (!socket || !currentConversationId || !currentUser) return;
      if (isTyping) {
        socket.emit("typing_start", {
          chatId: currentConversationId,
          userId: currentUser.id,
          userName: currentUser.name || "Someone",
        });
      } else {
        socket.emit("typing_stop", {
          chatId: currentConversationId,
          userId: currentUser.id,
        });
      }
    },
    [currentConversationId, currentUser],
  );

  const renderTypingIndicator = () => {
    const typingList = Object.values(typingUsers).filter(Boolean);
    if (typingList.length === 0) return null;

    if (typingList.length === 1) {
      return (
        <View style={typingStyles.container}>
          <Text style={typingStyles.text}>
            <Text style={typingStyles.boldText}>{typingList[0]}</Text> is typing
          </Text>
          <TypingDots />
        </View>
      );
    } else if (typingList.length === 2) {
      return (
        <View style={typingStyles.container}>
          <Text style={typingStyles.text}>
            <Text style={typingStyles.boldText}>{typingList[0]}</Text> and{" "}
            <Text style={typingStyles.boldText}>{typingList[1]}</Text> are
            typing
          </Text>
          <TypingDots />
        </View>
      );
    } else {
      return (
        <View style={typingStyles.container}>
          <Text style={typingStyles.text}>Several people are typing</Text>
          <TypingDots />
        </View>
      );
    }
  };

  // highlight state lives in Reanimated (see highlightedIdSV below renderItem)

  const showAlert = (config) => setAlertConfig({ ...config, visible: true });
  const hideAlert = () => setAlertConfig((p) => ({ ...p, visible: false }));

  const flashListRef = useRef(null);
  const scrollOffsetRef = useRef(0);
  const composerRef = useRef(null);
  const subscriptionRef = useRef(null);
  const supabaseRef = useRef(null);

  // Tracks whether the user is at/near the bottom of the chat list.
  // Initialised true — screen always opens at the newest message.
  // Updated on every onScroll event; read by incoming-message handlers
  // to decide whether to auto-scroll.
  const isAtBottomRef = useRef(true);

  // One-shot guard for FlashList v2's first-paint gap in
  // maintainVisibleContentPosition.autoscrollToBottomThreshold.
  // The native prop corrects ongoing content changes correctly, but on the
  // very first layout it can land one render tick late, causing a brief
  // visible scroll jump. This ref ensures the corrective scrollToEnd fires
  // exactly once per conversation open and never again.
  const hasCorrectedInitialLayoutRef = useRef(false);
  // Opacity mask: starts transparent so the user never sees the wrong-position
  // first frame. Fades to 1 after the one-shot scrollToEnd correction lands.
  // Opacity mask: starts transparent for 1 frame (16ms) while FlashList anchors to bottom, then reveals smoothly.
  const listRevealOpacity = useSharedValue(0);
  const isListSettledRef = useRef(false);
  const isInitialMountedRef = useRef(false);

  useEffect(() => {
    // Reset guards and pagination state whenever the conversation changes.
    hasCorrectedInitialLayoutRef.current = false;
    isListSettledRef.current = false;
    isInitialMountedRef.current = false;
    listRevealOpacity.value = 0;

    const timer = setTimeout(() => {
      isInitialMountedRef.current = true;
      isListSettledRef.current = true;
    }, 150);

    return () => clearTimeout(timer);
  }, [currentConversationId]);

  // ── runInitialCorrectionAndReveal ──────────────────────────────────────────────
  // 1-frame layout anchor: corrects position on Frame 1 (16ms) before revealing opacity.
  const runInitialCorrectionAndReveal = useCallback(() => {
    if (hasCorrectedInitialLayoutRef.current) return; // already ran
    if (messages.length === 0) return;                // no data yet
    hasCorrectedInitialLayoutRef.current = true;
    requestAnimationFrame(() => {
      flashListRef.current?.scrollToEnd({ animated: false });
      listRevealOpacity.value = withTiming(1, { duration: 50 }, () => {
        isListSettledRef.current = true;
        isInitialMountedRef.current = true;
      });
      isListSettledRef.current = true;
      isInitialMountedRef.current = true;
    });
  }, [messages.length]);

  // Data-arrival trigger: fires when messages arrive AFTER the layout has
  // already occurred (the cold-open / cache-miss case).
  useEffect(() => {
    runInitialCorrectionAndReveal();
  }, [runInitialCorrectionAndReveal]);

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

  // Shared value for ultra-smooth UI thread ReplyBar transition
  const replyBarHeightShared = useSharedValue(0);

  // Reanimated keyboard tracking
  const keyboardHeight = useSharedValue(0);
  useKeyboardHandler({
    onStart: (e) => {
      "worklet";
      keyboardHeight.value = isChatInputFocusedShared.value ? e.height : 0;
    },
    onMove: (e) => {
      "worklet";
      keyboardHeight.value = isChatInputFocusedShared.value ? e.height : 0;
    },
    onEnd: (e) => {
      "worklet";
      keyboardHeight.value = isChatInputFocusedShared.value ? e.height : 0;
    },
  });
  const containerAnimatedStyle = useAnimatedStyle(() => {
    const style = {
      marginBottom: inputHeight + replyBarHeightShared.value,
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
  // buildMessageList outputs oldest→newest (index 0 = oldest, last = newest).
  // FlashList v2 autoscrollToBottomThreshold keeps the view pinned to the
  // bottom natively without reactive scrollToEnd calls.
  const flatListData = useMemo(() => buildMessageList(messages), [messages]);


  // ── PERF: Dynamic Cost-Based FlatList Tuning ─────────────────────────────
  // Dynamically scales initialNumToRender, maxToRenderPerBatch, and windowSize
  // based on the layout complexity ("cost") of items in the list.
  // • Text-heavy chats (cost < 16): renders 16 rows upfront for instant scroll fill,
  //   batches 12 rows per frame.
  // • Media/card-heavy chats (cost >= 16): lowers initialNumToRender to 8 and
  //   batching to 5 to avoid heavy image decodes and JS frame drops on mount.
  const listCostConfig = useMemo(() => {
    let totalCost = 0;
    const len = Math.min(flatListData.length, 20);
    for (let i = 0; i < len; i++) {
      const item = flatListData[i];
      if (item.type === "message") {
        const msg = item.data;
        const isMediaOrCard =
          msg.messageType === "image" ||
          msg.messageType === "video" ||
          msg.messageType === "multi_media" ||
          msg.isPostShare ||
          msg.ticketId ||
          msg.eventId ||
          msg.planId;
        if (isMediaOrCard) {
          totalCost += 4;
        } else if (
          msg.replyToId ||
          (msg.messageText && msg.messageText.length > 140)
        ) {
          totalCost += 2;
        } else {
          totalCost += 1;
        }
      }
    }
    const isHeavy = totalCost >= 16;
    return {
      initialNumToRender: isHeavy ? 8 : 16,
      maxToRenderPerBatch: isHeavy ? 5 : 12,
      windowSize: isHeavy ? 6 : 10,
    };
  }, [flatListData]);

  const estimatedItemSize = useMemo(() => {
    // Weighted average based on the actual mix of row types in view,
    // rather than a flat guess that's wrong for ~30% of rows (media/cards).
    const len = Math.min(flatListData.length, 20);
    let totalHeight = 0;
    let count = 0;
    for (let i = 0; i < len; i++) {
      const item = flatListData[i];
      if (item.type !== "message") continue;
      const msg = item.data;
      const isMediaOrCard =
        msg.messageType === "image" ||
        msg.messageType === "video" ||
        msg.messageType === "multi_media" ||
        msg.messageType === "post_share" ||
        msg.messageType === "opportunity_share" ||
        msg.messageType === "event_share" ||
        msg.messageType === "plan_share" ||
        msg.messageType === "ticket";
      totalHeight += isMediaOrCard ? 190 : 60;
      count++;
    }
    return count > 0 ? Math.round(totalHeight / count) : 72;
  }, [flatListData]);

  // ── Phase 2: Granular FlashList Recycler Layout Types (_in vs _out) ──────────
  const getItemType = useCallback(
    (item) => {
      if (!item) return "unknown";
      if (item.type === "date_separator" || item.type === "separator") return "date_separator";
      if (item.type === "system") return "system";
      if (item.type === "message") {
        const msg = item.data;
        const isMyMsg = isGroup
          ? String(msg.senderId) === String(currentUser?.id) &&
            (msg.senderType || "member") === (currentUser?.type || "member")
          : msg.senderId !== (recipient?.id || recipientId);
        const dir = isMyMsg ? "_out" : "_in";

        if (msg.isDeleted) return `deleted${dir}`;

        const mType = msg.messageType;
        if (mType === "ticket") return `ticket${dir}`;
        if (mType === "event_share") return `event_share${dir}`;
        if (mType === "plan_share") return `plan_share${dir}`;
        if (mType === "opportunity_share") return `opportunity_share${dir}`;
        if (mType === "post_share") return `post_share${dir}`;
        if (mType === "video") return `video${dir}`;

        if (mType === "image" || mType === "multi_media") {
          const mediaList =
            msg.media || (msg.mediaUrl ? [{ url: msg.mediaUrl, type: mType }] : []);
          const count = mediaList.length;
          if (count <= 1) return `image_single${dir}`;
          if (count === 2) return `image_grid2${dir}`;
          if (count === 3) return `image_grid3${dir}`;
          return `image_grid4${dir}`;
        }

        if (msg.replyToId) return `text_reply${dir}`;
        return `text${dir}`;
      }
      return "default";
    },
    [currentUser?.id, currentUser?.type, isGroup, recipient?.id, recipientId],
  );

  // ── Phase 2B: Deterministic overrideItemLayout for Fixed-Geometry Cards ──────
  const overrideItemLayout = useCallback(
    (layout, item) => {
      const itemType = getItemType(item);
      switch (itemType) {
        case "system":
          layout.size = 36;
          break;
        case "date_separator":
          layout.size = 34;
          break;
        case "deleted_in":
        case "deleted_out":
          layout.size = 44;
          break;
        case "ticket_in":
        case "ticket_out":
          layout.size = 184;
          break;
        case "event_share_in":
        case "event_share_out":
        case "plan_share_in":
        case "plan_share_out":
          layout.size = 212;
          break;
        case "opportunity_share_in":
        case "opportunity_share_out":
          layout.size = 220;
          break;
        case "post_share_in":
        case "post_share_out":
          layout.size = 240;
          break;
        case "video_in":
        case "video_out":
        case "image_single_in":
        case "image_single_out":
        case "image_grid2_in":
        case "image_grid2_out":
          layout.size = 240;
          break;
        case "image_grid3_in":
        case "image_grid3_out":
        case "image_grid4_in":
        case "image_grid4_out":
          layout.size = 280;
          break;
        default:
          // Dynamic text types (text_in, text_out, text_reply_in, text_reply_out)
          // are left unconstrained for precise Yoga dynamic measurement.
          break;
      }
    },
    [getItemType],
  );

  // ── Development Recycler Diagnostics Logger ────────────────────────────────
  const recyclerStatsRef = useRef({ mounts: 0, byType: {} });
  useEffect(() => {
    if (__DEV__ && flatListData.length > 0) {
      const stats = recyclerStatsRef.current;
      stats.mounts += 1;
      const counts = {};
      flatListData.forEach((item) => {
        const t = getItemType(item);
        counts[t] = (counts[t] || 0) + 1;
      });
      stats.byType = counts;
      console.log(
        `[PERF-RECYCLER] FlashList render #${stats.mounts} | Items: ${flatListData.length} | Types:`,
        JSON.stringify(counts),
      );
    }
  }, [flatListData, getItemType]);

  const renderListHeader = useCallback(() => {
    if (!loadingOlder) return <View style={{ height: 8 }} />;
    return (
      <View style={{ paddingVertical: 14, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="small" color={PRIMARY_COLOR} />
      </View>
    );
  }, [loadingOlder]);

  // ── PERF: stored in a ref instead of useMemo so scrollToMessage can read the
  // latest index without depending on messageIndexMap as a closure variable.
  // If it closed over the useMemo value, scrollToMessage would rebuild every
  // time any message arrived (flatListData -> messageIndexMap -> scrollToMessage
  // -> renderItem -> all visible rows re-render). With a ref the dep array
  // becomes [highlightedIdSV] only, making scrollToMessage stable forever.
  const messageIndexMapRef = useRef({});
  useEffect(() => {
    const map = {};
    flatListData.forEach((item, idx) => {
      if (item.type === "message") map[item.data.id] = idx;
    });
    messageIndexMapRef.current = map;
  }, [flatListData]);

  // ΓöÇΓöÇ mediaTimeline: flattened array of all media in the chat ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const mediaTimeline = useMemo(() => {
    const timeline = [];
    messages.forEach((msg) => {
      if (msg.isDeleted) return;
      const isMyMessage = isGroup
        ? String(msg.senderId) === String(currentUser?.id) &&
          (msg.senderType || "member") === (currentUser?.type || "member")
        : currentUser?.id != null
          ? String(msg.senderId) === String(currentUser?.id)
          : String(msg.senderId) !== String(recipient?.id ?? recipientId);
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

  const mediaTimelineRef = useRef([]);
  useEffect(() => {
    mediaTimelineRef.current = mediaTimeline;
  }, [mediaTimeline]);

  // ΓöÇΓöÇ scrollToMessage ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const scrollToMessage = useCallback(
    (targetId) => {
      const idx = messageIndexMapRef.current[targetId];
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
    // messageIndexMapRef is a ref — reads .current at call time, no dep needed.
    [highlightedIdSV],
  );

  const recipientRef = useRef(recipient);
  useEffect(() => {
    recipientRef.current = recipient;
  }, [recipient]);

  const handleReply = useCallback((msg, isMyMessage) => {
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
      senderName: isMyMessage
        ? "You"
        : msg.senderName || recipientRef.current?.name,
      isDeleted: msg.isDeleted,
      isPostShare: msg.messageType === "post_share",
      postAuthorUsername:
        msg.metadata?.authorUsername || msg.metadata?.author_username,
      postCaption: msg.metadata?.caption,
    });
  }, []);

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

  const handleOpenViewer = useCallback((mediaId) => {
    const idx = mediaTimelineRef.current.findIndex((m) => m.id === mediaId);
    if (idx !== -1) {
      setViewerIndex(idx);
      setViewerVisible(true);
    }
  }, []);

  const handlePressPostShare = useCallback((postId, postData) => {
    if (!postData) return;

    const pType = postData.post_type || postData.type || "media";

    if (pType === "opportunity") {
      const nav = navigationRef.current;
      const n = nav?.getParent()?.getParent() || nav;
      n?.navigate("OpportunityView", {
        opportunityId: postId || postData.id,
        opportunity: postData,
      });
      return;
    }

    // Open focused full-screen post feed directly for all other post types
    setSelectedSharedPost(postData);
    setSharedPostModalVisible(true);
  }, []);

  const handlePressUser = useCallback((userId, userType) => {
    const nav = navigationRef.current;
    const n = nav?.getParent()?.getParent() || nav;
    if (userType === "community") {
      n?.navigate("CommunityPublicProfile", {
        communityId: userId,
        viewerRole: "member",
      });
    } else {
      n?.navigate("MemberPublicProfile", { memberId: userId });
    }
  }, []);

  const handlePressOpportunity = useCallback((opportunityId, metadata) => {
    const nav = navigationRef.current;
    const n = nav?.getParent()?.getParent() || nav;
    n?.navigate("OpportunityView", {
      opportunityId,
      opportunity: { id: opportunityId, ...metadata },
    });
  }, []);

  const handlePressEvent = useCallback((eventId) => {
    const nav = navigationRef.current;
    const n = nav?.getParent()?.getParent() || nav;
    n?.navigate("EventDetails", { eventId });
  }, []);

  const handlePressPlan = useCallback((planId) => {
    const nav = navigationRef.current;
    const n = nav?.getParent()?.getParent() || nav;
    n?.navigate("PlanDetail", { planId });
  }, []);

  // ΓöÇΓöÇ loadMessages ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  // loadMessages replaced by useChatPagination.loadInitial()

  // ── initializeConversation ────────────────────────────────────────────────────────
  useEffect(() => {
    const tStartInit = global.performance
      ? global.performance.now()
      : Date.now();
    if (tappedAt) {
      console.log(
        `[PERF] Tap to ChatScreen useEffect init: ${(tStartInit - tappedAt).toFixed(2)}ms`,
      );
    }
    const init = async () => {
      if (conversationId) {
        // ── Cache-first hydration ──────────────────────────────────────────
        // Check for a warm in-memory entry before touching the network.
        // If found, paint real messages immediately (no skeleton) and kick
        // off a background reconcile to merge any messages sent while away.
        const cached = getCachedConversation(conversationId);
        // ── PERF: reconcile freshness gate ───────────────────────────────────────
        // If the cache is fresh enough, skip the background getMessages() call.
        // The socket subscription (established below) delivers any new messages
        // in real-time, so a network fetch within this window is redundant.
        // Reconcile only runs when the cache is stale (> RECONCILE_SKIP_WINDOW_MS)
        // or on a first open (cache miss). This eliminates the ~850ms network
        // wait that users feel as lag on warm second-opens.
        const RECONCILE_SKIP_WINDOW_MS = 60_000; // 60 s
        const cacheAgeMs = cached ? Date.now() - cached.cachedAt : Infinity;
        const skipReconcile = cached && cacheAgeMs < RECONCILE_SKIP_WINDOW_MS;
        if (cached && cached.messages.length > 0) {
          console.log(
            `[ConvCache] Cache HIT for ${conversationId} — ${cached.messages.length} msgs, age ${((Date.now() - cached.cachedAt) / 1000).toFixed(1)}s`,
          );
          addNewMessages(cached.messages);
          setMessagesLoading(false);
        } else {
          console.log(`[ConvCache] Cache MISS for ${conversationId}`);
          setMessagesLoading(true);
        }

        setCurrentConversationId(conversationId);
        try {
          const tStartLoad = global.performance
            ? global.performance.now()
            : Date.now();
          let freshMsgs = [];
          let freshCursor = null;
          let hasOlderMessages = false;
          let hasNewerMessages = false;

          if (cached && cached.messages.length > 0) {
            if (skipReconcile) {
              // ── FRESH CACHE: skip network, just restore pagination state ──
              console.log(
                `[ConvCache] Cache HIT (fresh, ${(cacheAgeMs / 1000).toFixed(1)}s old) — skipping reconcile`,
              );
              hasOlderMessages = cached.hasMore ?? false;
              bootstrapPaginationState({
                conversationId,
                // Derive cursor from the actual oldest stored message, not
                // from cached.cursor which might contain bad data from old
                // code. messages[0] is always the oldest (oldest-first order).
                cursor: cached.messages.length > 0
                  ? cached.messages[0].createdAt
                  : null,
                hasMore: hasOlderMessages,
                newestAt:
                  cached.messages.length > 0
                    ? cached.messages[cached.messages.length - 1].createdAt
                    : null,
              });
            } else {
              // ── STALE CACHE: delta reconcile — only fetch what's NEW ────────
              // Use after=<newestAt> so we only retrieve messages created after
              // the last message we already have in cache. For quiet conversations
              // (no messages since last open) this returns 0 items and costs
              // essentially nothing. Only busy conversations pay proportional cost.
              const newestCachedAt =
                cached.messages.length > 0
                  ? cached.messages[cached.messages.length - 1].createdAt
                  : null;
              console.log(
                `[ConvCache] Cache HIT (stale, ${(cacheAgeMs / 1000).toFixed(1)}s old) — delta reconcile after ${newestCachedAt}`,
              );
              const isDeltaReconcile = Boolean(newestCachedAt);
              const reconcileParams = isDeltaReconcile
                ? { after: newestCachedAt } // delta: only newer messages
                : { limit: 20 }; // no anchor: full page fallback
              const reconcileRes = await getMessages(
                conversationId,
                reconcileParams,
              );
              freshMsgs = reconcileRes?.messages || [];
              freshCursor = reconcileRes?.nextCursor || null;

              if (isDeltaReconcile) {
                // Delta reconcile response's hasMore describes whether there are NEWER messages.
                hasNewerMessages = reconcileRes?.hasMore ?? false;
                // Preserve cached.hasMore for OLDER-message pagination.
                hasOlderMessages = cached.hasMore ?? false;
              } else {
                // Full fetch fallback describes older messages.
                hasOlderMessages = reconcileRes?.hasMore ?? false;
              }

              if (reconcileRes?.status) setGroupStatus(reconcileRes.status);
              // ⚠️ IMPORTANT: always derive cursor from the OLDEST cached message,
              // NOT from freshCursor (which comes from an { after: } query and is
              // a forward-looking cursor) and NOT from cached.cursor (which may
              // contain bad data written by old code before this fix was deployed).
              // messages[0] in the oldest-first array is always the backward boundary.
              bootstrapPaginationState({
                conversationId,
                cursor: cached.messages.length > 0
                  ? cached.messages[0].createdAt
                  : null,
                hasMore: hasOlderMessages,
                newestAt:
                  freshMsgs.length > 0
                    ? freshMsgs[freshMsgs.length - 1].createdAt
                    : newestCachedAt,
              });
            }
          } else {
            // Cache MISS path: original loadInitial handles state reset + set
            const loadRes = await loadInitial(conversationId, INITIAL_MESSAGES_LIMIT);
            if (loadRes?.status) setGroupStatus(loadRes.status);
            freshMsgs = loadRes?.messages || [];
            freshCursor = loadRes?.nextCursor || null;
            // Read hasMore from the API response object directly — NOT from the hasMore
            // React state variable, which hasn't settled yet when this async code runs.
            hasOlderMessages = loadRes?.hasMore ?? false;
          }

          const tEndLoad = global.performance
            ? global.performance.now()
            : Date.now();
          console.log(
            `[PERF] loadInitial (conversationId exists) took: ${(tEndLoad - tStartLoad).toFixed(2)}ms`,
          );

          // Merge: addNewMessages dedupes by id, so this is always safe
          // regardless of whether cache was used.
          if (freshMsgs.length > 0) {
            addNewMessages(freshMsgs);
          }
          // Update cache with the authoritative server state.
          // Stale reconcile: store the merged (old + delta) set. The cursor is
          // auto-computed from messages[0].createdAt inside setCachedConversation,
          // so it always matches the oldest stored message regardless of what
          // freshCursor or cached.cursor contained.
          // Initial load: freshMsgs is the full set, stored directly.
          if (freshMsgs.length > 0 || !cached) {
            const messagesForCache = cached
              ? [...(cached.messages || []), ...freshMsgs] // merge: old + delta
              : freshMsgs;                                 // initial load: full set
            console.log(
              `[ConvCache] WRITE conversationId=${conversationId} source=${cached ? "reconcile" : "initial"} delta=${freshMsgs.length} total=${messagesForCache.length}`,
            );
            setCachedConversation(conversationId, {
              messages: messagesForCache,
              hasMore: hasOlderMessages,
            });
          }

          EventBus.emit("messages-read");
          NotificationConsumptionService.consumeChat(conversationId).catch(
            console.error,
          );
          // For group chats: fetch restriction flag + current user role
          if (isGroup) {
            try {
              const gpRes = await getGroupParticipants(conversationId);
              setMessagingRestricted(gpRes.messagingRestricted || false);
              if (gpRes._myRole) setMyGroupRole(gpRes._myRole);
            } catch {
              /* non-fatal */
            }
          }
        } catch (err) {
          // If the background fetch fails but we had a cache hit, the user
          // still sees something. Only hard-error if we had no cache at all.
          console.error("[ConvCache] Background fetch failed:", err);
          if (!cached || cached.messages.length === 0) {
            throw err; // re-throw so the outer catch shows the alert
          }
        } finally {
          setMessagesLoading(false);
        }
      } else if (recipientId) {
        setMessagesLoading(true);
        // 1. Resolve conversation with recipient using lightweight endpoint
        const tResolveStart = global.performance
          ? global.performance.now()
          : Date.now();
        const resolvedRes = await resolveConversation(
          recipientId,
          recipientType,
        );
        const tResolveEnd = global.performance
          ? global.performance.now()
          : Date.now();
        console.log(
          `[PERF] resolveConversation took: ${(tResolveEnd - tResolveStart).toFixed(2)}ms`,
        );

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
              type: "community",
            }));
          } else {
            recipientPromise = getPublicMemberProfile(recipientId).then(
              (p) => ({
                id: p.id,
                name: p.full_name || p.name,
                username: p.username,
                profilePhotoUrl: p.profile_photo_url,
                you_have_blocked: !!p?.you_have_blocked,
                type: "member",
              }),
            );
          }
        }

        // Fetch profile/block status concurrently with loading the initial messages if conversation exists
        const promises = [recipientPromise];
        let loadInitialIndex = -1;
        if (resolvedConvId) {
          loadInitialIndex = promises.length;
          promises.push(loadInitial(resolvedConvId, INITIAL_MESSAGES_LIMIT));
        }

        const tPromisesStart = global.performance
          ? global.performance.now()
          : Date.now();
        const results = await Promise.all(promises);
        const loadRes =
          loadInitialIndex !== -1 ? results[loadInitialIndex] : null;
        if (loadRes?.status) setGroupStatus(loadRes.status);
        const tPromisesEnd = global.performance
          ? global.performance.now()
          : Date.now();
        if (loadInitialIndex !== -1) {
          console.log(
            `[PERF] loadInitial + recipientPromise concurrent took: ${(tPromisesEnd - tPromisesStart).toFixed(2)}ms`,
          );
        } else {
          console.log(
            `[PERF] recipientPromise took: ${(tPromisesEnd - tPromisesStart).toFixed(2)}ms`,
          );
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
          // Populate cache for the resolved conversation so next open is instant
          const freshMsgs = loadRes?.messages || [];
          if (freshMsgs.length > 0) {
            console.log(
              `[ConvCache] WRITE conversationId=${resolvedConvId} source=recipientPath count=${freshMsgs.length} (will be trimmed to ${Math.min(freshMsgs.length, 30)})`,
            );
            setCachedConversation(resolvedConvId, {
              messages: freshMsgs,
              hasMore: loadRes?.hasMore ?? false,
            });
          }
          EventBus.emit("messages-read");
          NotificationConsumptionService.consumeChat(resolvedConvId).catch(
            console.error,
          );
        } else {
          setCurrentConversationId(null);
        }
        setCurrentRecipientId(recipientId);
        setCurrentRecipientType(recipientType || "member");
      }
    };

    const run = async () => {
      try {
        await init();
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
        const tEndAll = global.performance
          ? global.performance.now()
          : Date.now();
        console.log(
          `[PERF] Total ChatScreen initialization took: ${(tEndAll - tStartInit).toFixed(2)}ms`,
        );
      }
    };
    // ── Defer all init work until after the navigation animation settles ──────
    // Running init() immediately on mount competes with the JS-driven push
    // animation (~350ms), causing frame drops and delaying visible content.
    // InteractionManager fires after all animations complete, freeing the JS
    // thread to do layout/animation first, then hydrate data.
    const interaction = InteractionManager.runAfterInteractions(() => {
      run();
    });
    return () => interaction.cancel();
  }, [conversationId, recipientId, recipientType]);

  // Fetch fresh post details when shared post modal opens
  useEffect(() => {
    const targetPostId =
      selectedSharedPost?.id ||
      selectedSharedPost?.postId ||
      selectedSharedPost?.post_id;
    if (sharedPostModalVisible && targetPostId) {
      let isMounted = true;
      const loadFreshPost = async () => {
        try {
          const response = await getPostById(targetPostId);
          const post = response.post || response;
          if (isMounted && post) {
            setSelectedSharedPost(post);
          }
        } catch (err) {
          console.warn(
            "[ChatScreen] Failed to fetch fresh shared post details:",
            err?.message,
          );
        }
      };
      loadFreshPost();
      return () => {
        isMounted = false;
      };
    }
  }, [
    sharedPostModalVisible,
    selectedSharedPost?.id,
    selectedSharedPost?.postId,
    selectedSharedPost?.post_id,
  ]);

  useEffect(() => {
    if (firstRenderRef.current && !messagesLoading) {
      firstRenderRef.current = false;
      const tEnd = global.performance ? global.performance.now() : Date.now();
      console.log(
        `[PERF] FlatList rendered with messages: ${(tEnd - t0Ref.current).toFixed(2)}ms since ChatScreen mount`,
      );
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
    table: "messages",
    event: "*",
    filter: currentConversationId
      ? `conversation_id=eq.${currentConversationId}`
      : null,
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
        // B is actively viewing this chat — mark as read immediately so the
        // ConversationsListScreen doesn't show a false unread badge on return.
        markMessageRead(m.id).catch(() => {});
      } else if (payload.eventType === "UPDATE") {
        console.log(
          "[ChatScreen] Realtime message update received:",
          payload.new.id,
        );
        updateMessageById(payload.new.id, {
          isDeleted: payload.new.is_deleted,
          deletedByType: payload.new.deleted_by_type,
          messageText: payload.new.is_deleted ? null : payload.new.message_text,
        });
      }
    },
  });

  // ——— Socket.io Room Joins & Leaves —————————————————————————————————──────────────
  useEffect(() => {
    if (!currentConversationId) return;

    const socket = getSocket();
    if (socket) {
      console.log(
        `[ChatScreen] Joining socket chat room: chat_${currentConversationId}`,
      );
      socket.emit("join_chat", currentConversationId);
    }

    return () => {
      if (socket) {
        const start = performance.now();
        console.log(
          `[ChatScreen] Leaving socket chat room: chat_${currentConversationId}`,
        );
        socket.emit("leave_chat", currentConversationId);
        console.log(
          `[PERF-CLEANUP] ChatScreen socket leave_chat took: ${(performance.now() - start).toFixed(2)}ms`,
        );
      }
    };
  }, [currentConversationId]);

  // ——— Socket.io Typing Listeners —————————————————————————————————─────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleUserTyping = ({ userId, userName }) => {
      console.log("[ChatScreen] User is typing:", userId, userName);
      setTypingUsers((prev) => ({ ...prev, [userId]: userName }));
    };

    const handleUserStoppedTyping = ({ userId }) => {
      console.log("[ChatScreen] User stopped typing:", userId);
      setTypingUsers((prev) => {
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

  // ——— Socket.io Realtime Message Listeners ———————————————————————————————————————————
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !currentConversationId) return;

    const handleNewChatMessage = (msg) => {
      // Don't duplicate self-sent messages (already inserted locally)
      if (currentUser?.id && String(msg.senderId) === String(currentUser.id)) {
        return;
      }
      console.log("[ChatScreen] Socket.io new message received:", msg.id);
      addNewMessage({
        id: msg.id,
        senderId: msg.senderId,
        senderType: msg.senderType,
        senderName: msg.senderName,
        senderUsername: msg.senderUsername,
        senderPhotoUrl: msg.senderPhotoUrl,
        messageText: msg.messageText,
        messageType: msg.messageType,
        metadata: msg.metadata,
        isDeleted: msg.isDeleted,
        deletedByType: msg.deletedByType,
        replyToMessageId: msg.replyToMessageId,
        replyPreview: msg.replyPreview,
        isRead: msg.isRead,
        createdAt: msg.createdAt,
      });
      // Keep the cache in sync so the next reopen is also instant.
      // Zero extra cost — we're already inside the socket handler.
      appendMessageToCache(currentConversationId, {
        id: msg.id,
        senderId: msg.senderId,
        senderType: msg.senderType,
        senderName: msg.senderName,
        senderUsername: msg.senderUsername,
        senderPhotoUrl: msg.senderPhotoUrl,
        messageText: msg.messageText,
        messageType: msg.messageType,
        metadata: msg.metadata,
        isDeleted: msg.isDeleted,
        deletedByType: msg.deletedByType,
        replyToMessageId: msg.replyToMessageId,
        replyPreview: msg.replyPreview,
        isRead: msg.isRead,
        createdAt: msg.createdAt,
      });
      // Auto-scroll to show the new message if user is at/near the bottom.
      // autoscrollToBottomThreshold handles this natively, but keep the
      // explicit fallback for socket-pushed messages during edge cases.
      if (isAtBottomRef.current) {
        setTimeout(() => {
          flashListRef.current?.scrollToEnd({ animated: true });
        }, 80);
      }
      // Mark as read immediately
      markMessageRead(msg.id).catch(() => {});
      NotificationConsumptionService.consumeChat(currentConversationId).catch(
        console.error,
      );
    };

    const handleMessageUpdated = (msg) => {
      console.log("[ChatScreen] Socket.io message update received:", msg.id);
      updateMessageById(msg.id, {
        isDeleted: msg.isDeleted,
        deletedByType: msg.deletedByType,
        messageText: msg.messageText,
      });
    };

    const handleGroupStatusChanged = ({ conversationId, status }) => {
      if (Number(conversationId) === Number(currentConversationId)) {
        console.log(
          "[ChatScreen] Socket.io group_status_changed received:",
          status,
        );
        setGroupStatus(status);
        loadInitial(currentConversationId, INITIAL_MESSAGES_LIMIT).catch(console.error);
      }
    };

    socket.on("new_chat_message", handleNewChatMessage);
    socket.on("message_updated", handleMessageUpdated);
    socket.on("group_status_changed", handleGroupStatusChanged);

    return () => {
      socket.off("new_chat_message", handleNewChatMessage);
      socket.off("message_updated", handleMessageUpdated);
      socket.off("group_status_changed", handleGroupStatusChanged);
    };
  }, [
    currentConversationId,
    currentUser,
    addNewMessage,
    updateMessageById,
    loadInitial,
  ]);

  const handleSendPayload = async ({ text, attachments }) => {
    const hasText = text && text.length > 0;
    const hasMedia = attachments && attachments.length > 0;
    if ((!hasText && !hasMedia) || sending || uploadingMedia) return;

    const replyId = selectedReply?.id || null;
    const replyPreviewObj = selectedReply ? { ...selectedReply } : null;
    const attachmentsSnap = attachments ? [...attachments] : [];

    setSelectedReply(null);
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
      composerRef.current?.clear();
      setTimeout(() => {
        flashListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      console.error("Error sending message:", err);
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
        await loadInitial(currentConversationId, INITIAL_MESSAGES_LIMIT);
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
    const timeA =
      message._time || (message._time = new Date(message.createdAt).getTime());
    const timeB =
      nextMessage._time ||
      (nextMessage._time = new Date(nextMessage.createdAt).getTime());
    const diff = Math.abs(timeB - timeA);
    return diff > 60000;
  }, []);

  // highlightedIdSV lives on the UI thread — writing to it triggers
  // animations in SwipeableMessage without any React re-renders.
  const highlightedIdSV = useSharedValue("");

  // ——— renderItem ———————————————————————————————————————————————————————————————————
  const renderItem = useCallback(
    ({ item, index }) => {
      if (item.type === "message" && index < 3) {
        console.log(
          "[CHECK-6] renderItem index:",
          index,
          "createdAt:",
          item.data.createdAt,
        );
      }

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
        : currentUser?.id != null
          ? String(msg.senderId) === String(currentUser?.id)
          : String(msg.senderId) !== String(recipient?.id ?? recipientId);

      const nextItem = flatListData[index + 1];
      const nextMsg = nextItem?.type === "message" ? nextItem.data : null;
      const showAvatar = isMyMessage
        ? false
        : (msg._showAvatar ?? shouldShowAvatar(msg, nextMsg, isMyMessage));
      const showSenderName =
        isGroup &&
        !isMyMessage &&
        (!nextMsg || nextMsg.senderId !== msg.senderId);

      const effectiveType = msg.isDeleted
        ? "deleted"
        : msg.messageType || "text";

      const isEdgeItem = index <= 2 || index >= flatListData.length - 3;
      if (isEdgeItem) {
        console.log(
          `[EDGE-DIAG] renderItem index=${index} total=${flatListData.length} msgId=${msg.id} type=${effectiveType} isMyMessage=${isMyMessage} showAvatar=${showAvatar} text="${(msg.messageText || '').slice(0, 20)}"`,
        );
      }

      return (
        <Profiler
          id={`ROW-type=${effectiveType} id=${msg.id}`}
          onRender={onRenderMsgProfiler}
        >
          <MessageRow
            item={item}
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
            onPressPlan={handlePressPlan}
            onPressReplyQuote={scrollToMessage}
            // navigationRef: read .current at call time; stable across all renders.
            // Keeping navigation OUT of renderItem's closure prevents rebuilds
            // triggered by React Navigation context updates (e.g. notifications).
            navigationRef={navigationRef}
          />
        </Profiler>
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
      handlePressPlan,
      scrollToMessage,
      // navigation intentionally excluded from deps — stored in navigationRef.
      // Including it caused renderItem to rebuild on every navigation context
      // update (e.g. NotificationsContext firing), cascading re-renders to all
      // visible rows via the 5 handlers that each had [navigation] in their deps.
    ],
  );

  // ——— Loading screen —————————————————————————————————————————————————————————————
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={{ height: insets.top, backgroundColor: "#FFFFFF" }} />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              console.log(
                `[PERF-NAV] ChatScreen Back pressed (loading screen) at: ${performance.now().toFixed(2)}ms`,
              );
              Keyboard.dismiss();
              console.log(
                `[PERF-NAV] ChatScreen navigation.goBack() called at: ${performance.now().toFixed(2)}ms`,
              );
              navigation.goBack();
            }}
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
    <Profiler id="ChatScreen" onRender={onRenderProfiler}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.container}>
          <StatusBar style="dark" animated={true} />
          <View style={{ backgroundColor: "#FFFFFF", zIndex: 10 }}>
            <View style={{ height: insets.top }} />
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => {
                  console.log(
                    `[PERF-NAV] ChatScreen Back pressed at: ${performance.now().toFixed(2)}ms`,
                  );
                  Keyboard.dismiss();
                  console.log(
                    `[PERF-NAV] ChatScreen navigation.goBack() called at: ${performance.now().toFixed(2)}ms`,
                  );
                  navigation.goBack();
                }}
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
                  <View style={{ flex: 1 }} />
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
                          recyclingKey={String(recipientId)}
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
            enabled={isChatInputFocused}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboardView}
            keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
          >
            <Animated.View style={[{ flex: 1 }, containerAnimatedStyle]}>
              {messagesLoading ? (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                </View>
              ) : (
                <Animated.View
                  style={[{ flex: 1 }, { opacity: listRevealOpacity }]}
                >
                  <FlashList
                    ref={flashListRef}
                    data={flatListData}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    getItemType={getItemType}
                    overrideItemLayout={overrideItemLayout}
                    estimatedItemSize={estimatedItemSize}
                    ListHeaderComponent={renderListHeader}
                    drawDistance={1500}
                    onBlankArea={(info) => console.log('[FLASH-BLANK] Blank area:', JSON.stringify(info))}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[
                      styles.listContent,
                      { paddingBottom: 12 + insets.bottom },
                    ]}
                    contentOffset={{ x: 0, y: 999999 }}
                    maintainVisibleContentPosition={{
                      autoscrollToBottomThreshold: 0.2,
                      startRenderingFromBottom: true,
                    }}
                    onStartReached={() => {
                      console.log("[ChatScreen] onStartReached fired");
                      if (hasMore && !isLoadingRef.current) {
                        loadOlderMessages(currentConversationId);
                      }
                    }}
                    onStartReachedThreshold={0.5}
                    onScroll={(e) => {
                      const y = e.nativeEvent.contentOffset.y;
                      const contentH = e.nativeEvent.contentSize.height;
                      const listH = e.nativeEvent.layoutMeasurement.height;
                      isAtBottomRef.current = contentH - listH - y < 100;

                      if (y < 400 && hasMore && !isLoadingRef.current) {
                        console.log(`[CHAT-SCROLL] Scroll-up trigger hit! y=${y.toFixed(1)} contentH=${contentH} listH=${listH} hasMore=${hasMore}`);
                        loadOlderMessages(currentConversationId);
                      }
                    }}
                  scrollEventThrottle={16}
                  onLayout={() => {
                    // Warm-open path: layout fires after data is already present.
                    // runInitialCorrectionAndReveal checks the guard internally.
                    runInitialCorrectionAndReveal();
                  }}
                  ListEmptyComponent={
                    !messagesLoading ? (
                      <View
                        style={{
                          flex: 1,
                          justifyContent: "center",
                          alignItems: "center",
                          minHeight: 200,
                        }}
                      >
                        <EmptyChatState
                          onLayout={() => {
                            listRevealOpacity.value = 1;
                          }}
                        />
                      </View>
                    ) : null
                  }
                  viewabilityConfig={viewabilityConfigRef.current}
                  onViewableItemsChanged={onViewableItemsChangedRef.current}
                />
              </Animated.View>
            )}
          </Animated.View>
          </KeyboardAvoidingView>

          <KeyboardAwareToolbar enabled={isChatInputFocused}>
            <View
              style={{ flexDirection: "column" }}
              onLayout={(e) => {
                const { height } = e.nativeEvent.layout;
                if (height > 0) {
                  setInputHeight(height);
                }
              }}
            >
              {renderTypingIndicator()}

              {/* Locked bar: shown to non-admins when messaging is restricted */}
              {isGroup && groupStatus === "CLOSED" ? (
                <View style={styles.closedBar}>
                  <View style={styles.closedBarHeader}>
                    <LockKeyhole
                      size={18}
                      color="#FF3B30"
                      strokeWidth={2.2}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.closedBarTitle}>
                      This group has been closed
                    </Text>
                  </View>
                  <Text style={styles.closedBarSubtext}>
                    Past conversations remain available, but new messages cannot
                    be sent.
                  </Text>
                </View>
              ) : isGroup && messagingRestricted && myGroupRole !== "admin" ? (
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
                <ChatComposer
                  ref={composerRef}
                  selectedReply={selectedReply}
                  onCloseReply={() => setSelectedReply(null)}
                  replyBarHeightShared={replyBarHeightShared}
                  onSend={handleSendPayload}
                  onTyping={handleTypingToggle}
                  onFocusChange={setIsChatInputFocused}
                  onShowAlert={showAlert}
                  sending={sending}
                  uploadingMedia={uploadingMedia}
                  disabled={youHaveBlocked || isBlockedByOther}
                />
              )}
            </View>
          </KeyboardAwareToolbar>

          {!!optionsTarget && (
            <MessageOptionsModal
              visible={!!optionsTarget}
              isMyMessage={
                isGroup
                  ? String(optionsTarget?.senderId) ===
                      String(currentUser?.id) &&
                    (optionsTarget?.senderType || "member") ===
                      (currentUser?.type || "member")
                  : optionsTarget?.senderId !== (recipient?.id || recipientId)
              }
              onReply={() => {
                const isOwnMsg = isGroup
                  ? String(optionsTarget?.senderId) ===
                      String(currentUser?.id) &&
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
                setTimeout(() => composerRef.current?.focus(), 100);
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

          {commentsModalState.visible && (
            <CommentsModal
              visible={commentsModalState.visible}
              postId={commentsModalState.postId}
              postType={commentsModalState.postType}
              onClose={() =>
                setCommentsModalState({
                  visible: false,
                  postId: null,
                  postType: "post",
                })
              }
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
                setTimeout(() => composerRef.current?.focus(), 100);
              }}
            />
          )}

          {alertConfig.visible && (
            <CustomAlertModal onClose={hideAlert} {...alertConfig} />
          )}
        </View>
      </GestureHandlerRootView>
    </Profiler>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CHAT_CANVAS_BG },
  closedBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#F8F9FA",
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  closedBarHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  closedBarTitle: {
    fontFamily: "Manrope-Bold",
    fontSize: 14,
    color: "#1E293B",
  },
  closedBarSubtext: {
    fontFamily: "Manrope-Regular",
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
  },
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
  // Spinner shown during cold open — absolute overlay outside the opacity wrapper
  // so it's visible even while the message list is fading in.
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  loadingOlderContainer: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: "transparent",
  },
  text: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  boldText: {
    fontFamily: "Manrope-SemiBold",
    color: COLORS.textPrimary,
  },
  dotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 6,
    height: 12,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.textSecondary,
    marginHorizontal: 1.5,
  },
});
