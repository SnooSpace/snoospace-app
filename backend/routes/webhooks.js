/**
 * Razorpay Webhook Handler
 *
 * CRITICAL: This endpoint must use express.raw() body parser, NOT express.json().
 * Razorpay signs the raw request body — if the body is parsed first, the
 * signature will never match and every webhook will be rejected.
 *
 * Registered in server.js BEFORE the global express.json() middleware.
 *
 * Razorpay retries failed webhooks (non-200 response) for up to 24 hours.
 * We always return 200 to Razorpay — errors are logged, not surfaced.
 *
 * Required env vars:
 *   RAZORPAY_WEBHOOK_SECRET  — set in Razorpay dashboard under Settings → Webhooks
 */

const crypto = require('crypto');
const notificationService = require('../services/notificationService');
const pushService = require('../services/pushService');
const { sendBookingConfirmationEmail } = require('../services/emailService');
const { emitSignal, getCategoryForEvent } = require('../utils/signalEmitter');

// ─── Signature Verification Middleware ────────────────────────────────────────
// Must run before handleRazorpayWebhook. Rejects requests with invalid
// or missing Razorpay-Signature headers.
const verifyRazorpaySignature = (req, res, next) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    // Config error — fail loud in dev, accept in prod to avoid silently
    // dropping real payments during a deploy misconfiguration.
    console.error('[Razorpay] RAZORPAY_WEBHOOK_SECRET is not set!');
    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({ error: 'webhook_secret_missing' });
    }
  }

  const receivedSignature = req.headers['x-razorpay-signature'];

  if (!receivedSignature) {
    console.warn('[Razorpay] Webhook received without signature header', {
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });
    return res.status(400).json({ error: 'missing_signature' });
  }

  // req.body is a Buffer when express.raw() is used on this route
  const rawBody = req.body instanceof Buffer
    ? req.body
    : Buffer.from(JSON.stringify(req.body));

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret || '')
    .update(rawBody)
    .digest('hex');

  if (receivedSignature !== expectedSignature) {
    console.warn('[Razorpay] Invalid webhook signature', {
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });
    return res.status(400).json({ error: 'invalid_signature' });
  }

  // Parse the raw buffer into JSON for the handler
  try {
    req.webhookBody = JSON.parse(rawBody.toString());
  } catch {
    return res.status(400).json({ error: 'invalid_json_body' });
  }

  next();
};

// ─── Payment Captured Handler ─────────────────────────────────────────────────
// This is the authoritative moment of registration for paid events.
// Only runs when Razorpay confirms payment was successfully captured.
const handlePaymentCaptured = async (pool, payment, event) => {
  const orderId = payment.order_id;

  // Look up our stored order to get user_id and event_id
  // Notes were set at order creation time in paymentController.createOrder
  const orderResult = await pool.query(
    `SELECT user_id, event_id, notes FROM razorpay_orders WHERE razorpay_order_id = $1`,
    [orderId]
  );

  if (orderResult.rows.length === 0) {
    console.error(`[Razorpay] handlePaymentCaptured: order not found: ${orderId}`);
    return;
  }

  const { user_id, event_id } = orderResult.rows[0];

  // Insert or update the payment record
  // ON CONFLICT handles the case where a previous attempt already inserted a row
  await pool.query(
    `INSERT INTO razorpay_payments (
       razorpay_payment_id, razorpay_order_id,
       user_id, event_id,
       amount_paise, currency,
       status, webhook_verified,
       payment_method, metadata, captured_at
     ) VALUES ($1, $2, $3, $4, $5, $6, 'captured', true, $7, $8, NOW())
     ON CONFLICT (razorpay_payment_id) DO UPDATE SET
       status           = 'captured',
       webhook_verified = true,
       captured_at      = NOW(),
       metadata         = EXCLUDED.metadata`,
    [
      payment.id,
      orderId,
      user_id   ? parseInt(user_id)   : null,
      event_id  ? parseInt(event_id)  : null,
      payment.amount,     // already in paise
      payment.currency,
      payment.method || null,
      JSON.stringify(event),
    ]
  );

  // Update order status to paid
  await pool.query(
    `UPDATE razorpay_orders SET status = 'paid', updated_at = NOW()
     WHERE razorpay_order_id = $1`,
    [orderId]
  );

  console.log(`[Razorpay] payment.captured: payment ${payment.id} for user ${user_id}, event ${event_id}`);

  if (!user_id || !event_id) {
    console.error(`[Razorpay] Missing user_id or event_id in order notes for order ${orderId}`);
    return;
  }

  const parsedUserId  = parseInt(user_id);
  const parsedEventId = parseInt(event_id);

  // ─── Create Event Registration ─────────────────────────────────────────────
  // This is the ONLY place we create registrations for paid events.
  // eventController.registerForEvent will now block paid events (totalAmount > 0)
  // from registering — all paid registrations flow through here.

  const existingReg = await pool.query(
    `SELECT id FROM event_registrations
     WHERE event_id = $1 AND member_id = $2 AND registration_status != 'cancelled'`,
    [parsedEventId, parsedUserId]
  );

  let registrationId;

  if (existingReg.rows.length === 0) {
    // Generate QR code hash for the ticket
    const qrCodeHash = crypto.randomBytes(16).toString('hex').toUpperCase();
    const amountRupees = payment.amount / 100;

    const regResult = await pool.query(
      `INSERT INTO event_registrations
         (event_id, member_id, registration_status, total_amount, qr_code_hash)
       VALUES ($1, $2, 'registered', $3, $4)
       RETURNING id`,
      [parsedEventId, parsedUserId, amountRupees, qrCodeHash]
    );
    registrationId = regResult.rows[0].id;

    console.log(
      `[Razorpay] Created registration ${registrationId} for user ${parsedUserId}, event ${parsedEventId}`
    );
  } else {
    registrationId = existingReg.rows[0].id;

    // Ensure registration is in 'registered' status (may have been created speculatively)
    await pool.query(
      `UPDATE event_registrations
       SET registration_status = 'registered', total_amount = $3
       WHERE id = $1 AND member_id = $2`,
      [registrationId, parsedUserId, payment.amount / 100]
    );

    console.log(
      `[Razorpay] Updated existing registration ${registrationId} to registered`
    );
  }

  // Link registration back to the order for audit trail
  await pool.query(
    `UPDATE razorpay_orders SET registration_id = $1, updated_at = NOW()
     WHERE razorpay_order_id = $2`,
    [registrationId, orderId]
  );

  // ─── Emit AQI Signal (event_rsvp) ─────────────────────────────────────────
  // paid_event_attended fires only after QR check-in (postEventAttendanceResolver).
  // At registration time, we only emit event_rsvp even for paid events.
  getCategoryForEvent(pool, parsedEventId).then((category) =>
    emitSignal(pool, {
      userId: parsedUserId,
      userType: 'member',
      eventType: 'event_rsvp',
      category,
      metadata: {
        event_id: parsedEventId,
        ticket_price: payment.amount / 100,
        payment_verified: true,
        razorpay_payment_id: payment.id,
      },
    })
  ).catch((err) => console.error('[Razorpay] emitSignal failed:', err.message));

  // ─── Send Booking Confirmation Email ─────────────────────────────────────
  try {
    const memberResult = await pool.query(
      `SELECT name, email FROM members WHERE id = $1`,
      [parsedUserId]
    );
    const eventResult = await pool.query(
      `SELECT title, start_datetime, location_url, community_id FROM events WHERE id = $1`,
      [parsedEventId]
    );

    if (memberResult.rows.length > 0 && eventResult.rows.length > 0) {
      const member = memberResult.rows[0];
      const evt = eventResult.rows[0];

      // In-app notification to the community
      await notificationService.createSimpleNotification(pool, {
        recipientId: evt.community_id,
        recipientType: 'community',
        actorId: parsedUserId,
        actorType: 'member',
        type: 'event_registration',
        payload: {
          eventId: parsedEventId,
          eventTitle: evt.title,
          memberName: member.name,
          actorName: member.name,
          totalAmount: payment.amount / 100,
        },
      }).catch((err) => console.warn('[Razorpay] community notification failed:', err.message));

      // Push notification to community
      pushService.sendPushNotification(
        pool,
        evt.community_id,
        'community',
        'New Registration (Paid) 🎟️',
        `${member.name} paid and registered for ${evt.title}`,
        { type: 'event_registration', eventId: parsedEventId }
      ).catch((err) => console.warn('[Razorpay] community push failed:', err.message));

      // Booking confirmation email to the member
      sendBookingConfirmationEmail({
        to: member.email,
        memberName: member.name,
        eventTitle: evt.title,
        eventDate: evt.start_datetime,
        eventLocation: evt.location_url || null,
        tickets: [{ ticketName: 'Ticket', quantity: 1, unitPrice: payment.amount / 100 }],
        qrCodeHash: null,  // QR hash will be fetched from event_registrations by member
        totalAmount: payment.amount / 100,
      }).catch((err) => console.warn('[Razorpay] confirmation email failed:', err.message));
    }
  } catch (notifErr) {
    // Non-critical — don't let notifications break the webhook acknowledgment
    console.warn('[Razorpay] Post-payment notifications failed:', notifErr.message);
  }
};

// ─── Payment Failed Handler ───────────────────────────────────────────────────
const handlePaymentFailed = async (pool, payment, event) => {
  const orderId = payment.order_id;

  await pool.query(
    `UPDATE razorpay_orders SET status = 'failed', updated_at = NOW()
     WHERE razorpay_order_id = $1`,
    [orderId]
  );

  await pool.query(
    `INSERT INTO razorpay_payments (
       razorpay_payment_id, razorpay_order_id,
       amount_paise, currency, status, webhook_verified, metadata
     ) VALUES ($1, $2, $3, $4, 'failed', true, $5)
     ON CONFLICT (razorpay_payment_id) DO UPDATE SET
       status           = 'failed',
       webhook_verified = true,
       metadata         = EXCLUDED.metadata`,
    [
      payment.id,
      orderId,
      payment.amount,
      payment.currency,
      JSON.stringify(event),
    ]
  );

  console.log(`[Razorpay] payment.failed recorded: ${payment.id}`);
};

// ─── Refund Created Handler ───────────────────────────────────────────────────
const handleRefundCreated = async (pool, refund, event) => {
  await pool.query(
    `UPDATE razorpay_payments SET status = 'refunded', metadata = $2
     WHERE razorpay_payment_id = $1`,
    [refund.payment_id, JSON.stringify(event)]
  );

  await pool.query(
    `UPDATE razorpay_orders
     SET status = 'refunded', updated_at = NOW()
     WHERE razorpay_order_id = (
       SELECT razorpay_order_id FROM razorpay_payments
       WHERE razorpay_payment_id = $1
     )`,
    [refund.payment_id]
  );

  // Cancel the event registration for this payment
  await pool.query(
    `UPDATE event_registrations er
     SET registration_status = 'cancelled'
     FROM razorpay_payments rp
     WHERE rp.razorpay_payment_id = $1
       AND er.member_id = rp.user_id
       AND er.event_id = rp.event_id
       AND er.registration_status = 'registered'`,
    [refund.payment_id]
  );

  console.log(`[Razorpay] refund.created processed for payment: ${refund.payment_id}`);
};

// ─── Main Webhook Handler ─────────────────────────────────────────────────────
const handleRazorpayWebhook = async (req, res) => {
  const pool = req.app.locals.pool;
  const event = req.webhookBody;  // parsed and verified by verifyRazorpaySignature
  const eventType = event?.event;

  try {
    if (eventType === 'payment.captured') {
      const payment = event.payload?.payment?.entity;
      if (!payment) {
        console.warn('[Razorpay] payment.captured missing payment entity');
        return res.status(200).json({ status: 'ok' });
      }
      await handlePaymentCaptured(pool, payment, event);

    } else if (eventType === 'payment.failed') {
      const payment = event.payload?.payment?.entity;
      if (!payment) return res.status(200).json({ status: 'ok' });
      await handlePaymentFailed(pool, payment, event);

    } else if (eventType === 'refund.created') {
      const refund = event.payload?.refund?.entity;
      if (!refund) return res.status(200).json({ status: 'ok' });
      await handleRefundCreated(pool, refund, event);

    } else {
      console.log(`[Razorpay] Unhandled event type: ${eventType}`);
    }

  } catch (err) {
    // Log but still return 200 — do not trigger Razorpay retries for our own processing errors
    console.error('[Razorpay] Webhook processing error:', err.message, err.stack);
  }

  return res.status(200).json({ status: 'ok' });
};

module.exports = { verifyRazorpaySignature, handleRazorpayWebhook };
