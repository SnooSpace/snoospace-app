/**
 * paymentController.js
 * Handles all Razorpay payment operations for paid event tickets.
 *
 * Endpoints:
 *   POST /payments/create-order   — create Razorpay order before checkout
 *   POST /payments/verify         — client-side signature verification after payment
 *   GET  /payments/status/:eventId — check payment status for current user
 *
 * Note: The webhook handler lives in routes/webhooks.js (registered in server.js
 * BEFORE express.json() because it needs the raw body for signature verification).
 * The webhook is the authoritative source of truth for payment confirmation and
 * is responsible for creating the event_registration row.
 */

const razorpay = require('../utils/razorpayClient');
const crypto = require('crypto');
const { createPool } = require('../config/db');
const { calculateOrderPricing } = require('../utils/pricingCalculator');

const pool = createPool();

// ─── CREATE ORDER ────────────────────────────────────────────────────────────
// POST /payments/create-order
// Called when user taps "Pay" on the checkout screen for a paid event.
// Creates a Razorpay order and returns order details to the frontend.
// Frontend uses these details to open the Razorpay payment sheet.
const createOrder = async (req, res) => {
  const {
    eventId,
    totalAmountRupees,
    tickets,
    promoCode,
    discountAmount,
    sessionId,
  } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'authentication_required' });
  }

  if (!eventId) {
    return res.status(400).json({ error: 'event_id_required' });
  }

  if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
    return res.status(400).json({ error: 'tickets_required', message: 'No tickets selected' });
  }

  try {
    // Fetch event to validate it exists and get title
    const eventResult = await pool.query(
      `SELECT id, title, community_id FROM events WHERE id = $1`,
      [eventId]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'event_not_found' });
    }

    const event = eventResult.rows[0];

    // Check if user already has a captured payment for this event
    const existingPayment = await pool.query(
      `SELECT id FROM razorpay_payments
       WHERE user_id = $1 AND event_id = $2
         AND status = 'captured' AND webhook_verified = true`,
      [userId, eventId]
    );

    if (existingPayment.rows.length > 0) {
      return res.status(400).json({ error: 'already_paid' });
    }

    // Check if user is already registered
    const existingReg = await pool.query(
      `SELECT id FROM event_registrations
       WHERE event_id = $1 AND member_id = $2
         AND registration_status != 'cancelled'`,
      [eventId, userId]
    );

    if (existingReg.rows.length > 0) {
      return res.json({
        success: true,
        isFullyDiscounted: true,
        registrationId: existingReg.rows[0].id,
        replayed: true,
        message: 'Already registered for this event',
      });
    }

    // Fetch user info for prefill
    const userResult = await pool.query(
      `SELECT name, email FROM members WHERE id = $1`,
      [userId]
    );
    const user = userResult.rows[0] || {};

    // ── Reconcile tickets against ticket_reservations hold ───────────────────
    let hasValidReservationHold = false;
    if (sessionId) {
      const reservationRes = await pool.query(
        `SELECT ticket_type_id, quantity, expires_at 
         FROM ticket_reservations 
         WHERE session_id = $1 AND member_id = $2 AND event_id = $3`,
        [sessionId, userId, eventId]
      );

      if (reservationRes.rows.length === 0) {
        return res.status(400).json({
          error: 'reservation_expired',
          message: 'Your ticket reservation hold has expired. Please select your tickets again.',
        });
      }

      const isExpired = reservationRes.rows.some((r) => new Date(r.expires_at) <= new Date());
      if (isExpired) {
        return res.status(400).json({
          error: 'reservation_expired',
          message: 'Your ticket reservation hold has expired. Please select your tickets again.',
        });
      }

      // Reconcile ticket quantities 1:1
      const heldMap = new Map();
      for (const r of reservationRes.rows) {
        const tid = parseInt(r.ticket_type_id, 10);
        heldMap.set(tid, (heldMap.get(tid) || 0) + parseInt(r.quantity, 10));
      }

      const requestedMap = new Map();
      for (const t of tickets) {
        const tid = parseInt(t.ticketTypeId, 10);
        requestedMap.set(tid, (requestedMap.get(tid) || 0) + parseInt(t.quantity, 10));
      }

      let isMismatch = heldMap.size !== requestedMap.size;
      if (!isMismatch) {
        for (const [tid, qty] of requestedMap.entries()) {
          if (heldMap.get(tid) !== qty) {
            isMismatch = true;
            break;
          }
        }
      }

      if (isMismatch) {
        return res.status(400).json({
          error: 'reservation_mismatch',
          message: 'Requested tickets do not match your reserved hold.',
        });
      }

      hasValidReservationHold = true;
    }

    // ── Authoritative Server-Side Pricing Calculation ───────────────────────
    const pricing = await calculateOrderPricing(pool, eventId, tickets, promoCode, userId, {
      sessionId,
      hasValidReservationHold,
    });

    // Zero-tolerance comparison at the paise level
    const clientAmountPaise = Math.round(parseFloat(totalAmountRupees || 0) * 100);
    const serverAmountPaise = Math.round(pricing.finalAmount * 100);

    if (clientAmountPaise !== serverAmountPaise) {
      return res.status(400).json({
        error: 'price_mismatch',
        message: 'Pricing has changed, please review your order again.',
        serverAmount: pricing.finalAmount,
        clientAmount: parseFloat(totalAmountRupees || 0),
      });
    }

    // ── 100% Discount Short-Circuit Path (Final Amount === 0) ────────────────
    if (pricing.finalAmount === 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Pre-check for existing non-cancelled registration
        const existingRegCheck = await client.query(
          `SELECT id FROM event_registrations
           WHERE event_id = $1 AND member_id = $2 
             AND registration_status != 'cancelled'
           FOR UPDATE`,
          [eventId, userId]
        );

        if (existingRegCheck.rows.length > 0) {
          await client.query('COMMIT');
          return res.json({
            success: true,
            isFullyDiscounted: true,
            registrationId: existingRegCheck.rows[0].id,
            replayed: true,
          });
        }

        // Atomically lock and increment promo code usage if promo was applied
        if (pricing.validatedPromoCode) {
          const dcResult = await client.query(
            `SELECT id, max_uses, current_uses FROM discount_codes 
             WHERE event_id = $1 AND code_normalized = $2 
             FOR UPDATE`,
            [eventId, pricing.validatedPromoCode.toUpperCase().trim()]
          );

          if (dcResult.rows.length > 0) {
            const dc = dcResult.rows[0];
            if (dc.max_uses !== null && dc.current_uses >= dc.max_uses) {
              await client.query('ROLLBACK');
              return res.status(400).json({
                error: 'promo_limit_reached',
                message: 'This promo code has reached its maximum usage limit.',
              });
            }
            await client.query(
              `UPDATE discount_codes SET current_uses = current_uses + 1 WHERE id = $1`,
              [dc.id]
            );
          }
        }

        // Insert registration with 23505 unique_violation catch
        const qrCodeHash = crypto.randomBytes(16).toString('hex').toUpperCase();
        let registrationId;

        try {
          const regResult = await client.query(
            `INSERT INTO event_registrations (
               event_id, member_id, registration_status, total_amount,
               promo_code, discount_amount, qr_code_hash
             ) VALUES ($1, $2, 'registered', 0, $3, $4, $5)
             RETURNING id`,
            [
              eventId,
              userId,
              pricing.validatedPromoCode || null,
              pricing.totalDiscount || 0,
              qrCodeHash,
            ]
          );
          registrationId = regResult.rows[0].id;
        } catch (insertErr) {
          if (insertErr.code === '23505') {
            await client.query('ROLLBACK');
            const dupeCheck = await pool.query(
              `SELECT id FROM event_registrations 
               WHERE event_id = $1 AND member_id = $2 AND registration_status != 'cancelled'`,
              [eventId, userId]
            );
            if (dupeCheck.rows.length > 0) {
              return res.json({
                success: true,
                isFullyDiscounted: true,
                registrationId: dupeCheck.rows[0].id,
                replayed: true,
              });
            }
          }
          throw insertErr;
        }

        // Insert ticket line items & update sold_count
        for (const item of pricing.ticketBreakdown) {
          await client.query(
            `INSERT INTO registration_tickets (
               registration_id, ticket_type_id, ticket_name, quantity, unit_price, total_price
             ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              registrationId,
              item.ticketTypeId,
              item.ticketName,
              item.quantity,
              item.unitPrice,
              item.lineTotal,
            ]
          );

          await client.query(
            `UPDATE ticket_types 
             SET sold_count = sold_count + $1, updated_at = NOW() 
             WHERE id = $2`,
            [item.quantity, item.ticketTypeId]
          );
        }

        // Consume reservation hold if sessionId was provided
        if (sessionId) {
          const reservations = await client.query(
            `SELECT ticket_type_id, quantity FROM ticket_reservations 
             WHERE session_id = $1 FOR UPDATE`,
            [sessionId]
          );

          for (const resRow of reservations.rows) {
            await client.query(
              `UPDATE ticket_types 
               SET reserved_count = GREATEST(0, COALESCE(reserved_count, 0) - $1)
               WHERE id = $2`,
              [resRow.quantity, resRow.ticket_type_id]
            );
          }

          await client.query(
            `DELETE FROM ticket_reservations WHERE session_id = $1`,
            [sessionId]
          );
        }

        // Remove from bookmarks
        await client.query(
          `DELETE FROM event_interests WHERE event_id = $1 AND member_id = $2`,
          [eventId, userId]
        );

        await client.query('COMMIT');

        return res.json({
          success: true,
          isFullyDiscounted: true,
          registrationId,
          prefill: {
            name: user.name || '',
            email: user.email || '',
          },
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // ── Paid Razorpay Order Creation (Server-Computed Amount) ────────────────
    const amountPaise = serverAmountPaise;

    if (amountPaise < 100) {
      return res.status(400).json({
        error: 'amount_too_low',
        message: 'Minimum payable amount is ₹1. Use free registration for zero-cost tickets.',
      });
    }

    const receipt = `SNS-${userId}-${eventId}-${Date.now()}`;
    const razorpayOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        user_id: String(userId),
        event_id: String(eventId),
        event_title: event.title,
      },
    });

    const fullOrderContext = {
      razorpay_notes: razorpayOrder.notes,
      tickets: pricing.ticketBreakdown,
      promoCode: pricing.validatedPromoCode || null,
      discountAmount: pricing.totalDiscount || 0,
      sessionId: sessionId || null,
    };

    await pool.query(
      `INSERT INTO razorpay_orders (
         razorpay_order_id, user_id, event_id,
         amount_paise, currency, status, receipt, notes
       ) VALUES ($1, $2, $3, $4, 'INR', 'created', $5, $6)
       ON CONFLICT (razorpay_order_id) DO NOTHING`,
      [
        razorpayOrder.id,
        userId,
        eventId,
        amountPaise,
        receipt,
        JSON.stringify(fullOrderContext),
      ]
    );

    console.log(
      `[createOrder] Created Razorpay order ${razorpayOrder.id} for user ${userId}, event ${eventId}, amount: ${amountPaise} paise`
    );

    return res.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: amountPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
      eventTitle: event.title,
      receipt,
      prefill: {
        name: user.name || '',
        email: user.email || '',
        contact: '',
      },
    });
  } catch (err) {
    console.error('[createOrder] Error:', err.message, err.stack);
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      error: err.code || 'order_creation_failed',
      message: err.message,
    });
  }
};

// ─── VERIFY PAYMENT (CLIENT-SIDE) ────────────────────────────────────────────
// POST /payments/verify
// Called by the frontend immediately after Razorpay payment sheet closes with success.
// Verifies the HMAC signature of the payment response.
//
// IMPORTANT: This is a SECONDARY optimistic verification.
// The webhook (handleRazorpayWebhook in routes/webhooks.js) is the authoritative
// source of truth and is what actually creates the event_registration row.
// This endpoint only marks the order as 'attempted' and returns an optimistic response.
const verifyPayment = async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'missing_payment_fields' });
  }

  try {
    // Razorpay signs: razorpay_order_id + "|" + razorpay_payment_id
    // using RAZORPAY_KEY_SECRET (not the webhook secret)
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.warn('[verifyPayment] Signature mismatch for order:', razorpay_order_id);
      return res.status(400).json({
        error: 'invalid_signature',
        message: 'Payment signature verification failed',
      });
    }

    // Signature is valid — update order status to 'attempted'
    // Do NOT mark as 'paid' here — wait for webhook confirmation
    await pool.query(
      `UPDATE razorpay_orders
       SET status = 'attempted', updated_at = NOW()
       WHERE razorpay_order_id = $1`,
      [razorpay_order_id]
    );

    console.log(
      `[verifyPayment] Signature verified for order ${razorpay_order_id}, payment ${razorpay_payment_id}`
    );

    // Return optimistic success — the actual registration is confirmed by webhook
    return res.json({
      success: true,
      status: 'payment_received',
      message: 'Payment received. Your registration will be confirmed shortly.',
    });
  } catch (err) {
    console.error('[verifyPayment] Error:', err.message, err.stack);
    return res.status(500).json({ error: 'verification_failed' });
  }
};

// ─── GET PAYMENT STATUS ───────────────────────────────────────────────────────
// GET /payments/status/:eventId
// Frontend uses this to determine whether to show payment UI, a pending state,
// or a confirmed registered state. Only returns data where webhook_verified = true.
const getPaymentStatus = async (req, res) => {
  const { eventId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'authentication_required' });
  }

  try {
    const result = await pool.query(
      `SELECT
         rp.status AS payment_status,
         rp.captured_at,
         rp.amount_paise,
         rp.payment_method,
         er.registration_status,
         er.qr_code_hash
       FROM razorpay_payments rp
       LEFT JOIN event_registrations er
         ON er.member_id = rp.user_id AND er.event_id = rp.event_id
       WHERE rp.user_id = $1
         AND rp.event_id = $2
         AND rp.webhook_verified = true
       ORDER BY rp.created_at DESC
       LIMIT 1`,
      [userId, eventId]
    );

    if (result.rows.length === 0) {
      return res.json({ status: 'not_paid' });
    }

    return res.json({
      status: 'found',
      ...result.rows[0],
    });
  } catch (err) {
    console.error('[getPaymentStatus] Error:', err.message, err.stack);
    return res.status(500).json({ error: 'status_check_failed' });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getPaymentStatus,
};
