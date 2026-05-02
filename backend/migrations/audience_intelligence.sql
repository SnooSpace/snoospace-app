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

-- ============================================================
-- V2 — Dynamic Self-Learning Architecture
-- ============================================================

-- 6. user_interest_vectors — per-user, per-category decaying interest scores
CREATE TABLE IF NOT EXISTS user_interest_vectors (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  category VARCHAR(100) NOT NULL,
  raw_score NUMERIC NOT NULL DEFAULT 0,
  decayed_score NUMERIC NOT NULL DEFAULT 0,
  last_signal_at TIMESTAMPTZ,
  signal_count INTEGER NOT NULL DEFAULT 0,
  trend VARCHAR(20) NOT NULL DEFAULT 'stable',
  -- 'rising', 'stable', 'declining', 'emerging', 'dormant'
  trend_delta NUMERIC NOT NULL DEFAULT 0,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_interest_vectors_user ON user_interest_vectors(user_id);
CREATE INDEX IF NOT EXISTS idx_interest_vectors_category ON user_interest_vectors(category);
CREATE INDEX IF NOT EXISTS idx_interest_vectors_decayed ON user_interest_vectors(decayed_score DESC);

-- 7. user_behavior_events — raw event stream, every user action
CREATE TABLE IF NOT EXISTS user_behavior_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  event_type VARCHAR(60) NOT NULL,
  -- 'event_attended', 'event_rsvp', 'content_watched', 'content_shared',
  -- 'search_performed', 'creator_followed', 'event_hosted', 'profile_visited'
  category VARCHAR(100),
  metadata JSONB,
  signal_strength NUMERIC NOT NULL DEFAULT 1.0,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_behavior_events_user ON user_behavior_events(user_id);
CREATE INDEX IF NOT EXISTS idx_behavior_events_occurred ON user_behavior_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_events_user_category ON user_behavior_events(user_id, category);

-- 8. user_drift_signals — detected trajectory changes
CREATE TABLE IF NOT EXISTS user_drift_signals (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  drift_type VARCHAR(60) NOT NULL,
  -- 'category_shift', 'spending_increase', 'spending_decrease',
  -- 'identity_shift_to_creator', 'tier_upgrade', 'tier_downgrade'
  from_state JSONB,
  to_state JSONB,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drift_signals_user ON user_drift_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_drift_signals_detected ON user_drift_signals(detected_at DESC);

-- 9. learned_demographic_scores — self-learned, never written by humans
CREATE TABLE IF NOT EXISTS learned_demographic_scores (
  id BIGSERIAL PRIMARY KEY,
  dimension VARCHAR(40) NOT NULL,
  -- 'occupation_exact', 'occupation_category', 'occupation_super',
  -- 'age_exact', 'age_band', 'age_life_stage'
  dimension_value VARCHAR(100) NOT NULL,
  learned_score NUMERIC NOT NULL,
  sample_size INTEGER NOT NULL DEFAULT 0,
  confidence_level VARCHAR(20) NOT NULL DEFAULT 'insufficient',
  -- 'high', 'medium', 'low', 'insufficient'
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(dimension, dimension_value)
);

CREATE INDEX IF NOT EXISTS idx_learned_scores_dimension ON learned_demographic_scores(dimension, dimension_value);

-- 10. occupation_hierarchy — grouping only, no scores
CREATE TABLE IF NOT EXISTS occupation_hierarchy (
  id BIGSERIAL PRIMARY KEY,
  occupation_exact VARCHAR(100) UNIQUE NOT NULL,
  occupation_category VARCHAR(100),
  occupation_super VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_occupation_hierarchy_exact ON occupation_hierarchy(occupation_exact);

-- 11. age_bands — maps age → band → life stage (grouping only, no scores)
CREATE TABLE IF NOT EXISTS age_bands (
  id BIGSERIAL PRIMARY KEY,
  age_exact INTEGER UNIQUE NOT NULL,
  age_band VARCHAR(20) NOT NULL,
  life_stage VARCHAR(40) NOT NULL
);

-- Pre-populate age_bands for ages 13–80
INSERT INTO age_bands (age_exact, age_band, life_stage)
SELECT age,
  CASE
    WHEN age BETWEEN 13 AND 17 THEN '13-17'
    WHEN age BETWEEN 18 AND 21 THEN '18-21'
    WHEN age BETWEEN 22 AND 26 THEN '22-26'
    WHEN age BETWEEN 27 AND 34 THEN '27-34'
    WHEN age BETWEEN 35 AND 45 THEN '35-45'
    WHEN age BETWEEN 46 AND 60 THEN '46-60'
    ELSE '60+'
  END,
  CASE
    WHEN age BETWEEN 13 AND 17 THEN 'Teenager'
    WHEN age BETWEEN 18 AND 21 THEN 'Early Adult / Student'
    WHEN age BETWEEN 22 AND 26 THEN 'Early Career'
    WHEN age BETWEEN 27 AND 34 THEN 'Career Growth'
    WHEN age BETWEEN 35 AND 45 THEN 'Established Professional'
    WHEN age BETWEEN 46 AND 60 THEN 'Senior Professional'
    ELSE 'Post-Career'
  END
FROM generate_series(13, 80) AS age
ON CONFLICT (age_exact) DO NOTHING;

-- ============================================================
-- ALTER user_aqi_signals — add dynamic weight columns
-- ============================================================

ALTER TABLE user_aqi_signals
  ADD COLUMN IF NOT EXISTS onboarding_weight NUMERIC DEFAULT 0.9,
  ADD COLUMN IF NOT EXISTS behavior_weight NUMERIC DEFAULT 0.1,
  ADD COLUMN IF NOT EXISTS total_behavior_events INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aqi_trajectory VARCHAR(20) DEFAULT 'stable',
  ADD COLUMN IF NOT EXISTS aqi_score_4w_ago NUMERIC,
  ADD COLUMN IF NOT EXISTS interest_vector_updated_at TIMESTAMPTZ;

-- ============================================================
-- SQL function: compute_demographic_medians
-- Groups members by a demographic dimension, calculates median
-- behavioral AQI per group. Only considers members with enough
-- behavioral history to have a trustworthy AQI.
-- ============================================================

CREATE OR REPLACE FUNCTION compute_demographic_medians(
  p_dimension TEXT,
  p_min_events INTEGER
)
RETURNS TABLE(dimension_value TEXT, median_behavioral_aqi NUMERIC, sample_size INTEGER)
LANGUAGE plpgsql AS $$
BEGIN
  -- Route to the correct grouping column based on dimension
  IF p_dimension = 'occupation_exact' THEN
    RETURN QUERY
      SELECT
        m.occupation::TEXT AS dimension_value,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.aqi_score) AS median_behavioral_aqi,
        COUNT(*)::INTEGER AS sample_size
      FROM members m
      JOIN user_aqi_signals s ON s.user_id = m.id
      WHERE s.total_behavior_events >= p_min_events
        AND s.aqi_score IS NOT NULL
        AND m.occupation IS NOT NULL
      GROUP BY m.occupation
      HAVING COUNT(*) >= 5;

  ELSIF p_dimension = 'occupation_category' THEN
    RETURN QUERY
      SELECT
        oh.occupation_category::TEXT AS dimension_value,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.aqi_score) AS median_behavioral_aqi,
        COUNT(*)::INTEGER AS sample_size
      FROM members m
      JOIN occupation_hierarchy oh ON oh.occupation_exact = m.occupation
      JOIN user_aqi_signals s ON s.user_id = m.id
      WHERE s.total_behavior_events >= p_min_events
        AND s.aqi_score IS NOT NULL
        AND oh.occupation_category IS NOT NULL
      GROUP BY oh.occupation_category
      HAVING COUNT(*) >= 5;

  ELSIF p_dimension = 'occupation_super' THEN
    RETURN QUERY
      SELECT
        oh.occupation_super::TEXT AS dimension_value,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.aqi_score) AS median_behavioral_aqi,
        COUNT(*)::INTEGER AS sample_size
      FROM members m
      JOIN occupation_hierarchy oh ON oh.occupation_exact = m.occupation
      JOIN user_aqi_signals s ON s.user_id = m.id
      WHERE s.total_behavior_events >= p_min_events
        AND s.aqi_score IS NOT NULL
        AND oh.occupation_super IS NOT NULL
      GROUP BY oh.occupation_super
      HAVING COUNT(*) >= 5;

  ELSIF p_dimension = 'age_exact' THEN
    RETURN QUERY
      SELECT
        EXTRACT(YEAR FROM AGE(NOW(), m.dob))::INTEGER::TEXT AS dimension_value,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.aqi_score) AS median_behavioral_aqi,
        COUNT(*)::INTEGER AS sample_size
      FROM members m
      JOIN user_aqi_signals s ON s.user_id = m.id
      WHERE s.total_behavior_events >= p_min_events
        AND s.aqi_score IS NOT NULL
        AND m.dob IS NOT NULL
      GROUP BY EXTRACT(YEAR FROM AGE(NOW(), m.dob))::INTEGER
      HAVING COUNT(*) >= 5;

  ELSIF p_dimension = 'age_band' THEN
    RETURN QUERY
      SELECT
        ab.age_band::TEXT AS dimension_value,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.aqi_score) AS median_behavioral_aqi,
        COUNT(*)::INTEGER AS sample_size
      FROM members m
      JOIN user_aqi_signals s ON s.user_id = m.id
      JOIN age_bands ab ON ab.age_exact = EXTRACT(YEAR FROM AGE(NOW(), m.dob))::INTEGER
      WHERE s.total_behavior_events >= p_min_events
        AND s.aqi_score IS NOT NULL
        AND m.dob IS NOT NULL
      GROUP BY ab.age_band
      HAVING COUNT(*) >= 5;

  ELSIF p_dimension = 'age_life_stage' THEN
    RETURN QUERY
      SELECT
        ab.life_stage::TEXT AS dimension_value,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.aqi_score) AS median_behavioral_aqi,
        COUNT(*)::INTEGER AS sample_size
      FROM members m
      JOIN user_aqi_signals s ON s.user_id = m.id
      JOIN age_bands ab ON ab.age_exact = EXTRACT(YEAR FROM AGE(NOW(), m.dob))::INTEGER
      WHERE s.total_behavior_events >= p_min_events
        AND s.aqi_score IS NOT NULL
        AND m.dob IS NOT NULL
      GROUP BY ab.life_stage
      HAVING COUNT(*) >= 5;
  END IF;
END;
$$;

-- Helper: get platform median AQI
CREATE OR REPLACE FUNCTION get_platform_median_aqi()
RETURNS NUMERIC
LANGUAGE plpgsql AS $$
DECLARE
  result NUMERIC;
BEGIN
  SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY aqi_score)
  INTO result
  FROM user_aqi_signals
  WHERE aqi_score IS NOT NULL;

  RETURN COALESCE(result, 45);
END;
$$;
