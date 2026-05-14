/**
 * WatchTracker — Singleton playback event tracker
 *
 * Fires watch events to the backend every 5 seconds during active playback
 * and on video exit/complete/replay.
 *
 * Usage:
 *   WatchTracker.start(videoId, viewerId, source)   — call when video begins playing
 *   WatchTracker.updateTimestamp(seconds)            — call from onPositionChange
 *   WatchTracker.complete()                          — call on playToEnd
 *   WatchTracker.replay()                            — call when user re-watches
 *   WatchTracker.stop()                              — call on unmount / screen leave
 */

import { recordWatchEvent } from '../api/videoInsights';

// ── Internal state ──────────────────────────────────────────────────────────
let _interval = null;
let _currentSession = null;
let _currentVideoId = null;
let _currentTimestamp = 0;
let _viewerId = null;
let _source = 'for_you';

// ── Session ID generator (no uuid package needed) ───────────────────────────
function generateSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ── Public API ───────────────────────────────────────────────────────────────
export const WatchTracker = {
  /**
   * Start tracking a new playback session.
   * Automatically stops any existing session first.
   */
  start(videoId, viewerId, source = 'for_you') {
    WatchTracker.stop();

    _currentVideoId = videoId;
    _currentSession = generateSessionId();
    _viewerId = viewerId ?? null;
    _source = source;
    _currentTimestamp = 0;

    _sendEvent('play', 0);

    _interval = setInterval(() => {
      _currentTimestamp += 5;
      _sendEvent('play', _currentTimestamp);
    }, 5000);
  },

  /** Update the current playback position (called from onPositionChange). */
  updateTimestamp(seconds) {
    _currentTimestamp = seconds;
  },

  /** Call when the video plays to completion. */
  complete() {
    clearInterval(_interval);
    _interval = null;
    _sendEvent('complete', _currentTimestamp);
    _currentSession = null;
  },

  /** Call when the user triggers a re-watch (replay). */
  replay() {
    _sendEvent('replay', _currentTimestamp);
  },

  /** Call on unmount, screen leave, or when a different video takes focus. */
  stop() {
    if (_currentSession) {
      clearInterval(_interval);
      _interval = null;
      _sendEvent('exit', _currentTimestamp);
      _currentSession = null;
    }
  },
};

// ── Internal: fire and forget ────────────────────────────────────────────────
async function _sendEvent(eventType, timestampSeconds) {
  if (!_currentVideoId || !_currentSession) return;

  // recordWatchEvent already fails silently
  await recordWatchEvent(_currentVideoId, {
    viewer_id: _viewerId,
    session_id: _currentSession,
    event_type: eventType,
    timestamp_seconds: timestampSeconds,
    source: _source,
  });
}
