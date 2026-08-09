-- Migration 060: Lifecycle System Phase 1 - Schema Addition
-- Adds post_impression_state and unfollow_events tables.

CREATE TABLE IF NOT EXISTS post_impression_state (
  user_id BIGINT NOT NULL,
  user_type VARCHAR(20) NOT NULL,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  unseen_count INT DEFAULT 0,
  last_session_id UUID,
  retired_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, user_type, post_id)
);

CREATE INDEX IF NOT EXISTS idx_post_impression_retired
  ON post_impression_state(user_id, user_type, post_id)
  WHERE retired_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS unfollow_events (
  id BIGSERIAL PRIMARY KEY,
  follower_id BIGINT NOT NULL,
  follower_type VARCHAR(20) NOT NULL,
  target_id BIGINT NOT NULL,
  target_type VARCHAR(20) NOT NULL,
  unfollowed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
