-- Migration 083: Buyer-initiated refund requests
-- One row per ticket tier per registration (per-tier model confirmed).
-- Actual Razorpay execution is handled in Prompt D by admin.

CREATE TABLE IF NOT EXISTS refund_requests (
  id                BIGSERIAL PRIMARY KEY,

  -- The buyer's registration (cascade-delete when registration is purged)
  registration_id   BIGINT       NOT NULL REFERENCES event_registrations(id) ON DELETE CASCADE,

  -- Denormalised for fast admin queries without joining back through registration
  member_id         BIGINT       NOT NULL REFERENCES members(id)              ON DELETE CASCADE,
  event_id          BIGINT       NOT NULL REFERENCES events(id)               ON DELETE CASCADE,

  -- The specific ticket tier this request is for (per-tier model)
  ticket_type_id    BIGINT                REFERENCES ticket_types(id)         ON DELETE SET NULL,

  -- Monetary fields
  -- requested_amount = registration_tickets.total_price x (policy.percentage / 100)
  -- Stored in rupees, matching event_registrations.refund_amount convention.
  requested_amount  NUMERIC(10,2) NOT NULL,

  -- Buyer-supplied reason (optional)
  reason            TEXT,

  -- Admin-supplied rejection reason (set in Prompt D; nullable until admin decides)
  rejection_reason  TEXT,

  -- Lifecycle status
  status            VARCHAR(32)  NOT NULL DEFAULT 'pending_review'
                    CHECK (status IN (
                      'pending_review', 'auto_approved', 'manual_review',
                      'approved', 'rejected', 'completed'
                    )),

  -- Snapshot of ticket_types.refund_policy at request time.
  -- Frozen so later organizer edits do not retroactively change pending terms.
  policy_snapshot   JSONB        NOT NULL,

  -- Timestamps
  requested_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  decided_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,

  -- Admin who approved/rejected (FK to admin_users to be formalised in Prompt D)
  decided_by        BIGINT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_refund_requests_registration
  ON refund_requests(registration_id);

CREATE INDEX IF NOT EXISTS idx_refund_requests_ticket_type
  ON refund_requests(ticket_type_id);

CREATE INDEX IF NOT EXISTS idx_refund_requests_status
  ON refund_requests(status);

CREATE INDEX IF NOT EXISTS idx_refund_requests_member
  ON refund_requests(member_id);

CREATE INDEX IF NOT EXISTS idx_refund_requests_event
  ON refund_requests(event_id);
