import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableHighlight,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  Animated,
  LayoutAnimation,
  UIManager,
  Linking,
  Switch,
} from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  Calendar1 as Calendar,
  Clock,
  Flag,
  Users,
  Video,
  Layers,
  Earth,
  Lock,
  Check,
  ArrowRight,
  Info,
  X,
  NotebookPen,
  Camera,
  BookMarked,
  BookOpenCheck,
  Glasses,
  Pencil,
  MapPin,
  AlertCircle,
  Trash2,
  Search,
  CheckCircle,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SHADOWS, BORDER_RADIUS } from "../../constants/theme";
import CustomDatePicker from "../ui/CustomDatePicker";
import CustomTimePicker from "../ui/CustomTimePicker";
import { updateEvent } from "../../api/events";
import { getDiscoverCategories } from "../../api/categories";
import { useLocationName } from "../../utils/locationNameCache";

const MODAL_TOKENS = {
  primary: "#3565F2",
  primaryGradient: ["#3565F2", "#2F56D6"],
  surface: "#F5F8FF",
  background: "#F9F9F9",
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
    bold: "BasicCommercial-Bold",
  },
};

const STEP_TITLES = {
  1: "Basic Information",
  2: "Media",
  3: "Description",
  4: "Highlights",
  5: "Featured",
  6: "Things to Know",
  7: "Review",
};

// Import our components
import ImageCarouselUpload from "../ImageCarouselUpload";
import EventGalleryUpload from "../EventGalleryUpload";
import RichTextEditor from "../RichTextEditor";
import HighlightsEditor from "../HighlightsEditor";
import FeaturedAccountsEditor from "../FeaturedAccountsEditor";
import ThingsToKnowEditor from "../ThingsToKnowEditor";
import TicketTypesEditor from "../editors/TicketTypesEditor";
import PromoEditor from "../editors/PromoEditor";
import CategorySelector from "../CategorySelector";
import SnooLoader from "../ui/SnooLoader";

export default function EditEventModal({
  visible,
  onClose,
  onEventUpdated,
  eventData,
}) {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 7;
  const progressPercent = useRef(new Animated.Value(0)).current;
  const [hasReachedReview, setHasReachedReview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [tabWidth, setTabWidth] = useState(0);

  // Enable LayoutAnimation on Android
  useEffect(() => {
    if (Platform.OS === "android") {
      if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
      }
    }
  }, []);

  // Animate progress bar on step change
  useEffect(() => {
    Animated.timing(progressPercent, {
      toValue: currentStep / totalSteps,
      duration: 300,
      useNativeDriver: false,
    }).start();
    if (currentStep === totalSteps) setHasReachedReview(true);
  }, [currentStep]);

  const handleEventTypeChange = (type) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEventType(type);
  };

  const getActiveTabLeft = () => {
    let index = 0;
    if (eventType === "virtual") index = 1;
    else if (eventType === "hybrid") index = 2;
    return 6 + index * tabWidth;
  };

  // Scroll ref for auto-scrolling when category dropdown opens
  const scrollViewRef = useRef(null);

  // Category name lookup map (id → name) for review display
  const categoryMapRef = useRef({});
  useEffect(() => {
    getDiscoverCategories()
      .then((res) => {
        if (res?.categories) {
          const map = {};
          res.categories.forEach((c) => {
            map[c.id] = c.name;
          });
          categoryMapRef.current = map;
        }
      })
      .catch(() => {});
  }, []);

  // Step 1: Basic Info
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
  const [promos, setPromos] = useState([]);
  const [categories, setCategories] = useState([]);
  // Event visibility
  const [accessType, setAccessType] = useState("public"); // 'public' or 'invite_only'
  const [invitePublicVisibility, setInvitePublicVisibility] = useState(false);

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
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showGatesTimePicker, setShowGatesTimePicker] = useState(false);
  const [hasEndTime, setHasEndTime] = useState(false);

  // Decode Google Maps URL for review section display.
  // Use the custom locationName (or generic fallback) so the review always shows something useful.
  const decodedLocationName = useLocationName(locationUrl, {
    fallback: locationName.trim() || "View Location",
  });
  const displayLocationName = locationName.trim() || decodedLocationName;

  useEffect(() => {
    if (eventData && visible) {
      setTitle(eventData.title || "");
      setEventDate(
        eventData.event_date ? new Date(eventData.event_date) : new Date(),
      );
      if (eventData.end_datetime) {
        setEndDate(new Date(eventData.end_datetime));
        setHasEndTime(true);
      } else {
        setEndDate(new Date(eventData.event_date || new Date()));
        setHasEndTime(false);
      }

      setGatesOpenTime(
        eventData.gates_open_time ? new Date(eventData.gates_open_time) : null,
      );
      setHasGates(!!eventData.gates_open_time);
      setEventType(eventData.event_type || "in-person");
      setLocationUrl(eventData.location_url || "");
      setLocationName(eventData.location_name || "");
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
      // Merge legacy discount_codes + pricing_rules into unified promos
      const loadedPromos = [];
      if (eventData.discount_codes) {
        eventData.discount_codes.forEach((dc) => {
          loadedPromos.push({
            ...dc,
            offer_type: "promo_code",
            name: dc.name || dc.code || "",
            applies_to: dc.applies_to || "all",
            selected_tickets: dc.selected_tickets || [],
          });
        });
      }
      if (eventData.pricing_rules) {
        eventData.pricing_rules.forEach((pr) => {
          loadedPromos.push({
            ...pr,
            offer_type: "early_bird",
            trigger:
              pr.rule_type === "early_bird_quantity" ? "by_sales" : "by_date",
            applies_to: pr.applies_to || "all",
            selected_tickets: pr.selected_tickets || [],
          });
        });
      }
      setPromos(loadedPromos);
      // Transform categories from objects (with id, name, etc.) to array of IDs
      const categoryIds = (eventData.categories || []).map((c) =>
        typeof c === "object" ? c.id : c,
      );
      setCategories(categoryIds);
      setAccessType(eventData.access_type || "public");
      setInvitePublicVisibility(eventData.invite_public_visibility || false);
      console.log(
        "[EditEventModal] Loaded from eventData - access_type:",
        eventData.access_type,
        "invite_public_visibility:",
        eventData.invite_public_visibility,
      );
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
          : null,
        hasEndTime: !!eventData.end_datetime,
        hasGates: !!eventData.gates_open_time,
        eventType: eventData.event_type || "in-person",
        locationUrl: eventData.location_url || "",
        locationName: eventData.location_name || "",
        virtualLink: eventData.virtual_link || "",
        maxAttendees: eventData.max_attendees?.toString() || "",
        bannerCarousel: JSON.stringify(eventData.banner_carousel || []),
        gallery: JSON.stringify(eventData.gallery || []),
        highlights: JSON.stringify(eventData.highlights || []),
        featuredAccounts: JSON.stringify(eventData.featured_accounts || []),
        thingsToKnow: JSON.stringify(eventData.things_to_know || []),
        ticketTypes: JSON.stringify(eventData.ticket_types || []),
        promos: JSON.stringify([
          ...(eventData.discount_codes || []).map((dc) => ({
            ...dc,
            offer_type: "promo_code",
            name: dc.name || dc.code || "",
          })),
          ...(eventData.pricing_rules || []).map((pr) => ({
            ...pr,
            offer_type: "early_bird",
            trigger:
              pr.rule_type === "early_bird_quantity" ? "by_sales" : "by_date",
          })),
        ]),
        categories: JSON.stringify(categoryIds),
        accessType: eventData.access_type || "public",
        invitePublicVisibility: eventData.invite_public_visibility || false,
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
      (hasEndTime ? endDate.toISOString() : null) !== initialSnapshot.endDate ||
      hasEndTime !== initialSnapshot.hasEndTime ||
      hasGates !== initialSnapshot.hasGates ||
      eventType !== initialSnapshot.eventType ||
      locationUrl !== initialSnapshot.locationUrl ||
      locationName !== initialSnapshot.locationName ||
      virtualLink !== initialSnapshot.virtualLink ||
      maxAttendees !== initialSnapshot.maxAttendees ||
      JSON.stringify(bannerCarousel) !== initialSnapshot.bannerCarousel ||
      JSON.stringify(gallery) !== initialSnapshot.gallery ||
      JSON.stringify(highlights) !== initialSnapshot.highlights ||
      JSON.stringify(featuredAccounts) !== initialSnapshot.featuredAccounts ||
      JSON.stringify(thingsToKnow) !== initialSnapshot.thingsToKnow ||
      JSON.stringify(ticketTypes) !== initialSnapshot.ticketTypes ||
      JSON.stringify(promos) !== initialSnapshot.promos ||
      JSON.stringify(categories) !== initialSnapshot.categories ||
      accessType !== initialSnapshot.accessType ||
      invitePublicVisibility !== initialSnapshot.invitePublicVisibility
    );
  }, [
    title,
    description,
    eventDate,
    endDate,
    hasEndTime,
    hasGates,
    eventType,
    locationUrl,
    locationName,
    virtualLink,
    maxAttendees,
    bannerCarousel,
    gallery,
    highlights,
    featuredAccounts,
    thingsToKnow,
    ticketTypes,
    promos,
    categories,
    accessType,
    invitePublicVisibility,
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
      if (
        (eventType === "in-person" || eventType === "hybrid") &&
        !locationName.trim()
      ) {
        Alert.alert("Required", "Please enter a location name so attendees can identify the venue");
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
        event_date: eventDate.toISOString(),
        start_datetime: eventDate.toISOString(),
        has_time: true,
        end_datetime: hasEndTime ? endDate.toISOString() : null,
        has_end_time: hasEndTime,
        gates_open_time:
          hasGates && gatesOpenTime ? gatesOpenTime.toISOString() : null,
        location_url: locationUrl.trim() || null,
        location_name: locationName.trim() || null,
        max_attendees: maxAttendees ? parseInt(maxAttendees) : null,
        event_type: eventType,
        virtual_link: virtualLink.trim() || null,
        banner_carousel: bannerCarousel,
        gallery,
        highlights,
        featured_accounts: featuredAccounts,
        things_to_know: thingsToKnow,
        ticket_types:
          ticketTypes.length > 0
            ? ticketTypes.map((t) => ({
                ...t,
                base_price:
                  t.base_price !== undefined
                    ? t.base_price
                    : parseFloat(t.price || 0),
                total_quantity:
                  t.total_quantity !== undefined
                    ? t.total_quantity
                    : parseInt(t.quantity || 0),
              }))
            : null,
        discount_codes: (() => {
          const codes = promos.filter((p) => p.offer_type === "promo_code");
          return codes.length > 0
            ? codes.map((p) => ({
                code: p.code,
                discount_type: p.discount_type,
                discount_value:
                  p.discount_value !== undefined ? p.discount_value : p.value,
                max_uses: p.max_uses,
                valid_from: p.valid_from,
                valid_until: p.valid_until,
                applies_to: p.applies_to,
                selected_tickets: p.selected_tickets,
                stackable: p.stackable,
                min_purchase: p.min_purchase,
                is_active: p.is_active,
                name: p.name,
              }))
            : null;
        })(),
        pricing_rules: (() => {
          const rules = promos.filter((p) => p.offer_type === "early_bird");
          return rules.length > 0
            ? rules.map((p) => ({
                name: p.name,
                rule_type:
                  p.trigger === "by_sales"
                    ? "early_bird_quantity"
                    : "early_bird_time",
                discount_type: p.discount_type,
                discount_value:
                  p.discount_value !== undefined ? p.discount_value : p.value,
                valid_until: p.valid_until,
                quantity_threshold: p.quantity_threshold,
                is_active: p.is_active,
                applies_to: p.applies_to,
                selected_tickets: p.selected_tickets,
              }))
            : null;
        })(),
        categories: categories.length > 0 ? categories : [],
        access_type: accessType,
        invite_public_visibility: invitePublicVisibility,
      };

      console.log(
        "[EditEventModal] Saving with access_type:",
        accessType,
        "invite_public_visibility:",
        invitePublicVisibility,
      );
      console.log(
        "[EditEventModal] Full updateData:",
        JSON.stringify(updateData, null, 2),
      );

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
            ref={scrollViewRef}
            style={styles.stepContent}
            contentContainerStyle={{ paddingBottom: 120 }}
          >
            <View style={styles.sectionHeaderNew}>
              <View style={styles.sectionHeaderTitleRow}>
                <View style={styles.sectionHeaderIconContainer}>
                  <BookMarked
                    size={24}
                    color={MODAL_TOKENS.primary}
                    strokeWidth={2}
                  />
                </View>
                <Text style={styles.sectionHeaderTitle}>Event Details</Text>
              </View>
              <Text style={styles.sectionHeaderHelper}>
                Set the name, date, time, ticket and much more of your event.
              </Text>
            </View>

            {/* Title */}
            <View style={styles.sectionBlock}>
              <Text style={styles.label}>Event Title</Text>
              <View style={styles.titleInputContainer}>
                <TextInput
                  style={styles.titleInput}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Name your event"
                  placeholderTextColor={MODAL_TOKENS.textMuted}
                />
              </View>
            </View>

            {/* Date & Time */}
            <View style={styles.sectionBlock}>
              <Text style={styles.label}>Date &amp; Time</Text>
              <View style={{ gap: 12 }}>
                <TouchableOpacity
                  style={[styles.dateCard, { width: "100%", flex: 0 }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <View style={styles.dateCardIconInfo}>
                    <Calendar size={16} color={MODAL_TOKENS.primary} />
                  </View>
                  <View>
                    <Text style={styles.dateCardLabel}>Date</Text>
                    <Text style={styles.dateCardValue}>
                      {eventDate ? eventDate.toLocaleDateString() : "Pick date"}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <TouchableOpacity
                    style={styles.dateCard}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <View style={styles.dateCardIconInfo}>
                      <Clock size={16} color={MODAL_TOKENS.primary} />
                    </View>
                    <View>
                      <Text style={styles.dateCardLabel}>Start Time</Text>
                      <Text style={styles.dateCardValue}>
                        {eventDate
                          ? eventDate.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Pick time"}
                      </Text>
                    </View>
                  </TouchableOpacity>

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
                onConfirm={({ startDate: newStart, endDate: newEnd }) => {
                  const newEventDate = new Date(newStart);
                  if (eventDate) {
                    newEventDate.setHours(
                      eventDate.getHours(),
                      eventDate.getMinutes(),
                      0,
                      0,
                    );
                  }
                  setEventDate(newEventDate);
                  if (newEnd) {
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
                    setEndDate(null);
                  }
                }}
              />

              <CustomTimePicker
                visible={showTimePicker}
                onClose={() => setShowTimePicker(false)}
                time={eventDate || new Date()}
                onChange={(newTime) => {
                  setEventDate(newTime);
                  if (hasEndTime && endDate) {
                    const minEnd = new Date(newTime.getTime() + 15 * 60 * 1000);
                    if (endDate < minEnd) {
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
                onChange={(newTime) => {
                  setHasEndTime(true);
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

            {/* Gates */}
            <View style={styles.sectionBlock}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: hasGates ? 16 : 0,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>
                    Gates / Early Entry{" "}
                    <Text style={styles.sectionHeaderOptional}>
                      • (Optional)
                    </Text>
                  </Text>
                  <Text style={styles.sectionHeaderHelper}>
                    Allow early access before the event starts.
                  </Text>
                </View>
                <Switch
                  value={hasGates}
                  onValueChange={(val) => {
                    LayoutAnimation.configureNext(
                      LayoutAnimation.Presets.easeInEaseOut,
                    );
                    setHasGates(val);
                    if (!val) setGatesOpenTime(null);
                  }}
                  thumbColor={hasGates ? "#FFFFFF" : "#FFFFFF"}
                  trackColor={{ false: "#D1D5DB", true: MODAL_TOKENS.primary }}
                  ios_backgroundColor="#D1D5DB"
                />
              </View>
              {hasGates && (
                <TouchableOpacity
                  style={styles.dateCard}
                  onPress={() => setShowGatesTimePicker(true)}
                >
                  <View style={styles.dateCardIconInfo}>
                    <Clock size={16} color={MODAL_TOKENS.primary} />
                  </View>
                  <View>
                    <Text style={styles.dateCardLabel}>Gates Open</Text>
                    <Text style={styles.dateCardValue}>
                      {gatesOpenTime
                        ? gatesOpenTime.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Set time"}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              <CustomTimePicker
                visible={showGatesTimePicker}
                onClose={() => setShowGatesTimePicker(false)}
                time={gatesOpenTime || eventDate || new Date()}
                onChange={(newTime) => {
                  setGatesOpenTime(newTime);
                }}
              />
            </View>

            {/* Event Type — Sliding Gradient Segment */}
            <View style={styles.sectionBlock}>
              <Text style={styles.label}>Event Type</Text>
              <View
                style={styles.eventTypeRow}
                onLayout={(e) => {
                  const width = e.nativeEvent.layout.width;
                  setTabWidth((width - 12) / 3);
                }}
              >
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
                  />
                </Animated.View>

                {[
                  { id: "in-person", label: "In-Person", Icon: Users },
                  { id: "virtual", label: "Virtual", Icon: Video },
                  { id: "hybrid", label: "Hybrid", Icon: Layers },
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
                        <item.Icon
                          size={16}
                          color={
                            isSelected ? "rgba(255,255,255,0.9)" : "#6B7280"
                          }
                        />
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

            {/* Event Visibility */}
            <View style={styles.sectionBlock}>
              <Text style={styles.label}>Event Visibility</Text>
              <View style={styles.visibilityContainer}>
                {[
                  { value: "public", label: "Public", Icon: Earth },
                  { value: "invite_only", label: "Invite Only", Icon: Lock },
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
                        <opt.Icon
                          size={24}
                          color={
                            isSelected ? "#FFF" : MODAL_TOKENS.textSecondary
                          }
                        />
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

            {/* Location */}
            {eventType !== "virtual" && (
              <>
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
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
                <View style={[styles.sectionBlock, { marginTop: -8 }]}>
                  <Text style={styles.label}>Location Name</Text>
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
                      placeholder="e.g. Room 302, Central Park"
                      placeholderTextColor={MODAL_TOKENS.textMuted}
                    />
                  </View>
                  <Text
                    style={{
                      fontFamily: "Manrope-Regular",
                      fontSize: 12,
                      color: MODAL_TOKENS.textMuted,
                      marginTop: 4,
                    }}
                  >
                    Give attendees a recognisable name for your venue.
                  </Text>
                </View>
              </>
            )}

            {/* Virtual Link */}
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

            {/* Ticketing */}
            <View style={styles.sectionBlock}>
              <TicketTypesEditor
                ticketTypes={ticketTypes}
                onChange={setTicketTypes}
                promos={promos}
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
          <ScrollView
            ref={scrollViewRef}
            style={styles.stepContent}
            contentContainerStyle={{ paddingBottom: 120 }}
          >
            <View style={styles.sectionHeaderNew}>
              <View style={styles.sectionHeaderTitleRow}>
                <View style={styles.sectionHeaderIconContainer}>
                  <Camera
                    size={24}
                    color={MODAL_TOKENS.primary}
                    strokeWidth={2}
                  />
                </View>
                <Text style={styles.sectionHeaderTitle}>Media</Text>
              </View>
              <Text style={styles.sectionHeaderHelper}>
                Add photos to make your event look more appealing.
              </Text>
            </View>
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
          <ScrollView
            ref={scrollViewRef}
            style={styles.stepContent}
            contentContainerStyle={{ paddingBottom: 100 }}
          >
            <View style={styles.sectionHeaderNew}>
              <View style={styles.sectionHeaderTitleRow}>
                <View style={styles.sectionHeaderIconContainer}>
                  <NotebookPen
                    size={24}
                    color={MODAL_TOKENS.primary}
                    strokeWidth={2}
                  />
                </View>
                <Text style={styles.sectionHeaderTitle}>Description</Text>
              </View>
              <Text style={styles.sectionHeaderHelper}>
                Provide a detailed overview of your event to help people
                understand what to expect.
              </Text>
            </View>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              minLength={50}
              variant="minimal"
            />
          </ScrollView>
        );
      case 4:
        return (
          <ScrollView
            style={styles.stepContent}
            contentContainerStyle={{ paddingBottom: 120 }}
          >
            <HighlightsEditor
              highlights={highlights}
              onChange={setHighlights}
              maxHighlights={5}
            />
          </ScrollView>
        );
      case 5:
        return (
          <ScrollView
            style={styles.stepContent}
            contentContainerStyle={{ paddingBottom: 120 }}
          >
            <FeaturedAccountsEditor
              accounts={featuredAccounts}
              onChange={setFeaturedAccounts}
            />
          </ScrollView>
        );
      case 6:
        return (
          <ScrollView
            ref={scrollViewRef}
            style={styles.stepContent}
            contentContainerStyle={{ paddingBottom: 120 }}
          >
            <View style={styles.sectionHeaderNew}>
              <View style={styles.sectionHeaderTitleRow}>
                <View style={styles.sectionHeaderIconContainer}>
                  <BookOpenCheck
                    size={24}
                    color={MODAL_TOKENS.primary}
                    strokeWidth={2}
                  />
                </View>
                <Text style={styles.sectionHeaderTitle}>Things to Know</Text>
              </View>
              <Text style={styles.sectionHeaderHelper}>
                Add important details like dress code, age limits, arrival
                instructions and much more.
              </Text>
            </View>
            <ThingsToKnowEditor
              items={thingsToKnow}
              onChange={setThingsToKnow}
              minItems={3}
            />
          </ScrollView>
        );
      case 7: {
        return (
          <ScrollView
            style={styles.stepContent}
            contentContainerStyle={{ paddingBottom: 160 }}
          >
            <View style={styles.sectionHeaderNew}>
              <View style={styles.sectionHeaderTitleRow}>
                <View style={styles.sectionHeaderIconContainer}>
                  <Glasses
                    size={24}
                    color={MODAL_TOKENS.primary}
                    strokeWidth={2}
                  />
                </View>
                <Text style={styles.sectionHeaderTitle}>
                  Review <Text style={styles.sectionHeaderOptional}></Text>
                </Text>
              </View>
              <Text style={styles.sectionHeaderHelper}>
                Verify your updates before saving.
              </Text>
            </View>

            {/* ── Card 1: Basics ── */}
            <View style={styles.reviewCardGroup}>
              <View style={styles.reviewCardHeader}>
                <Text style={styles.reviewCardTitle}>Basics</Text>
                <TouchableOpacity
                  style={styles.reviewEditButton}
                  onPress={() => setCurrentStep(1)}
                  activeOpacity={0.7}
                >
                  <Pencil
                    size={14}
                    color={MODAL_TOKENS.primary}
                    strokeWidth={2}
                  />
                  <Text style={styles.reviewEditText}>Edit</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Event Title</Text>
                <Text style={styles.reviewValue}>
                  {title || "No title set"}
                </Text>
              </View>

              <View style={styles.reviewDivider} />

              <View style={styles.reviewRow}>
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

              <View style={styles.reviewDivider} />

              {hasGates && gatesOpenTime && (
                <>
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewLabel}>Gates Open</Text>
                    <Text style={styles.reviewValue}>
                      {gatesOpenTime.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <View style={styles.reviewDivider} />
                </>
              )}

              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Event Type</Text>
                <Text style={styles.reviewValue}>
                  {eventType.charAt(0).toUpperCase() + eventType.slice(1)}
                </Text>
              </View>

              <View style={styles.reviewDivider} />

              {eventType !== "virtual" ? (
                <TouchableOpacity
                  style={styles.reviewRow}
                  onPress={() => locationUrl && Linking.openURL(locationUrl)}
                  activeOpacity={locationUrl ? 0.7 : 1}
                >
                  <Text style={styles.reviewLabel}>Location</Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <MapPin
                      size={16}
                      color={MODAL_TOKENS.primary}
                      strokeWidth={2}
                    />
                    <Text
                      style={[
                        styles.reviewValue,
                        { color: MODAL_TOKENS.textPrimary, flex: 1 },
                      ]}
                    >
                      {displayLocationName || "No location set"}
                    </Text>
                  </View>
                  {locationUrl && (
                    <Text style={styles.reviewLocationSubtitle}>
                      Tap to open in Maps
                    </Text>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Virtual Link</Text>
                  <Text style={styles.reviewValue} numberOfLines={2}>
                    {virtualLink || "No link set"}
                  </Text>
                </View>
              )}

              {categories.length > 0 && (
                <>
                  <View style={styles.reviewDivider} />
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewLabel}>Categories</Text>
                    <Text style={styles.reviewValue}>
                      {categories
                        .map((id) => categoryMapRef.current[id] || String(id))
                        .join(", ")}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* ── Card 2: Tickets ── */}
            <View style={styles.reviewCardGroup}>
              <View style={styles.reviewCardHeader}>
                <Text style={styles.reviewCardTitle}>Tickets</Text>
                <TouchableOpacity
                  style={styles.reviewEditButton}
                  onPress={() => setCurrentStep(1)}
                  activeOpacity={0.7}
                >
                  <Pencil
                    size={14}
                    color={MODAL_TOKENS.primary}
                    strokeWidth={2}
                  />
                  <Text style={styles.reviewEditText}>Edit</Text>
                </TouchableOpacity>
              </View>

              {ticketTypes.map((t, idx) => {
                // Find all promos that apply to this ticket
                const applicablePromos = promos.filter((p) => {
                  if (!p.discount_value || parseFloat(p.discount_value) <= 0)
                    return false;
                  if (p.applies_to === "all") return true;
                  if (p.applies_to === "specific")
                    return p.selected_tickets?.includes(t.name);
                  return false;
                });

                // Compute the lowest discounted price across all applicable promos
                const basePrice = parseFloat(t.base_price) || 0;
                let lowestPrice = basePrice;
                let bestPromo = null;
                applicablePromos.forEach((p) => {
                  const val = parseFloat(p.discount_value);
                  const discounted =
                    p.discount_type === "percentage"
                      ? basePrice - (basePrice * Math.min(val, 100)) / 100
                      : Math.max(0, basePrice - val);
                  if (discounted < lowestPrice) {
                    lowestPrice = discounted;
                    bestPromo = p;
                  }
                });
                const hasDiscount = bestPromo !== null && basePrice > 0;

                return (
                  <View key={idx} style={styles.ticketMiniCard}>
                    {/* Name row + promo badges */}
                    <View style={styles.ticketMiniNameRow}>
                      <Text style={styles.ticketMiniName}>{t.name}</Text>
                      {applicablePromos.map((p, pi) => (
                        <View
                          key={pi}
                          style={[
                            styles.ticketPromoBadge,
                            p.offer_type === "promo_code"
                              ? { backgroundColor: "#F0FDF4" }
                              : { backgroundColor: "#FFF7ED" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.ticketPromoBadgeText,
                              p.offer_type === "promo_code"
                                ? { color: "#16A34A" }
                                : { color: "#EA580C" },
                            ]}
                          >
                            {p.offer_type === "promo_code"
                              ? p.code || p.name
                              : p.name || "Early Bird"}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Price row */}
                    <View style={styles.ticketMiniRow}>
                      {basePrice === 0 ? (
                        <Text style={styles.ticketMiniPrice}>Free</Text>
                      ) : hasDiscount ? (
                        <>
                          <Text style={styles.ticketMiniPriceStrike}>
                            ₹{t.base_price}
                          </Text>
                          <Text style={styles.ticketMiniPriceDiscounted}>
                            ₹{Math.round(lowestPrice)}
                          </Text>
                          <Text style={styles.ticketMiniDot}>•</Text>
                          <Text
                            style={[
                              styles.ticketMiniQty,
                              {
                                color:
                                  bestPromo.offer_type === "promo_code"
                                    ? "#16A34A"
                                    : "#EA580C",
                              },
                            ]}
                          >
                            {bestPromo.discount_type === "percentage"
                              ? `${bestPromo.discount_value}% OFF`
                              : `₹${bestPromo.discount_value} OFF`}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.ticketMiniPrice}>
                          ₹{t.base_price}
                        </Text>
                      )}
                      <Text style={styles.ticketMiniDot}>•</Text>
                      <Text style={styles.ticketMiniQty}>
                        {t.total_quantity} available
                      </Text>
                    </View>
                  </View>
                );
              })}

              {ticketTypes.length === 0 && (
                <Text
                  style={[
                    styles.reviewValue,
                    { fontStyle: "italic", color: MODAL_TOKENS.textSecondary },
                  ]}
                >
                  No tickets added
                </Text>
              )}
            </View>

            {/* ── Card 3: Content ── */}
            <View style={styles.reviewCardGroup}>
              <View style={styles.reviewCardHeader}>
                <Text style={styles.reviewCardTitle}>Content</Text>
                <TouchableOpacity
                  style={styles.reviewEditButton}
                  onPress={() => setCurrentStep(2)}
                  activeOpacity={0.7}
                >
                  <Pencil
                    size={14}
                    color={MODAL_TOKENS.primary}
                    strokeWidth={2}
                  />
                  <Text style={styles.reviewEditText}>Edit</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Media</Text>
                <Text style={styles.reviewValue}>
                  {bannerCarousel.length} Banner
                  {bannerCarousel.length !== 1 ? "s" : ""}, {gallery.length}{" "}
                  Gallery image{gallery.length !== 1 ? "s" : ""}
                </Text>
              </View>

              <View style={styles.reviewDivider} />

              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Description</Text>
                <Text style={styles.reviewDescriptionValue}>
                  {description
                    ? description.replace(/<[^>]*>?/gm, "")
                    : "No description"}
                </Text>
              </View>

              {highlights.length > 0 && (
                <>
                  <View style={styles.reviewDivider} />
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewLabel}>Highlights</Text>
                    {highlights.map((h, idx) => (
                      <Text key={idx} style={styles.reviewValue}>
                        • {h.title}
                      </Text>
                    ))}
                  </View>
                </>
              )}

              {featuredAccounts.length > 0 && (
                <>
                  <View style={styles.reviewDivider} />
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewLabel}>Featured</Text>
                    {featuredAccounts.map((a, idx) => (
                      <Text key={idx} style={styles.reviewValue}>
                        • {a.display_name || a.account_name} ({a.role})
                      </Text>
                    ))}
                  </View>
                </>
              )}

              {thingsToKnow.length > 0 && (
                <>
                  <View style={styles.reviewDivider} />
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewLabel}>Things to Know</Text>
                    {thingsToKnow.map((item, idx) => (
                      <Text key={idx} style={styles.reviewValue}>
                        • {item.label}
                      </Text>
                    ))}
                  </View>
                </>
              )}
            </View>

            <View style={styles.infoBanner}>
              <Info size={20} color={MODAL_TOKENS.primary} />
              <Text style={styles.infoText}>
                Attendees will be notified of key changes to date, title, or
                location.
              </Text>
            </View>
          </ScrollView>
        );
      }
      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <SafeAreaView style={styles.container}>
        {/* Progress Bar Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              onPress={handleCloseAttempt}
              style={styles.closeButton}
            >
              <X size={24} color={MODAL_TOKENS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Event</Text>
            {hasChanges && currentStep !== totalSteps ? (
              <TouchableOpacity
                style={styles.reviewJumpButton}
                onPress={() => setCurrentStep(totalSteps)}
                activeOpacity={0.8}
              >
                <Text style={styles.reviewJumpButtonText}>Review</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 60 }} />
            )}
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

        {/* Floating Pill CTA */}
        <KeyboardStickyView
          offset={{ opened: insets.bottom + 12, closed: 0 }}
          style={styles.stickyFooter}
        >
          <View
            style={[
              styles.floatingFooter,
              { paddingBottom: insets.bottom + 24 },
            ]}
          >
            {currentStep > 1 && (
              <TouchableOpacity
                onPress={handleBack}
                style={styles.floatingBackButton}
                disabled={loading}
              >
                <Text style={styles.floatingBackButtonText}>Back</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={currentStep === 7 ? handleSave : handleNext}
              style={[
                styles.floatingNextButton,
                loading && { opacity: 0.7 },
                currentStep === 1 && { marginLeft: "auto" },
              ]}
              disabled={loading}
            >
              {loading ? (
                <SnooLoader color="#fff" />
              ) : (
                <LinearGradient
                  colors={
                    currentStep === 7 && !hasChanges
                      ? ["#E5E7EB", "#D1D5DB"]
                      : MODAL_TOKENS.primaryGradient
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              {!loading && (
                <Text
                  style={[
                    styles.floatingNextButtonText,
                    { fontFamily: "Manrope-SemiBold" },
                  ]}
                >
                  {currentStep === 7 ? "Save Changes" : "Next"}
                </Text>
              )}
              {!loading && currentStep !== 7 && (
                <ArrowRight size={18} color="#fff" style={{ marginLeft: 8 }} />
              )}
              {!loading && currentStep === 7 && (
                <CheckCircle size={18} color="#fff" style={{ marginLeft: 8 }} />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardStickyView>
      </SafeAreaView>

      {/* Unsaved Changes Modal */}
      <Modal
        visible={showUnsavedModal}
        transparent
        animationType="fade"
        statusBarTranslucent={true}
      >
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
                <AlertCircle size={28} color="#FFF" />
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
                colors={MODAL_TOKENS.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.unsavedPrimaryBtn}
              >
                <CheckCircle size={18} color="#FFF" />
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
              <Trash2 size={16} color="#EF4444" />
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
  container: {
    flex: 1,
    backgroundColor: MODAL_TOKENS.background,
  },

  // ── Header ──
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
  reviewJumpButton: {
    backgroundColor: MODAL_TOKENS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  reviewJumpButtonText: {
    fontFamily: MODAL_TOKENS.fonts.semibold,
    fontSize: 13,
    color: "#FFFFFF",
  },

  // ── Progress Bar ──
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

  // ── Step Content ──
  stepContent: {
    flex: 1,
    padding: 20,
  },

  // ── Section Headers ──
  sectionHeaderNew: {
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  sectionHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionHeaderIconContainer: {
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionHeaderTitle: {
    fontFamily: MODAL_TOKENS.fonts.bold,
    fontSize: 22,
    color: MODAL_TOKENS.textPrimary,
  },
  sectionHeaderHelper: {
    fontFamily: MODAL_TOKENS.fonts.regular,
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },
  sectionHeaderOptional: {
    fontFamily: MODAL_TOKENS.fonts.regular,
    fontSize: 14,
    color: "#9CA3AF",
  },

  // ── Section Blocks ──
  sectionBlock: {
    marginBottom: 24,
    backgroundColor: MODAL_TOKENS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: MODAL_TOKENS.border,
    padding: 20,
  },

  // ── Labels & Inputs ──
  label: {
    fontFamily: MODAL_TOKENS.fonts.semibold,
    fontSize: 16,
    color: MODAL_TOKENS.textPrimary,
    marginBottom: 12,
  },
  titleInputContainer: {
    backgroundColor: MODAL_TOKENS.background,
    borderRadius: MODAL_TOKENS.radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: MODAL_TOKENS.border,
  },
  titleInput: {
    fontFamily: MODAL_TOKENS.fonts.semibold,
    fontSize: 16,
    color: MODAL_TOKENS.textPrimary,
    padding: 0,
  },

  // ── Date Cards ──
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
    color: "#6B7280",
  },
  dateCardValue: {
    fontFamily: MODAL_TOKENS.fonts.semibold,
    fontSize: 14,
    color: "#111827",
  },

  // ── Toggle Pill (Gates) ──
  togglePill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: MODAL_TOKENS.border,
    backgroundColor: MODAL_TOKENS.background,
  },
  togglePillActive: {
    borderColor: MODAL_TOKENS.primary,
    backgroundColor: MODAL_TOKENS.primary,
  },
  togglePillText: {
    fontFamily: MODAL_TOKENS.fonts.semibold,
    fontSize: 14,
    color: MODAL_TOKENS.textSecondary,
  },
  togglePillTextActive: {
    color: "#FFFFFF",
  },

  // ── Event Type Segmented ──
  eventTypeRow: {
    flexDirection: "row",
    backgroundColor: "#F5F8FF",
    borderRadius: 16,
    height: 52,
    padding: 6,
    marginBottom: 0,
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

  // ── Visibility Cards ──
  visibilityContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 0,
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
    fontFamily: MODAL_TOKENS.fonts.semibold,
    fontSize: 14,
    color: "#FFFFFF",
  },

  // ── Checkbox ──
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

  // ── Location ──
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
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

  // ── Floating Footer ──
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  floatingFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
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

  // ── Info Banner ──
  infoBanner: {
    flexDirection: "row",
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    padding: 16,
    gap: 12,
    alignItems: "flex-start",
    marginTop: 8,
    marginBottom: 8,
  },
  infoText: {
    fontFamily: MODAL_TOKENS.fonts.regular,
    fontSize: 14,
    color: MODAL_TOKENS.textSecondary,
    flex: 1,
    lineHeight: 20,
  },

  // ── Review ──
  reviewCardGroup: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: MODAL_TOKENS.border,
    ...MODAL_TOKENS.shadow.sm,
  },
  reviewCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  reviewCardTitle: {
    fontFamily: MODAL_TOKENS.fonts.bold,
    fontSize: 16,
    color: MODAL_TOKENS.textPrimary,
  },
  reviewEditButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: MODAL_TOKENS.surface,
  },
  reviewEditText: {
    fontFamily: MODAL_TOKENS.fonts.semibold,
    fontSize: 13,
    color: MODAL_TOKENS.primary,
  },
  reviewRow: {
    paddingVertical: 6,
  },
  reviewDivider: {
    height: 1,
    backgroundColor: MODAL_TOKENS.border,
    marginVertical: 4,
  },
  reviewLabel: {
    fontFamily: MODAL_TOKENS.fonts.medium,
    fontSize: 12,
    color: MODAL_TOKENS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  reviewValue: {
    fontFamily: MODAL_TOKENS.fonts.regular,
    fontSize: 15,
    color: MODAL_TOKENS.textPrimary,
    lineHeight: 22,
  },
  reviewSubValue: {
    fontFamily: MODAL_TOKENS.fonts.regular,
    fontSize: 13,
    color: MODAL_TOKENS.textSecondary,
    marginTop: 2,
  },
  reviewDescriptionValue: {
    fontFamily: MODAL_TOKENS.fonts.regular,
    fontSize: 14,
    color: MODAL_TOKENS.textPrimary,
    lineHeight: 22,
  },
  reviewLocationSubtitle: {
    fontFamily: MODAL_TOKENS.fonts.regular,
    fontSize: 12,
    color: MODAL_TOKENS.primary,
    marginTop: 4,
  },
  ticketMiniCard: {
    backgroundColor: MODAL_TOKENS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: MODAL_TOKENS.border,
  },
  ticketMiniName: {
    fontFamily: MODAL_TOKENS.fonts.semibold,
    fontSize: 14,
    color: MODAL_TOKENS.textPrimary,
  },
  ticketMiniNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  ticketPromoBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ticketPromoBadgeText: {
    fontFamily: MODAL_TOKENS.fonts.semibold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  ticketMiniRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ticketMiniPrice: {
    fontFamily: MODAL_TOKENS.fonts.medium,
    fontSize: 13,
    color: MODAL_TOKENS.textSecondary,
  },
  ticketMiniDot: {
    fontFamily: MODAL_TOKENS.fonts.regular,
    fontSize: 13,
    color: MODAL_TOKENS.textMuted,
  },
  ticketMiniQty: {
    fontFamily: MODAL_TOKENS.fonts.medium,
    fontSize: 13,
    color: MODAL_TOKENS.textSecondary,
  },
  ticketMiniPriceStrike: {
    fontFamily: MODAL_TOKENS.fonts.medium,
    fontSize: 13,
    color: MODAL_TOKENS.textMuted,
    textDecorationLine: "line-through",
  },
  ticketMiniPriceDiscounted: {
    fontFamily: MODAL_TOKENS.fonts.semibold,
    fontSize: 14,
    color: MODAL_TOKENS.textPrimary,
  },

  // ── Unsaved Changes Modal ──
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
    fontFamily: MODAL_TOKENS.fonts.bold,
    fontSize: 20,
    color: "#1F2937",
    marginBottom: 8,
  },
  unsavedMessage: {
    fontFamily: MODAL_TOKENS.fonts.regular,
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
    fontFamily: MODAL_TOKENS.fonts.semibold,
    color: "#FFF",
    fontSize: 16,
  },
  unsavedSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 6,
  },
  unsavedSecondaryText: {
    fontFamily: MODAL_TOKENS.fonts.semibold,
    fontSize: 14,
    color: "#EF4444",
  },
  unsavedCancelBtn: {
    paddingVertical: 8,
  },
  unsavedCancelText: {
    fontFamily: MODAL_TOKENS.fonts.medium,
    fontSize: 14,
    color: "#6B7280",
  },
});
