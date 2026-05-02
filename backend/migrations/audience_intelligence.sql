-- ============================================================
-- Audience Intelligence System — Migration
-- ============================================================

-- 1. Follow source enum type
DO $$ BEGIN
  CREATE TYPE follow_source_type AS ENUM (
    'content_post',
    'content_video',
    'event_recap',
    'event_attendance',
    'search_discovery',
    'profile_visit',
    'social_referral',
    'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. follow_events — logs every follow action with context
CREATE TABLE IF NOT EXISTS follow_events (
  id BIGSERIAL PRIMARY KEY,
  follower_id BIGINT NOT NULL,
  creator_id BIGINT NOT NULL,
  followed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  follow_source follow_source_type NOT NULL DEFAULT 'unknown',
  source_content_id BIGINT,                    -- specific post/video that led to follow
  source_event_id BIGINT,                      -- event that led to follow
  content_consumed_duration_seconds INTEGER,    -- engagement time before following
  is_content_follow BOOLEAN GENERATED ALWAYS AS (
    follow_source IN ('content_post', 'content_video', 'event_recap', 'event_attendance')
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_events_follower ON follow_events(follower_id);
CREATE INDEX IF NOT EXISTS idx_follow_events_creator ON follow_events(creator_id);
CREATE INDEX IF NOT EXISTS idx_follow_events_followed_at ON follow_events(followed_at DESC);
CREATE INDEX IF NOT EXISTS idx_follow_events_source ON follow_events(follow_source);
CREATE INDEX IF NOT EXISTS idx_follow_events_content_follow ON follow_events(is_content_follow) WHERE is_content_follow = true;

-- 3. user_aqi_signals — raw behavioral signals per user, updated over time
CREATE TABLE IF NOT EXISTS user_aqi_signals (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  paid_events_attended INTEGER NOT NULL DEFAULT 0,
  avg_ticket_price_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  free_events_attended INTEGER NOT NULL DEFAULT 0,
  events_hosted INTEGER NOT NULL DEFAULT 0,
  rsvp_to_attend_ratio NUMERIC(5,4) NOT NULL DEFAULT 0,
  multi_city_events INTEGER NOT NULL DEFAULT 0,
  content_depth_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  search_sophistication_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  network_quality_avg NUMERIC(5,2) NOT NULL DEFAULT 0,
  engagement_hour_pattern JSONB DEFAULT '{}',          -- histogram of activity by hour 0–23
  professional_hours_ratio NUMERIC(5,4) NOT NULL DEFAULT 0,  -- % engagement during 8am–7pm weekdays
  premium_categories_ratio NUMERIC(5,4) NOT NULL DEFAULT 0,  -- % events in wellness/tech/business/luxury
  aqi_score NUMERIC(5,2),                              -- computed, 0–100
  aqi_tier INTEGER,                                    -- 1, 2, 3, or 4
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_aqi_signals_user ON user_aqi_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_aqi_signals_tier ON user_aqi_signals(aqi_tier);
CREATE INDEX IF NOT EXISTS idx_user_aqi_signals_score ON user_aqi_signals(aqi_score DESC);

-- 4. creator_audience_stats — aggregated audience quality per creator, recalculated daily
CREATE TABLE IF NOT EXISTS creator_audience_stats (
  id BIGSERIAL PRIMARY KEY,
  creator_id BIGINT NOT NULL UNIQUE,
  total_followers INTEGER NOT NULL DEFAULT 0,
  content_follows INTEGER NOT NULL DEFAULT 0,
  social_follows INTEGER NOT NULL DEFAULT 0,
  discovery_follows INTEGER NOT NULL DEFAULT 0,
  follow_quality_score NUMERIC(5,2) NOT NULL DEFAULT 0,  -- % of followers that are content follows
  tier1_followers INTEGER NOT NULL DEFAULT 0,
  tier2_followers INTEGER NOT NULL DEFAULT 0,
  tier3_followers INTEGER NOT NULL DEFAULT 0,
  tier4_followers INTEGER NOT NULL DEFAULT 0,
  tier1_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  tier2_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  audience_buying_power_score NUMERIC(5,2) NOT NULL DEFAULT 0,  -- 0–100
  top_spending_categories JSONB DEFAULT '[]',  -- array of category strings
  geographic_breakdown JSONB DEFAULT '{}',     -- city → {count, avg_aqi}
  engagement_authenticity_score NUMERIC(5,2) NOT NULL DEFAULT 0,  -- 0–100
  weekly_follow_quality_trend JSONB DEFAULT '[]',  -- last 8 weeks of follow_quality_score
  calculated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_creator_audience_stats_creator ON creator_audience_stats(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_audience_stats_buying_power ON creator_audience_stats(audience_buying_power_score DESC);

-- 5. brand_creator_matches — cached match scores per brand campaign
CREATE TABLE IF NOT EXISTS brand_creator_matches (
  id BIGSERIAL PRIMARY KEY,
  brand_id BIGINT NOT NULL,        -- sponsor id
  creator_id BIGINT NOT NULL,      -- community id
  campaign_id BIGINT,              -- nullable campaign reference
  audience_aqi_density_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  category_alignment_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  geographic_fit_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  past_performance_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_match_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  authentic_influence_radius INTEGER NOT NULL DEFAULT 0,  -- Tier 1+2 followers count
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_creator_matches_brand ON brand_creator_matches(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_creator_matches_creator ON brand_creator_matches(creator_id);
CREATE INDEX IF NOT EXISTS idx_brand_creator_matches_campaign ON brand_creator_matches(campaign_id);
CREATE INDEX IF NOT EXISTS idx_brand_creator_matches_score ON brand_creator_matches(total_match_score DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_creator_matches_unique 
  ON brand_creator_matches(brand_id, creator_id, campaign_id);
