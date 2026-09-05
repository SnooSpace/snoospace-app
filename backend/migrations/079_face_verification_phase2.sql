-- ==============================================================================
-- 079_face_verification_phase2.sql
-- Automated face verification columns on user_verifications and tier sync trigger
-- ==============================================================================

-- 1. Add columns to user_verifications for automated decision tracking
ALTER TABLE user_verifications
  ADD COLUMN IF NOT EXISTS decision_source TEXT NOT NULL DEFAULT 'manual'
  CHECK (decision_source IN ('manual', 'automated'));

ALTER TABLE user_verifications
  ADD COLUMN IF NOT EXISTS match_score NUMERIC;

ALTER TABLE user_verifications
  ADD COLUMN IF NOT EXISTS matched_photo_url TEXT;

-- 2. Redefine sync_verification_badge to maintain members.verification_tier
--    When approved: promote to 'selfie_verified' (unless already 'id_verified')
--    When rejected after approved: reset to 'none' (unless already 'id_verified')
CREATE OR REPLACE FUNCTION sync_verification_badge()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    UPDATE members
    SET is_verified = TRUE,
        verified_at = NOW(),
        verification_tier = CASE
          WHEN verification_tier = 'id_verified' THEN 'id_verified'
          ELSE 'selfie_verified'
        END
    WHERE id = NEW.user_id;
  ELSIF NEW.status = 'rejected' AND OLD.status = 'approved' THEN
    -- Revoke badge if re-reviewed and rejected (edge case)
    UPDATE members
    SET is_verified = FALSE,
        verified_at = NULL,
        verification_tier = CASE
          WHEN verification_tier = 'id_verified' THEN 'id_verified'
          ELSE 'none'
        END
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Re-apply security hardening from migration 053
ALTER FUNCTION public.sync_verification_badge() SET search_path = public;
