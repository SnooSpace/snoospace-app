-- Migration: Replace location TEXT with location_url TEXT
-- This migration renames the location column to location_url

-- Step 1: Check if location column exists and rename it
DO $$
BEGIN
    -- Check if location column exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'events' 
        AND column_name = 'location'
    ) THEN
        -- Check if location_url already exists
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'events' 
            AND column_name = 'location_url'
        ) THEN
            -- Rename location to location_url
            ALTER TABLE events RENAME COLUMN location TO location_url;
            RAISE NOTICE 'Renamed location column to location_url';
        ELSE
            RAISE NOTICE 'location_url column already exists, skipping rename';
        END IF;
    ELSE
        RAISE NOTICE 'location column does not exist, adding location_url';
        -- Add location_url column if it doesn't exist
        ALTER TABLE events ADD COLUMN location_url TEXT;
    END IF;
END $$;

-- Verification query (run this to check migration)
-- SELECT id, title, location_url, event_type FROM events LIMIT 10;
