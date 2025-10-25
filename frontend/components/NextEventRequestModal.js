import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PRIMARY_COLOR = '#6A0DAD';
const TEXT_COLOR = '#1D1D1F';
const LIGHT_TEXT_COLOR = '#8E8E93';

const NextEventRequestModal = ({ 
  visible, 
  attendee, 
  onClose, 
  onSendRequest 
}) => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendRequest = async () => {
    if (loading) return;

    setLoading(true);
    try {
      await onSendRequest(message);
      setMessage('');
      onClose();
      Alert.alert(
        'Request Sent!',
        `Your request to attend the next event with ${attendee.name} has been sent.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error sending request:', error);
      Alert.alert('Error', 'Failed to send request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMessage('');
    onClose();
  };

  if (!visible || !attendee) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={24} color={TEXT_COLOR} />
            </TouchableOpacity>
            <Text style={styles.title}>Request Next Event</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Attendee Info */}
          <View style={styles.attendeeInfo}>
            <View style={styles.attendeePhoto}>
              <Ionicons name="person" size={40} color={PRIMARY_COLOR} />
            </View>
            <View style={styles.attendeeDetails}>
              <Text style={styles.attendeeName}>{attendee.name}</Text>
              <Text style={styles.attendeeAge}>{attendee.age} years old</Text>
            </View>
          </View>

          {/* Message Input */}
          <View style={styles.messageContainer}>
            <Text style={styles.messageLabel}>
              Send a message (optional)
            </Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Hey! Would you like to attend the next event together?"
              placeholderTextColor={LIGHT_TEXT_COLOR}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              maxLength={200}
              textAlignVertical="top"
            />
            <Text style={styles.characterCount}>
              {message.length}/200
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.cancelButton]}
              onPress={handleClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.actionButton, 
                styles.sendButton,
                loading && styles.sendButtonDisabled
              ]}
              onPress={handleSendRequest}
              disabled={loading}
            >
              {loading ? (
                <Text style={styles.sendButtonText}>Sending...</Text>
              ) : (
                <>
                  <Ionicons name="calendar-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.sendButtonText}>Send Request</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Info Text */}
          <View style={styles.infoContainer}>
            <Ionicons name="information-circle-outline" size={16} color={LIGHT_TEXT_COLOR} />
            <Text style={styles.infoText}>
              They'll receive a notification about your request to attend the next event together.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  closeButton: {
    padding: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_COLOR,
  },
  placeholder: {
    width: 34,
  },
  attendeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  attendeePhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  attendeeDetails: {
    flex: 1,
  },
  attendeeName: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 4,
  },
  attendeeAge: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
  messageContainer: {
    marginBottom: 20,
  },
  messageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 8,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: TEXT_COLOR,
    minHeight: 100,
    backgroundColor: '#FFFFFF',
  },
  characterCount: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    textAlign: 'right',
    marginTop: 5,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  sendButton: {
    backgroundColor: PRIMARY_COLOR,
  },
  sendButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
  },
  infoText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
});

export default NextEventRequestModal;
