/**
 * Session Controller
 *
 * Handles POST /sessions/track — receives session_start and session_end events
 * from the frontend sessionTracker.
 *
 * Design principles:
 *   - Always acknowledges immediately (200 OK) before any async processing
 *   - All work happens after the response is sent
 *   - Never throws — all errors are logged and swallowed
 *   - Sessions < 5 seconds are discarded (app flickers, not real sessions)
 */

const { createPool } = require('../config/db');
const pool = createPool();
const { emitSignal } = require('../utils/signalEmitter');

/**
 * POST /sessions/track
 *
 * Receives session_start and session_end events from the frontend.
 * session_start: updates last_active_at in user_aqi_signals (keeps dormancy fresh).
 * session_end:   inserts into user_sessions + emits an AQI signal based on quality.
 *
 * Responds 200 immediately — all processing is async after the response.
 */
const trackSession = async (req, res) => {
  const userId = req.user?.id;
  const {
    eventType,
    sessionId,
    durationSeconds,
    screensVisited,
    screenSequence,
    deepestScreenDepth,
    sessionQuality,
    hourOfDay,
    dayOfWeek,
    isProfessionalHours,
  } = req.body;

  // Always respond immediately — never block the client on session tracking
  res.status(200).json({ status: 'ok' });

  // Process asynchronously after the response has been sent
  try {
    // Only track session activity and AQI signals for members.
    // Business accounts (communities, sponsors, venues) do not have member records or AQI profiles.
    if (!userId || req.user?.type !== "member") return;

    if (eventType === 'session_start') {
      // Update last_active_at so dormancy decay sees the user as active
      await pool.query(
        `INSERT INTO user_aqi_signals (user_id, last_active_at)
         VALUES ($1, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           last_active_at = NOW(),
           updated_at     = NOW()`,
        [userId],
      );

    } else if (eventType === 'session_end') {
      // Discard very short sessions — likely app flickers or accidental opens
      if (!durationSeconds || durationSeconds < 5) return;

      // Insert raw session record into aqi_sessions
      // (user_sessions is a pre-existing device/auth session table — different purpose)
      await pool.query(
        `INSERT INTO aqi_sessions (
          user_id, session_start, session_end,
          duration_seconds, screens_visited, screen_sequence,
          deepest_screen_depth, session_quality,
          hour_of_day, day_of_week, is_professional_hours
        ) VALUES (
          $1,
          NOW() - ($2 * INTERVAL '1 second'),
          NOW(),
          $2, $3, $4, $5, $6, $7, $8, $9
        )`,
        [
          userId,
          durationSeconds,
          screensVisited ?? 0,
          JSON.stringify(screenSequence ?? []),
          deepestScreenDepth ?? 1,
          sessionQuality ?? 'shallow',
          hourOfDay ?? 0,
          dayOfWeek ?? 0,
          isProfessionalHours ?? false,
        ],
      );

      // Map session quality to AQI signal strength.
      // Deep and engaged sessions carry real engagement signal.
      // Bounce sessions are a slight negative signal on content_depth_score.
      const sessionSignalStrength = {
        deep:    1.5,
        engaged: 0.8,
        shallow: 0.3,
        bounce: -0.1, // negative — bounces slightly drag content_depth_score
      };

      const strength = sessionSignalStrength[sessionQuality] ?? 0.3;

      // Only emit positive signals — negative ones just get dropped here since
      // the weekly stats job recalculates bounce_rate directly from session records
      if (strength > 0) {
        await emitSignal(pool, {
          userId,
          userType: req.user?.type ?? 'member',
          eventType: 'session_completed',
          category: null,
          metadata: {
            session_quality:   sessionQuality,
            duration_seconds:  durationSeconds,
            screens_visited:   screensVisited,
            deepest_depth:     deepestScreenDepth,
          },
          signalStrength: strength,
        });
      }
    }

  } catch (err) {
    // Non-fatal — session tracking must never affect app stability
    console.error('[SessionController] Session tracking error:', err.message);
  }
};

module.exports = { trackSession };
