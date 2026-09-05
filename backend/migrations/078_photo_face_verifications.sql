-- ==============================================================================
-- 078_photo_face_verifications.sql
-- Enable pgvector, create photo_face_verifications table with RLS,
-- and add verified_reference_photos to members.
-- ==============================================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create photo_face_verifications table
CREATE TABLE IF NOT EXISTS photo_face_verifications (
  id              BIGSERIAL PRIMARY KEY,
  member_id       BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  photo_url       TEXT NOT NULL,
  face_eligible   BOOLEAN DEFAULT FALSE,
  face_confidence NUMERIC,
  face_embedding  vector(128),
  checked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, photo_url)
);

-- Index for checking eligibility by member
CREATE INDEX IF NOT EXISTS idx_pfv_member_eligible
  ON photo_face_verifications (member_id, face_eligible);

-- 3. Row Level Security matching members table pattern
ALTER TABLE photo_face_verifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'photo_face_verifications'
      AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON photo_face_verifications
      FOR ALL TO postgres USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. Add verified_reference_photos column to members for future verification approval
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS verified_reference_photos TEXT[] DEFAULT NULL;
