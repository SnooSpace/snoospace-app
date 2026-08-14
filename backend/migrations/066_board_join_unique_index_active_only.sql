-- Migration 066: Fix Board Join Unique Index to Active Only
--
-- Relaxes uq_board_join_per_requester so that it only constrains active
-- (pending, accepted) join-requests. This ensures that when an applicant
-- withdraws a request, they are not permanently locked out from applying again.

DROP INDEX IF EXISTS uq_board_join_per_requester;

CREATE UNIQUE INDEX IF NOT EXISTS uq_board_join_per_requester
  ON collab_requests (board_post_id, sender_id, sender_type)
  WHERE board_post_id IS NOT NULL AND status IN ('pending', 'accepted');
