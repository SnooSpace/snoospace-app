-- Migration: Add aspect_ratios column to posts table
-- This column stores an array of aspect ratios (one per image) for dynamic feed display
-- Values are stored as decimal numbers (e.g., 0.8 for 4:5, 1.0 for 1:1)

ALTER TABLE posts ADD COLUMN IF NOT EXISTS aspect_ratios JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN posts.aspect_ratios IS 'Array of aspect ratios for each image, e.g., [0.8, 1.0, 0.8] for 4:5, 1:1, 4:5';

-- Optional: If you want to set default for existing posts with images
-- UPDATE posts SET aspect_ratios = '[]'::jsonb WHERE aspect_ratios IS NULL AND image_urls IS NOT NULL;
