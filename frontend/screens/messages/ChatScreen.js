import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  StyleSheet, View, Platform, Alert, Text, TextInput, Modal, ScrollView,
  TouchableOpacity, Image, KeyboardAvoidingView, Pressable, ActivityIndicator,
  FlatList,
} from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing,
} from "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import SwipeableMessageRow from "../../components/SwipeableMessageRow";
import useChatPagination from "../../hooks/useChatPagination";
import { useKeyboardHandler } from "react-native-keyboard-controller";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ArrowLeft, Send, X, Reply, TriangleAlert, Trash2, AlertTriangle, PartyPopper, MoreVertical, Flag, CheckCircle, Bell, BellOff, Image as ImageIcon, LockKeyhole, ImagePlus, Megaphone } from "lucide-react-native";
import CustomImagePicker from "../../components/CustomImagePicker";
import CustomAlertModal from "../../components/ui/CustomAlertModal";
import MediaViewerTimeline from "../../components/MediaViewerTimeline";
import VideoSendPreviewModal from "../../components/VideoSendPreviewModal";
import { getVideoThumbnailAsync } from "expo-video-thumbnails";

import { BlurView } from "expo-blur";
import { getMessages, sendMessage, unsendMessage, getConversations, hideConversation, reportConversation, muteConversation, unmuteConversation, getGroupParticipants } from "../../api/messages";
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
import ProfilePostFeed from "../../components/ProfilePostFeed";
import SnooLoader from "../../components/ui/SnooLoader";
import EmptyChatState from "../../components/EmptyChatState";

// ΓöÇΓöÇ Palette ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const PRIMARY_COLOR       = "#3565F2";
const ACCENT              = PRIMARY_COLOR;
const SEND_BUTTON_PRESSED = "#2E56D6";
const CHAT_CANVAS_BG      = "#F7F9FC";
const OUTGOING_MESSAGE_BG = "#E6F0FF";
const INCOMING_MESSAGE_BG = "#FFFFFF";
const INCOMING_BORDER     = "#E6ECF5";
const MESSAGE_TEXT_COLOR  = "#1F3A5F";
const LIGHT_TEXT          = COLORS.textSecondary;
const REPLY_SWIPE_MAX     = 72;
const REPLY_HAPTIC_THRESHOLD = 64;

// ΓöÇΓöÇ Helpers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// ── Helpers ────────────────────────────────────────────────────────────────
const formatTime = (dateString) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
};

const formatSeparatorLabel = (dateString) => {
  if (!dateString) return "";
  const d = new Date(dateString);
  const now = new Date();
  const diff = now - d;
  const oneDay = 86400000;
  if (diff < oneDay && now.getDate() === d.getDate()) return "Today";
  if (diff < 2 * oneDay) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
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
    const msg  = messages[i];
    const older = messages[i - 1]; // undefined when i === 0 (oldest message)

    result.push({ type: "message", data: msg });

    // Inject a separator after (below in the inverted list) this message if:
    // • it is the oldest message overall, OR
    // • the next-older message belongs to a different calendar day.
    const isOldestOfDay =
      !older ||
      new Date(msg.createdAt).toDateString() !== new Date(older.createdAt).toDateString();

    if (isOldestOfDay) {
      result.push({ type: "separator", id: `sep-${msg.id}`, label: formatSeparatorLabel(msg.createdAt) });
    }
  }
  return result;
};

// ── TimestampSeparator ──────────────────────────────────────────────────────
const TimestampSeparator = ({ label }) => (
  <View style={sepStyles.row}>
    <Text style={sepStyles.label}>{label}</Text>
  </View>
);
const sepStyles = StyleSheet.create({
  row:   { alignItems: "center", marginVertical: 12 },
  label: { fontFamily: "Manrope-Medium", fontSize: 12, color: LIGHT_TEXT, opacity: 0.7 },
});

// ── ReplyBar (above input) ──────────────────────────────────────────────────
const ReplyBar = ({ reply, onClose }) => {
  const translateY = useSharedValue(30);
  const opacity    = useSharedValue(0);
  useEffect(() => {
    if (reply) {
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
      opacity.value    = withTiming(1, { duration: 160 });
    }
  }, [reply]);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity:   opacity.value,
  }));
  if (!reply) return null;

  const isPostShare = reply.isPostShare;
  let preview;
  if (reply.isDeleted) {
    preview = "This message was unsent";
  } else if (isPostShare) {
    const authorLine = reply.postAuthorUsername ? `@${reply.postAuthorUsername}` : "Shared post";
    const captionLine = reply.postCaption ? ` ∙ ${reply.postCaption.slice(0, 40)}${reply.postCaption.length > 40 ? "…" : ""}` : "";
    preview = authorLine + captionLine;
  } else {
    preview = (reply.messageText || "").slice(0, 60) + ((reply.messageText || "").length > 60 ? "…" : "");
  }

  return (
    <Animated.View style={[replyBarStyles.container, animStyle]}>
      {isPostShare && (
        <View style={replyBarStyles.postIcon}>
          <ImageIcon size={14} color="#3565F2" strokeWidth={2} />
        </View>
      )}
      <View style={replyBarStyles.body}>
        <Text style={replyBarStyles.name}>Replying to {reply.senderName || "Message"}</Text>
        <Text style={replyBarStyles.preview} numberOfLines={1}>{preview}</Text>
      </View>
      <TouchableOpacity onPress={onClose} style={replyBarStyles.close} hitSlop={{top:8,bottom:8,left:8,right:8}}>
        <X size={16} color={LIGHT_TEXT} strokeWidth={2.5} />
      </TouchableOpacity>
    </Animated.View>
  );
};
const replyBarStyles = StyleSheet.create({
  container: { flexDirection:"row", alignItems:"center", backgroundColor: CHAT_CANVAS_BG,
    paddingHorizontal:16, paddingVertical:10, borderTopWidth: 1, borderTopColor: INCOMING_BORDER },
  postIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(53,101,242,0.10)",
    alignItems: "center", justifyContent: "center", marginRight: 10 },
  body:    { flex:1 },
  name:    { fontFamily:"Manrope-SemiBold", fontSize:12, color: LIGHT_TEXT, marginBottom:2 },
  preview: { fontFamily:"Manrope-Regular", fontSize:12, color: LIGHT_TEXT },
});

// ── ReplyQuote ─────────────────────────────────────────────────────────────
const ReplyQuote = ({ replyPreview, isMyMessage, onPress }) => {
  const isPostShare = replyPreview.isPostShare ||
    (!replyPreview.isDeleted && replyPreview.messageText === "Shared a post");

  return (
    <View style={quoteStyles.wrapper}>
      <Text style={[quoteStyles.replyLabel, isMyMessage ? quoteStyles.myReplyLabel : quoteStyles.otherReplyLabel]}>
        {isMyMessage ? "You replied" : "Replied to you"}
      </Text>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[quoteStyles.container, isMyMessage ? quoteStyles.myContainer : quoteStyles.otherContainer]}>
        <View style={[quoteStyles.verticalBar, isMyMessage ? quoteStyles.myVerticalBar : quoteStyles.otherVerticalBar]} />
        <View style={quoteStyles.content}>
          {replyPreview.isDeleted ? (
            <Text style={[quoteStyles.text, quoteStyles.deletedText]} numberOfLines={1}>
              This message was unsent
            </Text>
          ) : isPostShare ? (
            <>
              <View style={quoteStyles.postShareRow}>
                <ImageIcon size={12} color="#3565F2" strokeWidth={2} style={{ marginRight: 4 }} />
                <Text style={quoteStyles.postShareLabel}>Shared a post</Text>
              </View>
              {(replyPreview.postAuthorUsername || replyPreview.postCaption) && (
                <Text style={[quoteStyles.text, isMyMessage ? quoteStyles.myText : quoteStyles.otherText, { opacity: 0.75 }]} numberOfLines={1}>
                  {replyPreview.postAuthorUsername ? `@${replyPreview.postAuthorUsername}` : ""}
                  {replyPreview.postAuthorUsername && replyPreview.postCaption ? " ∙ " : ""}
                  {replyPreview.postCaption ? replyPreview.postCaption.slice(0, 50) : ""}
                </Text>
              )}
            </>
          ) : (
            <Text style={[quoteStyles.text, isMyMessage ? quoteStyles.myText : quoteStyles.otherText]} numberOfLines={2}>
              {replyPreview.messageText || "Message"}
            </Text>
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
const MessageOptionsModal = ({ visible, isMyMessage, onReply, onUnsend, onCancel }) => {
  if (!visible) return null;
  return (
    <View style={optionsStyles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
      <View style={optionsStyles.menu}>
        <TouchableOpacity style={optionsStyles.option} onPress={onReply}>
          <View style={[optionsStyles.iconBox, { backgroundColor: "rgba(53, 101, 242, 0.15)" }]}>
            <Reply size={20} color="#3565F2" strokeWidth={2.5} />
          </View>
          <Text style={optionsStyles.optionText}>Reply</Text>
        </TouchableOpacity>
        
        {isMyMessage && (
          <View style={optionsStyles.divider} />
        )}

        {isMyMessage && (
          <TouchableOpacity style={optionsStyles.option} onPress={onUnsend}>
            <View style={[optionsStyles.iconBox, { backgroundColor: "rgba(229, 57, 53, 0.15)" }]}>
              <Trash2 size={20} color="#E53935" strokeWidth={2.5} />
            </View>
            <Text style={[optionsStyles.optionText, { color: "#E53935" }]}>Unsend</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
const optionsStyles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor:"rgba(0,0,0,0.4)",
    justifyContent:"center", alignItems: "center", zIndex:999 },
  menu:    { backgroundColor:"#FFFFFF", borderRadius:24, width: 240, padding: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  option:  { flexDirection: "row", alignItems: "center", paddingVertical:12, paddingHorizontal:12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  optionText: { fontFamily:"Manrope-SemiBold", fontSize:16, color:"#1F3A5F", marginLeft: 16 },
  divider: { height: 1, backgroundColor: "#F3F4F6", marginHorizontal: 12 },
});

// ReportModal is removed in favor of CustomAlertModal logic in the main component

// ── REPORT_REASONS ────────────────────────────────────────────────────────
const REPORT_REASONS = [
  { key: "harassment",           label: "Harassment or bullying" },
  { key: "spam",                 label: "Spam or unwanted content" },
  { key: "hate_speech",          label: "Hate speech or discrimination" },
  { key: "threats",              label: "Threats or violence" },
  { key: "inappropriate_content",label: "Inappropriate content" },
  { key: "other",                label: "Other" },
];

// ── ChatActionsSheet ──────────────────────────────────────────────────────
const ChatActionsSheet = ({ visible, onClose, onDeleteChat, onReport, onMute, isMuted }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={actionSheetStyles.overlay} onPress={onClose}>
      <Pressable style={actionSheetStyles.sheet} onPress={(e) => e.stopPropagation()}>
        <View style={actionSheetStyles.handle} />

        {/* Mute / Unmute */}
        <TouchableOpacity style={actionSheetStyles.row} onPress={onMute} activeOpacity={0.7}>
          <View style={[actionSheetStyles.iconBox, { backgroundColor: isMuted ? "rgba(52,199,89,0.1)" : "rgba(255,159,10,0.1)" }]}>
            {isMuted
              ? <Bell    size={20} color="#34C759" strokeWidth={2.5} />
              : <BellOff size={20} color="#FF9F0A" strokeWidth={2.5} />}
          </View>
          <View style={actionSheetStyles.rowText}>
            <Text style={actionSheetStyles.rowLabel}>{isMuted ? "Unmute Chat" : "Mute Chat"}</Text>
            <Text style={actionSheetStyles.rowSub}>
              {isMuted ? "Turn notifications back on" : "Silence notifications for this chat"}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={actionSheetStyles.divider} />

        <TouchableOpacity style={actionSheetStyles.row} onPress={onDeleteChat} activeOpacity={0.7}>
          <View style={[actionSheetStyles.iconBox, { backgroundColor: "rgba(229, 57, 53, 0.1)" }]}>
            <Trash2 size={20} color="#E53935" strokeWidth={2.5} />
          </View>
          <View style={actionSheetStyles.rowText}>
            <Text style={actionSheetStyles.rowLabel}>Delete Chat</Text>
            <Text style={actionSheetStyles.rowSub}>Removes this chat from your inbox only</Text>
          </View>
        </TouchableOpacity>

        <View style={actionSheetStyles.divider} />

        <TouchableOpacity style={actionSheetStyles.row} onPress={onReport} activeOpacity={0.7}>
          <View style={[actionSheetStyles.iconBox, { backgroundColor: "rgba(255, 152, 0, 0.1)" }]}>
            <Flag size={20} color="#FF9800" strokeWidth={2.5} />
          </View>
          <View style={actionSheetStyles.rowText}>
            <Text style={actionSheetStyles.rowLabel}>Report Chat</Text>
            <Text style={actionSheetStyles.rowSub}>Report abusive or harmful content</Text>
          </View>
        </TouchableOpacity>
      </Pressable>
    </Pressable>
  </Modal>
);
const actionSheetStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet:   { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
  handle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E0E0E0", alignSelf: "center", marginBottom: 20 },
  row:     { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 14 },
  rowText: { flex: 1 },
  rowLabel:{ fontFamily: "Manrope-SemiBold", fontSize: 16, color: "#1F3A5F" },
  rowSub:  { fontFamily: "Manrope-Regular",  fontSize: 12, color: "#8FA1B8", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#F3F4F6" },
});

// ── ReportReasonSheet ─────────────────────────────────────────────────────
const ReportReasonSheet = ({ visible, onClose, onSelect }) => {
  const [otherMode, setOtherMode]   = React.useState(false);
  const [otherText, setOtherText]   = React.useState("");
  const otherInputRef               = React.useRef(null);

  React.useEffect(() => {
    if (visible) { setOtherMode(false); setOtherText(""); }
  }, [visible]);

  if (otherMode) {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <KeyboardStickyView offset={{ closed: 0, opened: 0 }} style={{ flex: 1 }}>
          <Pressable style={actionSheetStyles.overlay} onPress={onClose}>
            <Pressable style={[actionSheetStyles.sheet, { paddingBottom: 24 }]} onPress={(e) => e.stopPropagation()}>
              <View style={actionSheetStyles.handle} />

              <TouchableOpacity
                onPress={() => { setOtherMode(false); setOtherText(""); }}
                style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}
                activeOpacity={0.7}
              >
                <ArrowLeft size={18} color="#8FA1B8" strokeWidth={2} />
                <Text style={{ fontFamily: "Manrope-Medium", fontSize: 13, color: "#8FA1B8", marginLeft: 6 }}>Back</Text>
              </TouchableOpacity>

              <Text style={{ fontFamily: "BasicCommercial-Bold", fontSize: 18, color: "#1F3A5F", marginBottom: 6 }}>
                Tell us more
              </Text>
              <Text style={{ fontFamily: "Manrope-Regular", fontSize: 13, color: "#8FA1B8", marginBottom: 16 }}>
                Please describe what happened so we can review it properly.
              </Text>

              <View style={{
                borderWidth: 1, borderColor: "#E5E5EA", borderRadius: 14,
                backgroundColor: "#F8F9FB", paddingHorizontal: 14, paddingVertical: 10,
                marginBottom: 4, minHeight: 90,
              }}>
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
                    fontFamily: "Manrope-Regular", fontSize: 14.5,
                    color: "#1F3A5F", textAlignVertical: "top",
                    minHeight: 70,
                  }}
                />
              </View>
              <Text style={{ fontFamily: "Manrope-Regular", fontSize: 11, color: "#B0BEC5", alignSelf: "flex-end", marginBottom: 14 }}>
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
                  backgroundColor: otherText.trim().length > 0 ? "#1F3A5F" : "#E0E0E0",
                  borderRadius: 14, paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontFamily: "Manrope-SemiBold", fontSize: 15, color: "#FFFFFF" }}>
                  Submit Report
                </Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </KeyboardStickyView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={actionSheetStyles.overlay} onPress={onClose}>
        <Pressable style={actionSheetStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={actionSheetStyles.handle} />
          <Text style={{ fontFamily: "BasicCommercial-Bold", fontSize: 18, color: "#1F3A5F", marginBottom: 16 }}>
            Why are you reporting?
          </Text>
          {REPORT_REASONS.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={[actionSheetStyles.row, { paddingVertical: 12 }]}
              onPress={() => {
                if (r.key === "other") { setOtherMode(true); }
                else { onSelect(r); }
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontFamily: "Manrope-Regular", fontSize: 15, color: "#1F3A5F", flex: 1 }}>
                {r.label}
              </Text>
              {r.key === "other" && (
                <ArrowLeft size={16} color="#B0BEC5" strokeWidth={2} style={{ transform: [{ rotate: "180deg" }] }} />
              )}
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// SwipeableMessage extracted to components/SwipeableMessageRow.js
const SwipeableMessage = SwipeableMessageRow;

// ── Main Component ──────────────────────────────────────────────────────────
export default function ChatScreen({ route, navigation }) {
  const {
    conversationId, recipientId, recipientType = "member",
    isGroup = false, groupName,
    isMuted: initialIsMuted = false, mutedUntil: initialMutedUntil = null,
    // Passed from ConversationsListScreen for instant render — no async needed
    myGroupRole: initialMyGroupRole = null,
    messagingRestricted: initialMessagingRestricted = false,
  } = route.params || {};


  const {
    messages, hasMore, loadingOlder,
    loadInitial, loadOlderMessages,
    addNewMessage, addNewMessages,
    updateMessageById, newestAtRef,
  } = useChatPagination();

  const [messageText,           setMessageText]          = useState("");
  const [loading,               setLoading]              = useState(true);
  const [sending,               setSending]              = useState(false);
  const [recipient,             setRecipient]            = useState(null);
  const [currentConversationId, setCurrentConversationId] = useState(conversationId);
  const [currentRecipientType,  setCurrentRecipientType] = useState(recipientType);
  const [currentRecipientId,    setCurrentRecipientId]   = useState(recipientId);
  const [currentUser,           setCurrentUser]          = useState(null);
  const [rsvpLoading,           setRsvpLoading]          = useState({});
  const [sharedPostModalVisible,setSharedPostModalVisible] = useState(false);
  const [selectedSharedPost,    setSelectedSharedPost]   = useState(null);
  const [sharedPosts,           setSharedPosts]          = useState({});
  const [selectedReply,         setSelectedReply]        = useState(null); // { id, messageText, senderName, isDeleted }
  const [optionsTarget,         setOptionsTarget]        = useState(null); // message object to show options for
  const [alertConfig,           setAlertConfig]          = useState({
    visible: false,
    title: "",
    message: "",
    primaryAction: null,
    secondaryAction: null,
    icon: null,
    iconColor: "#FF3B30",
  });
  const [chatActionsVisible,    setChatActionsVisible]    = useState(false);
  const [reportSheetVisible,    setReportSheetVisible]    = useState(false);
  const [isMuted,               setIsMuted]               = useState(initialIsMuted);
  const [mutedUntil,            setMutedUntil]            = useState(initialMutedUntil);

  // Group restriction + media state
  const [messagingRestricted,   setMessagingRestricted]   = useState(initialMessagingRestricted);
  const [myGroupRole,           setMyGroupRole]           = useState(initialMyGroupRole);
  const [mediaAttachments,      setMediaAttachments]      = useState([]); // [{ uri, type, duration, thumbnailUri, muteAudio }]
  const [uploadProgress,        setUploadProgress]        = useState(0);
  const [uploadingMedia,        setUploadingMedia]        = useState(false);
  const [mediaPickerOpen,       setMediaPickerOpen]       = useState(false);
  const [videoPreviewing,       setVideoPreviewing]       = useState(null); // { uri, duration } when preview modal is open
  const [viewerVisible,         setViewerVisible]         = useState(false);
  const [viewerIndex,           setViewerIndex]           = useState(0);

  // highlight state lives in Reanimated (see highlightedIdSV below renderItem)

  const showAlert = (config) => setAlertConfig({ ...config, visible: true });
  const hideAlert = () => setAlertConfig((p) => ({ ...p, visible: false }));

  const flashListRef       = useRef(null);
  const scrollOffsetRef    = useRef(0);
  const inputRef           = useRef(null);
  const subscriptionRef    = useRef(null);
  const supabaseRef        = useRef(null);
  const pollingIntervalRef = useRef(null);
  const groupParticipantsRef = useRef([]);
  const visibleItemIdsRef  = useRef(new Set());
  const viewabilityConfigRef = useRef({ itemVisiblePercentThreshold: 50 });
  const onViewableItemsChangedRef = useRef(({ viewableItems }) => {
    const ids = new Set(
      viewableItems
        .filter(v => v.item?.type === "message")
        .map(v => v.item?.data?.id)
    );
    visibleItemIdsRef.current = ids;
  });
  const insets             = useSafeAreaInsets();

  // Reanimated keyboard tracking
  const keyboardHeight = useSharedValue(0);
  useKeyboardHandler({
    onStart: (e) => { "worklet"; keyboardHeight.value = withTiming(e.height, { duration: e.duration > 0 ? e.duration : 250, easing: Easing.out(Easing.exp) }); },
    onInteractive: (e) => { "worklet"; keyboardHeight.value = e.height; },
    onEnd: (e) => { "worklet"; keyboardHeight.value = e.height; },
  });
  const androidContainerStyle = useAnimatedStyle(() => {
    if (Platform.OS !== "android") return {};
    return { transform: [{ translateY: -keyboardHeight.value }] };
  });

  // Fetch current user for avatar metadata
  useEffect(() => {
    getActiveAccount().then(acc => {
      if (acc) {
        setCurrentUser({
          id: acc.id,
          name: acc.name,
          username: acc.username,
          avatarUri: acc.profilePicture || acc.profile_picture || null
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
      const isMyMessage = msg.senderId !== (recipient?.id || recipientId);
      const senderName = isMyMessage ? "You" : (msg.senderName || recipient?.name);
      const avatarUri = isMyMessage 
        ? (currentUser?.avatarUri || "https://via.placeholder.com/30")
        : (recipient?.profilePhotoUrl || "https://via.placeholder.com/30");
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
          indexInMessage: 0,
          ...commonData
        });
      } else if (msg.messageType === "multi_media" && Array.isArray(msg.metadata)) {
        msg.metadata.forEach((item, index) => {
          if (!item.url) return;
          timeline.push({
            id: `${msg.id}_${index}`,
            uri: item.url,
            type: item.resource_type === "video" ? "video" : "image",
            duration: item.duration,
            muteAudio: item.mute_audio ?? false,
            indexInMessage: index,
            ...commonData
          });
        });
      }
    });
    // Ensure chronological order
    return timeline.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
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
  const scrollToMessage = useCallback((targetId) => {
    const idx = messageIndexMap[targetId];
    if (idx == null) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flashListRef.current?.scrollToIndex({
      index: idx,
      animated: true,
      viewPosition: 0.5,
    });
    highlightedIdSV.value = String(targetId);
    setTimeout(() => { highlightedIdSV.value = ""; }, 1600);
  }, [messageIndexMap, highlightedIdSV]);

  // ΓöÇΓöÇ loadMessages ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  // loadMessages replaced by useChatPagination.loadInitial()


  // ΓöÇΓöÇ initializeConversation ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  useEffect(() => {
    const init = async () => {
      try {
        if (conversationId) {
          setCurrentConversationId(conversationId);
          await loadInitial(conversationId);
          EventBus.emit("messages-read");
          // For group chats: fetch restriction flag + current user role
          if (isGroup) {
            try {
              const gpRes = await getGroupParticipants(conversationId);
              setMessagingRestricted(gpRes.messagingRestricted || false);
              // find current user's role by matching token user ΓÇö we get it from auth via getConversations
              // We store it after we also load current user identity below
              if (gpRes._myRole) setMyGroupRole(gpRes._myRole); // populated below
            } catch { /* non-fatal */ }
          }
        } else if (recipientId) {
          const res = await getConversations();
          const existing = res.conversations?.find(c => c.otherParticipant?.id === recipientId);
          if (existing) {
            setCurrentConversationId(existing.id);
            await loadInitial(existing.id);
            EventBus.emit("messages-read");
          } else {
            setCurrentConversationId(null);
          }
          setCurrentRecipientId(recipientId);
          setCurrentRecipientType(recipientType || "member");
          if ((recipientType || "member") === "community") {
            const p = await getPublicCommunity(recipientId);
            setRecipient({ id: p.id, name: p.name, username: p.username, profilePhotoUrl: p.logo_url });
          } else {
            const p = await getPublicMemberProfile(recipientId);
            setRecipient({ id: p.id, name: p.full_name || p.name, username: p.username, profilePhotoUrl: p.profile_photo_url });
          }
        }
      } catch (err) {
        console.error("Error initializing conversation:", err);
        showAlert({
          title: "Error",
          message: err?.message || "Failed to load conversation.",
          primaryAction: { text: "OK", onPress: () => { hideAlert(); navigation.goBack(); } },
          icon: AlertTriangle,
        });
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [conversationId, recipientId, recipientType]);

  // ——— load recipient from conversationId ———————————————————————————————————————————
  useEffect(() => {
    if (!conversationId || recipient) return;
    (async () => {
      try {
        const res = await getConversations();
        const conv = res.conversations?.find(c => c.id === conversationId);
        if (conv?.otherParticipant) {
          setRecipient(conv.otherParticipant);
          if (conv.otherParticipant.id) setCurrentRecipientId(conv.otherParticipant.id);
          if (conv.otherParticipant.type) setCurrentRecipientType(conv.otherParticipant.type);
        }
      } catch (err) { console.error("Error loading recipient:", err); }
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
        if (gpRes._myRole)    setMyGroupRole(gpRes._myRole);
        if (gpRes.participants) groupParticipantsRef.current = gpRes.participants;
      } catch { /* non-fatal — initial values from params still correct */ }
    })();
  }, [isGroup, currentConversationId]);

  // ——— Supabase init ————————————————————————————————————————————————————————————————
  useEffect(() => {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    (async () => {
      try {
        const mod = await import("@supabase/supabase-js");
        if (mod?.createClient) supabaseRef.current = mod.createClient(url, key);
      } catch { console.log("Supabase not available"); }
    })();
  }, []);

  // ——— Realtime / polling ———————————————————————————————————————————————————————————
  useEffect(() => {
    if (!currentConversationId) return;
    if (supabaseRef.current) {
      const ch = supabaseRef.current
        .channel(`messages:${currentConversationId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "messages",
          filter: `conversation_id=eq.${currentConversationId}` },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const m = payload.new;
              addNewMessage({
                id: m.id, senderId: m.sender_id, senderType: m.sender_type,
                messageText: m.message_text, messageType: m.message_type,
                isDeleted: m.is_deleted, deletedByType: m.deleted_by_type,
                replyToMessageId: m.reply_to_message_id, isRead: m.is_read, createdAt: m.created_at,
              });
            }
            if (payload.eventType === "UPDATE") {
              updateMessageById(payload.new.id, {
                isDeleted: payload.new.is_deleted,
                deletedByType: payload.new.deleted_by_type,
                messageText: payload.new.is_deleted ? null : undefined,
              });
            }
          })
        .subscribe();
      subscriptionRef.current = ch;
      return () => { if (supabaseRef.current) supabaseRef.current.removeChannel(ch); };
    } else {
      // Polling fallback (no Supabase realtime available).
      // We use a forward cursor: each tick only fetches messages that arrived
      // AFTER the newest message we already have, so we never re-download the
      // full recent history on every interval.
      const poll = async () => {
        try {
          // Build params: pass `after` when we have a baseline, otherwise fall
          // back to a small initial load (handles the very first poll tick).
          const after = newestAtRef.current;
          const params = after
            ? { after, limit: 50 }
            : { limit: 50 };
          const res = await getMessages(currentConversationId, params);
          // Batch-merge: one state update, deduped + sorted inside the hook.
          addNewMessages(res.messages || []);
        } catch { }
      };
      poll();
      pollingIntervalRef.current = setInterval(poll, 3000);
      return () => { clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; };
    }
  }, [currentConversationId]);

  const handleSend = async () => {
    const hasText  = messageText.trim().length > 0;
    const hasMedia = mediaAttachments.length > 0;
    if ((!hasText && !hasMedia) || sending || uploadingMedia) return;

    const text            = messageText.trim();
    const replyId         = selectedReply?.id || null;
    const replyPreviewObj = selectedReply ? { ...selectedReply } : null;
    const attachmentsSnap = [...mediaAttachments];

    setMessageText("");
    setSelectedReply(null);
    setMediaAttachments([]);
    setSending(true);

    try {
      const finalRecipientId   = currentRecipientId || recipientId || recipient?.id;
      const finalRecipientType = currentRecipientType || recipientType || recipient?.type || "member";
      if (!finalRecipientId && !currentConversationId) throw new Error("Recipient information is missing.");

      if (attachmentsSnap.length === 0) {
        // ——— Text-only message ——————————————————————————————————————————————————————
        const response = await sendMessage({
          conversationId:      currentConversationId || undefined,
          recipientId:         currentConversationId ? undefined : finalRecipientId,
          recipientType:       finalRecipientType,
          messageText:         text,
          messageType:         "text",
          reply_to_message_id: replyId,
          metadata:            null,
        });
        const msg = { ...response.message, replyPreview: replyPreviewObj };
        if (!currentConversationId) setCurrentConversationId(msg.conversationId);
        addNewMessage(msg);
        EventBus.emit("conversation-updated", {
          conversationId: msg.conversationId,
          lastMessage: msg.messageText,
          lastMessageAt: msg.createdAt,
          otherParticipant: recipient ? { ...recipient, type: finalRecipientType } : { id: finalRecipientId, type: finalRecipientType },
        });
      } else {
        // ——— Multi-media: upload all in parallel, send sequentially ——————————————————
        setUploadingMedia(true);
        setUploadProgress(0);

        const totalItems   = attachmentsSnap.length;
        const progressArr  = new Array(totalItems).fill(0);

        const uploadedItems = await Promise.all(
          attachmentsSnap.map((attachment, idx) =>
            uploadChatMedia(
              attachment.uri,
              attachment.type,
              {
                onProgress: (p) => {
                  progressArr[idx] = p;
                  const avg = progressArr.reduce((a, b) => a + b, 0) / totalItems;
                  setUploadProgress(avg);
                },
              },
            ).then(u => ({ uploaded: u, type: attachment.type }))
          )
        );

        setUploadingMedia(false);

        // Send media as a SINGLE message (if single, use its type. if multiple, use multi_media)
        let resolvedConvId = currentConversationId;
        const isMulti = uploadedItems.length > 1;
        const messageType = isMulti ? "multi_media" : uploadedItems[0].type;
        
        const metadata = isMulti
          ? uploadedItems.map(({ uploaded }, idx) => ({
              url:           uploaded.url,
              public_id:     uploaded.public_id,
              resource_type: uploaded.resource_type,
              duration:      uploaded.duration,
              thumbnail_url: uploaded.thumbnail_url,
              width:         uploaded.width,
              height:        uploaded.height,
              mute_audio:    attachmentsSnap[idx]?.muteAudio ?? false,
            }))
          : {
              url:           uploadedItems[0].uploaded.url,
              public_id:     uploadedItems[0].uploaded.public_id,
              resource_type: uploadedItems[0].uploaded.resource_type,
              duration:      uploadedItems[0].uploaded.duration,
              thumbnail_url: uploadedItems[0].uploaded.thumbnail_url,
              width:         uploadedItems[0].uploaded.width,
              height:        uploadedItems[0].uploaded.height,
              mute_audio:    attachmentsSnap[0]?.muteAudio ?? false,
            };

        const response = await sendMessage({
          conversationId:      resolvedConvId || undefined,
          recipientId:         resolvedConvId ? undefined : finalRecipientId,
          recipientType:       finalRecipientType,
          messageText:         text,
          messageType:         messageType,
          reply_to_message_id: replyId,
          metadata,
        });

        const msg = { ...response.message, replyPreview: replyPreviewObj };
        if (!resolvedConvId) resolvedConvId = msg.conversationId;
        if (!currentConversationId && resolvedConvId) setCurrentConversationId(resolvedConvId);
        addNewMessage(msg);

        const previewLabel = isMulti
          ? `${uploadedItems.length} ≡ƒô╖ Media`
          : (messageType === "image" ? "≡ƒô╖ Photo" : "≡ƒÄÑ Video");

        EventBus.emit("conversation-updated", {
          conversationId: resolvedConvId,
          lastMessage:    previewLabel,
          lastMessageAt:  msg.createdAt,
          otherParticipant: recipient ? { ...recipient, type: finalRecipientType } : { id: finalRecipientId, type: finalRecipientType },
        });
      }

      EventBus.emit("new-message");
    } catch (err) {
      console.error("Error sending message:", err);
      setMessageText(text);
      setUploadingMedia(false);
      showAlert({
        title: "Error",
        message: err?.message || "Failed to send message.",
        primaryAction: { text: "OK", onPress: hideAlert },
        icon: AlertTriangle,
      });
    } finally {
      setSending(false);
      setUploadProgress(0);
    }
  };

  // ——— handleCustomPickerDone ————————————————————————————————————————————————————
  // Called by CustomImagePicker when the user taps Done.
  // Assets already filtered by picker (too-long videos are greyed out/unselectable).
  const handleCustomPickerDone = useCallback(async (assets) => {
    setMediaPickerOpen(false);
    if (!assets?.length) return;

    // Filter out over-size items (safety net)
    const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
    const MAX_IMAGE_BYTES = 50  * 1024 * 1024;

    const valid = assets.filter(a => {
      const isVideo = a.mediaType === "video";
      const max     = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      return !(a.fileSize && a.fileSize > max);
    });

    if (valid.length < assets.length) {
      showAlert({
        title: "Some files skipped",
        message: "One or more files exceeded the size limit and were removed.",
        primaryAction: { text: "OK", onPress: hideAlert },
        icon: AlertTriangle,
      });
    }

    if (!valid.length) return;

    // If exactly one video is selected, show the send-preview modal first
    if (valid.length === 1 && valid[0].mediaType === "video") {
      setVideoPreviewing({ uri: valid[0].uri, duration: valid[0].duration ?? null });
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
          uri:          a.uri,
          type:         a.mediaType === "video" ? "video" : "image",
          duration:     a.duration ?? null,
          thumbnailUri: thumbnailUri,
          muteAudio:    false,
        };
      })
    );

    setMediaAttachments(attachments);
  }, [showAlert, hideAlert]);

  // Called by VideoSendPreviewModal when the user confirms send
  const handleVideoSendConfirm = useCallback(async ({ muteAudio }) => {
    if (!videoPreviewing) return;
    let thumbnailUri = null;
    try {
      const thumb = await getVideoThumbnailAsync(videoPreviewing.uri, { time: 0 });
      thumbnailUri = thumb.uri;
    } catch (_) {}
    setMediaAttachments([{
      uri:          videoPreviewing.uri,
      type:         "video",
      duration:     videoPreviewing.duration,
      thumbnailUri: thumbnailUri,
      muteAudio:    muteAudio,
    }]);
    setVideoPreviewing(null);
  }, [videoPreviewing]);

  // ——— handleUnsend ————————————————————————————————————————————————————————————————
  const handleUnsend = async (id) => {
    // Optimistic: mark deleted immediately on the UI thread
    updateMessageById(id, { isDeleted: true, deletedByType: "sender", messageText: null });
    try {
      await unsendMessage(id);
    } catch (err) {
      console.error("Unsend error:", err);
      showAlert({
        title: "Error",
        message: "Could not unsend message.",
        primaryAction: { text: "OK", onPress: hideAlert },
        icon: AlertTriangle,
      });
      // Revert on failure
      updateMessageById(id, { isDeleted: false, deletedByType: null, messageText: undefined });
    }
  };

  // ——— handleDeleteChat ————————————————————————————————————————————————————————————
  const handleDeleteChat = () => {
    setChatActionsVisible(false);
    setTimeout(() => {
      showAlert({
        title: "Delete Chat",
        message: "This chat will be removed from your inbox. The other person won't be notified.",
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
              EventBus.emit("conversation-deleted", { conversationId: currentConversationId });
              navigation.goBack();
            } catch (err) {
              showAlert({
                title: "Error",
                message: err?.message || "Failed to delete chat.",
                primaryAction: { text: "OK", onPress: hideAlert },
                icon: AlertTriangle,
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
            icon: AlertTriangle,
          });
        }
      }, 300);
    } else {
      // Show duration picker
      const MUTE_DURATIONS = [
        { label: "For 1 hour",   ms: 60 * 60 * 1000 },
        { label: "For 8 hours",  ms: 8 * 60 * 60 * 1000 },
        { label: "For 24 hours", ms: 24 * 60 * 60 * 1000 },
        { label: "Until I change it",  ms: null },
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
            const until = dur.ms ? new Date(Date.now() + dur.ms).toISOString() : null;
            try {
              await muteConversation(currentConversationId, until);
              setIsMuted(true);
              setMutedUntil(until);
            } catch {
              showAlert({
                title: "Error",
                message: "Failed to mute. Please try again.",
                primaryAction: { text: "OK", onPress: hideAlert },
                icon: AlertTriangle,
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

  const handleReportReason = async (reason) => {
    setReportSheetVisible(false);

    if (!currentConversationId) {
      setTimeout(() => {
        showAlert({
          title: "Cannot Report",
          message: "This conversation hasn't started yet. Send a message first.",
          primaryAction: { text: "OK", onPress: hideAlert },
          icon: AlertTriangle,
        });
      }, 300);
      return;
    }

    try {
      await reportConversation(currentConversationId, reason.key, reason.details || reason.label);
      setTimeout(() => {
        showAlert({
          title: "Report Submitted",
          message: "Thanks for letting us know. Our team will review this conversation.",
          icon: CheckCircle,
          iconColor: "#34C759",
          primaryAction: { text: "OK", onPress: hideAlert },
        });
      }, 300);
    } catch (err) {
      const alreadyReported = err?.message?.toLowerCase().includes("unique") ||
                              err?.message?.toLowerCase().includes("already") ||
                              err?.status === 409;
      setTimeout(() => {
        showAlert({
          title: alreadyReported ? "Already Reported" : "Error",
          message: alreadyReported
            ? "You've already reported this conversation. Our team is reviewing it."
            : (err?.message || "Failed to submit report. Please try again."),
          primaryAction: { text: "OK", onPress: hideAlert },
          icon: alreadyReported ? CheckCircle : AlertTriangle,
          iconColor: alreadyReported ? "#FF9800" : undefined,
        });
      }, 300);
    }
  };

  // ——— shouldShowAvatar —————————————————————————————————————————————————————————————
  const shouldShowAvatar = useCallback((message, nextMessage) => {
    const recipientUserId = recipient?.id || recipientId;
    if (message.senderId !== recipientUserId) return false;
    if (!nextMessage) return true;
    if (nextMessage.senderId !== message.senderId) return true;
    const diff = Math.abs(new Date(nextMessage.createdAt) - new Date(message.createdAt));
    return diff > 60000;
  }, [recipient, recipientId]);

  // highlightedIdSV lives on the UI thread — writing to it triggers
  // animations in SwipeableMessage without any React re-renders.
  const highlightedIdSV = useSharedValue("");

  // ——— renderItem ———————————————————————————————————————————————————————————————————
  const renderItem = ({ item, index }) => {
    if (item.type === "separator") return <TimestampSeparator label={item.label} />;
    const msg = item.data;
    if (msg.messageType === "system") {
      return (
        <View style={styles.systemRow}>
          <Text style={styles.systemText}>{msg.messageText}</Text>
        </View>
      );
    }
    const isMyMessage  = msg.senderId !== (recipient?.id || recipientId);
    // flatListData is already reversed (newest=index 0 for inverted FlashList).
    // The next item chronologically (older message below this one in the chat) is at index+1.
    const nextItem     = flatListData[index + 1];
    const nextMsg      = nextItem?.type === "message" ? nextItem.data : null;
    const showAvatar   = shouldShowAvatar(msg, nextMsg);
    const avatarUri    = recipient?.profilePhotoUrl || "https://via.placeholder.com/30";

    if (msg.isDeleted) {
      return (
        <View style={[styles.messageContainer, isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer]}>
          {!isMyMessage && (showAvatar ? <Image source={{ uri: avatarUri }} style={styles.messageAvatar} /> : <View style={{ width: 30, marginRight: 8 }} />)}
          <View style={[styles.messageBubble, isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble, styles.deletedBubble]}>
            <Text style={styles.deletedText}>This message was unsent</Text>
          </View>
        </View>
      );
    }

    if (msg.messageType === "ticket" && msg.metadata) {
      const handleRSVP = async (response) => {
        const giftId = msg.metadata.giftId;
        if (!giftId) { 
          showAlert({ title: "Error", message: "Unable to process RSVP", primaryAction: { text: "OK", onPress: hideAlert }, icon: AlertTriangle });
          return; 
        }
        setRsvpLoading(prev => ({ ...prev, [msg.id]: true }));
        try {
          const result = await confirmGiftRSVP(giftId, response);
          if (result.success) {
            updateMessageById(msg.id, { metadata: { ...msg.metadata, status: result.status } });
            showAlert({
              title: response === "going" ? "You're In! ≡ƒÄë" : "Maybe Next Time",
              message: result.message,
              primaryAction: { text: "Sweet!", onPress: hideAlert },
              icon: PartyPopper,
              iconColor: COLORS.primary,
            });
          }
        } catch (err) { 
          showAlert({ title: "Error", message: err?.message || "Failed to confirm RSVP", primaryAction: { text: "OK", onPress: hideAlert }, icon: AlertTriangle });
        }
        finally { setRsvpLoading(prev => ({ ...prev, [msg.id]: false })); }
      };
      return (
        <View style={[styles.messageContainer, isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer]}>
          {!isMyMessage && (showAvatar ? <Image source={{ uri: avatarUri }} style={styles.messageAvatar} /> : <View style={{ width: 30, marginRight: 8 }} />)}
          <TicketMessageCard metadata={msg.metadata} isFromMe={isMyMessage} senderName={recipient?.name}
            loading={rsvpLoading[msg.id]}
            onViewEvent={() => { const n = navigation.getParent()?.getParent() || navigation; n.navigate("EventDetails", { eventId: msg.metadata.eventId }); }}
            onConfirmGoing={() => handleRSVP("going")} onDecline={() => handleRSVP("not_going")} />
        </View>
      );
    }

    // ——— Image / Video / MultiMedia messages ————————————————————————————————————————
    if (msg.messageType === "image" || msg.messageType === "video" || msg.messageType === "multi_media") {
      return (
        <View style={[styles.messageContainer, isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer]}>
          {!isMyMessage && (showAvatar ? <Image source={{ uri: avatarUri }} style={styles.messageAvatar} /> : <View style={{ width: 30, marginRight: 8 }} />)}
          <SwipeableMessage
            messageId={msg.id}
            highlightedIdSV={highlightedIdSV}
            isMyMessage={isMyMessage}
            onReply={() => setSelectedReply({
              id: msg.id,
              messageText: msg.messageType === "multi_media" ? "≡ƒô╕ Media" : (msg.messageType === "image" ? "≡ƒô╖ Photo" : "≡ƒÄÑ Video"),
              senderName: isMyMessage ? "You" : (msg.senderName || recipient?.name),
              isDeleted: msg.isDeleted,
            })}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setOptionsTarget(msg);
            }}
          >
            <View collapsable={false}>
              {msg.replyPreview && (
                <ReplyQuote
                  replyPreview={msg.replyPreview}
                  isMyMessage={isMyMessage}
                  onPress={() => scrollToMessage(msg.replyToMessageId)}
                />
              )}
              <ChatMediaMessage
                message={msg}
                isMyMessage={isMyMessage}
                uploadProgress={null}
                onOpenViewer={(mediaId) => {
                  const idx = mediaTimeline.findIndex((m) => m.id === mediaId);
                  if (idx !== -1) {
                    setViewerIndex(idx);
                    setViewerVisible(true);
                  }
                }}
              />
              <Text style={[styles.messageTime, isMyMessage ? styles.myMessageTime : styles.otherMessageTime, { marginRight: isMyMessage ? 4 : 0, marginLeft: isMyMessage ? 0 : 4, marginTop: 2 }]}>
                {formatTime(msg.createdAt)}
              </Text>
            </View>
          </SwipeableMessage>
        </View>
      );
    }

    if (msg.messageType === "post_share" && msg.metadata) {
      return (
        <View style={[styles.messageContainer, isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer]}>
          {!isMyMessage && (showAvatar ? <Image source={{ uri: avatarUri }} style={styles.messageAvatar} /> : <View style={{ width: 30, marginRight: 8 }} />)}
          <SwipeableMessage
            messageId={msg.id}
            highlightedIdSV={highlightedIdSV}
            isMyMessage={isMyMessage}
            onReply={() => setSelectedReply({
              id: msg.id,
              messageText: "Shared a post",
              senderName: isMyMessage ? "You" : (msg.senderName || recipient?.name),
              isDeleted: msg.isDeleted,
              isPostShare: true,
              postAuthorUsername: msg.metadata?.authorUsername || msg.metadata?.author_username,
              postCaption: msg.metadata?.caption,
            })}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setOptionsTarget(msg);
            }}
          >
            <View collapsable={false}>
              {msg.replyPreview && (
                <ReplyQuote
                  replyPreview={msg.replyPreview}
                  isMyMessage={isMyMessage}
                  onPress={() => scrollToMessage(msg.replyToMessageId)}
                />
              )}
              <SharedPostCard 
                metadata={msg.metadata} 
                onPress={(postId, postData) => {
                  setSharedPosts(prev => ({ ...prev, [postId]: postData }));
                  setSelectedSharedPost(postData); setSharedPostModalVisible(true);
                }}
                onUserPress={(userId, userType) => {
                  navigation.navigate("MemberProfile", { memberId: userId });
                }}
              />
            </View>
          </SwipeableMessage>
        </View>
      );
    }

    const bubbleContent = (
      <View collapsable={false} style={{ alignItems: isMyMessage ? "flex-end" : "flex-start", maxWidth: "100%" }}>
        {msg.replyPreview && (
          <ReplyQuote replyPreview={msg.replyPreview} isMyMessage={isMyMessage} onPress={() => scrollToMessage(msg.replyToMessageId)} />
        )}
        <View style={[
          styles.messageBubble, 
          isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
          msg.replyPreview && (isMyMessage ? styles.myMessageBubbleReplied : styles.otherMessageBubbleReplied)
        ]}>
          <Text style={[styles.messageText, isMyMessage ? styles.myMessageText : styles.otherMessageText]}>{msg.messageText}</Text>
          <Text style={[styles.messageTime, isMyMessage ? styles.myMessageTime : styles.otherMessageTime]}>{formatTime(msg.createdAt)}</Text>
        </View>
      </View>
    );

    return (
      <View style={[styles.messageContainer, isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer]}>
        {!isMyMessage && (showAvatar ? <Image source={{ uri: avatarUri }} style={styles.messageAvatar} /> : <View style={{ width: 30, marginRight: 8 }} />)}
        <SwipeableMessage
          messageId={msg.id}
          highlightedIdSV={highlightedIdSV}
          isMyMessage={isMyMessage}
          onReply={() => setSelectedReply({
            id: msg.id,
            messageText: msg.messageText,
            senderName: isMyMessage ? "You" : (msg.senderName || recipient?.name),
            isDeleted: msg.isDeleted,
          })}
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setOptionsTarget(msg);
          }}
        >
          {bubbleContent}
        </SwipeableMessage>
      </View>
    );
  };

  // ——— Loading screen —————————————————————————————————————————————————————————————
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={{ height: insets.top, backgroundColor: "#FFFFFF" }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft size={22} color="#333333" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.headerName}>Loading...</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}><SnooLoader size="large" color={PRIMARY_COLOR} /></View>
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
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <ArrowLeft size={22} color="#333333" strokeWidth={2.5} />
            </TouchableOpacity>
            {isGroup ? (
              <>
                <TouchableOpacity
                  style={styles.headerInfo}
                  onPress={() => navigation.navigate("GroupInfo", { conversationId: currentConversationId, groupName })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.headerName} numberOfLines={1}>{groupName || "Group"}</Text>
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
                  <>
                    <Image source={{ uri: recipient.profilePhotoUrl || "https://via.placeholder.com/32" }} style={styles.headerAvatar} />
                    <View style={styles.headerInfo}>
                      <Text style={styles.headerName} numberOfLines={1}>{recipient.name || "User"}</Text>
                      <Text style={styles.headerUsername} numberOfLines={1}>@{recipient.username || "user"}</Text>
                    </View>
                  </>
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
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <Animated.View style={[{ flex: 1 }, androidContainerStyle]}>
            <FlatList
              ref={flashListRef}
              data={flatListData}
              keyExtractor={(item) => item.type === "message" ? String(item.data.id) : item.id}
              renderItem={renderItem}
              inverted
              maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
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
              viewabilityConfig={viewabilityConfigRef.current}
              onViewableItemsChanged={onViewableItemsChangedRef.current}
            />

          </Animated.View>
        </KeyboardAvoidingView>

        <KeyboardAwareToolbar>
          <View style={{ flexDirection: "column" }}>
            <ReplyBar reply={selectedReply} onClose={() => setSelectedReply(null)} />

            {/* ΓöÇΓöÇ Locked bar: shown to non-admins when messaging is restricted ΓöÇΓöÇ */}
            {isGroup && messagingRestricted && myGroupRole !== "admin" ? (
              <View style={styles.lockedBar}>
                <View style={styles.lockedBarIcon}>
                  <LockKeyhole size={16} color={ACCENT} strokeWidth={2} />
                </View>
                <Text style={styles.lockedBarText}>Only admins can send messages</Text>
                <View style={styles.lockedBarBadge}>
                  <Megaphone size={12} color="#8FA1B8" strokeWidth={2} style={{ marginRight: 4 }} />
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
                            resizeMode="cover"
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
                              setMediaAttachments(prev => prev.filter((_, i) => i !== idx))
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
                        placeholder={`Add a captionΓÇª`}
                        placeholderTextColor="#B0BEC5"
                        value={messageText}
                        onChangeText={setMessageText}
                        multiline
                        maxLength={500}
                      />
                      <TouchableOpacity
                        onPress={() => { setMediaAttachments([]); setMessageText(""); }}
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
                        onChangeText={setMessageText}
                        multiline
                        maxLength={1000}
                      />
                    </View>
                  )}
                  {mediaAttachments.length > 0 && <View style={{ flex: 1 }} />}

                  <Pressable
                    style={({ pressed }) => [
                      styles.sendButton,
                      (!messageText.trim() && !mediaAttachments.length || sending || uploadingMedia) && styles.sendButtonDisabled,
                      pressed && (messageText.trim() || mediaAttachments.length) && !sending && { backgroundColor: SEND_BUTTON_PRESSED },
                    ]}
                    onPress={handleSend}
                    disabled={(!messageText.trim() && !mediaAttachments.length) || sending || uploadingMedia}
                  >
                    {(sending || uploadingMedia)
                      ? <SnooLoader size="small" color="#FFFFFF" />
                      : <Send size={20} color="#FFFFFF" strokeWidth={2.6} />}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </KeyboardAwareToolbar>

        <MessageOptionsModal 
          visible={!!optionsTarget} 
          isMyMessage={optionsTarget?.senderId !== (recipient?.id || recipientId)}
          onReply={() => {
            const isOwnMsg = optionsTarget?.senderId !== (recipient?.id || recipientId);
            setSelectedReply({
              id: optionsTarget.id,
              messageText: optionsTarget.messageText,
              senderName: isOwnMsg ? "You" : (optionsTarget.senderName || recipient?.name),
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

        <ChatActionsSheet
          visible={chatActionsVisible}
          onClose={() => setChatActionsVisible(false)}
          onDeleteChat={handleDeleteChat}
          onReport={handleStartReport}
          onMute={handleMuteChat}
          isMuted={isMuted}
        />

        <ReportReasonSheet
          visible={reportSheetVisible}
          onClose={() => setReportSheetVisible(false)}
          onSelect={handleReportReason}
        />

        {sharedPostModalVisible && selectedSharedPost && (
          <ProfilePostFeed
            visible={sharedPostModalVisible}
            posts={[selectedSharedPost]}
            initialPostId={selectedSharedPost.id}
            onClose={() => { setSharedPostModalVisible(false); setSelectedSharedPost(null); }}
            currentUserId={selectedSharedPost.author_id}
            currentUserType={selectedSharedPost.author_type}
            onLikeUpdate={(postId, isLiked) => setSelectedSharedPost(prev => ({ ...prev, is_liked: isLiked, isLiked, like_count: Math.max(0, (prev.like_count || 0) + (isLiked ? 1 : -1)) }))}
            onComment={(postId, newCount) => setSelectedSharedPost(prev => ({ ...prev, comment_count: newCount }))}
            navigation={navigation}
          />
        )}

        <CustomImagePicker
          visible={mediaPickerOpen}
          onClose={() => setMediaPickerOpen(false)}
          onDone={handleCustomPickerDone}
          selectionLimit={10}
          allowVideos
          videoMaxDuration={120}
        />

        <VideoSendPreviewModal
          visible={!!videoPreviewing}
          videoUri={videoPreviewing?.uri}
          duration={videoPreviewing?.duration}
          onClose={() => setVideoPreviewing(null)}
          onSend={handleVideoSendConfirm}
        />

        <MediaViewerTimeline
          timeline={mediaTimeline}
          initialIndex={viewerIndex}
          visible={viewerVisible}
          onClose={() => setViewerVisible(false)}
          onReply={(mediaItem) => {
            setViewerVisible(false);
            setSelectedReply({
              id: mediaItem.messageId,
              messageText: mediaItem.type === "video" ? "≡ƒÄÑ Video" : "≡ƒô╖ Photo",
              senderName: mediaItem.senderName,
              isDeleted: false,
            });
            setTimeout(() => inputRef.current?.focus(), 100);
          }}
        />

        <CustomAlertModal onClose={hideAlert} {...alertConfig} />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: CHAT_CANVAS_BG },
  keyboardView:   { flex: 1 },
  header:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
    paddingVertical: 12, backgroundColor: "#FFFFFF", zIndex: 10,
    borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)" },
  backButton:     { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 22,
    flexDirection: "row", alignItems: "center", marginRight: 10 },
  headerAvatar:   { width: 32, height: 32, borderRadius: 16, marginRight: 8 },
  headerInfo:     { flex: 1 },
  headerName:     { fontFamily: "BasicCommercial-Black", fontSize: 16, color: "#1F3A5F" },
  headerUsername: { fontFamily: "Manrope-Medium", fontSize: 12, color: LIGHT_TEXT },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  messagesList:   { paddingHorizontal: 16, paddingTop: 130, paddingBottom: 10 },
  messageContainer: { flexDirection: "row", marginBottom: 8, alignItems: "flex-end" },
  myMessageContainer:    { justifyContent: "flex-end" },
  otherMessageContainer: { justifyContent: "flex-start" },
  messageAvatar:  { width: 30, height: 30, borderRadius: 15, marginRight: 8 },
  messageBubble:  { maxWidth: "100%", paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6, borderRadius: 18 },
  myMessageBubble:    { backgroundColor: OUTGOING_MESSAGE_BG, borderBottomRightRadius: 4 },
  otherMessageBubble: { backgroundColor: INCOMING_MESSAGE_BG, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: INCOMING_BORDER,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  myMessageBubbleReplied: { borderTopRightRadius: 4 },
  otherMessageBubbleReplied: { borderTopLeftRadius: 4 },
  deletedBubble:  { opacity: 0.55 },
  deletedText:    { fontFamily: "Manrope-Regular", fontSize: 13, color: LIGHT_TEXT, fontStyle: "italic" },
  messageText:    { fontFamily: "Manrope-Regular", fontSize: 15, lineHeight: 21 },
  myMessageText:  { color: MESSAGE_TEXT_COLOR },
  otherMessageText: { color: MESSAGE_TEXT_COLOR },
  messageTime:    { fontFamily: "Manrope-Medium", fontSize: 10, alignSelf: "flex-end", opacity: 0.65, marginTop: 2 },
  myMessageTime:  { color: MESSAGE_TEXT_COLOR },
  otherMessageTime: { color: MESSAGE_TEXT_COLOR },
  systemRow:      { alignItems: "center", marginVertical: 6, paddingHorizontal: 16 },
  systemText:     { fontFamily: "Manrope-Regular", fontSize: 12, color: LIGHT_TEXT, fontStyle: "italic", opacity: 0.7, textAlign: "center" },
  inputContent:   { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 16, paddingVertical: 12 },
  inputWrapper:   { flex: 1, marginRight: 8, borderRadius: 22, backgroundColor: "#FFFFFF",
    borderWidth: 1, borderColor: "#E5E5EA", minHeight: 44,
    justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  input:          { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, maxHeight: 100, minHeight: 44,
    fontFamily: "Manrope-Regular", fontSize: 14.5, color: "#1F3A5F",
    backgroundColor: "transparent", textAlignVertical: "center", borderWidth: 0 },
  sendButton:     { width: 44, height: 44, borderRadius: 22, backgroundColor: PRIMARY_COLOR,
    alignItems: "center", justifyContent: "center", shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5, elevation: 5 },
  sendButtonDisabled: { backgroundColor: LIGHT_TEXT, shadowOpacity: 0, elevation: 0 },

  // ΓöÇΓöÇ Locked announcement bar ΓöÇΓöÇ
  lockedBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: CHAT_CANVAS_BG,
    borderTopWidth: 1, borderTopColor: INCOMING_BORDER,
  },
  lockedBarIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(53,101,242,0.1)",
    alignItems: "center", justifyContent: "center",
    marginRight: 10,
  },
  lockedBarText: {
    flex: 1,
    fontFamily: "Manrope-Medium", fontSize: 13,
    color: LIGHT_TEXT,
  },
  lockedBarBadge: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(143,161,184,0.12)",
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
  },
  lockedBarBadgeText: {
    fontFamily: "Manrope-Medium", fontSize: 10, color: "#8FA1B8",
  },

  // ΓöÇΓöÇ Media preview strip ΓöÇΓöÇ
  mediaPreviewStrip: {
    borderTopWidth: 1, borderTopColor: INCOMING_BORDER,
    backgroundColor: CHAT_CANVAS_BG,
    paddingTop: 10, paddingBottom: 6,
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
    width: 64, height: 64, borderRadius: 10,
    backgroundColor: "#E0E0E0",
  },
  mediaPreviewVideoIcon: {
    position: "absolute", left: 24, top: 24,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center",
  },
  mediaThumbRemove: {
    position: "absolute", top: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center", justifyContent: "center",
  },
  mediaCaptionRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 8,
  },
  mediaCaption: {
    flex: 1, marginRight: 10,
    fontFamily: "Manrope-Regular", fontSize: 14, color: "#1F3A5F",
    maxHeight: 80,
  },

  // ΓöÇΓöÇ Attachment button ΓöÇΓöÇ
  attachBtn: {
    width: 40, height: 44,
    alignItems: "center", justifyContent: "center",
    marginRight: 4,
  },
});

