-- Migration 023: Creator Mode
-- Adds Creator Mode toggle columns to the members table.
-- Also creates the creator_profiles table for storing content categories
-- and sponsorship preferences.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS is_creator_mode_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS creator_mode_enabled_at TIMESTAMPTZ;

-- Creator profile preferences (persists even when Creator Mode is toggled off)
-- people_id uses BIGINT to match members.id type
CREATE TABLE IF NOT EXISTS creator_profiles (
  people_id           BIGINT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  content_categories  TEXT[]  DEFAULT '{}',
  sponsor_types       TEXT[]  DEFAULT '{}',
  open_to_all_sponsors BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
