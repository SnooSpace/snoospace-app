-- Migration: Fix poll_votes unique constraint for multiple selection support
-- This allows users to vote for multiple options in polls with allow_multiple=true

BEGIN;

-- Drop the old constraint that prevented multiple votes per user
ALTER TABLE poll_votes 
DROP CONSTRAINT IF EXISTS unique_poll_vote;

-- Add new constraint that allows multiple votes but prevents duplicate votes for same option
ALTER TABLE poll_votes 
ADD CONSTRAINT unique_poll_vote UNIQUE(post_id, voter_id, voter_type, option_index);

COMMIT;
