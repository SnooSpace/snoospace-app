-- Migration: Add Spotify Top Tracks column to members table
ALTER TABLE members
ADD COLUMN IF NOT EXISTS spotify_top_tracks JSONB DEFAULT NULL;
