-- ==============================================================================
-- 080_two_tier_verification.sql
-- Two-tier verification schema extensions, scope support, and multi-scope badge trigger
-- ==============================================================================

-- 1. Add scope and manual_reference_photo_url to user_verifications
ALTER TABLE user_verifications
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'discover'
  CHECK (scope IN ('plans', 'discover'));

ALTER TABLE user_verifications
  ADD COLUMN IF NOT EXISTS manual_reference_photo_url TEXT;

-- Update reviewed_by to reference admins(id) rather than members(id)
ALTER TABLE user_verifications
  DROP CONSTRAINT IF EXISTS user_verifications_reviewed_by_fkey;

ALTER TABLE user_verifications
  ADD CONSTRAINT user_verifications_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES admins(id) ON DELETE SET NULL;

-- 2. Update verification_tier check constraint on members table
ALTER TABLE members
  DROP CONSTRAINT IF EXISTS members_verification_tier_check;

ALTER TABLE members
  ADD CONSTRAINT members_verification_tier_check
  CHECK (verification_tier IN ('none', 'plans_verified', 'selfie_verified', 'id_verified'));

-- 3. Redefine sync_verification_badge to be scope-aware and multi-scope-correct
CREATE OR REPLACE FUNCTION sync_verification_badge()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id BIGINT;
  v_current_tier TEXT;
  v_max_rank INT := 0;
  v_new_tier TEXT := 'none';
  v_rec RECORD;
  v_old_verified BOOLEAN;
  v_new_verified BOOLEAN;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fetch current verification details for the user
  SELECT is_verified, verification_tier
  INTO v_old_verified, v_current_tier
  FROM members
  WHERE id = v_user_id;

  -- Iterate through ALL currently approved user_verifications for this user
  FOR v_rec IN
    SELECT scope
    FROM user_verifications
    WHERE user_id = v_user_id AND status = 'approved'
  LOOP
    IF v_rec.scope = 'discover' AND 2 > v_max_rank THEN
      v_max_rank := 2;
    ELSIF v_rec.scope = 'plans' AND 1 > v_max_rank THEN
      v_max_rank := 1;
    END IF;
  END LOOP;

  -- Map max rank back to tier
  IF v_max_rank = 2 THEN
    v_new_tier := 'selfie_verified';
  ELSIF v_max_rank = 1 THEN
    v_new_tier := 'plans_verified';
  ELSE
    v_new_tier := 'none';
  END IF;

  -- Preserve id_verified if already held (id_verified is a separate higher tier)
  IF v_current_tier = 'id_verified' THEN
    v_new_tier := 'id_verified';
  END IF;

  v_new_verified := (v_new_tier != 'none');

  UPDATE members
  SET is_verified = v_new_verified,
      verified_at = CASE
        WHEN v_new_verified AND NOT COALESCE(v_old_verified, FALSE) THEN NOW()
        WHEN NOT v_new_verified THEN NULL
        ELSE verified_at
      END,
      verification_tier = v_new_tier
  WHERE id = v_user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Re-apply security hardening
ALTER FUNCTION public.sync_verification_badge() SET search_path = public;
