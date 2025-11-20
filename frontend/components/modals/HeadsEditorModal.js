import React, { useMemo, useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput, Image, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { launchImageLibraryAsync, MediaTypeOptions } from 'expo-image-picker';
import { uploadImage } from '../../api/cloudinary';
import { apiGet } from '../../api/client';
import { getAuthToken } from '../../api/auth';

const PRIMARY = '#5f27cd';
const TEXT = '#1e1e1e';
const LIGHT = '#6c757d';
const BG = '#ffffff';

export default function HeadsEditorModal({ visible, initialHeads = [], onCancel, onSave, maxHeads = 3 }) {
  const [heads, setHeads] = useState(() => initialHeads.map(h => ({ ...h })));
  const [saving, setSaving] = useState(false);
  const [linkingIndex, setLinkingIndex] = useState(-1);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberSearchError, setMemberSearchError] = useState('');

  useEffect(() => {
    if (visible) {
      setHeads(initialHeads.map(h => ({ ...h })));
      setLinkingIndex(-1);
      setMemberQuery('');
      setMemberResults([]);
      setMemberLoading(false);
      setMemberSearchError('');
    }
  }, [initialHeads, visible]);

  const canAdd = useMemo(() => heads.length < maxHeads, [heads.length, maxHeads]);

  const setPrimary = (idx) => {
    setHeads(prev => prev.map((h, i) => ({ ...h, is_primary: i === idx })));
  };

  const updateField = (idx, key, value) => {
    setHeads(prev => prev.map((h, i) => {
      if (i !== idx) return h;
      let nextValue = value;
      if (key === 'phone') {
        nextValue = (value || '').replace(/[^0-9]/g, '').slice(0, 10);
      }
      return { ...h, [key]: nextValue };
    }));
  };

  const addHead = () => {
    if (!canAdd) return;
    setHeads(prev => [...prev, { name: '', is_primary: prev.length === 0, email: null, phone: null, profile_pic_url: null, member_id: null, member_username: null, member_photo_url: null }]);
  };

  const removeHead = (idx) => {
    const next = heads.filter((_, i) => i !== idx);
    // ensure exactly one primary
    if (next.length > 0 && !next.some(h => h.is_primary)) next[0].is_primary = true;
    setHeads(next);
  };

  const clearLink = (idx) => {
    updateField(idx, 'member_id', null);
    updateField(idx, 'member_username', null);
    updateField(idx, 'member_photo_url', null);
  };

  const openLinkModal = (idx) => {
    setLinkingIndex(idx);
    const existingUsername = heads[idx]?.member_username || '';
    setMemberQuery(existingUsername);
    setMemberResults([]);
    setMemberSearchError('');
    if (existingUsername && existingUsername.trim().length >= 2) {
      searchMembers(existingUsername.trim());
    }
  };

  const closeLinkModal = () => {
    setLinkingIndex(-1);
    setMemberQuery('');
    setMemberResults([]);
    setMemberLoading(false);
    setMemberSearchError('');
  };

  const searchMembers = async (query) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setMemberResults([]);
      setMemberSearchError('');
      return;
    }
    try {
      setMemberLoading(true);
      setMemberSearchError('');
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      const res = await apiGet(`/members/search?q=${encodeURIComponent(trimmed)}`, 15000, token);
      const results = res?.results || [];
      setMemberResults(results);
      if (results.length === 0) {
        setMemberSearchError('No members found');
      }
    } catch (error) {
      setMemberResults([]);
      setMemberSearchError(error?.message || 'Failed to search members');
    } finally {
      setMemberLoading(false);
    }
  };

  useEffect(() => {
    if (linkingIndex === -1) return;
    if (!memberQuery || memberQuery.trim().length < 2) {
      setMemberResults([]);
      setMemberSearchError('');
      return;
    }
    const handler = setTimeout(() => {
      searchMembers(memberQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [memberQuery, linkingIndex]);

  const handleSelectMember = (member) => {
    if (linkingIndex === -1) return;
    updateField(linkingIndex, 'member_id', member.id);
    updateField(linkingIndex, 'member_username', member.username || member.full_name || member.name || 'member');
    updateField(linkingIndex, 'member_photo_url', member.profile_photo_url || null);
    closeLinkModal();
  };

  const pickAvatar = async (idx) => {
    try {
      const picker = await launchImageLibraryAsync({ mediaTypes: MediaTypeOptions.Images, allowsEditing: true, aspect: [1,1], quality: 0.9 });
      if (picker.canceled || !picker.assets || !picker.assets[0]) return;
      const url = await uploadImage(picker.assets[0].uri);
      updateField(idx, 'profile_pic_url', url);
    } catch (e) {
      Alert.alert('Upload failed', e?.message || 'Could not upload');
    }
  };

  const validate = (list) => {
    if (!list || list.length === 0) return 'Add at least one head';
    if (list.filter(h => h.is_primary).length !== 1) return 'Exactly one head must be primary';
    for (const h of list) {
      if (!h.name || !h.name.trim()) return 'Head name is required';
      if (h.phone && !/^\d{10}$/.test(h.phone)) return 'Head phone numbers must be 10 digits';
    }
    return null;
  };

  const handleSave = async () => {
    const sanitizedHeads = heads.map(h => {
      const phoneDigits = h.phone ? h.phone.replace(/[^0-9]/g, '').slice(0, 10) : null;
      const memberIdValue = h.member_id != null ? parseInt(h.member_id, 10) : null;
      const memberId = Number.isFinite(memberIdValue) && memberIdValue > 0 ? memberIdValue : null;
      return {
        ...h,
        name: h.name ? h.name.trim() : '',
        email: h.email ? h.email.trim() : null,
        phone: phoneDigits && phoneDigits.length === 10 ? phoneDigits : null,
        member_id: memberId,
        member_username: h.member_username ? h.member_username.trim() : null,
        member_photo_url: h.member_photo_url || null,
      };
    });
    const err = validate(sanitizedHeads);
    if (err) { Alert.alert('Invalid', err); return; }
    if (saving) return;
    try {
      setSaving(true);
      await onSave(sanitizedHeads);
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item, index }) => (
    <View style={styles.row}>
      <TouchableOpacity style={styles.avatar} onPress={() => pickAvatar(index)}>
        {item.profile_pic_url ? (
          <Image source={{ uri: item.profile_pic_url }} style={styles.avatarImg} />
        ) : (
          <Ionicons name="person-circle-outline" size={48} color={LIGHT} />
        )}
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <TextInput
          value={item.name}
          onChangeText={(t) => updateField(index, 'name', t)}
          placeholder="Head name"
          placeholderTextColor={LIGHT}
          style={styles.input}
        />
        <TextInput
          value={item.email || ''}
          onChangeText={(t) => updateField(index, 'email', t)}
          placeholder="Email (optional)"
          placeholderTextColor={LIGHT}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          value={item.phone || ''}
          onChangeText={(t) => updateField(index, 'phone', t)}
          placeholder="Phone (optional)"
          placeholderTextColor={LIGHT}
          style={styles.input}
          keyboardType="phone-pad"
          maxLength={10}
        />
        {item.member_id && (
          <Text style={styles.linkedInfo}>
            Linked to @{item.member_username || item.member_id}
          </Text>
        )}
        <View style={styles.linkActions}>
          <TouchableOpacity onPress={() => openLinkModal(index)} style={styles.linkButton}>
            <Ionicons name="person-add-outline" size={16} color={PRIMARY} />
            <Text style={styles.linkButtonText}>
              {item.member_id ? 'Change linked member' : 'Link member profile'}
            </Text>
          </TouchableOpacity>
          {item.member_id && (
            <TouchableOpacity onPress={() => clearLink(index)} style={styles.unlinkButton}>
              <Ionicons name="close-circle-outline" size={16} color="#FF3B30" />
              <Text style={styles.unlinkText}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.inline}>
          <TouchableOpacity onPress={() => setPrimary(index)} style={[styles.primaryBtn, item.is_primary ? styles.primaryActive : null]}>
            <Text style={[styles.primaryText, item.is_primary ? { color: '#fff' } : null]}>{item.is_primary ? 'Primary' : 'Set as Primary'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => removeHead(index)} style={styles.removeBtn}>
            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
            <Text style={styles.removeText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit Community Heads</Text>
            <TouchableOpacity onPress={onCancel} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={TEXT} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={heads}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
          />

          <View style={styles.footer}>
            <TouchableOpacity disabled={!canAdd} onPress={addHead} style={[styles.addBtn, !canAdd && { opacity: 0.5 }]}>
              <Ionicons name="add" size={20} color={PRIMARY} />
              <Text style={styles.addText}>Add Head</Text>
            </TouchableOpacity>
            <Text style={styles.limitText}>Up to 5 heads</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
              <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    <Modal
      visible={linkingIndex !== -1}
      transparent
      animationType="slide"
      onRequestClose={closeLinkModal}
    >
      <View style={styles.linkOverlay}>
        <View style={styles.linkSheet}>
          <View style={styles.linkHeader}>
            <Text style={styles.linkTitle}>Link Member Profile</Text>
            <TouchableOpacity onPress={closeLinkModal} style={{ padding: 4 }}>
              <Ionicons name="close" size={22} color={TEXT} />
            </TouchableOpacity>
          </View>
          <TextInput
            value={memberQuery}
            onChangeText={setMemberQuery}
            placeholder="Search members by name or username"
            placeholderTextColor={LIGHT}
            style={styles.linkSearchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {memberQuery.trim().length < 2 ? (
            <Text style={styles.linkHint}>Type at least 2 characters to search</Text>
          ) : memberLoading ? (
            <View style={styles.linkLoading}>
              <ActivityIndicator size="small" color={PRIMARY} />
            </View>
          ) : memberResults.length === 0 ? (
            <Text style={styles.linkHint}>{memberSearchError || 'No members found'}</Text>
          ) : (
            <FlatList
              data={memberResults}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.linkResultItem}
                  onPress={() => handleSelectMember(item)}
                >
                  {item.profile_photo_url ? (
                    <Image source={{ uri: item.profile_photo_url }} style={styles.linkResultAvatar} />
                  ) : (
                    <View style={[styles.linkResultAvatar, styles.linkResultAvatarPlaceholder]}>
                      <Ionicons name="person" size={18} color={LIGHT} />
                    </View>
                  )}
                  <View style={styles.linkResultMeta}>
                    <Text style={styles.linkResultName} numberOfLines={1}>
                      {item.full_name || item.name || 'Member'}
                    </Text>
                    <Text style={styles.linkResultUsername} numberOfLines={1}>
                      @{item.username || 'user'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={LIGHT} />
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.linkSeparator} />}
              style={styles.linkResults}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: BG, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '90%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  title: { fontSize: 16, fontWeight: '600', color: TEXT },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', marginLeft: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F2F7' },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  input: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: TEXT, marginBottom: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkedInfo: { fontSize: 12, color: LIGHT, marginBottom: 4 },
  linkActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: PRIMARY, borderRadius: 8 },
  linkButtonText: { color: PRIMARY, fontWeight: '600' },
  unlinkButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6 },
  unlinkText: { color: '#FF3B30', fontWeight: '600' },
  primaryBtn: { borderWidth: 1, borderColor: PRIMARY, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  primaryActive: { backgroundColor: PRIMARY },
  primaryText: { color: PRIMARY, fontWeight: '600' },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6 },
  removeText: { color: '#FF3B30', fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 8 },
  addText: { color: PRIMARY, fontWeight: '600' },
  limitText: { color: LIGHT, fontSize: 12, marginLeft: 8 },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  cancelText: { color: LIGHT },
  saveBtn: { backgroundColor: PRIMARY, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  saveText: { color: '#fff', fontWeight: '700' },
  linkOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  linkSheet: { backgroundColor: BG, borderRadius: 16, padding: 16, maxHeight: '80%' },
  linkHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  linkTitle: { fontSize: 16, fontWeight: '600', color: TEXT },
  linkSearchInput: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: TEXT },
  linkHint: { fontSize: 13, color: LIGHT, textAlign: 'center', marginTop: 12 },
  linkLoading: { paddingVertical: 20, alignItems: 'center' },
  linkResults: { marginTop: 12, maxHeight: 280 },
  linkResultItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  linkResultAvatar: { width: 36, height: 36, borderRadius: 18 },
  linkResultAvatarPlaceholder: { backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },
  linkResultMeta: { flex: 1 },
  linkResultName: { fontSize: 15, fontWeight: '600', color: TEXT },
  linkResultUsername: { fontSize: 13, color: LIGHT },
  linkSeparator: { height: 1, backgroundColor: '#E5E5EA' },
});
