-- Migration: Replace location JSONB with location_url TEXT
-- This migration changes the events table to store Google Maps URLs instead of coordinate objects

-- Step 1: Add new column
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS location_url TEXT;

-- Step 2: Migrate existing data
-- For events with location JSON containing a URL
UPDATE events 
SET location_url = location->>'url'
WHERE location IS NOT NULL AND location->>'url' IS NOT NULL;

-- For events with only coordinates, create Google Maps search URL
UPDATE events 
SET location_url = CONCAT(
  'https://www.google.com/maps/search/?api=1&query=',
  location->>'lat', ',', location->>'lng'
)
WHERE location IS NOT NULL 
  AND location->>'lat' IS NOT NULL 
  AND location_url IS NULL;

-- Step 3: Drop old location column
ALTER TABLE events 
DROP COLUMN IF EXISTS location;

-- Verification query (run this to check migration)
-- SELECT id, title, location_url FROM events WHERE event_type IN ('in-person', 'hybrid') LIMIT 10;
