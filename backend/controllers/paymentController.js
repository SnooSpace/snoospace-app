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

const pool = createPool();

// ─── CREATE ORDER ────────────────────────────────────────────────────────────
// POST /payments/create-order
// Called when user taps "Pay" on the checkout screen for a paid event.
// Creates a Razorpay order and returns order details to the frontend.
// Frontend uses these details to open the Razorpay payment sheet.
const createOrder = async (req, res) => {
  const { eventId, totalAmountRupees } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'authentication_required' });
  }

  if (!eventId) {
    return res.status(400).json({ error: 'event_id_required' });
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
    // This prevents double-payment if the user somehow gets back to checkout
    const existingPayment = await pool.query(
      `SELECT id FROM razorpay_payments
       WHERE user_id = $1 AND event_id = $2
         AND status = 'captured' AND webhook_verified = true`,
      [userId, eventId]
    );

    if (existingPayment.rows.length > 0) {
      return res.status(400).json({ error: 'already_paid' });
    }

    // Check if user is already registered (e.g. from webhook completing earlier)
    const existingReg = await pool.query(
      `SELECT id FROM event_registrations
       WHERE event_id = $1 AND member_id = $2
         AND registration_status != 'cancelled'`,
      [eventId, userId]
    );

    if (existingReg.rows.length > 0) {
      return res.status(400).json({ error: 'already_registered' });
    }

    // Fetch user info for prefill
    const userResult = await pool.query(
      `SELECT name, email FROM members WHERE id = $1`,
      [userId]
    );
    const user = userResult.rows[0] || {};

    // totalAmountRupees comes from the frontend after applying discounts/promo codes.
    // Convert to paise — Razorpay always works in the smallest currency unit.
    // Minimum Razorpay amount is ₹1 (100 paise).
    const amountPaise = Math.round(parseFloat(totalAmountRupees || 0) * 100);

    if (amountPaise < 100) {
      return res.status(400).json({
        error: 'amount_too_low',
        message: 'Minimum payable amount is ₹1. Use free registration for zero-cost tickets.'
      });
    }

    // Create order in Razorpay
    const receipt = `SNS-${userId}-${eventId}-${Date.now()}`;
    const razorpayOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        user_id: String(userId),    // stored as string — Razorpay notes are string-only
        event_id: String(eventId),
        event_title: event.title,
      },
    });

    // Store order in our database so the webhook can look it up by order_id
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
        JSON.stringify(razorpayOrder.notes),
      ]
    );

    console.log(
      `[createOrder] Created Razorpay order ${razorpayOrder.id} for user ${userId}, event ${eventId}, amount: ${amountPaise} paise`
    );

    // Return order details to frontend
    // key_id is the PUBLIC identifier — safe to expose to clients
    // NEVER send key_secret to the frontend
    return res.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: amountPaise,          // paise
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
      eventTitle: event.title,
      receipt,
      prefill: {
        name: user.name || '',
        email: user.email || '',
        contact: '',  // phone not stored — leave blank for user to fill
      },
    });
  } catch (err) {
    console.error('[createOrder] Error:', err.message, err.stack);
    return res.status(500).json({ error: 'order_creation_failed' });
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
