/**
 * eventCancellationService.js
 *
 * Implements cancelEventWithRefunds — the authoritative cancellation path
 * for both organizer and admin cancel endpoints.
 *
 * What it does:
 *   1. Guards: already-cancelled check, past-event note (non-blocking for admin)
 *   2. Marks event: is_cancelled=true, cancelled_at=NOW(), payout_hold=true
 *   3. For every paid registration (status IN 'registered','attended'):
 *      a. Finds the Razorpay payment via two-step lookup:
 *         - Primary: razorpay_orders.registration_id (populated post-webhook)
 *         - Fallback: razorpay_payments JOIN via (user_id + event_id) heuristic
 *      b. Creates a refund_requests row: trigger_source='system_cancellation',
 *         status='auto_approved', bypasses refund_policy entirely
 *      c. Executes Razorpay refund for the FULL amount (no fee deduction)
 *      d. Per-registration isolation: one failure does not abort the batch
 *   4. Fires in-app notifications (event_cancelled type, existing pattern)
 *   5. Fires real push notifications via sendBulkPushNotifications (not a TODO)
 *
 * Downstream reconciliation (registration cancellation, sold_count decrement,
 * refund_amount population) is handled by the existing refund.created webhook
 * in routes/webhooks.js — no duplication here.
 *
 * PAYMENT LOOKUP PATH (reported for transparency):
 *   Primary: razorpay_orders.registration_id → razorpay_payments.razorpay_order_id
 *   Fallback: razorpay_payments WHERE (user_id=member_id AND event_id=event_id AND status='captured')
 *   The fallback is the same heuristic used by approveRefundRequest and handleRefundCreated.
 *   The primary path requires the payment.captured webhook to have already fired
 *   (it writes registration_id back to the order at line 206 of webhooks.js).
 *
 * ATTENDED REGISTRATIONS:
 *   Both 'registered' and 'attended' statuses are included. If an event is
 *   cancelled after some attendees already scanned in (same-day cancel), those
 *   attendees deserve a refund — the event was cancelled regardless of check-in
 *   status. Excluding them would penalize early arrivals unfairly.
 */

const notificationService = require('./notificationService');
const pushService = require('./pushService');
const { executeRazorpayRefund } = require('../utils/razorpayRefundExecutor');

/**
 * Cancel an event and initiate full refunds for all paid registrations.
 *
 * @param {Pool}   pool            - pg Pool
 * @param {number} eventId         - The event to cancel
 * @param {number} cancelledById   - ID of the actor (community ID or admin ID)
 * @param {string} cancelledByType - 'community' | 'admin'
 * @returns {Promise<Object>} Summary of the cancellation result
 */
const cancelEventWithRefunds = async (pool, eventId, cancelledById, cancelledByType) => {
  // ── 1. Fetch event and guard: already-cancelled ────────────────────────────
  const eventResult = await pool.query(
    `SELECT e.id, e.title, e.is_cancelled, e.end_datetime, e.creator_id,
            c.name AS community_name, c.logo_url AS community_logo
     FROM events e
     LEFT JOIN communities c ON c.id = e.creator_id
     WHERE e.id = $1`,
    [eventId],
  );

  if (eventResult.rows.length === 0) {
    const err = new Error('Event not found');
    err.statusCode = 404;
    throw err;
  }

  const event = eventResult.rows[0];

  if (event.is_cancelled) {
    const err = new Error('Event is already cancelled');
    err.statusCode = 400;
    err.code = 'ALREADY_CANCELLED';
    throw err;
  }

  // Note (non-blocking): flag if the event is already in the past.
  // Admin may legitimately cancel a past event retroactively.
  const isPastEvent = event.end_datetime && new Date(event.end_datetime) < new Date();

  // ── 2. Mark event as cancelled (single atomic UPDATE) ─────────────────────
  await pool.query(
    `UPDATE events
     SET is_cancelled = true,
         cancelled_at = NOW(),
         payout_hold  = true,
         updated_at   = NOW()
     WHERE id = $1`,
    [eventId],
  );

  console.log(
    `[CancellationService] Event ${eventId} ("${event.title}") marked cancelled` +
    ` by ${cancelledByType}_${cancelledById}. payout_hold=true.`,
  );

  // ── 3. Fetch all affected registrations ───────────────────────────────────
  // Include 'attended' — see module-level comment for rationale.
  const registrationsResult = await pool.query(
    `SELECT er.id AS registration_id,
            er.member_id,
            er.total_amount,
            er.registration_status,
            m.name AS member_name
     FROM event_registrations er
     JOIN members m ON m.id = er.member_id
     WHERE er.event_id = $1
       AND er.registration_status IN ('registered', 'attended')`,
    [eventId],
  );

  const registrations = registrationsResult.rows;
  console.log(
    `[CancellationService] Found ${registrations.length} registration(s) to process for event ${eventId}`,
  );

  // ── 4. Per-registration refund loop ───────────────────────────────────────
  let refundedCount   = 0;
  let totalRefundedRupees = 0;
  const failures = [];
  const refundedMemberIds = [];

  for (const reg of registrations) {
    try {
      // ── 4a. Find the Razorpay payment ──────────────────────────────────────
      // Primary path: via razorpay_orders.registration_id (set by payment webhook)
      let paymentRow = null;
      let lookupPath = 'unknown';

      const primaryLookup = await pool.query(
        `SELECT rp.razorpay_payment_id, rp.amount_paise
         FROM razorpay_payments rp
         JOIN razorpay_orders ro ON ro.razorpay_order_id = rp.razorpay_order_id
         WHERE ro.registration_id = $1
           AND rp.status = 'captured'
         ORDER BY rp.created_at DESC
         LIMIT 1`,
        [reg.registration_id],
      );

      if (primaryLookup.rows.length > 0) {
        paymentRow = primaryLookup.rows[0];
        lookupPath = 'orders.registration_id';
      } else {
        // Fallback: same heuristic used by approveRefundRequest & handleRefundCreated
        const fallbackLookup = await pool.query(
          `SELECT rp.razorpay_payment_id, rp.amount_paise
           FROM razorpay_payments rp
           WHERE rp.user_id  = $1
             AND rp.event_id = $2
             AND rp.status   = 'captured'
           ORDER BY rp.created_at DESC
           LIMIT 1`,
          [reg.member_id, eventId],
        );

        if (fallbackLookup.rows.length > 0) {
          paymentRow = fallbackLookup.rows[0];
          lookupPath = 'user_id+event_id heuristic (fallback)';
        }
      }

      if (!paymentRow) {
        // Free registration or payment not yet captured — skip refund silently
        console.log(
          `[CancellationService] Registration ${reg.registration_id}: no captured payment found ` +
          `(free event or payment gap). Skipping Razorpay call.`,
        );
        // Still count this as a successfully processed registration for notification purposes
        refundedMemberIds.push(reg.member_id);
        continue;
      }

      console.log(
        `[CancellationService] Registration ${reg.registration_id}: payment found via ${lookupPath} ` +
        `(${paymentRow.razorpay_payment_id}, ₹${reg.total_amount})`,
      );

      // ── 4b. Create refund_requests row ────────────────────────────────────
      // ON CONFLICT: matches the partial UNIQUE index idx_refund_requests_registration_active
      // (registration_id WHERE status NOT IN ('rejected')).
      // If a non-rejected row already exists for this registration, skip the insert —
      // the refund was already initiated (e.g. cancel called twice in a retry scenario).
      const refundReqResult = await pool.query(
        `INSERT INTO refund_requests (
           registration_id, member_id, event_id,
           requested_amount, reason,
           status, trigger_source,
           policy_snapshot,
           requested_at, decided_at, decided_by
         ) VALUES ($1, $2, $3, $4, $5, 'auto_approved', 'system_cancellation', $6, NOW(), NOW(), $7)
         ON CONFLICT (registration_id) WHERE (status NOT IN ('rejected')) DO NOTHING
         RETURNING id`,

        [
          reg.registration_id,
          reg.member_id,
          eventId,
          reg.total_amount,                          // full amount paid
          `Event cancelled by ${cancelledByType}`,
          JSON.stringify({
            override: 'cancellation',
            reason:   `Event cancelled by ${cancelledByType} ${cancelledById}`,
            policy_bypassed: true,
            note: 'Cancellation refunds are always 100% of amount_paid regardless of ticket refund_policy',
          }),
          cancelledByType === 'admin' ? cancelledById : null,  // decided_by (nullable for community)
        ],
      );

      // If ON CONFLICT triggered (row already existed), log and skip Razorpay call
      if (refundReqResult.rows.length === 0) {
        console.log(
          `[CancellationService] Registration ${reg.registration_id}: refund_request already exists — skipping duplicate`,
        );
        refundedMemberIds.push(reg.member_id);
        continue;
      }

      const refundRequestId = refundReqResult.rows[0].id;

      // ── 4c. Execute Razorpay refund (full amount, no fee deduction) ────────
      const razorpayRefund = await executeRazorpayRefund(
        paymentRow.razorpay_payment_id,
        reg.total_amount,  // rupees; executor converts to paise
        {
          refund_request_id:    String(refundRequestId),
          event_id:             String(eventId),
          registration_id:      String(reg.registration_id),
          trigger:              'system_cancellation',
          cancelled_by_type:    cancelledByType,
          cancelled_by_id:      String(cancelledById),
        },
      );

      // Mark the refund_request as completed
      await pool.query(
        `UPDATE refund_requests
         SET status = 'completed', completed_at = NOW()
         WHERE id = $1`,
        [refundRequestId],
      );

      refundedCount++;
      totalRefundedRupees += parseFloat(reg.total_amount || 0);
      refundedMemberIds.push(reg.member_id);

      console.log(
        `[CancellationService] Registration ${reg.registration_id}: refund ₹${reg.total_amount} ` +
        `initiated (razorpay_refund_id=${razorpayRefund.id})`,
      );
      // Downstream reconciliation (cancel registration, decrement sold_count,
      // write refund_amount) happens in the refund.created webhook — no code here.

    } catch (regErr) {
      // ── Per-registration error isolation: log + collect, don't abort batch ──
      const failure = {
        registration_id: reg.registration_id,
        member_id:       reg.member_id,
        amount:          reg.total_amount,
        error:           regErr.error?.description || regErr.message,
        razorpay_error:  regErr.error || null,
      };
      failures.push(failure);
      console.error(
        `[CancellationService] Registration ${reg.registration_id} refund FAILED:`,
        regErr.error ? JSON.stringify(regErr.error) : regErr.message,
      );
    }
  }

  // ── 5. In-app notifications (existing event_cancelled pattern) ─────────────
  const notificationPayload = JSON.stringify({
    event_id:       parseInt(eventId),
    event_title:    event.title,
    community_name: event.community_name,
    community_logo: event.community_logo,
    event_date:     event.end_datetime,
    refund_note:    'A full refund has been automatically initiated for your registration.',
  });

  const notificationPromises = registrations.map((reg) =>
    pool.query(
      `INSERT INTO notifications (
         recipient_id, recipient_type, actor_id, actor_type,
         type, payload, is_read, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, false, NOW())`,
      [
        reg.member_id,
        'member',
        cancelledById,
        cancelledByType,
        'event_cancelled',
        notificationPayload,
      ],
    ).catch((err) =>
      console.warn(`[CancellationService] In-app notification failed for member ${reg.member_id}:`, err.message),
    ),
  );
  await Promise.all(notificationPromises);

  // Emit real-time socket events
  registrations.forEach((reg) => {
    try {
      notificationService.emitNotification(reg.member_id);
    } catch { /* non-critical */ }
  });

  // ── 6. Push notifications — REAL SEND (not a TODO) ────────────────────────
  // Uses sendBulkPushNotifications for efficiency (one token-lookup query per batch).
  if (registrations.length > 0) {
    const pushUsers = registrations.map((reg) => ({
      userId:   reg.member_id,
      userType: 'member',
    }));

    pushService.sendBulkPushNotifications(
      pool,
      pushUsers,
      'Event Cancelled — Refund Initiated 🔔',
      `${event.community_name || 'The organiser'} has cancelled "${event.title}". ` +
      `A full refund is being processed automatically.`,
      {
        type:        'event_cancelled',
        eventId:     parseInt(eventId),
        eventTitle:  event.title,
        screen:      'EventDetail',
      },
    ).catch((pushErr) =>
      console.warn('[CancellationService] Push notification batch failed (non-critical):', pushErr.message),
    );
  }

  const summary = {
    success:               true,
    event_id:              parseInt(eventId),
    event_title:           event.title,
    is_past_event:         isPastEvent,
    total_registrations:   registrations.length,
    refunded_count:        refundedCount,
    total_refunded_rupees: totalRefundedRupees,
    failed_count:          failures.length,
    failures,
    payout_hold_set:       true,
    cancelled_at:          new Date().toISOString(),
  };

  console.log(
    `[CancellationService] Event ${eventId} cancellation complete. ` +
    `refunded=${refundedCount}, failed=${failures.length}, total=₹${totalRefundedRupees}`,
  );

  return summary;
};

module.exports = { cancelEventWithRefunds };
