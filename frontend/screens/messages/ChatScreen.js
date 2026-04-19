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
import { ArrowLeft, Send, X, Reply, MoreVertical, CornerUpLeft, Info } from "lucide-react-native";

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
  const GAP = 15 * 60 * 1000;
  const result = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    result.push({ type: "message", data: msg });
    const next = messages[i + 1];
    if (!next) {
      result.push({ type: "separator", id: `sep-top-${msg.id}`, label: formatSeparatorLabel(msg.createdAt) });
      break;
    }
    const tCur  = new Date(msg.createdAt);
    const tNext = new Date(next.createdAt);
    const dayChanged = tNext.toDateString() !== tCur.toDateString();
    const bigGap     = (tCur - tNext) > GAP;
    if (dayChanged || bigGap) {
      result.push({ type: "separator", id: `sep-${msg.id}`, label: formatSeparatorLabel(next.createdAt) });
    }
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
  preview: { fontFamily:"Manrope-Regular",  fontSize:13, color: MESSAGE_TEXT_COLOR },
  close:   { padding:4, marginLeft:8 },
});

// ── ReplyQuote (inside bubble) ────────────────────────────────────────────────
const ReplyQuote = ({ replyPreview, onPress, isMyMessage }) => {
  if (!replyPreview) return null;
  const text = replyPreview.isDeleted ? "Original message was unsent" :
    (replyPreview.messageText || "").slice(0, 80) + ((replyPreview.messageText || "").length > 80 ? "…" : "");
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[quoteStyles.container, isMyMessage ? quoteStyles.myContainer : quoteStyles.otherContainer]}>
      <CornerUpLeft size={12} color={LIGHT_TEXT} style={{ marginRight: 6 }} />
      <Text style={quoteStyles.text} numberOfLines={1}>{text}</Text>
    </TouchableOpacity>
  );
};
const quoteStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: -8, // tuck behind main bubble
    zIndex: -1,
    maxWidth: "80%",
  },
  myContainer: {
    alignSelf: "flex-end",
    marginRight: 12,
  },
  otherContainer: {
    alignSelf: "flex-start",
    marginLeft: 12,
  },
  text: { 
    fontFamily: "Manrope-Medium", 
    fontSize: 12, 
    color: LIGHT_TEXT, 
  },
});

// ── UnsendModal ───────────────────────────────────────────────────────────────
const UnsendModal = ({ visible, onUnsend, onCancel }) => {
  if (!visible) return null;
  return (
    <View style={unsendStyles.overlay}>
      <View style={unsendStyles.sheet}>
        <Text style={unsendStyles.title}>Message Options</Text>
        <TouchableOpacity style={unsendStyles.option} onPress={onUnsend}>
          <Text style={unsendStyles.optionDanger}>Unsend Message</Text>
        </TouchableOpacity>
        <TouchableOpacity style={unsendStyles.option} onPress={onCancel}>
          <Text style={unsendStyles.optionCancel}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
const unsendStyles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor:"rgba(0,0,0,0.45)",
    justifyContent:"flex-end", zIndex:999 },
  sheet:   { backgroundColor:"#FFF", borderTopLeftRadius:20, borderTopRightRadius:20,
    paddingBottom:36, paddingTop:12 },
  title:   { fontFamily:"Manrope-SemiBold", fontSize:14, color:LIGHT_TEXT,
    textAlign:"center", paddingVertical:12, borderBottomWidth:1, borderBottomColor:"#F0F0F0" },
  option:  { paddingVertical:16, paddingHorizontal:24,
    borderBottomWidth:1, borderBottomColor:"#F0F0F0" },
  optionDanger: { fontFamily:"Manrope-SemiBold", fontSize:16, color:"#E53935", textAlign:"center" },
  optionCancel: { fontFamily:"Manrope-Regular",  fontSize:16, color:MESSAGE_TEXT_COLOR, textAlign:"center" },
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
  const [unsendTarget,          setUnsendTarget]         = useState(null); // message id to unsend
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

  // ── handleSend ─────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!messageText.trim() || sending) return;
    const text = messageText.trim();
    const replyId = selectedReply?.id || null;
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
      const msg = response.message;
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
  const handleUnsend = async () => {
    if (!unsendTarget) return;
    const id = unsendTarget;
    setUnsendTarget(null);
    setMessages(prev => prev.map(m => m.id === id
      ? { ...m, isDeleted: true, deletedByType: "sender", messageText: null } : m));
    try {
      await unsendMessage(id);
    } catch (err) {
      console.error("Unsend error:", err);
      Alert.alert("Error", "Could not unsend message.");
      setMessages(prev => prev.map(m => m.id === id ? { ...m, isDeleted: false } : m));
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

  const SwipeableMessage = useCallback(({ onReply, children }) => {
    const translateX  = useSharedValue(0);
    const iconOpacity = useSharedValue(0);
    const fired       = useRef(false);
    const pan = Gesture.Pan()
      .activeOffsetX([8, 999])
      .failOffsetY([-10, 10])
      .onUpdate((e) => {
        const dx = Math.min(Math.max(e.translationX, 0), REPLY_SWIPE_MAX);
        translateX.value  = dx;
        iconOpacity.value = dx / REPLY_SWIPE_MAX;
        if (dx >= REPLY_HAPTIC_THRESHOLD && !fired.current) {
          fired.current = true;
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        }
      })
      .onEnd((e) => {
        const didTrigger = e.translationX >= REPLY_HAPTIC_THRESHOLD;
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
    return (
      <GestureDetector gesture={pan}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <Animated.View style={[{ position: "absolute", left: 12, zIndex: -1 }, iconStyle]}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: INCOMING_MESSAGE_BG, borderWidth: 1, borderColor: INCOMING_BORDER, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
              <Reply size={16} color={MESSAGE_TEXT_COLOR} strokeWidth={2.5} />
            </View>
          </Animated.View>
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
        onLongPress={() => { if (isMyMessage) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setUnsendTarget(msg.id); } }}
        delayLongPress={400}
      >
        <View style={{ alignItems: isMyMessage ? "flex-end" : "flex-start" }}>
          {msg.replyPreview && (
            <ReplyQuote replyPreview={msg.replyPreview} isMyMessage={isMyMessage} onPress={() => {
              const idx = messageIndexMap[msg.replyToMessageId];
              if (idx != null) flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
            }} />
          )}
          <View style={[styles.messageBubble, isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble]}>
            <Text style={[styles.messageText, isMyMessage ? styles.myMessageText : styles.otherMessageText]}>{msg.messageText}</Text>
            <Text style={[styles.messageTime, isMyMessage ? styles.myMessageTime : styles.otherMessageTime]}>{formatTime(msg.createdAt)}</Text>
          </View>
        </View>
      </Pressable>
    );

    return (
      <View style={[styles.messageContainer, isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer]}>
        {!isMyMessage && (showAvatar ? <Image source={{ uri: avatarUri }} style={styles.messageAvatar} /> : <View style={{ width: 30, marginRight: 8 }} />)}
        {!isMyMessage ? (
          <SwipeableMessage onReply={() => setSelectedReply({ id: msg.id, messageText: msg.messageText, senderName: msg.senderName || recipient?.name, isDeleted: msg.isDeleted })}>
            {bubbleContent}
          </SwipeableMessage>
        ) : bubbleContent}
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
                <View style={styles.headerInfo}>
                  <Text style={styles.headerName} numberOfLines={1}>{groupName || "Group"}</Text>
                </View>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => navigation.navigate("GroupInfo", { conversationId: currentConversationId, groupName })}
                >
                  <Info size={20} color="#333333" strokeWidth={2} />
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
                <View style={{ width: 40 }} />
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

        <UnsendModal visible={!!unsendTarget} onUnsend={handleUnsend} onCancel={() => setUnsendTarget(null)} />

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
  messagesList:   { paddingHorizontal: 16, paddingTop: 130, paddingBottom: 30 },
  messageContainer: { flexDirection: "row", marginBottom: 8, alignItems: "flex-end" },
  myMessageContainer:    { justifyContent: "flex-end" },
  otherMessageContainer: { justifyContent: "flex-start" },
  messageAvatar:  { width: 30, height: 30, borderRadius: 15, marginRight: 8 },
  messageBubble:  { maxWidth: "75%", paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6, borderRadius: 18 },
  myMessageBubble:    { backgroundColor: OUTGOING_MESSAGE_BG },
  otherMessageBubble: { backgroundColor: INCOMING_MESSAGE_BG, borderWidth: 1, borderColor: INCOMING_BORDER,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
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

