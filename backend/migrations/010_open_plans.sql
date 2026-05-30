-- ============================================================
-- SNOOSPACE — OPEN PLANS FEATURE MIGRATION
-- ============================================================
-- Verified against codebase (2026-05-30):
--   - "profiles"          → members           (users/people table)
--   - "communities"       → communities       (confirmed correct)
--   - "community_members" → follows           (no junction table; membership is
--                           follower_type='member' / following_type='community')
--   - "posts"             → posts             (confirmed; FK col is author_id + author_type,
--                           NOT user_id — handled in proof-gate function below)
--   - IDs                 → BIGINT (not UUID); all FKs use BIGINT
--   - gender values       → 'Male','Female','Non-binary' (matches members.gender CHECK)
-- ============================================================


-- ============================================================
-- 1. MODIFY EXISTING: members
-- ============================================================
-- Note: members.gender already exists as TEXT; we ADD the CHECK constraint
-- only if it does not already have one. The safest approach on Supabase/PG
-- is to add the columns that are genuinely new.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- gender already exists on members (signup uses 'Male','Female','Non-binary').
-- We do NOT add it again, but the open_plans gender_preference CHECK below
-- is aligned with these values.


-- ============================================================
-- 2. CORE FEATURE: open_plans
-- ============================================================

CREATE TABLE IF NOT EXISTS open_plans (
  id                    BIGSERIAL   PRIMARY KEY,
  created_by            BIGINT      NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  -- Activity
  title                 TEXT        NOT NULL,
  activity_type         TEXT        NOT NULL
    CHECK (activity_type IN ('sports', 'study', 'food', 'gaming', 'other')),
  custom_activity_label TEXT,                      -- max 25 chars, used when type = 'other'

  -- Cost
  cost_type             TEXT        NOT NULL DEFAULT 'free'
    CHECK (cost_type IN ('free', 'self_pay', 'split', 'entry_fee')),
  cost_amount_paise     INTEGER,                   -- optional; used for 'entry_fee' or 'split'

  -- Visibility & preferences
  -- 'community_members': visible to users sharing any community (via follows) with host
  -- 'everyone':          visible to all SnooSpace members
  visibility            TEXT        NOT NULL DEFAULT 'community_members'
    CHECK (visibility IN ('community_members', 'everyone')),
  -- Optional: narrow community_members visibility to one specific community
  scoped_community_id   BIGINT      REFERENCES communities(id) ON DELETE SET NULL,
  -- Matches members.gender values: 'Male', 'Female', 'Non-binary'
  gender_preference     TEXT        NOT NULL DEFAULT 'all'
    CHECK (gender_preference IN ('all', 'Female', 'Male', 'Non-binary')),

  -- Locations
  location_public       TEXT,                      -- vague area shown to all viewers
  location_private      TEXT,                      -- exact point revealed only after approval

  -- Timing
  scheduled_at          TIMESTAMPTZ NOT NULL,
  expires_at            TIMESTAMPTZ NOT NULL,      -- default: set to scheduled_at + 1 hour in API

  -- Capacity (acceptances are capped; requests are unlimited)
  max_accepted          INTEGER     NOT NULL DEFAULT 5,

  -- Recurrence
  is_recurring          BOOLEAN     NOT NULL DEFAULT FALSE,
  recurrence_interval   TEXT        CHECK (recurrence_interval IN ('weekly')),
  parent_plan_id        BIGINT      REFERENCES open_plans(id) ON DELETE SET NULL,

  -- Status
  -- active:    accepting requests, host can approve/decline
  -- closed:    host has stopped new requests
  -- cancelled: host cancelled before scheduled time
  -- completed: auto-set by cron after expires_at passes
  status                TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'closed', 'cancelled', 'completed')),

  -- Engagement counts — denormalized, kept in sync by triggers below
  view_count            INTEGER     NOT NULL DEFAULT 0,
  like_count            INTEGER     NOT NULL DEFAULT 0,
  comment_count         INTEGER     NOT NULL DEFAULT 0,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 3. CORE FEATURE: open_plan_requests
-- ============================================================
-- Requests are unlimited regardless of max_accepted.
-- Acceptance cap is enforced in the API when host tries to approve.
-- status flow:
--   pending   → approved (host approves)  → DM thread unlocked + private location revealed
--   pending   → declined (host declines)
--   pending   → withdrawn (requester cancels before response)
--   approved  → removed (host removes approved attendee)

CREATE TABLE IF NOT EXISTS open_plan_requests (
  id            BIGSERIAL   PRIMARY KEY,
  plan_id       BIGINT      NOT NULL REFERENCES open_plans(id) ON DELETE CASCADE,
  requester_id  BIGINT      NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined', 'withdrawn', 'removed')),
  note          TEXT,                              -- optional message from requester to host
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at  TIMESTAMPTZ,                       -- set when host approves or declines
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (plan_id, requester_id)                  -- one request per member per plan
);


-- ============================================================
-- 4. ENGAGEMENT: likes, comments, views
-- ============================================================

CREATE TABLE IF NOT EXISTS open_plan_likes (
  id         BIGSERIAL   PRIMARY KEY,
  plan_id    BIGINT      NOT NULL REFERENCES open_plans(id) ON DELETE CASCADE,
  user_id    BIGINT      NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (plan_id, user_id)
);

CREATE TABLE IF NOT EXISTS open_plan_comments (
  id         BIGSERIAL   PRIMARY KEY,
  plan_id    BIGINT      NOT NULL REFERENCES open_plans(id) ON DELETE CASCADE,
  user_id    BIGINT      NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  is_deleted BOOLEAN     NOT NULL DEFAULT FALSE,  -- soft delete; content replaced with null on FE
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS open_plan_views (
  id         BIGSERIAL   PRIMARY KEY,
  plan_id    BIGINT      NOT NULL REFERENCES open_plans(id) ON DELETE CASCADE,
  viewer_id  BIGINT      REFERENCES members(id) ON DELETE SET NULL,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (plan_id, viewer_id)                     -- unique views only; upsert on conflict
);


-- ============================================================
-- 5. TRUST & SAFETY: blocks, social connections, verifications
-- ============================================================

CREATE TABLE IF NOT EXISTS user_blocks (
  id         BIGSERIAL   PRIMARY KEY,
  blocker_id BIGINT      NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  blocked_id BIGINT      NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (blocker_id, blocked_id),
  CHECK  (blocker_id != blocked_id)
);

-- Stores OAuth connections to external platforms (Instagram first)
-- IMPORTANT: encrypt access_token before storing in production
CREATE TABLE IF NOT EXISTS user_social_connections (
  id                 BIGSERIAL   PRIMARY KEY,
  user_id            BIGINT      NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  platform           TEXT        NOT NULL CHECK (platform IN ('instagram')),
  platform_user_id   TEXT        NOT NULL,
  platform_username  TEXT,
  access_token       TEXT,                         -- store encrypted; retrieve for API calls
  connected_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active          BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, platform)
);

-- Admin-reviewed video verification requests
CREATE TABLE IF NOT EXISTS user_verifications (
  id                  BIGSERIAL   PRIMARY KEY,
  user_id             BIGINT      NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  type                TEXT        NOT NULL DEFAULT 'video' CHECK (type IN ('video')),
  status              TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  video_storage_path  TEXT        NOT NULL,        -- path in Supabase storage bucket
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at         TIMESTAMPTZ,
  reviewed_by         BIGINT      REFERENCES members(id) ON DELETE SET NULL,
  rejection_reason    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 6. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_open_plans_created_by         ON open_plans (created_by);
CREATE INDEX IF NOT EXISTS idx_open_plans_status_scheduled   ON open_plans (status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_open_plans_visibility         ON open_plans (visibility);
CREATE INDEX IF NOT EXISTS idx_open_plans_gender             ON open_plans (gender_preference);
CREATE INDEX IF NOT EXISTS idx_open_plans_scoped_community   ON open_plans (scoped_community_id) WHERE scoped_community_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_opr_plan_status               ON open_plan_requests (plan_id, status);
CREATE INDEX IF NOT EXISTS idx_opr_requester_status          ON open_plan_requests (requester_id, status);

CREATE INDEX IF NOT EXISTS idx_opl_plan                      ON open_plan_likes (plan_id);
CREATE INDEX IF NOT EXISTS idx_opc_plan                      ON open_plan_comments (plan_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_opv_plan                      ON open_plan_views (plan_id);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker           ON user_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked           ON user_blocks (blocked_id);
CREATE INDEX IF NOT EXISTS idx_user_social_user              ON user_social_connections (user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_verifications_user       ON user_verifications (user_id, status);


-- ============================================================
-- 7. TRIGGERS — updated_at
-- ============================================================

-- Reuse existing update_updated_at() if it exists, or create it:
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_open_plans_updated_at
  BEFORE UPDATE ON open_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_opr_updated_at
  BEFORE UPDATE ON open_plan_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_opc_updated_at
  BEFORE UPDATE ON open_plan_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 8. TRIGGERS — engagement count sync on open_plans
-- ============================================================

-- like_count
CREATE OR REPLACE FUNCTION sync_plan_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE open_plans SET like_count = like_count + 1 WHERE id = NEW.plan_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE open_plans SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.plan_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_like_count
  AFTER INSERT OR DELETE ON open_plan_likes
  FOR EACH ROW EXECUTE FUNCTION sync_plan_like_count();

-- comment_count (increments on INSERT; decrements on soft-delete)
CREATE OR REPLACE FUNCTION sync_plan_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE open_plans SET comment_count = comment_count + 1 WHERE id = NEW.plan_id;
  ELSIF TG_OP = 'UPDATE'
    AND NEW.is_deleted = TRUE
    AND OLD.is_deleted = FALSE THEN
    UPDATE open_plans SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = NEW.plan_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_comment_count
  AFTER INSERT OR UPDATE ON open_plan_comments
  FOR EACH ROW EXECUTE FUNCTION sync_plan_comment_count();

-- view_count (only on INSERT since open_plan_views uses UNIQUE + upsert)
CREATE OR REPLACE FUNCTION sync_plan_view_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE open_plans SET view_count = view_count + 1 WHERE id = NEW.plan_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_view_count
  AFTER INSERT ON open_plan_views
  FOR EACH ROW EXECUTE FUNCTION sync_plan_view_count();

-- Auto-approve: update members.is_verified when a verification is approved
CREATE OR REPLACE FUNCTION sync_verification_badge()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    UPDATE members
    SET is_verified = TRUE, verified_at = NOW()
    WHERE id = NEW.user_id;
  ELSIF NEW.status = 'rejected' AND OLD.status = 'approved' THEN
    -- Revoke badge if re-reviewed and rejected (edge case)
    UPDATE members
    SET is_verified = FALSE, verified_at = NULL
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_verification_badge
  AFTER UPDATE ON user_verifications
  FOR EACH ROW EXECUTE FUNCTION sync_verification_badge();


-- ============================================================
-- 9. HELPER FUNCTIONS
-- ============================================================

-- Returns TRUE if a member qualifies to host or request plans.
-- Gate: has at least 1 post (author_id match), OR an active social connection,
-- OR is verified.
CREATE OR REPLACE FUNCTION member_meets_proof_gate(p_member_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
  has_post    BOOLEAN;
  has_social  BOOLEAN;
  v_verified  BOOLEAN;
BEGIN
  -- posts table uses author_id + author_type (not user_id)
  SELECT EXISTS(
    SELECT 1 FROM posts
    WHERE author_id = p_member_id AND author_type = 'member'
    LIMIT 1
  ) INTO has_post;

  SELECT EXISTS(
    SELECT 1 FROM user_social_connections
    WHERE user_id = p_member_id AND is_active = TRUE LIMIT 1
  ) INTO has_social;

  SELECT is_verified FROM members WHERE id = p_member_id INTO v_verified;

  RETURN COALESCE(has_post, FALSE)
      OR COALESCE(has_social, FALSE)
      OR COALESCE(v_verified, FALSE);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Returns TRUE if member_a and member_b both follow the same community.
-- Uses the follows table with following_type = 'community'.
CREATE OR REPLACE FUNCTION members_share_community(member_a BIGINT, member_b BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM follows f1
    JOIN follows f2
      ON f1.following_id   = f2.following_id
     AND f1.following_type = 'community'
     AND f2.following_type = 'community'
    WHERE f1.follower_id   = member_a
      AND f1.follower_type = 'member'
      AND f2.follower_id   = member_b
      AND f2.follower_type = 'member'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Returns TRUE if either member has blocked the other.
CREATE OR REPLACE FUNCTION members_are_blocked(member_a BIGINT, member_b BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_blocks
    WHERE (blocker_id = member_a AND blocked_id = member_b)
       OR (blocker_id = member_b AND blocked_id = member_a)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Called by cron to expire plans past their scheduled time.
-- Schedule via pg_cron or an HTTP cron hitting a backend route every 15 min.
CREATE OR REPLACE FUNCTION expire_open_plans()
RETURNS void AS $$
BEGIN
  UPDATE open_plans
  SET status = 'completed'
  WHERE status = 'active'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Called by cron to generate the next recurring plan instance.
-- Copies the parent plan with scheduled_at and expires_at += 7 days.
CREATE OR REPLACE FUNCTION generate_recurring_plans()
RETURNS void AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM open_plans
    WHERE is_recurring = TRUE
      AND recurrence_interval = 'weekly'
      AND status = 'completed'
      -- Only generate if no future instance already exists
      AND NOT EXISTS (
        SELECT 1 FROM open_plans child
        WHERE child.parent_plan_id = open_plans.id
          AND child.scheduled_at > NOW()
      )
  LOOP
    INSERT INTO open_plans (
      created_by, title, activity_type, custom_activity_label,
      cost_type, cost_amount_paise, visibility, scoped_community_id,
      gender_preference, location_public, location_private,
      scheduled_at, expires_at, max_accepted,
      is_recurring, recurrence_interval, parent_plan_id, status
    ) VALUES (
      r.created_by, r.title, r.activity_type, r.custom_activity_label,
      r.cost_type, r.cost_amount_paise, r.visibility, r.scoped_community_id,
      r.gender_preference, r.location_public, r.location_private,
      r.scheduled_at + INTERVAL '7 days',
      r.expires_at  + INTERVAL '7 days',
      r.max_accepted,
      TRUE, 'weekly', r.id, 'active'
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- NOTE ON RLS
-- ============================================================
-- This app uses a direct PostgreSQL pool (not Supabase auth.uid() RLS).
-- Access control is enforced at the API/controller layer.
-- Do NOT enable RLS on these tables unless you migrate to Supabase Auth
-- for this feature. The RLS policies from the original spec are omitted
-- to match the existing codebase pattern.
-- ============================================================


-- ============================================================
-- END OF MIGRATION
-- ============================================================
