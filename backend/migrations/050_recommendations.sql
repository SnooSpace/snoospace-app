-- ============================================================
-- 050_recommendations.sql — "People You Should Meet" System
-- ============================================================
-- Creates tables for batch-computed recommendations and
-- dismissal tracking. Also adds verification_tier to members.
--
-- Safe to re-run: all DDL uses IF NOT EXISTS / DO $$ guards.
-- ============================================================

-- ── 1. recommended_matches ───────────────────────────────────────────────────
-- Stores the daily-computed ranked candidates per user.
-- Upserted by the batch job; served from Redis cache (fallback to this table).
CREATE TABLE IF NOT EXISTS recommended_matches (
  user_id       BIGINT      NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  candidate_id  BIGINT      NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  total_score   FLOAT       NOT NULL DEFAULT 0,
  -- Array of {type: string, label: string}, max 2 entries
  top_reasons   JSONB       NOT NULL DEFAULT '[]',
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, candidate_id)
);

-- Fast reads for the API endpoint (score DESC for top candidates first)
CREATE INDEX IF NOT EXISTS idx_recommended_matches_user_score
  ON recommended_matches (user_id, total_score DESC);

-- ── 2. dismissed_recommendations ─────────────────────────────────────────────
-- Tracks dismissals. Used by the candidate gate to exclude recently dismissed
-- candidates (configurable cooldown, default 14 days).
CREATE TABLE IF NOT EXISTS dismissed_recommendations (
  user_id       BIGINT      NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  candidate_id  BIGINT      NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  dismissed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, candidate_id)
);

-- Used by the gate query: WHERE dismissed_at > NOW() - INTERVAL '14 days'
CREATE INDEX IF NOT EXISTS idx_dismissed_recs_user_ts
  ON dismissed_recommendations (user_id, dismissed_at DESC);

-- ── 3. verification_tier on members ──────────────────────────────────────────
-- Tracks verification level. Default 'none' = 0 boost (no silent advantage
-- before the verification feature is properly rolled out).
DO $$ BEGIN
  ALTER TABLE members
    ADD COLUMN IF NOT EXISTS verification_tier TEXT DEFAULT 'none'
    CHECK (verification_tier IN ('none', 'selfie_verified', 'id_verified'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ── ROLLBACK PLAN ─────────────────────────────────────────────────────────────
-- To revert this migration, run:
--
--   DROP TABLE IF EXISTS dismissed_recommendations;
--   DROP TABLE IF EXISTS recommended_matches;
--   ALTER TABLE members DROP COLUMN IF EXISTS verification_tier;
--
-- ─────────────────────────────────────────────────────────────────────────────
