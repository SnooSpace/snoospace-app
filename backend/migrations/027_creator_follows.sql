-- ============================================================
-- Migration 027: Creator Follows
-- One-way content-interest relationship between any account
-- and a Creator Mode member.
--
-- NOTE: follower_id and creator_id use BIGINT to match members.id
-- (members.id is BIGINT/BIGSERIAL — not UUID)
-- ============================================================

CREATE TABLE IF NOT EXISTS creator_follows (
  id             BIGSERIAL PRIMARY KEY,
  follower_id    BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  follower_type  TEXT NOT NULL DEFAULT 'member'
                 CHECK (follower_type IN ('member', 'community', 'page')),
  creator_id     BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ DEFAULT now(),
  is_dormant     BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (follower_id, creator_id),
  CHECK (follower_id != creator_id)
);

-- Fast lookup: all active followers of a given creator
CREATE INDEX IF NOT EXISTS idx_creator_follows_creator
  ON creator_follows(creator_id)
  WHERE is_dormant = false;

-- Fast lookup: all creators a given account follows
CREATE INDEX IF NOT EXISTS idx_creator_follows_follower
  ON creator_follows(follower_id);

-- Fast lookup: notable followers (community/page) per creator
CREATE INDEX IF NOT EXISTS idx_creator_follows_creator_type
  ON creator_follows(creator_id, follower_type)
  WHERE is_dormant = false;

-- Denormalized follower count on members table for fast profile display
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS creator_follower_count INT NOT NULL DEFAULT 0;

-- ── Trigger: maintain creator_follower_count ─────────────────────────────────

CREATE OR REPLACE FUNCTION fn_update_creator_follower_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_dormant = false THEN
    UPDATE members
    SET creator_follower_count = creator_follower_count + 1
    WHERE id = NEW.creator_id;

  ELSIF TG_OP = 'DELETE' AND OLD.is_dormant = false THEN
    UPDATE members
    SET creator_follower_count = GREATEST(0, creator_follower_count - 1)
    WHERE id = OLD.creator_id;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Dormancy toggle: active → dormant (decrement)
    IF OLD.is_dormant = false AND NEW.is_dormant = true THEN
      UPDATE members
      SET creator_follower_count = GREATEST(0, creator_follower_count - 1)
      WHERE id = NEW.creator_id;
    -- Dormancy toggle: dormant → active (increment)
    ELSIF OLD.is_dormant = true AND NEW.is_dormant = false THEN
      UPDATE members
      SET creator_follower_count = creator_follower_count + 1
      WHERE id = NEW.creator_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger (idempotent)
DROP TRIGGER IF EXISTS trg_creator_follower_count ON creator_follows;

CREATE TRIGGER trg_creator_follower_count
AFTER INSERT OR UPDATE OR DELETE ON creator_follows
FOR EACH ROW EXECUTE FUNCTION fn_update_creator_follower_count();
