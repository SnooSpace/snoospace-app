-- ============================================================
-- Event Quality Score — Migration
-- Prompt 2: Enables brand sponsorship decisions before/after events
-- ============================================================

CREATE TABLE IF NOT EXISTS event_quality_scores (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL UNIQUE,

  -- Audience quality distribution
  total_rsvps INT DEFAULT 0,
  total_verified_attendees INT DEFAULT 0,
  -- QR check-ins + manually confirmed + inferred

  tier1_attendee_pct NUMERIC DEFAULT 0,
  tier2_attendee_pct NUMERIC DEFAULT 0,
  tier3_attendee_pct NUMERIC DEFAULT 0,
  tier4_attendee_pct NUMERIC DEFAULT 0,

  avg_attendee_aqi NUMERIC DEFAULT 0,
  -- weighted average AQI of all attendees

  buying_class_density NUMERIC DEFAULT 0,
  -- % of Tier 1 + Tier 2 attendees combined
  -- headline metric for brands

  -- Event performance signals
  rsvp_to_attend_ratio NUMERIC DEFAULT 0,
  content_generated INT DEFAULT 0,
  post_event_follows INT DEFAULT 0,
  echo_signal_count INT DEFAULT 0,

  -- Overall score
  event_quality_score NUMERIC DEFAULT 0,
  -- 0-100 composite score
  event_quality_tier VARCHAR(20),
  -- 'premium'   → score >= 80
  -- 'quality'   → score >= 60
  -- 'standard'  → score >= 40
  -- 'developing' → score < 40

  -- Prediction (before event happens)
  predicted_buying_class_density NUMERIC,
  prediction_confidence VARCHAR(20),
  -- 'high' (20+ RSVPs), 'medium' (10-19), 'low' (5-9)

  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  is_post_event BOOLEAN DEFAULT FALSE
  -- false = pre-event prediction, true = post-event actuals
);

CREATE INDEX IF NOT EXISTS idx_event_quality_event ON event_quality_scores(event_id);
CREATE INDEX IF NOT EXISTS idx_event_quality_score ON event_quality_scores(event_quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_event_quality_tier ON event_quality_scores(event_quality_tier);

-- Add quality score reference to events table
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS quality_score_id BIGINT
    REFERENCES event_quality_scores(id);
