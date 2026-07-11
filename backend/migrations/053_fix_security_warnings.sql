-- ============================================================
-- 053_fix_security_warnings.sql
-- Resolves all 35 Supabase security warnings
-- ============================================================
-- Categories addressed:
--   1. function_search_path_mutable (21 functions)
--      → ALTER FUNCTION ... SET search_path = public
--   2. rls_policy_always_true (2 policies on venue_cache)
--      → Drop old open policies; tighten to explicit roles
--   3. anon/authenticated_security_definer_function_executable (10 warnings, 5 functions)
--      → REVOKE EXECUTE from anon and authenticated roles
--   4. extension_in_public — pg_trgm (1 warning)
--      → Move to extensions schema (Supabase's dedicated schema for extensions)
--
-- NOT ADDRESSED HERE (requires Supabase Dashboard, not SQL):
--   auth_leaked_password_protection → Go to:
--     Supabase Dashboard → Auth → Providers → Email → Password strength
--     Enable "Prevent use of leaked passwords" (HaveIBeenPwned integration)
--     NOTE: Not applicable if you don't use Supabase Auth at all.
--
-- SAFE TO RE-RUN: uses EXCEPTION handlers and IF EXISTS throughout.
-- ============================================================


-- ============================================================
-- SECTION 1 — Fix mutable search_path on all 21 functions
-- ============================================================
-- Without a fixed search_path, a malicious user could SET search_path
-- to a schema containing a trojan-horse function with the same name,
-- exploiting a SECURITY DEFINER function. Pinning it to 'public'
-- prevents this class of attack entirely.

DO $$ BEGIN
  ALTER FUNCTION public.compute_demographic_medians(text, integer)
    SET search_path = public;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'compute_demographic_medians: not found, skipping';
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.get_platform_median_aqi()
    SET search_path = public;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'get_platform_median_aqi: not found, skipping';
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.update_opportunity_applicant_count()
    SET search_path = public;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'update_opportunity_applicant_count: not found, skipping';
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.update_opportunity_updated_at()
    SET search_path = public;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'update_opportunity_updated_at: not found, skipping';
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.fn_update_follow_counts()
    SET search_path = public;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'fn_update_follow_counts: not found, skipping';
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.update_updated_at()
    SET search_path = public;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'update_updated_at: not found, skipping';
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.sync_plan_like_count()
    SET search_path = public;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'sync_plan_like_count: not found, skipping';
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.sync_plan_comment_count()
    SET search_path = public;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'sync_plan_comment_count: not found, skipping';
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.sync_plan_view_count()
    SET search_path = public;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'sync_plan_view_count: not found, skipping';
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.sync_verification_badge()
    SET search_path = public;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'sync_verification_badge: not found, skipping';
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.member_meets_proof_gate(bigint)
    SET search_path = public;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'member_meets_proof_gate: not found, skipping';
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.members_share_community(bigint, bigint)
    SET search_path = public;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'members_share_community: not found, skipping';
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.members_are_blocked(bigint, bigint)
    SET search_path = public;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'members_are_blocked: not found, skipping';
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.expire_open_plans()
    SET search_path = public;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'expire_open_plans: not found, skipping';
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.generate_recurring_plans()
    SET search_path = public;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'generate_recurring_plans: not found, skipping';
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.uuid_generate_v7()
    SET search_path = public;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'uuid_generate_v7: not found, skipping';
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.fn_update_circle_count()
    SET search_path = public;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'fn_update_circle_count: not found, skipping';
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.fn_update_creator_follower_count()
    SET search_path = public;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'fn_update_creator_follower_count: not found, skipping';
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.fn_update_community_circle_member_count()
    SET search_path = public;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'fn_update_community_circle_member_count: not found, skipping';
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.update_venue_cache_updated_at()
    SET search_path = public;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'update_venue_cache_updated_at: not found, skipping';
END $$;

DO $$ BEGIN
  ALTER FUNCTION public.set_notification_category()
    SET search_path = public;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'set_notification_category: not found, skipping';
END $$;


-- ============================================================
-- SECTION 2 — Fix venue_cache policies (rls_policy_always_true)
-- ============================================================
-- The original migration (036_venue_cache.sql) created open INSERT and UPDATE
-- policies for all roles so the Expo client could write through the anon key.
-- Since this app does NOT use Supabase Auth client-side, there is no anon key
-- in the Expo client — writes go via the backend API. These policies are
-- therefore unnecessary and flagged as overly permissive.
--
-- We drop the open INSERT/UPDATE policies. The existing service_role_all
-- policy (from migration 051) already grants full access to postgres/service_role.
-- The SELECT policy (USING true, no WITH CHECK) is intentionally kept — Supabase
-- explicitly excludes SELECT USING (true) from this warning as it's legitimate
-- for public read access.

DROP POLICY IF EXISTS "venue_cache_insert" ON public.venue_cache;
DROP POLICY IF EXISTS "venue_cache_update" ON public.venue_cache;

-- Verify the safe SELECT policy still exists; recreate if it was lost.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'venue_cache'
      AND policyname = 'venue_cache_select'
  ) THEN
    CREATE POLICY "venue_cache_select"
      ON public.venue_cache FOR SELECT
      USING (true);
  END IF;
END $$;


-- ============================================================
-- SECTION 3 — Revoke EXECUTE on SECURITY DEFINER functions
--             from anon and authenticated roles
-- ============================================================
-- These are internal cron/helper functions (expire_open_plans,
-- generate_recurring_plans) and gate-check functions (member_meets_proof_gate,
-- members_are_blocked, members_share_community). None should be callable
-- via the public REST API (/rest/v1/rpc/...).
--
-- REVOKE does not affect the backend — the postgres role (pg pool) and
-- service_role key both have EXECUTE regardless.

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.expire_open_plans()
    FROM anon, authenticated;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'expire_open_plans revoke: not found, skipping';
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.generate_recurring_plans()
    FROM anon, authenticated;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'generate_recurring_plans revoke: not found, skipping';
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.member_meets_proof_gate(bigint)
    FROM anon, authenticated;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'member_meets_proof_gate revoke: not found, skipping';
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.members_are_blocked(bigint, bigint)
    FROM anon, authenticated;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'members_are_blocked revoke: not found, skipping';
END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.members_share_community(bigint, bigint)
    FROM anon, authenticated;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'members_share_community revoke: not found, skipping';
END $$;


-- ============================================================
-- SECTION 4 — Move pg_trgm from public to extensions schema
-- ============================================================
-- pg_trgm should live in the dedicated extensions schema, not in public.
-- Supabase's default search_path already includes extensions, so all
-- uses of similarity(), gin_trgm_ops etc. continue to work without
-- any application code changes.
--
-- Steps:
--   1. Drop the GIN index that depends on pg_trgm (CASCADE does this)
--   2. Drop pg_trgm from public
--   3. Install pg_trgm in the extensions schema
--   4. Recreate the GIN index on sparks.normalized_label

DO $$ BEGIN
  -- Only move if it's currently in 'public'
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_trgm'
      AND n.nspname  = 'public'
  ) THEN
    -- Drop dependent GIN index first to avoid CASCADE surprise on the table
    DROP INDEX IF EXISTS public.sparks_trgm_idx;

    -- Remove from public (CASCADE drops any remaining dependents safely)
    DROP EXTENSION pg_trgm CASCADE;

    -- Reinstall in extensions schema
    CREATE EXTENSION pg_trgm SCHEMA extensions;

    -- Recreate the GIN trigram index — extensions is in search_path so
    -- the operator class resolves without a schema prefix
    CREATE INDEX IF NOT EXISTS sparks_trgm_idx
      ON public.sparks USING GIN (normalized_label gin_trgm_ops);

    RAISE NOTICE 'pg_trgm moved from public to extensions schema';
  ELSE
    RAISE NOTICE 'pg_trgm is not in public schema — no action needed';
  END IF;
END $$;


-- ============================================================
-- SECTION 5 — auth_leaked_password_protection
-- ============================================================
-- This cannot be fixed via SQL. It is a Supabase Auth dashboard setting.
--
-- HOW TO FIX:
--   Supabase Dashboard → Authentication → Sign In / Sign Up
--   → Password → Enable "Prevent use of leaked passwords"
--
-- NOTE: SnooSpace uses its own JWT auth system (not Supabase Auth).
--   If you are not using Supabase's email/password sign-in at all,
--   this warning is informational only and has no impact on your app.
--   You can dismiss it in the Supabase Advisor UI.
-- ============================================================


-- ============================================================
-- END OF MIGRATION
-- ============================================================
