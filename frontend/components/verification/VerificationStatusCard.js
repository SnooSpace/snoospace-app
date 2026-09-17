import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Clock, CircleCheck, CircleX, ShieldCheck, Check } from 'lucide-react-native';
import { COLORS, FONTS, SHADOWS } from '../../constants/theme';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function VerificationStatusCard({
  status,
  submittedAt,
  rejectionReason,
  tierLabel = 'Verification',
  onResubmit,
  onDone,
  actionLabel,
  onSecondaryAction,
  secondaryActionLabel,
}) {
  if (!status || status === 'unverified') {
    return null;
  }

  if (status === 'pending') {
    return (
      <View style={[styles.statusCard, styles.statusPending]}>
        <View style={styles.iconCirclePending}>
          <Clock size={32} color="#B45309" strokeWidth={1.8} />
        </View>
        <Text style={styles.statusTitle}>Under review</Text>
        <Text style={styles.statusBody}>
          Your {tierLabel.toLowerCase()} verification was submitted on {formatDate(submittedAt)}.
          Our team will review it within 48 hours.
        </Text>
      </View>
    );
  }

  if (status === 'approved') {
    const isDiscover = tierLabel.toLowerCase().includes('discover');
    const primaryColor = isDiscover ? '#2962FF' : '#10B981';

    return (
      <View
        style={[
          styles.statusCard,
          isDiscover ? styles.statusApprovedDiscover : styles.statusApproved,
        ]}
      >
        <View
          style={[
            styles.iconCircleApproved,
            isDiscover && styles.iconCircleApprovedDiscover,
          ]}
        >
          {isDiscover ? (
            <ShieldCheck size={32} color="#2962FF" strokeWidth={2} />
          ) : (
            <CircleCheck size={32} color="#10B981" strokeWidth={2} />
          )}
        </View>

        <Text style={styles.statusTitle}>
          {isDiscover ? "You're Discover Verified!" : "You're verified!"}
        </Text>

        <Text style={styles.statusBody}>
          {isDiscover
            ? 'Your verified blue badge is now active on your profile and Discover swipe decks. You also have full access to host and join Open Plans.'
            : 'Your verified badge is now visible on your profile. You can host and join Open Plans.'}
        </Text>

        {isDiscover && (
          <View style={styles.benefitsBox}>
            <View style={styles.benefitRow}>
              <View style={styles.benefitCheckCircle}>
                <Check size={12} color="#2962FF" strokeWidth={3} />
              </View>
              <Text style={styles.benefitText}>
                Active in Discover swipe decks at events
              </Text>
            </View>
            <View style={styles.benefitRow}>
              <View style={styles.benefitCheckCircle}>
                <Check size={12} color="#2962FF" strokeWidth={3} />
              </View>
              <Text style={styles.benefitText}>
                Blue verified checkmark on your profile
              </Text>
            </View>
            <View style={styles.benefitRow}>
              <View style={styles.benefitCheckCircle}>
                <Check size={12} color="#2962FF" strokeWidth={3} />
              </View>
              <Text style={styles.benefitText}>
                Full access to host and join Open Plans
              </Text>
            </View>
          </View>
        )}

        {onDone && (
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: primaryColor }]}
            onPress={onDone}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryActionBtnText}>
              {actionLabel || 'Done'}
            </Text>
          </TouchableOpacity>
        )}

        {onSecondaryAction && (
          <TouchableOpacity
            style={styles.secondaryActionBtn}
            onPress={onSecondaryAction}
            activeOpacity={0.7}
          >
            <Text style={[styles.secondaryActionBtnText, { color: primaryColor }]}>
              {secondaryActionLabel || 'Edit Discover Profile'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (status === 'rejected') {
    return (
      <View style={[styles.statusCard, styles.statusRejected]}>
        <View style={styles.iconCircleRejected}>
          <CircleX size={32} color="#EF4444" strokeWidth={1.8} />
        </View>
        <Text style={styles.statusTitle}>Verification not approved</Text>
        <Text style={styles.statusBody}>
          {rejectionReason || 'Your submission could not be verified. Please ensure your face is clearly visible.'}
        </Text>
        {onResubmit && (
          <TouchableOpacity style={styles.resubmitBtn} onPress={onResubmit} activeOpacity={0.85}>
            <Text style={styles.resubmitBtnText}>Resubmit</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
    shadowOpacity: 0.06,
  },
  statusPending: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FDE68A',
  },
  statusApproved: {
    backgroundColor: '#FFFFFF',
    borderColor: '#BBF7D0',
  },
  statusApprovedDiscover: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DBEAFE',
  },
  statusRejected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FECACA',
  },
  iconCirclePending: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconCircleApproved: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconCircleApprovedDiscover: {
    backgroundColor: '#EFF6FF',
  },
  iconCircleRejected: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statusTitle: {
    fontFamily: FONTS.basicCommercialBold,
    fontSize: 22,
    color: '#0F172A',
    textAlign: 'center',
  },
  statusBody: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 6,
  },
  benefitsBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 16,
    gap: 12,
    marginTop: 6,
    marginBottom: 4,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  primaryActionBtn: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  primaryActionBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  secondaryActionBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionBtnText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
  },
  resubmitBtn: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  resubmitBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#FFF',
  },
});
