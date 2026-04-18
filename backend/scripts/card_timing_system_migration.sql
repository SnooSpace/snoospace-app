-- Card Timing System Migration
-- Adds timing behavior, state management, and extension tracking per design specification
-- Run this after post_types_migration.sql

-- =============================================================================
-- STEP 1: Add timing fields to posts table
-- =============================================================================

-- Add original_end_time for audit trail (tracks original deadline before any extensions)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS original_end_time TIMESTAMP WITH TIME ZONE;

-- Add extended_at timestamp (when last extension occurred)
ALTER TABLE posts  ADD COLUMN IF NOT EXISTS extended_at TIMESTAMP WITH TIME ZONE;

-- Add extension_count to track number of extensions
ALTER TABLE posts ADD COLUMN IF NOT EXISTS extension_count INTEGER DEFAULT 0;

-- Backfill original_end_time for existing posts with expires_at
UPDATE posts 
SET original_end_time = expires_at 
WHERE expires_at IS NOT NULL AND original_end_time IS NULL;

-- =============================================================================
-- STEP 2: Add Q&A resolution state (replaces expiration logic)
-- =============================================================================

-- Add resolved state to qna_questions table
ALTER TABLE qna_questions ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE qna_questions ADD COLUMN IF NOT EXISTS resolved_by_user_id BIGINT;
ALTER TABLE qna_questions ADD COLUMN IF NOT EXISTS best_answer_id BIGINT REFERENCES qna_answers(id);

-- =============================================================================
-- STEP 3: Add Opportunity closure tracking
-- =============================================================================

-- Add closed_at timestamp for opportunities
ALTER TABLE posts ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

-- Add closure_type enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'closure_type_enum') THEN
        CREATE TYPE closure_type_enum AS ENUM ('automatic', 'manual', 'extended_then_closed');
    END IF;
END$$;

ALTER TABLE posts ADD COLUMN IF NOT EXISTS closure_type closure_type_enum;

-- =============================================================================
-- STEP 4: Create card_extensions audit log table
-- =============================================================================

CREATE TABLE IF NOT EXISTS card_extensions (
    id BIGSERIAL PRIMARY KEY,
    card_type VARCHAR(20) NOT NULL CHECK (card_type IN ('poll', 'challenge', 'opportunity')),
    card_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    original_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    new_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    extended_by_user_id BIGINT NOT NULL,
    extended_by_user_type VARCHAR(20) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- STEP 5: Create indexes for timing queries
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_posts_end_time ON posts(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_closed_at ON posts(closed_at) WHERE closed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_extension_count ON posts(extension_count) WHERE extension_count > 0;

CREATE INDEX IF NOT EXISTS idx_qna_resolved ON qna_questions(resolved_at) WHERE resolved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_card_extensions_card ON card_extensions(card_type, card_id);
CREATE INDEX IF NOT EXISTS idx_card_extensions_created ON card_extensions(created_at DESC);

-- =============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'Posts timing columns:' as info;
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'posts' 
  AND column_name IN ('expires_at', 'original_end_time', 'extended_at', 'extension_count', 'closed_at', 'closure_type');

SELECT 'QnA resolution columns:' as info;
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'qna_questions'
  AND column_name IN ('resolved_at', 'resolved_by_user_id', 'best_answer_id');

SELECT 'Extension audit table exists:' as info;
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'card_extensions'
);
