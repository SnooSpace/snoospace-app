-- ============================================================
-- OTP-Only Multi-Account Auth System Migration
-- ============================================================
-- This migration:
-- 1. Creates the sessions table for device-based session management
-- 2. Removes email UNIQUE constraints (allows multi-account per email)
-- 3. Drops supabase_user_id from all user tables
-- ============================================================

-- ============================================================
-- STEP 1: Create Sessions Table
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('member', 'community', 'sponsor', 'venue')),
  device_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, user_type, device_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_sessions_device ON sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_access_token ON sessions(access_token);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, user_type);

-- ============================================================
-- STEP 2: Remove Email UNIQUE Constraints
-- This allows multiple accounts of the same type per email
-- ============================================================

-- Members: Drop email unique constraint
DO $$ BEGIN
  ALTER TABLE members DROP CONSTRAINT IF EXISTS members_email_key;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Keep an index on email for fast lookups (not unique)
CREATE INDEX IF NOT EXISTS idx_members_email ON members(LOWER(email));

-- Communities: Drop email unique constraint
DO $$ BEGIN
  ALTER TABLE communities DROP CONSTRAINT IF EXISTS communities_email_key;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_communities_email ON communities(LOWER(email));

-- Sponsors: Drop email unique constraint
DO $$ BEGIN
  ALTER TABLE sponsors DROP CONSTRAINT IF EXISTS sponsors_email_key;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_sponsors_email ON sponsors(LOWER(email));

-- Venues: Drop contact_email unique constraint
DO $$ BEGIN
  ALTER TABLE venues DROP CONSTRAINT IF EXISTS venues_contact_email_key;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_venues_contact_email ON venues(LOWER(contact_email));

-- ============================================================
-- STEP 3: Drop supabase_user_id Columns
-- ============================================================

-- Members
ALTER TABLE members DROP COLUMN IF EXISTS supabase_user_id;

-- Communities  
ALTER TABLE communities DROP COLUMN IF EXISTS supabase_user_id;

-- Sponsors
ALTER TABLE sponsors DROP COLUMN IF EXISTS supabase_user_id;

-- Venues
ALTER TABLE venues DROP COLUMN IF EXISTS supabase_user_id;

-- ============================================================
-- STEP 4: Add user_id column to communities if missing
-- (This was nullable before, now it's deprecated anyway)
-- ============================================================
-- The 'id' column IS the user_id. No changes needed.

-- ============================================================
-- Verification Queries (run manually to check)
-- ============================================================
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'sessions';

-- SELECT conname FROM pg_constraint 
-- WHERE conrelid = 'members'::regclass AND contype = 'u';

-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name = 'members' AND column_name = 'supabase_user_id';
