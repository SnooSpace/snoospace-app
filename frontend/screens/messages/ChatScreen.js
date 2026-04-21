import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  StyleSheet, View, Platform, Alert, Text, TextInput,
  TouchableOpacity, FlatList, Image, KeyboardAvoidingView, Pressable,
} from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing, runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { useKeyboardHandler } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ArrowLeft, Send, X, Reply, CornerUpLeft, Info, TriangleAlert, Trash2 } from "lucide-react-native";

import { BlurView } from "expo-blur";
import { getMessages, sendMessage, unsendMessage, getConversations } from "../../api/messages";
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
  const preview = reply.isDeleted ? "This message was unsent" :
    (reply.messageText || "").slice(0, 60) + ((reply.messageText || "").length > 60 ? "…" : "");
  return (
    <Animated.View style={[replyBarStyles.container, animStyle]}>
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
  body:    { flex:1 },
  name:    { fontFamily:"Manrope-SemiBold", fontSize:12, color: LIGHT_TEXT, marginBottom:2 },
});

// ── ReplyQuote ────────────────────────────────────────────────────────────────
const ReplyQuote = ({ replyPreview, isMyMessage, onPress }) => (
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
        ) : (
          <Text style={[quoteStyles.text, isMyMessage ? quoteStyles.myText : quoteStyles.otherText]} numberOfLines={2}>
            {replyPreview.messageText || "Message"}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  </View>
);
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
});

// ── MessageOptionsModal ────────────────────────────────────────────────────────
const MessageOptionsModal = ({ visible, isMyMessage, onReply, onUnsend, onCancel }) => {
  if (!visible) return null;
  return (
    <View style={optionsStyles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
      <View style={optionsStyles.menu}>
        <TouchableOpacity style={optionsStyles.option} onPress={onReply}>
          <Reply size={20} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={optionsStyles.optionText}>Reply</Text>
        </TouchableOpacity>
        {isMyMessage && (
          <TouchableOpacity style={optionsStyles.option} onPress={onUnsend}>
            <Trash2 size={20} color="#E53935" strokeWidth={2.5} />
            <Text style={[optionsStyles.optionText, { color: "#E53935" }]}>Unsend</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
const optionsStyles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor:"rgba(0,0,0,0.5)",
    justifyContent:"center", alignItems: "center", zIndex:999 },
  menu:    { backgroundColor:"#262626", borderRadius:16, width: 220, paddingVertical: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  option:  { flexDirection: "row", alignItems: "center", paddingVertical:14, paddingHorizontal:20 },
  optionText: { fontFamily:"Manrope-Medium", fontSize:15, color:"#FFFFFF", marginLeft: 16 },
});

// ── ReportModal ───────────────────────────────────────────────────────────────
const ReportModal = ({ visible, onConfirm, onCancel }) => {
  if (!visible) return null;
  return (
    <View style={reportStyles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
      <View style={reportStyles.card}>
        <View style={reportStyles.iconContainer}>
          <TriangleAlert size={28} color="#E53935" strokeWidth={2} />
        </View>
        <Text style={reportStyles.title}>Report Chat</Text>
        <Text style={reportStyles.subtitle}>Are you sure you want to report this chat? Our team will review the conversation history.</Text>
        <View style={reportStyles.actions}>
          <TouchableOpacity style={reportStyles.cancelBtn} onPress={onCancel}>
            <Text style={reportStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={reportStyles.confirmBtn} onPress={onConfirm}>
            <Text style={reportStyles.confirmText}>Report</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
const reportStyles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center", alignItems: "center", zIndex: 1000 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 20, width: 300, padding: 24, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  iconContainer: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(229, 57, 53, 0.1)",
    justifyContent: "center", alignItems: "center", marginBottom: 16 },
  title: { fontFamily: "BasicCommercial-Bold", fontSize: 20, color: "#1F3A5F", marginBottom: 8, textAlign: "center" },
  subtitle: { fontFamily: "Manrope-Regular", fontSize: 14, color: "#666", textAlign: "center", marginBottom: 24, lineHeight: 20 },
  actions: { flexDirection: "row", justifyContent: "space-between", width: "100%" },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#F0F4FF", marginRight: 8, alignItems: "center" },
  cancelText: { fontFamily: "Manrope-SemiBold", fontSize: 15, color: "#3565F2" },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#E53935", marginLeft: 8, alignItems: "center" },
  confirmText: { fontFamily: "Manrope-SemiBold", fontSize: 15, color: "#FFFFFF" },
});

// ── Main Component ────────────────────────────────────────────────────────────
export default function ChatScreen({ route, navigation }) {
  const { conversationId, recipientId, recipientType = "member", isGroup = false, groupName } = route.params || {};


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
  const [reportModalVisible,    setReportModalVisible]   = useState(false);
  const [hapticFired,           setHapticFired]          = useState({});   // { [msgId]: bool }

  const flatListRef       = useRef(null);
  const inputRef          = useRef(null);
  const subscriptionRef   = useRef(null);
  const supabaseRef       = useRef(null);
  const pollingIntervalRef = useRef(null);
  const insets            = useSafeAreaInsets();

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
        Alert.alert("Error", err?.message || "Failed to load conversation.", [{ text: "OK", onPress: () => navigation.goBack() }]);
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
    if (!messageText.trim() || sending) return;
    const text = messageText.trim();
    const replyId = selectedReply?.id || null;
    const replyPreviewObj = selectedReply ? { ...selectedReply } : null;
    setMessageText("");
    setSelectedReply(null);
    setSending(true);
    try {
      const finalRecipientId   = currentRecipientId || recipientId || recipient?.id;
      const finalRecipientType = currentRecipientType || recipientType || recipient?.type || "member";
      if (!finalRecipientId) throw new Error("Recipient information is missing.");
      const response = await sendMessage({
        conversationId: currentConversationId || undefined,
        recipientId: currentConversationId ? undefined : finalRecipientId,
        recipientType: finalRecipientType,
        messageText: text,
        reply_to_message_id: replyId,
      });
      const msg = { ...response.message, replyPreview: replyPreviewObj };
      if (!currentConversationId) {
        setCurrentConversationId(msg.conversationId);
      }
      setMessages(prev => [...prev, msg]);
      EventBus.emit("conversation-updated", {
        conversationId: msg.conversationId,
        lastMessage: msg.messageText,
        lastMessageAt: msg.createdAt,
        otherParticipant: recipient ? { ...recipient, type: finalRecipientType } : { id: finalRecipientId, type: finalRecipientType },
      });
      EventBus.emit("new-message");
      setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);
    } catch (err) {
      console.error("Error sending message:", err);
      setMessageText(text);
      Alert.alert("Error", err?.message || "Failed to send message.", [{ text: "OK" }]);
    } finally {
      setSending(false);
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
      Alert.alert("Error", "Could not unsend message.");
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

  // ── shouldShowAvatar ───────────────────────────────────────────────────────
  const shouldShowAvatar = useCallback((message, nextMessage) => {
    const recipientUserId = recipient?.id || recipientId;
    if (message.senderId !== recipientUserId) return false;
    if (!nextMessage) return true;
    if (nextMessage.senderId !== message.senderId) return true;
    const diff = Math.abs(new Date(nextMessage.createdAt) - new Date(message.createdAt));
    return diff > 60000;
  }, [recipient, recipientId]);

  const SwipeableMessage = useCallback(({ onReply, isMyMessage: isMine, children }) => {
    const translateX  = useSharedValue(0);
    const iconOpacity = useSharedValue(0);
    const fired       = useRef(false);
    // Own messages swipe LEFT (negative X); others swipe RIGHT (positive X)
    const pan = Gesture.Pan()
      .activeOffsetX(isMine ? [-999, -8] : [8, 999])
      .failOffsetY([-10, 10])
      .onUpdate((e) => {
        const raw = isMine
          ? Math.max(Math.min(e.translationX, 0), -REPLY_SWIPE_MAX)   // clamp to [-max, 0]
          : Math.min(Math.max(e.translationX, 0), REPLY_SWIPE_MAX);   // clamp to [0, max]
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
    const bubbleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
    const iconStyle   = useAnimatedStyle(() => ({
      opacity: iconOpacity.value,
      transform: [{ scale: Math.max(0.5, iconOpacity.value) }]
    }));
    const iconContainer = (
      <Animated.View style={[
        { position: "absolute", zIndex: -1 },
        isMine ? { right: 12 } : { left: 12 },
        iconStyle,
      ]}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: INCOMING_MESSAGE_BG, borderWidth: 1, borderColor: INCOMING_BORDER, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
          <Reply size={16} color={MESSAGE_TEXT_COLOR} strokeWidth={2.5} />
        </View>
      </Animated.View>
    );
    return (
      <GestureDetector gesture={pan}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          {iconContainer}
          <Animated.View style={[{ flex: 1 }, bubbleStyle]}>{children}</Animated.View>
        </View>
      </GestureDetector>
    );
  }, []);

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
        if (!giftId) { Alert.alert("Error", "Unable to process RSVP"); return; }
        setRsvpLoading(prev => ({ ...prev, [msg.id]: true }));
        try {
          const result = await confirmGiftRSVP(giftId, response);
          if (result.success) {
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, metadata: { ...m.metadata, status: result.status } } : m));
            Alert.alert(response === "going" ? "You're In! 🎉" : "Maybe Next Time", result.message);
          }
        } catch (err) { Alert.alert("Error", err?.message || "Failed to confirm RSVP"); }
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

    if (msg.messageType === "post_share" && msg.metadata) {
      return (
        <View style={[styles.messageContainer, isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer]}>
          {!isMyMessage && (showAvatar ? <Image source={{ uri: avatarUri }} style={styles.messageAvatar} /> : <View style={{ width: 30, marginRight: 8 }} />)}
          <SharedPostCard metadata={msg.metadata} onPress={(postId, postData) => {
            setSharedPosts(prev => ({ ...prev, [postId]: postData }));
            setSelectedSharedPost(postData); setSharedPostModalVisible(true);
          }} />
        </View>
      );
    }

    const bubbleContent = (
      <Pressable
        onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setOptionsTarget(msg); }}
        delayLongPress={400}
      >
        <View style={{ alignItems: isMyMessage ? "flex-end" : "flex-start", maxWidth: "100%" }}>
          {msg.replyPreview && (
            <ReplyQuote replyPreview={msg.replyPreview} isMyMessage={isMyMessage} onPress={() => {
              const idx = messageIndexMap[msg.replyToMessageId];
              if (idx != null) flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
            }} />
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
      </Pressable>
    );

    return (
      <View style={[styles.messageContainer, isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer]}>
        {!isMyMessage && (showAvatar ? <Image source={{ uri: avatarUri }} style={styles.messageAvatar} /> : <View style={{ width: 30, marginRight: 8 }} />)}
        <SwipeableMessage
          isMyMessage={isMyMessage}
          onReply={() => setSelectedReply({
            id: msg.id,
            messageText: msg.messageText,
            senderName: isMyMessage ? "You" : (msg.senderName || recipient?.name),
            isDeleted: msg.isDeleted,
          })}
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
                  onPress={() => setReportModalVisible(true)}
                >
                  <TriangleAlert size={22} color="#E53935" strokeWidth={2} />
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
                  onPress={() => setReportModalVisible(true)}
                >
                  <TriangleAlert size={22} color="#E53935" strokeWidth={2} />
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
              ref={flatListRef}
              data={[...flatListData].reverse()}
              keyExtractor={(item) => item.type === "separator" ? item.id : String(item.data.id)}
              renderItem={renderItem}
              contentContainerStyle={[styles.messagesList, { flexGrow: 1 }]}
              inverted
              onScrollToIndexFailed={(info) => setTimeout(() => flatListRef.current?.scrollToIndex({ index: info.index, animated: true }), 200)}
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
            <View style={styles.inputContent}>
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
              <Pressable
                style={({ pressed }) => [
                  styles.sendButton,
                  (!messageText.trim() || sending) && styles.sendButtonDisabled,
                  pressed && !(!messageText.trim() || sending) && { backgroundColor: SEND_BUTTON_PRESSED },
                ]}
                onPress={handleSend}
                disabled={!messageText.trim() || sending}
              >
                {sending ? <SnooLoader size="small" color="#FFFFFF" /> : <Send size={20} color="#FFFFFF" strokeWidth={2.6} />}
              </Pressable>
            </View>
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

        <ReportModal 
          visible={reportModalVisible} 
          onCancel={() => setReportModalVisible(false)} 
          onConfirm={() => {
            setReportModalVisible(false);
            setTimeout(() => Alert.alert("Reported", "Chat reported successfully."), 300);
          }} 
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
});

