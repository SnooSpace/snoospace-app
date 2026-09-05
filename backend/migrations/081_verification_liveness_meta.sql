-- ==============================================================================
-- 081_verification_liveness_meta.sql
-- Add liveness_action and liveness_code columns to user_verifications
-- ==============================================================================

ALTER TABLE user_verifications
  ADD COLUMN IF NOT EXISTS liveness_action TEXT;

ALTER TABLE user_verifications
  ADD COLUMN IF NOT EXISTS liveness_code TEXT;
