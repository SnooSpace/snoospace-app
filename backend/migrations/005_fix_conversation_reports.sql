-- ============================================================
-- Migration 005b: Fix conversation_reports constraints only
-- Drops old CHECK constraints and recreates them correctly,
-- makes reported_user columns nullable, adds admin columns.
-- ============================================================

-- 1. Make reported_user columns optional
ALTER TABLE conversation_reports
  ALTER COLUMN reported_user_id   DROP NOT NULL,
  ALTER COLUMN reported_user_type DROP NOT NULL;

-- 2. Fix reason CHECK constraint
ALTER TABLE conversation_reports DROP CONSTRAINT IF EXISTS conversation_reports_reason_check;
ALTER TABLE conversation_reports
  ADD CONSTRAINT conversation_reports_reason_check
  CHECK (reason IN (
    'spam',
    'harassment',
    'hate_speech',
    'threats',
    'inappropriate_content',
    'other'
  ));

-- 3. Fix status CHECK constraint
ALTER TABLE conversation_reports DROP CONSTRAINT IF EXISTS conversation_reports_status_check;
ALTER TABLE conversation_reports
  ADD CONSTRAINT conversation_reports_status_check
  CHECK (status IN ('pending', 'resolved', 'dismissed'));

-- 4. Add admin resolution columns (idempotent)
ALTER TABLE conversation_reports
  ADD COLUMN IF NOT EXISTS resolved_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by    TEXT,
  ADD COLUMN IF NOT EXISTS resolution_note TEXT;

-- Rename admin_note → resolution_note if still on old name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversation_reports' AND column_name = 'admin_note'
  ) THEN
    ALTER TABLE conversation_reports RENAME COLUMN admin_note TO resolution_note;
  END IF;
END $$;

-- Rename reviewed_at → resolved_at if still on old name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversation_reports' AND column_name = 'reviewed_at'
  ) THEN
    ALTER TABLE conversation_reports RENAME COLUMN reviewed_at TO resolved_at;
  END IF;
END $$;

-- 5. Recreate unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_conv_reports_unique
  ON conversation_reports(conversation_id, reporter_id, reporter_type);
