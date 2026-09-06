-- Migration 084: Payout Ledger System
-- event_payouts: one row per event, computed 48h after end_datetime or on admin early-request.
-- community_payout_settings: per-community toggle for early payout (admin-only write).
--
-- IMPORTANT: No real bank transfer happens. 'released' status = admin bookkeeping only.
-- Actual money movement to communities requires Route/KYB infrastructure (future work).

-- ─── event_payouts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_payouts (
  id                    BIGSERIAL PRIMARY KEY,

  -- One payout record per event (enforced at DB level)
  event_id              BIGINT       NOT NULL REFERENCES events(id)      ON DELETE CASCADE,
  community_id          BIGINT       NOT NULL REFERENCES communities(id)  ON DELETE CASCADE,

  -- Lifecycle status
  -- 'pending'  = row being created (transient, should not persist)
  -- 'ready'    = ledger computed, awaiting admin review/release
  -- 'released' = admin has manually marked as paid out (no automated transfer)
  status                VARCHAR(20)  NOT NULL DEFAULT 'ready'
                        CHECK (status IN ('pending', 'ready', 'released')),

  -- Revenue components (all in rupees, matching existing convention)
  gross_revenue         NUMERIC(12,2) NOT NULL,  -- sum of price_paid across active registrations
  total_discounts       NUMERIC(12,2) NOT NULL DEFAULT 0,  -- sum of discount_amount
  platform_fee_amount   NUMERIC(12,2) NOT NULL,  -- 8% of price_paid (post-discount) per ticket
  refunds_deducted      NUMERIC(12,2) NOT NULL DEFAULT 0,  -- buyer-facing refund_amount sum; fee NOT clawed back
  tax_amount            NUMERIC(12,2) DEFAULT NULL,         -- INTENTIONALLY NULL: pending GST/tax compliance decision.
                                                             -- Do NOT compute or populate this field until legal/finance
                                                             -- confirms the applicable tax treatment. Left as a placeholder
                                                             -- so it is visible in the schema/API, not silently omitted.
  final_payout_amount   NUMERIC(12,2) NOT NULL,  -- gross - fee - refunds (tax excluded; can be negative)

  -- Full per-ticket-type breakdown at time of computation.
  -- Frozen snapshot so the view doesn't need to recompute from raw data.
  -- Shape: { tiers: [{ name, tickets_sold, gross, platform_fee, net }], totals: {...} }
  ledger_snapshot       JSONB        NOT NULL,

  -- How this payout was triggered
  trigger_type          VARCHAR(20)  NOT NULL
                        CHECK (trigger_type IN ('scheduled', 'early_on_demand')),

  -- When payout becomes eligible (end_datetime + 48h for scheduled; = created_at for early)
  scheduled_release_at  TIMESTAMPTZ  NOT NULL,

  -- Set when admin marks 'released' (manual bookkeeping; not an automated bank transfer)
  actual_released_at    TIMESTAMPTZ,
  released_by           BIGINT       REFERENCES admins(id) ON DELETE SET NULL,

  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- One payout per event — enforced at DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_payouts_event_id
  ON event_payouts(event_id);

CREATE INDEX IF NOT EXISTS idx_event_payouts_status
  ON event_payouts(status);

CREATE INDEX IF NOT EXISTS idx_event_payouts_community
  ON event_payouts(community_id);

CREATE INDEX IF NOT EXISTS idx_event_payouts_scheduled_release
  ON event_payouts(scheduled_release_at);

-- ─── community_payout_settings ───────────────────────────────────────────────
-- Per-community toggle for early payout (admin-only write; communities cannot
-- enable this for themselves). Separate table (not a column on communities)
-- because the settings concern a different operational domain (finance/admin)
-- and avoids widening the already broad communities table further.
CREATE TABLE IF NOT EXISTS community_payout_settings (
  community_id          BIGINT       NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  early_payout_enabled  BOOLEAN      NOT NULL DEFAULT FALSE,
  updated_by            BIGINT       REFERENCES admins(id)               ON DELETE SET NULL,
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (community_id)
);

CREATE INDEX IF NOT EXISTS idx_community_payout_settings_community
  ON community_payout_settings(community_id);
