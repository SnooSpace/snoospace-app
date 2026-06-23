import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ShieldCheck, Video, CircleCheck, CircleX, Clock } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS, SHADOWS } from '../../constants/theme';
import { getAuthToken } from '../../api/auth';
import { getMyVerification, submitVerification } from '../../api/plans';
import SnooLoader from '../../components/ui/SnooLoader';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function VerificationSubmitScreen({ navigation }) {
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [videoUri, setVideoUri] = useState(null);
  const [videoName, setVideoName] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [resubmit, setResubmit] = useState(false);

  const loadVerification = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const data = await getMyVerification(token);
      setVerification(data.verification);
    } catch (err) {
      console.error('[VerificationSubmitScreen]', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVerification(); }, [loadVerification]);

  const handlePickVideo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Please allow access to your media library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      setVideoUri(asset.uri);
      setVideoName(asset.fileName || asset.uri.split('/').pop());
    }
  };

  const handleSubmit = async () => {
    if (!videoUri) return;
    setUploading(true);
    try {
      const token = await getAuthToken();
      const data = await submitVerification(videoUri, token);
      setVerification(data.verification);
      setVideoUri(null);
      setVideoName(null);
      setResubmit(false);
    } catch (err) {
      Alert.alert('Upload failed', err.message || 'Please try again');
    } finally {
      setUploading(false);
    }
  };

  const showUploadForm = !verification || resubmit;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <ArrowLeft size={24} color={COLORS.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Get verified</Text>
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
          {!showUploadForm && verification?.status === 'pending' && (
            <View style={[styles.statusCard, styles.statusPending]}>
              <Clock size={28} color="#B45309" strokeWidth={1.8} />
              <Text style={[styles.statusTitle, { color: '#B45309' }]}>Under review</Text>
              <Text style={styles.statusBody}>
                Your verification video was submitted on {formatDate(verification.submitted_at)}.
                Our team will review it within 48 hours.
              </Text>
            </View>
          )}

          {!showUploadForm && verification?.status === 'approved' && (
            <View style={[styles.statusCard, styles.statusApproved]}>
              <CircleCheck size={28} color="#2E7D32" strokeWidth={1.8} />
              <Text style={[styles.statusTitle, { color: '#2E7D32' }]}>You're verified!</Text>
              <Text style={styles.statusBody}>
                Your verified badge is now visible on your profile. You can host and join Open Plans.
              </Text>
            </View>
          )}

          {!showUploadForm && verification?.status === 'rejected' && (
            <View style={[styles.statusCard, styles.statusRejected]}>
              <CircleX size={28} color="#C62828" strokeWidth={1.8} />
              <Text style={[styles.statusTitle, { color: '#C62828' }]}>Verification not approved</Text>
              {verification.rejection_reason && (
                <Text style={styles.statusBody}>{verification.rejection_reason}</Text>
              )}
              <TouchableOpacity style={styles.resubmitBtn} onPress={() => setResubmit(true)}>
                <Text style={styles.resubmitBtnText}>Resubmit</Text>
              </TouchableOpacity>
            </View>
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
                  Record a short video of yourself (5–15 seconds) saying your name and showing your face.
                  Our team reviews it within 48 hours. Verified users get a blue badge on their profile
                  and can host and join Open Plans.
                </Text>
              </View>

              {/* Video picker */}
              <TouchableOpacity style={styles.videoPicker} onPress={handlePickVideo}>
                <Video size={22} color={COLORS.primary} strokeWidth={1.8} />
                <View style={styles.videoPickerText}>
                  <Text style={styles.videoPickerLabel}>
                    {videoUri ? videoName || 'Video selected' : 'Tap to pick a video'}
                  </Text>
                  {videoUri && (
                    <Text style={styles.videoPickerChange}>Change video</Text>
                  )}
                </View>
              </TouchableOpacity>

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitBtn, (!videoUri || uploading) && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={!videoUri || uploading}
              >
                {uploading
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.submitBtnText}>Submit for review</Text>}
              </TouchableOpacity>

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
