import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import PropTypes from 'prop-types';
import { createEvent } from '../../api/events';

/**
 * CreateEventModal - Modal for communities to create events
 */
export default function CreateEventModal({ visible, onClose, onEventCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState('in-person');
  const [eventDate, setEventDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [location, setLocation] = useState('');
  const [virtualLink, setVirtualLink] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');
  const [bannerImage, setBannerImage] = useState(null);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setEventType('in-person');
    setEventDate(new Date());
    setLocation('');
    setVirtualLink('');
    setMaxAttendees('');
    setBannerImage(null);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setBannerImage(result.assets[0].uri);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setEventDate(selectedDate);
    }
  };

  const handleTimeChange = (event, selectedDate) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setEventDate(selectedDate);
    }
  };

  const validateForm = () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please enter an event title');
      return false;
    }

    if (eventType === 'virtual' && !virtualLink.trim()) {
      Alert.alert('Validation Error', 'Please enter a virtual link for virtual events');
      return false;
    }

    if ((eventType === 'in-person' || eventType === 'hybrid') && !location.trim()) {
      Alert.alert('Validation Error', 'Please enter a location for in-person/hybrid events');
      return false;
    }

    return true;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const eventData = {
        title,
        description,
        event_date: eventDate.toISOString(),
        event_type: eventType,
        location: location.trim() || null,
        virtual_link: virtualLink.trim() || null,
        max_attendees: maxAttendees ? parseInt(maxAttendees, 10) : null,
        banner_url: bannerImage, // TODO: Upload to Cloudinary first
      };

      const response = await createEvent(eventData);
      Alert.alert('Success', 'Event created successfully!');
      resetForm();
      if (onEventCreated) {
        onEventCreated(response.event);
      }
      onClose();
    } catch (error) {
      console.error('Error creating event:', error);
      Alert.alert('Error', error.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTime = (date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#1D1D1F" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Event</Text>
            <TouchableOpacity 
              onPress={handleCreate} 
              disabled={loading}
              style={styles.saveButton}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#0095F6" />
              ) : (
                <Text style={styles.saveText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Banner Image */}
            <TouchableOpacity style={styles.bannerSection} onPress={pickImage}>
              {bannerImage ? (
                <View style={styles.bannerPreview}>
                  <Text style={styles.bannerText}>Banner Selected ✓</Text>
                  <Text style={styles.bannerSubtext}>Tap to change</Text>
                </View>
              ) : (
                <View style={styles.bannerPlaceholder}>
                  <Ionicons name="image-outline" size={40} color="#8E8E93" />
                  <Text style={styles.bannerText}>Upload Banner Image</Text>
                  <Text style={styles.bannerSubtext}>Optional</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Title */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Event Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter event title..."
                value={title}
                onChangeText={setTitle}
                maxLength={100}
                placeholderTextColor="#8E8E93"
              />
            </View>

            {/* Description */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe your event..."
                value={description}
                onChangeText={setDescription}
                maxLength={1000}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholderTextColor="#8E8E93"
              />
            </View>

            {/* Event Type */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Event Type *</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={styles.radioButton}
                  onPress={() => setEventType('in-person')}
                >
                  <View style={styles.radio}>
                    {eventType === 'in-person' && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.radioLabel}>In-person</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.radioButton}
                  onPress={() => setEventType('virtual')}
                >
                  <View style={styles.radio}>
                    {eventType === 'virtual' && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.radioLabel}>Virtual</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.radioButton}
                  onPress={() => setEventType('hybrid')}
                >
                  <View style={styles.radio}>
                    {eventType === 'hybrid' && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.radioLabel}>Hybrid</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Date & Time */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Date & Time *</Text>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity
                  style={[styles.input, styles.dateTimeInput]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color="#8E8E93" />
                  <Text style={styles.dateTimeText}>{formatDate(eventDate)}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.input, styles.dateTimeInput]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons name="time-outline" size={20} color="#8E8E93" />
                  <Text style={styles.dateTimeText}>{formatTime(eventDate)}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={eventDate}
                mode="date"
                display="default"
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={eventDate}
                mode="time"
                display="default"
                onChange={handleTimeChange}
              />
            )}

            {/* Location (for in-person/hybrid) */}
            {(eventType === 'in-person' || eventType === 'hybrid') && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Location *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter event location..."
                  value={location}
                  onChangeText={setLocation}
                  placeholderTextColor="#8E8E93"
                />
              </View>
            )}

            {/* Virtual Link (for virtual/hybrid) */}
            {(eventType === 'virtual' || eventType === 'hybrid') && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Virtual Link *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter meeting link..."
                  value={virtualLink}
                  onChangeText={setVirtualLink}
                  keyboardType="url"
                  autoCapitalize="none"
                  placeholderTextColor="#8E8E93"
                />
              </View>
            )}

            {/* Max Attendees */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Max Attendees (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 50"
                value={maxAttendees}
                onChangeText={setMaxAttendees}
                keyboardType="number-pad"
                placeholderTextColor="#8E8E93"
              />
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '95%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1D1D1F',
  },
  saveButton: {
    padding: 4,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0095F6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  bannerSection: {
    marginBottom: 20,
  },
  bannerPlaceholder: {
    height: 160,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
  },
  bannerPreview: {
    height: 160,
    backgroundColor: '#0095F6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D1D1F',
    marginTop: 8,
  },
  bannerSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1D1D1F',
  },
  textArea: {
    height: 100,
    paddingTop: 14,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 16,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#0095F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0095F6',
  },
  radioLabel: {
    fontSize: 16,
    color: '#1D1D1F',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateTimeText: {
    fontSize: 16,
    color: '#1D1D1F',
  },
});

CreateEventModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onEventCreated: PropTypes.func,
};
