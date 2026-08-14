-- Migration 063: Opportunity Re-Ranking Extension
-- Adds rank_penalty_tier and rank_penalty_until to opportunity_impression_state
-- mirroring post_impression_state from Re-ranking Step 1.

ALTER TABLE opportunity_impression_state
  ADD COLUMN IF NOT EXISTS rank_penalty_tier VARCHAR(10) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rank_penalty_until TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_opportunity_impression_rank
  ON opportunity_impression_state(user_id, user_type, opportunity_id)
  WHERE rank_penalty_tier IS NOT NULL;
