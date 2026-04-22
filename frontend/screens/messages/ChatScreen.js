import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  StyleSheet, View, Platform, Alert, Text, TextInput, Modal,
  TouchableOpacity, Image, KeyboardAvoidingView, Pressable,
} from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing, runOnJS,
  withSequence, useDerivedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector, GestureHandlerRootView, FlatList as RNGHFlatList } from "react-native-gesture-handler";
import { useKeyboardHandler } from "react-native-keyboard-controller";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ArrowLeft, Send, X, Reply, TriangleAlert, Trash2, AlertTriangle, PartyPopper, MoreVertical, Flag, CheckCircle, Bell, BellOff, Image as ImageIcon, LockKeyhole, ImagePlus, Megaphone } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import CustomAlertModal from "../../components/ui/CustomAlertModal";

import { BlurView } from "expo-blur";
import { getMessages, sendMessage, unsendMessage, getConversations, hideConversation, reportConversation, muteConversation, unmuteConversation, getGroupParticipants } from "../../api/messages";
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

// ── Palette ──────────────────────────────────────────────────────────────────
const PRIMARY_COLOR       = "#3565F2";
const SEND_BUTTON_PRESSED = "#2E56D6";
const CHAT_CANVAS_BG      = "#F7F9FC";
const OUTGOING_MESSAGE_BG = "#E6F0FF";
const INCOMING_MESSAGE_BG = "#FFFFFF";
const INCOMING_BORDER     = "#E6ECF5";
const MESSAGE_TEXT_COLOR  = "#1F3A5F";
const LIGHT_TEXT          = COLORS.textSecondary;
const REPLY_SWIPE_MAX     = 72;
const REPLY_HAPTIC_THRESHOLD = 64;

// ── Helpers ───────────────────────────────────────────────────────────────────
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
 * buildMessageList: converts raw messages array into a mixed list of
 * { type:'separator', id, label } | { type:'message', data }
 * – filters sender-deleted messages
 * – injects date separators on 15-minute gaps or date changes
 */
const buildMessageList = (messages) => {
  if (!messages || messages.length === 0) return [];
  const result = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const prev = messages[i - 1];
    
    let isNewDay = false;
    if (!prev) {
      isNewDay = true;
    } else {
      const tCur = new Date(msg.createdAt);
      const tPrev = new Date(prev.createdAt);
      isNewDay = tCur.toDateString() !== tPrev.toDateString();
    }
    
    if (isNewDay) {
      result.push({ type: "separator", id: `sep-${msg.id}`, label: formatSeparatorLabel(msg.createdAt) });
    }
    result.push({ type: "message", data: msg });
  }
  return result;
};

// ── TimestampSeparator ─────────────────────────────────────────────────────────
const TimestampSeparator = ({ label }) => (
  <View style={sepStyles.row}>
    <Text style={sepStyles.label}>{label}</Text>
  </View>
);
const sepStyles = StyleSheet.create({
  row:   { alignItems: "center", marginVertical: 12 },
  label: { fontFamily: "Manrope-Medium", fontSize: 12, color: LIGHT_TEXT, opacity: 0.7 },
});

// ── ReplyBar (above input) ────────────────────────────────────────────────────
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
    const captionLine = reply.postCaption ? ` · ${reply.postCaption.slice(0, 40)}${reply.postCaption.length > 40 ? "…" : ""}` : "";
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

// ── ReplyQuote ────────────────────────────────────────────────────────────────
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
                  {replyPreview.postAuthorUsername && replyPreview.postCaption ? " · " : ""}
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

// ── REPORT_REASONS ────────────────────────────────────────────────────────────
const REPORT_REASONS = [
  { key: "harassment",           label: "Harassment or bullying" },
  { key: "spam",                 label: "Spam or unwanted content" },
  { key: "hate_speech",          label: "Hate speech or discrimination" },
  { key: "threats",              label: "Threats or violence" },
  { key: "inappropriate_content",label: "Inappropriate content" },
  { key: "other",                label: "Other" },
];

// ── ChatActionsSheet ─────────────────────────────────────────────────────────
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

// ── ReportReasonSheet ─────────────────────────────────────────────────────────
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

// ── SwipeableMessage ──────────────────────────────────────────────────────────
// IMPORTANT: This MUST be a module-level React.memo component — NOT defined
// inside useCallback. Defining it inside the parent with hooks would violate
// the Rules of Hooks and cause stale-closure bugs (highlight never fires).
//
// highlightedIdSV is a Reanimated shared value (string). We use useDerivedValue
// to reactively detect when *this* message becomes highlighted, entirely on the
// UI thread with zero React re-renders.
const SwipeableMessage = React.memo(({ messageId, highlightedIdSV, onReply, onLongPress, isMyMessage: isMine, children }) => {
  const translateX  = useSharedValue(0);
  const iconOpacity = useSharedValue(0);
  const scale       = useSharedValue(1);
  const bgOpacity   = useSharedValue(0);
  const fired       = useRef(false);

  // useDerivedValue runs on the UI thread. Every time highlightedIdSV changes,
  // this derived value recomputes and triggers the animation worklet below.
  const isHighlighted = useDerivedValue(() => {
    return highlightedIdSV.value === String(messageId);
  });

  // useAnimatedReaction would be the canonical hook here, but since we need
  // to chain multiple animations we drive them directly from useAnimatedStyle
  // by caching a "has run" guard via a separate shared value.
  const hasAnimated = useSharedValue(false);

  const highlightOverlayStyle = useAnimatedStyle(() => {
    const highlighted = isHighlighted.value;

    if (highlighted && !hasAnimated.value) {
      hasAnimated.value = true;

      // Pulse: scale up then back
      scale.value = withSequence(
        withTiming(1.04, { duration: 150 }),
        withTiming(1,    { duration: 300 })
      );

      // Glow: fade in fast, then fade out slow
      bgOpacity.value = withTiming(1, { duration: 180 }, () => {
        bgOpacity.value = withTiming(0, { duration: 900 });
      });
    }

    if (!highlighted) {
      hasAnimated.value = false;
    }

    return {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(255, 213, 79, 0.38)",
      borderRadius: 18,
      opacity: bgOpacity.value,
      pointerEvents: "none",
    };
  });

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ scale: Math.max(0.5, iconOpacity.value) }],
  }));

  // Long press for options
  const longPress = Gesture.LongPress()
    .onStart(() => { if (onLongPress) runOnJS(onLongPress)(); })
    .maxDistance(20);

  // Pan for swipe-to-reply
  const pan = Gesture.Pan()
    .activeOffsetX(isMine ? [-20, 9999] : [-9999, 20])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      const raw = isMine
        ? Math.max(Math.min(e.translationX, 0), -REPLY_SWIPE_MAX)
        : Math.min(Math.max(e.translationX, 0), REPLY_SWIPE_MAX);
      translateX.value  = raw;
      iconOpacity.value = Math.abs(raw) / REPLY_SWIPE_MAX;
      if (Math.abs(raw) >= REPLY_HAPTIC_THRESHOLD && !fired.current) {
        fired.current = true;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      }
    })
    .onEnd((e) => {
      const didTrigger = Math.abs(e.translationX) >= REPLY_HAPTIC_THRESHOLD;
      translateX.value  = withSpring(0, { damping: 18, stiffness: 200 });
      iconOpacity.value = withTiming(0, { duration: 150 });
      fired.current = false;
      if (didTrigger) runOnJS(onReply)();
    });

  const composed = Gesture.Simultaneous(longPress, pan);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
      <Animated.View style={[
        { position: "absolute", zIndex: -1 },
        isMine ? { right: 12 } : { left: 12 },
        iconStyle,
      ]}>
        <View style={{
          width: 32, height: 32, borderRadius: 16,
          backgroundColor: INCOMING_MESSAGE_BG, borderWidth: 1, borderColor: INCOMING_BORDER,
          alignItems: "center", justifyContent: "center",
          shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
        }}>
          <Reply size={16} color={MESSAGE_TEXT_COLOR} strokeWidth={2.5} />
        </View>
      </Animated.View>

      <Animated.View style={[{ flex: 1, alignItems: isMine ? "flex-end" : "flex-start" }, bubbleStyle]}>
        <GestureDetector gesture={composed}>
          <View collapsable={false}>
            <Animated.View style={highlightOverlayStyle} />
            {children}
          </View>
        </GestureDetector>
      </Animated.View>
    </View>
  );
});

// ── Main Component ────────────────────────────────────────────────────────────
export default function ChatScreen({ route, navigation }) {
  const {
    conversationId, recipientId, recipientType = "member",
    isGroup = false, groupName,
    isMuted: initialIsMuted = false, mutedUntil: initialMutedUntil = null,
    // Passed from ConversationsListScreen for instant render — no async needed
    myGroupRole: initialMyGroupRole = null,
    messagingRestricted: initialMessagingRestricted = false,
  } = route.params || {};


  const [messages,              setMessages]             = useState([]);
  const [messageText,           setMessageText]          = useState("");
  const [loading,               setLoading]              = useState(true);
  const [sending,               setSending]              = useState(false);
  const [recipient,             setRecipient]            = useState(null);
  const [currentConversationId, setCurrentConversationId] = useState(conversationId);
  const [currentRecipientType,  setCurrentRecipientType] = useState(recipientType);
  const [currentRecipientId,    setCurrentRecipientId]   = useState(recipientId);
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
  const [mediaAttachment,       setMediaAttachment]       = useState(null); // { uri, type, caption }
  const [uploadProgress,        setUploadProgress]        = useState(0);
  const [uploadingMedia,        setUploadingMedia]        = useState(false);

  // highlight state lives in Reanimated (see highlightedIdSV below renderItem)

  const showAlert = (config) => setAlertConfig({ ...config, visible: true });
  const hideAlert = () => setAlertConfig((p) => ({ ...p, visible: false }));

  const flatListRef        = useRef(null);
  const scrollOffsetRef    = useRef(0);
  const inputRef           = useRef(null);
  const subscriptionRef    = useRef(null);
  const supabaseRef        = useRef(null);
  const pollingIntervalRef = useRef(null);
  const groupParticipantsRef = useRef([]); // stores group participant list for role resolution
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

  // ── flatListData: memoised mixed separator + message list ──────────────────
  const flatListData = useMemo(() => {
    // messages from API are oldest→newest; buildMessageList works oldest→newest
    return buildMessageList([...messages]);
  }, [messages]);

  // Map message id → index in flatListData for scroll-to-reply
  const messageIndexMap = useMemo(() => {
    const map = {};
    flatListData.forEach((item, idx) => {
      if (item.type === "message") map[item.data.id] = idx;
    });
    return map;
  }, [flatListData]);

  // ── scrollToMessage ────────────────────────────────────────────────────────
  const scrollToMessage = useCallback((targetId) => {
    const idx = messageIndexMap[targetId];
    if (idx == null) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // ── Nudge trick ─────────────────────────────────────────────────────────
    // FlatList skips scrollToIndex entirely if the item is already inside
    // the render window ("already visible" optimisation). Scrolling 1px off
    // the current offset forces FlatList to treat the target as out-of-view
    // and always honour the subsequent scrollToIndex call.
    flatListRef.current?.scrollToOffset({
      offset: scrollOffsetRef.current + 1,
      animated: false,
    });

    // ── Precise scroll ──────────────────────────────────────────────────────
    // viewPosition: 1  → in an inverted FlatList this anchors the TOP edge of
    // the item to the TOP of the visible viewport, ensuring the full message
    // is always on screen regardless of height (critical for SharedPostCard).
    // viewOffset: 16   → breathing room so the item isn’t flush against the header.
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: idx,
        animated: true,
        viewPosition: 1,
        viewOffset: 16,
      });
    }, 30);

    // Signal the UI thread to start the highlight animation.
    // Writing directly to a shared value bypasses React scheduling entirely —
    // no re-renders, no stale closures.
    highlightedIdSV.value = String(targetId);
    setTimeout(() => { highlightedIdSV.value = ""; }, 1600);
  }, [messageIndexMap, highlightedIdSV]);

  // ── loadMessages ────────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (convId) => {
    try {
      const response = await getMessages(convId);
      setMessages(response.messages || []);
      EventBus.emit("messages-read");
      setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: false }), 100);
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  }, []);

  // ── initializeConversation ──────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        if (conversationId) {
          setCurrentConversationId(conversationId);
          await loadMessages(conversationId);
          // For group chats: fetch restriction flag + current user role
          if (isGroup) {
            try {
              const gpRes = await getGroupParticipants(conversationId);
              setMessagingRestricted(gpRes.messagingRestricted || false);
              // find current user's role by matching token user — we get it from auth via getConversations
              // We store it after we also load current user identity below
              if (gpRes._myRole) setMyGroupRole(gpRes._myRole); // populated below
            } catch { /* non-fatal */ }
          }
        } else if (recipientId) {
          const res = await getConversations();
          const existing = res.conversations?.find(c => c.otherParticipant?.id === recipientId);
          if (existing) {
            setCurrentConversationId(existing.id);
            await loadMessages(existing.id);
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

  // ── load recipient from conversationId ─────────────────────────────────────
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

  // ── Background-refresh group restriction + role (stale-while-revalidate) ────────────
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

  // ── Supabase init ──────────────────────────────────────────────────────────
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

  // ── Realtime / polling ─────────────────────────────────────────────────────
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
              setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, {
                id: m.id, senderId: m.sender_id, senderType: m.sender_type,
                messageText: m.message_text, messageType: m.message_type,
                isDeleted: m.is_deleted, deletedByType: m.deleted_by_type,
                replyToMessageId: m.reply_to_message_id, isRead: m.is_read, createdAt: m.created_at,
              }]);
              setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);
            }
            if (payload.eventType === "UPDATE") {
              setMessages(prev => prev.map(x => x.id === payload.new.id
                ? { ...x, isDeleted: payload.new.is_deleted, deletedByType: payload.new.deleted_by_type, messageText: payload.new.is_deleted ? null : x.messageText }
                : x));
            }
          })
        .subscribe();
      subscriptionRef.current = ch;
      return () => { if (supabaseRef.current) supabaseRef.current.removeChannel(ch); };
    } else {
      const poll = async () => {
        try {
          const res = await getMessages(currentConversationId, { page: 1, limit: 50 });
          const fresh = res.messages || [];
          setMessages(prev => fresh.length !== prev.length ? fresh : prev);
        } catch { }
      };
      poll();
      pollingIntervalRef.current = setInterval(poll, 3000);
      return () => { clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; };
    }
  }, [currentConversationId]);

  const handleSend = async () => {
    const hasText  = messageText.trim().length > 0;
    const hasMedia = !!mediaAttachment;
    if ((!hasText && !hasMedia) || sending || uploadingMedia) return;

    const text          = messageText.trim();
    const replyId       = selectedReply?.id || null;
    const replyPreviewObj = selectedReply ? { ...selectedReply } : null;
    const attachmentSnap = mediaAttachment;

    setMessageText("");
    setSelectedReply(null);
    setMediaAttachment(null);
    setSending(true);

    try {
      const finalRecipientId   = currentRecipientId || recipientId || recipient?.id;
      const finalRecipientType = currentRecipientType || recipientType || recipient?.type || "member";
      if (!finalRecipientId && !currentConversationId) throw new Error("Recipient information is missing.");

      let msgType  = "text";
      let metadata = null;

      if (attachmentSnap) {
        // Upload media first
        setUploadingMedia(true);
        setUploadProgress(0);
        const uploaded = await uploadChatMedia(
          attachmentSnap.uri,
          attachmentSnap.type,
          { onProgress: (p) => setUploadProgress(p) },
        );
        setUploadingMedia(false);
        msgType  = attachmentSnap.type; // 'image' | 'video'
        metadata = {
          url:           uploaded.url,
          public_id:     uploaded.public_id,
          resource_type: uploaded.resource_type,
          duration:      uploaded.duration,
          thumbnail_url: uploaded.thumbnail_url,
          width:         uploaded.width,
          height:        uploaded.height,
        };
      }

      const response = await sendMessage({
        conversationId:      currentConversationId || undefined,
        recipientId:         currentConversationId ? undefined : finalRecipientId,
        recipientType:       finalRecipientType,
        messageText:         text,
        messageType:         msgType,
        reply_to_message_id: replyId,
        metadata,
      });
      const msg = { ...response.message, replyPreview: replyPreviewObj };
      if (!currentConversationId) setCurrentConversationId(msg.conversationId);
      setMessages(prev => [...prev, msg]);
      EventBus.emit("conversation-updated", {
        conversationId: msg.conversationId,
        lastMessage: msgType === "image" ? "📷 Photo" : msgType === "video" ? "🎥 Video" : msg.messageText,
        lastMessageAt: msg.createdAt,
        otherParticipant: recipient ? { ...recipient, type: finalRecipientType } : { id: finalRecipientId, type: finalRecipientType },
      });
      EventBus.emit("new-message");
      setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);
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

  // ── handlePickMedia ───────────────────────────────────────────────────────────────
  const handlePickMedia = async (type) => {
    try {
      const mediaTypes = type === "video"
        ? ImagePicker.MediaTypeOptions.Videos
        : ImagePicker.MediaTypeOptions.Images;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes,
        allowsEditing: false,
        quality: 0.85,
        videoMaxDuration: 60, // 60s Instagram-style limit
      });

      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];

      // Enforce size limits
      const maxBytes = type === "video" ? 100 * 1024 * 1024 : 50 * 1024 * 1024;
      if (asset.fileSize && asset.fileSize > maxBytes) {
        showAlert({
          title: type === "video" ? "Video Too Large" : "Image Too Large",
          message: type === "video"
            ? "Videos must be under 100 MB and 60 seconds."
            : "Images must be under 50 MB.",
          primaryAction: { text: "OK", onPress: hideAlert },
          icon: AlertTriangle,
        });
        return;
      }

      setMediaAttachment({ uri: asset.uri, type, duration: asset.duration });
    } catch (err) {
      console.error("Media pick error:", err);
    }
  };

  // ── handleUnsend ───────────────────────────────────────────────────────────
  const handleUnsend = async (id) => {
    setMessages(prev => prev.map(m => {
      // Mark the deleted message itself
      if (m.id === id) {
        return { ...m, isDeleted: true, deletedByType: "sender", messageText: null };
      }
      // Mark any reply previews that reference this message
      if (m.replyPreview && m.replyToMessageId === id) {
        return { ...m, replyPreview: { ...m.replyPreview, isDeleted: true, messageText: null } };
      }
      return m;
    }));
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
      // Revert both the message and any reply previews pointing to it
      setMessages(prev => prev.map(m => {
        if (m.id === id) return { ...m, isDeleted: false };
        if (m.replyPreview && m.replyToMessageId === id) {
          return { ...m, replyPreview: { ...m.replyPreview, isDeleted: false } };
        }
        return m;
      }));
    }
  };

  // ── handleDeleteChat ────────────────────────────────────────────────────
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

  // ── handleMuteChat ───────────────────────────────────────────────────────
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

  // ── handleStartReport ─────────────────────────────────────────────────
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

  // ── shouldShowAvatar ───────────────────────────────────────────────────────
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

  // ── renderItem ─────────────────────────────────────────────────────────────
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
    const reversedData = [...flatListData].reverse();
    const nextItem     = reversedData[index - 1];
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
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, metadata: { ...m.metadata, status: result.status } } : m));
            showAlert({
              title: response === "going" ? "You're In! 🎉" : "Maybe Next Time",
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

    // ── Image / Video messages ────────────────────────────────────────────────────────────
    if (msg.messageType === "image" || msg.messageType === "video") {
      return (
        <View style={[styles.messageContainer, isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer]}>
          {!isMyMessage && (showAvatar ? <Image source={{ uri: avatarUri }} style={styles.messageAvatar} /> : <View style={{ width: 30, marginRight: 8 }} />)}
          <SwipeableMessage
            messageId={msg.id}
            highlightedIdSV={highlightedIdSV}
            isMyMessage={isMyMessage}
            onReply={() => setSelectedReply({
              id: msg.id,
              messageText: msg.messageType === "image" ? "📷 Photo" : "🎥 Video",
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

  // ── Loading screen ─────────────────────────────────────────────────────────
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

  // ── Main render ─────────────────────────────────────────────────────────────
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
            <RNGHFlatList
              ref={flatListRef}
              data={[...flatListData].reverse()}
              keyExtractor={(item) => item.type === "separator" ? item.id : String(item.data.id)}
              renderItem={renderItem}
              contentContainerStyle={[styles.messagesList, { flexGrow: 1 }]}
              inverted
              initialNumToRender={10}
              windowSize={5}
              removeClippedSubviews={false}
              scrollEventThrottle={16}
              onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
              onScrollToIndexFailed={(info) => {
                // Item not rendered yet — scroll to approximate offset first,
                // then retry with the same viewPosition:1 anchor.
                flatListRef.current?.scrollToOffset({
                  offset: info.averageItemLength * info.index,
                  animated: true,
                });
                setTimeout(() => {
                  flatListRef.current?.scrollToIndex({
                    index: info.index,
                    animated: true,
                    viewPosition: 1,
                    viewOffset: 16,
                  });
                }, 150);
              }}
              onLayout={() => setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: false }), 100)}
              ListEmptyComponent={
                <View style={{ flex: 1, justifyContent: "center", minHeight: 500 }}>
                  <EmptyChatState onSendMessage={() => inputRef.current?.focus()} />
                </View>
              }
            />
          </Animated.View>
        </KeyboardAvoidingView>

        <KeyboardAwareToolbar>
          <View style={{ flexDirection: "column" }}>
            <ReplyBar reply={selectedReply} onClose={() => setSelectedReply(null)} />

            {/* ── Locked bar: shown to non-admins when messaging is restricted ── */}
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
                {/* ── Media preview strip ── */}
                {mediaAttachment && (
                  <View style={styles.mediaPreviewStrip}>
                    <Image
                      source={{ uri: mediaAttachment.uri }}
                      style={styles.mediaPreviewThumb}
                      resizeMode="cover"
                    />
                    {mediaAttachment.type === "video" && (
                      <View style={styles.mediaPreviewVideoIcon}>
                        <Text style={{ fontSize: 10 }}>🎥</Text>
                      </View>
                    )}
                    <TextInput
                      style={styles.mediaCaption}
                      placeholder="Add a caption…"
                      placeholderTextColor="#B0BEC5"
                      value={messageText}
                      onChangeText={setMessageText}
                      multiline
                      maxLength={500}
                    />
                    <TouchableOpacity
                      onPress={() => { setMediaAttachment(null); setMessageText(""); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={18} color="#8FA1B8" strokeWidth={2.5} />
                    </TouchableOpacity>
                  </View>
                )}

                {/* ── Regular input row ── */}
                <View style={styles.inputContent}>
                  {/* Attachment button */}
                  <TouchableOpacity
                    style={styles.attachBtn}
                    onPress={() => showAlert({
                      title: "Share Media",
                      message: "What would you like to share?",
                      icon: ImagePlus,
                      iconColor: ACCENT,
                      primaryAction: {
                        text: "📷  Photo",
                        onPress: () => { hideAlert(); setTimeout(() => handlePickMedia("image"), 200); },
                      },
                      secondaryAction: {
                        text: "🎥  Video",
                        onPress: () => { hideAlert(); setTimeout(() => handlePickMedia("video"), 200); },
                      },
                    })}
                  >
                    <ImagePlus size={22} color={ACCENT} strokeWidth={2} />
                  </TouchableOpacity>

                  {!mediaAttachment && (
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
                  {mediaAttachment && <View style={{ flex: 1 }} />}

                  <Pressable
                    style={({ pressed }) => [
                      styles.sendButton,
                      (!messageText.trim() && !mediaAttachment || sending || uploadingMedia) && styles.sendButtonDisabled,
                      pressed && (messageText.trim() || mediaAttachment) && !sending && { backgroundColor: SEND_BUTTON_PRESSED },
                    ]}
                    onPress={handleSend}
                    disabled={(!messageText.trim() && !mediaAttachment) || sending || uploadingMedia}
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

  // ── Locked announcement bar ──
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

  // ── Media preview strip ──
  mediaPreviewStrip: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: INCOMING_BORDER,
    backgroundColor: CHAT_CANVAS_BG,
  },
  mediaPreviewThumb: {
    width: 56, height: 56, borderRadius: 10,
    backgroundColor: "#E0E0E0", marginRight: 10,
  },
  mediaPreviewVideoIcon: {
    position: "absolute", left: 22, top: 20,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
  },
  mediaCaption: {
    flex: 1, marginRight: 10,
    fontFamily: "Manrope-Regular", fontSize: 14, color: "#1F3A5F",
    maxHeight: 80,
  },

  // ── Attachment button ──
  attachBtn: {
    width: 40, height: 44,
    alignItems: "center", justifyContent: "center",
    marginRight: 4,
  },
});

