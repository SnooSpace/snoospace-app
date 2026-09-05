-- ==============================================================================
-- 082_verification_media_purge.sql
-- Add media_purged_at column to user_verifications for retention policy tracking
-- ==============================================================================

ALTER TABLE user_verifications
  ADD COLUMN IF NOT EXISTS media_purged_at TIMESTAMPTZ;
