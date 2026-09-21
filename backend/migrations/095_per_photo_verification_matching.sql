-- ==============================================================================
-- 095_per_photo_verification_matching.sql
-- Per-photo verification matching columns for Discover verification
-- ==============================================================================

-- 1. Add matched_photo_urls (array of reference photos individually confirmed as match)
ALTER TABLE user_verifications
  ADD COLUMN IF NOT EXISTS matched_photo_urls TEXT[];

-- 2. Add match_diagnostics (per-reference-photo breakdown: [{ photo_url, distance, status }])
ALTER TABLE user_verifications
  ADD COLUMN IF NOT EXISTS match_diagnostics JSONB;

-- 3. Add rejection_type to distinguish mild photo hygiene from full identity mismatch
ALTER TABLE user_verifications
  ADD COLUMN IF NOT EXISTS rejection_type TEXT
  CHECK (rejection_type IN ('identity_mismatch', 'photo_hygiene'));
