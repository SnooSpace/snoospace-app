-- ============================================================
-- VIDEO INSIGHTS MIGRATION
-- Run in order in the Supabase SQL editor
-- ============================================================

-- 1. video_watch_events
-- Tracks every meaningful playback event per viewer per session.
-- Powers: retention curve, hook rate, avg watch duration, re-watch rate.
CREATE TABLE IF NOT EXISTS video_watch_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  viewer_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('play', 'pause', 'seek', 'replay', 'exit', 'complete')),
  timestamp_seconds FLOAT NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'for_you' CHECK (
    source IN ('for_you', 'community', 'profile', 'direct_share', 'hashtag', 'search')
  ),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watch_events_video ON video_watch_events(video_id);
CREATE INDEX IF NOT EXISTS idx_watch_events_viewer ON video_watch_events(viewer_id);
CREATE INDEX IF NOT EXISTS idx_watch_events_session ON video_watch_events(session_id);
CREATE INDEX IF NOT EXISTS idx_watch_events_video_created ON video_watch_events(video_id, created_at);


-- 2. video_follow_conversions
-- Records when a viewer follows a creator within 30 min of watching their video.
CREATE TABLE IF NOT EXISTS video_follow_conversions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  viewer_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  creator_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  followed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(video_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_follow_conv_video ON video_follow_conversions(video_id);
CREATE INDEX IF NOT EXISTS idx_follow_conv_creator ON video_follow_conversions(creator_id);


-- 3. video_insights_cache
-- Aggregated insights per video, rebuilt every 15 minutes by the GET endpoint.
CREATE TABLE IF NOT EXISTS video_insights_cache (
  video_id INTEGER PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  total_views INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  total_watch_seconds FLOAT DEFAULT 0,
  avg_watch_seconds FLOAT DEFAULT 0,
  completion_rate FLOAT DEFAULT 0,
  hook_rate FLOAT DEFAULT 0,
  rewatch_rate FLOAT DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  saves_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  dm_sends_count INTEGER DEFAULT 0,
  new_followers INTEGER DEFAULT 0,
  follow_conversion_rate FLOAT DEFAULT 0,
  ror_score FLOAT DEFAULT 0,
  aqi_score FLOAT DEFAULT 0,
  high_intent_pct FLOAT DEFAULT 0,
  ghost_viewer_pct FLOAT DEFAULT 0,
  reach_total INTEGER DEFAULT 0,
  reach_non_followers_pct FLOAT DEFAULT 0,
  community_boost_views INTEGER DEFAULT 0,
  peak_hour INTEGER DEFAULT 20,
  midpoint_drop_pct FLOAT DEFAULT 0,
  major_drop_at_seconds FLOAT DEFAULT 0,
  rewatched_moment_seconds FLOAT DEFAULT 0,
  traffic_sources JSONB DEFAULT '{}',
  age_breakdown JSONB DEFAULT '{}',
  top_locations JSONB DEFAULT '[]',
  intent_classification JSONB DEFAULT '{}',
  hourly_views JSONB DEFAULT '[]',
  retention_curve JSONB DEFAULT '[]',
  best_time_to_post TEXT DEFAULT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- 4. Add duration_seconds to posts (if not already present)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS duration_seconds FLOAT DEFAULT 0;

-- 5. Add view_source to unique_view_events for traffic source tracking
ALTER TABLE unique_view_events ADD COLUMN IF NOT EXISTS view_source VARCHAR(50) DEFAULT NULL;
