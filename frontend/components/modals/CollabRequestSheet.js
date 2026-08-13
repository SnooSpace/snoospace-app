/**
 * CollabRequestSheet.js
 *
 * Reusable bottom-sheet for sending a Collab Request to any eligible entity.
 * Wraps SwipeableModal and provides:
 *   - Collab-type chip selector (event_partnership, cross_promo, guest_collab, custom)
 *   - Pitch text input (required, ≤ 300 chars)
 *   - Send button → calls createCollabRequest, reports errors via CustomAlertModal
 *
 * Usage:
 *   <CollabRequestSheet
 *     visible={sheetVisible}
 *     onClose={() => setSheetVisible(false)}
 *     receiverId={memberId}
 *     receiverType="member"           // "member" | "community"
 *     receiverName="John Doe"
 *     hasExistingConversation={true}  // changes label Send → Propose a Collab
 *     onSuccess={(request) => { ... }} // called on successful submit
 *   />
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Send, Handshake, TriangleAlert } from 'lucide-react-native';
import SwipeableModal from './SwipeableModal';
import CustomAlertModal from '../ui/CustomAlertModal';
import { COLORS, FONTS, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { createCollabRequest, COLLAB_TYPES } from '../../api/collabRequests';
import HapticsService from '../../services/HapticsService';

const PITCH_MAX_LEN = 300;

// ─── Collab-type chip data (subset of COLLAB_TYPES — excludes 'sponsorship') ──
const CHIP_OPTIONS = COLLAB_TYPES; // already filters sponsorship in collabRequests.js

export default function CollabRequestSheet({
  visible,
  onClose,
  receiverId,
  receiverType = 'member',
  receiverName,
  hasExistingConversation = false,
  onSuccess,
}) {
  const [selectedType, setSelectedType] = useState(null);
  const [pitchText, setPitchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ visible: false });
  const inputRef = useRef(null);

  const charsLeft = PITCH_MAX_LEN - pitchText.length;
  const canSend = selectedType && pitchText.trim().length > 0 && !loading;

  const resetState = useCallback(() => {
    setSelectedType(null);
    setPitchText('');
    setLoading(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const showAlert = useCallback((config) => {
    setAlertConfig({ ...config, visible: true });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    HapticsService.triggerMessageSend();
    setLoading(true);
    try {
      const result = await createCollabRequest({
        receiver_id: receiverId,
        receiver_type: receiverType,
        collab_type: selectedType,
        pitch_text: pitchText.trim(),
      });
      // Success
      HapticsService.triggerAddToCircle();
      resetState();
      onClose();
      onSuccess?.(result?.request);
    } catch (err) {
      const msg = err?.message || err?.data?.error || 'Failed to send request. Please try again.';
      showAlert({
        title: 'Could not send',
        message: msg,
        icon: TriangleAlert,
        iconColor: '#E53935',
        primaryAction: { text: 'OK', onPress: hideAlert },
      });
    } finally {
      setLoading(false);
    }
  }, [canSend, receiverId, receiverType, selectedType, pitchText, resetState, onClose, onSuccess, showAlert, hideAlert]);

  const headerContent = (
    <View style={styles.handle}>
      <View style={styles.pill} />
    </View>
  );

  return (
    <>
      <SwipeableModal
        visible={visible}
        onClose={handleClose}
        avoidKeyboard
        header={headerContent}
        sheetStyle={styles.sheet}
        springConfig={{ damping: 24, stiffness: 200, mass: 1 }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.titleRow}>
              <View style={styles.iconCircle}>
                <Handshake size={20} color={COLORS.primary} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>
                  {hasExistingConversation ? 'Propose a Collab' : 'Send Collab Request'}
                </Text>
                {receiverName ? (
                  <Text style={styles.subtitle} numberOfLines={1}>
                    to <Text style={styles.subtitleName}>{receiverName}</Text>
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Collab-type chips */}
            <Text style={styles.sectionLabel}>What kind of collab?</Text>
            <View style={styles.chipsRow}>
              {CHIP_OPTIONS.map((opt) => {
                const active = selectedType === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    activeOpacity={0.75}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => {
                      HapticsService.triggerImpactLight();
                      setSelectedType(active ? null : opt.value);
                    }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Pitch input */}
            <Text style={styles.sectionLabel}>Your pitch</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Tell them what you have in mind — why this collab makes sense…"
                placeholderTextColor={COLORS.textMuted}
                multiline
                maxLength={PITCH_MAX_LEN}
                value={pitchText}
                onChangeText={setPitchText}
                returnKeyType="default"
                textAlignVertical="top"
              />
              <Text style={[styles.charCount, charsLeft <= 30 && { color: charsLeft <= 10 ? '#E53935' : '#FF9500' }]}>
                {charsLeft}
              </Text>
            </View>

            {/* Send button */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              disabled={!canSend}
              onPress={handleSend}
            >
              {loading ? (
                <Text style={styles.sendBtnText}>Sending…</Text>
              ) : (
                <>
                  <Send size={16} color="#fff" strokeWidth={2.2} style={{ marginRight: 8 }} />
                  <Text style={styles.sendBtnText}>
                    {hasExistingConversation ? 'Propose Collab' : 'Send Request'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.hint}>
              Pitch text is required — they'll see exactly what you write here.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SwipeableModal>

      {/* Error alert */}
      <CustomAlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        icon={alertConfig.icon}
        iconColor={alertConfig.iconColor}
        primaryAction={alertConfig.primaryAction}
        onClose={hideAlert}
        showClose={false}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...SHADOWS.large,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  handle: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  pill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },

  // Header row
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(41, 98, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 18,
    color: '#111827',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  subtitleName: {
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
  },

  // Section labels
  sectionLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // Chips
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.pill,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: {
    backgroundColor: 'rgba(41, 98, 255, 0.1)',
    borderColor: COLORS.primary,
  },
  chipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  chipTextActive: {
    color: COLORS.primary,
  },

  // Pitch input
  inputWrapper: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: BORDER_RADIUS.l,
    backgroundColor: '#FAFAFA',
    padding: 14,
    marginBottom: 20,
    minHeight: 120,
  },
  input: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 22,
    minHeight: 90,
  },
  charCount: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: 6,
  },

  // Send button
  sendBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    ...SHADOWS.primaryGlow,
  },
  sendBtnDisabled: {
    backgroundColor: '#E5E7EB',
    ...SHADOWS.sm,
  },
  sendBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#fff',
  },

  // Hint
  hint: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
  },
});
