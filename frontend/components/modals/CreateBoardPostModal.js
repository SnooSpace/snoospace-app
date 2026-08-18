/**
 * CreateBoardPostModal.js
 *
 * Bottom sheet modal for posting a new collab opening to the Board.
 *
 * Fields:
 *   - Title (required, ≤80 chars)
 *   - Description (required, ≤500 chars)
 *   - Collab type chips (single-select, required)
 *   - Spots total stepper (numeric, ≥1, default 1)
 *   - Submit button -> POST /board-posts
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
import { Plus, Minus, Sparkles, TriangleAlert, Handshake } from 'lucide-react-native';
import SwipeableModal from './SwipeableModal';
import CustomAlertModal from '../ui/CustomAlertModal';
import { COLORS, FONTS, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { createBoardPost, COLLAB_TYPES } from '../../api/collabRequests';
import HapticsService from '../../services/HapticsService';

const TITLE_MAX_LEN = 80;
const DESC_MAX_LEN  = 500;

const TEAL = '#0D9488';
const TEAL_BG = 'rgba(13, 148, 136, 0.09)';
const TEAL_BORDER = 'rgba(13, 148, 136, 0.3)';

const CHIP_OPTIONS = COLLAB_TYPES;

export default function CreateBoardPostModal({
  visible,
  onClose,
  onSuccess,
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState(null);
  const [customType, setCustomType] = useState('');
  const [spotsTotal, setSpotsTotal] = useState(1);
  const [loading, setLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [alertConfig, setAlertConfig] = useState({ visible: false });
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

  const titleCharsLeft = TITLE_MAX_LEN - title.length;
  const descCharsLeft  = DESC_MAX_LEN - description.length;

  const customTypeOk = selectedType === 'custom' ? customType.trim().length > 0 : true;
  const canSubmit =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    !!selectedType &&
    customTypeOk &&
    spotsTotal >= 1 &&
    !loading;

  const resetState = useCallback(() => {
    setTitle('');
    setDescription('');
    setSelectedType(null);
    setCustomType('');
    setSpotsTotal(1);
    setLoading(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const showAlert = useCallback((cfg) => {
    setAlertConfig({ ...cfg, visible: true });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleIncrementSpots = () => {
    HapticsService.triggerImpactLight();
    setSpotsTotal((s) => Math.min(20, s + 1));
  };

  const handleDecrementSpots = () => {
    HapticsService.triggerImpactLight();
    setSpotsTotal((s) => Math.max(1, s - 1));
  };

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    HapticsService.triggerImpactMedium();
    setLoading(true);
    try {
      const finalDesc = (selectedType === 'custom' && customType.trim())
        ? `[${customType.trim()}] ${description.trim()}`
        : description.trim();

      const res = await createBoardPost({
        title: title.trim(),
        description: finalDesc,
        collab_type: selectedType,
        spots_total: spotsTotal,
      });

      HapticsService.triggerAddToCircle();
      resetState();
      onClose();
      onSuccess?.(res?.post || res);
    } catch (err) {
      const msg = err?.message || err?.data?.error || err?.error || 'Failed to post opening. Please try again.';
      showAlert({
        title: 'Could not create opening',
        message: msg,
        icon: TriangleAlert,
        iconColor: '#E53935',
        primaryAction: { text: 'OK', onPress: hideAlert },
      });
    } finally {
      setLoading(false);
    }
  }, [canSubmit, title, description, selectedType, customType, spotsTotal, resetState, onClose, onSuccess, showAlert, hideAlert]);

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
          {/* ── Title row ── */}
          <View style={styles.titleRow}>
            <View style={styles.iconCircle}>
              <Handshake size={20} color={TEAL} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>Post an Opening</Text>
              <Text style={styles.subtitle}>Open collab spots on the public Board</Text>
            </View>
          </View>

            {/* ── Opening title input ── */}
            <Text style={styles.sectionLabel}>Opening Title</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.singleInput}
                placeholder="e.g., Looking for co-host for Music Fest"
                placeholderTextColor={COLORS.textMuted}
                maxLength={TITLE_MAX_LEN}
                value={title}
                onChangeText={setTitle}
                returnKeyType="next"
              />
              <Text style={[styles.charCount, titleCharsLeft <= 10 && { color: '#E53935' }]}>
                {titleCharsLeft}
              </Text>
            </View>

            {/* ── Collab type chips ── */}
            <Text style={styles.sectionLabel}>Collab Type</Text>
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
                        scrollRef.current?.scrollTo({ y: 140, animated: true });
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

            {/* ── Spots total stepper ── */}
            <View style={styles.spotsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionLabel}>Available Spots</Text>
                <Text style={styles.spotsHelper}>How many collaborators can join?</Text>
              </View>
              <View style={styles.stepperContainer}>
                <TouchableOpacity
                  style={[styles.stepBtn, spotsTotal <= 1 && styles.stepBtnDisabled]}
                  onPress={handleDecrementSpots}
                  disabled={spotsTotal <= 1}
                  activeOpacity={0.75}
                >
                  <Minus size={15} color={spotsTotal <= 1 ? COLORS.textMuted : COLORS.textPrimary} strokeWidth={2.5} />
                </TouchableOpacity>
                <Text style={styles.spotsValueText}>{spotsTotal}</Text>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={handleIncrementSpots}
                  activeOpacity={0.75}
                >
                  <Plus size={15} color={COLORS.textPrimary} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Description input ── */}
            <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Description</Text>
            <View style={[styles.inputWrapper, { minHeight: 110 }]}>
              <TextInput
                style={styles.multiInput}
                placeholder="Describe what you're looking for, goals, prerequisites, timeline…"
                placeholderTextColor={COLORS.textMuted}
                multiline
                maxLength={DESC_MAX_LEN}
                value={description}
                onChangeText={setDescription}
                onFocus={() => {
                  setTimeout(() => {
                    scrollRef.current?.scrollToEnd({ animated: true });
                  }, 120);
                }}
                textAlignVertical="top"
              />
              <Text style={[styles.charCount, descCharsLeft <= 30 && { color: descCharsLeft <= 10 ? '#E53935' : '#FF9500' }]}>
                {descCharsLeft}
              </Text>
            </View>

            {/* ── Submit button ── */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              disabled={!canSubmit}
              onPress={handleSubmit}
            >
              {loading ? (
                <Text style={styles.submitBtnText}>Publishing…</Text>
              ) : (
                <>
                  <Plus size={16} color="#FFFFFF" strokeWidth={2.2} style={{ marginRight: 6 }} />
                  <Text style={styles.submitBtnText}>Post Opening</Text>
                </>
              )}
            </TouchableOpacity>
          </SwipeableModal.ScrollView>
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
    marginBottom: 18,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: TEAL_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetTitle: {
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
  sectionLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  inputWrapper: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: BORDER_RADIUS.l,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  singleInput: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textPrimary,
    paddingVertical: 4,
  },
  multiInput: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 22,
    minHeight: 80,
  },
  charCount: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
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
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  chipTextActive: {
    color: TEAL,
  },
  customTypeSection: {
    marginBottom: 16,
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
  spotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 4,
  },
  spotsHelper: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: -4,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  stepBtnDisabled: {
    backgroundColor: '#E5E7EB',
    elevation: 0,
    shadowOpacity: 0,
  },
  spotsValueText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textPrimary,
    minWidth: 20,
    textAlign: 'center',
  },
  submitBtn: {
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
    marginTop: 8,
  },
  submitBtnDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
