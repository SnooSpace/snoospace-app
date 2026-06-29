-- Migration 033: Add nickname to members
-- Allows members to set a nickname to be displayed instead of their main name.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS nickname VARCHAR(100) DEFAULT NULL;

-- Index for lookup optimization if needed
CREATE INDEX IF NOT EXISTS idx_members_nickname
  ON members (nickname)
  WHERE nickname IS NOT NULL;
