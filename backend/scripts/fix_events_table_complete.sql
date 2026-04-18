-- Complete events table migration
-- This adds ALL missing columns needed for event creation

-- Add ALL missing columns from the original schema
ALTER TABLE events ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_date TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_id BIGINT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS max_attendees INTEGER;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_past BOOLEAN DEFAULT false;

-- Add new columns for event creation feature
ALTER TABLE events ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS layout_data JSONB;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'in-person';
ALTER TABLE events ADD COLUMN IF NOT EXISTS virtual_link TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by BIGINT;

-- Add foreign key constraints if they don't exist
DO $$ 
BEGIN
  -- Add venue_id foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'events_venue_id_fkey' 
    AND table_name = 'events'
  ) THEN
    ALTER TABLE events ADD CONSTRAINT events_venue_id_fkey 
    FOREIGN KEY (venue_id) REFERENCES venues(id);
  END IF;

  -- Add created_by foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'events_created_by_fkey' 
    AND table_name = 'events'
  ) THEN
    ALTER TABLE events ADD CONSTRAINT events_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES communities(id);
  END IF;
EXCEPTION 
  WHEN OTHERS THEN 
    RAISE NOTICE 'Could not add foreign keys: %', SQLERRM;
END $$;

-- Add constraint for event_type
DO $$ 
BEGIN
  ALTER TABLE events DROP CONSTRAINT IF EXISTS event_type_check;
  ALTER TABLE events ADD CONSTRAINT event_type_check 
  CHECK (event_type IN ('in-person', 'virtual', 'hybrid'));
EXCEPTION 
  WHEN OTHERS THEN 
    RAISE NOTICE 'Could not add event_type constraint: %', SQLERRM;
END $$;

-- Make title and event_date NOT NULL if they aren't already
-- (but only if the column exists and has no null values)
DO $$ 
BEGIN
  -- Check if title can be made NOT NULL
  IF NOT EXISTS (SELECT 1 FROM events WHERE title IS NULL) THEN
    ALTER TABLE events ALTER COLUMN title SET NOT NULL;
  END IF;
EXCEPTION 
  WHEN OTHERS THEN 
    RAISE NOTICE 'Could not set title NOT NULL: %', SQLERRM;
END $$;

DO $$ 
BEGIN
  -- Check if event_date can be made NOT NULL
  IF NOT EXISTS (SELECT 1 FROM events WHERE event_date IS NULL) THEN
    ALTER TABLE events ALTER COLUMN event_date SET NOT NULL;
  END IF;
EXCEPTION 
  WHEN OTHERS THEN 
    RAISE NOTICE 'Could not set event_date NOT NULL: %', SQLERRM;
END $$;

-- Verify the final table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'events'
ORDER BY ordinal_position;
