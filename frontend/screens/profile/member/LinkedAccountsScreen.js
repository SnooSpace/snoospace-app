import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  TextInput,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Instagram, ExternalLink, Check, X, Trash2 } from 'lucide-react-native';
import HapticsService from '../../../services/HapticsService';
import { COLORS, FONTS, SHADOWS, BORDER_RADIUS } from '../../../constants/theme';
import {
  normaliseInstagramInput,
  validateInstagramUsername,
  buildInstagramUrl,
} from '../../../utils/instagramUtils';
import { apiPatch } from '../../../api/client';
import { getAuthToken } from '../../../api/auth';
import EventBus from '../../../utils/EventBus';
import DynamicStatusBar from '../../../components/DynamicStatusBar';

/**
 * LinkedAccountsScreen
 *
 * Full inline Instagram linking — no redirect to Edit Profile.
 * Handles link, update, and remove all within this screen.
 *
 * route.params:
 *   - instagramUsername: string | null  (current value from profile)
 */
export default function LinkedAccountsScreen({ route, navigation }) {
  const { instagramUsername: initialUsername } = route?.params || {};

  // Local mutable copy of the linked username
  const [linked, setLinked] = useState(initialUsername || null);

  // Input state (shown when editing)
  const [editing, setEditing] = useState(!initialUsername); // auto-open input if nothing linked
  const [inputValue, setInputValue] = useState(
    initialUsername ? `@${initialUsername}` : ''
  );
  const [inputError, setInputError] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  // ─── Open Instagram ───────────────────────────────────────────────────────
  const handleOpenInstagram = useCallback(async () => {
    if (!linked) return;
    HapticsService.triggerImpactLight();
    const url = buildInstagramUrl(linked);
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Open Instagram', `Visit instagram.com/${linked}`);
      }
    } catch {
      Alert.alert('Error', `Could not open https://www.instagram.com/${linked}`);
    }
  }, [linked]);

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    Keyboard.dismiss();
    HapticsService.triggerImpactLight();
    setInputError('');

    let cleanUsername = null;
    if (inputValue.trim()) {
      try {
        cleanUsername = normaliseInstagramInput(inputValue);
        if (cleanUsername) {
          const { valid, error: igErr } = validateInstagramUsername(cleanUsername);
          if (!valid) {
            setInputError(igErr);
            return;
          }
        }
      } catch (err) {
        setInputError(err.message);
        return;
      }
    }

    try {
      setSaving(true);
      const token = await getAuthToken();
      await apiPatch('/members/profile', { instagram_username: cleanUsername }, 15000, token);
      HapticsService.triggerNotificationSuccess();
      setLinked(cleanUsername);
      setEditing(false);
      if (!cleanUsername) setInputValue('');
      // Notify SettingsScreen (and any other listeners) of the change
      EventBus.emit('instagram:updated', { username: cleanUsername });
    } catch (err) {
      console.error('[LinkedAccountsScreen] save error:', err);
      Alert.alert('Error', 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [inputValue]);

  // ─── Remove ───────────────────────────────────────────────────────────────
  const handleRemove = useCallback(() => {
    HapticsService.triggerImpactLight();
    Alert.alert(
      'Remove Instagram',
      'This will remove @' + linked + ' from your profile.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              const token = await getAuthToken();
              await apiPatch('/members/profile', { instagram_username: null }, 15000, token);
              HapticsService.triggerNotificationSuccess();
              setLinked(null);
              setInputValue('');
              setEditing(true);
              // Notify SettingsScreen of the removal
              EventBus.emit('instagram:updated', { username: null });
            } catch (err) {
              console.error('[LinkedAccountsScreen] remove error:', err);
              Alert.alert('Error', 'Could not remove Instagram. Please try again.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  }, [linked]);

  // ─── Cancel edit ─────────────────────────────────────────────────────────
  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    setInputError('');
    // Restore input to current linked value
    setInputValue(linked ? `@${linked}` : '');
  }, [linked]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <DynamicStatusBar style="dark" />
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#FFFFFF' }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <ArrowLeft size={24} color={COLORS.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Linked Accounts</Text>
          <View style={styles.headerRight} />
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Section label */}
          <Text style={styles.sectionLabel}>SOCIAL PROFILES</Text>

          {/* Instagram card */}
          <View style={styles.card}>
            {/* Icon row */}
            <View style={styles.cardRow}>
              <View style={styles.iconCircle}>
                <Instagram size={22} color="#EC4899" strokeWidth={1.8} />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>Instagram</Text>
                {linked ? (
                  <Text style={styles.cardSub} numberOfLines={1}>
                    @{linked}
                  </Text>
                ) : (
                  <Text style={[styles.cardSub, styles.cardSubMuted]}>Not linked</Text>
                )}
              </View>
              {/* Status badge */}
              {linked ? (
                <View style={styles.linkedBadge}>
                  <Text style={styles.linkedBadgeText}>Linked</Text>
                </View>
              ) : (
                <View style={styles.notLinkedBadge}>
                  <Text style={styles.notLinkedBadgeText}>Not linked</Text>
                </View>
              )}
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* — EDITING STATE — Input + Save/Cancel */}
            {editing ? (
              <View style={styles.editBlock}>
                <View style={[styles.inputRow, inputError ? styles.inputRowError : null]}>
                  <Instagram size={15} color={inputError ? COLORS.error : COLORS.textSecondary} strokeWidth={2} />
                  <TextInput
                    ref={inputRef}
                    style={styles.textInput}
                    value={inputValue}
                    onChangeText={(val) => {
                      setInputValue(val);
                      setInputError('');
                    }}
                    placeholder="@username or paste URL"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
                    autoFocus={!linked} // auto-focus only when nothing was linked yet
                  />
                </View>

                {inputError ? (
                  <Text style={styles.errorText}>{inputError}</Text>
                ) : (
                  <Text style={styles.helperText}>
                    Paste your profile URL or enter your @username
                  </Text>
                )}

                <View style={styles.editActions}>
                  {/* Cancel — only show if already had a linked account */}
                  {linked ? (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={handleCancelEdit}
                      activeOpacity={0.75}
                      disabled={saving}
                    >
                      <X size={15} color={COLORS.textSecondary} strokeWidth={2} />
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  ) : null}

                  {/* Save */}
                  <TouchableOpacity
                    style={[styles.saveBtn, saving && styles.saveBtnDisabled, !linked && { flex: 1 }]}
                    onPress={handleSave}
                    activeOpacity={0.75}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Check size={15} color="#FFFFFF" strokeWidth={2.5} />
                        <Text style={styles.saveBtnText}>Save</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* — LINKED STATE — View + Change + Remove actions */
              <View style={styles.actionsRow}>
                {/* View on Instagram */}
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={handleOpenInstagram}
                  activeOpacity={0.75}
                >
                  <ExternalLink size={15} color={COLORS.primary} strokeWidth={2} />
                  <Text style={styles.actionBtnText}>View Profile</Text>
                </TouchableOpacity>

                {/* Change */}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnSecondary]}
                  onPress={() => {
                    HapticsService.triggerImpactLight();
                    setInputValue(linked ? `@${linked}` : '');
                    setInputError('');
                    setEditing(true);
                    setTimeout(() => inputRef.current?.focus(), 100);
                  }}
                  activeOpacity={0.75}
                  disabled={saving}
                >
                  <Instagram size={15} color={COLORS.textSecondary} strokeWidth={2} />
                  <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>
                    Change
                  </Text>
                </TouchableOpacity>

                {/* Remove */}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnDanger]}
                  onPress={handleRemove}
                  activeOpacity={0.75}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={COLORS.error} />
                  ) : (
                    <Trash2 size={15} color={COLORS.error} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Explainer */}
          <Text style={styles.explainer}>
            Linking your Instagram shows a trust signal on your profile so other
            members know you're a real person. SnooSpace never posts on your behalf
            and does not require Instagram login.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    backgroundColor: '#FFFFFF',
    minHeight: 56,
  },
  backBtn: { padding: 12 },
  headerTitle: {
    fontFamily: FONTS.primary,
    fontSize: 17,
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },
  headerRight: { width: 48 },

  // Content
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },

  sectionLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginLeft: 4,
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.xl,
    padding: 18,
    ...SHADOWS.sm,
    shadowOpacity: 0.05,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    marginBottom: 16,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(244, 114, 182, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardInfo: { flex: 1, gap: 3 },
  cardTitle: {
    fontFamily: FONTS.primary,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  cardSub: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  cardSubMuted: { color: COLORS.textMuted },

  // Badges
  linkedBadge: {
    backgroundColor: 'rgba(236, 72, 153, 0.10)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.pill,
  },
  linkedBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: '#EC4899',
  },
  notLinkedBadge: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.pill,
  },
  notLinkedBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textMuted,
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginBottom: 14,
  },

  // Input / edit block
  editBlock: {
    gap: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: BORDER_RADIUS.m,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  inputRowError: {
    borderColor: COLORS.error,
    backgroundColor: 'rgba(229,62,62,0.04)',
  },
  textInput: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textPrimary,
    padding: 0,
  },
  helperText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 2,
  },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.error,
    marginLeft: 2,
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingVertical: 11,
    borderRadius: BORDER_RADIUS.m,
  },
  cancelBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EC4899',
    paddingVertical: 11,
    borderRadius: BORDER_RADIUS.m,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },

  // Linked state actions
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(41, 98, 255, 0.08)',
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.m,
  },
  actionBtnSecondary: {
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  actionBtnDanger: {
    flex: 0,
    width: 42,
    backgroundColor: 'rgba(229,62,62,0.07)',
  },
  actionBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.primary,
  },
  actionBtnTextSecondary: {
    color: COLORS.textSecondary,
  },

  // Explainer
  explainer: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    marginHorizontal: 4,
    marginBottom: 12,
  },
  comingSoon: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textMuted,
    marginHorizontal: 4,
    textAlign: 'center',
  },
});
