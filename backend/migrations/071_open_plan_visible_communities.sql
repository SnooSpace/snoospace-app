-- Migration 071: Multi-community visibility for open plans
-- Replaces single scoped_community_id column with a join table supporting
-- multi-community targeting.
--
-- Pre-condition confirmed: scoped_community_id has 0 non-NULL rows in production.
-- The INSERT is defensive backfill only — expected to copy 0 rows.

-- 1. Create the join table
CREATE TABLE open_plan_visible_communities (
  plan_id      BIGINT NOT NULL REFERENCES open_plans(id) ON DELETE CASCADE,
  community_id BIGINT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, community_id)
);

-- Index for efficient per-plan lookups (plan_id → set of community_ids)
CREATE INDEX idx_opvc_plan_id ON open_plan_visible_communities (plan_id);
-- Index for efficient per-community lookups (community_id → set of plan_ids)
CREATE INDEX idx_opvc_community_id ON open_plan_visible_communities (community_id);

-- 2. Defensive backfill from legacy single-column (expected: 0 rows)
INSERT INTO open_plan_visible_communities (plan_id, community_id)
  SELECT id, scoped_community_id
    FROM open_plans
   WHERE scoped_community_id IS NOT NULL;

-- 3. Drop the now-superseded column
ALTER TABLE open_plans DROP COLUMN scoped_community_id;
