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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
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
  X,
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
import PromoEditor from "../editors/PromoEditor";
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

/**
 * Intelligent compressed date range formatter.
 * Handles Timezone safety, Leap years, Month boundaries, and DST transitions.
 * Normalizes using setHours(0,0,0,0).
 */
const formatEventDateRange = (startDate, endDate) => {
  if (!startDate) return { primaryText: "Pick date" };

  const startDay = new Date(startDate);
  startDay.setHours(0, 0, 0, 0);

  const endDay = endDate ? new Date(endDate) : null;
  if (endDay) endDay.setHours(0, 0, 0, 0);

  const isRange = endDay && endDay.getTime() !== startDay.getTime();

  // Use Intl.DateTimeFormat to avoid hardcoding month names and support locale natively
  const getMonthName = (date) =>
    new Intl.DateTimeFormat(undefined, { month: "short" }).format(date);

  if (!isRange) {
    return {
      primaryText: `${startDay.getDate()} ${getMonthName(startDay)} ${startDay.getFullYear()}`,
    };
  }

  // Calculate days difference safely by comparing midnights in UTC to negate DST shifts
  const utcStart = Date.UTC(
    startDay.getFullYear(),
    startDay.getMonth(),
    startDay.getDate(),
  );
  const utcEnd = Date.UTC(
    endDay.getFullYear(),
    endDay.getMonth(),
    endDay.getDate(),
  );
  const days = Math.floor((utcEnd - utcStart) / (1000 * 60 * 60 * 24)) + 1;
  const secondaryText = `${days}-day event`;

  const sameYear = startDay.getFullYear() === endDay.getFullYear();
  const sameMonth = sameYear && startDay.getMonth() === endDay.getMonth();

  let primaryText = "";

  if (sameYear && sameMonth) {
    // CASE 2: 23–26 Feb 2026
    primaryText = `${startDay.getDate()}–${endDay.getDate()} ${getMonthName(startDay)} ${startDay.getFullYear()}`;
  } else if (sameYear) {
    // CASE 3: 28 Feb – 2 Mar 2026
    primaryText = `${startDay.getDate()} ${getMonthName(startDay)} – ${endDay.getDate()} ${getMonthName(endDay)} ${endDay.getFullYear()}`;
  } else {
    // CASE 4: 30 Dec 2026 – 2 Jan 2027
    primaryText = `${startDay.getDate()} ${getMonthName(startDay)} ${startDay.getFullYear()} – ${endDay.getDate()} ${getMonthName(endDay)} ${endDay.getFullYear()}`;
  }

  return { primaryText, secondaryText };
};

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
  const insets = useSafeAreaInsets();
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
  const [promos, setPromos] = useState([]);
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
  const [hasTime, setHasTime] = useState(false); // true once user explicitly picks a start time
  const [draftExists, setDraftExists] = useState(false);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [draftLastSaved, setDraftLastSaved] = useState(null);
  const [showSaveDraftModal, setShowSaveDraftModal] = useState(false);

  // Scroll ref for auto-scrolling when category dropdown opens
  const scrollViewRef = useRef(null);

  // Editor refs for imperative modal triggers
  const ticketEditorRef = useRef(null);
  const promoEditorRef = useRef(null);

  // Bottom sheet state for ticket type selection
  const [showAddTicketSheet, setShowAddTicketSheet] = useState(false);

  // Memoized date formatting to prevent heavy recalculations every render
  const dateDisplay = React.useMemo(() => {
    return formatEventDateRange(eventDate, endDate);
  }, [eventDate, endDate]);

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
    setPromos([]);
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
    discount_codes: promos
      .filter((p) => p.offer_type === "promo_code")
      .map((p) => ({
        code: p.code,
        discount_type: p.discount_type,
        discount_value: p.discount_value,
        max_uses: p.max_uses,
        valid_from: p.valid_from,
        valid_until: p.valid_until,
        applies_to: p.applies_to,
        selected_tickets: p.selected_tickets,
        stackable: p.stackable,
        min_purchase: p.min_purchase,
        is_active: p.is_active,
        name: p.name,
      })),
    pricing_rules: promos
      .filter((p) => p.offer_type === "early_bird")
      .map((p) => ({
        name: p.name,
        rule_type:
          p.trigger === "by_sales" ? "early_bird_quantity" : "early_bird_time",
        discount_type: p.discount_type,
        discount_value: p.discount_value,
        valid_until: p.valid_until,
        quantity_threshold: p.quantity_threshold,
        is_active: p.is_active,
      })),
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
        if (draft.data.ticket_types) setTicketTypes(draft.data.ticket_types);
        // Load promos from unified array or merge legacy fields
        if (draft.data.promos) {
          setPromos(draft.data.promos);
        } else {
          const legacyPromos = [];
          if (draft.data.discount_codes) {
            draft.data.discount_codes.forEach((dc) => {
              legacyPromos.push({
                ...dc,
                offer_type: "promo_code",
                name: dc.name || dc.code || "",
              });
            });
          }
          if (draft.data.pricing_rules) {
            draft.data.pricing_rules.forEach((pr) => {
              legacyPromos.push({
                ...pr,
                offer_type: "early_bird",
                trigger:
                  pr.rule_type === "early_bird_quantity"
                    ? "by_sales"
                    : "by_date",
              });
            });
          }
          if (legacyPromos.length > 0) setPromos(legacyPromos);
        }

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
    setShowSaveDraftModal(true);
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
              <View style={{ gap: 12 }}>
                {/* Unified Date Card — Full Width */}
                <TouchableOpacity
                  style={[styles.dateCard, { width: "100%", flex: 0 }]}
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
                      numberOfLines={1}
                    >
                      {dateDisplay.primaryText}
                    </Text>
                    {dateDisplay.secondaryText ? (
                      <Text
                        style={{
                          fontFamily: MODAL_TOKENS.fonts.medium,
                          fontSize: 12,
                          color: MODAL_TOKENS.primary,
                          marginTop: 4,
                        }}
                      >
                        {dateDisplay.secondaryText}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>

                {/* Time Cards Row */}
                <View style={{ flexDirection: "row", gap: 12 }}>
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

                  {/* End Time Card — always visible */}
                  <TouchableOpacity
                    style={styles.dateCard}
                    onPress={() => setShowEndTimePicker(true)}
                  >
                    <View
                      style={[
                        styles.dateCardIconInfo,
                        hasEndTime && { backgroundColor: "#EEF2FF" },
                      ]}
                    >
                      <Flag
                        size={16}
                        color={
                          hasEndTime
                            ? MODAL_TOKENS.primary
                            : MODAL_TOKENS.textSecondary
                        }
                      />
                    </View>
                    <View>
                      <Text style={styles.dateCardLabel}>End Time</Text>
                      <Text
                        style={[
                          styles.dateCardValue,
                          !hasEndTime && { color: MODAL_TOKENS.textMuted },
                        ]}
                      >
                        {hasEndTime && endDate
                          ? endDate.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Pick time"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Date Picker — intent-based, single or range */}
              <CustomDatePicker
                visible={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                startDate={eventDate}
                endDate={
                  endDate &&
                  eventDate &&
                  endDate.toDateString() !== eventDate.toDateString()
                    ? endDate
                    : null
                }
                minDate={new Date()}
                maxDate={
                  new Date(new Date().setFullYear(new Date().getFullYear() + 1))
                }
                onConfirm={({ startDate: newStart, endDate: newEnd }) => {
                  // Apply new start date, preserve existing start time
                  const newEventDate = new Date(newStart);
                  if (hasTime && eventDate) {
                    newEventDate.setHours(
                      eventDate.getHours(),
                      eventDate.getMinutes(),
                      0,
                      0,
                    );
                  }
                  setEventDate(newEventDate);

                  if (newEnd) {
                    // Range confirmed — apply end date, preserve existing end time
                    const newEndDate = new Date(newEnd);
                    if (hasEndTime && endDate) {
                      newEndDate.setHours(
                        endDate.getHours(),
                        endDate.getMinutes(),
                        0,
                        0,
                      );
                    }
                    setEndDate(newEndDate);
                  } else {
                    // Single day — clear any previous range end
                    setEndDate(null);
                  }

                  // If start is today and existing time is now in the past, nudge time picker
                  if (hasTime) {
                    const isToday =
                      newStart.toDateString() === new Date().toDateString();
                    if (isToday) {
                      const minTime = new Date(Date.now() + 15 * 60 * 1000);
                      const candidate = new Date(newStart);
                      if (eventDate) {
                        candidate.setHours(
                          eventDate.getHours(),
                          eventDate.getMinutes(),
                        );
                      }
                      if (candidate < minTime) {
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
                  setHasTime(true);

                  // ── Auto-adjust end time if it would be < start + 15 min ──
                  if (hasEndTime && endDate) {
                    const minEndTime = new Date(
                      newTime.getTime() + 15 * 60 * 1000,
                    );
                    if (endDate < minEndTime) {
                      // Auto-set end to start + 1 hour on the correct end date
                      const autoEnd = new Date(endDate);
                      const oneHourLater = new Date(
                        newTime.getTime() + 60 * 60 * 1000,
                      );
                      autoEnd.setHours(
                        oneHourLater.getHours(),
                        oneHourLater.getMinutes(),
                        0,
                        0,
                      );
                      setEndDate(autoEnd);
                    }
                  }
                }}
              />

              <CustomTimePicker
                visible={showEndTimePicker}
                onClose={() => setShowEndTimePicker(false)}
                time={endDate || eventDate || new Date()}
                minTime={
                  // Only enforce end > start + 15min on same-day events
                  eventDate &&
                  (!endDate ||
                    endDate.toDateString() === eventDate.toDateString())
                    ? new Date(
                        (eventDate?.getTime() ?? Date.now()) + 15 * 60 * 1000,
                      )
                    : null
                }
                onChange={(newTime) => {
                  setHasEndTime(true);
                  // For single-day: if end time is within 15min of start, push to next day
                  const isSameDay =
                    eventDate &&
                    (!endDate ||
                      endDate.toDateString() === eventDate.toDateString());
                  const tooEarly =
                    isSameDay &&
                    eventDate &&
                    newTime < new Date(eventDate.getTime() + 15 * 60 * 1000);
                  if (tooEarly) {
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

            {/* Location Section — In-Person / Hybrid */}
            {eventType !== "virtual" && (
              <View style={styles.sectionBlock}>
                <Text style={styles.label}>Location</Text>
                <View style={styles.locationCard}>
                  <Search size={20} color={MODAL_TOKENS.primary} />
                  <TextInput
                    style={styles.locationInput}
                    value={locationUrl}
                    onChangeText={setLocationUrl}
                    placeholder="Google Maps Link"
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

            {/* Virtual Link Section — Virtual / Hybrid */}
            {(eventType === "virtual" || eventType === "hybrid") && (
              <View style={styles.sectionBlock}>
                <Text style={styles.label}>
                  {eventType === "hybrid" ? "Online Link" : "Virtual Link"}
                </Text>
                <View style={styles.locationCard}>
                  <Video size={20} color={MODAL_TOKENS.primary} />
                  <TextInput
                    style={styles.locationInput}
                    value={virtualLink}
                    onChangeText={setVirtualLink}
                    placeholder="Paste meeting link (Zoom, Meet, Teams…)"
                    placeholderTextColor={MODAL_TOKENS.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                </View>
              </View>
            )}

            {/* Ticketing Section — Uses Editor Components */}
            <View style={styles.sectionBlock}>
              <TicketTypesEditor
                ref={ticketEditorRef}
                ticketTypes={ticketTypes}
                onChange={setTicketTypes}
                onAddPress={() => setShowAddTicketSheet(true)}
                pricingRules={promos
                  .filter((p) => p.offer_type === "early_bird")
                  .map((p) => ({
                    name: p.name,
                    rule_type:
                      p.trigger === "by_sales"
                        ? "early_bird_quantity"
                        : "early_bird_time",
                    discount_type: p.discount_type,
                    discount_value: p.discount_value,
                    valid_until: p.valid_until,
                    quantity_threshold: p.quantity_threshold,
                    is_active: p.is_active,
                  }))}
                eventStartDate={eventDate}
                eventEndDate={endDate}
              />

              {ticketTypes.length > 0 && (
                <PromoEditor
                  ref={promoEditorRef}
                  promos={promos}
                  onChange={setPromos}
                  ticketTypes={ticketTypes}
                  eventStartDate={eventDate}
                />
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
          <View
            style={[
              styles.errorContainer,
              { marginBottom: insets.bottom + 100 },
            ]}
          >
            <Ionicons
              name="alert-circle"
              size={20}
              color={MODAL_TOKENS.error}
            />
            <Text style={styles.errorText}>{creationError}</Text>
          </View>
        )}

        {/* Floating Pill CTA */}
        <Animated.View
          style={[styles.floatingFooter, { bottom: insets.bottom + 24 }]}
        >
          {currentStep > 1 && (
            <TouchableOpacity
              onPress={handleBack}
              style={styles.floatingBackButton}
              disabled={creating}
            >
              <Text style={styles.floatingBackButtonText}>Back</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={currentStep === 7 ? handleCreate : handleNext}
            style={[
              styles.floatingNextButton,
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
              <Text style={styles.floatingNextButtonText}>
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
        </Animated.View>

        {/* Add Ticket Type Bottom Sheet */}
        <Modal
          visible={showAddTicketSheet}
          transparent
          animationType="slide"
          statusBarTranslucent={true}
          onRequestClose={() => setShowAddTicketSheet(false)}
        >
          <TouchableOpacity
            style={styles.sheetOverlay}
            activeOpacity={1}
            onPress={() => setShowAddTicketSheet(false)}
          >
            <View style={styles.sheetContainer}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Add to Ticketing</Text>

              {/* Normal Ticket */}
              <TouchableOpacity
                style={styles.sheetRow}
                onPress={() => {
                  setShowAddTicketSheet(false);
                  setTimeout(
                    () => ticketEditorRef.current?.openAddModal(),
                    300,
                  );
                }}
              >
                <View
                  style={[
                    styles.sheetIconCircle,
                    { backgroundColor: "#EEF2FF" },
                  ]}
                >
                  <Ticket size={20} color={MODAL_TOKENS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetRowTitle}>Ticket Type</Text>
                  <Text style={styles.sheetRowDesc}>
                    Standard admission tiers
                  </Text>
                </View>
                <ArrowRight size={16} color={MODAL_TOKENS.textMuted} />
              </TouchableOpacity>

              {/* Add Promo */}
              <TouchableOpacity
                style={[
                  styles.sheetRow,
                  ticketTypes.length === 0 && { opacity: 0.45 },
                ]}
                disabled={ticketTypes.length === 0}
                onPress={() => {
                  setShowAddTicketSheet(false);
                  setTimeout(() => promoEditorRef.current?.openAddModal(), 300);
                }}
              >
                <View
                  style={[
                    styles.sheetIconCircle,
                    { backgroundColor: "#F0FDF4" },
                  ]}
                >
                  <Ionicons name="pricetag" size={20} color="#22C55E" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetRowTitle}>Add Promo</Text>
                  <Text style={styles.sheetRowDesc}>
                    {ticketTypes.length === 0
                      ? "Add a ticket type first"
                      : "Promo codes & early bird discounts"}
                  </Text>
                </View>
                <ArrowRight size={16} color={MODAL_TOKENS.textMuted} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Draft Prompt Modal */}
        <Modal
          visible={showDraftPrompt}
          transparent
          animationType="fade"
          statusBarTranslucent={true}
        >
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

        {/* Save Draft Confirmation Modal */}
        <Modal
          visible={showSaveDraftModal}
          transparent
          animationType="fade"
          statusBarTranslucent={true}
          onRequestClose={() => setShowSaveDraftModal(false)}
        >
          <View style={styles.draftPromptOverlay}>
            <View style={styles.draftPromptContainer}>
              <TouchableOpacity
                style={styles.modalXButton}
                onPress={() => setShowSaveDraftModal(false)}
              >
                <X size={24} color={MODAL_TOKENS.textSecondary} />
              </TouchableOpacity>

              <Ionicons
                name="save-outline"
                size={48}
                color={MODAL_TOKENS.primary}
                style={{ alignSelf: "center", marginBottom: 15, marginTop: 10 }}
              />
              <Text style={styles.draftPromptTitle}>Save Draft?</Text>
              <Text style={styles.draftPromptSubtitle}>
                Would you like to save your progress?
              </Text>

              <TouchableOpacity
                style={styles.draftMainButton}
                onPress={async () => {
                  await saveDraft(true);
                  setShowSaveDraftModal(false);
                  onClose();
                }}
              >
                <Text style={styles.draftMainButtonText}>Save Draft</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.draftSecondaryButton}
                onPress={async () => {
                  await deleteDraftData();
                  resetForm();
                  setShowSaveDraftModal(false);
                  onClose();
                }}
              >
                <Text style={styles.draftSecondaryButtonText}>
                  Discard Changes
                </Text>
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
    padding: 20,
    paddingBottom: 120, // Enough padding to not hide behind floating CTA
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

  // Floating Footer CTA
  floatingFooter: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 100,
  },
  floatingBackButton: {
    backgroundColor: MODAL_TOKENS.surface,
    height: 56,
    paddingHorizontal: 24,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    ...MODAL_TOKENS.shadow.sm,
  },
  floatingBackButtonText: {
    fontFamily: MODAL_TOKENS.fonts.medium,
    fontSize: 16,
    color: MODAL_TOKENS.textSecondary,
  },
  floatingNextButton: {
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
  floatingNextButtonText: {
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
    position: "relative",
  },
  modalXButton: {
    position: "absolute",
    top: 20,
    right: 20,
    padding: 4,
    zIndex: 10,
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

  // Add Ticket Bottom Sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontFamily: MODAL_TOKENS.fonts.semibold,
    fontSize: 18,
    color: MODAL_TOKENS.textPrimary,
    marginBottom: 16,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 14,
  },
  sheetIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  sheetRowTitle: {
    fontFamily: MODAL_TOKENS.fonts.semibold,
    fontSize: 15,
    color: MODAL_TOKENS.textPrimary,
  },
  sheetRowDesc: {
    fontFamily: MODAL_TOKENS.fonts.regular,
    fontSize: 13,
    color: MODAL_TOKENS.textSecondary,
    marginTop: 2,
  },
});

export default CreateEventModal;
