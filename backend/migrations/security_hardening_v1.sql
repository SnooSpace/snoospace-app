-- ============================================================
-- Security Hardening Migration — Prompt 2
-- Rate Limiting, Fraud Detection & Data Retention
-- ============================================================

-- 1. Add fraud detection columns to user_aqi_signals
-- These are written exclusively by detectAnomalousSignals() in the
-- weekly learning job. Never written by user-facing endpoints.
ALTER TABLE user_aqi_signals
  ADD COLUMN IF NOT EXISTS fraud_flag   BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS fraud_reason VARCHAR(50) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_user_aqi_signals_fraud
  ON user_aqi_signals(fraud_flag)
  WHERE fraud_flag = true;

-- 2. system_job_logs — monitoring table for background jobs
-- Written by retention and other scheduled jobs for observability.
CREATE TABLE IF NOT EXISTS system_job_logs (
  id               BIGSERIAL   PRIMARY KEY,
  job_name         VARCHAR(100) NOT NULL,
  records_affected INT          DEFAULT 0,
  notes            TEXT,
  ran_at           TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_job_logs_job_name
  ON system_job_logs(job_name, ran_at DESC);

-- 3. Update compute_demographic_medians to exclude fraud-flagged users.
--    All nine dimension branches get AND s.fraud_flag = false added.
CREATE OR REPLACE FUNCTION compute_demographic_medians(
  p_dimension TEXT,
  p_min_events INTEGER
)
RETURNS TABLE(dimension_value TEXT, median_behavioral_aqi NUMERIC, sample_size INTEGER)
LANGUAGE plpgsql AS $$
BEGIN
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
        AND s.fraud_flag = false
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
        AND s.fraud_flag = false
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
        AND s.fraud_flag = false
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
        AND s.fraud_flag = false
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
        AND s.fraud_flag = false
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
        AND s.fraud_flag = false
      GROUP BY ab.life_stage
      HAVING COUNT(*) >= 5;

  ELSIF p_dimension = 'location_city' THEN
    RETURN QUERY
      SELECT
        (m.location->>'city')::TEXT AS dimension_value,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.aqi_score) AS median_behavioral_aqi,
        COUNT(*)::INTEGER AS sample_size
      FROM members m
      JOIN user_aqi_signals s ON s.user_id = m.id
      WHERE s.total_behavior_events >= p_min_events
        AND s.aqi_score IS NOT NULL
        AND m.location->>'city' IS NOT NULL
        AND s.fraud_flag = false
      GROUP BY m.location->>'city'
      HAVING COUNT(*) >= 5;

  ELSIF p_dimension = 'location_area' THEN
    RETURN QUERY
      SELECT
        (m.location->>'area')::TEXT AS dimension_value,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.aqi_score) AS median_behavioral_aqi,
        COUNT(*)::INTEGER AS sample_size
      FROM members m
      JOIN user_aqi_signals s ON s.user_id = m.id
      WHERE s.total_behavior_events >= p_min_events
        AND s.aqi_score IS NOT NULL
        AND m.location->>'area' IS NOT NULL
        AND s.fraud_flag = false
      GROUP BY m.location->>'area'
      HAVING COUNT(*) >= 5;

  ELSIF p_dimension = 'location_city_tier' THEN
    RETURN QUERY
      SELECT
        lh.city_tier::TEXT AS dimension_value,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.aqi_score) AS median_behavioral_aqi,
        COUNT(*)::INTEGER AS sample_size
      FROM members m
      JOIN location_hierarchy lh ON lh.city = m.location->>'city'
      JOIN user_aqi_signals s ON s.user_id = m.id
      WHERE s.total_behavior_events >= p_min_events
        AND s.aqi_score IS NOT NULL
        AND m.location->>'city' IS NOT NULL
        AND s.fraud_flag = false
      GROUP BY lh.city_tier
      HAVING COUNT(*) >= 5;

  END IF;
END;
$$;
