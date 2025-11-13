import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PRIMARY_COLOR = '#5f27cd';
const TEXT_COLOR = '#1e1e1e';
const LIGHT_TEXT_COLOR = '#6c757d';
const BACKGROUND_COLOR = '#ffffff';

export default function LocationConfirmationModal({ 
  visible, 
  businessName, 
  onYes, 
  onNo 
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onNo}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.questionText}>
            Are you currently at {businessName}?
          </Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.yesButton]}
              onPress={onYes}
            >
              <Text style={styles.yesButtonText}>Yes, I'm here</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.noButton]}
              onPress={onNo}
            >
              <Text style={styles.noButtonText}>No, I'm somewhere else</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: BACKGROUND_COLOR,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_COLOR,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yesButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  yesButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  noButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  noButtonText: {
    color: TEXT_COLOR,
    fontSize: 16,
    fontWeight: '500',
  },
});

