-- Migration 020: Plan Interests (bookmarks) table
-- Users can "save" an open plan without requesting to join

CREATE TABLE IF NOT EXISTS open_plan_interests (
  plan_id   INTEGER NOT NULL REFERENCES open_plans(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES members(id)    ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (plan_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_open_plan_interests_user ON open_plan_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_open_plan_interests_plan ON open_plan_interests(plan_id);
