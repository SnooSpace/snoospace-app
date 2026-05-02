/**
 * Audience Intelligence API
 * Frontend API client for audience intelligence endpoints
 */

import { apiGet, apiPost } from "./client";

/**
 * Track a follow event with intent classification
 */
export const trackFollowEvent = async ({
  followerId,
  creatorId,
  followSource = "unknown",
  sourceContentId = null,
  sourceEventId = null,
  contentConsumedDurationSeconds = null,
}) => {
  try {
    const response = await apiPost("/audience/track-follow", {
      followerId,
      creatorId,
      followSource,
      sourceContentId,
      sourceEventId,
      contentConsumedDurationSeconds,
    });
    return response;
  } catch (error) {
    console.error("[AudienceAPI] trackFollowEvent error:", error);
    return null;
  }
};

/**
 * Track user engagement with content
 */
export const trackEngagement = async ({
  userId,
  contentType,
  contentId,
  durationSeconds = 0,
  eventCategory,
  hourOfDay,
  isPaidEvent = false,
  ticketPrice = 0,
}) => {
  try {
    const response = await apiPost("/audience/track-engagement", {
      userId,
      contentType,
      contentId,
      durationSeconds,
      eventCategory,
      hourOfDay,
      isPaidEvent,
      ticketPrice,
    });
    return response;
  } catch (error) {
    console.error("[AudienceAPI] trackEngagement error:", error);
    return null;
  }
};

/**
 * Calculate AQI score for a specific user
 */
export const calculateAqi = async (userId) => {
  try {
    const response = await apiPost(`/audience/calculate-aqi/${userId}`);
    return response;
  } catch (error) {
    console.error("[AudienceAPI] calculateAqi error:", error);
    return null;
  }
};

/**
 * Get creator audience stats
 */
export const getCreatorStats = async (creatorId) => {
  try {
    const response = await apiGet(`/audience/creator-stats/${creatorId}`);
    return response;
  } catch (error) {
    console.error("[AudienceAPI] getCreatorStats error:", error);
    return null;
  }
};

/**
 * Get brand-creator matches for a campaign
 */
export const getBrandMatches = async (brandId, campaignId) => {
  try {
    const response = await apiGet(
      `/audience/brand-matches/${brandId}/${campaignId}`,
    );
    return response;
  } catch (error) {
    console.error("[AudienceAPI] getBrandMatches error:", error);
    return null;
  }
};

/**
 * Trigger creator stats recalculation
 */
export const recalculateCreatorStats = async (creatorId) => {
  try {
    const response = await apiPost(
      `/audience/calculate-creator-stats/${creatorId}`,
    );
    return response;
  } catch (error) {
    console.error("[AudienceAPI] recalculateCreatorStats error:", error);
    return null;
  }
};

// ── V2 Endpoints ──

/**
 * Get active categories on the platform (for brand filters)
 */
export const getActiveCategories = async () => {
  try {
    const response = await apiGet("/audience/active-categories");
    return response;
  } catch (error) {
    console.error("[AudienceAPI] getActiveCategories error:", error);
    return null;
  }
};

/**
 * Get a user's interest vector
 */
export const getUserInterests = async (userId) => {
  try {
    const response = await apiGet(`/audience/user-interests/${userId}`);
    return response;
  } catch (error) {
    console.error("[AudienceAPI] getUserInterests error:", error);
    return null;
  }
};

/**
 * Trigger interest vector recalculation for a user
 */
export const recalculateInterestVectors = async (userId) => {
  try {
    const response = await apiPost(`/audience/recalculate-interest-vectors/${userId}`);
    return response;
  } catch (error) {
    console.error("[AudienceAPI] recalculateInterestVectors error:", error);
    return null;
  }
};

/**
 * Trigger drift detection for a user
 */
export const detectDrift = async (userId) => {
  try {
    const response = await apiPost(`/audience/detect-drift/${userId}`);
    return response;
  } catch (error) {
    console.error("[AudienceAPI] detectDrift error:", error);
    return null;
  }
};
