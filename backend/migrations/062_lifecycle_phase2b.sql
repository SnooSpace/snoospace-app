-- Migration 062: Lifecycle System Phase 2b
-- Adds per-content-type impression state for Events (INTEGER id) and
-- Opportunities (UUID id), both separate from post_impression_state to
-- avoid the BIGINT FK constraint on posts(id) that is incompatible with
-- the UUID primary key on opportunities.

CREATE TABLE IF NOT EXISTS event_impression_state (
  user_id     BIGINT NOT NULL,
  user_type   VARCHAR(20) NOT NULL,
  event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  unseen_count INT DEFAULT 0,
  last_session_id UUID,
  retired_at  TIMESTAMPTZ,
  PRIMARY KEY (user_id, user_type, event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_impression_retired
  ON event_impression_state(user_id, user_type, event_id)
  WHERE retired_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS opportunity_impression_state (
  user_id          BIGINT NOT NULL,
  user_type        VARCHAR(20) NOT NULL,
  opportunity_id   UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  unseen_count     INT DEFAULT 0,
  last_session_id  UUID,
  retired_at       TIMESTAMPTZ,
  PRIMARY KEY (user_id, user_type, opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_opportunity_impression_retired
  ON opportunity_impression_state(user_id, user_type, opportunity_id)
  WHERE retired_at IS NOT NULL;
