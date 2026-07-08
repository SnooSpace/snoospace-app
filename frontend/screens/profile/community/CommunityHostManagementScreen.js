/**
 * CommunityHostManagementScreen.js
 *
 * Allows a Community owner or host to manage the multi-host membership for
 * their community. Accessible from Community Settings or from the "Hosting"
 * section of the AccountSwitcherModal.
 *
 * Route name: 'CommunityHostManagement'
 * Route params:
 *   communityId    {number|string}  Required. The community's DB id.
 *   communityName  {string}         Display name.
 *   communityLogo  {string}         Logo URL.
 *   role           {string}         The current user's role for this community.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  Alert,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  UserPlus,
  Crown,
  Building2,
  Shield,
  X,
  ChevronDown,
  MoreHorizontal,
  Trash2,
  User,
  ChevronRight,
} from 'lucide-react-native';
import { COLORS, FONTS } from '../../../constants/theme';
import {
  getCommunityHosts,
  inviteCommunityHost,
  removeCommunityHost,
  updateCommunityHostRole,
  transferCommunityOwnership,
} from '../../../api/communities';
import { apiGet, apiDelete } from '../../../api/client';
import { getAuthToken } from '../../../api/auth';
import SnooLoader from '../../../components/ui/SnooLoader';
import HapticsService from '../../../services/HapticsService';

// ─── Role config ──────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  owner:     { label: 'Owner',     icon: Crown,     color: '#F59E0B', canEdit: false },
  host:      { label: 'Host',      icon: Building2, color: COLORS.primary, canEdit: true },
  moderator: { label: 'Moderator', icon: Shield,    color: '#6B7280', canEdit: true },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function CommunityHostManagementScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const {
    communityId,
    communityName = 'Community',
    communityLogo,
    role: myRole = 'host',
  } = route.params || {};

  const isOwner = myRole === 'owner';

  // Hide tab bar
  useEffect(() => {
    navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => navigation.getParent()?.setOptions({ tabBarStyle: undefined });
  }, [navigation]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMenuHost, setActionMenuHost] = useState(null); // host row with menu open
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteRole, setInviteRole] = useState('host');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const searchTimer = useRef(null);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadHosts = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getCommunityHosts(communityId);
      setHosts(result?.hosts || []);
    } catch (err) {
      Alert.alert('Error', err?.message || 'Failed to load hosts');
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => { loadHosts(); }, [loadHosts]);

  // ── Member search (for invite panel) ──────────────────────────────────────
  const searchMembers = useCallback(async (query) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchError('');
      return;
    }
    try {
      setSearchLoading(true);
      setSearchError('');
      const token = await getAuthToken();
      const res = await apiGet(`/members/search?q=${encodeURIComponent(trimmed)}`, 15000, token);
      const results = res?.results || [];
      setSearchResults(results);
      if (results.length === 0) setSearchError('No members found');
    } catch (e) {
      setSearchResults([]);
      setSearchError(e?.message || 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (inviteQuery.trim().length < 2) {
      setSearchResults([]);
      setSearchError('');
      return;
    }
    searchTimer.current = setTimeout(() => searchMembers(inviteQuery), 300);
    return () => clearTimeout(searchTimer.current);
  }, [inviteQuery, searchMembers]);

  // ── Invite ────────────────────────────────────────────────────────────────
  const handleInvite = useCallback(async (member) => {
    if (submitting) return;
    // Check if member is already a host
    const alreadyHost = hosts.some(h => String(h.user_id) === String(member.id));
    if (alreadyHost) {
      Alert.alert('Already a host', 'This member is already a host of this community.');
      return;
    }
    try {
      setSubmitting(true);
      await inviteCommunityHost(communityId, { userId: member.id, role: inviteRole });
      HapticsService.triggerNotificationSuccess();
      setShowInvitePanel(false);
      setInviteQuery('');
      setSearchResults([]);
      await loadHosts();
    } catch (err) {
      Alert.alert('Error', err?.message || 'Failed to add host');
    } finally {
      setSubmitting(false);
    }
  }, [communityId, inviteRole, hosts, submitting, loadHosts]);

  // ── Remove host ───────────────────────────────────────────────────────────
  const handleRemove = useCallback(async (host) => {
    setActionMenuHost(null);
    Alert.alert(
      'Remove Host',
      `Remove ${host.name || host.username} from this community's hosts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeCommunityHost(communityId, host.user_id);
              HapticsService.triggerImpactMedium();
              await loadHosts();
            } catch (err) {
              Alert.alert('Error', err?.message || 'Failed to remove host');
            }
          },
        },
      ],
    );
  }, [communityId, loadHosts]);

  // ── Role change ───────────────────────────────────────────────────────────
  const handleRoleChange = useCallback(async (host, newRole) => {
    setActionMenuHost(null);
    if (host.role === newRole) return;
    try {
      await updateCommunityHostRole(communityId, host.user_id, newRole);
      HapticsService.triggerSelection();
      await loadHosts();
    } catch (err) {
      Alert.alert('Error', err?.message || 'Failed to update role');
    }
  }, [communityId, loadHosts]);

  // ── Transfer ownership ────────────────────────────────────────────────────
  const handleTransferOwnership = useCallback(async (host) => {
    setActionMenuHost(null);
    Alert.alert(
      'Transfer Ownership',
      `Transfer ownership of this community to ${host.name || host.username}? You will become a Host.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          style: 'destructive',
          onPress: async () => {
            try {
              await transferCommunityOwnership(communityId, host.user_id);
              HapticsService.triggerNotificationSuccess();
              await loadHosts();
              // Navigate back since current user is no longer owner
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', err?.message || 'Failed to transfer ownership');
            }
          },
        },
      ],
    );
  }, [communityId, navigation, loadHosts]);

  // ── Render host row ───────────────────────────────────────────────────────
  const renderHostRow = useCallback(({ item }) => {
    const cfg = ROLE_CONFIG[item.role] || ROLE_CONFIG.host;
    const RoleIcon = cfg.icon;
    const isMenuOpen = actionMenuHost?.user_id === item.user_id;
    const canManage = isOwner && item.role !== 'owner';

    return (
      <View style={styles.hostRow}>
        <Image
          source={{ uri: item.avatar_url || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
        />
        <View style={styles.hostMeta}>
          <Text style={styles.hostName} numberOfLines={1}>
            {item.name || item.username}
          </Text>
          <Text style={styles.hostUsername} numberOfLines={1}>@{item.username}</Text>
        </View>

        <View style={[styles.rolePill, { backgroundColor: cfg.color + '18' }]}>
          <RoleIcon size={11} color={cfg.color} />
          <Text style={[styles.rolePillText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>

        {canManage && (
          <TouchableOpacity
            style={styles.moreBtn}
            onPress={() => {
              HapticsService.triggerSelection();
              setActionMenuHost(isMenuOpen ? null : item);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MoreHorizontal size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Action menu (inline, below row) */}
        {isMenuOpen && (
          <View style={styles.actionMenu}>
            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => handleRoleChange(item, item.role === 'host' ? 'moderator' : 'host')}
            >
              <Shield size={15} color={COLORS.textPrimary} />
              <Text style={styles.actionMenuText}>
                {item.role === 'host' ? 'Make Moderator' : 'Make Host'}
              </Text>
            </TouchableOpacity>
            <View style={styles.actionMenuDivider} />
            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => handleTransferOwnership(item)}
            >
              <Crown size={15} color='#F59E0B' />
              <Text style={[styles.actionMenuText, { color: '#F59E0B' }]}>Transfer Ownership</Text>
            </TouchableOpacity>
            <View style={styles.actionMenuDivider} />
            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => handleRemove(item)}
            >
              <Trash2 size={15} color={COLORS.error} />
              <Text style={[styles.actionMenuText, { color: COLORS.error }]}>Remove from Hosts</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }, [actionMenuHost, isOwner, handleRoleChange, handleTransferOwnership, handleRemove]);

  // ── Render invite panel (inside modal) ────────────────────────────────────
  const renderInvitePanel = () => (
    <Modal
      visible={showInvitePanel}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowInvitePanel(false)}
    >
      <SafeAreaView style={styles.inviteSheet} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Sheet header */}
          <View style={styles.inviteHeader}>
            <Text style={styles.inviteTitle}>Add a Host</Text>
            <TouchableOpacity
              onPress={() => {
                setShowInvitePanel(false);
                setInviteQuery('');
                setSearchResults([]);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Role selector */}
          <View style={styles.roleSelectorRow}>
            {['host', 'moderator'].map(r => {
              const cfg = ROLE_CONFIG[r];
              const RoleIcon = cfg.icon;
              const selected = inviteRole === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleOption, selected && { borderColor: cfg.color, backgroundColor: cfg.color + '12' }]}
                  onPress={() => { setInviteRole(r); HapticsService.triggerSelection(); }}
                  activeOpacity={0.75}
                >
                  <RoleIcon size={14} color={selected ? cfg.color : COLORS.textSecondary} />
                  <Text style={[styles.roleOptionText, selected && { color: cfg.color, fontFamily: FONTS.semiBold }]}>
                    {cfg.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Search input */}
          <TextInput
            style={styles.searchInput}
            placeholder="Search members by name or username"
            placeholderTextColor={COLORS.textSecondary}
            value={inviteQuery}
            onChangeText={setInviteQuery}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />

          {/* Results */}
          {inviteQuery.trim().length < 2 ? (
            <Text style={styles.hint}>Type 2+ characters to search</Text>
          ) : searchLoading ? (
            <View style={styles.loaderWrap}><SnooLoader size="small" color={COLORS.primary} /></View>
          ) : searchResults.length === 0 ? (
            <Text style={styles.hint}>{searchError || 'No members found'}</Text>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={m => String(m.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchResultRow}
                  onPress={() => handleInvite(item)}
                  disabled={submitting}
                  activeOpacity={0.7}
                >
                  {item.profile_photo_url ? (
                    <Image source={{ uri: item.profile_photo_url }} style={styles.searchAvatar} />
                  ) : (
                    <View style={[styles.searchAvatar, styles.searchAvatarPlaceholder]}>
                      <User size={16} color={COLORS.textSecondary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchName} numberOfLines={1}>
                      {item.full_name || item.name || 'Member'}
                    </Text>
                    <Text style={styles.searchUsername} numberOfLines={1}>@{item.username}</Text>
                  </View>
                  <ChevronRight size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {communityLogo && (
            <Image source={{ uri: communityLogo }} style={styles.headerLogo} />
          )}
          <View>
            <Text style={styles.headerTitle}>{communityName}</Text>
            <Text style={styles.headerSubtitle}>Host Management</Text>
          </View>
        </View>
        {isOwner && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              setShowInvitePanel(true);
              HapticsService.triggerSelection();
            }}
          >
            <UserPlus size={20} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Host list */}
      {loading ? (
        <View style={styles.loaderWrap}>
          <SnooLoader size="medium" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={hosts}
          keyExtractor={h => `${h.community_id}_${h.user_id}`}
          renderItem={renderHostRow}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Building2 size={42} color={COLORS.textSecondary} />
              <Text style={styles.emptyTitle}>No hosts yet</Text>
              {isOwner && (
                <Text style={styles.emptySubtitle}>
                  Tap the + button to invite your first host.
                </Text>
              )}
            </View>
          }
          ListHeaderComponent={
            hosts.length > 0 ? (
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderText}>
                  {hosts.length} {hosts.length === 1 ? 'Host' : 'Hosts'}
                </Text>
                {isOwner && (
                  <Text style={styles.ownerNote}>
                    Tap ··· to manage roles or remove hosts.
                  </Text>
                )}
              </View>
            ) : null
          }
        />
      )}

      {/* Role legend */}
      {!loading && hosts.length > 0 && (
        <View style={[styles.legend, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={styles.legendTitle}>Roles</Text>
          <View style={styles.legendItems}>
            {Object.entries(ROLE_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <View key={key} style={styles.legendItem}>
                  <Icon size={12} color={cfg.color} />
                  <Text style={[styles.legendItemText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.legendNote}>
            Owners can invite and remove hosts. Hosts can manage events and content.
          </Text>
        </View>
      )}

      {renderInvitePanel()}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 8,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  addBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  listHeader: {
    marginBottom: 12,
  },
  listHeaderText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.textSecondary,
  },
  ownerNote: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    flexWrap: 'wrap',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E5EA',
    marginRight: 12,
  },
  hostMeta: {
    flex: 1,
    marginRight: 8,
  },
  hostName: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
  },
  hostUsername: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    marginRight: 4,
  },
  rolePillText: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
  },
  moreBtn: {
    padding: 4,
  },
  actionMenu: {
    width: '100%',
    marginTop: 10,
    backgroundColor: '#F5F5F7',
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  actionMenuText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textPrimary,
  },
  actionMenuDivider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginHorizontal: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  legend: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  legendTitle: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  legendItems: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendItemText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
  },
  legendNote: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },

  // ── Invite sheet ─────────────────────────────────────────────────────────
  inviteSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  inviteTitle: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  roleSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
  },
  roleOptionText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
  },
  searchInput: {
    margin: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F5F5F7',
    borderRadius: 12,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.textPrimary,
  },
  hint: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    paddingHorizontal: 24,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 12,
  },
  searchAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E5EA',
  },
  searchAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchName: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
  },
  searchUsername: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F5',
    marginLeft: 72,
  },
});
