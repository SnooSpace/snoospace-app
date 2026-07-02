/**
 * ReportSheet — Universal Report Bottom Sheet
 *
 * Reusable across: Posts, Open Plans, Events, People (members).
 * Renders type-appropriate reason options, submits to POST /reports,
 * shows animated confirmation view, then auto-closes.
 *
 * Props:
 *   visible         boolean
 *   onClose         () => void
 *   type            'post' | 'open_plan' | 'event' | 'member'
 *   targetId        number  — the ID of the content being reported
 *   targetName      string? — optional display name for context ("Report [name]")
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import SwipeableModal from './modals/SwipeableModal';
import {
  Flag,
  CheckCircle,
  ChevronRight,
  X,
} from 'lucide-react-native';
import { COLORS, FONTS } from '../constants/theme';
import { getAuthToken } from '../api/auth';
import { submitReport } from '../api/reports';
import HapticsService from '../services/HapticsService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Per-type reason lists ────────────────────────────────────────────────────

const REPORT_REASONS = {
  open_plan: [
    'Misleading or fake plan',
    'Inappropriate content',
    'Spam',
    'Safety concern',
    'Wrong or deceptive location',
    'Other',
  ],
  event: [
    'Misleading event details',
    'Fake or fraudulent event',
    'Inappropriate content',
    'Spam / self-promotion',
    'Safety concern',
    'Other',
  ],
  post: [
    'Hate speech or discrimination',
    'Harassment or bullying',
    'Nudity or sexual content',
    'Spam',
    'Misinformation',
    'Violence or dangerous content',
    'Intellectual property violation',
    'Other',
  ],
  member: [
    'Harassment or bullying',
    'Fake profile / impersonation',
    'Inappropriate content',
    'Spam',
    'Hate speech',
    'Underage user',
    'Other',
  ],
  // fallback
  default: [
    'Inappropriate content',
    'Spam',
    'Harassment',
    'Misinformation',
    'Other',
  ],
};

const TYPE_LABELS = {
  open_plan: 'Plan',
  event: 'Event',
  post: 'Post',
  member: 'Person',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportSheet({ visible, onClose, type, targetId, targetName }) {
  const [selectedReason, setSelectedReason] = useState(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState('select'); // 'select' | 'confirm' | 'done'
  const confirmAnim = useRef(new Animated.Value(0)).current;

  // Reset state every time the sheet opens
  useEffect(() => {
    if (visible) {
      setSelectedReason(null);
      setLoading(false);
      setPhase('select');
      confirmAnim.setValue(0);
    }
  }, [visible]);

  const reasons = REPORT_REASONS[type] || REPORT_REASONS.default;
  const typeLabel = TYPE_LABELS[type] || 'Content';

  const handleSelectReason = useCallback((reason) => {
    HapticsService.triggerImpactLight();
    setSelectedReason(reason);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedReason || loading) return;
    HapticsService.triggerImpactMedium();
    setLoading(true);
    try {
      const token = await getAuthToken();
      await submitReport(type, targetId, selectedReason, null, token);
    } catch (err) {
      // 409 = already reported — treat as success (user already knows)
      if (!err?.message?.includes('already_reported')) {
        console.warn('[ReportSheet] submit error:', err?.message);
      }
    } finally {
      setLoading(false);
      // Animate to done state
      setPhase('done');
      Animated.spring(confirmAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 70,
        friction: 10,
      }).start();
      // Auto-close after 2.5 seconds
      setTimeout(() => {
        onClose();
      }, 2500);
    }
  }, [selectedReason, loading, type, targetId, onClose, confirmAnim]);

  const handleClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  const headerEl = (
    <View collapsable={false}>
      <View style={styles.handle} />
      <View style={styles.headerRow}>
        <Text style={styles.sheetTitle}>
          Report {targetName ? `"${targetName}"` : typeLabel}
        </Text>
        <TouchableOpacity onPress={handleClose} hitSlop={12} style={styles.closeBtn}>
          <X size={20} color="#64748B" strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SwipeableModal
      visible={visible}
      onClose={handleClose}
      sheetStyle={styles.sheet}
      header={headerEl}
      swipeEnabled={!loading}
    >
      {phase === 'done' ? (
        // ── Confirmation screen ───────────────────────────────────────────────
        <Animated.View
          style={[
            styles.confirmContainer,
            {
              opacity: confirmAnim,
              transform: [
                {
                  scale: confirmAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.confirmIconWrap}>
            <CheckCircle size={44} color="#16A34A" strokeWidth={2} />
          </View>
          <Text style={styles.confirmTitle}>Report submitted</Text>
          <Text style={styles.confirmBody}>
            Thanks for helping keep SnooSpace safe. Our team will review your report.
          </Text>
        </Animated.View>
      ) : (
        // ── Reason selection ─────────────────────────────────────────────────
        <View style={styles.content}>
          <Text style={styles.subtitle}>
            Why are you reporting this {typeLabel.toLowerCase()}?
          </Text>

          {reasons.map((reason) => {
            const isSelected = selectedReason === reason;
            return (
              <TouchableOpacity
                key={reason}
                style={[styles.reasonRow, isSelected && styles.reasonRowSelected]}
                onPress={() => handleSelectReason(reason)}
                activeOpacity={0.75}
              >
                <Text style={[styles.reasonText, isSelected && styles.reasonTextSelected]}>
                  {reason}
                </Text>
                {isSelected && (
                  <View style={styles.selectedDot} />
                )}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[
              styles.submitBtn,
              !selectedReason && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!selectedReason || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Flag size={16} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.submitBtnText}>Submit Report</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.finePrint}>
            Reports are anonymous. Our team reviews all reports within 24–48 hours.
          </Text>

          <View style={{ height: Platform.OS === 'ios' ? 16 : 8 }} />
        </View>
      )}
    </SwipeableModal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    overflow: 'hidden',
    maxHeight: SCREEN_HEIGHT * 0.82,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 4,
  },
  sheetTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 18,
    color: '#0F172A',
    flex: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Content ──
  content: {
    paddingTop: 12,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 20,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  reasonRowSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2962FF',
  },
  reasonText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: '#334155',
    flex: 1,
  },
  reasonTextSelected: {
    color: '#2962FF',
    fontFamily: FONTS.semiBold,
  },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2962FF',
    marginLeft: 8,
  },

  // ── Submit ──
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#EF4444',
    marginTop: 16,
    marginBottom: 10,
  },
  submitBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  submitBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  finePrint: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },

  // ── Confirmation ──
  confirmContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  confirmIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  confirmTitle: {
    fontFamily: FONTS.primary,
    fontSize: 20,
    color: '#0F172A',
    marginBottom: 10,
    textAlign: 'center',
  },
  confirmBody: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
});
