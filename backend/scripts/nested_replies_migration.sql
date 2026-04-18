-- Nested Replies Migration
-- Adds support for replying to replies (YouTube-style nested threading)

-- =============================================================================
-- Add parent_reply_id for nested replies
-- =============================================================================

-- Add parent_reply_id column (NULL means direct reply to submission)
ALTER TABLE prompt_replies ADD COLUMN IF NOT EXISTS parent_reply_id BIGINT REFERENCES prompt_replies(id) ON DELETE CASCADE;

-- Add reply_count to track nested replies
ALTER TABLE prompt_replies ADD COLUMN IF NOT EXISTS reply_count INT DEFAULT 0;

-- Create index for efficient nested reply lookups
CREATE INDEX IF NOT EXISTS idx_prompt_replies_parent ON prompt_replies(parent_reply_id) WHERE parent_reply_id IS NOT NULL;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'prompt_replies' 
  AND column_name IN ('parent_reply_id', 'reply_count');
