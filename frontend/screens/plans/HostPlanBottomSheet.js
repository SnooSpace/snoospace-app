import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Switch,
  Alert,
  ActivityIndicator,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Dimensions,
  Keyboard,
  Image,
} from "react-native";
import SwipeableModal from "../../components/modals/SwipeableModal";
import {
  Users,
  Globe,
  ChevronDown,
  Minus,
  Plus,
  RefreshCw,
  AlertCircle,
  Calendar,
  Lock,
  MapPin,
  Clock,
  Image as ImageIcon,
  X,
  Venus,
  Mars,
  VenusAndMars,
} from "lucide-react-native";
import { COLORS, FONTS, BORDER_RADIUS, SHADOWS } from "../../constants/theme";
import { getAuthToken } from "../../api/auth";
import { createPlan, uploadPlanBanner } from "../../api/plans";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import PlanCropImage from "./PlanCropImage";
import { useCrop } from "../../components/MediaCrop";
import CustomDatePicker from "../../components/ui/CustomDatePicker";
import CustomTimePicker from "../../components/ui/CustomTimePicker";
import VenueSearchSheet from "../../components/location/VenueSearchSheet";
import MapLocationPicker from "../../components/location/MapLocationPicker";
import { getActiveProvider } from "../../services/location/index";
import { useToast } from "../../context/ToastContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CONTAINER_WIDTH = SCREEN_WIDTH - 40;

const ACTIVITIES = [
  { key: "sports", label: "🏀 Sports" },
  { key: "food", label: "🍜 Food" },
  { key: "cafe", label: "☕ Cafe" },
  { key: "bar", label: "🍸 Bar" },
  { key: "movies", label: "🎬 Movies" },
  { key: "live_music", label: "🎵 Live Music" },
  { key: "gaming", label: "🎮 Games" },
  { key: "gym", label: "💪 Gym" },
  { key: "yoga", label: "🧘 Yoga" },
  { key: "walk", label: "🚶 Walk" },
  { key: "rides", label: "🏍 Rides" },
  { key: "hangout", label: "🌳 Hangout" },
  { key: "creative", label: "🎨 Creative" },
  { key: "study", label: "📚 Study / Co-work" },
  { key: "pet_friendly", label: "🐾 Pet Friendly" },
  { key: "house_party", label: "🏡 House Party" },
  { key: "club", label: "🪩 Club" },
  { key: "hiking", label: "🥾 Hiking" },
  { key: "shopping", label: "🛍️ Shopping" },
  { key: "other", label: "＋ Other…" },
];

const COST_OPTS = [
  { key: "free", label: "Free" },
  { key: "self_pay", label: "Self-pay" },
  { key: "split", label: "We split" },
  { key: "entry_fee", label: "Entry fee" },
];

const GENDER_OPTS = [
  { key: "all", label: "Everyone" },
  { key: "Female", label: "Women only" },
  { key: "Male", label: "Men only" },
];

function formatDateTime(date, time) {
  if (!date) return null;
  const d = new Date(date);
  if (time) {
    d.setHours(time.getHours(), time.getMinutes(), 0, 0);
  }
  return d.toISOString();
}

function displayDateTime(date, time) {
  if (!date) return "Pick date & time";
  const d = new Date(date);
  if (time) d.setHours(time.getHours(), time.getMinutes());
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function HostPlanBottomSheet({
  isVisible,
  onClose,
  onPlanCreated,
  navigation,
}) {
  const { showToast } = useToast();
  const [activityType, setActivityType] = useState("sports");
  const [customLabel, setCustomLabel] = useState("");
  const [title, setTitle] = useState("");
  const [costType, setCostType] = useState("free");
  const [costAmount, setCostAmount] = useState("");
  const [visibility, setVisibility] = useState("everyone");
  const [genderPref, setGenderPref] = useState("all");
  const [locationPublic, setLocationPublic] = useState("");
  const [locationPrivate, setLocationPrivate] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [maxAccepted, setMaxAccepted] = useState(5);
  const [isRecurring, setIsRecurring] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // ── Banner (custom upload) ──
  const [bannerUri, setBannerUri] = useState(null);     // local file URI for preview
  const [bannerBase64, setBannerBase64] = useState(null); // base64 for upload
  const [bannerUploading, setBannerUploading] = useState(false);
  const [isCropping, setIsCropping] = useState(false);

  const { pickAndCrop } = useCrop();

  // ── Venue / Location (new unified flow) ──
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [pendingPlace, setPendingPlace] = useState(null);
  const [venueSheetVisible, setVenueSheetVisible] = useState(false);
  const [mapPickerVisible, setMapPickerVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKeyboardHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const dynamicMaxHeight =
    SCREEN_HEIGHT * 0.85 - (Platform.OS === "android" ? keyboardHeight : 0);

  const resetState = () => {
    setActivityType("sports");
    setCustomLabel("");
    setTitle("");
    setCostType("free");
    setCostAmount("");
    setVisibility("everyone");
    setGenderPref("all");
    setLocationPublic("");
    setLocationPrivate("");
    setSelectedDate(null);
    setSelectedTime(null);
    setMaxAccepted(5);
    setIsRecurring(false);
    setErrors({});
    setSelectedVenue(null);
    setPendingPlace(null);
    setBannerUri(null);
    setBannerBase64(null);
  };

  const validate = () => {
    const e = {};
    if (!title.trim()) e.title = "Required";
    if (title.trim().length > 100) e.title = "Max 100 characters";
    if (activityType === "other" && !customLabel.trim())
      e.customLabel = 'Required for "Other"';
    if (!selectedDate) e.date = "Required";
    if (!selectedTime) e.time = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const pickBanner = async () => {
    try {
      setIsCropping(true);
      const result = await pickAndCrop("event");
      setIsCropping(false);
      if (!result) return;

      setBannerUri(result.uri);
      // Compress and convert to base64 for Cloudinary
      const manipulated = await ImageManipulator.manipulateAsync(
        result.uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      setBannerBase64(`data:image/jpeg;base64,${manipulated.base64}`);
    } catch (e) {
      setIsCropping(false);
      Alert.alert('Error', 'Could not crop image.');
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const token = await getAuthToken();

      // Upload custom banner if selected
      let bannerImageUrl = null;
      if (bannerBase64) {
        setBannerUploading(true);
        const uploadRes = await uploadPlanBanner(bannerBase64, token);
        bannerImageUrl = uploadRes?.data?.url || null;
        setBannerUploading(false);
      }

      const scheduledAt = formatDateTime(selectedDate, selectedTime);
      const body = {
        activity_type: activityType,
        custom_activity_label:
          activityType === "other" ? customLabel.trim() : undefined,
        title: title.trim(),
        cost_type: costType,
        cost_amount_paise: costAmount
          ? Math.round(parseFloat(costAmount) * 100)
          : null,
        visibility,
        gender_preference: genderPref,
        location_public: locationPublic.trim() || null,
        location_private: selectedVenue
          ? JSON.stringify({
              name: selectedVenue.venueName,
              address: selectedVenue.venueAddress,
              short_address: selectedVenue.venueShortAddress,
              lat: selectedVenue.venueLat,
              lng: selectedVenue.venueLng,
              place_id: selectedVenue.venueProviderId,
              provider: selectedVenue.venueProvider,
              manually_adjusted: selectedVenue.manuallyAdjusted,
            })
          : locationPrivate.trim() || null,
        scheduled_at: scheduledAt,
        max_accepted: maxAccepted,
        is_recurring: isRecurring,
        recurrence_interval: isRecurring ? "weekly" : null,
        banner_image_url: bannerImageUrl,
      };
      const data = await createPlan(body, token);
      showToast("Success", "Open plan created successfully!");
      onPlanCreated(data.plan);
      resetState();
      onClose();
    } catch (err) {
      setBannerUploading(false);
      if (err.status === 403 && err.data?.error === "proof_gate_required") {
        Alert.alert(
          "Profile incomplete",
          "To host a plan, add a post, connect Instagram, or get verified.",
          [
            { text: "Not now", style: "cancel" },
            {
              text: "Get verified",
              onPress: () => {
                onClose();
                navigation?.navigate("VerificationSubmit");
              },
            },
          ],
        );
      } else {
        Alert.alert("Error", err.message || "Could not create plan");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SwipeableModal
        visible={isVisible && !isCropping}
        onClose={() => {
          resetState();
          onClose();
        }}
        sheetStyle={styles.sheet}
        keyboardAvoiding={true}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        backdropColor="rgba(0,0,0,0.5)"
        header={
          <View collapsable={false}>
            {/* Handle */}
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Host an open plan</Text>
          </View>
        }
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: Platform.OS === "android" ? keyboardHeight + 32 : 32,
          }}
        >
          {/* Activity type */}
          <Text style={styles.fieldLabel}>Activity type</Text>
          <View style={styles.chipRow}>
            {ACTIVITIES.map((a) => (
              <TouchableOpacity
                key={a.key}
                style={[
                  styles.chip,
                  activityType === a.key && styles.chipActive,
                ]}
                onPress={() => setActivityType(a.key)}
              >
                <Text
                  style={[
                    styles.chipText,
                    activityType === a.key && styles.chipTextActive,
                  ]}
                >
                  {a.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {activityType === "other" && (
            <TextInput
              style={[
                styles.input,
                errors.customLabel && styles.inputError,
                { marginTop: 12 },
              ]}
              placeholder="e.g. Photography walk"
              placeholderTextColor={COLORS.textMuted}
              maxLength={25}
              value={customLabel}
              onChangeText={setCustomLabel}
            />
          )}
          {errors.customLabel && (
            <Text style={styles.errorText}>{errors.customLabel}</Text>
          )}

          {/* ── Banner ── */}
          <Text style={styles.fieldLabel}>Banner</Text>
          <View style={styles.bannerPreviewWrap}>
            {/* Preset or custom preview */}
            <TouchableOpacity
              style={styles.bannerPreview}
              onPress={pickBanner}
              activeOpacity={0.8}
            >
              {bannerUri ? (
                <Image
                  source={{ uri: bannerUri }}
                  style={styles.bannerPreviewImg}
                  resizeMode="cover"
                />
              ) : (
                <PlanCropImage activityType={activityType} containerW={CONTAINER_WIDTH} height={130} />
              )}
            </TouchableOpacity>

            {/* Overlay buttons */}
            <View style={styles.bannerActions}>
              {bannerUri ? (
                <>
                  <TouchableOpacity style={styles.bannerBtn} onPress={pickBanner} activeOpacity={0.8}>
                    <ImageIcon size={15} color="#FFFFFF" strokeWidth={2} />
                    <Text style={styles.bannerBtnText}>Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.bannerBtn, styles.bannerBtnRemove]}
                    onPress={() => { setBannerUri(null); setBannerBase64(null); }}
                    activeOpacity={0.8}
                  >
                    <X size={15} color="#FFFFFF" strokeWidth={2} />
                    <Text style={styles.bannerBtnText}>Remove</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={styles.bannerBtn} onPress={pickBanner} activeOpacity={0.8}>
                  <ImageIcon size={15} color="#FFFFFF" strokeWidth={2} />
                  <Text style={styles.bannerBtnText}>Upload custom photo</Text>
                </TouchableOpacity>
              )}
            </View>
            {bannerUri && (
              <View style={styles.bannerCustomBadge} pointerEvents="none">
                <Text style={styles.bannerCustomBadgeText}>Custom</Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={styles.fieldLabel}>What's the plan?</Text>
          <TextInput
            style={[styles.input, errors.title && styles.inputError]}
            placeholder="e.g. Badminton doubles, need 1 more"
            placeholderTextColor={COLORS.textMuted}
            maxLength={100}
            value={title}
            onChangeText={setTitle}
          />
          {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}


          {/* Cost */}
          <Text style={styles.fieldLabel}>Cost</Text>
          <View style={styles.chipRow}>
            {COST_OPTS.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={[styles.chip, costType === c.key && styles.chipActive]}
                onPress={() => setCostType(c.key)}
              >
                <Text
                  style={[
                    styles.chipText,
                    costType === c.key && styles.chipTextActive,
                  ]}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {(costType === "entry_fee" || costType === "split") && (
            <View style={[styles.input, styles.inputRow, { marginTop: 12 }]}>
              <Text
                style={{
                  fontFamily: FONTS.medium,
                  fontSize: 16,
                  color: COLORS.textPrimary,
                  marginLeft: 2,
                }}
              >
                ₹
              </Text>
              <TextInput
                style={styles.inputInner}
                placeholder="Approx. cost per person (optional)"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
                value={costAmount}
                onChangeText={setCostAmount}
              />
            </View>
          )}

          {/* Visibility */}
          <Text style={styles.fieldLabel}>Who can discover this?</Text>
          <View style={styles.visibilityRow}>
            <TouchableOpacity
              style={[
                styles.visCard,
                visibility === "everyone" && styles.visCardActive,
              ]}
              onPress={() => setVisibility("everyone")}
            >
              <Globe
                size={18}
                color={
                  visibility === "everyone"
                    ? COLORS.primary
                    : COLORS.textSecondary
                }
                strokeWidth={1.8}
              />
              <Text
                style={[
                  styles.visCardTitle,
                  visibility === "everyone" && { color: COLORS.primary },
                ]}
              >
                Everyone
              </Text>
              <Text style={styles.visCardSub}>
                Visible to all SnooSpace users
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.visCard,
                visibility === "community_members" && styles.visCardActive,
              ]}
              onPress={() => setVisibility("community_members")}
            >
              <Users
                size={18}
                color={
                  visibility === "community_members"
                    ? COLORS.primary
                    : COLORS.textSecondary
                }
                strokeWidth={1.8}
              />
              <Text
                style={[
                  styles.visCardTitle,
                  visibility === "community_members" && {
                    color: COLORS.primary,
                  },
                ]}
              >
                Community members
              </Text>
              <Text style={styles.visCardSub}>
                People who share a community with you
              </Text>
            </TouchableOpacity>
          </View>

          {/* Gender */}
          <Text style={styles.fieldLabel}>Gender preference</Text>
          <View style={styles.chipRow}>
            {GENDER_OPTS.map((g) => {
              const isActive = genderPref === g.key;
              
              // Custom active colors: Everyone (Green), Women (Pink), Men (Blue)
              const colorConfig = {
                all: {
                  bg: '#E8F5E9',
                  border: '#2E7D32',
                  text: '#2E7D32',
                  iconColor: '#2E7D32'
                },
                Female: {
                  bg: '#FCE4EC',
                  border: '#D81B60',
                  text: '#D81B60',
                  iconColor: '#D81B60'
                },
                Male: {
                  bg: '#E3F2FD',
                  border: '#1565C0',
                  text: '#1565C0',
                  iconColor: '#1565C0'
                }
              };
              
              const activeStyle = colorConfig[g.key];
              
              // Icon components mapping
              let IconComponent = null;
              if (g.key === 'all') IconComponent = VenusAndMars;
              else if (g.key === 'Female') IconComponent = Venus;
              else if (g.key === 'Male') IconComponent = Mars;

              return (
                <TouchableOpacity
                  key={g.key}
                  style={[
                    styles.genderChip,
                    isActive ? {
                      backgroundColor: activeStyle.bg,
                      borderColor: activeStyle.border
                    } : {
                      backgroundColor: COLORS.surface,
                      borderColor: COLORS.border
                    }
                  ]}
                  onPress={() => setGenderPref(g.key)}
                >
                  {IconComponent && (
                    <IconComponent
                      size={14}
                      color={isActive ? activeStyle.iconColor : COLORS.textSecondary}
                      strokeWidth={2.2}
                    />
                  )}
                  <Text
                    style={[
                      styles.genderChipText,
                      isActive ? { color: activeStyle.text } : { color: COLORS.textSecondary }
                    ]}
                  >
                    {g.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Date & time + Max spots row */}
          <View style={styles.twoColRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>When</Text>
              <View style={styles.whenButtonsRow}>
                <TouchableOpacity
                  style={[
                    styles.input,
                    styles.dateFieldSub,
                    errors.date && styles.inputError,
                  ]}
                  onPress={() => setDatePickerOpen(true)}
                >
                  <Calendar
                    size={14}
                    color={COLORS.textMuted}
                    strokeWidth={1.8}
                  />
                  <Text
                    style={[
                      styles.dateFieldText,
                      !selectedDate && { color: COLORS.textMuted },
                    ]}
                    numberOfLines={1}
                  >
                    {selectedDate
                      ? selectedDate.toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })
                      : "Date"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.input,
                    styles.dateFieldSub,
                    errors.time && styles.inputError,
                  ]}
                  onPress={() => setTimePickerOpen(true)}
                >
                  <Clock size={14} color={COLORS.textMuted} strokeWidth={1.8} />
                  <Text
                    style={[
                      styles.dateFieldText,
                      !selectedTime && { color: COLORS.textMuted },
                    ]}
                    numberOfLines={1}
                  >
                    {selectedTime
                      ? selectedTime.toLocaleTimeString("en-IN", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })
                      : "Time"}
                  </Text>
                </TouchableOpacity>
              </View>
              {errors.date && (
                <Text style={styles.errorText}>{errors.date}</Text>
              )}
              {!errors.date && errors.time && (
                <Text style={styles.errorText}>{errors.time}</Text>
              )}
            </View>

            <View style={{ width: 120 }}>
              <Text style={styles.fieldLabel}>Max spots</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setMaxAccepted((v) => Math.max(1, v - 1))}
                >
                  <Minus
                    size={16}
                    color={COLORS.textSecondary}
                    strokeWidth={2}
                  />
                </TouchableOpacity>
                <Text style={styles.stepperVal}>{maxAccepted}</Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setMaxAccepted((v) => Math.min(50, v + 1))}
                >
                  <Plus
                    size={16}
                    color={COLORS.textSecondary}
                    strokeWidth={2}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Locations */}
          <Text style={styles.fieldLabel}>General area (public)</Text>
          <View style={[styles.input, styles.inputRow]}>
            <MapPin size={14} color={COLORS.textMuted} strokeWidth={1.8} />
            <TextInput
              style={styles.inputInner}
              placeholder="e.g. Near Gate 3, Koramangala"
              placeholderTextColor={COLORS.textMuted}
              value={locationPublic}
              onChangeText={setLocationPublic}
            />
          </View>

          <Text style={styles.fieldLabel}>
            Exact meetup point (only approved attendees see this)
          </Text>
          {selectedVenue ? (
            /* Confirmed venue — compact text row */
            <TouchableOpacity
              style={[styles.input, styles.inputRow]}
              onPress={() => setVenueSheetVisible(true)}
            >
              <Lock size={14} color={COLORS.primary} strokeWidth={1.8} />
              <Text
                style={[
                  styles.inputInner,
                  { color: COLORS.textPrimary, flex: 1 },
                ]}
                numberOfLines={1}
              >
                {selectedVenue.venueName}
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.medium,
                  fontSize: 11,
                  color: COLORS.primary,
                }}
              >
                Change
              </Text>
            </TouchableOpacity>
          ) : (
            /* Empty — tap to search */
            <TouchableOpacity
              style={[styles.input, styles.inputRow]}
              onPress={() => setVenueSheetVisible(true)}
            >
              <Lock size={14} color={COLORS.textMuted} strokeWidth={1.8} />
              <Text style={[styles.inputInner, { color: COLORS.textMuted }]}>
                Court 2, Aditya Sports Complex
              </Text>
            </TouchableOpacity>
          )}

          {/* VenueSearchSheet */}
          <VenueSearchSheet
            visible={venueSheetVisible}
            onClose={() => setVenueSheetVisible(false)}
            onSelect={(place) => {
              setPendingPlace(place);
              setVenueSheetVisible(false);
              setMapPickerVisible(true);
            }}
            onDropPin={() => {
              setPendingPlace(null);
              setMapPickerVisible(true);
            }}
            title="Exact meetup point"
            showNearby={true}
            userLocation={null}
          />

          {/* MapLocationPicker */}
          <MapLocationPicker
            visible={mapPickerVisible}
            initialPlace={pendingPlace}
            userLocation={null}
            onBack={() => {
              setMapPickerVisible(false);
              if (pendingPlace) setVenueSheetVisible(true);
            }}
            onConfirm={async (venue) => {
              setSelectedVenue(venue);
              setMapPickerVisible(false);
              // Auto-fill public location from reverseGeocode
              if (!locationPublic.trim()) {
                try {
                  const provider = getActiveProvider();
                  const geo = await provider.reverseGeocode(
                    venue.venueLat,
                    venue.venueLng,
                  );
                  if (geo?.shortAddress) setLocationPublic(geo.shortAddress);
                } catch {}
              }
            }}
          />

          {/* Recurring */}
          <View style={styles.recurringRow}>
            <View style={styles.recurringLeft}>
              <RefreshCw
                size={16}
                color={COLORS.textSecondary}
                strokeWidth={1.8}
              />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.recurringTitle}>Repeat weekly</Text>
                <Text style={styles.recurringSubtitle}>
                  Auto-post the same plan every week
                </Text>
              </View>
            </View>
            <Switch
              value={isRecurring}
              onValueChange={setIsRecurring}
              trackColor={{ true: COLORS.primary, false: COLORS.border }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitBtnText}>Post open plan</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SwipeableModal>

      {/* Date picker modal */}
      <CustomDatePicker
        visible={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        startDate={selectedDate}
        minDate={new Date()}
        singleMode
        onConfirm={({ startDate }) => {
          setSelectedDate(startDate);
          setDatePickerOpen(false);
        }}
      />

      {/* Time picker modal */}
      {timePickerOpen && (
        <CustomTimePicker
          visible={timePickerOpen}
          onClose={() => setTimePickerOpen(false)}
          time={selectedTime || new Date()}
          onChange={(time) => {
            setSelectedTime(time);
            setTimePickerOpen(false);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    overflow: "hidden",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: FONTS.primary,
    fontSize: 20,
    color: COLORS.textPrimary,
    marginBottom: 20,
  },
  fieldLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginTop: 16,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#EEF2FF",
  },
  chipText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  chipTextActive: {
    color: COLORS.primary,
  },
  genderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  genderChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: "#FAFAFA",
  },
  inputError: {
    borderColor: COLORS.error,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 0,
  },
  inputInner: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.error,
    marginTop: 4,
  },
  visibilityRow: {
    flexDirection: "row",
    gap: 10,
  },
  visCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  visCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#F0F4FF",
  },
  visCardTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  visCardSub: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  twoColRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    marginTop: 0,
  },
  whenButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  dateFieldSub: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: "#FAFAFA",
  },
  dateField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  dateFieldText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    flex: 1,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: "hidden",
    height: 46,
    backgroundColor: "#FAFAFA",
  },
  stepperBtn: {
    width: 38,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  stepperVal: {
    flex: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  recurringRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  recurringLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  recurringTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  recurringSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  submitBtn: {
    marginTop: 24,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: {
    opacity: 0.65,
  },
  submitBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: "#FFFFFF",
  },

  // ── Banner section ──
  bannerPreviewWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
  },
  bannerPreview: {
    width: '100%',
    height: 130,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F0F4FF',
  },
  bannerPreviewImg: {
    width: '100%',
    height: 130,
  },
  bannerActions: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    gap: 6,
  },
  bannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  bannerBtnRemove: {
    backgroundColor: 'rgba(200,30,30,0.7)',
  },
  bannerBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  bannerCustomBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(41,98,255,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  bannerCustomBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
});
