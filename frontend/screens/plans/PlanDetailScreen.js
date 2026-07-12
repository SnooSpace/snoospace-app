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
import SwipeableModal from '../../components/modals/SwipeableModal';
import ShareModal from '../../components/ShareModal';

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
  house_party:  { bg: '#FBE9E7', text: '#D84315' },
  club:         { bg: '#EDE7F6', text: '#5E35B1' },
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
  house_party:  '🏡',
  club:         '🪩',
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
  const [sharedCommSheetOpen, setSharedCommSheetOpen] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);

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

  const handleShare = useCallback(() => {
    setShareModalVisible(true);
  }, []);

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
    house_party: 'House Party', club: 'Club',
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
                  height={240}
                />
              )}
              {/* Activity & Gender overlays — bottom-left */}
              <View style={styles.bannerOverlaysBottomLeft}>
                <View style={[styles.activityPillOverlay, { backgroundColor: activityStyle.bg }]}>
                  <Text style={[styles.activityPillText, { color: activityStyle.text }]}>
                    {`${ACTIVITY_EMOJIS[activityKey] || ACTIVITY_EMOJIS.other} ${activityLabel}`}
                  </Text>
                </View>
                {showGenderBadge && (
                  <View style={[styles.genderPillOverlay, { backgroundColor: genderBadgeStyle.bg }]}>
                    <Text style={[styles.genderPillText, { color: genderBadgeStyle.text }]}>
                      {genderBadgeStyle.label}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Main Row: Left Info Column + Right Cost Container */}
            <View style={styles.topInfoRow}>
              {/* Left Column: Title + Host details */}
              <View style={styles.leftInfoCol}>
                <Text style={styles.title} numberOfLines={2}>{plan.title}</Text>

                {/* Host row — inline with avatar */}
                <TouchableOpacity
                  style={styles.hostRowInline}
                  onPress={() => {
                    if (plan.created_by) {
                      navigation.navigate("MemberPublicProfile", { memberId: plan.created_by });
                    }
                  }}
                  activeOpacity={0.7}
                >
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
                </TouchableOpacity>
              </View>

              {/* Right Cost Column */}
              <View style={styles.costContainer}>
                <View style={[styles.costPill, { backgroundColor: costCfg.bg }]}>
                  <Text style={[styles.pillText, { color: costCfg.text }]}>{costPillLabel}</Text>
                </View>
                {priceText ? (
                  <Text style={styles.costPriceBelow}>{priceText}</Text>
                ) : null}
              </View>
            </View>

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

            {/* Redesigned Acceptance & Shared Communities Section */}
            {(() => {
              const hasShared = !isOwner && plan.shared_communities?.length > 0;
              
              if (hasShared) {
                const count = plan.shared_communities.length;
                const communityLabel = count === 1 ? '1 shared community' : `${count} shared communities`;
                
                return (
                  <View style={styles.compactAcceptanceRowSplit}>
                    <View style={styles.compactAcceptanceCardHalf}>
                      <Users size={16} color={COLORS.primary} strokeWidth={2.2} />
                      <Text style={styles.compactAcceptanceText} numberOfLines={1}>
                        <Text style={styles.compactAcceptanceBold}>{plan.accepted_count ?? 0}/{plan.max_accepted}</Text> filled
                      </Text>
                    </View>
                    
                    <TouchableOpacity
                      style={styles.compactAcceptanceCardHalf}
                      onPress={() => setSharedCommSheetOpen(true)}
                      activeOpacity={0.7}
                    >
                      <Users size={16} color="#6366F1" strokeWidth={2.2} />
                      <Text style={[styles.compactAcceptanceText, { color: '#4F46E5' }]} numberOfLines={1}>
                        {communityLabel}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              }

              // Default full-width row for host or when no shared communities exist
              return (
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
              );
            })()}

            {/* Divider */}
            <View style={styles.divider} />

            {/* Engagement row */}
            <View style={styles.engagementRow}>
              {/* Like */}
              <Pressable onPress={handleLike} style={styles.engItem}>
                <Heart
                  size={22}
                  color={isLiked ? COLORS.error : '#5e8d9b'}
                  fill={isLiked ? COLORS.error : 'transparent'}
                  strokeWidth={2}
                />
                <Text style={[styles.engCount, isLiked && { color: COLORS.error }]}>
                  {formatCount(likeCount)}
                </Text>
              </Pressable>

              {/* Comment */}
              <Pressable onPress={() => setCommentsModalVisible(true)} style={styles.engItem}>
                <MessageCircle size={22} color="#5e8d9b" strokeWidth={2} />
                <Text style={styles.engCount}>{formatCount(plan.comment_count)}</Text>
              </Pressable>

              {/* Views */}
              <View style={styles.engItem}>
                <ChartNoAxesCombined size={22} color="#5e8d9b" strokeWidth={2} />
                <Text style={styles.engCount}>{formatCount(plan.view_count)}</Text>
              </View>

              {/* Share */}
              <Pressable onPress={handleShare} style={styles.engItem}>
                <Send size={22} color="#5e8d9b" strokeWidth={2} />
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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.commSheetList}>
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
                  <Image source={{ uri: comm.logo_url }} style={styles.commAvatar} />
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
        </ScrollView>
      </SwipeableModal>

      <ShareModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        post={plan}
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
    marginBottom: 10,
    overflow: 'hidden',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    position: 'relative',
  },
  bannerImage: {
    width: CARD_WIDTH,
    height: 240,
  },
  bannerOverlaysBottomLeft: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
  },
  activityPillOverlay: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  activityPillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
  },
  genderPillOverlay: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  genderPillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
  },

  // Combined Info Row (Title + Host on left, Cost on right)
  topInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 10,
    marginBottom: 10,
    gap: 16,
  },
  leftInfoCol: {
    flex: 1,
  },
  title: {
    fontFamily: FONTS.primary,
    fontSize: 17,
    color: COLORS.textPrimary,
    lineHeight: 23,
  },
  hostRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  costContainer: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  costPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  costPriceBelow: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  hostAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: COLORS.primary,
    marginRight: 8,
  },
  hostAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 2.5,
    borderColor: COLORS.primary,
  },
  hostInitial: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.primary,
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
    marginVertical: 10,
  },

  // Meta row — time + location inline
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
    marginBottom: 8,
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
  compactAcceptanceRowSplit: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  compactAcceptanceCardHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  commSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: Dimensions.get('window').height * 0.7,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  commSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  commSheetTitle: {
    fontFamily: FONTS.primary,
    fontSize: 20,
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  commSheetList: {
    paddingBottom: 20,
  },
  commItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  commAvatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#EEF2FF',
  },
  commAvatar: {
    width: '100%',
    height: '100%',
  },
  commAvatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commInfo: {
    flex: 1,
  },
  commName: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  commSub: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
