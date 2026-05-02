/**
 * Privacy API
 * Frontend API client for consent, privacy, and data transparency endpoints.
 *
 * DPDP Act compliance layer for the Audience Intelligence System.
 */

import { apiGet, apiPost } from "./client";

/**
 * Get current consent state for the logged-in user
 * @returns {{ success, hasConsented, consent, requiresReConsent }}
 */
export const getConsentState = async () => {
  try {
    const response = await apiGet("/privacy/consent");
    return response;
  } catch (error) {
    console.error("[PrivacyAPI] getConsentState error:", error);
    return null;
  }
};

/**
 * Update consent preferences
 * @param {{ behavioralTracking?: boolean, brandTargeting?: boolean, dataSharing?: boolean }} consentPayload
 * @returns {{ success, consent }}
 */
export const updateConsent = async (consentPayload) => {
  try {
    const response = await apiPost("/privacy/consent", consentPayload);
    return response;
  } catch (error) {
    console.error("[PrivacyAPI] updateConsent error:", error);
    return null;
  }
};

/**
 * Request deletion of all behavioral data
 * Does NOT delete account — only behavioral intelligence data
 * @returns {{ success, message, tablesCleared }}
 */
export const requestDataDeletion = async () => {
  try {
    const response = await apiPost("/privacy/request-deletion", {});
    return response;
  } catch (error) {
    console.error("[PrivacyAPI] requestDataDeletion error:", error);
    return null;
  }
};

/**
 * Get a plain-language summary of what data exists about the user
 * @returns {{ success, summary }}
 */
export const getMyDataSummary = async () => {
  try {
    const response = await apiGet("/privacy/my-data-summary");
    return response;
  } catch (error) {
    console.error("[PrivacyAPI] getMyDataSummary error:", error);
    return null;
  }
};
