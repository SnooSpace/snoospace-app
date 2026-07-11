/**
 * sparks.js  —  Frontend API client for the Sparks system
 *
 * All functions follow the same pattern as members.js:
 *   - Obtain auth token via getAuthToken()
 *   - Call apiGet / apiPost / apiDelete from client.js
 */
import { apiGet, apiPost, apiDelete } from "./client";
import { getAuthToken } from "./auth";

/**
 * GET /api/sparks
 * Fetch all active system sparks grouped by category, sorted by usage_count.
 * Returns: { categories: [{ category, sparks: [...] }] }
 */
export async function getSystemSparks() {
  const result = await apiGet("/api/sparks", 10000);
  return result?.categories || [];
}

/**
 * GET /api/sparks/search?q=...&category=...
 * Trigram similarity search.
 * Returns: { sparks: [...] }
 */
export async function searchSparks(q, category = null) {
  const token = await getAuthToken();
  const params = new URLSearchParams({ q });
  if (category) params.set("category", category);
  const result = await apiGet(`/api/sparks/search?${params.toString()}`, 10000, token);
  return result?.sparks || [];
}

/**
 * GET /members/me/sparks
 * Fetch the authenticated user's sparks (active only).
 * Returns: spark[] with start_date/end_date for travel sparks
 */
export async function getUserSparks() {
  const token = await getAuthToken();
  const result = await apiGet("/members/me/sparks", 10000, token);
  return result?.sparks || [];
}

/**
 * POST /members/me/sparks
 * Add a spark to the user's profile.
 * @param {number} sparkId
 * @param {{ start_date?: string, end_date?: string, target_city?: string }} [options]
 */
export async function addUserSpark(sparkId, options = {}) {
  const token = await getAuthToken();
  return apiPost(
    "/members/me/sparks",
    { spark_id: sparkId, ...options },
    10000,
    token
  );
}

/**
 * DELETE /members/me/sparks/:sparkId
 * Remove a spark from the user's profile.
 */
export async function removeUserSpark(sparkId) {
  const token = await getAuthToken();
  return apiDelete(`/members/me/sparks/${sparkId}`, null, 10000, token);
}

/**
 * POST /sparks/custom
 * Create a custom spark with dedup check.
 *
 * @param {string}  label     - User-typed spark label
 * @param {string}  category  - professional|social|activity|learning|travel
 * @param {boolean} [force]   - If true, bypasses similarity suggestions
 * @param {{ start_date?: string, end_date?: string, target_city?: string }} [options]
 *
 * Returns:
 *   { success: false, action: 'suggest', suggestions: [...] }  — similar sparks found, don't create yet
 *   { success: true, spark: { id, label, category } }          — created and added to profile
 */
export async function createCustomSpark(label, category, force = false, options = {}) {
  const token = await getAuthToken();
  return apiPost(
    "/sparks/custom",
    { label, category, force, ...options },
    12000,
    token
  );
}
