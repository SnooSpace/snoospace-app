-- ── Migration 098: Post Community Votes (Upvote / Downvote) ──────────────
-- Adds support for Reddit-style community voting (upvote and downvote) on posts.
-- Keeps post_likes intact for standard double-tap/heart engagement.

DO $$ BEGIN
  ALTER TABLE posts ADD COLUMN IF NOT EXISTS community_vote_score INTEGER NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE posts ADD COLUMN IF NOT EXISTS community_upvote_count INTEGER NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE posts ADD COLUMN IF NOT EXISTS community_downvote_count INTEGER NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS post_community_votes (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  user_type VARCHAR(20) NOT NULL DEFAULT 'member',
  vote_type SMALLINT NOT NULL CHECK (vote_type IN (-1, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_post_user_vote UNIQUE (post_id, user_id, user_type)
);

CREATE INDEX IF NOT EXISTS idx_post_community_votes_post ON post_community_votes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_community_votes_user ON post_community_votes(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_posts_community_vote_score ON posts(community_vote_score DESC);
