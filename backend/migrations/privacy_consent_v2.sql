-- privacy_consent_v2.sql
-- Adds polymorphic user_type support, event_audience_intelligence_consent for communities,
-- and brand_data_acknowledged for sponsor accounts.

-- 1. Add user_type column (defaults to 'member' for existing rows)
ALTER TABLE user_privacy_consent
  ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) NOT NULL DEFAULT 'member';

-- 2. Add event audience intelligence consent (Community accounts only)
ALTER TABLE user_privacy_consent
  ADD COLUMN IF NOT EXISTS event_audience_intelligence_consent BOOLEAN NOT NULL DEFAULT false;

-- 3. Add brand data acknowledgment flag (Sponsor accounts only)
ALTER TABLE user_privacy_consent
  ADD COLUMN IF NOT EXISTS brand_data_acknowledged BOOLEAN NOT NULL DEFAULT false;

-- 4. Drop old single-column unique constraint (safe — IF EXISTS supported on DROP)
ALTER TABLE user_privacy_consent
  DROP CONSTRAINT IF EXISTS user_privacy_consent_user_id_key;

-- 5. Add composite unique constraint — guard with a DO block to avoid duplicate error
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_privacy_consent_user_id_type_key'
  ) THEN
    ALTER TABLE user_privacy_consent
      ADD CONSTRAINT user_privacy_consent_user_id_type_key
        UNIQUE (user_id, user_type);
  END IF;
END $$;

-- 6. Update audit table to track user_type as well
ALTER TABLE user_privacy_consent_audit
  ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) NOT NULL DEFAULT 'member';

SELECT 'privacy_consent_v2 migration complete' AS status;
