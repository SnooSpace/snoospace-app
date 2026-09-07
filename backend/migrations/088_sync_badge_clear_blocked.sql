-- ==============================================================================
-- 088_sync_badge_clear_blocked.sql
-- Patches sync_verification_badge() to clear plans_access_blocked = FALSE
-- whenever a verification is approved (any scope, either tier).
--
-- The rest of the function is preserved verbatim from migration 080.
-- plans_access_blocked is NEVER set to TRUE by this trigger — only
-- verificationRejectionService.handleVerificationRejection() does that.
-- ==============================================================================

CREATE OR REPLACE FUNCTION sync_verification_badge()
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

  -- Update members row.
  -- NEW: on any approval transition, also clear plans_access_blocked.
  -- This covers both automated and manual approvals for any scope.
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
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
    -- Non-approval transitions (rejection, pending→pending etc.) —
    -- update tier/verified but leave plans_access_blocked completely untouched.
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-apply security hardening (same as migrations 079 and 080)
ALTER FUNCTION public.sync_verification_badge() SET search_path = public;
