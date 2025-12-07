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

// Draft storage utilities
import { 
  saveDraft as saveDraftUtil, 
  loadDraft as loadDraftUtil, 
  deleteDraft as deleteDraftUtil, 
  hasDraft, 
  formatLastSaved 
} from '../../utils/draftStorage';
import { getActiveAccount } from '../../api/auth';

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
  const [locationUrl, setLocationUrl] = useState('');  // Changed to simple URL string
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

  // Draft management states
  const [draftExists, setDraftExists] = useState(false);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [draftLastSaved, setDraftLastSaved] = useState(null);
  const [savingDraft, setSavingDraft] = useState(false);

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
    setLocationUrl('');
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

  // Draft Management Functions
  const getCurrentFormData = () => ({
    title,
    eventDate: eventDate.toISOString(),
    endDate: endDate.toISOString(),
    gatesOpenTime: gatesOpenTime ? gatesOpenTime.toISOString() : null,
    hasGates,
    eventType,
    locationUrl,
    virtualLink,
    maxAttendees,
    categories,
    bannerCarousel,
    gallery,
    description,
    highlights,
    featuredAccounts,
    thingsToKnow,
  });

  const saveDraft = async (silent = false) => {
    setSavingDraft(true);
    try {
      const account = await getActiveAccount();
      const communityId = account?.id;
      
      if (!communityId) {
        if (!silent) Alert.alert('Error', 'Could not save draft');
        return;
      }

      const formData = getCurrentFormData();
      await saveDraftUtil(communityId, currentStep, formData);
      
      setDraftLastSaved(new Date().toISOString());
      if (!silent) {
        Alert.alert('Draft Saved', 'Your event draft has been saved');
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      if (!silent) {
        Alert.alert('Error', 'Failed to save draft');
      }
    } finally {
      setSavingDraft(false);
    }
  };

  const loadDraftData = async () => {
    try {
      const account = await getActiveAccount();
      const communityId = account?.id;
      
      if (!communityId) return;

      const draft = await loadDraftUtil(communityId);
      
      if (draft) {
        // Load all form data from draft
        setTitle(draft.data.title || '');
        setEventDate(draft.data.eventDate ? new Date(draft.data.eventDate) : new Date());
        setEndDate(draft.data.endDate ? new Date(draft.data.endDate) : new Date());
        setGatesOpenTime(draft.data.gatesOpenTime ? new Date(draft.data.gatesOpenTime) : null);
        setHasGates(draft.data.hasGates || false);
        setEventType(draft.data.eventType || 'in-person');
        setLocationUrl(draft.data.locationUrl || '');
        setVirtualLink(draft.data.virtualLink || '');
        setMaxAttendees(draft.data.maxAttendees || '');
        setCategories(draft.data.categories || []);
        setBannerCarousel(draft.data.bannerCarousel || []);
        setGallery(draft.data.gallery || []);
        setDescription(draft.data.description || '');
        setHighlights(draft.data.highlights || []);
        setFeaturedAccounts(draft.data.featuredAccounts || []);
        setThingsToKnow(draft.data.thingsToKnow || []);
        setCurrentStep(draft.currentStep || 1);
        setDraftLastSaved(draft.lastSaved);
        
        setShowDraftPrompt(false);
      }
    } catch (error) {
      console.error('Error loading draft:', error);
      Alert.alert('Error', 'Failed to load draft');
    }
  };

  const deleteDraftData = async () => {
    try {
      const account = await getActiveAccount();
      const communityId = account?.id;
      
      if (!communityId) return;

      await deleteDraftUtil(communityId);
      setDraftExists(false);
      setDraftLastSaved(null);
    } catch (error) {
      console.error('Error deleting draft:', error);
    }
  };

  const checkForDraft = async () => {
    try {
      const account = await getActiveAccount();
      const communityId = account?.id;
      
      if (!communityId) return;

      const exists = await hasDraft(communityId);
      setDraftExists(exists);
      
      if (exists) {
        const draft = await loadDraftUtil(communityId);
        if (draft) {
          setDraftLastSaved(draft.lastSaved);
          setShowDraftPrompt(true);
        }
      }
    } catch (error) {
      console.error('Error checking for draft:', error);
    }
  };

  // Check for draft when modal opens
  useEffect(() => {
    if (visible) {
      checkForDraft();
    }
  }, [visible]);

  // Check if form has any content
  const hasFormContent = () => {
    return (
      title.trim() !== '' ||
      bannerCarousel.length > 0 ||
      gallery.length > 0 ||
      description.trim() !== '' ||
      highlights.length > 0 ||
      featuredAccounts.length > 0 ||
      thingsToKnow.length > 0 ||
      locationUrl.trim() !== '' ||
      virtualLink.trim() !== '' ||
      maxAttendees !== ''
    );
  };

  // Modified close handler with save draft prompt
  const handleClose = () => {
    // If form is empty or we're showing draft prompt, just close
    if (!hasFormContent() || showDraftPrompt) {
      onClose();
      return;
    }

    // Ask user if they want to save as draft
    Alert.alert(
      'Save Draft?',
      'Would you like to save your progress as a draft?',
      [
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await deleteDraftData();
            resetForm();
            onClose();
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Save Draft',
          onPress: async () => {
            await saveDraft(true); // Silent save
            onClose();
          },
        },
      ]
    );
  };

  // Helper function to validate Google Maps URLs
  const isValidGoogleMapsUrl = (url) => {
    if (!url) return false;
    const validDomains = [
      'maps.google.com',
      'www.google.com/maps',
      'maps.app.goo.gl',
      'goo.gl/maps',
      'g.co/maps',
    ];
    return validDomains.some(domain => url.includes(domain));
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
        if ((eventType === 'in-person' || eventType === 'hybrid') && !locationUrl.trim()) {
          Alert.alert('Required', 'Google Maps link is required for in-person/hybrid events');
          return false;
        }
        if (locationUrl && !isValidGoogleMapsUrl(locationUrl)) {
          Alert.alert('Invalid URL', 'Please paste a valid Google Maps link');
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
        location_url: locationUrl.trim() || null,  // Changed from location
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
              <Text style={styles.dateButtonText}>
                {eventDate.toLocaleDateString()}
              </Text>
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

            {/* Date Picker */}
            {showDatePicker && (
              <DateTimePicker
                value={eventDate}
                mode="date"
                is24Hour={false}
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  
                  if (event.type === 'set' && selectedDate) {
                    // Preserve the time from eventDate
                    const combined = new Date(selectedDate);
                    combined.setHours(eventDate.getHours());
                    combined.setMinutes(eventDate.getMinutes());
                    setEventDate(combined);
                    setEndDate(combined);
                  }
                }}
              />
            )}

            {/* Time Picker */}
            {showTimePicker && (
              <DateTimePicker
                value={eventDate}
                mode="time"
                is24Hour={false}
                display="default"
                onChange={(event, selectedDate) => {
                  setShowTimePicker(false);
                  
                  if (event.type === 'set' && selectedDate) {
                    // Combine date from eventDate with time from selectedDate
                    const combined = new Date(eventDate);
                    combined.setHours(selectedDate.getHours());
                    combined.setMinutes(selectedDate.getMinutes());
                    setEventDate(combined);
                    setEndDate(combined);
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
                display="default"
                onChange={(event, selectedDate) => {
                  setShowGatesTimePicker(false);
                  
                  if (event.type === 'set' && selectedDate) {
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
                <Text style={styles.label}>Location *</Text>
                <Text style={styles.helperText}>
                  Open Google Maps, search for the location, tap Share, and paste the link here
                </Text>
                <TextInput
                  style={styles.input}
                  value={locationUrl}
                  onChangeText={setLocationUrl}
                  placeholder="Paste Google Maps link here..."
                  placeholderTextColor={LIGHT_TEXT_COLOR}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                {locationUrl && isValidGoogleMapsUrl(locationUrl) && (
                  <View style={styles.urlValidIndicator}>
                    <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                    <Text style={styles.urlValidText}>Valid Google Maps link ✓</Text>
                  </View>
                )}
                {locationUrl && !isValidGoogleMapsUrl(locationUrl) && (
                  <View style={styles.urlInvalidIndicator}>
                    <Ionicons name="close-circle" size={20} color="#FF3B30" />
                    <Text style={styles.urlInvalidText}>Invalid URL - must be from Google Maps</Text>
                  </View>
                )}
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
          <ScrollView style={styles.stepContent} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={styles.stepTitle}>{title}</Text>
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
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
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

      {/* Draft Prompt Modal */}
      <Modal visible={showDraftPrompt} transparent animationType="fade">
        <View style={styles.draftPromptOverlay}>
          <View style={styles.draftPromptContainer}>
            <Ionicons name="save-outline" size={48} color={PRIMARY_COLOR} style={{ alignSelf: 'center', marginBottom: 15 }} />
            
            <Text style={styles.draftPromptTitle}>You have a draft event</Text>
            {draftLastSaved && (
              <Text style={styles.draftPromptSubtitle}>
                Last saved {formatLastSaved(draftLastSaved)}
              </Text>
            )}

            <TouchableOpacity
              style={styles.draftPromptButton}
              onPress={loadDraftData}
            >
              <Ionicons name="create-outline" size={20} color="#FFFFFF" />
              <Text style={styles.draftPromptButtonText}>Continue Editing</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.draftPromptButton, styles.draftPromptButtonSecondary]}
              onPress={() => {
                setShowDraftPrompt(false);
                resetForm();
              }}
            >
              <Ionicons name="add-circle-outline" size={20} color={PRIMARY_COLOR} />
              <Text style={[styles.draftPromptButtonText, styles.draftPromptButtonTextSecondary]}>
                Start Fresh
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.draftPromptButton, styles.draftPromptButtonDanger]}
              onPress={async () => {
                await deleteDraftData();
                setShowDraftPrompt(false);
                resetForm();
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              <Text style={[styles.draftPromptButtonText, styles.draftPromptButtonTextDanger]}>
                Delete Draft
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.draftPromptCancelButton}
              onPress={() => {
                setShowDraftPrompt(false);
                onClose();
              }}
            >
              <Text style={styles.draftPromptCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  scrollContent: {
    paddingBottom: 20,
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
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  locationButtonText: {
    marginLeft: 10,
    fontSize: 14,
    color: TEXT_COLOR,
    flex: 1,
  },
  locationDetail: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginTop: 6,
    marginLeft: 12,
  },
  locationMethodTabs: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  locationMethodTab: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E5EA',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  locationMethodTabActive: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: '#F8F5FF',
  },
  locationMethodTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: LIGHT_TEXT_COLOR,
  },
  locationMethodTabTextActive: {
    color: PRIMARY_COLOR,
  },
  linkInputContainer: {
    gap: 12,
  },
  parseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: PRIMARY_COLOR,
    gap: 8,
  },
  parseButtonDisabled: {
    opacity: 0.5,
  },
  parseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectedLocationContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F0FFF4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C6F6D5',
  },
  selectedLocationText: {
    flex: 1,
  },
  locationAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginBottom: 4,
  },
  helperText: {
    fontSize: 12,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 8,
    marginTop: -4,
  },
  urlValidIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 10,
    backgroundColor: '#F0FFF4',
    borderRadius: 8,
  },
  urlValidText: {
    fontSize: 13,
    color: '#34C759',
    fontWeight: '500',
  },
  urlInvalidIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 10,
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
  },
  urlInvalidText: {
    fontSize: 13,
    color: '#FF3B30',
    fontWeight: '500',
  },
  // Draft UI styles
  saveDraftButton: {
    padding: 4,
  },
  draftPromptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  draftPromptContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  draftPromptTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_COLOR,
    textAlign: 'center',
    marginBottom: 8,
  },
  draftPromptSubtitle: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    textAlign: 'center',
    marginBottom: 24,
  },
  draftPromptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_COLOR,
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  draftPromptButtonSecondary: {
    backgroundColor: '#F8F5FF',
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
  },
  draftPromptButtonDanger: {
    backgroundColor: '#FFF5F5',
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  draftPromptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  draftPromptButtonTextSecondary: {
    color: PRIMARY_COLOR,
  },
  draftPromptButtonTextDanger: {
    color: '#FF3B30',
  },
  draftPromptCancelButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  draftPromptCancelText: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
  },
});

export default CreateEventModal;
