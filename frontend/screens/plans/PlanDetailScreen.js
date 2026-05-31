import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, TextInput, FlatList, Alert, KeyboardAvoidingView,
  Platform, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, BadgeCheck, MapPin, Clock, Users,
  Lock, MessageCircle, Send,
} from 'lucide-react-native';
import { COLORS, FONTS, SPACING, SHADOWS, BORDER_RADIUS } from '../../constants/theme';
import { getAuthToken } from '../../api/auth';
import {
  getPlanById, recordView, getComments, addComment,
  deleteComment, likePlan, unlikePlan,
} from '../../api/plans';
import PlanEngagementRow from '../../components/plans/PlanEngagementRow';
import RequestBottomSheet from './RequestBottomSheet';
import SnooLoader from '../../components/ui/SnooLoader';

const ACTIVITY_COLORS = {
  sports: { bg: '#EEF2FF', text: '#3B5BDB' },
  study:  { bg: '#E8F5E9', text: '#2E7D32' },
  food:   { bg: '#FFF8E1', text: '#B45309' },
  gaming: { bg: '#FCE4EC', text: '#C2185B' },
  other:  { bg: '#F5F5F5', text: '#555555' },
};

const REQUEST_BUTTON = {
  null:      { label: 'Request to join',     bg: '#2962FF', textColor: '#FFFFFF', disabled: false },
  pending:   { label: 'Requested · Pending', bg: '#F5F5F5', textColor: '#6B7280', disabled: true  },
  approved:  { label: "Approved — You're in!", bg: '#E8F5E9', textColor: '#2E7D32', disabled: true },
  declined:  { label: 'Request declined',    bg: '#F5F5F5', textColor: '#9E9E9E', disabled: true  },
  withdrawn: { label: 'Request to join',     bg: '#2962FF', textColor: '#FFFFFF', disabled: false },
};

function formatScheduled(iso) {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === new Date(now.getTime() + 86400000).toDateString()) return `Tomorrow, ${time}`;
  return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) + ` · ${time}`;
}

function formatCommentTime(iso) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function PlanDetailScreen({ navigation, route }) {
  const { planId, openComments } = route.params;
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [requestSheetOpen, setRequestSheetOpen] = useState(openComments || false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const commentInputRef = useRef(null);

  const loadPlan = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const { authToken, userId } = await import('../../api/auth').then(m => m.getActiveAccount?.() || {});
      const [data, commentsData] = await Promise.all([
        getPlanById(planId, token),
        getComments(planId, token),
      ]);
      setPlan(data.plan);
      setLikeCount(data.plan.like_count ?? 0);
      setComments(commentsData.comments || []);
      // Fire and forget view
      recordView(planId, token).catch(() => {});
    } catch (err) {
      console.error('[PlanDetailScreen]', err.message);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => { loadPlan(); }, [loadPlan]);
  useEffect(() => {
    if (openComments) {
      setTimeout(() => commentInputRef.current?.focus(), 600);
    }
  }, [openComments]);

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

  const handleSendComment = async () => {
    if (!commentInput.trim()) return;
    setSendingComment(true);
    try {
      const token = await getAuthToken();
      const data = await addComment(planId, commentInput.trim(), token);
      setComments(prev => [...prev, data.comment]);
      setCommentInput('');
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not post comment');
    } finally {
      setSendingComment(false);
    }
  };

  const handleDeleteComment = useCallback(async (cmtId) => {
    Alert.alert('Delete comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getAuthToken();
            await deleteComment(planId, cmtId, token);
            setComments(prev => prev.map(c =>
              c.id === cmtId ? { ...c, is_deleted: true, content: null } : c
            ));
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  }, [planId]);

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

  const activityKey = plan.activity_type in ACTIVITY_COLORS ? plan.activity_type : 'other';
  const activityStyle = ACTIVITY_COLORS[activityKey];
  const activityLabel = plan.activity_type === 'other'
    ? (plan.custom_activity_label || 'Other')
    : plan.activity_type.charAt(0).toUpperCase() + plan.activity_type.slice(1);

  const isOwner = plan.created_by === currentUserId;
  const isApproved = plan.my_request_status === 'approved';
  const showPrivateLocation = isOwner || isApproved;

  const reqStatus = plan.my_request_status;
  const btnCfg = REQUEST_BUTTON[reqStatus] || REQUEST_BUTTON['null'];
  const progress = Math.min(1, (plan.accepted_count ?? 0) / (plan.max_accepted || 1));

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <ArrowLeft size={24} color={COLORS.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>Open Plan</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Activity + title */}
          <View style={styles.topRow}>
            <View style={[styles.pill, { backgroundColor: activityStyle.bg }]}>
              <Text style={[styles.pillText, { color: activityStyle.text }]}>{activityLabel}</Text>
            </View>
            {plan.gender_preference && plan.gender_preference !== 'all' && (
              <View style={[styles.pill, {
                backgroundColor: plan.gender_preference === 'Female' ? '#FCE4EC' : '#E3F2FD',
                marginLeft: 6,
              }]}>
                <Text style={[styles.pillText, {
                  color: plan.gender_preference === 'Female' ? '#C2185B' : '#1565C0',
                }]}>
                  {plan.gender_preference === 'Female' ? 'Women only' : 'Men only'}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.title}>{plan.title}</Text>

          {/* Host */}
          <View style={styles.hostRow}>
            <View style={styles.hostAvatar}>
              <Text style={styles.hostInitial}>
                {(plan.host_profile?.name || '?')[0].toUpperCase()}
              </Text>
            </View>
            <View>
              <View style={styles.hostNameRow}>
                <Text style={styles.hostName}>{plan.host_profile?.name}</Text>
                {plan.host_profile?.is_verified && (
                  <BadgeCheck size={15} color="#2962FF" strokeWidth={2} />
                )}
              </View>
              {plan.shared_communities?.length > 0 && (
                <Text style={styles.sharedComm}>
                  Shared: {plan.shared_communities.map(c => c.name).join(', ')}
                </Text>
              )}
            </View>
          </View>

          {/* Info */}
          <View style={styles.infoBlock}>
            <View style={styles.infoItem}>
              <Clock size={15} color={COLORS.textSecondary} strokeWidth={1.8} />
              <Text style={styles.infoText}>{formatScheduled(plan.scheduled_at)}</Text>
            </View>
            {plan.location_public ? (
              <View style={styles.infoItem}>
                <MapPin size={15} color={COLORS.textSecondary} strokeWidth={1.8} />
                <Text style={styles.infoText}>{plan.location_public}</Text>
              </View>
            ) : null}
          </View>

          {/* Private location revealed */}
          {showPrivateLocation && plan.location_private ? (
            <View style={styles.privateLocationBox}>
              <Lock size={14} color="#2962FF" strokeWidth={2} />
              <Text style={styles.privateLocationText}>{plan.location_private}</Text>
            </View>
          ) : null}

          {/* Acceptance */}
          <View style={styles.acceptanceSection}>
            <View style={styles.acceptanceRow}>
              <Text style={styles.acceptanceLabel}>
                <Text style={styles.acceptanceBold}>{plan.accepted_count ?? 0} / {plan.max_accepted}</Text> accepted
              </Text>
              {isOwner && plan.pending_count > 0 && (
                <Text style={styles.pendingText}>{plan.pending_count} pending</Text>
              )}
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          </View>

          {/* Host manage button */}
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

          {/* Engagement */}
          <View style={styles.engagementWrapper}>
            <PlanEngagementRow
              viewCount={plan.view_count}
              likeCount={likeCount}
              commentCount={comments.length}
              isLiked={isLiked}
              onLike={handleLike}
              onComment={() => commentInputRef.current?.focus()}
              onShare={() => {}}
            />
          </View>

          {/* Request button */}
          {!isOwner && (
            <TouchableOpacity
              style={[styles.requestBtn, { backgroundColor: btnCfg.bg }, btnCfg.disabled && { opacity: 0.85 }]}
              onPress={() => !btnCfg.disabled && setRequestSheetOpen(true)}
              disabled={btnCfg.disabled}
            >
              <Text style={[styles.requestBtnText, { color: btnCfg.textColor }]}>{btnCfg.label}</Text>
            </TouchableOpacity>
          )}

          {/* Comments */}
          <Text style={styles.commentsHeader}>Comments</Text>
          {comments.map(comment => (
            <Pressable
              key={comment.id}
              onLongPress={() => {
                if (!comment.is_deleted) handleDeleteComment(comment.id);
              }}
              style={styles.commentRow}
            >
              <View style={styles.commentAvatar}>
                <Text style={styles.commentAvatarText}>
                  {(comment.commenter_name || '?')[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.commentBody}>
                <View style={styles.commentNameRow}>
                  <Text style={styles.commentName}>{comment.commenter_name}</Text>
                  <Text style={styles.commentTime}>{formatCommentTime(comment.created_at)}</Text>
                </View>
                {comment.is_deleted
                  ? <Text style={styles.commentDeleted}>[Comment removed]</Text>
                  : <Text style={styles.commentText}>{comment.content}</Text>}
              </View>
            </Pressable>
          ))}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Comment input bar */}
        <View style={styles.commentBar}>
          <TextInput
            ref={commentInputRef}
            style={styles.commentInput}
            placeholder="Write a comment…"
            placeholderTextColor={COLORS.textMuted}
            value={commentInput}
            onChangeText={setCommentInput}
            returnKeyType="send"
            onSubmitEditing={handleSendComment}
          />
          <TouchableOpacity
            onPress={handleSendComment}
            disabled={!commentInput.trim() || sendingComment}
            style={styles.sendBtn}
          >
            {sendingComment
              ? <ActivityIndicator size="small" color={COLORS.primary} />
              : <Send size={20} color={commentInput.trim() ? COLORS.primary : COLORS.textMuted} strokeWidth={2} />}
          </TouchableOpacity>
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
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBackground },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.screenBackground },
  errorText: { fontFamily: FONTS.regular, fontSize: 16, color: COLORS.textSecondary },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 12 },
  retryText: { fontFamily: FONTS.semiBold, fontSize: 14, color: '#FFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontFamily: FONTS.semiBold, fontSize: 17, color: COLORS.textPrimary, flex: 1, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontFamily: FONTS.medium, fontSize: 12 },
  title: { fontFamily: FONTS.primary, fontSize: 22, color: COLORS.textPrimary, lineHeight: 30, marginBottom: 14 },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  hostAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center',
  },
  hostInitial: { fontFamily: FONTS.primary, fontSize: 16, color: '#2962FF' },
  hostNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hostName: { fontFamily: FONTS.semiBold, fontSize: 15, color: COLORS.textPrimary },
  sharedComm: { fontFamily: FONTS.regular, fontSize: 12, color: '#2962FF', marginTop: 2 },
  infoBlock: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 14,
    gap: 8, marginBottom: 12, ...SHADOWS.md, shadowOpacity: 0.04,
  },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontFamily: FONTS.medium, fontSize: 14, color: COLORS.textSecondary },
  privateLocationBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EEF2FF', borderRadius: 12, padding: 12, marginBottom: 12,
  },
  privateLocationText: { fontFamily: FONTS.semiBold, fontSize: 14, color: '#2962FF' },
  acceptanceSection: { marginBottom: 16 },
  acceptanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  acceptanceLabel: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textSecondary },
  acceptanceBold: { fontFamily: FONTS.semiBold, color: COLORS.textPrimary },
  pendingText: { fontFamily: FONTS.medium, fontSize: 13, color: '#E65100' },
  progressTrack: { height: 6, backgroundColor: '#EEF2FF', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },
  manageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 12,
    paddingHorizontal: 16, marginBottom: 16,
  },
  manageBtnText: { fontFamily: FONTS.semiBold, fontSize: 15, color: '#FFF', flex: 1 },
  manageBadge: {
    backgroundColor: '#FFF', width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  manageBadgeText: { fontFamily: FONTS.semiBold, fontSize: 12, color: COLORS.primary },
  engagementWrapper: {
    paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, marginBottom: 16,
  },
  requestBtn: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  requestBtnText: { fontFamily: FONTS.semiBold, fontSize: 16 },
  commentsHeader: { fontFamily: FONTS.primary, fontSize: 18, color: COLORS.textPrimary, marginBottom: 14 },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  commentAvatar: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#F0F4FF',
    alignItems: 'center', justifyContent: 'center',
  },
  commentAvatarText: { fontFamily: FONTS.semiBold, fontSize: 13, color: COLORS.primary },
  commentBody: { flex: 1 },
  commentNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  commentName: { fontFamily: FONTS.semiBold, fontSize: 14, color: COLORS.textPrimary },
  commentTime: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.textMuted },
  commentText: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },
  commentDeleted: { fontFamily: FONTS.regular, fontSize: 14, color: COLORS.textMuted, fontStyle: 'italic' },
  commentBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border, backgroundColor: COLORS.surface,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10, gap: 10,
  },
  commentInput: {
    flex: 1, height: 40, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 20, paddingHorizontal: 14, fontFamily: FONTS.regular,
    fontSize: 14, color: COLORS.textPrimary, backgroundColor: '#F9FAFB',
  },
  sendBtn: { padding: 6 },
});
