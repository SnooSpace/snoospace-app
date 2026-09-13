'use strict';

/**
 * scheduleReviewPrompts.js
 *
 * Two cron functions registered at different intervals in schedulerService.js:
 *
 *   scheduleReviewPrompts(pool)  — runs every 15 min
 *     Finds events/plans that ended since last scan; inserts review_prompts_queue rows.
 *     Scheduled_for = event end_time + 3 hours.
 *     Expires_at    = scheduled_for + 7 days (after this, the review window is closed).
 *     Skips users who have already received a prompt for this event/plan.
 *
 *   deliverReviewPrompts(pool)   — runs every 15 min (1-min offset from scheduler)
 *     Finds pending rows where scheduled_for <= NOW() and expires_at > NOW().
 *     Throttle: if a user received ANY review prompt in the last 24h, bump to next 15-min slot.
 *     Sends push notification with deep-link data.
 *     Marks expired rows as 'expired'.
 */

const { createPool } = require('../config/db');

// Lazy-load pushService to avoid circular dependency during startup
function getPushService() {
  return require('../services/pushService');
}

const PROMPT_DELAY_HOURS  = 3;    // hours after event/plan end before prompting
const PROMPT_EXPIRE_DAYS  = 7;    // review window duration
const THROTTLE_HOURS      = 24;   // minimum gap between review prompts per user

// ═══════════════════════════════════════════════════════════════════════════════
// scheduleReviewPrompts
// Inserts queue rows for events/plans that recently ended.
// ═══════════════════════════════════════════════════════════════════════════════

async function scheduleReviewPrompts(pool) {
  const start = Date.now();

  try {
    // ── Events: registrations for events that ended in the last 3h–6h window ──
    // (so we only pick up newly-ended events each pass without re-inserting)
    await scheduleEventPrompts(pool);

    // ── Open Plans: completed plans ──
    await schedulePlanPrompts(pool);

    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`[ReviewPromptScheduler] ✔ Schedule pass done in ${elapsed}s`);
  } catch (err) {
    console.error('[ReviewPromptScheduler] scheduleReviewPrompts error:', err.message);
  }
}

async function scheduleEventPrompts(pool) {
  // Find attended registrations for events that ended between (now - 7h) and (now - 3h)
  // — so we schedule prompts for events that ended recently, not replaying the past
  const { rows } = await pool.query(`
    SELECT er.member_id AS user_id, e.id AS event_id,
           e.end_datetime AS end_time
    FROM event_registrations er
    JOIN events e ON e.id = er.event_id
    WHERE e.end_datetime
            BETWEEN (NOW() - INTERVAL '7 hours') AND (NOW() - INTERVAL '${PROMPT_DELAY_HOURS} hours')
      AND er.registration_status IN ('attended', 'confirmed', 'registered')
      -- Skip if a prompt already exists for this user + event
      AND NOT EXISTS (
        SELECT 1 FROM review_prompts_queue rpq
        WHERE rpq.user_id     = er.member_id
          AND rpq.source_type = 'event'
          AND rpq.source_id   = e.id
      )
      -- Skip if user already reviewed this event
      AND NOT EXISTS (
        SELECT 1 FROM event_reviews rev
        WHERE rev.event_id = e.id AND rev.user_id = er.member_id
      )
  `);

  let inserted = 0;
  for (const row of rows) {
    const scheduledFor = new Date(row.end_time);
    scheduledFor.setHours(scheduledFor.getHours() + PROMPT_DELAY_HOURS);
    const expiresAt = new Date(scheduledFor);
    expiresAt.setDate(expiresAt.getDate() + PROMPT_EXPIRE_DAYS);

    await pool.query(`
      INSERT INTO review_prompts_queue (user_id, source_type, source_id, scheduled_for, expires_at)
      VALUES ($1, 'event', $2, $3, $4)
      ON CONFLICT DO NOTHING
    `, [row.user_id, row.event_id, scheduledFor.toISOString(), expiresAt.toISOString()]);
    inserted++;
  }

  if (inserted > 0) console.log(`[ReviewPromptScheduler] Queued ${inserted} event prompts`);
}

async function schedulePlanPrompts(pool) {
  // Find approved open plan attendees for plans completed in the recent window
  const { rows } = await pool.query(`
    SELECT opr.requester_id AS user_id, op.id AS plan_id, op.expires_at
    FROM open_plan_requests opr
    JOIN open_plans op ON op.id = opr.plan_id
    WHERE op.status = 'completed'
      AND op.expires_at BETWEEN (NOW() - INTERVAL '7 hours') AND (NOW() - INTERVAL '${PROMPT_DELAY_HOURS} hours')
      AND opr.status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM review_prompts_queue rpq
        WHERE rpq.user_id     = opr.requester_id
          AND rpq.source_type = 'open_plan'
          AND rpq.source_id   = op.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM open_plan_reviews rev
        WHERE rev.open_plan_id = op.id AND rev.user_id = opr.requester_id
      )
  `);

  // Also queue the host — only if at least one attendee was approved
  const { rows: hostRows } = await pool.query(`
    SELECT op.created_by AS user_id, op.id AS plan_id, op.expires_at
    FROM open_plans op
    WHERE op.status = 'completed'
      AND op.expires_at BETWEEN (NOW() - INTERVAL '7 hours') AND (NOW() - INTERVAL '${PROMPT_DELAY_HOURS} hours')
      AND EXISTS (
        SELECT 1 FROM open_plan_requests opr
        WHERE opr.plan_id = op.id AND opr.status = 'approved'
      )
      AND NOT EXISTS (
        SELECT 1 FROM review_prompts_queue rpq
        WHERE rpq.user_id     = op.created_by
          AND rpq.source_type = 'open_plan'
          AND rpq.source_id   = op.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM open_plan_reviews rev
        WHERE rev.open_plan_id = op.id AND rev.user_id = op.created_by
      )
  `);

  const allRows = [...rows, ...hostRows];
  let inserted = 0;

  for (const row of allRows) {
    const scheduledFor = new Date(row.expires_at);
    scheduledFor.setHours(scheduledFor.getHours() + PROMPT_DELAY_HOURS);
    const expiresAt = new Date(scheduledFor);
    expiresAt.setDate(expiresAt.getDate() + PROMPT_EXPIRE_DAYS);

    await pool.query(`
      INSERT INTO review_prompts_queue (user_id, source_type, source_id, scheduled_for, expires_at)
      VALUES ($1, 'open_plan', $2, $3, $4)
      ON CONFLICT DO NOTHING
    `, [row.user_id, row.plan_id, scheduledFor.toISOString(), expiresAt.toISOString()]);
    inserted++;
  }

  if (inserted > 0) console.log(`[ReviewPromptScheduler] Queued ${inserted} open plan prompts`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// deliverReviewPrompts
// Sends push notifications & in-app notifications for due prompts with throttle guard.
// ═══════════════════════════════════════════════════════════════════════════════

async function deliverReviewPrompts(pool) {
  const start = Date.now();

  try {
    // Mark expired rows first
    const { rowCount: expiredCount } = await pool.query(`
      UPDATE review_prompts_queue
      SET status = 'expired'
      WHERE status = 'pending' AND expires_at < NOW()
    `);
    if (expiredCount > 0) {
      console.log(`[ReviewPromptDelivery] Marked ${expiredCount} prompts as expired`);
    }

    // Fetch due prompts with source metadata
    const { rows: due } = await pool.query(`
      SELECT rpq.id, rpq.user_id, rpq.source_type, rpq.source_id, rpq.expires_at,
             CASE
               WHEN rpq.source_type = 'event' THEN e.title
               WHEN rpq.source_type = 'open_plan' THEN op.title
             END AS source_title,
             CASE
               WHEN rpq.source_type = 'event' THEN e.community_id
               WHEN rpq.source_type = 'open_plan' THEN op.created_by
             END AS actor_id,
             CASE
               WHEN rpq.source_type = 'event' THEN 'community'
               WHEN rpq.source_type = 'open_plan' THEN 'member'
             END AS actor_type
      FROM review_prompts_queue rpq
      LEFT JOIN events e ON rpq.source_type = 'event' AND rpq.source_id = e.id
      LEFT JOIN open_plans op ON rpq.source_type = 'open_plan' AND rpq.source_id = op.id
      WHERE rpq.status = 'pending'
        AND rpq.scheduled_for <= NOW()
        AND rpq.expires_at > NOW()
      ORDER BY rpq.scheduled_for ASC
      LIMIT 500
    `);

    let sent = 0, throttled = 0;

    for (const prompt of due) {
      // Throttle: skip if user received any review prompt in last THROTTLE_HOURS
      const recentCheck = await pool.query(`
        SELECT 1 FROM review_prompts_queue
        WHERE user_id   = $1
          AND status    = 'sent'
          AND sent_at   > NOW() - INTERVAL '${THROTTLE_HOURS} hours'
        LIMIT 1
      `, [prompt.user_id]);

      if (recentCheck.rows.length > 0) {
        // Bump scheduled_for by 15 min (next delivery slot)
        await pool.query(`
          UPDATE review_prompts_queue
          SET status = 'skipped_throttled', scheduled_for = NOW() + INTERVAL '15 minutes'
          WHERE id = $1
        `, [prompt.id]);
        throttled++;
        continue;
      }

      const rawTitle = prompt.source_title || (prompt.source_type === 'event' ? 'Event' : 'Open Plan');

      // Build notification payload
      const title = prompt.source_type === 'event'
        ? '⭐ How was the event?'
        : '👋 How did it go?';
      const body = prompt.source_type === 'event'
        ? `Share your thoughts on "${rawTitle}" — takes less than a minute.`
        : `How was "${rawTitle}"? Let us know if you'd meet up again.`;

      const deepLinkData = {
        type:        'review_prompt',
        sourceType:  prompt.source_type,
        sourceId:    prompt.source_id,
        sourceTitle: rawTitle,
        expiresAt:   prompt.expires_at,
      };

      // 1. Create in-app notification
      try {
        const notificationService = require('../services/notificationService');
        await notificationService.createSimpleNotification(pool, {
          recipientId:   prompt.user_id,
          recipientType: 'member',
          actorId:       prompt.actor_id || prompt.user_id,
          actorType:     prompt.actor_type || 'member',
          type:          'review_prompt',
          payload: {
            sourceType:  prompt.source_type,
            sourceId:    prompt.source_id,
            sourceTitle: rawTitle,
            expiresAt:   prompt.expires_at,
          },
        });
      } catch (inAppErr) {
        console.error(`[ReviewPromptDelivery] In-app notification failed for user ${prompt.user_id}:`, inAppErr.message);
      }

      // 2. Fetch user's push token
      const tokenResult = await pool.query(`
        SELECT expo_push_token AS push_token FROM push_tokens
        WHERE user_id = $1 AND user_type = 'member' AND is_active = true AND expo_push_token IS NOT NULL
        ORDER BY updated_at DESC LIMIT 1
      `, [prompt.user_id]);

      if (tokenResult.rows.length === 0) {
        // No push token — in-app was created, mark queue row as sent
        await pool.query(`
          UPDATE review_prompts_queue SET status = 'sent', sent_at = NOW() WHERE id = $1
        `, [prompt.id]);
        sent++;
        continue;
      }

      // 3. Dispatch push notification
      try {
        const pushService = getPushService();
        await pushService.sendPushNotification(
          pool,
          prompt.user_id,
          "member",
          title,
          body,
          deepLinkData
        );

        await pool.query(`
          UPDATE review_prompts_queue SET status = 'sent', sent_at = NOW() WHERE id = $1
        `, [prompt.id]);
        sent++;
      } catch (pushErr) {
        // Non-fatal — log but don't fail the whole batch
        console.error(
          `[ReviewPromptDelivery] Push failed for user ${prompt.user_id}:`,
          pushErr.message
        );
      }
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`[ReviewPromptDelivery] sent=${sent} throttled=${throttled} in ${elapsed}s`);
  } catch (err) {
    console.error('[ReviewPromptDelivery] Error:', err.message);
  }
}

module.exports = { scheduleReviewPrompts, deliverReviewPrompts };
