/**
 * JoinGroupChatModal
 *
 * Shown when:
 * 1. A Member follows a Community that has autoJoin enabled → EventBus "community-followed"
 * 2. A Member registers for an event under a Community → EventBus "event-registered"
 *
 * The modal fetches the community's group invite info and, if present and not already
 * dismissed, presents a join prompt. The user can join or dismiss.
 *
 * Usage: Mount this once at the root/home level so it persists across screens.
 * <JoinGroupChatModal navigation={navigation} />
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, TouchableOpacity, Image, StyleSheet, Modal, Animated, Easing,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Users, X } from "lucide-react-native";
import { getGroupJoinInvite, dismissGroupInvite, selfJoinGroup } from "../../api/messages";
import { getAuthToken, getAuthEmail } from "../../api/auth";
import { apiPost } from "../../api/client";
import EventBus from "../../utils/EventBus";
import SnooLoader from "../../components/ui/SnooLoader";

const ACCENT   = "#3565F2";
const BG_MODAL = "#1C1C1E";
const TEXT     = "#FFFFFF";
const TEXT_SEC = "#8E8E93";
const BORDER   = "#2A2A2A";

export default function JoinGroupChatModal({ navigation }) {
  const [visible,      setVisible]      = useState(false);
  const [invite,       setInvite]       = useState(null);  // { conversationId, groupName, groupAvatarUrl, communityName }
  const [joining,      setJoining]      = useState(false);
  const [currentUser,  setCurrentUser]  = useState(null);
  const slideAnim     = useRef(new Animated.Value(300)).current;
  const pendingQueue  = useRef([]);  // queue of communityId strings to check
  const isProcessing  = useRef(false);

  // ── Load current user once ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const token = await getAuthToken();
        const email = await getAuthEmail();
        if (!token || !email) return;
        const res = await apiPost("/auth/get-user-profile", { email }, 10000, token);
        setCurrentUser({ id: res?.profile?.id, type: res?.role });
      } catch {}
    })();
  }, []);

  // ── Slide animation ───────────────────────────────────────────────────────
  const show = useCallback(() => {
    setVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      damping: 18,
      stiffness: 180,
      useNativeDriver: true,
    }).start();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [slideAnim]);

  const hide = useCallback((afterHide) => {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 250,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setInvite(null);
      slideAnim.setValue(300);
      afterHide?.();
    });
  }, [slideAnim]);

  // ── Process one community from the queue ──────────────────────────────────
  const processNext = useCallback(async () => {
    if (isProcessing.current || pendingQueue.current.length === 0) return;
    isProcessing.current = true;
    const communityId = pendingQueue.current.shift();
    try {
      const res = await getGroupJoinInvite(communityId);
      if (res?.invite && !res.invite.dismissed) {
        setInvite(res.invite);
        show();
      } else {
        isProcessing.current = false;
        processNext();
      }
    } catch {
      isProcessing.current = false;
      processNext();
    }
  }, [show]);

  // ── EventBus subscriptions ────────────────────────────────────────────────
  useEffect(() => {
    const enqueue = (communityId) => {
      if (!communityId) return;
      pendingQueue.current.push(communityId);
      processNext();
    };

    const unsubFollow = EventBus.on("community-followed", ({ communityId }) => enqueue(communityId));
    const unsubEvent  = EventBus.on("event-registered",   ({ communityId }) => enqueue(communityId));

    return () => {
      unsubFollow?.();
      unsubEvent?.();
    };
  }, [processNext]);

  // ── Join action ───────────────────────────────────────────────────────────
  const handleJoin = async () => {
    if (!invite || !currentUser) return;
    setJoining(true);
    try {
      await selfJoinGroup(invite.conversationId);
      hide(() => {
        isProcessing.current = false;
        processNext();
        // Navigate to the group chat
        navigation.navigate("Chat", {
          conversationId: invite.conversationId,
          isGroup: true,
          groupName: invite.groupName,
        });
      });
    } catch (err) {
      console.error("JoinGroupChatModal: join error:", err);
      setJoining(false);
    }
  };

  // ── Dismiss action ────────────────────────────────────────────────────────
  const handleDismiss = () => {
    const convId = invite?.conversationId;
    hide(() => {
      if (convId) dismissGroupInvite(convId).catch(() => {});
      isProcessing.current = false;
      processNext();
    });
  };

  if (!visible || !invite) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={handleDismiss}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={handleDismiss} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
            <X size={18} color={TEXT_SEC} strokeWidth={2} />
          </TouchableOpacity>

          {/* Community avatar */}
          <View style={styles.avatarWrap}>
            {invite.groupAvatarUrl ? (
              <Image source={{ uri: invite.groupAvatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Users size={28} color={ACCENT} strokeWidth={1.5} />
              </View>
            )}
          </View>

          {/* Text */}
          <Text style={styles.heading}>Join the community chat?</Text>
          <Text style={styles.body} numberOfLines={3}>
            <Text style={styles.communityName}>{invite.communityName || "This community"}</Text>
            {" has a group chat — "}
            <Text style={styles.groupName}>{invite.groupName || "Community Updates"}</Text>
            {". Join to stay in the loop with events, news, and updates."}
          </Text>

          {/* Actions */}
          <TouchableOpacity
            style={[styles.joinBtn, joining && { opacity: 0.7 }]}
            onPress={handleJoin}
            disabled={joining}
          >
            {joining
              ? <SnooLoader size="small" color="#FFF" />
              : <Text style={styles.joinText}>Join Group Chat</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={handleDismiss}>
            <Text style={styles.skipText}>Not now</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:      { flex:1, backgroundColor:"rgba(0,0,0,0.6)", justifyContent:"flex-end" },
  sheet:         { backgroundColor:BG_MODAL, borderTopLeftRadius:24, borderTopRightRadius:24,
    paddingHorizontal:24, paddingTop:20, paddingBottom:40,
    borderTopWidth:1, borderTopColor:BORDER, alignItems:"center" },
  closeBtn:      { position:"absolute", top:16, right:16, padding:4 },
  avatarWrap:    { marginBottom:16, marginTop:8 },
  avatar:        { width:72, height:72, borderRadius:20 },
  avatarFallback:{ backgroundColor:"rgba(53,101,242,0.12)", alignItems:"center", justifyContent:"center" },
  heading:       { fontFamily:"BasicCommercial-Bold", fontSize:20, color:TEXT,
    textAlign:"center", marginBottom:10 },
  body:          { fontFamily:"Manrope-Regular", fontSize:14, color:TEXT_SEC,
    textAlign:"center", lineHeight:20, marginBottom:28 },
  communityName: { fontFamily:"Manrope-SemiBold", color:TEXT },
  groupName:     { fontFamily:"Manrope-SemiBold", color:ACCENT },
  joinBtn:       { width:"100%", backgroundColor:ACCENT, borderRadius:24,
    paddingVertical:14, alignItems:"center", marginBottom:10 },
  joinText:      { fontFamily:"Manrope-SemiBold", fontSize:15, color:"#FFF" },
  skipBtn:       { width:"100%", paddingVertical:10, alignItems:"center" },
  skipText:      { fontFamily:"Manrope-Regular", fontSize:14, color:TEXT_SEC },
});
