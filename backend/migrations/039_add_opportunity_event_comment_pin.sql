-- Adds is_pinned column to opportunity_comments and event_comments
ALTER TABLE opportunity_comments ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE event_comments ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
