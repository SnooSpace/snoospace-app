/**
 * OpenPlanCard — Premium event discovery card for Open Plans feed.
 *
 * Layout (360–380px total):
 *   ┌──────────────────────────────────────┐  borderRadius: 20
 *   │                                      │
 *   │     Hero Illustration (240px)        │
 *   │                  [👥 14 / 20]        │  ← top-right overlay
 *   │  [🏀 Sports]                         │  ← bottom-left pill
 *   │                                      │
 *   ├──────────────────────────────────────┤
 *   │  Saturday Football Match             │  BasicCommercialBold 16px
 *   │  📍 Cubbon Park                      │  Manrope Medium 13px
 *   │  🗓 Sat • 6:00 PM         ₹199       │  Manrope Medium 13px (inline)
 *   │  Hosted by Aarav Singh               │  Manrope Regular 12px (muted)
 *   ├──────────────────────────────────────┤  hairline divider
 *   │  ♡ 24    💬 8    📊 132    ➤         │  engagement row
 *   └──────────────────────────────────────┘
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  Dimensions, Share, Animated, Alert, Pressable, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable as GHPressable } from 'react-native-gesture-handler';
import { GradientHeart } from '../ui/GradientHeart';
import {
  Users, User, Check, MapPin, Calendar, Heart, MessageCircle,
  ChartNoAxesCombined, Send, Bookmark, Megaphone, MoreHorizontal, Pencil, Trash2,
} from 'lucide-react-native';
import { COLORS, FONTS, SHADOWS } from '../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import CommentsModal from '../CommentsModal';
import ContentActionsSheet from '../ContentActionsSheet';
import HapticsService from '../../services/HapticsService';
import { recordView, togglePlanInterest, cancelPlan } from '../../api/plans';
import { getAuthToken } from '../../api/auth';
import SwipeableModal from '../modals/SwipeableModal';
import { getPlanPromoteState } from '../../utils/promoteUtils';
import CustomConfirmDialog from '../ui/CustomConfirmDialog';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;  // 16px padding each side

// ─── Activity Illustration Assets ──────────────────────────────────────────

const ACTIVITY_IMAGES = {
  sports:       require('../../assets/Sports.webp'),
  bar:          require('../../assets/Bar.webp'),
  food:         require('../../assets/Food.webp'),
  cafe:         require('../../assets/Cafe.webp'),
  yoga:         require('../../assets/Yoga.webp'),
  gym:          require('../../assets/Gym.webp'),
  walk:         require('../../assets/walk.webp'),
  rides:        require('../../assets/ride.webp'),
  live_music:   require('../../assets/Music.webp'),
  study:        require('../../assets/Co-work_Study.webp'),
  creative:     require('../../assets/Creative.webp'),
  games:        require('../../assets/Gaming.webp'),
  gaming:       require('../../assets/Gaming.webp'),
  hangout:      require('../../assets/Hangout.webp'),
  pet_friendly: require('../../assets/Pet_Friendly.webp'),
  movies:       require('../../assets/Movie.webp'),
  other:        require('../../assets/Other.webp'),
  house_party:  require('../../assets/HouseParty.webp'),
  club:         require('../../assets/Party.webp'),
  hiking:       require('../../assets/Hiking.webp'),
  shopping:     require('../../assets/Shopping.webp'),
};

// ─── Activity colour palette (muted, instantly recognisable) ─────────────────

const PILL_COLORS = {
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
  house_party:  { bg: '#FBE9E7', text: '#D84315' },
  club:         { bg: '#EDE7F6', text: '#5E35B1' },
  hiking:       { bg: '#E8F5E9', text: '#2E7D32' },
  shopping:     { bg: '#FCE4EC', text: '#D81B60' },
  other:        { bg: '#F5F5F5', text: '#424242' },
};

const ACTIVITY_LABELS = {
  sports:       'Sports',
  movies:       'Movies',
  bar:          'Bar',
  food:         'Food',
  cafe:         'Cafe',
  yoga:         'Yoga',
  gym:          'Gym',
  walk:         'Walk',
  rides:        'Rides',
  live_music:   'Live Music',
  study:        'Study / Co-work',
  creative:     'Creative',
  games:        'Games',
  gaming:       'Games',
  pet_friendly: 'Pet Friendly',
  hangout:      'Hangout',
  house_party:  'House Party',
  club:         'Club',
  hiking:       'Hiking',
  shopping:     'Shopping',
  other:        null,  // falls back to custom_activity_label
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
  house_party:  '🏡',
  club:         '🪩',
  hiking:       '🥾',
  shopping:     '🛍️',
  other:        '＋',
};

// ─── Cost helpers ─────────────────────────────────────────────────────────────

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

// ─── Date formatter ───────────────────────────────────────────────────────────

function formatScheduled(iso) {
  const d   = new Date(iso);
  const now = new Date();
  const today    = now.toDateString();
  const tomorrow = new Date(now.getTime() + 86400000).toDateString();
  const time = d.toLocaleTimeString('en-IN', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  if (d.toDateString() === today)    return `Today • ${time}`;
  if (d.toDateString() === tomorrow) return `Tomorrow • ${time}`;
  const dayPart = d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${dayPart} • ${time}`;
}

// ─── Count formatter ──────────────────────────────────────────────────────────

function fmt(n) {
  const v = Number(n) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

// ─── CropImage ────────────────────────────────────────────────────────────────

/**
 * Renders the default banner image for the activity,
 * scaled to fill containerW × height exactly.
 */
function CropImage({ activityType, containerW, height = 240 }) {
  const H = height;
  const imageSource = ACTIVITY_IMAGES[activityType];

  if (!imageSource) {
    // Return a clean premium neutral placeholder background for missing assets
    return (
      <View style={{ width: containerW, height: H, backgroundColor: '#F1F5F9' }} />
    );
  }

  return (
    <View style={{ width: containerW, height: H, overflow: 'hidden' }}>
      <Image
        source={imageSource}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
      />
    </View>
  );
}

// ─── OpenPlanCard ─────────────────────────────────────────────────────────────

const OpenPlanCard = ({
  plan,
  currentUserId,
  onPress,
  onRequestPress,
  onLike,
  onShare,
  onComment,
  isInterested: isInterestedProp = false,
  onInterest,
  onPromote,
  onDelete,
  navigation: navProp,
  compact = false,
}) => {
  const insets = useSafeAreaInsets();
  const navHook = useNavigation();
  const navigation = navProp || navHook;

  // Cache auth token
  const tokenRef = useRef(null);
  useEffect(() => {
    getAuthToken().then((t) => {
      tokenRef.current = t;
    });
  }, []);

  // Engagement state
  const [isLiked,       setIsLiked]       = useState(Boolean(plan?.is_liked));
  const [likeCount,     setLikeCount]     = useState(plan?.like_count ?? 0);
  const [isLiking,      setIsLiking]      = useState(false);
  const [commentCount,  setCommentCount]  = useState(plan?.comment_count ?? 0);
  const [viewCount]                       = useState(plan?.view_count ?? 0);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [isSaved,       setIsSaved]       = useState(isInterestedProp);
  const [isSaving,      setIsSaving]      = useState(false);
  const [hostMenuVisible, setHostMenuVisible] = useState(false);
  const [deletingCard,  setDeletingCard]  = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteConfirmMessage, setDeleteConfirmMessage] = useState('');

  // Layout width for CropImage
  const [cardW, setCardW] = useState(compact ? (SCREEN_WIDTH - 48) / 2 : CARD_WIDTH);

  // ── Derived plan fields ──────────────────────────────────────────────────

  const activityKey   = plan?.activity_type || 'other';
  const pillColors    = PILL_COLORS[activityKey]  || PILL_COLORS.other;
  const activityLabel =
    activityKey === 'other'
      ? (plan?.custom_activity_label || 'Other')
      : (ACTIVITY_LABELS[activityKey] || activityKey);

  const hostName = plan?.host_profile?.name
    || plan?.host_name
    || plan?.creator_name
    || 'the host';
  const hostPhoto = plan?.host_profile?.profile_photo_url
    || plan?.host_photo
    || plan?.host_avatar
    || plan?.creator_photo_url
    || null;
  const costLabel   = getCostLabel(plan);
  const acceptedN   = plan?.accepted_count   ?? 0;
  const maxAccepted = plan?.max_accepted      ?? 0;
  const spotsLeft   = maxAccepted - acceptedN;
  const isFull      = spotsLeft <= 0;
  const scheduledAt = plan?.scheduled_at;
  let location = plan?.location_public;
  if (location && location.toLowerCase() === 'current location') {
    location = 'Location TBD';
    if (plan?.location_private) {
      try {
        const parsed = JSON.parse(plan.location_private);
        location = parsed.short_address || parsed.city || parsed.address || 'Location TBD';
        if (location.toLowerCase() === 'current location') {
          location = 'Location TBD';
        }
      } catch {}
    }
  }

  const isOwner   = currentUserId != null && String(plan?.created_by) === String(currentUserId);
  const reqStatus = plan?.my_request_status ?? plan?.request_status ?? null;

  const scheduledTime = plan?.scheduled_at ? new Date(plan.scheduled_at).getTime() : 0;
  const nowTime = Date.now();
  const threeHours = 3 * 60 * 60 * 1000;

  let statusChip = null;
  if (plan?.status === 'cancelled') {
    statusChip = { label: 'Cancelled', bg: '#FFEBEE', text: '#C62828' };
  } else if (plan?.status === 'completed' || (scheduledTime && nowTime > scheduledTime + threeHours)) {
    statusChip = { label: 'Past', bg: '#F5F5F5', text: '#616161' };
  } else if (scheduledTime && nowTime >= scheduledTime && nowTime <= scheduledTime + threeHours) {
    statusChip = { label: 'Live', bg: '#E8F5E9', text: '#2E7D32' };
  } else {
    statusChip = { label: 'Upcoming', bg: '#E3F2FD', text: '#1565C0' };
  }

  // Host action menu derived values
  const isPastDeadlineCard = scheduledTime && nowTime > scheduledTime;
  // Allow deleting plans of all statuses (including cancelled) as long as no one was accepted.
  const canDeleteCard = (plan?.accepted_count ?? 0) === 0;
  const showDisabledDeleteCard = !canDeleteCard && (plan?.accepted_count ?? 0) > 0;

  // ── Like handler ─────────────────────────────────────────────────────────

  const handleLike = useCallback(async () => {
    if (isLiking) return;
    HapticsService.triggerLike();
    const nextLiked = !isLiked;
    const nextCount = Math.max(0, likeCount + (nextLiked ? 1 : -1));
    setIsLiked(nextLiked);
    setLikeCount(nextCount);
    setIsLiking(true);
    try {
      await onLike?.(plan.id, nextLiked);
    } catch {
      setIsLiked(!nextLiked);
      setLikeCount(likeCount);
    } finally {
      setIsLiking(false);
    }
  }, [isLiking, isLiked, likeCount, plan?.id, onLike]);

  // ── Share handler ────────────────────────────────────────────────────────

  const handleShare = useCallback(async () => {
    HapticsService.triggerShare();
    if (onShare) {
      onShare(plan);
    } else {
      try {
        await Share.share({
          message: `Check out this open plan "${plan?.title || 'Open Plan'}" on SnooSpace!`,
        });
      } catch (_) {}
    }
  }, [onShare, plan]);

  // ── Comment handler ──────────────────────────────────────────────────────

  const handleComment = useCallback(() => {
    HapticsService.triggerComment();
    if (onComment) {
      onComment(plan?.id);
    } else {
      setCommentsVisible(true);
    }
  }, [onComment, plan?.id]);

  // ── Bookmark / Interest handler ──────────────────────────────────────────

  const handleInterest = useCallback(async () => {
    if (isSaving) return;
    HapticsService.triggerSave();
    const next = !isSaved;
    setIsSaved(next);
    setIsSaving(true);
    try {
      if (onInterest) {
        await onInterest(plan?.id, next);
      } else {
        const token = tokenRef.current || (await getAuthToken());
        await togglePlanInterest(plan?.id, token);
      }
    } catch {
      setIsSaved(!next); // revert
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, isSaved, plan?.id, onInterest]);

  // ── Request button config ────────────────────────────────────────────────

  const REQUEST_BTNS = {
    null:      { label: 'Request to join',     bg: COLORS.primary, color: '#FFF',   disabled: false },
    pending:   { label: 'Pending…',            bg: '#F5F5F5',       color: '#9CA3AF', disabled: true },
    approved:  { label: "You're in!",          bg: '#E8F5E9',       color: '#2E7D32', disabled: true },
    declined:  { label: 'Request declined',    bg: '#F5F5F5',       color: '#9CA3AF', disabled: true },
    withdrawn: { label: 'Request to join',     bg: COLORS.primary, color: '#FFF',   disabled: false },
  };
  const btnCfg = REQUEST_BTNS[reqStatus] || REQUEST_BTNS['null'];

  // ── Spots pill ────────────────────────────────────────────────────────────

  const spotsText = isFull
    ? 'Full'
    : spotsLeft === 1
      ? '1 spot left!'
      : null;
  const lastTapRef = useRef(0);
  const timerRef = useRef(null);
  const cardRef = useRef(null);

  const heartScale = useRef(new Animated.Value(0)).current;
  const [heartPos, setHeartPos] = useState({ x: 0, y: 0 });
  const [heartRot, setHeartRot] = useState(0);
  const [showHeart, setShowHeart] = useState(false);

  const triggerHeartAnimation = (x, y) => {
    setHeartPos({ x, y });
    setHeartRot(Math.random() * 30 - 15);
    setShowHeart(true);
    heartScale.setValue(0);
    
    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 1.2,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(heartScale, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(heartScale, {
        toValue: 1.05,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(heartScale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.delay(800),
      Animated.timing(heartScale, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowHeart(false);
    });
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Sync engagement state when parent passes updated plan prop (e.g. after commenting/liking)
  useEffect(() => {
    if (plan?.is_liked !== undefined) setIsLiked(Boolean(plan.is_liked));
  }, [plan?.is_liked]);

  useEffect(() => {
    if (plan?.like_count !== undefined) setLikeCount(plan.like_count);
  }, [plan?.like_count]);

  useEffect(() => {
    if (plan?.comment_count !== undefined) setCommentCount(plan.comment_count);
  }, [plan?.comment_count]);

  // ── Card press: navigate + record view ──────────────────────────────────

  const handleCardPress = useCallback((event) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const { pageX, pageY } = event.nativeEvent;
      cardRef.current?.measure((x, y, width, height, cardPageX, cardPageY) => {
        const relativeX = pageX - cardPageX;
        const relativeY = pageY - cardPageY;
        triggerHeartAnimation(relativeX, relativeY);
      });
      if (!isLiked) {
        handleLike();
      } else {
        HapticsService.triggerImpactLight();
      }
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(async () => {
        timerRef.current = null;
        onPress?.(plan?.id);
        // Fire-and-forget view recording
        try {
          const token = await getAuthToken();
          await recordView(plan.id, token);
        } catch (_) {}
      }, 250);
    }
    lastTapRef.current = now;
  }, [onPress, plan?.id, isLiked, handleLike]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <TouchableOpacity
      ref={cardRef}
      style={styles.card}
      activeOpacity={0.95}
      onPress={handleCardPress}
      onLayout={(e) => setCardW(e.nativeEvent.layout.width)}
    >
      {/* ── Hero Illustration ─────────────────────────────────────────── */}
      <View style={[styles.heroContainer, compact && { height: 110 }]}>
        <CropImage activityType={activityKey} containerW={cardW} height={compact ? 110 : 240} />

        {/* Top Left Row (Attendee count overlay) */}
        <View style={[styles.topLeftRow, compact && { top: 8, left: 8 }]}>
          <View style={[styles.attendeeBubble, compact && { paddingHorizontal: 6, paddingVertical: 3 }]}>
            <Users size={compact ? 10 : 12} color="#FFF" strokeWidth={2.2} />
            <Text style={[styles.attendeeText, compact && { fontSize: 10 }]}>
              {acceptedN} / {maxAccepted}
            </Text>
          </View>
        </View>

        {/* Top Right Row (Status Chip + Report/Owner Button overlay) */}
        <View style={[styles.topRightRow, compact && { top: 8, right: 8 }]}>
          {statusChip && (
            <View style={[styles.statusChipBubble, { backgroundColor: statusChip.bg }, compact && { paddingHorizontal: 8, paddingVertical: 3 }]}>
              <Text style={[styles.statusChipText, { color: statusChip.text }, compact && { fontSize: 10 }]}>
                {statusChip.label}
              </Text>
            </View>
          )}

          {/* Owner: 3-dot menu button */}
          {isOwner ? (
            <TouchableOpacity
              style={[styles.reportBubble, compact && { width: 26, height: 26, borderRadius: 13 }]}
              onPress={(e) => { e.stopPropagation(); setHostMenuVisible(true); }}
              activeOpacity={0.8}
              hitSlop={8}
            >
              <MoreHorizontal size={compact ? 14 : 18} color="#1E293B" strokeWidth={2} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.reportBubble, compact && { width: 26, height: 26, borderRadius: 13 }]}>
              <ContentActionsSheet
                type="open_plan"
                targetId={plan?.id}
                targetName={hostName}
                label="Open Plan"
                iconColor="#1E293B"
                iconSize={compact ? 14 : 20}
              />
            </View>
          )}
        </View>

        {/* Activity pill overlay — bottom-left */}
        <View style={[styles.activityPill, { backgroundColor: pillColors.bg }, compact && { bottom: 8, left: 8, paddingHorizontal: 8, paddingVertical: 4 }]}>
          <Text style={[styles.activityPillText, { color: pillColors.text }, compact && { fontSize: 10 }]}>
            {`${ACTIVITY_EMOJIS[activityKey] || ACTIVITY_EMOJIS.other} ${activityLabel}`}
          </Text>
        </View>

        {/* Spots-full / spots-left warning — bottom-right */}
        {spotsText && (
          <View style={[styles.spotsBubble, isFull && styles.spotsBubbleFull, compact && { bottom: 8, right: 8, paddingHorizontal: 8, paddingVertical: 4 }]}>
            <Text style={[styles.spotsText, compact && { fontSize: 9 }]}>{spotsText}</Text>
          </View>
        )}
      </View>

      {/* ── Content area ─────────────────────────────────────────────── */}
      <View style={[styles.content, compact && { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 2 }]}>

        {/* Title */}
        <Text style={[styles.title, compact && { fontSize: 15, lineHeight: 20, marginBottom: 4 }]} numberOfLines={compact ? 1 : 2}>{plan?.title}</Text>

        {/* Location row */}
        {location ? (
          <View style={[styles.metaRow, compact && { marginBottom: 3 }]}>
            <MapPin size={compact ? 12 : 13} color={COLORS.textSecondary} strokeWidth={2} />
            <Text style={[styles.metaText, compact && { fontSize: 12 }]} numberOfLines={1}>{location}</Text>
          </View>
        ) : null}

        {/* Date + cost row (inline) */}
        <View style={[styles.dateRow, compact && { marginBottom: 3 }]}>
          <View style={styles.dateLeft}>
            <Calendar size={compact ? 12 : 13} color={COLORS.textSecondary} strokeWidth={2} />
            <Text style={[styles.metaText, compact && { fontSize: 12 }]}>
              {scheduledAt ? formatScheduled(scheduledAt) : '—'}
            </Text>
          </View>
          {costLabel ? (
            <Text style={[styles.costText, compact && { fontSize: 13 }]}>{costLabel}</Text>
          ) : null}
        </View>

        {/* Host row */}
        <TouchableOpacity
          style={[styles.hostRow, compact && { marginBottom: 6 }]}
          onPress={(e) => {
            e.stopPropagation();
            if (plan?.created_by) {
              navigation.navigate("MemberPublicProfile", { memberId: plan.created_by });
            }
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.hostAvatarContainer, compact && { width: 24, height: 24, borderRadius: 12 }]}>
            {hostPhoto ? (
              <Image source={{ uri: hostPhoto }} style={styles.hostAvatar} />
            ) : (
              <View style={styles.hostAvatarFallback}>
                <User size={compact ? 12 : 16} color={COLORS.textSecondary} strokeWidth={2.2} />
              </View>
            )}
          </View>
          <Text style={[styles.hostText, compact && { fontSize: 12 }]}>
            Hosted by <Text style={[styles.hostName, compact && { fontSize: 12 }]}>{hostName}</Text>
          </Text>
        </TouchableOpacity>

        {/* Engagement divider */}
        <View style={[styles.divider, compact && { marginBottom: 6 }]} />

        {/* Engagement row */}
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
          }}
          style={[styles.engRow, compact && { marginBottom: 6 }]}
        >
          {/* Like */}
          <TouchableOpacity style={[styles.engBtn, compact && { minWidth: 28, minHeight: 28 }]} onPress={handleLike} disabled={isLiking}>
            <Heart
              size={20}
              color={isLiked ? COLORS.error : '#5e8d9b'}
              fill={isLiked ? COLORS.error : 'transparent'}
              strokeWidth={2}
            />
            <Text style={[styles.engCount, isLiked && { color: COLORS.error }]}>
              {fmt(likeCount)}
            </Text>
          </TouchableOpacity>

          {/* Comment */}
          <TouchableOpacity style={[styles.engBtn, compact && { minWidth: 28, minHeight: 28 }]} onPress={handleComment}>
            <MessageCircle size={20} color="#5e8d9b" strokeWidth={2} />
            <Text style={styles.engCount}>{fmt(commentCount)}</Text>
          </TouchableOpacity>

          {/* Views */}
          <TouchableOpacity
            style={[styles.engBtn, compact && { minWidth: 28, minHeight: 28 }]}
            onPress={() => HapticsService.triggerView()}
          >
            <ChartNoAxesCombined size={20} color="#5e8d9b" strokeWidth={2} />
            <Text style={styles.engCount}>{fmt(viewCount)}</Text>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity style={[styles.engBtn, compact && { minWidth: 28, minHeight: 28 }]} onPress={handleShare}>
            <Send size={20} color="#5e8d9b" strokeWidth={2} />
          </TouchableOpacity>

          {/* Promote — only for owner, hidden once past the 2-hour cutoff */}
          {isOwner && onPromote && (() => {
            const { canPromote } = getPlanPromoteState(plan);
            if (!canPromote) return null;
            return (
              <TouchableOpacity
                style={[
                  styles.engBtn,
                  compact && { minWidth: 28, minHeight: 28 },
                ]}
                onPress={() => {
                  HapticsService.triggerImpactLight();
                  onPromote(plan);
                }}
              >
                <Megaphone
                  size={20}
                  color='#7C3AED'
                  strokeWidth={2}
                />
              </TouchableOpacity>
            );
          })()}
        </Pressable>

        {/* Request / Owner section */}
        {!isOwner && (
          <View style={[styles.actionSection, compact && { marginBottom: 2 }]}>
            <TouchableOpacity
              style={[
                styles.requestBtn,
                { backgroundColor: btnCfg.bg },
                btnCfg.disabled && styles.requestBtnDisabled,
                compact && { height: 36, borderRadius: 10, marginBottom: 4 }
              ]}
              onPress={() => !btnCfg.disabled && onRequestPress?.(plan?.id)}
              disabled={btnCfg.disabled}
              activeOpacity={btnCfg.disabled ? 1 : 0.85}
            >
              {reqStatus === 'approved' ? (
                <View style={styles.approvedBtnContent}>
                  <View style={[styles.CircleCheck, compact && { width: 16, height: 16, borderRadius: 8 }]}>
                    <Check size={compact ? 8 : 10} color="#FFF" strokeWidth={3} />
                  </View>
                  <Text style={[styles.requestBtnText, { color: btnCfg.color }, compact && { fontSize: 13 }]}>
                    {btnCfg.label}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.requestBtnText, { color: btnCfg.color }, compact && { fontSize: 13 }]}>
                  {btnCfg.label}
                </Text>
              )}
            </TouchableOpacity>
            <Text style={[styles.finePrint, compact && { fontSize: 10 }]}>
              Exact location shared only after host approves
            </Text>
          </View>
        )}
      </View>

      {showHeart && (
        <Animated.View
          style={{
            position: 'absolute',
            top: heartPos.y - 75,
            left: heartPos.x - 75,
            transform: [
              { scale: heartScale },
              { rotate: `${heartRot}deg` }
            ],
            opacity: heartScale.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1],
            }),
            zIndex: 9999,
          }}
          pointerEvents="none"
        >
          <GradientHeart />
        </Animated.View>
      )}
      {/* CommentsModal — plan comments (no threaded replies) */}
      <CommentsModal
        visible={commentsVisible}
        postId={plan?.id}
        baseRoute="/plans"
        onCommentCountChange={(n) => setCommentCount(n)}
        onClose={() => setCommentsVisible(false)}
        navigation={navigation}
      />

      {/* Host action menu — plain Modal to avoid overflow:hidden clipping */}
      {isOwner && (
        <Modal
          transparent
          visible={hostMenuVisible}
          animationType="fade"
          onRequestClose={() => setHostMenuVisible(false)}
          statusBarTranslucent
        >
          {/* Backdrop */}
          <Pressable
            style={styles.hostMenuOverlay}
            onPress={() => setHostMenuVisible(false)}
          />

          {/* Sheet container */}
          <View
            style={[styles.hostMenuSheet, { paddingBottom: Math.max(36, insets.bottom + 20) }]}
          >
            {/* Handle */}
            <View style={styles.hostMenuHandle} />
            <Text style={styles.hostMenuTitle}>Plan Options</Text>

            <View style={styles.hostMenuList}>
              {/* Edit Plan */}
              {!isPastDeadlineCard ? (
                <TouchableOpacity
                  style={styles.hostMenuRow}
                  onPress={() => {
                    setHostMenuVisible(false);
                    navigation.navigate('PlanDetail', { planId: plan?.id });
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.hostMenuIconWrap}>
                    <Pencil size={18} color={COLORS.primary} strokeWidth={2} />
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
                    <Text style={styles.hostMenuSub}>Cannot edit — plan time has passed</Text>
                  </View>
                </View>
              )}

              {/* Delete Plan */}
              {canDeleteCard ? (
                <TouchableOpacity
                  style={[styles.hostMenuRow, { opacity: deletingCard ? 0.5 : 1 }]}
                  onPress={() => {
                    const pendingCount = plan?.pending_count ?? 0;
                    const msg = pendingCount > 0
                      ? `${pendingCount} pending request${pendingCount > 1 ? 's' : ''} will be notified that the plan was removed. This cannot be undone.`
                      : 'This plan will be permanently deleted. This cannot be undone.';
                    setDeleteConfirmMessage(msg);
                    setDeleteConfirmVisible(true);
                    setHostMenuVisible(false);
                  }}
                  activeOpacity={0.7}
                  disabled={deletingCard}
                >
                  <View style={[styles.hostMenuIconWrap, { backgroundColor: '#FEF2F2' }]}>
                    <Trash2 size={18} color="#EF4444" strokeWidth={2} />
                  </View>
                  <View style={styles.hostMenuRowText}>
                    <Text style={[styles.hostMenuLabel, { color: '#DC2626' }]}>Delete Plan</Text>
                    <Text style={styles.hostMenuSub}>
                      {(plan?.pending_count ?? 0) > 0
                        ? `${plan.pending_count} pending request${plan.pending_count > 1 ? 's' : ''} will be notified`
                        : 'Permanently remove this plan'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : showDisabledDeleteCard ? (
                <View style={[styles.hostMenuRow, { opacity: 0.45 }]}>
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
      )}

      <CustomConfirmDialog
        visible={deleteConfirmVisible}
        title="Delete Plan"
        message={deleteConfirmMessage}
        onCancel={() => setDeleteConfirmVisible(false)}
        onConfirm={async () => {
          setDeleteConfirmVisible(false);
          setDeletingCard(true);
          try {
            const token = await getAuthToken();
            await cancelPlan(plan?.id, token);
            if (onDelete) onDelete(plan?.id);
          } catch (err) {
            const code = err?.response?.data?.error || err?.error;
            if (code === 'plan_has_accepted_attendees') {
              Alert.alert('Cannot Delete', 'People have already joined this plan.');
            } else {
              Alert.alert('Error', err?.message || 'Could not delete plan.');
            }
          } finally {
            setDeletingCard(false);
          }
        }}
      />
    </TouchableOpacity>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    ...SHADOWS.md,
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroContainer: {
    width: '100%',
    height: 240,
    position: 'relative',
  },

  topLeftRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
  },

  topRightRow: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
  },
  attendeeBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(26, 45, 74, 0.78)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusChipBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
  },
  reportBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendeeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#FFF',
  },

  activityPill: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  activityPillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    letterSpacing: 0.2,
  },

  spotsBubble: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  spotsBubbleFull: {
    backgroundColor: '#FFEBEE',
  },
  spotsText: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: '#B71C1C',
  },

  // ── Content ───────────────────────────────────────────────────────────────
  content: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },

  title: {
    fontFamily: FONTS.primary,
    fontSize: 18,
    color: COLORS.textPrimary,
    lineHeight: 24,
    marginBottom: 8,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 5,
  },
  metaText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },

  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
    gap: 8,
  },
  dateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  costText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },

  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  hostAvatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: COLORS.primary,
    overflow: 'hidden',
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hostAvatar: {
    width: '100%',
    height: '100%',
  },
  hostAvatarFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hostText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  hostName: {
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
  },

  // ── Divider ───────────────────────────────────────────────────────────────
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginBottom: 10,
  },

  // ── Engagement row ────────────────────────────────────────────────────────
  engRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 12,
  },
  engBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    gap: 5,
  },
  engCount: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: '#9CA3AF',
  },

  // ── Action section ────────────────────────────────────────────────────────
  actionSection: {
    marginBottom: 8,
  },
  requestBtn: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  requestBtnDisabled: {
    opacity: 0.8,
  },
  requestBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
  },
  approvedBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  CircleCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2E7D32', // matches approved text color
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerBadge: {
    height: 38,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ownerBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.primary,
  },
  finePrint: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },

  // ── Host action menu ─────────────────────────────────────────────────────
  hostMenuOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  hostMenuSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  hostMenuHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  hostMenuTitle: {
    fontFamily: FONTS.primary,
    fontSize: 18,
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  hostMenuList: {
    gap: 8,
    paddingBottom: 8,
  },
  hostMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  hostMenuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostMenuRowText: {
    flex: 1,
  },
  hostMenuLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  hostMenuSub: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});

export default React.memo(OpenPlanCard);
