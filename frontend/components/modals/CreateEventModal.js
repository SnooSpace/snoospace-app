import React, { useState, useEffect, useRef } from "react";
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
import { COLORS, SHADOWS } from "../../constants/theme";
import DateTimePicker from "@react-native-community/datetimepicker";
import PropTypes from "prop-types";
import { createEvent } from "../../api/events";
import { isValidGoogleMapsUrl } from "../../utils/validateGoogleMapsUrl";

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
import CategorySelector from "../CategorySelector";

// Draft storage utilities
import {
  saveDraft as saveDraftUtil,
  loadDraft as loadDraftUtil,
  deleteDraft as deleteDraftUtil,
  hasDraft,
  formatLastSaved,
} from "../../utils/draftStorage";
import { getActiveAccount } from "../../api/auth";

const PRIMARY_COLOR = COLORS.primary; // Assumed Blue/Cyan
const TEXT_COLOR = "#1F2937";
const LIGHT_TEXT_COLOR = "#6B7280";
const BORDER_COLOR = "#E5E7EB";

const CreateEventModal = ({ visible, onClose, onEventCreated }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [creating, setCreating] = useState(false);

  // Form States
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [gatesOpenTime, setGatesOpenTime] = useState(null);
  const [hasGates, setHasGates] = useState(false);
  const [eventType, setEventType] = useState("in-person");
  const [locationUrl, setLocationUrl] = useState("");
  const [locationName, setLocationName] = useState("");
  const [virtualLink, setVirtualLink] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");
  const [ticketTypes, setTicketTypes] = useState([]);
  const [discountCodes, setDiscountCodes] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [categories, setCategories] = useState([]);
  const [bannerCarousel, setBannerCarousel] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [description, setDescription] = useState("");
  const [highlights, setHighlights] = useState([]);
  const [featuredAccounts, setFeaturedAccounts] = useState([]);
  const [thingsToKnow, setThingsToKnow] = useState([]);
  // Event visibility
  const [accessType, setAccessType] = useState("public"); // 'public' or 'invite_only'
  const [invitePublicVisibility, setInvitePublicVisibility] = useState(false); // Show in feeds with hidden location

  // UI States
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showGatesTimePicker, setShowGatesTimePicker] = useState(false);
  const [hasEndTime, setHasEndTime] = useState(false);
  const [draftExists, setDraftExists] = useState(false);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [draftLastSaved, setDraftLastSaved] = useState(null);

  // Scroll ref for auto-scrolling when category dropdown opens
  const scrollViewRef = useRef(null);

  const resetForm = () => {
    setCurrentStep(1);
    setTitle("");
    setEventDate(new Date());
    setEndDate(new Date());
    setHasEndTime(false);
    setGatesOpenTime(null);
    setHasGates(false);
    setEventType("in-person");
    setLocationUrl("");
    setLocationName("");
    setVirtualLink("");
    setMaxAttendees("");
    setTicketTypes([]);
    setCategories([]);
    setBannerCarousel([]);
    setGallery([]);
    setDescription("");
    setHighlights([]);
    setFeaturedAccounts([]);
    setThingsToKnow([]);
    setAccessType("public");
    setInvitePublicVisibility(false);
  };

  const getCurrentFormData = () => ({
    title: title.trim(),
    event_date: eventDate.toISOString(),
    start_datetime: eventDate.toISOString(),
    end_datetime: hasEndTime ? endDate.toISOString() : null,
    has_end_time: hasEndTime,
    gates_open_time: gatesOpenTime ? gatesOpenTime.toISOString() : null,
    has_gates: hasGates,
    event_type: eventType,
    location_url: locationUrl,
    location_name: locationName.trim(),
    virtual_link: virtualLink,
    max_attendees: maxAttendees,
    ticket_types: ticketTypes,
    discount_codes: discountCodes,
    pricing_rules: pricingRules,
    categories: categories,
    banner_carousel: bannerCarousel,
    gallery: gallery,
    description: description,
    highlights: highlights,
    highlighted_accounts: featuredAccounts,
    things_to_know: thingsToKnow,
    access_type: accessType,
    invite_public_visibility: invitePublicVisibility,
  });

  const saveDraft = async (silent = false) => {
    try {
      const account = await getActiveAccount();
      if (!account?.id) return;
      await saveDraftUtil(account.id, currentStep, getCurrentFormData());
      if (!silent)
        Alert.alert("Draft Saved", "Your event draft has been saved");
    } catch (error) {
      if (!silent) Alert.alert("Error", "Failed to save draft");
    }
  };

  const loadDraftData = async () => {
    try {
      const account = await getActiveAccount();
      const draft = await loadDraftUtil(account.id);
      if (draft && draft.data) {
        setTitle(draft.data.title || "");

        // Handle both old camelCase and new snake_case keys for backward compatibility with existing drafts
        const dateStr = draft.data.event_date || draft.data.eventDate;
        if (dateStr) setEventDate(new Date(dateStr));

        const hasEnd =
          draft.data.has_end_time !== undefined
            ? draft.data.has_end_time
            : draft.data.hasEndTime;
        const endStr = draft.data.end_datetime || draft.data.endDate;

        if (hasEnd && endStr) {
          setEndDate(new Date(endStr));
          setHasEndTime(true);
        } else {
          setHasEndTime(false);
        }

        setHasGates(
          draft.data.has_gates !== undefined
            ? draft.data.has_gates
            : draft.data.hasGates || false
        );
        setEventType(
          draft.data.event_type || draft.data.eventType || "in-person"
        );
        setLocationUrl(draft.data.location_url || draft.data.locationUrl || "");
        setLocationName(draft.data.location_name || "");
        setVirtualLink(draft.data.virtual_link || draft.data.virtualLink || "");
        setBannerCarousel(
          draft.data.banner_carousel || draft.data.bannerCarousel || []
        );
        setGallery(draft.data.gallery || []);
        setDescription(draft.data.description || "");
        setHighlights(draft.data.highlights || []);
        setFeaturedAccounts(
          draft.data.featured_accounts || draft.data.featuredAccounts || []
        );
        setThingsToKnow(
          draft.data.things_to_know || draft.data.thingsToKnow || []
        );

        // Also load categories if they exist
        if (draft.data.categories) setCategories(draft.data.categories);
        // Load ticket types
        if (draft.data.ticket_types) setTicketTypes(draft.data.ticket_types);

        setCurrentStep(draft.currentStep || 1);
        setShowDraftPrompt(false);
      }
    } catch (error) {
      console.error("[CreateEventModal] Error loading draft:", error);
      Alert.alert("Error", "Failed to load draft");
    }
  };

  const deleteDraftData = async () => {
    const account = await getActiveAccount();
    await deleteDraftUtil(account.id);
    setDraftExists(false);
  };

  const checkForDraft = async () => {
    const account = await getActiveAccount();
    if (!account?.id) return;
    const exists = await hasDraft(account.id);
    if (exists) {
      const draft = await loadDraftUtil(account.id);
      setDraftLastSaved(draft.lastSaved);
      setShowDraftPrompt(true);
    }
  };

  useEffect(() => {
    if (visible) checkForDraft();
  }, [visible]);

  const handleClose = () => {
    if (title.trim() === "" && bannerCarousel.length === 0) {
      onClose();
      return;
    }
    Alert.alert("Save Draft?", "Would you like to save your progress?", [
      {
        text: "Discard",
        style: "destructive",
        onPress: async () => {
          await deleteDraftData();
          resetForm();
          onClose();
        },
      },
      { text: "Cancel", style: "cancel" },
      {
        text: "Save Draft",
        onPress: async () => {
          await saveDraft(true);
          onClose();
        },
      },
    ]);
  };

  const validateStep = (step) => {
    if (step === 1) {
      if (!title.trim()) {
        Alert.alert("Required", "Enter an event title");
        return false;
      }
      if (eventType !== "virtual" && !isValidGoogleMapsUrl(locationUrl)) {
        Alert.alert("Invalid URL", "Please paste a valid Google Maps link");
        return false;
      }
      if (ticketTypes.length === 0) {
        Alert.alert("Required", "Add at least one ticket type");
        return false;
      }
      if (categories.length === 0) {
        Alert.alert("Required", "Select at least one category");
        return false;
      }
    }
    if (step === 2 && bannerCarousel.length === 0) {
      Alert.alert("Required", "Add a banner image");
      return false;
    }
    if (step === 3 && description.length < 50) {
      Alert.alert("Required", "Description must be 50+ chars");
      return false;
    }
    if (step === 6 && thingsToKnow.length < 3) {
      Alert.alert("Required", "Add at least 3 items");
      return false;
    }
    return true;
  };

  const handleNext = () =>
    validateStep(currentStep) && setCurrentStep(currentStep + 1);
  const handleBack = () => setCurrentStep(currentStep - 1);

  const [creationError, setCreationError] = useState(null);

  const handleCreate = async () => {
    setCreating(true);
    setCreationError(null);
    try {
      const response = await createEvent(getCurrentFormData());
      if (response?.event) {
        Alert.alert("Success", "Event created successfully!", [
          {
            text: "OK",
            onPress: () => {
              resetForm();
              onEventCreated?.(response.event);
              onClose();
            },
          },
        ]);
      }
    } catch (error) {
      console.error(error);
      setCreationError(
        "Don't worry, we've saved your progress. Please try again."
      );
    } finally {
      setCreating(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <ScrollView
            ref={scrollViewRef}
            style={styles.stepContent}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={styles.stepTitle}>Basic Information</Text>
            <Text style={styles.label}>Event Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="What is the name of your event?"
              placeholderTextColor={LIGHT_TEXT_COLOR}
            />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Date *</Text>
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
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Start Time *</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons
                    name="time-outline"
                    size={20}
                    color={PRIMARY_COLOR}
                  />
                  <Text style={styles.dateButtonText}>
                    {eventDate.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* End Time - Optional */}
            <View
              style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>End Time (Optional)</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowEndTimePicker(true)}
                >
                  <Ionicons
                    name="time-outline"
                    size={20}
                    color={hasEndTime ? PRIMARY_COLOR : LIGHT_TEXT_COLOR}
                  />
                  <Text
                    style={[
                      styles.dateButtonText,
                      !hasEndTime && { color: LIGHT_TEXT_COLOR },
                    ]}
                  >
                    {hasEndTime
                      ? endDate.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Not set"}
                  </Text>
                </TouchableOpacity>
              </View>
              {hasEndTime && (
                <TouchableOpacity
                  style={{ paddingBottom: 12 }}
                  onPress={() => {
                    setHasEndTime(false);
                    setEndDate(new Date(eventDate));
                  }}
                >
                  <Ionicons
                    name="close-circle"
                    size={24}
                    color={LIGHT_TEXT_COLOR}
                  />
                </TouchableOpacity>
              )}
            </View>

            {(showDatePicker || showTimePicker) && (
              <DateTimePicker
                value={eventDate}
                mode={showDatePicker ? "date" : "time"}
                onChange={(e, date) => {
                  setShowDatePicker(false);
                  setShowTimePicker(false);
                  if (date) {
                    const combined = new Date(date);
                    setEventDate(combined);
                    // If end time is set, adjust it if it's now before the start time
                    if (hasEndTime) {
                      if (endDate < combined) {
                        // If start moves past end, reset end to same as start
                        setEndDate(combined);
                      }
                    }
                  }
                }}
              />
            )}

            {showEndTimePicker && (
              <DateTimePicker
                value={endDate}
                mode="time"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowEndTimePicker(false);
                  if (selectedDate) {
                    // Start with the same date as eventDate
                    const nextEndDate = new Date(eventDate);
                    nextEndDate.setHours(
                      selectedDate.getHours(),
                      selectedDate.getMinutes(),
                      0,
                      0
                    );

                    // If the selected time is earlier than the start time,
                    // assume it's for the next day (e.g., 7 PM to 2 AM)
                    if (nextEndDate < eventDate) {
                      nextEndDate.setDate(nextEndDate.getDate() + 1);
                    }

                    setEndDate(nextEndDate);
                    setHasEndTime(true);
                  }
                }}
              />
            )}

            <Text style={styles.label}>Event Type *</Text>
            <View style={styles.eventTypeRow}>
              {["in-person", "virtual", "hybrid"].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={styles.pillWrapper}
                  onPress={() => setEventType(type)}
                >
                  {eventType === type ? (
                    <LinearGradient
                      colors={COLORS.primaryGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.pillActive}
                    >
                      <Text style={styles.pillTextActive}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.pillInactive}>
                      <Text style={styles.pillText}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Event Visibility */}
            <Text style={styles.label}>Event Visibility *</Text>
            <View style={styles.eventTypeRow}>
              {[
                { value: "public", label: "Public", icon: "globe-outline" },
                {
                  value: "invite_only",
                  label: "Invite Only",
                  icon: "lock-closed-outline",
                },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.pillWrapper}
                  onPress={() => setAccessType(opt.value)}
                >
                  {accessType === opt.value ? (
                    <LinearGradient
                      colors={COLORS.primaryGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.pillActive,
                        { flexDirection: "row", alignItems: "center", gap: 6 },
                      ]}
                    >
                      <Ionicons name={opt.icon} size={14} color="#fff" />
                      <Text style={styles.pillTextActive}>{opt.label}</Text>
                    </LinearGradient>
                  ) : (
                    <View
                      style={[
                        styles.pillInactive,
                        { flexDirection: "row", alignItems: "center", gap: 6 },
                      ]}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={14}
                        color={LIGHT_TEXT_COLOR}
                      />
                      <Text style={styles.pillText}>{opt.label}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* For invite-only: option to show in feeds with hidden location */}
            {accessType === "invite_only" && (
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() =>
                  setInvitePublicVisibility(!invitePublicVisibility)
                }
              >
                <View
                  style={[
                    styles.checkbox,
                    invitePublicVisibility && styles.checkboxChecked,
                  ]}
                >
                  {invitePublicVisibility && (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>
                  Show in discover feed (location hidden until invited)
                </Text>
              </TouchableOpacity>
            )}

            {eventType !== "virtual" && (
              <>
                <Text style={styles.label}>Location *</Text>
                <TextInput
                  style={styles.input}
                  value={locationUrl}
                  onChangeText={setLocationUrl}
                  placeholder="Paste Google Maps Link"
                  placeholderTextColor={LIGHT_TEXT_COLOR}
                />
                <Text style={styles.label}>Location Name (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={locationName}
                  onChangeText={setLocationName}
                  placeholder="e.g. Ground Floor, Sector 5"
                  placeholderTextColor={LIGHT_TEXT_COLOR}
                />
              </>
            )}

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

            {/* Event Categories for Discover Feed */}
            <CategorySelector
              selectedCategories={categories}
              onChange={setCategories}
              maxCategories={4}
              onExpand={() => {
                // Auto-scroll down when dropdown opens so it's visible
                setTimeout(() => {
                  scrollViewRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }}
            />
          </ScrollView>
        );
      case 2:
        return (
          <ScrollView style={styles.stepContent}>
            <Text style={styles.stepTitle}>Media</Text>
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
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={styles.stepTitle}>Review</Text>
            <Text style={styles.reviewSubtitle}>
              Check your event details before publishing
            </Text>

            <View style={styles.reviewCard}>
              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Event Title</Text>
                <Text style={styles.reviewValue}>
                  {title || "No title set"}
                </Text>
              </View>

              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Date & Time</Text>
                <Text style={styles.reviewValue}>
                  {eventDate.toLocaleDateString()} at{" "}
                  {eventDate.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
                {hasEndTime && (
                  <Text style={styles.reviewSubValue}>
                    Ends:{" "}
                    {endDate.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {endDate.getDate() !== eventDate.getDate()
                      ? ` (${endDate.toLocaleDateString()})`
                      : ""}
                  </Text>
                )}
              </View>

              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Event Type</Text>
                <Text style={styles.reviewValue}>
                  {eventType.charAt(0).toUpperCase() + eventType.slice(1)}
                </Text>
              </View>

              {eventType !== "virtual" ? (
                <View style={styles.reviewSection}>
                  <Text style={styles.reviewLabel}>Location</Text>
                  <Text style={styles.reviewValue} numberOfLines={2}>
                    {locationUrl || "No location URL set"}
                  </Text>
                  {locationName ? (
                    <Text
                      style={[
                        styles.reviewValue,
                        { fontWeight: "600", marginTop: 4 },
                      ]}
                    >
                      Display Name: {locationName}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <View style={styles.reviewSection}>
                  <Text style={styles.reviewLabel}>Virtual Link</Text>
                  <Text style={styles.reviewValue} numberOfLines={2}>
                    {virtualLink || "No link set"}
                  </Text>
                </View>
              )}

              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Ticket Tiers</Text>
                {ticketTypes.map((t, idx) => (
                  <Text key={idx} style={styles.reviewValue}>
                    • {t.name}: ₹{t.base_price} ({t.total_quantity} qty)
                  </Text>
                ))}
              </View>

              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Categories</Text>
                <Text style={styles.reviewValue}>
                  {categories.length > 0
                    ? `${categories.length} categories selected`
                    : "None selected"}
                </Text>
              </View>

              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Media</Text>
                <Text style={styles.reviewValue}>
                  {bannerCarousel.length} Banners, {gallery.length} Gallery
                  images
                </Text>
              </View>

              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Description</Text>
                <Text style={styles.reviewValue} numberOfLines={3}>
                  {description
                    ? description.replace(/<[^>]*>?/gm, "")
                    : "No description"}
                </Text>
              </View>

              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Highlights</Text>
                {highlights.length > 0 ? (
                  highlights.map((h, idx) => (
                    <Text key={idx} style={styles.reviewValue}>
                      • {h.title}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.reviewValue}>None</Text>
                )}
              </View>

              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Featured Accounts</Text>
                {featuredAccounts.length > 0 ? (
                  featuredAccounts.map((a, idx) => (
                    <Text key={idx} style={styles.reviewValue}>
                      • {a.display_name || a.account_name} ({a.role})
                    </Text>
                  ))
                ) : (
                  <Text style={styles.reviewValue}>None</Text>
                )}
              </View>

              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Things to Know</Text>
                {thingsToKnow.length > 0 ? (
                  thingsToKnow.map((item, idx) => (
                    <Text key={idx} style={styles.reviewValue}>
                      • {item.label}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.reviewValue}>None</Text>
                )}
              </View>
            </View>
          </ScrollView>
        );
      default:
        return (
          <ScrollView style={styles.stepContent}>
            <Text style={styles.stepTitle}>Coming Soon</Text>
          </ScrollView>
        );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={28} color={TEXT_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Event</Text>
          <View style={{ width: 28 }} />
        </View>

        <StepIndicator currentStep={currentStep} totalSteps={7} />

        {renderStep()}

        <View style={styles.footer}>
          {creationError && (
            <View
              style={{
                position: "absolute",
                bottom: 80,
                left: 20,
                right: 20,
                backgroundColor: "#FEF2F2",
                padding: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#FECACA",
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text style={{ marginLeft: 8, color: "#DC2626", flex: 1 }}>
                {creationError}
              </Text>
            </View>
          )}

          {currentStep > 1 && (
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Ionicons name="arrow-back" size={20} color={PRIMARY_COLOR} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.nextButtonWrapper}
            onPress={currentStep < 7 ? handleNext : handleCreate}
            disabled={creating}
          >
            <LinearGradient
              colors={
                currentStep < 7
                  ? COLORS.primaryGradient
                  : ["#34C759", "#2FB350"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.fullButtonGradient}
            >
              {creating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.nextButtonText}>
                    {currentStep < 7 ? "Next" : "Publish"}
                  </Text>
                  <Ionicons
                    name={
                      currentStep < 7 ? "arrow-forward" : "checkmark-circle"
                    }
                    size={20}
                    color="#FFFFFF"
                  />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <Modal visible={showDraftPrompt} transparent animationType="fade">
          <View style={styles.draftPromptOverlay}>
            <View style={styles.draftPromptContainer}>
              <Ionicons
                name="save-outline"
                size={48}
                color={PRIMARY_COLOR}
                style={{ alignSelf: "center", marginBottom: 15 }}
              />
              <Text style={styles.draftPromptTitle}>Resume Draft?</Text>
              <Text style={styles.draftPromptSubtitle}>
                Last saved{" "}
                {draftLastSaved ? formatLastSaved(draftLastSaved) : "recently"}
              </Text>
              <TouchableOpacity
                style={styles.draftMainButton}
                onPress={loadDraftData}
              >
                <Text style={styles.draftMainButtonText}>Continue Editing</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.draftSecondaryButton}
                onPress={() => {
                  setShowDraftPrompt(false);
                  resetForm();
                }}
              >
                <Text style={styles.draftSecondaryButtonText}>Start Fresh</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

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
    fontSize: 24,
    fontWeight: "700",
    color: TEXT_COLOR,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_COLOR,
    marginTop: 15,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: TEXT_COLOR,
    backgroundColor: "#F9FAFB",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
  },
  dateButtonText: { marginLeft: 10, fontSize: 14, color: TEXT_COLOR, flex: 1 },
  eventTypeRow: { flexDirection: "row", gap: 10, marginTop: 5 },
  pillWrapper: { flex: 1, height: 45 },
  pillInactive: {
    flex: 1,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  pillActive: {
    flex: 1,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  pillText: { fontSize: 14, fontWeight: "600", color: LIGHT_TEXT_COLOR },
  pillTextActive: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
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
  },
  backButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "600",
    color: PRIMARY_COLOR,
  },
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
  reviewSubtitle: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    marginBottom: 20,
  },
  reviewCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  reviewSection: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 12,
  },
  reviewLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: LIGHT_TEXT_COLOR,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  reviewValue: {
    fontSize: 15,
    fontWeight: "600",
    color: TEXT_COLOR,
    lineHeight: 20,
  },
  reviewSubValue: {
    fontSize: 13,
    color: LIGHT_TEXT_COLOR,
    marginTop: 2,
  },
  // Draft Modal
  draftPromptOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  draftPromptContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 30,
  },
  draftPromptTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    color: TEXT_COLOR,
  },
  draftPromptSubtitle: {
    fontSize: 14,
    color: LIGHT_TEXT_COLOR,
    textAlign: "center",
    marginBottom: 25,
    marginTop: 5,
  },
  draftMainButton: {
    backgroundColor: PRIMARY_COLOR,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  draftMainButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  draftSecondaryButton: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    alignItems: "center",
  },
  draftSecondaryButtonText: { color: TEXT_COLOR, fontWeight: "600" },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 15,
  },
  toggle: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: BORDER_COLOR,
  },
  toggleActive: { borderColor: PRIMARY_COLOR, backgroundColor: PRIMARY_COLOR },
  toggleText: { fontSize: 14, fontWeight: "600", color: LIGHT_TEXT_COLOR },
  toggleTextActive: { color: "#FFFFFF" },
  // Checkbox styles for visibility toggle
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: BORDER_COLOR,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  checkboxChecked: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  checkboxLabel: {
    fontSize: 14,
    color: TEXT_COLOR,
    flex: 1,
  },
});

export default CreateEventModal;
