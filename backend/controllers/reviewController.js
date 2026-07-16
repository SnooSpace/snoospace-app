'use strict';

/**
 * reviewController.js
 *
 * Endpoints:
 *   GET  /api/reviews/events/:eventId/dimensions    — fetch dimension questions for this event's category
 *   POST /api/reviews/events/:eventId               — submit event review
 *   POST /api/reviews/open-plans/:planId            — submit open plan review + attendee ratings
 *   GET  /api/users/:userId/reputation              — public/organizer reputation (cold-start safe)
 *   GET  /api/organizers/events/:eventId/review-summary — organizer aggregate (never raw rows)
 */

const { SAFETY_CONCERNS_TAG, ALL_VALID_TAGS, getTagsForRating } = require('../constants/reviewTags');
const notificationService = require('../services/notificationService');
const { getRedis } = require('../services/redisService');

// ── Redis helpers ─────────────────────────────────────────────────────────────

const REPUTATION_TTL = 3600; // 1 hour

function reputationCacheKey(userId) {
  return `reputation:${userId}`;
}

async function getCachedReputation(userId) {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(reputationCacheKey(userId));
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch { return null; }
}

async function setCachedReputation(userId, data) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(reputationCacheKey(userId), JSON.stringify(data), { ex: REPUTATION_TTL });
  } catch { /* non-fatal */ }
}

// ── Attendance verification ───────────────────────────────────────────────────

async function verifyEventAttendance(pool, userId, eventId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM event_registrations
     WHERE member_id = $1 AND event_id = $2
       AND registration_status IN ('registered', 'attended', 'confirmed')
     LIMIT 1`,
    [userId, eventId]
  );
  return rows.length > 0;
}

async function verifyOpenPlanAttendance(pool, userId, planId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM open_plan_requests
     WHERE requester_id = $1 AND plan_id = $2 AND status = 'approved'
     LIMIT 1`,
    [userId, planId]
  );
  return rows.length > 0;
}

// ── Safety report notification ────────────────────────────────────────────────
// Per spec: safety reports MUST route to a channel actively monitored day-to-day
// (not just an in-app admin notification that requires an active session).
//
// Set SAFETY_WEBHOOK_URL in backend/.env to a Slack incoming webhook URL or
// a similar HTTP endpoint. If unset, falls back to console.error only.
// In-app notification is kept as a secondary channel if SAFETY_REPORT_ADMIN_MEMBER_ID is also set.

async function fireSafetyReportAlert(pool, reviewId, eventId, reporterId) {
  const message =
    `🚨 *SAFETY REPORT* — requires human review\n` +
    `• review_id: \`${reviewId}\`\n` +
    `• event_id: \`${eventId}\`\n` +
    `• reporter member_id: \`${reporterId}\`\n` +
    `• Table: \`event_review_comments\` WHERE \`is_safety_report=true AND moderation_status='pending'\``;

  // 1. Always log to server stdout/stderr (visible in any log aggregator)
  console.error(`[SAFETY REPORT] 🚨 ${message.replace(/[*`\n]/g, ' ')}`);

  // 2. Webhook (Slack / email relay / etc) — highest priority monitored channel
  const webhookUrl = process.env.SAFETY_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const https = require('https');
      const http  = require('http');
      const url   = new URL(webhookUrl);
      const body  = JSON.stringify({ text: message });
      const lib   = url.protocol === 'https:' ? https : http;

      await new Promise((resolve, reject) => {
        const req = lib.request(
          { hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
          (res) => { res.resume(); resolve(); }
        );
        req.on('error', reject);
        req.write(body);
        req.end();
      });
      console.log(`[ReviewController] Safety webhook delivered to ${url.hostname}`);
    } catch (webhookErr) {
      // Non-fatal: console.error above already fired
      console.error('[ReviewController] Safety webhook delivery failed:', webhookErr.message);
    }
  } else {
    console.warn(
      '[ReviewController] SAFETY_WEBHOOK_URL not set — safety report visible in server logs only. ' +
      'Set this env var to a Slack incoming webhook URL before going live.'
    );
  }

  // 3. In-app notification (secondary — requires admin to be checking the app)
  try {
    const adminIdEnv = process.env.SAFETY_REPORT_ADMIN_MEMBER_ID;
    if (adminIdEnv) {
      await notificationService.createSimpleNotification(pool, {
        recipientId:   parseInt(adminIdEnv, 10),
        recipientType: 'member',
        actorId:       reporterId,
        actorType:     'member',
        type:          'safety_report_received',
        payload:       { reviewId, eventId, reporterId },
      });
    }
  } catch (err) {
    console.error('[ReviewController] Safety in-app notification failed:', err.message);
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/reviews/events/:eventId/dimensions
// Returns dimension questions for this event's category group.
// ═══════════════════════════════════════════════════════════════════════════════

const getEventDimensions = async (req, res) => {
  const pool = req.app.locals.pool;
  const { eventId } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT
         rd.id,
         rd.key,
         rd.label,
         rd.scale_type,
         rd.scale_labels,
         cgd.display_order
       FROM events e
       JOIN category_group_dimensions cgd ON cgd.category_group = COALESCE(e.category_group, 'general')
       JOIN review_dimensions rd ON rd.id = cgd.dimension_id
       WHERE e.id = $1
         AND rd.applies_to = 'event'
       ORDER BY cgd.display_order`,
      [eventId]
    );

    return res.json({ dimensions: rows });
  } catch (err) {
    console.error('[ReviewController] getEventDimensions error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch dimensions' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/reviews/events/:eventId
// Submit an event review (worth_it_rating + tags + optional dimensions + optional comment).
// ═══════════════════════════════════════════════════════════════════════════════

const submitEventReview = async (req, res) => {
  const pool  = req.app.locals.pool;
  const userId  = req.user.id;
  const { eventId } = req.params;
  const { worth_it_rating, tags = [], dimension_ratings = [], comment } = req.body;

  // ── Validate worth_it_rating ─────────────────────────────────────────────
  const VALID_RATINGS = ['absolutely', 'mostly', 'okay', 'not_really', 'not_at_all'];
  if (!worth_it_rating || !VALID_RATINGS.includes(worth_it_rating)) {
    return res.status(400).json({ error: 'worth_it_rating is required and must be one of: ' + VALID_RATINGS.join(', ') });
  }

  // ── Validate tags (min 1 required for ALL branches) ──────────────────────
  if (!Array.isArray(tags) || tags.length === 0) {
    return res.status(400).json({ error: 'At least one tag is required' });
  }

  // All submitted tags must be in the valid set for this rating
  const validTagSet = getTagsForRating(worth_it_rating);
  const invalidTags = tags.filter(t => !validTagSet.includes(t));
  if (invalidTags.length > 0) {
    return res.status(400).json({ error: `Invalid tags for this rating: ${invalidTags.join(', ')}` });
  }

  // ── Safety concerns check (keyed off the tag, not the sentiment) ─────────
  const hasSafetyConcerns = tags.includes(SAFETY_CONCERNS_TAG);
  if (hasSafetyConcerns && (!comment || !comment.trim())) {
    return res.status(400).json({
      error: 'A description is required when reporting a safety concern',
      field: 'safety_comment',
    });
  }

  // ── Verify attendance ────────────────────────────────────────────────────
  const attended = await verifyEventAttendance(pool, userId, eventId);
  if (!attended) {
    return res.status(403).json({ error: 'You can only review events you attended' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert base review
    const reviewResult = await client.query(
      `INSERT INTO event_reviews (event_id, user_id, worth_it_rating)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [eventId, userId, worth_it_rating]
    );
    const reviewId = reviewResult.rows[0].id;

    // Insert tags
    for (const tag of tags) {
      await client.query(
        `INSERT INTO event_review_tags (review_id, tag) VALUES ($1, $2)`,
        [reviewId, tag]
      );
    }

    // Insert dimension ratings (if any provided)
    for (const dr of dimension_ratings) {
      if (dr.dimension_id && dr.rating_value) {
        await client.query(
          `INSERT INTO event_review_dimension_ratings (review_id, dimension_id, rating_value)
           VALUES ($1, $2, $3)
           ON CONFLICT (review_id, dimension_id) DO UPDATE SET rating_value = EXCLUDED.rating_value`,
          [reviewId, dr.dimension_id, dr.rating_value]
        );
      }
    }

    // Insert comment if provided
    if (comment && comment.trim()) {
      await client.query(
        `INSERT INTO event_review_comments (review_id, comment_text, is_safety_report, moderation_status)
         VALUES ($1, $2, $3, $4)`,
        [
          reviewId,
          comment.trim(),
          hasSafetyConcerns,
          hasSafetyConcerns ? 'pending' : 'none',
        ]
      );

      // Mark safety_report trust flag immediately (not deferred to batch job)
      if (hasSafetyConcerns) {
        await client.query(
          `INSERT INTO user_trust_flags (user_id, flag_type, severity, window_start, window_end)
           VALUES ($1, 'safety_report', 2, NOW(), NOW() + INTERVAL '90 days')`,
          [userId]
        );
      }
    }

    await client.query('COMMIT');

    // Fire safety alert AFTER commit (non-transactional notification)
    if (hasSafetyConcerns) {
      fireSafetyReportAlert(pool, reviewId, eventId, userId).catch(() => {});
    }

    return res.status(201).json({ success: true, review_id: reviewId });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You have already reviewed this event' });
    }
    console.error('[ReviewController] submitEventReview error:', err.message);
    return res.status(500).json({ error: 'Failed to submit review' });
  } finally {
    client.release();
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/reviews/open-plans/:planId
// Submit open plan review + interaction selections + per-person attendee ratings.
// All three steps submitted in one call.
// ═══════════════════════════════════════════════════════════════════════════════

const submitOpenPlanReview = async (req, res) => {
  const pool   = req.app.locals.pool;
  const userId  = req.user.id;
  const { planId } = req.params;
  const {
    would_join_again,
    interacted_user_ids = [],
    attendee_ratings    = [],  // [{ user_id, rating }]
  } = req.body;

  // ── Validate would_join_again ────────────────────────────────────────────
  const VALID_JOIN = ['absolutely', 'probably', 'maybe', 'probably_not', 'never_again'];
  if (!would_join_again || !VALID_JOIN.includes(would_join_again)) {
    return res.status(400).json({ error: 'would_join_again is required' });
  }

  // ── Validate attendee_ratings ⊆ interacted_user_ids ─────────────────────
  const interactedSet = new Set(interacted_user_ids.map(String));
  for (const ar of attendee_ratings) {
    if (!interactedSet.has(String(ar.user_id))) {
      return res.status(400).json({
        error: `Cannot rate user ${ar.user_id} — they were not in your interaction selection`,
      });
    }
  }

  // ── Verify plan attendance (requester must be approved) ──────────────────
  const attended = await verifyOpenPlanAttendance(pool, userId, planId);
  if (!attended) {
    return res.status(403).json({ error: 'You can only review open plans you attended' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert base review
    const reviewResult = await client.query(
      `INSERT INTO open_plan_reviews (open_plan_id, user_id, would_join_again)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [planId, userId, would_join_again]
    );
    const reviewId = reviewResult.rows[0].id;

    // Insert interaction selections
    for (const interactedUserId of interacted_user_ids) {
      await client.query(
        `INSERT INTO open_plan_interaction_selections (open_plan_review_id, rated_user_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [reviewId, interactedUserId]
      );
    }

    // Insert attendee ratings + reputation_pair_history in same transaction
    for (const ar of attendee_ratings) {
      if (!ar.rating || !VALID_JOIN.includes(ar.rating)) continue;

      await client.query(
        `INSERT INTO open_plan_attendee_ratings
           (open_plan_review_id, rated_user_id, rater_id, rating)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (open_plan_review_id, rated_user_id) DO NOTHING`,
        [reviewId, ar.user_id, userId, ar.rating]
      );

      // Write to pair history for anti-gaming tracking + Signal 10
      await client.query(
        `INSERT INTO reputation_pair_history (rater_id, ratee_id, rating, source_type, source_id)
         VALUES ($1, $2, $3, 'open_plan', $4)`,
        [userId, ar.user_id, ar.rating, reviewId]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json({ success: true, review_id: reviewId });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You have already reviewed this open plan' });
    }
    console.error('[ReviewController] submitOpenPlanReview error:', err.message);
    return res.status(500).json({ error: 'Failed to submit review' });
  } finally {
    client.release();
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/users/:userId/reputation
// Public-facing reputation. Cold-start safe: no score shown until >= 5 ratings.
// Returns bucketed sample size, never exact count.
// ═══════════════════════════════════════════════════════════════════════════════

const MIN_RATINGS_FOR_SCORE = 5;

function sampleSizeBucket(rawCount) {
  if (rawCount < 20)  return '5-20';
  if (rawCount < 50)  return '20-50';
  return '50+';
}

const getUserReputation = async (req, res) => {
  const pool = req.app.locals.pool;
  const { userId } = req.params;

  // Check Redis cache first
  const cached = await getCachedReputation(userId);
  if (cached) return res.json(cached);

  try {
    const { rows } = await pool.query(
      `SELECT smoothed_score, total_raw_rating_count
       FROM user_reputation_scores
       WHERE user_id = $1`,
      [userId]
    );

    let response;

    if (rows.length === 0 || rows[0].total_raw_rating_count < MIN_RATINGS_FOR_SCORE) {
      response = {
        status: 'building',
        label: 'Building reputation',
      };
    } else {
      const { smoothed_score, total_raw_rating_count } = rows[0];
      response = {
        status: 'active',
        percentage: Math.round((smoothed_score || 0) * 100),
        sample_size_bucket: sampleSizeBucket(total_raw_rating_count),
      };
    }

    await setCachedReputation(userId, response);
    return res.json(response);
  } catch (err) {
    console.error('[ReviewController] getUserReputation error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch reputation' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/organizers/events/:eventId/review-summary
// Organizer-only aggregate view. Never returns individual comment_text or user rows.
// ═══════════════════════════════════════════════════════════════════════════════

const getOrganizerReviewSummary = async (req, res) => {
  const pool   = req.app.locals.pool;
  const userId  = req.user.id;
  const { eventId } = req.params;

  // Verify organizer ownership — requestor must be the event's community organizer
  try {
    const ownerCheck = await pool.query(
      `SELECT e.id FROM events e
       JOIN communities c ON c.id = e.community_id
       WHERE e.id = $1 AND c.id IN (
         SELECT id FROM communities WHERE id IN (
           SELECT community_id FROM events WHERE id = $1
         )
       )
       -- Verify via community heads or members table matching the requesting user's account
       AND EXISTS (
         SELECT 1 FROM community_heads ch
         WHERE ch.community_id = e.community_id
           AND ch.member_id = $2
         UNION
         SELECT 1 FROM communities comm
         WHERE comm.id = e.community_id
           AND comm.id IN (
             SELECT c2.id FROM communities c2
             JOIN follows f ON f.following_id = c2.id
               AND f.following_type = 'community'
               AND f.follower_id = $2
               AND f.follower_type = 'member'
               AND f.role IN ('admin', 'moderator', 'owner')
           )
       )
       LIMIT 1`,
      [eventId, userId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied — not the event organizer' });
    }
  } catch (authErr) {
    // Fallback: check if user is the community creator/owner via simpler query
    try {
      const simpleCheck = await pool.query(
        `SELECT 1 FROM events e
         JOIN communities c ON c.id = e.community_id
         WHERE e.id = $1
           AND (
             c.created_by = $2
             OR EXISTS (SELECT 1 FROM community_heads WHERE community_id = c.id AND member_id = $2)
           )
         LIMIT 1`,
        [eventId, userId]
      );
      if (simpleCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied — not the event organizer' });
      }
    } catch (err2) {
      console.error('[ReviewController] organizer auth check error:', err2.message);
      return res.status(500).json({ error: 'Authorization check failed' });
    }
  }

  try {
    // Worth-it distribution
    const distResult = await pool.query(
      `SELECT worth_it_rating, COUNT(*) AS count
       FROM event_reviews WHERE event_id = $1
       GROUP BY worth_it_rating`,
      [eventId]
    );

    // Total review count
    const totalResult = await pool.query(
      `SELECT COUNT(*) AS total FROM event_reviews WHERE event_id = $1`,
      [eventId]
    );
    const total = parseInt(totalResult.rows[0].total, 10);

    // Tag frequency (exclude safety_concerns — those are moderation-only)
    const tagResult = await pool.query(
      `SELECT t.tag, COUNT(*) AS count
       FROM event_review_tags t
       JOIN event_reviews r ON r.id = t.review_id
       WHERE r.event_id = $1
         AND t.tag != $2
       GROUP BY t.tag
       ORDER BY count DESC
       LIMIT 20`,
      [eventId, SAFETY_CONCERNS_TAG]
    );

    // Dimension averages (distribution of each answer value per dimension)
    const dimResult = await pool.query(
      `SELECT
         rd.key,
         rd.label,
         rd.scale_labels,
         erdr.rating_value,
         COUNT(*) AS count
       FROM event_review_dimension_ratings erdr
       JOIN event_reviews er ON er.id = erdr.review_id
       JOIN review_dimensions rd ON rd.id = erdr.dimension_id
       WHERE er.event_id = $1
       GROUP BY rd.key, rd.label, rd.scale_labels, erdr.rating_value
       ORDER BY rd.key, erdr.rating_value`,
      [eventId]
    );

    // Group dimension data by key
    const dimensionMap = {};
    for (const row of dimResult.rows) {
      if (!dimensionMap[row.key]) {
        dimensionMap[row.key] = {
          key: row.key,
          label: row.label,
          scale_labels: row.scale_labels,
          distribution: {},
        };
      }
      dimensionMap[row.key].distribution[row.rating_value] = parseInt(row.count, 10);
    }

    // Build worth_it % distribution
    const worthItDist = {};
    for (const r of distResult.rows) {
      worthItDist[r.worth_it_rating] = {
        count: parseInt(r.count, 10),
        percentage: total > 0 ? Math.round((parseInt(r.count, 10) / total) * 100) : 0,
      };
    }

    return res.json({
      total_reviews:      total,
      worth_it_distribution: worthItDist,
      top_tags:           tagResult.rows.map(r => ({ tag: r.tag, count: parseInt(r.count, 10) })),
      dimensions:         Object.values(dimensionMap),
    });
  } catch (err) {
    console.error('[ReviewController] getOrganizerReviewSummary error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch review summary' });
  }
};

module.exports = {
  getEventDimensions,
  submitEventReview,
  submitOpenPlanReview,
  getUserReputation,
  getOrganizerReviewSummary,
};
