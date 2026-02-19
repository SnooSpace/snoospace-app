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
  Animated,
  LayoutAnimation,
  UIManager,
  Easing,
  TouchableHighlight,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  Calendar1 as Calendar,
  Clock,
  Ticket,
  Flag,
  Users,
  Video,
  Layers,
  Globe,
  Lock,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  PlusCircle,
  XCircle,
  ArrowRight,
  Info,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SHADOWS } from "../../constants/theme";
import CustomDatePicker from "../ui/CustomDatePicker";
import CustomTimePicker from "../ui/CustomTimePicker";
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

const MODAL_TOKENS = {
  primary: "#3565F2",
  primaryGradient: ["#3565F2", "#2F56D6"],
  surface: "#F5F8FF", // Surface Tint
  background: "#FFFFFF",
  border: "#E6ECF8",
  textPrimary: "#1F2937",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  error: "#EF4444",
  success: "#10B981",
  radius: {
    xs: 8,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 24,
  },
  shadow: {
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
  },
  fonts: {
    regular: "Manrope-Regular",
    medium: "Manrope-Medium",
    semibold: "Manrope-SemiBold",
    bold: "BasicCommercial-Bold", // Only for major headings
  },
};

const STEP_TITLES = {
  1: "Basic Information",
  2: "Media",
  3: "Description",
  4: "Highlights",
  5: "Featured Accounts",
  6: "Things to Know",
  7: "Review",
};

const CreateEventModal = ({ visible, onClose, onEventCreated }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 7;
  // Progress calculation
  const progressPercent = useRef(new Animated.Value(0)).current;

  // Enable LayoutAnimation for Android
  useEffect(() => {
    if (Platform.OS === "android") {
      if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
      }
    }
  }, []);

  useEffect(() => {
    Animated.timing(progressPercent, {
      toValue: currentStep / totalSteps,
      duration: 300,
      useNativeDriver: false, // width doesn't support native driver
    }).start();
  }, [currentStep]);
  // Sliding Segment Control Logic
  const [tabWidth, setTabWidth] = useState(0);

  const handleEventTypeChange = (type) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEventType(type);
  };

  const getActiveTabLeft = () => {
    let index = 0;
    if (eventType === "virtual") index = 1;
    else if (eventType === "hybrid") index = 2;
    // 6px padding + index * tabWidth
    return 6 + index * tabWidth;
  };

  const [creating, setCreating] = useState(false);

  // Form States
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
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
  const [hasTime, setHasTime] = useState(false); // true once user explicitly picks a time
  const [draftExists, setDraftExists] = useState(false);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [draftLastSaved, setDraftLastSaved] = useState(null);

  // Scroll ref for auto-scrolling when category dropdown opens
  const scrollViewRef = useRef(null);

  const resetForm = () => {
    setCurrentStep(1);
    setTitle("");
    setEventDate(null);
    setEndDate(null);
    setHasEndTime(false);
    setHasTime(false);
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
            : draft.data.hasGates || false,
        );
        setEventType(
          draft.data.event_type || draft.data.eventType || "in-person",
        );
        setLocationUrl(draft.data.location_url || draft.data.locationUrl || "");
        setLocationName(draft.data.location_name || "");
        setVirtualLink(draft.data.virtual_link || draft.data.virtualLink || "");
        setBannerCarousel(
          draft.data.banner_carousel || draft.data.bannerCarousel || [],
        );
        setGallery(draft.data.gallery || []);
        setDescription(draft.data.description || "");
        setHighlights(draft.data.highlights || []);
        setFeaturedAccounts(
          draft.data.featured_accounts || draft.data.featuredAccounts || [],
        );
        setThingsToKnow(
          draft.data.things_to_know || draft.data.thingsToKnow || [],
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
        "Don't worry, we've saved your progress. Please try again.",
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
            {/* Event Identity Section */}
            <View style={styles.sectionBlock}>
              <Text style={styles.label}>Event Title</Text>
              <View style={styles.titleInputContainer}>
                <TextInput
                  style={styles.titleInput}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Name your event"
                  placeholderTextColor={MODAL_TOKENS.textMuted}
                  autoFocus={true}
                />
              </View>
            </View>

            {/* Date & Time Section */}
            <View style={styles.sectionBlock}>
              <Text style={styles.label}>Date & Time</Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                {/* Start Date Card */}
                <TouchableOpacity
                  style={styles.dateCard}
                  onPress={() => setShowDatePicker(true)}
                >
                  <View style={styles.dateCardIconInfo}>
                    <Calendar size={16} color={MODAL_TOKENS.primary} />
                  </View>
                  <View>
                    <Text style={styles.dateCardLabel}>Date</Text>
                    <Text
                      style={[
                        styles.dateCardValue,
                        !eventDate && { color: MODAL_TOKENS.textMuted },
                      ]}
                    >
                      {eventDate
                        ? eventDate.toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                          })
                        : "Pick date"}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Start Time Card */}
                <TouchableOpacity
                  style={styles.dateCard}
                  onPress={() => setShowTimePicker(true)}
                >
                  <View style={styles.dateCardIconInfo}>
                    <Clock size={16} color={MODAL_TOKENS.primary} />
                  </View>
                  <View>
                    <Text style={styles.dateCardLabel}>Start Time</Text>
                    <Text
                      style={[
                        styles.dateCardValue,
                        (!eventDate || !hasTime) && {
                          color: MODAL_TOKENS.textMuted,
                        },
                      ]}
                    >
                      {eventDate && hasTime
                        ? eventDate.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Pick time"}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* End Time / Ghost Card */}
                {hasEndTime ? (
                  <TouchableOpacity
                    style={styles.dateCard}
                    onPress={() => setShowEndTimePicker(true)}
                  >
                    <View
                      style={[
                        styles.dateCardIconInfo,
                        { backgroundColor: "#F3E5F5" },
                      ]}
                    >
                      <Flag size={16} color="#9C27B0" />
                    </View>
                    <View>
                      <Text style={styles.dateCardLabel}>End Time</Text>
                      <Text
                        style={[
                          styles.dateCardValue,
                          !endDate && { color: MODAL_TOKENS.textMuted },
                        ]}
                      >
                        {endDate
                          ? endDate.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Pick time"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={{ position: "absolute", top: 4, right: 4 }}
                      onPress={() => {
                        LayoutAnimation.configureNext(
                          LayoutAnimation.Presets.easeInEaseOut,
                        );
                        setHasEndTime(false);
                        setEndDate(eventDate ? new Date(eventDate) : null);
                      }}
                    >
                      <XCircle size={18} color={MODAL_TOKENS.textMuted} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.ghostCard}
                    onPress={() => setShowEndTimePicker(true)}
                  >
                    <PlusCircle size={24} color={MODAL_TOKENS.textSecondary} />
                    <Text style={styles.ghostCardText}>Add End Time</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Pickers (Invisible/Modal based) */}
              {/* Custom Parsed Pickers */}
              <CustomDatePicker
                visible={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                date={eventDate || new Date()}
                minDate={new Date()} // Disable past dates
                maxDate={
                  new Date(new Date().setFullYear(new Date().getFullYear() + 1))
                } // 1 year limit
                onChange={(newDate) => {
                  setEventDate(newDate);
                  // Adjust end date if it becomes before start date
                  if (hasEndTime && endDate && endDate < newDate) {
                    const newEnd = new Date(newDate);
                    newEnd.setHours(endDate.getHours(), endDate.getMinutes());
                    setEndDate(newEnd);
                  }
                  // If user already picked a time, and new date is today,
                  // check if that time is now in the past — auto-open time picker
                  if (hasTime) {
                    const isToday =
                      newDate.toDateString() === new Date().toDateString();
                    if (isToday) {
                      const minTime = new Date(Date.now() + 15 * 60 * 1000);
                      // Reconstruct what the full datetime would be with current time selection
                      const existingTime = eventDate; // eventDate still holds the old time parts
                      const candidate = new Date(newDate);
                      if (existingTime) {
                        candidate.setHours(
                          existingTime.getHours(),
                          existingTime.getMinutes(),
                        );
                      }
                      if (candidate < minTime) {
                        // Time is now invalid — open time picker so user sees the Invalid Time modal
                        setTimeout(() => setShowTimePicker(true), 300);
                      }
                    }
                  }
                }}
              />

              <CustomTimePicker
                visible={showTimePicker}
                onClose={() => setShowTimePicker(false)}
                time={eventDate || new Date()}
                minTime={
                  !eventDate ||
                  eventDate.toDateString() === new Date().toDateString()
                    ? new Date(Date.now() + 15 * 60 * 1000) // Current time + 15m if today
                    : null
                }
                onChange={(newTime) => {
                  setEventDate(newTime);
                  setHasTime(true); // Mark that user has explicitly set a time
                  // Ensure end time is not before start time if on same day
                  if (hasEndTime && endDate && endDate < newTime) {
                    setEndDate(newTime);
                  }
                }}
              />

              <CustomTimePicker
                visible={showEndTimePicker}
                onClose={() => setShowEndTimePicker(false)}
                time={endDate || eventDate || new Date()}
                minTime={eventDate || null} // End time must be after start time
                onChange={(newTime) => {
                  setHasEndTime(true);
                  // If selected end time is before start time, push to next day
                  if (eventDate && newTime < eventDate) {
                    const corrected = new Date(newTime);
                    corrected.setDate(corrected.getDate() + 1);
                    setEndDate(corrected);
                  } else {
                    setEndDate(newTime);
                  }
                }}
              />
            </View>

            {/* Event Type Section */}
            {/* Event Type Section (Sliding Gradient) */}
            <View style={styles.sectionBlock}>
              <Text style={styles.label}>Event Type</Text>
              <View
                style={styles.eventTypeRow}
                onLayout={(e) => {
                  const width = e.nativeEvent.layout.width;
                  setTabWidth((width - 12) / 3); // Subtract padding (6*2)
                }}
              >
                {/* Sliding Background */}
                <Animated.View
                  style={{
                    position: "absolute",
                    left: getActiveTabLeft(),
                    top: 6,
                    bottom: 6,
                    width: tabWidth,
                    borderRadius: 12,
                    zIndex: 0,
                  }}
                >
                  <LinearGradient
                    colors={MODAL_TOKENS.primaryGradient}
                    style={{ flex: 1, borderRadius: 12 }}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {/* Inner Highlight */}
                    <View
                      style={{
                        height: 1,
                        backgroundColor: "rgba(255,255,255,0.06)",
                        width: "100%",
                      }}
                    />
                  </LinearGradient>
                </Animated.View>

                {/* Tabs */}
                {[
                  { id: "in-person", label: "In-Person", icon: "people" },
                  { id: "virtual", label: "Virtual", icon: "videocam" },
                  { id: "hybrid", label: "Hybrid", icon: "layers" },
                ].map((item) => {
                  const isSelected = eventType === item.id;
                  return (
                    <TouchableHighlight
                      key={item.id}
                      style={[styles.segmentedOption, { borderRadius: 12 }]}
                      onPress={() => handleEventTypeChange(item.id)}
                      underlayColor="rgba(53,101,242,0.08)"
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {item.id === "in-person" && (
                          <Users
                            size={16}
                            color={
                              isSelected ? "rgba(255,255,255,0.9)" : "#6B7280"
                            }
                          />
                        )}
                        {item.id === "virtual" && (
                          <Video
                            size={16}
                            color={
                              isSelected ? "rgba(255,255,255,0.9)" : "#6B7280"
                            }
                          />
                        )}
                        {item.id === "hybrid" && (
                          <Layers
                            size={16}
                            color={
                              isSelected ? "rgba(255,255,255,0.9)" : "#6B7280"
                            }
                          />
                        )}
                        <Text
                          style={[
                            styles.segmentedText,
                            isSelected && styles.segmentedTextActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </View>
                    </TouchableHighlight>
                  );
                })}
              </View>
            </View>

            {/* Event Visibility Section */}
            <View style={styles.sectionBlock}>
              <Text style={styles.label}>Event Visibility</Text>
              <View style={styles.visibilityContainer}>
                {[
                  { value: "public", label: "Public", icon: "globe-outline" },
                  {
                    value: "invite_only",
                    label: "Invite Only",
                    icon: "lock-closed-outline",
                  },
                ].map((opt) => {
                  const isSelected = accessType === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.visibilityCard,
                        isSelected && styles.visibilityCardActive,
                      ]}
                      onPress={() => {
                        LayoutAnimation.configureNext(
                          LayoutAnimation.Presets.easeInEaseOut,
                        );
                        setAccessType(opt.value);
                      }}
                    >
                      {isSelected && (
                        <LinearGradient
                          colors={MODAL_TOKENS.primaryGradient}
                          style={[
                            StyleSheet.absoluteFill,
                            { borderRadius: MODAL_TOKENS.radius.md },
                          ]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        />
                      )}
                      <View style={{ zIndex: 1, alignItems: "center", gap: 6 }}>
                        {opt.value === "public" ? (
                          <Globe
                            size={24}
                            color={
                              isSelected ? "#FFF" : MODAL_TOKENS.textSecondary
                            }
                          />
                        ) : (
                          <Lock
                            size={24}
                            color={
                              isSelected ? "#FFF" : MODAL_TOKENS.textSecondary
                            }
                          />
                        )}
                        <Text
                          style={
                            isSelected
                              ? styles.visibilityTitleActive
                              : styles.visibilityTitle
                          }
                        >
                          {opt.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Discovery Feed Toggle for Invite Only */}
              {accessType === "invite_only" && (
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => {
                    LayoutAnimation.configureNext(
                      LayoutAnimation.Presets.easeInEaseOut,
                    );
                    setInvitePublicVisibility(!invitePublicVisibility);
                  }}
                >
                  <View
                    style={[
                      styles.checkbox,
                      invitePublicVisibility && styles.checkboxChecked,
                    ]}
                  >
                    {invitePublicVisibility && <Check size={14} color="#fff" />}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    Show in discover feed (location hidden)
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Location Section */}
            {eventType !== "virtual" && (
              <View style={styles.sectionBlock}>
                <Text style={styles.label}>Location</Text>
                <View style={styles.locationCard}>
                  <Search size={20} color={MODAL_TOKENS.primary} />
                  <TextInput
                    style={styles.locationInput}
                    value={locationUrl}
                    onChangeText={setLocationUrl}
                    placeholder="Search Location or Paste Link"
                    placeholderTextColor={MODAL_TOKENS.textMuted}
                  />
                </View>
                <View
                  style={[
                    styles.locationCard,
                    {
                      backgroundColor: "transparent",
                      borderWidth: 1,
                      borderColor: MODAL_TOKENS.border,
                      paddingVertical: 12,
                    },
                  ]}
                >
                  <TextInput
                    style={[
                      styles.locationInput,
                      { marginLeft: 0, fontSize: 14 },
                    ]}
                    value={locationName}
                    onChangeText={setLocationName}
                    placeholder="Location Name (Optional, e.g. Room 302)"
                    placeholderTextColor={MODAL_TOKENS.textMuted}
                  />
                </View>
              </View>
            )}

            {/* Ticketing Section - Interactive Panels */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.label, { marginBottom: 12 }]}>
                Ticketing
              </Text>

              {/* Ticket Types Panel */}
              {ticketTypes.length === 0 ? (
                <View style={[styles.ticketBlock, styles.ticketBlockEmpty]}>
                  {/* Top Row: Icon + Text */}
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <LinearGradient
                      colors={MODAL_TOKENS.primaryGradient}
                      style={styles.ticketIconCircle}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ticket size={24} color="#FFFFFF" />
                    </LinearGradient>
                    <View style={styles.ticketBlockContent}>
                      <Text style={styles.ticketBlockTitle}>
                        No tickets added
                      </Text>
                      <Text style={styles.ticketBlockSub}>
                        Add ticket types to enable registrations
                      </Text>
                    </View>
                  </View>

                  {/* CTA Button */}
                  <TouchableOpacity
                    style={styles.addTicketButton}
                    onPress={() =>
                      Alert.alert("Add Ticket", "Opens Ticket Editor")
                    }
                  >
                    <LinearGradient
                      colors={MODAL_TOKENS.primaryGradient}
                      style={styles.addTicketGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.addTicketText}>Add Ticket Type</Text>
                      <ArrowRight size={16} color="#FFFFFF" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.ticketBlock}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 16,
                      width: "100%",
                    }}
                  >
                    <Text style={styles.ticketBlockTitle}>
                      Ticket Types ({ticketTypes.length})
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        Alert.alert("Edit Tickets", "Opens Ticket Editor")
                      }
                    >
                      <Text
                        style={{
                          fontFamily: MODAL_TOKENS.fonts.medium,
                          color: MODAL_TOKENS.primary,
                        }}
                      >
                        Edit
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {ticketTypes.map((ticket, index) => (
                    <View
                      key={index}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        backgroundColor: MODAL_TOKENS.surface,
                        borderRadius: 12,
                        padding: 12,
                        marginBottom: 8,
                        width: "100%",
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Ticket size={16} color={MODAL_TOKENS.textSecondary} />
                        <Text
                          style={{
                            fontFamily: MODAL_TOKENS.fonts.medium,
                            color: MODAL_TOKENS.textPrimary,
                            fontSize: 14,
                          }}
                        >
                          {ticket.name}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontFamily: MODAL_TOKENS.fonts.semibold,
                          color: MODAL_TOKENS.textPrimary,
                          fontSize: 14,
                        }}
                      >
                        {ticket.price === 0 ? "Free" : `₹${ticket.price}`}
                      </Text>
                    </View>
                  ))}

                  <TouchableOpacity
                    style={[styles.addTicketButton, { marginTop: 12 }]}
                    onPress={() =>
                      Alert.alert("Add Ticket", "Opens Ticket Editor")
                    }
                  >
                    <LinearGradient
                      colors={MODAL_TOKENS.primaryGradient}
                      style={styles.addTicketGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.addTicketText}>
                        Add Another Ticket Type
                      </Text>
                      <Plus size={16} color="#FFFFFF" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* We can do similar for Discount/Pricing if needed, but for now just showing Ticket Types as the main block */}
              {ticketTypes.length > 0 && (
                <>
                  <DiscountCodesEditor
                    discountCodes={discountCodes}
                    onChange={setDiscountCodes}
                  />
                  <PricingRulesEditor
                    pricingRules={pricingRules}
                    onChange={setPricingRules}
                  />
                </>
              )}
            </View>

            {/* Categories */}
            <View style={styles.sectionBlock}>
              <Text style={styles.label}>Categories</Text>
              <CategorySelector
                selectedCategories={categories}
                onChange={setCategories}
                maxCategories={4}
                onExpand={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }}
              />
            </View>
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
                    â€¢ {t.name}: â‚¹{t.base_price} ({t.total_quantity} qty)
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
                      â€¢ {h.title}
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
                      â€¢ {a.display_name || a.account_name} ({a.role})
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
                      â€¢ {item.label}
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
        {/* ðŸ”¥ Custom Header with Progress Bar */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons
                name="close"
                size={24}
                color={MODAL_TOKENS.textPrimary}
              />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Event</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Slim Animated Progress Bar */}
          <View style={styles.progressBarContainer}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressPercent.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>

          <View style={styles.stepLabelContainer}>
            <Text style={styles.stepLabelText}>{STEP_TITLES[currentStep]}</Text>
            <Text style={styles.percentageText}>
              {Math.round((currentStep / totalSteps) * 100)}%
            </Text>
          </View>
        </View>

        {renderStep()}

        {/* Error Message Display */}
        {creationError && (
          <View style={styles.errorContainer}>
            <Ionicons
              name="alert-circle"
              size={20}
              color={MODAL_TOKENS.error}
            />
            <Text style={styles.errorText}>{creationError}</Text>
          </View>
        )}

        {/* Footer Actions */}
        <View style={styles.footer}>
          {currentStep > 1 && (
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              disabled={creating}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={currentStep === 7 ? handleCreate : handleNext}
            style={[
              styles.nextButton,
              creating && { opacity: 0.7 },
              currentStep === 1 && { marginLeft: "auto" },
            ]}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <LinearGradient
                colors={MODAL_TOKENS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            {!creating && (
              <Text style={styles.nextButtonText}>
                {currentStep === 7 ? "Publish Event" : "Next"}
              </Text>
            )}
            {!creating && currentStep !== 7 && (
              <Ionicons
                name="arrow-forward"
                size={18}
                color="#fff"
                style={{ marginLeft: 8 }}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Draft Prompt Modal */}
        <Modal visible={showDraftPrompt} transparent animationType="fade">
          <View style={styles.draftPromptOverlay}>
            <View style={styles.draftPromptContainer}>
              <Ionicons
                name="save-outline"
                size={48}
                color={MODAL_TOKENS.primary}
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
  container: {
    flex: 1,
    backgroundColor: MODAL_TOKENS.background,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: MODAL_TOKENS.background,
    borderBottomWidth: 1,
    borderBottomColor: MODAL_TOKENS.surface,
    paddingBottom: 16,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: {
    fontFamily: MODAL_TOKENS.fonts.bold,
    fontSize: 20,
    color: MODAL_TOKENS.textPrimary,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: MODAL_TOKENS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: MODAL_TOKENS.surface,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: MODAL_TOKENS.primary,
    borderRadius: 2,
  },
  stepLabelContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stepLabelText: {
    fontFamily: MODAL_TOKENS.fonts.medium,
    fontSize: 14,
    color: MODAL_TOKENS.textPrimary,
  },
  percentageText: {
    fontFamily: MODAL_TOKENS.fonts.medium,
    fontSize: 12,
    color: MODAL_TOKENS.textSecondary,
  },

  // Step Content Style
  stepContent: {
    flex: 1,
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },

  // Section Blocks
  sectionBlock: {
    marginBottom: 24,
    backgroundColor: MODAL_TOKENS.surface, // #F5F8FF
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MODAL_TOKENS.border, // #E6ECF8
    padding: 20,
  },
  sectionTitle: {
    fontFamily: MODAL_TOKENS.fonts.semibold,
    fontSize: 16,
    color: MODAL_TOKENS.textPrimary,
    marginBottom: 12,
  },

  // Inputs
  label: {
    fontFamily: MODAL_TOKENS.fonts.semibold, // Section Titles: Manrope Semibold 16px
    fontSize: 16,
    color: MODAL_TOKENS.textPrimary, // #1F2937 (close to #111827)
    marginBottom: 12,
  },
  titleInputContainer: {
    backgroundColor: MODAL_TOKENS.surface,
    borderRadius: MODAL_TOKENS.radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  titleInput: {
    fontFamily: MODAL_TOKENS.fonts.semibold,
    fontSize: 16,
    color: MODAL_TOKENS.textPrimary,
    padding: 0,
  },
  input: {
    borderWidth: 1,
    borderColor: MODAL_TOKENS.border,
    borderRadius: MODAL_TOKENS.radius.sm,
    padding: 12,
    fontFamily: MODAL_TOKENS.fonts.regular,
    fontSize: 14,
    color: "#111827", // Darker text
    marginBottom: 16,
    backgroundColor: MODAL_TOKENS.background,
  },

  // Error
  errorContainer: {
    margin: 20,
    padding: 12,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
    flexDirection: "row",
    alignItems: "center",
  },
  errorText: {
    marginLeft: 8,
    color: MODAL_TOKENS.error,
    flex: 1,
    fontFamily: MODAL_TOKENS.fonts.medium,
    fontSize: 13,
  },

  // Footer
  footer: {
    flexDirection: "row",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: MODAL_TOKENS.border,
    backgroundColor: MODAL_TOKENS.background,
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  backButtonText: {
    fontFamily: MODAL_TOKENS.fonts.medium,
    fontSize: 16,
    color: MODAL_TOKENS.textSecondary,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    paddingHorizontal: 32,
    borderRadius: 28,
    overflow: "hidden",
    minWidth: 140,
    ...MODAL_TOKENS.shadow.md,
  },
  nextButtonText: {
    fontFamily: MODAL_TOKENS.fonts.semibold,
    fontSize: 16,
    color: "#ffffff",
    zIndex: 1,
  },

  // Date Time Pickers
  dateCard: {
    flex: 1,
    padding: 12,
    borderRadius: MODAL_TOKENS.radius.sm,
    borderWidth: 1,
    borderColor: MODAL_TOKENS.border,
    backgroundColor: MODAL_TOKENS.background,
    alignItems: "flex-start",
    gap: 8,
  },
  dateCardIconInfo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: MODAL_TOKENS.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  dateCardLabel: {
    fontFamily: MODAL_TOKENS.fonts.medium,
    fontSize: 12,
    color: "#6B7280", // Grey label
  },
  dateCardValue: {
    fontFamily: MODAL_TOKENS.fonts.semibold,
    fontSize: 14,
    color: "#111827", // Darker value
  },

  // Ghost Card
  ghostCard: {
    flex: 1,
    padding: 12,
    borderRadius: MODAL_TOKENS.radius.sm,
    borderWidth: 1,
    borderColor: MODAL_TOKENS.border,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
    minHeight: 100, // Match height of other cards roughly
  },
  ghostCardText: {
    fontFamily: MODAL_TOKENS.fonts.medium,
    fontSize: 14,
    color: MODAL_TOKENS.textSecondary,
    marginTop: 8,
  },

  // Event Type
  // Event Type
  eventTypeRow: {
    flexDirection: "row",
    backgroundColor: "#F5F8FF", // Light surface
    borderRadius: 16,
    height: 52,
    padding: 6, // Increased padding
    marginBottom: 24,
    position: "relative",
  },
  segmentedOption: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    zIndex: 1,
  },
  segmentedText: {
    fontFamily: MODAL_TOKENS.fonts.medium,
    fontSize: 14,
    color: "#6B7280",
  },
  segmentedTextActive: {
    fontFamily: MODAL_TOKENS.fonts.medium,
    fontSize: 14,
    color: "#FFFFFF",
  },

  // Visibility Cards
  visibilityContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  visibilityCard: {
    flex: 1,
    padding: 16,
    borderRadius: MODAL_TOKENS.radius.md,
    borderWidth: 1,
    borderColor: MODAL_TOKENS.border,
    backgroundColor: MODAL_TOKENS.background,
    alignItems: "center",
    gap: 8,
  },
  visibilityCardActive: {
    borderColor: "transparent",
  },
  visibilityTitle: {
    fontFamily: MODAL_TOKENS.fonts.semibold,
    fontSize: 14,
    color: MODAL_TOKENS.textPrimary,
  },
  visibilityTitleActive: {
    color: "#FFFFFF",
  },

  // Location
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20, // Global Polish: 20px padding
    borderRadius: MODAL_TOKENS.radius.md,
    backgroundColor: MODAL_TOKENS.surface,
    borderWidth: 1,
    borderColor: "transparent",
    marginBottom: 12,
  },
  locationInput: {
    flex: 1,
    fontFamily: MODAL_TOKENS.fonts.medium,
    fontSize: 15,
    color: MODAL_TOKENS.textPrimary,
    marginLeft: 12,
  },

  // Ticketing Blocks
  ticketBlock: {
    backgroundColor: MODAL_TOKENS.background, // White background
    borderRadius: 18, // 18px radius
    padding: 20, // 20px padding
    borderWidth: 1,
    borderColor: MODAL_TOKENS.border, // #E6ECF8
    marginBottom: 16,
    // Soft shadow (0, 6, 18, 0.05)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  ticketBlockEmpty: {
    // Merged into ticketBlock, keeping this for backward compatibility if needed,
    // or we can just remove it if the JS logic uses ticketBlock for both.
    // For now, let's make it identical or just remove the dashed style.
    borderStyle: "solid",
  },
  ticketIconCircle: {
    width: 56, // 56px circle
    height: 56,
    borderRadius: 28,
    // Background handled by LinearGradient in JSX
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    // Subtle shadow for icon
    shadowColor: MODAL_TOKENS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  ticketBlockContent: {
    flex: 1,
    justifyContent: "center",
  },
  ticketBlockTitle: {
    fontFamily: MODAL_TOKENS.fonts.semibold,
    fontSize: 16,
    color: "#111827",
    marginBottom: 4,
  },
  ticketBlockSub: {
    fontFamily: MODAL_TOKENS.fonts.regular,
    fontSize: 14,
    color: "#6B7280",
  },
  addTicketButton: {
    marginTop: 16,
    width: "100%",
    height: 44,
    borderRadius: 12,
    overflow: "hidden", // For Gradient
  },
  addTicketGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addTicketText: {
    fontFamily: MODAL_TOKENS.fonts.semibold,
    fontSize: 14,
    color: "#FFFFFF",
  },

  // Review Styles
  reviewCard: {
    backgroundColor: MODAL_TOKENS.surface,
    borderRadius: MODAL_TOKENS.radius.md,
    padding: 16,
  },
  reviewSection: {
    marginBottom: 16,
  },
  reviewLabel: {
    fontFamily: MODAL_TOKENS.fonts.medium,
    fontSize: 12,
    color: MODAL_TOKENS.textSecondary,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  reviewValue: {
    fontFamily: MODAL_TOKENS.fonts.medium,
    fontSize: 15,
    color: MODAL_TOKENS.textPrimary,
  },
  reviewSubValue: {
    fontFamily: MODAL_TOKENS.fonts.regular,
    fontSize: 13,
    color: MODAL_TOKENS.textSecondary,
  },
  stepTitle: {
    fontFamily: MODAL_TOKENS.fonts.bold,
    fontSize: 24,
    color: MODAL_TOKENS.textPrimary,
    marginBottom: 20,
  },
  reviewSubtitle: {
    fontFamily: MODAL_TOKENS.fonts.regular,
    fontSize: 16,
    color: MODAL_TOKENS.textSecondary,
    marginBottom: 20,
  },

  // Draft Prompt Styles
  draftPromptOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  draftPromptContainer: {
    width: "100%",
    backgroundColor: MODAL_TOKENS.background,
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
  },
  draftPromptTitle: {
    fontFamily: MODAL_TOKENS.fonts.bold,
    fontSize: 24,
    color: MODAL_TOKENS.textPrimary,
    marginBottom: 8,
  },
  draftPromptSubtitle: {
    fontFamily: MODAL_TOKENS.fonts.regular,
    fontSize: 16,
    color: MODAL_TOKENS.textSecondary,
    marginBottom: 32,
    textAlign: "center",
  },
  draftMainButton: {
    width: "100%",
    backgroundColor: MODAL_TOKENS.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  draftMainButtonText: {
    fontFamily: MODAL_TOKENS.fonts.semibold,
    fontSize: 16,
    color: "#FFFFFF",
  },
  draftSecondaryButton: {
    paddingVertical: 12,
  },
  draftSecondaryButtonText: {
    fontFamily: MODAL_TOKENS.fonts.medium,
    fontSize: 16,
    color: MODAL_TOKENS.textSecondary,
  },
  // Footer
  footer: {
    padding: 24,
    backgroundColor: MODAL_TOKENS.background,
    borderTopWidth: 1,
    borderTopColor: MODAL_TOKENS.border,
    paddingBottom: 24,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  backButtonText: {
    fontFamily: MODAL_TOKENS.fonts.medium,
    fontSize: 16,
    color: MODAL_TOKENS.textSecondary,
    marginLeft: 8,
  },
  nextButtonWrapper: {
    borderRadius: MODAL_TOKENS.radius.xl,
    overflow: "hidden",
    shadowColor: MODAL_TOKENS.primary,
    shadowOffset: { width: 0, height: 4 }, // Reduced y from 8 to 4
    shadowOpacity: 0.12, // Reduced from 0.3 to 0.12
    shadowRadius: 12, // Reduced from 16 to 12 (diffused)
    elevation: 4, // Reduced elevation
  },
  fullButtonGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  nextButtonText: {
    fontFamily: MODAL_TOKENS.fonts.bold,
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },

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
    borderColor: MODAL_TOKENS.border,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: MODAL_TOKENS.surface,
  },
  checkboxChecked: {
    backgroundColor: MODAL_TOKENS.primary,
    borderColor: MODAL_TOKENS.primary,
  },
  checkboxLabel: {
    fontFamily: MODAL_TOKENS.fonts.medium,
    fontSize: 14,
    color: MODAL_TOKENS.textPrimary,
    flex: 1,
  },
});

export default CreateEventModal;
