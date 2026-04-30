import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  Image, StyleSheet, Alert, ScrollView, ActivityIndicator, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useCrop } from "../../components/MediaCrop";
import { ArrowLeft, Edit2, Check, X, UserMinus, Shield, ShieldOff, ShieldCheck, UserPlus,
  MoreHorizontal, Camera, LogOut, AlertTriangle, Info, LockKeyhole, Megaphone, Users, Crown,
} from "lucide-react-native";
import CustomAlertModal from "../../components/ui/CustomAlertModal";
import {
  getGroupParticipants,
  updateGroupConversation,
  removeGroupParticipant,
  transferAdmin,
  promoteToAdmin,
  demoteFromAdmin,
  transferGroupOwnership,
  addGroupParticipant,
  sendMessage,
} from "../../api/messages";
import { searchAccounts } from "../../api/search";
import { getAuthToken, getAuthEmail } from "../../api/auth";
import { apiPost } from "../../api/client";
import SnooLoader from "../../components/ui/SnooLoader";

// ── Palette ─────────────────────────────────────────────────────────────────
const BG       = "#FFFFFF";
const SURFACE  = "#F8F8F8";
const SURFACE2 = "#EFEFF4";
const BORDER   = "#E5E5EA";
const ACCENT   = "#3565F2";
const TEXT     = "#000000";
const TEXT_SEC = "#8E8E93";
const DANGER        = "#E53935";
const GOLD          = "#FFB800";
const SILVER_ADMIN  = "#9B9B9B";

const CLOUD_NAME   = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || "dulhurgt7";
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "harshith_unsigned";

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

async function uploadToCloudinary(uri) {
  const formData = new FormData();
  formData.append("file", { uri, type: "image/jpeg", name: "group_avatar.jpg" });
  formData.append("upload_preset", UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST", body: formData,
  });
  const json = await res.json();
  if (!json.secure_url) throw new Error("Upload failed");
  return json.secure_url;
}

// ── ParticipantRow ───────────────────────────────────────────────────────────
function ParticipantRow({
  participant, isCurrentUser, isMeAdmin, communityOwnerId,
  onKick, onPromote, onDemote, onPress,
}) {
  const [showActions, setShowActions] = useState(false);
  const name    = participant.name || participant.username || "User";
  const uri     = participant.photoUrl;
  const isAdmin = participant.role === "admin";

  // Community owner is the root/immutable admin — shown with Crown
  const isCommunityOwner =
    participant.participantType === "community" &&
    communityOwnerId &&
    String(participant.participantId) === String(communityOwnerId);

  // Co-admin = admin but NOT the community owner
  const isCoAdmin = isAdmin && !isCommunityOwner;

  // Can demote: caller is admin, target is co-admin (not community owner, not self)
  const canDemote  = isMeAdmin && isCoAdmin && !isCurrentUser;
  // Can promote: caller is admin, target is regular member
  const canPromote = isMeAdmin && !isAdmin && !isCurrentUser;
  // Can kick: caller is admin, target is not community owner
  const canKick    = isMeAdmin && !isCurrentUser && !isCommunityOwner;

  const hasActions = canPromote || canDemote || canKick;

  return (
    <View>
      <TouchableOpacity
        style={pStyles.row}
        activeOpacity={0.75}
        onPress={() => {
          if (hasActions) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowActions((v) => !v);
          } else if (!isCurrentUser) {
            onPress?.();
          }
        }}
        onLongPress={() => { if (!isCurrentUser) onPress?.(); }}
      >
        <Image
          source={{ uri: uri || "https://via.placeholder.com/44" }}
          style={pStyles.avatar}
        />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
            <Text style={pStyles.name} numberOfLines={1}>{name}</Text>
            {/* Crown badge — community owner */}
            {isCommunityOwner && (
              <View style={[pStyles.adminBadge, pStyles.ownerBadge]}>
                <Crown size={10} color={GOLD} strokeWidth={2} style={{ marginRight: 3 }} />
                <Text style={pStyles.adminText}>Owner</Text>
              </View>
            )}
            {/* Shield badge — promoted co-admin */}
            {isCoAdmin && (
              <View style={pStyles.adminBadge}>
                <ShieldCheck size={10} color={SILVER_ADMIN} strokeWidth={2} style={{ marginRight: 3 }} />
                <Text style={[pStyles.adminText, { color: SILVER_ADMIN }]}>Admin</Text>
              </View>
            )}
            {isCurrentUser && (
              <Text style={pStyles.youTag}> (You)</Text>
            )}
          </View>
          <Text style={pStyles.username} numberOfLines={1}>
            {participant.username ? `@${participant.username}` : (participant.participantType || "member")}
          </Text>
        </View>
        {hasActions && (
          <MoreHorizontal size={18} color={TEXT_SEC} strokeWidth={2} />
        )}
      </TouchableOpacity>

      {showActions && (
        <View style={pStyles.actions}>
          {canPromote && (
            <TouchableOpacity style={pStyles.actionBtn} onPress={() => { setShowActions(false); onPromote?.(); }}>
              <Shield size={16} color={GOLD} strokeWidth={2} style={{ marginRight: 8 }} />
              <Text style={[pStyles.actionText, { color: GOLD }]}>Make Admin</Text>
            </TouchableOpacity>
          )}
          {canDemote && (
            <TouchableOpacity style={pStyles.actionBtn} onPress={() => { setShowActions(false); onDemote?.(); }}>
              <ShieldOff size={16} color="#FF8C00" strokeWidth={2} style={{ marginRight: 8 }} />
              <Text style={[pStyles.actionText, { color: "#FF8C00" }]}>Remove Admin</Text>
            </TouchableOpacity>
          )}
          {canKick && (
            <TouchableOpacity style={pStyles.actionBtn} onPress={() => { setShowActions(false); onKick?.(); }}>
              <UserMinus size={16} color={DANGER} strokeWidth={2} style={{ marginRight: 8 }} />
              <Text style={[pStyles.actionText, { color: DANGER }]}>Remove from Group</Text>
            </TouchableOpacity>
          )}
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
  youTag:     { fontFamily:"Manrope-Regular", fontSize:12, color:TEXT_SEC },
  adminBadge: { flexDirection:"row", alignItems:"center", backgroundColor:"rgba(155,155,155,0.15)",
    paddingHorizontal:7, paddingVertical:2, borderRadius:10, marginLeft:8 },
  ownerBadge: { backgroundColor:"rgba(255,184,0,0.15)" },
  adminText:  { fontFamily:"Manrope-SemiBold", fontSize:10, color:GOLD },
  actions:    { backgroundColor:SURFACE, marginHorizontal:16, marginBottom:4,
    borderRadius:12, overflow:"hidden", borderWidth:1, borderColor:BORDER },
  actionBtn:  { flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingVertical:13,
    borderBottomWidth:1, borderBottomColor:BORDER },
  actionText: { fontFamily:"Manrope-SemiBold", fontSize:14 },
});

// ── AddMemberSheet ───────────────────────────────────────────────────────────
function AddMemberSheet({ conversationId, existingIds, currentUserId, currentUserType, onAdded, onClose }) {
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
          if (r.id === currentUserId) return false;         // exclude self
          if (existingIds.has(r.id)) return false;          // exclude existing members
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
      showAlert({
        title: "Error",
        message: err?.message || "Could not add member.",
        primaryAction: { text: "OK", onPress: hideAlert },
        icon: AlertTriangle,
      });
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
// OwnerPickerSheet — shown when community owner tries to leave
// ═══════════════════════════════════════════════════════════════════════════════
function OwnerPickerSheet({ participants, currentUserId, onPick, onSkip, onClose }) {
  const [picking, setPicking] = useState(null);

  const candidates = [
    ...participants.filter((p) => p.role === "admin"  && String(p.participantId) !== String(currentUserId)),
    ...participants.filter((p) => p.role !== "admin"  && String(p.participantId) !== String(currentUserId)),
  ];

  return (
    <View style={opStyles.sheet}>
      <View style={opStyles.header}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={opStyles.title}>Transfer Ownership</Text>
          <Text style={opStyles.sub}>Choose who becomes the next group manager</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
          <X size={20} color={TEXT_SEC} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
        {candidates.length === 0 && (
          <Text style={opStyles.empty}>No other participants to transfer to.</Text>
        )}
        {candidates.map((p) => {
          const name = p.name || p.username || "User";
          const isConfirming = picking === p.participantId;
          return (
            <View key={p.participantId} style={opStyles.row}>
              <Image source={{ uri: p.photoUrl || "https://via.placeholder.com/40" }} style={opStyles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={opStyles.name} numberOfLines={1}>{name}</Text>
                {p.role === "admin" && <Text style={opStyles.adminTag}>Admin</Text>}
              </View>
              {isConfirming ? (
                <View style={{ flexDirection:"row", gap:8 }}>
                  <TouchableOpacity style={[opStyles.btn, opStyles.btnConfirm]} onPress={() => { setPicking(null); onPick(p); }}>
                    <Text style={opStyles.btnConfirmText}>Confirm</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[opStyles.btn, opStyles.btnCancel]} onPress={() => setPicking(null)}>
                    <Text style={opStyles.btnCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={[opStyles.btn, opStyles.btnPick]} onPress={() => setPicking(p.participantId)}>
                  <Crown size={13} color={GOLD} strokeWidth={2} style={{ marginRight: 4 }} />
                  <Text style={opStyles.btnPickText}>Make Owner</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={opStyles.skipArea}>
        <View style={opStyles.skipNote}>
          <Info size={13} color={TEXT_SEC} strokeWidth={2} style={{ marginRight: 6 }} />
          <Text style={opStyles.skipNoteText}>
            If you skip, the longest-standing admin will automatically become the group manager.
          </Text>
        </View>
        <TouchableOpacity style={opStyles.skipBtn} onPress={onSkip}>
          <Text style={opStyles.skipBtnText}>Skip &amp; Leave</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const opStyles = StyleSheet.create({
  sheet:          { backgroundColor:SURFACE, marginHorizontal:16, marginVertical:8,
    borderRadius:18, borderWidth:1, borderColor:BORDER, overflow:"hidden" },
  header:         { flexDirection:"row", alignItems:"flex-start", justifyContent:"space-between",
    padding:16, borderBottomWidth:1, borderBottomColor:BORDER },
  title:          { fontFamily:"BasicCommercial-Bold", fontSize:16, color:TEXT },
  sub:            { fontFamily:"Manrope-Regular", fontSize:12, color:TEXT_SEC, marginTop:2 },
  empty:          { fontFamily:"Manrope-Regular", fontSize:13, color:TEXT_SEC,
    textAlign:"center", paddingVertical:24 },
  row:            { flexDirection:"row", alignItems:"center", paddingHorizontal:16,
    paddingVertical:12, borderBottomWidth:1, borderBottomColor:BORDER },
  avatar:         { width:40, height:40, borderRadius:20, marginRight:12, backgroundColor:SURFACE2 },
  name:           { fontFamily:"Manrope-SemiBold", fontSize:14, color:TEXT },
  adminTag:       { fontFamily:"Manrope-Regular", fontSize:11, color:GOLD, marginTop:1 },
  btn:            { flexDirection:"row", alignItems:"center", borderRadius:20,
    paddingHorizontal:12, paddingVertical:7 },
  btnPick:        { backgroundColor:"rgba(255,184,0,0.12)", borderWidth:1, borderColor:"rgba(255,184,0,0.35)" },
  btnPickText:    { fontFamily:"Manrope-SemiBold", fontSize:12, color:GOLD },
  btnConfirm:     { backgroundColor:ACCENT },
  btnConfirmText: { fontFamily:"Manrope-SemiBold", fontSize:12, color:"#FFF" },
  btnCancel:      { backgroundColor:SURFACE2 },
  btnCancelText:  { fontFamily:"Manrope-SemiBold", fontSize:12, color:TEXT_SEC },
  skipArea:       { padding:16 },
  skipNote:       { flexDirection:"row", alignItems:"flex-start", backgroundColor:"rgba(142,142,147,0.1)",
    borderRadius:10, padding:10, marginBottom:12 },
  skipNoteText:   { fontFamily:"Manrope-Regular", fontSize:12, color:TEXT_SEC, flex:1, lineHeight:17 },
  skipBtn:        { alignItems:"center", paddingVertical:13, borderRadius:14,
    backgroundColor:"rgba(229,57,53,0.07)", borderWidth:1, borderColor:"rgba(229,57,53,0.18)" },
  skipBtnText:    { fontFamily:"Manrope-SemiBold", fontSize:14, color:DANGER },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export default function GroupInfoScreen({ route, navigation }) {
  const { conversationId, groupName: initialName } = route.params || {};

  const [participants,        setParticipants]        = useState([]);
  const [groupAvatar,         setGroupAvatar]         = useState(null);
  const [createdAt,           setCreatedAt]           = useState(null);
  const [loading,             setLoading]             = useState(true);
  const [uploadingAvatar,     setUploadingAvatar]     = useState(false);
  const [currentUser,         setCurrentUser]         = useState(null);
  const [editingName,         setEditingName]         = useState(false);
  const [nameText,            setNameText]            = useState(initialName || "");
  const [savingName,          setSavingName]          = useState(false);
  const [showAddSheet,        setShowAddSheet]        = useState(false);
  const [messagingRestricted, setMessagingRestricted] = useState(false);
  const [togglingRestrict,    setTogglingRestrict]    = useState(false);
  const [communityAutoJoin,   setCommunityAutoJoin]   = useState(false);
  const [communityOwnerId,    setCommunityOwnerId]    = useState(null);
  const [togglingAutoJoin,    setTogglingAutoJoin]    = useState(false);
  const [adminOnlyInvite,     setAdminOnlyInvite]     = useState(false);
  const [togglingAdminInvite, setTogglingAdminInvite] = useState(false);
  const [showOwnerPicker,     setShowOwnerPicker]     = useState(false);
  const [alertConfig,         setAlertConfig]         = useState({
    visible: false,
    title: "",
    message: "",
    primaryAction: null,
    secondaryAction: null,
    icon: null,
    iconColor: "#FF3B30",
  });

  const showAlert = (config) => setAlertConfig({ ...config, visible: true });
  const hideAlert = () => setAlertConfig((prev) => ({ ...prev, visible: false }));

  // ── Load current user ──────────────────────────────────────────────────────
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

  // ── Load participants + metadata ───────────────────────────────────────────
  const loadParticipants = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getGroupParticipants(conversationId);
      setParticipants(res.participants || []);
      if (res.groupAvatarUrl)    setGroupAvatar(res.groupAvatarUrl);
      if (res.createdAt)         setCreatedAt(res.createdAt);
      setMessagingRestricted(res.messagingRestricted || false);
      setCommunityAutoJoin(res.communityAutoJoin   || false);
      setCommunityOwnerId(res.communityOwnerId     || null);
      setAdminOnlyInvite(res.adminOnlyInvite       || false);
    } catch (err) {
      console.error("GroupInfoScreen: error loading participants:", err);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => { loadParticipants(); }, [loadParticipants]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const myParticipant = participants.find(
    (p) => String(p.participantId) === String(currentUser?.id)
  );
  const isMeAdmin     = myParticipant?.role === "admin";
  // Any member can add others unless adminOnlyInvite is on
  const canAddMembers = isMeAdmin || !adminOnlyInvite;

  const { pickAndCrop } = useCrop();

  // ── Avatar upload ──────────────────────────────────────────────────────────
  const handleAvatarPress = async () => {
    if (!isMeAdmin) return;
    setUploadingAvatar(true);
    try {
      const result = await pickAndCrop("avatar");
      if (!result?.uri) return;
      const url = await uploadToCloudinary(result.uri);
      await updateGroupConversation(conversationId, { groupAvatarUrl: url });
      setGroupAvatar(url);
    } catch (err) {
      showAlert({
        title: "Error",
        message: "Could not update group photo.",
        primaryAction: { text: "OK", onPress: hideAlert },
        icon: AlertTriangle,
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ── Save group name ────────────────────────────────────────────────────────
  const handleSaveName = async () => {
    if (!nameText.trim()) return;
    setSavingName(true);
    try {
      await updateGroupConversation(conversationId, { groupName: nameText.trim() });
      setEditingName(false);
    } catch (err) {
      showAlert({
        title: "Error",
        message: err?.message || "Could not update group name.",
        primaryAction: { text: "OK", onPress: hideAlert },
        icon: AlertTriangle,
      });
    } finally {
      setSavingName(false);
    }
  };

  // ── Kick member ────────────────────────────────────────────────────────────
  const handleKick = useCallback((participant) => {
    showAlert({
      title: "Remove Member",
      message: `Remove ${participant.name || "this member"} from the group?`,
      icon: UserMinus,
      iconColor: DANGER,
      secondaryAction: { text: "Cancel", onPress: hideAlert },
      primaryAction: {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await removeGroupParticipant(conversationId, participant.participantId, participant.participantType || "member");
            setParticipants((prev) => prev.filter((p) => p.participantId !== participant.participantId));
          } catch (err) {
            showAlert({
              title: "Error",
              message: err?.message || "Could not remove member.",
              primaryAction: { text: "OK", onPress: hideAlert },
              icon: AlertTriangle,
            });
          }
        },
      },
    });
  }, [conversationId]);

  // ── Promote to admin ───────────────────────────────────────────────────────
  const handlePromote = useCallback((participant) => {
    showAlert({
      title: "Make Admin",
      message: `Make ${participant.name || "this member"} a group admin? They'll be able to add/remove members and manage settings.`,
      icon: Shield,
      iconColor: GOLD,
      secondaryAction: { text: "Cancel", onPress: hideAlert },
      primaryAction: {
        text: "Make Admin",
        onPress: async () => {
          try {
            await promoteToAdmin(conversationId, participant.participantId, participant.participantType || "member");
            setParticipants((prev) =>
              prev.map((p) => p.participantId === participant.participantId ? { ...p, role: "admin" } : p)
            );
          } catch (err) {
            showAlert({
              title: "Error",
              message: err?.message || "Could not promote member.",
              primaryAction: { text: "OK", onPress: hideAlert },
              icon: AlertTriangle,
            });
          }
        },
      },
    });
  }, [conversationId]);

  // ── Demote from admin ──────────────────────────────────────────────────────
  const handleDemote = useCallback((participant) => {
    showAlert({
      title: "Remove Admin",
      message: `Remove ${participant.name || "this member"}'s admin privileges?`,
      icon: ShieldOff,
      iconColor: "#FF8C00",
      secondaryAction: { text: "Cancel", onPress: hideAlert },
      primaryAction: {
        text: "Remove Admin",
        style: "destructive",
        onPress: async () => {
          try {
            await demoteFromAdmin(conversationId, participant.participantId, participant.participantType || "member");
            setParticipants((prev) =>
              prev.map((p) => p.participantId === participant.participantId ? { ...p, role: "member" } : p)
            );
          } catch (err) {
            showAlert({
              title: "Error",
              message: err?.message || "Could not demote admin.",
              primaryAction: { text: "OK", onPress: hideAlert },
              icon: AlertTriangle,
            });
          }
        },
      },
    });
  }, [conversationId]);

  // ── Transfer admin (legacy, kept for community-only flow) ──────────────────
  const handleTransfer = useCallback((participant) => {
    showAlert({
      title: "Transfer Admin",
      message: `Make ${participant.name || "this member"} the new admin? You will become a regular member.`,
      icon: Shield,
      iconColor: GOLD,
      secondaryAction: { text: "Cancel", onPress: hideAlert },
      primaryAction: {
        text: "Transfer",
        onPress: async () => {
          try {
            await transferAdmin(conversationId, participant.participantId, participant.participantType || "member");
            await loadParticipants();
          } catch (err) {
            showAlert({
              title: "Error",
              message: err?.message || "Could not transfer admin.",
              primaryAction: { text: "OK", onPress: hideAlert },
              icon: AlertTriangle,
            });
          }
        },
      },
    });
  }, [conversationId, loadParticipants]);

  // ── Leave group ────────────────────────────────────────────────────────────
  const handleLeave = useCallback(() => {
    const adminCount  = participants.filter((p) => p.role === "admin").length;
    const isLastAdmin = isMeAdmin && adminCount === 1 && participants.length > 1;

    // If the community owner is leaving, show the ownership picker first
    const isCommunityOwnerLeaving =
      currentUser?.type === "community" &&
      communityOwnerId &&
      String(currentUser.id) === String(communityOwnerId);

    if (isCommunityOwnerLeaving) {
      setShowOwnerPicker(true);
      return;
    }

    if (isLastAdmin) {
      showAlert({
        title: "Promote Someone First",
        message: "You're the only admin. Promote another member to admin before leaving the group.",
        icon: Shield,
        iconColor: GOLD,
        primaryAction: { text: "OK", onPress: hideAlert },
      });
      return;
    }

    showAlert({
      title: "Leave Group",
      message: "Are you sure you want to leave this group?",
      icon: LogOut,
      iconColor: DANGER,
      secondaryAction: { text: "Cancel", onPress: hideAlert },
      primaryAction: {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          try {
            await removeGroupParticipant(conversationId, currentUser.id, currentUser.type || "member");
            navigation.popToTop();
          } catch (err) {
            const isLastAdminErr = err?.message === "LAST_ADMIN" || err?.error === "LAST_ADMIN";
            showAlert({
              title: isLastAdminErr ? "Promote Someone First" : "Error",
              message: isLastAdminErr
                ? "You're the only admin. Promote another member before leaving."
                : (err?.message || "Could not leave group."),
              primaryAction: { text: "OK", onPress: hideAlert },
              icon: isLastAdminErr ? Shield : AlertTriangle,
              iconColor: isLastAdminErr ? GOLD : DANGER,
            });
          }
        },
      },
    });
  }, [communityOwnerId, conversationId, currentUser, isMeAdmin, navigation, participants]);

  // ── Pick owner & leave (community owner explicit choice) ───────────────────
  const handlePickOwner = useCallback(async (target) => {
    setShowOwnerPicker(false);
    try {
      await transferGroupOwnership(conversationId, target.participantId, target.participantType || "member");
      await removeGroupParticipant(conversationId, currentUser.id, currentUser.type);
      navigation.popToTop();
    } catch (err) {
      showAlert({
        title: "Error",
        message: err?.message || "Could not transfer ownership.",
        primaryAction: { text: "OK", onPress: hideAlert },
        icon: AlertTriangle,
      });
    }
  }, [conversationId, currentUser, navigation]);

  // ── Skip ownership pick & leave (backend auto-assigns) ─────────────────────
  const handleSkipOwner = useCallback(() => {
    setShowOwnerPicker(false);
    showAlert({
      title: "Leave Group",
      message: "The longest-standing admin will automatically become the group manager. Continue?",
      icon: Crown,
      iconColor: GOLD,
      secondaryAction: { text: "Cancel", onPress: hideAlert },
      primaryAction: {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          try {
            await removeGroupParticipant(conversationId, currentUser.id, currentUser.type);
            navigation.popToTop();
          } catch (err) {
            showAlert({
              title: "Error",
              message: err?.message || "Could not leave group.",
              primaryAction: { text: "OK", onPress: hideAlert },
              icon: AlertTriangle,
            });
          }
        },
      },
    });
  }, [conversationId, currentUser, navigation]);

  // ── Toggle messaging restriction ────────────────────────────────────────────────────────────
  const handleToggleRestrict = useCallback(async (value) => {
    setTogglingRestrict(true);
    try {
      await updateGroupConversation(conversationId, { messagingRestricted: value });
      setMessagingRestricted(value);
      // Post a system message so participants know
      const sysText = value
        ? "Messaging has been restricted to admins only."
        : "All participants can now send messages.";
      try {
        await sendMessage({
          conversationId,
          messageText: sysText,
          messageType: "system",
        });
      } catch { /* non-fatal */ }
    } catch (err) {
      showAlert({
        title: "Error",
        message: err?.message || "Could not update restriction.",
        primaryAction: { text: "OK", onPress: hideAlert },
        icon: AlertTriangle,
      });
    } finally {
      setTogglingRestrict(false);
    }
  }, [conversationId]);

  // ── Toggle admin-only invite ───────────────────────────────────────────────
  const handleToggleAdminInvite = useCallback(async (value) => {
    setTogglingAdminInvite(true);
    try {
      await updateGroupConversation(conversationId, { adminOnlyInvite: value });
      setAdminOnlyInvite(value);
    } catch (err) {
      showAlert({
        title: "Error",
        message: err?.message || "Could not update invite setting.",
        primaryAction: { text: "OK", onPress: hideAlert },
        icon: AlertTriangle,
      });
    } finally {
      setTogglingAdminInvite(false);
    }
  }, [conversationId]);

  // ── Toggle auto-join (community admin only) ────────────────────────────────
  const handleToggleAutoJoin = useCallback(async (value) => {
    setTogglingAutoJoin(true);
    try {
      await updateGroupConversation(conversationId, { communityAutoJoin: value });
      setCommunityAutoJoin(value);
    } catch (err) {
      showAlert({
        title: "Error",
        message: err?.message || "Could not update auto-join setting.",
        primaryAction: { text: "OK", onPress: hideAlert },
        icon: AlertTriangle,
      });
    } finally {
      setTogglingAutoJoin(false);
    }
  }, [conversationId]);

  // ── Navigate to profile ────────────────────────────────────────────────────
  const navigateToProfile = useCallback((participant) => {
    if (String(participant.participantId) === String(currentUser?.id)) return;
    if (participant.participantType === "community") {
      navigation.navigate("CommunityPublicProfile", { communityId: participant.participantId });
    } else {
      navigation.navigate("MemberPublicProfile", { memberId: participant.participantId });
    }
  }, [currentUser, navigation]);

  const existingIds = new Set(participants.map((p) => p.participantId));

  // ── Loading ────────────────────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <ArrowLeft size={22} color={TEXT} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.title}>Group Info</Text>
        {canAddMembers ? (
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowAddSheet((v) => !v)}>
            <UserPlus size={20} color={ACCENT} strokeWidth={2} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>

        {/* Ownership transfer sheet (shown when community owner taps Leave) */}
        {showOwnerPicker && (
          <OwnerPickerSheet
            participants={participants}
            currentUserId={currentUser?.id}
            onPick={handlePickOwner}
            onSkip={handleSkipOwner}
            onClose={() => setShowOwnerPicker(false)}
          />
        )}

        {/* Group avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handleAvatarPress} activeOpacity={isMeAdmin ? 0.7 : 1} style={styles.avatarWrap}>
            {uploadingAvatar ? (
              <View style={[styles.avatar, styles.avatarLoading]}>
                <SnooLoader size="small" color={ACCENT} />
              </View>
            ) : (
              <Image
                source={{ uri: groupAvatar || "https://via.placeholder.com/88" }}
                style={styles.avatar}
              />
            )}
            {isMeAdmin && !uploadingAvatar && (
              <View style={styles.cameraOverlay}>
                <Camera size={16} color="#FFF" strokeWidth={2} />
              </View>
            )}
          </TouchableOpacity>

          {/* Group name */}
          <View style={styles.nameRow}>
            {editingName ? (
              <View style={styles.nameEditRow}>
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
              </View>
            ) : (
              <View style={styles.nameDisplayRow}>
                <Text style={styles.nameDisplay} numberOfLines={1}>{nameText || "Group"}</Text>
                {isMeAdmin && (
                  <TouchableOpacity onPress={() => setEditingName(true)}
                    hitSlop={{ top:8, bottom:8, left:8, right:8 }} style={{ marginLeft: 8 }}>
                    <Edit2 size={16} color={TEXT_SEC} strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Created date */}
          {createdAt && (
            <Text style={styles.createdAt}>Created {formatDate(createdAt)}</Text>
          )}
        </View>

        {/* Add member sheet (inline) */}
        {showAddSheet && canAddMembers && (
          <AddMemberSheet
            conversationId={conversationId}
            existingIds={existingIds}
            currentUserId={currentUser?.id}
            currentUserType={currentUser?.type}
            onAdded={(user) => {
              setParticipants((prev) => [
                ...prev,
                {
                  participantId:   user.id,
                  participantType: user.type || "member",
                  name:            user.display_name || user.name || user.full_name,
                  username:        user.username,
                  photoUrl:        user.profile_photo_url || user.logo_url,
                  role:            "member",
                },
              ]);
              setShowAddSheet(false);
            }}
            onClose={() => setShowAddSheet(false)}
          />
        )}

        {/* Auto-join toggle (community owner + admin only) */}
        {isMeAdmin &&
          currentUser?.type === "community" &&
          String(currentUser?.id) === String(communityOwnerId) && (
          <View style={styles.restrictRow}>
            <View style={styles.restrictRowLeft}>
              <View style={[styles.restrictIcon, { backgroundColor: "rgba(53,101,242,0.1)" }]}>
                <Users size={16} color={ACCENT} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.restrictTitle}>Auto-add followers</Text>
                <Text style={styles.restrictSub}>
                  {communityAutoJoin
                    ? "Followers are invited to join this group"
                    : "Followers are not auto-invited to this group"}
                </Text>
              </View>
            </View>
            <Switch
              value={communityAutoJoin}
              onValueChange={handleToggleAutoJoin}
              disabled={togglingAutoJoin}
              trackColor={{ false: "#E5E5EA", true: `${ACCENT}40` }}
              thumbColor={communityAutoJoin ? ACCENT : "#FFFFFF"}
              ios_backgroundColor="#E5E5EA"
            />
          </View>
        )}

        {/* Restrict messaging (admin only) */}
        {isMeAdmin && (
          <View style={styles.restrictRow}>
            <View style={styles.restrictRowLeft}>
              <View style={styles.restrictIcon}>
                <LockKeyhole size={16} color={ACCENT} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.restrictTitle}>Restrict Messaging</Text>
                <Text style={styles.restrictSub}>
                  {messagingRestricted ? "Only admins can send messages" : "Everyone can send messages"}
                </Text>
              </View>
            </View>
            <Switch
              value={messagingRestricted}
              onValueChange={handleToggleRestrict}
              disabled={togglingRestrict}
              trackColor={{ false: "#E5E5EA", true: `${ACCENT}40` }}
              thumbColor={messagingRestricted ? ACCENT : "#FFFFFF"}
              ios_backgroundColor="#E5E5EA"
            />
          </View>
        )}

        {/* Admin-only invite toggle (admin only) */}
        {isMeAdmin && (
          <View style={styles.restrictRow}>
            <View style={styles.restrictRowLeft}>
              <View style={[styles.restrictIcon, { backgroundColor: "rgba(155,155,155,0.12)" }]}>
                <UserPlus size={16} color={SILVER_ADMIN} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.restrictTitle}>Admin-Only Invites</Text>
                <Text style={styles.restrictSub}>
                  {adminOnlyInvite ? "Only admins can add new members" : "Anyone can add new members"}
                </Text>
              </View>
            </View>
            <Switch
              value={adminOnlyInvite}
              onValueChange={handleToggleAdminInvite}
              disabled={togglingAdminInvite}
              trackColor={{ false: "#E5E5EA", true: `${ACCENT}40` }}
              thumbColor={adminOnlyInvite ? ACCENT : "#FFFFFF"}
              ios_backgroundColor="#E5E5EA"
            />
          </View>
        )}

        {/* Grouped participant list — Admins on top, Members below */}
        {(() => {
          const admins  = participants.filter((p) => p.role === "admin");
          const members = participants.filter((p) => p.role !== "admin");
          return (
            <>
              {/* Admins section */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>ADMINS ({admins.length})</Text>
              </View>
              {admins.map((p) => (
                <ParticipantRow
                  key={p.participantId}
                  participant={p}
                  isCurrentUser={String(p.participantId) === String(currentUser?.id)}
                  isMeAdmin={isMeAdmin}
                  communityOwnerId={communityOwnerId}
                  onKick={() => handleKick(p)}
                  onPromote={() => handlePromote(p)}
                  onDemote={() => handleDemote(p)}
                  onPress={() => navigateToProfile(p)}
                />
              ))}

              {/* Members section */}
              {members.length > 0 && (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>MEMBERS ({members.length})</Text>
                </View>
              )}
              {members.map((p) => (
                <ParticipantRow
                  key={p.participantId}
                  participant={p}
                  isCurrentUser={String(p.participantId) === String(currentUser?.id)}
                  isMeAdmin={isMeAdmin}
                  communityOwnerId={communityOwnerId}
                  onKick={() => handleKick(p)}
                  onPromote={() => handlePromote(p)}
                  onDemote={() => handleDemote(p)}
                  onPress={() => navigateToProfile(p)}
                />
              ))}
            </>
          );
        })()}

        {/* Leave button */}
        {currentUser && (
          <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave}>
            <LogOut size={18} color={DANGER} strokeWidth={2} style={{ marginRight: 10 }} />
            <Text style={styles.leaveBtnText}>Leave Group</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <CustomAlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        onClose={hideAlert}
        primaryAction={alertConfig.primaryAction}
        secondaryAction={alertConfig.secondaryAction}
        icon={alertConfig.icon}
        iconColor={alertConfig.iconColor}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex:1, backgroundColor:BG },
  header:       { flexDirection:"row", alignItems:"center", justifyContent:"space-between",
    paddingHorizontal:16, paddingVertical:12, borderBottomWidth:1, borderBottomColor:BORDER },
  iconBtn:      { width:40, height:40, alignItems:"center", justifyContent:"center" },
  title:        { fontFamily:"BasicCommercial-Black", fontSize:18, color:TEXT },
  centered:     { flex:1, justifyContent:"center", alignItems:"center" },

  // Avatar section
  avatarSection:  { alignItems:"center", paddingVertical:28 },
  avatarWrap:     { position:"relative", marginBottom:14 },
  avatar:         { width:88, height:88, borderRadius:44, backgroundColor:SURFACE2 },
  avatarLoading:  { alignItems:"center", justifyContent:"center" },
  cameraOverlay:  { position:"absolute", bottom:0, right:0, width:28, height:28,
    borderRadius:14, backgroundColor:ACCENT, alignItems:"center", justifyContent:"center",
    borderWidth:2, borderColor:BG },

  // Name
  nameRow:        { width:"100%", alignItems:"center", paddingHorizontal:32 },
  nameEditRow:    { flexDirection:"row", alignItems:"center" },
  nameDisplayRow: { flexDirection:"row", alignItems:"center", justifyContent:"center" },
  nameDisplay:    { fontFamily:"BasicCommercial-Bold", fontSize:22, color:TEXT },
  nameInput:      { fontFamily:"BasicCommercial-Bold", fontSize:22, color:TEXT,
    borderBottomWidth:1, borderBottomColor:ACCENT, paddingVertical:4, marginRight:10, minWidth:120 },
  createdAt:      { fontFamily:"Manrope-Regular", fontSize:12, color:TEXT_SEC, marginTop:6 },

  // Members
  sectionHeader:  { paddingHorizontal:16, paddingTop:8, paddingBottom:8,
    borderTopWidth:1, borderTopColor:BORDER },
  sectionLabel:   { fontFamily:"BasicCommercial-Bold", fontSize:12, color:TEXT_SEC,
    letterSpacing:0.5, textTransform:"uppercase" },

  // Leave
  leaveBtn:       { flexDirection:"row", alignItems:"center", justifyContent:"center",
    marginHorizontal:16, marginTop:32, paddingVertical:14, borderRadius:14,
    backgroundColor:"rgba(229,57,53,0.08)", borderWidth:1, borderColor:"rgba(229,57,53,0.2)" },
  leaveBtnText:   { fontFamily:"Manrope-SemiBold", fontSize:15, color:DANGER },

  // Restrict messaging toggle
  restrictRow:    { flexDirection:"row", alignItems:"center", justifyContent:"space-between",
    marginHorizontal:16, marginTop:8, marginBottom:4, paddingVertical:14,
    paddingHorizontal:16, backgroundColor:SURFACE, borderRadius:16,
    borderWidth:1, borderColor:BORDER },
  restrictRowLeft:{ flexDirection:"row", alignItems:"center", flex:1, marginRight:12 },
  restrictIcon:   { width:36, height:36, borderRadius:18, backgroundColor:"rgba(53,101,242,0.1)",
    alignItems:"center", justifyContent:"center", marginRight:12 },
  restrictTitle:  { fontFamily:"Manrope-SemiBold", fontSize:14, color:TEXT },
  restrictSub:    { fontFamily:"Manrope-Regular", fontSize:12, color:TEXT_SEC, marginTop:2 },
});
