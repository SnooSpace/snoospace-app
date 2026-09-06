/**
 * financialController.js
 *
 * Admin-only endpoints for:
 *   - Payout ledger management (list, release, trigger early payout)
 *   - Community payout settings (per-community early payout toggle)
 *   - Refund request queue (list, approve, reject)
 *
 * All handlers assume req.admin is set by adminAuthMiddleware.
 * No real bank transfer happens — 'released' is a bookkeeping marker only.
 *
 * Refund approval approach: webhook-driven.
 *   approveRefundRequest() calls Razorpay API only.
 *   The resulting refund.created webhook (routes/webhooks.js handleRefundCreated)
 *   handles all downstream state: registration cancellation, sold_count decrement,
 *   refund_amount population. This avoids duplicate code paths and race conditions.
 */

const { createPool } = require("../config/db");
const razorpay = require("../utils/razorpayClient");
const { computeEventPayout } = require("../jobs/computeEventPayout");

const pool = createPool();

// ─── PAYOUT ENDPOINTS ─────────────────────────────────────────────────────────

/**
 * GET /admin/payouts
 * List all event_payouts with event + community context.
 * Query params: ?status=ready|released|all&page=1&pageSize=20
 */
const listPayouts = async (req, res) => {
  try {
    const { status = "all", page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    const conditions = [];
    const params = [];

    if (status !== "all") {
      params.push(status);
      conditions.push(`ep.status = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM event_payouts ep ${where}`,
      params,
    );

    params.push(parseInt(pageSize), offset);
    const result = await pool.query(
      `SELECT
         ep.id,
         ep.event_id,
         ep.community_id,
         ep.status,
         ep.gross_revenue,
         ep.total_discounts,
         ep.platform_fee_amount,
         ep.refunds_deducted,
         ep.tax_amount,
         ep.final_payout_amount,
         ep.ledger_snapshot,
         ep.trigger_type,
         ep.scheduled_release_at,
         ep.actual_released_at,
         ep.created_at,
         e.title            AS event_title,
         e.start_datetime   AS event_start,
         e.end_datetime     AS event_end,
         c.name             AS community_name,
         a.name             AS released_by_name
       FROM event_payouts ep
       JOIN events      e ON e.id = ep.event_id
       JOIN communities c ON c.id = ep.community_id
       LEFT JOIN admins a ON a.id = ep.released_by
       ${where}
       ORDER BY ep.scheduled_release_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    res.json({
      success: true,
      payouts: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    });
  } catch (err) {
    console.error("[Finance] listPayouts error:", err.message);
    res.status(500).json({ error: "Failed to fetch payouts" });
  }
};

/**
 * POST /admin/events/:eventId/trigger-early-payout
 * Compute payout immediately for a community with early_payout_enabled=true.
 *
 * Guards:
 *   1. Event must have ended (end_datetime <= NOW()) — skips 48h wait, not event itself.
 *   2. community_payout_settings.early_payout_enabled must be true.
 *   3. No existing event_payouts row for this event.
 */
const triggerEarlyPayout = async (req, res) => {
  const { eventId } = req.params;
  try {
    // Fetch event
    const eventResult = await pool.query(
      `SELECT id, community_id, end_datetime, title FROM events WHERE id = $1`,
      [eventId],
    );
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }
    const event = eventResult.rows[0];

    // Guard 1: Event must have ended.
    // ASSUMPTION: early payout skips the 48h wait, not the event itself.
    // An organiser requesting payout before the event ends would compute
    // revenue on unexecuted tickets. Admin must confirm event is complete.
    if (new Date(event.end_datetime) > new Date()) {
      return res.status(400).json({
        error: "Event has not ended yet. Early payout requires the event to have finished.",
        end_datetime: event.end_datetime,
      });
    }

    // Guard 2: Check early_payout_enabled for this community
    const settingsResult = await pool.query(
      `SELECT early_payout_enabled FROM community_payout_settings WHERE community_id = $1`,
      [event.community_id],
    );
    const earlyEnabled = settingsResult.rows[0]?.early_payout_enabled === true;
    if (!earlyEnabled) {
      return res.status(403).json({
        error: "Early payout is not enabled for this community. Enable it in Community Payout Settings first.",
      });
    }

    // Guard 3: No existing payout row
    const existingResult = await pool.query(
      `SELECT id, status FROM event_payouts WHERE event_id = $1`,
      [eventId],
    );
    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        error: "Payout record already exists for this event",
        existing: existingResult.rows[0],
      });
    }

    // Compute and insert
    const computed = await computeEventPayout(pool, parseInt(eventId));

    await pool.query(
      `INSERT INTO event_payouts (
         event_id, community_id, status,
         gross_revenue, total_discounts, platform_fee_amount,
         refunds_deducted, tax_amount, final_payout_amount,
         ledger_snapshot, trigger_type, scheduled_release_at
       ) VALUES ($1,$2,'ready',$3,$4,$5,$6,$7,$8,$9,'early_on_demand',NOW())`,
      [
        computed.eventId,
        computed.communityId,
        computed.grossRevenue,
        computed.totalDiscounts,
        computed.platformFeeAmount,
        computed.refundsDeducted,
        computed.taxAmount, // null — intentional
        computed.finalPayoutAmount,
        JSON.stringify(computed.ledgerSnapshot),
      ],
    );

    console.log(
      `[Finance] Early payout triggered for event ${eventId} by admin ${req.admin.id}. ` +
      `Payout: ₹${computed.finalPayoutAmount}`,
    );

    res.json({
      success: true,
      message: "Early payout ledger computed and marked ready",
      payout: {
        event_id: computed.eventId,
        gross_revenue: computed.grossRevenue,
        platform_fee_amount: computed.platformFeeAmount,
        refunds_deducted: computed.refundsDeducted,
        final_payout_amount: computed.finalPayoutAmount,
        trigger_type: "early_on_demand",
      },
    });
  } catch (err) {
    console.error("[Finance] triggerEarlyPayout error:", err.message);
    res.status(500).json({ error: "Failed to trigger early payout" });
  }
};

/**
 * POST /admin/payouts/:payoutId/release
 * Mark a 'ready' payout as 'released' (bookkeeping only — no real bank transfer).
 */
const releasePayout = async (req, res) => {
  const { payoutId } = req.params;
  try {
    const result = await pool.query(
      `UPDATE event_payouts
       SET status            = 'released',
           actual_released_at = NOW(),
           released_by        = $1
       WHERE id = $2 AND status = 'ready'
       RETURNING *`,
      [req.admin.id, payoutId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Payout not found or not in 'ready' state. Only ready payouts can be released.",
      });
    }

    console.log(`[Finance] Payout ${payoutId} released by admin ${req.admin.id}`);
    res.json({ success: true, payout: result.rows[0] });
  } catch (err) {
    console.error("[Finance] releasePayout error:", err.message);
    res.status(500).json({ error: "Failed to release payout" });
  }
};

// ─── COMMUNITY PAYOUT SETTINGS ─────────────────────────────────────────────────

/**
 * GET /admin/community-payout-settings
 * List all communities with their payout settings (LEFT JOIN, so communities
 * without a settings row appear with early_payout_enabled=false).
 */
const listCommunityPayoutSettings = async (req, res) => {
  try {
    const { page = 1, pageSize = 50, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const params = [];
    let searchClause = "";
    if (search) {
      params.push(`%${search}%`);
      searchClause = `WHERE c.name ILIKE $${params.length}`;
    }

    params.push(parseInt(pageSize), offset);
    const result = await pool.query(
      `SELECT
         c.id            AS community_id,
         c.name,
         c.logo_url,
         COALESCE(cps.early_payout_enabled, false) AS early_payout_enabled,
         cps.updated_at,
         a.name          AS updated_by_name
       FROM communities c
       LEFT JOIN community_payout_settings cps ON cps.community_id = c.id
       LEFT JOIN admins a ON a.id = cps.updated_by
       ${searchClause}
       ORDER BY c.name ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const countParams = search ? [`%${search}%`] : [];
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM communities c ${searchClause}`,
      countParams,
    );

    res.json({
      success: true,
      settings: result.rows,
      total: parseInt(countResult.rows[0].count),
    });
  } catch (err) {
    console.error("[Finance] listCommunityPayoutSettings error:", err.message);
    res.status(500).json({ error: "Failed to fetch community payout settings" });
  }
};

/**
 * PATCH /admin/communities/:communityId/payout-settings
 * Toggle early_payout_enabled for a community. Admin-only.
 * Body: { early_payout_enabled: boolean }
 */
const updateCommunityPayoutSettings = async (req, res) => {
  const { communityId } = req.params;
  const { early_payout_enabled } = req.body;

  if (typeof early_payout_enabled !== "boolean") {
    return res.status(400).json({ error: "early_payout_enabled must be a boolean" });
  }

  try {
    // Verify community exists
    const community = await pool.query(
      `SELECT id, name FROM communities WHERE id = $1`,
      [communityId],
    );
    if (community.rows.length === 0) {
      return res.status(404).json({ error: "Community not found" });
    }

    const result = await pool.query(
      `INSERT INTO community_payout_settings (community_id, early_payout_enabled, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (community_id) DO UPDATE
         SET early_payout_enabled = EXCLUDED.early_payout_enabled,
             updated_by           = EXCLUDED.updated_by,
             updated_at           = NOW()
       RETURNING *`,
      [communityId, early_payout_enabled, req.admin.id],
    );

    console.log(
      `[Finance] Community ${communityId} early_payout_enabled=${early_payout_enabled} by admin ${req.admin.id}`,
    );

    res.json({
      success: true,
      settings: result.rows[0],
      community: community.rows[0],
    });
  } catch (err) {
    console.error("[Finance] updateCommunityPayoutSettings error:", err.message);
    res.status(500).json({ error: "Failed to update community payout settings" });
  }
};

// ─── REFUND REQUEST QUEUE ──────────────────────────────────────────────────────

/**
 * GET /admin/refund-requests
 * List refund requests with buyer/event/registration context.
 * Query: ?status=manual_review|auto_approved|pending_review|all&page=1&pageSize=20
 */
const listRefundRequests = async (req, res) => {
  try {
    const { status = "all", page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const params = [];
    const conditions = [];

    if (status !== "all") {
      params.push(status);
      conditions.push(`rr.status = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM refund_requests rr ${where}`,
      params,
    );

    params.push(parseInt(pageSize), offset);
    const result = await pool.query(
      `SELECT
         rr.id,
         rr.registration_id,
         rr.member_id,
         rr.event_id,
         rr.ticket_type_id,
         rr.requested_amount,
         rr.reason,
         rr.rejection_reason,
         rr.status,
         rr.policy_snapshot,
         rr.requested_at,
         rr.decided_at,
         rr.completed_at,
         -- Buyer info
         m.full_name         AS buyer_name,
         m.username          AS buyer_username,
         -- Event info
         e.title             AS event_title,
         e.start_datetime    AS event_start,
         e.end_datetime      AS event_end,
         -- Ticket tier
         tt.name             AS ticket_tier_name,
         -- Admin who decided
         a.name              AS decided_by_name
       FROM refund_requests rr
       JOIN members     m  ON m.id  = rr.member_id
       JOIN events      e  ON e.id  = rr.event_id
       LEFT JOIN ticket_types tt ON tt.id = rr.ticket_type_id
       LEFT JOIN admins       a  ON a.id  = rr.decided_by
       ${where}
       ORDER BY rr.requested_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    res.json({
      success: true,
      requests: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    });
  } catch (err) {
    console.error("[Finance] listRefundRequests error:", err.message);
    res.status(500).json({ error: "Failed to fetch refund requests" });
  }
};

/**
 * POST /admin/refund-requests/:requestId/approve
 *
 * Executes a real Razorpay refund (test-mode or live, per env keys).
 * Reconciliation approach: WEBHOOK-DRIVEN.
 *   This endpoint only: (a) calls Razorpay, (b) marks refund_request status=completed.
 *   The refund.created webhook (routes/webhooks.js handleRefundCreated) handles:
 *     - Cancelling the registration
 *     - Decrementing sold_count
 *     - Writing event_registrations.refund_amount
 *   This avoids all double-path risks and code duplication.
 *
 * Both 'auto_approved' and 'manual_review' statuses are actionable here —
 * both require explicit admin action to move money.
 */
const approveRefundRequest = async (req, res) => {
  const { requestId } = req.params;
  try {
    // Fetch the refund request
    const rqResult = await pool.query(
      `SELECT rr.*, er.member_id AS reg_member_id
       FROM refund_requests rr
       JOIN event_registrations er ON er.id = rr.registration_id
       WHERE rr.id = $1`,
      [requestId],
    );

    if (rqResult.rows.length === 0) {
      return res.status(404).json({ error: "Refund request not found" });
    }

    const rq = rqResult.rows[0];

    // Only actionable statuses can be approved
    const actionableStatuses = ["pending_review", "auto_approved", "manual_review"];
    if (!actionableStatuses.includes(rq.status)) {
      return res.status(409).json({
        error: `Refund request is in status '${rq.status}' and cannot be approved`,
        current_status: rq.status,
      });
    }

    // Find the Razorpay payment ID for this registration
    // Join path: event_registrations → razorpay_payments (user_id + event_id match)
    const paymentResult = await pool.query(
      `SELECT rp.razorpay_payment_id, rp.amount AS payment_amount_paise
       FROM razorpay_payments rp
       JOIN event_registrations er ON rp.user_id = er.member_id AND rp.event_id = er.event_id
       WHERE er.id = $1
         AND rp.status = 'captured'
       ORDER BY rp.created_at DESC
       LIMIT 1`,
      [rq.registration_id],
    );

    if (paymentResult.rows.length === 0) {
      return res.status(422).json({
        error: "No captured payment found for this registration. Cannot execute Razorpay refund.",
      });
    }

    const payment = paymentResult.rows[0];

    // requested_amount is stored in rupees — Razorpay expects paise
    const amountPaise = Math.round(rq.requested_amount * 100);

    // Call Razorpay refund API (test-mode or live, per RAZORPAY_KEY_ID)
    const razorpayRefund = await razorpay.payments.refund(
      payment.razorpay_payment_id,
      {
        amount: amountPaise,
        notes: {
          refund_request_id: String(rq.id),
          approved_by_admin: String(req.admin.id),
          reason: rq.reason || "Admin approved refund",
        },
      },
    );

    // Mark request as completed optimistically.
    // The refund.created webhook will handle all downstream reconciliation
    // (cancel registration, decrement sold_count, write refund_amount).
    await pool.query(
      `UPDATE refund_requests
       SET status       = 'completed',
           completed_at = NOW(),
           decided_at   = NOW(),
           decided_by   = $1
       WHERE id = $2`,
      [req.admin.id, requestId],
    );

    console.log(
      `[Finance] Refund approved: request=${requestId} razorpay_refund_id=${razorpayRefund.id} ` +
      `amount=₹${rq.requested_amount} payment=${payment.razorpay_payment_id} admin=${req.admin.id}`,
    );

    res.json({
      success: true,
      message: "Refund executed via Razorpay. Webhook will reconcile registration state.",
      refund_request_id: rq.id,
      razorpay_refund_id: razorpayRefund.id,
      amount_refunded: rq.requested_amount,
    });
  } catch (err) {
    // Surface Razorpay-specific errors clearly
    if (err.error) {
      console.error("[Finance] Razorpay refund error:", JSON.stringify(err.error));
      return res.status(502).json({
        error: "Razorpay refund API failed",
        razorpay_error: err.error,
      });
    }
    console.error("[Finance] approveRefundRequest error:", err.message);
    res.status(500).json({ error: "Failed to process refund" });
  }
};

/**
 * POST /admin/refund-requests/:requestId/reject
 * Body: { rejection_reason: string }
 * No Razorpay call — buyer is simply told no money is returned.
 */
const rejectRefundRequest = async (req, res) => {
  const { requestId } = req.params;
  const { rejection_reason } = req.body;

  if (!rejection_reason || typeof rejection_reason !== "string" || !rejection_reason.trim()) {
    return res.status(400).json({ error: "rejection_reason is required" });
  }

  try {
    const result = await pool.query(
      `UPDATE refund_requests
       SET status           = 'rejected',
           rejection_reason = $1,
           decided_at       = NOW(),
           decided_by       = $2
       WHERE id = $3
         AND status IN ('pending_review', 'auto_approved', 'manual_review')
       RETURNING *`,
      [rejection_reason.trim(), req.admin.id, requestId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Refund request not found or already decided",
      });
    }

    console.log(
      `[Finance] Refund rejected: request=${requestId} reason="${rejection_reason}" admin=${req.admin.id}`,
    );

    res.json({ success: true, request: result.rows[0] });
  } catch (err) {
    console.error("[Finance] rejectRefundRequest error:", err.message);
    res.status(500).json({ error: "Failed to reject refund request" });
  }
};

module.exports = {
  listPayouts,
  triggerEarlyPayout,
  releasePayout,
  listCommunityPayoutSettings,
  updateCommunityPayoutSettings,
  listRefundRequests,
  approveRefundRequest,
  rejectRefundRequest,
};
