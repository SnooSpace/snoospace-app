-- Add media_types column to posts table for video support
-- This stores an array of media types ('image' | 'video') matching the image_urls array

ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_types JSONB DEFAULT '[]';

-- Comment explaining the column
COMMENT ON COLUMN posts.media_types IS 'Array of media types (image/video) matching image_urls array for video support';
