-- Add edited_at and edit_history columns to posts table
-- Migration: post_edit_tracking

-- Add edited_at timestamp column
ALTER TABLE posts
ADD COLUMN edited_at TIMESTAMP DEFAULT NULL;

-- Add edit_history JSONB column (for admins)
ALTER TABLE posts
ADD COLUMN edit_history JSONB DEFAULT '[]'::jsonb;

-- Add index for edited_at for performance
CREATE INDEX idx_posts_edited_at ON posts(edited_at) WHERE edited_at IS NOT NULL;

-- Add comment to describe the columns
COMMENT ON COLUMN posts.edited_at IS 'Timestamp when post was last edited';
COMMENT ON COLUMN posts.edit_history IS 'Array of edit history objects (for admin users only)';
