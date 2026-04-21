import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Image, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ArrowLeft, Search, X, Check, Users, AlertTriangle } from "lucide-react-native";
import CustomAlertModal from "../../components/ui/CustomAlertModal";
import { searchAccounts } from "../../api/search";
import { createGroupConversation } from "../../api/messages";
import { getAuthToken, getAuthEmail } from "../../api/auth";
import { apiPost } from "../../api/client";
import SnooLoader from "../../components/ui/SnooLoader";

const BG       = "#FFFFFF";
const SURFACE  = "#F8F8F8";
const SURFACE2 = "#EFEFF4";
const BORDER   = "#E5E5EA";
const ACCENT   = "#3565F2";
const TEXT     = "#000000";
const TEXT_SEC = "#8E8E93";

function SelectedChip({ user, onRemove }) {
  const name = user.display_name || user.name || user.full_name || "User";
  const uri  = user.profile_photo_url || user.logo_url;
  return (
    <View style={chipStyles.container}>
      <Image source={{ uri: uri || "https://via.placeholder.com/24" }} style={chipStyles.avatar} />
      <Text style={chipStyles.name} numberOfLines={1}>{name}</Text>
      <TouchableOpacity onPress={onRemove} hitSlop={{ top:6, bottom:6, left:6, right:6 }}>
        <X size={12} color={TEXT_SEC} strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}
const chipStyles = StyleSheet.create({
  container: { flexDirection:"row", alignItems:"center", backgroundColor:SURFACE2,
    borderRadius:20, paddingHorizontal:10, paddingVertical:5, marginRight:6, marginBottom:6 },
  avatar: { width:20, height:20, borderRadius:10, marginRight:6 },
  name:   { fontFamily:"Manrope-Medium", fontSize:12, color:TEXT, maxWidth:80 },
});

function UserRow({ user, selected, onToggle }) {
  const name = user.display_name || user.name || user.full_name || "User";
  const sub  = user.username ? `@${user.username}` : user.type;
  const uri  = user.profile_photo_url || user.logo_url;
  return (
    <TouchableOpacity style={rowStyles.row} onPress={onToggle} activeOpacity={0.75}>
      <Image source={{ uri: uri || "https://via.placeholder.com/44" }} style={rowStyles.avatar} />
      <View style={{ flex:1 }}>
        <Text style={rowStyles.name} numberOfLines={1}>{name}</Text>
        <Text style={rowStyles.sub}  numberOfLines={1}>{sub}</Text>
      </View>
      <View style={[rowStyles.check, selected && rowStyles.checkSelected]}>
        {selected && <Check size={14} color="#FFF" strokeWidth={2.5} />}
      </View>
    </TouchableOpacity>
  );
}
const rowStyles = StyleSheet.create({
  row:          { flexDirection:"row", alignItems:"center", paddingHorizontal:16,
    paddingVertical:10, borderBottomWidth:1, borderBottomColor:BORDER },
  avatar:       { width:44, height:44, borderRadius:22, marginRight:12, backgroundColor:SURFACE2 },
  name:         { fontFamily:"Manrope-SemiBold", fontSize:14, color:TEXT },
  sub:          { fontFamily:"Manrope-Regular",  fontSize:12, color:TEXT_SEC, marginTop:1 },
  check:        { width:24, height:24, borderRadius:12, borderWidth:2, borderColor:BORDER,
    alignItems:"center", justifyContent:"center" },
  checkSelected:{ backgroundColor:ACCENT, borderColor:ACCENT },
});

export default function CreateGroupScreen({ navigation }) {
  const [step,          setStep]          = useState(1);
  const [searchText,    setSearchText]    = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selected,      setSelected]      = useState([]);
  const [groupName,     setGroupName]     = useState("");
  const [creating,      setCreating]      = useState(false);
  const [currentUser,   setCurrentUser]   = useState(null);
  const [alertConfig,   setAlertConfig]   = useState({
    visible: false,
    title: "",
    message: "",
    primaryAction: null,
    secondaryAction: null,
    icon: null,
    iconColor: "#FF3B30",
  });
  const searchTimeout = useRef(null);

  const showAlert = (config) => setAlertConfig({ ...config, visible: true });
  const hideAlert = () => setAlertConfig((p) => ({ ...p, visible: false }));

  useEffect(() => {
    (async () => {
      try {
        const token = await getAuthToken();
        const email = await getAuthEmail();
        if (!token || !email) return;
        const res = await apiPost("/auth/get-user-profile", { email }, 10000, token);
        setCurrentUser({ id: res?.profile?.id, type: res?.role });
      } catch (err) { console.error("Error loading current user:", err); }
    })();
  }, []);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    const q = searchText.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const res = await searchAccounts(q);
        const filtered = (res.results || []).filter((r) => {
          if (r.id === currentUser?.id) return false;                           // exclude self
          if (currentUser?.type === "member") return r.type === "member";
          return true;
        });
        setSearchResults(filtered);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 350);
  }, [searchText, currentUser]);

  const toggleUser = useCallback((user) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) => {
      const exists = prev.some((u) => u.id === user.id);
      return exists ? prev.filter((u) => u.id !== user.id) : [...prev, user];
    });
  }, []);

  const isSelected = (user) => selected.some((u) => u.id === user.id);

  const handleCreate = async () => {
    if (!groupName.trim()) {
      showAlert({ title: "Name required", message: "Please give your group a name.", primaryAction: { text: "OK", onPress: hideAlert }, icon: AlertTriangle });
      return;
    }
    if (selected.length < 2) {
      showAlert({ title: "Add members", message: "Please select at least 2 people.", primaryAction: { text: "OK", onPress: hideAlert }, icon: Users, iconColor: ACCENT });
      return;
    }
    setCreating(true);
    try {
      const res = await createGroupConversation({
        groupName: groupName.trim(),
        participants: selected.map((u) => ({ id: u.id, type: u.type || "member" })),
      });
      navigation.replace("Chat", {
        conversationId: res.conversationId,
        isGroup: true,
        groupName: groupName.trim(),
      });
    } catch (err) {
      showAlert({ title: "Error", message: err?.message || "Failed to create group chat.", primaryAction: { text: "OK", onPress: hideAlert }, icon: AlertTriangle });
    } finally {
      setCreating(false);
    }
  };

  if (step === 1) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <ArrowLeft size={22} color={TEXT} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.title}>New Group</Text>
          <TouchableOpacity
            style={[styles.nextBtn, selected.length < 2 && styles.nextBtnDisabled]}
            onPress={() => { if (selected.length >= 2) setStep(2); }}
            disabled={selected.length < 2}
          >
            <Text style={[styles.nextText, selected.length < 2 && { opacity: 0.4 }]}>Next</Text>
          </TouchableOpacity>
        </View>

        {selected.length > 0 && (
          <View style={styles.chipsRow}>
            {selected.map((u) => (
              <SelectedChip key={u.id} user={u} onRemove={() => toggleUser(u)} />
            ))}
          </View>
        )}

        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search size={16} color={TEXT_SEC} strokeWidth={2} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder={currentUser?.type === "member" ? "Search members…" : "Search people…"}
              placeholderTextColor={TEXT_SEC}
              value={searchText}
              onChangeText={setSearchText}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText("")} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
                <X size={14} color={TEXT_SEC} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {searchLoading ? (
          <View style={{ paddingTop: 24, alignItems: "center" }}>
            <SnooLoader size="small" color={ACCENT} />
          </View>
        ) : searchText.trim().length < 2 ? (
          <View style={styles.hint}>
            <Users size={32} color={BORDER} strokeWidth={1.5} />
            <Text style={styles.hintText}>Type at least 2 characters to search</Text>
          </View>
        ) : searchResults.length === 0 ? (
          <View style={styles.hint}>
            <Text style={styles.hintText}>No results for "{searchText}"</Text>
          </View>
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <UserRow user={item} selected={isSelected(item)} onToggle={() => toggleUser(item)} />
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep(1)} style={styles.iconBtn}>
            <ArrowLeft size={22} color={TEXT} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.title}>Group Name</Text>
          <TouchableOpacity
            style={[styles.nextBtn, (!groupName.trim() || creating) && styles.nextBtnDisabled]}
            onPress={handleCreate}
            disabled={!groupName.trim() || creating}
          >
            {creating
              ? <SnooLoader size="small" color={ACCENT} />
              : <Text style={[styles.nextText, !groupName.trim() && { opacity: 0.4 }]}>Create</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.memberPreviewRow}>
          {selected.slice(0, 5).map((u) => (
            <Image key={u.id}
              source={{ uri: u.profile_photo_url || u.logo_url || "https://via.placeholder.com/36" }}
              style={styles.previewAvatar} />
          ))}
          {selected.length > 5 && (
            <View style={styles.previewMore}>
              <Text style={styles.previewMoreText}>+{selected.length - 5}</Text>
            </View>
          )}
        </View>

        <View style={styles.nameInputWrap}>
          <TextInput
            style={styles.nameInput}
            placeholder="Group name…"
            placeholderTextColor={TEXT_SEC}
            value={groupName}
            onChangeText={setGroupName}
            maxLength={60}
            autoFocus
          />
        </View>
        <Text style={styles.memberCount}>
          {selected.length} {selected.length === 1 ? "member" : "members"} selected
        </Text>
      </KeyboardAvoidingView>

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
  container:       { flex: 1, backgroundColor: BG },
  header:          { flexDirection:"row", alignItems:"center", justifyContent:"space-between",
    paddingHorizontal:16, paddingVertical:12, borderBottomWidth:1, borderBottomColor:BORDER },
  iconBtn:         { width:40, height:40, alignItems:"center", justifyContent:"center" },
  title:           { fontFamily:"BasicCommercial-Black", fontSize:18, color:TEXT },
  nextBtn:         { paddingHorizontal:16, paddingVertical:8, backgroundColor:ACCENT, borderRadius:20 },
  nextBtnDisabled: { backgroundColor:SURFACE2 },
  nextText:        { fontFamily:"Manrope-SemiBold", fontSize:14, color:"#FFFFFF" },
  chipsRow:        { flexDirection:"row", flexWrap:"wrap", paddingHorizontal:12, paddingTop:10,
    paddingBottom:4, borderBottomWidth:1, borderBottomColor:BORDER },
  searchRow:       { paddingHorizontal:16, paddingVertical:10 },
  searchBar:       { flexDirection:"row", alignItems:"center", backgroundColor:SURFACE,
    borderRadius:12, paddingHorizontal:12, paddingVertical:10, borderWidth:1, borderColor:BORDER },
  searchInput:     { flex:1, fontFamily:"Manrope-Regular", fontSize:14, color:TEXT, paddingVertical:0 },
  hint:            { flex:1, alignItems:"center", justifyContent:"center", paddingBottom:80, gap:12 },
  hintText:        { fontFamily:"Manrope-Regular", fontSize:14, color:TEXT_SEC, textAlign:"center" },
  memberPreviewRow:{ flexDirection:"row", alignItems:"center", justifyContent:"center", paddingVertical:32 },
  previewAvatar:   { width:44, height:44, borderRadius:22, marginHorizontal:4, borderWidth:2, borderColor:BG },
  previewMore:     { width:44, height:44, borderRadius:22, backgroundColor:SURFACE2,
    alignItems:"center", justifyContent:"center", marginHorizontal:4 },
  previewMoreText: { fontFamily:"Manrope-Medium", fontSize:13, color:TEXT_SEC },
  nameInputWrap:   { marginHorizontal:16, borderBottomWidth:1, borderBottomColor:BORDER, paddingVertical:4 },
  nameInput:       { fontFamily:"BasicCommercial-Bold", fontSize:22, color:TEXT, paddingVertical:10 },
  memberCount:     { fontFamily:"Manrope-Medium", fontSize:13, color:TEXT_SEC, textAlign:"center", marginTop:16 },
});
