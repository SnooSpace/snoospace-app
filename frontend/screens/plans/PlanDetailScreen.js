import React, { useState, useEffect, useCallback, useRef, Profiler } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Dimensions,
  Linking,
  Platform,
  Alert,
  Modal,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Share as ShareIcon,
  MapPin,
  Clock,
  Users,
  Lock,
  Calendar,
  Star,
  Heart,
  MessageCircle,
  ChartNoAxesCombined,
  Send,
  Pencil,
  MoreHorizontal,
  MoveRight,
  Trash2,
  AlertCircle,
} from 'lucide-react-native';

import VerifiedBadge from '../../components/badges/VerifiedBadge';
import { COLORS } from '../../constants/theme';
import { getAuthToken, getActiveAccount } from '../../api/auth';
import {
  getPlanById,
  recordView,
  likePlan,
  unlikePlan,
  cancelPlan,
  getApprovedAttendees,
} from '../../api/plans';
import RequestBottomSheet from './RequestBottomSheet';
import CommentsModal from '../../components/modals/CommentsModal';
import EditPlanBottomSheet from './EditPlanBottomSheet';
import PlanCropImage from './PlanCropImage';
import SnooLoader from '../../components/ui/SnooLoader';
import ReportSheet from '../../components/modals/ReportSheet';
import SwipeableModal from '../../components/modals/SwipeableModal';
import ShareModal from '../../components/modals/ShareModal';
import CustomConfirmDialog from '../../components/ui/CustomConfirmDialog';
import DynamicStatusBar from '../../components/navigation/DynamicStatusBar';
import EventBus from '../../utils/EventBus';
import { getGradientForName, getInitials } from '../../utils/AvatarGenerator';

const onRenderProfiler = (id, phase, actualDuration) => {
  console.log(`[PERF-RENDER] ${id} - Phase: ${phase}, Duration: ${actualDuration.toFixed(2)}ms`);
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BANNER_HEIGHT = Math.round(SCREEN_HEIGHT * 0.40);

const PRIMARY_COLOR = COLORS.primary;
const TEXT_COLOR = '#1F2937';
const MUTED_TEXT = '#6B7280';
const BACKGROUND_COLOR = '#F9FAFB';
const CARD_BACKGROUND = '#FFFFFF';
const BORDER_COLOR = '#E5E7EB';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVITY_COLORS = {
  sports:         { bg: '#FFF3E0', text: '#E65100' },
  movies:         { bg: '#F3E5F5', text: '#6A1B9A' },
  bar:            { bg: '#E8EAF6', text: '#303F9F' },
  food:           { bg: '#FFF8E1', text: '#F57F17' },
  cafe:           { bg: '#EFEBE9', text: '#4E342E' },
  yoga:           { bg: '#E8F5E9', text: '#2E7D32' },
  gym:            { bg: '#FCE4EC', text: '#880E4F' },
  walk:           { bg: '#E0F2F1', text: '#00695C' },
  rides:          { bg: '#E3F2FD', text: '#1565C0' },
  live_music:     { bg: '#FCE4EC', text: '#C62828' },
  study:          { bg: '#EDE7F6', text: '#4527A0' },
  cowork:         { bg: '#EDE7F6', text: '#4527A0' },
  creative:       { bg: '#FFF9C4', text: '#F57F17' },
  games:          { bg: '#E1F5FE', text: '#01579B' },
  gaming:         { bg: '#E1F5FE', text: '#01579B' },
  pet_friendly:   { bg: '#F1F8E9', text: '#33691E' },
  pet_gathering:  { bg: '#F1F8E9', text: '#33691E' },
  hangout:        { bg: '#E8F5E9', text: '#1B5E20' },
  house_party:    { bg: '#FBE9E7', text: '#D84315' },
  club:           { bg: '#EDE7F6', text: '#5E35B1' },
  hiking:         { bg: '#E8F5E9', text: '#2E7D32' },
  shopping:       { bg: '#FCE4EC', text: '#D81B60' },
  bowling:        { bg: '#EDE7F6', text: '#512DA8' },
  gokarting:      { bg: '#FFF3E0', text: '#D84315' },
  go_karting:     { bg: '#FFF3E0', text: '#D84315' },
  indoorgames:    { bg: '#EDE7F6', text: '#673AB7' },
  indoor_games:   { bg: '#EDE7F6', text: '#673AB7' },
  pilates:        { bg: '#FCE4EC', text: '#C2185B' },
  swimming:       { bg: '#E0F7FA', text: '#00838F' },
  other:          { bg: '#F5F5F5', text: '#424242' },
};

const ACTIVITY_EMOJIS = {
  sports:         '🏀',
  food:           '🍜',
  cafe:           '☕',
  bar:            '🍸',
  movies:         '🎬',
  live_music:     '🎵',
  games:          '🎮',
  gaming:         '🎮',
  gym:            '💪',
  yoga:           '🧘',
  walk:           '🚶',
  rides:          '🏍',
  hangout:        '🌳',
  creative:       '🎨',
  study:          '📚',
  cowork:         '📚',
  pet_friendly:   '🐾',
  pet_gathering:  '🐾',
  house_party:    '🏡',
  club:           '🪩',
  hiking:         '🥾',
  shopping:       '🛍️',
  bowling:        '🎳',
  gokarting:      '🏎️',
  go_karting:     '🏎️',
  indoorgames:    '🎲',
  indoor_games:   '🎲',
  pilates:        '🤸‍♀️',
  swimming:       '🏊',
  other:          '＋',
};

const COST_LABELS = {
  free:      { label: 'Free',     bg: '#E8F5E9', text: '#2E7D32' },
  self_pay:  { label: 'Self-pay', bg: '#E8F5E9', text: '#2E7D32' },
  split:     { label: 'We split', bg: '#EEF2FF', text: '#3B5BDB' },
  entry_fee: { label: null,       bg: '#FFF8E1', text: '#B45309' },
};

const REQUEST_BUTTON = {
  null:      { label: 'Request to join',       bg: '#2962FF', textColor: '#FFFFFF', disabled: false },
  pending:   { label: 'Requested · Pending',   bg: '#F3F4F6', textColor: '#6B7280', disabled: true  },
  approved:  { label: "Approved — You're in!", bg: '#E8F5E9', textColor: '#2E7D32', disabled: true  },
  declined:  { label: 'Request declined',      bg: '#F3F4F6', textColor: '#9E9E9E', disabled: true  },
  withdrawn: { label: 'Request to join',       bg: '#2962FF', textColor: '#FFFFFF', disabled: false },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatScheduled(iso) {
  if (!iso) return '';
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
  const { planId, openComments } = route.params || {};
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [requestSheetOpen, setRequestSheetOpen] = useState(false);
  const [commentsModalVisible, setCommentsModalVisible] = useState(openComments || false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [reportSheetVisible, setReportSheetVisible] = useState(false);
  const [hostMenuVisible, setHostMenuVisible] = useState(false);
  const [sharedCommSheetOpen, setSharedCommSheetOpen] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteConfirmMessage, setDeleteConfirmMessage] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [attendees, setAttendees] = useState([]);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  // Pinned Header Interpolations matching EventDetailsScreen
  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [20, 50],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const loadPlan = useCallback(async () => {
    try {
      setLoading(true);
      const [token, account] = await Promise.all([
        getAuthToken(),
        getActiveAccount().catch(() => null),
      ]);
      if (account?.id) {
        setCurrentUserId(account.id);
      }
      const data = await getPlanById(planId, token);
      const actualPlan = data?.plan || data;
      setPlan(actualPlan);
      setIsLiked(actualPlan?.is_liked === true);
      setLikeCount(actualPlan?.like_count ?? 0);

      recordView(planId, token)
        .then((res) => {
          if (res?.is_new) {
            const updatedCount =
              res?.view_count !== undefined
                ? res.view_count
                : (actualPlan?.view_count || 0) + 1;
            setPlan((prev) =>
              prev ? { ...prev, view_count: updatedCount } : prev
            );
            EventBus.emit('plan-view-updated', {
              planId,
              viewCount: updatedCount,
            });
          }
        })
        .catch(() => {});
    } catch (err) {
      console.error('[PlanDetailScreen]', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  // Sync real-time view updates
  useEffect(() => {
    if (!planId) return;
    const unsubscribe = EventBus.on('plan-view-updated', (payload) => {
      if (payload?.planId === planId || payload?.postId === planId) {
        setPlan((prev) =>
          prev
            ? {
                ...prev,
                view_count: payload.viewCount ?? prev.view_count,
              }
            : prev
        );
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [planId]);

  // Fetch approved attendees only when user is host or approved attendee
  useEffect(() => {
    if (!plan) return;
    const isOwnerOrApproved =
      (currentUserId != null && String(plan.created_by) === String(currentUserId)) ||
      plan.my_request_status === 'approved';
    if (!isOwnerOrApproved) return;

    (async () => {
      try {
        const token = await getAuthToken();
        const data = await getApprovedAttendees(plan.id, token);
        setAttendees(data?.attendees || []);
      } catch {
        // Non-fatal — attendees section just stays empty
      }
    })();
  }, [plan?.id, plan?.created_by, plan?.my_request_status, currentUserId]);

  const handleLike = useCallback(async () => {
    const prev = { isLiked, likeCount };
    setIsLiked((v) => !v);
    setLikeCount((v) => (isLiked ? v - 1 : v + 1));
    try {
      const token = await getAuthToken();
      if (isLiked) await unlikePlan(planId, token);
      else await likePlan(planId, token);
    } catch {
      setIsLiked(prev.isLiked);
      setLikeCount(prev.likeCount);
    }
  }, [isLiked, likeCount, planId]);

  const handleShare = useCallback(() => {
    setShareModalVisible(true);
  }, []);

  const handleDeletePlan = useCallback(() => {
    if (!plan) return;
    const pendingCount = plan.pending_count ?? 0;
    const warningMsg =
      pendingCount > 0
        ? `${pendingCount} pending request${pendingCount > 1 ? 's' : ''} will be notified that the plan was removed. This cannot be undone.`
        : 'This plan will be permanently deleted. This cannot be undone.';

    setDeleteConfirmMessage(warningMsg);
    setDeleteConfirmVisible(true);
    setHostMenuVisible(false);
  }, [plan]);

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

  // ─── Loading / Error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <DynamicStatusBar style="dark-content" />
        <SnooLoader size="large" color={PRIMARY_COLOR} />
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={[styles.container, styles.centered]}>
        <DynamicStatusBar style="dark-content" />
        <AlertCircle size={48} color={MUTED_TEXT} />
        <Text style={styles.errorText}>Plan not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Derived values ────────────────────────────────────────────────────────

  const isOwner = currentUserId != null && String(plan.created_by) === String(currentUserId);
  const isPastDeadline = plan.scheduled_at ? new Date(plan.scheduled_at) < new Date() : false;
  const canDelete = (plan.accepted_count ?? 0) === 0;
  const showDisabledDelete = !canDelete && (plan.accepted_count ?? 0) > 0;
  const isApproved = plan.my_request_status === 'approved';
  const showPrivateLocation = isOwner || isApproved;

  const activityKey =
    plan.activity_type && plan.activity_type in ACTIVITY_COLORS ? plan.activity_type : 'other';
  const activityStyle = ACTIVITY_COLORS[activityKey] || ACTIVITY_COLORS.other;
  const ACTIVITY_LABELS = {
    sports: 'Sports', movies: 'Movies', bar: 'Bar', food: 'Food',
    cafe: 'Cafe', yoga: 'Yoga', gym: 'Gym', walk: 'Walk',
    rides: 'Rides', live_music: 'Live Music', study: 'Co-work',
    cowork: 'Co-work', creative: 'Creative', games: 'Games', gaming: 'Games',
    pet_friendly: 'Pet Meetup', pet_gathering: 'Pet Meetup',
    hangout: 'Hangout', house_party: 'House Party', club: 'Club',
    hiking: 'Hiking', shopping: 'Shopping', bowling: 'Bowling',
    gokarting: 'Go-karting', go_karting: 'Go-karting',
    indoorgames: 'Indoor Games', indoor_games: 'Indoor Games',
    pilates: 'Pilates', swimming: 'Swimming',
  };
  const activityLabel =
    !plan.activity_type || plan.activity_type === 'other'
      ? plan.custom_activity_label || 'Other'
      : ACTIVITY_LABELS[plan.activity_type] ||
        (typeof plan.activity_type === 'string'
          ? plan.activity_type.charAt(0).toUpperCase() + plan.activity_type.slice(1)
          : 'Other');

  const costCfg = COST_LABELS[plan.cost_type] || COST_LABELS.free;
  let priceText = null;
  if (plan.cost_type === 'split' && plan.cost_amount_paise) {
    priceText = `~₹${Math.round(plan.cost_amount_paise / 100)} split`;
  } else if (plan.cost_type === 'entry_fee' && plan.cost_amount_paise) {
    priceText = `₹${Math.round(plan.cost_amount_paise / 100)}`;
  }

  const costPillLabel =
    plan.cost_type === 'entry_fee'
      ? 'Entry fee'
      : plan.cost_type === 'split'
        ? 'We split'
        : costCfg.label;

  const reqStatus = plan.my_request_status;
  const btnCfg = REQUEST_BUTTON[reqStatus] || REQUEST_BUTTON['null'];

  const spotsLeft = Math.max(0, (plan.max_accepted || 1) - (plan.accepted_count ?? 0));
  const progress = Math.min(1, (plan.accepted_count ?? 0) / (plan.max_accepted || 1));

  const genderPref = plan.gender_preference;
  const showGenderBadge = Boolean(genderPref && genderPref !== 'all');
  const genderBadgeStyle =
    genderPref === 'Female'
      ? { bg: '#FCE4EC', text: '#C2185B', label: 'Women only' }
      : { bg: '#E3F2FD', text: '#1565C0', label: 'Men only' };

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

  let privateLocationLabel = plan.location_private || 'View Location';
  if (plan.location_private) {
    try {
      const parsed = JSON.parse(plan.location_private);
      const name = (parsed.name || '').trim();
      const address = (parsed.address || '').trim();
      const shortAddress = (parsed.short_address || '').trim();
      if (name && name.toLowerCase() !== 'current location') {
        privateLocationLabel = name;
      } else if (address) {
        privateLocationLabel = address;
      } else if (shortAddress) {
        privateLocationLabel = shortAddress;
      }
    } catch {}
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Profiler id="PlanDetailScreen" onRender={onRenderProfiler}>
      <DynamicStatusBar style="dark-content" />
      <View style={styles.container}>
        {/* 🌟 Fixed Pinned Header System with Scrim (matching EventDetailsScreen) */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: insets.top + (Platform.OS === 'ios' ? 44 : 56),
            zIndex: 1001,
            pointerEvents: 'box-none',
          }}
        >
          {/* Header Background (fades in on scroll) */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                opacity: headerBgOpacity,
                elevation: scrollY.interpolate({
                  inputRange: [0, 50],
                  outputRange: [0, 4],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          />

          {/* Centered Title Layer */}
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                paddingTop: insets.top,
                justifyContent: 'center',
                alignItems: 'center',
              },
            ]}
            pointerEvents="none"
          >
            <Animated.Text
              style={[styles.headerTitle, { opacity: headerTitleOpacity }]}
              numberOfLines={1}
            >
              {plan.title || ''}
            </Animated.Text>
          </View>

          {/* Buttons Layer (Floating on top of scrim) */}
          <View
            style={[
              styles.floatingHeader,
              {
                paddingTop: insets.top,
                height: '100%',
              },
            ]}
          >
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <ArrowLeft size={22} color="#1D1D1F" strokeWidth={2} />
            </TouchableOpacity>

            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={handleShare}
                activeOpacity={0.8}
              >
                <ShareIcon size={20} color="#1D1D1F" strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerButton, { marginLeft: 8 }]}
                onPress={() => (isOwner ? setHostMenuVisible(true) : setReportSheetVisible(true))}
                activeOpacity={0.8}
              >
                <MoreHorizontal size={20} color="#1D1D1F" strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Scrollable Content */}
        <Animated.ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          bounces={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
        >
          {/* 1️⃣ Hero Banner Section (Full width, edge-to-edge) */}
          <View style={styles.bannerContainer}>
            {plan.banner_image_url ? (
              <Image
                source={{ uri: plan.banner_image_url }}
                style={styles.bannerImage}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <PlanCropImage
                activityType={plan.activity_type}
                containerW={SCREEN_WIDTH}
                height={BANNER_HEIGHT}
              />
            )}

            {/* Top dark gradient overlay for header buttons legibility */}
            <LinearGradient
              colors={['rgba(0,0,0,0.5)', 'transparent']}
              locations={[0, 0.4]}
              style={StyleSheet.absoluteFillObject}
            />

            {/* Bottom subtle shadow gradient */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.3)']}
              locations={[0.7, 1]}
              style={StyleSheet.absoluteFillObject}
            />
          </View>

          {/* 2️⃣ Sticky Action Section (Hero Information & Action) */}
          <View style={styles.stickyActionContainer}>
            {/* Plan Title */}
            <Text style={styles.planTitle} numberOfLines={3}>
              {plan.title || ''}
            </Text>

            {/* Scheduled Date & Time */}
            {plan.scheduled_at ? (
              <View style={styles.metaRowItem}>
                <Calendar size={16} color={MUTED_TEXT} strokeWidth={2} />
                <Text style={styles.metaRowText}>
                  {formatScheduled(plan.scheduled_at)}
                </Text>
              </View>
            ) : null}

            {/* Location Section */}
            {publicLoc ? (
              <View style={styles.metaRowItem}>
                <MapPin size={16} color={MUTED_TEXT} strokeWidth={2} />
                <Text style={styles.metaRowText} numberOfLines={1}>
                  {publicLoc}
                </Text>
              </View>
            ) : null}

            {/* Private Location link or Locked Notice */}
            {showPrivateLocation ? (
              plan.location_private ? (
                <TouchableOpacity
                  onPress={handleOpenMap}
                  style={styles.mapLinkRow}
                  activeOpacity={0.7}
                >
                  <Text style={styles.mapLinkText}>
                    {isOwner ? 'View location on map' : privateLocationLabel}
                  </Text>
                  <MoveRight size={15} color={PRIMARY_COLOR} strokeWidth={2.5} />
                  {isOwner ? (
                    <View style={styles.hiddenTag}>
                      <Text style={styles.hiddenTagText}>Hidden for others</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              ) : (
                <View style={{ marginBottom: 12 }} />
              )
            ) : (
              <View style={styles.lockedLocationRow}>
                <Lock size={12} color={MUTED_TEXT} strokeWidth={2} />
                <Text style={styles.lockedLocationText}>
                  Exact location shared after host approves
                </Text>
              </View>
            )}

            {/* Badges Row (Activity, Gender, Cost) */}
            <View style={styles.badgesRow}>
              {/* Activity badge */}
              <View style={[styles.badgeChip, { backgroundColor: activityStyle.bg }]}>
                <Text style={[styles.badgeChipText, { color: activityStyle.text }]}>
                  {`${ACTIVITY_EMOJIS[activityKey] || ACTIVITY_EMOJIS.other} ${activityLabel}`}
                </Text>
              </View>

              {/* Gender badge */}
              {showGenderBadge ? (
                <View style={[styles.badgeChip, { backgroundColor: genderBadgeStyle.bg }]}>
                  <Text style={[styles.badgeChipText, { color: genderBadgeStyle.text }]}>
                    {genderBadgeStyle.label}
                  </Text>
                </View>
              ) : null}

              {/* Cost badge */}
              <View style={[styles.badgeChip, { backgroundColor: costCfg.bg }]}>
                <Text style={[styles.badgeChipText, { color: costCfg.text }]}>
                  {costPillLabel}
                </Text>
              </View>
            </View>

            {/* Action Bar (Price/Spots on left, CTA on right) */}
            <View style={styles.stickyActionContent}>
              <View style={styles.stickyPriceContainer}>
                <Text style={styles.stickyPriceLabel}>
                  {plan.cost_type !== 'free' && priceText ? 'Cost' : 'Spots'}
                </Text>
                <Text style={styles.stickyPriceValue}>
                  {plan.cost_type !== 'free' && priceText
                    ? priceText
                    : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`}
                </Text>
              </View>

              {isOwner ? (
                <TouchableOpacity
                  style={styles.stickyActionButton}
                  onPress={() => navigation.navigate('HostRequests', { planId: plan.id, planTitle: plan.title })}
                  activeOpacity={0.85}
                >
                  <Users size={16} color="#FFFFFF" strokeWidth={2} style={{ marginRight: 8 }} />
                  <Text style={styles.stickyActionButtonText}>Manage Requests</Text>
                  {plan.pending_count > 0 ? (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>{plan.pending_count}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.stickyActionButton,
                    { backgroundColor: btnCfg.bg },
                    btnCfg.disabled ? styles.stickyActionButtonDisabled : null,
                  ]}
                  onPress={() => !btnCfg.disabled && setRequestSheetOpen(true)}
                  disabled={btnCfg.disabled}
                  activeOpacity={btnCfg.disabled ? 1 : 0.85}
                >
                  <Text style={[styles.stickyActionButtonText, { color: btnCfg.textColor }]}>
                    {btnCfg.label}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 3️⃣ Content Container */}
          <View style={styles.contentContainer}>
            {/* About Plan Section */}
            {plan.description ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About Plan</Text>
                <Text
                  style={styles.description}
                  numberOfLines={descriptionExpanded ? undefined : 4}
                >
                  {plan.description}
                </Text>
                {plan.description.length > 180 ? (
                  <TouchableOpacity onPress={() => setDescriptionExpanded(!descriptionExpanded)}>
                    <Text style={styles.readMore}>
                      {descriptionExpanded ? 'Show less' : 'Read more'} ›
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {/* Capacity & Shared Communities Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Plan Capacity</Text>
              <View style={styles.capacityCard}>
                <View style={styles.capacityHeader}>
                  <View style={styles.capacityIconWrap}>
                    <Users size={18} color={PRIMARY_COLOR} strokeWidth={2} />
                  </View>
                  <View style={styles.capacityCol}>
                    <Text style={styles.capacityTitle}>
                      {plan.accepted_count ?? 0} of {plan.max_accepted} spots filled
                    </Text>
                    <Text style={styles.capacitySub}>
                      {spotsLeft > 0 ? `${spotsLeft} spots available` : 'This plan is currently full'}
                    </Text>
                  </View>
                </View>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.round(progress * 100))}%` }]} />
                </View>
              </View>

              {/* Shared Communities CTA */}
              {!isOwner && plan.shared_communities?.length > 0 ? (
                <TouchableOpacity
                  style={styles.sharedCommCard}
                  onPress={() => setSharedCommSheetOpen(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.sharedCommLeft}>
                    <View style={styles.sharedCommIconWrap}>
                      <Users size={16} color="#6366F1" strokeWidth={2.2} />
                    </View>
                    <Text style={styles.sharedCommText}>
                      {plan.shared_communities.length === 1
                        ? '1 shared community'
                        : `${plan.shared_communities.length} shared communities`}
                    </Text>
                  </View>
                  <MoveRight size={16} color="#6366F1" strokeWidth={2} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Hosted By Section (Premium Host Card matching EventDetailsScreen) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hosted By</Text>
              <TouchableOpacity
                style={styles.hostCardPremium}
                onPress={() => {
                  if (plan.created_by) {
                    navigation.navigate('MemberPublicProfile', { memberId: plan.created_by });
                  }
                }}
                activeOpacity={0.8}
              >
                <View style={styles.hostCardInner}>
                  {plan.host_profile?.profile_photo_url ? (
                    <Image
                      source={{ uri: plan.host_profile.profile_photo_url }}
                      style={styles.hostAvatarPremium}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <LinearGradient
                      colors={getGradientForName(plan.host_profile?.name || 'Host')}
                      style={styles.hostAvatarPremium}
                    >
                      <Text style={styles.hostInitials}>
                        {getInitials(plan.host_profile?.name || 'Host')}
                      </Text>
                    </LinearGradient>
                  )}
                  <View style={styles.hostInfoPremium}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.hostNamePremium} numberOfLines={1}>
                        {plan.host_profile?.name || 'Host'}
                      </Text>
                      <VerifiedBadge
                        tier={plan.host_profile?.verification_tier}
                        size={14}
                        style={{ marginLeft: 6 }}
                      />
                    </View>
                    <Text style={styles.hostStatsPremium}>
                      {plan.host_profile?.member_since ? `Member since ${plan.host_profile.member_since}` : 'Member'}
                      {plan.host_profile?.events_joined_count != null ? ` • ${plan.host_profile.events_joined_count} events joined` : ''}
                    </Text>
                  </View>
                </View>

                {/* Host Trust Stats: Activity Level + Top Interests */}
                {plan.host_profile?.activity_level || (plan.host_profile?.top_interests && plan.host_profile.top_interests.length > 0) ? (
                  <View style={styles.hostTrustStatsRow}>
                    {plan.host_profile?.activity_level ? (
                      <View style={[styles.activityLevelPill, styles[`activityLevel_${plan.host_profile.activity_level.replace(' ', '_')}`]]}>
                        <Star size={11} color="#92400E" strokeWidth={2} />
                        <Text style={styles.activityLevelText}>{plan.host_profile.activity_level}</Text>
                      </View>
                    ) : null}
                    {plan.host_profile?.top_interests?.map((interest, idx) => (
                      <View key={idx} style={styles.interestChip}>
                        <Text style={styles.interestChipText}>{interest}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.hostCtaRow}>
                  <Text style={styles.hostCtaText}>View Profile</Text>
                  <MoveRight size={16} color={PRIMARY_COLOR} strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Who's Coming Section (Approved Attendees) */}
            {(isOwner || isApproved) && attendees && attendees.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Who's Coming ({attendees.length})
                </Text>
                <View style={styles.attendeesList}>
                  {attendees.map((attendee) => (
                    <TouchableOpacity
                      key={attendee.id || attendee.member_id}
                      style={styles.attendeeCard}
                      onPress={() => {
                        if (attendee.id || attendee.member_id) {
                          navigation.navigate('MemberPublicProfile', {
                            memberId: attendee.member_id || attendee.id,
                          });
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      {attendee.profile_photo_url ? (
                        <Image
                          source={{ uri: attendee.profile_photo_url }}
                          style={styles.attendeeAvatar}
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <LinearGradient
                          colors={getGradientForName(attendee.name || 'A')}
                          style={styles.attendeeAvatar}
                        >
                          <Text style={styles.attendeeInitials}>
                            {getInitials(attendee.name || 'A')}
                          </Text>
                        </LinearGradient>
                      )}
                      <View style={styles.attendeeInfo}>
                        <View style={styles.attendeeNameRow}>
                          <Text style={styles.attendeeName} numberOfLines={1}>
                            {attendee.name || 'Member'}
                          </Text>
                          <VerifiedBadge
                            tier={attendee.verification_tier}
                            size={13}
                            style={{ marginLeft: 4 }}
                          />
                        </View>
                        <Text style={styles.attendeeMetaText}>
                          Since {attendee.member_since} • {attendee.events_joined_count ?? 0} events
                        </Text>
                        <View style={styles.attendeeBottomRow}>
                          {attendee.activity_level ? (
                            <View style={[styles.attendeeActivityPill, styles[`activityLevel_${attendee.activity_level?.replace(' ', '_')}`]]}>
                              <Text style={styles.attendeeActivityText}>{attendee.activity_level}</Text>
                            </View>
                          ) : null}
                          {attendee.top_interests?.slice(0, 2).map((interest, idx) => (
                            <View key={idx} style={styles.attendeeInterestChip}>
                              <Text style={styles.attendeeInterestText}>{interest}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      <MoveRight size={14} color={MUTED_TEXT} strokeWidth={2} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Engagement Row */}
            <View style={styles.engagementCard}>
              <Pressable onPress={handleLike} style={styles.engItem}>
                <Heart
                  size={22}
                  color={isLiked ? COLORS.error : '#6B7280'}
                  fill={isLiked ? COLORS.error : 'transparent'}
                  strokeWidth={2}
                />
                <Text style={[styles.engCount, isLiked ? { color: COLORS.error } : null]}>
                  {formatCount(likeCount)}
                </Text>
              </Pressable>

              <Pressable onPress={() => setCommentsModalVisible(true)} style={styles.engItem}>
                <MessageCircle size={22} color="#6B7280" strokeWidth={2} />
                <Text style={styles.engCount}>{formatCount(plan.comment_count)}</Text>
              </Pressable>

              <View style={styles.engItem}>
                <ChartNoAxesCombined size={22} color="#6B7280" strokeWidth={2} />
                <Text style={styles.engCount}>{formatCount(plan.view_count)}</Text>
              </View>

              <Pressable onPress={handleShare} style={styles.engItem}>
                <Send size={22} color="#6B7280" strokeWidth={2} />
              </Pressable>
            </View>

            <View style={{ height: 60 }} />
          </View>
        </Animated.ScrollView>

        {/* ─── Modals & Bottom Sheets ────────────────────────────────────── */}

        <RequestBottomSheet
          isVisible={requestSheetOpen}
          planId={plan.id}
          planTitle={plan.title}
          onClose={() => setRequestSheetOpen(false)}
          onRequested={() => {
            setPlan((p) => ({ ...p, my_request_status: 'pending' }));
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
            setPlan((p) => ({ ...p, comment_count: newCount }));
          }}
        />

        <EditPlanBottomSheet
          visible={editSheetOpen}
          onClose={() => setEditSheetOpen(false)}
          plan={plan}
          navigation={navigation}
          onPlanUpdated={(updatedPlan) => {
            setPlan((p) => ({ ...p, ...updatedPlan }));
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

        <SwipeableModal
          visible={sharedCommSheetOpen}
          onClose={() => setSharedCommSheetOpen(false)}
          sheetStyle={styles.commSheet}
          header={
            <View>
              <View style={styles.commSheetHandle} />
              <Text style={styles.commSheetTitle}>Shared Communities</Text>
            </View>
          }
        >
          <SwipeableModal.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.commSheetList}>
            {plan?.shared_communities?.map((comm) => (
              <TouchableOpacity
                key={comm.id}
                style={styles.commItem}
                onPress={() => {
                  setSharedCommSheetOpen(false);
                  navigation.navigate('CommunityPublicProfile', { communityId: comm.id, communityName: comm.name });
                }}
                activeOpacity={0.7}
              >
                <View style={styles.commAvatarContainer}>
                  {comm.logo_url ? (
                    <Image source={{ uri: comm.logo_url }} style={styles.commAvatar} cachePolicy="memory-disk" />
                  ) : (
                    <View style={styles.commAvatarFallback}>
                      <Users size={16} color="#4F46E5" />
                    </View>
                  )}
                </View>
                <View style={styles.commInfo}>
                  <Text style={styles.commName}>{comm.name}</Text>
                  <Text style={styles.commSub}>Tap to view community</Text>
                </View>
              </TouchableOpacity>
            ))}
          </SwipeableModal.ScrollView>
        </SwipeableModal>

        <ShareModal
          visible={shareModalVisible}
          onClose={() => setShareModalVisible(false)}
          post={plan}
        />

        {/* Host action menu */}
        <Modal
          transparent
          visible={hostMenuVisible}
          animationType="fade"
          onRequestClose={() => setHostMenuVisible(false)}
          statusBarTranslucent
        >
          <Pressable style={styles.hostMenuOverlay} onPress={() => setHostMenuVisible(false)} />
          <View style={styles.hostMenuSheet}>
            <View style={styles.hostMenuHandle} />
            <Text style={styles.hostMenuTitle}>Plan Options</Text>

            <View style={styles.hostMenuList}>
              {!isPastDeadline ? (
                <TouchableOpacity
                  style={styles.hostMenuRow}
                  onPress={() => {
                    setHostMenuVisible(false);
                    setEditSheetOpen(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.hostMenuIconWrap}>
                    <Pencil size={18} color={PRIMARY_COLOR} strokeWidth={2} />
                  </View>
                  <View style={styles.hostMenuRowText}>
                    <Text style={styles.hostMenuLabel}>Edit Plan</Text>
                    <Text style={styles.hostMenuSub}>Update details, time or location</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={[styles.hostMenuRow, { opacity: 0.45 }]}>
                  <View style={[styles.hostMenuIconWrap, { backgroundColor: '#F3F4F6' }]}>
                    <Pencil size={18} color="#D1D5DB" strokeWidth={2} />
                  </View>
                  <View style={styles.hostMenuRowText}>
                    <Text style={[styles.hostMenuLabel, { color: '#9CA3AF' }]}>Edit Plan</Text>
                    <Text style={styles.hostMenuSub}>Cannot edit after scheduled time</Text>
                  </View>
                </View>
              )}

              {canDelete ? (
                <TouchableOpacity
                  style={styles.hostMenuRow}
                  onPress={handleDeletePlan}
                  activeOpacity={0.7}
                >
                  <View style={[styles.hostMenuIconWrap, { backgroundColor: '#FEE2E2' }]}>
                    <Trash2 size={18} color="#EF4444" strokeWidth={2} />
                  </View>
                  <View style={styles.hostMenuRowText}>
                    <Text style={[styles.hostMenuLabel, { color: '#EF4444' }]}>Delete Plan</Text>
                    <Text style={styles.hostMenuSub}>
                      {(plan.pending_count ?? 0) > 0
                        ? `${plan.pending_count} pending request${plan.pending_count > 1 ? 's' : ''} will be notified`
                        : 'Permanently remove this plan'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}

              {showDisabledDelete ? (
                <View style={[styles.hostMenuRow, styles.hostMenuRowDisabled]}>
                  <View style={[styles.hostMenuIconWrap, { backgroundColor: '#F3F4F6' }]}>
                    <Trash2 size={18} color="#D1D5DB" strokeWidth={2} />
                  </View>
                  <View style={styles.hostMenuRowText}>
                    <Text style={[styles.hostMenuLabel, { color: '#9CA3AF' }]}>Delete Plan</Text>
                    <Text style={styles.hostMenuSub}>Cannot delete — people have joined</Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </Modal>

        <CustomConfirmDialog
          visible={deleteConfirmVisible}
          title="Delete Plan"
          message={deleteConfirmMessage}
          onCancel={() => setDeleteConfirmVisible(false)}
          onConfirm={async () => {
            setDeleteConfirmVisible(false);
            setDeleting(true);
            try {
              const token = await getAuthToken();
              await cancelPlan(plan.id, token);
              navigation.goBack();
            } catch (err) {
              const errorCode = err?.response?.data?.error || err?.error;
              if (errorCode === 'plan_has_accepted_attendees') {
                Alert.alert('Cannot Delete', 'People have already joined this plan. You can close it instead.');
              } else {
                Alert.alert('Error', err?.message || 'Could not delete plan. Please try again.');
              }
            } finally {
              setDeleting(false);
            }
          }}
        />
      </View>
    </Profiler>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 16,
    color: MUTED_TEXT,
    marginTop: 12,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 20,
  },
  retryButtonText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },

  // 🌟 Pinned Floating Header (matching EventDetailsScreen)
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Manrope-SemiBold',
    color: TEXT_COLOR,
    textAlign: 'center',
    paddingHorizontal: 80,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },

  // Hero Banner Section
  bannerContainer: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
    position: 'relative',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  bannerImage: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
  },

  // Sticky Action Section (Hero Information & Action)
  stickyActionContainer: {
    backgroundColor: CARD_BACKGROUND,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    zIndex: 20,
  },
  planTitle: {
    fontFamily: 'BasicCommercial-Bold',
    fontSize: 26,
    color: TEXT_COLOR,
    marginBottom: 16,
    lineHeight: 32,
  },
  metaRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  metaRowText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 15,
    color: MUTED_TEXT,
    marginLeft: 8,
    flex: 1,
  },
  mapLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 24,
    marginBottom: 16,
  },
  mapLinkText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 13,
    color: PRIMARY_COLOR,
    marginRight: 6,
  },
  hiddenTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  hiddenTagText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 11,
    color: '#2563EB',
  },
  lockedLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 24,
    marginBottom: 16,
  },
  lockedLocationText: {
    fontFamily: 'Manrope-Regular',
    fontSize: 12,
    color: MUTED_TEXT,
    marginLeft: 6,
  },

  // Badges
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  badgeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeChipText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 12,
  },

  // Action Container
  stickyActionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  stickyPriceContainer: {
    flexDirection: 'column',
  },
  stickyPriceLabel: {
    fontFamily: 'Manrope-Medium',
    fontSize: 13,
    color: MUTED_TEXT,
  },
  stickyPriceValue: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 20,
    color: TEXT_COLOR,
    marginTop: 2,
  },
  stickyActionButton: {
    backgroundColor: PRIMARY_COLOR,
    height: 48,
    borderRadius: 16,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    marginLeft: 20,
    flexDirection: 'row',
  },
  stickyActionButtonDisabled: {
    opacity: 0.85,
  },
  stickyActionButtonText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  pendingBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    paddingHorizontal: 6,
  },
  pendingBadgeText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 11,
    color: '#FFFFFF',
  },

  // Content Container
  contentContainer: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'BasicCommercial-Bold',
    fontSize: 18,
    color: TEXT_COLOR,
    marginBottom: 12,
  },
  description: {
    fontFamily: 'Manrope-Regular',
    fontSize: 15,
    lineHeight: 23,
    color: MUTED_TEXT,
  },
  readMore: {
    fontFamily: 'Manrope-SemiBold',
    color: PRIMARY_COLOR,
    marginTop: 6,
    fontSize: 14,
  },

  // Capacity Card
  capacityCard: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  capacityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  capacityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(41, 98, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  capacityCol: {
    flex: 1,
  },
  capacityTitle: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 15,
    color: TEXT_COLOR,
  },
  capacitySub: {
    fontFamily: 'Manrope-Regular',
    fontSize: 13,
    color: MUTED_TEXT,
    marginTop: 2,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 3,
  },

  // Shared Communities Card
  sharedCommCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  sharedCommLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sharedCommIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sharedCommText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 14,
    color: '#4F46E5',
  },

  // Host Card (Premium matching EventDetailsScreen)
  hostCardPremium: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  hostCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  hostAvatarPremium: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  hostInitials: {
    fontFamily: 'BasicCommercial-Bold',
    fontSize: 18,
    color: '#FFFFFF',
  },
  hostInfoPremium: {
    flex: 1,
  },
  hostNamePremium: {
    fontFamily: 'BasicCommercial-Bold',
    fontSize: 16,
    color: TEXT_COLOR,
  },
  hostStatsPremium: {
    fontFamily: 'Manrope-Medium',
    fontSize: 13,
    color: MUTED_TEXT,
    marginTop: 3,
  },
  hostTrustStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  activityLevelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  activityLevel_New_Member: { backgroundColor: '#F3F4F6' },
  activityLevel_Rising:     { backgroundColor: '#EFF6FF' },
  activityLevel_Active:     { backgroundColor: '#ECFDF5' },
  activityLevel_Super_Active:{ backgroundColor: '#FEF3C7' },
  activityLevelText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 11,
    color: '#374151',
  },
  interestChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  interestChipText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 11,
    color: '#4B5563',
  },
  hostCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  hostCtaText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 14,
    color: PRIMARY_COLOR,
    marginRight: 4,
  },

  // Attendees Section
  attendeesList: {
    gap: 10,
  },
  attendeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BACKGROUND,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  attendeeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  attendeeInitials: {
    fontFamily: 'BasicCommercial-Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  attendeeInfo: {
    flex: 1,
  },
  attendeeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attendeeName: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 14,
    color: TEXT_COLOR,
  },
  attendeeMetaText: {
    fontFamily: 'Manrope-Regular',
    fontSize: 12,
    color: MUTED_TEXT,
    marginTop: 2,
  },
  attendeeBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  attendeeActivityPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  attendeeActivityText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 10,
    color: '#374151',
  },
  attendeeInterestChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  attendeeInterestText: {
    fontFamily: 'Manrope-Medium',
    fontSize: 10,
    color: '#4B5563',
  },

  // Engagement Row
  engagementCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: CARD_BACKGROUND,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  engItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  engCount: {
    fontFamily: 'Manrope-Medium',
    fontSize: 13,
    color: '#6B7280',
  },

  // Shared Communities Modal Sheet
  commSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  commSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  commSheetTitle: {
    fontFamily: 'BasicCommercial-Bold',
    fontSize: 18,
    color: TEXT_COLOR,
    marginBottom: 16,
    textAlign: 'center',
  },
  commSheetList: {
    gap: 12,
    paddingBottom: 20,
  },
  commItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  commAvatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 12,
  },
  commAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  commAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commInfo: {
    flex: 1,
  },
  commName: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 14,
    color: TEXT_COLOR,
  },
  commSub: {
    fontFamily: 'Manrope-Regular',
    fontSize: 12,
    color: MUTED_TEXT,
    marginTop: 2,
  },

  // Host Action Menu Modal
  hostMenuOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  hostMenuSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  hostMenuHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  hostMenuTitle: {
    fontFamily: 'BasicCommercial-Bold',
    fontSize: 18,
    color: TEXT_COLOR,
    marginBottom: 16,
  },
  hostMenuList: {
    gap: 12,
  },
  hostMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  hostMenuRowDisabled: {
    opacity: 0.5,
  },
  hostMenuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(41, 98, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  hostMenuRowText: {
    flex: 1,
  },
  hostMenuLabel: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 15,
    color: TEXT_COLOR,
  },
  hostMenuSub: {
    fontFamily: 'Manrope-Regular',
    fontSize: 12,
    color: MUTED_TEXT,
    marginTop: 2,
  },
});
