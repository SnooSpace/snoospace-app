import { AppState } from 'react-native';
import { emitSessionEvent } from '../api/sessions';
import { getAuthToken } from '../api/auth';

/**
 * Session Tracker — Audience Intelligence System
 *
 * Tracks app sessions (foreground → background transitions) and per-session
 * screen depth. Data feeds into return_frequency_score and session_depth_score
 * in the AQI pipeline.
 *
 * Design principles:
 *   - Never throws — all errors are silently swallowed
 *   - Never blocks the app — all network calls are fire-and-forget
 *   - Only tracks authenticated sessions (no token = no tracking)
 */

// Internal session state — module-level singleton
let sessionState = {
  sessionId: null,
  startTime: null,
  screenSequence: [],
  currentDepth: 1,
  maxDepth: 1,
  isTracking: false,
  hourIST: 0,
  dayOfWeek: 0,
  isProfessionalHours: false,
};

/**
 * Called from AppContent in App.js on mount.
 * Sets up the AppState listener for foreground/background transitions.
 * Starts an initial session immediately (app is in foreground on mount).
 *
 * @returns {function} Cleanup function — pass to useEffect return
 */
export const initSessionTracker = () => {
  // Start a session immediately — app is in foreground on init
  startSession();

  // Listen for app state changes
  const subscription = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      // App came to foreground — start a new session
      startSession();
    } else if (nextState === 'background' || nextState === 'inactive') {
      // App went to background — end the current session
      endSession();
    }
  });

  // Return cleanup function for useEffect
  return () => subscription?.remove();
};

/**
 * Start a new session. Silently skips if:
 *   - A session is already active (idempotent)
 *   - User is not authenticated (no token)
 */
const startSession = async () => {
  if (sessionState.isTracking) return;

  try {
    const token = await getAuthToken();
    if (!token) return; // Don't track unauthenticated sessions

    const startTime = new Date();

    // Calculate IST time for professional hours classification
    const istTotalMinutes = startTime.getUTCHours() * 60 + startTime.getUTCMinutes() + 330; // +5h30m
    const hourIST = Math.floor(istTotalMinutes / 60) % 24;
    const dayOfWeek = startTime.getUTCDay(); // 0=Sunday, 6=Saturday
    // Professional hours: Mon-Fri (1-5), 9am-6pm IST
    const isProfessionalHours = dayOfWeek >= 1 && dayOfWeek <= 5
      && hourIST >= 9 && hourIST < 18;

    sessionState = {
      sessionId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime,
      screenSequence: [],
      currentDepth: 1,
      maxDepth: 1,
      isTracking: true,
      hourIST,
      dayOfWeek,
      isProfessionalHours,
    };

    // Fire session_start to backend — non-blocking, failure is acceptable
    emitSessionEvent({
      eventType: 'session_start',
      sessionId: sessionState.sessionId,
      hourOfDay: hourIST,
      dayOfWeek,
      isProfessionalHours,
    }, token).catch(() => {});
    // Silently fail — session tracking must never break the app

  } catch (err) {
    // Non-fatal — session tracking must never break the app
    console.warn('[SessionTracker] startSession error (non-fatal):', err?.message);
  }
};

/**
 * End the current session. Silently skips if no active session.
 * Calculates duration and quality, then fires session_end to backend.
 */
const endSession = async () => {
  if (!sessionState.isTracking || !sessionState.startTime) return;

  // Snapshot state before reset to avoid race conditions
  const snapshot = { ...sessionState };

  // Reset state immediately — don't wait for network
  sessionState = {
    sessionId: null,
    startTime: null,
    screenSequence: [],
    currentDepth: 1,
    maxDepth: 1,
    isTracking: false,
    hourIST: 0,
    dayOfWeek: 0,
    isProfessionalHours: false,
  };

  try {
    const token = await getAuthToken();
    if (!token) return;

    const endTime = new Date();
    const durationSeconds = Math.floor(
      (endTime - snapshot.startTime) / 1000
    );

    // Classify session quality
    const screensVisited = snapshot.screenSequence.length;
    let sessionQuality;
    if (durationSeconds < 30 || screensVisited <= 1) {
      sessionQuality = 'bounce';
    } else if (durationSeconds < 120 || screensVisited <= 3) {
      sessionQuality = 'shallow';
    } else if (durationSeconds < 300 || screensVisited <= 7) {
      sessionQuality = 'engaged';
    } else {
      sessionQuality = 'deep';
    }

    // Fire session_end to backend — non-blocking, failure is acceptable
    emitSessionEvent({
      eventType: 'session_end',
      sessionId: snapshot.sessionId,
      durationSeconds,
      screensVisited,
      screenSequence: snapshot.screenSequence.slice(0, 50),
      // cap at 50 to prevent huge payloads
      deepestScreenDepth: snapshot.maxDepth,
      sessionQuality,
      hourOfDay: snapshot.hourIST,
      dayOfWeek: snapshot.dayOfWeek,
      isProfessionalHours: snapshot.isProfessionalHours,
    }, token).catch(() => {});

  } catch (err) {
    // Non-fatal — session tracking must never break the app
    console.warn('[SessionTracker] endSession error (non-fatal):', err?.message);
  }
};

/**
 * Record a screen navigation event.
 * Wire this to NavigationContainer's onStateChange in App.js.
 *
 * @param {string} screenName  - Current screen name from navigation state
 * @param {number} stackDepth  - Navigation stack depth (1 = tab root, 2+ = pushed screens)
 */
export const trackScreenVisit = (screenName, stackDepth = 1) => {
  if (!sessionState.isTracking) return;

  try {
    // Add to sequence — avoid consecutive duplicates (e.g. tab re-selects)
    const last = sessionState.screenSequence[sessionState.screenSequence.length - 1];
    if (last !== screenName) {
      sessionState.screenSequence.push(screenName);
    }

    // Update depth tracking
    sessionState.currentDepth = stackDepth;
    sessionState.maxDepth = Math.max(sessionState.maxDepth, stackDepth);
  } catch {
    // Non-fatal — never break navigation
  }
};

/**
 * Get the current session ID for correlation with other events.
 * Returns null if no session is active.
 */
export const getSessionId = () => sessionState.sessionId;
