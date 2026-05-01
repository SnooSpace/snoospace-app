-- ============================================================
-- Migration 008: Generic Group Owner Tracking
-- SnooSpace — decouples group ownership from community accounts
-- so that any participant (member or community) can hold the
-- Crown/Owner badge after a handoff.
-- Run once against your Supabase/PostgreSQL database.
-- ============================================================

-- ---- 1. Add group_owner_id + group_owner_type columns ----
-- These are type-agnostic: they can point to a member OR community.
-- community_owner_id is kept for backward-compat (auto-join gate logic).
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS group_owner_id   BIGINT,
  ADD COLUMN IF NOT EXISTS group_owner_type VARCHAR(20);

-- ---- 2. Backfill from community_owner_id (no-op after first run) ----
-- For every existing group that has a community_owner_id, seed the new fields.
UPDATE conversations
SET
  group_owner_id   = community_owner_id,
  group_owner_type = 'community'
WHERE
  is_group         = TRUE
  AND community_owner_id IS NOT NULL
  AND group_owner_id IS NULL;

-- ---- 3. Index for quick lookup ----
CREATE INDEX IF NOT EXISTS idx_conversations_group_owner
  ON conversations(group_owner_id, group_owner_type)
  WHERE group_owner_id IS NOT NULL;
