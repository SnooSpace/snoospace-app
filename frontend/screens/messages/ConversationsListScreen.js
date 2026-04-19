import React, {
  useState, useEffect, useCallback, useRef, useMemo,
} from "react";
import {
  View, Text, FlatList, TouchableOpacity, Image, StyleSheet,
  TextInput, RefreshControl, Animated, Pressable, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS, withRepeat, withSequence, Easing
} from "react-native-reanimated";
import Svg, { Circle, Path, Rect, G } from "react-native-svg";
import * as Haptics from "expo-haptics";

import {
  ChevronDown, PenSquare, Search, Users, Trash2, LogOut, X, ArrowLeft,
} from "lucide-react-native";

import { getConversations, hideConversation, removeGroupParticipant } from "../../api/messages";
import { globalSearch } from "../../api/search";
import { getAllAccounts, getActiveAccount } from "../../api/auth";


import EventBus from "../../utils/EventBus";
import SnooLoader from "../../components/ui/SnooLoader";
import AccountSwitcherModal from "../../components/modals/AccountSwitcherModal";
import AddAccountModal from "../../components/modals/AddAccountModal";

// ── Palette ───────────────────────────────────────────────────────────────────
const BG           = "#FFFFFF";
const SURFACE      = "#F8F8F8";
const SURFACE2     = "#EFEFF4";
const BORDER       = "#E5E5EA";
const ACCENT       = "#3565F2";
const TEXT_PRIMARY = "#000000";
const TEXT_SEC     = "#8E8E93";
const UNREAD_DOT   = "#3565F2";
const DANGER       = "#E53935";
const ACTIVE_RING  = "#3565F2";

// ── Time formatter ────────────────────────────────────────────────────────────
function formatRelativeTime(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now  = new Date();
  const diff = now - date;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "now";
  if (mins  < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days  < 7)  return `${days}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Avatar with optional unread ring ─────────────────────────────────────────
function ConvAvatar({ uri, size = 52, hasUnread = false, isGroup = false }) {
  return (
    <View style={{ width: size, height: size, marginRight: 12 }}>
      {hasUnread && (
        <View style={[avatarStyles.unreadRing, { width: size + 4, height: size + 4, borderRadius: (size + 4) / 2, top: -2, left: -2 }]} />
      )}
      <Image
        source={{ uri: uri || "https://via.placeholder.com/52" }}
        style={{ width: size, height: size, borderRadius: isGroup ? 14 : size / 2, backgroundColor: SURFACE2 }}
      />
    </View>
  );
}
const avatarStyles = StyleSheet.create({
  unreadRing: { position: "absolute", borderWidth: 2, borderColor: ACTIVE_RING, zIndex: 0 },
});

// ── Search result row ─────────────────────────────────────────────────────────
function SearchResultRow({ item, onPress }) {
  const name = item.display_name || item.name || item.full_name || "User";
  const sub  = item.username ? `@${item.username}` : item.type;
  const uri  = item.profile_photo_url || item.logo_url || item.photo_url;
  return (
    <TouchableOpacity style={srStyles.row} onPress={onPress} activeOpacity={0.7}>
      <Image source={{ uri: uri || "https://via.placeholder.com/40" }}
        style={srStyles.avatar} />
      <View style={{ flex: 1 }}>
        <Text style={srStyles.name} numberOfLines={1}>{name}</Text>
        <Text style={srStyles.sub}  numberOfLines={1}>{sub}</Text>
      </View>
      <View style={srStyles.badge}>
        <Text style={srStyles.badgeText}>{item.type || "member"}</Text>
      </View>
    </TouchableOpacity>
  );
}
const srStyles = StyleSheet.create({
  row:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  avatar:    { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: SURFACE2 },
  name:      { fontFamily: "Manrope-SemiBold", fontSize: 14, color: TEXT_PRIMARY },
  sub:       { fontFamily: "Manrope-Regular",  fontSize: 12, color: TEXT_SEC, marginTop: 1 },
  badge:     { backgroundColor: SURFACE2, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10, marginLeft: 8 },
  badgeText: { fontFamily: "Manrope-Medium", fontSize: 10, color: TEXT_SEC, textTransform: "capitalize" },
});

// ── Swipeable conversation row ────────────────────────────────────────────────
const SWIPE_THRESHOLD = 80;

function SwipeableConvRow({ conv, onPress, onDelete, onLeave, currentUserType }) {
  const translateX = useSharedValue(0);
  const isGroup    = conv.isGroup;

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .onUpdate((e) => {
      if (e.translationX > 0) { translateX.value = 0; return; }
      translateX.value = Math.max(e.translationX, -SWIPE_THRESHOLD - 20);
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(-SWIPE_THRESHOLD, { damping: 18, stiffness: 200 });
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 200 });
      }
    });

  const rowStyle    = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const actionWidth = SWIPE_THRESHOLD;

  const name = isGroup
    ? (conv.groupName || "Group")
    : (conv.otherParticipant?.name || "User");
  const username = isGroup
    ? `${conv.participantCount || "?"} members`
    : (conv.otherParticipant?.username ? `@${conv.otherParticipant.username}` : "");
  const uri = isGroup
    ? conv.groupAvatarUrl
    : conv.otherParticipant?.profilePhotoUrl;
  const hasUnread    = (conv.unreadCount || 0) > 0;

  return (
    <View style={{ overflow: "hidden" }}>
      {/* Action buttons revealed on swipe */}
      <View style={[swipeStyles.actions, { width: actionWidth }]}>
        <TouchableOpacity
          style={[swipeStyles.actionBtn, { backgroundColor: isGroup ? "#FF9500" : DANGER }]}
          onPress={() => {
            translateX.value = withSpring(0);
            if (isGroup) onLeave?.();
            else onDelete?.();
          }}
        >
          {isGroup
            ? <LogOut size={20} color="#FFF" strokeWidth={2} />
            : <Trash2  size={20} color="#FFF" strokeWidth={2} />}
        </TouchableOpacity>
      </View>

      <GestureDetector gesture={pan}>
        <Reanimated.View style={rowStyle}>
          <Pressable style={swipeStyles.row} onPress={onPress} android_ripple={{ color: SURFACE2 }}>
            <ConvAvatar uri={uri} size={52} hasUnread={hasUnread} isGroup={isGroup} />
            <View style={swipeStyles.content}>
              <View style={swipeStyles.topRow}>
                <Text style={[swipeStyles.name, hasUnread && swipeStyles.nameUnread]} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={swipeStyles.time}>{formatRelativeTime(conv.lastMessageAt)}</Text>
              </View>
              <View style={swipeStyles.bottomRow}>
                <Text style={[swipeStyles.preview, hasUnread && swipeStyles.previewUnread]} numberOfLines={1}>
                  {conv.lastMessage || username || "No messages yet"}
                </Text>
                {hasUnread && (
                  <View style={swipeStyles.badge}>
                    <Text style={swipeStyles.badgeText}>
                      {conv.unreadCount > 9 ? "9+" : String(conv.unreadCount)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        </Reanimated.View>
      </GestureDetector>
    </View>
  );
}
const swipeStyles = StyleSheet.create({
  actions:      { position: "absolute", right: 0, top: 0, bottom: 0, justifyContent: "center",
    alignItems: "flex-end", paddingRight: 4 },
  actionBtn:    { width: 68, alignSelf: "stretch", justifyContent: "center", alignItems: "center",
    borderRadius: 12, margin: 4 },
  row:          { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: BG, alignItems: "center" },
  content:      { flex: 1 },
  topRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  bottomRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name:         { fontFamily: "Manrope-SemiBold", fontSize: 15, color: TEXT_SEC, flex: 1, marginRight: 8 },
  nameUnread:   { color: TEXT_PRIMARY },
  time:         { fontFamily: "Manrope-Regular",  fontSize: 12, color: TEXT_SEC },
  preview:      { fontFamily: "Manrope-Regular",  fontSize: 13, color: TEXT_SEC, flex: 1, marginRight: 8 },
  previewUnread:{ fontFamily: "Manrope-SemiBold", color: TEXT_PRIMARY },
  badge:        { backgroundColor: ACCENT, borderRadius: 10, minWidth: 20, height: 20,
    paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
  badgeText:    { fontFamily: "Manrope-Medium", fontSize: 11, color: "#FFF" },
});

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE ILLUSTRATION
// ═══════════════════════════════════════════════════════════════════════════════
function EmptyInboxIllustration() {
  const floatAnim = useSharedValue(0);
  const orbitAnim = useSharedValue(0);

  useEffect(() => {
    floatAnim.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    orbitAnim.value = withRepeat(
      withTiming(2 * Math.PI, { duration: 6000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatAnim.value }]
  }));

  const orbitStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: 5 * Math.cos(orbitAnim.value) },
      { translateY: 5 * Math.sin(orbitAnim.value) }
    ]
  }));

  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 16 }}>
      <Reanimated.View style={floatStyle}>
        <Svg width={240} height={240} viewBox="0 0 240 240" fill="none">
          <Circle cx="120" cy="120" r="85" fill="#2563EB" fillOpacity="0.06" />
          <Path d="M50 130L60 170H180L190 130H160C160 145 145 155 120 155C95 155 80 145 80 130H50Z" fill="white" stroke="#0F172A" strokeWidth="4" strokeLinejoin="round" />
          <Path d="M50 130V100C50 88.9543 58.9543 80 70 80H170C181.046 80 190 88.9543 190 100V130" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" />
          <Rect x="75" y="100" width="90" height="6" rx="3" fill="#F0F9FF" stroke="#0F172A" strokeWidth="2" />
          <Rect x="75" y="115" width="60" height="6" rx="3" fill="#F0F9FF" stroke="#0F172A" strokeWidth="2" />
          <G transform="translate(130, 70) rotate(-15)">
            <Path d="M0 15L30 0L20 28L15 20L0 15Z" fill="white" stroke="#0F172A" strokeWidth="3" strokeLinejoin="round" />
            <Path d="M15 20L30 0" stroke="#0F172A" strokeWidth="2" />
          </G>
          <Circle cx="55" cy="85" r="5" fill="#2563EB" stroke="#0F172A" strokeWidth="2" />
          <Path d="M80 50L82 55H87L83 58L84 63L80 60L76 63L77 58L73 55H78L80 50Z" fill="#2563EB" stroke="#0F172A" strokeWidth="1.5" />
        </Svg>
        <Reanimated.View style={[{ position: "absolute", top: 0, left: 0 }, orbitStyle]}>
          <Svg width={240} height={240} viewBox="0 0 240 240" fill="none">
            <Rect x="180" y="90" width="25" height="18" rx="5" fill="#22D3EE" stroke="#0F172A" strokeWidth="2.5" />
            <Path d="M185 108L180 113V108H185Z" fill="#22D3EE" stroke="#0F172A" strokeWidth="2.5" />
          </Svg>
        </Reanimated.View>
      </Reanimated.View>
      <View style={{ width: 128, height: 8, backgroundColor: "rgba(30, 58, 138, 0.05)", borderRadius: 100, marginTop: -8 }} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export default function ConversationsListScreen({ navigation }) {
  const [conversations,    setConversations]    = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);
  const [searchText,       setSearchText]       = useState("");
  const [searchResults,    setSearchResults]    = useState([]);
  const [searchLoading,    setSearchLoading]    = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [showAddAccount,   setShowAddAccount]   = useState(false);
  const [activeAccount,    setActiveAccount]    = useState(null);
  const [allAccounts,      setAllAccounts]      = useState([]);

  const searchTimeout = useRef(null);
  const isSearching   = searchText.trim().length > 0;

  // ── Load account info ────────────────────────────────────────────────────────
  const loadAccountInfo = useCallback(async () => {
    try {
      const [active, all] = await Promise.all([getActiveAccount(), getAllAccounts()]);
      setActiveAccount(active);
      setAllAccounts(all || []);
    } catch (err) {
      console.error("Error loading account info:", err);
    }
  }, []);

  // ── Load conversations ───────────────────────────────────────────────────────
  const loadConversations = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await getConversations();
      setConversations(res.conversations || []);
    } catch (err) {
      console.error("Error loading conversations:", err);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    loadAccountInfo();
  }, []);

  useFocusEffect(useCallback(() => {
    loadConversations(true);
    loadAccountInfo();
  }, [loadConversations, loadAccountInfo]));

  // ── EventBus listeners ────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = EventBus.on("conversation-updated", (payload) => {
      if (!payload?.conversationId) return;
      setConversations((prev) => {
        const updated = [...prev];
        const idx = updated.findIndex((c) => c.id === payload.conversationId);
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], lastMessage: payload.lastMessage, lastMessageAt: payload.lastMessageAt };
        } else if (payload.otherParticipant) {
          updated.unshift({ id: payload.conversationId, otherParticipant: payload.otherParticipant,
            lastMessage: payload.lastMessage, lastMessageAt: payload.lastMessageAt, unreadCount: 0 });
        }
        return updated.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
      });
    });
    return () => unsub?.();
  }, []);

  // ── Search ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    const q = searchText.trim();
    if (q.length === 0) { setSearchResults([]); return; }

    // First: filter existing conversations client-side
    const localMatches = conversations.filter((conv) => {
      const name    = conv.isGroup ? conv.groupName : conv.otherParticipant?.name;
      const uname   = conv.isGroup ? "" : conv.otherParticipant?.username;
      const q_lower = q.toLowerCase();
      return name?.toLowerCase().includes(q_lower) || uname?.toLowerCase().includes(q_lower);
    });
    setSearchResults(localMatches.map((c) => ({ _isConv: true, conv: c })));

    // Then: fire global search for new users (debounced 400ms)
    if (q.length >= 2) {
      searchTimeout.current = setTimeout(async () => {
        try {
          setSearchLoading(true);
          const res = await globalSearch(q, { limit: 12 });
          const global = (res.results || []).filter((r) =>
            !conversations.some((c) => !c.isGroup && c.otherParticipant?.id === r.id)
          );
          setSearchResults((prev) => [
            ...prev,
            ...global.map((r) => ({ _isConv: false, user: r })),
          ]);
        } catch { } finally { setSearchLoading(false); }
      }, 400);
    }
  }, [searchText, conversations]);

  // ── Delete / Leave handlers ────────────────────────────────────────────────────
  const handleDeleteConversation = useCallback(async (conv) => {
    Alert.alert(
      "Delete Conversation",
      "This will remove the conversation from your view. The other person won't be affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            setConversations((prev) => prev.filter((c) => c.id !== conv.id));
            try { await hideConversation(conv.id); }
            catch { setConversations((prev) => [...prev, conv]); }
          },
        },
      ]
    );
  }, []);

  const handleLeaveGroup = useCallback(async (conv) => {
    Alert.alert(
      "Leave Group",
      `Leave "${conv.groupName || "this group"}"? You won't receive messages anymore.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave", style: "destructive",
          onPress: async () => {
            setConversations((prev) => prev.filter((c) => c.id !== conv.id));
            try {
              await removeGroupParticipant(conv.id, activeAccount?.id, activeAccount?.type || "member");
            } catch { setConversations((prev) => [...prev, conv]); }
          },
        },
      ]
    );
  }, [activeAccount]);

  // ── Navigate to chat ──────────────────────────────────────────────────────────
  const openConversation = useCallback((conv) => {
    if (conv.isGroup) {
      navigation.navigate("Chat", { conversationId: conv.id, isGroup: true, groupName: conv.groupName });
    } else {
      navigation.navigate("Chat", {
        conversationId: conv.id,
        recipientId:   conv.otherParticipant?.id,
        recipientType: conv.otherParticipant?.type || "member",
      });
    }
  }, [navigation]);

  const openUserChat = useCallback((user) => {
    navigation.navigate("Chat", { recipientId: user.id, recipientType: user.type || "member" });
  }, [navigation]);

  // ── Derived display name for header ───────────────────────────────────────────
  const displayName = activeAccount?.username
    ? `@${activeAccount.username}`
    : activeAccount?.name || "Messages";

  // ── Render ────────────────────────────────────────────────────────────────────
  const renderConversation = ({ item }) => (
    <SwipeableConvRow
      conv={item}
      onPress={() => openConversation(item)}
      onDelete={() => handleDeleteConversation(item)}
      onLeave={() => handleLeaveGroup(item)}
      currentUserType={activeAccount?.type}
    />
  );

  const renderSearchItem = ({ item }) => {
    if (item._isConv) {
      return (
        <SwipeableConvRow
          conv={item.conv}
          onPress={() => openConversation(item.conv)}
          onDelete={() => handleDeleteConversation(item.conv)}
          onLeave={() => handleLeaveGroup(item.conv)}
          currentUserType={activeAccount?.type}
        />
      );
    }
    return (
      <SearchResultRow
        item={item.user}
        onPress={() => openUserChat(item.user)}
      />
    );
  };

  const ListHeader = !isSearching ? (
    <View style={styles.messagesHeaderRow}>
      <Text style={styles.messagesHeaderText}>Messages</Text>
    </View>
  ) : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color={TEXT_PRIMARY} strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.accountBtn} onPress={() => setShowAccountSwitcher(true)}>
            <Text style={styles.accountName} numberOfLines={1}>{displayName}</Text>
            <ChevronDown size={26} color="#3B82F6" style={{ marginLeft: -2 }} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("CreateGroupChat")}>
            <PenSquare size={22} color={TEXT_PRIMARY} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <SnooLoader size="large" color={ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color={TEXT_PRIMARY} strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.accountBtn} onPress={() => setShowAccountSwitcher(true)} activeOpacity={0.75}>
            <Text style={styles.accountName} numberOfLines={1}>{displayName}</Text>
            <ChevronDown size={26} color="#3B82F6" style={{ marginLeft: -2 }} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("CreateGroupChat")}>
            <PenSquare size={22} color={TEXT_PRIMARY} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* ── Search bar ── */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search size={16} color={TEXT_SEC} strokeWidth={2} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search people & conversations…"
              placeholderTextColor={TEXT_SEC}
              value={searchText}
              onChangeText={setSearchText}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={14} color={TEXT_SEC} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Search results ── */}
        {isSearching ? (
          <FlatList
            data={searchResults}
            keyExtractor={(item, idx) => item._isConv ? `conv-${item.conv.id}` : `user-${item.user?.id}-${idx}`}
            renderItem={renderSearchItem}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListHeaderComponent={searchLoading ? (
              <View style={{ paddingVertical: 12, alignItems: "center" }}>
                <SnooLoader size="small" color={ACCENT} />
              </View>
            ) : null}
            ListEmptyComponent={!searchLoading ? (
              <View style={styles.emptySearch}>
                <Text style={styles.emptySearchText}>No results for "{searchText}"</Text>
              </View>
            ) : null}
          />
        ) : (
          /* ── Conversations list ── */
          <FlatList
            data={conversations}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderConversation}
            ListHeaderComponent={ListHeader}
            contentContainerStyle={conversations.length === 0 ? { flex: 1 } : { paddingBottom: 40 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadConversations(true)}
                tintColor={ACCENT}
                colors={[ACCENT]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <EmptyInboxIllustration />
                <Text style={styles.emptyTitle}>No conversations yet</Text>
                <Text style={styles.emptySub}>
                  Your inbox is waiting for its first spark. Find friends or start a new chat to see them here.
                </Text>
              </View>
            }
          />
        )}

        {/* ── Modals ── */}
        <AccountSwitcherModal
          visible={showAccountSwitcher}
          onClose={() => setShowAccountSwitcher(false)}
          onAddAccount={() => { setShowAccountSwitcher(false); setShowAddAccount(true); }}
          currentAccountId={activeAccount?.id ? `${activeAccount.type || "member"}_${activeAccount.id}` : undefined}
          currentProfile={activeAccount ? { ...activeAccount, type: activeAccount.type || "member" } : null}
          onAccountSwitch={(account) => {
            setShowAccountSwitcher(false);
            const routeName =
              account.type === "community" ? "CommunityHome" :
              account.type === "sponsor"   ? "SponsorHome" :
              account.type === "venue"     ? "VenueHome" :
              "MemberHome";
            // Walk up the navigator tree to find root
            let rootNavigator = navigation;
            try {
              if (navigation.getParent) {
                const parent1 = navigation.getParent();
                if (parent1?.getParent) {
                  const parent2 = parent1.getParent();
                  if (parent2) rootNavigator = parent2;
                }
              }
            } catch (_) {}
            rootNavigator.reset({ index: 0, routes: [{ name: routeName }] });
          }}
          onLoginRequired={(account) => {
            setShowAccountSwitcher(false);
            let rootNavigator = navigation;
            try {
              if (navigation.getParent) {
                const parent1 = navigation.getParent();
                if (parent1?.getParent) {
                  const parent2 = parent1.getParent();
                  if (parent2) rootNavigator = parent2;
                }
              }
            } catch (_) {}
            try {
              rootNavigator.navigate("Login", { email: account.email, isAddingAccount: false });
            } catch (_) {
              rootNavigator.reset({ index: 0, routes: [{ name: "Landing" }] });
            }
          }}
        />
        <AddAccountModal
          visible={showAddAccount}
          onClose={() => setShowAddAccount(false)}
          onAccountAdded={async () => {
            setShowAddAccount(false);
            await loadAccountInfo();
            await loadConversations();
          }}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: BG },
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:         { width: 40, height: 40, alignItems: "flex-start", justifyContent: "center" },
  accountBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", flex: 1 },
  accountName:     { fontFamily: "BasicCommercial-Black", fontSize: 20, color: "#3B82F6" },
  iconBtn:         { width: 40, height: 40, alignItems: "flex-end", justifyContent: "center" },
  searchRow:       { paddingHorizontal: 16, paddingBottom: 12 },
  searchBar:       { flexDirection: "row", alignItems: "center", backgroundColor: SURFACE,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: BORDER },
  searchInput:     { flex: 1, fontFamily: "Manrope-Regular", fontSize: 14,
    color: TEXT_PRIMARY, paddingVertical: 0 },
  messagesHeaderRow:{ flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 4 },
  messagesHeaderText:{ fontFamily: "BasicCommercial-Bold", fontSize: 16, color: TEXT_PRIMARY },
  requestsText:      { fontFamily: "Manrope-SemiBold", fontSize: 14, color: "#3B82F6" },
  loadingContainer:  { flex: 1, justifyContent: "center", alignItems: "center" },
  emptySearch:     { paddingTop: 40, alignItems: "center" },
  emptySearchText: { fontFamily: "Manrope-Regular", fontSize: 14, color: TEXT_SEC },
  emptyContainer:  { flex: 1, justifyContent: "center", alignItems: "center",
    paddingHorizontal: 32, paddingBottom: 80 },
  emptyTitle:      { fontFamily: "BasicCommercial-Bold", fontSize: 24, color: "#0F172A",
    marginBottom: 12, letterSpacing: -0.3 },
  emptySub:        { fontFamily: "Manrope-Regular", fontSize: 14, color: "#64748B",
    textAlign: "center", lineHeight: 22, marginBottom: 32, maxWidth: 280 },
});
