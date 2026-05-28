/**
 * WatchTracker — Singleton playback event tracker
 *
 * Fires watch events to the backend every 5 seconds during active playback
 * and on video exit/complete/replay.
 *
 * Also emits a completion-ratio AQI signal on complete/exit so that
 * getVideoSignalStrength() is called with a real completion ratio.
 * Without this, all video signals would use the default 0.3 strength.
 *
 * Usage:
 *   WatchTracker.start(videoId, viewerId, source, duration)  — call when video begins playing
 *   WatchTracker.updateTimestamp(seconds)                     — call from onPositionChange
 *   WatchTracker.complete()                                   — call on playToEnd
 *   WatchTracker.replay()                                     — call when user re-watches
 *   WatchTracker.stop()                                       — call on unmount / screen leave
 */

import { recordWatchEvent, recordAqiVideoSignal } from '../api/videoInsights';

// ── Internal state ──────────────────────────────────────────────────────────────
let _interval       = null;
let _currentSession = null;
let _currentVideoId = null;
let _currentTimestamp = 0;
let _viewerId       = null;
let _source         = 'for_you';
let _duration       = 0;      // total video duration in seconds
let _rewatchCount   = 0;      // times user scrubbed backward significantly
let _maxPosition    = 0;      // furthest position reached (used for completionRatio)

// ── Session ID generator (no uuid package needed) ───────────────────────────────
function generateSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ── Compute completion ratio ─────────────────────────────────────────────────────
function _completionRatio() {
  if (!_duration || _duration <= 0) return 0;
  return Math.min(1, _maxPosition / _duration);
}

// ── Public API ───────────────────────────────────────────────────────────────────
export const WatchTracker = {
  /**
   * Start tracking a new playback session.
   * @param {string|number} videoId
   * @param {string|number} viewerId   - current user's ID
   * @param {string}        source     - feed context ('for_you', 'profile', etc.)
   * @param {number}        duration   - total video duration in seconds (from player.duration)
   */
  start(videoId, viewerId, source = 'for_you', duration = 0) {
    WatchTracker.stop();

    _currentVideoId   = videoId;
    _currentSession   = generateSessionId();
    _viewerId         = viewerId ?? null;
    _source           = source;
    _currentTimestamp = 0;
    _maxPosition      = 0;
    _rewatchCount     = 0;
    _duration         = duration;

    _sendEvent('play', 0);

    _interval = setInterval(() => {
      _currentTimestamp += 5;
      _maxPosition = Math.max(_maxPosition, _currentTimestamp);
      _sendEvent('play', _currentTimestamp);
    }, 5000);
  },

  /** Update the current playback position (called from onPositionChange). */
  updateTimestamp(seconds) {
    // Detect rewatch: if the user scrubbed back >5s from their furthest position
    if (seconds < _maxPosition - 5 && _maxPosition > 10) {
      _rewatchCount++;
    }
    _maxPosition      = Math.max(_maxPosition, seconds);
    _currentTimestamp = seconds;
  },

  /** Set the total duration when known (call from player readyToPlay). */
  setDuration(seconds) {
    if (seconds > 0) _duration = seconds;
  },

  /** Call when the video plays to completion. */
  complete() {
    clearInterval(_interval);
    _interval   = null;
    _maxPosition = _duration || _currentTimestamp; // at completion, we watched 100%
    _sendEvent('complete', _currentTimestamp);
    _emitAqiSignal();
    _currentSession = null;
  },

  /** Call when the user triggers a re-watch (replay). */
  replay() {
    _sendEvent('replay', _currentTimestamp);
    _rewatchCount++;
  },

  /** Call on unmount, screen leave, or when a different video takes focus. */
  stop() {
    if (_currentSession) {
      clearInterval(_interval);
      _interval = null;
      _sendEvent('exit', _currentTimestamp);
      _emitAqiSignal();
      _currentSession = null;
    }
  },
};

// ── Internal: fire and forget watch heartbeat ────────────────────────────────────
async function _sendEvent(eventType, timestampSeconds) {
  if (!_currentVideoId || !_currentSession) return;

  await recordWatchEvent(_currentVideoId, {
    viewer_id:         _viewerId,
    session_id:        _currentSession,
    event_type:        eventType,
    timestamp_seconds: timestampSeconds,
    source:            _source,
  });
}

// ── Internal: emit AQI video completion signal ────────────────────────────────────
// Called on complete and exit. Sends completionRatio to the backend so
// emitSignal can call getVideoSignalStrength() with the real value.
async function _emitAqiSignal() {
  if (!_viewerId || !_currentVideoId) return;
  const ratio = _completionRatio();
  if (ratio < 0.05) return; // ignore accidental taps / autoplay bounces

  await recordAqiVideoSignal(_currentVideoId, {
    viewer_id:       _viewerId,
    completion_ratio: ratio,
    duration_seconds: _currentTimestamp,
    expected_duration: _duration,
    sound_on:         true,        // WatchTracker doesn't track mute state
    rewatch_detected: _rewatchCount > 0,
    source:           _source,
  }).catch(() => {}); // fire and forget — never block on AQI failure
}
