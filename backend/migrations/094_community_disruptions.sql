-- Migration 094: Community Disruptions & Cancellation Reliability System
--
-- Adds:
--   1. community_disruptions table to track event cancellations & postponements
--   2. communities.non_genuine_cancellation_count (int, default 0)
--   3. communities.cancellation_flagged (boolean, default false)

-- 1. Create community_disruptions table
CREATE TABLE IF NOT EXISTS community_disruptions (
  id                  BIGSERIAL PRIMARY KEY,
  community_id        BIGINT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  event_id            BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  disruption_type     TEXT NOT NULL CHECK (disruption_type IN ('cancellation', 'postponement')),
  attendee_count      INT NOT NULL DEFAULT 0,
  reason_category     TEXT NOT NULL,
  reason_text         TEXT,
  is_genuine          BOOLEAN NOT NULL DEFAULT false,
  needs_manual_review BOOLEAN NOT NULL DEFAULT false,
  reviewed_by         BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on (community_id, is_genuine, created_at) for efficient rolling-window lookups
CREATE INDEX IF NOT EXISTS idx_community_disruptions_comm_genuine_date
  ON community_disruptions (community_id, is_genuine, created_at);

-- 2. Add reliability columns to communities
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS non_genuine_cancellation_count INT NOT NULL DEFAULT 0;

ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS cancellation_flagged BOOLEAN NOT NULL DEFAULT false;
