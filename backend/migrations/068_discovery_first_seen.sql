-- Migration 068: Add first_discovered_at to post_impression_state
-- Used for trickle pacing in getDiscoveryPosts:
--   at most 5 genuinely new posts introduced per user per 24h window.
--   Stamped when the frontend first includes a discovery post in feedItems,
--   via ViewQueueService.recordDiscoveryServe() → POST /posts/views/batch (type: 'discovery_serve').
--   Idempotent: COALESCE(existing, NOW()) ensures re-serves never overwrite the original stamp.

ALTER TABLE post_impression_state
  ADD COLUMN IF NOT EXISTS first_discovered_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN post_impression_state.first_discovered_at IS
  'Timestamp when this post was first served to this user via discovery feed. '
  'NULL means never served. Used for trickle pacing: at most 5 new introductions '
  'per user per 24h. Written by ViewQueueService discovery_serve batch event.';
