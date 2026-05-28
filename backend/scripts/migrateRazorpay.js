/**
 * migrateRazorpay.js
 * Creates razorpay_orders and razorpay_payments tables.
 *
 * Run once:
 *   node backend/scripts/migrateRazorpay.js
 *
 * Safe to re-run — uses IF NOT EXISTS everywhere.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createPool } = require('../config/db');

const pool = createPool();

const SQL = `
-- ─── Razorpay Orders ─────────────────────────────────────────────────────────
-- Created before payment, updated after. One order = one checkout attempt.
CREATE TABLE IF NOT EXISTS razorpay_orders (
  id                  BIGSERIAL PRIMARY KEY,
  razorpay_order_id   VARCHAR(100) UNIQUE NOT NULL,  -- e.g. order_ABC123
  user_id             BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  event_id            BIGINT NOT NULL,
  registration_id     BIGINT,                         -- populated after registration row created
  amount_paise        INT NOT NULL,                   -- ALWAYS paise — 1 rupee = 100 paise
  currency            VARCHAR(10) DEFAULT 'INR',
  status              VARCHAR(30) DEFAULT 'created',
  -- 'created'   → order exists, payment not yet attempted
  -- 'attempted' → payment initiated by user (client-side verify called)
  -- 'paid'      → payment captured (webhook confirmed)
  -- 'failed'    → payment failed (webhook confirmed)
  -- 'refunded'  → payment refunded (webhook confirmed)
  receipt             VARCHAR(100),                   -- SNS-{userId}-{eventId}-{timestamp}
  notes               JSONB,                          -- user_id and event_id for webhook retrieval
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Razorpay Payments ────────────────────────────────────────────────────────
-- One order can have multiple payment attempts (e.g. user retries).
-- webhook_verified = true ONLY after Razorpay webhook signature is verified.
-- NEVER trust a payment where webhook_verified = false.
CREATE TABLE IF NOT EXISTS razorpay_payments (
  id                    BIGSERIAL PRIMARY KEY,
  razorpay_payment_id   VARCHAR(100) UNIQUE NOT NULL,  -- e.g. pay_XYZ
  razorpay_order_id     VARCHAR(100) NOT NULL
                          REFERENCES razorpay_orders(razorpay_order_id),
  user_id               BIGINT REFERENCES members(id),
  event_id              BIGINT,
  amount_paise          INT NOT NULL,
  currency              VARCHAR(10) DEFAULT 'INR',
  status                VARCHAR(30) DEFAULT 'created',
  -- 'captured'  → payment successfully captured
  -- 'failed'    → payment failed
  -- 'refunded'  → payment refunded
  webhook_verified      BOOLEAN DEFAULT FALSE,
  -- CRITICAL: only TRUE after webhook signature verified
  -- Never fulfil the order based on data where this is FALSE
  payment_method        VARCHAR(50),                   -- 'upi', 'card', 'netbanking', 'wallet'
  metadata              JSONB,                         -- full Razorpay webhook payload for debugging
  captured_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_user
  ON razorpay_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_event
  ON razorpay_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_status
  ON razorpay_orders(status);
CREATE INDEX IF NOT EXISTS idx_razorpay_payments_order
  ON razorpay_payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_payments_user_event
  ON razorpay_payments(user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_payments_status
  ON razorpay_payments(status);
`;

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running Razorpay migration...');
    await client.query(SQL);
    console.log('✅ razorpay_orders table created/verified');
    console.log('✅ razorpay_payments table created/verified');
    console.log('✅ Indexes created/verified');
    console.log('✅ Razorpay migration complete');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
