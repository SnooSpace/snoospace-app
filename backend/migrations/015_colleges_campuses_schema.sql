-- ============================================================
-- 015_colleges_campuses_schema.sql
-- Formally brings colleges and campuses into migration history.
--
-- Context:
--   Both tables were originally defined in db.js (ensureTables()
--   bootstrap block) rather than in a .sql migration file. This
--   migration takes ownership of their schema without recreating
--   or modifying existing data.
--
-- What this does:
--   - Ensures all ALTER-applied columns exist (idempotent)
--   - Ensures all indexes exist (idempotent)
--   - Ensures communities.campus_id FK column exists (idempotent)
--   - Upgrades campuses.id default from gen_random_uuid() to
--     uuid_generate_v7() — the last remaining UUID v4 default
--   - Does NOT recreate or drop either table
--   - Does NOT modify any existing row data
--
-- Pre-flight check (run before applying — must return 0 rows):
--   SELECT viewname, definition
--   FROM pg_views
--   WHERE definition ILIKE '%campuses%'
--      OR definition ILIKE '%colleges%';
--
-- Prerequisites:
--   - 012_uuid_v7_function.sql must have been run (uuid_generate_v7
--     must exist)
--   - Tables colleges and campuses must already exist in the DB
--     (bootstrapped by db.js ensureTables())
--
-- Safe to run:
--   - All statements use IF NOT EXISTS or SET DEFAULT — fully
--     idempotent, safe to run more than once
--   - Wrapped in a transaction — rolls back cleanly on any failure
--   - Existing data, constraints, and foreign keys are preserved
--
-- After this migration is verified:
--   - Remove the colleges and campuses CREATE TABLE blocks from
--     db.js ensureTables() along with their associated ALTERs
--   - See cleanup instructions at the bottom of this file
-- ============================================================

BEGIN;

-- ── 1. campuses: ensure ALTER-applied columns exist ───────────
-- These were added via ALTER in db.js after the original CREATE.
-- ADD COLUMN IF NOT EXISTS is a no-op if the column already exists.

ALTER TABLE campuses ADD COLUMN IF NOT EXISTS state        TEXT;
ALTER TABLE campuses ADD COLUMN IF NOT EXISTS location_url TEXT;

-- ── 2. campuses: ensure indexes exist ────────────────────────
-- Matches the three indexes defined in db.js.

CREATE INDEX IF NOT EXISTS idx_campuses_college ON campuses(college_id);
CREATE INDEX IF NOT EXISTS idx_campuses_city    ON campuses(city);
CREATE INDEX IF NOT EXISTS idx_campuses_status  ON campuses(status);

-- ── 3. communities: ensure campus_id FK column exists ─────────
-- Added via ALTER in db.js. Already present per pre-run check
-- but written as IF NOT EXISTS so this migration stays idempotent.

ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES campuses(id);

-- ── 4. campuses: upgrade UUID default to v7 ───────────────────
-- This is the primary reason this migration exists.
-- Requires 012_uuid_v7_function.sql to have been run first.

ALTER TABLE campuses
  ALTER COLUMN id SET DEFAULT uuid_generate_v7();

COMMIT;


-- ============================================================
-- POST-MIGRATION: db.js cleanup instructions
-- ============================================================
-- After verifying this migration ran cleanly, remove the
-- following blocks from db.js ensureTables():
--
-- 1. The entire colleges CREATE TABLE block (lines 1210-1220)
-- 2. The entire campuses CREATE TABLE block (lines 1222-1277)
--    including:
--      - The two ALTER TABLE campuses ADD COLUMN statements
--        (state, location_url)
--      - The three CREATE INDEX statements
--      - The ALTER TABLE communities ADD COLUMN campus_id statement
--
-- Do NOT remove any application logic that reads/writes these
-- tables — only the schema definition blocks.
--
-- Verification query — run after migration and after db.js cleanup
-- to confirm the app still boots and the schema is intact:
--
--   SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'campuses'
--   ORDER BY ordinal_position;
--
-- Expected: id column_default should be uuid_generate_v7()
--           state and location_url columns should be present
-- ============================================================
