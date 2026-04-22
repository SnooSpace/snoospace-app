-- ============================================================
-- Migration 006: Chat UX Improvements
-- SnooSpace — Timestamp-based hide logic + Mute system
-- Run once against your Supabase/PostgreSQL database
-- ============================================================

-- ---- 1. Ensure conversation_hidden has a hidden_at timestamp ----
-- (Column likely exists already via the DEFAULT NOW() in 002; this is safe to re-run)
ALTER TABLE conversation_hidden
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ---- 2. conversation_muted table ----
-- Tracks per-user mute preferences for conversations.
-- muted_until = NULL means muted indefinitely.
CREATE TABLE IF NOT EXISTS conversation_muted (
  id               BIGSERIAL    PRIMARY KEY,
  conversation_id  BIGINT       NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  muted_by_id      BIGINT       NOT NULL,
  muted_by_type    TEXT         NOT NULL CHECK (muted_by_type IN ('member', 'community')),
  muted_until      TIMESTAMPTZ,           -- NULL = forever
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- One mute record per user per conversation
CREATE UNIQUE INDEX IF NOT EXISTS idx_conv_muted_unique
  ON conversation_muted(conversation_id, muted_by_id, muted_by_type);

CREATE INDEX IF NOT EXISTS idx_conv_muted_lookup
  ON conversation_muted(muted_by_id, muted_by_type);

-- ---- Verify ----
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'conversation_hidden' AND column_name = 'hidden_at';
--
-- SELECT table_name FROM information_schema.tables
--   WHERE table_name = 'conversation_muted';
