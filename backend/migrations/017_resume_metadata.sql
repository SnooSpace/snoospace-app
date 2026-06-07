-- ============================================
-- MIGRATION 017: Resume Metadata Columns
-- Adds original filename and file size to opportunity_applications
-- so the hirer can see the filename without decoding the Cloudinary URL
-- ============================================

ALTER TABLE opportunity_applications
  ADD COLUMN IF NOT EXISTS resume_filename TEXT,
  ADD COLUMN IF NOT EXISTS resume_size_bytes INTEGER;

-- Verification
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'opportunity_applications'
--   AND column_name IN ('resume_url', 'resume_filename', 'resume_size_bytes')
-- ORDER BY ordinal_position;
