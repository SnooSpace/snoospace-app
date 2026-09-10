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

  const { user_id, event_id, notes } = orderResult.rows[0];
  // pg auto-parses JSONB columns into JS objects
  // notes shape (set in paymentController.createOrder):
  //   { razorpay_notes, tickets: [...], promoCode, discountAmount, sessionId }
  const orderTickets   = notes?.tickets || [];
  const orderSessionId = notes?.sessionId || null;
  const orderPromoCode = notes?.promoCode || null;
  const orderDiscount  = notes?.discountAmount || 0;

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

  // Bust community revenue caches (summary + report, all periods)
  try {
    const { getRedis } = require('../services/redisService');
    const redis = getRedis();
    if (redis) {
      // Look up community_id from the event so we know which community to bust
      const evtRow = await pool.query('SELECT creator_id FROM events WHERE id = $1', [parseInt(event_id)]);
      const communityId = evtRow.rows[0]?.creator_id;
      if (communityId) {
        const periods = ['7d', '15d', '30d', '90d', 'all'];
        await Promise.all(periods.flatMap(p => [
          redis.del(`community:${communityId}:revenue-summary:${p}`),
          redis.del(`community:${communityId}:revenue-report:${p}`),
        ]));
      }
    }
  } catch { /* non-fatal */ }

  console.log(`[Razorpay] payment.captured: payment ${payment.id} for user ${user_id}, event ${event_id}`);

  if (!user_id || !event_id) {
    console.error(`[Razorpay] Missing user_id or event_id in order notes for order ${orderId}`);
    return;
  }

  const parsedUserId  = parseInt(user_id);
  const parsedEventId = parseInt(event_id);

  // ─── Create Event Registration & Fulfill Tickets ───────────────────────────
  // This is the ONLY place we create registrations for paid events.
  // Wrapped in a single atomic transaction with an idempotency guard.
  let registrationId;
  let isNewRegistration = false;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingReg = await client.query(
      `SELECT id FROM event_registrations
       WHERE event_id = $1 AND member_id = $2 AND registration_status != 'cancelled'`,
      [parsedEventId, parsedUserId]
    );

    if (existingReg.rows.length === 0) {
      // Generate QR code hash for the ticket
      const qrCodeHash = crypto.randomBytes(16).toString('hex').toUpperCase();
      const amountRupees = payment.amount / 100;

      const regResult = await client.query(
        `INSERT INTO event_registrations
           (event_id, member_id, registration_status, total_amount,
            promo_code, discount_amount, qr_code_hash)
         VALUES ($1, $2, 'registered', $3, $4, $5, $6)
         RETURNING id`,
        [parsedEventId, parsedUserId, amountRupees, orderPromoCode, orderDiscount, qrCodeHash]
      );
      registrationId = regResult.rows[0].id;
      isNewRegistration = true;

      console.log(
        `[Razorpay] Created registration ${registrationId} for user ${parsedUserId}, event ${parsedEventId}`
      );
    } else {
      registrationId = existingReg.rows[0].id;

      // Ensure registration is in 'registered' status (may have been created speculatively)
      await client.query(
        `UPDATE event_registrations
         SET registration_status = 'registered', total_amount = $3
         WHERE id = $1 AND member_id = $2`,
        [registrationId, parsedUserId, payment.amount / 100]
      );

      console.log(
        `[Razorpay] Updated existing registration ${registrationId} to registered (idempotent replay — skipping ticket/inventory writes)`
      );
    }

    // Link registration back to the order for audit trail
    await client.query(
      `UPDATE razorpay_orders SET registration_id = $1, updated_at = NOW()
       WHERE razorpay_order_id = $2`,
      [registrationId, orderId]
    );

    // ── Ticket line items, inventory, and reservation cleanup ──────────────
    // Only run on first fulfillment of this order. If Razorpay retries the
    // webhook, re-running these would double-insert tickets and double-increment sold_count.
    if (isNewRegistration && orderTickets.length > 0) {
      for (const ticket of orderTickets) {
        const quantity   = parseInt(ticket.quantity, 10) || 1;
        const unitPrice  = parseFloat(ticket.unitPrice) || 0;
        const totalPrice = unitPrice * quantity;

        await client.query(
          `INSERT INTO registration_tickets
             (registration_id, ticket_type_id, ticket_name, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [registrationId, ticket.ticketTypeId || null, ticket.ticketName || 'Ticket', quantity, unitPrice, totalPrice]
        );

        if (ticket.ticketTypeId) {
          await client.query(
            `UPDATE ticket_types
             SET sold_count = sold_count + $2, updated_at = NOW()
             WHERE id = $1`,
            [ticket.ticketTypeId, quantity]
          );
        }
      }

      console.log(
        `[Razorpay] Inserted ${orderTickets.length} ticket line item(s) for registration ${registrationId}`
      );
    }

    // Consume/clear the checkout-hold reservation now that payment succeeded.
    if (isNewRegistration && orderSessionId) {
      // 1. Decrement reserved_count on ticket_types (converting reserved -> sold)
      const reservations = await client.query(
        `SELECT ticket_type_id, quantity FROM ticket_reservations WHERE session_id = $1`,
        [orderSessionId]
      );

      for (const reservation of reservations.rows) {
        await client.query(
          `UPDATE ticket_types
           SET reserved_count = GREATEST(0, COALESCE(reserved_count, 0) - $1)
           WHERE id = $2`,
          [reservation.quantity, reservation.ticket_type_id]
        );
      }

      // 2. Delete the reservation records
      const releaseResult = await client.query(
        `DELETE FROM ticket_reservations WHERE session_id = $1`,
        [orderSessionId]
      );
      console.log(
        `[Razorpay] Consumed ${releaseResult.rowCount} reservation row(s) for session ${orderSessionId}`
      );
    }

    // Remove from bookmarks (event_interests) if the user had marked interest.
    // Mirrors the free-ticket flow in eventController.registerForEvent.
    // DELETE on a non-existent row is a no-op — safe for webhook retries.
    await client.query(
      `DELETE FROM event_interests WHERE event_id = $1 AND member_id = $2`,
      [parsedEventId, parsedUserId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Razorpay] handlePaymentCaptured transaction failed, rolled back:', err.message, err.stack);
    throw err;
  } finally {
    client.release();
  }

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

      const totalTicketCount = orderTickets.length > 0
        ? orderTickets.reduce((sum, t) => sum + (parseInt(t.quantity, 10) || 1), 0)
        : 1;

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
          ticketCount: totalTicketCount,
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

      // Booking confirmation email to the member with actual ticket line items
      const confirmationTickets =
        orderTickets.length > 0
          ? orderTickets.map((t) => ({
              ticketName: t.ticketName || 'Ticket',
              quantity: parseInt(t.quantity, 10) || 1,
              unitPrice: parseFloat(t.unitPrice) || payment.amount / 100,
            }))
          : [{ ticketName: 'Ticket', quantity: 1, unitPrice: payment.amount / 100 }];

      sendBookingConfirmationEmail({
        to: member.email,
        memberName: member.name,
        eventTitle: evt.title,
        eventDate: evt.start_datetime,
        eventLocation: evt.location_url || null,
        tickets: confirmationTickets,
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
// BUG FIX: Wraps all writes in a single transaction so sold_count decrement
// and refund_amount population are atomic with the existing status updates.
// A partial failure will ROLLBACK — no inconsistent state is left behind.
const handleRefundCreated = async (pool, refund, event) => {
  // Razorpay always sends amount in paise (smallest unit). Convert to rupees
  // for event_registrations.refund_amount which stores monetary values in rupees
  // (consistent with total_amount stored as rupees at registration time).
  const refundAmountRupees = (refund.amount || 0) / 100;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Mark payment as refunded ────────────────────────────────────────
    await client.query(
      `UPDATE razorpay_payments SET status = 'refunded', metadata = $2
       WHERE razorpay_payment_id = $1`,
      [refund.payment_id, JSON.stringify(event)]
    );

    // ── 2. Mark order as refunded ──────────────────────────────────────────
    await client.query(
      `UPDATE razorpay_orders
       SET status = 'refunded', updated_at = NOW()
       WHERE razorpay_order_id = (
         SELECT razorpay_order_id FROM razorpay_payments
         WHERE razorpay_payment_id = $1
       )`,
      [refund.payment_id]
    );

    // ── 3. Identify the registration affected by this refund ───────────────
    // Join path: razorpay_payments → (user_id + event_id) → event_registrations
    const regResult = await client.query(
      `SELECT er.id AS registration_id
       FROM event_registrations er
       INNER JOIN razorpay_payments rp
         ON rp.user_id = er.member_id AND rp.event_id = er.event_id
       WHERE rp.razorpay_payment_id = $1
         AND er.registration_status = 'registered'
       LIMIT 1`,
      [refund.payment_id]
    );

    let registrationId = null;
    if (regResult.rows.length > 0) {
      registrationId = regResult.rows[0].registration_id;
    }

    // ── 4. Cancel the registration and populate refund_amount ──────────────
    // FIX 2: Set refund_amount on cancellation.
    // Guarded by registration_status = 'registered' — same guard as the
    // original query, preserving the existing idempotency behaviour.
    await client.query(
      `UPDATE event_registrations er
       SET registration_status = 'cancelled',
           refund_amount        = $2,
           cancelled_at         = NOW()
       FROM razorpay_payments rp
       WHERE rp.razorpay_payment_id = $1
         AND er.member_id = rp.user_id
         AND er.event_id  = rp.event_id
         AND er.registration_status = 'registered'`,
      [refund.payment_id, refundAmountRupees]
    );

    // ── 5. Decrement sold_count on ticket_types ────────────────────────────
    // FIX 1: Restore ticket inventory on refund.
    //
    // registration_tickets stores one row per ticket-type per order, with a
    // quantity column (INTEGER >= 1). A single registration can span multiple
    // ticket types (e.g., 2 Stag + 1 Couple), so we decrement each
    // ticket_type independently by its own quantity, not a hardcoded 1.
    //
    // GREATEST(..., 0) prevents sold_count from going negative in edge cases
    // (e.g., data corrected manually, or duplicate webhook delivery).
    if (registrationId !== null) {
      await client.query(
        `UPDATE ticket_types tt
         SET sold_count = GREATEST(tt.sold_count - rt_agg.total_qty, 0)
         FROM (
           SELECT ticket_type_id, SUM(quantity) AS total_qty
           FROM registration_tickets
           WHERE registration_id = $1
             AND ticket_type_id IS NOT NULL
           GROUP BY ticket_type_id
         ) AS rt_agg
         WHERE tt.id = rt_agg.ticket_type_id`,
        [registrationId]
      );
    } else {
      // No registration_tickets rows found (legacy free-registration or
      // data gap) — nothing to decrement; log for observability.
      console.warn(
        `[Razorpay] refund.created: no registration_tickets found for payment ${refund.payment_id} — sold_count not decremented`
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;   // re-throw so the outer handleRazorpayWebhook catch can log it
  } finally {
    client.release();
  }

  console.log(
    `[Razorpay] refund.created processed: payment=${refund.payment_id} ` +
    `refund_amount=₹${refundAmountRupees}`
  );

  // Bust community revenue caches on refund
  try {
    const { getRedis } = require('../services/redisService');
    const redis = getRedis();
    if (redis) {
      const evtRow = await pool.query(
        `SELECT e.creator_id FROM razorpay_payments rp
         INNER JOIN events e ON rp.event_id = e.id
         WHERE rp.razorpay_payment_id = $1 LIMIT 1`,
        [refund.payment_id]
      );
      const communityId = evtRow.rows[0]?.creator_id;
      if (communityId) {
        const periods = ['7d', '15d', '30d', '90d', 'all'];
        await Promise.all(periods.flatMap(p => [
          redis.del(`community:${communityId}:revenue-summary:${p}`),
          redis.del(`community:${communityId}:revenue-report:${p}`),
        ]));
      }
    }
  } catch { /* non-fatal */ }
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
