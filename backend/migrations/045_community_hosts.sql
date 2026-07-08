-- ============================================================
-- Migration 045: Multi-Host Community Architecture
--
-- Adds community_hosts junction table so multiple Member accounts
-- can be hosts of the same Community, each with their own role.
-- No backfill: communities have no owner_id column; the Community's
-- own account (type='community') is treated as owner-equivalent by
-- the Express middleware layer (see middleware/communityAuth.js).
-- No RLS: access control is at the Express layer (project convention).
-- ============================================================

-- 1. Junction table: which Members are Hosts of which Communities
CREATE TABLE IF NOT EXISTS community_hosts (
  id           BIGSERIAL    PRIMARY KEY,
  community_id BIGINT       NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id      BIGINT       NOT NULL REFERENCES members(id)     ON DELETE CASCADE,  -- always a Member
  role         TEXT         NOT NULL CHECK (role IN ('owner', 'host', 'moderator')),
  invited_by   BIGINT       REFERENCES members(id) ON DELETE SET NULL,              -- which Member invited them
  status       TEXT         NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'pending', 'revoked')),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (community_id, user_id)
);

-- Enforce exactly one active 'owner' per community at the DB level
-- If the app-layer transaction ever fails mid-way, this index is the last line of defence.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_owner_per_community
  ON community_hosts(community_id)
  WHERE role = 'owner' AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_community_hosts_user
  ON community_hosts(user_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_community_hosts_community
  ON community_hosts(community_id)
  WHERE status = 'active';

-- 2. Audit log: immutable record of every host-management action
CREATE TABLE IF NOT EXISTS community_host_audit_log (
  id             BIGSERIAL    PRIMARY KEY,
  community_id   BIGINT       NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  actor_user_id  BIGINT       NOT NULL REFERENCES members(id)     ON DELETE SET NULL,
  action         TEXT         NOT NULL,  -- 'host_invited' | 'host_removed' | 'role_changed' | 'ownership_transferred'
  target_user_id BIGINT       REFERENCES members(id)              ON DELETE SET NULL,
  metadata       JSONB        DEFAULT '{}',
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_host_audit_community
  ON community_host_audit_log(community_id, created_at DESC);

-- 3. updated_at trigger — reuses update_updated_at() from migration 010
--    If that function doesn't exist yet in the target DB, create it idempotently.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_community_hosts_updated_at
  BEFORE UPDATE ON community_hosts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- NOTE: No backfill INSERT.
-- The communities table has no owner_id / creator_id column — communities
-- are standalone accounts, not created by any specific Member.
-- Host assignment starts fresh from this migration onward.
-- The Community's own JWT (type='community') remains owner-equivalent
-- via the Express middleware layer for bootstrapping.
-- ============================================================
