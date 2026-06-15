-- Migration 021: Instagram username linking
-- Allows members to optionally link their Instagram username as a social trust signal.
-- Only the clean username is stored, never a full URL or access token.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS instagram_username TEXT DEFAULT NULL;

-- Lightweight index for any future analytics / lookup
CREATE INDEX IF NOT EXISTS idx_members_instagram_username
  ON members (instagram_username)
  WHERE instagram_username IS NOT NULL;
