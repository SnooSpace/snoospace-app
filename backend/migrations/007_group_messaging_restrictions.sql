-- ============================================================
-- Migration 007: Group Messaging Restrictions
-- SnooSpace — WhatsApp-style admin-only announcement mode
-- Run once against your Supabase/PostgreSQL database
-- ============================================================

-- ---- 1. Add messaging_restricted flag to conversations ----
-- When true, only participants with role='admin' can send messages.
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS messaging_restricted BOOLEAN NOT NULL DEFAULT false;

-- Optional: partial index for quick lookup of restricted groups
CREATE INDEX IF NOT EXISTS idx_conversations_restricted
  ON conversations(id) WHERE messaging_restricted = true;

-- ---- Verify ----
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'conversations' AND column_name = 'messaging_restricted';
