-- Post Types System Migration
-- Adds support for multiple post types: media, poll, prompt, qna, challenge

-- =============================================================================
-- STEP 1: Extend posts table with type support
-- =============================================================================

-- Add post_type column (defaults to 'media' for backward compatibility)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_type VARCHAR(20) DEFAULT 'media';

-- Add status for lifecycle management
ALTER TABLE posts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Add expiry support
ALTER TABLE posts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Add visibility control
ALTER TABLE posts ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public';

-- Add pinning support
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- Add flexible type-specific data storage (JSONB)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS type_data JSONB DEFAULT '{}';

-- =============================================================================
-- STEP 2: Migrate existing posts (copy image_urls, etc. to type_data)
-- =============================================================================

-- For existing media posts, populate type_data from existing columns
UPDATE posts 
SET type_data = jsonb_build_object(
  'image_urls', COALESCE(image_urls::jsonb, '[]'::jsonb),
  'aspect_ratios', COALESCE(aspect_ratios::jsonb, '[]'::jsonb),
  'tagged_entities', COALESCE(tagged_entities::jsonb, '[]'::jsonb)
)
WHERE post_type = 'media' 
  AND (type_data IS NULL OR type_data = '{}'::jsonb);

-- =============================================================================
-- STEP 3: Create poll_votes table
-- =============================================================================

CREATE TABLE IF NOT EXISTS poll_votes (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    voter_id BIGINT NOT NULL,
    voter_type VARCHAR(20) NOT NULL,
    option_index INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_poll_vote UNIQUE(post_id, voter_id, voter_type)
);

-- =============================================================================
-- STEP 4: Create prompt_submissions table
-- =============================================================================

CREATE TABLE IF NOT EXISTS prompt_submissions (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id BIGINT NOT NULL,
    author_type VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    media_urls JSONB,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, featured
    moderated_by BIGINT,
    moderated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- STEP 5: Create qna_questions table
-- =============================================================================

CREATE TABLE IF NOT EXISTS qna_questions (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id BIGINT NOT NULL,
    author_type VARCHAR(20) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT,
    answered_at TIMESTAMP WITH TIME ZONE,
    answered_by BIGINT,
    is_pinned BOOLEAN DEFAULT FALSE,
    upvote_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- STEP 6: Create qna_question_upvotes table
-- =============================================================================

CREATE TABLE IF NOT EXISTS qna_question_upvotes (
    id BIGSERIAL PRIMARY KEY,
    question_id BIGINT NOT NULL REFERENCES qna_questions(id) ON DELETE CASCADE,
    voter_id BIGINT NOT NULL,
    voter_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_question_upvote UNIQUE(question_id, voter_id, voter_type)
);

-- =============================================================================
-- STEP 7: Create challenge_participations table
-- =============================================================================

CREATE TABLE IF NOT EXISTS challenge_participations (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    participant_id BIGINT NOT NULL,
    participant_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'joined', -- joined, in_progress, completed, verified
    submission_data JSONB,
    completed_at TIMESTAMP WITH TIME ZONE,
    verified_by BIGINT,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_challenge_participation UNIQUE(post_id, participant_id, participant_type)
);

-- =============================================================================
-- STEP 8: Create performance indexes
-- =============================================================================

-- Posts indexes
CREATE INDEX IF NOT EXISTS idx_posts_type_status ON posts(post_type, status);
CREATE INDEX IF NOT EXISTS idx_posts_expires_at ON posts(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_author_type ON posts(author_id, author_type, post_type);
CREATE INDEX IF NOT EXISTS idx_posts_pinned ON posts(is_pinned) WHERE is_pinned = TRUE;

-- Poll votes indexes
CREATE INDEX IF NOT EXISTS idx_poll_votes_post ON poll_votes(post_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_voter ON poll_votes(voter_id, voter_type);

-- Prompt submissions indexes
CREATE INDEX IF NOT EXISTS idx_prompt_submissions_post_status ON prompt_submissions(post_id, status);
CREATE INDEX IF NOT EXISTS idx_prompt_submissions_author ON prompt_submissions(author_id, author_type);

-- Q&A indexes
CREATE INDEX IF NOT EXISTS idx_qna_questions_post ON qna_questions(post_id);
CREATE INDEX IF NOT EXISTS idx_qna_questions_author ON qna_questions(author_id, author_type);
CREATE INDEX IF NOT EXISTS idx_qna_questions_upvotes ON qna_questions(post_id, upvote_count DESC);

-- Challenge participation indexes
CREATE INDEX IF NOT EXISTS idx_challenge_participations_post ON challenge_participations(post_id, status);
CREATE INDEX IF NOT EXISTS idx_challenge_participations_participant ON challenge_participations(participant_id, participant_type);

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Verify posts table has new columns
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'posts' 
  AND column_name IN ('post_type', 'status', 'expires_at', 'visibility', 'is_pinned', 'type_data');

-- Verify new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('poll_votes', 'prompt_submissions', 'qna_questions', 'qna_question_upvotes', 'challenge_participations');
