-- ============================================
-- Fix opportunity_applications.applicant_id type
-- The column was defined as UUID but members.id is INTEGER
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop the unique constraint first (depends on the column)
ALTER TABLE opportunity_applications
  DROP CONSTRAINT IF EXISTS opportunity_applications_opportunity_id_applicant_id_applic_key;

-- Drop indexes that depend on applicant_id
DROP INDEX IF EXISTS idx_applications_applicant;

-- Change column type from UUID to INTEGER
ALTER TABLE opportunity_applications
  ALTER COLUMN applicant_id TYPE INTEGER USING applicant_id::text::integer;

-- Recreate the unique constraint
ALTER TABLE opportunity_applications
  ADD CONSTRAINT opportunity_applications_opportunity_id_applicant_id_key
  UNIQUE (opportunity_id, applicant_id, applicant_type);

-- Recreate the index
CREATE INDEX IF NOT EXISTS idx_applications_applicant 
  ON opportunity_applications(applicant_id, applicant_type);
