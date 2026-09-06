/**
 * eventPostponementService.js
 *
 * All business logic for the event postponement system:
 *
 *   declarePostponement    — mark event postponed, create decision rows, push buyers
 *   setPostponementNewDate — when organiser picks a date, start the 72h opt-out window
 *   processOptOut          — buyer opts out within the window → refund
 *   processKeep            — buyer explicitly confirms they're keeping their ticket
 *   checkAndReleasePayoutHold — release payout_hold once all decisions for an event resolve
 *
 * Cron job functions (called by schedulerService):
 *   runPostponementWindowExpiry  — hourly: auto-keep expired pending decisions
 *   runIndefinitePostponementCap — daily: auto-refund if no new date set after 30 days
 *
 * DESIGN DECISIONS (documented):
 * - 'registered' AND 'attended' registrations both receive decision rows (same logic as
 *   cancellation — attendees who checked in before a postponement still deserve a choice).
 * - Re-postponement: if organiser changes date while decisions are still pending (window open),
 *   new_date_set_at and opt_out_deadline are reset to NOW()+72h. Window restarts. Intentional.
 * - trigger_source has NO CHECK constraint — new values work without schema change.
 * - payout_hold is released only when zero pending decisions remain for the event.
 */

const pushService         = require('./pushService');
const { executeRazorpayRefund } = require('../utils/razorpayRefundExecutor');

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Find a Razorpay payment for a registration.
 * Primary path: razorpay_orders.registration_id (set by payment webhook).
 * Fallback: user_id + event_id heuristic (same as approveRefundRequest).
 */
const findCapturedPayment = async (pool, registrationId, memberId, eventId) => {
  // Primary
  const primary = await pool.query(
    `SELECT rp.razorpay_payment_id, rp.amount_paise
     FROM razorpay_payments rp
     JOIN razorpay_orders ro ON ro.razorpay_order_id = rp.razorpay_order_id
     WHERE ro.registration_id = $1
       AND rp.status = 'captured'
     ORDER BY rp.created_at DESC LIMIT 1`,
    [registrationId],
  );
  if (primary.rows.length > 0) return { ...primary.rows[0], lookupPath: 'orders.registration_id' };

  // Fallback
  const fallback = await pool.query(
    `SELECT rp.razorpay_payment_id, rp.amount_paise
     FROM razorpay_payments rp
     WHERE rp.user_id  = $1
       AND rp.event_id = $2
       AND rp.status   = 'captured'
     ORDER BY rp.created_at DESC LIMIT 1`,
    [memberId, eventId],
  );
  if (fallback.rows.length > 0) return { ...fallback.rows[0], lookupPath: 'user_id+event_id heuristic' };
  return null;
};

/**
 * Create a refund_requests row and execute the Razorpay refund for a decision.
 * Used by both opt-out and indefinite-cap paths.
 */
const createAndExecuteRefund = async (pool, {
  registrationId, memberId, eventId, totalAmount,
  triggerSource, notes,
}) => {
  const payment = await findCapturedPayment(pool, registrationId, memberId, eventId);
  if (!payment) {
    console.warn(`[PostponementService] No captured payment for registration ${registrationId} — skipping refund`);
    return null;
  }

  const refundReqResult = await pool.query(
    `INSERT INTO refund_requests (
       registration_id, member_id, event_id,
       requested_amount, reason, status, trigger_source,
       policy_snapshot, requested_at, decided_at
     ) VALUES ($1, $2, $3, $4, $5, 'auto_approved', $6, $7, NOW(), NOW())
     ON CONFLICT (registration_id) WHERE (status NOT IN ('rejected')) DO NOTHING
     RETURNING id`,
    [
      registrationId, memberId, eventId,
      totalAmount,
      `Postponement: ${triggerSource}`,
      triggerSource,
      JSON.stringify({
        override:        'postponement',
        trigger:         triggerSource,
        policy_bypassed: true,
        note: 'Postponement refunds are always 100% of amount_paid, policy percentage not applied',
      }),
    ],
  );

  if (refundReqResult.rows.length === 0) {
    console.log(`[PostponementService] refund_request already exists for registration ${registrationId} — skipping`);
    return null;
  }

  const refundRequestId = refundReqResult.rows[0].id;

  const razorpayRefund = await executeRazorpayRefund(
    payment.razorpay_payment_id,
    totalAmount,
    { ...notes, refund_request_id: String(refundRequestId) },
  );

  await pool.query(
    `UPDATE refund_requests SET status = 'completed', completed_at = NOW() WHERE id = $1`,
    [refundRequestId],
  );

  return { refundRequestId, razorpayRefund, lookupPath: payment.lookupPath };
};

/**
 * Check whether all decisions for an event are resolved.
 * If so, release payout_hold so the 48h payout cron can resume.
 */
const checkAndReleasePayoutHold = async (pool, eventId) => {
  const pending = await pool.query(
    `SELECT COUNT(*) FROM event_postponement_decisions
     WHERE event_id = $1 AND decision = 'pending'`,
    [eventId],
  );
  if (parseInt(pending.rows[0].count) === 0) {
    await pool.query(
      `UPDATE events SET payout_hold = false WHERE id = $1 AND is_cancelled = false`,
      [eventId],
    );
    console.log(`[PostponementService] payout_hold released for event ${eventId} — all decisions resolved`);
    return true;
  }
  return false;
};

// ─── Part 2: Declare postponement ─────────────────────────────────────────────

const declarePostponement = async (pool, eventId, postponedById, postponedByType) => {
  // Fetch event
  const evResult = await pool.query(
    `SELECT e.id, e.title, e.is_cancelled, e.is_postponed, e.start_datetime,
            c.name AS community_name
     FROM events e LEFT JOIN communities c ON c.id = e.creator_id
     WHERE e.id = $1`,
    [eventId],
  );

  if (evResult.rows.length === 0) {
    const err = new Error('Event not found'); err.statusCode = 404; throw err;
  }
  const event = evResult.rows[0];

  if (event.is_cancelled) {
    const err = new Error('Cannot postpone a cancelled event'); err.statusCode = 400; throw err;
  }
  if (event.is_postponed) {
    const err = new Error('Event is already postponed'); err.statusCode = 400; err.code = 'ALREADY_POSTPONED'; throw err;
  }

  // Snapshot start_datetime BEFORE any date change, mark postponed
  await pool.query(
    `UPDATE events
     SET is_postponed            = true,
         postponed_at            = NOW(),
         original_start_datetime = start_datetime,
         payout_hold             = true,
         updated_at              = NOW()
     WHERE id = $1`,
    [eventId],
  );

  // Fetch all affected registrations (registered + attended)
  const regs = await pool.query(
    `SELECT er.id AS registration_id, er.member_id, er.total_amount
     FROM event_registrations er
     WHERE er.event_id = $1
       AND er.registration_status IN ('registered', 'attended')`,
    [eventId],
  );

  const declaredAt = new Date().toISOString();

  // Create one decision row per registration
  for (const reg of regs.rows) {
    await pool.query(
      `INSERT INTO event_postponement_decisions
         (event_id, registration_id, member_id, postponement_declared_at, decision)
       VALUES ($1, $2, $3, $4, 'pending')
       ON CONFLICT (event_id, registration_id, postponement_declared_at) DO NOTHING`,
      [eventId, reg.registration_id, reg.member_id, declaredAt],
    );
  }

  // Push: "postponed, new date TBD" — distinct from event_rescheduled
  if (regs.rows.length > 0) {
    const pushUsers = regs.rows.map(r => ({ userId: r.member_id, userType: 'member' }));
    pushService.sendBulkPushNotifications(
      pool, pushUsers,
      'Event Postponed 📅',
      `${event.community_name || 'The organiser'} has postponed "${event.title}". ` +
      'A new date will be announced soon — you\'ll have 72 hours to decide once it\'s set.',
      { type: 'event_postponed', eventId: parseInt(eventId), screen: 'EventDetail' },
    ).catch(e => console.warn('[PostponementService] Push failed (non-critical):', e.message));
  }

  console.log(`[PostponementService] Event ${eventId} postponed by ${postponedByType}_${postponedById}. ${regs.rows.length} decision rows created.`);

  return {
    success: true,
    event_id: parseInt(eventId),
    event_title: event.title,
    decision_rows_created: regs.rows.length,
    payout_hold_set: true,
    postponed_at: declaredAt,
  };
};

// ─── Part 3: Set new date (starts the 72h opt-out window) ─────────────────────

const setPostponementNewDate = async (pool, eventId, newStartDatetime, communityName, eventTitle) => {
  const now = new Date();
  const optOutDeadline = new Date(now.getTime() + 72 * 60 * 60 * 1000);

  // Update all pending decision rows that don't have a date set yet (OR reset if already set)
  // Re-postponement: if organiser changes date again while window is open, window resets.
  const updateResult = await pool.query(
    `UPDATE event_postponement_decisions
     SET new_date_set_at  = $1,
         opt_out_deadline  = $2
     WHERE event_id = $3
       AND decision  = 'pending'
     RETURNING member_id`,
    [now.toISOString(), optOutDeadline.toISOString(), eventId],
  );

  if (updateResult.rows.length === 0) {
    // No pending decisions — nothing to do (free event or all resolved)
    return { decisions_updated: 0 };
  }

  const deadlineFormatted = optOutDeadline.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const newDateFormatted = new Date(newStartDatetime).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // Push with explicit deadline language — critical "not just a notification" moment
  const memberIds = [...new Set(updateResult.rows.map(r => r.member_id))];
  const pushUsers = memberIds.map(id => ({ userId: id, userType: 'member' }));

  pushService.sendBulkPushNotifications(
    pool, pushUsers,
    'New Date Set — 72 Hours to Decide 🗓️',
    `"${eventTitle}" is now rescheduled to ${newDateFormatted}. ` +
    `If you want a full refund instead, you must request it before ${deadlineFormatted}. ` +
    `No action = your ticket is automatically kept.`,
    {
      type:        'postponement_new_date',
      eventId:     parseInt(eventId),
      deadline:    optOutDeadline.toISOString(),
      screen:      'TicketView',
    },
  ).catch(e => console.warn('[PostponementService] New-date push failed (non-critical):', e.message));

  console.log(`[PostponementService] Event ${eventId}: new date set, ${updateResult.rows.length} decisions updated. Opt-out deadline: ${optOutDeadline.toISOString()}`);

  return {
    decisions_updated: updateResult.rows.length,
    opt_out_deadline:  optOutDeadline.toISOString(),
  };
};

// ─── Part 4a: Buyer opts out ───────────────────────────────────────────────────

const processOptOut = async (pool, decisionId, memberId) => {
  // Fetch decision and validate ownership + window
  const decResult = await pool.query(
    `SELECT d.*, er.total_amount
     FROM event_postponement_decisions d
     JOIN event_registrations er ON er.id = d.registration_id
     WHERE d.id = $1`,
    [decisionId],
  );

  if (decResult.rows.length === 0) {
    const err = new Error('Decision not found'); err.statusCode = 404; throw err;
  }
  const dec = decResult.rows[0];

  if (parseInt(dec.member_id) !== parseInt(memberId)) {
    const err = new Error('Not your decision'); err.statusCode = 403; throw err;
  }
  if (dec.decision !== 'pending') {
    const err = new Error(`Decision already resolved: ${dec.decision}`);
    err.statusCode = 400; err.code = 'ALREADY_RESOLVED'; throw err;
  }
  if (!dec.opt_out_deadline) {
    const err = new Error('No new date has been announced yet — opt-out window not open');
    err.statusCode = 400; err.code = 'WINDOW_NOT_OPEN'; throw err;
  }
  if (new Date() > new Date(dec.opt_out_deadline)) {
    const err = new Error('The 72-hour opt-out window has closed');
    err.statusCode = 400; err.code = 'WINDOW_CLOSED'; throw err;
  }

  // Mark opted out
  await pool.query(
    `UPDATE event_postponement_decisions
     SET decision = 'opted_out_refund', decided_at = NOW()
     WHERE id = $1`,
    [decisionId],
  );

  // Create + execute refund — same per-registration isolation as cancelEventWithRefunds.
  // If Razorpay fails, the refund_request row (auto_approved) remains as the contract.
  // Admin queue handles Razorpay failures; decision is NOT reverted.
  let refundResult = null;
  let refundError  = null;
  try {
    refundResult = await createAndExecuteRefund(pool, {
      registrationId: dec.registration_id,
      memberId:       dec.member_id,
      eventId:        dec.event_id,
      totalAmount:    dec.total_amount,
      triggerSource:  'postponement_opt_out',
      notes: {
        decision_id:  String(decisionId),
        event_id:     String(dec.event_id),
        trigger:      'buyer_opt_out',
      },
    });
  } catch (refundErr) {
    refundError = refundErr.message || String(refundErr);
    console.error(
      `[PostponementService] Razorpay refund failed for decision ${decisionId} (non-fatal — admin queue):`,
      refundError,
    );
  }

  // Check if all decisions for this event are now resolved → release payout_hold
  await checkAndReleasePayoutHold(pool, dec.event_id);

  return {
    success: true,
    decision: 'opted_out_refund',
    refund_initiated: refundResult !== null,
    refund_request_id: refundResult?.refundRequestId || null,
    razorpay_error: refundError || undefined,
  };

};

// ─── Part 4b: Buyer explicitly keeps ticket ────────────────────────────────────

const processKeep = async (pool, decisionId, memberId) => {
  const decResult = await pool.query(
    `SELECT * FROM event_postponement_decisions WHERE id = $1`,
    [decisionId],
  );

  if (decResult.rows.length === 0) {
    const err = new Error('Decision not found'); err.statusCode = 404; throw err;
  }
  const dec = decResult.rows[0];

  if (parseInt(dec.member_id) !== parseInt(memberId)) {
    const err = new Error('Not your decision'); err.statusCode = 403; throw err;
  }
  if (dec.decision !== 'pending') {
    const err = new Error(`Decision already resolved: ${dec.decision}`);
    err.statusCode = 400; err.code = 'ALREADY_RESOLVED'; throw err;
  }

  await pool.query(
    `UPDATE event_postponement_decisions
     SET decision = 'kept_ticket', decided_at = NOW()
     WHERE id = $1`,
    [decisionId],
  );

  await checkAndReleasePayoutHold(pool, dec.event_id);

  return { success: true, decision: 'kept_ticket' };
};

// ─── Part 5: Cron — expire opt-out windows ────────────────────────────────────

const runPostponementWindowExpiry = async (pool) => {
  if (!pool) return;
  try {
    // Find all pending decisions whose opt_out_deadline has passed
    const expired = await pool.query(
      `SELECT d.id, d.event_id, d.registration_id, d.member_id
       FROM event_postponement_decisions d
       WHERE d.decision        = 'pending'
         AND d.opt_out_deadline IS NOT NULL
         AND NOW() >= d.opt_out_deadline`,
    );

    if (expired.rows.length === 0) return;

    console.log(`[Scheduler/PostponeExpiry] Processing ${expired.rows.length} expired opt-out window(s)`);

    // Mark all as auto_kept_no_response in a single batch
    const ids = expired.rows.map(r => r.id);
    await pool.query(
      `UPDATE event_postponement_decisions
       SET decision   = 'auto_kept_no_response',
           decided_at = NOW()
       WHERE id = ANY($1::bigint[])`,
      [ids],
    );

    // For each distinct event, check if payout_hold can be released
    const eventIds = [...new Set(expired.rows.map(r => r.event_id))];
    for (const eventId of eventIds) {
      await checkAndReleasePayoutHold(pool, eventId);
    }

    console.log(`[Scheduler/PostponeExpiry] Auto-kept ${expired.rows.length} decision(s) across ${eventIds.length} event(s)`);
  } catch (err) {
    console.error('[Scheduler/PostponeExpiry] Error:', err.message);
  }
};

// ─── Part 6: Cron — indefinite postponement cap (30 days) ─────────────────────

const runIndefinitePostponementCap = async (pool) => {
  if (!pool) return;
  try {
    // Find events postponed 30+ days ago with NO new date ever set for any pending decision
    const capEvents = await pool.query(
      `SELECT DISTINCT d.event_id
       FROM event_postponement_decisions d
       JOIN events e ON e.id = d.event_id
       WHERE d.decision        = 'pending'
         AND d.new_date_set_at IS NULL
         AND e.is_postponed    = true
         AND NOW() >= e.postponed_at + INTERVAL '30 days'`,
    );

    if (capEvents.rows.length === 0) return;

    console.log(`[Scheduler/IndefiniteCap] Processing ${capEvents.rows.length} event(s) past 30-day postponement cap`);

    for (const { event_id } of capEvents.rows) {
      // Fetch all still-pending decisions for this event with no new date
      const pendingDecs = await pool.query(
        `SELECT d.id, d.registration_id, d.member_id, er.total_amount, e.title
         FROM event_postponement_decisions d
         JOIN event_registrations er ON er.id = d.registration_id
         JOIN events e ON e.id = d.event_id
         WHERE d.event_id      = $1
           AND d.decision      = 'pending'
           AND d.new_date_set_at IS NULL`,
        [event_id],
      );

      const failures = [];
      for (const dec of pendingDecs.rows) {
        try {
          // Mark decision first
          await pool.query(
            `UPDATE event_postponement_decisions
             SET decision = 'auto_refunded_indefinite_cap', decided_at = NOW()
             WHERE id = $1`,
            [dec.id],
          );

          // Execute refund
          await createAndExecuteRefund(pool, {
            registrationId: dec.registration_id,
            memberId:       dec.member_id,
            eventId:        event_id,
            totalAmount:    dec.total_amount,
            triggerSource:  'postponement_indefinite_cap',
            notes: {
              decision_id: String(dec.id),
              event_id:    String(event_id),
              trigger:     '30_day_indefinite_cap',
            },
          });

          console.log(`[Scheduler/IndefiniteCap] Refunded registration ${dec.registration_id} for event ${event_id}`);
        } catch (err) {
          failures.push({ decision_id: dec.id, registration_id: dec.registration_id, error: err.message });
          console.error(`[Scheduler/IndefiniteCap] Failed for decision ${dec.id}:`, err.message);
          // Don't revert the decision — the refund may have partially succeeded (Razorpay may have it)
          // Admin will need to handle via the refund_requests queue
        }
      }

      // Push buyers who were auto-refunded (not failures)
      const refundedMembers = pendingDecs.rows
        .filter(d => !failures.find(f => f.decision_id === d.id))
        .map(d => ({ userId: d.member_id, userType: 'member' }));

      if (refundedMembers.length > 0) {
        pushService.sendBulkPushNotifications(
          pool, refundedMembers,
          'Refund Processed — Event Not Rescheduled 🔔',
          `"${pendingDecs.rows[0]?.title || 'An event'}" was postponed over 30 days ago ` +
          'without a new date being set. A full refund has been automatically processed.',
          { type: 'postponement_indefinite_cap', eventId: parseInt(event_id) },
        ).catch(e => console.warn('[Scheduler/IndefiniteCap] Push failed:', e.message));
      }

      // Release payout_hold if all decisions resolved
      await checkAndReleasePayoutHold(pool, event_id);

      if (failures.length > 0) {
        console.error(`[Scheduler/IndefiniteCap] Event ${event_id}: ${failures.length} refund(s) failed — manual review needed`);
      }
    }
  } catch (err) {
    console.error('[Scheduler/IndefiniteCap] Top-level error:', err.message);
  }
};

module.exports = {
  declarePostponement,
  setPostponementNewDate,
  processOptOut,
  processKeep,
  checkAndReleasePayoutHold,
  runPostponementWindowExpiry,
  runIndefinitePostponementCap,
};
