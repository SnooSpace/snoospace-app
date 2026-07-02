-- ============================================================
-- MIGRATION 041: Extend reports table for Open Plans + uniqueness
-- ============================================================
-- 1. Add 'open_plan' to the allowed reported_type values
-- 2. Add unique constraint so a user can only report the same content once

-- Drop old check constraint (if it exists on reported_type)
ALTER TABLE reports
  DROP CONSTRAINT IF EXISTS reports_reported_type_check;

-- Re-add with open_plan included
ALTER TABLE reports
  ADD CONSTRAINT reports_reported_type_check
  CHECK (reported_type IN ('post', 'comment', 'member', 'community', 'event', 'open_plan'));

-- Unique constraint: one report per reporter per target (prevents spam/duplicates)
-- Scoped to (reporter_id, reporter_type, reported_id, reported_type)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_unique_per_reporter
  ON reports (reporter_id, reporter_type, reported_id, reported_type);

-- Index for fast admin querying by type
CREATE INDEX IF NOT EXISTS idx_reports_reported_type
  ON reports (reported_type, status, created_at DESC);
