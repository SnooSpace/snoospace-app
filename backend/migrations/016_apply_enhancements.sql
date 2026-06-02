-- ============================================
-- MIGRATION 016: Application Enhancements
-- Adds richer fields to opportunity_applications
-- and an optional requires_resume flag to opportunities
-- ============================================

-- Add new applicant-side fields to opportunity_applications
ALTER TABLE opportunity_applications
  ADD COLUMN IF NOT EXISTS intro_pitch TEXT,
  ADD COLUMN IF NOT EXISTS portfolio_links TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS resume_url TEXT,
  ADD COLUMN IF NOT EXISTS applicant_questions TEXT[] DEFAULT '{}';

-- Rename old single-link column to legacy (keep for backward compat)
-- We don't drop portfolio_link — keep it for old records
-- New records will use portfolio_links[] instead

-- Add requires_resume flag to opportunities (creator can toggle this)
-- Defaults to false so all existing opportunities are unaffected
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS requires_resume BOOLEAN DEFAULT false;

-- Verification
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'opportunity_applications'
-- ORDER BY ordinal_position;
