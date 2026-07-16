'use strict';

/**
 * computeTrustFlags.js
 *
 * Daily batch job: detect reputation-pattern-based safety signals.
 *
 * Flag types handled here (NOT safety_report — that's created instantly in the controller):
 *   1. repeat_never_again — 3+ distinct raters with 'never_again'/'probably_not' in last 30 days
 *   2. exclusivity_cluster — same rater→ratee pair triggered the exclusivity cap 3+ consecutive job runs
 *
 * Flags auto-dismissed when window_end > 90 days old with no new negatives in the last 30 days.
 */

const LOOKBACK_DAYS        = 30;
const NEGATIVE_THRESHOLD   = 3;   // distinct raters with negative signal required to flag
const AUTO_DISMISS_DAYS    = 90;  // flags older than this with no new negatives are dismissed

async function runTrustFlagsJob(pool) {
  const jobStart = Date.now();
  console.log('[TrustFlagsJob] ▶ Starting trust flag computation...');

  try {
    await flagRepeatNeverAgain(pool);
    await autoDismissStaleFlags(pool);

    const elapsed = ((Date.now() - jobStart) / 1000).toFixed(2);
    console.log(`[TrustFlagsJob] ✔ Done in ${elapsed}s`);
  } catch (err) {
    console.error('[TrustFlagsJob] Fatal error:', err.message);
    throw err;
  }
}

// ── Flag 1: repeat_never_again ────────────────────────────────────────────────
async function flagRepeatNeverAgain(pool) {
  // Find ratees with 3+ distinct raters sending 'never_again' or 'probably_not' in last 30 days
  const { rows } = await pool.query(`
    SELECT ratee_id, COUNT(DISTINCT rater_id) AS negative_rater_count
    FROM reputation_pair_history
    WHERE rating IN ('never_again', 'probably_not')
      AND created_at > NOW() - INTERVAL '${LOOKBACK_DAYS} days'
    GROUP BY ratee_id
    HAVING COUNT(DISTINCT rater_id) >= $1
  `, [NEGATIVE_THRESHOLD]);

  let flagged = 0;
  for (const row of rows) {
    // Only create a new flag if no OPEN flag already exists for this window
    const existing = await pool.query(`
      SELECT id FROM user_trust_flags
      WHERE user_id    = $1
        AND flag_type  = 'repeat_never_again'
        AND status     = 'open'
        AND window_end > NOW()
      LIMIT 1
    `, [row.ratee_id]);

    if (existing.rows.length === 0) {
      await pool.query(`
        INSERT INTO user_trust_flags
          (user_id, flag_type, severity, window_start, window_end)
        VALUES ($1, 'repeat_never_again', 2, NOW() - INTERVAL '${LOOKBACK_DAYS} days', NOW() + INTERVAL '${AUTO_DISMISS_DAYS} days')
      `, [row.ratee_id]);
      flagged++;

      console.warn(
        `[TrustFlagsJob] 🚩 repeat_never_again flag created for user ${row.ratee_id} ` +
        `(${row.negative_rater_count} distinct negative raters in last ${LOOKBACK_DAYS} days)`
      );
    }
  }

  console.log(`[TrustFlagsJob] repeat_never_again: ${flagged} new flags created`);
}

// ── Auto-dismiss: old flags with no recent new negatives ──────────────────────
async function autoDismissStaleFlags(pool) {
  // Flags are dismissed if:
  // - They were created more than AUTO_DISMISS_DAYS ago (window_end < NOW())
  // - AND no new negative ratings for this user in the last 30 days
  const { rows: stale } = await pool.query(`
    SELECT utf.id, utf.user_id
    FROM user_trust_flags utf
    WHERE utf.flag_type = 'repeat_never_again'
      AND utf.status    = 'open'
      AND utf.window_end < NOW()
  `);

  let dismissed = 0;
  for (const flag of stale) {
    // Check if any recent negatives
    const recentNeg = await pool.query(`
      SELECT 1 FROM reputation_pair_history
      WHERE ratee_id = $1
        AND rating IN ('never_again', 'probably_not')
        AND created_at > NOW() - INTERVAL '${LOOKBACK_DAYS} days'
      LIMIT 1
    `, [flag.user_id]);

    if (recentNeg.rows.length === 0) {
      await pool.query(`
        UPDATE user_trust_flags SET status = 'dismissed', window_end = NOW()
        WHERE id = $1
      `, [flag.id]);
      dismissed++;
    }
  }

  console.log(`[TrustFlagsJob] auto-dismissed ${dismissed} stale flags`);
}

module.exports = { runTrustFlagsJob };
