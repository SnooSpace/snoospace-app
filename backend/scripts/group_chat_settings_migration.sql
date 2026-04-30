-- Migration: add community_owner_id and community_auto_join to conversations
-- Run: node scripts/run_group_chat_settings_migration.js

-- Add community_owner_id to track which community owns each group conversation
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS community_owner_id INTEGER REFERENCES communities(id) ON DELETE SET NULL;

-- Add community_auto_join if it doesn't exist yet (may already be there from earlier work)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS community_auto_join BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill community_owner_id from existing conversation_participants:
-- For each group conversation that has a community participant with role='admin',
-- set that community as the owner.
UPDATE conversations c
SET community_owner_id = cp.participant_id
FROM conversation_participants cp
WHERE cp.conversation_id = c.id
  AND cp.participant_type = 'community'
  AND cp.role = 'admin'
  AND c.is_group = TRUE
  AND c.community_owner_id IS NULL;

-- Create an index for efficient lookup by community owner
CREATE INDEX IF NOT EXISTS idx_conversations_community_owner_id
  ON conversations(community_owner_id)
  WHERE community_owner_id IS NOT NULL;
