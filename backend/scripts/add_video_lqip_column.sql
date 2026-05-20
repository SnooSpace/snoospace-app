-- Migration: Add video_lqip column to posts table
-- Low-Quality Image Placeholder (LQIP) for video posts
-- Stores a Cloudinary URL for a tiny blurred JPEG (~2KB) that loads instantly
-- while the real thumbnail/video buffers.

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS video_lqip TEXT;

COMMENT ON COLUMN posts.video_lqip IS 'Cloudinary LQIP URL for video posts (40px wide, blurred JPEG for instant placeholder)';
