-- Migration 085: Event Cancellation Auto-Refund Infrastructure
--
-- Adds:
--   1. events.payout_hold       — when true, the payout cron skips this event
--   2. refund_requests.trigger_source — 'buyer' (default) | 'system_cancellation'
--   3. Partial UNIQUE index on refund_requests(registration_id) WHERE not rejected
--      Prevents duplicate active refund requests for the same registration.
--
-- NOTE: events.cancelled_at already exists in the schema (confirmed — was declared
-- but never populated). This migration does NOT re-add it; the application code
-- will now start populating it. payout_hold is net-new.

-- 1. Add payout_hold to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS payout_hold BOOLEAN NOT NULL DEFAULT false;

-- 2. Add trigger_source to refund_requests
ALTER TABLE refund_requests
  ADD COLUMN IF NOT EXISTS trigger_source VARCHAR(50) NOT NULL DEFAULT 'buyer';

-- 3. Partial unique index: one active refund_request per registration
--    Status 'rejected' is excluded — a rejected request can be superseded by a new one.
--    This prevents duplicate system-triggered requests if the cancel endpoint is
--    called twice in a race condition or retry scenario.
CREATE UNIQUE INDEX IF NOT EXISTS idx_refund_requests_registration_active
  ON refund_requests (registration_id)
  WHERE status NOT IN ('rejected');

-- 4. Index on payout_hold to support the cron's WHERE NOT e.payout_hold scan
CREATE INDEX IF NOT EXISTS idx_events_payout_hold
  ON events (payout_hold)
  WHERE payout_hold = true;

-- 5. Index on events.is_cancelled for fast cancel-state lookups
CREATE INDEX IF NOT EXISTS idx_events_is_cancelled
  ON events (is_cancelled)
  WHERE is_cancelled = true;
