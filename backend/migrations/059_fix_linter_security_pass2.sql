-- ============================================================
-- 059_fix_linter_security_pass2.sql
-- Resolves all remaining Supabase Advisor security issues
-- ============================================================
--
-- ERRORS FIXED (rls_disabled_in_public):
--   1. public.event_verifications — RLS not enabled
--   2. public.open_plan_shares    — RLS not enabled
--   3. public.venues              — RLS was listed in 051 but linter
--                                   still flags it; re-apply idempotently
--
-- WARNINGS FIXED:
--   4. public.uuid_generate_v7 — mutable search_path
--      Migration 053 already ran SET search_path = public, but the function
--      may have been recreated (CREATE OR REPLACE) since then, dropping the
--      search_path pin. Re-pin it here idempotently.
--
-- SUGGESTIONS FIXED (rls_enabled_no_policy):
--   5. public.promote_quotas — RLS is ON but no policy exists
--      Migration 055 enabled RLS but skipped creating the postgres-only
--      bypass policy. Add it now to match the pattern from 051/052.
--
-- NOT FIXED HERE (requires Supabase Dashboard):
--   auth_leaked_password_protection
--   → Dashboard → Authentication → Sign In / Sign Up → Password
--   → Enable "Prevent use of leaked passwords"
--   NOTE: SnooSpace uses its own JWT auth, not Supabase Auth email/password.
--         This warning has no functional impact on the app and can be dismissed.
--
-- SAFE TO RE-RUN: fully idempotent — uses DROP POLICY IF EXISTS + EXCEPTION
--                 handlers throughout.
-- ============================================================


-- ============================================================
-- SECTION 1 — Enable RLS on the 3 unprotected tables
-- ============================================================
-- Strategy matches migrations 051 / 052:
--   • Enable RLS
--   • Drop any stale policy with the same name (idempotency)
--   • Create PERMISSIVE policy for 'postgres' superuser only
--     → anon and authenticated get zero access via PostgREST
--   • postgres pool + SUPABASE_SERVICE_KEY bypass RLS → no backend changes needed

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'event_verifications',
    'open_plan_shares',
    'venues'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name   = tbl
        AND table_type   = 'BASE TABLE'
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "service_role_all" ON %I', tbl);
      EXECUTE format(
        'CREATE POLICY "service_role_all" ON %I AS PERMISSIVE FOR ALL TO postgres USING (true) WITH CHECK (true)',
        tbl
      );
      RAISE NOTICE 'RLS secured: %', tbl;
    ELSE
      RAISE NOTICE 'Skipped (table not found in public schema): %', tbl;
    END IF;
  END LOOP;
END;
$$;


-- ============================================================
-- SECTION 2 — Re-pin uuid_generate_v7 search_path (WARNING fix)
-- ============================================================
-- uuid_generate_v7 was pinned in migration 053 but CREATE OR REPLACE
-- resets the search_path configuration when the function is recreated.
-- Re-applying SET search_path = public is safe and idempotent.

DO $$ BEGIN
  ALTER FUNCTION public.uuid_generate_v7()
    SET search_path = public;
EXCEPTION WHEN undefined_function OR undefined_object THEN
  RAISE NOTICE 'uuid_generate_v7: function not found, skipping';
END $$;


-- ============================================================
-- SECTION 3 — Add postgres policy to promote_quotas (SUGGESTION fix)
-- ============================================================
-- promote_quotas has RLS enabled (migration 055) but no policies,
-- which blocks all access including from the backend postgres pool.
-- Add the standard postgres-only bypass policy.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'promote_quotas'
      AND table_type   = 'BASE TABLE'
  ) THEN
    -- Ensure RLS is on (in case 055 was skipped or partially applied)
    ALTER TABLE promote_quotas ENABLE ROW LEVEL SECURITY;

    -- Drop and recreate policy idempotently
    DROP POLICY IF EXISTS "service_role_all" ON promote_quotas;
    CREATE POLICY "service_role_all"
      ON promote_quotas AS PERMISSIVE
      FOR ALL TO postgres
      USING (true)
      WITH CHECK (true);

    RAISE NOTICE 'RLS policy added: promote_quotas';
  ELSE
    RAISE NOTICE 'promote_quotas not found, skipping';
  END IF;
END $$;


-- ============================================================
-- VERIFICATION QUERIES (uncomment to confirm after running)
-- ============================================================

-- 1. Confirm RLS is ON for all 4 tables:
-- SELECT relname AS table_name, relrowsecurity AS rls_enabled
-- FROM pg_class
-- WHERE relnamespace = 'public'::regnamespace
--   AND relkind = 'r'
--   AND relname IN ('event_verifications', 'open_plan_shares', 'venues', 'promote_quotas')
-- ORDER BY relname;

-- 2. Confirm the policies exist:
-- SELECT tablename, policyname, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename  IN ('event_verifications', 'open_plan_shares', 'venues', 'promote_quotas')
-- ORDER BY tablename;

-- 3. Confirm uuid_generate_v7 search_path is pinned:
-- SELECT proname, proconfig
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname = 'uuid_generate_v7';

-- ============================================================
-- END OF MIGRATION
-- ============================================================
