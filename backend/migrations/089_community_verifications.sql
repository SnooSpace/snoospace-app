-- ==============================================================================
-- 089_community_verifications.sql
-- Two-tier Community verification schema, badge sync trigger, and storage bucket
-- ==============================================================================

-- 1. Create community_verifications table
CREATE TABLE IF NOT EXISTS community_verifications (
  id BIGSERIAL PRIMARY KEY,
  community_id BIGINT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('community_verified', 'registered_org')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  document_storage_path TEXT,  -- Tier B only, NULL for community_verified
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for status queries and deduplication checks
CREATE INDEX IF NOT EXISTS idx_community_verifications_comm_status
  ON community_verifications (community_id, status);

CREATE INDEX IF NOT EXISTS idx_community_verifications_comm_tier
  ON community_verifications (community_id, tier);

-- 2. Add community_verification_tier column to communities
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS community_verification_tier TEXT NOT NULL DEFAULT 'none'
  CHECK (community_verification_tier IN ('none', 'community_verified', 'registered_org'));

-- 3. Row Level Security matching codebase service_role_all pattern
ALTER TABLE community_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON community_verifications;
CREATE POLICY "service_role_all" ON community_verifications
  AS PERMISSIVE FOR ALL TO postgres USING (true) WITH CHECK (true);

-- 4. Trigger function to synchronize community badge and status
CREATE OR REPLACE FUNCTION sync_community_verification_badge()
RETURNS TRIGGER AS $$
DECLARE
  v_community_id  BIGINT;
  v_max_rank      INT := 0;
  v_new_tier      TEXT := 'none';
  v_new_status    TEXT := 'not_requested';
  v_rec           RECORD;
  v_latest_status TEXT;
BEGIN
  v_community_id := COALESCE(NEW.community_id, OLD.community_id);
  IF v_community_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Compute highest approved tier from ALL currently approved submissions for this community
  FOR v_rec IN
    SELECT tier
    FROM community_verifications
    WHERE community_id = v_community_id AND status = 'approved'
  LOOP
    IF v_rec.tier = 'registered_org' AND 2 > v_max_rank THEN
      v_max_rank := 2;
    ELSIF v_rec.tier = 'community_verified' AND 1 > v_max_rank THEN
      v_max_rank := 1;
    END IF;
  END LOOP;

  -- Map max rank back to tier
  IF v_max_rank = 2 THEN
    v_new_tier := 'registered_org';
  ELSIF v_max_rank = 1 THEN
    v_new_tier := 'community_verified';
  ELSE
    v_new_tier := 'none';
  END IF;

  -- Reconcile verification_status
  IF v_new_tier != 'none' THEN
    -- If any approval exists, overall status is approved regardless of newer submissions
    v_new_status := 'approved';
  ELSE
    -- When no approved tier exists, status reflects the most recent submission
    SELECT status INTO v_latest_status
    FROM community_verifications
    WHERE community_id = v_community_id
    ORDER BY submitted_at DESC, id DESC
    LIMIT 1;

    IF v_latest_status = 'pending' THEN
      v_new_status := 'pending';
    ELSIF v_latest_status = 'rejected' THEN
      v_new_status := 'rejected';
    ELSE
      v_new_status := 'not_requested';
    END IF;
  END IF;

  -- Update the community record
  UPDATE communities
  SET community_verification_tier = v_new_tier,
      verification_status = v_new_status
  WHERE id = v_community_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply security hardening
ALTER FUNCTION public.sync_community_verification_badge() SET search_path = public;

-- Attach trigger for inserts, updates, and deletes
DROP TRIGGER IF EXISTS trg_sync_community_verification_badge ON community_verifications;
CREATE TRIGGER trg_sync_community_verification_badge
  AFTER INSERT OR UPDATE OR DELETE ON community_verifications
  FOR EACH ROW EXECUTE FUNCTION sync_community_verification_badge();

-- 5. Insert dedicated private bucket for community verification documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-verification-docs', 'community-verification-docs', false)
ON CONFLICT (id) DO NOTHING;
