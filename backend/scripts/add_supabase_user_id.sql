-- Migration: Add supabase_user_id column to communities and sponsors tables
-- This allows authentication to work correctly even after email changes

-- Add supabase_user_id column to communities table
ALTER TABLE communities ADD COLUMN IF NOT EXISTS supabase_user_id TEXT;

-- Add supabase_user_id column to sponsors table
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS supabase_user_id TEXT;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_communities_supabase_user_id ON communities(supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_sponsors_supabase_user_id ON sponsors(supabase_user_id);

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('communities', 'sponsors') 
  AND column_name = 'supabase_user_id';
