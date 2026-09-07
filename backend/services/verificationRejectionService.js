/**
 * verificationRejectionService.js
 *
 * Handles the downstream cascade triggered when a user's Plans-scope
 * verification is rejected (either automated no_match or manual admin review).
 *
 * Called from verificationsController.js — both rejection paths:
 *   1. submitVerification() background block — automated 'no_match' branch
 *   2. adminReview() PATCH — manual rejection branch
 *
 * Exported: handleVerificationRejection(pool, io, userId, scope)
 */

const { createSimpleNotification } = require('./notificationService');
const { cancelPlanCore } = require('../controllers/plansController');

// ---------------------------------------------------------------------------
// handleVerificationRejection
// ---------------------------------------------------------------------------
/**
 * @param {Pool}   pool   - pg Pool from req.app.locals.pool
 * @param {Object} io     - Socket.io instance from req.app.locals.io (may be null)
 * @param {number} userId - ID of the member whose verification was rejected
 * @param {string} scope  - 'plans' | 'discover'
 */
async function handleVerificationRejection(pool, io, userId, scope) {
  // Only Plans-scope rejections trigger a cascade.
  // Discover rejections are entirely unaffected by this logic.
  if (scope !== 'plans') {
    return;
  }

  try {
    // ── 1. Block the user from hosting / joining Open Plans ──────────────────
    await pool.query(
      `UPDATE members SET plans_access_blocked = TRUE WHERE id = $1`,
      [userId]
    );

    // ── 2. Fetch the user's name for notification payloads ───────────────────
    const memberR = await pool.query(
      `SELECT name FROM members WHERE id = $1`,
      [userId]
    );
    const userName = memberR.rows[0]?.name || 'Someone';

    // ── 3. Auto-decline this user's own pending join requests on OTHER plans ─
    // No in-app notification needed here — the user already received a
    // verification_status_updated socket event with scope and status='rejected'.
    await pool.query(
      `UPDATE open_plan_requests
       SET status = 'declined', responded_at = NOW()
       WHERE requester_id = $1 AND status = 'pending'`,
      [userId]
    );

    // ── 4. Handle plans where THIS USER is an APPROVED attendee ─────────────
    // Notify the host: their call whether to keep or remove this attendee.
    const approvedRequestsR = await pool.query(
      `SELECT opr.plan_id, op.title AS plan_title, op.created_by AS host_id
       FROM open_plan_requests opr
       JOIN open_plans op ON op.id = opr.plan_id
       WHERE opr.requester_id = $1
         AND opr.status = 'approved'
         AND op.status IN ('active', 'closed')`,
      [userId]
    );

    for (const row of approvedRequestsR.rows) {
      try {
        await createSimpleNotification(pool, {
          recipientId:   row.host_id,
          recipientType: 'member',
          actorId:       userId,
          actorType:     'member',
          type:          'plan_attendee_ver_failed',
          payload: {
            planId:       row.plan_id,
            planTitle:    row.plan_title,
            attendeeName: userName,
            message:      `${userName} failed identity verification. It's your call whether to keep or remove them from "${row.plan_title}".`,
          },
        });
      } catch (e) {
        console.warn(
          '[verificationRejectionService] Failed to notify host for plan',
          row.plan_id, e.message
        );
      }
    }

    // ── 5. Handle plans that THIS USER is HOSTING ────────────────────────────
    const hostedPlansR = await pool.query(
      `SELECT id, title FROM open_plans
       WHERE created_by = $1
         AND status IN ('active', 'closed')`,
      [userId]
    );

    for (const plan of hostedPlansR.rows) {
      const planId = plan.id;

      // Count accepted attendees for this plan
      const countR = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM open_plan_requests
         WHERE plan_id = $1 AND status = 'approved'`,
        [planId]
      );
      const acceptedCount = countR.rows[0]?.count ?? 0;

      if (acceptedCount === 0) {
        // ── 5a. No accepted attendees → auto-cancel the plan ─────────────────
        // cancelPlanCore handles: mark cancelled + push-notify pending requesters.
        await cancelPlanCore(
          pool,
          planId,
          plan,
          `"${plan.title}" was taken down because the host failed identity verification.`
        );

        // Send an in-app notification row to every requester for this plan
        // (cancelPlanCore already sent push notifications to the pending ones;
        // this inserts a DB notifications row so it appears in the feed).
        // Step 3 has already flipped their status to 'declined', so we query
        // all distinct requesters for the plan without filtering on status.
        const allRequestersR = await pool.query(
          `SELECT DISTINCT requester_id FROM open_plan_requests WHERE plan_id = $1`,
          [planId]
        );
        for (const req of allRequestersR.rows) {
          try {
            await createSimpleNotification(pool, {
              recipientId:   req.requester_id,
              recipientType: 'member',
              actorId:       userId,
              actorType:     'member',
              type:          'plan_host_ver_takedown',
              payload: {
                planId,
                planTitle: plan.title,
                message:   `"${plan.title}" was taken down because the host failed identity verification.`,
              },
            });
          } catch (e) {
            console.warn(
              '[verificationRejectionService] Failed to notify requester',
              req.requester_id, 'for plan', planId, e.message
            );
          }
        }
      } else {
        // ── 5b. Has accepted attendees → do NOT cancel, notify each approved attendee ─
        const approvedAttendeesR = await pool.query(
          `SELECT requester_id FROM open_plan_requests
           WHERE plan_id = $1 AND status = 'approved'`,
          [planId]
        );
        for (const attendee of approvedAttendeesR.rows) {
          try {
            await createSimpleNotification(pool, {
              recipientId:   attendee.requester_id,
              recipientType: 'member',
              actorId:       userId,
              actorType:     'member',
              type:          'plan_host_ver_failed',
              payload: {
                planId,
                planTitle: plan.title,
                message:   `The host of "${plan.title}" failed identity verification. It's your call whether to still attend.`,
              },
            });
          } catch (e) {
            console.warn(
              '[verificationRejectionService] Failed to notify attendee',
              attendee.requester_id, 'for plan', planId, e.message
            );
          }
        }
      }
    }
  } catch (err) {
    // The cascade is non-fatal relative to the verification update itself
    // (the caller has already updated user_verifications and emitted the socket event).
    // Log and swallow to avoid disrupting the HTTP response.
    console.error('[verificationRejectionService.handleVerificationRejection] Error:', err);
  }
}

module.exports = { handleVerificationRejection };
