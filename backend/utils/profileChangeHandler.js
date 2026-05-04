/**
 * Profile Change Handler
 *
 * Fires after any member profile update that touches a field that affects
 * AQI signals (occupation, city, area, gender, date_of_birth).
 *
 * Responsibilities:
 *   1. Log the change in member_profile_change_log
 *   2. Sync occupation/location into hierarchy tables so the next
 *      demographic learning job sees the new values
 *   3. Trigger an immediate AQI recalculation (not waiting for Sunday)
 *   4. Mark the log entry as recalculated
 *
 * This module is intentionally lightweight — it calls existing infrastructure
 * (the same occupation/location seed logic used by the weekly job) rather
 * than duplicating scoring logic.
 */

const TRACKED_FIELDS = ['occupation', 'city', 'area', 'gender', 'date_of_birth'];

/**
 * Ensure a new occupation value exists in occupation_hierarchy.
 * Mirrors seedOccupationHierarchy in learnDemographicScores.js but
 * for a single occupation value (immediate, not batch).
 */
const ensureOccupationInHierarchy = async (pool, occupation, occupationCategory = null) => {
  if (!occupation || typeof occupation !== 'string') return;
  try {
    await pool.query(`
      INSERT INTO occupation_hierarchy (occupation_exact, occupation_category)
      VALUES ($1, $2)
      ON CONFLICT (occupation_exact) DO UPDATE SET
        occupation_category = COALESCE(occupation_hierarchy.occupation_category, EXCLUDED.occupation_category)
    `, [occupation.trim(), occupationCategory]);
  } catch (err) {
    console.error('[ProfileChange] ensureOccupationInHierarchy error:', err.message);
  }
};

/**
 * Ensure a city/area combination exists in location_hierarchy.
 * Uses UPSERT so repeat calls are idempotent.
 */
const ensureCityInHierarchy = async (pool, city, area = null) => {
  if (!city || typeof city !== 'string') return;
  try {
    // location_hierarchy uses city as primary key (from existing schema)
    await pool.query(`
      INSERT INTO location_hierarchy (city, area, tier)
      VALUES ($1, $2, 'unknown')
      ON CONFLICT (city) DO UPDATE SET
        area = COALESCE(location_hierarchy.area, EXCLUDED.area)
    `, [city.trim(), area ? area.trim() : null]);
  } catch (err) {
    // Table may not have area column — non-fatal
    console.error('[ProfileChange] ensureCityInHierarchy error:', err.message);
  }
};

/**
 * Lightweight AQI recalculation trigger.
 * Calls the /audience/calculate-aqi/:userId endpoint logic directly via
 * the pool (same DB writes, no HTTP round-trip) by running a minimal
 * signal refresh and then invoking the full calculateAqi controller logic
 * internally. We use a fire-and-forget pattern — if it fails, the weekly
 * job will catch up on Sunday.
 *
 * Note: We require the controller lazily to avoid circular dependency since
 * audienceIntelligenceController may be loaded before this module.
 */
const triggerAqiRecalculation = async (pool, userId) => {
  try {
    const { calculateAqiInternal } = require('../controllers/audienceIntelligenceController');
    if (typeof calculateAqiInternal === 'function') {
      await calculateAqiInternal(pool, userId);
      console.log(`[ProfileChange] AQI recalculated for user ${userId}`);
    } else {
      // Fallback: mark the signals row as dirty so the next job picks it up
      await pool.query(`
        UPDATE user_aqi_signals
        SET onboarding_weight = 0.9,
            behavior_weight = 0.1,
            aqi_score = NULL
        WHERE user_id = $1
      `, [userId]);
      console.log(`[ProfileChange] AQI marked for recalculation (job fallback) for user ${userId}`);
    }
  } catch (err) {
    // Non-fatal — weekly job catches up
    console.error('[ProfileChange] triggerAqiRecalculation error:', err.message);
  }
};

/**
 * Main entry point — call this after any profile UPDATE on members table.
 *
 * @param {Pool}   pool      - pg Pool instance
 * @param {number} userId    - member id
 * @param {string} field     - field that changed (must be in TRACKED_FIELDS)
 * @param {*}      oldValue  - previous value (may be null)
 * @param {*}      newValue  - new value
 * @param {object} [context] - optional { occupation_category } for occupation changes
 */
const handleProfileFieldChange = async (pool, userId, field, oldValue, newValue, context = {}) => {
  if (!TRACKED_FIELDS.includes(field)) return;

  // Normalize to strings for storage (null is fine too)
  const oldStr = oldValue != null ? String(oldValue) : null;
  const newStr = newValue != null ? String(newValue) : null;

  try {
    // 1. Log the change
    await pool.query(`
      INSERT INTO member_profile_change_log
        (user_id, field_changed, old_value, new_value)
      VALUES ($1, $2, $3, $4)
    `, [userId, field, oldStr, newStr]);

    // 2. Sync hierarchy tables so new values are scorable immediately
    if (field === 'occupation' && newValue) {
      await ensureOccupationInHierarchy(pool, newValue, context.occupation_category || null);
    }

    if ((field === 'city' || field === 'area') && newValue) {
      // Get the user's current city/area to form the complete pair
      const userResult = await pool.query(
        `SELECT location FROM members WHERE id = $1`,
        [userId],
      );
      const loc = userResult.rows[0]?.location || {};
      const resolvedCity = field === 'city' ? newValue : (loc.city || null);
      const resolvedArea = field === 'area' ? newValue : (loc.area || null);
      await ensureCityInHierarchy(pool, resolvedCity, resolvedArea);
    }

    // 3. Trigger immediate AQI recalculation (fire-and-forget is fine)
    //    We intentionally do NOT await so the profile save response is
    //    not delayed by AQI computation.
    triggerAqiRecalculation(pool, userId).catch((err) =>
      console.error('[ProfileChange] Background AQI recalculation failed:', err.message)
    );

    // 4. Mark the log entry as recalculated
    //    (Set to true optimistically — the recalculation is in-flight)
    await pool.query(`
      UPDATE member_profile_change_log
      SET aqi_recalculated = true, recalculated_at = NOW()
      WHERE user_id = $1
        AND field_changed = $2
        AND aqi_recalculated = false
    `, [userId, field]);

  } catch (err) {
    // Never propagate — a logging failure should not break a profile save
    console.error(`[ProfileChange] handleProfileFieldChange error (field: ${field}):`, err.message);
  }
};

module.exports = {
  handleProfileFieldChange,
  ensureOccupationInHierarchy,
  ensureCityInHierarchy,
  TRACKED_FIELDS,
};
