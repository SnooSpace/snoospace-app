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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import SwipeableModal from '../../../components/modals/SwipeableModal';
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
import { COLORS, FONTS, SHADOWS } from '../../../constants/theme';
import {
  getCommunityHosts,
  inviteCommunityHost,
  removeCommunityHost,
  updateCommunityHostRole,
  transferCommunityOwnership,
} from '../../../api/communities';
import { apiGet } from '../../../api/client';
import { getAuthToken } from '../../../api/auth';
import SnooLoader from '../../../components/ui/SnooLoader';
import HapticsService from '../../../services/HapticsService';

// ─── Role config ──────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  owner:     { label: 'Owner',     icon: Crown,     color: '#F59E0B', canEdit: false },
  host:      { label: 'Host',      icon: Building2, color: COLORS.primary, canEdit: true },
  moderator: { label: 'Moderator', icon: Shield,    color: '#9333EA', canEdit: true },
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
  const [modalLoading, setModalLoading] = useState(false);
  const searchTimer = useRef(null);

  // Custom alert / confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    title: '',
    message: '',
    btnLabel: '',
    isDestructive: false,
    onConfirm: null,
  });

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
  const handleRemove = useCallback((host) => {
    setActionMenuHost(null);
    setConfirmModal({
      visible: true,
      title: 'Remove Host',
      message: `Remove ${host.name || host.username} from this community's hosts?`,
      btnLabel: 'REMOVE',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await removeCommunityHost(communityId, host.user_id);
          HapticsService.triggerImpactMedium();
          await loadHosts();
        } catch (err) {
          Alert.alert('Error', err?.message || 'Failed to remove host');
        }
      },
    });
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
  const handleTransferOwnership = useCallback((host) => {
    setActionMenuHost(null);
    setConfirmModal({
      visible: true,
      title: 'Transfer Ownership',
      message: `Transfer ownership of this community to ${host.name || host.username}? You will become a Host.`,
      btnLabel: 'TRANSFER',
      isDestructive: true,
      onConfirm: async () => {
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
    });
  }, [communityId, navigation, loadHosts]);

  // ── Render host row ───────────────────────────────────────────────────────
  const renderHostRow = useCallback(({ item }) => {
    const cfg = ROLE_CONFIG[item.role] || ROLE_CONFIG.host;
    const RoleIcon = cfg.icon;
    const isMenuOpen = actionMenuHost?.user_id === item.user_id;
    const canManage = isOwner && item.role !== 'owner';

    return (
      <View style={styles.hostRowContainer}>
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
                setActionMenuHost(item);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MoreHorizontal size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }, [actionMenuHost, isOwner]);

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
                  <Text style={[styles.roleOptionText, selected && { color: cfg.color }]}>
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

  // ── Render action menu modal (bottom sheet) ───────────────────────────────
  const renderActionMenuModal = () => {
    if (!actionMenuHost) return null;
    const cfg = ROLE_CONFIG[actionMenuHost.role] || ROLE_CONFIG.host;
    const isMod = actionMenuHost.role === 'moderator';

    return (
      <SwipeableModal
        visible={!!actionMenuHost}
        onClose={() => setActionMenuHost(null)}
        sheetStyle={styles.sheetContent}
        header={
          <View style={styles.sheetHeaderWrapper}>
            <View style={styles.sheetHandle} />
          </View>
        }
      >
        <View style={{ paddingBottom: insets.bottom + 20 }}>
          {/* Header info */}
          <View style={styles.sheetHeaderInfo}>
            <Image
              source={{ uri: actionMenuHost.avatar_url || 'https://via.placeholder.com/50' }}
              style={styles.sheetHeaderAvatar}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetHeaderTitle}>{actionMenuHost.name || actionMenuHost.username}</Text>
              <Text style={styles.sheetHeaderSubtitle}>@{actionMenuHost.username} • {cfg.label}</Text>
            </View>
          </View>

          {/* Menu Options */}
          <View style={styles.sheetMenu}>
            <TouchableOpacity
              style={styles.sheetMenuItem}
              onPress={() => handleRoleChange(actionMenuHost, isMod ? 'host' : 'moderator')}
            >
              <View style={[styles.sheetMenuIconWrap, { backgroundColor: COLORS.primary + '12' }]}>
                <Shield size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.sheetMenuText}>
                {isMod ? 'Make Host' : 'Make Moderator'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetMenuItem}
              onPress={() => handleTransferOwnership(actionMenuHost)}
            >
              <View style={[styles.sheetMenuIconWrap, { backgroundColor: '#F59E0B' + '12' }]}>
                <Crown size={18} color='#F59E0B' />
              </View>
              <Text style={[styles.sheetMenuText, { color: '#F59E0B' }]}>
                Transfer Ownership
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetMenuItem}
              onPress={() => handleRemove(actionMenuHost)}
            >
              <View style={[styles.sheetMenuIconWrap, { backgroundColor: COLORS.error + '12' }]}>
                <Trash2 size={18} color={COLORS.error} />
              </View>
              <Text style={[styles.sheetMenuText, { color: COLORS.error }]}>
                Remove from Hosts
              </Text>
            </TouchableOpacity>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.sheetCancelBtn}
            onPress={() => setActionMenuHost(null)}
          >
            <Text style={styles.sheetCancelBtnText}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </SwipeableModal>
    );
  };

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
          style={styles.list}
          ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
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

      {renderActionMenuModal()}

      {/* Custom Confirmation Modal */}
      <Modal
        visible={confirmModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
        statusBarTranslucent
      >
        <Pressable
          style={styles.alertOverlay}
          onPress={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
        >
          <Pressable style={styles.alertContainer} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.confirmTitle}>{confirmModal.title}</Text>
            <Text style={styles.confirmMessage}>{confirmModal.message}</Text>
            <View style={styles.alertActionsRow}>
              <TouchableOpacity
                style={styles.alertBtnCancel}
                onPress={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
              >
                <Text style={styles.alertBtnTextCancel}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  confirmModal.isDestructive ? styles.alertBtnDestructive : styles.alertBtnPrimary,
                  modalLoading && { opacity: 0.6 }
                ]}
                disabled={modalLoading}
                onPress={async () => {
                  if (confirmModal.onConfirm) {
                    setModalLoading(true);
                    await confirmModal.onConfirm();
                    setModalLoading(false);
                  }
                  setConfirmModal(prev => ({ ...prev, visible: false }));
                }}
              >
                {modalLoading ? (
                  <SnooLoader size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmBtnText}>{confirmModal.btnLabel}</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Updated white background to go all the way up
  },
  list: {
    flex: 1,
    backgroundColor: '#FAFAFA', // clean light background for the scroll area
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    // Removed bottom separation line
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
    fontFamily: FONTS.black, // Used BasicCommercialBlack once for screen title
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11,
    fontFamily: FONTS.regular, // Manrope-Regular
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
    fontFamily: FONTS.primary, // BasicCommercialBold for section titles
    color: COLORS.textSecondary,
  },
  ownerNote: {
    fontSize: 12,
    fontFamily: FONTS.regular, // Manrope-Regular
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  hostRowContainer: {
    width: '100%',
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent', // Removed card styling (shadows, borders, bg)
    paddingVertical: 12,
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
    fontFamily: FONTS.semiBold, // Manrope-SemiBold
    color: COLORS.textPrimary,
  },
  hostUsername: {
    fontSize: 12,
    fontFamily: FONTS.regular, // Manrope-Regular
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
    fontFamily: FONTS.semiBold, // Manrope-SemiBold
  },
  moreBtn: {
    padding: 4,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetHeaderWrapper: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingTop: 14,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetHandle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E5E5EA',
    alignSelf: 'center',
    marginBottom: 10,
  },
  sheetHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  sheetHeaderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E5EA',
  },
  sheetHeaderTitle: {
    fontSize: 16,
    fontFamily: FONTS.semiBold, // Manrope-SemiBold
    color: COLORS.textPrimary,
  },
  sheetHeaderSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular, // Manrope-Regular
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sheetMenu: {
    gap: 8,
    marginBottom: 16,
  },
  sheetMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  sheetMenuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetMenuText: {
    fontSize: 15,
    fontFamily: FONTS.semiBold, // Manrope-SemiBold for interactive menu options
    color: COLORS.textPrimary,
  },
  sheetCancelBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  sheetCancelBtnText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold, // Manrope-SemiBold for cancel button
    color: '#475569',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: FONTS.primary, // BasicCommercialBold
    color: COLORS.textPrimary,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular, // Manrope-Regular
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  legend: {
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  legendTitle: {
    fontSize: 11,
    fontFamily: FONTS.primary, // BasicCommercialBold
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
    fontFamily: FONTS.medium, // Manrope-Medium
  },
  legendNote: {
    fontSize: 11,
    fontFamily: FONTS.regular, // Manrope-Regular
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
    fontFamily: FONTS.primary, // BasicCommercialBold
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
    fontFamily: FONTS.semiBold, // Manrope-SemiBold for interactive role selector
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
    fontFamily: FONTS.regular, // Manrope-Regular
    color: COLORS.textPrimary,
  },
  hint: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
    fontFamily: FONTS.regular, // Manrope-Regular
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
    fontFamily: FONTS.semiBold, // Manrope-SemiBold
    color: COLORS.textPrimary,
  },
  searchUsername: {
    fontSize: 12,
    fontFamily: FONTS.regular, // Manrope-Regular
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F5',
    marginLeft: 72,
  },
  listSeparator: {
    height: 1,
    backgroundColor: '#F0F0F5',
    marginLeft: 56, // aligned with text start (avatar is 44 + margin 12)
  },

  // ── Custom Alert Modal Styles ─────────────────────────────────────────────
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContainer: {
    width: '85%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  confirmTitle: {
    fontSize: 18,
    fontFamily: FONTS.primary, // BasicCommercialBold
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  confirmMessage: {
    fontSize: 14,
    fontFamily: FONTS.regular, // Manrope-Regular
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  alertActionsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  alertBtnCancel: {
    flex: 1,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  alertBtnTextCancel: {
    fontSize: 14,
    color: '#475569',
    fontFamily: FONTS.semiBold, // Manrope-SemiBold for interactive button
  },
  alertBtnPrimary: {
    flex: 1,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  alertBtnDestructive: {
    flex: 1,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.error,
  },
  confirmBtnText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: FONTS.semiBold, // Manrope-SemiBold for interactive button
  },
});
