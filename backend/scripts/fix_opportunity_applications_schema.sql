-- ============================================
-- Fix opportunity_applications schema mismatch
-- The controller uses newer column names that don't
-- match the original migration script.
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Rename applied_skill_group → applied_role
ALTER TABLE opportunity_applications
  RENAME COLUMN applied_skill_group TO applied_role;

-- 2. Make applied_role nullable (controller passes it but old rows had NOT NULL)
ALTER TABLE opportunity_applications
  ALTER COLUMN applied_role DROP NOT NULL;

-- 3. Give applicant_type a default so controller doesn't need to pass it explicitly
ALTER TABLE opportunity_applications
  ALTER COLUMN applicant_type SET DEFAULT 'member';

-- 4. Add portfolio_link column (single legacy link)
ALTER TABLE opportunity_applications
  ADD COLUMN IF NOT EXISTS portfolio_link TEXT;

-- 5. Add portfolio_note column
ALTER TABLE opportunity_applications
  ADD COLUMN IF NOT EXISTS portfolio_note TEXT;

-- 6. Add intro_pitch column
ALTER TABLE opportunity_applications
  ADD COLUMN IF NOT EXISTS intro_pitch TEXT;

-- 7. Add portfolio_links column (array of links)
ALTER TABLE opportunity_applications
  ADD COLUMN IF NOT EXISTS portfolio_links TEXT[] DEFAULT '{}';

-- 8. Add resume_url column
ALTER TABLE opportunity_applications
  ADD COLUMN IF NOT EXISTS resume_url TEXT;

-- 9. Add applicant_questions column (questions asked by applicant to creator)
ALTER TABLE opportunity_applications
  ADD COLUMN IF NOT EXISTS applicant_questions TEXT[] DEFAULT '{}';

-- Verify final schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'opportunity_applications'
ORDER BY ordinal_position;
