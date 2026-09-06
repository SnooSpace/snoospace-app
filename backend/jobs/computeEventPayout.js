/**
 * computeEventPayout.js
 *
 * Pure computation function — does NOT insert anything. Callers (cron job,
 * early-payout endpoint) are responsible for the INSERT into event_payouts.
 *
 * Platform fee: 8% of price_paid (post-discount), per ticket.
 *   E.g. ₹500 ticket sold at ₹400 (promo) → fee = ₹32, not ₹40.
 *
 * Refunds do NOT claw back the platform fee already earned.
 *   refunds_deducted = sum of event_registrations.refund_amount for this event.
 *   The 8% SnooSpace already received stays with SnooSpace regardless.
 *
 * final_payout_amount = gross_revenue - platform_fee_amount - refunds_deducted
 *   Can be NEGATIVE in edge cases (e.g. heavy refund event). We surface the
 *   true number — never clamp to zero. A negative payout is a real signal,
 *   not a bug to hide.
 *
 * tax_amount = null — intentionally excluded pending GST/compliance decision.
 */

const PLATFORM_FEE_RATE = 0.08; // 8%, confirmed by spec

/**
 * Compute the full payout ledger for an event.
 *
 * @param {import('pg').Pool} pool
 * @param {number} eventId
 * @returns {Promise<{
 *   eventId: number,
 *   communityId: number,
 *   grossRevenue: number,
 *   totalDiscounts: number,
 *   platformFeeAmount: number,
 *   refundsDeducted: number,
 *   taxAmount: null,
 *   finalPayoutAmount: number,
 *   ledgerSnapshot: object,
 *   ticketCount: number,
 * }>}
 */
async function computeEventPayout(pool, eventId) {
  // ── 1. Fetch event + community ─────────────────────────────────────────────
  const eventResult = await pool.query(
    `SELECT id, community_id, title, end_datetime FROM events WHERE id = $1`,
    [eventId],
  );
  if (eventResult.rows.length === 0) {
    throw new Error(`computeEventPayout: event ${eventId} not found`);
  }
  const event = eventResult.rows[0];
  const communityId = event.community_id;

  // ── 2. Fetch all active registrations with ticket breakdown ────────────────
  // Active = registered or attended. Cancelled registrations are excluded from
  // revenue, but their refund_amount IS included in refunds_deducted below.
  const registrationsResult = await pool.query(
    `SELECT
       er.id              AS registration_id,
       er.total_amount,   -- price paid by buyer (already post-discount)
       er.discount_amount,
       er.registration_status
     FROM event_registrations er
     WHERE er.event_id = $1
       AND er.registration_status IN ('registered', 'attended')`,
    [eventId],
  );

  // ── 3. Fetch per-ticket-type breakdown for active registrations ────────────
  // registration_tickets has one row per ticket type per registration.
  const activeRegIds = registrationsResult.rows.map((r) => r.registration_id);

  let tierRows = [];
  if (activeRegIds.length > 0) {
    const tierResult = await pool.query(
      `SELECT
         rt.ticket_type_id,
         tt.name          AS tier_name,
         COUNT(*)::int    AS registrations_count,
         SUM(rt.quantity)::int AS tickets_sold,
         SUM(rt.total_price)  AS tier_gross
       FROM registration_tickets rt
       LEFT JOIN ticket_types tt ON tt.id = rt.ticket_type_id
       WHERE rt.registration_id = ANY($1)
       GROUP BY rt.ticket_type_id, tt.name
       ORDER BY tier_gross DESC`,
      [activeRegIds],
    );
    tierRows = tierResult.rows;
  }

  // ── 4. Aggregate gross revenue and discounts ───────────────────────────────
  let grossRevenue = 0;
  let totalDiscounts = 0;
  for (const reg of registrationsResult.rows) {
    grossRevenue   += parseFloat(reg.total_amount)    || 0;
    totalDiscounts += parseFloat(reg.discount_amount) || 0;
  }

  // ── 5. Platform fee: 8% of price_paid (total_amount = post-discount) ──────
  // Computed on the aggregate — same result as per-registration sum since
  // fee is linear: sum(total_amount * 0.08) = gross * 0.08
  const platformFeeAmount = +(grossRevenue * PLATFORM_FEE_RATE).toFixed(2);

  // ── 6. Refunds deducted ────────────────────────────────────────────────────
  // Sum refund_amount from event_registrations.
  // Includes CANCELLED registrations (where refund_amount was set by the
  // refund.created webhook or admin approval). Active registrations have
  // refund_amount = NULL (treated as 0).
  // The 8% platform fee on the original sale is NOT clawed back — confirmed.
  const refundResult = await pool.query(
    `SELECT COALESCE(SUM(refund_amount), 0) AS total_refunded
     FROM event_registrations
     WHERE event_id = $1
       AND refund_amount IS NOT NULL
       AND refund_amount > 0`,
    [eventId],
  );
  const refundsDeducted = parseFloat(refundResult.rows[0].total_refunded) || 0;

  // ── 7. Final payout amount ────────────────────────────────────────────────
  // Can be negative (e.g. heavy refund event). Never clamped.
  const finalPayoutAmount = +(grossRevenue - platformFeeAmount - refundsDeducted).toFixed(2);

  // ── 8. Build ledger snapshot ──────────────────────────────────────────────
  // Per-tier breakdown for the itemized admin view.
  const tiers = tierRows.map((row) => {
    const tierGross    = parseFloat(row.tier_gross) || 0;
    const tierFee      = +(tierGross * PLATFORM_FEE_RATE).toFixed(2);
    const tierNet      = +(tierGross - tierFee).toFixed(2);
    return {
      ticket_type_id:    row.ticket_type_id,
      tier_name:         row.tier_name || 'Unknown',
      tickets_sold:      row.tickets_sold || 0,
      gross:             +tierGross.toFixed(2),
      platform_fee:      tierFee,
      net_before_refund: tierNet,
    };
  });

  const ledgerSnapshot = {
    computed_at: new Date().toISOString(),
    event_id:    eventId,
    event_title: event.title,
    tiers,
    totals: {
      gross_revenue:       +grossRevenue.toFixed(2),
      total_discounts:     +totalDiscounts.toFixed(2),
      platform_fee_amount: platformFeeAmount,
      refunds_deducted:    +refundsDeducted.toFixed(2),
      // tax_amount: null — intentionally excluded pending compliance decision
      tax_amount:          null,
      final_payout_amount: finalPayoutAmount,
    },
    notes: finalPayoutAmount < 0
      ? 'WARNING: final_payout_amount is negative — refunds exceeded gross revenue for this event.'
      : null,
  };

  const ticketCount = activeRegIds.length;

  return {
    eventId,
    communityId,
    grossRevenue:       +grossRevenue.toFixed(2),
    totalDiscounts:     +totalDiscounts.toFixed(2),
    platformFeeAmount,
    refundsDeducted:    +refundsDeducted.toFixed(2),
    taxAmount:          null, // intentionally null — pending compliance decision
    finalPayoutAmount,
    ledgerSnapshot,
    ticketCount,
  };
}

module.exports = { computeEventPayout, PLATFORM_FEE_RATE };
