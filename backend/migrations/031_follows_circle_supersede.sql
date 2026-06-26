-- ============================================================
-- Migration 031: Separate follows circle-superseded state
-- ============================================================

-- 1. Add column to follows
ALTER TABLE follows
  ADD COLUMN IF NOT EXISTS is_superseded_by_circle BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill is_superseded_by_circle to true for any community circle member follows
UPDATE follows f
SET is_superseded_by_circle = true
FROM community_member_circles cc
WHERE
  (f.follower_id = cc.community_id AND f.follower_type = 'community' AND f.following_id = cc.member_id AND f.following_type = 'member')
  OR
  (f.follower_id = cc.member_id AND f.follower_type = 'member' AND f.following_id = cc.community_id AND f.following_type = 'community');

-- 3. Modify trigger function fn_update_follow_counts to handle UPDATE and only count non-superseded follows
CREATE OR REPLACE FUNCTION fn_update_follow_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  was_active BOOLEAN;
  is_active  BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_superseded_by_circle = false THEN
      -- Increment follower_count on the entity being followed
      IF NEW.following_type = 'member' THEN
        UPDATE members SET follower_count = follower_count + 1 WHERE id = NEW.following_id;
      ELSIF NEW.following_type = 'community' THEN
        UPDATE communities SET follower_count = follower_count + 1 WHERE id = NEW.following_id;
      END IF;

      -- Increment following_count on the entity doing the following
      IF NEW.follower_type = 'member' THEN
        UPDATE members SET following_count = following_count + 1 WHERE id = NEW.follower_id;
      ELSIF NEW.follower_type = 'community' THEN
        UPDATE communities SET following_count = following_count + 1 WHERE id = NEW.follower_id;
      END IF;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.is_superseded_by_circle = false THEN
      -- Decrement follower_count on the entity that was being followed
      IF OLD.following_type = 'member' THEN
        UPDATE members SET follower_count = GREATEST(0, follower_count - 1) WHERE id = OLD.following_id;
      ELSIF OLD.following_type = 'community' THEN
        UPDATE communities SET follower_count = GREATEST(0, follower_count - 1) WHERE id = OLD.following_id;
      END IF;

      -- Decrement following_count on the entity that was following
      IF OLD.follower_type = 'member' THEN
        UPDATE members SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
      ELSIF OLD.follower_type = 'community' THEN
        UPDATE communities SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
      END IF;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    was_active := (OLD.is_superseded_by_circle = false);
    is_active  := (NEW.is_superseded_by_circle = false);

    IF was_active AND NOT is_active THEN
      -- Deactivated (superseded) -> decrement
      IF NEW.following_type = 'member' THEN
        UPDATE members SET follower_count = GREATEST(0, follower_count - 1) WHERE id = NEW.following_id;
      ELSIF NEW.following_type = 'community' THEN
        UPDATE communities SET follower_count = GREATEST(0, follower_count - 1) WHERE id = NEW.following_id;
      END IF;

      IF NEW.follower_type = 'member' THEN
        UPDATE members SET following_count = GREATEST(0, following_count - 1) WHERE id = NEW.follower_id;
      ELSIF NEW.follower_type = 'community' THEN
        UPDATE communities SET following_count = GREATEST(0, following_count - 1) WHERE id = NEW.follower_id;
      END IF;

    ELSIF NOT was_active AND is_active THEN
      -- Reactivated (un-superseded) -> increment
      IF NEW.following_type = 'member' THEN
        UPDATE members SET follower_count = follower_count + 1 WHERE id = NEW.following_id;
      ELSIF NEW.following_type = 'community' THEN
        UPDATE communities SET follower_count = follower_count + 1 WHERE id = NEW.following_id;
      END IF;

      IF NEW.follower_type = 'member' THEN
        UPDATE members SET following_count = following_count + 1 WHERE id = NEW.follower_id;
      ELSIF NEW.follower_type = 'community' THEN
        UPDATE communities SET following_count = following_count + 1 WHERE id = NEW.follower_id;
      END IF;
    END IF;

  END IF;

  RETURN NULL;
END;
$$;

-- 4. Recreate trigger trg_follow_counts
DROP TRIGGER IF EXISTS trg_follow_counts ON follows;
CREATE TRIGGER trg_follow_counts
  AFTER INSERT OR UPDATE OR DELETE ON follows
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_follow_counts();

-- 5. Recalculate denormalized counts
UPDATE members m
SET
  follower_count  = (SELECT COUNT(*) FROM follows WHERE following_id = m.id AND following_type = 'member' AND is_superseded_by_circle = false),
  following_count = (SELECT COUNT(*) FROM follows WHERE follower_id  = m.id AND follower_type  = 'member' AND is_superseded_by_circle = false);

UPDATE communities c
SET
  follower_count  = (SELECT COUNT(*) FROM follows WHERE following_id = c.id AND following_type = 'community' AND is_superseded_by_circle = false),
  following_count = (SELECT COUNT(*) FROM follows WHERE follower_id  = c.id AND follower_type  = 'community' AND is_superseded_by_circle = false);
