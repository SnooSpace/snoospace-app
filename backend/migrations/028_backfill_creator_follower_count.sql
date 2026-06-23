-- ============================================================
-- Migration 028: Backfill creator_follower_count
-- One-time fix: syncs the denormalized creator_follower_count
-- column with the actual live count from creator_follows.
-- Required because any follows inserted before migration 027
-- added the trigger will not have triggered the increment.
-- ============================================================

UPDATE members m
SET creator_follower_count = (
  SELECT COUNT(*)
  FROM creator_follows cf
  WHERE cf.creator_id = m.id
    AND cf.is_dormant = false
)
WHERE m.is_creator_mode_enabled = true;
