import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, CheckCircle2, Users } from 'lucide-react-native';
import { COLORS, FONTS } from '../../constants/theme';
import { submitOpenPlanReview } from '../../api/reviews';
import { getAuthToken } from '../../api/auth';
import { apiGet } from '../../api/client';

const JOIN_OPTIONS = [
  { key: 'absolutely',   label: 'Absolutely',    emoji: '😍' },
  { key: 'probably',     label: 'Probably',       emoji: '🙂' },
  { key: 'maybe',        label: 'Maybe',          emoji: '😐' },
  { key: 'probably_not', label: 'Probably not',   emoji: '🙁' },
  { key: 'never_again',  label: 'Never again',    emoji: '😞' },
];

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

/**
 * OpenPlanReviewScreen
 *
 * Route params: { planId, planTitle, currentUserId }
 * 3-step flow:
 *   Step 0 — "Would you join this group again?" (5-option scale)
 *   Step 1 — "Who did you get to know?" (avatar multi-select from approved attendees)
 *   Step 2 — Rate each selected person individually
 */
export default function OpenPlanReviewScreen({ route, navigation }) {
  const { planId, planTitle = 'Open Plan', currentUserId } = route.params || {};

  const [step, setStep] = useState(0);
  const [joinRating, setJoinRating] = useState(null);

  // Attendee list (fetched from API)
  const [attendees, setAttendees] = useState([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);

  // Step 1: selected attendees
  const [selectedPeople, setSelectedPeople] = useState([]); // [memberId, ...]

  // Step 2: per-person ratings
  const [personRatings, setPersonRatings] = useState({}); // { memberId: ratingKey }

  const [submitting, setSubmitting] = useState(false);

  // Fetch approved attendees (excluding self)
  useEffect(() => {
    fetchAttendees();
  }, []);

  const fetchAttendees = async () => {
    setLoadingAttendees(true);
    try {
      const token = await getAuthToken();
      const data = await apiGet(`/plans/${planId}/approved-attendees`, 15000, token);
      const others = (data?.attendees || []).filter(
        a => String(a.id) !== String(currentUserId)
      );
      setAttendees(others);
    } catch {
      setAttendees([]);
    } finally {
      setLoadingAttendees(false);
    }
  };

  const togglePerson = useCallback((personId) => {
    Haptics.selectionAsync();
    setSelectedPeople(prev =>
      prev.includes(personId) ? prev.filter(id => id !== personId) : [...prev, personId]
    );
  }, []);

  const setPersonRating = useCallback((personId, rating) => {
    Haptics.selectionAsync();
    setPersonRatings(prev => ({ ...prev, [personId]: rating }));
  }, []);

  const goNext = () => {
    if (step === 0 && !joinRating) return;
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

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const token = await getAuthToken();
      const attendeeRatings = selectedPeople.map(uid => ({
        user_id: uid,
        rating: personRatings[uid] || 'maybe',
      }));

      await submitOpenPlanReview(planId, {
        would_join_again: joinRating,
        interacted_user_ids: selectedPeople,
        attendee_ratings: attendeeRatings,
      }, token);

      navigation.replace('ReviewSuccess', { type: 'open_plan' });
    } catch (err) {
      if (err?.status === 409) {
        Alert.alert('Already reviewed', 'You have already reviewed this plan.');
        navigation.goBack();
      } else {
        Alert.alert('Oops', err?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedAttendeesData = attendees.filter(a => selectedPeople.includes(a.id));

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft size={22} color={COLORS.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{planTitle}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(step / 2) * 100}%` }]} />
      </View>

      <StepIndicator currentStep={step} totalSteps={3} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── STEP 0: Would you join again? ─────────────────────────────── */}
        {step === 0 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepQuestion}>Would you join this group again?</Text>
            <Text style={styles.stepSubtitle}>Be honest — your rating is private</Text>

            {JOIN_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.sentimentRow,
                  joinRating === opt.key && styles.sentimentRowSelected,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setJoinRating(opt.key);
                }}
                activeOpacity={0.75}
              >
                <Text style={styles.sentimentEmoji}>{opt.emoji}</Text>
                <Text style={[
                  styles.sentimentLabel,
                  joinRating === opt.key && styles.sentimentLabelSelected,
                ]}>
                  {opt.label}
                </Text>
                {joinRating === opt.key && (
                  <CheckCircle2 size={20} color={COLORS.primary} strokeWidth={2} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── STEP 1: Who did you get to know? ──────────────────────────── */}
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepQuestion}>Who did you get to know?</Text>
            <Text style={styles.stepSubtitle}>Select people you interacted with</Text>

            {loadingAttendees ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
            ) : attendees.length === 0 ? (
              <View style={styles.emptyState}>
                <Users size={36} color={COLORS.textMuted} strokeWidth={1.5} />
                <Text style={styles.emptyStateText}>
                  No other attendees found.{'\n'}Tap Continue to submit your review.
                </Text>
              </View>
            ) : (
              <View style={styles.attendeeGrid}>
                {attendees.map(person => {
                  const isSelected = selectedPeople.includes(person.id);
                  return (
                    <TouchableOpacity
                      key={person.id}
                      style={[styles.attendeeCard, isSelected && styles.attendeeCardSelected]}
                      onPress={() => togglePerson(person.id)}
                      activeOpacity={0.75}
                    >
                      {person.profile_photo_url ? (
                        <Image
                          source={{ uri: person.profile_photo_url }}
                          style={[styles.avatar, isSelected && styles.avatarSelected]}
                        />
                      ) : (
                        <View style={[styles.avatarPlaceholder, isSelected && styles.avatarSelected]}>
                          <Text style={styles.avatarInitial}>
                            {(person.name || '?').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <CheckCircle2 size={14} color="#FFF" strokeWidth={2.5} />
                        </View>
                      )}
                      <Text style={[styles.attendeeName, isSelected && styles.attendeeNameSelected]} numberOfLines={1}>
                        {person.name?.split(' ')[0] || 'Person'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ── STEP 2: Rate selected people ──────────────────────────────── */}
        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepQuestion}>How were they to be around?</Text>
            <Text style={styles.stepSubtitle}>Ratings are private and help our matching</Text>

            {selectedAttendeesData.length === 0 ? (
              <Text style={styles.noSelectionText}>
                You didn't select anyone — tap Submit to finish!
              </Text>
            ) : (
              selectedAttendeesData.map(person => (
                <View key={person.id} style={styles.ratingCard}>
                  <View style={styles.ratingCardHeader}>
                    {person.profile_photo_url ? (
                      <Image source={{ uri: person.profile_photo_url }} style={styles.ratingAvatar} />
                    ) : (
                      <View style={styles.ratingAvatarPlaceholder}>
                        <Text style={styles.ratingAvatarInitial}>
                          {(person.name || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.ratingPersonName}>{person.name?.split(' ')[0]}</Text>
                  </View>
                  <View style={styles.ratingOptions}>
                    {JOIN_OPTIONS.map(opt => {
                      const isSelected = personRatings[person.id] === opt.key;
                      return (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.ratingOption, isSelected && styles.ratingOptionSelected]}
                          onPress={() => setPersonRating(person.id, opt.key)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.ratingEmoji}>{opt.emoji}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        {step < 2 ? (
          <TouchableOpacity
            style={[styles.ctaButton, step === 0 && !joinRating && styles.ctaDisabled]}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.screenBackground },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
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
  scrollContent: { paddingBottom: 100 },
  stepContainer: { paddingHorizontal: 20, paddingTop: 28 },
  stepQuestion: {
    fontFamily: FONTS.black,
    fontSize: 22,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  stepSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },
  // Sentiment rows
  sentimentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 18,
    backgroundColor: '#FFF',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  sentimentRowSelected: { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  sentimentEmoji: { fontSize: 24, marginRight: 14 },
  sentimentLabel: { flex: 1, fontFamily: FONTS.semiBold, fontSize: 16, color: COLORS.textPrimary },
  sentimentLabelSelected: { color: COLORS.primary },
  // Attendee grid
  attendeeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  attendeeCard: {
    width: 76,
    alignItems: 'center',
    position: 'relative',
  },
  attendeeCardSelected: {},
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  avatarSelected: { borderColor: COLORS.primary, borderWidth: 2.5 },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  avatarInitial: { fontFamily: FONTS.primary, fontSize: 22, color: '#6B7280' },
  checkBadge: {
    position: 'absolute',
    bottom: 20,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attendeeName: {
    marginTop: 6,
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  attendeeNameSelected: { color: COLORS.primary },
  // Empty state
  emptyState: { alignItems: 'center', marginTop: 48, gap: 12 },
  emptyStateText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Rating cards
  ratingCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ratingCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  ratingAvatar: { width: 38, height: 38, borderRadius: 19, marginRight: 12 },
  ratingAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ratingAvatarInitial: { fontFamily: FONTS.primary, fontSize: 16, color: '#6B7280' },
  ratingPersonName: { fontFamily: FONTS.primary, fontSize: 15, color: COLORS.textPrimary },
  ratingOptions: { flexDirection: 'row', justifyContent: 'space-between' },
  ratingOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    marginHorizontal: 2,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  ratingOptionSelected: { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  ratingEmoji: { fontSize: 22 },
  noSelectionText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 24,
    textAlign: 'center',
  },
  // Footer
  footer: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 12 },
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
  ctaDisabled: { opacity: 0.45 },
  ctaText: { fontFamily: FONTS.semiBold, fontSize: 16, color: '#FFF' },
});

const stepStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D1D5DB' },
  dotActive: { backgroundColor: COLORS.primary, width: 20 },
  dotDone: { backgroundColor: '#A5B4FC' },
});
