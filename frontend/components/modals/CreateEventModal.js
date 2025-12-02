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
import PropTypes from 'prop-types';
import { createEvent } from '../../api/events';

// Import our new components
import StepIndicator from '../StepIndicator';
import ImageCarouselUpload from '../ImageCarouselUpload';
import EventGalleryUpload from '../EventGalleryUpload';
import RichTextEditor from '../RichTextEditor';
import HighlightsEditor from '../HighlightsEditor';
import FeaturedAccountsEditor from '../FeaturedAccountsEditor';
import ThingsToKnowEditor from '../ThingsToKnowEditor';

const PRIMARY_COLOR = '#6B46C1';
const TEXT_COLOR = '#1C1C1E';
const LIGHT_TEXT_COLOR = '#8E8E93';

/**
 * Enhanced CreateEventModal - Multi-step event creation
 * 7 Steps: Basic Info, Media, Description, Highlights, Featured Accounts, Things to Know, Review
 */
const CreateEventModal = ({ visible, onClose, onEventCreated }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [creating, setCreating] = useState(false);

  // Step 1: Basic Info
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [gatesOpenTime, setGatesOpenTime] = useState(null);
  const [hasGates, setHasGates] = useState(false);
  const [eventType, setEventType] = useState('in-person');
  const [location, setLocation] = useState('');
  const [virtualLink, setVirtualLink] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');
  const [categories, setCategories] = useState([]);

  // Step 2: Media
  const [bannerCarousel, setBannerCarousel] = useState([]);
  const [gallery, setGallery] = useState([]);

  // Step 3: Description
 const [description, setDescription] = useState('');

  // Step 4: Highlights
  const [highlights, setHighlights] = useState([]);

  // Step 5: Featured Accounts
  const [featuredAccounts, setFeaturedAccounts] = useState([]);

  // Step 6: Things to Know
  const [thingsToKnow, setThingsToKnow] = useState([]);

  // Date picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showGatesTimePicker, setShowGatesTimePicker] = useState(false);

  const stepLabels = [
    'Basic Info',
    'Media',
    'Description',
    'Highlights',
    'Featured',
    'Know',
    'Review',
  ];

  const resetForm = () => {
    setCurrentStep(1);
    setTitle('');
    setEventDate(new Date());
    setEndDate(new Date());
    setGatesOpenTime(null);
    setHasGates(false);
    setEventType('in-person');
    setLocation('');
    setVirtualLink('');
    setMaxAttendees('');
    setCategories([]);
    setBannerCarousel([]);
    setGallery([]);
    setDescription('');
    setHighlights([]);
    setFeaturedAccounts([]);
    setThingsToKnow([]);
  };

  const validateStep = (step) => {
    switch (step) {
      case 1: // Basic Info
        if (!title.trim()) {
          Alert.alert('Required', 'Please enter an event title');
          return false;
        }
        if (eventType === 'virtual' && !virtualLink.trim()) {
          Alert.alert('Required', 'Virtual link is required for virtual events');
          return false;
        }
        if ((eventType === 'in-person' || eventType === 'hybrid') && !location.trim()) {
          Alert.alert('Required', 'Location is required for in-person/hybrid events');
          return false;
        }
        return true;

      case 2: // Media
        if (bannerCarousel.length === 0) {
          Alert.alert('Required', 'Please add at least one banner image');
          return false;
        }
        return true;

      case 3: // Description
        if (description.length < 50) {
          Alert.alert('Required', `Description must be at least 50 characters (currently ${description.length})`);
          return false;
        }
        return true;

      case 4: // Highlights (optional)
        return true;

      case 5: // Featured Accounts (optional)
        return true;

      case 6: // Things to Know
        if (thingsToKnow.length < 3) {
          Alert.alert('Required', `Please add at least 3 "Things to Know" items (currently ${thingsToKnow.length})`);
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleCreate = async () => {
    setCreating(true);

    try {
      const eventData = {
        // Basic info
        title: title.trim(),
        event_date: eventDate.toISOString(),
        end_date: endDate.toISOString(),
        gates_open_time: hasGates && gatesOpenTime ? gatesOpenTime.toISOString() : null,
        event_type: eventType,
        location: location.trim() || null,
        virtual_link: virtualLink.trim() || null,
        max_attendees: maxAttendees ? parseInt(maxAttendees) : null,
        categories,

        // Media
        banner_carousel: bannerCarousel,
        gallery,

        // Content
        description: description.trim(),
        highlights,
        things_to_know: thingsToKnow,
        featured_accounts: featuredAccounts,
      };

      const response = await createEvent(eventData);

      if (response?.event) {
        Alert.alert('Success', 'Event created successfully!', [
          {
            text: 'OK',
            onPress: () => {
              resetForm();
              onEventCreated?.(response.event);
              onClose();
            },
          },
        ]);
      }
    } catch (error) {
      console.error('Error creating event:', error);
      Alert.alert('Error', 'Failed to create event. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <ScrollView style={styles.stepContent}>
            <Text style={styles.stepTitle}>Basic Information</Text>

            <Text style={styles.label}>Event Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter event title..."
              placeholderTextColor={LIGHT_TEXT_COLOR}
            />

            <Text style={styles.label}>Event Date & Time *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={PRIMARY_COLOR} />
              <Text style={styles.dateButtonText}>
                {eventDate.toLocaleDateString()} at {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={eventDate}
                mode="datetime"
                is24Hour={false}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    setEventDate(selectedDate);
                    setEndDate(selectedDate);
                  }
                }}
              />
            )}

            {/* Gates Open Time Toggle */}
            <View style={styles.toggleRow}>
              <Text style={styles.label}>Has gates/early entry?</Text>
              <TouchableOpacity
                style={[styles.toggle, hasGates && styles.toggleActive]}
                onPress={() => setHasGates(!hasGates)}
              >
                <Text style={[styles.toggleText, hasGates && styles.toggleTextActive]}>
                  {hasGates ? 'Yes' : 'No'}
                </Text>
              </TouchableOpacity>
            </View>

            {hasGates && (
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowGatesTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color={PRIMARY_COLOR} />
                <Text style={styles.dateButtonText}>
                  {gatesOpenTime
                    ? gatesOpenTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Set gates open time'}
                </Text>
              </TouchableOpacity>
            )}

            {showGatesTimePicker && (
              <DateTimePicker
                value={gatesOpenTime || new Date()}
                mode="time"
                is24Hour={false}
                onChange={(event, selectedDate) => {
                  setShowGatesTimePicker(Platform.OS === 'ios');
                  if (selectedDate) setGatesOpenTime(selectedDate);
                }}
              />
            )}

            <Text style={styles.label}>Event Type *</Text>
            <View style={styles.eventTypeRow}>
              {['in-person', 'virtual', 'hybrid'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.eventTypeButton,
                    eventType === type && styles.eventTypeButtonActive,
                  ]}
                  onPress={() => setEventType(type)}
                >
                  <Text
                    style={[
                      styles.eventTypeText,
                      eventType === type && styles.eventTypeTextActive,
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {(eventType === 'in-person' || eventType === 'hybrid') && (
              <>
                <Text style={styles.label}>Location *</Text>
                <TextInput
                  style={styles.input}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Event location..."
                  placeholderTextColor={LIGHT_TEXT_COLOR}
                />
              </>
            )}

            {(eventType === 'virtual' || eventType === 'hybrid') && (
              <>
                <Text style={styles.label}>Virtual Link *</Text>
                <TextInput
                  style={styles.input}
                  value={virtualLink}
                  onChangeText={setVirtualLink}
                  placeholder="https://..."
                  placeholderTextColor={LIGHT_TEXT_COLOR}
                  keyboardType="url"
                />
              </>
            )}

            <Text style={styles.label}>Max Attendees (Optional)</Text>
            <TextInput
              style={styles.input}
              value={maxAttendees}
              onChangeText={setMaxAttendees}
              placeholder="Leave empty for unlimited"
              placeholderTextColor={LIGHT_TEXT_COLOR}
              keyboardType="numeric"
            />
          </ScrollView>
        );

      case 2:
        return (
          <ScrollView style={styles.stepContent}>
            <Text style={styles.stepTitle}>Event Media</Text>
            <ImageCarouselUpload
              images={bannerCarousel}
              onChange={setBannerCarousel}
              maxImages={5}
            />
            <EventGalleryUpload
              images={gallery}
              onChange={setGallery}
              maxImages={20}
            />
          </ScrollView>
        );

      case 3:
        return (
          <ScrollView style={styles.stepContent}>
            <Text style={styles.stepTitle}>Event Description</Text>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              minLength={50}
              maxLength={2000}
              placeholder="Tell people what makes this event special..."
            />
          </ScrollView>
        );

      case 4:
        return (
          <ScrollView style={styles.stepContent}>
            <Text style={styles.stepTitle}>Event Highlights</Text>
            <Text style={styles.stepSubtitle}>Optional - Showcase what makes your event special</Text>
            <HighlightsEditor
              highlights={highlights}
              onChange={setHighlights}
              maxHighlights={5}
            />
          </ScrollView>
        );

      case 5:
        return (
          <ScrollView style={styles.stepContent}>
            <Text style={styles.stepTitle}>Featured Accounts</Text>
            <Text style={styles.stepSubtitle}>Optional - Performers, DJs, Sponsors, Vendors</Text>
            <FeaturedAccountsEditor
              accounts={featuredAccounts}
              onChange={setFeaturedAccounts}
            />
          </ScrollView>
        );

      case 6:
        return (
          <ScrollView style={styles.stepContent}>
            <Text style={styles.stepTitle}>Things to Know</Text>
            <Text style={styles.stepSubtitle}>Required - Minimum 3 items</Text>
            <ThingsToKnowEditor
              items={thingsToKnow}
              onChange={setThingsToKnow}
              minItems={3}
            />
          </ScrollView>
        );

      case 7:
        return (
          <ScrollView style={styles.stepContent}>
            <Text style={styles.stepTitle}>Review & Publish</Text>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Title</Text>
              <Text style={styles.reviewValue}>{title}</Text>
            </View>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Date & Time</Text>
              <Text style={styles.reviewValue}>
                {eventDate.toLocaleDateString()} at{' '}
                {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Type</Text>
              <Text style={styles.reviewValue}>{eventType}</Text>
            </View>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Banner Images</Text>
              <Text style={styles.reviewValue}>{bannerCarousel.length} images</Text>
            </View>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Gallery Images</Text>
              <Text style={styles.reviewValue}>{gallery.length} images</Text>
            </View>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Description</Text>
              <Text style={styles.reviewValue}>{description.length} characters</Text>
            </View>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Highlights</Text>
              <Text style={styles.reviewValue}>{highlights.length} items</Text>
            </View>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Featured Accounts</Text>
              <Text style={styles.reviewValue}>{featuredAccounts.length} accounts</Text>
            </View>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Things to Know</Text>
              <Text style={styles.reviewValue}>{thingsToKnow.length} items</Text>
            </View>
          </ScrollView>
        );

      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color={TEXT_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Event</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Step Indicator */}
        <StepIndicator
          currentStep={currentStep}
          totalSteps={7}
          stepLabels={stepLabels}
        />

        {/* Step Content */}
        {renderStep()}

        {/* Navigation Buttons */}
        <View style={styles.footer}>
          {currentStep > 1 && (
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={20} color={PRIMARY_COLOR} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}

          {currentStep < 7 ? (
            <TouchableOpacity
              style={[styles.nextButton, currentStep === 1 && styles.nextButtonFull]}
              onPress={handleNext}
            >
              <Text style={styles.nextButtonText}>Next</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.createButton, creating && styles.createButtonDisabled]}
              onPress={handleCreate}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.createButtonText}>Publish Event</Text>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

CreateEventModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onEventCreated: PropTypes.func,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  stepContent: {
    flex: 1,
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: TEXT_COLOR,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginTop: 15,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: TEXT_COLOR,
    backgroundColor: '#FFFFFF',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  dateButtonText: {
    marginLeft: 10,
    fontSize: 14,
    color: TEXT_COLOR,
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
  },
  toggle: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  toggleActive: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: PRIMARY_COLOR,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: LIGHT_TEXT_COLOR,
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  eventTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  eventTypeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  eventTypeButtonActive: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: '#F8F5FF',
  },
  eventTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: LIGHT_TEXT_COLOR,
  },
  eventTypeTextActive: {
    color: PRIMARY_COLOR,
  },
  reviewSection: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  reviewLabel: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 4,
  },
  reviewValue: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    gap: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: 15,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
    backgroundColor: '#FFFFFF',
  },
  backButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 2,
    padding: 15,
    borderRadius: 12,
    backgroundColor: PRIMARY_COLOR,
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonText: {
    marginRight: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#34C759',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    marginRight: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default CreateEventModal;
