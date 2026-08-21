-- Migration 066: Ignored-View Retirement -- add counter to post_impression_state
--
-- Adds ignored_view_count to track how many times a user has received and
-- watched (>=2s qualified view) a post without any engagement (like, comment,
-- save, or share).  At 3 ignored qualified views, the post is retired for that
-- user (retired_at = NOW()) using the same 15-day exclusion window already in
-- getFeed's NOT EXISTS clause (postController.js L849-856).
--
-- Only post_impression_state is modified; event_impression_state and
-- opportunity_impression_state are explicitly out of scope per spec.

ALTER TABLE post_impression_state
  ADD COLUMN IF NOT EXISTS ignored_view_count INTEGER DEFAULT 0;
