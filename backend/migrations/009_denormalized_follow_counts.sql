-- ============================================================
-- Migration 009: Denormalized follow counts
-- Replaces live COUNT(*) subqueries on every profile load
-- with integer columns maintained by a trigger.
-- ============================================================

-- 1. Add columns
-- Default 0 so existing rows are valid immediately.
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS follower_count  INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count INT NOT NULL DEFAULT 0;

ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS follower_count  INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count INT NOT NULL DEFAULT 0;

-- 2. Backfill from live data
UPDATE members m
SET
  follower_count  = (SELECT COUNT(*) FROM follows WHERE following_id = m.id AND following_type = 'member'),
  following_count = (SELECT COUNT(*) FROM follows WHERE follower_id  = m.id AND follower_type  = 'member');

UPDATE communities c
SET
  follower_count  = (SELECT COUNT(*) FROM follows WHERE following_id = c.id AND following_type = 'community'),
  following_count = (SELECT COUNT(*) FROM follows WHERE follower_id  = c.id AND follower_type  = 'community');

-- 3. Trigger function
-- Handles INSERT (follow) and DELETE (unfollow).
-- Both directions (follower_type and following_type) are checked
-- independently so a member→community follow correctly increments
-- the member's following_count AND the community's follower_count.
-- GREATEST(0, n - 1) prevents negative counts from data anomalies.
CREATE OR REPLACE FUNCTION fn_update_follow_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN

    -- Increment follower_count on the entity being followed
    IF NEW.following_type = 'member' THEN
      UPDATE members
        SET follower_count = follower_count + 1
        WHERE id = NEW.following_id;
    ELSIF NEW.following_type = 'community' THEN
      UPDATE communities
        SET follower_count = follower_count + 1
        WHERE id = NEW.following_id;
    END IF;

    -- Increment following_count on the entity doing the following
    IF NEW.follower_type = 'member' THEN
      UPDATE members
        SET following_count = following_count + 1
        WHERE id = NEW.follower_id;
    ELSIF NEW.follower_type = 'community' THEN
      UPDATE communities
        SET following_count = following_count + 1
        WHERE id = NEW.follower_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN

    -- Decrement follower_count on the entity that was being followed
    IF OLD.following_type = 'member' THEN
      UPDATE members
        SET follower_count = GREATEST(0, follower_count - 1)
        WHERE id = OLD.following_id;
    ELSIF OLD.following_type = 'community' THEN
      UPDATE communities
        SET follower_count = GREATEST(0, follower_count - 1)
        WHERE id = OLD.following_id;
    END IF;

    -- Decrement following_count on the entity that was following
    IF OLD.follower_type = 'member' THEN
      UPDATE members
        SET following_count = GREATEST(0, following_count - 1)
        WHERE id = OLD.follower_id;
    ELSIF OLD.follower_type = 'community' THEN
      UPDATE communities
        SET following_count = GREATEST(0, following_count - 1)
        WHERE id = OLD.follower_id;
    END IF;

  END IF;

  -- FOR EACH ROW trigger: RETURN NULL is correct for AFTER triggers
  RETURN NULL;
END;
$$;

-- 4. Attach trigger to follows table
-- Drop first so re-running the migration is idempotent
DROP TRIGGER IF EXISTS trg_follow_counts ON follows;

CREATE TRIGGER trg_follow_counts
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_follow_counts();
