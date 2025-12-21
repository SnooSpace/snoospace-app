import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { updateEvent } from '../../api/events';
import { COLORS, BORDER_RADIUS } from '../../constants/theme';

const PRIMARY_COLOR = '#6B46C1';
const TEXT_COLOR = '#1C1C1E';
const LIGHT_TEXT_COLOR = '#8E8E93';

/**
 * EditEventModal - Edit existing event details
 * Simplified modal for editing key event fields
 */
export default function EditEventModal({ 
  visible, 
  onClose, 
  onEventUpdated, 
  eventData 
}) {
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState(new Date());
  const [locationUrl, setLocationUrl] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');
  const [eventType, setEventType] = useState('in-person');
  const [virtualLink, setVirtualLink] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Populate form with existing event data
  useEffect(() => {
    if (eventData && visible) {
      setTitle(eventData.title || '');
      setDescription(eventData.description || '');
      setEventDate(eventData.event_date ? new Date(eventData.event_date) : new Date());
      setLocationUrl(eventData.location_url || '');
      setMaxAttendees(eventData.max_attendees?.toString() || '');
      setEventType(eventData.event_type || 'in-person');
      setVirtualLink(eventData.virtual_link || '');
    }
  }, [eventData, visible]);

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Error', 'Event title is required');
      return;
    }

    if ((eventType === 'in-person' || eventType === 'hybrid') && !locationUrl.trim()) {
      Alert.alert('Error', 'Location is required for in-person/hybrid events');
      return;
    }

    if (eventType === 'virtual' && !virtualLink.trim()) {
      Alert.alert('Error', 'Virtual link is required for virtual events');
      return;
    }

    setLoading(true);
    try {
      const updateData = {
        title: title.trim(),
        description: description.trim(),
        event_date: eventDate.toISOString(),
        location_url: locationUrl.trim() || null,
        max_attendees: maxAttendees ? parseInt(maxAttendees) : null,
        event_type: eventType,
        virtual_link: virtualLink.trim() || null,
      };

      const result = await updateEvent(eventData.id, updateData);

      if (result?.success) {
        // Show notification info if attendees were notified
        if (result.changedFields?.length > 0 && result.notifiedAttendees > 0) {
          Alert.alert(
            'Event Updated',
            `${result.notifiedAttendees} registered attendee(s) have been notified about the changes.`,
            [{ text: 'OK' }]
          );
        }
        
        onEventUpdated?.(result.event);
        onClose();
      } else {
        Alert.alert('Error', result?.error || 'Failed to update event');
      }
    } catch (error) {
      console.error('Error updating event:', error);
      Alert.alert('Error', 'Failed to update event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(eventDate);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      setEventDate(newDate);
    }
  };

  const handleTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(eventDate);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setEventDate(newDate);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={TEXT_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Event</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Event Title */}
          <View style={styles.section}>
            <Text style={styles.label}>Event Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter event title"
              placeholderTextColor={LIGHT_TEXT_COLOR}
            />
          </View>

          {/* Event Type */}
          <View style={styles.section}>
            <Text style={styles.label}>Event Type</Text>
            <View style={styles.typeButtons}>
              {['in-person', 'virtual', 'hybrid'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    eventType === type && styles.typeButtonActive
                  ]}
                  onPress={() => setEventType(type)}
                >
                  <Text style={[
                    styles.typeButtonText,
                    eventType === type && styles.typeButtonTextActive
                  ]}>
                    {type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Date & Time */}
          <View style={styles.section}>
            <Text style={styles.label}>Date & Time *</Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={PRIMARY_COLOR} />
                <Text style={styles.dateButtonText}>{formatDate(eventDate)}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.dateButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color={PRIMARY_COLOR} />
                <Text style={styles.dateButtonText}>{formatTime(eventDate)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Location (for in-person/hybrid) */}
          {(eventType === 'in-person' || eventType === 'hybrid') && (
            <View style={styles.section}>
              <Text style={styles.label}>Location (Google Maps Link) *</Text>
              <TextInput
                style={styles.input}
                value={locationUrl}
                onChangeText={setLocationUrl}
                placeholder="Paste Google Maps link"
                placeholderTextColor={LIGHT_TEXT_COLOR}
                autoCapitalize="none"
              />
            </View>
          )}

          {/* Virtual Link (for virtual/hybrid) */}
          {(eventType === 'virtual' || eventType === 'hybrid') && (
            <View style={styles.section}>
              <Text style={styles.label}>Virtual Meeting Link *</Text>
              <TextInput
                style={styles.input}
                value={virtualLink}
                onChangeText={setVirtualLink}
                placeholder="Paste meeting link (Zoom, Meet, etc.)"
                placeholderTextColor={LIGHT_TEXT_COLOR}
                autoCapitalize="none"
              />
            </View>
          )}

          {/* Max Attendees */}
          <View style={styles.section}>
            <Text style={styles.label}>Maximum Attendees</Text>
            <TextInput
              style={styles.input}
              value={maxAttendees}
              onChangeText={setMaxAttendees}
              placeholder="Leave empty for unlimited"
              placeholderTextColor={LIGHT_TEXT_COLOR}
              keyboardType="number-pad"
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your event..."
              placeholderTextColor={LIGHT_TEXT_COLOR}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={20} color={PRIMARY_COLOR} />
            <Text style={styles.infoText}>
              Registered attendees will be notified about changes to key details 
              (date, time, location).
            </Text>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={onClose}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={eventDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}

        {/* Time Picker */}
        {showTimePicker && (
          <DateTimePicker
            value={eventDate}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: TEXT_COLOR,
    backgroundColor: '#FAFAFA',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
  },
  typeButtonActive: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: `${PRIMARY_COLOR}15`,
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: LIGHT_TEXT_COLOR,
  },
  typeButtonTextActive: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    gap: 10,
  },
  dateButtonText: {
    fontSize: 14,
    color: TEXT_COLOR,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${PRIMARY_COLOR}10`,
    padding: 14,
    borderRadius: 12,
    gap: 10,
    marginTop: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: TEXT_COLOR,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: LIGHT_TEXT_COLOR,
  },
  saveButton: {
    flex: 2,
    padding: 16,
    borderRadius: 12,
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
