import React, { useState, useEffect, useMemo } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import { updateEvent } from "../../api/events";
import { COLORS, BORDER_RADIUS } from "../../constants/theme";

// Import our components
import StepIndicator from "../StepIndicator";
import ImageCarouselUpload from "../ImageCarouselUpload";
import EventGalleryUpload from "../EventGalleryUpload";
import RichTextEditor from "../RichTextEditor";
import HighlightsEditor from "../HighlightsEditor";
import FeaturedAccountsEditor from "../FeaturedAccountsEditor";
import ThingsToKnowEditor from "../ThingsToKnowEditor";
import TicketTypesEditor from "../editors/TicketTypesEditor";
import DiscountCodesEditor from "../editors/DiscountCodesEditor";
import PricingRulesEditor from "../editors/PricingRulesEditor";

const PRIMARY_COLOR = COLORS.primary; // This should be your solid Blue
const TEXT_COLOR = "#1F2937";
const LIGHT_TEXT_COLOR = "#6B7280";
const BORDER_COLOR = "#E5E7EB";

export default function EditEventModal({
  visible,
  onClose,
  onEventUpdated,
  eventData,
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  // Step 1: Basic Info
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [gatesOpenTime, setGatesOpenTime] = useState(null);
  const [hasGates, setHasGates] = useState(false);
  const [eventType, setEventType] = useState("in-person");
  const [locationUrl, setLocationUrl] = useState("");
  const [virtualLink, setVirtualLink] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");
  const [ticketTypes, setTicketTypes] = useState([]);
  const [discountCodes, setDiscountCodes] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);

  // Step 2-6: Content
  const [bannerCarousel, setBannerCarousel] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [description, setDescription] = useState("");
  const [highlights, setHighlights] = useState([]);
  const [featuredAccounts, setFeaturedAccounts] = useState([]);
  const [thingsToKnow, setThingsToKnow] = useState([]);

  // Date picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showGatesTimePicker, setShowGatesTimePicker] = useState(false);

  const stepLabels = [
    "Basic Info",
    "Media",
    "Description",
    "Highlights",
    "Featured",
    "Know",
    "Review",
  ];

  useEffect(() => {
    if (eventData && visible) {
      setTitle(eventData.title || "");
      setEventDate(
        eventData.event_date ? new Date(eventData.event_date) : new Date()
      );
      setEndDate(
        eventData.end_datetime ? new Date(eventData.end_datetime) : new Date()
      );
      setGatesOpenTime(
        eventData.gates_open_time ? new Date(eventData.gates_open_time) : null
      );
      setHasGates(!!eventData.gates_open_time);
      setEventType(eventData.event_type || "in-person");
      setLocationUrl(eventData.location_url || "");
      setVirtualLink(eventData.virtual_link || "");
      setMaxAttendees(eventData.max_attendees?.toString() || "");

      if (eventData.banner_carousel?.length > 0) {
        setBannerCarousel(eventData.banner_carousel);
      } else if (eventData.banner_url) {
        setBannerCarousel([{ url: eventData.banner_url }]);
      }

      setGallery(eventData.gallery || []);
      setDescription(eventData.description || "");
      setHighlights(eventData.highlights || []);
      setFeaturedAccounts(eventData.featured_accounts || []);
      setThingsToKnow(eventData.things_to_know || []);
      setTicketTypes(eventData.ticket_types || []);
      setDiscountCodes(eventData.discount_codes || []);
      setPricingRules(eventData.pricing_rules || []);
      setCurrentStep(1);

      // Store initial snapshot for change detection
      setInitialSnapshot({
        title: eventData.title || "",
        description: eventData.description || "",
        eventDate: eventData.event_date
          ? new Date(eventData.event_date).toISOString()
          : new Date().toISOString(),
        endDate: eventData.end_datetime
          ? new Date(eventData.end_datetime).toISOString()
          : new Date().toISOString(),
        hasGates: !!eventData.gates_open_time,
        eventType: eventData.event_type || "in-person",
        locationUrl: eventData.location_url || "",
        virtualLink: eventData.virtual_link || "",
        maxAttendees: eventData.max_attendees?.toString() || "",
        bannerCarousel: JSON.stringify(eventData.banner_carousel || []),
        gallery: JSON.stringify(eventData.gallery || []),
        highlights: JSON.stringify(eventData.highlights || []),
        featuredAccounts: JSON.stringify(eventData.featured_accounts || []),
        thingsToKnow: JSON.stringify(eventData.things_to_know || []),
        ticketTypes: JSON.stringify(eventData.ticket_types || []),
        discountCodes: JSON.stringify(eventData.discount_codes || []),
        pricingRules: JSON.stringify(eventData.pricing_rules || []),
      });
    }
  }, [eventData, visible]);

  // Compute if form has changes from initial state
  const hasChanges = useMemo(() => {
    if (!initialSnapshot) return false;
    return (
      title !== initialSnapshot.title ||
      description !== initialSnapshot.description ||
      eventDate.toISOString() !== initialSnapshot.eventDate ||
      endDate.toISOString() !== initialSnapshot.endDate ||
      hasGates !== initialSnapshot.hasGates ||
      eventType !== initialSnapshot.eventType ||
      locationUrl !== initialSnapshot.locationUrl ||
      virtualLink !== initialSnapshot.virtualLink ||
      maxAttendees !== initialSnapshot.maxAttendees ||
      JSON.stringify(bannerCarousel) !== initialSnapshot.bannerCarousel ||
      JSON.stringify(gallery) !== initialSnapshot.gallery ||
      JSON.stringify(highlights) !== initialSnapshot.highlights ||
      JSON.stringify(featuredAccounts) !== initialSnapshot.featuredAccounts ||
      JSON.stringify(thingsToKnow) !== initialSnapshot.thingsToKnow ||
      JSON.stringify(ticketTypes) !== initialSnapshot.ticketTypes ||
      JSON.stringify(discountCodes) !== initialSnapshot.discountCodes ||
      JSON.stringify(pricingRules) !== initialSnapshot.pricingRules
    );
  }, [
    title,
    description,
    eventDate,
    endDate,
    hasGates,
    eventType,
    locationUrl,
    virtualLink,
    maxAttendees,
    bannerCarousel,
    gallery,
    highlights,
    featuredAccounts,
    thingsToKnow,
    ticketTypes,
    discountCodes,
    pricingRules,
    initialSnapshot,
  ]);

  // Handle close with unsaved changes check
  const handleCloseAttempt = () => {
    if (hasChanges) {
      setShowUnsavedModal(true);
    } else {
      onClose();
    }
  };

  // Save and exit handler
  const handleSaveAndExit = async () => {
    setShowUnsavedModal(false);
    await handleSave();
  };

  const validateStep = (step) => {
    if (step === 1) {
      if (!title.trim()) {
        Alert.alert("Required", "Please enter an event title");
        return false;
      }
      if (eventType === "virtual" && !virtualLink.trim()) {
        Alert.alert("Required", "Virtual link is required");
        return false;
      }
      if (
        (eventType === "in-person" || eventType === "hybrid") &&
        !locationUrl.trim()
      ) {
        Alert.alert("Required", "Location is required");
        return false;
      }
    }
    if (step === 2 && bannerCarousel.length === 0) {
      Alert.alert("Required", "Add at least one banner image");
      return false;
    }
    if (step === 3 && description.length < 50) {
      Alert.alert("Required", "Description must be 50+ chars");
      return false;
    }
    if (step === 6 && thingsToKnow.length < 3) {
      Alert.alert("Required", 'Add at least 3 "Things to Know" items');
      return false;
    }
    return true;
  };

  const handleNext = () =>
    validateStep(currentStep) && setCurrentStep(currentStep + 1);
  const handleBack = () => setCurrentStep(currentStep - 1);

  const handleSave = async () => {
    setLoading(true);
    try {
      const updateData = {
        title: title.trim(),
        description: description.trim(),
        start_datetime: eventDate.toISOString(),
        end_datetime: endDate.toISOString(),
        gates_open_time:
          hasGates && gatesOpenTime ? gatesOpenTime.toISOString() : null,
        location_url: locationUrl.trim() || null,
        max_attendees: maxAttendees ? parseInt(maxAttendees) : null,
        event_type: eventType,
        virtual_link: virtualLink.trim() || null,
        banner_carousel: bannerCarousel,
        gallery,
        highlights,
        featured_accounts: featuredAccounts,
        things_to_know: thingsToKnow,
        ticket_types: ticketTypes.length > 0 ? ticketTypes : null,
        discount_codes: discountCodes.length > 0 ? discountCodes : null,
        pricing_rules: pricingRules.length > 0 ? pricingRules : null,
      };

      const result = await updateEvent(eventData.id, updateData);
      if (result?.success) {
        onEventUpdated?.(result.event);
        onClose();
      } else {
        Alert.alert("Error", result?.error || "Failed to update event");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update event. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <ScrollView
            style={styles.stepContent}
            contentContainerStyle={styles.scrollContent}
          >
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
              <Ionicons
                name="calendar-outline"
                size={20}
                color={PRIMARY_COLOR}
              />
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
                {eventDate.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </TouchableOpacity>

            {(showDatePicker || showTimePicker) && (
              <DateTimePicker
                value={eventDate}
                mode={showDatePicker ? "date" : "time"}
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  setShowTimePicker(false);
                  if (selectedDate) {
                    const combined = new Date(eventDate);
                    if (showDatePicker) {
                      combined.setFullYear(
                        selectedDate.getFullYear(),
                        selectedDate.getMonth(),
                        selectedDate.getDate()
                      );
                    } else {
                      combined.setHours(
                        selectedDate.getHours(),
                        selectedDate.getMinutes()
                      );
                    }
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
                <Text
                  style={[
                    styles.toggleText,
                    hasGates && styles.toggleTextActive,
                  ]}
                >
                  {hasGates ? "Yes" : "No"}
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
                    ? gatesOpenTime.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Set gates open time"}
                </Text>
              </TouchableOpacity>
            )}

            <Text style={styles.label}>Event Type *</Text>
            <View style={styles.eventTypeRow}>
              {["in-person", "virtual", "hybrid"].map((type) => (
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

            <TicketTypesEditor
              ticketTypes={ticketTypes}
              onChange={setTicketTypes}
            />
            <DiscountCodesEditor
              discountCodes={discountCodes}
              onChange={setDiscountCodes}
            />
            <PricingRulesEditor
              pricingRules={pricingRules}
              onChange={setPricingRules}
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
            <Text style={styles.stepTitle}>Description</Text>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              minLength={50}
              maxLength={2000}
            />
          </ScrollView>
        );
      case 4:
        return (
          <ScrollView style={styles.stepContent}>
            <Text style={styles.stepTitle}>Highlights</Text>
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
            <Text style={styles.stepTitle}>Featured</Text>
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
            <ThingsToKnowEditor
              items={thingsToKnow}
              onChange={setThingsToKnow}
              minItems={3}
            />
          </ScrollView>
        );
      case 7:
        return (
          <ScrollView
            style={styles.stepContent}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            <Text style={styles.stepTitle}>Review</Text>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Title</Text>
              <Text style={styles.reviewValue}>{title}</Text>
            </View>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewLabel}>Type</Text>
              <Text style={styles.reviewValue}>{eventType}</Text>
            </View>
            <View style={styles.infoBanner}>
              <Ionicons
                name="information-circle"
                size={20}
                color={PRIMARY_COLOR}
              />
              <Text style={styles.infoText}>
                Attendees will be notified of key changes.
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
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCloseAttempt}>
            <Ionicons name="close" size={28} color={TEXT_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Event</Text>
          <TouchableOpacity
            disabled={!hasChanges || loading}
            onPress={handleSave}
            style={[
              styles.saveHeaderButton,
              hasChanges && !loading && styles.saveHeaderButtonActive,
              (!hasChanges || loading) && styles.saveHeaderDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : hasChanges ? (
              <LinearGradient
                colors={COLORS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveHeaderGradient}
              >
                <Text style={styles.saveHeaderTextActive}>Save</Text>
              </LinearGradient>
            ) : (
              <Text style={styles.saveHeaderTextDisabled}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <StepIndicator
          currentStep={currentStep}
          totalSteps={7}
          stepLabels={stepLabels}
        />

        {renderStep()}

        <View style={styles.footer}>
          {currentStep > 1 && (
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={20} color={PRIMARY_COLOR} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}

          {currentStep < 7 ? (
            <TouchableOpacity
              style={styles.nextButtonWrapper}
              onPress={handleNext}
            >
              <LinearGradient
                colors={COLORS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.fullButtonGradient}
              >
                <Text style={styles.nextButtonText}>Next</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.nextButtonWrapper}
              onPress={handleSave}
              disabled={loading}
            >
              <LinearGradient
                colors={["#34C759", "#2FB350"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.fullButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.nextButtonText}>Save Changes</Text>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#FFFFFF"
                    />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* Unsaved Changes Modal */}
      <Modal visible={showUnsavedModal} transparent animationType="fade">
        <View style={styles.unsavedOverlay}>
          <View style={styles.unsavedCard}>
            {/* Warning Icon */}
            <View style={styles.unsavedIconContainer}>
              <LinearGradient
                colors={["#FF9500", "#FF6B00"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.unsavedIconGradient}
              >
                <Ionicons name="alert" size={28} color="#FFF" />
              </LinearGradient>
            </View>

            {/* Title & Message */}
            <Text style={styles.unsavedTitle}>Unsaved Changes</Text>
            <Text style={styles.unsavedMessage}>
              You have unsaved changes that will be lost if you leave now.
            </Text>

            {/* Primary Action - Save & Exit */}
            <TouchableOpacity
              style={styles.unsavedPrimaryBtnWrapper}
              onPress={handleSaveAndExit}
            >
              <LinearGradient
                colors={COLORS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.unsavedPrimaryBtn}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                <Text style={styles.unsavedPrimaryText}>Save & Exit</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Secondary Action - Discard */}
            <TouchableOpacity
              style={styles.unsavedSecondaryBtn}
              onPress={() => {
                setShowUnsavedModal(false);
                onClose();
              }}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
              <Text style={styles.unsavedSecondaryText}>Discard Changes</Text>
            </TouchableOpacity>

            {/* Cancel Action - Keep Editing */}
            <TouchableOpacity
              style={styles.unsavedCancelBtn}
              onPress={() => setShowUnsavedModal(false)}
            >
              <Text style={styles.unsavedCancelText}>Keep Editing</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  headerTitle: { fontSize: 18, fontWeight: "600", color: TEXT_COLOR },
  stepContent: { flex: 1, padding: 20 },
  scrollContent: { paddingBottom: 40 },
  stepTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: TEXT_COLOR,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: TEXT_COLOR,
    backgroundColor: "#F9FAFB",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    gap: 10,
  },
  dateButtonText: { fontSize: 14, color: TEXT_COLOR },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  toggle: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: BORDER_COLOR,
    backgroundColor: "#FFFFFF",
  },
  toggleActive: { borderColor: PRIMARY_COLOR, backgroundColor: PRIMARY_COLOR },
  toggleText: { fontSize: 14, fontWeight: "600", color: TEXT_COLOR },
  toggleTextActive: { color: "#FFFFFF" },
  eventTypeRow: { flexDirection: "row", gap: 10 },
  eventTypeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    alignItems: "center",
  },
  eventTypeButtonActive: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: "#F0F9FF",
  },
  eventTypeText: { fontSize: 13, fontWeight: "500", color: LIGHT_TEXT_COLOR },
  eventTypeTextActive: { color: PRIMARY_COLOR, fontWeight: "600" },
  reviewSection: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  reviewLabel: { fontSize: 13, color: LIGHT_TEXT_COLOR, marginBottom: 4 },
  reviewValue: { fontSize: 16, fontWeight: "500", color: TEXT_COLOR },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0F9FF",
    padding: 14,
    borderRadius: 12,
    gap: 10,
    marginTop: 20,
  },
  infoText: { flex: 1, fontSize: 13, color: TEXT_COLOR, lineHeight: 18 },
  footer: {
    flexDirection: "row",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
    gap: 10,
  },
  backButton: {
    flex: 1,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 30,
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
    backgroundColor: "#FFFFFF",
    gap: 8,
  },
  backButtonText: { fontSize: 16, fontWeight: "600", color: PRIMARY_COLOR },
  nextButtonWrapper: {
    flex: 1,
    height: 50,
    borderRadius: 30,
    overflow: "hidden",
  },
  fullButtonGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  nextButtonText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },

  // Header Save Button
  saveHeaderButton: {
    borderRadius: 16,
    overflow: "hidden",
  },
  saveHeaderButtonActive: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  saveHeaderDisabled: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  saveHeaderGradient: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  saveHeaderTextActive: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  saveHeaderTextDisabled: {
    fontSize: 15,
    fontWeight: "600",
    color: "#9CA3AF",
  },

  // Unsaved Changes Modal
  unsavedOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  unsavedCard: {
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 10,
  },
  unsavedIconContainer: {
    marginBottom: 16,
  },
  unsavedIconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  unsavedTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  unsavedMessage: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  unsavedPrimaryBtnWrapper: {
    width: "100%",
    borderRadius: 30,
    overflow: "hidden",
    marginBottom: 12,
  },
  unsavedPrimaryBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  unsavedPrimaryText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  unsavedSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 6,
  },
  unsavedSecondaryText: {
    fontSize: 14,
    color: "#EF4444",
    fontWeight: "600",
  },
  unsavedCancelBtn: {
    paddingVertical: 8,
  },
  unsavedCancelText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
});
