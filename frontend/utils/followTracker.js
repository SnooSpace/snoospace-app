/**
 * Follow Tracker Utility
 *
 * Determines follow intent (why a user followed a creator) based on
 * the current navigation state and last content interaction, then
 * fires the tracking call to the audience intelligence API.
 */

import { trackFollowEvent } from "../api/audienceIntelligence";

/**
 * Classify the follow intent based on current navigation context.
 *
 * @param {object} navigationState - Current React Navigation state
 *   { routeName: string, params: object }
 * @param {object|null} lastContentInteraction - Last content the user engaged with
 *   { type: 'post'|'video'|'event', contentId: number, eventId: number, durationSeconds: number }
 * @returns {{ followSource: string, sourceContentId: number|null, sourceEventId: number|null, contentConsumedDurationSeconds: number|null }}
 */
export const classifyFollowIntent = (
  navigationState,
  lastContentInteraction,
) => {
  const routeName = navigationState?.routeName || navigationState?.name || "";
  const params = navigationState?.params || {};

  // If user is currently viewing a specific post
  if (
    routeName === "PostDetail" ||
    routeName === "PostView" ||
    routeName === "HomeFeed"
  ) {
    if (lastContentInteraction?.type === "video") {
      return {
        followSource: "content_video",
        sourceContentId: lastContentInteraction.contentId || null,
        sourceEventId: null,
        contentConsumedDurationSeconds:
          lastContentInteraction.durationSeconds || null,
      };
    }
    if (lastContentInteraction?.type === "post") {
      return {
        followSource: "content_post",
        sourceContentId: lastContentInteraction.contentId || null,
        sourceEventId: null,
        contentConsumedDurationSeconds:
          lastContentInteraction.durationSeconds || null,
      };
    }
  }

  // If user just attended an event and is on a creator's post-event profile
  if (
    routeName === "EventDetails" ||
    routeName === "EventAttendees" ||
    routeName === "EventRecap"
  ) {
    return {
      followSource: "event_attendance",
      sourceContentId: null,
      sourceEventId: params?.eventId || lastContentInteraction?.eventId || null,
      contentConsumedDurationSeconds: null,
    };
  }

  // If user is viewing an event recap post
  if (lastContentInteraction?.type === "event") {
    return {
      followSource: "event_recap",
      sourceContentId: null,
      sourceEventId: lastContentInteraction.eventId || null,
      contentConsumedDurationSeconds: null,
    };
  }

  // If user came from search results
  if (
    routeName === "SearchResults" ||
    routeName === "Search" ||
    routeName === "DiscoverFeed" ||
    routeName === "GlobalSearch"
  ) {
    return {
      followSource: "search_discovery",
      sourceContentId: null,
      sourceEventId: null,
      contentConsumedDurationSeconds: null,
    };
  }

  // If user is viewing a public profile (direct profile visit)
  if (
    routeName === "MemberPublicProfile" ||
    routeName === "CommunityPublicProfile" ||
    routeName === "SponsorPublicProfile" ||
    routeName === "CommunityProfile"
  ) {
    // Check if they came from a social referral (shared link or friend's profile)
    if (params?.fromShare || params?.referredBy) {
      return {
        followSource: "social_referral",
        sourceContentId: null,
        sourceEventId: null,
        contentConsumedDurationSeconds: null,
      };
    }

    return {
      followSource: "profile_visit",
      sourceContentId: null,
      sourceEventId: null,
      contentConsumedDurationSeconds: null,
    };
  }

  // Default
  return {
    followSource: "unknown",
    sourceContentId: null,
    sourceEventId: null,
    contentConsumedDurationSeconds: null,
  };
};

/**
 * Track a follow action with intent classification.
 * Call this wherever a follow action is triggered.
 *
 * @param {number} followerId - ID of the user who followed
 * @param {number} creatorId - ID of the creator/community being followed
 * @param {object} navigationContext - { navigationState, lastContentInteraction }
 */
export const trackFollow = async (followerId, creatorId, navigationContext) => {
  try {
    const { navigationState, lastContentInteraction } =
      navigationContext || {};

    const intent = classifyFollowIntent(
      navigationState,
      lastContentInteraction,
    );

    // Fire and forget — don't block the UI
    trackFollowEvent({
      followerId,
      creatorId,
      followSource: intent.followSource,
      sourceContentId: intent.sourceContentId,
      sourceEventId: intent.sourceEventId,
      contentConsumedDurationSeconds: intent.contentConsumedDurationSeconds,
    });
  } catch (error) {
    // Non-fatal — never block the follow action
    console.error("[FollowTracker] trackFollow error:", error);
  }
};
