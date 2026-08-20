-- ============================================================
-- Migration 067: Migrate member→creator follows from follows table
--                into creator_follows
--
-- Context
-- -------
-- A bug in the AsyncStorage creator-mode key caused creator mode
-- to be accidentally enabled for certain member accounts (e.g. Veena).
-- When another member (e.g. Harsh) later followed them, the follow
-- was recorded in the general `follows` table (follower_type='member',
-- following_type='member') rather than the `creator_follows` table.
-- This produced a mismatch:
--   • Profile stat "Followers" = 1  (comes from members.follower_count)
--   • CreatorFollowersScreen list  = 0  (reads creator_follows only)
--
-- Fix
-- ---
-- For every creator-mode member who has member→member rows in the
-- `follows` table, this migration:
--   1. Upserts those rows into creator_follows (is_dormant = false).
--      The existing trigger (trg_creator_follower_count) will fire and
--      increment creator_follower_count automatically on INSERT, or
--      un-dormant on UPDATE — preserving idempotency.
--   2. Deletes the orphan rows from `follows`.
--   3. Decrements follower_count on the creator member row to match
--      (since follower_count is maintained by the follows table trigger).
--
-- Safety
-- ------
-- • Wrapped in a transaction — fully rolls back on error.
-- • Only targets rows where following_id belongs to a creator-mode member.
-- • ON CONFLICT clause handles the case where a creator_follows row
--   already exists (dormant or otherwise) — it simply un-dormants it
--   without double-counting (trigger only increments on true transitions).
-- ============================================================

BEGIN;

-- ── Step 1: Identify orphaned follows ─────────────────────────────────────────
-- These are member→member rows in `follows` where the target is a creator-mode
-- member.  They should live in creator_follows instead.

CREATE TEMP TABLE _orphan_follows AS
SELECT
  f.follower_id,
  f.following_id   AS creator_id,
  f.created_at
FROM follows f
JOIN members m ON m.id = f.following_id
WHERE f.follower_type   = 'member'
  AND f.following_type  = 'member'
  AND m.is_creator_mode_enabled = true
  AND f.follower_id != f.following_id  -- guard against self-follows
;

-- ── Step 2: Upsert into creator_follows ───────────────────────────────────────
-- INSERT new rows; for existing rows simply un-dormant them.
-- The trigger fires AFTER INSERT/UPDATE and adjusts creator_follower_count.

INSERT INTO creator_follows (follower_id, follower_type, creator_id, is_dormant, created_at)
SELECT
  follower_id,
  'member',        -- follower_type is always 'member' here
  creator_id,
  false,           -- immediately active
  created_at
FROM _orphan_follows
ON CONFLICT (follower_id, creator_id)
DO UPDATE SET
  is_dormant = false,
  created_at = EXCLUDED.created_at   -- keep original follow timestamp
;

-- ── Step 3: Delete orphaned rows from follows ──────────────────────────────────
DELETE FROM follows f
USING _orphan_follows o
WHERE f.follower_id    = o.follower_id
  AND f.following_id   = o.creator_id
  AND f.follower_type  = 'member'
  AND f.following_type = 'member'
;

-- ── Step 4: Adjust follower_count on affected creators ────────────────────────
-- follower_count is maintained by the `follows` table trigger (not creator_follows).
-- We removed rows from `follows`, so we must manually decrement the count
-- for each creator by the number of rows removed.

UPDATE members m
SET follower_count = GREATEST(0, m.follower_count - sub.removed)
FROM (
  SELECT creator_id, COUNT(*) AS removed
  FROM _orphan_follows
  GROUP BY creator_id
) sub
WHERE m.id = sub.creator_id
;

-- ── Step 5: Cleanup temp table and summarise ──────────────────────────────────
DO $$
DECLARE
  row_count INT;
BEGIN
  SELECT COUNT(*) INTO row_count FROM _orphan_follows;
  RAISE NOTICE 'Migration 067: migrated % orphaned member→member follows into creator_follows.', row_count;
END;
$$;

DROP TABLE _orphan_follows;

COMMIT;
