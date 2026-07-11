-- ============================================================
-- 051_enable_rls_all_tables.sql
-- Row-Level Security — Enable on ALL tables
-- ============================================================
-- WHY THIS EXISTS:
--   Supabase flagged two CRITICAL security issues:
--     1. rls_disabled_in_public  → tables readable/writable by anyone with
--                                   the project URL via the REST API (PostgREST)
--     2. sensitive_columns_exposed → tables with PII/sensitive data exposed
--
-- HOW THIS WORKS:
--   This app uses a Node.js backend pool connecting as 'postgres' superuser
--   and a Supabase JS client using SUPABASE_SERVICE_KEY — neither uses JWT auth.
--
--   Strategy:
--     1. Enable RLS on every table in the public schema.
--     2. Add a single USING (true) policy for the 'postgres' role so that
--        all backend pg pool queries continue to work unchanged.
--     3. supabase.js uses the service_role key, which bypasses RLS entirely
--        at the Supabase level — so that client also needs no changes.
--     4. The anon and authenticated roles get NO policy → zero REST API access
--        by default. This closes the Supabase PostgREST exposure completely.
--
-- SAFE TO RE-RUN: uses DROP POLICY IF EXISTS + existence checks throughout.
-- NO CODE CHANGES REQUIRED: postgres superuser ignores RLS;
--   SUPABASE_SERVICE_KEY also bypasses RLS at the Supabase gateway level.
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    -- ── Core entity tables ────────────────────────────────────────────
    'members',
    'communities',
    'community_heads',
    'sponsors',
    'venues',
    'interests',
    'sponsor_interests',
    'signup_interests',
    'pronouns',

    -- ── Posts & engagement ────────────────────────────────────────────
    'posts',
    'post_likes',
    'post_comments',
    'post_shares',
    'post_saves',

    -- ── Follows / circles ─────────────────────────────────────────────
    'follows',
    'circles',
    'circle_requests',
    'community_blocks',

    -- ── Events & ticketing ────────────────────────────────────────────
    'events',
    'event_banners',
    'event_gallery',
    'event_registrations',
    'ticket_types',
    'registration_tickets',
    'discount_codes',
    'pricing_rules',
    'ticket_gifts',
    'ticket_reservations',
    'invite_requests',
    'event_swipes',
    'event_matches',
    'next_event_requests',
    'event_likes',
    'event_views',
    'event_comments',
    'event_comment_likes',

    -- ── Messaging ─────────────────────────────────────────────────────
    'conversations',
    'messages',

    -- ── Sessions (auth tokens — HIGHLY SENSITIVE) ──────────────────────
    'sessions',

    -- ── Member extras ─────────────────────────────────────────────────
    'member_photos',
    'member_location_history',
    'member_profile_change_log',

    -- ── Notifications ─────────────────────────────────────────────────
    'notifications',

    -- ── Moderation & admin ────────────────────────────────────────────
    'reports',
    'user_restrictions',
    'admin_audit_log',

    -- ── Sponsor types lookup ──────────────────────────────────────────
    'sponsor_types',

    -- ── Open Plans feature ────────────────────────────────────────────
    'open_plans',
    'open_plan_requests',
    'open_plan_likes',
    'open_plan_comments',
    'open_plan_views',

    -- ── Trust & safety ────────────────────────────────────────────────
    'user_blocks',
    'user_social_connections',  -- contains OAuth access_token — SENSITIVE
    'user_verifications',

    -- ── Privacy & consent (SENSITIVE: IP addresses, consent flags) ────
    'user_privacy_consent',
    'user_privacy_consent_audit',
    'data_deletion_requests',

    -- ── Sparks (intent declaration) ───────────────────────────────────
    'sparks',
    'user_sparks',

    -- ── People You Should Meet ────────────────────────────────────────
    'recommended_matches',
    'dismissed_recommendations',

    -- ── Audience Intelligence / AQI ───────────────────────────────────
    'follow_events',
    'user_aqi_signals',
    'creator_audience_stats',
    'brand_creator_matches',
    'brand_campaigns',
    'user_interest_vectors',
    'user_behavior_events',
    'user_drift_signals',
    'learned_demographic_scores',
    'occupation_hierarchy',
    'age_bands',
    'location_hierarchy',
    'learned_gender_category_affinity',
    'community_fraud_signals',
    'community_health_scores',
    'razorpay_payments',
    'platform_config',

    -- ── Session tracking (AQI sessions) ──────────────────────────────
    'aqi_sessions',
    'aqi_session_stats',

    -- ── System monitoring ─────────────────────────────────────────────
    'system_job_logs'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    -- Only process tables that actually exist (some may be created by later migrations)
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name   = tbl
        AND table_type   = 'BASE TABLE'
    ) THEN
      -- 1. Enable RLS on this table
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

      -- 2. Drop existing policy so this is idempotent
      EXECUTE format('DROP POLICY IF EXISTS "service_role_all" ON %I', tbl);

      -- 3. Create bypass policy for the postgres superuser only.
      --    anon and authenticated roles get no policy → no REST API access.
      EXECUTE format(
        'CREATE POLICY "service_role_all" ON %I AS PERMISSIVE FOR ALL TO postgres USING (true) WITH CHECK (true)',
        tbl
      );

      RAISE NOTICE 'RLS enabled: %', tbl;
    ELSE
      RAISE NOTICE 'Skipped (table not yet created): %', tbl;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- VERIFICATION QUERY (uncomment and run to confirm)
-- Every table should have rls_enabled = true
-- ============================================================
-- SELECT relname AS table_name,
--        relrowsecurity AS rls_enabled
-- FROM pg_class
-- WHERE relnamespace = 'public'::regnamespace
--   AND relkind = 'r'
-- ORDER BY relname;
-- ============================================================

-- ============================================================
-- END OF MIGRATION
-- ============================================================
