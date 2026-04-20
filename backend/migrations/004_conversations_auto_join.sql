-- ============================================================
-- Migration 004: Add community_auto_join to conversations
-- SnooSpace — Group chat auto-join flag per conversation
-- Safe to run multiple times (IF NOT EXISTS / IF NOT EXISTS)
-- ============================================================

-- Add the column that createGroupConversation and getGroupJoinInviteByCommunity reference
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS community_auto_join BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_conversations_auto_join
  ON conversations (community_auto_join)
  WHERE community_auto_join = true;

-- Fix: conversation_reports schema mismatch
-- The controller inserts (conversation_id, reporter_id, reporter_type, reason, details)
-- but 002 created the table with extra NOT NULL columns (reported_user_id, reported_user_type)
-- that the controller doesn't supply. Make those columns optional.
ALTER TABLE conversation_reports
  ALTER COLUMN reported_user_id   DROP NOT NULL,
  ALTER COLUMN reported_user_type DROP NOT NULL;

-- Also align the reason CHECK constraint with what the controller actually uses
-- (the controller passes freeform strings; relax to TEXT only)
-- We drop and re-add without a constraint so any reason string is accepted.
ALTER TABLE conversation_reports
  DROP CONSTRAINT IF EXISTS conversation_reports_reason_check;

-- Align status/description column names (controller uses "details" not "description")
ALTER TABLE conversation_reports
  ADD COLUMN IF NOT EXISTS details TEXT;

-- Fix: participant1_id / participant2_id must be nullable for GROUP conversations
-- (DM rows populate these; group rows leave them NULL and use conversation_participants instead)
ALTER TABLE conversations
  ALTER COLUMN participant1_id   DROP NOT NULL,
  ALTER COLUMN participant1_type DROP NOT NULL,
  ALTER COLUMN participant2_id   DROP NOT NULL,
  ALTER COLUMN participant2_type DROP NOT NULL;
