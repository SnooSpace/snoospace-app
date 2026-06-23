-- ============================================================
-- Migration 029: Separate circle-superseded state from dormancy
-- 
-- Previously, when a member joined a creator's circle, the
-- creator_follows row was set to is_dormant=true. But is_dormant
-- is semantically reserved for Creator Mode being toggled off.
-- 
-- This migration adds is_superseded_by_circle (a distinct flag)
-- and updates the follower count trigger to treat a row as active
-- only when BOTH flags are false.
-- ============================================================

-- 1. Add new column
ALTER TABLE creator_follows
  ADD COLUMN IF NOT EXISTS is_superseded_by_circle BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill: rows where follower and creator are in a circle
--    should use the new column (not is_dormant)
UPDATE creator_follows cf
SET
  is_superseded_by_circle = true,
  is_dormant = false  -- un-set the incorrect dormant flag
FROM circles ci
WHERE cf.is_dormant = true
  AND (
    (cf.follower_id = ci.user_a_id AND cf.creator_id = ci.user_b_id)
    OR
    (cf.follower_id = ci.user_b_id AND cf.creator_id = ci.user_a_id)
  );

-- 3. Index for fast lookup of active follows
CREATE INDEX IF NOT EXISTS idx_creator_follows_active
  ON creator_follows(creator_id)
  WHERE is_dormant = false AND is_superseded_by_circle = false;

-- 4. Update the follower count trigger to use both flags
CREATE OR REPLACE FUNCTION fn_update_creator_follower_count()
RETURNS TRIGGER AS $$
DECLARE
  was_active BOOLEAN;
  is_active  BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_dormant = false AND NEW.is_superseded_by_circle = false THEN
      UPDATE members
        SET creator_follower_count = creator_follower_count + 1
        WHERE id = NEW.creator_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.is_dormant = false AND OLD.is_superseded_by_circle = false THEN
      UPDATE members
        SET creator_follower_count = GREATEST(0, creator_follower_count - 1)
        WHERE id = OLD.creator_id;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    was_active := (OLD.is_dormant = false AND OLD.is_superseded_by_circle = false);
    is_active  := (NEW.is_dormant = false AND NEW.is_superseded_by_circle = false);

    IF was_active AND NOT is_active THEN
      -- Row deactivated
      UPDATE members
        SET creator_follower_count = GREATEST(0, creator_follower_count - 1)
        WHERE id = NEW.creator_id;
    ELSIF NOT was_active AND is_active THEN
      -- Row reactivated
      UPDATE members
        SET creator_follower_count = creator_follower_count + 1
        WHERE id = NEW.creator_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger already exists — just recreating the function is enough
-- (trigger definition unchanged, still fires AFTER INSERT OR UPDATE OR DELETE)
