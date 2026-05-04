/**
 * Razorpay Webhook Handler
 *
 * CRITICAL: This endpoint must use express.raw() body parser, NOT express.json().
 * Razorpay signs the raw request body — if the body is parsed first, the
 * signature will never match and every webhook will be rejected.
 *
 * Register in routes/index.js BEFORE the global express.json() middleware,
 * or use the express.raw() middleware override on this route only.
 *
 * Razorpay retries failed webhooks (non-200 response) for up to 24 hours.
 * We always return 200 to Razorpay — errors are logged, not surfaced.
 *
 * Required env var: RAZORPAY_WEBHOOK_SECRET
 */

const crypto = require('crypto');

// ─── Signature Verification Middleware ────────────────────────────────────
// Must run before handleRazorpayWebhook. Rejects requests with invalid
// or missing Razorpay-Signature headers.
const verifyRazorpaySignature = (req, res, next) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    // Config error — fail loud in dev, but still accept in prod to avoid
    // silently dropping real payments during a deploy misconfiguration.
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

// ─── Main Webhook Handler ─────────────────────────────────────────────────
const handleRazorpayWebhook = async (req, res) => {
  // Always return 200 first in mindset — Razorpay will retry on non-200.
  // We use try/catch to log errors without breaking the response.
  const pool = req.app.locals.pool;
  const event = req.webhookBody; // parsed by verifyRazorpaySignature
  const eventType = event?.event;

  try {
    if (eventType === 'payment.captured') {
      const payment = event.payload?.payment?.entity;
      const order = event.payload?.order?.entity;

      if (!payment) {
        console.warn('[Razorpay] payment.captured missing payment entity');
        return res.status(200).json({ status: 'ok' });
      }

      // Extract user_id and event_id from order notes (set at order creation time)
      const userId = order?.notes?.user_id ?? payment.notes?.user_id ?? null;
      const eventId = order?.notes?.event_id ?? payment.notes?.event_id ?? null;

      await pool.query(`
        INSERT INTO razorpay_payments (
          razorpay_order_id, razorpay_payment_id,
          user_id, event_id,
          amount_paise, currency,
          status, webhook_verified,
          metadata, captured_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'captured', true, $7, NOW())
        ON CONFLICT (razorpay_order_id) DO UPDATE SET
          razorpay_payment_id = EXCLUDED.razorpay_payment_id,
          status              = 'captured',
          webhook_verified    = true,
          captured_at         = NOW(),
          metadata            = EXCLUDED.metadata
      `, [
        payment.order_id,
        payment.id,
        userId   ? parseInt(userId)   : null,
        eventId  ? parseInt(eventId)  : null,
        payment.amount,    // already in paise
        payment.currency,
        JSON.stringify(event),
      ]);

      console.log(`[Razorpay] payment.captured recorded: ${payment.id}`);

    } else if (eventType === 'payment.failed') {
      const payment = event.payload?.payment?.entity;
      if (!payment) return res.status(200).json({ status: 'ok' });

      await pool.query(`
        INSERT INTO razorpay_payments (
          razorpay_order_id, razorpay_payment_id,
          amount_paise, currency, status, webhook_verified, metadata
        ) VALUES ($1, $2, $3, $4, 'failed', true, $5)
        ON CONFLICT (razorpay_order_id) DO UPDATE SET
          status           = 'failed',
          webhook_verified = true,
          metadata         = EXCLUDED.metadata
      `, [
        payment.order_id, payment.id,
        payment.amount, payment.currency,
        JSON.stringify(event),
      ]);

      console.log(`[Razorpay] payment.failed recorded: ${payment.id}`);

    } else if (eventType === 'refund.created') {
      const refund = event.payload?.refund?.entity;
      if (!refund) return res.status(200).json({ status: 'ok' });

      await pool.query(`
        UPDATE razorpay_payments
        SET status = 'refunded', metadata = $2
        WHERE razorpay_payment_id = $1
      `, [refund.payment_id, JSON.stringify(event)]);

      console.log(`[Razorpay] refund.created recorded for payment: ${refund.payment_id}`);

    } else {
      // Unhandled event type — acknowledge but don't process
      console.log(`[Razorpay] Unhandled event type: ${eventType}`);
    }

  } catch (err) {
    // Log but still return 200 — we don't want Razorpay to retry infinitely
    console.error('[Razorpay] Webhook processing error:', err.message, err.stack);
  }

  return res.status(200).json({ status: 'ok' });
};

module.exports = { verifyRazorpaySignature, handleRazorpayWebhook };
