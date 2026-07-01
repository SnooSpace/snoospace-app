import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Plus, Clock, MapPin, Users, ArrowRight } from 'lucide-react-native';
import { COLORS, FONTS, SPACING, SHADOWS } from '../../constants/theme';
import { getAuthToken, getActiveAccount } from '../../api/auth';
import { getPlans } from '../../api/plans';
import HostPlanBottomSheet from './HostPlanBottomSheet';
import RequestBottomSheet from './RequestBottomSheet';

// ─── Constants ────────────────────────────────────────────────────────────────

const MASTER_IMAGE = require('../../assets/Open_Plans.webp');
const MASTER_SIZE  = 1254; // pixel width & height of the source image

const CROP_MAP = {
  sports:       { l: 130, t: 130, r: 470, b: 348 },
  movies:       { l: 360, t:  10, r: 720, b: 240 },
  bar:          { l: 870, t:   0, r: 1200, b: 200 },
  food:         { l: 810, t: 310, r: 1150, b: 530 },
  cafe:         { l: 330, t: 290, r: 670,  b: 490 },
  yoga:         { l: 480, t: 420, r: 820,  b: 650 },
  gym:          { l: 860, t: 530, r: 1190, b: 730 },
  walk:         { l:  10, t: 620, r: 350,  b: 870 },
  rides:        { l: 520, t: 910, r: 870,  b: 1120 },
  live_music:   { l: 580, t: 280, r: 880,  b: 450 },
  study:        { l: 900, t: 680, r: 1230, b: 920 },
  creative:     { l: 230, t: 820, r: 580,  b: 1060 },
  games:        { l: 130, t: 440, r: 470,  b: 690 },
  gaming:       { l: 130, t: 440, r: 470,  b: 690 },
  pet_friendly: { l: 140, t: 680, r: 490,  b: 900 },
  hangout:      { l: 450, t: 570, r: 790,  b: 790 },
  other:        { l: 300, t: 350, r: 660,  b: 570 },
};

const ACTIVITY_COLORS = {
  sports:       { bg: '#FFF3E0', text: '#E65100', label: 'Sports' },
  movies:       { bg: '#F3E5F5', text: '#6A1B9A', label: 'Movies' },
  bar:          { bg: '#E8EAF6', text: '#303F9F', label: 'Bar' },
  food:         { bg: '#FFF8E1', text: '#F57F17', label: 'Food' },
  cafe:         { bg: '#EFEBE9', text: '#4E342E', label: 'Cafe' },
  yoga:         { bg: '#E8F5E9', text: '#2E7D32', label: 'Yoga' },
  gym:          { bg: '#FCE4EC', text: '#880E4F', label: 'Gym' },
  walk:         { bg: '#E0F2F1', text: '#00695C', label: 'Walk' },
  rides:        { bg: '#E3F2FD', text: '#1565C0', label: 'Rides' },
  live_music:   { bg: '#FCE4EC', text: '#C62828', label: 'Live Music' },
  study:        { bg: '#EDE7F6', text: '#4527A0', label: 'Study / Co-work' },
  creative:     { bg: '#FFF9C4', text: '#F57F17', label: 'Creative' },
  games:        { bg: '#E1F5FE', text: '#01579B', label: 'Games' },
  gaming:       { bg: '#E1F5FE', text: '#01579B', label: 'Games' },
  pet_friendly: { bg: '#F1F8E9', text: '#33691E', label: 'Pet Friendly' },
  hangout:      { bg: '#E8F5E9', text: '#1B5E20', label: 'Hangout' },
  other:        { bg: '#F5F5F5', text: '#424242', label: 'Other' },
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

function formatTimeAgo(isoString) {
  if (!isoString) return '';
  const created = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return created.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function getCostLabel(plan) {
  if (plan.cost_type === 'free')     return 'Free';
  if (plan.cost_type === 'self_pay') return 'Self-pay';
  if (plan.cost_type === 'split') {
    return plan.cost_amount_paise
      ? `~₹${Math.round(plan.cost_amount_paise / 100)} split`
      : 'Split cost';
  }
  if (plan.cost_type === 'entry_fee') {
    return plan.cost_amount_paise
      ? `₹${Math.round(plan.cost_amount_paise / 100)}`
      : 'Entry fee';
  }
  return null;
}

function CropImage({ activityType, containerW, height = 110 }) {
  const box   = CROP_MAP[activityType] || CROP_MAP.other;
  const boxW  = box.r - box.l;
  const boxH  = box.b - box.t;
  const H     = height;

  const scale   = Math.max(containerW / boxW, H / boxH);
  const imgSize = MASTER_SIZE * scale;

  // Centre the crop inside the container
  const offsetX = -(box.l * scale) + (containerW - boxW * scale) / 2;
  const offsetY = -(box.t * scale) + (H - boxH * scale) / 2;

  return (
    <View style={{ width: containerW, height: H, overflow: 'hidden' }}>
      <Image
        source={MASTER_IMAGE}
        style={{
          position: 'absolute',
          width:  imgSize,
          height: imgSize,
          left:   offsetX,
          top:    offsetY,
        }}
        contentFit="cover"
      />
    </View>
  );
}

export default function OpenPlansSection({ navigation, currentUserId, refreshKey }) {
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
      setPlans((data.plans || []).slice(0, 6));
    } catch (err) {
      console.error('[OpenPlansSection] load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans, refreshKey]);

  const handlePlanCreated = useCallback((newPlan) => {
    setPlans(prev => [newPlan, ...prev].slice(0, 6));
  }, []);

  const renderOpenPlanCard = useCallback((plan) => {
    const isOwner = currentUserIdState && (plan.created_by === currentUserIdState || plan.created_by === String(currentUserIdState));
    const activityKey = plan.activity_type in ACTIVITY_COLORS ? plan.activity_type : 'other';
    const activityStyle = ACTIVITY_COLORS[activityKey];
    const activityLabel = plan.activity_type === 'other'
      ? (plan.custom_activity_label || 'Other')
      : activityStyle.label;

    const reqStatus = plan.my_request_status ?? plan.request_status ?? null;
    const acceptedN = plan.accepted_count ?? 0;
    const maxAccepted = plan.max_accepted ?? 0;
    const costLabel = getCostLabel(plan);
    const createdTime = plan.created_at || plan.createdAt || plan.scheduled_at;

    // Overlay statuses
    let bottomPillLabel = null;
    if (isOwner) {
      bottomPillLabel = 'Hosting';
    } else if (reqStatus === 'approved') {
      bottomPillLabel = 'Joined';
    } else if (reqStatus === 'pending') {
      bottomPillLabel = 'Requested';
    }

    return (
      <TouchableOpacity
        key={plan.id}
        style={[
          styles.planCard,
          isOwner && styles.planCardHostingOutline
        ]}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('PlanDetail', { planId: plan.id })}
      >
        {/* Upper Poster Half */}
        <View style={styles.cardPosterContainer}>
          <CropImage activityType={activityKey} containerW={170} height={110} />
          
          {/* Top-Left Category Badge */}
          <View style={[styles.cardCategoryPill, { backgroundColor: activityStyle.bg }]}>
            <Text style={[styles.cardCategoryPillText, { color: activityStyle.text }]}>
              {activityLabel}
            </Text>
          </View>

          {/* Top-Right Count Badge */}
          <View style={styles.cardCountPill}>
            <Users size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
            <Text style={styles.cardCountPillText}>
              {`${acceptedN}/${maxAccepted}`}
            </Text>
          </View>

          {/* Bottom-Left Status Badge (Hosting / Joined / Requested) */}
          {bottomPillLabel && (
            <View style={styles.cardStatusPill}>
              <View style={[styles.statusDot, bottomPillLabel === 'Hosting' ? styles.statusDotHosting : styles.statusDotJoined]} />
              <Text style={styles.cardStatusPillText}>
                {bottomPillLabel}
              </Text>
            </View>
          )}
        </View>

        {/* Lower Content Half */}
        <View style={styles.cardContentContainer}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {plan.title}
          </Text>

          <View style={styles.cardMetaRow}>
            <MapPin size={12} color="#94A3B8" />
            <Text style={styles.cardMetaText} numberOfLines={1}>
              {plan.location_public || 'Location TBD'}
            </Text>
          </View>

          <View style={styles.cardMetaRow}>
            <Clock size={12} color="#94A3B8" />
            <Text style={styles.cardMetaText} numberOfLines={1}>
              {formatScheduled(plan.scheduled_at)}
            </Text>
          </View>

          <View style={styles.cardBottomRow}>
            {/* Price tag */}
            <View style={[styles.costPill, costLabel === 'Free' ? styles.costPillFree : styles.costPillPaid]}>
              <Text style={[styles.costPillText, costLabel === 'Free' ? styles.costPillTextFree : styles.costPillTextPaid]}>
                {costLabel || 'Free'}
              </Text>
            </View>
            
            {/* Posted time ago */}
            <Text style={styles.timeAgoText}>
              {formatTimeAgo(createdTime)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [currentUserIdState, navigation]);

  const renderSeeAllCard = () => {
    return (
      <TouchableOpacity
        key="see-all"
        style={styles.seeAllCard}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('PlansDiscoverFeed')}
      >
        <View style={styles.seeAllIconContainer}>
          <ArrowRight size={18} color="#2962FF" strokeWidth={2.5} />
        </View>
        <Text style={styles.seeAllCardText}>See all</Text>
      </TouchableOpacity>
    );
  };

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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={182} // Card width 170 + Gap 12
          decelerationRate="fast"
          snapToAlignment="start"
          contentContainerStyle={styles.horizontalScrollContent}
        >
          {plans.map(plan => renderOpenPlanCard(plan))}
          {renderSeeAllCard()}
        </ScrollView>
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#2962FF',
    shadowColor: '#2962FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  hostBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  horizontalScrollContent: {
    paddingHorizontal: 24,
    gap: 12,
    paddingBottom: 8, // space for shadows
  },
  // New Open Plan Card styles
  planCard: {
    width: 170,
    height: 240,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  planCardHostingOutline: {
    borderColor: '#2962FF',
  },
  cardPosterContainer: {
    width: 170,
    height: 110,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  cardCategoryPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  cardCategoryPillText: {
    fontFamily: FONTS.medium,
    fontSize: 10,
  },
  cardCountPill: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  cardCountPillText: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: '#FFFFFF',
  },
  cardStatusPill: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  cardStatusPillText: {
    fontFamily: FONTS.medium,
    fontSize: 9,
    color: '#FFFFFF',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusDotHosting: {
    backgroundColor: '#38BDF8',
  },
  statusDotJoined: {
    backgroundColor: '#34D399',
  },
  cardContentContainer: {
    padding: 12,
    backgroundColor: '#1E293B',
    flex: 1,
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontFamily: FONTS.primary, // BasicCommercial-Bold
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 18,
    marginBottom: 4,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  cardMetaText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: '#CBD5E1',
    flex: 1,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  costPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  costPillFree: {
    backgroundColor: '#064E3B',
  },
  costPillPaid: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  costPillText: {
    fontFamily: FONTS.medium,
    fontSize: 10,
  },
  costPillTextFree: {
    color: '#34D399',
  },
  costPillTextPaid: {
    color: '#E2E8F0',
  },
  timeAgoText: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: '#94A3B8',
  },
  // See all Card styles
  seeAllCard: {
    width: 170,
    height: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  seeAllIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAllCardText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: '#1E293B',
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
});
