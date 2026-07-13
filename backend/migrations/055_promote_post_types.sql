-- Migration 055: Promote Post Types
-- Adds support for event_promo and plan_promo post types.
-- source_id references the promoted event or plan.
-- promote_quotas tracks weekly usage.

-- 1. Add promote-related columns to posts table
ALTER TABLE posts 
  ADD COLUMN IF NOT EXISTS source_id INTEGER,
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(20),      -- 'event' | 'plan'
  ADD COLUMN IF NOT EXISTS promo_text TEXT,              -- optional promotional caption
  ADD COLUMN IF NOT EXISTS engagement_type VARCHAR(20);  -- 'poll' | 'qna' | 'prompt' | 'opportunity'

-- 2. Create promote quotas tracking table
CREATE TABLE IF NOT EXISTS promote_quotas (
  id              SERIAL PRIMARY KEY,
  owner_id        INTEGER NOT NULL,         -- community_id or member_id
  owner_type      VARCHAR(20) NOT NULL,     -- 'community' | 'member'
  source_type     VARCHAR(20) NOT NULL,     -- 'event' | 'plan'
  week_start      DATE NOT NULL,            -- Monday of the current week (UTC)
  promotes_used   INTEGER DEFAULT 0 NOT NULL,
  max_promotes    INTEGER DEFAULT 5 NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, owner_type, source_type, week_start)
);

-- 3. Enable RLS on promote_quotas (consistent with rest of app)
ALTER TABLE promote_quotas ENABLE ROW LEVEL SECURITY;

-- 4. Grant service_role access
GRANT ALL ON promote_quotas TO service_role;
GRANT USAGE, SELECT ON SEQUENCE promote_quotas_id_seq TO service_role;

-- 5. Index for efficient quota lookups
CREATE INDEX IF NOT EXISTS idx_promote_quotas_lookup 
  ON promote_quotas(owner_id, owner_type, source_type, week_start);

-- 6. Index for fast filtering of promo posts in feed
CREATE INDEX IF NOT EXISTS idx_posts_source_type 
  ON posts(source_type) WHERE source_type IS NOT NULL;
