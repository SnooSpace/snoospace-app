-- ============================================================
-- Migration 022: Circles — Member-to-Member Connection System
-- Replaces member↔member follow with a mutual, request-based
-- "Circle" system. Following remains unchanged for all other
-- account type combinations.
--
-- NOTE: members.id is BIGINT (BIGSERIAL), not UUID.
-- ============================================================

-- 1. Pending / historical connection requests between two People
CREATE TABLE IF NOT EXISTS circle_requests (
  id          BIGSERIAL PRIMARY KEY,
  sender_id   BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  receiver_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (sender_id, receiver_id)
);

-- 2. Confirmed mutual circle relationships (one row per pair, undirected)
--    Enforce user_a_id < user_b_id in application code before inserting.
CREATE TABLE IF NOT EXISTS circles (
  id         BIGSERIAL PRIMARY KEY,
  user_a_id  BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  user_b_id  BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (user_a_id < user_b_id),
  UNIQUE (user_a_id, user_b_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_circle_requests_receiver
  ON circle_requests(receiver_id, status);

CREATE INDEX IF NOT EXISTS idx_circle_requests_sender
  ON circle_requests(sender_id, status);

CREATE INDEX IF NOT EXISTS idx_circles_user_a ON circles(user_a_id);
CREATE INDEX IF NOT EXISTS idx_circles_user_b ON circles(user_b_id);

-- 4. Denormalized circle_count on members
--    Maintained by trigger below. Defaults to 0 — backfill happens
--    in the data migration script (023_circles_migration.js).
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS circle_count INT NOT NULL DEFAULT 0;

-- 5. Trigger function to maintain circle_count
CREATE OR REPLACE FUNCTION fn_update_circle_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE members SET circle_count = circle_count + 1 WHERE id = NEW.user_a_id;
    UPDATE members SET circle_count = circle_count + 1 WHERE id = NEW.user_b_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE members SET circle_count = GREATEST(0, circle_count - 1) WHERE id = OLD.user_a_id;
    UPDATE members SET circle_count = GREATEST(0, circle_count - 1) WHERE id = OLD.user_b_id;
  END IF;
  RETURN NULL;
END;
$$;

-- 6. Attach trigger (idempotent — drop first)
DROP TRIGGER IF EXISTS trg_circle_count ON circles;

CREATE TRIGGER trg_circle_count
  AFTER INSERT OR DELETE ON circles
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_circle_count();
