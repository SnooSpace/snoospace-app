-- Migration 046: Case-insensitive unique index on username for all user tables
-- Run SELECT lower(username), count(*) FROM <table> GROUP BY 1 HAVING count(*) > 1
-- on each table before applying. If any rows return, dedupe manually first.
-- (Checked clean as of 2026-07-11)

-- Members
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_username_lower
  ON members (lower(username))
  WHERE username IS NOT NULL;

-- Communities
CREATE UNIQUE INDEX IF NOT EXISTS idx_communities_username_lower
  ON communities (lower(username))
  WHERE username IS NOT NULL;

-- Sponsors
CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsors_username_lower
  ON sponsors (lower(username))
  WHERE username IS NOT NULL;

-- Venues
CREATE UNIQUE INDEX IF NOT EXISTS idx_venues_username_lower
  ON venues (lower(username))
  WHERE username IS NOT NULL;
