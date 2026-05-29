-- ============================================================
-- Session Tracking — Migration
-- Prompt 1: Session Depth & Return Frequency Tracking
--
-- NOTE: user_sessions already exists as a device/auth session table.
-- This migration uses aqi_sessions + aqi_session_stats to avoid collision.
-- ============================================================

-- Raw AQI session records — every app foreground session as one row
CREATE TABLE IF NOT EXISTS aqi_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_end TIMESTAMPTZ,
  -- null if session is still active or ended unexpectedly
  duration_seconds INT,
  -- calculated on session end: session_end - session_start
  screens_visited INT DEFAULT 0,
  -- count of distinct navigation events during session
  screen_sequence JSONB,
  -- ordered array of screen names visited: ["Home", "EventDetail", "Profile"]
  -- capped at 50 entries to prevent unbounded growth
  deepest_screen_depth INT DEFAULT 1,
  -- maximum navigation stack depth reached during session
  -- depth 1 = tab screens, depth 2 = pushed screens, depth 3+ = nested
  session_quality VARCHAR(20),
  -- 'deep'    → 8+ screens or 5+ minutes
  -- 'engaged' → 4-7 screens or 2-5 minutes
  -- 'shallow' → 1-3 screens or under 2 minutes
  -- 'bounce'  → 1 screen, under 30 seconds
  hour_of_day INT,
  -- 0-23, extracted from session_start for fast aggregation
  day_of_week INT,
  -- 0=Sunday, 6=Saturday
  is_professional_hours BOOLEAN,
  -- true if Mon-Fri 9am-6pm IST
  device_was_active BOOLEAN DEFAULT true,
  -- false if session was background/passive (future use)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aqi_sessions_user ON aqi_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_aqi_sessions_start ON aqi_sessions(session_start DESC);
CREATE INDEX IF NOT EXISTS idx_aqi_sessions_user_start ON aqi_sessions(user_id, session_start DESC);
CREATE INDEX IF NOT EXISTS idx_aqi_sessions_quality ON aqi_sessions(session_quality);

-- Weekly aggregated session stats per user
-- Recalculated every Sunday by the learning job
-- Used directly in AQI calculation — avoids querying raw aqi_sessions table
CREATE TABLE IF NOT EXISTS aqi_session_stats (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE UNIQUE,

  -- Return frequency signals
  active_days_last_7 INT DEFAULT 0,
  active_days_last_30 INT DEFAULT 0,
  active_weeks_last_8 INT DEFAULT 0,
  avg_sessions_per_active_day NUMERIC DEFAULT 0,
  longest_streak_days INT DEFAULT 0,

  -- Session depth signals
  avg_screens_per_session NUMERIC DEFAULT 0,
  avg_session_duration_seconds NUMERIC DEFAULT 0,
  deep_session_ratio NUMERIC DEFAULT 0,
  -- % of sessions classified as 'deep' or 'engaged'
  bounce_rate NUMERIC DEFAULT 0,

  -- Timing pattern signals
  professional_hours_session_ratio NUMERIC DEFAULT 0,
  most_active_hour INT,
  weekend_vs_weekday_ratio NUMERIC DEFAULT 0,

  -- Recency
  last_session_at TIMESTAMPTZ,
  days_since_last_session INT,
  total_sessions INT DEFAULT 0,

  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aqi_session_stats_user ON aqi_session_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_aqi_session_stats_active_days ON aqi_session_stats(active_days_last_7 DESC);

-- Add session-derived columns to user_aqi_signals
ALTER TABLE user_aqi_signals
  ADD COLUMN IF NOT EXISTS return_frequency_score NUMERIC DEFAULT 0;
ALTER TABLE user_aqi_signals
  ADD COLUMN IF NOT EXISTS session_depth_score NUMERIC DEFAULT 0;
