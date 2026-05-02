-- ============================================================
-- Privacy Consent & DPDP Act Compliance — Migration
-- ============================================================

-- 1. user_privacy_consent — stores each user's consent decisions
-- One row per user, upserted whenever they update preferences
CREATE TABLE IF NOT EXISTS user_privacy_consent (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  behavioral_tracking_consent BOOLEAN NOT NULL DEFAULT false,
  -- consent to track event attendance, content engagement, search behavior
  brand_targeting_consent BOOLEAN NOT NULL DEFAULT false,
  -- consent to appear in brand-creator matching and AQI scoring for ads
  data_sharing_consent BOOLEAN NOT NULL DEFAULT false,
  -- consent to share aggregated (never individual) data with brand partners
  consent_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
  -- increment this when privacy policy changes, re-prompt users
  consented_at TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  ip_address VARCHAR(45),
  -- log IP at time of consent for legal record
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_privacy_consent_user ON user_privacy_consent(user_id);
CREATE INDEX IF NOT EXISTS idx_privacy_consent_behavioral 
  ON user_privacy_consent(behavioral_tracking_consent);
CREATE INDEX IF NOT EXISTS idx_privacy_consent_brand 
  ON user_privacy_consent(brand_targeting_consent);

-- 2. user_privacy_consent_audit — every change to consent is permanently recorded
-- Never update or delete rows here
CREATE TABLE IF NOT EXISTS user_privacy_consent_audit (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  action VARCHAR(30) NOT NULL,
  -- 'initial_consent', 'opt_out_behavioral', 'opt_in_behavioral',
  -- 'opt_out_brand', 'opt_in_brand', 'data_deletion_requested',
  -- 'policy_version_update'
  previous_state JSONB,
  new_state JSONB,
  performed_at TIMESTAMPTZ DEFAULT now(),
  ip_address VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS idx_consent_audit_user ON user_privacy_consent_audit(user_id);

-- 3. data_deletion_requests — cascade deletion of all behavioral data
CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ DEFAULT now(),
  status VARCHAR(20) DEFAULT 'pending',
  -- 'pending', 'processing', 'completed', 'failed'
  completed_at TIMESTAMPTZ,
  tables_cleared JSONB,
  -- log which tables were cleared and row counts
  UNIQUE(user_id)
);
