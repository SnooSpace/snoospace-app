-- Migration: Add auto_join_group_chat column to communities table
-- This stores the community-level preference for auto-inviting followers to group chats.
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS auto_join_group_chat BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for efficient lookup when processing community-based invite checks
CREATE INDEX IF NOT EXISTS idx_communities_auto_join
  ON communities (auto_join_group_chat)
  WHERE auto_join_group_chat = TRUE;
