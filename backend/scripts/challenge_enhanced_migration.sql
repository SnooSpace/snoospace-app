-- Challenge Enhanced Migration
-- Adds separate submissions table and additional columns for challenge posts
-- Run after post_types_migration.sql

-- =============================================================================
-- STEP 1: Enhance challenge_participations table
-- =============================================================================

-- Add progress and highlight columns
ALTER TABLE challenge_participations ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE challenge_participations ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT FALSE;

-- =============================================================================
-- STEP 2: Create challenge_submissions table (proof submissions)
-- =============================================================================

CREATE TABLE IF NOT EXISTS challenge_submissions (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    participant_id BIGINT NOT NULL REFERENCES challenge_participations(id) ON DELETE CASCADE,
    content TEXT,  -- Caption/description
    media_urls JSONB,  -- Images
    video_url TEXT,  -- For video challenges
    video_thumbnail TEXT,  -- Thumbnail for video
    submission_type VARCHAR(20) DEFAULT 'image',  -- 'text', 'image', 'video'
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
    like_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,  -- Admin can feature top submissions
    moderated_by BIGINT,
    moderated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- STEP 3: Create challenge_submission_likes table
-- =============================================================================

CREATE TABLE IF NOT EXISTS challenge_submission_likes (
    id BIGSERIAL PRIMARY KEY,
    submission_id BIGINT NOT NULL REFERENCES challenge_submissions(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    user_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_challenge_submission_like UNIQUE(submission_id, user_id, user_type)
);

-- =============================================================================
-- STEP 4: Create performance indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_challenge_submissions_post ON challenge_submissions(post_id);
CREATE INDEX IF NOT EXISTS idx_challenge_submissions_participant ON challenge_submissions(participant_id);
CREATE INDEX IF NOT EXISTS idx_challenge_submissions_status ON challenge_submissions(post_id, status);
CREATE INDEX IF NOT EXISTS idx_challenge_submissions_featured ON challenge_submissions(post_id, is_featured) 
    WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_challenge_submission_likes ON challenge_submission_likes(submission_id);

-- =============================================================================
-- VERIFICATION
-- =============================================================================

SELECT 'challenge_participations columns:' as info;
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'challenge_participations';

SELECT 'challenge_submissions exists:' as info;
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'challenge_submissions'
);
