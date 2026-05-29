import { apiPost } from './client';
import { getAuthToken } from './auth';

/**
 * Emit a session lifecycle event (session_start or session_end) to the backend.
 *
 * Called fire-and-forget from sessionTracker.js — errors are silently swallowed
 * at the call site. Session tracking must never affect app stability.
 *
 * The token parameter is accepted directly to avoid a redundant async call when
 * the caller has already resolved the token (e.g. startSession checks auth first).
 *
 * @param {object} sessionData - Session event payload from sessionTracker
 * @param {string} [token]     - Auth token (resolved by caller to avoid extra async)
 */
export const emitSessionEvent = async (sessionData, token) => {
  // Resolve token if caller didn't provide one
  const authToken = token || (await getAuthToken());
  if (!authToken) return; // Never track unauthenticated sessions

  return apiPost('/sessions/track', sessionData, 10000, authToken);
  // 10 second timeout — session events must be fast
  // If they fail or time out, that's acceptable — don't retry
};
