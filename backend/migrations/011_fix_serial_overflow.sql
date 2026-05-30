-- ============================================================
-- 011_fix_serial_overflow.sql
-- Fix SERIAL (32-bit integer) overflow risk in event engagement tables
--
-- Context:
--   event_engagement.sql defined 4 tables with SERIAL PRIMARY KEY.
--   SERIAL is backed by integer (max 2,147,483,647). At scale, high-volume
--   tables like event_likes and event_views can exhaust this limit.
--   This migration converts those id columns to BIGINT, matching the
--   BIGSERIAL standard used across the rest of the SnooSpace schema.
--
-- Safe to run:
--   - ALTER COLUMN id TYPE BIGINT is a metadata-only change in PostgreSQL
--     when the column is already integer — no table rewrite required.
--   - Existing data, sequences, indexes, and foreign keys are preserved.
--   - The underlying sequence is NOT changed (it was already BIGINT-range
--     capable); only the column storage type is widened.
--   - The entire migration is wrapped in a transaction. If any statement
--     fails (e.g. a view or generated column blocks an ALTER), the whole
--     block rolls back cleanly — no half-widened state.
--
-- Pre-flight check (run this before applying — must return 0 rows):
--   SELECT viewname, definition
--   FROM pg_views
--   WHERE definition ILIKE '%event_likes%'
--      OR definition ILIKE '%event_views%'
--      OR definition ILIKE '%event_comments%'
--      OR definition ILIKE '%event_comment_likes%';
--
-- Do NOT run until reviewed. See SERIAL_AUDIT.md for full audit details.
-- ============================================================

BEGIN;

-- 1. event_likes  (originally: id SERIAL PRIMARY KEY)
ALTER TABLE event_likes ALTER COLUMN id TYPE BIGINT;

-- 2. event_views  (originally: id SERIAL PRIMARY KEY)
ALTER TABLE event_views ALTER COLUMN id TYPE BIGINT;

-- 3. event_comments  (originally: id SERIAL PRIMARY KEY)
--    Note: event_comments.parent_id also references this column.
--    parent_id is defined as INTEGER — widen it too for FK consistency.
ALTER TABLE event_comments ALTER COLUMN id TYPE BIGINT;
ALTER TABLE event_comments ALTER COLUMN parent_id TYPE BIGINT;

-- 4. event_comment_likes  (originally: id SERIAL PRIMARY KEY)
--    Note: event_comment_likes.comment_id references event_comments(id).
--    Widen it for FK consistency.
ALTER TABLE event_comment_likes ALTER COLUMN id TYPE BIGINT;
ALTER TABLE event_comment_likes ALTER COLUMN comment_id TYPE BIGINT;

COMMIT;
