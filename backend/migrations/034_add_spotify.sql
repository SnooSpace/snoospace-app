-- Migration: Add Spotify Columns to Members
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS spotify_connected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS spotify_top_artists JSONB DEFAULT NULL;

-- Index for querying connected spotify accounts if needed
CREATE INDEX IF NOT EXISTS idx_members_spotify_connected ON members(spotify_connected);
