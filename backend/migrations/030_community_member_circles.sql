-- ============================================================
-- Migration 030: Community-Member Circle System
--
-- Allows a Community to send a circle invite to a Member.
-- A separate system from member↔member circles, since the
-- existing circles table uses members(id) FKs only.
-- ============================================================

-- 1. Pending/historical invites sent by a community to a member
CREATE TABLE IF NOT EXISTS community_member_circle_invites (
  id            BIGSERIAL PRIMARY KEY,
  community_id  BIGINT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  member_id     BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (community_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_circle_invites_member
  ON community_member_circle_invites(member_id, status);

CREATE INDEX IF NOT EXISTS idx_comm_circle_invites_community
  ON community_member_circle_invites(community_id, status);

-- 2. Accepted community-member circle relationships
CREATE TABLE IF NOT EXISTS community_member_circles (
  id            BIGSERIAL PRIMARY KEY,
  community_id  BIGINT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  member_id     BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (community_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_circles_community
  ON community_member_circles(community_id);

CREATE INDEX IF NOT EXISTS idx_comm_circles_member
  ON community_member_circles(member_id);
