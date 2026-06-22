import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  TouchableWithoutFeedback, Keyboard,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import SwipeableModal from '../../components/modals/SwipeableModal';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { Info } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import { getAuthToken } from '../../api/auth';
import { sendRequest } from '../../api/plans';

export default function RequestBottomSheet({
  isVisible, planId, planTitle, onClose, onRequested,
}) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      await sendRequest(planId, note.trim() || null, token);
      onRequested();
      setNote('');
      onClose();
    } catch (err) {
      if (err.status === 403 && err.data?.error === 'proof_gate_required') {
        Alert.alert(
          'Profile incomplete',
          'To request to join a plan, add a post, connect Instagram, or get verified.',
        );
      } else if (err.status === 409) {
        Alert.alert('Already requested', "You've already sent a request for this plan.");
      } else {
        Alert.alert('Error', err.message || 'Could not send request');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNote('');
    onClose();
  };

  return (
    <SwipeableModal
      visible={isVisible}
      onClose={handleClose}
      sheetStyle={styles.keyboardView}
      backdropColor="rgba(0,0,0,0.5)"
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardStickyView style={styles.keyboardView}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>Request to join</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{planTitle}</Text>

            <TextInput
              style={styles.noteInput}
              placeholder="Add a note to the host (optional)"
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={3}
              maxLength={200}
              value={note}
              onChangeText={setNote}
              textAlignVertical="top"
            />

            <View style={styles.infoRow}>
              <Info size={14} color={COLORS.textMuted} strokeWidth={1.8} />
              <Text style={styles.infoText}>
                The host will review your profile before approving.{'\n'}
                Exact meetup details are shared only after approval.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.sendBtn, loading && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.sendBtnText}>Send request</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardStickyView>
      </TouchableWithoutFeedback>
    </SwipeableModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  keyboardView: {
    width: '100%',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: FONTS.primary,
    fontSize: 20,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    minHeight: 80,
    backgroundColor: '#FAFAFA',
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  sendBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.65 },
  sendBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

