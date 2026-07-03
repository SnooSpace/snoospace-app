-- Migration 042: Instagram username linking for Communities
-- Allows communities to optionally link their Instagram username.

ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS instagram_username TEXT DEFAULT NULL;

-- Lightweight index for any future analytics / lookup
CREATE INDEX IF NOT EXISTS idx_communities_instagram_username
  ON communities (instagram_username)
  WHERE instagram_username IS NOT NULL;
