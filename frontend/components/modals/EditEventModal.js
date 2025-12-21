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

// Import our components (same as CreateEventModal)
import StepIndicator from '../StepIndicator';
import ImageCarouselUpload from '../ImageCarouselUpload';
import EventGalleryUpload from '../EventGalleryUpload';
import RichTextEditor from '../RichTextEditor';
import HighlightsEditor from '../HighlightsEditor';
import FeaturedAccountsEditor from '../FeaturedAccountsEditor';
import ThingsToKnowEditor from '../ThingsToKnowEditor';
import { isValidGoogleMapsUrl } from '../../utils/validateGoogleMapsUrl';

const PRIMARY_COLOR = '#6B46C1';
const TEXT_COLOR = '#1C1C1E';
const LIGHT_TEXT_COLOR = '#8E8E93';

/**
 * EditEventModal - Full multi-step event editing
 * 7 Steps: Basic Info, Media, Description, Highlights, Featured Accounts, Things to Know, Review
 */
export default function EditEventModal({ 
  visible, 
  onClose, 
  onEventUpdated, 
  eventData 
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Basic Info
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [gatesOpenTime, setGatesOpenTime] = useState(null);
  const [hasGates, setHasGates] = useState(false);
  const [eventType, setEventType] = useState('in-person');
  const [locationUrl, setLocationUrl] = useState('');
  const [virtualLink, setVirtualLink] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');

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

  // Populate form with existing event data
  useEffect(() => {
    if (eventData && visible) {
      console.log('[EditEventModal] Loading event data:', {
        id: eventData.id,
        title: eventData.title,
        highlights: eventData.highlights?.length || 0,
        featured_accounts: eventData.featured_accounts?.length || 0,
        things_to_know: eventData.things_to_know?.length || 0,
        gallery: eventData.gallery?.length || 0,
      });
      
      setTitle(eventData.title || '');
      // Backend returns event_date (aliased from start_datetime)
      setEventDate(eventData.event_date ? new Date(eventData.event_date) : new Date());
      setEndDate(eventData.end_datetime ? new Date(eventData.end_datetime) : new Date());
      setGatesOpenTime(eventData.gates_open_time ? new Date(eventData.gates_open_time) : null);
      setHasGates(!!eventData.gates_open_time);
      setEventType(eventData.event_type || 'in-person');
      setLocationUrl(eventData.location_url || '');
      setVirtualLink(eventData.virtual_link || '');
      setMaxAttendees(eventData.max_attendees?.toString() || '');
      
      // Banner carousel - backend may return as array or single banner_url
      if (eventData.banner_carousel && eventData.banner_carousel.length > 0) {
        setBannerCarousel(eventData.banner_carousel);
      } else if (eventData.banner_url) {
        setBannerCarousel([{ url: eventData.banner_url }]);
      } else {
        setBannerCarousel([]);
      }
      
      // These come from separate tables in getCommunityEvents
      setGallery(eventData.gallery || []);
      setDescription(eventData.description || '');
      setHighlights(eventData.highlights || []);
      setFeaturedAccounts(eventData.featured_accounts || []);
      setThingsToKnow(eventData.things_to_know || []);
      setCurrentStep(1);
    }
  }, [eventData, visible]);

  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!title.trim()) {
          Alert.alert('Required', 'Please enter an event title');
          return false;
        }
        if (eventType === 'virtual' && !virtualLink.trim()) {
          Alert.alert('Required', 'Virtual link is required for virtual events');
          return false;
        }
        if ((eventType === 'in-person' || eventType === 'hybrid') && !locationUrl.trim()) {
          Alert.alert('Required', 'Location is required for in-person/hybrid events');
          return false;
        }
        return true;
      case 2:
        if (bannerCarousel.length === 0) {
          Alert.alert('Required', 'Please add at least one banner image');
          return false;
        }
        return true;
      case 3:
        if (description.length < 50) {
          Alert.alert('Required', `Description must be at least 50 characters`);
          return false;
        }
        return true;
      case 4:
      case 5:
        return true;
      case 6:
        if (thingsToKnow.length < 3) {
          Alert.alert('Required', 'Please add at least 3 "Things to Know" items');
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

  const handleSave = async () => {
    setLoading(true);
    try {
      const updateData = {
        title: title.trim(),
        description: description.trim(),
        start_datetime: eventDate.toISOString(),
        end_datetime: endDate.toISOString(),
        gates_open_time: hasGates && gatesOpenTime ? gatesOpenTime.toISOString() : null,
        location_url: locationUrl.trim() || null,
        max_attendees: maxAttendees ? parseInt(maxAttendees) : null,
        event_type: eventType,
        virtual_link: virtualLink.trim() || null,
        banner_carousel: bannerCarousel,
        gallery: gallery,
        highlights: highlights,
        featured_accounts: featuredAccounts,
        things_to_know: thingsToKnow,
      };

      const result = await updateEvent(eventData.id, updateData);

      if (result?.success) {
        if (result.changedFields?.length > 0 && result.notifiedAttendees > 0) {
          Alert.alert(
            'Event Updated',
            `${result.notifiedAttendees} registered attendee(s) have been notified.`,
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

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <ScrollView style={styles.stepContent} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.stepTitle}>Basic Information</Text>

            <Text style={styles.label}>Event Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter event title..."
              placeholderTextColor={LIGHT_TEXT_COLOR}
            />

            <Text style={styles.label}>Event Date *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={PRIMARY_COLOR} />
              <Text style={styles.dateButtonText}>{eventDate.toLocaleDateString()}</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Event Time *</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time-outline" size={20} color={PRIMARY_COLOR} />
              <Text style={styles.dateButtonText}>
                {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={eventDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    const combined = new Date(selectedDate);
                    combined.setHours(eventDate.getHours());
                    combined.setMinutes(eventDate.getMinutes());
                    setEventDate(combined);
                    setEndDate(combined);
                  }
                }}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={eventDate}
                mode="time"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowTimePicker(false);
                  if (selectedDate) {
                    const combined = new Date(eventDate);
                    combined.setHours(selectedDate.getHours());
                    combined.setMinutes(selectedDate.getMinutes());
                    setEventDate(combined);
                    setEndDate(combined);
                  }
                }}
              />
            )}

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
                display="default"
                onChange={(event, selectedDate) => {
                  setShowGatesTimePicker(false);
                  if (selectedDate) {
                    setGatesOpenTime(selectedDate);
                  }
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
                <Text style={styles.label}>Location (Google Maps Link) *</Text>
                <TextInput
                  style={styles.input}
                  value={locationUrl}
                  onChangeText={setLocationUrl}
                  placeholder="Paste Google Maps link here..."
                  placeholderTextColor={LIGHT_TEXT_COLOR}
                  autoCapitalize="none"
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
                  autoCapitalize="none"
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
          <ScrollView style={styles.stepContent} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={styles.stepTitle}>Review Changes</Text>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Title</Text>
              <Text style={styles.reviewValue}>{title}</Text>
            </View>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Date & Time</Text>
              <Text style={styles.reviewValue}>
                {eventDate.toLocaleDateString()} at {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
              <Text style={styles.reviewLabel}>Gallery</Text>
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
            
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle" size={20} color={PRIMARY_COLOR} />
              <Text style={styles.infoText}>
                Registered attendees will be notified about changes to key details.
              </Text>
            </View>
          </ScrollView>
        );

      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color={TEXT_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Event</Text>
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
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
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
  scrollContent: {
    paddingBottom: 40,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_COLOR,
    marginBottom: 20,
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
    marginBottom: 8,
    marginTop: 16,
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
  dateButton: {
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
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
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
    color: TEXT_COLOR,
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    alignItems: 'center',
  },
  eventTypeButtonActive: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: `${PRIMARY_COLOR}15`,
  },
  eventTypeText: {
    fontSize: 13,
    fontWeight: '500',
    color: LIGHT_TEXT_COLOR,
  },
  eventTypeTextActive: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  reviewSection: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  reviewLabel: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 4,
  },
  reviewValue: {
    fontSize: 16,
    fontWeight: '500',
    color: TEXT_COLOR,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `${PRIMARY_COLOR}10`,
    padding: 14,
    borderRadius: 12,
    gap: 10,
    marginTop: 20,
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
    gap: 8,
  },
  backButtonText: {
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
    gap: 8,
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 2,
    padding: 15,
    borderRadius: 12,
    backgroundColor: PRIMARY_COLOR,
    gap: 8,
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
