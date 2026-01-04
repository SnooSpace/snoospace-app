-- Prompt Replies System Migration
-- Adds threaded replies, pinning, and hide functionality

-- =============================================================================
-- STEP 1: Add new columns to prompt_submissions
-- =============================================================================

-- Add is_pinned column for pinned responses
ALTER TABLE prompt_submissions ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- Add reply_count to track number of replies
ALTER TABLE prompt_submissions ADD COLUMN IF NOT EXISTS reply_count INT DEFAULT 0;

-- =============================================================================
-- STEP 2: Create prompt_replies table for threaded replies
-- =============================================================================

CREATE TABLE IF NOT EXISTS prompt_replies (
    id BIGSERIAL PRIMARY KEY,
    submission_id BIGINT NOT NULL REFERENCES prompt_submissions(id) ON DELETE CASCADE,
    author_id BIGINT NOT NULL,
    author_type VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    is_hidden BOOLEAN DEFAULT FALSE,
    hidden_at TIMESTAMP WITH TIME ZONE,
    hidden_by BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- STEP 3: Create indexes for performance
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_prompt_replies_submission ON prompt_replies(submission_id);
CREATE INDEX IF NOT EXISTS idx_prompt_replies_author ON prompt_replies(author_id, author_type);
CREATE INDEX IF NOT EXISTS idx_prompt_submissions_pinned ON prompt_submissions(post_id, is_pinned) WHERE is_pinned = TRUE;

-- =============================================================================
-- STEP 4: Migrate featured status to pinned
-- =============================================================================

-- Set is_pinned = TRUE for any featured submissions
UPDATE prompt_submissions SET is_pinned = TRUE WHERE status = 'featured';

-- Change status from 'featured' to 'approved'
UPDATE prompt_submissions SET status = 'approved' WHERE status = 'featured';

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Verify new columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'prompt_submissions' 
  AND column_name IN ('is_pinned', 'reply_count');

-- Verify prompt_replies table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'prompt_replies';
