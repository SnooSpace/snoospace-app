-- Add status column to conversations for Group Lifecycle Management
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';

-- Add closed metadata columns to conversations for Group Lifecycle Management
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS closed_by_id BIGINT,
ADD COLUMN IF NOT EXISTS closed_by_type VARCHAR(20);

-- Backfill any existing NULL values to ACTIVE
UPDATE conversations SET status = 'ACTIVE' WHERE status IS NULL;
