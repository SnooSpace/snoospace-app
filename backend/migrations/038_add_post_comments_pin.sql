-- Adds is_pinned column to post_comments
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
