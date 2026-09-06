'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');

async function run() {
  const pool = createPool();

  try {
    // ─── Setup: reset seed state to pre-refund baseline ───────────────────
    // Seed registration_id=14, ticket_type_id=79 (Couple, 1 ticket)
    // Seed payment: pay_test_a1_evt0, user_id=124, event_id=42, 50000 paise = ₹500
    await pool.query(
      `UPDATE event_registrations
       SET registration_status = 'registered', refund_amount = NULL, cancelled_at = NULL
       WHERE id = 14`
    );
    await pool.query(`UPDATE ticket_types SET sold_count = 1 WHERE id = 79`);
    await pool.query(
      `UPDATE razorpay_payments SET status = 'captured'
       WHERE razorpay_payment_id = 'pay_test_a1_evt0'`
    );
    await pool.query(
      `UPDATE razorpay_orders SET status = 'paid'
       WHERE razorpay_order_id = 'ord_test_a1_evt0'`
    );
    console.log('[SETUP] State reset to pre-refund baseline');

    // Read baseline values
    const before = await pool.query(`
      SELECT tt.sold_count, er.registration_status, er.refund_amount
      FROM ticket_types tt, event_registrations er
      WHERE tt.id = 79 AND er.id = 14
    `);
    console.log('[BEFORE]', before.rows[0]);

    // ─── Invoke the handler via the main webhook dispatcher ────────────────
    const { handleRazorpayWebhook } = require('../routes/webhooks');

    // amount in paise: 50000 paise = ₹500.00
    const fakeEvent = {
      event: 'refund.created',
      payload: {
        refund: {
          entity: {
            id: 'rfnd_test_001',
            payment_id: 'pay_test_a1_evt0',
            amount: 50000,
            currency: 'INR',
            status: 'processed',
          },
        },
      },
    };

    let statusCode = null;
    let responseBody = null;
    const req = {
      app: { locals: { pool } },
      webhookBody: fakeEvent,
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(body)   { responseBody = body; return this; },
    };

    await handleRazorpayWebhook(req, res);
    console.log('[HANDLER] HTTP response:', statusCode, responseBody);

    // ─── Verify post-state ────────────────────────────────────────────────
    const after = await pool.query(`
      SELECT
        tt.sold_count,
        er.registration_status,
        er.refund_amount,
        er.cancelled_at,
        rp.status AS payment_status,
        ro.status AS order_status
      FROM ticket_types tt,
           event_registrations er,
           razorpay_payments rp,
           razorpay_orders ro
      WHERE tt.id = 79
        AND er.id = 14
        AND rp.razorpay_payment_id = 'pay_test_a1_evt0'
        AND ro.razorpay_order_id   = 'ord_test_a1_evt0'
    `);

    const row = after.rows[0];
    console.log('[AFTER]', row);
    console.log('');

    const ok_a = Number(row.sold_count) === 0;
    const ok_b = parseFloat(row.refund_amount) === 500.00;
    const ok_c = row.registration_status === 'cancelled';
    const ok_d = row.payment_status === 'refunded';
    const ok_e = row.order_status === 'refunded';
    const ok_f = row.cancelled_at !== null;

    console.log('[CHECK] sold_count decremented to 0 (was 1):  ', ok_a ? 'PASS' : 'FAIL', '—', row.sold_count);
    console.log('[CHECK] refund_amount = ₹500 (paise/100):     ', ok_b ? 'PASS' : 'FAIL', '—', row.refund_amount);
    console.log('[CHECK] registration_status = cancelled:       ', ok_c ? 'PASS' : 'FAIL');
    console.log('[CHECK] payment_status = refunded:             ', ok_d ? 'PASS' : 'FAIL');
    console.log('[CHECK] order_status   = refunded:             ', ok_e ? 'PASS' : 'FAIL');
    console.log('[CHECK] cancelled_at   populated:              ', ok_f ? 'PASS' : 'FAIL', '—', row.cancelled_at);

    const allPass = ok_a && ok_b && ok_c && ok_d && ok_e && ok_f;
    console.log('');
    console.log(allPass ? '[RESULT] ALL CHECKS PASSED' : '[RESULT] ONE OR MORE CHECKS FAILED');

    // ─── Test idempotency: fire the same webhook a second time ─────────────
    // sold_count should not go below 0; refund_amount should stay at ₹500.
    console.log('');
    console.log('[IDEMPOTENCY] Firing same webhook again...');
    await handleRazorpayWebhook(req, res);

    const after2 = await pool.query(`
      SELECT tt.sold_count, er.refund_amount
      FROM ticket_types tt, event_registrations er
      WHERE tt.id = 79 AND er.id = 14
    `);
    const row2 = after2.rows[0];
    const ok_idem_a = Number(row2.sold_count) >= 0;   // must not go negative
    const ok_idem_b = Number(row2.sold_count) === 0;  // should stay at 0 (was already 0)
    console.log('[CHECK] sold_count >= 0 after duplicate webhook:', ok_idem_a ? 'PASS' : 'FAIL', '—', row2.sold_count);
    console.log('[CHECK] sold_count = 0 (no double-decrement):  ', ok_idem_b ? 'PASS' : 'FAIL', '—', row2.sold_count);
    console.log('[CHECK] refund_amount unchanged at ₹500:        ', parseFloat(row2.refund_amount) === 500 ? 'PASS' : 'FAIL', '—', row2.refund_amount);

    process.exit(allPass && ok_idem_a ? 0 : 1);
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error('[FATAL]', err.message, err.stack);
  process.exit(1);
});
