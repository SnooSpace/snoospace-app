import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Clock, CircleCheck, CircleX } from 'lucide-react-native';
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
}) {
  if (!status || status === 'unverified') {
    return null;
  }

  if (status === 'pending') {
    return (
      <View style={[styles.statusCard, styles.statusPending]}>
        <View style={styles.iconCirclePending}>
          <Clock size={28} color="#B45309" strokeWidth={1.8} />
        </View>
        <Text style={[styles.statusTitle, { color: '#B45309' }]}>Under review</Text>
        <Text style={styles.statusBody}>
          Your {tierLabel.toLowerCase()} verification was submitted on {formatDate(submittedAt)}.
          Our team will review it within 48 hours.
        </Text>
      </View>
    );
  }

  if (status === 'approved') {
    return (
      <View style={[styles.statusCard, styles.statusApproved]}>
        <View style={styles.iconCircleApproved}>
          <CircleCheck size={28} color="#2E7D32" strokeWidth={1.8} />
        </View>
        <Text style={[styles.statusTitle, { color: '#2E7D32' }]}>You're verified!</Text>
        <Text style={styles.statusBody}>
          Your verified badge is now visible on your profile. You can host and join Open Plans.
        </Text>
      </View>
    );
  }

  if (status === 'rejected') {
    return (
      <View style={[styles.statusCard, styles.statusRejected]}>
        <View style={styles.iconCircleRejected}>
          <CircleX size={28} color="#C62828" strokeWidth={1.8} />
        </View>
        <Text style={[styles.statusTitle, { color: '#C62828' }]}>Verification not approved</Text>
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
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
    ...SHADOWS.md,
    shadowOpacity: 0.04,
  },
  statusPending: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: 'rgba(180, 83, 9, 0.15)',
  },
  statusApproved: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: 'rgba(46, 125, 50, 0.15)',
  },
  statusRejected: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: 'rgba(198, 40, 40, 0.15)',
  },
  iconCirclePending: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(180, 83, 9, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconCircleApproved: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(46, 125, 50, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconCircleRejected: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(198, 40, 40, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statusTitle: {
    fontFamily: FONTS.basicCommercialBold,
    fontSize: 20,
    textAlign: 'center',
  },
  statusBody: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  resubmitBtn: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  resubmitBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
