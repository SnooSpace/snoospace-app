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
  Dimensions, Share, Animated,
} from 'react-native';
import { GradientHeart } from '../ui/GradientHeart';
import {
  Users, User, Check, MapPin, Calendar, Heart, MessageCircle,
  ChartNoAxesCombined, Send, Bookmark,
} from 'lucide-react-native';
import { COLORS, FONTS, SHADOWS } from '../../constants/theme';
import { useNavigation } from '@react-navigation/native';
import CommentsModal from '../CommentsModal';
import HapticsService from '../../services/HapticsService';
import { recordView, togglePlanInterest } from '../../api/plans';
import { getAuthToken } from '../../api/auth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;  // 16px padding each side

// ─── Master illustration asset ──────────────────────────────────────────────

const MASTER_IMAGE = require('../../assets/Open_Plans.webp');
const MASTER_SIZE  = 1254; // pixel width & height of the source image

/**
 * Crop map: each entry is { left, top, right, bottom } in source-image pixels.
 * These were verified visually against the 1254×1254 illustration.
 */
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
  gaming:       { l: 130, t: 440, r: 470,  b: 690 },  // alias for gaming key
  pet_friendly: { l: 140, t: 680, r: 490,  b: 900 },
  hangout:      { l: 450, t: 570, r: 790,  b: 790 },
  // fallback / other
  other:        { l: 300, t: 350, r: 660,  b: 570 },
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
 * Renders the master illustration cropped to a given bounding box,
 * scaled to fill containerW × 240px exactly (cover-fill semantics).
 */
function CropImage({ activityType, containerW }) {
  const box   = CROP_MAP[activityType] || CROP_MAP.other;
  const boxW  = box.r - box.l;
  const boxH  = box.b - box.t;
  const H     = 240;

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
  isInterested: isInterestedProp = false,
  onInterest,
  navigation: navProp,
}) => {
  const navHook = useNavigation();
  const navigation = navProp || navHook;

  // Engagement state
  const [isLiked,       setIsLiked]       = useState(Boolean(plan?.is_liked));
  const [likeCount,     setLikeCount]     = useState(plan?.like_count ?? 0);
  const [isLiking,      setIsLiking]      = useState(false);
  const [commentCount,  setCommentCount]  = useState(plan?.comment_count ?? 0);
  const [viewCount]                       = useState(plan?.view_count ?? 0);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [isSaved,       setIsSaved]       = useState(isInterestedProp);
  const [isSaving,      setIsSaving]      = useState(false);

  // Layout width for CropImage
  const [cardW, setCardW] = useState(CARD_WIDTH);

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
  const location    = plan?.location_public;

  const isOwner   = currentUserId && (plan?.created_by === currentUserId || plan?.created_by === String(currentUserId));
  const reqStatus = plan?.my_request_status ?? plan?.request_status ?? null;

  // ── Like handler ─────────────────────────────────────────────────────────

  const handleLike = useCallback(async () => {
    if (isLiking) return;
    HapticsService.triggerImpactLight();
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
    HapticsService.triggerImpactLight();
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
    HapticsService.triggerImpactLight();
    setCommentsVisible(true);
  }, []);

  // ── Bookmark / Interest handler ──────────────────────────────────────────

  const handleInterest = useCallback(async () => {
    if (isSaving) return;
    HapticsService.triggerImpactLight();
    const next = !isSaved;
    setIsSaved(next);
    setIsSaving(true);
    try {
      if (onInterest) {
        await onInterest(plan?.id, next);
      } else {
        const token = await getAuthToken();
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
      <View style={styles.heroContainer}>
        <CropImage activityType={activityKey} containerW={cardW} />

        {/* Attendee count overlay — top-right */}
        <View style={styles.attendeeBubble}>
          <Users size={12} color="#FFF" strokeWidth={2.2} />
          <Text style={styles.attendeeText}>
            {acceptedN} / {maxAccepted}
          </Text>
        </View>

        {/* Activity pill overlay — bottom-left */}
        <View style={[styles.activityPill, { backgroundColor: pillColors.bg }]}>
          <Text style={[styles.activityPillText, { color: pillColors.text }]}>
            {`${ACTIVITY_EMOJIS[activityKey] || ACTIVITY_EMOJIS.other} ${activityLabel}`}
          </Text>
        </View>

        {/* Spots-full / spots-left warning — bottom-right */}
        {spotsText && (
          <View style={[styles.spotsBubble, isFull && styles.spotsBubbleFull]}>
            <Text style={styles.spotsText}>{spotsText}</Text>
          </View>
        )}
      </View>

      {/* ── Content area ─────────────────────────────────────────────── */}
      <View style={styles.content}>

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>{plan?.title}</Text>

        {/* Location row */}
        {location ? (
          <View style={styles.metaRow}>
            <MapPin size={13} color={COLORS.textSecondary} strokeWidth={2} />
            <Text style={styles.metaText} numberOfLines={1}>{location}</Text>
          </View>
        ) : null}

        {/* Date + cost row (inline) */}
        <View style={styles.dateRow}>
          <View style={styles.dateLeft}>
            <Calendar size={13} color={COLORS.textSecondary} strokeWidth={2} />
            <Text style={styles.metaText}>
              {scheduledAt ? formatScheduled(scheduledAt) : '—'}
            </Text>
          </View>
          {costLabel ? (
            <Text style={styles.costText}>{costLabel}</Text>
          ) : null}
        </View>

        {/* Host row */}
        <View style={styles.hostRow}>
          <View style={styles.hostAvatarContainer}>
            {hostPhoto ? (
              <Image source={{ uri: hostPhoto }} style={styles.hostAvatar} />
            ) : (
              <View style={styles.hostAvatarFallback}>
                <User size={16} color={COLORS.textSecondary} strokeWidth={2.2} />
              </View>
            )}
          </View>
          <Text style={styles.hostText}>
            Hosted by <Text style={styles.hostName}>{hostName}</Text>
          </Text>
        </View>

        {/* Engagement divider */}
        <View style={styles.divider} />

        {/* Engagement row */}
        <View style={styles.engRow}>
          {/* Like */}
          <TouchableOpacity style={styles.engBtn} onPress={handleLike} disabled={isLiking}>
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
          <TouchableOpacity style={styles.engBtn} onPress={handleComment}>
            <MessageCircle size={20} color="#5e8d9b" strokeWidth={2} />
            <Text style={styles.engCount}>{fmt(commentCount)}</Text>
          </TouchableOpacity>

          {/* Views */}
          <View style={styles.engBtn}>
            <ChartNoAxesCombined size={20} color="#5e8d9b" strokeWidth={2} />
            <Text style={styles.engCount}>{fmt(viewCount)}</Text>
          </View>

          {/* Bookmark/Save */}
          <TouchableOpacity style={styles.engBtn} onPress={handleInterest} disabled={isSaving}>
            <Bookmark
              size={20}
              color={isSaved ? COLORS.primary : '#5e8d9b'}
              fill={isSaved ? COLORS.primary : 'transparent'}
              strokeWidth={2}
            />
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity style={styles.engBtn} onPress={handleShare}>
            <Send size={20} color="#5e8d9b" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Request / Owner section */}
        <View style={styles.actionSection}>
          {isOwner ? (
            <TouchableOpacity
              style={styles.ownerBadge}
              onPress={() => navigation.navigate('HostRequests', { planId: plan?.id, planTitle: plan?.title })}
              activeOpacity={0.82}
            >
              <Text style={styles.ownerBadgeText}>Your plan →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.requestBtn,
                { backgroundColor: btnCfg.bg },
                btnCfg.disabled && styles.requestBtnDisabled,
              ]}
              onPress={() => !btnCfg.disabled && onRequestPress?.(plan?.id)}
              disabled={btnCfg.disabled}
              activeOpacity={btnCfg.disabled ? 1 : 0.85}
            >
              {reqStatus === 'approved' ? (
                <View style={styles.approvedBtnContent}>
                  <View style={styles.checkCircle}>
                    <Check size={10} color="#FFF" strokeWidth={3} />
                  </View>
                  <Text style={[styles.requestBtnText, { color: btnCfg.color }]}>
                    {btnCfg.label}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.requestBtnText, { color: btnCfg.color }]}>
                  {btnCfg.label}
                </Text>
              )}
            </TouchableOpacity>
          )}
          <Text style={styles.finePrint}>
            Exact location shared only after host approves
          </Text>
        </View>
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

  attendeeBubble: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(26, 45, 74, 0.78)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
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
  checkCircle: {
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
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});

export default OpenPlanCard;
