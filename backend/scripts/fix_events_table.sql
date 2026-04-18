-- Fix events table schema
-- This script adds missing columns to the events table

-- First, check if event_date exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'event_date'
  ) THEN
    ALTER TABLE events ADD COLUMN event_date TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Add other missing columns
ALTER TABLE events ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS layout_data JSONB;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'in-person';
ALTER TABLE events ADD COLUMN IF NOT EXISTS virtual_link TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES communities(id);

-- Add constraint for event_type
DO $$ 
BEGIN
  ALTER TABLE events DROP CONSTRAINT IF EXISTS event_type_check;
  ALTER TABLE events ADD CONSTRAINT event_type_check CHECK (event_type IN ('in-person', 'virtual', 'hybrid'));
EXCEPTION 
  WHEN OTHERS THEN NULL; 
END $$;

-- Verify the table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'events'
ORDER BY ordinal_position;
