-- ============================================================
-- Qualified View System Migration
-- 
-- Creates tables for tracking qualified unique views (public)
-- and repeat/engaged views (private analytics).
-- 
-- Server-side deduplication via UNIQUE constraint on (post_id, user_id, user_type)
-- ensures ONE public view per user per post, lifetime.
-- ============================================================

-- Unique view events (source of truth for public view counts)
CREATE TABLE IF NOT EXISTS unique_view_events (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  user_type VARCHAR(20) NOT NULL, -- 'member', 'community', 'sponsor', 'venue'
  dwell_time_ms INTEGER,
  trigger_type VARCHAR(30), -- 'dwell', 'playback', 'unmute', 'fullscreen'
  post_type VARCHAR(20), -- 'text', 'image', 'video'
  qualified_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- THE CONSTRAINT: One user, one view, forever
  UNIQUE(post_id, user_id, user_type)
);

-- Indexes for unique_view_events
CREATE INDEX IF NOT EXISTS idx_unique_views_post_id ON unique_view_events(post_id);
CREATE INDEX IF NOT EXISTS idx_unique_views_user ON unique_view_events(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_unique_views_qualified_at ON unique_view_events(qualified_at);

-- Repeat/Engaged view events (private analytics only)
CREATE TABLE IF NOT EXISTS repeat_view_events (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  user_type VARCHAR(20) NOT NULL,
  engagement_type VARCHAR(50), -- 'revisit', 'replay', 'loop', 'expand', 'zoom', 'unmute', 'fullscreen', 'completion_50', 'unmuted_25'
  dwell_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
  -- NO unique constraint: many per user is expected
);

-- Indexes for repeat_view_events
CREATE INDEX IF NOT EXISTS idx_repeat_views_post_id ON repeat_view_events(post_id);
CREATE INDEX IF NOT EXISTS idx_repeat_views_user ON repeat_view_events(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_repeat_views_created_at ON repeat_view_events(created_at);
CREATE INDEX IF NOT EXISTS idx_repeat_views_engagement_type ON repeat_view_events(engagement_type);

-- Add public_view_count column to posts table (denormalized for performance)
DO $$ BEGIN
  ALTER TABLE posts ADD COLUMN IF NOT EXISTS public_view_count INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Create index on public_view_count for sorting (if ever needed)
CREATE INDEX IF NOT EXISTS idx_posts_public_view_count ON posts(public_view_count);

