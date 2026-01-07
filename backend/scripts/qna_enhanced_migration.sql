-- Q&A Enhanced Migration
-- Adds support for multiple answers per question and designated experts
-- Run after post_types_migration.sql

-- =============================================================================
-- STEP 1: Enhance qna_questions table
-- =============================================================================

-- Add is_locked and is_hidden columns for moderation
ALTER TABLE qna_questions ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE qna_questions ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- =============================================================================
-- STEP 2: Create qna_answers table (for multiple/detailed answers)
-- =============================================================================

CREATE TABLE IF NOT EXISTS qna_answers (
    id BIGSERIAL PRIMARY KEY,
    question_id BIGINT NOT NULL REFERENCES qna_questions(id) ON DELETE CASCADE,
    author_id BIGINT NOT NULL,
    author_type VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    media_urls JSONB,  -- Optional images/links in answer
    is_best_answer BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- STEP 3: Create qna_experts table (designated answerers)
-- =============================================================================

CREATE TABLE IF NOT EXISTS qna_experts (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    user_type VARCHAR(20) NOT NULL,
    added_by_id BIGINT NOT NULL,
    added_by_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_qna_expert UNIQUE(post_id, user_id, user_type)
);

-- =============================================================================
-- STEP 4: Create performance indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_qna_answers_question ON qna_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_qna_answers_author ON qna_answers(author_id, author_type);
CREATE INDEX IF NOT EXISTS idx_qna_experts_post ON qna_experts(post_id);

-- =============================================================================
-- VERIFICATION
-- =============================================================================

SELECT 'qna_questions columns:' as info;
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'qna_questions';

SELECT 'qna_answers exists:' as info;
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'qna_answers'
);

SELECT 'qna_experts exists:' as info;
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'qna_experts'
);
