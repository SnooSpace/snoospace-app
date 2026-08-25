-- ==============================================================================
-- 075_add_load_test_marker_columns.sql
-- Add Load-Test Marker Columns & Cleanup Partial Indexes
-- ==============================================================================
-- ORIGIN & CONTEXT:
--   Supports synthetic data generation for high-concurrency load testing (k6)
--   against the Home Feed query and related endpoints.
--   Enables 100% clean, verified teardown without affecting real production rows.
--
-- TARGET TABLES:
--   1. members
--   2. posts
--   3. follows
--   4. post_likes
--   5. post_comments
--
-- PARTIAL INDEXES:
--   Partial indexes with `WHERE is_load_test = true` ensure:
--   - Zero index overhead for regular production queries (is_load_test = false)
--   - Instant lookup and rapid DELETE operations during cleanup
--
-- EXECUTION NOTES (CONCURRENTLY CONSTRAINT):
--   `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block
--   (no `BEGIN ... COMMIT` or `DO $$`). Statements must be run individually
--   in autocommit mode or via Supabase SQL editor / standalone runner script.
-- ==============================================================================

-- 1. Members
ALTER TABLE members 
  ADD COLUMN IF NOT EXISTS is_load_test boolean NOT NULL DEFAULT false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_load_test 
  ON members (is_load_test) 
  WHERE is_load_test = true;

-- 2. Posts
ALTER TABLE posts 
  ADD COLUMN IF NOT EXISTS is_load_test boolean NOT NULL DEFAULT false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_load_test 
  ON posts (is_load_test) 
  WHERE is_load_test = true;

-- 3. Follows
ALTER TABLE follows 
  ADD COLUMN IF NOT EXISTS is_load_test boolean NOT NULL DEFAULT false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_load_test 
  ON follows (is_load_test) 
  WHERE is_load_test = true;

-- 4. Post Likes
ALTER TABLE post_likes 
  ADD COLUMN IF NOT EXISTS is_load_test boolean NOT NULL DEFAULT false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_likes_load_test 
  ON post_likes (is_load_test) 
  WHERE is_load_test = true;

-- 5. Post Comments
ALTER TABLE post_comments 
  ADD COLUMN IF NOT EXISTS is_load_test boolean NOT NULL DEFAULT false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_comments_load_test 
  ON post_comments (is_load_test) 
  WHERE is_load_test = true;
