-- Migration 086: Event Postponement System
--
-- Adds:
--   1. events.is_postponed          — boolean flag for postponed state
--   2. events.postponed_at          — when postponement was declared
--   3. events.original_start_datetime — snapshot of start_datetime at declaration
--   4. event_postponement_decisions — one row per (registration, postponement cycle)
--
-- trigger_source: NO CHANGE needed — it has no CHECK constraint (confirmed).
-- New values 'postponement_opt_out' and 'postponement_indefinite_cap' work as-is.

-- 1. New columns on events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_postponed            BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS postponed_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_start_datetime TIMESTAMPTZ;

-- 2. Decision table
CREATE TABLE IF NOT EXISTS event_postponement_decisions (
  id                       BIGSERIAL PRIMARY KEY,
  event_id                 BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  registration_id          BIGINT NOT NULL REFERENCES event_registrations(id) ON DELETE CASCADE,
  member_id                BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  postponement_declared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  new_date_set_at          TIMESTAMPTZ,
  opt_out_deadline         TIMESTAMPTZ,
  decision                 VARCHAR(40) NOT NULL DEFAULT 'pending'
    CHECK (decision IN (
      'pending',
      'opted_out_refund',
      'kept_ticket',
      'auto_kept_no_response',
      'auto_refunded_indefinite_cap'
    )),
  decided_at               TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Allows a second postponement on the same event to create fresh decision rows
  -- once a prior cycle is fully resolved. postponement_declared_at differs per cycle.
  UNIQUE (event_id, registration_id, postponement_declared_at)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_epd_event    ON event_postponement_decisions(event_id);
CREATE INDEX IF NOT EXISTS idx_epd_member   ON event_postponement_decisions(member_id);
CREATE INDEX IF NOT EXISTS idx_epd_decision ON event_postponement_decisions(decision);
-- Partial index: cron only needs rows where decision='pending' and deadline is set
CREATE INDEX IF NOT EXISTS idx_epd_deadline ON event_postponement_decisions(opt_out_deadline)
  WHERE decision = 'pending' AND opt_out_deadline IS NOT NULL;
-- Partial index for indefinite-cap cron (postponed, no date yet)
CREATE INDEX IF NOT EXISTS idx_epd_no_date  ON event_postponement_decisions(postponement_declared_at)
  WHERE decision = 'pending' AND new_date_set_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_events_is_postponed ON events(is_postponed) WHERE is_postponed = true;
