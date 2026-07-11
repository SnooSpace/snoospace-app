-- ============================================================
-- 052_rls_remaining_tables.sql
-- Row-Level Security — Second pass for tables missed by 051
-- ============================================================
-- WHY:
--   After running 051_enable_rls_all_tables.sql, the verification
--   query revealed tables that exist in production but were not
--   listed in the previous migration (created by older migrations
--   or schema changes not tracked in /migrations).
--
-- SAME STRATEGY AS 051:
--   - Enable RLS on each table
--   - Add USING (true) policy for the 'postgres' role only
--   - anon / authenticated roles get no policy → REST API blocked
--   - postgres superuser + SUPABASE_SERVICE_KEY both bypass RLS
--     → zero backend code changes needed
--
-- SAFE TO RE-RUN: idempotent via DROP POLICY IF EXISTS.
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    -- ── Admin ─────────────────────────────────────────────────────────
    'admins',

    -- ── Analytics ─────────────────────────────────────────────────────
    'analytics_daily',

    -- ── Branches ──────────────────────────────────────────────────────
    'branches',

    -- ── Colleges & campuses ───────────────────────────────────────────
    'campuses',
    'colleges',

    -- ── Card extensions ───────────────────────────────────────────────
    'card_extensions',

    -- ── Challenges ────────────────────────────────────────────────────
    'challenge_participations',
    'challenge_submission_comments',
    'challenge_submission_likes',
    'challenge_submission_sources',
    'challenge_submission_views',
    'challenge_submissions',
    'submission_removal_requests',

    -- ── Post comment likes ────────────────────────────────────────────
    'comment_likes',

    -- ── Community extras ─────────────────────────────────────────────
    'community_categories',
    'community_host_audit_log',
    'community_hosts',
    'community_member_circle_invites',
    'community_member_circles',

    -- ── Connections (pre-circles system) ──────────────────────────────
    'connection_requests',

    -- ── Conversation features ─────────────────────────────────────────
    'conversation_hidden',
    'conversation_muted',
    'conversation_participants',
    'conversation_reports',

    -- ── Creator system ────────────────────────────────────────────────
    'creator_follows',
    'creator_profiles',

    -- ── Discover ──────────────────────────────────────────────────────
    'discover_categories',

    -- ── Event extras ──────────────────────────────────────────────────
    'event_cohosts',
    'event_discover_categories',
    'event_featured_accounts',
    'event_highlights',
    'event_interests',
    'event_quality_scores',
    'event_things_to_know',

    -- ── Group chat ────────────────────────────────────────────────────
    'group_auto_join_dismissed',

    -- ── Notification extras ───────────────────────────────────────────
    'notification_aggregates',
    'user_notification_preferences',

    -- ── Open plan extras ──────────────────────────────────────────────
    'open_plan_interests',

    -- ── Opportunities ─────────────────────────────────────────────────
    'opportunities',
    'opportunity_application_responses',
    'opportunity_applications',
    'opportunity_comment_likes',
    'opportunity_comments',
    'opportunity_likes',
    'opportunity_questions',
    'opportunity_saves',
    'opportunity_skill_groups',
    'opportunity_views',

    -- ── Polls ─────────────────────────────────────────────────────────
    'poll_votes',

    -- ── Profile views ─────────────────────────────────────────────────
    'profile_views',

    -- ── Prompts / Q&A ─────────────────────────────────────────────────
    'prompt_replies',
    'prompt_submissions',
    'qna_answers',
    'qna_experts',
    'qna_question_upvotes',
    'qna_questions',

    -- ── Push tokens (SENSITIVE — device identifiers) ──────────────────
    'push_tokens',

    -- ── View tracking ─────────────────────────────────────────────────
    'repeat_view_events',
    'unique_view_events',

    -- ── Spotify (SENSITIVE — OAuth connections) ───────────────────────
    'spotify_connections',
    'spotify_top_artists',

    -- ── Subscriptions ─────────────────────────────────────────────────
    'subscriptions',

    -- ── User extras ───────────────────────────────────────────────────
    'user_bans',
    'user_events',
    'user_sessions',   -- SENSITIVE: active auth sessions

    -- ── Video analytics ───────────────────────────────────────────────
    'video_follow_conversions',
    'video_insights_cache',
    'video_watch_events'
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
      RAISE NOTICE 'RLS enabled: %', tbl;
    ELSE
      RAISE NOTICE 'Skipped (does not exist): %', tbl;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- VERIFICATION — should return zero rows after this runs
-- ============================================================
-- SELECT relname AS table_name
-- FROM pg_class
-- WHERE relnamespace = 'public'::regnamespace
--   AND relkind = 'r'
--   AND relrowsecurity = false
-- ORDER BY relname;
-- ============================================================

-- ============================================================
-- END OF MIGRATION
-- ============================================================
