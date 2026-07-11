/**
 * recommendationsController.js
 *
 * REST endpoints for the "People You Should Meet" feature.
 *
 * GET  /api/recommendations                     — list recommendations
 * POST /api/recommendations/:candidateId/dismiss — dismiss a candidate
 * POST /admin/recommendations/trigger            — manually trigger batch job (admin only)
 */

'use strict';

const cfg = require('../config/recommendationConfig');
const { getUserRecs, removeUserRec } = require('../services/redisService');
const { runRecommendationsJob } = require('../jobs/computeRecommendations');

// ── GET /api/recommendations ──────────────────────────────────────────────────
/**
 * Returns the authenticated user's current recommendation list.
 *
 * Tries Redis cache first; falls back to recommended_matches table with
 * full candidate profile join. Paginated (page + limit query params).
 *
 * Response shape:
 * {
 *   recommendations: [
 *     {
 *       candidate_id: bigint,
 *       top_reasons:  [{type, label}],  // max 2
 *       profile: {
 *         name, nickname, username, profile_photo_url,
 *         occupation, verification_tier
 *       }
 *     }
 *   ],
 *   from_cache: boolean,
 *   page:       number,
 *   has_more:   boolean
 * }
 *
 * Note: total_score is NOT exposed to the frontend.
 */
const getRecommendations = async (req, res) => {
  try {
    const pool   = req.app.locals.pool;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '20', 10)));

    // Page 1 — try Redis cache first (cache only holds the top REDIS_CACHE_SIZE)
    if (page === 1) {
      const cached = await getUserRecs(userId);
      if (cached && cached.length > 0) {
        const slice = cached.slice(0, limit);
        return res.json({
          recommendations: slice.map(normaliseRec),
          from_cache: true,
          page: 1,
          has_more: cached.length > limit,
        });
      }
    }

    // Cache miss or page > 1 — query DB directly
    const offset = (page - 1) * limit;
    const { rows } = await pool.query(
      `SELECT
         rm.candidate_id,
         rm.top_reasons,
         m.name,
         m.nickname,
         m.username,
         m.profile_photo_url,
         m.occupation,
         m.verification_tier
       FROM recommended_matches rm
       JOIN members m ON m.id = rm.candidate_id
       WHERE rm.user_id = $1
       ORDER BY rm.total_score DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit + 1, offset]   // fetch limit+1 to determine has_more
    );

    const has_more = rows.length > limit;
    const page_rows = rows.slice(0, limit);

    return res.json({
      recommendations: page_rows.map(normaliseRec),
      from_cache: false,
      page,
      has_more,
    });
  } catch (err) {
    console.error('[RecommendationsController] getRecommendations error:', err.message);
    res.status(500).json({ error: 'Failed to load recommendations' });
  }
};

/** Strip internal fields and normalise a recommendation row for the API response. */
function normaliseRec(row) {
  return {
    candidate_id: row.candidate_id,
    top_reasons:  Array.isArray(row.top_reasons)
      ? row.top_reasons
      : (typeof row.top_reasons === 'string' ? JSON.parse(row.top_reasons) : []),
    profile: {
      name:               row.name,
      nickname:           row.nickname || null,
      username:           row.username || null,
      profile_photo_url:  row.profile_photo_url || null,
      occupation:         row.occupation || null,
      verification_tier:  row.verification_tier || 'none',
    },
  };
}

// ── POST /api/recommendations/:candidateId/dismiss ────────────────────────────
/**
 * Dismisses a recommendation.
 *
 * - Inserts into dismissed_recommendations (upsert — safe to call twice)
 * - Removes from recommended_matches for this pair
 * - Removes from Redis cache list if present
 *
 * The dismissed candidate will not resurface for DISMISSAL_COOLDOWN_DAYS.
 */
const dismissRecommendation = async (req, res) => {
  try {
    const pool        = req.app.locals.pool;
    const userId      = req.user?.id;
    const candidateId = req.params.candidateId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!candidateId || isNaN(Number(candidateId))) {
      return res.status(400).json({ error: 'Valid candidateId is required' });
    }

    // Upsert dismissal record
    await pool.query(
      `INSERT INTO dismissed_recommendations (user_id, candidate_id, dismissed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, candidate_id) DO UPDATE SET dismissed_at = NOW()`,
      [userId, candidateId]
    );

    // Remove from recommended_matches (soft-clean; job will also exclude via gate)
    await pool.query(
      `DELETE FROM recommended_matches WHERE user_id = $1 AND candidate_id = $2`,
      [userId, candidateId]
    );

    // Remove from Redis cache (best-effort — non-fatal if cache is absent)
    await removeUserRec(userId, candidateId);

    return res.json({ success: true });
  } catch (err) {
    console.error('[RecommendationsController] dismissRecommendation error:', err.message);
    res.status(500).json({ error: 'Failed to dismiss recommendation' });
  }
};

// ── POST /admin/recommendations/trigger ──────────────────────────────────────
/**
 * Admin-only endpoint to manually trigger the batch job.
 * Runs async — returns immediately with a 202 Accepted.
 * Monitor progress via server logs.
 */
const triggerRecommendationsJob = async (req, res) => {
  try {
    const pool = req.app.locals.pool;

    // Kick off async — don't await (job can run for minutes on large datasets)
    console.log('[RecommendationsController] Admin triggered recommendations job');
    runRecommendationsJob(pool).catch(err => {
      console.error('[RecommendationsController] Triggered job error:', err.message);
    });

    return res.status(202).json({
      success: true,
      message: 'Recommendations job started. Monitor server logs for progress.',
    });
  } catch (err) {
    console.error('[RecommendationsController] triggerRecommendationsJob error:', err.message);
    res.status(500).json({ error: 'Failed to trigger job' });
  }
};

module.exports = {
  getRecommendations,
  dismissRecommendation,
  triggerRecommendationsJob,
};
