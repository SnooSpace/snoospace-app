/**
 * Privacy API
 * Frontend API client for consent, privacy, and data transparency endpoints.
 *
 * DPDP Act compliance layer for the Audience Intelligence System.
 *
 * CRITICAL FIX — all endpoints now pass auth token explicitly.
 * Without this, apiPost/apiGet go out unauthenticated → 401 →
 * catch fires in handleToggle → UI reverts. This was the toggle bug.
 *
 * Fix C: updateConsent maps both camelCase and snake_case field names.
 * The backend expects camelCase (behavioralTracking, etc.) in req.body.
 * We normalise here so field naming drift can never cause silent failures.
 */

import { apiGet, apiPost } from "./client";
import { getAuthToken } from "./auth";

/**
 * Get current consent state for the logged-in user
 * @returns {{ success, hasConsented, consent, requiresReConsent }}
 */
export const getConsentState = async () => {
  try {
    const token = await getAuthToken();
    const response = await apiGet("/privacy/consent", 15000, token);
    return response;
  } catch (error) {
    console.error("[PrivacyAPI] getConsentState error:", error);
    return null;
  }
};

/**
 * Update consent preferences — does NOT swallow errors.
 * Callers (toggle handlers) rely on this throwing so they can revert state.
 *
 * Accepts both camelCase and snake_case field names for forward-compat.
 * Backend (POST /privacy/consent) expects camelCase: behavioralTracking, etc.
 *
 * @param {Object} consentData - Any subset of consent fields
 * @param {string} [explicitToken] - Optional pre-fetched token (avoids double fetch)
 * @returns {{ success, consent }}
 */
export const updateConsent = async (consentData, explicitToken) => {
  // No try/catch — apiPost throws a structured Error on non-2xx.
  // handleToggle in the screen catches and reverts local state on failure.
  const token = explicitToken ?? (await getAuthToken());

  // Normalise field names — accept either camelCase or snake_case
  // Backend expects camelCase keys (destructured at line 38-43 of privacyController.js)
  const payload = {};

  if (consentData.behavioralTracking !== undefined)
    payload.behavioralTracking = consentData.behavioralTracking;
  if (consentData.behavioral_tracking_consent !== undefined)
    payload.behavioralTracking = consentData.behavioral_tracking_consent;

  if (consentData.brandTargeting !== undefined)
    payload.brandTargeting = consentData.brandTargeting;
  if (consentData.brand_targeting_consent !== undefined)
    payload.brandTargeting = consentData.brand_targeting_consent;

  if (consentData.dataSharing !== undefined)
    payload.dataSharing = consentData.dataSharing;
  if (consentData.data_sharing_consent !== undefined)
    payload.dataSharing = consentData.data_sharing_consent;

  if (consentData.eventAudienceIntelligence !== undefined)
    payload.eventAudienceIntelligence = consentData.eventAudienceIntelligence;
  if (consentData.event_audience_intelligence_consent !== undefined)
    payload.eventAudienceIntelligence = consentData.event_audience_intelligence_consent;

  if (consentData.brandDataAcknowledged !== undefined)
    payload.brandDataAcknowledged = consentData.brandDataAcknowledged;
  if (consentData.brand_data_acknowledged !== undefined)
    payload.brandDataAcknowledged = consentData.brand_data_acknowledged;

  if (consentData.termsVersion !== undefined)
    payload.termsVersion = consentData.termsVersion;
  if (consentData.terms_version !== undefined)
    payload.termsVersion = consentData.terms_version;

  const response = await apiPost("/privacy/consent", payload, 15000, token);
  return response;
};

/**
 * Request deletion of all behavioral data
 * Does NOT delete account — only behavioral intelligence data
 * @returns {{ success, message, tablesCleared }}
 */
export const requestDataDeletion = async () => {
  try {
    const token = await getAuthToken();
    const response = await apiPost("/privacy/request-deletion", {}, 15000, token);
    return response;
  } catch (error) {
    console.error("[PrivacyAPI] requestDataDeletion error:", error);
    return null;
  }
};

/**
 * Get a plain-language summary of what data exists about the user (member / sponsor)
 * @returns {{ success, summary }}
 */
export const getMyDataSummary = async () => {
  try {
    const token = await getAuthToken();
    const response = await apiGet("/privacy/my-data-summary", 15000, token);
    return response;
  } catch (error) {
    console.error("[PrivacyAPI] getMyDataSummary error:", error);
    return null;
  }
};

/**
 * Get community-specific data summary for the Community Privacy Screen.
 * Returns eventsHosted, memberCount, contentPublished, topCategories,
 * healthScore, consentState, and joinedAt.
 * @returns {{ success, eventsHosted, memberCount, contentPublished, topCategories, healthScore, consentState, joinedAt }}
 */
export const getCommunityDataSummary = async () => {
  try {
    const token = await getAuthToken();
    const response = await apiGet("/privacy/community-data-summary", 15000, token);
    return response;
  } catch (error) {
    console.error("[PrivacyAPI] getCommunityDataSummary error:", error);
    return null;
  }
};
