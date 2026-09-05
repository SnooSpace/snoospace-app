import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import {
  ArrowLeft,
  Camera,
  Video,
  Check,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react-native';
import { COLORS, FONTS, SHADOWS, BORDER_RADIUS } from '../../../constants/theme';
import { getAuthToken } from '../../../api/auth';
import { getMyVerification, submitVerification } from '../../../api/plans';
import { useCrop } from '../../../components/media';
import { uploadImage } from '../../../api/cloudinary';
import VerificationStatusCard from '../../../components/verification/VerificationStatusCard';
import SnooLoader from '../../../components/ui/SnooLoader';
import HapticsService from '../../../services/HapticsService';

export default function PlansVerificationScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState(null);
  const [resubmit, setResubmit] = useState(false);

  // Step 1: Reference Photo
  const [photoUri, setPhotoUri] = useState(null);
  const [referencePhotoUrl, setReferencePhotoUrl] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Step 2: Video Recording
  const [videoUri, setVideoUri] = useState(null);
  const [livenessMeta, setLivenessMeta] = useState(null);

  // Step 3: Submitting
  const [submitting, setSubmitting] = useState(false);

  const { pickAndCrop } = useCrop();

  const loadVerification = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const data = await getMyVerification(token, 'plans');
      setVerification(data?.verification || null);
    } catch (err) {
      console.error('[PlansVerificationScreen] load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVerification();
  }, [loadVerification]);

  // Step 1: Pick & Upload Face Photo
  const handlePickPhoto = async () => {
    try {
      const result = await pickAndCrop('avatar');
      if (!result?.uri) return;

      setPhotoUri(result.uri);
      setUploadingPhoto(true);

      const secureUrl = await uploadImage(result.uri);
      setReferencePhotoUrl(secureUrl);
      HapticsService.triggerSelection?.();
    } catch (err) {
      console.error('[PlansVerificationScreen] Photo upload error:', err);
      Alert.alert('Upload Failed', err?.message || 'Could not upload face photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Step 2: Record Verification Video
  const handleRecordVideo = () => {
    navigation.navigate('VerificationRecorder', {
      scope: 'plans',
      onVideoRecorded: (uri, scope, meta) => {
        setVideoUri(uri);
        if (meta) {
          setLivenessMeta(meta);
        }
        HapticsService.triggerSelection?.();
      },
    });
  };

  // Step 3: Submit Verification
  const handleSubmit = async () => {
    if (!videoUri || !referencePhotoUrl) {
      Alert.alert('Incomplete Submission', 'Please provide both your face photo and verification video.');
      return;
    }

    setSubmitting(true);
    try {
      const token = await getAuthToken();
      const data = await submitVerification(videoUri, token, {
        scope: 'plans',
        referencePhotoUrl,
        livenessAction: livenessMeta?.action,
        livenessCode: livenessMeta?.code,
      });

      setVerification(data.verification);
      setPhotoUri(null);
      setReferencePhotoUrl(null);
      setVideoUri(null);
      setLivenessMeta(null);
      setResubmit(false);
      HapticsService.triggerImpactMedium?.();
    } catch (err) {
      console.error('[PlansVerificationScreen] submit error:', err);
      Alert.alert('Submission Failed', err.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const showForm = !verification || resubmit;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
            <ArrowLeft size={24} color={COLORS.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Plans Verification</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <SnooLoader size="large" color={COLORS.secondary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Status Card (pending / approved / rejected) */}
          {!showForm && (
            <VerificationStatusCard
              status={verification?.status}
              submittedAt={verification?.submitted_at}
              rejectionReason={verification?.rejection_reason}
              tierLabel="Plans"
              onResubmit={() => setResubmit(true)}
            />
          )}

          {/* Form */}
          {showForm && (
            <>
              {/* Header Info */}
              <View style={styles.introBox}>
                <Text style={styles.introHeading}>Open Plans Verification</Text>
                <Text style={styles.introBody}>
                  Complete these two quick steps to verify your identity and start hosting or joining Open Plans.
                </Text>
              </View>

              {/* Step 1: Photo */}
              <View style={styles.stepCard}>
                <View style={styles.stepHeader}>
                  <View style={[styles.stepNumberBadge, { backgroundColor: 'rgba(0, 191, 165, 0.12)' }]}>
                    <Text style={[styles.stepNumberText, { color: COLORS.secondary }]}>1</Text>
                  </View>
                  <View style={styles.stepTitleWrap}>
                    <Text style={styles.stepTitle}>Face Reference Photo</Text>
                    <Text style={styles.stepSublabel}>Private • Not shown on your profile</Text>
                  </View>
                </View>

                <Text style={styles.stepDescription}>
                  Upload a clear, well-lit photo of your face. We use this only to match against your video.
                </Text>

                {photoUri ? (
                  <View style={styles.photoPreviewRow}>
                    <ExpoImage source={{ uri: photoUri }} style={styles.photoPreview} />
                    <View style={styles.photoPreviewInfo}>
                      {uploadingPhoto ? (
                        <View style={styles.uploadingRow}>
                          <ActivityIndicator size="small" color={COLORS.secondary} />
                          <Text style={styles.uploadingText}>Uploading photo...</Text>
                        </View>
                      ) : referencePhotoUrl ? (
                        <View style={styles.uploadedRow}>
                          <View style={styles.checkCircle}>
                            <Check size={14} color="#2E7D32" strokeWidth={2.5} />
                          </View>
                          <Text style={styles.uploadedText}>Photo uploaded</Text>
                        </View>
                      ) : null}
                      <TouchableOpacity
                        style={styles.changePhotoBtn}
                        onPress={handlePickPhoto}
                        disabled={uploadingPhoto}
                      >
                        <RotateCcw size={14} color={COLORS.secondary} strokeWidth={2} />
                        <Text style={styles.changePhotoText}>Change photo</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.uploadBox}
                    onPress={handlePickPhoto}
                    activeOpacity={0.75}
                    disabled={uploadingPhoto}
                  >
                    {uploadingPhoto ? (
                      <ActivityIndicator color={COLORS.secondary} />
                    ) : (
                      <>
                        <View style={styles.uploadIconContainer}>
                          <Camera size={24} color={COLORS.secondary} strokeWidth={2} />
                        </View>
                        <Text style={styles.uploadBoxLabel}>Take or choose a clear face photo</Text>
                        <Text style={styles.uploadBoxSubtext}>Tap to pick and crop</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Photo guidance */}
                <View style={styles.photoGuidanceBox}>
                  <Text style={styles.photoGuidanceItem}>• Good lighting, face clearly visible</Text>
                  <Text style={styles.photoGuidanceItem}>• No sunglasses or hats</Text>
                  <Text style={styles.photoGuidanceItem}>• Just you in the photo — no one else in frame</Text>
                  <Text style={styles.photoGuidanceItem}>• Look directly at the camera</Text>
                </View>
              </View>

              {/* Step 2: Video */}
              <View style={[styles.stepCard, !referencePhotoUrl && styles.stepCardDisabled]}>
                <View style={styles.stepHeader}>
                  <View style={[styles.stepNumberBadge, { backgroundColor: referencePhotoUrl ? 'rgba(0, 191, 165, 0.12)' : 'rgba(0,0,0,0.05)' }]}>
                    <Text style={[styles.stepNumberText, { color: referencePhotoUrl ? COLORS.secondary : COLORS.textMuted }]}>2</Text>
                  </View>
                  <View style={styles.stepTitleWrap}>
                    <Text style={[styles.stepTitle, !referencePhotoUrl && { color: COLORS.textMuted }]}>
                      Verification Video
                    </Text>
                    <Text style={styles.stepSublabel}>12-second selfie liveness check</Text>
                  </View>
                </View>

                <Text style={[styles.stepDescription, !referencePhotoUrl && { color: COLORS.textMuted }]}>
                  Record a short video performing a randomized action and reading a 4-digit code.
                </Text>

                <TouchableOpacity
                  style={[
                    styles.videoBox,
                    !referencePhotoUrl && styles.videoBoxDisabled,
                  ]}
                  onPress={handleRecordVideo}
                  disabled={!referencePhotoUrl}
                  activeOpacity={0.75}
                >
                  <Video size={22} color={referencePhotoUrl ? COLORS.secondary : COLORS.textMuted} strokeWidth={2} />
                  <View style={styles.videoBoxTextWrap}>
                    <Text style={[styles.videoBoxLabel, !referencePhotoUrl && { color: COLORS.textMuted }]}>
                      {videoUri ? 'Video recorded successfully' : 'Record verification video'}
                    </Text>
                    <Text style={[styles.videoBoxSubtext, !referencePhotoUrl && { color: COLORS.textMuted }]}>
                      {videoUri ? 'Tap to re-record' : 'Tap to open recorder'}
                    </Text>
                  </View>
                  {videoUri && (
                    <View style={styles.checkCircle}>
                      <Check size={14} color="#2E7D32" strokeWidth={2.5} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Step 3: Submit Button */}
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (!referencePhotoUrl || !videoUri || submitting) && styles.submitBtnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!referencePhotoUrl || !videoUri || submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit for review</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.footerNote}>
                Your reference photo and video are encrypted and used only to confirm your identity. They will never be posted publicly.
              </Text>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  safeArea: {
    backgroundColor: COLORS.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: FONTS.basicCommercialBold,
    fontSize: 20,
    color: COLORS.textPrimary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 48,
  },
  introBox: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  introHeading: {
    fontFamily: FONTS.basicCommercialBlack,
    fontSize: 22,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  introBody: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.xl,
    padding: 18,
    ...SHADOWS.sm,
    shadowOpacity: 0.04,
    marginBottom: 16,
  },
  stepCardDisabled: {
    opacity: 0.6,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  stepNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontFamily: FONTS.basicCommercialBold,
    fontSize: 15,
  },
  stepTitleWrap: {
    flex: 1,
  },
  stepTitle: {
    fontFamily: FONTS.basicCommercialBold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  stepSublabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  stepDescription: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    marginBottom: 16,
  },
  uploadBox: {
    borderWidth: 1.5,
    borderColor: 'rgba(0, 191, 165, 0.3)',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 191, 165, 0.03)',
  },
  uploadIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 191, 165, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  uploadBoxLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  uploadBoxSubtext: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.secondary,
  },
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 12,
  },
  photoPreview: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#E5E7EB',
  },
  photoPreviewInfo: {
    flex: 1,
    gap: 6,
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadingText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  uploadedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  uploadedText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#2E7D32',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(46, 125, 50, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  changePhotoText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.secondary,
  },
  videoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
  },
  videoBoxDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  videoBoxTextWrap: {
    flex: 1,
  },
  videoBoxLabel: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  videoBoxSubtext: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.secondary,
    marginTop: 2,
  },
  submitBtn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  footerNote: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  photoGuidanceBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    gap: 4,
  },
  photoGuidanceItem: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});
