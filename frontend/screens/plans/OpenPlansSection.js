import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { ChevronRight, Plus, Trophy, BookOpen, Star, Gamepad2, Sparkles, Clock, MapPin } from 'lucide-react-native';
import { COLORS, FONTS, SPACING, SHADOWS } from '../../constants/theme';
import { getAuthToken, getActiveAccount } from '../../api/auth';
import { getPlans, likePlan, unlikePlan } from '../../api/plans';
import HostPlanBottomSheet from './HostPlanBottomSheet';
import RequestBottomSheet from './RequestBottomSheet';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVITY_COLORS = {
  sports: { bg: '#EEF2FF', text: '#3B5BDB', label: 'Sports', icon: Trophy },
  study:  { bg: '#E8F5E9', text: '#2E7D32', label: 'Study', icon: BookOpen },
  food:   { bg: '#FFF8E1', text: '#B45309', label: 'Food', icon: Star },
  gaming: { bg: '#FCE4EC', text: '#C2185B', label: 'Gaming', icon: Gamepad2 },
  other:  { bg: '#F5F5F5', text: '#555555', label: 'Other', icon: Sparkles },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatScheduled(iso) {
  const d = new Date(iso);
  const now = new Date();
  const todayStr = now.toDateString();
  const tomorrowStr = new Date(now.getTime() + 86400000).toDateString();
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (d.toDateString() === todayStr) return `Today, ${time}`;
  if (d.toDateString() === tomorrowStr) return `Tomorrow, ${time}`;
  return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) + ` · ${time}`;
}

export default function OpenPlansSection({ navigation, currentUserId }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hostSheetOpen, setHostSheetOpen] = useState(false);
  const [requestSheet, setRequestSheet] = useState(null); // { planId, planTitle }
  const [currentUserIdState, setCurrentUserIdState] = useState(currentUserId);

  useEffect(() => {
    if (!currentUserIdState) {
      getActiveAccount().then((account) => {
        if (account?.id) setCurrentUserIdState(account.id);
      }).catch(() => {});
    }
  }, [currentUserId]);

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const data = await getPlans(null, token);
      setPlans((data.plans || []).slice(0, 3));
    } catch (err) {
      console.error('[OpenPlansSection] load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const handlePlanCreated = useCallback((newPlan) => {
    setPlans(prev => [newPlan, ...prev].slice(0, 3));
  }, []);

  const renderCompactCard = useCallback((plan, isFullWidth) => {
    const isOwner = plan.created_by === currentUserIdState;
    const activityKey = plan.activity_type in ACTIVITY_COLORS ? plan.activity_type : 'other';
    const activityStyle = ACTIVITY_COLORS[activityKey];
    const activityLabel = plan.activity_type === 'other'
      ? (plan.custom_activity_label || 'Other')
      : activityStyle.label;
    const ActivityIcon = activityStyle.icon;

    const spotsLeft = plan.max_accepted - (plan.accepted_count ?? 0);
    const spotsLeftColor = spotsLeft <= 1 ? '#EF6C00' : COLORS.textSecondary;

    const reqStatus = plan.my_request_status;

    let btnLabel = 'Join';
    let btnDisabled = false;
    if (isOwner) {
      btnLabel = 'Your plan';
      btnDisabled = true;
    } else if (reqStatus === 'pending') {
      btnLabel = 'Requested';
      btnDisabled = true;
    } else if (reqStatus === 'approved') {
      btnLabel = 'Joined';
      btnDisabled = true;
    }

    if (isFullWidth) {
      const formattedDate = formatScheduled(plan.scheduled_at);
      const spotsLeft = plan.max_accepted - (plan.accepted_count ?? 0);
      const spotsStr = `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`;
      const subtitleText = `${formattedDate} · ${spotsStr}`;

      return (
        <TouchableOpacity
          style={styles.fullCard}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('PlanDetail', { planId: plan.id })}
        >
          <View style={styles.fullCardHeader}>
            <View style={[styles.compactPill, { backgroundColor: activityStyle.bg }]}>
              <ActivityIcon size={12} color={activityStyle.text} strokeWidth={2.5} />
              <Text style={[styles.compactPillText, { color: activityStyle.text }]}>
                {activityLabel}
              </Text>
            </View>
            {isOwner && (
              <View style={styles.yourPlanBadge}>
                <Text style={styles.yourPlanBadgeText}>Your plan</Text>
              </View>
            )}
          </View>

          <Text style={styles.fullCardTitle} numberOfLines={2}>
            {plan.title}
          </Text>

          <Text style={styles.fullCardSubtitle}>
            {subtitleText}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={styles.compactCard}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('PlanDetail', { planId: plan.id })}
      >
        <View style={[styles.compactPill, { backgroundColor: activityStyle.bg }]}>
          <ActivityIcon size={11} color={activityStyle.text} strokeWidth={2.5} />
          <Text style={[styles.compactPillText, { color: activityStyle.text }]}>
            {activityLabel}
          </Text>
        </View>

        <Text style={styles.compactTitle} numberOfLines={2}>
          {plan.title}
        </Text>

        <View style={styles.compactMetaRow}>
          <Clock size={12} color={COLORS.textSecondary} strokeWidth={2} />
          <Text style={styles.compactMetaText} numberOfLines={1}>
            {formatScheduled(plan.scheduled_at)}
          </Text>
        </View>
        {plan.location_public ? (
          <View style={styles.compactMetaRow}>
            <MapPin size={12} color={COLORS.textSecondary} strokeWidth={2} />
            <Text style={styles.compactMetaText} numberOfLines={1}>
              {plan.location_public}
            </Text>
          </View>
        ) : null}

        <View style={{ flex: 1, minHeight: 12 }} />

        <View style={styles.compactBottomRow}>
          <Text style={[styles.spotsLeftText, { color: spotsLeftColor }]}>
            {spotsLeft === 1 ? '1 spot left' : `${spotsLeft} spots left`}
          </Text>
          <TouchableOpacity
            style={[
              styles.compactJoinBtn,
              btnDisabled && styles.compactJoinBtnDisabled
            ]}
            onPress={() => !btnDisabled && setRequestSheet({ planId: plan.id, planTitle: plan.title })}
            disabled={btnDisabled}
          >
            <Text style={styles.compactJoinBtnText}>{btnLabel}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }, [currentUserIdState, navigation]);

  // Layout selection logic based on number of plans
  let halfPlans = [];
  let fullPlan = null;

  if (plans.length === 1) {
    fullPlan = plans[0];
  } else if (plans.length === 2) {
    halfPlans = plans;
  } else if (plans.length >= 3) {
    halfPlans = plans.slice(0, 2);
    fullPlan = plans[2];
  }

  return (
    <View style={styles.section}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.sectionTitle}>Open Plans</Text>
        </View>
        <TouchableOpacity
          style={styles.hostBtn}
          onPress={() => setHostSheetOpen(true)}
          activeOpacity={0.8}
        >
          <Plus size={13} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.hostBtnText}>Host</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <ActivityIndicator style={{ marginVertical: 24 }} color={COLORS.primary} />
      ) : plans.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No open plans in your communities yet. Be the first to host one.
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {halfPlans.length > 0 && (
            <View style={styles.gridRow}>
              {halfPlans.map(plan => (
                <View key={plan.id} style={styles.halfCardWrapper}>
                  {renderCompactCard(plan, false)}
                </View>
              ))}
            </View>
          )}
          {fullPlan && (
            <View style={styles.fullCardWrapper}>
              {renderCompactCard(fullPlan, true)}
            </View>
          )}
        </View>
      )}

      {/* See all */}
      {plans.length > 0 && (
        <TouchableOpacity
          style={styles.seeAllRow}
          onPress={() => navigation.navigate('PlansDiscoverFeed')}
        >
          <Text style={styles.seeAllText}>See all plans</Text>
          <ChevronRight size={14} color={COLORS.primary} strokeWidth={2} />
        </TouchableOpacity>
      )}

      {/* Sheets */}
      <HostPlanBottomSheet
        isVisible={hostSheetOpen}
        onClose={() => setHostSheetOpen(false)}
        onPlanCreated={handlePlanCreated}
        navigation={navigation}
      />
      {requestSheet && (
        <RequestBottomSheet
          isVisible={!!requestSheet}
          planId={requestSheet.planId}
          planTitle={requestSheet.planTitle}
          onClose={() => setRequestSheet(null)}
          onRequested={() => {
            setRequestSheet(null);
            loadPlans();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: FONTS.primary,
    fontSize: 20,
    color: COLORS.textPrimary,
  },
  hostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  hostBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  grid: {
    paddingHorizontal: 16,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  halfCardWrapper: {
    flex: 1,
  },
  fullCardWrapper: {
    width: '100%',
  },
  // Compact Card styles
  compactCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    minHeight: 180,
    flex: 1,
    justifyContent: 'space-between',
  },
  compactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginBottom: 10,
    gap: 6,
  },
  compactPillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
  },
  compactTitle: {
    fontFamily: FONTS.primary,
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 20,
    marginBottom: 8,
  },
  compactMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  compactMetaText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  compactBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  spotsLeftText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  compactJoinBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.surface,
  },
  compactJoinBtnDisabled: {
    borderColor: 'transparent',
    backgroundColor: '#F3F4F6',
  },
  compactJoinBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.textPrimary,
  },
  // Full width Card styles
  fullCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    padding: 16,
  },
  fullCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  yourPlanBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  yourPlanBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: COLORS.primary,
  },
  fullCardTitle: {
    fontFamily: FONTS.primary,
    fontSize: 16,
    color: COLORS.textPrimary,
    lineHeight: 22,
    marginBottom: 6,
  },
  fullCardSubtitle: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  emptyState: {
    marginHorizontal: 24,
    padding: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  seeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    marginTop: 12,
    gap: 4,
  },
  seeAllText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.primary,
  },
});
