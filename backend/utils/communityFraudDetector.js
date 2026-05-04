/**
 * Community Fraud Detector
 *
 * Five detection rules that run as part of the weekly learning job.
 * Rules 1, 2, and 5 are batch (weekly). Rules 3 and 4 are event-driven
 * (called in real-time from RSVP creation and post sponsorship endpoints).
 *
 * All rules share the insertCommunityFlag helper which deduplicates flags
 * and immediately recalculates the affected community's health score.
 *
 * Schema references (from your codebase):
 *   - event_registrations   → RSVP table (member_id, event_id, registration_status)
 *   - ticket_types          → base_price for paid event detection
 *   - razorpay_payments     → verified payment source of truth
 *   - follow_events         → used for follow-loop detection (from Prompt 2 learning job)
 */

const { recalculateCommunityHealthScore } = require('./communityHealthScore');

// ─── Rule 1: RSVP-to-Attendance Ratio Anomaly ─────────────────────────────
// Community's average attendance/registration ratio consistently exceeds
// the platform average by more than 2 standard deviations.
// Note: We use event_registrations as the RSVP source of truth.
const detectRsvpStuffing = async (pool) => {
  console.log('[CommunityFraud] Running RSVP stuffing detection...');

  try {
    // Get platform-wide average attendance ratio
    // We don't have an attended_count column — we use registration_status = 'attended'
    // if it exists, otherwise fall back to 'registered' as a proxy.
    const platformStats = await pool.query(`
      SELECT
        AVG(attendance_ratio) AS avg_ratio,
        STDDEV(attendance_ratio) AS stddev_ratio
      FROM (
        SELECT
          event_id,
          COUNT(*) FILTER (WHERE registration_status IN ('attended', 'registered')) AS rsvp_count,
          COUNT(*) FILTER (WHERE registration_status = 'attended') AS attended_count,
          COUNT(*) FILTER (WHERE registration_status = 'attended')::float
            / NULLIF(COUNT(*) FILTER (WHERE registration_status IN ('attended', 'registered')), 0)
            AS attendance_ratio
        FROM event_registrations
        WHERE created_at >= NOW() - INTERVAL '90 days'
        GROUP BY event_id
        HAVING COUNT(*) FILTER (WHERE registration_status IN ('attended', 'registered')) >= 10
      ) event_stats
    `);

    const { avg_ratio, stddev_ratio } = platformStats.rows[0];
    if (!avg_ratio || !stddev_ratio) {
      console.log('[CommunityFraud] Not enough data for RSVP stuffing detection — skipping');
      return;
    }

    const suspiciousThreshold = parseFloat(avg_ratio) + 2 * parseFloat(stddev_ratio);

    // Find communities consistently above threshold across 3+ events
    const suspicious = await pool.query(`
      SELECT
        e.community_id,
        COUNT(DISTINCT e.id) AS event_count,
        AVG(
          COUNT(*) FILTER (WHERE er.registration_status = 'attended')::float
          / NULLIF(COUNT(*) FILTER (WHERE er.registration_status IN ('attended', 'registered')), 0)
        ) OVER (PARTITION BY e.community_id) AS avg_attendance_ratio,
        SUM(COUNT(*) FILTER (WHERE er.registration_status IN ('attended', 'registered'))) OVER (PARTITION BY e.community_id) AS total_rsvps,
        SUM(COUNT(*) FILTER (WHERE er.registration_status = 'attended')) OVER (PARTITION BY e.community_id) AS total_attended
      FROM events e
      JOIN event_registrations er ON er.event_id = e.id
      WHERE e.created_at >= NOW() - INTERVAL '90 days'
      GROUP BY e.community_id, e.id
      HAVING COUNT(*) FILTER (WHERE er.registration_status IN ('attended', 'registered')) >= 10
    `);

    // Aggregate by community — a single query with window functions gets duplicated rows
    const communityMap = new Map();
    for (const row of suspicious.rows) {
      const cid = row.community_id;
      if (!communityMap.has(cid)) {
        communityMap.set(cid, {
          community_id: cid,
          event_count: parseInt(row.event_count),
          avg_attendance_ratio: parseFloat(row.avg_attendance_ratio),
          total_rsvps: parseInt(row.total_rsvps),
          total_attended: parseInt(row.total_attended),
        });
      }
    }

    for (const data of communityMap.values()) {
      if (data.event_count >= 3 && data.avg_attendance_ratio > suspiciousThreshold) {
        await insertCommunityFlag(pool, {
          communityId: data.community_id,
          flagType: 'rsvp_stuffing',
          severity: data.avg_attendance_ratio > 0.95 ? 'high' : 'medium',
          evidence: {
            avg_attendance_ratio: data.avg_attendance_ratio,
            platform_avg: parseFloat(avg_ratio),
            suspicious_threshold: suspiciousThreshold,
            event_count: data.event_count,
            total_rsvps: data.total_rsvps,
            total_attended: data.total_attended,
          },
        });
      }
    }

    console.log('[CommunityFraud] RSVP stuffing check complete');
  } catch (err) {
    console.error('[CommunityFraud] detectRsvpStuffing error:', err.message);
  }
};

// ─── Rule 2: Unverified Ticket Price ──────────────────────────────────────
// Event claims to be paid (ticket_types with base_price > 0) but has
// zero verified Razorpay payments. Only flags events with 10+ registrations.
const detectUnverifiedTicketPrices = async (pool) => {
  console.log('[CommunityFraud] Running ticket price verification...');

  try {
    const suspicious = await pool.query(`
      SELECT
        e.id AS event_id,
        e.community_id,
        MIN(tt.base_price) AS min_ticket_price,
        COUNT(DISTINCT er.id) AS rsvp_count,
        COUNT(DISTINCT rp.id) AS verified_payment_count
      FROM events e
      JOIN ticket_types tt ON tt.event_id = e.id AND tt.is_active = true AND tt.base_price > 0
      LEFT JOIN event_registrations er ON er.event_id = e.id
        AND er.registration_status NOT IN ('cancelled')
      LEFT JOIN razorpay_payments rp ON rp.event_id = e.id
        AND rp.status = 'captured'
        AND rp.webhook_verified = true
        AND rp.amount_paise >= (tt.base_price * 100 * 0.9)
      WHERE e.created_at >= NOW() - INTERVAL '90 days'
        AND (e.is_cancelled = false OR e.is_cancelled IS NULL)
      GROUP BY e.id, e.community_id
      HAVING COUNT(DISTINCT er.id) >= 10
        AND COUNT(DISTINCT rp.id) = 0
    `);

    for (const row of suspicious.rows) {
      await insertCommunityFlag(pool, {
        communityId: row.community_id,
        flagType: 'unverified_ticket_price',
        eventId: row.event_id,
        severity: 'high', // high — directly corrupts AQI signal quality
        evidence: {
          min_ticket_price_rupees: parseFloat(row.min_ticket_price),
          rsvp_count: parseInt(row.rsvp_count),
          verified_payments_found: 0,
        },
      });
    }

    console.log('[CommunityFraud] Ticket price verification complete');
  } catch (err) {
    console.error('[CommunityFraud] detectUnverifiedTicketPrices error:', err.message);
  }
};

// ─── Rule 3: Dummy Account RSVPs ──────────────────────────────────────────
// Called in real-time after a new RSVP is created.
// Flags if >40% of RSVPs for an event come from accounts created in the last 7 days.
const checkForDummyAccountRsvps = async (pool, eventId) => {
  try {
    const result = await pool.query(`
      SELECT
        e.community_id,
        COUNT(er.id) AS total_rsvps,
        COUNT(er.id) FILTER (WHERE m.created_at >= NOW() - INTERVAL '7 days') AS new_account_rsvps,
        COUNT(er.id) FILTER (WHERE m.created_at >= NOW() - INTERVAL '7 days')::float
          / NULLIF(COUNT(er.id), 0) AS new_account_ratio
      FROM events e
      JOIN event_registrations er ON er.event_id = e.id
        AND er.registration_status NOT IN ('cancelled')
      JOIN members m ON m.id = er.member_id
      WHERE e.id = $1
      GROUP BY e.community_id
    `, [eventId]);

    if (result.rows.length === 0) return;
    const row = result.rows[0];

    const totalRsvps = parseInt(row.total_rsvps);
    const newAccountRatio = parseFloat(row.new_account_ratio);

    if (totalRsvps >= 20 && newAccountRatio > 0.40) {
      await insertCommunityFlag(pool, {
        communityId: row.community_id,
        flagType: 'dummy_account_rsvps',
        eventId: parseInt(eventId),
        severity: newAccountRatio > 0.60 ? 'high' : 'medium',
        evidence: {
          total_rsvps: totalRsvps,
          new_account_rsvps: parseInt(row.new_account_rsvps),
          new_account_ratio: newAccountRatio,
          threshold: 0.40,
        },
      });
    }
  } catch (err) {
    // Non-fatal — never block RSVP creation
    console.error('[CommunityFraud] checkForDummyAccountRsvps error:', err.message);
  }
};

// ─── Rule 4: Sponsored Content Engagement Spike ───────────────────────────
// Called 24 hours after a post is marked as sponsored.
// Flags if >65% of 24-hour engagement happened in the first hour.
const detectEngagementSpike = async (pool, postId) => {
  try {
    // Uses post_likes as a proxy for engagement.
    // Adjust to your actual engagement table if you have a dedicated one.
    const result = await pool.query(`
      SELECT
        p.community_id,
        COUNT(pl.id) AS total_engagements,
        COUNT(pl.id) FILTER (WHERE pl.created_at <= p.created_at + INTERVAL '1 hour') AS first_hour_engagements
      FROM posts p
      LEFT JOIN post_likes pl ON pl.post_id = p.id
        AND pl.created_at <= p.created_at + INTERVAL '24 hours'
      WHERE p.id = $1
      GROUP BY p.community_id, p.created_at
    `, [postId]);

    if (result.rows.length === 0) return;
    const row = result.rows[0];

    const total = parseInt(row.total_engagements);
    const firstHour = parseInt(row.first_hour_engagements);

    if (total < 50) return; // Not enough data

    const firstHourRatio = firstHour / total;

    if (firstHourRatio > 0.65) {
      await insertCommunityFlag(pool, {
        communityId: row.community_id,
        flagType: 'engagement_spike',
        severity: firstHourRatio > 0.80 ? 'high' : 'medium',
        evidence: {
          total_24hr_engagements: total,
          first_hour_engagements: firstHour,
          first_hour_ratio: firstHourRatio,
          threshold: 0.65,
          post_id: parseInt(postId),
        },
      });
    }
  } catch (err) {
    console.error('[CommunityFraud] detectEngagementSpike error:', err.message);
  }
};

// ─── Rule 5: Cross-Community Follow Coordination ──────────────────────────
// Flags communities with 10+ mutual follow pairs in a 7-day window.
const detectFollowCoordination = async (pool) => {
  console.log('[CommunityFraud] Running follow coordination detection...');

  try {
    // Using the follow_events table referenced in learnDemographicScores.js
    const suspicious = await pool.query(`
      SELECT
        fe.creator_id AS community_id,
        COUNT(*) AS mutual_follow_count
      FROM follow_events fe
      WHERE fe.followed_at >= NOW() - INTERVAL '7 days'
        AND EXISTS (
          SELECT 1 FROM follow_events fe2
          WHERE fe2.follower_id = fe.creator_id
            AND fe2.creator_id = fe.follower_id
            AND fe2.followed_at >= NOW() - INTERVAL '7 days'
        )
      GROUP BY fe.creator_id
      HAVING COUNT(*) >= 10
    `);

    for (const row of suspicious.rows) {
      await insertCommunityFlag(pool, {
        communityId: row.community_id,
        flagType: 'follow_coordination',
        severity: 'medium',
        evidence: {
          mutual_follow_count: parseInt(row.mutual_follow_count),
          detection_window: '7 days',
        },
      });
    }

    console.log('[CommunityFraud] Follow coordination check complete');
  } catch (err) {
    console.error('[CommunityFraud] detectFollowCoordination error:', err.message);
  }
};

// ─── Shared Helper: Insert flag + deduplicate ─────────────────────────────
const insertCommunityFlag = async (pool, {
  communityId,
  flagType,
  eventId = null,
  severity,
  evidence,
}) => {
  try {
    // Check if same flag already exists and is unresolved within 7 days
    const existing = await pool.query(`
      SELECT id FROM community_fraud_signals
      WHERE community_id = $1
        AND flag_type = $2
        AND (event_id = $3 OR ($3 IS NULL AND event_id IS NULL))
        AND flagged_at >= NOW() - INTERVAL '7 days'
        AND resolved = false
    `, [communityId, flagType, eventId]);

    if (existing.rows.length > 0) return; // Already flagged recently

    await pool.query(`
      INSERT INTO community_fraud_signals
        (community_id, flag_type, event_id, severity, evidence)
      VALUES ($1, $2, $3, $4, $5)
    `, [communityId, flagType, eventId, severity, JSON.stringify(evidence)]);

    console.log(`[CommunityFraud] Flagged community ${communityId}: ${flagType} (${severity})`);

    // Immediately recalculate health score for this community
    await recalculateCommunityHealthScore(pool, communityId);
  } catch (err) {
    console.error('[CommunityFraud] insertCommunityFlag error:', err.message);
  }
};

module.exports = {
  detectRsvpStuffing,
  detectUnverifiedTicketPrices,
  checkForDummyAccountRsvps,
  detectEngagementSpike,
  detectFollowCoordination,
};
