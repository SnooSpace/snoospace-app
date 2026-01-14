-- ============================================
-- COMMUNITY SIGNUP RESTRUCTURING MIGRATION
-- Run this script in Supabase SQL Editor
-- ============================================

-- 1. Create colleges table
CREATE TABLE IF NOT EXISTS colleges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT DEFAULT 'India',
  website TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  request_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_colleges_name ON colleges(name);
CREATE INDEX IF NOT EXISTS idx_colleges_status ON colleges(status);
CREATE INDEX IF NOT EXISTS idx_colleges_city ON colleges(city);

-- 2. Create branches table with India-first list
CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  display_order INTEGER
);

INSERT INTO branches (name, display_order) VALUES
  ('Open to All', 0),
  ('Computer Science / IT', 1),
  ('Electronics & Communication', 2),
  ('Electrical', 3),
  ('Mechanical', 4),
  ('Civil', 5),
  ('Chemical', 6),
  ('Biotechnology', 7),
  ('Artificial Intelligence / Data Science', 8),
  ('Management / MBA', 9),
  ('Architecture / Design', 10),
  ('Arts / Humanities', 11),
  ('Commerce', 12),
  ('Science (General)', 13),
  ('Law', 14),
  ('Medical / Healthcare', 15)
ON CONFLICT (name) DO NOTHING;

-- 3. Add new columns to communities table
ALTER TABLE communities ADD COLUMN IF NOT EXISTS community_type TEXT 
  CHECK (community_type IN ('individual_organizer', 'college_affiliated', 'organization'));

ALTER TABLE communities ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES colleges(id);

ALTER TABLE communities ADD COLUMN IF NOT EXISTS college_subtype TEXT 
  CHECK (college_subtype IN ('event', 'club', 'student_community'));

ALTER TABLE communities ADD COLUMN IF NOT EXISTS club_type TEXT 
  CHECK (club_type IN ('official_club', 'department', 'society'));

ALTER TABLE communities ADD COLUMN IF NOT EXISTS community_theme TEXT;

ALTER TABLE communities ADD COLUMN IF NOT EXISTS is_sponsor_visible BOOLEAN DEFAULT false;

ALTER TABLE communities ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'not_requested'
  CHECK (verification_status IN ('not_requested', 'pending', 'approved', 'rejected'));

-- 4. Migrate existing communities to 'organization' type
UPDATE communities 
SET community_type = 'organization', is_sponsor_visible = true 
WHERE community_type IS NULL;

-- 5. Add college context fields to members table (optional, for member profile)
ALTER TABLE members ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES colleges(id);
ALTER TABLE members ADD COLUMN IF NOT EXISTS passout_year INTEGER;
ALTER TABLE members ADD COLUMN IF NOT EXISTS show_college_on_profile BOOLEAN DEFAULT false;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_communities_type ON communities(community_type);
CREATE INDEX IF NOT EXISTS idx_communities_college_id ON communities(college_id);
CREATE INDEX IF NOT EXISTS idx_communities_college_subtype ON communities(college_subtype);
CREATE INDEX IF NOT EXISTS idx_members_college_id ON members(college_id);

-- Verification: Check migration results
-- SELECT id, name, community_type, is_sponsor_visible FROM communities;
