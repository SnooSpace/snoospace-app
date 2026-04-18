-- ============================================
-- ADD show_heads COLUMN TO communities TABLE
-- Run this in Supabase SQL Editor
-- ============================================

-- Add show_heads boolean column, defaulting to true (visible)
ALTER TABLE communities 
  ADD COLUMN IF NOT EXISTS show_heads BOOLEAN DEFAULT true;

-- Backfill existing rows with true (show by default)
UPDATE communities 
  SET show_heads = true 
  WHERE show_heads IS NULL;

-- Verification
-- SELECT id, name, show_heads FROM communities LIMIT 5;
