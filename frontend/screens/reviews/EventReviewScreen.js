import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react-native';
import { COLORS, FONTS, SPACING } from '../../constants/theme';
import {
  getTagsForRating,
  SAFETY_CONCERNS_TAG,
} from '../../constants/reviewTags';
import { getEventDimensions, submitEventReview } from '../../api/reviews';
import { getAuthToken } from '../../api/auth';

const { width } = Dimensions.get('window');

// ── Sentiment options ─────────────────────────────────────────────────────────
const SENTIMENTS = [
  { key: 'absolutely', label: 'Absolutely',  emoji: '😍' },
  { key: 'mostly',     label: 'Mostly',      emoji: '🙂' },
  { key: 'okay',       label: 'Okay',        emoji: '😐' },
  { key: 'not_really', label: 'Not really',  emoji: '🙁' },
  { key: 'not_at_all', label: 'Not at all',  emoji: '😞' },
];

// ── Step indicators ───────────────────────────────────────────────────────────
function StepIndicator({ currentStep, totalSteps }) {
  return (
    <View style={stepStyles.row}>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <View
          key={i}
          style={[
            stepStyles.dot,
            i === currentStep && stepStyles.dotActive,
            i < currentStep && stepStyles.dotDone,
          ]}
        />
      ))}
    </View>
  );
}

// ── Tag chip ─────────────────────────────────────────────────────────────────
function TagChip({ label, selected, onPress, isSafety = false }) {
  return (
    <TouchableOpacity
      style={[
        tagStyles.chip,
        selected && tagStyles.chipSelected,
        isSafety && tagStyles.chipSafety,
        isSafety && selected && tagStyles.chipSafetySelected,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {isSafety && (
        <AlertTriangle
          size={12}
          color={selected ? '#DC2626' : '#9CA3AF'}
          strokeWidth={2}
          style={{ marginRight: 5 }}
        />
      )}
      <Text
        style={[
          tagStyles.chipText,
          selected && tagStyles.chipTextSelected,
          isSafety && selected && tagStyles.chipTextSafety,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── Dimension scale renderer ──────────────────────────────────────────────────
function DimensionQuestion({ dimension, value, onChange }) {
  const { key, label, scale_type, scale_labels } = dimension;
  const labels = Array.isArray(scale_labels) ? scale_labels : Object.values(scale_labels || {});

  return (
    <View style={dimStyles.container}>
      <Text style={dimStyles.label}>{label}</Text>
      <View style={dimStyles.options}>
        {labels.map((optLabel, idx) => {
          const optKey = String(idx);
          const isSelected = value === optKey;
          return (
            <TouchableOpacity
              key={optKey}
              style={[dimStyles.option, isSelected && dimStyles.optionSelected]}
              onPress={() => onChange(key, optKey)}
              activeOpacity={0.7}
            >
              {scale_type === '4pt_emoji' && (
                <Text style={dimStyles.optEmoji}>{['😍','🙂','😐','😞'][idx] || '•'}</Text>
              )}
              <Text style={[dimStyles.optText, isSelected && dimStyles.optTextSelected]}>
                {optLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EventReviewScreen
// Route params: { eventId, eventTitle }
// ═══════════════════════════════════════════════════════════════════════════════

export default function EventReviewScreen({ route, navigation }) {
  const { eventId, eventTitle = 'Event' } = route.params || {};

  const [step, setStep] = useState(0);

  // Step 0 state
  const [selectedSentiment, setSelectedSentiment] = useState(null);

  // Step 1 state
  const [selectedTags, setSelectedTags] = useState([]);
  const [comment, setComment] = useState('');

  // Step 2 state
  const [dimensions, setDimensions] = useState([]);
  const [dimensionRatings, setDimensionRatings] = useState({});
  const [loadingDimensions, setLoadingDimensions] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);

  const progressAnim = useSharedValue(0);

  useEffect(() => {
    progressAnim.value = withTiming((step / 2) * 100, { duration: 350 });
  }, [step]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value}%`,
  }));

  // Fetch dimensions when reaching step 2
  useEffect(() => {
    if (step === 2) {
      fetchDimensions();
    }
  }, [step]);

  const fetchDimensions = async () => {
    setLoadingDimensions(true);
    try {
      const token = await getAuthToken();
      const data = await getEventDimensions(eventId, token);
      setDimensions(data?.dimensions || []);
    } catch {
      setDimensions([]);
    } finally {
      setLoadingDimensions(false);
    }
  };

  // ── Tag toggle ───────────────────────────────────────────────────────────
  const toggleTag = useCallback((tagKey) => {
    Haptics.selectionAsync();
    setSelectedTags(prev =>
      prev.includes(tagKey) ? prev.filter(t => t !== tagKey) : [...prev, tagKey]
    );
  }, []);

  // ── Dimension rating change ──────────────────────────────────────────────
  const onDimensionChange = useCallback((dimensionKey, value) => {
    setDimensionRatings(prev => ({ ...prev, [dimensionKey]: value }));
  }, []);

  // ── Navigation between steps ─────────────────────────────────────────────
  const canAdvanceStep0 = !!selectedSentiment;
  const hasSafetyConcern = selectedTags.includes(SAFETY_CONCERNS_TAG);
  const canAdvanceStep1 = selectedTags.length > 0 && (!hasSafetyConcern || comment.trim().length > 0);

  const goNext = () => {
    if (step === 0 && !canAdvanceStep0) return;
    if (step === 1) {
      if (selectedTags.length === 0) {
        Alert.alert('Select a tag', 'Please select at least one tag to continue.');
        return;
      }
      if (hasSafetyConcern && !comment.trim()) {
        Alert.alert(
          'Description required',
          'Please describe the safety concern. Your report will go to our safety team only.',
        );
        return;
      }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(s => s + 1);
  };

  const goBack = () => {
    if (step === 0) {
      navigation.goBack();
    } else {
      setStep(s => s - 1);
    }
  };

  // ── Submission ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const token = await getAuthToken();
      const dimensionRatingsArray = Object.entries(dimensionRatings).map(
        ([dimensionKey, ratingValue]) => {
          const dim = dimensions.find(d => d.key === dimensionKey);
          return dim ? { dimension_id: dim.id, rating_value: ratingValue } : null;
        }
      ).filter(Boolean);

      await submitEventReview(eventId, {
        worth_it_rating: selectedSentiment,
        tags: selectedTags,
        dimension_ratings: dimensionRatingsArray,
        comment: comment.trim() || undefined,
      }, token);

      // Navigate to success screen
      navigation.replace('ReviewSuccess', { type: 'event' });
    } catch (err) {
      const msg = err?.message || 'Something went wrong. Please try again.';
      if (err?.status === 409) {
        Alert.alert('Already reviewed', 'You have already reviewed this event.');
        navigation.goBack();
      } else {
        Alert.alert('Oops', msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Tag set for current sentiment ────────────────────────────────────────
  const currentTagSet = getTagsForRating(selectedSentiment);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft size={22} color={COLORS.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {eventTitle}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, progressStyle]} />
      </View>

      <StepIndicator currentStep={step} totalSteps={3} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── STEP 0: Sentiment ──────────────────────────────────────────── */}
        {step === 0 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepQuestion}>Was it worth your time?</Text>
            <Text style={styles.stepSubtitle}>Tap to select</Text>
            {SENTIMENTS.map(s => (
              <TouchableOpacity
                key={s.key}
                style={[
                  styles.sentimentRow,
                  selectedSentiment === s.key && styles.sentimentRowSelected,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedSentiment(s.key);
                  // Reset tags if sentiment changed
                  setSelectedTags([]);
                }}
                activeOpacity={0.75}
              >
                <Text style={styles.sentimentEmoji}>{s.emoji}</Text>
                <Text style={[
                  styles.sentimentLabel,
                  selectedSentiment === s.key && styles.sentimentLabelSelected,
                ]}>
                  {s.label}
                </Text>
                {selectedSentiment === s.key && (
                  <CheckCircle2 size={20} color={COLORS.primary} strokeWidth={2} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── STEP 1: Tags ──────────────────────────────────────────────── */}
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepQuestion}>What stood out?</Text>
            <Text style={styles.stepSubtitle}>Select at least one</Text>

            <View style={styles.tagGrid}>
              {currentTagSet.map(tag => (
                <TagChip
                  key={tag.key}
                  label={tag.label}
                  selected={selectedTags.includes(tag.key)}
                  onPress={() => toggleTag(tag.key)}
                  isSafety={tag.key === SAFETY_CONCERNS_TAG}
                />
              ))}
            </View>

            {/* Safety concern sub-panel */}
            {hasSafetyConcern && (
              <View style={styles.safetyPanel}>
                <View style={styles.safetyHeader}>
                  <AlertTriangle size={14} color="#DC2626" strokeWidth={2} />
                  <Text style={styles.safetyHeaderText}>
                    This will be reviewed by our safety team only
                  </Text>
                </View>
                <TextInput
                  style={styles.safetyInput}
                  placeholder="Please describe what happened... (required)"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                  value={comment}
                  onChangeText={setComment}
                  textAlignVertical="top"
                />
              </View>
            )}

            {/* Optional free-text (non-safety) */}
            {!hasSafetyConcern && (
              <View style={styles.optionalCommentWrap}>
                <Text style={styles.optionalLabel}>Add a note (optional)</Text>
                <TextInput
                  style={styles.optionalInput}
                  placeholder="Anything else you'd like to share..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  value={comment}
                  onChangeText={setComment}
                  textAlignVertical="top"
                />
              </View>
            )}
          </View>
        )}

        {/* ── STEP 2: Dimensions ────────────────────────────────────────── */}
        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepQuestion}>A few quick questions</Text>
            <Text style={styles.stepSubtitle}>Optional — skip any you're unsure about</Text>

            {loadingDimensions ? (
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
                style={{ marginTop: 40 }}
              />
            ) : dimensions.length === 0 ? (
              <Text style={styles.noDimsText}>
                No questions for this event type — tap Submit to finish!
              </Text>
            ) : (
              dimensions.map(dim => (
                <DimensionQuestion
                  key={dim.key}
                  dimension={dim}
                  value={dimensionRatings[dim.key]}
                  onChange={onDimensionChange}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.footer}>
        {step < 2 ? (
          <TouchableOpacity
            style={[
              styles.ctaButton,
              step === 0 && !canAdvanceStep0 && styles.ctaDisabled,
              step === 1 && !canAdvanceStep1 && styles.ctaDisabled,
            ]}
            onPress={goNext}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Continue</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.ctaButton, submitting && styles.ctaDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.ctaText}>Submit Review</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.screenBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: COLORS.screenBackground,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: FONTS.primary,
    fontSize: 17,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  progressTrack: {
    height: 3,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingBottom: 100,
  },
  stepContainer: {
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  stepQuestion: {
    fontFamily: FONTS.black,
    fontSize: 24,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  stepSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },
  // Sentiment
  sentimentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: '#FFF',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  sentimentRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#EEF2FF',
  },
  sentimentEmoji: {
    fontSize: 26,
    marginRight: 14,
  },
  sentimentLabel: {
    flex: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  sentimentLabelSelected: {
    color: COLORS.primary,
  },
  // Tags
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  // Safety panel
  safetyPanel: {
    backgroundColor: '#FFF5F5',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 4,
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  safetyHeaderText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: '#DC2626',
    flex: 1,
  },
  safetyInput: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    minHeight: 90,
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  // Optional comment
  optionalCommentWrap: {
    marginTop: 8,
  },
  optionalLabel: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  optionalInput: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textPrimary,
    minHeight: 72,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  // Footer CTA
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: COLORS.screenBackground,
  },
  ctaButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  ctaText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFF',
  },
  noDimsText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 20,
    textAlign: 'center',
  },
});

const stepStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    backgroundColor: COLORS.primary,
    width: 20,
  },
  dotDone: {
    backgroundColor: '#A5B4FC',
  },
});

const tagStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  chipSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: COLORS.primary,
  },
  chipSafety: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF5F5',
  },
  chipSafetySelected: {
    borderColor: '#DC2626',
    backgroundColor: '#FEE2E2',
  },
  chipText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  chipTextSelected: {
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
  },
  chipTextSafety: {
    color: '#DC2626',
    fontFamily: FONTS.semiBold,
  },
});

const dimStyles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  label: {
    fontFamily: FONTS.primary,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  optionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#EEF2FF',
  },
  optEmoji: {
    fontSize: 16,
    marginBottom: 2,
  },
  optText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  optTextSelected: {
    color: COLORS.primary,
    fontFamily: FONTS.semiBold,
  },
});
