-- ============================================================
-- 013_uuid_v7_defaults.sql
-- Upgrades UUID column defaults from gen_random_uuid() (v4)
-- to uuid_generate_v7() (v7) on all affected tables.
--
-- What this does:
--   - Changes only the DEFAULT expression on each id column
--   - Does NOT modify any existing row data
--   - Does NOT change the column type (still UUID)
--   - Does NOT affect any foreign key constraints
--
-- Pre-flight check — run before applying, must return 0 rows:
--   SELECT viewname, definition FROM pg_views
--   WHERE definition ILIKE '%video_watch_events%'
--      OR definition ILIKE '%video_follow_conversions%'
--      OR definition ILIKE '%opportunities%'
--      OR definition ILIKE '%opportunity_skill_groups%'
--      OR definition ILIKE '%opportunity_questions%'
--      OR definition ILIKE '%opportunity_applications%'
--      OR definition ILIKE '%opportunity_application_responses%'
--      OR definition ILIKE '%colleges%'
--      OR definition ILIKE '%sessions%'
--      OR definition ILIKE '%profile_views%'
--      OR definition ILIKE '%connection_requests%'
--      OR definition ILIKE '%campuses%';
--
-- Prerequisite: 012_uuid_v7_function.sql must have been run first.
-- Do NOT run until reviewed. See UUID_V7_UPGRADE.md for full details.
-- ============================================================

BEGIN;

-- ── video_insights.sql ────────────────────────────────────────

-- 1. video_watch_events
ALTER TABLE video_watch_events
  ALTER COLUMN id SET DEFAULT uuid_generate_v7();

-- 2. video_follow_conversions
ALTER TABLE video_follow_conversions
  ALTER COLUMN id SET DEFAULT uuid_generate_v7();

-- ── opportunities_migration.sql ───────────────────────────────

-- 3. opportunities
ALTER TABLE opportunities
  ALTER COLUMN id SET DEFAULT uuid_generate_v7();

-- 4. opportunity_skill_groups
ALTER TABLE opportunity_skill_groups
  ALTER COLUMN id SET DEFAULT uuid_generate_v7();

-- 5. opportunity_questions
ALTER TABLE opportunity_questions
  ALTER COLUMN id SET DEFAULT uuid_generate_v7();

-- 6. opportunity_applications
ALTER TABLE opportunity_applications
  ALTER COLUMN id SET DEFAULT uuid_generate_v7();

-- 7. opportunity_application_responses
ALTER TABLE opportunity_application_responses
  ALTER COLUMN id SET DEFAULT uuid_generate_v7();

-- ── community_restructure_migration.sql ───────────────────────

-- 8. colleges
ALTER TABLE colleges
  ALTER COLUMN id SET DEFAULT uuid_generate_v7();

-- ── migrate_otp_auth.sql ──────────────────────────────────────

-- 9. sessions
ALTER TABLE sessions
  ALTER COLUMN id SET DEFAULT uuid_generate_v7();

-- ── profile_view_tracking.sql ─────────────────────────────────

-- 10. profile_views
ALTER TABLE profile_views
  ALTER COLUMN id SET DEFAULT uuid_generate_v7();

-- 11. connection_requests
ALTER TABLE connection_requests
  ALTER COLUMN id SET DEFAULT uuid_generate_v7();

-- ── db.js (inline schema bootstrap) ──────────────────────────
-- campuses is defined in application code (db.js), not in any
-- .sql migration file. This ALTER brings it into migration history.
-- See UUID_V7_UPGRADE.md — "campuses" flag section.

-- 12. campuses
ALTER TABLE campuses
  ALTER COLUMN id SET DEFAULT uuid_generate_v7();

COMMIT;
