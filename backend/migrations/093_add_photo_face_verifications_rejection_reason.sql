-- ==============================================================================
-- 093_add_photo_face_verifications_rejection_reason.sql
-- Add rejection_reason column to photo_face_verifications table to track
-- why a photo failed face eligibility (multiple_faces, no_face, etc.).
-- ==============================================================================

ALTER TABLE photo_face_verifications
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL;
