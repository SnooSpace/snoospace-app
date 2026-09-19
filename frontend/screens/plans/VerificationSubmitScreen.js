import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, ShieldCheck, Video, Camera, ShieldAlert, Check, Users, AlertCircle } from 'lucide-react-native';
import { COLORS, FONTS, SHADOWS } from '../../constants/theme';
import { getAuthToken } from '../../api/auth';
import { apiGet } from '../../api/client';
import { getMyVerification, submitVerification, getFaceEligibility } from '../../api/plans';
import { getSocket } from '../../services/socketService';
import EventBus from '../../utils/EventBus';
import VerificationStatusCard from '../../components/verification/VerificationStatusCard';
import AnimatedVerificationButton from '../../components/verification/AnimatedVerificationButton';
import CustomAlertModal from '../../components/ui/CustomAlertModal';
import SnooLoader from '../../components/ui/SnooLoader';

export default function VerificationSubmitScreen({ navigation, route }) {
  const [verification, setVerification] = useState(null);
  const [memberProfile, setMemberProfile] = useState(null);
  const [faceEligibility, setFaceEligibility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [videoUri, setVideoUri] = useState(null);
  const [videoName, setVideoName] = useState(null);
  const [livenessMeta, setLivenessMeta] = useState(null);
  const [buttonStatus, setButtonStatus] = useState('idle'); // 'idle' | 'submitting' | 'success' | 'review' | 'failed'
  const [resubmit, setResubmit] = useState(false);
  const [alertModal, setAlertModal] = useState({
    visible: false,
    title: '',
    message: '',
    icon: null,
    iconColor: '#FF3B30',
    primaryAction: null,
    secondaryAction: null,
  });
  const pendingVerificationRef = useRef(null);
  const debounceRef = useRef(null);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('MemberHome');
    }
  }, [navigation]);

  const navigateToEditProfile = useCallback(() => {
    if (route?.params?.from === 'EditDiscoverProfile' && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    const state = navigation.getState?.();
    if (state && state.routes && state.index > 0) {
      const prevRoute = state.routes[state.index - 1];
      if (prevRoute?.name === 'EditDiscoverProfile') {
        navigation.goBack();
        return;
      }
      if (prevRoute?.name === 'MemberHome') {
        const tabRoute = prevRoute.state?.routes?.[prevRoute.state?.index ?? -1];
        if (tabRoute?.name === 'Discover') {
          const stackRoute = tabRoute.state?.routes?.[tabRoute.state?.index ?? -1];
          if (stackRoute?.name === 'EditDiscoverProfile') {
            navigation.goBack();
            return;
          }
        }
      }
    }

    try {
      navigation.navigate('MemberHome', {
        screen: 'Discover',
        params: {
          screen: 'EditDiscoverProfile',
        },
      });
    } catch {
      navigation.navigate('EditDiscoverProfile');
    }
  }, [navigation, route?.params?.from]);

  const navigateToEditPhotos = navigateToEditProfile;

  const loadVerification = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const token = await getAuthToken();
      const [vData, fData, pData] = await Promise.all([
        getMyVerification(token, 'discover').catch(() => ({ verification: null })),
        getFaceEligibility(token).catch(() => null),
        apiGet('/members/profile', 10000, token).catch(() => null),
      ]);
      setVerification(vData?.verification || null);
      if (fData) {
        setFaceEligibility(fData);
      }
      if (pData) {
        const profile = pData.profile || pData;
        setMemberProfile(profile);
      }
    } catch (err) {
      console.error('[VerificationSubmitScreen]', err.message);
    } finally {
      if (!isSilent) setLoading(false);
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
        loadVerification(true);
      }, 200);
    };

    if (socket) {
      socket.on('verification_status_updated', handleStatusUpdated);
    }

    const unsubStatus = EventBus.on('verification:status_updated', handleStatusUpdated);
    const unsubNotif = EventBus.on('new_notification', handleStatusUpdated);
    const unsubReconnect = EventBus.on('socket:reconnected', () => loadVerification(true));
    const unsubConnect = EventBus.on('socket:connected', () => loadVerification(true));

    return () => {
      if (socket) {
        socket.off('verification_status_updated', handleStatusUpdated);
      }
      unsubStatus?.();
      unsubNotif?.();
      unsubReconnect?.();
      unsubConnect?.();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [loadVerification]);

  const proceedToRecorder = () => {
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

  const handleRecordVideo = () => {
    if (faceEligibility && typeof faceEligibility.eligiblePhotoCount === 'number' && faceEligibility.eligiblePhotoCount < 1) {
      const photoBulletPoints = (faceEligibility.photos || [])
        .map((p, idx) => `• Photo ${idx + 1}: ${p.label}`)
        .join('\n');

      setAlertModal({
        visible: true,
        title: 'Face Photo Required',
        message: `None of your Discover photos have a verified face:\n\n${photoBulletPoints}\n\nYou need at least 1 photo with your face clearly visible to get verified.`,
        icon: Camera,
        iconColor: COLORS.primary,
        primaryAction: {
          text: 'Edit Photos',
          onPress: () => {
            setAlertModal((prev) => ({ ...prev, visible: false }));
            navigateToEditProfile();
          },
        },
        secondaryAction: {
          text: 'Record Anyway',
          onPress: () => {
            setAlertModal((prev) => ({ ...prev, visible: false }));
            proceedToRecorder();
          },
        },
      });
      return;
    }
    proceedToRecorder();
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
      const isPhotosError =
        err.code === 'insufficient_reference_photos' ||
        err.message?.toLowerCase().includes('insufficient_reference_photos') ||
        err.message?.toLowerCase().includes('photo') ||
        err.message?.toLowerCase().includes('face');

      if (isPhotosError) {
        const photoBulletPoints = (faceEligibility?.photos || [])
          .map((p, idx) => `• Photo ${idx + 1}: ${p.label}`)
          .join('\n');

        const detailsText = photoBulletPoints ? `\n\n${photoBulletPoints}` : '';

        setAlertModal({
          visible: true,
          title: 'Face Photo Required',
          message:
            `You must have at least 1 photo with your face clearly visible in your Discover profile to get verified.${detailsText}\n\nPlease add a clear photo of yourself and try again.`,
          icon: Camera,
          iconColor: COLORS.primary,
          primaryAction: {
            text: 'Edit Photos',
            onPress: () => {
              setAlertModal((prev) => ({ ...prev, visible: false }));
              navigateToEditPhotos();
            },
          },
          secondaryAction: {
            text: 'OK',
            onPress: () => setAlertModal((prev) => ({ ...prev, visible: false })),
          },
        });
      } else {
        setAlertModal({
          visible: true,
          title: 'Upload Failed',
          message: err.message || 'Please try again',
          icon: ShieldAlert,
          iconColor: '#FF3B30',
          primaryAction: {
            text: 'OK',
            onPress: () => setAlertModal((prev) => ({ ...prev, visible: false })),
          },
        });
      }
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

  const isAlreadyDiscoverVerified =
    verification?.status === 'approved' ||
    memberProfile?.verification_tier === 'selfie_verified' ||
    memberProfile?.verification_tier === 'id_verified';

  const showUploadForm = (!verification && !isAlreadyDiscoverVerified) || resubmit;
  const effectiveStatus = isAlreadyDiscoverVerified ? 'approved' : verification?.status;

  // Active polling while verification is under review (every 2.5 seconds)
  useEffect(() => {
    if (effectiveStatus !== 'pending') return;

    const interval = setInterval(() => {
      loadVerification(true);
    }, 2500);

    return () => clearInterval(interval);
  }, [effectiveStatus, loadVerification]);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} hitSlop={12}>
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
              status={effectiveStatus}
              submittedAt={verification?.submitted_at}
              rejectionReason={verification?.rejection_reason}
              tierLabel="Discover"
              onResubmit={() => setResubmit(true)}
              onDone={handleBack}
              actionLabel="Done"
              onSecondaryAction={navigateToEditProfile}
              secondaryActionLabel="Edit Discover Profile"
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
                  Record a quick 8-second selfie video showing your face. We match your video against your Discover photos to confirm your identity. Verified users get a blue badge on their profile and can host and join Open Plans.
                </Text>

                {/* Face photo requirement callout */}
                <View style={styles.requirementCard}>
                  <View style={styles.requirementIconCircle}>
                    <Camera size={18} color={COLORS.primary} strokeWidth={2} />
                  </View>
                  <View style={styles.requirementTextWrap}>
                    <Text style={styles.requirementTitle}>1 Face Photo Required</Text>
                    <Text style={styles.requirementBody}>
                      Make sure at least 1 of your Discover photos clearly shows your face before verifying.
                    </Text>
                  </View>
                </View>

                <View style={styles.guidanceBox}>
                  <Text style={styles.guidanceItem}>• At least 1 Discover photo with your face clearly visible</Text>
                  <Text style={styles.guidanceItem}>• Good lighting, face clearly visible in video</Text>
                  <Text style={styles.guidanceItem}>• No sunglasses or hats</Text>
                  <Text style={styles.guidanceItem}>• Just you in the frame — look directly at camera</Text>
                </View>
              </View>

              {/* Photo Face Verification Status Card */}
              {faceEligibility?.photos && faceEligibility.photos.length > 0 && (
                <View style={styles.photoStatusCard}>
                  <View style={styles.photoStatusHeader}>
                    <View style={styles.photoStatusTitleRow}>
                      <Text style={styles.photoStatusTitle}>Discover Photos</Text>
                      <View
                        style={[
                          styles.eligibleCountBadge,
                          faceEligibility.eligiblePhotoCount >= 1
                            ? styles.eligibleCountBadgeSuccess
                            : styles.eligibleCountBadgeWarning,
                        ]}
                      >
                        <Text
                          style={[
                            styles.eligibleCountBadgeText,
                            faceEligibility.eligiblePhotoCount >= 1
                              ? styles.eligibleCountBadgeTextSuccess
                              : styles.eligibleCountBadgeTextWarning,
                          ]}
                        >
                          {faceEligibility.eligiblePhotoCount >= 1
                            ? `${faceEligibility.eligiblePhotoCount} Photo Ready`
                            : '0 Eligible'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={navigateToEditPhotos} hitSlop={10}>
                      <Text style={styles.photoStatusEditLink}>Edit Photos</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.photoThumbList}
                  >
                    {faceEligibility.photos.map((item, idx) => {
                       const isEligible = item.isEligible;
                      return (
                        <View key={item.url || idx} style={styles.photoThumbContainer}>
                          <Image
                            source={{ uri: item.url }}
                            style={[
                              styles.photoThumb,
                              isEligible ? styles.photoThumbEligible : styles.photoThumbIneligible,
                            ]}
                          />
                          <View
                            style={[
                              styles.photoBadge,
                              isEligible ? styles.photoBadgeEligible : styles.photoBadgeIneligible,
                            ]}
                          >
                            {isEligible ? (
                              <Check size={10} color="#FFFFFF" strokeWidth={3} />
                            ) : item.reason === 'multiple_faces' ? (
                              <Users size={10} color="#FFFFFF" strokeWidth={2.5} />
                            ) : (
                              <AlertCircle size={10} color="#FFFFFF" strokeWidth={2.5} />
                            )}
                            <Text style={styles.photoBadgeText}>
                              {isEligible
                                ? 'Face Ready'
                                : item.reason === 'multiple_faces'
                                ? '2+ Faces'
                                : item.reason === 'face_too_small'
                                ? 'Too Far'
                                : item.reason === 'low_confidence'
                                ? 'Unclear'
                                : 'No Face'}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>

                  {faceEligibility.eligiblePhotoCount < 1 ? (
                    <Text style={styles.photoStatusHintWarning}>
                      None of your photos clearly show only your face. Tap "Edit Photos" to upload a clear face photo.
                    </Text>
                  ) : (
                    <Text style={styles.photoStatusHintSuccess}>
                      ✓ At least 1 photo with your face is ready. We will match this against your selfie video.
                    </Text>
                  )}
                </View>
              )}

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

      {/* Alert Modal */}
      <CustomAlertModal
        visible={alertModal.visible}
        title={alertModal.title}
        message={alertModal.message}
        icon={alertModal.icon}
        iconColor={alertModal.iconColor}
        onClose={() => setAlertModal((prev) => ({ ...prev, visible: false }))}
        primaryAction={alertModal.primaryAction}
        secondaryAction={alertModal.secondaryAction}
      />
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
  requirementCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    borderRadius: 14,
    padding: 12,
  },
  requirementIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requirementTextWrap: {
    flex: 1,
  },
  requirementTitle: {
    fontFamily: FONTS.primary,
    fontSize: 13,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  requirementBody: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
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

  photoStatusCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    ...SHADOWS.md,
    shadowOpacity: 0.04,
  },
  photoStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  photoStatusTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  photoStatusTitle: {
    fontFamily: FONTS.primary,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  eligibleCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  eligibleCountBadgeSuccess: {
    backgroundColor: '#E8F5E9',
  },
  eligibleCountBadgeWarning: {
    backgroundColor: '#FFF3E0',
  },
  eligibleCountBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
  },
  eligibleCountBadgeTextSuccess: {
    color: '#2E7D32',
  },
  eligibleCountBadgeTextWarning: {
    color: '#D97706',
  },
  photoStatusEditLink: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.primary,
  },
  photoThumbList: {
    gap: 12,
    paddingBottom: 4,
  },
  photoThumbContainer: {
    alignItems: 'center',
    width: 88,
  },
  photoThumb: {
    width: 88,
    height: 110,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  photoThumbEligible: {
    borderWidth: 2,
    borderColor: '#34C759',
  },
  photoThumbIneligible: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    opacity: 0.85,
  },
  photoBadge: {
    position: 'absolute',
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  photoBadgeEligible: {
    backgroundColor: '#2E7D32',
  },
  photoBadgeIneligible: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
  },
  photoBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: '#FFFFFF',
  },
  photoStatusHintSuccess: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#2E7D32',
    marginTop: 12,
    lineHeight: 17,
  },
  photoStatusHintWarning: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#D97706',
    marginTop: 12,
    lineHeight: 17,
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
