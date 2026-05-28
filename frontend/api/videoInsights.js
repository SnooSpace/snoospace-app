/**
 * Video Insights API
 *
 * Thin wrappers around the 3 video insights endpoints.
 * Uses BACKEND_BASE_URL from api/client.js — consistent with the rest of the app.
 */

import { BACKEND_BASE_URL } from './client';

/**
 * Fire a single watch-event (play heartbeat, exit, complete, replay).
 * Fails silently — tracking must never crash the app.
 */
export async function recordWatchEvent(videoId, payload) {
  try {
    await fetch(`${BACKEND_BASE_URL}/api/videos/${videoId}/watch-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // silent — never block playback
  }
}

/**
 * Record a follow conversion (viewer followed creator after watching).
 * Fails silently.
 */
export async function recordFollowConversion(videoId, payload) {
  try {
    await fetch(`${BACKEND_BASE_URL}/api/videos/${videoId}/follow-conversion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // silent
  }
}

/**
 * Emit an AQI video completion signal to the behavioral pipeline.
 * Called by WatchTracker on complete/exit with the real completionRatio.
 * Uses getVideoSignalStrength() server-side so dynamic strength is applied.
 * Fails silently — never block on AQI failure.
 *
 * @param {string|number} videoId
 * @param {{ viewer_id, completion_ratio, duration_seconds, rewatch_detected, source }} payload
 */
export async function recordAqiVideoSignal(videoId, payload) {
  try {
    await fetch(`${BACKEND_BASE_URL}/api/videos/${videoId}/aqi-signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // silent — tracking must never crash the app
  }
}

/**
 * Fetch full aggregated insights for a video (creator only).
 * @returns {Promise<Object>} insights data
 */
export async function getVideoInsights(videoId, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BACKEND_BASE_URL}/api/videos/${videoId}/insights`, { headers });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to load insights');
  return json.data;
}
