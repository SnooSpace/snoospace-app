import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Share, Image, Pressable, Dimensions, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, BadgeCheck, MapPin, Clock, Users, Lock,
  Heart, MessageCircle, ChartNoAxesCombined, Send, Pencil, MoreHorizontal, MoveRight,
} from 'lucide-react-native';
import { COLORS, FONTS, SHADOWS } from '../../constants/theme';
import { getAuthToken, getActiveAccount } from '../../api/auth';
import {
  getPlanById, recordView, likePlan, unlikePlan,
} from '../../api/plans';
import RequestBottomSheet from './RequestBottomSheet';
import CommentsModal from '../../components/CommentsModal';
import EditPlanBottomSheet from './EditPlanBottomSheet';
import PlanCropImage from './PlanCropImage';
import SnooLoader from '../../components/ui/SnooLoader';
import ReportSheet from '../../components/ReportSheet';

const CARD_PADDING = 16;
const SCREEN_WIDTH = Dimensions.get('window').width;
// Card width accounts for scrollContent padding: 16px each side
const CARD_WIDTH = SCREEN_WIDTH - 32;

// ─── Constants ────────────────────────────────────────────────────────────────

// Matches OpenPlanCard PILL_COLORS — all 16 activity types
const ACTIVITY_COLORS = {
  sports:       { bg: '#FFF3E0', text: '#E65100' },
  movies:       { bg: '#F3E5F5', text: '#6A1B9A' },
  bar:          { bg: '#E8EAF6', text: '#303F9F' },
  food:         { bg: '#FFF8E1', text: '#F57F17' },
  cafe:         { bg: '#EFEBE9', text: '#4E342E' },
  yoga:         { bg: '#E8F5E9', text: '#2E7D32' },
  gym:          { bg: '#FCE4EC', text: '#880E4F' },
  walk:         { bg: '#E0F2F1', text: '#00695C' },
  rides:        { bg: '#E3F2FD', text: '#1565C0' },
  live_music:   { bg: '#FCE4EC', text: '#C62828' },
  study:        { bg: '#EDE7F6', text: '#4527A0' },
  creative:     { bg: '#FFF9C4', text: '#F57F17' },
  games:        { bg: '#E1F5FE', text: '#01579B' },
  gaming:       { bg: '#E1F5FE', text: '#01579B' },
  pet_friendly: { bg: '#F1F8E9', text: '#33691E' },
  hangout:      { bg: '#E8F5E9', text: '#1B5E20' },
  other:        { bg: '#F5F5F5', text: '#424242' },
};

const ACTIVITY_EMOJIS = {
  sports:       '🏀',
  food:         '🍜',
  cafe:         '☕',
  bar:          '🍸',
  movies:       '🎬',
  live_music:   '🎵',
  games:        '🎮',
  gaming:       '🎮',
  gym:          '💪',
  yoga:         '🧘',
  walk:         '🚶',
  rides:        '🏍',
  hangout:      '🌳',
  creative:     '🎨',
  study:        '📚',
  pet_friendly: '🐾',
  other:        '＋',
};

const COST_LABELS = {
  free:      { label: 'Free',     bg: '#E8F5E9', text: '#2E7D32' },
  self_pay:  { label: 'Self-pay', bg: '#E8F5E9', text: '#2E7D32' },
  split:     { label: 'We split', bg: '#EEF2FF', text: '#3B5BDB' },
  entry_fee: { label: null,       bg: '#FFF8E1', text: '#B45309' },
};

const REQUEST_BUTTON = {
  null:      { label: 'Request to join',       bg: '#2962FF', textColor: '#FFFFFF', disabled: false },
  pending:   { label: 'Requested · Pending',   bg: '#F5F5F5', textColor: '#6B7280', disabled: true  },
  approved:  { label: "Approved — You're in!", bg: '#E8F5E9', textColor: '#2E7D32', disabled: true  },
  declined:  { label: 'Request declined',      bg: '#F5F5F5', textColor: '#9E9E9E', disabled: true  },
  withdrawn: { label: 'Request to join',       bg: '#2962FF', textColor: '#FFFFFF', disabled: false },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatScheduled(iso) {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === new Date(now.getTime() + 86400000).toDateString()) return `Tomorrow, ${time}`;
  return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) + ` · ${time}`;
}

function formatCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n ?? 0);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlanDetailScreen({ navigation, route }) {
  const { planId, openComments } = route.params;
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [requestSheetOpen, setRequestSheetOpen] = useState(false);
  const [commentsModalVisible, setCommentsModalVisible] = useState(openComments || false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [reportSheetVisible, setReportSheetVisible] = useState(false);

  const loadPlan = useCallback(async () => {
    try {
      setLoading(true);
      const [token, account] = await Promise.all([
        getAuthToken(),
        getActiveAccount(),
      ]);
      if (account?.id) setCurrentUserId(account.id);
      const data = await getPlanById(planId, token);
      setPlan(data.plan);
      setLikeCount(data.plan.like_count ?? 0);
      setIsLiked(data.plan.is_liked === true);
      recordView(planId, token).catch(() => {});
    } catch (err) {
      console.error('[PlanDetailScreen]', err.message);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    loadPlan();
    const unsubscribe = navigation.addListener('focus', () => {
      loadPlan();
    });
    return unsubscribe;
  }, [loadPlan, navigation]);

  const handleLike = useCallback(async () => {
    const prev = { isLiked, likeCount };
    setIsLiked(v => !v);
    setLikeCount(v => isLiked ? v - 1 : v + 1);
    try {
      const token = await getAuthToken();
      if (isLiked) await unlikePlan(planId, token);
      else await likePlan(planId, token);
    } catch {
      setIsLiked(prev.isLiked);
      setLikeCount(prev.likeCount);
    }
  }, [isLiked, likeCount, planId]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Check out this open plan "${plan?.title || 'Open Plan'}" on SnooSpace!`,
      });
    } catch (err) {
      console.error('[PlanDetailScreen] Share error:', err.message);
    }
  }, [plan?.title]);

  const handleOpenMap = useCallback(() => {
    if (!plan?.location_private) return;
    try {
      const parsed = JSON.parse(plan.location_private);
      const { lat, lng, name, address } = parsed;

      let url = '';
      if (lat && lng) {
        const label = encodeURIComponent(name || address || 'Meetup Point');
        url = Platform.select({
          ios: `maps://?q=${label}&ll=${lat},${lng}`,
          android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
        });
      } else {
        const query = encodeURIComponent(name || address || plan.location_private);
        url = Platform.select({
          ios: `maps://?q=${query}`,
          android: `geo:0,0?q=${query}`,
        });
      }
      Linking.openURL(url).catch(() => {
        const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${
          lat && lng ? `${lat},${lng}` : encodeURIComponent(name || address || plan.location_private)
        }`;
        Linking.openURL(fallbackUrl);
      });
    } catch {
      const query = encodeURIComponent(plan.location_private);
      const url = Platform.select({
        ios: `maps://?q=${query}`,
        android: `geo:0,0?q=${query}`,
      });
      Linking.openURL(url);
    }
  }, [plan?.location_private]);

  // ─── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <SnooLoader size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Plan not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.retryBtn}>
          <Text style={styles.retryText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Derived values ────────────────────────────────────────────────────────

  const isOwner = plan.created_by === currentUserId;
  const isApproved = plan.my_request_status === 'approved';
  const showPrivateLocation = isOwner || isApproved;

  const activityKey = plan.activity_type in ACTIVITY_COLORS ? plan.activity_type : 'other';
  const activityStyle = ACTIVITY_COLORS[activityKey];
  const ACTIVITY_LABELS = {
    sports: 'Sports', movies: 'Movies', bar: 'Bar', food: 'Food',
    cafe: 'Cafe', yoga: 'Yoga', gym: 'Gym', walk: 'Walk',
    rides: 'Rides', live_music: 'Live Music', study: 'Study / Co-work',
    creative: 'Creative', games: 'Games', gaming: 'Games',
    pet_friendly: 'Pet Friendly', hangout: 'Hangout',
  };
  const activityLabel = plan.activity_type === 'other'
    ? (plan.custom_activity_label || 'Other')
    : (ACTIVITY_LABELS[plan.activity_type] || plan.activity_type.charAt(0).toUpperCase() + plan.activity_type.slice(1));

  const costCfg = COST_LABELS[plan.cost_type] || COST_LABELS.free;
  let priceText = null;
  if (plan.cost_type === 'split' && plan.cost_amount_paise) {
    priceText = `~₹${Math.round(plan.cost_amount_paise / 100)} split`;
  } else if (plan.cost_type === 'entry_fee' && plan.cost_amount_paise) {
    priceText = `₹${Math.round(plan.cost_amount_paise / 100)}`;
  }

  const costPillLabel = plan.cost_type === 'entry_fee'
    ? 'Entry fee'
    : plan.cost_type === 'split'
      ? 'We split'
      : costCfg.label;

  const reqStatus = plan.my_request_status;
  const btnCfg = REQUEST_BUTTON[reqStatus] || REQUEST_BUTTON['null'];

  const spotsLeft = plan.max_accepted - (plan.accepted_count ?? 0);
  const progress = Math.min(1, (plan.accepted_count ?? 0) / (plan.max_accepted || 1));

  const genderPref = plan.gender_preference;
  const showGenderBadge = genderPref && genderPref !== 'all';
  const genderBadgeStyle = genderPref === 'Female'
    ? { bg: '#FCE4EC', text: '#C2185B', label: 'Women only' }
    : { bg: '#E3F2FD', text: '#1565C0', label: 'Men only' };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <ArrowLeft size={24} color={COLORS.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Open Plans</Text>
        {isOwner ? (
          <TouchableOpacity onPress={() => setEditSheetOpen(true)} hitSlop={12}>
            <Pencil size={20} color={COLORS.primary} strokeWidth={2} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => setReportSheetVisible(true)} hitSlop={12}>
            <MoreHorizontal size={22} color="#94A3B8" strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Card */}
          <View style={styles.card}>

            {/* Banner — custom image or activity-type preset */}
            <View style={styles.bannerContainer}>
              {plan.banner_image_url ? (
                <Image
                  source={{ uri: plan.banner_image_url }}
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
              ) : (
                <PlanCropImage
                  activityType={plan.activity_type}
                  containerW={CARD_WIDTH}
                  height={160}
                />
              )}
            </View>


            {/* Top row: activity tag + gender + cost */}
            <View style={styles.topRow}>

              <View style={styles.topRowLeft}>
                <View style={[styles.pill, { backgroundColor: activityStyle.bg }]}>
                  <Text style={[styles.pillText, { color: activityStyle.text }]}>
                    {`${ACTIVITY_EMOJIS[activityKey] || ACTIVITY_EMOJIS.other} ${activityLabel}`}
                  </Text>
                </View>
                {showGenderBadge && (
                  <View style={[styles.pill, { backgroundColor: genderBadgeStyle.bg, marginLeft: 6 }]}>
                    <Text style={[styles.pillText, { color: genderBadgeStyle.text }]}>{genderBadgeStyle.label}</Text>
                  </View>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={[styles.pill, { backgroundColor: costCfg.bg }]}>
                  <Text style={[styles.pillText, { color: costCfg.text }]}>{costPillLabel}</Text>
                </View>
                {priceText ? (
                  <Text style={styles.costPriceBelow}>{priceText}</Text>
                ) : null}
              </View>
            </View>

            {/* Title */}
            <Text style={styles.title}>{plan.title}</Text>

            {/* Host row — inline with avatar */}
            <View style={styles.hostRow}>
              {plan.host_profile?.profile_photo_url ? (
                <Image
                  source={{ uri: plan.host_profile.profile_photo_url }}
                  style={styles.hostAvatar}
                />
              ) : (
                <View style={styles.hostAvatarFallback}>
                  <Text style={styles.hostInitial}>
                    {(plan.host_profile?.name || '?')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.hostedByText}>
                Hosted by{' '}
                <Text style={styles.hostNameBold}>{plan.host_profile?.name || 'Someone'}</Text>
              </Text>
              {plan.host_profile?.is_verified && (
                <BadgeCheck size={14} color="#2962FF" strokeWidth={2} style={{ marginLeft: 4 }} />
              )}
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Time & location — inline */}
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Clock size={13} color={COLORS.textSecondary} strokeWidth={2} />
                <Text style={styles.metaText}>{formatScheduled(plan.scheduled_at)}</Text>
              </View>
              {(() => {
                let publicLoc = plan.location_public;
                if (publicLoc && publicLoc.toLowerCase() === 'current location') {
                  publicLoc = 'Location TBD';
                  if (plan.location_private) {
                    try {
                      const parsed = JSON.parse(plan.location_private);
                      publicLoc = parsed.short_address || parsed.city || parsed.address || 'Location TBD';
                      if (publicLoc.toLowerCase() === 'current location') {
                        publicLoc = 'Location TBD';
                      }
                    } catch {}
                  }
                }
                if (!publicLoc) return null;
                return (
                  <View style={[styles.metaItem, { marginLeft: 14 }]}>
                    <MapPin size={13} color={COLORS.textSecondary} strokeWidth={2} />
                    <Text style={styles.metaText} numberOfLines={1}>{publicLoc}</Text>
                  </View>
                );
              })()}
            </View>

            {/* Private location & Locked pill */}
            {(() => {
              if (showPrivateLocation) {
                if (!plan.location_private) return null;
                
                let locLabel = plan.location_private;
                try {
                  const parsed = JSON.parse(plan.location_private);
                  const name = (parsed.name || '').trim();
                  const address = (parsed.address || '').trim();
                  const shortAddress = (parsed.short_address || '').trim();
                  
                  if (name && name.toLowerCase() !== 'current location') {
                    locLabel = name;
                  } else if (address) {
                    locLabel = address;
                  } else if (shortAddress) {
                    locLabel = shortAddress;
                  } else {
                    locLabel = name || plan.location_private;
                  }
                } catch {}

                const displayLabel = isOwner ? 'View Location' : locLabel;

                return (
                  <TouchableOpacity
                    style={styles.privateLocationBox}
                    onPress={handleOpenMap}
                    activeOpacity={0.7}
                  >
                    <Lock size={13} color="#2962FF" strokeWidth={2} />
                    <Text style={styles.privateLocationText}>{displayLabel}</Text>
                    {isOwner ? (
                      <>
                        <MoveRight size={13} color="#2962FF" strokeWidth={2} style={{ marginLeft: 4 }} />
                        <View style={styles.locationHiddenTag}>
                          <Text style={styles.locationHiddenTagText}>Hidden for others</Text>
                        </View>
                      </>
                    ) : null}
                  </TouchableOpacity>
                );
              } else {
                // Non-approved user: show the locked pill in place of location
                return (
                  <View style={[styles.privateLocationBox, styles.privateLocationLocked]}>
                    <Lock size={13} color="#6B7280" strokeWidth={2} />
                    <Text style={styles.privateLocationTextLocked}>
                      Exact location shared after host approves
                    </Text>
                  </View>
                );
              }
            })()}

            {/* Redesigned Acceptance Section */}
            <View style={styles.compactAcceptanceRow}>
              <View style={styles.compactAcceptanceLeft}>
                <Users size={16} color={COLORS.primary} strokeWidth={2.2} />
                <Text style={styles.compactAcceptanceText}>
                  <Text style={styles.compactAcceptanceBold}>{plan.accepted_count ?? 0} / {plan.max_accepted}</Text> spots filled
                </Text>
              </View>
              {isOwner && plan.pending_count > 0 && (
                <View style={styles.pendingBadgeInline}>
                  <View style={styles.pendingBadgeDot} />
                  <Text style={styles.pendingBadgeText}>{plan.pending_count} pending</Text>
                </View>
              )}
            </View>

            {/* Shared community pill */}
            {!isOwner && plan.shared_communities?.length > 0 && (
              <View style={styles.sharedPill}>
                <Users size={12} color="#2962FF" strokeWidth={2} />
                <Text style={styles.sharedText}>
                  Shared community:{' '}
                  <Text style={{ color: '#2962FF' }}>
                    {plan.shared_communities.map(c => c.name).join(', ')}
                  </Text>
                </Text>
              </View>
            )}

            {/* Divider */}
            <View style={styles.divider} />

            {/* Engagement row */}
            <View style={styles.engagementRow}>
              {/* Like */}
              <Pressable onPress={handleLike} style={styles.engItem}>
                <Heart
                  size={18}
                  color={isLiked ? '#E53E3E' : '#6B7280'}
                  fill={isLiked ? '#E53E3E' : 'transparent'}
                  strokeWidth={2}
                />
                <Text style={[styles.engCount, isLiked && styles.likedCount]}>
                  {formatCount(likeCount)}
                </Text>
              </Pressable>

              {/* Comment */}
              <Pressable onPress={() => setCommentsModalVisible(true)} style={styles.engItem}>
                <MessageCircle size={18} color="#6B7280" strokeWidth={2} />
                <Text style={styles.engCount}>{formatCount(plan.comment_count)}</Text>
              </Pressable>

              {/* Views */}
              <View style={styles.engItem}>
                <ChartNoAxesCombined size={18} color="#6B7280" strokeWidth={2} />
                <Text style={styles.engCount}>{formatCount(plan.view_count)}</Text>
              </View>

              {/* Share */}
              <Pressable onPress={handleShare} style={styles.engItem}>
                <Send size={18} color="#6B7280" strokeWidth={2} />
              </Pressable>
            </View>

            {/* Host: manage requests button */}
            {isOwner && (
              <TouchableOpacity
                style={styles.manageBtn}
                onPress={() => navigation.navigate('HostRequests', { planId: plan.id, planTitle: plan.title })}
              >
                <Users size={16} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.manageBtnText}>Manage requests</Text>
                {plan.pending_count > 0 && (
                  <View style={styles.manageBadge}>
                    <Text style={styles.manageBadgeText}>{plan.pending_count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* Request to join button — non-hosts only */}
            {!isOwner && (
              <TouchableOpacity
                style={[styles.requestBtn, { backgroundColor: btnCfg.bg }, btnCfg.disabled && { opacity: 0.85 }]}
                onPress={() => !btnCfg.disabled && setRequestSheetOpen(true)}
                disabled={btnCfg.disabled}
                activeOpacity={btnCfg.disabled ? 1 : 0.85}
              >
                <Text style={[styles.requestBtnText, { color: btnCfg.textColor }]}>{btnCfg.label}</Text>
              </TouchableOpacity>
            )}

            {/* Fine print removed (relocated to locked location pill) */}

          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      <RequestBottomSheet
        isVisible={requestSheetOpen}
        planId={plan.id}
        planTitle={plan.title}
        onClose={() => setRequestSheetOpen(false)}
        onRequested={() => {
          setPlan(p => ({ ...p, my_request_status: 'pending' }));
          setRequestSheetOpen(false);
        }}
      />

      <CommentsModal
        visible={commentsModalVisible}
        postId={plan.id}
        onClose={() => setCommentsModalVisible(false)}
        baseRoute="/plans"
        replyBaseRoute="/comments"
        navigation={navigation}
        onCommentCountChange={(newCount) => {
          setPlan(p => ({ ...p, comment_count: newCount }));
        }}
      />

      <EditPlanBottomSheet
        visible={editSheetOpen}
        onClose={() => setEditSheetOpen(false)}
        plan={plan}
        navigation={navigation}
        onPlanUpdated={(updatedPlan) => {
          setPlan(p => ({ ...p, ...updatedPlan }));
          setEditSheetOpen(false);
        }}
        onPlanCancelled={() => {
          setEditSheetOpen(false);
          navigation.goBack();
        }}
      />

      <ReportSheet
        visible={reportSheetVisible}
        onClose={() => setReportSheetVisible(false)}
        type="open_plan"
        targetId={plan.id}
        targetName={plan.title}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.surface },
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  errorText: { fontFamily: FONTS.regular, fontSize: 16, color: COLORS.textSecondary },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 12 },
  retryText: { fontFamily: FONTS.semiBold, fontSize: 14, color: '#FFF' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontFamily: FONTS.semiBold, fontSize: 17, color: COLORS.textPrimary, flex: 1, textAlign: 'center' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  // Card — matches OpenPlanCard exactly
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: CARD_PADDING,
    paddingTop: 0,
    ...SHADOWS.md,
    overflow: 'hidden',
  },

  // Banner section at top of card
  bannerContainer: {
    marginHorizontal: -CARD_PADDING,
    marginBottom: 14,
    overflow: 'hidden',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  bannerImage: {
    width: CARD_WIDTH,
    height: 160,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  topRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
  },

  // Title
  title: {
    fontFamily: FONTS.primary,
    fontSize: 17,
    color: COLORS.textPrimary,
    lineHeight: 23,
    marginBottom: 8,
  },

  // Host row — inline style matching image 1
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  hostAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6,
    overflow: 'hidden',
  },
  hostAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  hostInitial: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: '#2962FF',
  },
  hostedByText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  hostNameBold: {
    fontFamily: FONTS.semiBold,
    color: COLORS.textPrimary,
  },

  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },

  // Meta row — time + location inline
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  // Private location
  privateLocationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  privateLocationText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#2962FF',
  },
  locationHiddenTag: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  locationHiddenTagText: {
    fontFamily: FONTS.semiBold,
    fontSize: 9,
    color: '#7E22CE',
    textTransform: 'uppercase',
  },
  privateLocationLocked: {
    backgroundColor: '#F3F4F6',
  },
  privateLocationTextLocked: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#6B7280',
  },

  // Acceptance (Redesigned compact styles)
  compactAcceptanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  compactAcceptanceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactAcceptanceText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  compactAcceptanceBold: {
    fontFamily: FONTS.bold,
    color: COLORS.textPrimary,
  },
  pendingBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
    borderWidth: 0.5,
    borderColor: '#FFEDD5',
  },
  pendingBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EA580C',
  },
  pendingBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: '#C2410C',
  },

  // Shared community pill
  sharedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  sharedText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  // Engagement row
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  engItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 36,
  },
  engCount: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#9CA3AF',
    marginLeft: 6,
  },
  likedCount: {
    color: '#E53E3E',
  },

  // Manage button (host)
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  manageBtnText: { fontFamily: FONTS.semiBold, fontSize: 15, color: '#FFF', flex: 1 },
  manageBadge: {
    backgroundColor: '#FFF',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageBadgeText: { fontFamily: FONTS.semiBold, fontSize: 12, color: COLORS.primary },
  costPriceBelow: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginTop: 4,
  },

  // Request button
  requestBtn: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  requestBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
  },

  // Fine print
  finePrint: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
