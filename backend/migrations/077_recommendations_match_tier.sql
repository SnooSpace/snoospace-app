-- ==============================================================================
-- 077_recommendations_match_tier.sql
-- Add match_tier and distance_km to recommended_matches table
-- ==============================================================================

-- 1. Add columns to persist match tier and geographic distance
ALTER TABLE recommended_matches
  ADD COLUMN IF NOT EXISTS match_tier INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS distance_km DOUBLE PRECISION;

-- 2. Index for tiered ranking on cache fallback / pagination
-- Uses standard IF NOT EXISTS to guarantee compatibility with transactional migration runners.
CREATE INDEX IF NOT EXISTS idx_recommended_matches_user_tier
  ON recommended_matches (user_id, match_tier ASC, total_score DESC);
