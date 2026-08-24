-- ==============================================================================
-- 074_feed_query_indexes.sql
-- Home Feed Performance Optimization Indexes
-- ==============================================================================
-- ORIGIN & CONTEXT:
--   Identified during an EXPLAIN ANALYZE performance audit of the Home Feed query
--   in `backend/controllers/postController.js` (`getFeed`, lines 635–996).
--
-- REASONS & RESOLVED SUBPLANS:
--
-- 1. idx_follows_follower_lookup ON follows (follower_id, follower_type)
--    Resolves sequential scans on `follows` across 3 distinct subqueries:
--    - SubPlan 15: Primary feed inclusion check (evaluated per post candidate)
--    - SubPlan 4:  Per-row `is_following` boolean calculation in SELECT projection
--    - SubPlan 14 / SubPlan 45: `is_backlog_post` retroactive engagement check
--    (Existing composite unique index leads with all 4 columns; a dedicated 2-column
--    lookup index allows direct B-tree index scans for viewer follow graph lookups).
--
-- 2. idx_post_likes_liker_lookup ON post_likes (liker_id, liker_type)
--    Resolves sequential scans on `post_likes` across 3 distinct subqueries:
--    - SubPlan 40: Untimed liked post exclusion (WHERE clause)
--    - SubPlan 42: Backlog liked post exclusion (WHERE clause)
--    - SubPlan 2:  Per-row `is_liked` boolean calculation in SELECT projection
--    (Existing unique index leads with `post_id`, rendering viewer-centric lookups
--    incapable of using an index and forcing full table scans).
--
-- 3. idx_post_comments_commenter_lookup ON post_comments (commenter_id, commenter_type)
--    Resolves sequential scan on `post_comments`:
--    - SubPlan 44: Backlog commented post exclusion (WHERE clause)
--    (Only primary key `id` previously existed on `post_comments`).
--
-- 4. idx_posts_created_at_id_sort ON posts (created_at DESC, id DESC)
--    Supports reverse-chronological cursor pagination and base sort order:
--    - Primary `ORDER BY effective_sort_time DESC, p.id DESC` / compound cursor
--    (Reduces sort cost and avoids full in-memory quicksort of candidate sets).
--
-- EXECUTION NOTES (CONCURRENTLY CONSTRAINT):
--   `CREATE INDEX CONCURRENTLY` cannot execute inside a transaction block
--   (no `BEGIN ... COMMIT` or `DO $$`). Statements must be run individually
--   in autocommit mode or via Supabase SQL editor / standalone runner script.
-- ==============================================================================

-- 1. Follows: Viewer follow-graph lookups (feed inclusion & flags)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_follower_lookup 
  ON follows (follower_id, follower_type);

-- 2. Post Likes: Viewer liked-posts lookups (exclusions & flags)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_likes_liker_lookup 
  ON post_likes (liker_id, liker_type);

-- 3. Post Comments: Viewer comment lookups (backlog exclusion)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_comments_commenter_lookup 
  ON post_comments (commenter_id, commenter_type);

-- 4. Posts: Reverse-chronological feed sorting & compound cursor pagination
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_created_at_id_sort 
  ON posts (created_at DESC, id DESC);
