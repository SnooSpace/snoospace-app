import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Image, StyleSheet, Alert, ScrollView, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  ArrowLeft, Edit2, Check, X, UserMinus, Shield, UserPlus, MoreHorizontal,
} from "lucide-react-native";
import {
  getGroupParticipants,
  updateGroupConversation,
  removeGroupParticipant,
  transferAdmin,
  addGroupParticipant,
} from "../../api/messages";
import { searchAccounts } from "../../api/search";
import { getAuthToken, getAuthEmail } from "../../api/auth";
import { apiPost } from "../../api/client";
import SnooLoader from "../../components/ui/SnooLoader";

// ── Palette ────────────────────────────────────────────────────────────────────
const BG       = "#FFFFFF";
const SURFACE  = "#F8F8F8";
const SURFACE2 = "#EFEFF4";
const BORDER   = "#E5E5EA";
const ACCENT   = "#3565F2";
const TEXT     = "#000000";
const TEXT_SEC = "#8E8E93";
const DANGER   = "#E53935";
const GOLD     = "#FFB800";

// ── ParticipantRow ────────────────────────────────────────────────────────────
function ParticipantRow({ participant, isCurrentUser, isCurrentAdmin, isMeAdmin, onKick, onTransfer }) {
  const [showActions, setShowActions] = useState(false);
  const name = participant.name || participant.username || "User";
  const uri  = participant.profilePhotoUrl || participant.profile_photo_url;
  const isAdmin = participant.role === "admin";

  return (
    <View>
      <TouchableOpacity
        style={pStyles.row}
        activeOpacity={0.75}
        onPress={() => { if (isMeAdmin && !isCurrentUser) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowActions((v) => !v); } }}
      >
        <Image source={{ uri: uri || "https://via.placeholder.com/44" }} style={pStyles.avatar} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={pStyles.name} numberOfLines={1}>{name}</Text>
            {isAdmin && (
              <View style={pStyles.adminBadge}>
                <Shield size={10} color={GOLD} strokeWidth={2} style={{ marginRight: 3 }} />
                <Text style={pStyles.adminText}>Admin</Text>
              </View>
            )}
          </View>
          <Text style={pStyles.username} numberOfLines={1}>
            {participant.username ? `@${participant.username}` : (participant.type || "member")}
          </Text>
        </View>
        {isMeAdmin && !isCurrentUser && (
          <MoreHorizontal size={18} color={TEXT_SEC} strokeWidth={2} />
        )}
      </TouchableOpacity>

      {showActions && (
        <View style={pStyles.actions}>
          {!isAdmin && (
            <TouchableOpacity style={pStyles.actionBtn} onPress={() => { setShowActions(false); onTransfer?.(); }}>
              <Shield size={16} color={GOLD} strokeWidth={2} style={{ marginRight: 8 }} />
              <Text style={[pStyles.actionText, { color: GOLD }]}>Make Admin</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={pStyles.actionBtn} onPress={() => { setShowActions(false); onKick?.(); }}>
            <UserMinus size={16} color={DANGER} strokeWidth={2} style={{ marginRight: 8 }} />
            <Text style={[pStyles.actionText, { color: DANGER }]}>Remove from Group</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
const pStyles = StyleSheet.create({
  row:        { flexDirection:"row", alignItems:"center", paddingHorizontal:16,
    paddingVertical:12, borderBottomWidth:1, borderBottomColor:BORDER },
  avatar:     { width:44, height:44, borderRadius:22, marginRight:12, backgroundColor:SURFACE2 },
  name:       { fontFamily:"Manrope-SemiBold", fontSize:14, color:TEXT },
  username:   { fontFamily:"Manrope-Regular",  fontSize:12, color:TEXT_SEC, marginTop:1 },
  adminBadge: { flexDirection:"row", alignItems:"center", backgroundColor:"rgba(255,184,0,0.15)",
    paddingHorizontal:7, paddingVertical:2, borderRadius:10, marginLeft:8 },
  adminText:  { fontFamily:"Manrope-SemiBold", fontSize:10, color:GOLD },
  actions:    { backgroundColor:SURFACE, marginHorizontal:16, marginBottom:4,
    borderRadius:12, overflow:"hidden", borderWidth:1, borderColor:BORDER },
  actionBtn:  { flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingVertical:13,
    borderBottomWidth:1, borderBottomColor:BORDER },
  actionText: { fontFamily:"Manrope-SemiBold", fontSize:14 },
});

// ── AddMemberSheet (simple inline search) ─────────────────────────────────────
function AddMemberSheet({ conversationId, existingIds, currentUserType, onAdded, onClose }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding,  setAdding]  = useState({});

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchAccounts(query);
        const filtered = (res.results || []).filter((r) => {
          if (existingIds.has(r.id)) return false;
          if (currentUserType === "member") return r.type === "member";
          return true;
        });
        setResults(filtered);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const handleAdd = async (user) => {
    setAdding((p) => ({ ...p, [user.id]: true }));
    try {
      await addGroupParticipant(conversationId, user.id, user.type || "member");
      onAdded(user);
    } catch (err) {
      Alert.alert("Error", err?.message || "Could not add member.");
    } finally {
      setAdding((p) => ({ ...p, [user.id]: false }));
    }
  };

  return (
    <View style={addStyles.sheet}>
      <View style={addStyles.header}>
        <Text style={addStyles.title}>Add Member</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
          <X size={20} color={TEXT_SEC} strokeWidth={2} />
        </TouchableOpacity>
      </View>
      <View style={addStyles.searchBar}>
        <TextInput
          style={addStyles.input}
          placeholder="Search…"
          placeholderTextColor={TEXT_SEC}
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCapitalize="none"
        />
      </View>
      {loading ? (
        <View style={{ padding: 20, alignItems: "center" }}>
          <SnooLoader size="small" color={ACCENT} />
        </View>
      ) : (
        results.map((user) => {
          const name = user.display_name || user.name || user.full_name || "User";
          const uri  = user.profile_photo_url || user.logo_url;
          return (
            <View key={user.id} style={addStyles.resultRow}>
              <Image source={{ uri: uri || "https://via.placeholder.com/36" }} style={addStyles.avatar} />
              <Text style={addStyles.name} numberOfLines={1}>{name}</Text>
              <TouchableOpacity
                style={addStyles.addBtn}
                onPress={() => handleAdd(user)}
                disabled={adding[user.id]}
              >
                {adding[user.id]
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <UserPlus size={16} color="#FFF" strokeWidth={2} />}
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </View>
  );
}
const addStyles = StyleSheet.create({
  sheet:     { backgroundColor:SURFACE, borderRadius:16, margin:16, padding:4,
    borderWidth:1, borderColor:BORDER },
  header:    { flexDirection:"row", alignItems:"center", justifyContent:"space-between",
    paddingHorizontal:16, paddingVertical:12 },
  title:     { fontFamily:"BasicCommercial-Bold", fontSize:16, color:TEXT },
  searchBar: { marginHorizontal:12, marginBottom:8, backgroundColor:SURFACE2,
    borderRadius:10, paddingHorizontal:12, paddingVertical:8, borderWidth:1, borderColor:BORDER },
  input:     { fontFamily:"Manrope-Regular", fontSize:14, color:TEXT, paddingVertical:0 },
  resultRow: { flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingVertical:10,
    borderTopWidth:1, borderTopColor:BORDER },
  avatar:    { width:36, height:36, borderRadius:18, marginRight:10, backgroundColor:SURFACE2 },
  name:      { flex:1, fontFamily:"Manrope-SemiBold", fontSize:14, color:TEXT },
  addBtn:    { width:34, height:34, borderRadius:17, backgroundColor:ACCENT,
    alignItems:"center", justifyContent:"center" },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export default function GroupInfoScreen({ route, navigation }) {
  const { conversationId, groupName: initialName } = route.params || {};

  const [participants, setParticipants] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [currentUser,  setCurrentUser]  = useState(null);
  const [editingName,  setEditingName]  = useState(false);
  const [nameText,     setNameText]     = useState(initialName || "");
  const [savingName,   setSavingName]   = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);

  // ── Load current user identity ────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const token = await getAuthToken();
        const email = await getAuthEmail();
        if (!token || !email) return;
        const res = await apiPost("/auth/get-user-profile", { email }, 10000, token);
        setCurrentUser({ id: res?.profile?.id, type: res?.role });
      } catch (err) { console.error("GroupInfoScreen: error loading user:", err); }
    })();
  }, []);

  // ── Load participants ─────────────────────────────────────────────────────
  const loadParticipants = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getGroupParticipants(conversationId);
      setParticipants(res.participants || []);
    } catch (err) {
      console.error("GroupInfoScreen: error loading participants:", err);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => { loadParticipants(); }, [loadParticipants]);

  // ── Derived: am I admin? ──────────────────────────────────────────────────
  const myParticipant = participants.find((p) => p.participantId === currentUser?.id);
  const isMeAdmin     = myParticipant?.role === "admin";

  // ── Save group name ───────────────────────────────────────────────────────
  const handleSaveName = async () => {
    if (!nameText.trim()) return;
    setSavingName(true);
    try {
      await updateGroupConversation(conversationId, { name: nameText.trim() });
      setEditingName(false);
    } catch (err) {
      Alert.alert("Error", err?.message || "Could not update group name.");
    } finally {
      setSavingName(false);
    }
  };

  // ── Kick participant ──────────────────────────────────────────────────────
  const handleKick = useCallback((participant) => {
    const name = participant.name || "this member";
    Alert.alert(
      "Remove Member",
      `Remove ${name} from the group?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove", style: "destructive",
          onPress: async () => {
            try {
              await removeGroupParticipant(conversationId, participant.participantId, participant.participantType || "member");
              setParticipants((prev) => prev.filter((p) => p.participantId !== participant.participantId));
            } catch (err) {
              Alert.alert("Error", err?.message || "Could not remove member.");
            }
          },
        },
      ]
    );
  }, [conversationId]);

  // ── Transfer admin ────────────────────────────────────────────────────────
  const handleTransfer = useCallback((participant) => {
    const name = participant.name || "this member";
    Alert.alert(
      "Transfer Admin",
      `Make ${name} the new admin? You will become a regular member.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Transfer", style: "destructive",
          onPress: async () => {
            try {
              await transferAdmin(conversationId, participant.participantId, participant.participantType || "member");
              await loadParticipants();
            } catch (err) {
              Alert.alert("Error", err?.message || "Could not transfer admin.");
            }
          },
        },
      ]
    );
  }, [conversationId, loadParticipants]);

  const existingIds = new Set(participants.map((p) => p.participantId));

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <ArrowLeft size={22} color={TEXT} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.title}>Group Info</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}><SnooLoader size="large" color={ACCENT} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <ArrowLeft size={22} color={TEXT} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.title}>Group Info</Text>
        {isMeAdmin && (
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowAddSheet((v) => !v)}>
            <UserPlus size={20} color={ACCENT} strokeWidth={2} />
          </TouchableOpacity>
        )}
        {!isMeAdmin && <View style={{ width: 40 }} />}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Group name section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>GROUP NAME</Text>
          <View style={styles.nameRow}>
            {editingName ? (
              <>
                <TextInput
                  style={styles.nameInput}
                  value={nameText}
                  onChangeText={setNameText}
                  autoFocus
                  maxLength={60}
                />
                <TouchableOpacity onPress={() => { setEditingName(false); setNameText(initialName || ""); }}
                  hitSlop={{ top:8, bottom:8, left:8, right:8 }} style={{ marginRight: 8 }}>
                  <X size={18} color={TEXT_SEC} strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveName} disabled={savingName}>
                  {savingName
                    ? <SnooLoader size="small" color={ACCENT} />
                    : <Check size={20} color={ACCENT} strokeWidth={2.5} />}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.nameDisplay} numberOfLines={1}>{nameText || "Group"}</Text>
                {isMeAdmin && (
                  <TouchableOpacity onPress={() => setEditingName(true)}
                    hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
                    <Edit2 size={16} color={TEXT_SEC} strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>

        {/* Add member sheet (inline) */}
        {showAddSheet && isMeAdmin && (
          <AddMemberSheet
            conversationId={conversationId}
            existingIds={existingIds}
            currentUserType={currentUser?.type}
            onAdded={(user) => {
              setParticipants((prev) => [
                ...prev,
                {
                  participantId:   user.id,
                  participantType: user.type || "member",
                  name:            user.display_name || user.name || user.full_name,
                  username:        user.username,
                  profilePhotoUrl: user.profile_photo_url || user.logo_url,
                  role:            "member",
                },
              ]);
              setShowAddSheet(false);
            }}
            onClose={() => setShowAddSheet(false)}
          />
        )}

        {/* Members list */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{participants.length} MEMBERS</Text>
        </View>
        {participants.map((p) => (
          <ParticipantRow
            key={p.participantId}
            participant={p}
            isCurrentUser={p.participantId === currentUser?.id}
            isMeAdmin={isMeAdmin}
            onKick={() => handleKick(p)}
            onTransfer={() => handleTransfer(p)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:BG },
  header:    { flexDirection:"row", alignItems:"center", justifyContent:"space-between",
    paddingHorizontal:16, paddingVertical:12, borderBottomWidth:1, borderBottomColor:BORDER },
  iconBtn:   { width:40, height:40, alignItems:"center", justifyContent:"center" },
  title:     { fontFamily:"BasicCommercial-Black", fontSize:18, color:TEXT },
  centered:  { flex:1, justifyContent:"center", alignItems:"center" },
  section:   { paddingHorizontal:16, paddingTop:20, paddingBottom:8 },
  sectionLabel: { fontFamily:"BasicCommercial-Bold", fontSize:12, color:TEXT_SEC,
    letterSpacing:0.5, textTransform:"uppercase" },
  nameRow:   { flexDirection:"row", alignItems:"center", marginTop:8 },
  nameDisplay: { fontFamily:"BasicCommercial-Bold", fontSize:20, color:TEXT, flex:1, marginRight:10 },
  nameInput: { flex:1, fontFamily:"BasicCommercial-Bold", fontSize:20, color:TEXT,
    borderBottomWidth:1, borderBottomColor:ACCENT, paddingVertical:4, marginRight:10 },
});
