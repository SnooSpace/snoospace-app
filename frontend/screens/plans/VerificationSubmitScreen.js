import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, ShieldCheck, Video } from 'lucide-react-native';
import { COLORS, FONTS, SHADOWS } from '../../constants/theme';
import { getAuthToken } from '../../api/auth';
import { getMyVerification, submitVerification } from '../../api/plans';
import { getSocket } from '../../services/socketService';
import EventBus from '../../utils/EventBus';
import VerificationStatusCard from '../../components/verification/VerificationStatusCard';
import AnimatedVerificationButton from '../../components/verification/AnimatedVerificationButton';
import SnooLoader from '../../components/ui/SnooLoader';

export default function VerificationSubmitScreen({ navigation }) {
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [videoUri, setVideoUri] = useState(null);
  const [videoName, setVideoName] = useState(null);
  const [livenessMeta, setLivenessMeta] = useState(null);
  const [buttonStatus, setButtonStatus] = useState('idle'); // 'idle' | 'submitting' | 'success' | 'review' | 'failed'
  const [resubmit, setResubmit] = useState(false);
  const pendingVerificationRef = useRef(null);
  const debounceRef = useRef(null);

  const loadVerification = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const data = await getMyVerification(token, 'discover');
      setVerification(data.verification);
    } catch (err) {
      console.error('[VerificationSubmitScreen]', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadVerification();
    }, [loadVerification])
  );

  useEffect(() => {
    const socket = getSocket();

    const handleStatusUpdated = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        loadVerification();
      }, 300);
    };

    if (socket) {
      socket.on('verification_status_updated', handleStatusUpdated);
    }

    const unsubReconnect = EventBus.on('socket:reconnected', () => {
      loadVerification();
    });

    return () => {
      if (socket) {
        socket.off('verification_status_updated', handleStatusUpdated);
      }
      unsubReconnect?.();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [loadVerification]);

  const handleRecordVideo = () => {
    navigation.navigate('VerificationRecorder', {
      scope: 'discover',
      onVideoRecorded: (uri, scope, meta) => {
        setVideoUri(uri);
        setVideoName('verification-video.mp4');
        setButtonStatus('idle');
        if (meta) {
          setLivenessMeta(meta);
        }
      },
    });
  };

  const handleSubmit = async () => {
    if (!videoUri || buttonStatus === 'submitting') return;
    setButtonStatus('submitting');
    try {
      const token = await getAuthToken();
      const data = await submitVerification(videoUri, token, {
        scope: 'discover',
        livenessAction: livenessMeta?.action,
        livenessCode: livenessMeta?.code,
      });
      pendingVerificationRef.current = data?.verification;
      const vStatus = data?.verification?.status;
      if (vStatus === 'approved') {
        setButtonStatus('success');
      } else {
        setButtonStatus('review');
      }
    } catch (err) {
      setButtonStatus('failed');
      Alert.alert('Upload failed', err.message || 'Please try again');
    }
  };

  const handleAnimationComplete = () => {
    if (pendingVerificationRef.current) {
      setVerification(pendingVerificationRef.current);
      setVideoUri(null);
      setVideoName(null);
      setLivenessMeta(null);
      setResubmit(false);
      pendingVerificationRef.current = null;
    }
    setButtonStatus('idle');
  };

  const showUploadForm = !verification || resubmit;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <ArrowLeft size={24} color={COLORS.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Discover Verification</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <SnooLoader size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Status cards */}
          {!showUploadForm && (
            <VerificationStatusCard
              status={verification?.status}
              submittedAt={verification?.submitted_at}
              rejectionReason={verification?.rejection_reason}
              tierLabel="Discover"
              onResubmit={() => setResubmit(true)}
            />
          )}

          {/* Upload form */}
          {showUploadForm && (
            <>
              {/* Explanation card */}
              <View style={styles.explanationCard}>
                <View style={styles.iconCircle}>
                  <ShieldCheck size={28} color={COLORS.primary} strokeWidth={1.8} />
                </View>
                <Text style={styles.explanationTitle}>Verified badge</Text>
                <Text style={styles.explanationBody}>
                  Record a quick 12-second selfie video showing your face. We match your video against your Discover photos to confirm your identity. Verified users get a blue badge on their profile and can host and join Open Plans.
                </Text>
                <View style={styles.guidanceBox}>
                  <Text style={styles.guidanceItem}>• Good lighting, face clearly visible</Text>
                  <Text style={styles.guidanceItem}>• No sunglasses or hats</Text>
                  <Text style={styles.guidanceItem}>• Just you in the frame — look directly at camera</Text>
                </View>
              </View>

              {/* Video recorder button */}
              <TouchableOpacity
                style={styles.videoPicker}
                onPress={handleRecordVideo}
                activeOpacity={0.7}
              >
                <Video size={22} color={COLORS.primary} strokeWidth={1.8} />
                <View style={styles.videoPickerText}>
                  <Text style={styles.videoPickerLabel}>
                    {videoUri ? 'Video recorded successfully' : 'Record verification video'}
                  </Text>
                  {videoUri ? (
                    <Text style={styles.videoPickerChange}>Tap to re-record</Text>
                  ) : (
                    <Text style={styles.videoPickerChange}>Tap to open camera</Text>
                  )}
                </View>
              </TouchableOpacity>

              {/* Submit */}
              <AnimatedVerificationButton
                title="Submit for review"
                status={buttonStatus}
                disabled={!videoUri}
                accentColor={COLORS.primary}
                onPress={handleSubmit}
                onAnimationComplete={handleAnimationComplete}
              />

              {/* Footer */}
              <Text style={styles.footer}>
                Your video is only used for identity verification and is not shown to other users.
              </Text>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  safeArea: { backgroundColor: COLORS.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontFamily: FONTS.primary, fontSize: 20, color: COLORS.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 20, paddingBottom: 60 },

  statusCard: {
    borderRadius: 18, padding: 24, alignItems: 'center', gap: 10,
    marginBottom: 24, ...SHADOWS.md, shadowOpacity: 0.04,
  },
  statusPending: { backgroundColor: '#FFF8E1' },
  statusApproved: { backgroundColor: '#E8F5E9' },
  statusRejected: { backgroundColor: '#FFEBEE' },
  statusTitle: { fontFamily: FONTS.primary, fontSize: 20, textAlign: 'center' },
  statusBody: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  resubmitBtn: {
    marginTop: 8, backgroundColor: COLORS.primary, paddingHorizontal: 24,
    paddingVertical: 10, borderRadius: 12,
  },
  resubmitBtnText: { fontFamily: FONTS.semiBold, fontSize: 14, color: '#FFF' },

  explanationCard: {
    backgroundColor: COLORS.surface, borderRadius: 18, padding: 22,
    alignItems: 'center', gap: 12, marginBottom: 20, ...SHADOWS.md, shadowOpacity: 0.04,
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center',
  },
  explanationTitle: { fontFamily: FONTS.primary, fontSize: 20, color: COLORS.textPrimary },
  explanationBody: {
    fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textSecondary,
    textAlign: 'center', lineHeight: 21,
  },
  guidanceBox: {
    width: '100%',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    gap: 4,
    alignItems: 'flex-start',
  },
  guidanceItem: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  videoPicker: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.surface,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 16,
    padding: 16, marginBottom: 20,
  },
  videoPickerText: { flex: 1 },
  videoPickerLabel: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textPrimary },
  videoPickerChange: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.primary, marginTop: 3 },

  submitBtn: {
    height: 52, borderRadius: 16, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontFamily: FONTS.semiBold, fontSize: 16, color: '#FFF' },
  footer: {
    fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textMuted,
    textAlign: 'center', lineHeight: 18,
  },
});
