import React, { useEffect, useCallback, useState, useMemo } from "react";
import * as Notifications from 'expo-notifications';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  InteractionManager,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withTiming,
  FadeInDown,
} from "react-native-reanimated";
import {
  Heart,
  MessageCircle,
  AtSign,
  Ticket,
  ChevronRight,
  ArrowLeft,
  Pencil,
  Calendar,
  Bell,
  AlertCircle,
  Banknote,
  Trash2,
  CircleX,
  Gift,
  Mail,
  Hand,
  CircleCheck,
  CheckCircle2,
  MinusCircle,
  UserPlus,
} from "lucide-react-native";
import { useNotifications } from "../../context/NotificationsContext";
import { fetchNotifications } from "../../api/notifications";
import { CATEGORIES } from "../../constants/notificationTypes";
import EventBus from "../../utils/EventBus";
import {
  getCircleStatus,
  sendCircleRequest,
  getCommunityCircleStatus,
  sendCommunityCircleInvite,
  getCreatorFollowStatus,
  followCreator,
  unfollowCreator,
  getMemberCommunityCircleStatus,
  respondToCommunityCircleInvite,
} from "../../api/members";
import { apiGet, apiPost, apiDelete } from "../../api/client";
import { getAuthToken, getActiveAccount } from "../../api/auth";
import hapticsService from "../../services/HapticsService";
import { COLORS, FONTS, SHADOWS, BORDER_RADIUS } from "../../constants/theme";

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);

// Tactile animated pressable component for premium micro-interactions
const AnimatedPressable = ({ children, onPress, style, disabled, isUnread }) => {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: withTiming(
        pressed.value
          ? "rgba(0, 0, 0, 0.05)"
          : isUnread
          ? "rgba(41, 98, 255, 0.03)"
          : COLORS.surface,
        { duration: 100 }
      ),
      borderLeftWidth: isUnread ? 4 : 0,
      borderLeftColor: COLORS.primary,
    };
  });

  const handlePressIn = () => {
    if (!disabled) {
      hapticsService.triggerImpactLight();
      pressed.value = 1;
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      pressed.value = 0;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      delayPressIn={80}
      disabled={disabled}
      style={style}
    >
      <Animated.View style={[styles.rowCardContent, animatedStyle]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

// Extracted NotificationRow component to strictly follow Rules of Hooks
const NotificationRow = ({
  group,
  index,
  section,
  sections,
  scrollY,
  overscrollBottom,
  relationshipStatuses,
  relationshipLoading,
  handleRelationshipAction,
  handleRespondToInvite,
  navigateToProfile,
  navigateToEvent,
  navigation,
}) => {
  const firstItem = group.items[0];
  const payload = firstItem.payload || {};
  const count = group.items.length;
  const isCreatorSocial =
    group.type === "creator_follow_received" ||
    (firstItem.actor_type === "community" && ["follow", "circle_request_received", "circle_request_accepted", "community_circle_invite"].includes(group.type));

  const sectionIndex = sections.findIndex((s) => s.title === section.title);
  const isFirst = sectionIndex === 0 && index === 0;
  const isLast =
    sectionIndex === sections.length - 1 &&
    index === section.data.length - 1;

  const bounceStyle = useAnimatedStyle(() => {
    let translateY = 0;
    let scaleY = 1;

    if (isFirst && scrollY.value < 0) {
      translateY = -scrollY.value * 0.35;
      scaleY = 1 + (-scrollY.value * 0.0015);
    } else if (isLast && overscrollBottom.value > 0) {
      translateY = -overscrollBottom.value * 0.35;
      scaleY = 1 + (overscrollBottom.value * 0.0015);
    }

    return {
      transform: [{ translateY }, { scaleY }],
    };
  });

  const getNotificationIconInfo = (type) => {
    switch (type) {
      case "event_registration":
        return {
          icon: <Ticket size={18} color="#34C759" strokeWidth={2} />,
          bg: "rgba(52, 199, 89, 0.1)",
        };
      case "event_updated":
        return {
          icon: <Pencil size={18} color="#FF9500" strokeWidth={2} />,
          bg: "rgba(255, 149, 0, 0.1)",
        };
      case "event_rescheduled":
        return {
          icon: <Calendar size={18} color="#FF3B30" strokeWidth={2} />,
          bg: "rgba(255, 59, 48, 0.1)",
        };
      case "event_reminder_24h":
      case "event_reminder_1h":
        return {
          icon: <Bell size={18} color="#2962FF" strokeWidth={2} />,
          bg: "rgba(41, 98, 255, 0.1)",
        };
      case "tickets_sold_out":
        return {
          icon: <AlertCircle size={18} color="#8E8E93" strokeWidth={2} />,
          bg: "rgba(142, 142, 147, 0.1)",
        };
      case "refund_processed":
        return {
          icon: <Banknote size={18} color="#34C759" strokeWidth={2} />,
          bg: "rgba(52, 199, 89, 0.1)",
        };
      case "event_deleted":
        return {
          icon: <Trash2 size={18} color="#FF3B30" strokeWidth={2} />,
          bg: "rgba(255, 59, 48, 0.1)",
        };
      case "event_cancelled":
        return {
          icon: <CircleX size={18} color="#FF9500" strokeWidth={2} />,
          bg: "rgba(255, 149, 0, 0.1)",
        };
      case "ticket_gifted":
        return {
          icon: <Gift size={18} color="#FF69B4" strokeWidth={2} />,
          bg: "rgba(255, 105, 180, 0.1)",
        };
      case "event_invite":
        return {
          icon: <Mail size={18} color="#2962FF" strokeWidth={2} />,
          bg: "rgba(41, 98, 255, 0.1)",
        };
      case "gift_revoked":
        return {
          icon: <CircleX size={18} color="#FF3B30" strokeWidth={2} />,
          bg: "rgba(255, 59, 48, 0.1)",
        };
      case "invite_request":
        return {
          icon: <Hand size={18} color="#FF9500" strokeWidth={2} />,
          bg: "rgba(255, 149, 0, 0.1)",
        };
      case "invite_approved":
        return {
          icon: <CircleCheck size={18} color="#34C759" strokeWidth={2} />,
          bg: "rgba(52, 199, 89, 0.1)",
        };
      case "invite_declined":
        return {
          icon: <MinusCircle size={18} color="#8E8E93" strokeWidth={2} />,
          bg: "rgba(142, 142, 147, 0.1)",
        };
      case "submission_approved":
        return {
          icon: <CheckCircle2 size={18} color="#34C759" strokeWidth={2} />,
          bg: "rgba(52, 199, 89, 0.1)",
        };
      case "submission_rejected":
        return {
          icon: <CircleX size={18} color="#FF3B30" strokeWidth={2} />,
          bg: "rgba(255, 59, 48, 0.1)",
        };
      case "like":
        return {
          icon: <Heart size={18} color="#FF3B30" strokeWidth={2} />,
          bg: "rgba(255, 59, 48, 0.08)",
        };
      case "comment":
        return {
          icon: <MessageCircle size={18} color="#2962FF" strokeWidth={2} />,
          bg: "rgba(41, 98, 255, 0.08)",
        };
      case "tag":
        return {
          icon: <AtSign size={18} color="#34C759" strokeWidth={2} />,
          bg: "rgba(52, 199, 89, 0.08)",
        };
      case "community_circle_invite":
      case "circle_request_received":
        return {
          icon: <UserPlus size={18} color="#2962FF" strokeWidth={2} />,
          bg: "rgba(41, 98, 255, 0.08)",
        };
      case "circle_request_accepted":
        return {
          icon: <CheckCircle2 size={18} color="#34C759" strokeWidth={2} />,
          bg: "rgba(52, 199, 89, 0.08)",
        };
      case "creator_follow_received":
        return {
          icon: <UserPlus size={18} color="#7C3AED" strokeWidth={2} />,
          bg: "rgba(124, 58, 237, 0.08)",
        };
      case "follow":
        return {
          icon: <UserPlus size={18} color="#2962FF" strokeWidth={2} />,
          bg: "rgba(41, 98, 255, 0.08)",
        };
      case "attendance_confirmation":
        return {
          icon: <CheckCircle2 size={18} color="#34C759" strokeWidth={2} />,
          bg: "rgba(52, 199, 89, 0.1)",
        };
      case "plan_request":
        return {
          icon: <UserPlus size={18} color="#2962FF" strokeWidth={2} />,
          bg: "rgba(41, 98, 255, 0.1)",
        };
      case "plan_approved":
        return {
          icon: <CheckCircle2 size={18} color="#34C759" strokeWidth={2} />,
          bg: "rgba(52, 199, 89, 0.1)",
        };
      case "plan_declined":
      case "plan_removed":
        return {
          icon: <MinusCircle size={18} color="#FF3B30" strokeWidth={2} />,
          bg: "rgba(255, 59, 48, 0.1)",
        };
      case "plan_like":
      case "challenge_submission_like":
        return {
          icon: <Heart size={18} color="#FF3B30" strokeWidth={2} />,
          bg: "rgba(255, 59, 48, 0.08)",
        };
      case "plan_comment":
      case "submission_comment":
      case "qna_question":
        return {
          icon: <MessageCircle size={18} color="#2962FF" strokeWidth={2} />,
          bg: "rgba(41, 98, 255, 0.08)",
        };
      case "qna_upvote":
        return {
          icon: <Heart size={18} color="#FF3B30" strokeWidth={2} />,
          bg: "rgba(255, 59, 48, 0.08)",
        };
      case "qna_answered":
        return {
          icon: <CheckCircle2 size={18} color="#34C759" strokeWidth={2} />,
          bg: "rgba(52, 199, 89, 0.1)",
        };
      case "removal_request":
        return {
          icon: <AlertCircle size={18} color="#FF9500" strokeWidth={2} />,
          bg: "rgba(255, 149, 0, 0.1)",
        };
      case "removal_request_review":
        return {
          icon: <CheckCircle2 size={18} color="#34C759" strokeWidth={2} />,
          bg: "rgba(52, 199, 89, 0.1)",
        };
      default:
        return {
          icon: <Bell size={18} color="#8E8E93" strokeWidth={2} />,
          bg: "rgba(142, 142, 147, 0.08)",
        };
    }
  };

  const renderLeftSection = () => {
    const iconInfo = getNotificationIconInfo(group.type);
    const hasAvatar = ["follow", "like", "comment", "tag", "event_registration", "circle_request_received", "circle_request_accepted", "creator_follow_received", "plan_like", "plan_comment", "qna_question", "qna_upvote", "qna_answered", "challenge_submission_like", "submission_comment", "removal_request", "community_circle_invite"].includes(group.type) && payload.actorAvatar;

    if (hasAvatar) {
      return (
        <View style={styles.compositeIconWrapper}>
          {/* Large Category Icon Circle (Primary Indicator) */}
          <View style={[styles.largeIconContainer, { backgroundColor: iconInfo.bg }]}>
            {iconInfo.icon}
          </View>
          {/* Tiny Actor Avatar Badge in bottom-right corner (Secondary Indicator) */}
          <Image
            source={{ uri: payload.actorAvatar }}
            style={styles.avatarBadge}
          />
        </View>
      );
    }

    // Fallback if no avatar (system events) - centered large icon
    return (
      <View style={styles.compositeIconWrapperCentered}>
        <View style={[styles.largeIconContainerCentered, { backgroundColor: iconInfo.bg }]}>
          {iconInfo.icon}
        </View>
      </View>
    );
  };

  const renderRightActionButton = () => {
    const actorId = firstItem.actor_id;
    const relStatus = relationshipStatuses[actorId];
    if (!relStatus) return null;

    const { type, status, requestId } = relStatus;
    const isLoading = !!relationshipLoading[actorId];

    let buttonText = "";
    let isButtonActive = false; // active state = gray/disabled, inactive state = blue/clickable
    let isDisabled = false;

    if (type === 'circle') {
      if (status === 'in_circle') {
        buttonText = "In Circle";
        isButtonActive = true;
        isDisabled = true;
      } else if (status === 'requested') {
        buttonText = "Requested";
        isButtonActive = true;
        isDisabled = true;
      } else {
        buttonText = "Add to Circle";
        isButtonActive = false;
        isDisabled = false;
      }
    } else if (type === 'community_circle') {
      if (status === 'in_circle') {
        buttonText = "In Circle";
        isButtonActive = true;
        isDisabled = true;
      } else if (status === 'requested') {
        buttonText = "Invited";
        isButtonActive = true;
        isDisabled = true;
      } else {
        buttonText = "Add to Circle";
        isButtonActive = false;
        isDisabled = false;
      }
    } else if (type === 'creator_follow') {
      if (status === 'in_circle') {
        buttonText = "In Circle";
        isButtonActive = true;
        isDisabled = true;
      } else if (status === 'following') {
        buttonText = "Following";
        isButtonActive = true;
        isDisabled = false;
      } else {
        buttonText = "Follow Back";
        isButtonActive = false;
        isDisabled = false;
      }
    } else if (type === 'follow') {
      if (status === 'following') {
        buttonText = "Following";
        isButtonActive = true;
        isDisabled = false;
      } else if (status === 'follow_back') {
        buttonText = "Follow Back";
        isButtonActive = false;
        isDisabled = false;
      } else {
        buttonText = "Follow";
        isButtonActive = false;
        isDisabled = false;
      }
    } else if (type === 'community_circle_invite') {
      if (status === 'in_circle') {
        buttonText = "In Circle";
        isButtonActive = true;
        isDisabled = true;
      } else if (status === 'pending_invite' && requestId) {
        return (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonInactive, { minWidth: 60 }]}
              onPress={() => handleRespondToInvite(actorId, requestId, 'accepted')}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.textInverted} />
              ) : (
                <Text style={[styles.actionButtonText, styles.actionButtonTextInactive]}>Accept</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonActive, { minWidth: 60 }]}
              onPress={() => handleRespondToInvite(actorId, requestId, 'declined')}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.textSecondary} />
              ) : (
                <Text style={[styles.actionButtonText, styles.actionButtonTextActive]}>Decline</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      } else {
        return null;
      }
    }

    if (!buttonText) return null;

    return (
      <TouchableOpacity
        style={[
          styles.actionButton,
          isButtonActive ? styles.actionButtonActive : styles.actionButtonInactive,
        ]}
        onPress={() => handleRelationshipAction(actorId, firstItem.actor_type)}
        disabled={isLoading || isDisabled}
      >
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={isButtonActive ? COLORS.textSecondary : COLORS.textInverted}
          />
        ) : (
          <Text
            style={[
              styles.actionButtonText,
              isButtonActive ? styles.actionButtonTextActive : styles.actionButtonTextInactive,
            ]}
          >
            {buttonText}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  let title = null;
  let subtitle = null;
  let isNavigable = true;
  let onPress = () => {};
  let rightComponent = null;

  // Determine custom visual and navigation properties by type
  switch (group.type) {
    case "circle_request_received":
      isNavigable = true;
      onPress = () => navigation.navigate("CircleRequests");
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.actorName || "Someone"}</Text> wants to connect with you
        </Text>
      );
      break;

    case "creator_follow_received":
      isNavigable = true;
      onPress = () => navigateToProfile(firstItem.actor_id, firstItem.actor_type);
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.actorName || "Someone"}</Text> started following your creator content
        </Text>
      );
      rightComponent = renderRightActionButton();
      break;

    case "community_circle_invite":
      isNavigable = true;
      onPress = () => navigateToProfile(firstItem.actor_id, firstItem.actor_type);
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.actorName || "Someone"}</Text> invited you to join their circle
        </Text>
      );
      rightComponent = renderRightActionButton();
      break;

    case "circle_request_accepted":
      isNavigable = true;
      onPress = () => navigateToProfile(firstItem.actor_id, firstItem.actor_type);
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.actorName || "Someone"}</Text> accepted your circle request
        </Text>
      );
      break;

    case "follow":
      isNavigable = true;
      onPress = () => navigateToProfile(firstItem.actor_id, firstItem.actor_type);
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.actorName || "Someone"}</Text> started following you
        </Text>
      );
      rightComponent = renderRightActionButton();
      break;

    case "like":
      isNavigable = true;
      onPress = () => navigateToProfile(firstItem.actor_id, firstItem.actor_type);
      const likedPostText = payload.postTitle || payload.postCaption;
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.actorName || "Someone"}</Text>{" "}
          {count > 1 
            ? `liked ${count} of your posts` 
            : likedPostText 
              ? `liked your post "${likedPostText}"` 
              : "liked your post"
          }
        </Text>
      );
      break;

    case "comment":
      isNavigable = true;
      onPress = () => navigateToProfile(firstItem.actor_id, firstItem.actor_type);
      const commentedPostText = payload.postTitle || payload.postCaption;
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.actorName || "Someone"}</Text>{" "}
          {commentedPostText 
            ? `commented: "${payload.commentText || "commented"}" on your post "${commentedPostText}"`
            : `commented: ${payload.commentText || "commented on your post"}`
          }
        </Text>
      );
      break;

    case "tag":
      isNavigable = true;
      onPress = () => navigateToProfile(firstItem.actor_id, firstItem.actor_type);
      const taggedPostText = payload.postTitle || payload.postCaption;
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.actorName || "Someone"}</Text>{" "}
          {taggedPostText
            ? `tagged you in a ${payload.commentId ? "comment" : "post"} on "${taggedPostText}"`
            : `tagged you in a ${payload.commentId ? "comment" : "post"}`
          }
        </Text>
      );
      break;

    case "event_registration":
      isNavigable = true;
      onPress = () => navigateToEvent(payload.eventId);
      const collapseAfter = payload.collapseAfter
        ? new Date(payload.collapseAfter)
        : null;
      const shouldCollapse =
        collapseAfter && new Date() > collapseAfter && count > 1;

      if (shouldCollapse) {
        title = (
          <Text style={styles.title}>
            <Text style={styles.bold}>{count} people</Text> registered for "{payload.eventTitle}"
          </Text>
        );
      } else {
        title = (
          <Text style={styles.title}>
            <Text style={styles.bold}>{payload.memberName || "Someone"}</Text> registered for "{payload.eventTitle}"
          </Text>
        );
      }
      break;

    case "event_updated":
      isNavigable = true;
      onPress = () => navigateToEvent(payload.eventId);
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.communityName}</Text> updated{" "}
          {payload.changedFields?.join(", ") || "details"} for "{payload.eventTitle}"
        </Text>
      );
      break;

    case "event_rescheduled":
      isNavigable = true;
      onPress = () => navigateToEvent(payload.eventId);
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.communityName}</Text> rescheduled "{payload.eventTitle}"
        </Text>
      );
      const newDate = payload.newStartDateTime
        ? new Date(payload.newStartDateTime).toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          })
        : "TBD";
      subtitle = `New date: ${newDate}`;
      break;

    case "event_reminder_24h":
    case "event_reminder_1h":
      isNavigable = true;
      onPress = () => navigateToEvent(payload.eventId);
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.eventTitle}</Text>{" "}
          {group.type === "event_reminder_1h" ? "starts in 1 hour!" : "is tomorrow!"}
        </Text>
      );
      if (payload.eventDate && payload.eventTime) {
        subtitle = `${payload.eventDate} at ${payload.eventTime}`;
      }
      break;

    case "tickets_sold_out":
      isNavigable = true;
      onPress = () => navigateToEvent(payload.eventId);
      title = (
        <Text style={styles.title}>
          Tickets for <Text style={styles.bold}>"{payload.eventTitle}"</Text> are now sold out
        </Text>
      );
      break;

    case "refund_processed":
      isNavigable = true;
      onPress = () => navigateToEvent(payload.eventId);
      title = (
        <Text style={styles.title}>
          Your refund of <Text style={styles.bold}>₹{payload.refundAmount?.toLocaleString("en-IN")}</Text> has been processed
        </Text>
      );
      subtitle = `For: ${payload.eventTitle}`;
      break;

    case "event_deleted":
      isNavigable = false;
      title = (
        <Text style={styles.title}>
          The event <Text style={styles.bold}>"{payload.eventTitle}"</Text> has been deleted
        </Text>
      );
      break;

    case "event_cancelled":
      isNavigable = false;
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.communityName || payload.community_name}</Text> cancelled "{payload.eventTitle || payload.event_title}"
        </Text>
      );
      break;

    case "ticket_gifted":
    case "event_invite":
      isNavigable = true;
      const hasConversation = payload.conversationId;
      onPress = () => {
        if (hasConversation) {
          navigation.navigate("Chat", { conversationId: payload.conversationId });
        } else {
          navigateToEvent(payload.eventId || firstItem.reference_id);
        }
      };
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>
            {payload.title || (group.type === "ticket_gifted" ? "🎫 You received a ticket!" : "You're Invited!")}
          </Text>
        </Text>
      );
      subtitle = payload.message;
      break;

    case "gift_revoked":
      isNavigable = false;
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.title || "Ticket Revoked"}</Text>
        </Text>
      );
      subtitle = payload.message;
      break;

    case "invite_request":
      isNavigable = true;
      onPress = () => navigateToEvent(payload.referenceId || firstItem.reference_id);
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.title || "Invite Request"}</Text>
        </Text>
      );
      subtitle = payload.message;
      break;

    case "invite_approved":
      isNavigable = true;
      onPress = () => navigateToEvent(payload.referenceId || firstItem.reference_id);
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.title || "Invite Approved!"}</Text>
        </Text>
      );
      subtitle = payload.message;
      break;

    case "invite_declined":
      isNavigable = false;
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.title || "Invite Declined"}</Text>
        </Text>
      );
      subtitle = payload.message;
      break;

    case "submission_approved":
      isNavigable = !!payload.postId;
      onPress = () => {
        if (payload.postId) {
          navigation.navigate("HomeFeed");
        }
      };
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.title || "Response approved ✅"}</Text>
        </Text>
      );
      subtitle = payload.message;
      break;

    case "submission_rejected":
      isNavigable = false;
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.title || "Response not approved"}</Text>
        </Text>
      );
      subtitle = payload.message;
      break;

    case "attendance_confirmation":
      isNavigable = true;
      onPress = () => navigateToEvent(payload.eventId);
      title = (
        <Text style={styles.title}>
          Did you attend? 🎫 Let us know if you attended <Text style={styles.bold}>"{payload.eventTitle}"</Text>
        </Text>
      );
      break;

    case "plan_request":
      isNavigable = true;
      onPress = () => navigation.navigate("PlanDetail", { planId: payload.planId });
      title = (
        <Text style={styles.title}>
          New request to join your plan: <Text style={styles.bold}>"{payload.planTitle}"</Text> from <Text style={styles.bold}>{payload.actorName || "Someone"}</Text>
        </Text>
      );
      break;

    case "plan_approved":
      isNavigable = true;
      onPress = () => {
        if (payload.conversationId) {
          navigation.navigate("Chat", { conversationId: payload.conversationId });
        } else {
          navigation.navigate("PlanDetail", { planId: payload.planId });
        }
      };
      title = (
        <Text style={styles.title}>
          Request approved! 🎉 Your request to join <Text style={styles.bold}>"{payload.planTitle}"</Text> was approved.
        </Text>
      );
      subtitle = payload.conversationId ? "Tap to chat with the host" : null;
      break;

    case "plan_declined":
      isNavigable = true;
      onPress = () => navigation.navigate("PlanDetail", { planId: payload.planId });
      title = (
        <Text style={styles.title}>
          Your request to join <Text style={styles.bold}>"{payload.planTitle}"</Text> was not accepted.
        </Text>
      );
      break;

    case "plan_removed":
      isNavigable = true;
      onPress = () => navigation.navigate("PlanDetail", { planId: payload.planId });
      title = (
        <Text style={styles.title}>
          You have been removed from the plan: <Text style={styles.bold}>"{payload.planTitle}"</Text>
        </Text>
      );
      break;

    case "plan_like":
      isNavigable = true;
      onPress = () => navigation.navigate("PlanDetail", { planId: payload.planId });
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.actorName || "Someone"}</Text> liked your plan <Text style={styles.bold}>"{payload.planTitle}"</Text>
        </Text>
      );
      break;

    case "plan_comment":
      isNavigable = true;
      onPress = () => navigation.navigate("PlanDetail", { planId: payload.planId });
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.actorName || "Someone"}</Text> commented on your plan <Text style={styles.bold}>"{payload.planTitle}"</Text>
        </Text>
      );
      subtitle = payload.commentText ? `"${payload.commentText}"` : null;
      break;

    case "qna_question":
      isNavigable = true;
      onPress = () => navigation.navigate("QnAQuestions", { postId: payload.postId });
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.actorName || "Someone"}</Text> asked: <Text style={styles.bold}>"{payload.questionText}"</Text> in your Q&A session
        </Text>
      );
      break;

    case "qna_upvote":
      isNavigable = true;
      onPress = () => navigation.navigate("QnAQuestions", { postId: payload.postId });
      title = (
        <Text style={styles.title}>
          Your question in Q&A was upvoted by <Text style={styles.bold}>{payload.actorName || "Someone"}</Text>
        </Text>
      );
      break;

    case "qna_answered":
      isNavigable = true;
      onPress = () => navigation.navigate("QnAQuestions", { postId: payload.postId });
      title = (
        <Text style={styles.title}>
          Your question was answered! 🎉 <Text style={styles.bold}>{payload.actorName || "Someone"}</Text> posted an answer.
        </Text>
      );
      break;

    case "challenge_submission_like":
      isNavigable = true;
      onPress = () => navigation.navigate("HomeFeed");
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.actorName || "Someone"}</Text> liked your challenge submission
        </Text>
      );
      break;

    case "submission_comment":
      isNavigable = true;
      onPress = () => navigation.navigate("HomeFeed");
      title = (
        <Text style={styles.title}>
          <Text style={styles.bold}>{payload.actorName || "Someone"}</Text> commented on your submission
        </Text>
      );
      subtitle = payload.commentText ? `"${payload.commentText}"` : null;
      break;

    case "removal_request":
      isNavigable = true;
      onPress = () => navigation.navigate("HomeFeed");
      title = (
        <Text style={styles.title}>
          Submission removal request from <Text style={styles.bold}>{payload.actorName || "Someone"}</Text>
        </Text>
      );
      break;

    case "removal_request_review":
      isNavigable = true;
      onPress = () => navigation.navigate("HomeFeed");
      title = (
        <Text style={styles.title}>
          {payload.title || `Your removal request was ${payload.status}`}
        </Text>
      );
      subtitle = payload.message;
      break;

  }

  // Show thumbnail on the right for likes, comments, and tags
  if (["like", "comment", "tag"].includes(group.type) && !rightComponent) {
    const postImage = payload.postImage;

    if (postImage) {
      rightComponent = (
        <Image
          source={{ uri: postImage }}
          style={styles.postThumbnail}
          resizeMode="cover"
        />
      );
    }
  }

  if (!title) {
    return null;
  }

  const isUnread = !firstItem.is_read;

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 6) * 50).duration(300)}
      style={[styles.cardContainer, bounceStyle]}
    >
      <AnimatedPressable
        onPress={onPress}
        disabled={!isNavigable}
        isUnread={isUnread}
        style={styles.rowCard}
      >
        {renderLeftSection()}
        <View style={styles.rowBody}>
          {title}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {isCreatorSocial && (
            <View style={styles.creatorBadgeContainer}>
              <Text style={styles.creatorBadgeText}>✨ Creator Connection</Text>
            </View>
          )}
          <Text style={styles.time}>
            {new Date(firstItem.created_at).toLocaleString()}
          </Text>
        </View>
        {rightComponent}
        {isNavigable && !rightComponent && (
          <ChevronRight
            size={16}
            color="#8E8E93"
            style={styles.chevron}
          />
        )}
      </AnimatedPressable>
    </Animated.View>
  );
};

export default function NotificationsScreen({ navigation }) {
  const { items, unread, categoryBreakdown, loading, loadInitial, loadMore, markAllRead } = useNotifications();
  
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [localItems, setLocalItems] = useState([]);
  const [localOffset, setLocalOffset] = useState(0);
  const [localHasMore, setLocalHasMore] = useState(true);
  const [localLoading, setLocalLoading] = useState(false);

  const loadCategoryNotifications = useCallback(async (cat, reset = false) => {
    setLocalLoading(true);
    try {
      const offset = reset ? 0 : localOffset;
      const res = await fetchNotifications({ limit: 20, offset, category: cat });
      if (reset) {
        setLocalItems(res?.notifications || []);
        setLocalOffset(res?.nextOffset || 0);
        setLocalHasMore(res?.hasMore ?? false);
      } else {
        setLocalItems(prev => [...prev, ...(res?.notifications || [])]);
        setLocalOffset(res?.nextOffset || localOffset);
        setLocalHasMore(res?.hasMore ?? false);
      }
    } catch (e) {
      console.warn("Failed to load category notifications", e);
    } finally {
      setLocalLoading(false);
    }
  }, [localOffset]);

  useEffect(() => {
    loadCategoryNotifications(selectedCategory, true);
  }, [selectedCategory]);

  // Reload category notifications when context or screen gets marked read/updated
  useEffect(() => {
    const unsubConsumed = EventBus.on('notifications-read', () => {
      loadCategoryNotifications(selectedCategory, true);
    });
    return () => unsubConsumed();
  }, [selectedCategory, loadCategoryNotifications]);

  const handleLoadMore = () => {
    if (!localLoading && localHasMore) {
      loadCategoryNotifications(selectedCategory, false);
    }
  };

  const [viewerType, setViewerType] = useState(null);
  const [viewerId, setViewerId] = useState(null);

  useEffect(() => {
    const getViewerInfo = async () => {
      try {
        const acc = await getActiveAccount();
        if (acc) {
          setViewerType(acc.type?.toLowerCase());
          setViewerId(acc.id);
        }
      } catch (err) {
        console.warn("Failed to get active account info:", err);
      }
    };
    getViewerInfo();
  }, []);

  const [relationshipStatuses, setRelationshipStatuses] = useState({});
  const [relationshipLoading, setRelationshipLoading] = useState({});

  const scrollY = useSharedValue(0);
  const overscrollBottom = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      const maxScroll = event.contentSize.height - event.layoutMeasurement.height;
      if (event.contentOffset.y > maxScroll && maxScroll > 0) {
        overscrollBottom.value = event.contentOffset.y - maxScroll;
      } else {
        overscrollBottom.value = 0;
      }
    },
  });

  // Group notifications by user and type (consecutive likes within 24h)
  const groupedNotifications = useMemo(() => {
    const TIME_WINDOW = 24 * 60 * 60 * 1000;
    const grouped = [];

    let i = 0;
    while (i < localItems.length) {
      const current = localItems[i];
      const group = {
        items: [current],
        type: current.type,
        actorId: current.actor_id,
        actorType: current.actor_type,
        latestTimestamp: current.created_at,
        payload: current.payload || {},
      };

      if (current.type === "like") {
        let j = i + 1;
        while (j < localItems.length) {
          const next = localItems[j];
          const timeDiff =
            new Date(current.created_at) - new Date(next.created_at);

          if (
            next.type === "like" &&
            next.actor_id === current.actor_id &&
            next.actor_type === current.actor_type &&
            timeDiff <= TIME_WINDOW
          ) {
            group.items.push(next);
            j++;
          } else {
            break;
          }
        }
        i = j;
      } else {
        i++;
      }

      grouped.push(group);
    }

    return grouped;
  }, [localItems]);

  // Group into chronological sections: Today, This Week, Earlier
  const sections = useMemo(() => {
    const today = [];
    const thisWeek = [];
    const earlier = [];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;

    groupedNotifications.forEach((group) => {
      const timestamp = new Date(group.latestTimestamp).getTime();
      if (timestamp >= startOfToday) {
        today.push(group);
      } else if (timestamp >= sevenDaysAgo) {
        thisWeek.push(group);
      } else {
        earlier.push(group);
      }
    });

    const result = [];
    if (today.length > 0) {
      result.push({ title: "Today", data: today });
    }
    if (thisWeek.length > 0) {
      result.push({ title: "This Week", data: thisWeek });
    }
    if (earlier.length > 0) {
      result.push({ title: "Earlier", data: earlier });
    }
    return result;
  }, [groupedNotifications]);

  const checkFollowStatus = async (followingId, followingType) => {
    const token = await getAuthToken();
    const params = new URLSearchParams();
    params.set("followingId", String(followingId));
    params.set("followingType", followingType);
    const res = await apiGet(`/follow/status?${params.toString()}`, 10000, token);
    return !!res?.isFollowing;
  };

  const toggleFollow = async (followingId, followingType, isFollowing) => {
    const token = await getAuthToken();
    if (isFollowing) {
      return apiDelete("/follow", { followingId, followingType }, 10000, token);
    } else {
      return apiPost("/follow", { followingId, followingType }, 10000, token);
    }
  };

  // Fetch follow/circle statuses for all actors involved in relationship notifications
  const loadRelationshipStatuses = useCallback(async (items, vType) => {
    if (!vType || !items || items.length === 0) return;

    // Filter unique actors from follow & creator_follow_received notifications
    const targetActors = [];
    const seen = new Set();

    items.forEach((item) => {
      if ((item.type === "follow" || item.type === "creator_follow_received" || item.type === "community_circle_invite") && item.actor_id) {
        const key = `${item.actor_id}-${item.actor_type}`;
        if (!seen.has(key)) {
          seen.add(key);
          targetActors.push({
            id: item.actor_id,
            type: item.actor_type,
            isCreator: !!item.payload?.actorIsCreator || !!item.actor_is_creator,
          });
        }
      }
    });

    if (targetActors.length === 0) return;

    // Fetch status for each target actor in parallel
    const statusPromises = targetActors.map(async (actor) => {
      try {
        let relType = 'follow';
        let relStatus = 'none';
        let requestId = null;

        if (vType === 'member') {
          if (actor.type === 'member') {
            if (actor.isCreator) {
              // Member-to-Creator: Creator Follow
              relType = 'creator_follow';
              const res = await getCreatorFollowStatus(actor.id);
              if (res?.is_in_circle) {
                relStatus = 'in_circle';
              } else if (res?.is_following) {
                relStatus = 'following';
              } else {
                relStatus = 'not_following';
              }
            } else {
              // Member-to-Member: Circle
              relType = 'circle';
              const res = await getCircleStatus(actor.id);
              if (res?.status === 'in_circle') {
                relStatus = 'in_circle';
              } else if (res?.status === 'pending_outgoing') {
                relStatus = 'requested';
                requestId = res.request_id;
              } else {
                relStatus = 'none';
              }
            }
          } else {
            // Member-to-Other (Community/Sponsor/Venue): Follow / Community Circle Invite
            if (actor.type === 'community') {
              const commCircleRes = await getMemberCommunityCircleStatus(actor.id);
              if (commCircleRes?.status === 'pending_invite') {
                relType = 'community_circle_invite';
                relStatus = 'pending_invite';
                requestId = commCircleRes.invite_id;
              } else if (commCircleRes?.status === 'in_circle') {
                relType = 'community_circle_invite';
                relStatus = 'in_circle';
              } else {
                relType = 'follow';
                const isFollowing = await checkFollowStatus(actor.id, actor.type);
                relStatus = isFollowing ? 'following' : 'not_following';
              }
            } else {
              relType = 'follow';
              const isFollowing = await checkFollowStatus(actor.id, actor.type);
              relStatus = isFollowing ? 'following' : 'not_following';
            }
          }
        } else if (vType === 'community') {
          if (actor.type === 'member') {
            // Community-to-Member: Community Circle
            relType = 'community_circle';
            const res = await getCommunityCircleStatus(actor.id);
            if (res?.status === 'in_circle') {
              relStatus = 'in_circle';
            } else if (res?.status === 'pending_outgoing') {
              relStatus = 'requested';
              requestId = res.invite_id;
            } else {
              relStatus = 'none';
            }
          } else {
            // Community-to-Other (Community/Sponsor/Venue): Follow
            relType = 'follow';
            const isFollowing = await checkFollowStatus(actor.id, actor.type);
            relStatus = isFollowing ? 'following' : 'follow_back';
          }
        }

        return { actorId: actor.id, relType, relStatus, requestId };
      } catch (err) {
        console.warn(`Failed to fetch relationship for actor ${actor.id}:`, err);
        return null;
      }
    });

    const results = await Promise.all(statusPromises);
    const newStatuses = {};
    results.forEach((res) => {
      if (res) {
        newStatuses[res.actorId] = {
          type: res.relType,
          status: res.relStatus,
          requestId: res.requestId,
        };
      }
    });

    setRelationshipStatuses((prev) => ({ ...prev, ...newStatuses }));
  }, []);

  useEffect(() => {
    if (localItems.length > 0 && viewerType) {
      const task = InteractionManager.runAfterInteractions(() => {
        loadRelationshipStatuses(localItems, viewerType);
      });
      return () => task.cancel();
    }
  }, [localItems, viewerType, loadRelationshipStatuses]);

  // Mark all read on mount and clear tray
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      markAllRead();
      Notifications.dismissAllNotificationsAsync().catch(() => {});
    });
    return () => task.cancel();
  }, [markAllRead]);

  const navigateToProfile = useCallback((actorId, actorType) => {
    if (actorType === "member") {
      navigation.navigate("MemberPublicProfile", { memberId: actorId });
    } else if (actorType === "community") {
      navigation.navigate("CommunityPublicProfile", { communityId: actorId });
    } else if (actorType === "sponsor") {
      navigation.navigate("SponsorProfile", { sponsorId: actorId });
    } else if (actorType === "venue") {
      navigation.navigate("VenueProfile", { venueId: actorId });
    }
  }, [navigation]);

  const navigateToEvent = useCallback((eventId) => {
    if (eventId) {
      navigation.navigate("EventDetails", { eventId });
    }
  }, [navigation]);

  const handleRelationshipAction = useCallback(async (actorId, actorType) => {
    const currentRel = relationshipStatuses[actorId];
    if (!currentRel || !viewerType) return;

    hapticsService.triggerImpactMedium();
    setRelationshipLoading((prev) => ({ ...prev, [actorId]: true }));

    try {
      if (currentRel.type === 'circle') {
        if (currentRel.status === 'none') {
          const res = await sendCircleRequest(actorId);
          if (res?.auto_accepted) {
            setRelationshipStatuses((prev) => ({
              ...prev,
              [actorId]: { ...currentRel, status: 'in_circle' },
            }));
          } else {
            setRelationshipStatuses((prev) => ({
              ...prev,
              [actorId]: { ...currentRel, status: 'requested', requestId: res?.request_id },
            }));
          }
        }
      } else if (currentRel.type === 'community_circle') {
        if (currentRel.status === 'none') {
          const res = await sendCommunityCircleInvite(actorId);
          setRelationshipStatuses((prev) => ({
            ...prev,
            [actorId]: { ...currentRel, status: 'requested', requestId: res?.invite_id },
          }));
        }
      } else if (currentRel.type === 'creator_follow') {
        const isFollowing = currentRel.status === 'following';
        if (isFollowing) {
          await unfollowCreator(actorId);
          setRelationshipStatuses((prev) => ({
            ...prev,
            [actorId]: { ...currentRel, status: 'not_following' },
          }));
        } else {
          await followCreator(actorId);
          setRelationshipStatuses((prev) => ({
            ...prev,
            [actorId]: { ...currentRel, status: 'following' },
          }));
        }
      } else if (currentRel.type === 'follow') {
        const isFollowing = currentRel.status === 'following';
        await toggleFollow(actorId, actorType, isFollowing);
        setRelationshipStatuses((prev) => ({
          ...prev,
          [actorId]: {
            ...currentRel,
            status: isFollowing
              ? (viewerType === 'community' && actorType !== 'member' ? 'follow_back' : 'not_following')
              : 'following'
          },
        }));
      }
    } catch (e) {
      console.warn(`Failed to perform relationship action for ${actorId}:`, e);
    } finally {
      setRelationshipLoading((prev) => ({ ...prev, [actorId]: false }));
    }
  }, [relationshipStatuses, viewerType]);

  const handleRespondToInvite = useCallback(async (actorId, inviteId, responseStatus) => {
    hapticsService.triggerImpactMedium();
    setRelationshipLoading((prev) => ({ ...prev, [actorId]: true }));
    try {
      await respondToCommunityCircleInvite(inviteId, responseStatus);
      setRelationshipStatuses((prev) => ({
        ...prev,
        [actorId]: {
          type: 'community_circle_invite',
          status: responseStatus === 'accepted' ? 'in_circle' : 'none',
          requestId: null,
        },
      }));
    } catch (e) {
      console.warn(`Failed to respond to community circle invite ${inviteId}:`, e);
    } finally {
      setRelationshipLoading((prev) => ({ ...prev, [actorId]: false }));
    }
  }, []);

  const renderItem = useCallback(({ item, index, section }) => (
    <NotificationRow
      group={item}
      index={index}
      section={section}
      sections={sections}
      scrollY={scrollY}
      overscrollBottom={overscrollBottom}
      relationshipStatuses={relationshipStatuses}
      relationshipLoading={relationshipLoading}
      handleRelationshipAction={handleRelationshipAction}
      handleRespondToInvite={handleRespondToInvite}
      navigateToProfile={navigateToProfile}
      navigateToEvent={navigateToEvent}
      navigation={navigation}
    />
  ), [sections, scrollY, overscrollBottom, relationshipStatuses, relationshipLoading, handleRelationshipAction, handleRespondToInvite, navigateToProfile, navigateToEvent, navigation]);

  const renderFooter = useCallback(() => {
    if (localLoading) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      );
    }

    if (!localHasMore && localItems.length > 0) {
      return (
        <View style={styles.caughtUpContainer}>
          <View style={styles.caughtUpIconCircle}>
            <CircleCheck size={28} color="#34C759" strokeWidth={2.2} />
          </View>
          <Text style={styles.caughtUpTitle}>You're all caught up</Text>
          <Text style={styles.caughtUpSubtitle}>
            You have seen all notifications from the past 3 weeks.
          </Text>
        </View>
      );
    }

    return null;
  }, [localLoading, localHasMore, localItems]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            hapticsService.triggerImpactLight();
            navigation.goBack();
          }}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#1D1D1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>
      {/* Category Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {CATEGORIES.map((cat) => {
            const count = categoryBreakdown[cat.id] || 0;
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.tabButton,
                  isSelected && styles.tabButtonActive,
                ]}
                onPress={() => {
                  hapticsService.triggerImpactLight();
                  setSelectedCategory(cat.id);
                }}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    isSelected && styles.tabButtonTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
                {count > 0 && !isSelected && (
                  <View style={styles.tabBadge} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <AnimatedSectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        keyExtractor={(group, index) => `group-${index}-${group.items[0]?.id}`}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.6}
        contentContainerStyle={sections.length === 0 ? { flexGrow: 1 } : null}
        stickySectionHeadersEnabled={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        ListEmptyComponent={
          !(localLoading || loading) ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {selectedCategory === "messages" 
                  ? "No message notifications\nDirect messages are managed in your Inbox." 
                  : "No notifications"
                }
              </Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          )
        }
        ListFooterComponent={renderFooter}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontFamily: "BasicCommercial-Black",
    color: COLORS.textPrimary,
  },
  sectionHeaderContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: "#F9FAFB",
  },
  sectionHeaderText: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 13,
    color: COLORS.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  cardContainer: {
    width: "100%",
  },
  rowCard: {
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
  },
  rowCardContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  compositeIconWrapper: {
    width: 44,
    height: 44,
    position: "relative",
    marginRight: 16,
  },
  largeIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    top: 0,
    left: 0,
  },
  avatarBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    position: "absolute",
    bottom: 0,
    right: 0,
    borderWidth: 1.5,
    borderColor: COLORS.surface,
  },
  compositeIconWrapperCentered: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  largeIconContainerCentered: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: {
    flex: 1,
  },
  title: {
    color: COLORS.textPrimary,
    fontFamily: "Manrope-Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  bold: {
    fontFamily: "Manrope-SemiBold",
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
    fontFamily: "Manrope-Regular",
  },
  time: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 4,
    fontFamily: "Manrope-Regular",
  },
  chevron: {
    marginLeft: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.s,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
    minWidth: 85,
    height: 30,
  },
  actionButtonInactive: {
    backgroundColor: COLORS.primary,
  },
  actionButtonActive: {
    backgroundColor: "#E5E5EA",
  },
  actionButtonText: {
    fontSize: 11,
    fontFamily: "Manrope-SemiBold",
  },
  actionButtonTextInactive: {
    color: COLORS.textInverted,
  },
  actionButtonTextActive: {
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 100,
    backgroundColor: COLORS.surface,
  },
  emptyText: {
    fontFamily: "Manrope-Regular",
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  postThumbnail: {
    width: 36,
    height: 36,
    borderRadius: 4,
    marginLeft: 8,
    backgroundColor: "#F2F2F7",
  },
  postTextPreviewContainer: {
    width: 44,
    height: 36,
    borderRadius: 4,
    padding: 3,
    backgroundColor: "#F2F2F7",
    marginLeft: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  postTextPreview: {
    fontSize: 9,
    fontFamily: "Manrope-Regular",
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
    backgroundColor: COLORS.surface,
  },
  tabsContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
    flexDirection: "row",
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: COLORS.primary,
  },
  tabButtonText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  tabButtonTextActive: {
    color: COLORS.textInverted,
  },
  tabBadge: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FF3B30",
    marginLeft: 6,
  },
  creatorBadgeContainer: {
    backgroundColor: "rgba(124, 58, 237, 0.08)",
    borderColor: "rgba(124, 58, 237, 0.16)",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: "flex-start",
    marginTop: 4,
    marginBottom: 2,
  },
  creatorBadgeText: {
    fontFamily: "Manrope-SemiBold",
    fontSize: 10,
    color: "#7C3AED",
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
  },
  caughtUpContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    paddingHorizontal: 24,
    marginTop: 16,
    marginBottom: 24,
  },
  caughtUpIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(52, 199, 89, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  caughtUpTitle: {
    fontFamily: "BasicCommercial-Bold",
    fontSize: 16,
    color: "#1D1D1F",
    marginBottom: 4,
  },
  caughtUpSubtitle: {
    fontFamily: "Manrope-Regular",
    fontSize: 13,
    color: "#8E8E93",
    textAlign: "center",
    maxWidth: 260,
  },
});
