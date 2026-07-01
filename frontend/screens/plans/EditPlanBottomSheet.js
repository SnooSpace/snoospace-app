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
  Pencil,
  MapPin,
  Users,
  RefreshCw,
  Minus,
  Plus,
  Calendar,
  Clock,
  Image as ImageIcon,
  X,
} from 'lucide-react-native';
import { COLORS, FONTS, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { getAuthToken } from '../../api/auth';
import { updatePlan, uploadPlanBanner } from '../../api/plans';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import PlanCropImage from './PlanCropImage';
import CustomDatePicker from '../../components/ui/CustomDatePicker';
import CustomTimePicker from '../../components/ui/CustomTimePicker';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

function formatDateTime(date, time) {
  if (!date) return null;
  const d = new Date(date);
  if (time) d.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return d.toISOString();
}

export default function EditPlanBottomSheet({ visible, onClose, plan, onPlanUpdated }) {
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

  // Banner state
  const [bannerUri, setBannerUri] = useState(null);       // local URI if newly picked
  const [bannerBase64, setBannerBase64] = useState(null); // base64 for upload
  const [existingBannerUrl, setExistingBannerUrl] = useState(null); // from plan
  const [bannerRemoved, setBannerRemoved] = useState(false); // user explicitly cleared

  // Pre-fill from plan whenever the sheet opens
  useEffect(() => {
    if (!visible || !plan) return;

    setTitle(plan.title || '');
    setLocationPublic(plan.location_public || '');
    setMaxAccepted(plan.max_accepted ?? 5);
    setIsRecurring(plan.is_recurring ?? false);
    setErrors({});

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
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo access to upload a banner.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [2, 1],
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      setBannerUri(manipulated.uri);
      setBannerBase64(`data:image/jpeg;base64,${manipulated.base64}`);
      setBannerRemoved(false);
    } catch (e) {
      Alert.alert('Error', 'Could not load image.');
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

  if (!plan) return null;

  return (
    <>
      <SwipeableModal
        visible={visible}
        onClose={onClose}
        sheetStyle={styles.sheet}
        header={
          <View collapsable={false} style={styles.modalHeaderContainer}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <View style={styles.headerIconContainer}>
                <Pencil size={18} color={COLORS.primary} strokeWidth={2.2} />
              </View>
              <Text style={styles.sheetTitle}>Edit plan</Text>
            </View>
          </View>
        }
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Card 1: Basic Info */}
          <Text style={styles.sectionHeader}>Plan details</Text>
          <View style={styles.card}>
            {/* Title */}
            <Text style={styles.fieldLabel}>Plan title</Text>
            <View style={[styles.inputWrap, errors.title && styles.inputWrapError]}>
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="What's the plan?"
                placeholderTextColor="#9CA3AF"
                maxLength={100}
                returnKeyType="done"
              />
            </View>
            {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

            {/* Public location */}
            <Text style={styles.fieldLabel}>Public location hint</Text>
            <View style={styles.inputWrap}>
              <MapPin size={14} color={COLORS.textSecondary} strokeWidth={1.8} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                value={locationPublic}
                onChangeText={setLocationPublic}
                placeholder="e.g. Indiranagar, Bangalore"
                placeholderTextColor="#9CA3AF"
                returnKeyType="done"
              />
            </View>
          </View>

          {/* Banner section */}
          <Text style={styles.sectionHeader}>Banner image</Text>
          <View style={styles.bannerCard}>
            {/* Preview */}
            <View style={styles.bannerPreviewWrap}>
              {bannerUri ? (
                <Image source={{ uri: bannerUri }} style={styles.bannerPreviewImg} resizeMode="cover" />
              ) : existingBannerUrl && !bannerRemoved ? (
                <Image source={{ uri: existingBannerUrl }} style={styles.bannerPreviewImg} resizeMode="cover" />
              ) : (
                <PlanCropImage activityType={plan?.activity_type || 'other'} containerW={335} height={140} />
              )}

              {/* Overlay buttons */}
              <View style={styles.bannerActions}>
                <TouchableOpacity style={styles.bannerBtn} onPress={pickBanner} activeOpacity={0.8}>
                  <ImageIcon size={14} color="#FFFFFF" strokeWidth={2} />
                  <Text style={styles.bannerBtnText}>{(existingBannerUrl && !bannerRemoved) || bannerUri ? 'Change' : 'Upload photo'}</Text>
                </TouchableOpacity>
                {((existingBannerUrl && !bannerRemoved) || bannerUri) && (
                  <TouchableOpacity
                    style={[styles.bannerBtn, styles.bannerBtnRemove]}
                    onPress={() => { setBannerUri(null); setBannerBase64(null); setBannerRemoved(true); }}
                    activeOpacity={0.8}
                  >
                    <X size={14} color="#FFFFFF" strokeWidth={2} />
                    <Text style={styles.bannerBtnText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Badge */}
              {(bannerUri || existingBannerUrl) && !bannerRemoved && (
                <View style={styles.bannerBadge}>
                  <Text style={styles.bannerBadgeText}>{bannerUri ? 'New' : 'Custom'}</Text>
                </View>
              )}
            </View>
            <Text style={styles.bannerHint}>Changes auto-save with the form</Text>
          </View>


          {/* Timing & capacity */}
          <Text style={styles.sectionHeader}>Timing {'&'} capacity</Text>
          <View style={styles.card}>
            {/* Date & Time row */}
            <View style={styles.twoColRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.fieldLabel}>Date</Text>
                <TouchableOpacity
                  style={[styles.pickerBtn, errors.date && styles.inputWrapError]}
                  onPress={() => setDatePickerOpen(true)}
                  activeOpacity={0.85}
                >
                  <Calendar size={14} color={COLORS.primary} strokeWidth={1.8} />
                  <Text style={styles.pickerBtnText} numberOfLines={1}>
                    {selectedDate
                      ? selectedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                      : 'Pick date'}
                  </Text>
                </TouchableOpacity>
                {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Time</Text>
                <TouchableOpacity
                  style={[styles.pickerBtn, errors.time && styles.inputWrapError]}
                  onPress={() => setTimePickerOpen(true)}
                  activeOpacity={0.85}
                >
                  <Clock size={14} color={COLORS.primary} strokeWidth={1.8} />
                  <Text style={styles.pickerBtnText} numberOfLines={1}>
                    {selectedTime
                      ? selectedTime.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
                      : 'Pick time'}
                  </Text>
                </TouchableOpacity>
                {errors.time && <Text style={styles.errorText}>{errors.time}</Text>}
              </View>
            </View>

            {/* Max spots stepper */}
            <Text style={styles.fieldLabel}>Max spots</Text>
            <View style={styles.stepperRow}>
              <View style={styles.stepperLeft}>
                <Users size={14} color={COLORS.textSecondary} strokeWidth={1.8} style={{ marginRight: 8 }} />
                <Text style={styles.stepperLabel}>Attendee limit</Text>
              </View>
              <View style={styles.stepperControls}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setMaxAccepted(v => Math.max(1, v - 1))}
                  hitSlop={8}
                >
                  <Minus size={14} color={COLORS.textPrimary} strokeWidth={2.2} />
                </TouchableOpacity>
                <Text style={styles.stepValue}>{maxAccepted}</Text>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setMaxAccepted(v => Math.min(50, v + 1))}
                  hitSlop={8}
                >
                  <Plus size={14} color={COLORS.textPrimary} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Repeat weekly toggle card */}
          <Text style={styles.sectionHeader}>Repeat settings</Text>
          <View style={[styles.recurringCard, isRecurring && styles.recurringCardActive]}>
            <View style={styles.recurringLeft}>
              <View style={[styles.recurringIconContainer, isRecurring && styles.recurringIconContainerActive]}>
                <RefreshCw size={16} color={isRecurring ? COLORS.primary : COLORS.textSecondary} strokeWidth={2} />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.recurringTitle}>Repeat weekly</Text>
                <Text style={styles.recurringSubtitle}>Auto-post the same plan every week</Text>
              </View>
            </View>
            <Switch
              value={isRecurring}
              onValueChange={setIsRecurring}
              trackColor={{ true: COLORS.primary, false: COLORS.border }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.saveBtnText}>Save changes</Text>
            }
          </TouchableOpacity>

          <View style={{ height: 24 }} />
        </ScrollView>
      </SwipeableModal>
    </>
  );
}

const styles = StyleSheet.create({
  // Sheet container — matches HostPlanBottomSheet's sheet style
  sheet: {
    backgroundColor: COLORS.screenBackground,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SCREEN_HEIGHT * 0.88,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    overflow: 'hidden',
  },
  modalHeaderContainer: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontFamily: FONTS.primary, // BasicCommercialBold
    fontSize: 19,
    color: COLORS.textPrimary,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'android' ? 32 : 12,
  },

  sectionHeader: {
    fontFamily: FONTS.primary, // BasicCommercialBold
    fontSize: 12,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
    ...SHADOWS.sm,
  },

  fieldLabel: {
    fontFamily: FONTS.semiBold, // Manrope SemiBold
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inputWrapError: {
    borderColor: '#EF4444',
  },
  textInput: {
    fontFamily: FONTS.medium, // Manrope Medium
    fontSize: 14,
    color: COLORS.textPrimary,
    flex: 1,
    paddingVertical: 0,
  },
  errorText: {
    fontFamily: FONTS.regular, // Manrope Regular
    fontSize: 11,
    color: '#EF4444',
    marginTop: 4,
  },

  twoColRow: {
    flexDirection: 'row',
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pickerBtnText: {
    fontFamily: FONTS.medium, // Manrope Medium
    fontSize: 13,
    color: COLORS.textPrimary,
    flex: 1,
  },

  // Max spots stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  stepperLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperLabel: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 2,
  },
  stepBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  stepValue: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginHorizontal: 12,
    minWidth: 20,
    textAlign: 'center',
  },

  // Recurring Toggle Card
  recurringCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 16,
    ...SHADOWS.sm,
  },
  recurringCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#F5F8FF',
  },
  recurringLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  recurringIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recurringIconContainerActive: {
    backgroundColor: '#E0EAFF',
  },
  recurringTitle: {
    fontFamily: FONTS.semiBold, // Manrope SemiBold
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  recurringSubtitle: {
    fontFamily: FONTS.regular, // Manrope Regular
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },

  // Save button
  saveBtn: {
    marginTop: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },
  saveBtnDisabled: {
    opacity: 0.65,
  },
  saveBtnText: {
    fontFamily: FONTS.semiBold, // Manrope SemiBold
    fontSize: 16,
    color: '#FFFFFF',
  },

  // Banner
  bannerCard: {
    marginBottom: 4,
  },
  bannerPreviewWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F0F4FF',
    position: 'relative',
  },
  bannerPreviewImg: {
    width: '100%',
    height: 140,
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
  bannerBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(41,98,255,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  bannerBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  bannerHint: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 6,
    marginLeft: 2,
  },
});
