-- Multi-Account Authentication System Migration
-- Adds signup_status state machine and draft tracking

-- Add signup_status column to members table
ALTER TABLE members ADD COLUMN IF NOT EXISTS signup_status TEXT DEFAULT 'ACTIVE';
ALTER TABLE members ADD COLUMN IF NOT EXISTS last_completed_step TEXT;

-- Add signup_status column to communities table
ALTER TABLE communities ADD COLUMN IF NOT EXISTS signup_status TEXT DEFAULT 'ACTIVE';
ALTER TABLE communities ADD COLUMN IF NOT EXISTS last_completed_step TEXT;

-- Add signup_status column to sponsors table  
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS signup_status TEXT DEFAULT 'ACTIVE';
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS last_completed_step TEXT;

-- Add signup_status column to venues table
ALTER TABLE venues ADD COLUMN IF NOT EXISTS signup_status TEXT DEFAULT 'ACTIVE';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS last_completed_step TEXT;

-- Create indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_members_signup_status ON members(signup_status);
CREATE INDEX IF NOT EXISTS idx_members_email_status ON members(email, signup_status);

CREATE INDEX IF NOT EXISTS idx_communities_signup_status ON communities(signup_status);
CREATE INDEX IF NOT EXISTS idx_communities_email_status ON communities(email, signup_status);

CREATE INDEX IF NOT EXISTS idx_sponsors_signup_status ON sponsors(signup_status);
CREATE INDEX IF NOT EXISTS idx_sponsors_email_status ON sponsors(email, signup_status);

CREATE INDEX IF NOT EXISTS idx_venues_signup_status ON venues(signup_status);
CREATE INDEX IF NOT EXISTS idx_venues_email_status ON venues(contact_email, signup_status);

-- Update any existing records without signup_status to ACTIVE
UPDATE members SET signup_status = 'ACTIVE' WHERE signup_status IS NULL;
UPDATE communities SET signup_status = 'ACTIVE' WHERE signup_status IS NULL;
UPDATE sponsors SET signup_status = 'ACTIVE' WHERE signup_status IS NULL;
UPDATE venues SET signup_status = 'ACTIVE' WHERE signup_status IS NULL;

-- Add comment explaining the state machine
COMMENT ON COLUMN members.signup_status IS 'Profile state: IN_PROGRESS (draft), ACTIVE (complete), DELETED (soft delete)';
COMMENT ON COLUMN members.last_completed_step IS 'Last completed signup step for resume functionality';
