import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import SwipeableModal from '../../components/modals/SwipeableModal';
import {
  Calendar,
  Clock,
  Minus,
  Plus,
  RefreshCw,
  Image as ImageIcon,
  X,
  Globe,
  Users,
  Venus,
  Mars,
  VenusAndMars,
} from 'lucide-react-native';
import { COLORS, FONTS, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { getAuthToken } from '../../api/auth';
import { updatePlan, uploadPlanBanner, cancelPlan } from '../../api/plans';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import PlanCropImage from './PlanCropImage';
import { useCrop } from '../../components/MediaCrop';
import CustomDatePicker from '../../components/ui/CustomDatePicker';
import CustomTimePicker from '../../components/ui/CustomTimePicker';

const COST_OPTS = [
  { key: 'free', label: 'Free' },
  { key: 'self_pay', label: 'Self-pay' },
  { key: 'split', label: 'We split' },
  { key: 'entry_fee', label: 'Entry fee' },
];

const GENDER_OPTS = [
  { key: 'all', label: 'Everyone' },
  { key: 'Female', label: 'Women only' },
  { key: 'Male', label: 'Men only' },
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CONTAINER_WIDTH = SCREEN_WIDTH - 40;

function formatDateTime(date, time) {
  if (!date) return null;
  const d = new Date(date);
  if (time) d.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return d.toISOString();
}

export default function EditPlanBottomSheet({ visible, onClose, plan, navigation, onPlanUpdated, onPlanCancelled }) {
  const [title, setTitle] = useState('');
  const [locationPublic, setLocationPublic] = useState('');
  const [maxAccepted, setMaxAccepted] = useState(5);
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [cancelConfirming, setCancelConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // New fields state
  const [costType, setCostType] = useState('free');
  const [costAmount, setCostAmount] = useState('');
  const [visibility, setVisibility] = useState('everyone');
  const [genderPref, setGenderPref] = useState('all');

  // Banner state
  const [bannerUri, setBannerUri] = useState(null);       // local URI if newly picked
  const [bannerBase64, setBannerBase64] = useState(null); // base64 for upload
  const [existingBannerUrl, setExistingBannerUrl] = useState(null); // from plan
  const [bannerRemoved, setBannerRemoved] = useState(false); // user explicitly cleared
  const [isCropping, setIsCropping] = useState(false);

  const { pickAndCrop } = useCrop();

  // Pre-fill from plan whenever the sheet opens
  useEffect(() => {
    if (!visible || !plan) return;

    setTitle(plan.title || '');
    setLocationPublic(plan.location_public || '');
    setMaxAccepted(plan.max_accepted ?? 5);
    setIsRecurring(plan.is_recurring ?? false);
    setErrors({});
    setCancelConfirming(false);
    setCancelling(false);

    // New fields pre-fill
    setCostType(plan.cost_type || 'free');
    setCostAmount(plan.cost_amount_paise ? String(Math.round(plan.cost_amount_paise / 100)) : '');
    setVisibility(plan.visibility || 'community_members');
    setGenderPref(plan.gender_preference || 'all');

    // Banner pre-fill
    setExistingBannerUrl(plan.banner_image_url || null);
    setBannerUri(null);
    setBannerBase64(null);
    setBannerRemoved(false);

    if (plan.scheduled_at) {
      const d = new Date(plan.scheduled_at);
      setSelectedDate(d);
      setSelectedTime(d);
    } else {
      setSelectedDate(null);
      setSelectedTime(null);
    }
  }, [visible, plan]);

  const validate = () => {
    const e = {};
    if (!title.trim()) e.title = 'Required';
    if (title.trim().length > 100) e.title = 'Max 100 characters';
    if (!selectedDate) e.date = 'Required';
    if (!selectedTime) e.time = 'Required';
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
      setBannerRemoved(false);
    } catch (e) {
      setIsCropping(false);
      Alert.alert('Error', 'Could not crop image.');
    }
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const token = await getAuthToken();

      // Handle banner
      let finalBannerUrl = existingBannerUrl; // default: keep existing
      if (bannerRemoved) {
        finalBannerUrl = null;
      } else if (bannerBase64) {
        const uploadRes = await uploadPlanBanner(bannerBase64, token);
        finalBannerUrl = uploadRes?.data?.url || existingBannerUrl;
      }

      const scheduledAt = formatDateTime(selectedDate, selectedTime);
      const body = {
        title: title.trim(),
        location_public: locationPublic.trim() || null,
        max_accepted: maxAccepted,
        is_recurring: isRecurring,
        recurrence_interval: isRecurring ? 'weekly' : null,
        scheduled_at: scheduledAt,
        banner_image_url: finalBannerUrl,
        cost_type: costType,
        cost_amount_paise: ['entry_fee', 'split'].includes(costType) && costAmount.trim() ? Math.round(parseFloat(costAmount) * 100) : null,
        visibility: visibility,
        gender_preference: genderPref,
      };
      const data = await updatePlan(plan.id, body, token);
      onPlanUpdated(data.plan);
      onClose();
    } catch (err) {
      Alert.alert('Could not save', err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!cancelConfirming) {
      // Phase 1: show warning
      setCancelConfirming(true);
      return;
    }
    // Phase 2: execute
    setCancelling(true);
    try {
      const token = await getAuthToken();
      await cancelPlan(plan.id, token);
      onClose();
      // Notify parent to remove plan from list
      if (onPlanCancelled) onPlanCancelled(plan.id);
    } catch (err) {
      const errorCode = err?.response?.data?.error || err?.error;
      if (errorCode === 'plan_has_accepted_attendees') {
        Alert.alert(
          'Cannot Delete Plan',
          'This plan cannot be deleted because people have already joined. You can close it instead.'
        );
      } else {
        Alert.alert('Error', err?.message || 'Could not delete plan. Please try again.');
      }
    } finally {
      setCancelling(false);
      setCancelConfirming(false);
    }
  };

  if (!plan) return null;

  return (
    <>
      <SwipeableModal
        visible={visible && !isCropping}
        onClose={onClose}
        sheetStyle={styles.sheet}
        header={
          <View collapsable={false}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Edit plan</Text>
          </View>
        }
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Banner section */}
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
              ) : existingBannerUrl && !bannerRemoved ? (
                <Image
                  source={{ uri: existingBannerUrl }}
                  style={styles.bannerPreviewImg}
                  resizeMode="cover"
                />
              ) : (
                <PlanCropImage activityType={plan?.activity_type || 'other'} containerW={CONTAINER_WIDTH} height={130} />
              )}
            </TouchableOpacity>

            {/* Overlay buttons */}
            <View style={styles.bannerActions}>
              <TouchableOpacity style={styles.bannerBtn} onPress={pickBanner} activeOpacity={0.8}>
                <ImageIcon size={15} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.bannerBtnText}>
                  {(existingBannerUrl && !bannerRemoved) || bannerUri ? 'Change' : 'Upload custom photo'}
                </Text>
              </TouchableOpacity>
              {((existingBannerUrl && !bannerRemoved) || bannerUri) && (
                <TouchableOpacity
                  style={[styles.bannerBtn, styles.bannerBtnRemove]}
                  onPress={() => { setBannerUri(null); setBannerBase64(null); setBannerRemoved(true); }}
                  activeOpacity={0.8}
                >
                  <X size={15} color="#FFFFFF" strokeWidth={2} />
                  <Text style={styles.bannerBtnText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
            {(bannerUri || (existingBannerUrl && !bannerRemoved)) && (
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

          {/* Public location */}
          <Text style={styles.fieldLabel}>Where (Area name/public hint)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Indiranagar, Bangalore"
            placeholderTextColor={COLORS.textMuted}
            value={locationPublic}
            onChangeText={setLocationPublic}
          />

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
          {['entry_fee', 'split'].includes(costType) && (
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

          {/* Date, Time & Stepper side-by-side */}
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
              {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
              {!errors.date && errors.time && <Text style={styles.errorText}>{errors.time}</Text>}
            </View>

            <View style={{ width: 110 }}>
              <Text style={styles.fieldLabel}>Max spots</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setMaxAccepted((v) => Math.max(1, v - 1))}
                >
                  <Minus size={14} color={COLORS.textPrimary} strokeWidth={2.2} />
                </TouchableOpacity>
                <Text style={styles.stepperVal}>{maxAccepted}</Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setMaxAccepted((v) => Math.min(50, v + 1))}
                >
                  <Plus size={14} color={COLORS.textPrimary} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Visibility */}
          <Text style={styles.fieldLabel}>Who can discover this?</Text>
          <View style={styles.visibilityRow}>
            <TouchableOpacity
              style={[
                styles.visCard,
                visibility === 'everyone' && styles.visCardActive,
              ]}
              onPress={() => setVisibility('everyone')}
            >
              <Globe
                size={18}
                color={
                  visibility === 'everyone'
                    ? COLORS.primary
                    : COLORS.textSecondary
                }
                strokeWidth={1.8}
              />
              <Text
                style={[
                  styles.visCardTitle,
                  visibility === 'everyone' && { color: COLORS.primary },
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
                visibility === 'community_members' && styles.visCardActive,
              ]}
              onPress={() => setVisibility('community_members')}
            >
              <Users
                size={18}
                color={
                  visibility === 'community_members'
                    ? COLORS.primary
                    : COLORS.textSecondary
                }
                strokeWidth={1.8}
              />
              <Text
                style={[
                  styles.visCardTitle,
                  visibility === 'community_members' && {
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

          {/* Repeat Settings */}
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

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitBtnText}>Save changes</Text>
            )}
          </TouchableOpacity>
          {/* Delete Plan — only when no one has been accepted yet */}
          {plan && (plan.accepted_count ?? 0) === 0 && (
            <View style={styles.cancelSection}>
              {cancelConfirming && (
                <View style={styles.cancelWarning}>
                  <Text style={styles.cancelWarningText}>
                    {(plan.pending_count ?? 0) > 0
                      ? `⚠️ ${plan.pending_count} pending request${plan.pending_count > 1 ? 's' : ''} will be notified that the plan was removed. This cannot be undone.`
                      : 'This plan will be permanently deleted. This cannot be undone.'}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.cancelPlanBtn,
                  cancelConfirming && styles.cancelPlanBtnConfirm,
                  cancelling && styles.submitBtnDisabled,
                ]}
                onPress={handleDeletePlan}
                disabled={cancelling || loading}
                activeOpacity={0.8}
              >
                {cancelling ? (
                  <ActivityIndicator color="#EF4444" />
                ) : (
                  <Text style={[
                    styles.cancelPlanBtnText,
                    cancelConfirming && styles.cancelPlanBtnTextConfirm,
                  ]}>
                    {cancelConfirming ? 'Confirm — Delete Plan' : 'Delete Plan'}
                  </Text>
                )}
              </TouchableOpacity>
              {cancelConfirming && (
                <TouchableOpacity
                  style={styles.undoBtn}
                  onPress={() => setCancelConfirming(false)}
                >
                  <Text style={styles.undoBtnText}>Never mind</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
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
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    overflow: 'hidden',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
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
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: '#FAFAFA',
  },
  inputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.error,
    marginTop: 4,
  },
  twoColRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginTop: 0,
  },
  whenButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateFieldSub: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#FAFAFA',
  },
  dateFieldText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    flex: 1,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: 'hidden',
    height: 46,
    backgroundColor: '#FAFAFA',
  },
  stepperBtn: {
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  stepperVal: {
    flex: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  recurringLeft: {
    flexDirection: 'row',
    alignItems: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.65,
  },
  submitBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 32,
  },

  // Cancel Plan section
  cancelSection: {
    marginTop: 10,
    marginBottom: 8,
  },
  cancelWarning: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelWarningText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 20,
  },
  cancelPlanBtn: {
    height: 50,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPlanBtnConfirm: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  cancelPlanBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#EF4444',
  },
  cancelPlanBtnTextConfirm: {
    color: '#DC2626',
  },
  undoBtn: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 6,
  },
  undoBtnText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textMuted,
  },

  // Banner section
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    backgroundColor: '#EEF2FF',
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  visibilityRow: {
    flexDirection: 'row',
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
    backgroundColor: '#F0F4FF',
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
});
