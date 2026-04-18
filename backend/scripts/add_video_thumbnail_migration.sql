-- Migration: Add video_thumbnail column to posts table
-- Purpose: Store generated video thumbnails during post creation
-- Date: 2026-02-05

-- Add video_thumbnail column to store Cloudinary thumbnail URLs
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS video_thumbnail TEXT;

-- Comment explaining the column
COMMENT ON COLUMN posts.video_thumbnail IS 'Cloudinary thumbnail URL for video posts (first frame as JPEG)';
