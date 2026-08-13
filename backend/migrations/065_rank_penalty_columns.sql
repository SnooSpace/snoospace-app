-- Phase Re-ranking Step 1: Add rank_penalty_tier and rank_penalty_until columns to post_impression_state
-- rank_penalty_tier: 'light' (strike-1 / comment) or 'heavy' (like on timed content), NULL = no penalty
-- rank_penalty_until: penalty expiry timestamp; getFeed (Step 2) will use this for ranking weight

ALTER TABLE post_impression_state
  ADD COLUMN IF NOT EXISTS rank_penalty_tier VARCHAR(10) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rank_penalty_until TIMESTAMPTZ DEFAULT NULL;

-- Index to support future Step 2 LEFT JOIN (non-blocking, creates concurrently)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pis_rank_penalty
  ON post_impression_state (user_id, user_type, post_id)
  WHERE rank_penalty_tier IS NOT NULL;
