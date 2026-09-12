-- ==============================================================================
-- 091_sync_verification_badge_trigger.sql
-- 1. Updates sync_verification_badge() to support INSERT, UPDATE, and DELETE.
-- 2. Re-creates trg_sync_verification_badge as AFTER INSERT OR UPDATE OR DELETE.
-- 3. Synchronizes members table so any member with an approved verification
--    has is_verified = TRUE and plans_access_blocked = FALSE.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.sync_verification_badge()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id       BIGINT;
  v_current_tier  TEXT;
  v_max_rank      INT := 0;
  v_new_tier      TEXT := 'none';
  v_rec           RECORD;
  v_old_verified  BOOLEAN;
  v_new_verified  BOOLEAN;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
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

  -- Update members row.
  -- On any approval transition, also clear plans_access_blocked.
  IF (TG_OP = 'INSERT' AND NEW.status = 'approved') OR
     (TG_OP = 'UPDATE' AND NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved')) THEN
    UPDATE members
    SET is_verified          = v_new_verified,
        verified_at          = CASE
                                 WHEN v_new_verified AND NOT COALESCE(v_old_verified, FALSE) THEN NOW()
                                 WHEN NOT v_new_verified THEN NULL
                                 ELSE verified_at
                               END,
        verification_tier    = v_new_tier,
        plans_access_blocked = FALSE          -- clear on any approval
    WHERE id = v_user_id;
  ELSE
    -- Non-approval transitions (rejection, pending, delete etc.) —
    -- update tier/verified but leave plans_access_blocked untouched.
    UPDATE members
    SET is_verified       = v_new_verified,
        verified_at       = CASE
                              WHEN v_new_verified AND NOT COALESCE(v_old_verified, FALSE) THEN NOW()
                              WHEN NOT v_new_verified THEN NULL
                              ELSE verified_at
                            END,
        verification_tier = v_new_tier
    WHERE id = v_user_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION public.sync_verification_badge() SET search_path = public;

-- Recreate trigger to fire on INSERT, UPDATE, and DELETE
DROP TRIGGER IF EXISTS trg_sync_verification_badge ON user_verifications;

CREATE TRIGGER trg_sync_verification_badge
  AFTER INSERT OR UPDATE OR DELETE ON user_verifications
  FOR EACH ROW EXECUTE FUNCTION sync_verification_badge();

-- Backfill / Synchronize any members with approved verifications that might be desynced
UPDATE members m
SET is_verified = TRUE,
    plans_access_blocked = FALSE,
    verified_at = COALESCE(m.verified_at, NOW()),
    verification_tier = CASE
      WHEN m.verification_tier = 'id_verified' THEN 'id_verified'
      WHEN EXISTS (
        SELECT 1 FROM user_verifications uv
        WHERE uv.user_id = m.id AND uv.status = 'approved' AND uv.scope = 'discover'
      ) THEN 'selfie_verified'
      ELSE 'plans_verified'
    END
WHERE EXISTS (
  SELECT 1 FROM user_verifications uv
  WHERE uv.user_id = m.id AND uv.status = 'approved'
) AND (m.is_verified = FALSE OR m.verification_tier = 'none' OR m.verification_tier IS NULL);
