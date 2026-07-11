-- ============================================================
-- 054_fix_new_tables_and_revoke_public.sql
-- ============================================================
-- Fixes two remaining issues:
--
-- 1. RLS ERRORS (2 tables created after 051/052 ran):
--    recommended_matches, dismissed_recommendations
--    → Enable RLS + postgres-only policy
--
-- 2. SECURITY DEFINER WARNINGS (5 functions × 2 roles = 10 warnings):
--    The REVOKE in 053 targeted anon and authenticated directly, but
--    those roles inherit EXECUTE from the PUBLIC role. We must also
--    REVOKE FROM PUBLIC to fully block REST API access.
--    Functions: expire_open_plans, generate_recurring_plans,
--               member_meets_proof_gate, members_are_blocked,
--               members_share_community
-- ============================================================


-- ── 1. RLS on the two new recommendation tables ───────────────────────────────

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY['recommended_matches', 'dismissed_recommendations'];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl AND table_type = 'BASE TABLE'
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "service_role_all" ON %I', tbl);
      EXECUTE format(
        'CREATE POLICY "service_role_all" ON %I AS PERMISSIVE FOR ALL TO postgres USING (true) WITH CHECK (true)',
        tbl
      );
      RAISE NOTICE 'RLS enabled: %', tbl;
    END IF;
  END LOOP;
END;
$$;


-- ── 2. Revoke EXECUTE from PUBLIC on the 5 SECURITY DEFINER functions ─────────
-- anon and authenticated inherit EXECUTE from PUBLIC by default.
-- Revoking from PUBLIC removes that inherited access for all roles.
-- The postgres superuser and service_role are unaffected.

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.expire_open_plans() FROM PUBLIC;
EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.generate_recurring_plans() FROM PUBLIC;
EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.member_meets_proof_gate(bigint) FROM PUBLIC;
EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.members_are_blocked(bigint, bigint) FROM PUBLIC;
EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.members_share_community(bigint, bigint) FROM PUBLIC;
EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;


-- ── END OF MIGRATION ──────────────────────────────────────────────────────────
