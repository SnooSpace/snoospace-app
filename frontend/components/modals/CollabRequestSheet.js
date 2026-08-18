/**
 * CollabRequestSheet.js
 *
 * Reusable bottom-sheet for sending a Collab Request to any eligible entity.
 * Wraps SwipeableModal and provides:
 *   - Collab-type chip selector (event_partnership, cross_promo, guest_collab, custom)
 *   - Pitch text input (required by default, configurable via `pitchRequired`)
 *   - Character limit configurable via `maxLength` (default 300, Board uses 150)
 *   - Send button calls createCollabRequest, reports errors via CustomAlertModal
 *
 * Usage:
 *   <CollabRequestSheet
 *     visible={sheetVisible}
 *     onClose={() => setSheetVisible(false)}
 *     receiverId={memberId}
 *     receiverType="member"
 *     receiverName="John Doe"
 *     hasExistingConversation={true}
 *     pitchRequired={true}
 *     maxLength={300}
 *     onSuccess={(request) => { ... }}
 *   />
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Dimensions,
  Keyboard,
} from 'react-native';
import { Handshake, TriangleAlert } from 'lucide-react-native';
import SwipeableModal from './SwipeableModal';
import CustomAlertModal from '../ui/CustomAlertModal';
import { COLORS, FONTS, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { createCollabRequest, COLLAB_TYPES } from '../../api/collabRequests';
import HapticsService from '../../services/HapticsService';

// Collab identity palette (teal -- distinct from purple Creator / blue primary)
const TEAL = '#0D9488';
const TEAL_BG = 'rgba(13, 148, 136, 0.09)';
const TEAL_BORDER = 'rgba(13, 148, 136, 0.3)';

// Collab-type chip data (subset of COLLAB_TYPES -- excludes 'sponsorship')
const CHIP_OPTIONS = COLLAB_TYPES;

export default function CollabRequestSheet({
  visible,
  onClose,
  receiverId,
  receiverType = 'member',
  receiverName,
  hasExistingConversation = false,
  pitchRequired = true,
  maxLength = 300,
  showTypeChips = true,
  title: customTitle,
  buttonLabel: customButtonLabel,
  placeholder: customPlaceholder,
  sectionLabel: customSectionLabel,
  onSubmit,
  onSuccess,
}) {
  const [selectedType, setSelectedType] = useState(null);
  const [customType, setCustomType] = useState('');
  const [pitchText, setPitchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [alertConfig, setAlertConfig] = useState({ visible: false });
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const charsLeft = maxLength - pitchText.length;
  const pitchOk = pitchRequired ? pitchText.trim().length > 0 : true;
  const typeOk = showTypeChips ? !!selectedType : true;
  const customTypeOk = (showTypeChips && selectedType === 'custom') ? customType.trim().length > 0 : true;
  const canSend = typeOk && customTypeOk && pitchOk && !loading;

  const resetState = useCallback(() => {
    setSelectedType(null);
    setCustomType('');
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
      const finalPitch = (selectedType === 'custom' && customType.trim())
        ? (pitchText.trim() ? `[${customType.trim()}] ${pitchText.trim()}` : `[${customType.trim()}]`)
        : (pitchText.trim() || null);

      const payload = {
        receiver_id: receiverId,
        receiver_type: receiverType,
        collab_type: selectedType,
        custom_type: selectedType === 'custom' ? customType.trim() : null,
        pitch_text: finalPitch,
        note: finalPitch,
      };

      const submitFn = onSubmit || createCollabRequest;
      const result = await submitFn(payload);

      HapticsService.triggerAddToCircle();
      resetState();
      onClose();
      onSuccess?.(result?.request || result);
    } catch (err) {
      const msg = err?.message || err?.data?.error || err?.error || 'Failed to send request. Please try again.';
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
  }, [canSend, receiverId, receiverType, selectedType, customType, pitchText, onSubmit, resetState, onClose, onSuccess, showAlert, hideAlert]);

  const headerContent = (
    <View style={styles.handle}>
      <View style={styles.pill} />
    </View>
  );

  const sheetTitle = customTitle || (hasExistingConversation ? 'Propose a Collab' : 'Send Collab Request');
  const btnLabel = customButtonLabel || (hasExistingConversation ? 'Propose Collab' : 'Send Request');
  const inputPlaceholder = customPlaceholder || (pitchRequired
    ? 'Tell them what you have in mind — why this collab makes sense…'
    : 'Add an optional note to your join request…');
  const inputSectionLabel = customSectionLabel || (pitchRequired ? 'Your pitch' : 'Your note (optional)');

  return (
    <>
      <SwipeableModal
        visible={visible}
        onClose={handleClose}
        header={headerContent}
        sheetStyle={styles.sheet}
        springConfig={{ damping: 24, stiffness: 200, mass: 1 }}
      >
        <SwipeableModal.ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 30 : (Platform.OS === 'ios' ? 34 : 24) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleRow}>
            <View style={styles.iconCircle}>
              <Handshake size={20} color={TEAL} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {sheetTitle}
              </Text>
              {receiverName ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  to <Text style={styles.subtitleName}>{receiverName}</Text>
                </Text>
              ) : null}
            </View>
          </View>

            {showTypeChips && (
              <>
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

                {selectedType === 'custom' && (
                  <View style={styles.customTypeSection}>
                    <Text style={styles.sectionLabel}>Specify Custom Collab</Text>
                    <View style={styles.customInputWrapper}>
                      <TextInput
                        style={styles.customInput}
                        placeholder="e.g. Podcast Guest, Photo Swap, Workshop…"
                        placeholderTextColor={COLORS.textMuted}
                        maxLength={50}
                        value={customType}
                        onChangeText={setCustomType}
                        onFocus={() => {
                          setTimeout(() => {
                            scrollRef.current?.scrollTo({ y: 120, animated: true });
                          }, 100);
                        }}
                        returnKeyType="next"
                      />
                      <Text style={[
                        styles.charCountSmall,
                        50 - customType.length <= 10 && { color: '#E53935' },
                      ]}>
                        {50 - customType.length}
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}

            <Text style={styles.sectionLabel}>
              {inputSectionLabel}
            </Text>
            <View style={styles.inputWrapper}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder={inputPlaceholder}
                placeholderTextColor={COLORS.textMuted}
                multiline
                maxLength={maxLength}
                value={pitchText}
                onChangeText={setPitchText}
                onFocus={() => {
                  setTimeout(() => {
                    scrollRef.current?.scrollToEnd({ animated: true });
                  }, 120);
                }}
                returnKeyType="default"
                textAlignVertical="top"
              />
              <Text style={[
                styles.charCount,
                charsLeft <= 30 && { color: charsLeft <= 10 ? '#E53935' : '#FF9500' },
              ]}>
                {charsLeft}
              </Text>
            </View>

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
                  <Handshake size={16} color="#fff" strokeWidth={2.2} style={{ marginRight: 8 }} />
                  <Text style={styles.sendBtnText}>
                    {btnLabel}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {pitchRequired && (
              <Text style={styles.hint}>
                Pitch text is required — they will see exactly what you write here.
              </Text>
            )}
          </SwipeableModal.ScrollView>
      </SwipeableModal>

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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SCREEN_HEIGHT * 0.90,
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
    backgroundColor: TEAL_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: FONTS.primary,
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
  sectionLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
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
    backgroundColor: TEAL_BG,
    borderColor: TEAL,
  },
  chipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  chipTextActive: {
    color: TEAL,
  },
  customTypeSection: {
    marginBottom: 20,
  },
  customInputWrapper: {
    borderWidth: 1.5,
    borderColor: TEAL,
    borderRadius: BORDER_RADIUS.l,
    backgroundColor: TEAL_BG,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  customInput: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textPrimary,
    paddingVertical: 2,
  },
  charCountSmall: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textMuted,
    marginLeft: 8,
  },
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
  sendBtn: {
    backgroundColor: TEAL,
    borderRadius: BORDER_RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBtnDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#fff',
  },
  hint: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
  },
});
