-- Add crop_metadata column to posts table if it doesn't exist
ALTER TABLE posts ADD COLUMN IF NOT EXISTS crop_metadata TEXT;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'posts' AND column_name = 'crop_metadata';
