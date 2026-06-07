-- Migration 018: Migrate resume storage from Cloudinary to Supabase Storage
--
-- The 'resumes' bucket is private (public = false).
-- Files are NOT accessible via public CDN URL.
-- Access is only possible via signed URLs generated server-side (1-hour TTL).
--
-- MANUAL ALTERNATIVE: If this INSERT fails due to permissions,
-- create the bucket in the Supabase Dashboard instead:
--   Storage → New Bucket → Name: resumes → Public: OFF → Create
-- Then only run the COMMENT ON COLUMN statement below.

INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- Document the new value format on the column so future devs understand it.
-- New rows:  storagePath only, e.g. "resume_51_1718000000000.pdf"
-- Old rows:  full Cloudinary https:// URL — treated as stale, trigger re-upload prompt.
COMMENT ON COLUMN opportunity_applications.resume_url IS
  'Supabase Storage path (e.g. resume_51_1718000000000.pdf). '
  'Legacy rows may contain a full Cloudinary https:// URL — '
  'those are treated as stale and trigger a re-upload prompt.';
