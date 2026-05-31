-- ============================================================
-- 014_fix_branches_serial.sql
-- Fix SERIAL (32-bit integer) overflow risk in branches table
--
-- Context:
--   branches table in scripts/community_restructure_migration.sql
--   was defined with SERIAL PRIMARY KEY — flagged during the UUID v7
--   upgrade audit (UUID_V7_UPGRADE.md). Was missed in the original
--   SERIAL audit (SERIAL_AUDIT.md) because it lives in scripts/,
--   not migrations/.
--
-- Safe to run:
--   - ALTER COLUMN id TYPE BIGINT is a metadata-only change in
--     PostgreSQL when the column is already integer — no table
--     rewrite required.
--   - Existing data, sequences, indexes, and foreign keys are
--     preserved.
--   - The underlying sequence is NOT changed (already BIGINT-range
--     capable); only the column storage type is widened.
--   - Wrapped in a transaction — rolls back cleanly if anything
--     blocks the ALTER.
--
-- Pre-flight check (run before applying — must return 0 rows):
--   SELECT viewname, definition
--   FROM pg_views
--   WHERE definition ILIKE '%branches%';
--
-- FK check (run before applying — share results if any rows returned):
--   SELECT
--     tc.table_name,
--     kcu.column_name,
--     ccu.table_name AS referenced_table
--   FROM information_schema.table_constraints tc
--   JOIN information_schema.key_column_usage kcu
--     ON tc.constraint_name = kcu.constraint_name
--   JOIN information_schema.constraint_column_usage ccu
--     ON tc.constraint_name = ccu.constraint_name
--   WHERE tc.constraint_type = 'FOREIGN KEY'
--     AND ccu.table_name = 'branches';
--
--   If this returns rows, any INTEGER FK columns referencing branches(id)
--   must also be widened to BIGINT here before running — same pattern
--   as event_comments.parent_id in 011_fix_serial_overflow.sql.
--
-- Do NOT run until reviewed.
-- ============================================================

BEGIN;

-- branches (originally: id SERIAL PRIMARY KEY)
ALTER TABLE branches ALTER COLUMN id TYPE BIGINT;

COMMIT;
